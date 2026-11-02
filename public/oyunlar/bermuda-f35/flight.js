export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function speedBand(angle,closed=false) {
  if(closed || angle<25) return {id:'descent',label:'FREN & ALÇALIŞ',target:0};
  if(angle<80) return {id:'slow',label:'İLERLE & ALÇAL',target:70};
  if(angle<=100) return {id:'medium',label:'ORTA HIZ',target:90};
  return {id:'fast',label:'HIZLI',target:170};
}
export function resolveAirplaneControl(input){
  const angle=clamp(input.angle,0,180);
  const attitudeBand=speedBand(angle,input.closed);
  const leftAngle=Number.isFinite(input.leftAngle)?input.leftAngle:angle;
  const rightAngle=Number.isFinite(input.rightAngle)?input.rightAngle:angle;
  // Deliberate descent needs both wings lowered. A one-arm turn must not
  // unexpectedly command the stronger forward descent.
  const forwardDescent=attitudeBand.id==='slow'&&leftAngle>=25&&leftAngle<80&&rightAngle>=25&&rightAngle<80;
  // Leaning adds motor power while the original lowered/folded-arm stop keeps priority.
  const throttle=Number.isFinite(angle)&&attitudeBand.id!=='descent'&&Number.isFinite(input.bodyThrottle)?clamp(input.bodyThrottle,0,1):0;
  const throttling=throttle>0;
  const band=throttling?{id:'throttle',label:'GÖVDE GAZI',target:Math.max(attitudeBand.target,90+100*throttle)}:attitudeBand;
  return {angle,band,attitudeBand,throttle,throttling,forwardDescent};
}
export function createFlightState(){return {speed:0,altitude:0,heading:0,bank:0,pitch:0,verticalSpeed:0,distance:0,x:0,time:0,flying:false,initialClimbComplete:false,travelled:0,camera:'chase',band:'medium',landings:0,engineThrottle:0,courseBoostActive:false,crashed:false,crashTime:null};}
export function stepFlight(state,input,dt){
  if(state.crashed || !input.active || input.paused) return state;
  dt=clamp(dt,0,0.1);
  const {angle,band,attitudeBand,throttle,throttling,forwardDescent}=resolveAirplaneControl(input);
  state.band=band.id;state.engineThrottle=throttle;state.time+=dt;
  const grounded=state.altitude<=0.03;
  const requestedBoost=Number(input.boost);
  const boost=state.flying&&!grounded&&band.id!=='descent'&&Number.isFinite(angle)
    ?clamp(Number.isFinite(requestedBoost)?requestedBoost:1,1,1.45):1;
  state.courseBoostActive=boost>1;
  const target=grounded&&angle<80?0:band.target*boost;
  // Arcade response: fast throttle changes, stronger braking, and an exact stop.
  const response=target===0?3.6:target<state.speed?2.4:state.courseBoostActive?3:throttling?2.8:1.8;
  state.speed+=(target-state.speed)*(1-Math.exp(-dt*response));
  if(target===0 && state.speed<0.5) state.speed=0;
  if(grounded && !state.flying && band.id!=='descent' && angle>=80 && state.speed>36){state.flying=true;state.initialClimbComplete=false;}
  let verticalTarget=0;
  if(state.flying){
    // The opening climb only helps the first takeoff. An intentional descent
    // cancels it so returning to level wings preserves the chosen lower height.
    if(state.altitude>=55||forwardDescent||attitudeBand.id==='descent')state.initialClimbComplete=true;
    if(attitudeBand.id==='descent') verticalTarget=-9;
    else if(attitudeBand.id==='fast') verticalTarget=clamp(2.5+(angle-100)*0.12,2.5,11);
    else if(attitudeBand.id==='slow') verticalTarget=forwardDescent?-clamp(2+(80-angle)*.1,2,7.5):-.8;
    else if(!state.initialClimbComplete&&state.altitude<55) verticalTarget=2.8;
    if(state.altitude>=1200) verticalTarget=Math.min(0,verticalTarget);
  }
  state.verticalSpeed+=(verticalTarget-state.verticalSpeed)*(1-Math.exp(-dt*2.8));
  state.altitude=clamp(state.altitude+state.verticalSpeed*dt,0,1200);
  if(state.flying&&state.altitude>=55)state.initialClimbComplete=true;
  if(state.altitude===0){if(state.flying && state.verticalSpeed<0){state.flying=false;state.landings++;state.initialClimbComplete=false;}state.verticalSpeed=0;}
  const bankTarget=state.flying?clamp(input.bank||0,-1,1)*38:0;
  state.bank+=(bankTarget-state.bank)*(1-Math.exp(-dt*10));
  state.heading=(state.heading+state.bank*0.42*dt+360)%360;
  const rad=state.heading*Math.PI/180, moved=state.speed*0.514444*dt;
  state.distance+=Math.cos(rad)*moved;state.x+=Math.sin(rad)*moved;state.travelled+=moved;
  const targetPitch=state.flying?clamp(state.verticalSpeed*1.8,-10,13):0;
  state.pitch+=(targetPitch-state.pitch)*(1-Math.exp(-dt*1.8));
  return state;
}
