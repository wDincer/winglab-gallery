// Mission and combat are separate from the unmodified WINGLAB flight/pose physics.
import {clamp} from './flight.js';
import {COURSE_DESIGN} from './course-design.js';
export const MISSION=Object.freeze(COURSE_DESIGN.mission);
export const PLANETS=MISSION.planets;
export const PORTALS=MISSION.portals;
const v=(x=0,y=0,z=0)=>({x,y,z});
const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return v(a.x/n,a.y/n,a.z/n);};
const scale=(a,k)=>v(a.x*k,a.y*k,a.z*k);
export const playerPosition=f=>v(f.x,f.altitude+12,-f.distance);
export const forward=f=>v(Math.sin(f.heading*Math.PI/180),0,-Math.cos(f.heading*Math.PI/180));
export function segmentDistance(p,a,b){const d=sub(b,a),q=sub(p,a),n=d.x*d.x+d.y*d.y+d.z*d.z;const t=n?clamp((q.x*d.x+q.y*d.y+q.z*d.z)/n,0,1):0;return Math.hypot(q.x-d.x*t,q.y-d.y*t,q.z-d.z*t);}
export function phaseAt(time){
  if(time<MISSION.orbitExit)return {id:'launch',remaining:MISSION.orbitExit-time};
  const t=(time-MISSION.orbitExit)%MISSION.cycle;
  if(t<MISSION.meteorSeconds)return {id:'meteor',remaining:MISSION.meteorSeconds-t};
  if(t<MISSION.meteorSeconds+MISSION.ufoSeconds)return {id:'ufo',remaining:MISSION.meteorSeconds+MISSION.ufoSeconds-t};
  return {id:'quiet',remaining:MISSION.cycle-t};
}
export function createMission(seed=7241){return {time:0,health:MISSION.maxDamage,kills:0,meteorKills:0,ufoKills:0,status:'ready',zone:0,portalsPassed:0,actors:[],shots:[],effects:[],events:[],seed,nextId:1,spawnClock:0,shotClock:0,invulnerable:0,phase:'launch',totalShots:0};}
function random(m){m.seed=(m.seed*16807)%2147483647;return (m.seed-1)/2147483646;}
function event(m,type,extra={}){m.events.push({type,...extra});}
export function applyDamage(m,source='laser'){
  if(m.status!=='playing'||m.invulnerable>0)return false;
  m.health=Math.max(0,m.health-1);m.invulnerable=.72;event(m,'damage',{source});
  if(m.health===0){m.status='lost';event(m,'lost');}return true;
}
function explode(m,a){m.kills++;m[a.type==='meteor'?'meteorKills':'ufoKills']++;m.effects.push({id:m.nextId++,position:{...a.position},age:0,color:a.type==='meteor'?'#ffc081':'#9bfff0',seed:random(m)});event(m,'kill',{target:a.type});a.dead=true;}
function spawn(m,f,type){
  const p=playerPosition(f),fw=forward(f),right=v(-fw.z,0,fw.x);
  const spread=type==='meteor'?170:130,side=(random(m)-.5)*spread,up=(random(m)-.4)*100;
  const ahead=type==='meteor'?450+random(m)*130:300+random(m)*130;
  const position=v(p.x+fw.x*ahead+right.x*side,p.y+up,p.z+fw.z*ahead+right.z*side);
  const aimSide=(random(m)-.5)*100,aimUp=(random(m)-.5)*45;
  const target=v(p.x+right.x*aimSide,p.y+aimUp,p.z+right.z*aimSide);
  m.actors.push({id:m.nextId++,type,position,velocity:scale(norm(sub(target,position)),type==='meteor'?65+random(m)*30:22),radius:type==='meteor'?5+random(m)*6:10,age:0,rotation:random(m)*6.28,fireIn:1.4+random(m)*1.8,warning:null,seed:random(m)});
}
export function firePlayer(m,f,direction){
  if(m.status!=='playing'||m.shotClock>0)return false;
  const p=playerPosition(f),fw=forward(f);let dir=norm(direction??fw);
  // A small aim cone makes both body control and a mouse practical at this scale.
  let best=.992,target=null;
  for(const a of m.actors){const q=sub(a.position,p),d=norm(q),dot=d.x*dir.x+d.y*dir.y+d.z*dir.z;if(dot>best&&Math.hypot(q.x,q.y,q.z)<850){best=dot;target=d;}}
  if(target)dir=target;
  m.shots.push({id:m.nextId++,owner:'player',position:v(p.x+dir.x*14,p.y+dir.y*14,p.z+dir.z*14),velocity:scale(dir,650),age:0});m.shotClock=.22;m.totalShots++;event(m,'shot');return true;
}
function enemyTarget(m,f){
  const p=playerPosition(f),fw=forward(f),r=v(-fw.z,0,fw.x),accurate=random(m)<.18;
  const side=accurate?(random(m)-.5)*5:(random(m)<.5?-1:1)*(15+random(m)*34);
  return v(p.x+r.x*side,p.y+(accurate?0:(random(m)-.5)*38),p.z+r.z*side);
}
export function stepMission(m,f,dt,{active=true,paused=false,fire=false,direction=null}={}){
  if(!active||paused||m.status!=='playing')return m;
  dt=clamp(dt,0,.1);const previous=m.time;m.time=Math.min(MISSION.duration,m.time+dt);
  m.invulnerable=Math.max(0,m.invulnerable-dt);m.shotClock=Math.max(0,m.shotClock-dt);
  for(const portal of PORTALS)if(previous<portal.time&&m.time>=portal.time){m.zone++;m.portalsPassed++;event(m,'portal',{zone:m.zone});}
  const phase=phaseAt(m.time);
  if(phase.id!==m.phase){m.phase=phase.id;m.spawnClock=0;m.actors=[];m.shots=m.shots.filter(s=>s.owner==='player');event(m,'phase',{phase:m.phase});}
  m.spawnClock-=dt;
  if((phase.id==='meteor'||phase.id==='ufo')&&m.spawnClock<=0){spawn(m,f,phase.id);m.spawnClock=phase.id==='meteor'?.62:2.1;}
  if(fire)firePlayer(m,f,direction);
  const p=playerPosition(f);
  for(const a of m.actors){
    const prev={...a.position};a.age+=dt;
    a.position.x+=a.velocity.x*dt;a.position.y+=a.velocity.y*dt;a.position.z+=a.velocity.z*dt;
    if(a.type==='ufo'){
      a.position.y+=Math.cos(a.age*1.8+a.seed*6)*dt*3;a.fireIn-=dt;
      if(a.fireIn<.7&&!a.warning)a.warning=enemyTarget(m,f);
      if(a.fireIn<=0){m.shots.push({id:m.nextId++,owner:'enemy',position:{...a.position},velocity:scale(norm(sub(a.warning??p,a.position)),190),age:0});a.fireIn=1.7+random(m);a.warning=null;event(m,'enemyShot');}
    }
    if(segmentDistance(p,prev,a.position)<a.radius+3){applyDamage(m,a.type);a.dead=true;m.effects.push({id:m.nextId++,position:{...a.position},age:0,color:'#ff9660',seed:random(m)});}
    if(a.age>11||Math.hypot(a.position.x-p.x,a.position.y-p.y,a.position.z-p.z)>1100)a.dead=true;
  }
  for(const s of m.shots){
    const prev={...s.position};s.age+=dt;s.position.x+=s.velocity.x*dt;s.position.y+=s.velocity.y*dt;s.position.z+=s.velocity.z*dt;
    if(s.owner==='player'){
      for(const a of m.actors)if(!a.dead&&segmentDistance(a.position,prev,s.position)<a.radius+1.8){explode(m,a);s.dead=true;break;}
    }else if(segmentDistance(p,prev,s.position)<4.5){applyDamage(m,'laser');s.dead=true;}
    if(s.age>5)s.dead=true;
  }
  m.actors=m.actors.filter(a=>!a.dead);m.shots=m.shots.filter(s=>!s.dead);
  for(const e of m.effects)e.age+=dt;m.effects=m.effects.filter(e=>e.age<1.35);
  if(m.time>=MISSION.duration&&m.status==='playing'){m.status='won';event(m,'won');}
  return m;
}
export function navigationAt(m,f){
  const t=m.time,p=PORTALS.find(p=>p.time>t&&p.time-t<17),planet=PLANETS.find(p=>p.time>t+3)??PLANETS.at(-1);
  const target=t<MISSION.orbitExit?{time:MISSION.orbitExit,heading:0}:p??planet;
  const desired=(target.heading??0)+Math.atan2(-f.x,Math.max(200,(target.time-t)*65))*180/Math.PI,error=((desired-f.heading+540)%360)-180;
  return {name:p?'PORTAL '+String(p.id).padStart(2,'0'):t<18?'DÜNYA YÖRÜNGESİ':planet.name.toLocaleUpperCase('tr'),error,seconds:Math.max(0,Math.ceil(target.time-t)),portal:!!p};
}
