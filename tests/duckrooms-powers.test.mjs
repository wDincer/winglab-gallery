import test from 'node:test';
import assert from 'node:assert/strict';
import {EXIT_CELL,InfiniteMaze,MAZE,cellCenter} from '../public/oyunlar/duckrooms/maze.js?v=duck-waves-v1';
import {BOX_PICKUP_RADIUS,POWER_DURATION,createPowerState,syncPowerBoxes,stepPowers,monsterPowerFactor,hasMonsterShield,playerPowerFactor} from '../public/oyunlar/duckrooms/powers.js';

const room=(x,z)=>({...cellCenter({x,z}),cellX:x,cellZ:z});
function groupRooms(groupX=0,groupZ=0){
  return Array.from({length:10},(_,index)=>room(groupX*5+index%5,groupZ*2+Math.floor(index/5)));
}
function state(rooms=groupRooms(),random=()=>0,monsters=[]){
  return {...createPowerState(),maze:{layout:{rooms,walls:[]}},player:{x:0,y:1,z:0},events:[],random,monsters};
}
function collect(run){
  const box=syncPowerBoxes(run)[0];
  assert.ok(box,'test has an available reward');
  run.player={x:box.x,y:box.y,z:box.z};
  stepPowers(run,{...run.player},1/60);
  return box;
}

test('exactly one of each ten rooms has a floating box across positive and negative groups',()=>{
  const rooms=[];
  for(let z=-8;z<=8;z++)for(let x=-8;x<=8;x++)rooms.push(...groupRooms(x,z));
  const run=state(rooms),boxes=syncPowerBoxes(run),counts=new Map();
  assert.equal(boxes.length,17*17);
  assert.equal(new Set(boxes.map(box=>box.id)).size,boxes.length);
  for(const box of boxes){
    const group=Math.floor(box.cellX/5)+','+Math.floor(box.cellZ/2);
    counts.set(group,(counts.get(group)??0)+1);
    assert.notDeepEqual({x:box.cellX,z:box.cellZ},{x:0,z:0},'launch room has no accidental pickup');
    assert.notDeepEqual({x:box.cellX,z:box.cellZ},EXIT_CELL,'the exit stays clear');
    assert.equal(box.y,1.3);
    assert.equal(box.radius,BOX_PICKUP_RADIUS);
  }
  assert.equal(counts.size,17*17);
  assert.ok([...counts.values()].every(count=>count===1));
});

test('box positions fit actual generated rooms without intersecting walls or pillars',()=>{
  const maze=new InfiniteMaze(),run={...createPowerState(),maze};
  let checked=0;
  for(const cell of[{x:0,z:0},{x:18,z:14},{x:-9,z:5},{x:4,z:-10},{x:-12,z:-12}]){
    maze.update(cellCenter(cell));
    for(const box of syncPowerBoxes(run)){
      checked++;
      assert.ok(box.y-.4>MAZE.floorCenter&&box.y+.4<MAZE.ceiling);
      assert.ok(Math.abs(box.x-box.cellX*MAZE.cellSize)<MAZE.cellSize/2-1);
      assert.ok(Math.abs(box.z-box.cellZ*MAZE.cellSize)<MAZE.cellSize/2-1);
      for(const wall of maze.layout.walls){
        const dx=Math.max(0,Math.abs(box.x-wall.x)-wall.w/2),dz=Math.max(0,Math.abs(box.z-wall.z)-wall.d/2);
        assert.ok(Math.hypot(dx,dz)>BOX_PICKUP_RADIUS,'reward has room for the duck to collect it');
      }
    }
  }
  assert.ok(checked>30,'multiple generated chunks and supports were covered');
});

test('consumed boxes stay gone after leaving and regenerating their loaded rooms',()=>{
  const rooms=groupRooms(-2,3),run=state(rooms),first=syncPowerBoxes(run);
  assert.equal(syncPowerBoxes(run),first,'no per-frame box array rebuild');
  const box=collect(run);
  assert.equal(run.boxesCollected,1);
  assert.ok(run.collectedBoxes.has(box.id));
  assert.deepEqual(run.boxes,[]);
  run.maze.layout={rooms:groupRooms(8,-9),walls:[]};
  assert.equal(syncPowerBoxes(run).length,1);
  run.maze.layout={rooms:rooms.map(entry=>({...entry})),walls:[]};
  assert.deepEqual(syncPowerBoxes(run),[],'revisiting cannot farm the same box');
});

