import {EAGLE_GEOMETRY,eagleWingAngle} from './eagle-geometry.js';
export const COW_GEOMETRY=Object.freeze({bodyWidth:1.5,bodyHeight:1.05,bodyLength:2.65,headZ:-3.05,noseZ:-3.95,tailZ:5.65});
export function cowProbes(state){
  const g=COW_GEOMETRY;
  const probes=[[0,0,0,g.bodyWidth],[0,.55,g.headZ,.8],[0,.25,g.noseZ,.45],[0,.25,3,.4],[0,.65,g.tailZ,.55]];
  for(const side of[-1,1]){
    for(const z of[-1.65,1.7])probes.push([side*.95,-1.56,z,.28]);
    const angle=eagleWingAngle(side<0?state.leftWingAngle:state.rightWingAngle,state.altitude)*Math.PI/180-Math.PI/2;
    for(const span of[2,4,6,EAGLE_GEOMETRY.wingReach])probes.push([side*(EAGLE_GEOMETRY.shoulderX+span*Math.cos(angle)),EAGLE_GEOMETRY.shoulderY+span*Math.sin(angle),EAGLE_GEOMETRY.shoulderZ+.6,.32]);
  }
  const yaw=-(state.heading??0)*Math.PI/180,roll=-(state.bank??0)*Math.PI/180,pitch=(state.pitch??0)*Math.PI/180;
  return probes.map(([x,y,z,r])=>{
    const rx=x*Math.cos(roll)-y*Math.sin(roll),ry=x*Math.sin(roll)+y*Math.cos(roll);
    const py=ry*Math.cos(pitch)-z*Math.sin(pitch),pz=ry*Math.sin(pitch)+z*Math.cos(pitch);
    return {x:state.x+rx*Math.cos(yaw)+pz*Math.sin(yaw),y:state.altitude+2.15+py,z:-state.distance-rx*Math.sin(yaw)+pz*Math.cos(yaw),r};
  });
}
