import {createEagleState,stepEagle,TAKEOFF_FLAPS,FLAP_RISE_METRES,MAX_ALTITUDE} from './eagle.js?v=flap-rise-100';
import {eagleProbes,transformedProbe} from './collision.js';
import {groundSurface,randomSource} from './amazon-world.js';
import {COURSE_DESIGN} from './course-design.js?v=flap-rise-100';
export const RULES=Object.freeze({...COURSE_DESIGN.amazon,length:COURSE_DESIGN.course.length,collectionRadius:18,takeoffFlaps:TAKEOFF_FLAPS,flapRise:FLAP_RISE_METRES,maxAltitude:MAX_ALTITUDE});
export function createChocolates(){
  const random=randomSource(1114),types=Array.from({length:RULES.collectibleCount},(_,i)=>i<RULES.collectibleCount*(1-RULES.positiveRatio)?'negative':'positive');
  for(let i=types.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
  if(types[0]!=='positive'){const first=types.indexOf('positive');[types[0],types[first]]=[types[first],types[0]];}
  const shuffledCells=()=>{
    const cells=types.map((_,index)=>index);
    for(let i=cells.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
    return cells;
  };
  const horizontal=shuffledCells(),vertical=shuffledCells();
  return types.map((type,id)=>{
    // Independent shuffled cells fill the course in all three dimensions,
    // rather than lining rewards up at the summit's original flight height.
    let distance=160+(id+random())*(RULES.length-320)/RULES.collectibleCount;
    let x=((horizontal[id]+random())/RULES.collectibleCount*2-1)*RULES.collectibleHalfWidth;
    const floor=Math.max(RULES.collectibleMinAltitude,groundSurface(x,-distance)+70);
    let y=floor+(RULES.collectibleMaxAltitude-floor)*(vertical[id]+random())/RULES.collectibleCount;
    // One visible first reward introduces the new takeoff altitude.
    if(id===0){x=0;y=RULES.startAltitude+RULES.takeoffFlaps*RULES.flapRise;distance=160;}
    return {id,type,x,y,z:-distance,collected:false,collectedAt:null,points:type==='positive'?RULES.positivePoints:RULES.negativePoints};
  });
}
export function createEagles(){return Array.from({length:18},(_,id)=>({id,x:(id%3-1)*110,y:495+(id%4)*13,z:-380-id*300,phase:id*1.73}));}
export function eaglePose(e,time){
  const t=time*.32+e.phase;
  const vx=94*.32*Math.cos(t),vz=37*.32*Math.cos(t*.8);
  return {x:e.x+94*Math.sin(t),altitude:e.y+14*Math.sin(t*.7),distance:-(e.z+37*Math.sin(t*.8)),
    heading:Math.atan2(vx,-vz)*180/Math.PI,bank:Math.sin(t)*12,pitch:0,
    leftWingAngle:90+24*Math.sin(time*3+e.phase),rightWingAngle:90+24*Math.sin(time*3+e.phase)};
}
export function createRun(){
  const state=createEagleState();state.altitude=RULES.startAltitude;
  return {state,chocolates:createChocolates(),eagles:createEagles(),score:0,positive:0,negative:0,finished:false,crashReason:null};
}
export function wingClearance(state){
  const ground=groundSurface(state.x,-state.distance);
  // The falling ground ahead must not unfold the downstroke into the summit
  // still underneath the trailing feathers. The model and collision share this.
  const support=state.launching?Math.max(ground,RULES.startAltitude+1):ground;
  return Math.max(0,state.altitude-support);
}
export function birdProbes(state,toucan=true){
  const center={x:state.x,y:state.altitude+2.15,z:-state.distance};
  const clearance=wingClearance(state);
  const local=eagleProbes(state.leftWingAngle??90,state.rightWingAngle??90,clearance);
  if(toucan)local.push([0,.7,-4,.5],[0,.5,-5.2,.3]);
  return local.map(p=>transformedProbe(p,center,state.heading||0,state.bank||0,state.pitch||0));
}
export function collisionBetween(previous,current,eagles=[]){
  if(!previous.flying&&!current.flying)return null;
  const moved=Math.hypot(current.x-previous.x,current.distance-previous.distance,current.altitude-previous.altitude);
  const wingSweep=Math.max(Math.abs((current.leftWingAngle??90)-(previous.leftWingAngle??90)),Math.abs((current.rightWingAngle??90)-(previous.rightWingAngle??90)))*.15;
  const samples=Math.max(1,Math.ceil(Math.max(moved,wingSweep)/.65));
  const near=eagles.filter(e=>Math.abs(-e.z-current.distance)<180);
  const delta=(a,b)=>((b-a+540)%360)-180;
  for(let n=0;n<=samples;n++){
    const f=n/samples,s={...current};
    for(const k of ['x','distance','altitude','time','leftWingAngle','rightWingAngle'])s[k]=(previous[k]??90)+((current[k]??90)-(previous[k]??90))*f;
    for(const k of ['heading','bank','pitch'])s[k]=(previous[k]||0)+delta(previous[k]||0,current[k]||0)*f;
    const probes=birdProbes(s);
    for(const p of probes)if(p.y-p.radius<groundSurface(p.x,p.z)-.03)return {type:'terrain',fraction:f,message:'Dağa veya orman zeminine çarptın.'};
    for(const eagle of near){
      const hazard=birdProbes(eaglePose(eagle,s.time),false);
      for(const a of probes)for(const b of hazard)if((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2<=(a.radius+b.radius+.15)**2)return {type:'eagle',fraction:f,message:'Bir kartalla çarpıştın. Yeniden kanatlan!'};
    }
  }
  return null;
}
const segmentDistanceSquared=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const denom=dx*dx+dy*dy+dz*dz;const t=denom?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/denom)):0;return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2+(p.z-a.z-dz*t)**2;};
export function collectChocolates(run,previous){
  const s=run.state;if(!s.flying||s.crashed||run.finished)return [];
  const a={x:previous.x,y:previous.altitude+2.15,z:-previous.distance},b={x:s.x,y:s.altitude+2.15,z:-s.distance},events=[];
  for(const c of run.chocolates){
    if(c.collected||segmentDistanceSquared(c,a,b)>RULES.collectionRadius**2)continue;
    c.collected=true;c.collectedAt=s.time;run.score+=c.points;run[c.type]++;
    events.push({type:c.type,points:c.points,id:c.id});
  }
  return events;
}
export function stepRun(run,input,dt){
  const s=run.state;
  if(!input.active||input.paused||s.crashed||run.finished){stepEagle(s,{active:false},0);return [];}
  const previous={...s};
  // Flight telemetry and the climb target use the same absolute world altitude.
  stepEagle(s,input,dt);
  const hit=collisionBetween(previous,s,run.eagles);
  if(hit){
    for(const k of ['x','distance','altitude','time'])s[k]=previous[k]+(s[k]-previous[k])*hit.fraction;
    s.crashed=true;s.speed=0;s.verticalSpeed=0;run.crashReason=hit.message;return [{type:'crash',message:hit.message}];
  }
  const events=collectChocolates(run,previous);
  if(s.distance>=RULES.length){run.finished=true;s.speed=0;s.verticalSpeed=0;events.push({type:'finish'});}
  return events;
}
