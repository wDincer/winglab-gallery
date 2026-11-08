import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,stepGame,detectCowEnvironment,makePlate,plateHitsCow,CHEF_SPEED} from '../public/oyunlar/ucan-inek/gameplay.js';
import {COW_WORLD} from '../public/oyunlar/ucan-inek/cow-world.js';
import {BUILDINGS} from '../public/oyunlar/ucan-inek/neighborhood.js?v=cow-freeflight-v1';

const flight=(overrides={})=>({x:400,distance:400,altitude:260,heading:0,bank:0,pitch:0,leftWingAngle:90,rightWingAngle:90,flying:true,launching:false,crashed:false,time:0,speed:0,...overrides});
function isolated(){const game=createGame(717);game.hay=[];game.remaining=0;game.nextAttack=Infinity;return game;}
function tick(game,state,dt=1/60){const previous={...state};state.time+=dt;return stepGame(game,previous,state,dt);}
const near=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('free-flight hay is deterministic and occupies all directions and altitude bands',()=>{
  const a=createGame(24016),b=createGame(24016),different=createGame(24017);
  assert.deepEqual(a.hay,b.hay);assert.notDeepEqual(a.hay,different.hay);
  assert.equal(a.hay.length,COW_WORLD.hayCount);assert.equal(a.remaining,a.hay.length);
  for(const sideX of[-1,1])for(const sideZ of[-1,1])assert.ok(a.hay.filter(h=>h.x*sideX>0&&h.z*sideZ>0).length>60);
  for(const [low,high]of[[40,150],[150,300],[300,490]])assert.ok(a.hay.filter(h=>h.y>=low&&h.y<high).length>65);
  for(const h of a.hay){
    assert.ok(Math.abs(h.x)<=COW_WORLD.haySpread&&Math.abs(h.z)<=COW_WORLD.haySpread);
    assert.ok(h.y>=40&&h.y<COW_WORLD.maxAltitude);
    for(const roof of BUILDINGS.filter(b=>Math.abs(b.x-h.x)<b.width/2+7&&Math.abs(b.z-h.z)<b.depth/2+7))assert.ok(h.y>=roof.height+(roof.roof??0)+9);
  }
  const nearby=a.hay.filter(h=>Math.hypot(h.x,h.z)<150);
  assert.ok(nearby.length>=6,'reachable bales introduce the wide scatter around the launch tower');
  assert.ok(nearby.some(h=>h.x>35)&&nearby.some(h=>h.x< -35)&&nearby.some(h=>h.z>35)&&nearby.some(h=>h.z< -35));
});

test('hay collection sweeps a long move in either direction and scores each bale once',()=>{
  const game=isolated();game.hay=[{id:0,x:400,y:262.15,z:-400,collected:false},{id:1,x:460,y:262.15,z:-400,collected:false}];game.remaining=2;
  const previous=flight({x:375}),current=flight({x:425,time:1});
  assert.equal(stepGame(game,previous,current,.1),null);assert.equal(game.total,1);assert.equal(game.remaining,1);assert.equal(game.events[0].type,'hay');
  stepGame(game,current,previous,.1);assert.equal(game.total,1);assert.equal(game.events.length,0);
  stepGame(game,previous,flight({x:475,time:2}),.1);assert.equal(game.total,2);assert.equal(game.remaining,0);
});

test('paused or missing tracking freezes collectibles, projectiles and the flying chef',()=>{
  const game=isolated(),state=flight({time:10});game.hay=[{id:0,x:state.x,y:state.altitude+2.15,z:-state.distance,collected:false}];game.remaining=1;
  game.plates=[makePlate({x:state.x+90,y:state.altitude,z:-state.distance},{x:state.x,y:state.altitude,z:-state.distance})];
  game.chef={x:state.x+150,y:state.altitude+20,z:-state.distance,stage:'approaching',age:0,spawnAt:0,side:1};
  const frozen=structuredClone(game);
  for(const options of[{active:false},{paused:true}]){stepGame(game,state,state,.1,options);assert.deepEqual(game,frozen);}
});

