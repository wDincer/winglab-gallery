import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {PoseController} from './pose.js';
import {ClapDetector} from './clap.js';
import {createCombatState,stepCombat,firePlayer,flightFrame} from './combat.js';
import {createSpaceScene} from './space-scene.js';
import {LaserAudio} from './laser-audio.js';
const $=id=>document.getElementById(id),keys=new Set(),clap=new ClapDetector();
let state=createFlightState(),combat=createCombatState(state),mode='camera',started=false,paused=false,hiddenPause=document.hidden;
let cameraStatus='off',pose=null,manualAngle=90,scene,lastTime=performance.now(),hudTime=0,raf,toastTimer,resultAt=null;
let holdUntil=0,stablePose={angle:90,leftAngle:90,rightAngle:90,bank:0,closed:false},soundEnabled=true,audio,engineGain,engineOsc,laserAudio;
state.vehicle='airplane';
const pad=n=>String(Math.floor(n)).padStart(2,'0'),timeString=n=>pad(n/60)+':'+pad(n%60);
function toast(message,ms=3500){$('flight-toast').textContent=message;$('flight-toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('flight-toast').classList.remove('visible'),ms);}
function tracking(){return mode==='keyboard'||(cameraStatus==='tracking'&&pose!==null);}
function canSimulate(){return started&&tracking()&&!paused&&!hiddenPause&&!$('help-dialog').open;}
function currentInput(){
  if(mode==='keyboard')return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),bodyThrottle:keys.has('g')?1:0,bodyLean:keys.has('g')?30:0,bodyCalibrated:true};
  if(!pose)return {angle:90,bank:0,bodyThrottle:0};
  if(performance.now()<holdUntil)return {...pose,...stablePose,closed:false};
  return pose;
}
function refreshMode(){
  const keyboard=mode==='keyboard';document.body.classList.toggle('keyboard-mode',keyboard);
  $('keyboard-mode').classList.toggle('active',keyboard);$('camera-mode').classList.toggle('active',!keyboard);
  $('keyboard-mode').setAttribute('aria-pressed',String(keyboard));$('camera-mode').setAttribute('aria-pressed',String(!keyboard));
  $('keyboard-panel').hidden=!keyboard;$('keyboard-hints').hidden=!keyboard;$('camera-hints').hidden=keyboard;$('calibrate-body').hidden=keyboard;
  $('camera-placeholder').hidden=cameraStatus==='tracking'||(cameraStatus==='lost'&&!!$('camera-video').srcObject);
  $('clap-state').textContent=keyboard?'X / DOKUN':'EL ÇIRP';
}
function begin(){if(!started){started=true;document.body.classList.remove('intro-open');document.body.classList.add('playing');$('pause').disabled=false;lastTime=performance.now();$('simulator').focus({preventScroll:true});}refreshMode();}
function keyboard(){prepareAudio();mode='keyboard';poseController.stop();cameraStatus='off';clap.reset();holdUntil=0;keys.clear();begin();toast('↑ ↓ kol açısı · ← → yön · G gaz · X çift ışın');}
async function camera(){
  if(cameraStatus==='loading')return;
  prepareAudio();
  mode='camera';keys.clear();clap.reset();holdUntil=0;refreshMode();$('start-camera').disabled=true;
  try{await poseController.start();}finally{$('start-camera').disabled=false;}
}
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),
  onPose(value){
    pose=value;
    if(!value){clap.reset();holdUntil=0;laserAudio?.stopAll();return;}
    if(mode!=='camera')return;
    if(!started)begin();
    if(!canSimulate()||combat.lost||combat.won){clap.reset();return;}
    const now=performance.now(),gesture=clap.update(value.landmarks,now,($('camera-video').videoWidth||640)/($('camera-video').videoHeight||480));
    if(gesture.closing)holdUntil=now+700;
    if(!gesture.closing&&(gesture.gap??0)>1.5){stablePose={angle:value.angle,leftAngle:value.leftAngle,rightAngle:value.rightAngle,bank:value.bank,closed:false};}
    if(gesture.clapped){holdUntil=now+850;fire();}
    $('clap-state').textContent=gesture.armed?'EL ÇIRP':'ELLERİNİ AÇ';
  },
  onStatus(status){
    cameraStatus=status.state;$('camera-dot').classList.toggle('tracking',cameraStatus==='tracking');$('tracking-badge').hidden=cameraStatus!=='tracking';
    $('camera-message').textContent=cameraStatus==='off'?(mode==='keyboard'?'Klavye kontrolü aktif':'Kamera bekleniyor'):status.message;
    $('camera-toggle').setAttribute('aria-label',['tracking','lost','loading'].includes(cameraStatus)?'Kamerayı kapat':'Kamerayı aç');
    $('camera-toggle').title=$('camera-toggle').getAttribute('aria-label');
    if(cameraStatus==='error')toast(status.message,6500);
    refreshMode();
  }
});
function fire(){if(!canSimulate()||combat.lost||combat.won)return;if(firePlayer(combat,state)){$('fire').classList.add('firing');setTimeout(()=>$('fire').classList.remove('firing'),150);}}
function setPaused(value){paused=value;if(value)laserAudio?.stopAll();keys.clear();clap.reset();holdUntil=0;document.body.classList.toggle('paused',value);$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?'Devam et':'Duraklat');$('pause').title=value?'Devam et (Boşluk)':'Duraklat (Boşluk)';}
function reset(){laserAudio?.stopAll();const view=state.camera;state=createFlightState();state.vehicle='airplane';state.camera=view;combat=createCombatState(state);manualAngle=90;$('manual-angle').value=90;clap.reset();keys.clear();holdUntil=0;resultAt=null;$('result-overlay').hidden=true;$('pause').disabled=false;setPaused(false);$('simulator').focus({preventScroll:true});updateHud();toast('Yeni görev. Beş düşman, 100 HP. Uçuşa hazırsın.');}
function setAngle(value){manualAngle=clamp(Number(value),0,180);$('manual-angle').value=manualAngle;$('manual-angle-label').textContent=Math.round(manualAngle)+'°';}
function toggleView(){state.camera=state.camera==='chase'?'cockpit':'chase';toast(state.camera==='chase'?'Takip kamerası':'Pilot kamerası');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Tam ekran bu görünümde kullanılamıyor.');}}
function syncSoundButton(){$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');$('sound').title=soundEnabled?'Sesi kapat':'Sesi aç';$('sound').style.color=soundEnabled?'var(--orange)':'';}
function initAudio(){if(audio)return;audio=new(window.AudioContext||window.webkitAudioContext)();engineOsc=audio.createOscillator();engineGain=audio.createGain();const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=130;engineOsc.type='sawtooth';engineGain.gain.value=0;engineOsc.connect(filter).connect(engineGain).connect(audio.destination);engineOsc.start();laserAudio=new LaserAudio(audio,new URL('./assets/laser-fire.mp3',import.meta.url),{onError:()=>toast('Ateş sesi yüklenemedi. Sayfayı yenileyip tekrar dene.',6000)});}
async function prepareAudio(){if(!soundEnabled)return;try{initAudio();await audio.resume();}catch{soundEnabled=false;syncSoundButton();toast('Ses başlatılamadı. Ses düğmesine basarak yeniden deneyebilirsin.');}}
async function toggleSound(){soundEnabled=!soundEnabled;if(soundEnabled)await prepareAudio();else{laserAudio?.stopAll();if(engineGain)engineGain.gain.setTargetAtTime(0,audio.currentTime,.03);}syncSoundButton();}
function playEffect(type){if(!soundEnabled||!audio)return;const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type=type==='explosion'?'sawtooth':'triangle';o.frequency.setValueAtTime(type==='hit'?170:65,t);o.frequency.exponentialRampToValueAtTime(25,t+.28);g.gain.setValueAtTime(type==='explosion'?.12:.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g).connect(audio.destination);o.start();o.stop(t+.4);o.onended=()=>{o.disconnect();g.disconnect();};}
const markers=new Map();
function updateMarkers(){
  if(!scene)return;
  for(const projected of scene.projectEnemies(combat,state)){
    const enemy=combat.enemies.find(e=>e.id===projected.id);
    if(!markers.has(enemy.id)){const marker=document.createElement('div'),label=document.createElement('div');marker.className='target-marker';label.className='target-label';label.innerHTML=`${enemy.type==='cruiser'?'KRUVAZÖR':'AVCI'} ${pad(enemy.id)} <span class="range"></span><span class="enemy-bar"><i></i></span>`;$('target-layer').append(marker,label);markers.set(enemy.id,{marker,label});}
    const {marker,label}=markers.get(enemy.id),visible=projected.visible&&started&&!combat.lost&&!combat.won;
    marker.hidden=label.hidden=!visible;
    if(visible){const x=projected.x*100,y=projected.y*100;marker.style.left=x+'%';marker.style.top=y+'%';label.style.left=x+'%';label.style.top=`calc(${y}% - 36px)`;label.querySelector('.range').textContent=projected.distance+' M';label.querySelector('i').style.width=enemy.hp+'%';marker.style.borderColor=combat.lockId===enemy.id?'#8effb277':'#ff8d7955';}
  }
  for(const[id,{marker,label}]of markers)if(combat.enemies.find(e=>e.id===id)?.dead){marker.hidden=label.hidden=true;}
}
function showResult(){
  const win=combat.won;$('result-eyebrow').textContent=win?'SEKTÖR TEMİZLENDİ':'GÖREV SONU';$('result-title').textContent=win?'Bulutsu artık güvende.':'Gövde kaybedildi.';
  $('result-message').textContent=win?'Düşman filosunun tümünü etkisiz hale getirdin. Bir sonraki uçuşa hazır mısın?':'Aracın 0 HP’ye ulaştı ve patladı. Yön ve irtifa değiştirerek düşman ışınlarından kaçabilirsin.';
  $('result-kills').textContent=combat.kills+' / '+combat.enemies.length;$('result-hits').textContent=combat.hits;$('result-time').textContent=timeString(combat.time);$('result-overlay').hidden=false;$('pause').disabled=true;$('restart-flight').focus({preventScroll:true});
}
function updateHud(){
  const input=currentInput(),control=resolveAirplaneControl(input),running=canSimulate(),terminal=combat.lost||combat.won;
  $('simulator').dataset.flight=JSON.stringify({speed:state.speed,altitude:state.altitude,heading:state.heading,bank:state.bank,verticalSpeed:state.verticalSpeed,bodyThrottle:control.throttle,angle:input.angle,mode,started,paused,active:running,cameraStatus,hp:combat.hp,kills:combat.kills,hits:combat.hits,volleys:combat.volleys,time:combat.time,won:combat.won,lost:combat.lost,lockId:combat.lockId,projectiles:combat.projectiles.length,effects:combat.effects.map(e=>e.type)});
  $('simulator').dataset.sound=JSON.stringify({enabled:soundEnabled,context:audio?.state??'not-started',...laserAudio?.getStats()});
  $('hp').textContent=combat.hp;$('hp-fill').style.width=combat.hp+'%';$('hp-fill').style.background=combat.hp<=30?'#ff665d':'var(--orange)';
  $('kills').textContent=pad(combat.kills);$('enemy-total').textContent=pad(combat.enemies.length);$('flight-time').textContent=timeString(combat.time);
  $('speed').textContent=String(Math.round(state.speed)).padStart(3,'0');$('altitude').textContent=String(Math.round(state.altitude)).padStart(3,'0');
  $('speed-label').textContent=control.attitudeBand.id==='descent'?'FREN':control.throttling?'TAM GÜÇ':state.flying?'SEYİR':'KALKIŞ';
  $('vertical-label').textContent=(state.verticalSpeed>0?'+':'')+state.verticalSpeed.toFixed(1)+' M/S';
  const throttle=Math.round((running?control.throttle:0)*100);$('throttle-value').textContent='%'+throttle;$('throttle-fill').style.width=throttle+'%';
  $('body-lean').textContent='Öne eğim '+(input.bodyCalibrated?Math.max(0,Math.round(input.bodyLean??0))+'°':'—');
  $('body-calibration-status').textContent=mode==='keyboard'?'Klavye kontrolü':pose?.bodyCalibrated?'Dik duruş ayarlı':pose?'Dik dur, ayarlanıyor…':'Gövde kontrolü';
  $('calibrate-body').disabled=cameraStatus!=='tracking';$('manual-angle-label').textContent=Math.round(manualAngle)+'°';
  $('top-status').textContent=terminal?(combat.won?'GÖREV TAMAMLANDI':'BAĞLANTI KESİLDİ'):!started?'UÇUŞA HAZIR':!running?'BEKLEMEDE':'ÇATIŞMA AKTİF';
  $('mission-state').textContent=terminal?(combat.won?'05 / 05 — TEHDİT YOK':'ARAÇ İMHA EDİLDİ'):!running?'UÇUŞ BEKLEMEDE':!state.flying?'KALKIŞ İÇİN KOLLARINI AÇ':`${pad(combat.enemies.length-combat.kills)} DÜŞMAN · KAÇINMA MANEVRASI YAP`;
  $('control-title').textContent=performance.now()<holdUntil?'ÇİFT IŞIN · UÇUŞ DENGESİ KORUNUYOR':control.throttling?'GÖVDE GAZI · ÖNE EĞİM':control.forwardDescent?'ALÇALIŞ · KOLLARINI 90° AÇINCA DENGELE':control.attitudeBand.id==='descent'?'FREN · YENİDEN AÇILARAK HIZLAN':control.attitudeBand.id==='fast'?'TIRMANIŞ · HEDEFİ ORTADA TUT':'KOLLARINI AÇ. HEDEFİ YAKALA.';
  const lock=combat.enemies.find(e=>e.id===combat.lockId&&!e.dead);
  $('aim').classList.toggle('locked',!!lock&&!terminal);$('aim').setAttribute('aria-label',lock?'Nişangah yeşil, hedefe kilitlenildi':'Nişangah, hedef aranıyor');
  $('aim-label').textContent=lock?'HEDEFE KİLİTLENDİ':'HEDEF ARANIYOR';$('target-distance').textContent=lock?lock.name:'';
  $('target-card').hidden=!lock||terminal;if(lock){$('target-name').textContent=lock.type==='cruiser'?'AĞIR KRUVAZÖR':'DÜŞMAN AVCI '+pad(lock.id);$('target-hp').textContent=lock.hp;$('target-hp-fill').style.width=lock.hp+'%';}
  $('weapon-status').innerHTML=combat.time<combat.nextShot?'SOĞUYOR':'HAZIR <i></i>';
  const waiting=started&&!terminal&&!$('help-dialog').open&&(paused||hiddenPause||!tracking());
  $('pause-overlay').hidden=!waiting;
  if(waiting){const lost=!tracking()&&mode==='camera';$('pause-title').textContent=lost?'Pilot bekleniyor.':'Bir nefes arası.';$('pause-message').textContent=lost?(cameraStatus==='error'?'Kamerayı yeniden aç veya Klavye düğmesini kullan.':'Omuzların, kolların ve kalçan kadrajda olsun. Takip gelince uçuş devam eder.'):'Uçuş ve savaş duraklatıldı.';$('resume').hidden=lost;}
  if(engineGain&&audio){engineGain.gain.setTargetAtTime(soundEnabled&&running&&!terminal?.023:0,audio.currentTime,.13);engineOsc.frequency.setTargetAtTime(32+state.speed*.2,audio.currentTime,.2);}
  updateMarkers();
}
function frame(now){
  const dt=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;
  const active=canSimulate();
  if(active&&mode==='keyboard'&&!combat.lost&&!combat.won){const direction=(keys.has('arrowup')||keys.has('w')?1:0)-(keys.has('arrowdown')||keys.has('s')?1:0);if(direction)setAngle(manualAngle+direction*45*dt);}
  stepFlight(state,{...currentInput(),active:active&&!combat.won&&!combat.lost,paused:!active},dt);
  stepCombat(combat,state,dt,{active,paused:!active});
  laserAudio?.update({enabled:soundEnabled,active:active&&!combat.lost&&!combat.won,listener:flightFrame(state).position,enemies:combat.enemies});
  for(const event of combat.events){
    if(event.type==='fire')laserAudio?.play(event);
    if(event.type==='hit')playEffect('hit');
    if(event.type==='damage'){$('damage-flash').animate([{opacity:.5},{opacity:0}],{duration:380});playEffect('hit');}
    if(event.type==='destroyed'){playEffect('explosion');if(event.owner==='enemy')toast(event.name+' imha edildi · '+combat.kills+'/'+combat.enemies.length,2200);else{state.crashed=true;state.crashTime=state.time;state.speed=0;state.verticalSpeed=0;}}
    if((event.type==='victory'||event.type==='destroyed'&&event.owner==='player')&&resultAt===null){resultAt=now+1500;keys.clear();clap.reset();}
  }combat.events=[];
  scene?.update(state,combat,dt,{intro:!started,active});
  if(resultAt!==null&&now>=resultAt&&$('result-overlay').hidden)showResult();
  hudTime+=dt;if(hudTime>.075){updateHud();hudTime=0;}
  raf=requestAnimationFrame(frame);
}
$('start-camera').addEventListener('click',camera);$('try-keyboard').addEventListener('click',keyboard);$('keyboard-mode').addEventListener('click',keyboard);$('camera-mode').addEventListener('click',camera);
$('camera-toggle').addEventListener('click',()=>['tracking','lost','loading'].includes(cameraStatus)?poseController.stop():camera());
$('calibrate-body').addEventListener('click',()=>{poseController.resetBodyCalibration();toast('600 ms dik dur. Normal duruşun yeniden ayarlanıyor.');});
$('manual-angle').addEventListener('input',e=>setAngle(e.target.value));$('level-wings').addEventListener('click',()=>setAngle(90));
$('fire').addEventListener('click',fire);$('pause').addEventListener('click',()=>setPaused(!paused));$('resume').addEventListener('click',()=>setPaused(false));$('restart-flight').addEventListener('click',reset);$('sound').addEventListener('click',toggleSound);$('fullscreen').addEventListener('click',fullscreen);
$('help').addEventListener('click',()=>{keys.clear();clap.reset();laserAudio?.stopAll();$('help-dialog').showModal();});for(const id of ['close-help','help-done'])$(id).addEventListener('click',()=>$('help-dialog').close());
$('help-dialog').addEventListener('close',()=>{lastTime=performance.now();keys.clear();clap.reset();});
window.addEventListener('keydown',e=>{
  if($('help-dialog').open||e.target.matches('input,textarea,select'))return;
  const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(k==='r'&&started&&!e.repeat){reset();return;}
  if(k==='f'&&!e.repeat){fullscreen();return;}
  if(!started||combat.lost||combat.won)return;
  if(k===' '&&!e.repeat){setPaused(!paused);return;}
  if(k==='c'&&!e.repeat){toggleView();return;}
  if(k==='x'&&!e.repeat){fire();return;}
  if(canSimulate()&&mode==='keyboard')keys.add(k);
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();clap.reset();if(started&&!combat.lost&&!combat.won)setPaused(true);});
document.addEventListener('visibilitychange',()=>{hiddenPause=document.hidden;if(hiddenPause)laserAudio?.stopAll();keys.clear();clap.reset();holdUntil=0;lastTime=performance.now();});
window.addEventListener('resize',()=>scene?.resize());
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();laserAudio?.dispose();audio?.close();});
try{scene=createSpaceScene($('world'));syncSoundButton();updateHud();raf=requestAnimationFrame(frame);}catch(error){console.error('NEBULA WING:',error);$('fatal-error').hidden=false;}
// Read-only telemetry: useful for checking simulation, camera and combat behavior.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,started,paused,active:canSimulate(),cameraStatus,manualAngle,hp:combat.hp,kills:combat.kills,hits:combat.hits,volleys:combat.volleys,combatTime:combat.time,won:combat.won,lost:combat.lost,lockId:combat.lockId,projectiles:combat.projectiles.map(s=>({...s})),enemies:combat.enemies.map(e=>({...e})),effects:combat.effects.map(e=>({...e})),render:scene?.getStats()})})});

