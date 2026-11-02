import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {PoseController} from './pose.js';
import {createFlightScene} from './scene.js';
import {createMission,stepMission,phaseAt,navigationAt,PLANETS,MISSION} from './mission.js';
const $=id=>document.getElementById(id),keys=new Set();
let flight=createFlightState(),mission=createMission(),mode='keyboard',pose=null,cameraStatus='off',paused=false,hidden=document.hidden,manualAngle=90,autoFire=false,pointerFire=false,pointer=null,scene,raf,last=performance.now(),hudClock=0,toastTimer,flashTimer,resultShown=false;
let soundEnabled=true,audioContext,engineGain,engineOsc;
const music=new Audio('./assets/audio/space.mp3');music.loop=true;music.volume=.38;
const lasers=Array.from({length:6},()=>{const a=new Audio('./assets/audio/laser.mp3');a.volume=.27;a.preload='auto';return a;});let laserIndex=0;
const timeText=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const running=()=>mission.status==='playing';
const hasControl=()=>mode==='keyboard'||cameraStatus==='tracking'&&!!pose;
const active=()=>running()&&!paused&&!hidden&&!$('help-dialog').open&&hasControl();
function toast(text,duration=3700){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function initAudio(){
  if(!audioContext){const AudioCtx=window.AudioContext||window.webkitAudioContext;if(AudioCtx){audioContext=new AudioCtx();engineOsc=audioContext.createOscillator();engineGain=audioContext.createGain();engineOsc.type='sawtooth';engineOsc.frequency.value=35;engineGain.gain.value=0;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=110;engineOsc.connect(filter);filter.connect(engineGain);engineGain.connect(audioContext.destination);engineOsc.start();}}
  audioContext?.resume().catch(()=>{});if(soundEnabled&&running())music.play().catch(()=>toast('Müziği başlatmak için ses düğmesine dokun.'));
}
function syncAudio(){
  const on=soundEnabled&&active();if(on&&music.paused)music.play().catch(()=>{});else if(!on&&!music.paused)music.pause();
  if(!on)for(const a of lasers)if(!a.paused)a.pause();
  if(engineGain){engineGain.gain.setTargetAtTime(on?.009:0,audioContext.currentTime,.12);engineOsc.frequency.setTargetAtTime(25+flight.speed*.23,audioContext.currentTime,.2);}
}
function shotSound(){if(!soundEnabled||!active())return;const a=lasers[laserIndex++%lasers.length];a.currentTime=0;a.play().catch(()=>{});}
function setAngle(value){manualAngle=clamp(Number(value),0,180);$('manual-angle').value=manualAngle;$('angle-label').textContent=Math.round(manualAngle)+'°';}
function input(){if(mode==='camera')return pose??{angle:0,bank:0};return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),bodyThrottle:keys.has('g')?1:0,bodyLean:keys.has('g')?30:0,bodyCalibrated:true};}
function refreshMode(){
  const cam=mode==='camera';$('camera-mode').classList.toggle('active',cam);$('keyboard-mode').classList.toggle('active',!cam);$('camera-mode').setAttribute('aria-pressed',String(cam));$('keyboard-mode').setAttribute('aria-pressed',String(!cam));$('keyboard-control').hidden=cam;$('camera-control').hidden=!cam;
  $('autofire').setAttribute('aria-pressed',String(autoFire));$('autofire').querySelector('b').textContent=autoFire?'AÇIK':'KAPALI';
  $('calibrate-body').disabled=!(cam&&cameraStatus==='tracking');$('camera-placeholder').hidden=!!$('camera-video').srcObject;
  $('camera-dot').classList.toggle('tracking',cameraStatus==='tracking');
}
const controller=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose:p=>{pose=p;},onStatus:s=>{
  cameraStatus=s.state;$('camera-status').textContent=s.state==='off'?'KONTROLÜ DEVRAL':s.message;$('camera-toggle').title=['loading','tracking','lost'].includes(s.state)?'Kamerayı kapat':'Kamerayı aç';refreshMode();if(s.state==='error')toast(s.message+' Klavyeyle devam edebilirsin.',7000);
}});
function setModeKeyboard(){mode='keyboard';controller.stop();keys.clear();pointerFire=false;autoFire=false;setAngle(90);refreshMode();initAudio();updateHud();}
async function setModeCamera({start=false}={}){
  const previous=mode;mode='camera';keys.clear();pointerFire=false;$('start-camera').disabled=true;refreshMode();
  try {const ok=await controller.start();if(ok){autoFire=true;if(start)startMission();initAudio();toast('Kollarını yana aç. Dik duruşun ayarlanınca öne eğilerek gaz ver.',6000);}else {mode=previous;refreshMode();}}
  finally{$('start-camera').disabled=false;refreshMode();updateHud();}
}
function startMission(){
  flight=createFlightState();flight.vehicle='airplane';mission=createMission();mission.status='playing';paused=false;resultShown=false;manualAngle=90;keys.clear();pointerFire=false;pointer=null;setAngle(90);music.currentTime=0;
  if($('result-dialog').open)$('result-dialog').close();$('briefing').hidden=true;$('destination').hidden=true;$('flight-hud').hidden=false;$('control-dock').hidden=false;$('pause').disabled=false;document.body.classList.add('flying');$('simulator').focus();initAudio();refreshMode();updateHud();
  toast('Motorlar aktif. Dünya yörüngesine yükseliyoruz.',3300);
}
function returnToBase(){mission=createMission();flight=createFlightState();paused=false;resultShown=false;controller.stop();mode='keyboard';keys.clear();pointerFire=false;music.pause();if($('result-dialog').open)$('result-dialog').close();$('briefing').hidden=false;$('destination').hidden=false;$('flight-hud').hidden=true;$('control-dock').hidden=true;$('pause').disabled=true;$('pause-overlay').hidden=true;document.body.classList.remove('flying');refreshMode();updateHud();}
function setPaused(value){if(!running())return;paused=value;keys.clear();pointerFire=false;syncAudio();updateHud();}
function showResult(){
  if(resultShown)return;resultShown=true;keys.clear();pointerFire=false;syncAudio();const won=mission.status==='won';
  if(!won){flight.crashed=true;flight.speed=0;flight.verticalSpeed=0;}
  $('result-eyebrow').textContent=won?'GÖREV TAMAMLANDI':'GÖREV SONLANDI';$('result-title').textContent=won?"Uranüs'e ulaştın.":'Kalkanlar tükendi.';
  $('result-description').textContent=won?'Gezegenleri geride bıraktın, iki portalı geçtin. Derin uzay artık bir adım daha yakın.':'10 isabet aldın. Meteorları vur, lazerlerin hedef çizgisini gördüğünde yön değiştir ve tekrar dene.';
  $('result-time').textContent=timeText(mission.time);$('result-kills').textContent=mission.kills;$('result-health').textContent=mission.health;$('result-dialog').showModal();$('pause').disabled=true;
}
function processEvents(){for(const e of mission.events){
  if(e.type==='shot')shotSound();
  if(e.type==='damage'){$('damage-flash').style.opacity='.75';clearTimeout(flashTimer);flashTimer=setTimeout(()=>$('damage-flash').style.opacity='0',180);toast(`Kalkan darbesi · ${mission.health} / 10 kaldı`,1800);}
  if(e.type==='portal'){$('portal-flash').style.opacity='1';setTimeout(()=>$('portal-flash').style.opacity='0',180);toast(`Portal ${e.zone} geçildi · ${e.zone+1}. uzay bölgesi · Nebula yoğunluğu arttı`,4400);}
  if(e.type==='phase'&&e.phase==='meteor')toast('Meteor kuşağı · 15 saniye · Taşları vurarak yolu aç.',2600);
  if(e.type==='phase'&&e.phase==='ufo')toast('Düşman teması · 10 saniye · Lazer çizgisinden uzaklaş.',2600);
  if(e.type==='won'||e.type==='lost')showResult();
}mission.events.length=0;}
function updateHud(){
  const inp=input(),control=resolveAirplaneControl(inp),phase=phaseAt(mission.time),nav=navigationAt(mission,flight);
  $('timer').textContent=timeText(Math.ceil(MISSION.duration-mission.time));$('sector').textContent=['01 / İÇ GÜNEŞ SİSTEMİ','02 / MOR NEBULA','03 / DERİN UZAY'][mission.zone];
  $('health').textContent=mission.health+' / 10';$('health-bars').innerHTML=Array.from({length:10},(_,i)=>`<i${i>=mission.health?' class="empty"':''}></i>`).join('');$('destroyed').textContent=mission.kills+' HEDEF İMHA EDİLDİ';
  $('speed').textContent=Math.round(flight.speed);$('altitude').textContent=Math.round(flight.altitude).toLocaleString('tr');$('vertical').textContent=(flight.verticalSpeed>0?'+':'')+flight.verticalSpeed.toFixed(1);$('throttle').textContent=Math.round(control.throttle*100);
  $('left-angle').textContent=mode==='camera'&&!pose?'—':Math.round(inp.leftAngle??manualAngle)+'°';$('right-angle').textContent=mode==='camera'&&!pose?'—':Math.round(inp.rightAngle??manualAngle)+'°';$('body-lean').textContent='ÖNE EĞİM '+(inp.bodyCalibrated?Math.max(0,Math.round(inp.bodyLean??0))+'°':'—');$('calibrate-body').disabled=!(mode==='camera'&&cameraStatus==='tracking');
  $('nav-title').textContent=nav.name;$('nav-detail').textContent=(Math.abs(nav.error)>8?(nav.error<0?'Sola dön · ':'Sağa dön · '):'Hattı koru · ')+nav.seconds+' sn';$('nav-arrow').style.transform=`rotate(${clamp(nav.error,-150,150)}deg)`;
  const details={launch:['KALKIŞ KORİDORU','Dünya yörüngesinden çıkılıyor'],meteor:['METEOR KUŞAĞI','Taşları vur veya yanlarından kaç'],ufo:['DÜŞMAN TEMASI','Lazer çizgisinden uzaklaş'],quiet:['GÜVENLİ KORİDOR','Bir sonraki dalgaya hazırlan']};
  $('encounter-title').textContent=details[phase.id][0];$('encounter-detail').textContent=details[phase.id][1];$('encounter-time').textContent=Math.ceil(phase.remaining)+' s';$('encounter').classList.toggle('danger',phase.id==='meteor'||phase.id==='ufo');
  $('route-fill').style.width=mission.time/MISSION.duration*100+'%';$('route-progress').textContent=running()?`%${Math.floor(mission.time/MISSION.duration*100)} TAMAMLANDI`:'DÜNYA → URANÜS';
  const current=[...PLANETS].reverse().find(p=>mission.time>=p.time-5)??PLANETS[0];document.querySelectorAll('.route-stop').forEach(el=>el.classList.toggle('current',Number(el.dataset.time)===current.time));
  const visiblePlanet=mission.time<20?PLANETS[0]:PLANETS.find(p=>p.time>mission.time-17)??PLANETS.at(-1);$('scene-label').querySelector('b').textContent=visiblePlanet.name.toLocaleUpperCase('tr');$('scene-label').querySelector('small').textContent=mission.time<18?'01 / KALKIŞ NOKTASI':visiblePlanet.id==='uranus'?'07 / BUZ DEVİ':'GEZEGEN YAKIN GEÇİŞİ';
  const lost=running()&&mode==='camera'&&!hasControl();$('pause-overlay').hidden=!(running()&&(paused||lost||hidden));$('pause-title').textContent=lost?'Seni göremiyoruz.':hidden?'Sekme beklemede.':'Kısa bir mola.';$('pause-description').textContent=lost?'Omuzlarını, kalçanı ve kollarını kameraya göster. Takip gelince yolculuk devam eder.':'Yolculuğun seni bekliyor.';$('resume').hidden=lost&&!paused;
  $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Devam et':'Duraklat');
  $('flight-status').innerHTML='<i></i> '+(!running()?'KALKIŞA HAZIR':paused?'GÖREV DURAKLATILDI':lost?'TAKİP BEKLENİYOR':control.forwardDescent?'İLERİ UÇUŞ · ALÇALIŞ':control.throttling?'GÖVDE GAZI AKTİF':mission.time<18?'YÖRÜNGEYE YÜKSELİŞ':'SEYİR SİSTEMLERİ AKTİF');
}
$('start-keyboard').addEventListener('click',()=>{setModeKeyboard();startMission();});$('start-camera').addEventListener('click',()=>setModeCamera({start:true}));$('keyboard-mode').addEventListener('click',setModeKeyboard);$('camera-mode').addEventListener('click',()=>setModeCamera());
$('camera-toggle').addEventListener('click',()=>{if(['tracking','lost','loading'].includes(cameraStatus)){controller.stop();if(running())toast('Kamera kapalı. Klavye sekmesiyle devam edebilirsin.');}else setModeCamera();});
$('calibrate-body').addEventListener('click',()=>{controller.resetBodyCalibration();if(pose)pose={...pose,bodyThrottle:0,bodyCalibrated:false};toast('Dik dur; nötr gövde duruşun yeniden ayarlanıyor.');});
$('manual-angle').addEventListener('input',e=>setAngle(e.target.value));$('autofire').addEventListener('click',()=>{autoFire=!autoFire;refreshMode();});
$('pause').addEventListener('click',()=>setPaused(!paused));$('resume').addEventListener('click',()=>setPaused(false));$('restart').addEventListener('click',startMission);$('play-again').addEventListener('click',startMission);$('return-base').addEventListener('click',returnToBase);
function toggleView(){flight.camera=flight.camera==='chase'?'cockpit':'chase';$('view-toggle').querySelector('span').textContent=flight.camera==='chase'?'MOTOR KAMERASI':'PİLOT KAMERASI';}
$('view-toggle').addEventListener('click',toggleView);
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Bu pencerede tam ekran açılamadı. Tarayıcıda F11 kullanabilirsin.');}}
$('fullscreen').addEventListener('click',fullscreen);$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').querySelector('span').textContent=soundEnabled?'SES AÇIK':'SES KAPALI';$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');if(soundEnabled)initAudio();syncAudio();});
$('help').addEventListener('click',()=>{$('help-dialog').showModal();keys.clear();pointerFire=false;syncAudio();});$('close-help').addEventListener('click',()=>$('help-dialog').close());$('help-dialog').addEventListener('close',()=>{last=performance.now();syncAudio();});
$('result-dialog').addEventListener('cancel',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select')||$('help-dialog').open)return;const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(key==='r'&&!e.repeat){if(mission.status!=='ready')startMission();return;}
  if(!running())return;if(key===' '&&!e.repeat){setPaused(!paused);return;}if(key==='c'&&!e.repeat)toggleView();if(key==='f'&&!e.repeat)fullscreen();keys.add(key);
});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function clearKeys(){keys.clear();pointerFire=false;}
window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',()=>{hidden=document.hidden;clearKeys();last=performance.now();syncAudio();updateHud();});
$('world').addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(running()){$('aim').style.left=e.clientX+'px';$('aim').style.top=e.clientY+'px';}});
$('world').addEventListener('pointerdown',e=>{if(e.button===0){pointerFire=true;pointer={x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);initAudio();}});
$('fire').addEventListener('pointerdown',e=>{pointerFire=true;$('fire').setPointerCapture(e.pointerId);initAudio();});window.addEventListener('pointerup',()=>pointerFire=false);window.addEventListener('pointercancel',()=>pointerFire=false);
window.addEventListener('resize',()=>{scene?.resize();pointer=null;$('aim').style.left='50%';$('aim').style.top='43%';});
function frame(now){
  const dt=Math.min((now-last)/1000,.1);last=now;const enabled=active();
  if(enabled&&mode==='keyboard'){if(keys.has('arrowup')||keys.has('w'))setAngle(manualAngle+dt*45);if(keys.has('arrowdown')||keys.has('s'))setAngle(manualAngle-dt*45);}
  stepFlight(flight,{...input(),active:enabled,paused:!enabled},dt);
  const direction=pointer&&pointerFire?scene?.aimDirection(pointer.x,pointer.y,flight):null;
  stepMission(mission,flight,dt,{active:enabled,fire:autoFire||pointerFire||keys.has('j'),direction});processEvents();
  scene?.update(flight,mission,dt,{playing:mission.status!=='ready',active:enabled});hudClock+=dt;if(hudClock>=.1){updateHud();syncAudio();hudClock=0;}raf=requestAnimationFrame(frame);
}
try{scene=createFlightScene($('world'));raf=requestAnimationFrame(frame);}catch(error){console.error(error);$('fatal-error').hidden=false;}
refreshMode();updateHud();
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);controller.dispose();scene?.dispose();music.pause();lasers.forEach(a=>a.pause());audioContext?.close();});
// Read-only diagnostics for local verification; no game state mutation is exposed.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...flight,mode,paused,cameraStatus,manualAngle,active:active(),mission:{time:mission.time,health:mission.health,kills:mission.kills,status:mission.status,phase:mission.phase,zone:mission.zone,portalsPassed:mission.portalsPassed,actors:mission.actors.length,shots:mission.shots.length,totalShots:mission.totalShots}})})});
