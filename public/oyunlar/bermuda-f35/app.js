import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {PoseController} from './pose.js';
import {createStormScene} from './storm-scene.js';
import {createSurvivalState,startSurvival,stepSurvival,isInZone,RULES} from './survival.js';
import {StormAudio} from './audio.js';
const $=id=>document.getElementById(id),keys=new Set(),audio=new StormAudio();
function newFlight(){return {...createFlightState(),altitude:78,speed:90,flying:true,initialClimbComplete:true,vehicle:'airplane'};}
let flight=newFlight(),game=createSurvivalState(flight),scene,mode='camera',pose=null,cameraStatus='off',manualAngle=90,paused=false,hidden=document.hidden,last=performance.now(),raf,ambientAt=6,helpPaused=false,alertUntil=0,alertText='',starting=false,sceneFault=false;
const timeLabel=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let cameraMessage='Omuzların, dirseklerin ve kalçan kadrajda olsun.';
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose(p){pose=p;},onStatus(s){cameraStatus=s.state;cameraMessage=s.message;$('camera-message').textContent=s.message;$('tracking-dot').classList.toggle('active',s.state==='tracking');const live=!!$('camera-video').srcObject;document.querySelector('.camera-card').classList.toggle('camera-live',live);$('camera-placeholder').hidden=live;if(s.state==='error')notify(s.message,8);}});
function notify(text,seconds=3){alertText=text;alertUntil=performance.now()+seconds*1000;$('alert').textContent=text;}
function input(){return mode==='keyboard'?{angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),bodyThrottle:keys.has('g')?1:0,bodyLean:keys.has('g')?30:0,bodyCalibrated:true}:pose;}
function hasInput(){return mode==='keyboard'||(cameraStatus==='tracking'&&pose?.bodyCalibrated===true);}
function syncMode(){$('keyboard-panel').hidden=mode!=='keyboard';$('calibrate-body').hidden=mode==='keyboard';$('switch-keyboard').hidden=mode==='keyboard'||game.phase==='ready';$('camera-message').textContent=mode==='keyboard'?'KLAVYE KONTROLÜ AKTİF':'KOLLARIN VE KALÇAN KADRAJDA OLSUN';}
async function launch(control){
 if(starting||sceneFault)return;starting=true;mode=control;keys.clear();syncMode();
 // Start audio directly from the user's click so browser autoplay rules are satisfied.
 const sound=audio.start().catch(e=>notify(e.message,8));
 if(control==='camera'){
  $('start-camera').disabled=true;
  try{const ok=await poseController.start();if(!ok){starting=false;$('start-camera').disabled=false;return;}}catch(e){notify(e.message,8);starting=false;return;}finally{$('start-camera').disabled=false;}
 }else{poseController.stop();pose=null;}
 await sound;
 if(game.phase==='ready')startSurvival(game);
 document.body.classList.add('playing');$('intro').hidden=true;$('aircraft-label').hidden=true;$('flight-hud').hidden=false;$('game-actions').hidden=false;
 paused=false;starting=false;last=performance.now();$('simulator').focus();
}
function reset(){const camera=flight.camera;flight=newFlight();flight.camera=camera;game=createSurvivalState(flight);startSurvival(game);manualAngle=90;$('manual-angle').value=90;keys.clear();paused=false;ambientAt=6;audio.reset();audio.setPaused(false);alertText='';alertUntil=0;if($('over-dialog').open)$('over-dialog').close();$('simulator').focus();last=performance.now();}
function togglePause(){if(game.phase==='ready'||game.phase==='over')return;paused=!paused;keys.clear();}
function toggleView(){flight.camera=flight.camera==='chase'?'cockpit':'chase';$('view').innerHTML=`◉ <span>${flight.camera==='chase'?'Takip kamerası':'Pilot görünümü'}</span>`;}
function radar(){const c=$('radar').getContext('2d'),w=220,h=180,cx=110,cy=93,scale=.065;c.clearRect(0,0,w,h);c.save();c.beginPath();c.arc(cx,cy,76,0,Math.PI*2);c.clip();c.strokeStyle='#91bab820';c.lineWidth=1;for(const r of[25,50,75]){c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(cx,cy-80);c.lineTo(cx,cy+80);c.moveTo(cx-80,cy);c.lineTo(cx+80,cy);c.stroke();const rad=flight.heading*Math.PI/180;
 const project=(x,d)=>{const dx=x-flight.x,dz=d-flight.distance;return [cx+(dx*Math.cos(rad)-dz*Math.sin(rad))*scale,cy-(dx*Math.sin(rad)+dz*Math.cos(rad))*scale];};
 const z=game.zone,a=z.heading*Math.PI/180,points=[];for(const [s,f]of[[-1,-1],[1,-1],[1,1],[-1,1]])points.push(project(z.x+Math.cos(a)*s*z.halfWidth+Math.sin(a)*f*z.halfLength,z.distance-Math.sin(a)*s*z.halfWidth+Math.cos(a)*f*z.halfLength));c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle='#ff5e4630';c.fill();c.strokeStyle='#ff6b5680';c.stroke();
 for(const shark of game.sharks){const [x,y]=project(shark.target.x,shark.target.distance);c.strokeStyle='#ffc286';c.beginPath();c.arc(x,y,4+Math.sin(game.time*7)*2,0,Math.PI*2);c.stroke();}
 c.strokeStyle='#d9ee9c25';c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.sin(game.time*.7)*90,cy-Math.cos(game.time*.7)*90);c.stroke();c.restore();c.fillStyle='#d9ee9c';c.beginPath();c.moveTo(cx,cy-7);c.lineTo(cx-5,cy+5);c.lineTo(cx,cy+2);c.lineTo(cx+5,cy+5);c.closePath();c.fill();c.font='8px monospace';c.textAlign='center';c.fillStyle='#7e9ea6';c.fillText('N',cx,9);}
