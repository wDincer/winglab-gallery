import {COURSE_DESIGN} from './course-design.js';
export const RULES = Object.freeze(COURSE_DESIGN.survival);
const rad = n => n*Math.PI/180;
export function createZone(flight, round=1) {
  const h=rad(flight.heading),dx=Math.sin(h),dz=Math.cos(h);
  return {x:flight.x+dx*450,distance:flight.distance+dz*450,heading:flight.heading,
    halfWidth:RULES.zoneHalfWidth+Math.min(60,(round-1)*8),halfLength:RULES.zoneHalfLength};
}
export function zoneCoordinates(flight,zone) {
  const h=rad(zone.heading),x=flight.x-zone.x,z=flight.distance-zone.distance;
  return {side:x*Math.cos(h)-z*Math.sin(h),forward:x*Math.sin(h)+z*Math.cos(h)};
}
export function isInZone(flight,zone) {
  const p=zoneCoordinates(flight,zone);
  return Math.abs(p.side)<=zone.halfWidth&&Math.abs(p.forward)<=zone.halfLength;
}
export function createSurvivalState(flight) {
  return {phase:'ready',time:0,round:1,escaped:0,remaining:RULES.zoneSeconds,zone:createZone(flight),
    sharks:[],nextShark:4.5,sharkId:0,hits:0,flash:0,strike:null,loss:null,lossTime:0,events:[],danger:false};
}
export function startSurvival(game){game.phase='playing';}
export function beginLoss(game,flight,reason) {
  if(game.phase!=='playing')return;
  game.phase='falling';game.lossTime=0;
  game.loss={reason,x:flight.x,distance:flight.distance,altitude:flight.altitude,heading:flight.heading,
    vortexX:flight.x+Math.sin(rad(flight.heading))*100,vortexDistance:flight.distance+Math.cos(rad(flight.heading))*100};
  flight.crashed=true;flight.crashTime=flight.time;game.events.push({type:'loss',reason});
}
export function sharkPosition(shark) {
  const t=Math.max(0,Math.min(1,(shark.age-RULES.sharkWarningSeconds)/RULES.sharkLeapSeconds));
  return {x:shark.target.x+shark.direction*(.5-t)*150,
    altitude:-12+(shark.target.altitude+17)*Math.sin(t*Math.PI),
    distance:shark.target.distance+(.5-t)*24,t};
}
export function stepSurvival(game,flight,dt,{active=true,paused=false}={}) {
  game.events=[];
  if(!active||paused||game.phase==='ready'||game.phase==='over')return game;
  dt=Math.min(Math.max(dt,0),.1);
  game.flash=Math.max(0,game.flash-dt*1.8);
  if(game.phase==='falling') {
    game.lossTime+=dt;
    if(game.lossTime>=RULES.lossSeconds){game.phase='over';game.events.push({type:'over'});}
    return game;
  }
  game.time+=dt;game.remaining-=dt;game.danger=isInZone(flight,game.zone);
  if(game.remaining<=1e-7) {
    const hit=isInZone(flight,game.zone);
    game.flash=1;game.strike={x:hit?flight.x:game.zone.x,distance:hit?flight.distance:game.zone.distance,altitude:hit?flight.altitude:0,at:game.time};
    game.events.push({type:'thunder',hit});
    if(hit){beginLoss(game,flight,'lightning');return game;}
    game.escaped++;game.round++;game.zone=createZone(flight,game.round);game.remaining=RULES.zoneSeconds;
    game.events.push({type:'escaped'});
  }
  if(flight.altitude<=.5){beginLoss(game,flight,'ocean');return game;}
  if(game.time>=game.nextShark) {
    const h=rad(flight.heading),lead=flight.speed*.514444*(RULES.sharkWarningSeconds+RULES.sharkLeapSeconds*.5);
    const shark={id:++game.sharkId,age:0,direction:game.sharkId%2?1:-1,hit:false,
      target:{x:flight.x+Math.sin(h)*lead,distance:flight.distance+Math.cos(h)*lead,altitude:flight.altitude}};
    game.sharks.push(shark);game.nextShark=game.time+RULES.sharkInterval;game.events.push({type:'shark'});
  }
  for(const shark of game.sharks) {
    shark.age+=dt;
    if(shark.age>=RULES.sharkWarningSeconds&&!shark.hit) {
      const p=sharkPosition(shark);
      if(Math.hypot(p.x-flight.x,p.distance-flight.distance,p.altitude-flight.altitude)<RULES.sharkCollisionRadius) {
        shark.hit=true;game.hits++;game.events.push({type:'hit'});game.flash=.4;
        if(game.hits>=RULES.sharkHitsToLose){beginLoss(game,flight,'sharks');return game;}
      }
    }
  }
  game.sharks=game.sharks.filter(s=>s.age<RULES.sharkWarningSeconds+RULES.sharkLeapSeconds+.4);
  return game;
}
