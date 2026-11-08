import test from 'node:test';
import assert from 'node:assert/strict';
import {DIRECTIONS,EXIT,EXIT_CELL,InfiniteMaze,MAZE,cellAt,cellCenter} from '../public/oyunlar/duckrooms/maze.js';
import {DUCK,clearSight,touchesWall} from '../public/oyunlar/duckrooms/rooms.js';

const id=cell=>`${cell.x},${cell.z}`;
const direction=(a,b)=>DIRECTIONS.find(d=>a.x+d.dx===b.x&&a.z+d.dz===b.z);
function assertRoute(maze,path,from,to){
  assert.ok(path.length,'route exists within the search budget');
  assert.deepEqual(path[0],from);assert.deepEqual(path.at(-1),to);
  assert.equal(new Set(path.map(id)).size,path.length,'route never doubles back');
  for(let i=1;i<path.length;i++){
    const d=direction(path[i-1],path[i]);assert.ok(d,'route moves one cardinal room at a time');
    assert.ok(maze.isOpen(path[i-1].x,path[i-1].z,d.name),'every route step uses a doorway');
  }
}

test('maze regeneration preserves rooms and shared doors after bounded cache eviction',()=>{
  const maze=new InfiniteMaze(),sample=maze.chunk(-7,11);
  const edges=[...sample.edges].sort(),doors=[];
  for(let z=32;z<=35;z++)for(let x=-22;x<=-19;x++)doors.push(DIRECTIONS.map(d=>maze.isOpen(x,z,d.name)));
  for(let i=0;i<160;i++)maze.chunk(100+i,-200-i);
  assert.ok(maze.chunks.size<=96,'exploration has a bounded chunk cache');
  assert.ok(!maze.chunks.has('-7,11'),'the original chunk was actually evicted');
  const regenerated=maze.chunk(-7,11);
  assert.notEqual(regenerated,sample);assert.deepEqual([...regenerated.edges].sort(),edges);
  const regeneratedDoors=[];
  for(let z=32;z<=35;z++)for(let x=-22;x<=-19;x++)regeneratedDoors.push(DIRECTIONS.map(d=>maze.isOpen(x,z,d.name)));
  assert.deepEqual(regeneratedDoors,doors);
  assert.deepEqual([...new InfiniteMaze().chunk(-7,11).edges].sort(),edges);
});

test('every room has two exits and every doorway is undirected across positive and negative chunks',()=>{
  const maze=new InfiniteMaze(),coordinates=[-23,-9,-3,-1,0,1,4,12,29],n=MAZE.chunkCells;
  for(const cz of coordinates)for(const cx of coordinates)for(let z=cz*n;z<(cz+1)*n;z++)for(let x=cx*n;x<(cx+1)*n;x++){
    const adjacent=maze.neighbors({x,z});
    assert.ok(adjacent.length>=2,`room ${x},${z} cannot be a dead end`);
    for(const d of DIRECTIONS){
      assert.equal(maze.isOpen(x,z,d.name),maze.isOpen(x+d.dx,z+d.dz,d.opposite),`shared ${d.name} doorway at ${x},${z}`);
    }
  }
});

test('connected routes cross chunk boundaries in every quadrant',()=>{
  const maze=new InfiniteMaze();
  for(const[from,to]of[
    [{x:0,z:0},EXIT_CELL],
    [{x:-28,z:20},{x:21,z:-22}],
    [{x:25,z:19},{x:-20,z:-23}],
    [{x:-17,z:-14},{x:19,z:21}],
    [{x:0,z:-31},{x:0,z:32}]
  ])assertRoute(maze,maze.path(from,to),from,to);
  assert.deepEqual(maze.path({x:5,z:-2},{x:5,z:-2}),[{x:5,z:-2}]);
});

test('winning exit is distant and hidden by intervening walls at the starting room',()=>{
  const maze=new InfiniteMaze(),start={x:0,z:0},layout=maze.update(cellCenter(start));
  assert.deepEqual(EXIT_CELL,{x:18,z:14});
  assert.deepEqual(EXIT,{x:324,z:252,radius:2.2,cell:EXIT_CELL});
  assert.ok(Object.isFrozen(EXIT)&&Object.isFrozen(EXIT_CELL));
  assert.equal(layout.exit,EXIT);assert.ok(EXIT.x>0&&EXIT.z>0,'the exit lies beyond turns in both world axes');
  assert.ok((Math.abs(EXIT.x)+Math.abs(EXIT.z))>=576);
  assert.ok(layout.remainingDistance>=576);
  assertRoute(maze,layout.pathToExit,start,EXIT_CELL);
  assert.equal(layout.remainingDistance,(layout.pathToExit.length-1)*MAZE.cellSize);
  assert.equal(clearSight(cellCenter(start),EXIT,layout.walls),false,'walls hide the exit even without the initial camera heading');
});

