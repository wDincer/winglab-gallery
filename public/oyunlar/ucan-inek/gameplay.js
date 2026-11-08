import {seededRandom,BUILDINGS,BRIDGE_SOLIDS} from './neighborhood.js?v=cow-freeflight-v1';
import {cowProbes} from './cow-geometry.js?v=cow-freeflight-v1';
import {COW_WORLD} from './cow-world.js?v=cow-freeflight-v1';

export const PICKUP_RADIUS=18;
export const PLATE_RADIUS=2.2;
export const CHEF_SPEED=40;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function segmentDistanceSquared(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz;
  const t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l,0,1):0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2+(p.z-a.z-dz*t)**2;
}
export function createGame(seed=Math.floor(Math.random()*2147483645)+1){
  seed=Math.abs(Math.trunc(seed))%2147483646||1;
  const random=seededRandom(seed),hay=[],count=COW_WORLD.hayCount;
  const shuffle=()=>{const cells=Array.from({length:count},(_,i)=>i);for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}return cells;};
  const xs=shuffle(),zs=shuffle(),ys=shuffle();
  for(let i=0;i<count;i++){
    let x=((xs[i]+random())/count*2-1)*COW_WORLD.haySpread;
    let z=((zs[i]+random())/count*2-1)*COW_WORLD.haySpread;
    let y=40+(ys[i]+random())/count*(COW_WORLD.maxAltitude-60);
    // Nearby discoveries in several directions introduce collecting without
    // turning the random airspace into a compulsory line of checkpoints.
    if(i<6){
      const angle=[0,1.35,3.05,4.6,.75,3.85][i],radius=[46,62,74,88,118,135][i];
      x=Math.sin(angle)*radius;z=-Math.cos(angle)*radius;y=COW_WORLD.startAltitude+24+i*12;
    }
    const roof=BUILDINGS.filter(b=>Math.abs(b.x-x)<b.width/2+7&&Math.abs(b.z-z)<b.depth/2+7)
      .reduce((height,b)=>Math.max(height,b.height+(b.roof??0)),0);
    y=Math.min(COW_WORLD.maxAltitude-12,Math.max(y,roof+10));
    hay.push({id:i,x,y,z,collected:false,collectedAt:0,phase:random()*Math.PI*2});
  }
  return {seed,hay,total:0,remaining:hay.length,plates:[],chef:null,nextAttack:6.5,throwCount:0,encounter:0,nearMisses:0,towerCleared:false,events:[]};
}
export function makePlate(origin,target,id=0){
  const speed=85,dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,length=Math.hypot(dx,dy,dz)||1;
  return {id,...origin,previous:{...origin},vx:dx/length*speed,vy:dy/length*speed,vz:dz/length*speed,age:0,radius:PLATE_RADIUS};
}
export function randomPlate(origin,seed,id=0){
  const random=seededRandom(Math.abs(Math.trunc(seed+(id+1)*104729))%2147483646+1);
  return makePlate(origin,{x:origin.x+(random()-.5)*200,y:clamp(origin.y+(random()-.5)*120,10,COW_WORLD.maxAltitude),z:origin.z+(random()-.5)*200},id);
}
export function detectCowEnvironment(previous,current,{allowTowerLaunch=(previous.launching||current.launching)}={}){
  const motion=Math.hypot(current.x-previous.x,current.distance-previous.distance,current.altitude-previous.altitude);
  const sweep=Math.max(Math.abs((current.leftWingAngle??90)-(previous.leftWingAngle??90)),Math.abs((current.rightWingAngle??90)-(previous.rightWingAngle??90)))*.145;
  const count=Math.max(1,Math.ceil(Math.max(motion,sweep)/1.25));
  const minX=Math.min(previous.x,current.x)-20,maxX=Math.max(previous.x,current.x)+20;
  const minZ=Math.min(-previous.distance,-current.distance)-20,maxZ=Math.max(-previous.distance,-current.distance)+20;
  const nearby=[...BUILDINGS,...BRIDGE_SOLIDS].filter(b=>b.x+b.width/2>=minX&&b.x-b.width/2<=maxX&&b.z+b.depth/2>=minZ&&b.z-b.depth/2<=maxZ);
  const tower=COW_WORLD.tower;
  for(let i=0;i<=count;i++){
    const f=i/count,s={...current};
    for(const k of['x','distance','altitude','bank','pitch','leftWingAngle','rightWingAngle'])s[k]=(previous[k]??0)+((current[k]??0)-(previous[k]??0))*f;
    const delta=((current.heading-previous.heading+540)%360)-180;s.heading=previous.heading+delta*f;
    for(const p of cowProbes(s)){
      if((current.flying||previous.flying)&&p.y-p.r<-.03)return {type:'ground',message:'Yere biraz fazla yaklaştın.'};
      const radial=Math.max(0,Math.hypot(p.x-tower.x,p.z-tower.z)-tower.radius);
      const vertical=Math.max(0,-p.y,p.y-tower.height);
      const launchClearance=allowTowerLaunch&&s.altitude>=tower.height-1&&p.y>=tower.height-10;
      if(!launchClearance&&radial*radial+vertical*vertical<=p.r*p.r)return {type:'tower',message:'Kalkış kulesine çarptın. Kulenin üstünden veya yanından geç.'};
      for(const b of nearby){
        const dx=Math.max(0,Math.abs(p.x-b.x)-b.width/2),dz=Math.max(0,Math.abs(p.z-b.z)-b.depth/2);
        const dy=Math.max(0,(b.minY??0)-p.y,p.y-(b.height+(b.roof??0)));
        if(dx*dx+dy*dy+dz*dz<=p.r*p.r)return {type:b.type??'building',message:b.type==='bridge'?'Köprüye çarptın. Altından veya üstünden geç.':'Mahallenin çatısına çarptın.'};
      }
    }
  }
  if(previous.flying&&current.altitude<=.03&&current.altitude<previous.altitude)return {type:'ground',message:'İniş biraz sert oldu.'};
  return null;
}
export function plateHitsCow(plate,previous,current){
  const a=cowProbes(previous),b=cowProbes(current);
  return b.some((p,i)=>segmentDistanceSquared({x:0,y:0,z:0},
    {x:plate.previous.x-a[i].x,y:plate.previous.y-a[i].y,z:plate.previous.z-a[i].z},
    {x:plate.x-p.x,y:plate.y-p.y,z:plate.z-p.z})<=(PLATE_RADIUS+p.r)**2);
}
function playerPoint(flight){return {x:flight.x,y:flight.altitude+2.15,z:-flight.distance};}
function spawnChef(game,flight){
  const random=seededRandom((game.seed+game.encounter*104729)%2147483646+1),side=game.encounter++%2?1:-1;
  const angle=flight.heading*Math.PI/180+side*(.6+random()*.5),range=160+random()*35;
  game.chef={x:flight.x+Math.sin(angle)*range,y:clamp(flight.altitude-2.05+(random()-.5)*80,16,COW_WORLD.maxAltitude-8),
    z:-flight.distance-Math.cos(angle)*range,spawnAt:flight.time,throwAt:Infinity,thrown:false,stage:'approaching',side,age:0};
  game.nextAttack=Infinity;
}
function moveChef(chef,target,speed,dt,standoff=45){
  const dx=target.x-chef.x,dy=target.y-chef.y,dz=target.z-chef.z,length=Math.hypot(dx,dy,dz)||1;
  const difference=length-standoff,amount=Math.sign(difference)*Math.min(Math.abs(difference),speed*dt);
  chef.x+=dx/length*amount;chef.y+=dy/length*amount;chef.z+=dz/length*amount;
}
export function stepGame(game,previous,flight,dt,{active=true,paused=false}={}){
  game.events=[];
  if(!active||paused||flight.crashed||(!flight.flying&&!previous.flying))return null;
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(dt===0)return null;
  const tower=COW_WORLD.tower;
  const collision=detectCowEnvironment(previous,flight,{allowTowerLaunch:!game.towerCleared&&(previous.launching||flight.launching)});
  if(collision)return collision;
  if(flight.altitude>=tower.height+12||Math.hypot(flight.x-tower.x,-flight.distance-tower.z)>tower.radius+14)game.towerCleared=true;
  const a=playerPoint(previous),b=playerPoint(flight);
  for(const hay of game.hay)if(!hay.collected&&segmentDistanceSquared(hay,a,b)<=PICKUP_RADIUS**2){
    hay.collected=true;hay.collectedAt=flight.time;game.total++;game.remaining--;game.events.push({type:'hay',hay});
  }
  if(!game.chef&&flight.time>=game.nextAttack)spawnChef(game,flight);
  const chef=game.chef;
  if(chef){
    chef.age+=dt;
    const target={x:flight.x,y:flight.altitude-2.05,z:-flight.distance};
    if(chef.stage==='approaching'||chef.stage==='warning'){
      moveChef(chef,target,CHEF_SPEED,dt);
      const range=Math.hypot(target.x-chef.x,target.y-chef.y,target.z-chef.z);
      if(chef.stage==='approaching'&&range<=70){chef.stage='warning';chef.throwAt=flight.time+1.35;game.events.push({type:'warning'});}
      if(chef.stage==='warning'&&flight.time>=chef.throwAt){
        const origin={x:chef.x,y:chef.y+4.2,z:chef.z};
        // Aim once at release. Banking or changing height after the warning
        // dodges the plate; its velocity never homes in on the cow afterward.
        const plate=makePlate(origin,b,game.throwCount++);game.plates.push(plate);
        chef.throwDirection={x:plate.vx,y:plate.vy,z:plate.vz};chef.thrown=true;chef.stage='retreating';chef.retreatAge=0;
        const retreatLength=Math.hypot(chef.x-b.x,chef.y-b.y,chef.z-b.z)||1;
        chef.retreat={x:(chef.x-b.x)/retreatLength,y:.32,z:(chef.z-b.z)/retreatLength};
        game.events.push({type:'throw'});
      }else if(chef.age>15){chef.stage='retreating';chef.retreatAge=0;chef.retreat={x:chef.side*.7,y:.3,z:.7};}
    }else{
      chef.retreatAge+=dt;chef.x+=chef.retreat.x*CHEF_SPEED*dt;chef.y+=chef.retreat.y*CHEF_SPEED*dt;chef.z+=chef.retreat.z*CHEF_SPEED*dt;
      if(chef.retreatAge>3.2){game.chef=null;game.nextAttack=flight.time+5;}
    }
  }
  for(const plate of game.plates){
    plate.previous={x:plate.x,y:plate.y,z:plate.z};plate.age+=dt;
    plate.x+=plate.vx*dt;plate.y+=plate.vy*dt;plate.z+=plate.vz*dt;
    if(plateHitsCow(plate,previous,flight))return {type:'plate',message:'Uçan pilavcının tabağı sana çarptı!'};
  }
  game.plates=game.plates.filter(p=>p.age<5&&p.y>-15&&p.y<COW_WORLD.maxAltitude+140&&Math.hypot(p.x-b.x,p.z-b.z)<950);
  return null;
}
