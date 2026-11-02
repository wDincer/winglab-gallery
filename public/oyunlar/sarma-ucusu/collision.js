import {getCourseGates} from './course.js';
import {RING,BUILDINGS,position} from './game-rules.js';
const probes=[[0,0,0,2.3],[-2.3,0,-4.6,1.1],[2.3,0,-4.6,1.1],[0,.2,-6,.5],[-2.5,1,4.3,1.2],[2.5,1,4.3,1.2],[-2.3,4.7,5.2,.65],[2.3,4.7,5.2,.65],[0,1.7,0,1.3]];
export function detectCollision(previous,current){
  if(!previous||!current||(!previous.flying&&!current.flying))return null;
  const a=position(previous),b=position(current);
  if(![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite))return null;
  const samples=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/1.3));
  const gates=getCourseGates().filter(g=>g.distance>=Math.min(previous.distance,current.distance)-12&&g.distance<=Math.max(previous.distance,current.distance)+12);
  for(let i=0;i<=samples;i++){
    const t=i/samples,center={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
    const yaw=-current.heading*Math.PI/180,roll=-current.bank*Math.PI/180,pitch=current.pitch*Math.PI/180;
    for(const [x,y,z,r]of probes){
      const rx=x*Math.cos(roll)-y*Math.sin(roll),ry=x*Math.sin(roll)+y*Math.cos(roll);
      const py=ry*Math.cos(pitch)-z*Math.sin(pitch),pz=ry*Math.sin(pitch)+z*Math.cos(pitch);
      const p={x:center.x+rx*Math.cos(yaw)+pz*Math.sin(yaw),y:center.y+py,z:center.z-rx*Math.sin(yaw)+pz*Math.cos(yaw)};
      if(p.y-r<0&&current.altitude>2)return {type:'ground',message:'Deniz tabanına çarptın.',fraction:t};
      for(const gate of gates){
        const radial=Math.hypot(p.x-gate.x,p.y-gate.y)-RING.radius;
        if(Math.hypot(radial,p.z-gate.z)<=RING.tube+r)return {type:'gate',message:'Can simidinin kenarına çarptın.',fraction:t};
      }
      for(const building of BUILDINGS){
        if(Math.abs(p.z-building.z)>building.radius+r)continue;
        if(p.y-r<building.height&&Math.hypot(p.x-building.x,p.z-building.z)<building.radius+r)return {type:'building',message:'Kasabadaki bir binaya çarptın.',fraction:t};
      }
    }
  }
  if(previous.flying&&current.altitude<previous.altitude&&current.altitude<=.03)return {type:'ground',message:'Deniz tabanına çarptın.',fraction:1};
  return null;
}