for(const fps of[30,60])test(`airborne chef approaches in three dimensions, warns, then aims once at ${fps} FPS`,()=>{
  const game=isolated(),state=flight({x:500,distance:-500,altitude:320});game.nextAttack=0;
  tick(game,state,1/fps);assert.equal(game.chef.stage,'approaching');assert.ok(game.chef.y>250,'the chef flies at the cow altitude');
  const distance=()=>Math.hypot(game.chef.x-state.x,game.chef.y-(state.altitude-2.05),game.chef.z+state.distance);
  const start=distance();assert.ok(start>140&&start<200);
  const old={...game.chef};tick(game,state,1/fps);near(Math.hypot(game.chef.x-old.x,game.chef.y-old.y,game.chef.z-old.z),CHEF_SPEED/fps);
  let warned=false,warningTime=0,thrown=false;
  for(let i=0;i<8*fps;i++){
    assert.equal(tick(game,state,1/fps),null);
    if(game.events.some(e=>e.type==='warning')){warned=true;warningTime=state.time;assert.ok(distance()<=70);assert.equal(game.plates.length,0);}
    if(game.events.some(e=>e.type==='throw')){thrown=true;break;}
  }
  assert.ok(warned&&thrown);assert.ok(state.time-warningTime>=1.3,'a visible warning precedes release');
  assert.equal(game.chef.stage,'retreating');assert.equal(game.chef.thrown,true);assert.ok(distance()>=44,'the chef keeps a stand-off distance');
  const plate=game.plates[0],origin=plate.previous,target={x:state.x,y:state.altitude+2.15,z:-state.distance};
  const desired={x:target.x-origin.x,y:target.y-origin.y,z:target.z-origin.z},length=Math.hypot(desired.x,desired.y,desired.z);
  near(Math.hypot(plate.vx,plate.vy,plate.vz),85);
  near((plate.vx*desired.x+plate.vy*desired.y+plate.vz*desired.z)/(85*length),1);
  const velocity=[plate.vx,plate.vy,plate.vz];state.x+=250;state.altitude=400;
  tick(game,state,1/fps);assert.deepEqual([plate.vx,plate.vy,plate.vz],velocity,'a released plate never homes on the cow');
  for(let i=0;i<5.2*fps;i++)assert.equal(tick(game,state,1/fps),null);
  assert.equal(game.plates.length,0);assert.equal(game.chef,null,'the chef retreats rather than occupying the scene forever');
});

test('plates hit the moving cow along their swept path rather than teleporting through it',()=>{
  const state=flight(),target={x:state.x,y:state.altitude+2.15,z:-state.distance};
  const p=makePlate({x:target.x-12,y:target.y,z:target.z},{x:target.x+12,y:target.y,z:target.z});
  p.x=target.x+12;assert.equal(plateHitsCow(p,state,state),true);
  p.previous.y+=40;p.y+=40;assert.equal(plateHitsCow(p,state,state),false);
});

test('the tower allows initial wing clearance but remains solid on a return flight',()=>{
  const previous=flight({x:0,distance:0,altitude:COW_WORLD.tower.height,launching:true,leftWingAngle:30,rightWingAngle:30}),next={...previous,altitude:previous.altitude+.2,time:.1};
  assert.equal(detectCowEnvironment(previous,next),null);
  assert.equal(detectCowEnvironment({...previous,launching:false},{...next,launching:false})?.type,'tower');
  const game=isolated();tick(game,flight({x:0,distance:0,altitude:100,launching:true}));assert.equal(game.towerCleared,true);
  const returning=flight({x:0,distance:0,altitude:60,launching:true});
  assert.equal(stepGame(game,returning,returning,.1)?.type,'tower','initial grace cannot be reused after leaving the platform');
});

test('tower sides and the ground still collide at high movement speeds',()=>{
  const previous=flight({x:-60,distance:0,altitude:45}),next=flight({x:60,distance:0,altitude:45});
  assert.equal(detectCowEnvironment(previous,next)?.type,'tower');
  const landing=flight({x:1800,distance:1800,altitude:0});
  assert.equal(detectCowEnvironment({...landing,altitude:20},landing)?.type,'ground');
});
