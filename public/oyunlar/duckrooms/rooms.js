import {COURSE_DESIGN} from './course-design.js?v=duck-waves-v1';
import {clamp} from './flight.js';
import {createEagleState,stepEagle} from './eagle.js?v=duck-waves-v1';
import {InfiniteMaze,cellAt,cellCenter,EXIT} from './maze.js?v=duck-waves-v1';
import {createPowerState,syncPowerBoxes,stepPowers,monsterPowerFactor,hasMonsterShield,playerPowerFactor} from './powers.js?v=duck-waves-v1';

export const ROOMS=Object.freeze(COURSE_DESIGN.backrooms);
const scale=ROOMS.duckScale;
export const DUCK=Object.freeze({scale,radius:.30*scale,shoulderX:.245*scale,shoulderY:.08*scale,wingReach:.59*scale,headTop:.67*scale,footBottom:.30*scale,tipRadius:.065*scale});
export const worldHeight=altitude=>ROOMS.floorCenter+altitude*ROOMS.heightScale;
export const worldSpeed=flight=>clamp(flight.speed*.514444*ROOMS.flightScale,0,ROOMS.maxWorldSpeed??4.8);
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
function enemies(state){return state.monsters??(state.monster?[state.monster]:[]);}
function rangeToMonster(state,monster){
  const dy=Math.max(0,state.player.y-2.7,.1-state.player.y);
  return Math.hypot(state.player.x-monster.x,state.player.z-monster.z,dy);
}
function nearestMonster(state){
  const all=enemies(state),active=all.filter(monster=>monster.stage!=='retreating'),pool=active.length?active:all;
  return pool.reduce((nearest,monster)=>!nearest||rangeToMonster(state,monster)<rangeToMonster(state,nearest)?monster:nearest,null);
}
export function seesMonster(state,monster=null){
  if(!monster)return enemies(state).some(enemy=>enemy.stage!=='retreating'&&seesMonster(state,enemy));
  const dx=monster.x-state.player.x,dz=monster.z-state.player.z,range=Math.hypot(dx,dz);
  const heading=state.flight.heading*Math.PI/180;
  const dot=(dx*Math.sin(heading)-dz*Math.cos(heading))/Math.max(.01,range);
  return range<38&&dot>.1&&clearSight(state.player,monster,state.maze.layout.walls);
}
export function monsterDistance(state){
  const monster=nearestMonster(state);return monster?rangeToMonster(state,monster):Infinity;
}
export const waveSize=escaped=>1+Math.floor(Math.max(0,escaped)/(ROOMS.escapesPerAdditionalMonster??2));
export const monsterMultiplier=escaped=>(ROOMS.monsterSpeedGrowth??1.1)**Math.max(0,escaped);
export function createRun({random=Math.random}={}){
  const maze=new InfiniteMaze(),player={x:0,y:ROOMS.floorCenter,z:0};maze.update(player);
  const flight=createEagleState(),firstStep=maze.layout.pathToExit?.[1],start=cellAt(player);
  if(firstStep)flight.heading=(Math.atan2(firstStep.x-start.x,start.z-firstStep.z)*180/Math.PI+360)%360;
  const exitDistance=maze.layout.remainingDistance??Math.hypot(EXIT.x-player.x,EXIT.z-player.z);
  const state={flight,player,maze,elapsed:0,travelled:0,room:start,roomsEntered:1,
    mode:'playing',monsters:[],encounter:0,escaped:0,chaseRemaining:0,sightingRemaining:0,
    nextEncounter:ROOMS.firstEncounterAfter,safeUntil:0,events:[],reason:null,closest:Infinity,impact:null,wallHits:0,
    exit:EXIT,initialExitDistance:exitDistance,remainingDistance:exitDistance,hasTakenOff:false,airborneLocked:false,
    random,...createPowerState()};
  // Preserve consumers of the former single pursuer API. Assigning a legacy
  // test fixture replaces the wave; reads return the nearest active threat.
  Object.defineProperty(state,'monster',{enumerable:true,get(){return nearestMonster(this);},set(value){this.monsters=value?[value]:[];}});
  syncPowerBoxes(state);return state;
}
function spawnMonsters(state){
  const count=waveSize(state.escaped),cell=cellAt(state.player),minimum=Math.max(2,ROOMS.monsterSpawnMinRooms??2);
  const heading=state.flight.heading*Math.PI/180,maxDepth=minimum+Math.ceil(Math.sqrt(count))+3;
  const queue=[{...cell,depth:0}],visited=new Set([cell.x+','+cell.z]),candidates=[];
  // Graph distance keeps every spawn at least two real doorways away. The
  // search expands with wave size instead of silently capping enemy count.
  for(let cursor=0;cursor<queue.length&&cursor<Math.max(160,count*24);cursor++){
    const current=queue[cursor];
    if(current.depth>=minimum){
      const point=cellCenter(current),dx=point.x-state.player.x,dz=point.z-state.player.z;
      const forward=(dx*Math.sin(heading)-dz*Math.cos(heading))/Math.max(.01,Math.hypot(dx,dz));
      candidates.push({...current,forward});
    }
    if(current.depth>=maxDepth)continue;
    for(const next of state.maze.neighbors(current)){
      const id=next.x+','+next.z;if(visited.has(id))continue;
      visited.add(id);queue.push({...next,depth:current.depth+1});
    }
  }
  if(!candidates.length)return;
  const draw=()=>clamp(Number(state.random?.())||0,0,.9999999999999999),used=new Set();
  for(let index=0;index<count;index++){
    const requestedAhead=draw()<(ROOMS.monsterFrontChance??.6);
    let available=candidates.filter(candidate=>!used.has(candidate.x+','+candidate.z));
    // Extremely large waves may share a room, but never exceed the requested
    // population or spawn inside a wall. Ordinary waves use distinct rooms.
    if(!available.length)available=candidates;
    const preferred=available.filter(candidate=>(candidate.forward>.15)===requestedAhead);
    const pool=preferred.length?preferred:available,minDepth=Math.min(...pool.map(candidate=>candidate.depth));
    const near=pool.filter(candidate=>candidate.depth<=minDepth+1),choice=near[Math.floor(draw()*near.length)];
    const spawn={x:choice.x,z:choice.z};used.add(spawn.x+','+spawn.z);
    state.monsters.push({...cellCenter(spawn),id:state.encounter+'-'+index,stage:'emerging',seen:false,age:0,path:[],repath:0,
      spawnCell:spawn,spawnRoomsAway:choice.depth,spawnAhead:choice.forward>.15,requestedAhead,speedMultiplier:monsterMultiplier(state.escaped)});
  }
  state.encounter++;state.events.push('emerge');
}
function reachesExit(previous,player,exit){
  const dx=player.x-previous.x,dz=player.z-previous.z,lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared?clamp(((exit.x-previous.x)*dx+(exit.z-previous.z)*dz)/lengthSquared,0,1):0;
  return Math.hypot(previous.x+dx*t-exit.x,previous.z+dz*t-exit.z)<=exit.radius;
}
function navigateMonster(state,monster,target,speed,dt){
  const walls=state.maze.layout.walls;
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
  for(const monster of state.monsters)if(monster.stage!=='retreating')monster.stage='chasing';
  state.chaseRemaining=ROOMS.chaseSeconds;state.events.push('chase-start');
}
function sighting(state,monster){
  monster.seen=true;state.sightingRemaining=ROOMS.sightingSeconds;
  if(!state.events.includes('sighting'))state.events.push('sighting');
}
export function stepRun(state,input,dt){
  state.events=[];
  if(!input.active||input.paused||state.mode!=='playing'){stepEagle(state.flight,{active:false},0);return state;}
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(dt===0)return state;
  if(state.impact){state.impact.remaining=Math.max(0,state.impact.remaining-dt);if(state.impact.remaining===0)state.impact=null;}
  const previous={...state.player},beforeHeading=state.flight.heading,wasFlying=state.flight.flying;
  stepEagle(state.flight,input,dt);
  // Body input steers immediately; the original smoothed bank remains visible.
  // In particular, the duck stops yawing as soon as the player straightens up.
  const turn=state.flight.flying?clamp(Number(input.bank)||0,-1,1)*38*.42*ROOMS.turnGain*dt:0;
  state.flight.heading=(beforeHeading+turn+360)%360;
  const midHeading=(beforeHeading+turn*.5)*Math.PI/180,moved=worldSpeed(state.flight)*playerPowerFactor(state)*dt;
  state.player.x+=Math.sin(midHeading)*moved;state.player.z-=Math.cos(midHeading)*moved;
  const maxAltitude=(ROOMS.maxCenter-ROOMS.floorCenter)/ROOMS.heightScale;
  if(state.flight.altitude>maxAltitude){state.flight.altitude=maxAltitude;state.flight.verticalSpeed=Math.min(0,state.flight.verticalSpeed);}
  state.player.y=worldHeight(state.flight.altitude);
  state.maze.update(state.player);
  state.elapsed+=dt;state.safeUntil=Math.max(0,state.safeUntil-dt);state.sightingRemaining=Math.max(0,state.sightingRemaining-dt);
  if(sweptWall(previous,state.player,state.flight,state.maze.layout.walls)){
    bounceOffWall(state,previous,state.maze.layout.walls);
  }
  state.maze.update(state.player);
  state.travelled+=Math.hypot(state.player.x-previous.x,state.player.z-previous.z);
  state.hasTakenOff=state.flight.hasTakenOff||wasFlying||state.flight.flying;
  state.airborneLocked=state.flight.airborneLocked;
  const directExitDistance=Math.hypot(state.exit.x-state.player.x,state.exit.z-state.player.z);
  state.remainingDistance=state.maze.layout.pathToExit?.length===1?directExitDistance:(state.maze.layout.remainingDistance??directExitDistance);
  // Keep telemetry in sync after movement and automatic wall turnarounds.
  state.flight.x=state.player.x/ROOMS.flightScale;state.flight.distance=-state.player.z/ROOMS.flightScale;
  const room=cellAt(state.player);
  if(room.x!==state.room.x||room.z!==state.room.z){state.room=room;state.roomsEntered++;}
  stepPowers(state,previous,dt);
  // Use the actual post-collision segment, so an exit beyond a wall cannot be
  // reached by the intended movement. Arrival takes priority over a pursuer.
  if(reachesExit(previous,state.player,state.exit)){
    state.mode='won';state.reason='exit';state.remainingDistance=0;
    state.flight.speed=0;state.flight.verticalSpeed=0;state.flight.crashed=false;
    state.events.push('won');return state;
  }
  const firstEncounterReady=state.encounter>0||state.travelled>=(ROOMS.firstEncounterDistance??45);
  if(!state.monsters.length&&state.elapsed>=state.nextEncounter&&firstEncounterReady&&state.flight.flying)spawnMonsters(state);
  const active=state.monsters.filter(monster=>monster.stage!=='retreating'),chasing=active.some(monster=>monster.stage==='chasing');
  const effect=monsterPowerFactor(state);
  for(const monster of state.monsters)monster.age+=dt;
  if(active.length&&!chasing){
    for(const monster of active){
      navigateMonster(state,monster,state.player,ROOMS.monsterEmergingSpeed*(monster.speedMultiplier??monsterMultiplier(state.escaped))*effect,dt);
      if(!monster.seen&&seesMonster(state,monster))sighting(state,monster);
    }
    if(active.some(monster=>seesMonster(state,monster)||monster.age>3.5))beginChase(state);
  }else if(chasing){
    // One clock per wave: surviving several simultaneous monsters counts as
    // one escape, rather than multiplying progression by enemy population.
    state.chaseRemaining=Math.max(0,state.chaseRemaining-dt);
    for(const monster of active){
      if(!monster.seen&&seesMonster(state,monster))sighting(state,monster);
      navigateMonster(state,monster,state.player,ROOMS.monsterSpeed*(monster.speedMultiplier??monsterMultiplier(state.escaped))*effect,dt);
    }
    if(state.chaseRemaining<=1e-8){
      for(const monster of active){monster.stage='retreating';monster.retreatAge=0;monster.path=[];monster.repath=0;}
      state.escaped++;state.safeUntil=4;state.events.push('escaped');state.nextEncounter=state.elapsed+ROOMS.encounterCooldown;
    }
  }
  for(const monster of state.monsters){
    if(monster.stage==='retreating'){
      monster.retreatAge=(monster.retreatAge??0)+dt;
      navigateMonster(state,monster,cellCenter(monster.spawnCell),ROOMS.monsterRetreatSpeed*(monster.speedMultiplier??1)*effect,dt);
    }else{
      const range=rangeToMonster(state,monster);state.closest=Math.min(state.closest,range);
      if(range<=ROOMS.dangerRadius&&!hasMonsterShield(state)){
        state.mode='lost';state.reason='monster';state.flight.crashed=true;
        if(!state.events.includes('caught'))state.events.push('caught');
      }
    }
  }
  state.monsters=state.monsters.filter(monster=>monster.stage!=='retreating'||(monster.retreatAge<=3.5&&rangeToMonster(state,monster)<=45));
  return state;
}
