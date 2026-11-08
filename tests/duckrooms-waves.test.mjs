import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,stepRun,ROOMS,waveSize,monsterMultiplier,monsterDistance,seesMonster} from '../public/oyunlar/duckrooms/rooms.js';
import {cellAt} from '../public/oyunlar/duckrooms/maze.js?v=duck-waves-v1';

const input={active:true,angle:90,bank:0};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function arena(){
  const run=createRun({random:()=>.1});
  run.nextEncounter=Infinity;
  run.maze.update=()=>{};
  run.maze.layout={...run.maze.layout,walls:[],rooms:[]};
  return run;
}
function enemy(x,z=0,stage='chasing'){
  return {x,z,stage,age:0,seen:false,path:[],repath:0,spawnCell:{x:4,z:0},retreatAge:0,speedMultiplier:1};
}
function startWave(escaped=0,sample=.1,heading=0){
  const run=arena();
  run.escaped=escaped;run.random=()=>sample;
  run.elapsed=ROOMS.firstEncounterAfter;run.travelled=ROOMS.firstEncounterDistance;run.nextEncounter=run.elapsed;
  Object.assign(run.flight,{flying:true,altitude:12,speed:78,heading});
  stepRun(run,input,1/60);
  return run;
}

test('each escape compounds speed and every second escape adds one monster without a population cap',()=>{
  for(const escaped of [0,1,2,3,4,10]){
    const run=startWave(escaped);
    assert.equal(run.monsters.length,1+Math.floor(escaped/2));
    assert.equal(waveSize(escaped),run.monsters.length);
    close(monsterMultiplier(escaped),1.1**escaped);
    for(const monster of run.monsters)close(monster.speedMultiplier,1.1**escaped);
    assert.equal(new Set(run.monsters.map(monster=>`${monster.spawnCell.x},${monster.spawnCell.z}`)).size,run.monsters.length);
  }
});

test('the sixty percent threshold chooses the forward hemisphere across all four headings',()=>{
  for(const heading of [0,90,180,270]){
    let ahead=0;
    for(let bucket=0;bucket<10;bucket++){
      const sample=(bucket+.5)/10,run=startWave(0,sample,heading),monster=run.monsters[0];
      assert.equal(monster.requestedAhead,sample<.6);
      assert.equal(monster.spawnAhead,sample<.6,'both legal direction pools are available');
      const radians=heading*Math.PI/180,dx=monster.x-run.player.x,dz=monster.z-run.player.z;
      const forward=(dx*Math.sin(radians)-dz*Math.cos(radians))/Math.hypot(dx,dz);
      assert.equal(forward>.15,monster.spawnAhead);
      assert.ok(run.maze.path(cellAt(run.player),monster.spawnCell).length-1>=2);
      ahead+=Number(monster.spawnAhead);
    }
    assert.equal(ahead,6);
  }
});

test('all members of a wave share one chase clock and yield only one escape',()=>{
  const run=arena();run.escaped=4;run.monsters=[enemy(30),enemy(35),enemy(40)];run.chaseRemaining=.05;
  stepRun(run,input,.1);
  assert.equal(run.escaped,5);
  assert.equal(run.monsters.length,3);
  assert.equal(run.events.filter(event=>event==='escaped').length,1);
  assert.ok(run.monsters.every(monster=>monster.stage==='retreating'));
  assert.equal(run.nextEncounter,run.elapsed+ROOMS.encounterCooldown);
  stepRun(run,input,.1);
  assert.equal(run.escaped,5,'retreating enemies cannot count as further escapes');
  assert.ok(!run.events.includes('escaped'));
});

test('actual chasing movement follows the compounded speed multiplier for every enemy',()=>{
  for(const escaped of [0,1,2,4]){
    const run=arena();run.escaped=escaped;run.chaseRemaining=15;
    run.monsters=[enemy(80),enemy(100)];
    for(const monster of run.monsters)monster.speedMultiplier=monsterMultiplier(escaped);
    stepRun(run,input,.1);
    close(80-run.monsters[0].x,ROOMS.monsterSpeed*1.1**escaped*.1);
    close(100-run.monsters[1].x,ROOMS.monsterSpeed*1.1**escaped*.1);
  }
});

