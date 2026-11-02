import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {PoseController} from './pose.js';
import {createCombatScene} from './combat-scene.js';
import {ClapDetector,TargetLock,selectNearestTarget,canFire,advanceMissile,destroyTarget} from './combat.js';

const $=id=>document.getElementById(id);
let state=createFlightState();
let game,scene,mode='camera',started=false,paused=false,pose=null,cameraStatus='off';
let manualAngle=90,lastTime=performance.now(),raf,toastTimer,flashTimer,lastOpenInput=null;
let pendingFire=false,cameraOperation=0,serial=0,spawnSerial=0,hudElapsed=0;
const keys=new Set(),clap=new ClapDetector(),lock=new TargetLock();
const dialogs=[$('help-dialog'),$('memory-dialog'),$('crash-dialog')];
const modalOpen=()=>dialogs.some(d=>d.open);
const tracking=()=>mode==='keyboard'||(cameraStatus==='tracking'&&pose!==null);
const active=()=>started&&tracking()&&!paused&&!document.hidden&&!state.crashed&&!modalOpen();
const origin=()=>({x:state.x,y:state.altitude+2.15,z:-state.distance});
const radians=n=>n*Math.PI/180;
let audio,engine,engineGain,soundEnabled=false;

function toast(message,duration=3100){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function spawnTarget(target,initial=false){
  const index=target.id-1,h=radians(state.heading);
  const offsets=initial?[0,-95,130,-170,85,230]:[0,-70,85,-35,110,0];
  const lateral=offsets[initial?index:(spawnSerial++)%6],range=initial?460+index*155:480+(index%3)*110;
  const y=initial?55+[0,15,8,40,50,25][index]:clamp(state.altitude+8+((index%3)-1)*18,40,1050);
  Object.assign(target,{alive:true,incoming:false,respawnAt:0,heading:h+(index===0?0:Math.sin(index)*.08),speed:27+index*1.9,
    baseX:state.x+Math.sin(h)*range+Math.cos(h)*lateral,baseY:y,z:-state.distance-Math.cos(h)*range+Math.sin(h)*lateral,
    phase:index*1.7,amplitude:index===0?2.5:9+index*3,age:0});
  target.x=target.baseX;target.y=y;
}
function newGame(){
  game={targets:Array.from({length:6},(_,i)=>({id:i+1})),missiles:[],bursts:[],destroyed:0,shots:0,locked:false,lockId:null,lastShot:-Infinity};
  spawnSerial=0;game.targets.forEach(t=>spawnTarget(t,true));lock.clear();clap.reset();pendingFire=false;lastOpenInput=null;
}
function resetFlight(){
  const view=state.camera;state=createFlightState();state.camera=view;paused=false;keys.clear();manualAngle=90;
  $('manual-angle').value=90;newGame();$('crash-dialog').close();$('pause-overlay').hidden=true;$('pause').innerHTML='<span>Ⅱ</span> <b>Duraklat</b>';
  clearTimeout(flashTimer);$('hit-flash').classList.remove('active');lastTime=performance.now();
  scene?.prepare(state,0);updateHud();toast('Yeni uçuş. Kollarını aç, KAAN ile havalan.');
}
function currentInput(){
  if(mode==='camera')return pose;
  return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,
    bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),
    bodyThrottle:keys.has('g')?1:0,bodyLean:keys.has('g')?30:0,bodyCalibrated:true};
}
function begin(){started=true;document.body.classList.add('playing');$('intro').classList.add('dismissed');}
function refreshMode(){
  const keyboard=mode==='keyboard';$('keyboard-panel').hidden=!keyboard;
  for(const m of['keyboard','camera']){$(m+'-mode').classList.toggle('active',mode===m);$(m+'-mode').setAttribute('aria-pressed',String(mode===m));}
  $('camera-placeholder').hidden=!!$('camera-video').srcObject;
  $('camera-message').textContent=keyboard?'Klavye kontrolü aktif.':cameraStatus==='loading'?'Kamera ve model hazırlanıyor…':cameraStatus==='error'?'Kamera açılamadı. Klavyeyle deneyebilirsin.':'Kollarını aç. Kontrolü devral.';
  $('calibrate-body').disabled=keyboard||cameraStatus!=='tracking';
  $('calibrate-mobile').disabled=keyboard||cameraStatus!=='tracking';
}
function useKeyboard(){
  cameraOperation++;poseController.stop();$('start-camera').disabled=false;pose=null;clap.reset();mode='keyboard';cameraStatus='off';keys.clear();begin();refreshMode();
  toast('↑ ↓ kol · ← → dönüş · G gaz · Yeşil kilitte E ile dürüm fırlat',4300);
}
async function useCamera(){
  if(cameraStatus==='loading')return;
  const operation=++cameraOperation;mode='camera';keys.clear();pose=null;clap.reset();cameraStatus='loading';refreshMode();
  $('start-camera').disabled=true;
  try{if(await poseController.start()){if(operation===cameraOperation){begin();toast('Kısa süre dik dur. Ardından kollarını kanat gibi aç.',4500);}}}
  finally{if(operation===cameraOperation)$('start-camera').disabled=false;}
}
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),
  onPose(value){
    if(!value){pose=null;clap.reset();lock.clear();lastOpenInput=null;return;}
    const gesture=clap.update(value.landmarks,performance.now()/1000,($('camera-video').videoWidth||1)/($('camera-video').videoHeight||1));
    if(gesture.holding&&lastOpenInput){
      pose={...value,angle:lastOpenInput.angle,leftAngle:lastOpenInput.leftAngle,rightAngle:lastOpenInput.rightAngle,closed:lastOpenInput.closed,bank:lastOpenInput.bank};
    }else{pose=value;if(!value.closed)lastOpenInput={...value};}
    if(gesture.clap){$('clap-indicator').textContent='✦ ALKIŞ ALGILANDI';if(active())pendingFire=true;}
    else $('clap-indicator').textContent=gesture.holding?'✦ ELLERİNİ AÇ':'✦ ALKIŞ HAZIR';
  },
  onStatus(status){
    cameraStatus=status.state;$('camera-dot').classList.toggle('tracking',status.state==='tracking');$('tracking-badge').hidden=status.state!=='tracking';
    if(status.state==='lost'||status.state==='off'||status.state==='error'){lock.clear();clap.reset();pendingFire=false;}
    if(status.state==='error')toast(status.message,6500);
    refreshMode();
  }
});

