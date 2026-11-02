import {createFlightScene} from './scene.js';
import {PoseController} from './pose.js';
import {createFlightState,stepFlight,speedBand,resolveAirplaneControl,clamp} from './flight.js';
import {createDiamondField,updateDiamondField} from './diamonds.js';
import {COURSE,courseProgress,getCourseSection,getCourseGates,getNextCourseGate} from './course.js';
import {detectCollision} from './collision.js';
import {createEagleState,stepEagle,eagleBand} from './eagle.js';

const $=id=>document.getElementById(id);
let state=createFlightState();
let diamondField=createDiamondField();
let courseComplete=false;
let lastSectionLabel='';
function syncDiamonds(){state.diamonds=diamondField.items;state.diamondCount=diamondField.total;}
syncDiamonds();
let mode='camera',paused=false,pose=null,cameraStatus='off',manualAngle=90,manualBank=0;
let vehicle=null,pendingFlap=false,menuWasPaused=false;
let manualThrottle=0;
let scene,raf,lastTime=performance.now(),toastTimer,hiddenPause=false,hudElapsed=0;
let audioContext,engineOscillator,engineGain,soundEnabled=false;
const keys=new Set();
const courseGateCount=getCourseGates().length;
const airplaneGuide=$('gesture-guide').innerHTML;
const airplaneHelp=$('help-dialog').querySelector('ol').innerHTML;
const airplaneRanges=document.querySelector('.range-labels').innerHTML;
const armIcon='<svg viewBox="0 0 48 35" aria-hidden="true"><circle cx="24" cy="5" r="3"/><path d="M24 11v14m0-12L9 5m15 8L39 5M24 25l-6 8m6-8 6 8"/></svg>';
function applyVehicleUi(){
  const eagle=vehicle==='eagle';document.body.classList.toggle('eagle-mode',eagle);
  $('vehicle-label').textContent=eagle?'02 · Kartal':'01 · Uçak';$('edition-label').textContent=eagle?'WINGLAB 02':'WINGLAB 01';
  $('start-title').innerHTML=eagle?'Kanatlarını aç.<br><em>Bir kartal gibi uç.</em>':'Kollarını aç.<br><em>Gökyüzü senin.</em>';
  $('start-description').textContent=eagle?'Kanat çırparak hızlan; çırpışı bırakıp 90°’de hızını koruyarak süzül.':'Kolların açık kalsın. Öne eğilerek gaz ver, dik durarak normal güce dön.';
  $('gesture-guide').innerHTML=eagle?`<div class="guide-heading"><span>KARTAL / HAREKET REHBERİ</span><span>↗</span></div>
    <button class="gesture" data-flap data-band="flap" title="Kanat çırpmayı dene (B)">${armIcon}<span>Kanat çırp<small>İki kolu yukarı → aşağı · B</small></span><span class="descent-arrow">↟</span></button>
    <button class="gesture" data-angle="90" data-band="glide" title="90 derece ile süzülmeyi dene"><svg viewBox="0 0 48 35"><circle cx="24" cy="5" r="3"/><path d="M24 11v14M7 13h34M24 25l-6 8m6-8 6 8"/></svg><span>Süzül & irtifayı koru<small>80° – 100° · hızını koru</small></span><span class="descent-arrow">→</span></button>
    <button class="gesture" data-angle="145" data-band="brake" title="Kollar yukarı: yavaşlamayı dene">${armIcon}<span>Yavaşla<small>Kollar yukarı · 100° üzeri</small></span><span class="descent-arrow">↑</span></button>
    <button class="gesture" data-angle="0" data-band="dive" title="Kollar aşağı: hızlı dalışı dene"><svg viewBox="0 0 48 35"><circle cx="24" cy="5" r="3"/><path d="M24 11v14m-3-12-4 12m10-12 4 12M24 25l-6 8m6-8 6 8"/></svg><span>Hızlan & dalışa geç<small>Kollar aşağı · irtifa düşer</small></span><span class="descent-arrow">↓</span></button>
    <div class="guide-tip">Dönüş için bir kolunu alçalt. Hızlanmak için iki kolunla çırp.</div><div class="eagle-flap-feedback"><span>GÜÇLÜ KANAT ÇIRPIŞI</span><strong id="flap-count">0</strong></div>`:airplaneGuide;
  $('help-dialog').querySelector('h2').textContent=eagle?'Kanatların sensin.':'Kumanda sensin.';
  $('help-dialog').querySelector('ol').innerHTML=eagle?'<li><b>Kalkış ve hızlanma:</b> İki kolunu birlikte yukarı kaldır, sonra aşağı çırp. Her tam çırpış hız ve kaldırma kuvveti verir; kartal da seninle kanat çırpar.</li><li><b>Süzülme:</b> Kollarını 80–100° arasında tut. Kartal irtifasını ve kazandığı hızı koruyarak süzülür; hızı birkaç saniye içinde yavaşça azalır.</li><li><b>Yavaşlama:</b> Kollarını yukarıda sabit tut; bu hareket güçlü frenleme yapar.</li><li><b>Dalış:</b> Kollarını aşağıda tut. Havada hızlanırken irtifa kaybedersin; yere yaklaşınca tekrar aç.</li><li><b>Dönüş:</b> Sağa dönmek için sağ, sola dönmek için sol kolunu alçalt. Klavyede B ile kanat çırp.</li>':airplaneHelp+'<li><b>Gövde gazı:</b> Kamera açılınca kısa süre dik dur; normal duruşun ayarlansın. Kollarını kanat gibi açık tutarken gövdeni öne eğdikçe gaz artar. Dik durunca normal seyir gücüne dönersin. Omuzların ve kalçan kadrajda olsun. Gerekirse Dik duruşu ayarla düğmesine bas. Klavyede G’yi basılı tut veya gaz göstergesine tıkla.</li>';
  document.querySelector('.keyboard-hint').textContent=eagle?'B çırp · ↑ ↓ kol · ← → yön':'G gaz · ↑ ↓ kol · ← → yön';
  document.querySelector('.range-labels').innerHTML=eagle?'<span>0° · Hızlı dalış</span><span>90° · Süzül</span><span>180° · Fren</span>':airplaneRanges;
  $('sound').disabled=eagle;$('sound').title=eagle?'Kartal modunda motor sesi yok':soundEnabled?'Sesi kapat':'Sesi aç';
}
function openVehicleMenu(){menuWasPaused=paused;setPaused(true);keys.clear();pendingFlap=false;$('cancel-mode').hidden=!vehicle;$('vehicle-dialog').showModal();}
function selectVehicle(value){vehicle=value;$('vehicle-dialog').close();applyVehicleUi();resetFlight();if(!activeInput())$('start-prompt').classList.remove('dismissed');toast(value==='eagle'?'Kartal modu · Kalkış ve hızlanma için iki kolunla kanat çırp.':'Uçak modu · Dik duruşun ayarlansın, öne eğilerek gaz ver.',4500);}
function requestFlap(){if(vehicle!=='eagle'||paused||hiddenPause||state.crashed||$('vehicle-dialog').open)return;if(mode!=='keyboard')useKeyboard(90);pendingFlap=true;}
function clearFlapGesture(){pendingFlap=false;if(vehicle==='eagle')stepEagle(state,{active:false},0);}
function currentInput(){
  if(mode==='camera')return pose;
  const gas=vehicle==='airplane'?Math.max(manualThrottle,keys.has('g')?1:0):0;
  return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:manualBank,bodyThrottle:gas,bodyLean:gas*30,bodyCalibrated:true};
}
function toggleManualThrottle(){if(vehicle!=='airplane'||paused||hiddenPause||state.crashed)return;if(mode!=='keyboard')useKeyboard();manualThrottle=manualThrottle?0:1;updateHud();}
function calibrateBody(){
  if(vehicle!=='airplane'||mode!=='camera'||cameraStatus!=='tracking')return;
  poseController.resetBodyCalibration();
  if(pose)pose={...pose,bodyThrottle:0,bodyLean:null,bodyCalibrated:false};
  updateHud();toast('Kısa süre dik dur. Normal duruşun ayarlanıyor.');
}
const statusMessages={loading:'Yapay zekâ hazırlanıyor',tracking:'Vücut takibi aktif',lost:'Kadrajda kolların görünsün',off:'Seni bekliyor',error:'Kamera bağlantısı gerekli'};