test('a visible member starts the entire wave chasing while a hidden member remains tracked',()=>{
  const run=arena();run.flight.heading=0;
  run.monsters=[enemy(20,0,'emerging'),enemy(0,-20,'emerging')];
  assert.equal(seesMonster(run),true);
  stepRun(run,input,.1);
  assert.ok(run.monsters.every(monster=>monster.stage==='chasing'));
  assert.equal(run.chaseRemaining,15);
  assert.equal(run.events.filter(event=>event==='chase-start').length,1);
});

test('legacy primary threat reads the nearest active enemy and catches from any wave member',()=>{
  const run=arena(),far=enemy(30),near=enemy(.5);
  run.monsters=[far,near,enemy(.1,0,'retreating')];run.chaseRemaining=15;
  assert.equal(run.monster,near,'retreating enemies do not mask active threats');
  close(monsterDistance(run),.5);
  stepRun(run,input,.1);
  assert.equal(run.mode,'lost');
  assert.equal(run.events.filter(event=>event==='caught').length,1);
});

test('freeze stops every pursuer while the shared survival timer keeps advancing',()=>{
  const run=arena();run.monsters=[enemy(30),enemy(40)];run.chaseRemaining=15;
  run.power={type:'freeze',remaining:15,duration:15};
  stepRun(run,input,.1);
  assert.deepEqual(run.monsters.map(monster=>monster.x),[30,40]);
  close(run.chaseRemaining,14.9);
  close(run.power.remaining,14.9);
});

test('shield blocks catches from all pursuers until its fifteen second effect expires',()=>{
  const run=arena();run.monsters=[enemy(.4),enemy(.7)];run.chaseRemaining=15;
  run.power={type:'shield',remaining:15,duration:15};
  stepRun(run,input,.1);
  assert.equal(run.mode,'playing');
  run.power.remaining=.05;
  stepRun(run,input,.1);
  assert.equal(run.power,null);
  assert.equal(run.mode,'lost');
});

test('collecting a real loaded box grants protection before a nearby enemy can catch on that same frame',()=>{
  const run=createRun({random:()=>.99}),box=run.boxes[0];
  assert.ok(box,'the real starting maze loads at least one box');
  Object.assign(run.player,{x:box.x,y:box.y,z:box.z});
  Object.assign(run.flight,{heading:0,flying:true,altitude:(box.y-ROOMS.floorCenter)/ROOMS.heightScale,speed:78});
  run.nextEncounter=Infinity;run.chaseRemaining=15;
  run.monsters=[enemy(box.x+.3,box.z),enemy(box.x+.6,box.z)];
  stepRun(run,input,1/60);
  assert.ok(run.events.includes('power-collected'));
  assert.ok(run.collectedBoxes.has(box.id));
  assert.equal(run.boxesCollected,1);
  assert.equal(run.power.type,'shield');
  assert.equal(run.power.remaining,15);
  assert.equal(run.mode,'playing','both nearby enemies are blocked on the pickup frame');
  assert.ok(!run.events.includes('caught'));
});

test('a speed power increases actual resolved movement instead of only the HUD speed',()=>{
  const base=arena(),boosted=arena();
  for(const run of [base,boosted])Object.assign(run.flight,{heading:90,flying:true,altitude:12,speed:78});
  boosted.power={type:'boost',remaining:15,duration:15};
  stepRun(base,input,.1);stepRun(boosted,input,.1);
  assert.ok(base.travelled>0);
  close(boosted.travelled/base.travelled,1.35);
});

test('pause and tracking loss freeze the full wave and power duration',()=>{
  for(const inactive of [{active:false},{...input,paused:true}]){
    const run=arena();run.monsters=[enemy(30),enemy(40)];run.chaseRemaining=15;
    run.power={type:'slow',remaining:15,duration:15};
    const before=structuredClone({monsters:run.monsters,power:run.power,elapsed:run.elapsed});
    stepRun(run,inactive,.1);
    assert.deepEqual({monsters:run.monsters,power:run.power,elapsed:run.elapsed},before);
    assert.equal(run.chaseRemaining,15);
  }
});