function setPaused(value){paused=value;keys.clear();pendingFire=false;lock.clear();clap.reset();$('pause-overlay').hidden=!paused;$('pause').innerHTML=paused?'<span>▶</span> <b>Devam et</b>':'<span>Ⅱ</span> <b>Duraklat</b>';lastTime=performance.now();updateHud();}
function openDialog(id){keys.clear();clap.reset();pendingFire=false;lock.clear();if(id==='memory-dialog')$('memory-score').textContent=`KAAN ile ${Math.round(state.travelled).toLocaleString('tr-TR')} metre uçuş · ${game.destroyed} uçak imha edildi.`;$(id).showModal();}
function crash(message){state.crashed=true;state.crashTime=state.time;lock.clear();clap.reset();keys.clear();$('crash-score').textContent=String(game.destroyed).padStart(2,'0');$('crash-message').textContent=message;$('crash-dialog').showModal();tone('crash');}
function shoot(){
  const target=game.targets.find(t=>t.id===lock.id);
  if(!canFire({active:active()&&state.flying,locked:lock.locked,target,time:state.time,lastShot:game.lastShot})){
    if(active())toast(!state.flying?'Önce havalan. Kollarını yana aç.':'En yakın uçağı merkeze getir; yeşil kilidi bekle.',1800);return;
  }
  const h=radians(state.heading),side=game.shots%2?1:-1;
  game.missiles.push({id:++serial,targetId:target.id,x:state.x+Math.cos(h)*side*4+Math.sin(h)*8,y:state.altitude+1,z:-state.distance+Math.sin(h)*side*4-Math.cos(h)*8,age:0});
  target.incoming=true;game.lastShot=state.time;game.shots++;lock.clear();game.locked=false;tone('launch');
  toast('Dürüm yolda. Afiyet olsun! ↗',1600);
}
function stepCombat(dt){
  for(const target of game.targets){
    if(!target.alive){if(state.time>=target.respawnAt)spawnTarget(target);continue;}
    target.age+=dt;target.baseX+=Math.sin(target.heading)*target.speed*dt;target.z-=Math.cos(target.heading)*target.speed*dt;
    target.x=target.baseX+Math.sin(target.phase+target.age*.42)*target.amplitude;
    target.y=target.baseY+Math.sin(target.phase+target.age*.32)*3;
    target.bank=Math.cos(target.phase+target.age*.42)*.11;
    const p=origin(),distance=Math.hypot(target.x-p.x,target.y-p.y,target.z-p.z);
    const ahead=(target.x-p.x)*Math.sin(radians(state.heading))-(target.z-p.z)*Math.cos(radians(state.heading));
    if(!target.incoming&&(distance>1700||ahead< -110)){spawnTarget(target);continue;}
    if(state.flying&&distance<10&&!target.incoming){crash('Bir savaş uçağına temas ettin. Yeni bir uçuşla tekrar dene.');return;}
  }
  game.missiles=game.missiles.filter(missile=>{
    const target=game.targets.find(t=>t.id===missile.targetId);missile.age+=dt;
    const result=advanceMissile(missile,target,dt);
    if(result==='hit'&&destroyTarget(target,game)){
      target.respawnAt=state.time+3.5;game.bursts.push({id:++serial,x:target.x,y:target.y,z:target.z,age:0});
      toast(`TAM İSABET · ${game.destroyed} uçak imha edildi`,2300);tone('hit');
      $('hit-flash').classList.add('active');clearTimeout(flashTimer);flashTimer=setTimeout(()=>$('hit-flash').classList.remove('active'),350);
    }
    const expired=missile.age>8;
    if(expired&&target?.alive)target.incoming=false;
    return result==='flying'&&!expired;
  });
  game.bursts.forEach(b=>b.age+=dt);game.bursts=game.bursts.filter(b=>b.age<1.8);
}
function updateTarget(dt){
  const nearest=selectNearestTarget(game.targets,origin());
  const projected=nearest?scene.project(nearest.target):null;
  const wasLocked=lock.locked;
  lock.update(nearest?.target,projected,dt,active()&&state.flying);
  game.locked=lock.locked;game.lockId=lock.id;
  document.body.classList.toggle('locked',game.locked);
  const box=$('target-box');
  const visible=projected&&projected.z> -1&&projected.z<1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1;
  box.hidden=!started||!visible||!active();
  if(visible){
    box.style.left=(projected.x*.5+.5)*100+'%';box.style.top=(-projected.y*.5+.5)*100+'%';
    const size=clamp(15000/Math.max(40,nearest.distance),38,155);box.style.width=size+'px';box.style.height=size*.65+'px';
    $('target-name').textContent=`HEDEF ${String(nearest.target.id).padStart(2,'0')}`;
    $('target-range').textContent=`${Math.round(nearest.distance)} M`;
  }
  if(lock.locked&&!wasLocked)tone('lock');
  const cooldown=state.time-game.lastShot<.9;
  $('fire').disabled=!game.locked||!active()||cooldown;
  $('weapon-state').innerHTML=cooldown?'<i></i> YENİ DÜRÜM HAZIRLANIYOR':'<i></i> SINIRSIZ LEZZET';
  $('lock-text').textContent=!started?'HEDEF ARANIYOR':!tracking()?'PİLOT BEKLENİYOR':paused||modalOpen()?'UÇUŞ BEKLEMEDE':!state.flying?'KALKIŞ İÇİN KOLLARINI AÇ':game.locked?'HEDEF KİLİTLENDİ':nearest?'EN YAKIN HEDEF':'GÖKYÜZÜ TARANIYOR';
  $('lock-detail').textContent=game.locked?'Alkışla · Dürümü gönder':!state.flying?'Kollarını en az 80° yana aç':nearest?`${Math.round(nearest.distance)} m · ${visible?'Uçağı merkeze getir':projected?.x<0?'Sola dön, hedefi bul':'Sağa dön, hedefi bul'}`:'Yeni uçaklar yaklaşıyor';
}

