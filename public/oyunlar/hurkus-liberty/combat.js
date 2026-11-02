// Mission logic is independent of rendering and of the saved WINGLAB controls.
export const RULES = Object.freeze({spawnInterval:30, goal:10, range:2500, aimDegrees:7.5, lockSeconds:.55, missileSpeed:720, cooldown:1.25, approachSeconds:36});
export const STATUE = Object.freeze({x:0,y:95,z:0});
export const length = v => Math.hypot(v.x,v.y,v.z);
export const subtract = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const distance = (a,b) => length(subtract(a,b));
export function positionOf(flight){return {x:flight.x,y:flight.altitude+2.15,z:-flight.distance};}
export function forwardOf(flight){const h=flight.heading*Math.PI/180,p=flight.pitch*Math.PI/180;return {x:Math.sin(h)*Math.cos(p),y:Math.sin(p),z:-Math.cos(h)*Math.cos(p)};}
export function targetSolution(player, forward, target){
  const delta=subtract(target,player),range=length(delta);
  const dot=range>0?(delta.x*forward.x+delta.y*forward.y+delta.z*forward.z)/range:1;
  const angle=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
  return {range,angle,inRange:range<=RULES.range,aligned:angle<=RULES.aimDegrees,eligible:range<=RULES.range&&angle<=RULES.aimDegrees};
}
export function handsTogether(landmarks,width=1,height=1){
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.45&&(p.presence??1)>.45;
  if(![11,12,15,16].every(i=>valid(landmarks?.[i])))return false;
  const d=(a,b)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
  const shoulders=d(landmarks[11],landmarks[12]);
  if(shoulders<width*.035)return false;
  // Include finger landmarks so fingertip contact also counts with separated wrists.
  const left=[15,17,19,21].map(i=>landmarks[i]).filter(valid),right=[16,18,20,22].map(i=>landmarks[i]).filter(valid);
  return left.some(a=>right.some(b=>d(a,b)<shoulders*.32));
}
export class TouchTrigger{
  constructor(){this.reset();}
  reset(){this.hold=0;this.released=.2;this.latched=false;}
  update(touching,dt,active=true){
    if(!active){this.hold=0;this.released=0;this.latched=true;return false;}
    if(!touching){this.hold=0;this.released+=dt;if(this.released>=.16)this.latched=false;return false;}
    this.released=0;this.hold+=dt;
    if(this.hold>=.075&&!this.latched){this.latched=true;return true;}
    return false;
  }
}
export function createMission(){return {status:'playing',time:0,score:0,wave:0,nextSpawn:RULES.spawnInterval,enemies:[],missiles:[],events:[],lockId:null,lockProgress:0,cooldown:0,shots:0,reason:null};}
export function spawnEnemy(mission,player){
  mission.wave++;
  const dx=player.x-STATUE.x,dz=player.z-STATUE.z,n=Math.hypot(dx,dz)||1;
  const side=Math.sin((mission.wave-1)*2.4)*270;
  const start={x:-dx/n*1900+dz/n*side,y:145+Math.sin(mission.wave*1.8)*38,z:-dz/n*1900-dx/n*side};
  const enemy={id:mission.wave,position:{...start},start,age:0,duration:RULES.approachSeconds,alive:true,reserved:false};
  mission.enemies.push(enemy);mission.events.push({type:'spawn',id:enemy.id});return enemy;
}
export function updateLock(mission,player,forward,dt){
  const candidates=mission.enemies.filter(e=>e.alive&&!e.reserved).map(e=>({e,s:targetSolution(player,forward,e.position)})).filter(({s})=>s.eligible).sort((a,b)=>a.s.angle-b.s.angle);
  const chosen=candidates[0]?.e;
  if(!chosen){mission.lockId=null;mission.lockProgress=0;return;}
  if(mission.lockId!==chosen.id){mission.lockId=chosen.id;mission.lockProgress=0;}
  mission.lockProgress=Math.min(1,mission.lockProgress+dt/RULES.lockSeconds);
}
export function fireMissile(mission,player,forward){
  if(mission.status!=='playing')return {ok:false,reason:'inactive'};
  if(mission.cooldown>0)return {ok:false,reason:'cooldown'};
  const target=mission.enemies.find(e=>e.id===mission.lockId&&e.alive&&!e.reserved);
  if(!target||mission.lockProgress<1||!targetSolution(player,forward,target.position).eligible)return {ok:false,reason:'lock'};
  target.reserved=true;mission.shots++;mission.cooldown=RULES.cooldown;
  mission.missiles.push({id:mission.shots,targetId:target.id,position:{...player},age:0});
  mission.events.push({type:'launch',position:{...player}});mission.lockId=null;mission.lockProgress=0;
  return {ok:true};
}
export function loseMission(mission,reason='statue'){
  if(mission.status!=='playing')return;
  mission.status='lost';mission.reason=reason;mission.lockId=null;mission.lockProgress=0;
  mission.events.push({type:reason==='statue'?'statue-destroyed':'crash',position:reason==='statue'?{...STATUE}:null});
}
export function stepMission(mission,{player,forward,active=true,paused=false,fire=false},dt){
  if(!active||paused||mission.status!=='playing')return mission;
  dt=Math.max(0,Math.min(dt,.1));mission.time+=dt;mission.cooldown=Math.max(0,mission.cooldown-dt);
  while(mission.wave<RULES.goal&&mission.time+1e-7>=mission.nextSpawn){spawnEnemy(mission,player);mission.nextSpawn+=RULES.spawnInterval;}
  for(const enemy of mission.enemies){
    if(!enemy.alive)continue;
    enemy.age+=dt;const t=Math.min(1,enemy.age/enemy.duration);
    enemy.position={x:enemy.start.x*(1-t),y:enemy.start.y+(STATUE.y-enemy.start.y)*t,z:enemy.start.z*(1-t)};
  }
  updateLock(mission,player,forward,dt);
  if(fire)fireMissile(mission,player,forward);
  for(const missile of mission.missiles){
    if(missile.dead)continue;
    const target=mission.enemies.find(e=>e.id===missile.targetId&&e.alive);
    if(!target){missile.dead=true;continue;}
    missile.age+=dt;const d=subtract(target.position,missile.position),n=length(d),step=RULES.missileSpeed*dt;
    if(n<=step+9){
      target.alive=false;missile.dead=true;mission.score++;
      mission.events.push({type:'explosion',id:target.id,position:{...target.position}});
      if(mission.score>=RULES.goal){mission.status='won';mission.events.push({type:'victory'});}
    }else{missile.position.x+=d.x/n*step;missile.position.y+=d.y/n*step;missile.position.z+=d.z/n*step;}
  }
  if(mission.status==='playing'&&mission.enemies.some(e=>e.alive&&e.age>=e.duration))loseMission(mission,'statue');
  mission.missiles=mission.missiles.filter(m=>!m.dead);return mission;
}
