// Wrist separation is normalized by shoulder width, independent of camera distance.
const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55&&(p.presence??1)>.55;
export function handSeparation(landmarks,aspect=4/3){
  if(![11,12,15,16].every(i=>visible(landmarks?.[i])))return null;
  const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
  const shoulder=distance(landmarks[11],landmarks[12]);
  if(shoulder<.045)return null;
  const wrists=[landmarks[15],landmarks[16]],top=Math.min(landmarks[11].y,landmarks[12].y)-.2;
  const bottom=Math.max(landmarks[23]?.y??.85,landmarks[24]?.y??.85)+.1;
  if(!wrists.every(p=>p.y>top&&p.y<bottom))return null;
  return distance(...wrists)/shoulder;
}
export class ClapDetector{
  constructor(){this.reset();}
  reset(){this.armed=false;this.lastGap=null;this.lastTime=null;this.lastClap=-Infinity;this.closingUntil=0;}
  update(landmarks,time,aspect=4/3){
    const gap=handSeparation(landmarks,aspect);
    if(gap===null||!Number.isFinite(time)){this.armed=false;this.lastGap=null;this.lastTime=null;return {clapped:false,closing:false,armed:false};}
    if(this.lastTime!==null&&(time-this.lastTime>250||time<this.lastTime)){this.armed=false;this.lastGap=null;}
    const dt=this.lastTime===null?0:(time-this.lastTime)/1000;
    const closingSpeed=dt>0&&this.lastGap!==null?(this.lastGap-gap)/dt:0;
    if(gap>1.15)this.armed=true;
    const clapped=this.armed&&gap<.56&&closingSpeed>.65&&time-this.lastClap>420;
    const closing=this.armed&&gap<1.5&&closingSpeed>.5;
    if(closing)this.closingUntil=time+700;
    if(clapped){this.armed=false;this.lastClap=time;this.closingUntil=time+850;}
    this.lastGap=gap;this.lastTime=time;
    return {clapped,closing:closing||time<this.closingUntil,armed:this.armed,gap};
  }
}