function updateHud(){
  const input=currentInput(),control=resolveAirplaneControl(input??{angle:90});
  $('speed').textContent=String(Math.round(state.speed)).padStart(3,'0');$('altitude').textContent=String(Math.round(state.altitude)).padStart(3,'0');
  $('vertical').textContent=(state.verticalSpeed>0?'+':'')+state.verticalSpeed.toFixed(1);
  const directions=['K','KD','D','GD','G','GB','B','KB'];$('heading').textContent=String(Math.round(state.heading)%360).padStart(3,'0')+'° '+directions[Math.round(state.heading/45)%8];
  $('destroyed').textContent=String(game.destroyed).padStart(2,'0');$('shot-count').textContent=game.shots+' ATIŞ';
  $('flight-time').textContent=String(Math.floor(state.time/60)).padStart(2,'0')+':'+String(Math.floor(state.time%60)).padStart(2,'0');
  $('left-angle').textContent=input?Math.round(input.leftAngle)+'°':'—';$('right-angle').textContent=input?Math.round(input.rightAngle)+'°':'—';
  const percent=Math.round((active()?control.throttle:0)*100);$('throttle-value').textContent='%'+percent;$('throttle-fill').style.width=percent+'%';$('throttle-meter').setAttribute('aria-valuenow',String(percent));
  $('body-lean').textContent='Öne eğim '+(input?.bodyCalibrated&&Number.isFinite(input?.bodyLean)?Math.max(0,Math.round(input.bodyLean))+'°':'—');
  $('body-calibration').textContent=mode==='keyboard'?'G tuşu ile gaz':pose?.bodyCalibrated?'Dik duruş ayarlı':pose?'Dik dur, ayarlanıyor…':'Dik duruş bekleniyor';
  $('mobile-throttle').textContent=`GAZ %${percent} · ${input?.bodyCalibrated&&Number.isFinite(input.bodyLean)?'ÖNE EĞİM '+Math.max(0,Math.round(input.bodyLean))+'°':'DİK DURUŞ BEKLENİYOR'}`;
  $('manual-angle-label').textContent=Math.round(manualAngle)+'°';
  $('control-dot').classList.toggle('live',active());
  $('control-title').textContent=state.crashed?'Uçuş sona erdi':paused?'Uçuş duraklatıldı':!started?'Pistte hazır':!tracking()?'Vücut takibi bekleniyor':!state.flying?'Kalkış yapılıyor':mode==='keyboard'?'Klavye kontrolü aktif':'Pilot takibi aktif';
  $('control-subtitle').textContent=!tracking()&&started?'Kolların ve kalçan kadrajda olsun.':control.throttling?'Gövde gazı · %'+percent:state.flying?'Hedefle. Alkışla. İmha et.':'Kollarını yana aç, havalan.';
  $('view-label').textContent=state.camera==='chase'?'Takip kamerası':'Pilot kamerası';
  if(engineGain){const gain=soundEnabled&&active()?(.008+state.speed*.00016):0;engineGain.gain.setTargetAtTime(gain,audio.currentTime,.12);engine.frequency.setTargetAtTime(38+state.speed*.22,audio.currentTime,.15);}
}

