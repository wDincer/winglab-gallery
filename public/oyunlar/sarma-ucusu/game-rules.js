import {coursePoint, getCourseGates} from './course.js';

// Dimensions shared by Three.js and collision detection.
export const RING = Object.freeze({radius:34,tube:4,carRadius:3.3});
export const BOOK = Object.freeze({width:9,height:12,depth:1.6,radius:6.2,interval:8,firstAt:9,warningTime:2.5});
export const TOWNS = [120,720,1380,2060,2680];
export const BUILDINGS = TOWNS.flatMap((d,i)=>{
  const x=coursePoint(d).x;
  return [
    {type:'pineapple',x:x+122,z:-d-20,radius:23,height:76},
    {type:'moai',x:x-130,z:-d-35,radius:20,height:80},
    {type:'rock',x:x+205,z:-d+50,radius:27,height:23},
    {type:'krusty',x:x-245,z:-d-145,radius:48,height:50},
    ...Array.from({length:12},(_,j)=>({type:'tube',x:x+(j%2?1:-1)*(220+(j%3)*70),z:-d-260-Math.floor(j/2)*67,radius:15,height:32+(j%4)*10,color:(i+j)%6})),
  ];
});
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createRun(){return {gates:getCourseGates().map(g=>({...g,status:'pending'})),passed:0,missed:0,books:[],nextBookAt:BOOK.firstAt,nextBookId:0,dodged:0,finished:false};}
export function movingDistance(a0,a1,b0,b1){
  const p={x:a0.x-b0.x,y:a0.y-b0.y,z:a0.z-b0.z};
  const v={x:a1.x-a0.x-b1.x+b0.x,y:a1.y-a0.y-b1.y+b0.y,z:a1.z-a0.z-b1.z+b0.z};
  const len=v.x*v.x+v.y*v.y+v.z*v.z;
  const t=len?clamp(-(p.x*v.x+p.y*v.y+p.z*v.z)/len,0,1):0;
  return Math.hypot(p.x+t*v.x,p.y+t*v.y,p.z+t*v.z);
}
export const position=s=>({x:s.x,y:s.altitude+2.15,z:-s.distance});
export function spawnBook(run,state){
  const seconds=BOOK.warningTime,heading=state.heading*Math.PI/180,speed=state.speed*.514444;
  const target={x:state.x+Math.sin(heading)*speed*seconds,y:state.altitude+2.15+state.verticalSpeed*seconds,z:-state.distance-Math.cos(heading)*speed*seconds};
  const start={x:target.x+(run.nextBookId%2?38:-38),y:target.y+24,z:target.z-150};
  run.books.push({id:run.nextBookId++,x:start.x,y:start.y,z:start.z,vx:(target.x-start.x)/seconds,vy:(target.y-start.y)/seconds,vz:(target.z-start.z)/seconds,age:0,passed:false});
  run.nextBookAt=state.time+BOOK.interval;
}
export function updateRun(run,previous,state,dt,{active=true,paused=false}={}){
  const events=[];
  if(!active||paused||state.crashed||run.finished)return {events,collision:null};
  if(state.flying&&state.time>=run.nextBookAt)spawnBook(run,state);
  const p0=position(previous),p1=position(state);
  for(const book of run.books){
    const b0={...book};book.x+=book.vx*dt;book.y+=book.vy*dt;book.z+=book.vz*dt;book.age+=dt;
    if(movingDistance(p0,p1,b0,book)<BOOK.radius+RING.carRadius)return {events,collision:{type:'book',message:'Fenomen kitabı Batmobil’e çarptı!'}};
    if(!book.passed&&book.z>p1.z+14){book.passed=true;run.dodged++;events.push({type:'dodge'});}
  }
  run.books=run.books.filter(b=>b.age<9&&!b.passed);
  for(const gate of run.gates){
    if(gate.status!=='pending'||previous.distance>gate.distance||state.distance<gate.distance)continue;
    const t=(gate.distance-previous.distance)/(state.distance-previous.distance||1);
    const radius=Math.hypot(lerp(previous.x,state.x,t)-gate.x,lerp(previous.altitude,state.altitude,t)+2.15-gate.y);
    gate.status=radius<RING.radius-RING.tube-RING.carRadius?'passed':'missed';
    if(gate.status==='passed'){run.passed++;events.push({type:'gate',index:gate.index});}else{run.missed++;events.push({type:'miss',index:gate.index});}
  }
  if(state.distance>=run.gates.at(-1).distance){run.finished=true;events.push({type:'finish'});}
  return {events,collision:null};
}
