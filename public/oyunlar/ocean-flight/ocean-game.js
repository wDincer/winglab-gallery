import {COURSE_DESIGN} from './course-design.js';

// Shared by rendering and collision detection. The established flight controls
// remain in flight.js; this module owns only the student's ocean adventure.
const OCEAN=COURSE_DESIGN.ocean;
export const RULES=Object.freeze({health:OCEAN.health,cloudDamage:OCEAN.cloudDamage,coinRadius:18,cloudRadius:OCEAN.clouds.radius,birdRadius:8,length:COURSE_DESIGN.course.length});
export const AIRCRAFT=Object.freeze([
  {name:'Öncü',detail:'Ahşap kanatlar',label:'PERVANELİ UÇAK',threshold:0},
  {name:'Airbus A350',detail:'Yeni ufuklar',label:'YOLCU UÇAĞI',threshold:4},
  {name:'F-16',detail:'Gökyüzünün zirvesi',label:'SAVAŞ UÇAĞI',threshold:8}
]);
export const stageForCoins=count=>count>=OCEAN.upgrades[1]?2:count>=OCEAN.upgrades[0]?1:0;
export function createAdventure(){
  const coins=[];
  for(let i=0,d=COURSE_DESIGN.diamonds.start;d<=RULES.length;d+=COURSE_DESIGN.diamonds.spacing,i++){
    // The first eight are reachable during the standard 55 m opening climb.
    coins.push({id:i,x:i<8?0:Math.sin(i*.7)*48,y:i<4?Math.min(55,10+i*10):55+Math.sin((i-4)*.6)*9,distance:d,collected:false});
  }
  const clouds=[];
  for(let i=0;i<OCEAN.clouds.count;i++){
    const distance=OCEAN.clouds.start+i*OCEAN.clouds.spacing;
    clouds.push({id:i,x:i%5===0?0:(i%2?1:-1)*(45+(i*31)%150),y:42+(i*13)%65,distance,radius:RULES.cloudRadius,hit:false});
  }
  const birds=Array.from({length:OCEAN.birds.count},(_,i)=>({id:i,x:i%3===0?0:(i%2?1:-1)*(25+i%4*15),y:48+i%3*9,distance:OCEAN.birds.start+i*OCEAN.birds.spacing,radius:RULES.birdRadius,hit:false}));
  return {health:RULES.health,coinCount:0,stage:0,coins,clouds,birds,falling:false,fallTime:0,fallVelocity:0,lost:false,finished:false,reason:'',lastEvent:null};
}
export function birdPoint(bird,time){return {x:bird.x+Math.sin(time*.9+bird.id)*14,y:bird.y+Math.sin(time*1.4+bird.id)*3,distance:bird.distance};}
export function cloudPuffs(radius,seed){return Array.from({length:9},(_,i)=>{const a=i*2.399+seed,r=i===0?0:radius*.48,size=radius*(i===0?.63:.33+(i%3)*.05);return {x:Math.cos(a)*r,y:Math.sin(i*2.1+seed)*radius*.19,z:Math.sin(a)*r*.55,sx:size,sy:size*.68,sz:size*.86};});}
export function segmentDistanceSquared(previous,current,point,scale={x:1,y:1,z:1}){
  const a={x:(previous.x-point.x)/scale.x,y:(previous.altitude+2.15-point.y)/scale.y,z:(previous.distance-point.distance)/scale.z};
  const b={x:(current.x-point.x)/scale.x,y:(current.altitude+2.15-point.y)/scale.y,z:(current.distance-point.distance)/scale.z};
  const v={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
  const length=v.x*v.x+v.y*v.y+v.z*v.z;
  const t=length?Math.max(0,Math.min(1,-(a.x*v.x+a.y*v.y+a.z*v.z)/length)):0;
  return (a.x+t*v.x)**2+(a.y+t*v.y)**2+(a.z+t*v.z)**2;
}
export function updateAdventure(game,state,previous,{active=true,paused=false}={}){
  if(!active||paused||game.lost||game.falling||game.finished||state.crashed)return [];
  const events=[];
  for(const coin of game.coins){
    if(!coin.collected&&segmentDistanceSquared(previous,state,coin)<=RULES.coinRadius**2){
      coin.collected=true;game.coinCount++;events.push({type:'coin',count:game.coinCount});
      const stage=stageForCoins(game.coinCount);
      if(stage!==game.stage){game.stage=stage;events.push({type:'upgrade',stage});}
    }
  }
  for(const cloud of game.clouds){
    const touches=!cloud.hit&&cloudPuffs(cloud.radius,cloud.id).some(p=>segmentDistanceSquared(previous,state,{x:cloud.x+p.x,y:cloud.y+p.y,distance:cloud.distance-p.z},{x:p.sx+3,y:p.sy+3,z:p.sz+3})<=1);
    if(touches){
      cloud.hit=true;game.health=Math.max(0,game.health-RULES.cloudDamage);
      events.push({type:'cloud',health:game.health});
      if(game.health===0){beginFall(game,state,'Canın bitti. Uçağın okyanusa düştü.');events.push({type:'fall'});break;}
    }
  }
  if(!game.falling)for(const bird of game.birds){
    if(!bird.hit&&segmentDistanceSquared(previous,state,birdPoint(bird,state.time))<=(bird.radius+3)**2){
      bird.hit=true;const turn=bird.id%2?-16:16;
      state.heading=(state.heading+turn+360)%360;
      state.bank=Math.sign(turn)*30;events.push({type:'bird',turn});
    }
  }
  if(!game.falling&&previous.flying&&state.altitude<=.1&&(state.distance>180||Math.abs(state.x)>23)){
    beginFall(game,state,'Okyanusa çok yaklaştın. Yeniden havalan!');events.push({type:'fall'});
  }
  if(!game.falling&&state.distance>=RULES.length){game.finished=true;events.push({type:'finish'});}
  game.lastEvent=events.at(-1)??game.lastEvent;
  return events;
}
export function beginFall(game,state,reason){
  if(game.falling||game.lost)return;
  game.falling=true;game.reason=reason;game.fallVelocity=Math.min(-4,state.verticalSpeed);game.fallTime=0;
}
export function stepFall(game,state,dt,{active=true,paused=false}={}){
  if(!game.falling||game.lost||!active||paused)return false;
  dt=Math.min(.1,Math.max(0,dt));game.fallTime+=dt;state.time+=dt;
  game.fallVelocity-=18*dt;state.altitude=Math.max(-3,state.altitude+game.fallVelocity*dt);
  state.speed*=Math.exp(-dt*.25);state.pitch=Math.max(-72,state.pitch-dt*38);state.bank+=dt*42;
  const move=state.speed*.514444*dt;const angle=state.heading*Math.PI/180;
  state.distance+=move*Math.cos(angle);state.x+=move*Math.sin(angle);state.verticalSpeed=game.fallVelocity;
  if(state.altitude<=-2){game.lost=true;game.falling=false;state.crashed=true;state.speed=0;state.crashTime=state.time;return true;}
  return false;
}
