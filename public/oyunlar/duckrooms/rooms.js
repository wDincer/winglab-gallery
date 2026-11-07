import {COURSE_DESIGN} from './course-design.js?v=duck-bounce-v1';
import {clamp} from './flight.js';
import {createEagleState,stepEagle} from './eagle.js';
import {InfiniteMaze,cellAt,cellCenter} from './maze.js';

export const ROOMS=Object.freeze(COURSE_DESIGN.backrooms);
const scale=ROOMS.duckScale;
export const DUCK=Object.freeze({scale,radius:.30*scale,shoulderX:.245*scale,shoulderY:.08*scale,wingReach:.59*scale,headTop:.67*scale,footBottom:.30*scale,tipRadius:.065*scale});
export const worldHeight=altitude=>ROOMS.floorCenter+altitude*ROOMS.heightScale;
export const worldSpeed=flight=>flight.speed*.514444*ROOMS.flightScale;
export function wingAngle(angle,height,bank=0,side=1){
  const roll=-bank*Math.PI/180;
  const shoulderY=DUCK.shoulderY*Math.cos(roll)+side*DUCK.shoulderX*Math.sin(roll);
  const floorAngle=Math.asin(clamp((DUCK.tipRadius-height-shoulderY)/DUCK.wingReach,-1,1))*180/Math.PI;
  const ceilingAngle=Math.asin(clamp((ROOMS.ceiling-DUCK.tipRadius-height-shoulderY)/DUCK.wingReach,-1,1))*180/Math.PI;
  return clamp(angle,90+floorAngle-side*roll*180/Math.PI,90+ceilingAngle-side*roll*180/Math.PI);
}
export function bodyProbes(player,flight){
  const heading=flight.heading*Math.PI/180,roll=-flight.bank*Math.PI/180;
  const probes=[{...player,r:DUCK.radius}];
  for(const side of[-1,1]){
    const arm=wingAngle(side<0?flight.leftWingAngle:flight.rightWingAngle,player.y,flight.bank,side);
    const angle=(arm-90)*Math.PI/180,reach=DUCK.shoulderX+Math.cos(angle)*DUCK.wingReach;
    const localY=DUCK.shoulderY+Math.sin(angle)*DUCK.wingReach;
    const wx=side*reach*Math.cos(roll)-localY*Math.sin(roll);
    const wy=side*reach*Math.sin(roll)+localY*Math.cos(roll);
    probes.push({x:player.x+wx*Math.cos(heading),y:player.y+wy,z:player.z+wx*Math.sin(heading),r:DUCK.tipRadius});
  }
  return probes;
}
export function touchesWall(player,flight,walls){
  return bodyProbes(player,flight).some(p=>walls.some(w=>{
    if(Math.abs(w.z-p.z)>w.d/2+p.r||p.y-p.r>w.h)return false;
    const dx=Math.max(Math.abs(p.x-w.x)-w.w/2,0),dz=Math.max(Math.abs(p.z-w.z)-w.d/2,0);
    return dx*dx+dz*dz<p.r*p.r;
  }));
}
export function sweptWall(previous,player,flight,walls){
  const steps=Math.max(1,Math.ceil(Math.hypot(player.x-previous.x,player.z-previous.z)/.075));
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    if(touchesWall({x:previous.x+(player.x-previous.x)*t,y:previous.y+(player.y-previous.y)*t,z:previous.z+(player.z-previous.z)*t},flight,walls))return true;
  }
  return false;
}
function separateFromWalls(player,flight,walls){
  // A changing wing pose or the turnaround can make a previously clear probe
  // overlap. Push the entire duck out using the same probes as the renderer.
  for(let pass=0;pass<24;pass++){
    let overlap=false;
    for(const p of bodyProbes(player,flight))for(const w of walls){
      if(p.y-p.r>w.h)continue;
      const left=w.x-w.w/2,right=w.x+w.w/2,near=w.z-w.d/2,far=w.z+w.d/2;
      const dx=p.x-clamp(p.x,left,right),dz=p.z-clamp(p.z,near,far),distance=Math.hypot(dx,dz);
      if(distance>=p.r)continue;
      if(distance>1e-8){
        const push=(p.r-distance+.002)/distance;player.x+=dx*push;player.z+=dz*push;
      }else{
        const sides=[{depth:p.x-left,x:-1,z:0},{depth:right-p.x,x:1,z:0},{depth:p.z-near,x:0,z:-1},{depth:far-p.z,x:0,z:1}];
        const side=sides.reduce((a,b)=>a.depth<b.depth?a:b),push=side.depth+p.r+.002;
        player.x+=side.x*push;player.z+=side.z*push;
      }
      overlap=true;break;
    }
    if(!overlap)break;
  }
}
function bounceOffWall(state,previous,walls){
  const destination={...state.player},flight=state.flight;
  const steps=Math.max(1,Math.ceil(Math.hypot(destination.x-previous.x,destination.z-previous.z)/.075));
  let safe=0,hit=1;
  for(let i=1;i<=steps;i++){
    const t=i/steps,p={x:previous.x+(destination.x-previous.x)*t,y:previous.y+(destination.y-previous.y)*t,z:previous.z+(destination.z-previous.z)*t};
    if(touchesWall(p,flight,walls)){hit=t;break;}safe=t;
  }
  // Finish immediately before contact, including at high speed and thin walls.
  if(!touchesWall(previous,flight,walls))for(let i=0;i<10;i++){
    const t=(safe+hit)/2,p={x:previous.x+(destination.x-previous.x)*t,y:previous.y+(destination.y-previous.y)*t,z:previous.z+(destination.z-previous.z)*t};
    if(touchesWall(p,flight,walls))hit=t;else safe=t;
  }
  state.player.x=previous.x+(destination.x-previous.x)*safe;
  state.player.z=previous.z+(destination.z-previous.z)*safe;
  flight.heading=(flight.heading+180)%360;
  separateFromWalls(state.player,flight,walls);
  state.impact={remaining:.55,duration:.55};state.wallHits++;state.events.push('wall');
}
export function clearSight(a,b,walls){
  const dx=b.x-a.x,dz=b.z-a.z;
  for(const wall of walls){
    if(Math.abs(wall.z-(a.z+b.z)/2)>Math.abs(dz)/2+wall.d/2)continue;
    let low=0,high=1;
    for(const[origin,delta,min,max]of[[a.x,dx,wall.x-wall.w/2,wall.x+wall.w/2],[a.z,dz,wall.z-wall.d/2,wall.z+wall.d/2]]){
      if(Math.abs(delta)<1e-8){if(origin<min||origin>max){low=2;break;}}
      else{const t1=(min-origin)/delta,t2=(max-origin)/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));}
    }
    if(low<=high&&low<1&&high>0)return false;
  }
  return true;
}
export function seesMonster(state){
  const monster=state.monster;if(!monster)return false;
  const dx=monster.x-state.player.x,dz=monster.z-state.player.z,range=Math.hypot(dx,dz);
  const heading=state.flight.heading*Math.PI/180;
  const dot=(dx*Math.sin(heading)-dz*Math.cos(heading))/Math.max(.01,range);
  return range<38&&dot>.1&&clearSight(state.player,monster,state.maze.layout.walls);
}
export function monsterDistance(state){
  if(!state.monster)return Infinity;
  const m=state.monster,dy=Math.max(0,state.player.y-2.7,.1-state.player.y);
  return Math.hypot(state.player.x-m.x,state.player.z-m.z,dy);
}
export function createRun(){
  const maze=new InfiniteMaze(),player={x:0,y:ROOMS.floorCenter,z:0};maze.update(player);
  return {flight:createEagleState(),player,maze,elapsed:0,travelled:0,room:cellAt(player),roomsEntered:1,
    mode:'playing',monster:null,encounter:0,escaped:0,chaseRemaining:0,sightingRemaining:0,
    nextEncounter:ROOMS.firstEncounterAfter,safeUntil:0,events:[],reason:null,closest:Infinity,impact:null,wallHits:0};
}
function spawnMonster(state){
  const cell=cellAt(state.player),neighbors=state.maze.neighbors(cell);
  const heading=state.flight.heading*Math.PI/180;
  // Prefer a side doorway rather than the room immediately behind the duck.
  neighbors.sort((a,b)=>Math.abs((a.x-cell.x)*Math.sin(heading)-(a.z-cell.z)*Math.cos(heading))-
    Math.abs((b.x-cell.x)*Math.sin(heading)-(b.z-cell.z)*Math.cos(heading)));
  const spawn=neighbors[state.encounter%Math.min(2,neighbors.length)];
  const p=cellCenter(spawn);
  state.monster={...p,stage:'emerging',seen:false,age:0,path:[],repath:0,spawnCell:spawn};
  state.encounter++;state.events.push('emerge');
}
function navigateMonster(state,target,speed,dt){
  const monster=state.monster,walls=state.maze.layout.walls;
  monster.repath-=dt;
  if(clearSight(monster,target,walls))monster.path=[{x:target.x,z:target.z}];
  else if(monster.repath<=0||!monster.path.length){
    const from=cellAt(monster),to=cellAt(target),path=state.maze.path(from,to);
    monster.path=path.map(cellCenter);monster.path.push({x:target.x,z:target.z});monster.repath=.55;
    // If the next cell centre is directly visible, the current centre can be skipped.
    if(monster.path.length>1&&clearSight(monster,monster.path[1],walls))monster.path.shift();
  }
  let budget=speed*dt;
  while(monster.path.length&&budget>0){
    const next=monster.path[0],dx=next.x-monster.x,dz=next.z-monster.z,length=Math.hypot(dx,dz);
    if(length<.025){monster.path.shift();continue;}
    const amount=Math.min(length,budget),p={x:monster.x+dx/length*amount,z:monster.z+dz/length*amount};
    if(!clearSight(monster,p,walls)){monster.path=[];monster.repath=0;break;}
    monster.x=p.x;monster.z=p.z;budget-=amount;
    if(amount>=length-.00001)monster.path.shift();
  }
}
function beginChase(state){
  state.monster.stage='chasing';state.chaseRemaining=ROOMS.chaseSeconds;state.events.push('chase-start');
}
function sighting(state){
  state.monster.seen=true;state.sightingRemaining=ROOMS.sightingSeconds;state.events.push('sighting');
}
export function stepRun(state,input,dt){
  state.events=[];
  if(!input.active||input.paused||state.mode!=='playing'){stepEagle(state.flight,{active:false},0);return state;}
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(dt===0)return state;
  if(state.impact){state.impact.remaining=Math.max(0,state.impact.remaining-dt);if(state.impact.remaining===0)state.impact=null;}
  const previous={...state.player},beforeHeading=state.flight.heading;
  stepEagle(state.flight,input,dt);
  // Explicitly requested indoor manoeuvrability: amplify yaw without altering
  // WINGLAB flap detection, coasting, arm angles, braking or tracking semantics.
  const rawTurn=((state.flight.heading-beforeHeading+540)%360)-180;
  const turn=rawTurn*ROOMS.turnGain;
  state.flight.heading=(beforeHeading+turn+360)%360;
  const midHeading=(beforeHeading+turn*.5)*Math.PI/180,moved=worldSpeed(state.flight)*dt;
  state.player.x+=Math.sin(midHeading)*moved;state.player.z-=Math.cos(midHeading)*moved;
  const maxAltitude=(ROOMS.maxCenter-ROOMS.floorCenter)/ROOMS.heightScale;
  if(state.flight.altitude>maxAltitude){state.flight.altitude=maxAltitude;state.flight.verticalSpeed=Math.min(0,state.flight.verticalSpeed);}
  state.player.y=worldHeight(state.flight.altitude);
  state.maze.update(state.player);
  state.elapsed+=dt;state.safeUntil=Math.max(0,state.safeUntil-dt);state.sightingRemaining=Math.max(0,state.sightingRemaining-dt);
  if(sweptWall(previous,state.player,state.flight,state.maze.layout.walls)){
    bounceOffWall(state,previous,state.maze.layout.walls);
  }
  state.travelled+=Math.hypot(state.player.x-previous.x,state.player.z-previous.z);
  // Keep telemetry in sync after movement and automatic wall turnarounds.
  state.flight.x=state.player.x/ROOMS.flightScale;state.flight.distance=-state.player.z/ROOMS.flightScale;
  const room=cellAt(state.player);
  if(room.x!==state.room.x||room.z!==state.room.z){state.room=room;state.roomsEntered++;}
  if(!state.monster&&state.elapsed>=state.nextEncounter&&state.flight.flying)spawnMonster(state);
  const monster=state.monster;
  if(monster){
    monster.age+=dt;
    if(monster.stage==='emerging'){
      navigateMonster(state,state.player,ROOMS.monsterEmergingSpeed,dt);
      if(seesMonster(state)){sighting(state);beginChase(state);}
      else if(monster.age>3.5)beginChase(state);
    }else if(monster.stage==='chasing'){
      state.chaseRemaining=Math.max(0,state.chaseRemaining-dt);
      if(!monster.seen&&seesMonster(state))sighting(state);
      navigateMonster(state,state.player,ROOMS.monsterSpeed+Math.min(.4875,state.escaped*.045),dt);
      if(state.chaseRemaining<=1e-8){
        monster.stage='retreating';monster.retreatAge=0;monster.path=[];monster.repath=0;
        state.escaped++;state.safeUntil=4;state.events.push('escaped');
        state.nextEncounter=state.elapsed+ROOMS.encounterCooldown;
      }
    }else{
      monster.retreatAge+=dt;
      navigateMonster(state,cellCenter(monster.spawnCell),ROOMS.monsterRetreatSpeed,dt);
      if(monster.retreatAge>3.5||monsterDistance(state)>45)state.monster=null;
    }
    if(state.monster&&monster.stage!=='retreating'){
      const range=monsterDistance(state);state.closest=Math.min(state.closest,range);
      if(range<=ROOMS.dangerRadius){state.mode='lost';state.reason='monster';state.flight.crashed=true;state.events.push('caught');}
    }
  }
  return state;
}
