import {COURSE_DESIGN as D} from './course-design.js';
import {stepFlight} from './flight.js';
export const CONFIG=Object.freeze(D.festival);
export const EFFECTS=Object.freeze({coin:{label:'COIN',color:'#ffd66d',symbol:'₺'},boost:{label:'HIZLANDIRICI',color:'#6cf5c7',symbol:'»'},slow:{label:'YAVAŞLATICI',color:'#a798ff',symbol:'≋'},fog:{label:'5 SN SİS',color:'#edf6ff',symbol:'☁'}});
export const BRIDGES=D.gates.map((distance,i)=>({id:i+1,distance,x:0,halfWidth:CONFIG.bridgeHalfWidth,tiers:[{id:'lower',y:CONFIG.lowerY,effect:CONFIG.tierEffects[i][0]},{id:'upper',y:CONFIG.upperY,effect:CONFIG.tierEffects[i][1]}]}));
export const HELI_PROBES=[[0,0,0,1.5],[0,0,-4.8,1],[0,0,6.8,.5],[0,2.1,8.6,.6],[-6.7,3.1,0,.25],[6.7,3.1,0,.25],[0,3.1,-6.7,.25],[0,3.1,6.7,.25],[-1.4,-1.9,0,.3],[1.4,-1.9,0,.3]];
export const WEATHER={clear:{name:'Açık gökyüzü',sky:'#69b9ed',horizon:'#d8eafa',sun:'#fff3d8',clouds:8},cloudy:{name:'Parçalı bulutlu',sky:'#8bb6d5',horizon:'#e0e8ec',sun:'#eef4ff',clouds:22},sunset:{name:'Gün batımı',sky:'#8e9bc9',horizon:'#ffd7b0',sun:'#ffcf91',clouds:12},rain:{name:'Yağmurlu',sky:'#7d9eb8',horizon:'#c6d4df',sun:'#dce9ff',clouds:30}};
export function chooseWeather(previous,random=Math.random){const choices=Object.keys(WEATHER).filter(x=>x!==previous);return choices[Math.floor(random()*choices.length)];}
export function createRun(previousWeather){return {weather:chooseWeather(previousWeather),coins:0,red:false,passed:[],used:new Set(),collected:new Set(),boostUntil:0,slowUntil:0,fogUntil:0,event:'',eventUntil:0,complete:false};}
export const COINS=BRIDGES.flatMap(b=>[...b.tiers.map(t=>({id:`b${b.id}-${t.id}`,distance:b.distance-25,x:0,y:t.y})),{id:`p${b.id}`,distance:b.distance-150,x:0,y:55}]);
export function birdAt(index,time){const distance=520+index*290;return {x:Math.sin(time*.24+index*1.7)*(index%3===0?50:115),y:55+Math.sin(time*.38+index*2.1)*19+(index%2)*28,z:-distance+Math.cos(time*.2+index)*25};}
export function powerAt(run,time){return {boost:time<run.boostUntil?1.45:1,slow:time<run.slowUntil,fog:time<run.fogUntil};}
export function stepFestival(state,input,run,dt){
  if(!input.active||input.paused||state.crashed||run.complete)return state;
  if(!state.flying&&state.distance<20&&input.angle>=80)state.flying=true;
  if(!state.flying)return state;
  const power=powerAt(run,state.time),x=state.x,d=state.distance;
  stepFlight(state,{...input,boost:power.boost},dt);
  if(power.slow&&state.speed>38){const original=state.speed;state.speed=38+(state.speed-38)*Math.exp(-Math.min(.1,dt)*4);const ratio=state.speed/original;state.distance=d+(state.distance-d)*ratio;state.x=x+(state.x-x)*ratio;}
  return state;
}
export function applyEffect(run,effect,time){const e=EFFECTS[effect];if(effect==='boost')run.boostUntil=time+5;if(effect==='slow')run.slowUntil=time+5;if(effect==='fog')run.fogUntil=time+CONFIG.fogDuration;run.event=e.label+(effect==='coin'?' · COIN ROTASI':' · 5 SANİYE');run.eventUntil=time+3;}
function probes(s){const yaw=-s.heading*Math.PI/180,roll=-s.bank*Math.PI/180,pitch=s.pitch*Math.PI/180;return HELI_PROBES.map(([x,y,z,r])=>{const rx=Math.cos(roll)*x-Math.sin(roll)*y,ry=Math.sin(roll)*x+Math.cos(roll)*y,py=Math.cos(pitch)*ry-Math.sin(pitch)*z,pz=Math.sin(pitch)*ry+Math.cos(pitch)*z;return {x:s.x+Math.cos(yaw)*rx+Math.sin(yaw)*pz,y:s.altitude+2.15+py,z:-s.distance-Math.sin(yaw)*rx+Math.cos(yaw)*pz,r};});}
export function detectFestivalCollision(previous,current){
  if(!previous||(!previous.flying&&!current.flying))return null;
  const samples=Math.max(1,Math.ceil(Math.hypot(current.distance-previous.distance,current.x-previous.x,current.altitude-previous.altitude)/1.3));
  for(let i=0;i<=samples;i++){const t=i/samples,s={...current};for(const k of['x','distance','altitude','time'])s[k]=previous[k]+(current[k]-previous[k])*t;for(const k of['heading','bank','pitch'])s[k]=previous[k]+(((current[k]-previous[k]+540)%360)-180)*t;const points=probes(s);
    for(const p of points){if(p.y-p.r<0)return {message:'Zemine çarptın. İrtifanı koru.',type:'ground'};
      if(s.distance>45&&Math.abs(p.x)>240)return {message:'Uçuş koridorunun dışına çıktın.',type:'boundary'};
      if(Math.abs(p.x)<18.5+p.r&&Math.abs(p.z)<18.5+p.r&&p.y-p.r<51.8&&p.y+p.r>51.2)return {type:'tower',message:'Kalkış kulesinin platformuna çarptın.'};
      for(const b of BRIDGES){
        if(Math.abs(p.z+b.distance-10)<4+p.r)for(const y of CONFIG.deckLevels)for(const side of[-1,1]){const a=side*-.4,dx=p.x-side*84,dy=p.y-y+9,lx=Math.cos(a)*dx+Math.sin(a)*dy,ly=-Math.sin(a)*dx+Math.cos(a)*dy;if(Math.abs(lx)<22.5+p.r&&Math.abs(ly)<.7+p.r)return {type:'bridge',message:'Köprünün bağlantı rampasına çarptın.'};}
        if(Math.abs(p.z+b.distance)>CONFIG.deckDepth/2+p.r)continue;
        if(Math.abs(p.x)<b.halfWidth+12+p.r&&CONFIG.deckLevels.some(y=>Math.abs(p.y-y)<CONFIG.deckThickness/2+p.r))return {type:'bridge',message:'Köprünün beton tabliyesine çarptın. Alt veya üst açıklığı hedefle.'};
        if(Math.abs(Math.abs(p.x)-b.halfWidth)<2+p.r&&p.y<123)return {type:'bridge',message:'Köprü ayağına çarptın.'};
        // Railings share the same dimensions and positions as the scene.
        if(Math.abs(p.x)<b.halfWidth+12+p.r&&Math.abs(Math.abs(p.z+b.distance)-4)<.25+p.r&&CONFIG.deckLevels.some(y=>p.y>y+.5-p.r&&p.y<y+3+p.r))return {type:'bridge',message:'Köprü korkuluğuna çarptın.'};
      }
      for(let bird=0;bird<8;bird++){const a=birdAt(bird,s.time);if(Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z)<p.r+4.8)return {type:'eagle',message:'Bir kartalla çarpıştın. Kartalların uçuş yolundan uzaklaş.'};}
    }
  }
  if(previous.flying&&current.altitude<=.03)return {type:'ground',message:'Yere çarptın.'};return null;
}
function segmentDistance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz,t=l?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy+(point.z-a.z)*dz)/l)):0;return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy,point.z-a.z-t*dz);}
export function updateRun(run,previous,state,{active=true,paused=false}={}){
  if(!active||paused||state.crashed||run.complete||!state.flying)return {picked:0};
  const a={x:previous.x,y:previous.altitude+2.15,z:-previous.distance},b={x:state.x,y:state.altitude+2.15,z:-state.distance};let picked=0;
  for(const c of COINS)if(!run.collected.has(c.id)&&segmentDistance({x:c.x,y:c.y,z:-c.distance},a,b)<=18){run.collected.add(c.id);run.coins++;picked++;}
  if(run.coins>=CONFIG.redUnlockCoins)run.red=true;
  for(const bridge of BRIDGES){if(previous.distance<bridge.distance&&state.distance>=bridge.distance&&!run.used.has(bridge.id)){
    run.used.add(bridge.id);const t=(bridge.distance-previous.distance)/(state.distance-previous.distance),x=previous.x+(state.x-previous.x)*t,y=previous.altitude+(state.altitude-previous.altitude)*t+2.15;
    const tier=bridge.tiers.find(tier=>Math.abs(y-tier.y)<18&&Math.abs(x)<bridge.halfWidth-7);
    if(!tier){state.crashed=true;return {picked,missed:true,message:'Geçidi kaçırdın. İki katlı köprünün bir açıklığından geçmelisin.'};}
    run.passed.push({id:bridge.id,tier:tier.id});applyEffect(run,tier.effect,state.time);
  }}
  if(run.passed.length===BRIDGES.length)run.complete=true;
  return {picked};
}
