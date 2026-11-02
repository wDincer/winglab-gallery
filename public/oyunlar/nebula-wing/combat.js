// World-space combat. Flight and pose mechanics remain in the WINGLAB modules.
export const MAX_HP=100, HIT_DAMAGE=10, SHOT_COOLDOWN=.42;
export const vec=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a,n)=>vec(a.x*n,a.y*n,a.z*n);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const unit=a=>mul(a,1/(length(a)||1));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function flightFrame(state){
  const h=state.heading*Math.PI/180,p=state.pitch*.65*Math.PI/180;
  const flat=vec(Math.sin(h),0,-Math.cos(h));
  const forward=vec(flat.x*Math.cos(p),Math.sin(p),flat.z*Math.cos(p));
  const right=vec(Math.cos(h),0,Math.sin(h));
  const position=vec(state.x,state.altitude+150,-state.distance);
  const cockpit=state.camera==='cockpit';
  const framing=Math.max(1,1.25/(state.viewAspect||1.78));
  const camera=add(add(position,mul(flat,cockpit?-3: -27*framing)),vec(0,cockpit?2.6:8*framing,0));
  const look=add(add(position,mul(forward,160)),vec(0,cockpit?2.6:8,0));
  return {position,forward,flat,right,camera,look,aim:unit(sub(look,camera))};
}
export function createCombatState(state){
  const f=flightFrame(state);
  const types=['interceptor','striker','interceptor','striker','cruiser'];
  const names=['KIZIL HAYALET','KÜL KANAT','GECE AVCISI','KIZIL PENÇE','AĞIR KRUVAZÖR'];
  return {hp:MAX_HP,time:0,kills:0,hits:0,volleys:0,nextShot:0,lockId:null,won:false,lost:false,
    projectiles:[],effects:[],events:[],serial:1,
    enemies:types.map((type,i)=>({id:i+1,type,name:names[i],hp:MAX_HP,dead:false,radius:type==='cruiser'?18:6.2,
      position:add(f.position,vec([0,-52,62,-100,24][i],9+[0,7,-4,16,22][i],-[190,270,310,390,580][i])),
      previous:vec(),velocity:vec(),heading:0,bank:0,pitch:0,nextShot:8+i*2.4,phase:i*1.7,flash:0}))};
}
export function segmentSphere(a,b,center,radius){
  const delta=sub(b,a),offset=sub(a,center),denom=dot(delta,delta);
  if(dot(offset,offset)<=radius*radius)return 0;
  if(denom<1e-10)return null;
  const t=clamp(-dot(offset,delta)/denom,0,1);
  const nearest=add(a,mul(delta,t));
  return length(sub(nearest,center))<=radius?t:null;
}
export function acquireTarget(combat,state){
  const f=flightFrame(state);let best=null,bestScore=Infinity;
  for(const e of combat.enemies){
    if(e.dead)continue;
    const delta=sub(e.position,f.camera),distance=length(delta),forward=dot(delta,f.aim);
    if(forward<20||distance>1000)continue;
    const lateral=length(sub(delta,mul(f.aim,forward)));
    // A small 2.2° cone plus the actual hull radius, in front of the camera.
    if(lateral>e.radius+forward*.038)continue;
    const score=lateral/forward+distance*.000012;
    if(score<bestScore){best=e;bestScore=score;}
  }
  return best;
}
function bolt(combat,owner,origin,direction,speed,side){
  combat.projectiles.push({id:combat.serial++,owner,position:{...origin},previous:{...origin},velocity:mul(direction,speed),life:owner==='player'?2.3:4,side});
}
export function firePlayer(combat,state){
  if(combat.lost||combat.won||combat.time<combat.nextShot)return false;
  const f=flightFrame(state),target=acquireTarget(combat,state);
  const aimPoint=target?add(target.position,mul(target.velocity,length(sub(target.position,f.position))/640)):add(f.camera,mul(f.aim,450));
  for(const side of [-1,1]){
    const origin=add(add(f.position,mul(f.right,side*8)),vec(0,.4,0));
    bolt(combat,'player',origin,unit(sub(aimPoint,origin)),640,side);
  }
  combat.volleys++;combat.nextShot=combat.time+SHOT_COOLDOWN;
  combat.events.push({type:'fire',owner:'player'});return true;
}
export function applyHit(combat,target,point){
  if(target==='player'){
    if(combat.lost||combat.won)return;
    combat.hp=Math.max(0,combat.hp-HIT_DAMAGE);
    combat.events.push({type:'damage',hp:combat.hp});
    combat.effects.push({id:combat.serial++,type:combat.hp===0?'explosion':'hit',position:{...point},age:0,size:combat.hp===0?12:2});
    if(combat.hp===0){combat.lost=true;combat.lockId=null;combat.events.push({type:'destroyed',owner:'player'});}
    return;
  }
  if(target.dead)return;
  target.hp=Math.max(0,target.hp-HIT_DAMAGE);target.flash=.18;combat.hits++;
  combat.effects.push({id:combat.serial++,type:'hit',position:{...point},age:0,size:2});
  combat.events.push({type:'hit',enemyId:target.id,hp:target.hp});
  if(target.hp===0){
    target.dead=true;combat.kills++;
    combat.effects.push({id:combat.serial++,type:'explosion',position:{...target.position},age:0,size:target.type==='cruiser'?25:12});
    combat.events.push({type:'destroyed',owner:'enemy',enemyId:target.id,name:target.name});
    if(combat.kills===combat.enemies.length){combat.won=true;combat.lockId=null;combat.events.push({type:'victory'});}
  }
}
function moveEnemies(combat,state,dt){
  const f=flightFrame(state),alive=combat.enemies.filter(e=>!e.dead);
  alive.forEach((e,rank)=>{
    const t=combat.time,cruiser=e.type==='cruiser';
    const flank=rank===0?0:(rank%2?-1:1)*(38+rank*15);
    const depth=rank===0?(cruiser?245:185):240+rank*68;
    const sway=rank===0?Math.sin(t*.27+e.phase)*7:Math.sin(t*.24+e.phase)*17;
    const goal=vec(state.x*.12+flank+sway,f.position.y+9+Math.sin(t*.31+e.phase)*(rank===0?3:11),-state.distance-depth);
    e.previous={...e.position};
    const response=1-Math.exp(-dt*(cruiser?.7:1.5));
    e.position=add(e.position,mul(sub(goal,e.position),response));
    e.velocity=mul(sub(e.position,e.previous),1/Math.max(dt,.001));
    const towardPilot=sub(f.position,e.position);
    e.heading=Math.atan2(towardPilot.x,-towardPilot.z)*180/Math.PI;
    e.bank=clamp(-e.velocity.x*.55,-23,23);e.pitch=clamp(e.velocity.y*.3,-8,8);
    e.flash=Math.max(0,e.flash-dt);
    if(t>=e.nextShot&&state.flying&&length(sub(e.position,f.position))<900){
      e.nextShot=t+(cruiser?5.8:4.6)+e.id*.5;
      // Both enemy guns aim at the current location: maneuvers can dodge them.
      for(const side of [-1,1]){
        const front=unit(towardPilot),right=vec(Math.cos(e.heading*Math.PI/180),0,Math.sin(e.heading*Math.PI/180));
        const origin=add(add(e.position,mul(front,cruiser?21:6)),mul(right,side*(cruiser?10:5)));
        const destination=add(f.position,vec(Math.sin(t+e.id)*2,Math.cos(t*.6+e.id)*1.4,0));
        bolt(combat,'enemy',origin,unit(sub(destination,origin)),150,side);
      }
      combat.events.push({type:'fire',owner:'enemy',enemyId:e.id});
    }
  });
}
export function stepCombat(combat,state,dt,{active=true,paused=false}={}){
  if(!active||paused)return combat;
  dt=clamp(dt,0,.1);
  for(const effect of combat.effects)effect.age+=dt;
  combat.effects=combat.effects.filter(e=>e.age<(e.type==='explosion'?2.5:.35));
  if(combat.lost||combat.won)return combat;
  combat.time+=dt;moveEnemies(combat,state,dt);
  const f=flightFrame(state),remaining=[];
  for(const shot of combat.projectiles){
    shot.previous={...shot.position};shot.position=add(shot.position,mul(shot.velocity,dt));shot.life-=dt;
    let hit=null,hitFraction=Infinity;
    if(shot.owner==='player'){
      for(const e of combat.enemies){
        if(e.dead)continue;
        // Relative swept motion catches fast beams and a moving target.
        const start=sub(shot.previous,e.previous),end=sub(shot.position,e.position);
        const fraction=segmentSphere(start,end,vec(),e.radius);
        if(fraction!==null&&fraction<hitFraction){hit=e;hitFraction=fraction;}
      }
    }else if(segmentSphere(shot.previous,shot.position,f.position,3.5)!==null)hit='player';
    if(hit){applyHit(combat,hit,shot.position);}else if(shot.life>0)remaining.push(shot);
    if(combat.lost||combat.won)break;
  }
  combat.projectiles=combat.lost||combat.won?[]:remaining;
  combat.lockId=acquireTarget(combat,state)?.id??null;
  return combat;
}