function toast(message,duration=3200){$('flight-toast').textContent=message;$('flight-toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('flight-toast').classList.remove('visible'),duration);}
function setManualAngle(value){manualAngle=clamp(Number(value),0,180);$('manual-angle').value=manualAngle;$('manual-angle-label').textContent=Math.round(manualAngle)+'°';}
function hidePrompt(){$('start-prompt').classList.add('dismissed');}
function refreshMode(){
  const keyboard=mode==='keyboard';
  $('keyboard-panel').hidden=!keyboard;
  $('keyboard-mode').classList.toggle('active',keyboard);$('camera-mode').classList.toggle('active',!keyboard);
  $('keyboard-mode').setAttribute('aria-pressed',String(keyboard));$('camera-mode').setAttribute('aria-pressed',String(!keyboard));
  $('camera-placeholder').hidden=cameraStatus==='tracking'||(cameraStatus==='lost'&&!!$('camera-video').srcObject);
  $('gesture-guide').classList.toggle('keyboard-open',keyboard);document.querySelector('.camera-card').classList.toggle('keyboard-open',keyboard);
}
function useKeyboard(angle=manualAngle){clearFlapGesture();manualThrottle=0;mode='keyboard';setManualAngle(angle);poseController.stop();cameraStatus='off';hidePrompt();refreshMode();toast(vehicle==='eagle'?'Klavye · B kanat çırp · ↑ ↓ kol açısı · ← → dönüş':'Klavye · G basılı: gaz · ↑ ↓ kol açısı · ← → dönüş');}
async function useCamera(){
  clearFlapGesture();manualThrottle=0;mode='camera';manualBank=0;keys.clear();refreshMode();
  $('start-camera').disabled=true;
  try {if(await poseController.start()) hidePrompt();}
  finally{$('start-camera').disabled=false;}
}
const poseController=new PoseController({
  video:$('camera-video'),canvas:$('pose-canvas'),
  onPose(value){pose=value;if(!value)clearFlapGesture();if(value&&mode==='camera')hidePrompt();},
  onStatus(status){
    cameraStatus=status.state;
    $('camera-dot').classList.toggle('tracking',status.state==='tracking');
    $('tracking-badge').hidden=status.state!=='tracking';
    $('camera-message').textContent=status.state==='off'?(mode==='keyboard'?'Klavye kontrolü aktif.':'Kameranı aç, kontrolü devral.'):status.message;
    $('camera-toggle').title=['tracking','lost','loading'].includes(status.state)?'Kamerayı kapat':'Kamerayı aç';
    $('camera-toggle').setAttribute('aria-label',$('camera-toggle').title);
    if(status.state==='error')toast(status.message,6500);
    refreshMode();
  }
});

function activeInput(){return !!vehicle&&!$('vehicle-dialog').open&&(mode==='keyboard'||(cameraStatus==='tracking'&&pose!==null));}
function updateHud(){
  const section=getCourseSection(state);
  const nextGate=getNextCourseGate(state);
  const turnHint=nextGate?.turnAngle?`${nextGate.direction==='left'?'← SOLA':'SAĞA →'} ${nextGate.turnAngle}°`:'';
  const gateLabel=nextGate?`GEÇİT ${String(nextGate.index).padStart(2,'0')} / ${String(courseGateCount).padStart(2,'0')} · ${turnHint|| (nextGate.finish?'FİNİŞ':'DÜZ')}`:'FİNİŞ BÖLGESİ';
  $('course-name').textContent=COURSE.name;$('course-training').textContent=gateLabel;
  const sectionLabel=state.crashed?'':state.courseBoostActive?'↗ İVME BÖLGESİ · +%45':section.cave?`MAĞARA ${String(section.cave.id).padStart(2,'0')} · ${turnHint||'HATTI KORU'}`:turnHint?`GEÇİT ${String(nextGate.index).padStart(2,'0')} · ${turnHint}`:'';
  $('course-event').hidden=!sectionLabel;
  $('course-event').classList.toggle('is-boost',!!state.courseBoostActive);
  if(sectionLabel!==lastSectionLabel){$('course-event').textContent=sectionLabel;lastSectionLabel=sectionLabel;}
  const progress=courseProgress(state);
  $('course-distance').textContent=progress.finished?'PARKUR TAMAMLANDI':`DAĞ PARKURU · ${(progress.distance/1000).toFixed(1).replace('.',',')} / ${(COURSE.length/1000).toFixed(1).replace('.',',')} KM`;
  if(progress.finished&&!courseComplete&&!state.crashed){courseComplete=true;toast(`Parkur tamamlandı! ${diamondField.total} elmas topladın. Yeniden uçmak için R.`,7000);}
  $('diamond-count').textContent=diamondField.total.toLocaleString('tr-TR');
  const input=currentInput();
  const eagle=vehicle==='eagle';
  const airplaneControl=resolveAirplaneControl(input??{angle:90});
  const band=eagle?eagleBand(input?.angle??90,state.flapping):airplaneControl.band;
  if(eagle)$('flap-count').textContent=state.flapCount??0;
  else if($('throttle-value')){
    const percent=Math.round((activeInput()?airplaneControl.throttle:0)*100);
    $('throttle-value').textContent='%'+percent;$('throttle-meter').setAttribute('aria-valuenow',String(percent));$('throttle-fill').style.width=percent+'%';
    $('test-throttle').setAttribute('aria-pressed',String(percent>0));
    $('body-lean').textContent='Öne eğim '+(input?.bodyCalibrated&&Number.isFinite(input?.bodyLean)?Math.max(0,Math.round(input.bodyLean))+'°':'—');
    $('body-calibration-status').textContent=mode==='keyboard'?'Klavye ile deneme':!pose?'Dik duruş bekleniyor':!Number.isFinite(pose.bodyPitch)?'Gövden kadrajda olsun':pose.bodyCalibrated?'Dik duruş ayarlı':'Dik dur, ayarlanıyor…';
    $('calibrate-body').hidden=mode==='keyboard';$('calibrate-body').disabled=cameraStatus!=='tracking';
  }
  $('speed').textContent=Math.round(state.speed);
  $('altitude').textContent=Math.round(state.altitude*3.28084).toLocaleString('tr-TR');
  $('heading').textContent=String(Math.round(state.heading)%360).padStart(3,'0');
  const cardinal=['Kuzey','Kuzeydoğu','Doğu','Güneydoğu','Güney','Güneybatı','Batı','Kuzeybatı'][Math.round(state.heading/45)%8];
  $('heading-label').textContent=cardinal;$('compass-center').textContent=['N','NE','E','SE','S','SW','W','NW'][Math.round(state.heading/45)%8];
  const vs=Math.round(state.verticalSpeed*196.85/10)*10;
  $('vertical').textContent=(vs>0?'+':'')+vs;
  $('vertical-label').textContent=state.flying?(vs>30?'Tırmanış':vs< -30?'Alçalış':'Düz uçuş'):'Pistte';
  const braking=band.id==='descent',stopped=state.speed<.5;
  const forwardDescent=!eagle&&state.flying&&airplaneControl.forwardDescent;
  $('speed-label').textContent=!activeInput()?'Kontrol bekleniyor':eagle?(!state.flying?'Kalkış için kanat çırp':state.launching?'Kanat çırpışıyla kalkış':{flap:'Kanat çırpışı · hızlanma',glide:state.speed>65?'Hızını koruyarak süzülüş':'Yavaş süzülüş',brake:'Kanatlar yukarı · fren',dive:'Hızlı dalış'}[band.id]):forwardDescent?'İleri uçuş & alçalış':airplaneControl.throttling?'Gövde gazı · %'+Math.round(airplaneControl.throttle*100):braking?(stopped?'İleri hareket durdu':'Sert frenleme'):state.speed<36&&!state.flying?((input?.angle??0)>=80?'Kalkış için hızlanıyor':'Pistte bekliyor'):{slow:'Yavaş uçuş',medium:'Seyir hızı',fast:'Hızlı uçuş'}[band.id];
  const minutes=Math.floor(state.time/60),seconds=Math.floor(state.time%60);$('flight-time').textContent=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
  $('left-angle').textContent=input?Math.round(input.leftAngle)+'°':'—';$('right-angle').textContent=input?Math.round(input.rightAngle)+'°':'—';
  let title,subtitle,symbol;
  if(state.crashed){title='Çarpışma';subtitle='Yeniden başla düğmesine bas.';symbol='!';}
  else if(paused||hiddenPause){title='Uçuş duraklatıldı';subtitle='Devam etmek için ▶ düğmesine bas.';symbol='Ⅱ';}
  else if(!activeInput()){title=statusMessages[cameraStatus]||'Kontrol bekleniyor';subtitle=cameraStatus==='lost'?'Takip gelince uçuş devam eder.':cameraStatus==='loading'?'İlk açılış birkaç saniye sürebilir.':eagle?'Kalkış için iki kolunla kanat çırp.':'Kalkış için kollarını kaldır.';symbol='⌁';}
  else if(eagle){title=!state.flying?'Kalkış için kanat çırp':state.launching?'Kalkış · yükseliyorsun':{flap:'Kanat çırparak hızlanıyorsun',glide:'Dengeli süzülüş',brake:'Yavaşlıyorsun',dive:'Hızlı dalış'}[band.id];subtitle=!state.flying?(mode==='keyboard'?'B’ye bas veya Kanat çırp’a tıkla.':'İki kolunu yukarı kaldırıp aşağı çırp.'):state.launching?'İlk çırpışla yerden ayrılıyorsun.':{flap:'Her çırpış hız ve yükselme sağlar.',glide:'90° · İrtifanı koruyorsun.',brake:'Kollar yukarı · Hızın azalıyor.',dive:'Kollar aşağı · İrtifa kaybediyorsun.'}[band.id];symbol=state.launching?'↟':{flap:'↟',glide:'→',brake:'↑',dive:'↓'}[band.id];}
  else if(forwardDescent){title='İlerleyerek alçalıyorsun';subtitle=airplaneControl.throttling?'Alçalış + gövde gazı · %'+Math.round(airplaneControl.throttle*100):'Alçalışı bitirmek için kollarını 90° aç.';symbol='↘';}
  else if(airplaneControl.throttling){title='Motora güç veriyorsun';subtitle=(input?.angle??0)<80&&!state.flying?'Kalkış için kollarını 80° ve üzerine aç.':'Gövde gazı · %'+Math.round(airplaneControl.throttle*100);symbol='↗';}
  else if(braking){title=stopped?'İleri hareket durdu':'Fren & alçalış';subtitle=state.flying?'Alçalıyorsun. Hızlanmak için kollarını aç.':'Kalkış için kollarını tekrar kaldır.';symbol=stopped?'Ⅱ':'↓';}
  else {title=state.flying?{fast:'Hızlı uçuş',medium:'Dengeli uçuş',slow:'Yavaş uçuş'}[band.id]:(input?.angle??0)<80?'Pistte bekliyor':state.speed<36?'Kalkışa hazırlanıyor':'Kalkış';subtitle=mode==='camera'?'Vücudunla kontrol ediyorsun.':'Kol açısını kaydırıcıyla değiştirebilirsin.';symbol=state.flying?'↗':'⌁';}
  $('control-title').textContent=title;$('control-subtitle').textContent=subtitle;$('status-symbol').textContent=symbol;
  document.querySelectorAll('.gesture').forEach(button=>button.classList.toggle('selected',activeInput()&&(eagle?button.dataset.band:speedBand(Number(button.dataset.angle)).id)===band.id));
  $('ground-label').style.opacity=state.altitude<25?'1':'0';
  if(engineGain&&audioContext){const sounding=!eagle&&soundEnabled&&activeInput()&&!paused&&!hiddenPause&&!state.crashed;engineGain.gain.setTargetAtTime(sounding ? .024 : 0,audioContext.currentTime,.15);engineOscillator.frequency.setTargetAtTime(32+state.speed*.55+(state.engineThrottle??0)*30,audioContext.currentTime,.3);}
}
function handleCrash(collision,previous){
  if(state.crashed)return;
  const fraction=clamp(Number.isFinite(collision.fraction)?collision.fraction:1,0,1);
  for(const key of ['x','distance','altitude','time'])state[key]=previous[key]+(state[key]-previous[key])*fraction;
  state.crashed=true;state.crashTime=state.time;state.speed=0;state.verticalSpeed=0;state.courseBoostActive=false;
  keys.clear();manualBank=0;clearTimeout(toastTimer);$('flight-toast').classList.remove('visible');
  $('crash-message').textContent=collision.message;
  $('crash-diamonds').textContent=diamondField.total.toLocaleString('tr-TR');
  $('crash-distance').textContent=(Math.max(0,state.distance)/1000).toFixed(1).replace('.',',')+' km';
  document.body.classList.add('crashed');$('pause').disabled=true;
  $('crash-dialog').showModal();$('restart-flight').focus();updateHud();
}
function setPaused(value){paused=value;if(value)clearFlapGesture();document.body.classList.toggle('paused',paused);$('pause').classList.toggle('is-paused',paused);$('pause').setAttribute('aria-label',paused?'Uçuşa devam et':'Uçuşu duraklat');$('pause').title=paused?'Devam et (Boşluk)':'Duraklat (Boşluk)';$('pause').innerHTML=paused?'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg><span>Devam et</span>':'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg><span>Duraklat</span>';}
function resetFlight(){const view=state.camera;state=vehicle==='eagle'?createEagleState():createFlightState();state.vehicle=vehicle??'airplane';state.camera=view;pendingFlap=false;manualThrottle=0;diamondField=createDiamondField();courseComplete=false;lastSectionLabel='';syncDiamonds();$('diamond-count').textContent='0';$('diamond-announcement').textContent='';$('course-event').hidden=true;document.body.classList.remove('crashed');$('pause').disabled=false;if($('crash-dialog').open)$('crash-dialog').close();setPaused(false);manualBank=0;setManualAngle(90);keys.clear();$('simulator').focus();updateHud();toast('Parkur yeniden başladı. Vadi hattındaki elmasları topla!');}
function toggleView(){state.camera=state.camera==='chase'?'cockpit':'chase';$('view-label').textContent=state.camera==='chase'?'Takip kamerası':'Pilot görünümü';toast(state.camera==='chase'?'Takip kamerası':'Pilot görünümü');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Bu tarayıcı tam ekranı desteklemiyor.');}}
async function toggleSound(){
  try{
    if(!audioContext){audioContext=new(window.AudioContext||window.webkitAudioContext)();engineOscillator=audioContext.createOscillator();engineGain=audioContext.createGain();engineOscillator.type='sawtooth';engineOscillator.frequency.value=32;engineGain.gain.value=0;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=180;engineOscillator.connect(filter);filter.connect(engineGain);engineGain.connect(audioContext.destination);engineOscillator.start();}
    await audioContext.resume();soundEnabled=!soundEnabled;
    $('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');$('sound').title=soundEnabled?'Sesi kapat':'Sesi aç';
    $('sound').innerHTML=soundEnabled?'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 5 6m0-6-5 6"/></svg>';
  }catch{toast('Bu tarayıcıda ses başlatılamadı.');}
}
let helpWasPaused=false;
function openHelp(){helpWasPaused=paused;setPaused(true);$('help-dialog').showModal();}
function closeHelp(){$('help-dialog').close();}
$('help-dialog').addEventListener('close',()=>setPaused(helpWasPaused));
$('start-camera').addEventListener('click',useCamera);$('camera-mode').addEventListener('click',useCamera);
$('camera-toggle').addEventListener('click',()=>{if(cameraStatus==='tracking'||cameraStatus==='lost'||cameraStatus==='loading'){poseController.stop();toast('Kamera kapatıldı.');}else useCamera();});
$('try-keyboard').addEventListener('click',()=>useKeyboard());$('keyboard-mode').addEventListener('click',()=>useKeyboard());
$('manual-angle').addEventListener('input',event=>setManualAngle(event.target.value));
$('gesture-guide').addEventListener('click',event=>{if(event.target.closest('[data-calibrate-body]')){calibrateBody();return;}if(event.target.closest('[data-throttle]')){toggleManualThrottle();return;}const button=event.target.closest('.gesture');if(!button)return;if(button.hasAttribute('data-flap')){requestFlap();return;}if(mode!=='keyboard')useKeyboard(Number(button.dataset.angle));else setManualAngle(button.dataset.angle);});
$('pause').addEventListener('click',()=>setPaused(!paused));$('reset').addEventListener('click',resetFlight);$('view-toggle').addEventListener('click',toggleView);$('fullscreen').addEventListener('click',fullscreen);$('sound').addEventListener('click',toggleSound);
$('help').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);$('help-done').addEventListener('click',closeHelp);
$('restart-flight').addEventListener('click',resetFlight);
$('crash-dialog').addEventListener('cancel',event=>event.preventDefault());
$('choose-mode').addEventListener('click',openVehicleMenu);
document.querySelectorAll('[data-vehicle]').forEach(button=>button.addEventListener('click',()=>selectVehicle(button.dataset.vehicle)));
function cancelVehicleMenu(){if(!vehicle)return;$('vehicle-dialog').close();setPaused(menuWasPaused);}
$('cancel-mode').addEventListener('click',cancelVehicleMenu);
$('vehicle-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelVehicleMenu();});
window.addEventListener('keydown',event=>{
  if($('vehicle-dialog').open){if(event.key==='1'||event.key==='2'){event.preventDefault();selectVehicle(event.key==='2'?'eagle':'airplane');}return;}
  if(state.crashed){if(event.key.toLowerCase()==='r'){event.preventDefault();resetFlight();}return;}
  if(event.key.toLowerCase()==='g'&&vehicle==='airplane'&&!$('help-dialog').open&&!event.target.matches('textarea,input:not([type="range"])')){event.preventDefault();if(!paused&&!hiddenPause){if(mode!=='keyboard')useKeyboard();keys.add('g');}return;}
  if(event.key.toLowerCase()==='b'&&vehicle==='eagle'&&!$('help-dialog').open&&!event.target.matches('textarea,input:not([type="range"])')){event.preventDefault();if(!event.repeat)requestFlap();return;}
  if($('help-dialog').open||event.target.matches('input,textarea,select'))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();
  if(event.repeat){keys.add(event.key.toLowerCase());return;}
  const key=event.key.toLowerCase();keys.add(key);
  if(key===' ')setPaused(!paused);if(key==='r')resetFlight();if(key==='c')toggleView();if(key==='f')fullscreen();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d'].includes(key)&&mode!=='keyboard')useKeyboard();
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{hiddenPause=document.hidden;if(hiddenPause)clearFlapGesture();keys.clear();lastTime=performance.now();});
window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;
  if(mode==='keyboard'&&!paused&&!hiddenPause&&!state.crashed){
    if(keys.has('arrowup')||keys.has('w'))setManualAngle(manualAngle+dt*45);
    if(keys.has('arrowdown')||keys.has('s'))setManualAngle(manualAngle-dt*45);
    manualBank=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);
  }
  const input=currentInput()??{angle:0,bank:0};
  const courseSection=getCourseSection(state);
  const previous=activeInput()&&!paused&&!hiddenPause&&!state.crashed?{...state}:null;
  const step=vehicle==='eagle'?stepEagle:stepFlight;
  step(state,{...input,flap:pendingFlap,boost:courseSection.boost?.multiplier??1,active:activeInput(),paused:paused||hiddenPause},dt);pendingFlap=false;
  if(previous){const collision=detectCollision(previous,state);if(collision)handleCrash(collision,previous);}
  state.inCave=!!getCourseSection(state).cave;
  const pickedUp=updateDiamondField(diamondField,state,{active:activeInput()&&!state.crashed,paused:paused||hiddenPause||state.crashed});
  syncDiamonds();
  if(pickedUp.length){
    $('diamond-count').textContent=diamondField.total.toLocaleString('tr-TR');
    $('diamond-announcement').textContent=`${pickedUp.length} elmas toplandı. Toplam ${diamondField.total} elmas.`;
    $('diamond-pickup').textContent='+'+pickedUp.length;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      $('diamond-score').animate([{transform:'scale(1)'},{transform:'scale(1.1)'},{transform:'scale(1)'}],{duration:350});
      $('diamond-pickup').animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(-7px)',offset:.3},{opacity:0,transform:'translateY(-26px)'}],{duration:850});
    }
  }
  scene?.update(state,dt);hudElapsed+=dt;if(hudElapsed>=.1){updateHud();hudElapsed=0;}raf=requestAnimationFrame(frame);
}
try{scene=createFlightScene($('world'));raf=requestAnimationFrame(frame);}catch(error){console.error('Unable to initialize 3D scene',error);$('fatal-error').hidden=false;}
selectVehicle('airplane');
$('choose-mode').hidden=true;
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();audioContext?.close();});
// Read-only telemetry is useful when testing angle thresholds and tracking loss.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,paused,cameraStatus,manualAngle,active:activeInput()})})});
