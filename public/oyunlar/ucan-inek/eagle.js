import {clamp,createFlightState} from './flight.js';
import {COW_WORLD} from './cow-world.js?v=cow-freeflight-v1';

// Keep gesture history outside flight telemetry. Pausing can discard incomplete
// gestures while leaving the visible flight state completely frozen.
const gestures=new WeakMap();
const radians=Math.PI/180;

export function eagleBand(angle,flapping=false){
  if(flapping)return {id:'flap',label:'KANAT ÇIRP · HIZLAN',target:190};
  if(angle<70)return {id:'dive',label:'ELLER AŞAĞIDA · ALÇAL',target:105};
  if(angle<=100)return {id:'glide',label:'GÖĞÜS HİZASI · SÜZÜL',target:48};
  return {id:'climb',label:'ELLER YUKARIDA · YÜKSEL',target:90};
}

export function createEagleState(){
  return {...createFlightState(),altitude:COW_WORLD.startAltitude,vehicle:'eagle',band:'glide',flapCount:0,
    flapping:false,flapPower:0,leftWingAngle:90,rightWingAngle:90,launching:false,launchStartedAt:null};
}

function newGesture(left,right,time){
  return {left,right,canArm:true,armed:false,raisedAt:0,peakLeft:0,peakRight:0,
    lastStroke:-Infinity,flapUntil:-Infinity,manualAt:-Infinity,idle:0,power:0,raiseTime:0,time};
}

function updateGesture(state,input,dt,left,right){
  let gesture=gestures.get(state);
  if(!gesture){gesture=newGesture(left,right,state.time);gestures.set(state,gesture);}
  const moving=Math.max(Math.abs(left-gesture.left),Math.abs(right-gesture.right))>dt*30;
  gesture.idle=moving?0:gesture.idle+dt;
  gesture.power=Math.max(0,gesture.power-dt*.6);
  const symmetric=Math.abs(left-right)<30;
  if(left<=100&&right<=100)gesture.canArm=true;
  if(!symmetric)gesture.armed=false;
  if(symmetric&&left>=110&&right>=110&&gesture.canArm&&!gesture.armed){
    gesture.armed=true;gesture.canArm=false;gesture.raisedAt=state.time;
    gesture.peakLeft=left;gesture.peakRight=right;
  }
  if(gesture.armed){
    gesture.peakLeft=Math.max(gesture.peakLeft,left);
    gesture.peakRight=Math.max(gesture.peakRight,right);
    if(state.time-gesture.raisedAt>1.8)gesture.armed=false;
  }
  const elapsed=state.time-gesture.raisedAt;
  // Engage on the downstroke at shoulder height, rather than waiting for the
  // arms to reach the bottom. A deliberate drop of both arms still filters jitter.
  const powerstroke=gesture.armed&&symmetric&&left<=100&&right<=100&&elapsed>=.08&&
    gesture.peakLeft-left>=25&&gesture.peakRight-right>=25&&
    (gesture.peakLeft-left)/elapsed>=35&&(gesture.peakRight-right)/elapsed>=35;
  const manual=Boolean(input.flap)&&state.time-gesture.lastStroke>=.18;
  const stroke=(powerstroke||manual)&&state.time-gesture.lastStroke>=.18;
  if(stroke){
    gesture.armed=false;gesture.lastStroke=state.time;gesture.flapUntil=state.time+.95;
    gesture.power=Math.min(1,gesture.power+.7);gesture.idle=0;
    if(manual)gesture.manualAt=state.time;
    state.flapCount++;
  }
  const manualAge=state.time-gesture.manualAt;
  const manualAnimation=manualAge>=0&&manualAge<.7;
  // One explicit keyboard stroke moves the wings once. Real camera wings always
  // follow the measured arms, including ordinary banking and a held posture.
  const syntheticAngle=90+65*Math.sin(manualAge/.7*Math.PI*2);
  state.leftWingAngle=manualAnimation?syntheticAngle:left;
  state.rightWingAngle=manualAnimation?syntheticAngle:right;
  const angle=(left+right)/2;
  const holdLimit=angle>100?.22:angle<80?.4:.12;
  state.flapping=state.time<gesture.flapUntil&&(manualAnimation||gesture.idle<holdLimit);
  state.flapPower=gesture.power;
  gesture.left=left;gesture.right=right;gesture.time=state.time;
  return stroke;
}