function hud(){
 const p=input(),control=resolveAirplaneControl(p??{angle:90}),active=hasInput(),falling=['falling','over'].includes(game.phase),waiting=['playing','falling'].includes(game.phase)&&!active,blocked=(paused||hidden||waiting)&&game.phase!=='ready'&&game.phase!=='over';
 const calibrationMessage=pose&&!pose.bodyCalibrated?(Number.isFinite(pose.bodyPitch)?`Dik dur, nötr duruş ayarlanıyor · %${Math.round((pose.bodyCalibrationProgress??0)*100)}`:'Gövde derinliği okunamıyor; yüzünü kameraya çevir ve kalçanı kadraja al.'):null;
 $('tracking-feedback').textContent=mode==='keyboard'?'Klavye kontrolü aktif.':calibrationMessage??cameraMessage;
 $('tracking-feedback').classList.toggle('ready',mode==='camera'&&active);
 document.body.classList.toggle('tracking-wait',waiting);
 $('pause-screen').hidden=!blocked;$('pause-title').textContent=waiting?(calibrationMessage?'Dik duruş ayarlanıyor.':'Pilot aranıyor.'):'Nefes al.';$('pause-description').textContent=waiting?(calibrationMessage??cameraMessage):'Devam etmek için boşluk tuşuna bas.';$('resume').hidden=waiting;
 $('pause').innerHTML=paused?'▶ <span>Devam et</span>':'Ⅱ <span>Duraklat</span>';
 $('time').textContent=timeLabel(game.time);$('escaped').textContent=String(game.escaped).padStart(2,'0');$('round').textContent='TUR '+String(game.round).padStart(2,'0');
 $('countdown').innerHTML=`${Math.max(0,Math.floor(game.remaining))}<span>.${Math.max(0,Math.floor(game.remaining*10)%10)}</span>`;
 const safe=!isInZone(flight,game.zone);$('zone-card').classList.toggle('safe',safe&&!falling);$('zone-card').classList.toggle('urgent',game.remaining<4&&!safe&&!falling);
 $('zone-status').textContent=falling?'SİNYAL KAYBI':safe?'GÜVENDESİN · DIŞARIDA KAL':'TEHLİKELİ ALANDASIN';$('countdown-fill').style.width=Math.max(0,game.remaining/RULES.zoneSeconds*100)+'%';
 $('speed').textContent=Math.round(flight.speed);$('altitude').textContent=falling?Math.round(game.loss.altitude*(1-Math.min(1,game.lossTime/3.5))-Math.max(0,game.lossTime-3.2)*32):Math.round(flight.altitude);$('vertical').textContent=(flight.verticalSpeed>0?'+':'')+flight.verticalSpeed.toFixed(1);$('heading').textContent=String(Math.round(flight.heading)%360).padStart(3,'0')+'°';$('attitude').style.transform=`rotate(${flight.bank}deg)`;
 $('hits').textContent=`${game.hits} / 3 TEMAS`;$('health-bars').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('lost',i<game.hits));
 $('left-angle').textContent=p?Math.round(p.leftAngle)+'°':'—';$('right-angle').textContent=p?Math.round(p.rightAngle)+'°':'—';const throttle=active?Math.round(control.throttle*100):0;$('throttle').textContent='%'+throttle;$('throttle-fill').style.width=throttle+'%';$('body-lean').textContent='ÖNE EĞİM '+(Number.isFinite(p?.bodyLean)?Math.max(0,Math.round(p.bodyLean))+'°':'—');$('calibrate-body').disabled=cameraStatus!=='tracking';$('angle-value').textContent=Math.round(manualAngle)+'°';
 $('alert').textContent=falling?(game.lossTime<3?'KONTROL KAYBI · GİRDABA ÇEKİLİYORSUN':'SU ALTINDA · SİNYAL KESİLİYOR'):performance.now()<alertUntil?alertText:game.sharks.some(s=>s.age<RULES.sharkWarningSeconds)?'△ SU ALTI HAREKETİ · YÖNÜNÜ DEĞİŞTİR':game.remaining<4&&!safe?'⚡ RED ZONE’DAN ÇIK!':'';
 $('flash-overlay').style.opacity=game.flash*.36;radar();audio.update(flight,falling);audio.setPaused((blocked||game.phase==='over'||game.phase==='ready')&&!starting);
}
function handleEvents(){for(const e of game.events){if(e.type==='thunder')audio.play('thunder');if(e.type==='shark')audio.play('shark');if(e.type==='hit')notify(`KÖPEKBALIĞI TEMASI · ${game.hits} / 3`,3);if(e.type==='escaped')notify('RED ZONE ATLATILDI · YENİ BÖLGE OLUŞTU',3);if(e.type==='loss')keys.clear();if(e.type==='over'){$('loss-message').textContent={lightning:'Red zone içindeyken yıldırım isabet etti. F-35 girdaba çekildi ve okyanusun derinliklerine battı.',sharks:'Üç köpekbalığı teması gövdeyi parçaladı. F-35 girdaba çekildi ve okyanusun derinliklerine battı.',ocean:'İrtifanı kaybettin. Okyanusa düşen F-35 girdaba çekildi ve suyun altında battı.'}[game.loss.reason];$('result-time').textContent=timeLabel(game.time);$('result-escaped').textContent=String(game.escaped).padStart(2,'0');$('over-dialog').showModal();}}}
function frame(now){const dt=Math.min(1,Math.max(0,(now-last)/1000));last=now;
 const active=hasInput(),simulate=active&&!paused&&!hidden&&!$('help-dialog').open&&game.phase!=='ready'&&game.phase!=='over';
 let remaining=dt;
 while(remaining>0.00001){const tick=Math.min(1/60,remaining);remaining-=tick;
 if(simulate&&game.phase==='playing'){
  if(mode==='keyboard'){manualAngle=clamp(manualAngle+((keys.has('arrowup')||keys.has('w')?1:0)-(keys.has('arrowdown')||keys.has('s')?1:0))*tick*45,0,180);$('manual-angle').value=manualAngle;}
  stepFlight(flight,{...input(),active:true},tick);
 }
 stepSurvival(game,flight,tick,{active:simulate});handleEvents();
 }
 if(simulate&&game.phase==='playing'&&game.time>=ambientAt){scene?.ambientLightning(flight);audio.play('thunder');ambientAt=game.time+7.5;}
 scene?.update(flight,game,game.phase==='ready'||simulate?dt:0);hud();raf=requestAnimationFrame(frame);
}
$('start-keyboard').onclick=()=>launch('keyboard');$('start-camera').onclick=()=>launch('camera');$('switch-camera').onclick=()=>launch('camera');$('switch-keyboard').onclick=()=>launch('keyboard');$('camera-toggle').onclick=()=>{if(mode==='camera'&&cameraStatus==='tracking'){poseController.stop();pose=null;}else launch('camera');};
$('calibrate-body').onclick=()=>{poseController.resetBodyCalibration();notify('DİK DUR · NÖTR DURUŞ AYARLANIYOR',4);};
$('manual-angle').oninput=e=>{manualAngle=Number(e.target.value);};$('pause').onclick=togglePause;$('resume').onclick=()=>{paused=false;};$('view').onclick=toggleView;$('reset').onclick=reset;$('restart').onclick=reset;
$('sound').onclick=()=>{const enabled=audio.toggle();$('sound').textContent=enabled?'♫':'♩';$('sound').setAttribute('aria-label',enabled?'Sesi kapat':'Sesi aç');$('sound').title=enabled?'Sesi kapat':'Sesi aç';};
$('fullscreen').onclick=()=>{(document.fullscreenElement?document.exitFullscreen():$('simulator').requestFullscreen()).catch(()=>notify('Tam ekran kullanılamıyor.'));};
$('help').onclick=()=>{helpPaused=paused;paused=true;$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();$('help-dialog').onclose=()=>{paused=helpPaused;};$('over-dialog').oncancel=e=>e.preventDefault();
window.addEventListener('keydown',e=>{if($('help-dialog').open||e.target.matches('input,select,textarea'))return;const key=e.key.toLowerCase();if(e.target.matches('button')&&key===' ')return;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(game.phase==='ready')return;if(key==='r'&&!e.repeat){reset();return;}if(key===' '&&!e.repeat)togglePause();if(key==='c'&&!e.repeat)toggleView();if(key==='f'&&!e.repeat)$('fullscreen').click();if(mode==='keyboard')keys.add(key);});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();});document.addEventListener('visibilitychange',()=>{hidden=document.hidden;keys.clear();last=performance.now();});window.addEventListener('resize',()=>scene?.resize());
try{scene=createStormScene($('world'));scene.update(flight,game,0);raf=requestAnimationFrame(frame);}catch(e){sceneFault=true;console.error(e);$('fatal-error').hidden=false;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();audio.dispose();});
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...flight,mode,paused,cameraStatus,active:hasInput(),game:structuredClone(game)}),getAudio:()=>({enabled:audio.enabled,state:audio.context?.state,loaded:Object.keys(audio.buffers),oceanLoop:audio.loop?.loop??false})})});
