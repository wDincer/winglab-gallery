const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const good=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>.55&&(p.presence??1)>.55;
export class CombatGestures{
 constructor(){this.reset();}
 reset(){this.neutral=null;this.samples=[];this.aim={x:.5,y:.42};this.opened=false;this.lastClap=-Infinity;this.previous=null;this.holdUntil=0;this.holdStart=0;}
 resetHead(){this.neutral=null;this.samples=[];}
 update(points,now,width=640,height=480){
  if(!points){this.previous=null;this.opened=false;this.holdUntil=0;this.samples=[];return{aim:this.aim,clap:false,hold:false,headTracked:false,headReady:false};}
  const shoulder=good(points[11])&&good(points[12])?Math.hypot((points[11].x-points[12].x)*width,(points[11].y-points[12].y)*height):0;
  let headTracked=false;
  if(shoulder>12&&[0,7,8].every(i=>good(points[i]))){
   // Nose relative to ears: head motion moves aim, whole-body translations do not.
   const raw={x:((points[7].x+points[8].x)/2-points[0].x)*width/shoulder,y:(points[0].y-(points[7].y+points[8].y)/2)*height/shoulder};headTracked=true;
   if(!this.neutral){this.samples.push({raw,time:now});if(this.samples.length>25)this.samples.shift();const first=this.samples[0];if(now-first.time>=600){this.neutral={x:this.samples.reduce((s,p)=>s+p.raw.x,0)/this.samples.length,y:this.samples.reduce((s,p)=>s+p.raw.y,0)/this.samples.length};}}
   if(this.neutral){const x=clamp(.5+(raw.x-this.neutral.x)*2.4,.07,.93),y=clamp(.42+(raw.y-this.neutral.y)*2.8,.1,.85);this.aim.x+=(x-this.aim.x)*.32;this.aim.y+=(y-this.aim.y)*.32;}
  }else{this.samples=[];}
  let clap=false,hold=false;
  if(shoulder>12&&good(points[15])&&good(points[16])){
   const gap=Math.hypot((points[15].x-points[16].x)*width,(points[15].y-points[16].y)*height)/shoulder;
   const chestY=(points[11].y+points[12].y+points[23].y+points[24].y)/4;
   const handsY=(points[15].y+points[16].y)/2;const atChest=Math.abs(handsY-chestY)*height<shoulder*1.1;
   const previous=this.previous,elapsed=previous?(now-previous.time)/1000:0;
   const closing=previous&&elapsed>0&&elapsed<.3?(previous.gap-gap)/elapsed:0;
   if(gap>1.05){this.opened=true;this.holdStart=0;}
   if(this.opened&&gap<.95&&closing>.9&&atChest&&!this.holdStart){this.holdStart=now;this.holdUntil=now+700;}
   if(this.opened&&gap<.32&&closing>.65&&atChest&&now-this.lastClap>850){clap=true;this.lastClap=now;this.opened=false;this.holdUntil=Math.max(this.holdUntil,now+450);}
   hold=now<this.holdUntil;this.previous={gap,time:now};
  }else{this.previous=null;this.opened=false;this.holdUntil=0;}
  return{aim:{...this.aim},clap,hold,headTracked,headReady:!!this.neutral};
 }
}
