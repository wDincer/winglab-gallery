import {createFlightScene} from './scene.js';
import {PoseController} from './pose.js';
import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {COURSE,getNextCourseGate} from './course.js';
import {detectCollision} from './collision.js';
import {createRun,updateRun} from './game-rules.js';

const $=id=>document.getElementById(id);
let state=createFlightState(),run=createRun(),mode='camera',started=false,paused=false,pose=null,cameraStatus='off',manualAngle=90,manualGas=false;
let scene,lastTime=performance.now(),hudTime=0,raf,toastTimer,soundEnabled=false,audio,osc,gain,helpWasPaused=false,frameRate=60;
const keys=new Set();state.vehicle='airplane';
const dots=run.gates.map(()=>{const dot=document.createElement('i');$('progress-dots').append(dot);return dot;});
const fmtTime=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
function active(){return started&&!document.hidden&&!paused&&!state.crashed&&!run.finished&&!$('help-dialog').open&&(mode==='keyboard'||(cameraStatus==='tracking'&&pose!==null));}
function input(){if(mode==='camera')return pose??{angle:90,leftAngle:90,rightAngle:90,bank:0,bodyThrottle:0};return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),bodyThrottle:keys.has('g')||manualGas?1:0,bodyLean:keys.has('g')||manualGas?30:0,bodyCalibrated:true};}
function toast(text,time=2700){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),time);}
function setAngle(value){manualAngle=clamp(+value,0,180);$('manual-angle').value=manualAngle;$('manual-angle-label').textContent=Math.round(manualAngle)+'°';}
function refreshMode(){const keyboard=mode==='keyboard';$('keyboard-panel').hidden=!keyboard;$('camera-mode').classList.toggle('active',!keyboard);$('keyboard-mode').classList.toggle('active',keyboard);$('camera-mode').setAttribute('aria-pressed',String(!keyboard));$('keyboard-mode').setAttribute('aria-pressed',String(keyboard));$('calibrate-body').hidden=keyboard;}
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose(value){pose=value;if(value&&mode==='camera'){started=true;document.body.classList.add('playing');$('start-prompt').hidden=true;}},onStatus(status){cameraStatus=status.state;$('camera-message').textContent=status.message;$('camera-placeholder').hidden=status.state==='tracking'||(status.state==='lost'&&!!$('camera-video').srcObject);$('camera-dot').classList.toggle('tracking',status.state==='tracking');if(status.state==='error')toast(status.message,6500);}});
function useKeyboard(){mode='keyboard';manualGas=false;poseController.stop();cameraStatus='off';started=true;document.body.classList.add('playing');$('start-prompt').hidden=true;keys.clear();refreshMode();$('simulator').focus();toast('Kalkış! ↑ ↓ kol açısı · ← → dönüş · G gaz');}
async function useCamera(){mode='camera';keys.clear();manualGas=false;refreshMode();$('start-camera').disabled=true;$('camera-toggle').disabled=true;try{await poseController.start();}finally{$('start-camera').disabled=false;$('camera-toggle').disabled=false;}}
function reset(){const view=state.camera;state=createFlightState();state.vehicle='airplane';state.camera=view;run=createRun();keys.clear();manualGas=false;setAngle(90);paused=false;document.body.classList.remove('crashed','finished','paused');$('pause').textContent='Ⅱ';$('result').hidden=true;$('book-warning').hidden=true;$('pause').disabled=false;dots.forEach(d=>d.className='');$('simulator').focus();scene?.update(state,0,run);hud();toast('Yeni tur! Halkaların içinden geç, kitaplardan kaç.');}
function setPaused(value){if(state.crashed||run.finished)return;paused=value;keys.clear();document.body.classList.toggle('paused',paused);$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Devam et':'Duraklat');hud();}
function result(crash){
  $('result-eyebrow').textContent=crash?'ROBIN’DEN SARMA İKRAMI':'BIKINI BOTTOM TURU TAMAMLANDI';
  $('result-title').textContent=crash?(state.crashType==='book'?'Kitaba yakalandın!':'Ufak bir çarpışma!'):(run.passed===run.gates.length?'Sarmaların hepsi senin!':'Bir tabak daha?');
  $('result-message').textContent=crash?(state.crashType==='book'?'Fenomen kitabı yakaladı, Robin de sarmayla geldi. Bir tur daha deneyelim!':'Batmobil’i tekrar havalandıralım. Turuncu halkanın açık kısmını hedefle.'):run.passed===run.gates.length?'Sekiz halkanın tamamından geçtin. Robin’den kocaman bir sarma tabağı kazandın!':`${run.passed} halkadan geçtin, ${run.missed} halkayı kaçırdın. Yeni turda hepsini toplamayı dene.`;
  $('result-gates').textContent=run.passed+' / '+run.gates.length;$('result-books').textContent=run.dodged;$('result-time').textContent=fmtTime(state.time);$('result').hidden=false;$('pause').disabled=true;$('book-warning').hidden=true;$('restart-flight').focus();
}
function crash(collision){state.crashed=true;state.crashTime=state.time;state.crashType=collision.type;state.speed=0;state.verticalSpeed=0;keys.clear();document.body.classList.add('crashed');clearTimeout(toastTimer);$('toast').classList.remove('visible');result(true);tone(100,.22);}
function initAudio(){if(audio)return;audio=new (window.AudioContext||window.webkitAudioContext)();osc=audio.createOscillator();gain=audio.createGain();osc.type='sawtooth';osc.frequency.value=40;gain.gain.value=0;osc.connect(gain).connect(audio.destination);osc.start();}
function tone(frequency,duration=.12){if(!soundEnabled||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=frequency;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
async function toggleSound(){try{initAudio();await audio.resume();soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'♪':'♫';$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');$('sound').title=soundEnabled?'Sesi kapat':'Sesi aç';}catch{toast('Bu tarayıcıda ses başlatılamadı.');}}
function hud(){
  const data=input(),control=resolveAirplaneControl(data),gas=active()?control.throttle:0,next=getNextCourseGate(state);
  $('gate-count').textContent=run.passed;$('dodged-count').textContent=run.dodged;
  const distance=clamp(state.distance,0,COURSE.length),percent=distance/COURSE.length*100;
  $('course-distance').textContent=(distance/1000).toFixed(2).replace('.',',')+' / 2,80 km';$('progress-percent').textContent='%'+Math.round(percent);$('progress-fill').style.width=percent+'%';
  dots.forEach((dot,i)=>dot.className=run.gates[i].status==='pending'?'':run.gates[i].status);
  $('speed').textContent=Math.round(state.speed);$('speed-fill').style.width=clamp(state.speed/190*100,0,100)+'%';$('altitude').textContent=Math.round(state.altitude);$('vertical').textContent=(state.verticalSpeed>0?'+':'')+state.verticalSpeed.toFixed(1);$('heading').textContent=String(Math.round(state.heading)%360).padStart(3,'0')+'°';
  $('throttle-value').textContent='%'+Math.round(gas*100);$('throttle-fill').style.width=gas*100+'%';$('body-lean').textContent='Öne eğim '+(data.bodyCalibrated?Math.max(0,Math.round(data.bodyLean??0))+'°':'—');
  $('left-angle').textContent=mode==='camera'&&!pose?'—':Math.round(data.leftAngle)+'°';$('right-angle').textContent=mode==='camera'&&!pose?'—':Math.round(data.rightAngle)+'°';$('flight-time').textContent=fmtTime(state.time);
  $('calibrate-body').disabled=cameraStatus!=='tracking';$('manual-gas').setAttribute('aria-pressed',String(manualGas));
  let title='Uçuşa hazırsın.',subtitle='Kamera veya klavye ile kontrolü devral.',symbol='↗';
  if(state.crashed){title='Uçuş sona erdi.';subtitle='Robin’den sarma molası.';symbol='!';}
  else if(run.finished){title='Tur tamamlandı!';subtitle=run.passed+' sarma halkasından geçtin.';symbol='✓';}
  else if(paused||document.hidden||$('help-dialog').open){title='Uçuş duraklatıldı.';subtitle='Devam etmek için ▶ veya Space.';symbol='Ⅱ';}
  else if(started&&mode==='camera'&&!active()){title=cameraStatus==='loading'?'Kamera hazırlanıyor…':'Vücut takibi bekleniyor.';subtitle=cameraStatus==='error'?'Kamerayı yeniden aç veya klavyeyi seç.':'Kolların ve kalçan kadrajda görünsün.';symbol='⌁';}
  else if(active()){
    title=!state.flying?'Batmobil kalkışa hazırlanıyor.':control.attitudeBand.id==='descent'?'Fren ve alçalış':control.forwardDescent?'İlerleyerek alçalıyorsun.':control.throttling?'Tam gaz, sarmaya doğru!':control.attitudeBand.id==='fast'?'Yükseliyorsun.':'Dengeli uçuş.';
    subtitle=mode==='keyboard'?'↑ ↓ kol açısı · ← → dönüş · G gaz':!data.bodyCalibrated?'Kısa süre dik dur; gaz ayarlanıyor.':'Gövdenle gaz ver, kollarınla yönlendir.';
    symbol=control.attitudeBand.id==='descent'?'↓':control.forwardDescent?'↘':control.attitudeBand.id==='fast'?'↑':'→';
  }
  $('control-title').textContent=title;$('control-subtitle').textContent=subtitle;$('status-symbol').textContent=symbol;
  $('target').hidden=!started||state.crashed||run.finished;
  if(next){$('next-gate').innerHTML=String(next.index).padStart(2,'0')+' <span>'+(next.turnAngle?(next.direction==='left'?'↖':'↗'):'→')+'</span>';$('gate-distance').textContent=Math.max(0,Math.round(next.distance-state.distance))+' m';}
  $('book-warning').hidden=!run.books.some(b=>!b.passed)||!active();
  if(gain&&audio){gain.gain.setTargetAtTime(soundEnabled&&active()?.013:0,audio.currentTime,.15);osc.frequency.setTargetAtTime(35+state.speed*.5+gas*25,audio.currentTime,.15);}
  document.querySelectorAll('[data-angle]').forEach(b=>b.classList.toggle('selected',Math.abs(+b.dataset.angle-manualAngle)<4));
}
function toggleView(){state.camera=state.camera==='chase'?'cockpit':'chase';$('view-label').textContent=state.camera==='chase'?'Takip kamerası':'Pilot kamerası';}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Tarayıcının tam ekran düğmesini kullanabilirsin.');}}
$('start-camera').onclick=useCamera;$('camera-mode').onclick=useCamera;$('try-keyboard').onclick=useKeyboard;$('keyboard-mode').onclick=useKeyboard;
$('camera-toggle').onclick=()=>{if(['tracking','lost','loading'].includes(cameraStatus))poseController.stop();else useCamera();};
$('manual-angle').oninput=e=>setAngle(e.target.value);$('manual-gas').onclick=()=>{manualGas=!manualGas;hud();};
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>setAngle(b.dataset.angle));
$('calibrate-body').onclick=()=>{poseController.resetBodyCalibration();toast('Kısa süre dik dur. Gaz için nötr duruşun ayarlanıyor.');};
$('pause').onclick=()=>setPaused(!paused);$('reset').onclick=reset;$('restart-flight').onclick=reset;$('view-toggle').onclick=toggleView;$('fullscreen').onclick=fullscreen;$('sound').onclick=toggleSound;
$('help').onclick=()=>{helpWasPaused=paused;setPaused(true);$('help-dialog').showModal();};
$('close-help').onclick=$('help-done').onclick=()=>$('help-dialog').close();$('help-dialog').onclose=()=>setPaused(helpWasPaused);
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if($('help-dialog').open)return;
  if(e.target.matches('input,textarea,select')&&key!=='escape')return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(state.crashed||run.finished){if(key==='r')reset();return;}
  if(!e.repeat){if(key===' ')setPaused(!paused);if(key==='r')reset();if(key==='c')toggleView();if(key==='f')fullscreen();}
  if(['arrowup','arrowdown','arrowleft','arrowright','g','w','a','s','d'].includes(key)){if(!started)useKeyboard();if(mode==='keyboard')keys.add(key);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();lastTime=performance.now();});
window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.min((now-lastTime)/1000,1);frameRate=frameRate*.9+(1/Math.max(.001,dt))*.1;lastTime=now;
  // Substeps keep real time and swept collisions consistent on slower devices.
  const steps=Math.max(1,Math.ceil(dt/.05)),step=dt/steps;
  for(let tick=0;tick<steps&&active();tick++){
    if(mode==='keyboard'){if(keys.has('arrowup')||keys.has('w'))setAngle(manualAngle+step*45);if(keys.has('arrowdown')||keys.has('s'))setAngle(manualAngle-step*45);}
    const previous={...state};stepFlight(state,{...input(),active:true,paused:false},step);
    const environmentHit=detectCollision(previous,state);
    if(environmentHit)crash(environmentHit);
    else{const updated=updateRun(run,previous,state,step);if(updated.collision)crash(updated.collision);else for(const e of updated.events){if(e.type==='gate'){toast('Halka '+String(e.index).padStart(2,'0')+' · Sarma senin! 🥬');tone(660);setTimeout(()=>tone(880),90);}if(e.type==='miss')toast('Halka kaçtı! Sonrakini hedefle.');if(e.type==='dodge'){toast('Kitabı atlattın! Güzel manevra.');tone(490);}if(e.type==='finish'){document.body.classList.add('finished');result(false);}}}
  }
  scene?.update(state,dt,run);hudTime+=dt;if(hudTime>.08){hud();hudTime=0;}raf=requestAnimationFrame(frame);
}
try{scene=createFlightScene($('world'));scene.update(state,0,run);raf=requestAnimationFrame(frame);}catch(e){console.error('Scene initialization failed',e);$('fatal-error').hidden=false;}
refreshMode();hud();
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();audio?.close();});
// Read-only snapshots for repeatable browser and control verification.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,started,paused,active:active(),cameraStatus,manualAngle,fps:Math.round(frameRate),render:scene?.getStats(),passed:run.passed,missed:run.missed,dodged:run.dodged,finished:run.finished,books:run.books.map(b=>({...b})),gates:run.gates.map(g=>({...g}))})})});
