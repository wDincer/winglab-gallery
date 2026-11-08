import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelState,DUEL,ENEMY_MAX_HEALTH,PLAYER_MAX_HEALTH,firePlayer,stepDuel} from '../public/oyunlar/nyan-duello/duel.js';

const level={active:true,angle:90,leftAngle:90,rightAngle:90,bank:0};
const dt=1/60;

function airborne(){
  const state=createDuelState();
  state.status='playing';
  Object.assign(state.flight,{altitude:DUEL.launchHeight,speed:48,flying:true,launching:false});
  return state;
}

function tick(state,events=[],input=level,elapsed=dt){
  stepDuel(state,input,elapsed);
  events.push(...state.events);
}

function hitEnemy(state,events=[]){
  while(state.cooldown>0)tick(state,events);
  const before=state.hits;
  assert.equal(firePlayer(state),true,'an airborne player can fire after cooldown');
  events.push(...state.events);
  for(let frames=0;frames<120&&state.hits===before;frames++)tick(state,events);
  assert.equal(state.hits,before+1,'the fired projectile reaches the moving opponent');
}

function incomingHit(state,events=[]){
  while(state.invulnerable>0)tick(state,events);
  const p=state.flight;
  // Cross the player in one frame to exercise swept projectile collision.
  state.projectiles.push({id:++state.id,owner:'enemy',x:p.x-20,y:p.altitude+2.15,z:-p.distance,vx:400,vy:0,vz:0,age:0});
  tick(state,events,level,.1);
}

test('four actual projectile hits leave the five-hit duel playing',()=>{
  const state=airborne(),events=[];
  for(let hit=1;hit<=4;hit++){
    hitEnemy(state,events);
    assert.equal(state.status,'playing');
    assert.equal(state.enemy.health,5-hit);
    assert.equal(state.health,3);
  }
  assert.equal(state.hits,4);
  assert.equal(events.filter(event=>event.type==='enemy-hit').length,4);
  assert.equal(events.some(event=>event.type==='won'),false);
});

test('the fifth actual projectile hit wins once and ends further damage',()=>{
  const state=airborne(),events=[];
  for(let hit=0;hit<5;hit++)hitEnemy(state,events);
  assert.equal(state.enemy.health,0);
  assert.equal(state.status,'won');
  assert.equal(state.hits,5);
  assert.equal(events.filter(event=>event.type==='won').length,1);
  assert.equal(events.filter(event=>event.type==='explosion').length,1);
  assert.equal(firePlayer(state),false);
  for(let frame=0;frame<60;frame++)tick(state,events);
  assert.equal(state.hits,5);
  assert.equal(events.filter(event=>event.type==='won').length,1);
  assert.equal(events.filter(event=>event.type==='enemy-hit').length,5);
});

test('the player still loses on the third incoming projectile hit',()=>{
  const state=airborne(),events=[];
  for(let hit=1;hit<=3;hit++){
    incomingHit(state,events);
    assert.equal(state.health,3-hit);
    assert.equal(state.status,hit===3?'lost':'playing');
  }
  assert.equal(state.enemy.health,5);
  assert.equal(state.hits,0);
  assert.equal(events.filter(event=>event.type==='player-hit').length,3);
  assert.equal(events.filter(event=>event.type==='lost').length,1);
});

test('a projectile is consumed on impact and cannot hit the opponent twice',()=>{
  const state=airborne(),events=[];
  hitEnemy(state,events);
  assert.equal(state.projectiles.filter(shot=>shot.owner==='player').length,0);
  for(let frame=0;frame<120;frame++)tick(state,events);
  assert.equal(state.hits,1);
  assert.equal(state.enemy.health,4);
  assert.equal(events.filter(event=>event.type==='enemy-hit').length,1);
});

test('paused or missing tracking freezes flight, projectiles and duel timers',()=>{
  for(const input of[{...level,paused:true},{...level,active:false}]){
    const state=airborne();
    assert.equal(firePlayer(state),true);
    tick(state);
    const frozen=structuredClone(state);
    for(let frame=0;frame<90;frame++)stepDuel(state,input,.1);
    assert.deepEqual(state,{...frozen,events:[]});
  }
});

test('a new duel resets to five opponent health and three player lives',()=>{
  const previous=airborne();
  hitEnemy(previous);
  incomingHit(previous);
  const reset=createDuelState();
  assert.equal(ENEMY_MAX_HEALTH,5);
  assert.equal(PLAYER_MAX_HEALTH,3);
  assert.equal(DUEL.enemyHealth,ENEMY_MAX_HEALTH);
  assert.equal(DUEL.health,PLAYER_MAX_HEALTH);
  assert.equal(reset.enemy.health,ENEMY_MAX_HEALTH);
  assert.equal(reset.health,PLAYER_MAX_HEALTH);
  assert.equal(reset.status,'ready');
  assert.equal(reset.hits,0);
  assert.equal(reset.shots,0);
  assert.equal(reset.time,0);
  assert.deepEqual(reset.projectiles,[]);
  assert.equal(previous.enemy.health,4);
  assert.equal(previous.health,2);
});