for(const[sample,type,factor,shield]of[[0,'freeze',0,false],[.4,'slow',.45,false],[.999,'shield',1,true]]){
  test('a monster encounter can award '+type+' for exactly fifteen active seconds',()=>{
    const run=state(groupRooms(),()=>sample,[{stage:'chasing'}]);
    collect(run);
    assert.equal(run.power.type,type);
    assert.equal(run.power.remaining,POWER_DURATION);
    assert.equal(run.power.duration,15);
    assert.equal(monsterPowerFactor(run),factor);
    assert.equal(hasMonsterShield(run),shield);
    assert.equal(playerPowerFactor(run),1,'danger rewards target the monsters');
    assert.ok(run.events.includes('power-collected'));
    run.events=[];
    stepPowers(run,run.player,14.9);
    assert.ok(run.power?.remaining>0,'effect remains until the entire duration elapses');
    stepPowers(run,run.player,.1);
    assert.equal(run.power,null);
    assert.equal(monsterPowerFactor(run),1);
    assert.equal(hasMonsterShield(run),false);
    assert.ok(run.events.includes('power-ended'));
  });
}

test('calm rooms randomly award boost or shield and retreating monsters do not bias the reward',()=>{
  for(const[sample,type,factor]of[[0,'boost',1.35],[.999,'shield',1]]){
    const run=state(groupRooms(),()=>sample,[{stage:'retreating'}]);
    collect(run);
    assert.equal(run.power.type,type);
    assert.equal(playerPowerFactor(run),factor);
  }
  const legacy=state();delete legacy.monsters;legacy.monster={stage:'emerging'};
  collect(legacy);
  assert.equal(legacy.power.type,'freeze','single-monster integrations get the same danger rewards');
});

test('a swept airborne pass collects even when neither frame endpoint overlaps the box',()=>{
  const run=state(),box=syncPowerBoxes(run)[0];
  const previous={x:box.x-2,y:1,z:box.z};
  run.player={x:box.x+2,y:1,z:box.z};
  stepPowers(run,previous,.1);
  assert.equal(run.boxesCollected,1);
  assert.equal(run.power?.type,'boost');
  assert.equal(run.power?.remaining,15,'new pickup starts a full duration after frame time');
});

test('grounded and distant flight passes cannot collect the floating reward',()=>{
  for(const[y,zOffset]of[[MAZE.floorCenter,0],[1.3,BOX_PICKUP_RADIUS+.01]]){
    const run=state(),box=syncPowerBoxes(run)[0];
    run.player={x:box.x,y,z:box.z+zOffset};
    stepPowers(run,run.player,.1);
    assert.equal(run.power,null);
    assert.equal(run.boxesCollected,0);
  }
});

test('pause or tracking loss with zero active time freezes the effect and prevents pickup',()=>{
  const run=state(),box=syncPowerBoxes(run)[0];
  run.player={x:box.x,y:1.3,z:box.z};
  for(const dt of[0,-1,NaN,Infinity])stepPowers(run,run.player,dt);
  assert.equal(run.power,null);
  assert.equal(run.boxesCollected,0);
  stepPowers(run,run.player,.1);
  for(const dt of[0,-1,NaN,Infinity])stepPowers(run,run.player,dt);
  assert.equal(run.power.remaining,15);
});

test('a different box replaces the previous power and resets its duration without stacking',()=>{
  const run=state([...groupRooms(),...groupRooms(1,0)]);
  collect(run);
  stepPowers(run,run.player,10);
  assert.equal(run.power.remaining,5);
  run.random=()=>.999;
  collect(run);
  assert.equal(run.power.type,'shield');
  assert.equal(run.power.remaining,15);
  assert.equal(playerPowerFactor(run),1,'replaced boost no longer applies');
  assert.equal(run.boxesCollected,2);
});