test('navigation refreshes on room crossings inside a chunk without rebuilding geometry',()=>{
  const maze=new InfiniteMaze();let searches=0;
  const path=maze.path.bind(maze);maze.path=(...args)=>{searches++;return path(...args);};
  const layout=maze.update({x:0,z:0}),walls=layout.walls,rooms=layout.rooms,route=layout.pathToExit,revision=layout.revision;
  assert.equal(layout.navigationId,'0,0');assert.equal(searches,1);
  for(let i=0;i<30;i++){
    assert.equal(maze.update({x:i*.1,z:-i*.1}),layout);
    assert.equal(layout.pathToExit,route,'movement within one room reuses its route');
  }
  assert.equal(searches,1,'pathfinding never runs every frame');
  assert.equal(maze.update(cellCenter({x:1,z:0})),layout);
  assert.equal(layout.navigationId,'1,0');assert.equal(searches,2);
  assert.equal(layout.walls,walls);assert.equal(layout.rooms,rooms);assert.equal(layout.revision,revision);
  assert.deepEqual(layout.pathToExit[0],{x:1,z:0});
  assert.notEqual(layout.pathToExit,route);
  maze.update(cellCenter({x:MAZE.chunkCells,z:0}));
  assert.notEqual(maze.layout,layout);assert.ok(maze.layout.revision>revision);assert.equal(searches,3);
});

test('intermittent room signs always point through a legal door toward a shorter exit route',()=>{
  const maze=new InfiniteMaze(),route=maze.path({x:0,z:0},EXIT_CELL);
  for(let roomIndex=0;roomIndex<route.length-1;roomIndex+=3){
    const layout=maze.update(cellCenter(route[roomIndex])),path=layout.pathToExit;
    assert.ok(layout.signs.length>0,'the current room always has a guidance sign');
    assert.ok(layout.signs.some(sign=>sign.cellX===path[0].x&&sign.cellZ===path[0].z));
    for(const sign of layout.signs){
      const current={x:sign.cellX,z:sign.cellZ},index=path.findIndex(cell=>id(cell)===id(current));
      assert.ok(index>=0&&index<10,'sign belongs to the nearby route');
      assert.ok(current.x>=layout.minX&&current.x<=layout.maxX&&current.z>=layout.minZ&&current.z<=layout.maxZ);
      assert.deepEqual({x:sign.x,z:sign.z},cellCenter(current));
      const next={x:current.x+sign.dx,z:current.z+sign.dz};
      assert.deepEqual(next,path[index+1]);
      const d=direction(current,next);assert.ok(d);assert.ok(maze.isOpen(current.x,current.z,d.name));
      assert.equal(sign.distance,(path.length-1-index)*MAZE.cellSize);
      assert.equal(maze.path(next,EXIT_CELL).length,path.length-index-1,'following the arrow shortens a shortest exit route');
    }
    for(let i=0;i<Math.min(path.length-1,10);i++){
      const current=path[i],previous=path[i-1],next=path[i+1];
      if(current.x<layout.minX||current.x>layout.maxX||current.z<layout.minZ||current.z>layout.maxZ)continue;
      const turning=previous&&(current.x-previous.x!==next.x-current.x||current.z-previous.z!==next.z-current.z);
      if(i===0||i%2===0||turning)assert.ok(layout.signs.some(sign=>sign.cellX===current.x&&sign.cellZ===current.z),'current rooms, alternating rooms, and turns are marked');
    }
  }
  const exitLayout=maze.update(EXIT);
  assert.equal(exitLayout.remainingDistance,0);assert.deepEqual(exitLayout.pathToExit,[EXIT_CELL]);assert.deepEqual(exitLayout.signs,[]);
});

test('the full exit route fits the duck from every room centre through each doorway',()=>{
  const maze=new InfiniteMaze(),route=maze.path({x:0,z:0},EXIT_CELL);
  assert.ok(MAZE.doorWidth>2*(DUCK.shoulderX+DUCK.wingReach+DUCK.tipRadius));
  for(let i=1;i<route.length;i++){
    const a=cellCenter(route[i-1]),b=cellCenter(route[i]),layout=maze.update(a);
    const heading=(Math.atan2(b.x-a.x,a.z-b.z)*180/Math.PI+360)%360;
    const flight={heading,bank:0,leftWingAngle:90,rightWingAngle:90};
    for(let step=0;step<=72;step++){
      const t=step/72,player={x:a.x+(b.x-a.x)*t,y:1,z:a.z+(b.z-a.z)*t};
      assert.equal(touchesWall(player,flight,layout.walls),false,`clear duck passage between ${id(route[i-1])} and ${id(route[i])}, sample ${step}`);
    }
  }
  assert.deepEqual(cellAt(EXIT),EXIT_CELL);
});