async function toggleSound(){
  if(!audio){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){toast('Bu tarayıcı ses sistemini desteklemiyor.');return;}
    audio=new Audio();engine=audio.createOscillator();engine.type='sawtooth';engineGain=audio.createGain();engineGain.gain.value=0;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;engine.connect(filter);filter.connect(engineGain);engineGain.connect(audio.destination);engine.start();
  }
  try{await audio.resume();soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').textContent=soundEnabled?'♫':'♪';$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');$('sound').title=soundEnabled?'Sesi kapat':'Sesi aç';updateHud();}catch{toast('Ses başlatılamadı.');}
}
function tone(type){
  if(!soundEnabled||!audio)return;
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.connect(g);g.connect(audio.destination);
  const config={lock:[780,1050,.1,.035],launch:[180,75,.28,.08],hit:[110,32,.55,.14],crash:[80,24,.65,.12]}[type];
  o.type=type==='lock'?'sine':'triangle';o.frequency.setValueAtTime(config[0],t);o.frequency.exponentialRampToValueAtTime(config[1],t+config[2]);g.gain.setValueAtTime(config[3],t);g.gain.exponentialRampToValueAtTime(.001,t+config[2]);o.start(t);o.stop(t+config[2]);o.onended=()=>{o.disconnect();g.disconnect();};
}
function setAngle(value){manualAngle=clamp(Number(value),0,180);$('manual-angle').value=manualAngle;}
function toggleView(){state.camera=state.camera==='chase'?'cockpit':'chase';scene?.prepare(state,0);lock.clear();updateHud();}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Tam ekran kullanılamıyor. Tarayıcıda F11 ile deneyebilirsin.');}}
$('start-camera').addEventListener('click',useCamera);$('camera-mode').addEventListener('click',useCamera);
$('try-keyboard').addEventListener('click',useKeyboard);$('keyboard-mode').addEventListener('click',useKeyboard);
$('camera-toggle').addEventListener('click',()=>{if(['tracking','loading','lost'].includes(cameraStatus)){cameraOperation++;poseController.stop();$('start-camera').disabled=false;pose=null;}else useCamera();});
$('manual-angle').addEventListener('input',e=>setAngle(e.target.value));
$('calibrate-body').addEventListener('click',()=>{poseController.resetBodyCalibration();toast('Kısa süre dik dur. Normal duruşun yeniden ayarlanıyor.');});
$('calibrate-mobile').addEventListener('click',()=>{poseController.resetBodyCalibration();toast('Kısa süre dik dur. Normal duruşun yeniden ayarlanıyor.');});
$('pause').addEventListener('click',()=>setPaused(!paused));$('resume').addEventListener('click',()=>setPaused(false));
$('reset').addEventListener('click',resetFlight);$('restart-flight').addEventListener('click',resetFlight);
$('view-toggle').addEventListener('click',toggleView);$('fullscreen').addEventListener('click',fullscreen);$('sound').addEventListener('click',toggleSound);
$('help').addEventListener('click',()=>openDialog('help-dialog'));$('memory').addEventListener('click',()=>openDialog('memory-dialog'));
$('fire').addEventListener('click',()=>{if(active())pendingFire=true;});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
dialogs.forEach(d=>d.addEventListener('close',()=>{lastTime=performance.now();clap.reset();}));
$('crash-dialog').addEventListener('cancel',e=>e.preventDefault());
$('guide-toggle').addEventListener('click',()=>{const expanded=$('guide-body').hidden;$('guide-body').hidden=!expanded;$('guide-toggle').textContent=expanded?'−':'+';$('guide-toggle').setAttribute('aria-expanded',String(expanded));});
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(['textarea','select'].includes(e.target.tagName)||(e.target.tagName==='INPUT'&&e.target.type!=='range'))return;
  if(e.target.type==='range'&&key.startsWith('arrow'))return;
  if(key==='r'&&$('crash-dialog').open){e.preventDefault();resetFlight();return;}
  if(modalOpen())return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(e.repeat&&!['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d','g'].includes(key))return;
  if(key===' '){setPaused(!paused);return;}
  if(key==='r'){resetFlight();return;}if(key==='c'){toggleView();return;}if(key==='f'){fullscreen();return;}
  if(key==='e'){if(active())pendingFire=true;return;}
  if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d','g'].includes(key)){
    if(mode!=='keyboard')useKeyboard();keys.add(key);
  }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();pendingFire=false;clap.reset();if(engineGain)engineGain.gain.setTargetAtTime(0,audio.currentTime,.05);});
