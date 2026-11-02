import {COURSE,coursePoint} from './course.js';
import {seededRandom,BUILDINGS,BRIDGE_SOLIDS} from './neighborhood.js';
import {cowProbes} from './cow-geometry.js';

export const PICKUP_RADIUS=18;
export const PLATE_RADIUS=2.2;
export function segmentDistanceSquared(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz;
  const t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l)):0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2+(p.z-a.z-dz*t)**2;
}
export function createGame(seed=Math.floor(Math.random()*2147483645)+1){
  const random=seededRandom(seed),hay=[];
  for(let i=0,d=62;d<COURSE.length-25;i++,d+=35+random()*24){
    const point=coursePoint(d),early=d<310;
    hay.push({id:i,x:point.x+(random()-.5)*(early?19:72),y:early?14+random()*7:23+random()*48,z:-d,collected:false,collectedAt:0,phase:random()*Math.PI*2});
  }
  return {seed,hay,total:0,plates:[],chef:null,nextAttack:6.5,throwCount:0,nearMisses:0,events:[]};
}
export function makePlate(origin,target,id=0){
  const speed=82,dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z,length=Math.hypot(dx,dy,dz)||1;
  return {id,...origin,previous:{...origin},vx:dx/length*speed,vy:dy/length*speed,vz:dz/length*speed,age:0,radius:PLATE_RADIUS};
}
export function randomPlate(origin,seed,id=0){
  // Throw into a broad section of the neighborhood, independently of the
  // player's position, altitude, heading, and velocity. No aim or homing.
  const random=seededRandom(((seed+(id+1)*104729)%2147483646)+1);
  const center=coursePoint(-origin.z);
  const target={x:center.x+(random()-.5)*120,y:12+random()*64,z:origin.z+(random()-.5)*260};
  return makePlate(origin,target,id);
}
export function detectCowEnvironment(previous,current){
  const motion=Math.hypot(current.x-previous.x,current.distance-previous.distance,current.altitude-previous.altitude);
  const sweep=Math.max(Math.abs((current.leftWingAngle??90)-(previous.leftWingAngle??90)),Math.abs((current.rightWingAngle??90)-(previous.rightWingAngle??90)))*.145;
  const count=Math.max(1,Math.ceil(Math.max(motion,sweep)/1.25));
  const nearby=[...BUILDINGS,...BRIDGE_SOLIDS].filter(b=>Math.abs(b.z+current.distance)<motion+b.depth/2+15&&Math.abs(b.x-current.x)<b.width/2+20);
  for(let i=0;i<=count;i++){
    const f=i/count,s={...current};
    for(const k of['x','distance','altitude','bank','pitch','leftWingAngle','rightWingAngle'])s[k]=previous[k]+(current[k]-previous[k])*f;
    const delta=((current.heading-previous.heading+540)%360)-180;s.heading=previous.heading+delta*f;
    for(const p of cowProbes(s)){
      if(current.flying&&p.y-p.r<-.03)return {type:'ground',message:'Yere biraz fazla yaklaştın.'};
      for(const b of nearby){
        const dx=Math.max(0,Math.abs(p.x-b.x)-b.width/2),dz=Math.max(0,Math.abs(p.z-b.z)-b.depth/2);
        const dy=Math.max(0,(b.minY??0)-p.y,p.y-(b.height+b.roof));
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
export function stepGame(game,previous,flight,dt,{active=true,paused=false}={}){
  game.events=[];
  if(!active||paused||flight.crashed||!flight.flying)return null;
  const collision=detectCowEnvironment(previous,flight);
  if(collision)return collision;
  const a={x:previous.x,y:previous.altitude+2.15,z:-previous.distance},b={x:flight.x,y:flight.altitude+2.15,z:-flight.distance};
  for(const hay of game.hay)if(!hay.collected&&segmentDistanceSquared(hay,a,b)<=PICKUP_RADIUS**2){
    hay.collected=true;hay.collectedAt=flight.time;game.total++;game.events.push({type:'hay',hay});
  }
  if(flight.time>=game.nextAttack&&flight.distance<COURSE.length-140){
    const side=game.throwCount%2?1:-1,point=coursePoint(flight.distance+155);
    game.chef={x:point.x+side*32,y:1.4,z:point.z,spawnAt:flight.time,throwAt:flight.time+1.45,thrown:false,side};
    game.nextAttack=flight.time+Math.max(5.2,8-flight.distance/900);game.events.push({type:'warning'});
  }
  const chef=game.chef;
  if(chef&&!chef.thrown&&flight.time>=chef.throwAt){
    const origin={x:chef.x,y:chef.y+4.2,z:chef.z};
    const plate=randomPlate(origin,game.seed,game.throwCount++);
    game.plates.push(plate);chef.throwDirection={x:plate.vx,z:plate.vz};chef.thrown=true;game.events.push({type:'throw'});
  }
  for(const plate of game.plates){
    plate.previous={x:plate.x,y:plate.y,z:plate.z};plate.age+=dt;
    plate.x+=plate.vx*dt;plate.y+=plate.vy*dt;plate.z+=plate.vz*dt;
    if(plateHitsCow(plate,previous,flight))return {type:'plate',message:'Yemekli tabak sana çarptı!'};
  }
  game.plates=game.plates.filter(p=>p.age<7&&p.y>-10);
  if(chef&&flight.time-chef.spawnAt>7)game.chef=null;
  return null;
}