export function stepEagle(state,input,dt){
  if(state.crashed)return state;
  if(!input.active||input.paused){gestures.delete(state);return state;}
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
  if(dt===0)return state;
  const fallback=Number.isFinite(input.angle)?clamp(input.angle,0,180):90;
  const left=Number.isFinite(input.leftAngle)?clamp(input.leftAngle,0,180):fallback;
  const right=Number.isFinite(input.rightAngle)?clamp(input.rightAngle,0,180):fallback;
  const angle=(left+right)/2;
  state.time+=dt;
  const stroke=updateGesture(state,input,dt,left,right);
  const gesture=gestures.get(state);
  // The wrist command is independent of elbow angles: bent elbows can remain
  // below the shoulders while the hands are deliberately raised above the chest.
  const handsAboveChest=typeof input.handsAboveChest==='boolean'?input.handsAboveChest:left>100&&right>100;
  const handsBelowChest=!handsAboveChest&&(typeof input.handsBelowChest==='boolean'?input.handsBelowChest:left<70&&right<70);
  const raised=!state.flying&&handsAboveChest;
  gesture.raiseTime=raised?gesture.raiseTime+dt:0;
  if(gesture.raiseTime>=.18){
    state.flying=true;state.launching=true;state.launchStartedAt=state.time;state.speed=Math.max(state.speed,48);gesture.raiseTime=0;
  }
  if(stroke){
    state.speed=Math.max(state.speed,Math.min(210,state.speed+46));
    if(!state.flying){state.flying=true;state.launching=true;state.launchStartedAt=state.time;}
  }
  const band=state.flapping?eagleBand(angle,true):handsAboveChest?eagleBand(120):handsBelowChest?eagleBand(45):eagleBand(90);
  state.band=band.id;
  const requestedBoost=Number(input.boost);
  const boost=state.flying&&state.altitude>.03
    ?clamp(Number.isFinite(requestedBoost)?requestedBoost:1,1,1.45):1;
  state.courseBoostActive=boost>1;
  const target=state.flying?band.target*boost:0;
  // Keep the earned flap momentum through every held-hand stance. Raising the
  // hands now commands ascent, rather than braking the cow above the tower.
  const response=target<state.speed?(state.flying?.18:2.8):band.id==='flap'?5.5:3;
  state.speed+=(target-state.speed)*(1-Math.exp(-dt*response));
  if(target===0&&state.speed<.5)state.speed=0;

  let verticalTarget=0;
  if(state.flying){
    if(handsAboveChest)verticalTarget=COW_WORLD.climbRate;
    else if(handsBelowChest)verticalTarget=-COW_WORLD.descentRate;
    if(state.altitude>=COW_WORLD.maxAltitude)verticalTarget=Math.min(0,verticalTarget);
  }
  if(verticalTarget===0)state.verticalSpeed=0;
  else state.verticalSpeed+=(verticalTarget-state.verticalSpeed)*(1-Math.exp(-dt*7));
  state.altitude=clamp(state.altitude+state.verticalSpeed*dt,0,COW_WORLD.maxAltitude);
  if(state.altitude===COW_WORLD.maxAltitude)state.verticalSpeed=Math.min(0,state.verticalSpeed);
  if(state.launching&&(state.altitude>=COW_WORLD.startAltitude+10||state.time-state.launchStartedAt>=.9))state.launching=false;
  if(state.altitude===0&&state.flying&&state.verticalSpeed<0){
    state.flying=false;state.launching=false;state.landings++;state.verticalSpeed=0;
  }
  // Briefly stabilize roll beside the tower rim, then restore normal steering.
  const bankTarget=state.flying&&!state.launching?clamp(input.bank||0,-1,1)*38:0;
  state.bank+=(bankTarget-state.bank)*(1-Math.exp(-dt*10));
  state.heading=(state.heading+state.bank*.42*dt+360)%360;
  const moved=state.speed*.514444*dt;
  state.distance+=Math.cos(state.heading*radians)*moved;
  state.x+=Math.sin(state.heading*radians)*moved;state.travelled+=moved;
  const launchPitch=state.launching?clamp((state.time-state.launchStartedAt)/.35,0,1):1;
  const targetPitch=state.flying?clamp(state.verticalSpeed*1.8,-26,19)*launchPitch:0;
  state.pitch+=(targetPitch-state.pitch)*(1-Math.exp(-dt*4));
  return state;
}
