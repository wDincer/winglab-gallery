import {COURSE_DESIGN} from './course-design.js';
import {COURSE,coursePoint} from './course.js';
export const RULES=Object.freeze(COURSE_DESIGN.game);
const mix=(a,b,t)=>a+(b-a)*t;
function aimFish(f,p,seconds,offset){const rad=f.heading*Math.PI/180,speed=f.speed*.514444;return {x:p.x+Math.sin(rad)*speed*seconds+offset,y:Math.max(5,p.y+f.verticalSpeed*seconds),z:p.z-Math.cos(rad)*speed*seconds};}
export function createMission(random=Math.random){
  const bears=[];
  for(let d=RULES.firstBear;d<COURSE.length;d+=RULES.bearSpacing){const id=bears.length,side=id%2?1:-1;bears.push({id,x:coursePoint(d).x+side*(42+random()*20),y:0,z:-d,nextThrow:2+random()*3,throwing:0});}
  return {score:0,apples:0,hits:0,elapsed:0,status:'ready',bears,shots:[],drops:[],nextId:0,nextAttack:4,previous:null,reason:''};
}
export function finishMission(m,status,reason=''){if(['won','lost'].includes(m.status))return false;m.status=status;m.reason=reason;return true;}
export function fishPosition(s,age){const t=Math.max(0,Math.min(1,age/RULES.fishFlightSeconds));return {x:mix(s.origin.x,s.target.x,t),y:mix(s.origin.y,s.target.y,t)+Math.sin(Math.PI*t)*22,z:mix(s.origin.z,s.target.z,t)};}
function segmentNearOrigin(a,b,r){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz,t=l?Math.max(0,Math.min(1,-(a.x*dx+a.y*dy+a.z*dz)/l)):0;return Math.hypot(a.x+dx*t,a.y+dy*t,a.z+dz*t)<=r;}
export function updateMission(m,f,pickups,dt,{active=true,paused=false,random=Math.random}={}){
  if(!active||paused||f.crashed||['won','lost'].includes(m.status)){m.previous=null;return [];}
  m.status='playing';const events=[];dt=Math.min(.1,Math.max(0,dt));m.elapsed+=dt;
  const p={x:f.x,y:f.altitude+2.15,z:-f.distance},previous=m.previous??p;
  if(pickups.length){m.apples+=pickups.length;m.score+=pickups.length*RULES.applePoints;events.push({type:'pickup',points:pickups.length*RULES.applePoints});}
  for(const s of m.shots){const old=s.age;s.age+=dt;if(s.age<0)continue;
    // Take one final aim at release, then keep the airborne fish on its arc.
    if(old<0)s.target=aimFish(f,p,Math.max(0,RULES.fishFlightSeconds-s.age),s.aimOffset??0);
    const a=fishPosition(s,Math.max(0,old)),b=fishPosition(s,s.age);s.position=b;
    if(!s.hit&&segmentNearOrigin({x:a.x-previous.x,y:a.y-previous.y,z:a.z-previous.z},{x:b.x-p.x,y:b.y-p.y,z:b.z-p.z},RULES.hitRadius)){
      s.hit=true;m.score=Math.max(0,m.score-RULES.applePoints);m.apples=Math.max(0,m.apples-1);m.hits++;m.drops.push({id:m.nextId++,x:p.x,y:p.y,z:p.z,age:0});events.push({type:'hit',points:-RULES.applePoints});
    }
  }
  m.shots=m.shots.filter(s=>!s.hit&&s.age<RULES.fishFlightSeconds+.05);m.drops=m.drops.filter(d=>d.age<3);for(const d of m.drops)d.age+=dt;
  for(const b of m.bears)b.throwing=Math.max(0,b.throwing-dt);
  // A nearby bear predicts the pilot's position and locks its aim at release.
  // Airborne fish never home in.
  // Warning + flight time give the pilot 2.65 seconds to change direction.
  if(f.flying&&m.elapsed>=m.nextAttack&&!m.shots.length){
    const b=m.bears.find(b=>m.elapsed>=b.nextThrow&&-b.z-f.distance>25&&-b.z-f.distance<175&&Math.hypot(b.x-p.x,b.z-p.z)<RULES.throwRange);
    if(b){const h=RULES.warningSeconds+RULES.fishFlightSeconds,aimOffset=(random()-.5)*RULES.aimSpread,target=aimFish(f,p,h,aimOffset),origin={x:b.x,y:7,z:b.z};
      m.shots.push({id:m.nextId++,bearId:b.id,origin,target,aimOffset,age:-RULES.warningSeconds,position:origin,hit:false});b.throwing=RULES.warningSeconds+.4;b.nextThrow=m.elapsed+4+random()*3;m.nextAttack=m.elapsed+3.6+random()*2;events.push({type:'warning'});}
  }
  m.previous=p;
  if(m.score>=RULES.targetScore){finishMission(m,'won');events.push({type:'won'});}
  else if(m.elapsed>=RULES.timeLimit){finishMission(m,'lost','120 saniye doldu. Elmalar bir sonraki uçuşta seni bekliyor!');events.push({type:'lost'});}
  else if(f.distance>=COURSE.length){finishMission(m,'lost','Çölün sonuna ulaştın. 5.000 puan için yeniden uç!');events.push({type:'lost'});}
  return events;
}
