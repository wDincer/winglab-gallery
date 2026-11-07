import {clamp,createFlightState} from './flight.js';

export const TAKEOFF_FLAPS=2;
export const FLAP_RISE_METRES=100;
export const MAX_ALTITUDE=1200;
const climbSpeed=150;

// Keep gesture history outside flight telemetry. Pausing can discard incomplete
// gestures while leaving the visible flight state completely frozen.
const gestures=new WeakMap();
const radians=Math.PI/180;

export function eagleBand(angle,flapping=false){
  if(flapping)return {id:'flap',label:'KANAT ÇIRP · HIZLAN',target:190};
  if(angle<80)return {id:'dive',label:'DALIŞ · ÇOK HIZLI',target:205+clamp((80-angle)/80,0,1)*35};
  if(angle<=100)return {id:'glide',label:'DENGELİ SÜZÜLÜŞ',target:48};
  return {id:'brake',label:'KANATLAR YUKARI · YAVAŞLA',target:24};
}

export function createEagleState(){
  return {...createFlightState(),vehicle:'eagle',band:'glide',flapCount:0,
    flapping:false,flapPower:0,leftWingAngle:90,rightWingAngle:90,launching:false,
    climbTarget:null,launchAltitude:null};
}

function newGesture(left,right,time){
  return {left,right,canArm:true,armed:false,raisedAt:0,peakLeft:0,peakRight:0,
    lastStroke:-Infinity,flapUntil:-Infinity,manualAt:-Infinity,idle:0,power:0,time};
}

function updateGesture(state,input,dt,left,right){
  let gesture=gestures.get(state);
  if(!gesture){gesture=newGesture(left,right,state.time);gestures.set(state,gesture);}
  const moving=Math.max(Math.abs(left-gesture.left),Math.abs(right-gesture.right))>dt*30;
  gesture.idle=moving?0:gesture.idle+dt;
  gesture.power=Math.max(0,gesture.power-dt*.6);
  const symmetric=Math.abs(left-right)<30;
  // Shoulder-height strokes work on the summit and in the air. Keep a separate
  // low reset threshold so one long downstroke cannot count twice.
  const raisedAngle=85;
  const resetAngle=70;
  if(left<=resetAngle&&right<=resetAngle)gesture.canArm=true;
  if(!symmetric)gesture.armed=false;
  if(symmetric&&left>=raisedAngle&&right>=raisedAngle&&gesture.canArm&&!gesture.armed){
    gesture.armed=true;gesture.canArm=false;gesture.raisedAt=state.time;
    gesture.peakLeft=left;gesture.peakRight=right;
  }
  if(gesture.armed){
    gesture.peakLeft=Math.max(gesture.peakLeft,left);
    gesture.peakRight=Math.max(gesture.peakRight,right);
    // Time the downstroke, not a steady glide held before it begins.
    if(left>=gesture.peakLeft-5&&right>=gesture.peakRight-5)gesture.raisedAt=state.time;
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
  if(stroke){
    // Every accepted stroke contributes exactly 100 m, including the two
    // preparation strokes. Closely spaced strokes add to the unfinished climb.
    state.climbTarget=Math.min(MAX_ALTITUDE,Math.max(state.altitude,state.climbTarget??state.altitude)+FLAP_RISE_METRES);
  }
  if(stroke&&(state.flying||state.flapCount>=TAKEOFF_FLAPS)){
    state.speed=Math.max(state.speed,Math.min(210,state.speed+46));
    if(!state.flying){state.flying=true;state.launching=true;state.launchAltitude=state.altitude;}
  }
  if(state.flying&&Number.isFinite(state.climbTarget)&&state.climbTarget<=state.altitude)state.climbTarget=null;
  const band=eagleBand(angle,state.flapping);
  state.band=band.id;
  const requestedBoost=Number(input.boost);
  const boost=state.flying&&state.altitude>.03&&band.id!=='brake'
    ?clamp(Number.isFinite(requestedBoost)?requestedBoost:1,1,1.45):1;
  state.courseBoostActive=boost>1;
  const target=state.flying?band.target*boost:0;
  // Level wings coast on the speed earned by flapping. Raising the arms still
  // applies the original strong brake instead of sharing this gentle drag.
  const response=target<state.speed?(state.flying&&band.id==='glide'?.18:2.8):band.id==='flap'?5.5:3;
  state.speed+=(target-state.speed)*(1-Math.exp(-dt*response));
  if(target===0&&state.speed<.5)state.speed=0;

  let verticalTarget=0;
  const climbing=state.flying&&Number.isFinite(state.climbTarget)&&state.climbTarget>state.altitude;
  const preparing=gestures.get(state)?.armed===true;
  if(state.flying){
    // Finish the promised gain even after the downstroke stops. Level wings
    // then hold the new height, without a short flap-animation lift timer.
    if(climbing)verticalTarget=climbSpeed;
    else if(band.id==='dive'&&!preparing)verticalTarget=-(7+clamp((80-angle)/80,0,1)*15);
    if(state.altitude>=MAX_ALTITUDE)verticalTarget=Math.min(0,verticalTarget);
  }
  if(verticalTarget===0)state.verticalSpeed=0;
  else state.verticalSpeed+=(verticalTarget-state.verticalSpeed)*(1-Math.exp(-dt*7));
  state.altitude=clamp(state.altitude+state.verticalSpeed*dt,0,MAX_ALTITUDE);
  if(climbing&&state.altitude>=state.climbTarget){
    state.altitude=state.climbTarget;state.climbTarget=null;state.verticalSpeed=0;
  }
  if(state.launching&&state.altitude>=state.launchAltitude+12)state.launching=false;
  if(state.altitude===0&&state.flying&&state.verticalSpeed<0){
    state.flying=false;state.launching=false;state.landings++;state.verticalSpeed=0;
  }
  const bankTarget=state.flying?clamp(input.bank||0,-1,1)*38:0;
  state.bank+=(bankTarget-state.bank)*(1-Math.exp(-dt*10));
  state.heading=(state.heading+state.bank*.42*dt+360)%360;
  const moved=state.speed*.514444*dt;
  state.distance+=Math.cos(state.heading*radians)*moved;
  state.x+=Math.sin(state.heading*radians)*moved;state.travelled+=moved;
  const targetPitch=state.flying?clamp(state.verticalSpeed*1.8,-26,19):0;
  state.pitch+=(targetPitch-state.pitch)*(1-Math.exp(-dt*4));
  return state;
}
