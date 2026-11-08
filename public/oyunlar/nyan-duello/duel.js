import {createEagleState,stepEagle} from './eagle.js';
import {clamp} from './flight.js';
import {CAT_GEOMETRY} from './cat-geometry.js';

export const ENEMY_MAX_HEALTH=5;
export const PLAYER_MAX_HEALTH=3;
export const DUEL = Object.freeze({health:PLAYER_MAX_HEALTH,enemyHealth:ENEMY_MAX_HEALTH,range:94,shotCooldown:.75,enemyInterval:5.4,shotSpeed:126,hitRadius:CAT_GEOMETRY.hitRadius*CAT_GEOMETRY.enemyScale*2.5,launchHeight:28,liftMultiplier:2.8});
export function createDuelState(){
  return {flight:createEagleState(),enemy:{x:0,altitude:28,distance:DUEL.range,health:ENEMY_MAX_HEALTH},
    health:PLAYER_MAX_HEALTH,time:0,status:'ready',shots:0,hits:0,projectiles:[],events:[],cooldown:0,
    enemyClock:0,warning:0,locked:false,aim:{x:0,y:0},id:0,invulnerable:0};
}
export function measureAim(state){
  const p=state.flight,e=state.enemy,h=p.heading*Math.PI/180;
  const dx=e.x-p.x,range=e.distance-p.distance;
  const side=dx*Math.cos(h)-range*Math.sin(h);
  const forward=dx*Math.sin(h)+range*Math.cos(h);
  // Match the chase camera at +22m behind, +9m above, looking 100m ahead.
  const centerY=p.altitude+9-(forward+22)*(6.85/122);
  const vertical=e.altitude+2.15-centerY;
  return {x:side,y:vertical,depth:forward,locked:forward>12&&Math.hypot(side,vertical)<DUEL.hitRadius};
}

function event(state,type,position){state.events.push({type,position});}
function positionOfPlayer(state){const p=state.flight;return {x:p.x,y:p.altitude+2.15,z:-p.distance};}
function positionOfEnemy(state){const e=state.enemy;return {x:e.x,y:e.altitude+2.15,z:-e.distance};}
function projectile(state,owner,start,target){
  const dx=target.x-start.x,dy=target.y-start.y,dz=target.z-start.z;
  const length=Math.hypot(dx,dy,dz)||1,speed=owner==='player'?DUEL.shotSpeed:51;
  const h=state.flight.heading*Math.PI/180,inherit=owner==='player'?state.flight.speed*.514444:0;
  state.projectiles.push({id:++state.id,owner,...start,vx:dx/length*speed+Math.sin(h)*inherit,vy:dy/length*speed,vz:dz/length*speed-Math.cos(h)*inherit,age:0});
}
export function firePlayer(state){
  if(state.status!=='playing'||!state.flight.flying||state.cooldown>0)return false;
  state.cooldown=DUEL.shotCooldown;state.shots++;
  const p=state.flight,h=p.heading*Math.PI/180,start=positionOfPlayer(state);
  start.z-=3;start.y+=.8;
  // A centered enemy receives slight aim assistance; a miss keeps travelling.
  const aim=measureAim(state);
  const target=aim.locked?positionOfEnemy(state):{x:p.x+Math.sin(h)*150,y:p.altitude+.6,z:-p.distance-Math.cos(h)*150};
  projectile(state,'player',start,target);event(state,'fire',start);return true;
}
function segmentDistance(a,b,p){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
  return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z);
}
export function damage(state,who,position){
  if(state.status!=='playing')return false;
  if(who==='player'){
    if(state.invulnerable>0)return false;
    state.health=Math.max(0,state.health-1);state.invulnerable=1.1;event(state,'player-hit',position);
  }else{state.enemy.health=Math.max(0,state.enemy.health-1);state.hits++;event(state,'enemy-hit',position);}
  if(state.health===0||state.enemy.health===0){
    state.status=state.health===0?'lost':'won';state.flight.crashed=true;
    event(state,'explosion',position);event(state,state.status,position);
  }
  return true;
}
export function stepDuel(state,input,dt){
  state.events=[];
  if(state.status!=='playing'||!input.active||input.paused){stepEagle(state.flight,{active:false},0);return state;}
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
  if(!dt)return state;
  const before={...state.flight};
  // Bringing the hands together is a firing gesture; hold the previous altitude
  // during that gesture so it cannot accidentally become a steep dive.
  const flightInput=input.handsTogether?{...input,angle:90,leftAngle:90,rightAngle:90,bank:0}:input;
  stepEagle(state.flight,{...flightInput,launchHeight:DUEL.launchHeight,liftMultiplier:DUEL.liftMultiplier},dt);
  state.time+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.invulnerable=Math.max(0,state.invulnerable-dt);
  const p=state.flight,e=state.enemy;
  if(p.flapCount>before.flapCount)event(state,'flap',positionOfPlayer(state));
  // The opponent patrols a small arena. It never teleports onto the reticle.
  e.x=14*Math.sin(state.time*.24)+4*Math.sin(state.time*.61);
  e.altitude=28+8*(.5+.5*Math.sin(state.time*.23-1.2));
  e.distance=p.distance+DUEL.range;
  state.aim=measureAim(state);state.locked=state.aim.locked;
  if(input.fire)firePlayer(state);
  if(p.flying&&p.altitude>7){
    state.enemyClock+=dt;
    state.warning=state.enemyClock>DUEL.enemyInterval-1?1:0;
    if(state.enemyClock>=DUEL.enemyInterval){
      state.enemyClock=0;state.warning=0;
      const start=positionOfEnemy(state),target=positionOfPlayer(state);
      // Lead the forward flight, but allow banking or flapping to dodge.
      target.z-=p.speed*.514444*.68;target.x+=(p.x-before.x)/dt*.45;
      projectile(state,'enemy',start,target);event(state,'enemy-fire',start);
    }
  }
  const next=[];
  for(const shot of state.projectiles){
    const old={x:shot.x,y:shot.y,z:shot.z};
    shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.z+=shot.vz*dt;shot.age+=dt;
    const target=shot.owner==='player'?positionOfEnemy(state):positionOfPlayer(state);
    const radius=shot.owner==='player'?DUEL.hitRadius:CAT_GEOMETRY.hitRadius;
    if(segmentDistance(old,shot,target)<radius){damage(state,shot.owner==='player'?'enemy':'player',target);continue;}
    if(shot.age<5&&Math.abs(shot.z+p.distance)<380)next.push(shot);
  }
  state.projectiles=next;
  return state;
}

export class ClapGesture {
  constructor(){this.reset();}
  reset(){this.wasTogether=false;this.ready=false;}
  update(landmarks,width=640,height=480){
    const good=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.5&&(p.presence??1)>.5;
    if(![11,12,15,16].every(i=>good(landmarks?.[i]))){this.reset();return {fire:false,together:false};}
    const [ls,rs,l,r]=[11,12,15,16].map(i=>landmarks[i]);
    const distance=(a,b)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
    const shoulder=Math.max(35,distance(ls,rs)),gap=distance(l,r)/shoulder;
    if(gap>.65)this.ready=true;
    const together=gap<(this.wasTogether?.46:.34);
    const fire=together&&!this.wasTogether&&this.ready;
    if(fire)this.ready=false;
    this.wasTogether=together;return {fire,together};
  }
}