document.addEventListener('visibilitychange',()=>{keys.clear();pendingFire=false;clap.reset();lock.clear();lastTime=performance.now();if(document.hidden&&engineGain)engineGain.gain.setTargetAtTime(0,audio.currentTime,.05);});
window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.max(0,Math.min((now-lastTime)/1000,.1));lastTime=now;
  if(active()){
    if(mode==='keyboard'){
      if(keys.has('arrowup')||keys.has('w'))setAngle(manualAngle+45*dt);
      if(keys.has('arrowdown')||keys.has('s'))setAngle(manualAngle-45*dt);
    }
    const previous={...state};
    stepFlight(state,{...currentInput(),active:true},dt);
    if(previous.flying&&!state.flying&&previous.verticalSpeed< -3)crash('Yere sert temas ettin. Alçalırken kollarını tekrar yana açarak dengelen.');
    if(!state.crashed)stepCombat(dt);
  }
  scene.prepare(state,active()?dt:0);updateTarget(dt);
  if(pendingFire){pendingFire=false;shoot();}
  scene.render(state,game);
  hudElapsed+=dt;if(hudElapsed>=.08){updateHud();hudElapsed=0;}
  raf=requestAnimationFrame(frame);
}
newGame();
try{scene=createCombatScene($('world'));scene.prepare(state,0);updateHud();refreshMode();raf=requestAnimationFrame(frame);}
catch(error){console.error('KAAN scene initialization failed',error);$('fatal-error').hidden=false;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();audio?.close();});
// Read-only local telemetry supports diagnosis without camera frames or landmarks.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,paused,cameraStatus,manualAngle,active:active(),destroyed:game.destroyed,shots:game.shots,locked:game.locked,lockId:game.lockId,missiles:game.missiles.length,targets:game.targets.map(({id,x,y,z,alive,incoming})=>({id,x,y,z,alive,incoming}))})})});
