import {createFlightScene} from './scene.js';
import {PoseController} from './pose.js';
import {createFlightState,stepFlight,resolveAirplaneControl,clamp} from './flight.js';
import {createAdventure,updateAdventure,stepFall,AIRCRAFT,RULES} from './ocean-game.js';

const $=id=>document.getElementById(id);
let state=createFlightState(),game=createAdventure(),started=false,mode='keyboard',paused=false,hiddenPause=document.hidden;
let pose=null,cameraStatus='off',manualAngle=90,scene,raf,lastTime=performance.now(),hudTime=0,toastTimer;
let soundEnabled=false,audioContext,engineOscillator,engineGain,helpWasPaused=false;
const keys=new Set();
function toast(text,duration=3500){$('toast').textContent=text;$('announcement').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function angle(value){manualAngle=clamp(Number(value),0,180);$('manual-angle').value=manualAngle;$('manual-angle-label').textContent=Math.round(manualAngle)+'°';}
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),
  onPose(value){pose=value;if(value&&mode==='camera'&&!started)begin();},
  onStatus(status){cameraStatus=status.state;$('camera-message').textContent=status.message;$('camera-dot').classList.toggle('tracking',status.state==='tracking');$('camera-placeholder').hidden=status.state==='tracking'||(status.state==='lost'&&!!$('camera-video').srcObject);$('camera-toggle').setAttribute('aria-label',['tracking','lost','loading'].includes(status.state)?'Kamerayı kapat':'Kamerayı aç');$('calibrate-body').disabled=status.state!=='tracking';if(status.state==='error')toast(status.message,6500);}
});
function input(){return mode==='camera'?pose:{angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,closed:manualAngle<25,bank:(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),bodyThrottle:keys.has('g')?1:0,bodyCalibrated:true};}
function active(){return started&&(mode==='keyboard'||(cameraStatus==='tracking'&&!!pose));}
function begin(){started=true;document.body.classList.add('flying');refreshMode();}
function refreshMode(){$('keyboard-panel').hidden=mode!=='keyboard';$('camera-mode').setAttribute('aria-pressed',String(mode==='camera'));$('keyboard-mode').setAttribute('aria-pressed',String(mode==='keyboard'));$('calibrate-body').hidden=mode!=='camera';}
function keyboard(){keys.clear();mode='keyboard';poseController.stop();begin();refreshMode();toast('Kolların 90°: dengeli kalkış. ↑ ↓ kol açısı · ← → yön · G gaz');}
async function camera(){
  keys.clear();mode='camera';refreshMode();$('start-camera').disabled=true;
  try{const okay=await poseController.start();if(okay)begin();}finally{$('start-camera').disabled=false;}
}
function setPaused(value){paused=!!value;keys.clear();$('paused-overlay').hidden=!paused||$('help-dialog').open||!started||game.lost||game.finished;$('pause-icon').textContent=paused?'▷':'Ⅱ';$('pause-text').textContent=paused?'Devam et':'Duraklat';$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'Devam et':'Duraklat');lastTime=performance.now();}
function reset(){
  const cameraView=state.camera;state=createFlightState();state.camera=cameraView;game=createAdventure();angle(90);keys.clear();$('result-dialog').close();$('help-dialog').close();document.body.classList.remove('upgrade');$('toast').classList.remove('visible');setPaused(false);updateHud();if(started)toast('Yeni uçuş. 100 can, yeni bir macera.');
}
function toggleView(){state.camera=state.camera==='chase'?'cockpit':'chase';$('view-label').textContent=state.camera==='chase'?'Takip kamerası':'Pilot kamerası';}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Bu tarayıcıda tam ekran açılamadı.');}}
function result(won=false){
  keys.clear();$('result-title').textContent=won?'Okyanus senin!':'Bir uçuş daha?';$('result-eyebrow').textContent=won?'PARKUR TAMAMLANDI':'UÇUŞ SONA ERDİ';$('result-icon').textContent=won?'✧':'↘';$('result-message').textContent=won?'8 kilometrelik okyanus parkurunu tamamladın. Kanatlarına sağlık!':game.reason;
  $('result-coins').textContent=game.coinCount;$('result-distance').textContent=Math.round(Math.max(0,state.distance)).toLocaleString('tr-TR');$('result-plane').textContent=AIRCRAFT[game.stage].name;$('result-dialog').showModal();
}
function sound(){
  if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();engineOscillator=audioContext.createOscillator();engineGain=audioContext.createGain();engineOscillator.type='sawtooth';engineOscillator.frequency.value=40;engineGain.gain.value=0;engineOscillator.connect(engineGain);engineGain.connect(audioContext.destination);engineOscillator.start();}
  audioContext.resume();soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Motor sesini kapat':'Motor sesini aç');$('sound').style.color=soundEnabled?'#ebcc8c':'';
}
function handleEvents(events){for(const event of events){
  if(event.type==='coin'){$('coin-pop').animate([{opacity:0,transform:'translateY(0)'},{opacity:1,transform:'translateY(-8px)',offset:.3},{opacity:0,transform:'translateY(-25px)'}],{duration:700});$('announcement').textContent=`Altın toplandı. Toplam ${event.count} altın.`;}
  if(event.type==='upgrade'){toast(`${event.stage===1?'4':'8'} altın! ${AIRCRAFT[event.stage].name} ile uçuyorsun.`,5000);document.body.classList.remove('upgrade');void document.body.offsetWidth;document.body.classList.add('upgrade');}
  if(event.type==='cloud'){$('damage-flash').classList.remove('hit');void $('damage-flash').offsetWidth;$('damage-flash').classList.add('hit');toast(`Bulut teması! −10 can · Kalan can: ${event.health}`,2000);}
  if(event.type==='bird')toast(`Kuşa çarptın! Yönün ${event.turn>0?'sağa':'sola'} değişti. Kanatlarınla dengele.`,3500);
  if(event.type==='fall')toast('Uçak düşüyor…',6000);
  if(event.type==='finish')result(true);
}}
function updateHud(){
  const current=input(),control=resolveAirplaneControl(current??{angle:90}),waiting=!active();
  $('health').textContent=game.health;$('health-fill').style.width=game.health+'%';$('health-fill').style.background=game.health<=30?'#ec947d':'#8cdec2';$('health-track').setAttribute('aria-valuenow',String(game.health));$('health-label').textContent=game.health>60?'Her şey yolunda':game.health>30?'Bulutlara dikkat':game.health>0?'Kritik can!':'Uçuş gücü tükendi';
  $('coin-count').innerHTML=game.coinCount+'<small> / 8</small>';$('upgrade-label').textContent=game.stage===2?'F-16 açıldı · Uçmaya devam!':`Sıradaki uçak için ${(game.stage===0?4:8)-game.coinCount} altın`;$('fleet-fill').style.width=Math.min(100,game.coinCount/8*100)+'%';
  document.querySelectorAll('.aircraft-card').forEach((card,i)=>{card.classList.toggle('active',i===game.stage);card.classList.toggle('locked',i>game.stage);card.querySelector('.card-status').textContent=i===game.stage?(started?'UÇUŞTA':'UÇUŞA HAZIR'):i<game.stage?'AÇILDI':'KİLİTLİ';});
  $('speed').textContent=Math.round(state.speed);$('altitude').textContent=Math.max(0,Math.round(state.altitude));$('heading').textContent=String(Math.round(state.heading)%360).padStart(3,'0');$('flight-time').textContent=String(Math.floor(state.time/60)).padStart(2,'0')+':'+String(Math.floor(state.time%60)).padStart(2,'0');$('route-distance').textContent=`${(Math.max(0,state.distance)/1000).toFixed(2).replace('.',',')} / ${(RULES.length/1000).toFixed(2).replace('.',',')} KM`;
  $('left-angle').textContent=current?Math.round(current.leftAngle??current.angle)+'°':'—';$('right-angle').textContent=current?Math.round(current.rightAngle??current.angle)+'°':'—';
  const throttle=waiting?0:Math.round(control.throttle*100);$('throttle-value').textContent='%'+throttle;$('throttle-fill').style.width=throttle+'%';$('body-lean').textContent=mode==='keyboard'?'GÖVDE GAZI · G':current?.bodyCalibrated?'ÖNE EĞİM '+Math.round(Math.max(0,current.bodyLean??0))+'°':'DİK DUR, AYARLANIYOR';
  let title='Gökyüzü seni bekliyor',subtitle='Uçuş için kamera veya klavye seç.',symbol='⌁';
  if(game.lost){title='Uçuş sona erdi';subtitle='Yeni bir macera için yeniden başla.';symbol='↘';}
  else if(game.finished){title='Parkur tamamlandı';subtitle='8 km okyanus macerası tamamlandı.';symbol='✧';}
  else if(game.falling){title='Uçak düşüyor';subtitle='Can tükendi. Okyanusa alçalıyorsun.';symbol='↘';}
  else if(paused||hiddenPause){title='Uçuş duraklatıldı';subtitle='Devam etmek için boşluk tuşuna bas.';symbol='Ⅱ';}
  else if(waiting&&started){title=cameraStatus==='loading'?'Kamera hazırlanıyor':'Vücut takibi bekleniyor';subtitle='Kolların ve kalçan kadrajda görünsün.';}
  else if(started){
    symbol=control.forwardDescent?'↘':control.attitudeBand.id==='descent'?'↓':control.attitudeBand.id==='fast'?'↗':'→';
    title=!state.flying?'Adadan kalkış':control.forwardDescent?'İlerleyerek alçalıyorsun':control.attitudeBand.id==='descent'?'Fren ve alçalış':control.throttling?'Gövde gazı aktif':control.attitudeBand.id==='fast'?'Yükseliyorsun':'Dengeli uçuş';
    subtitle=mode==='camera'?'Kolların kanatların. Öne eğilerek gaz ver.':`${Math.round(manualAngle)}° kol açısı · ${Math.round(state.verticalSpeed*10)/10} m/sn dikey hız`;
  }
  $('control-title').textContent=title;$('control-subtitle').textContent=subtitle;$('control-symbol').textContent=symbol;$('session-label').textContent=game.lost?'UÇUŞ SONA ERDİ':game.finished?'PARKUR TAMAM':paused?'DURAKLATILDI':!started?'UÇUŞA HAZIR':waiting?'TAKİP BEKLENİYOR':game.falling?'ACİL DURUM':'UÇUŞ AKTİF';
  $('tracking-overlay').hidden=!(started&&mode==='camera'&&waiting&&!paused&&!game.lost&&!game.finished&&!$('help-dialog').open);
  $('tracking-title').textContent=cameraStatus==='error'?'Kamera açılamadı':cameraStatus==='loading'?'Kamera hazırlanıyor':'Vücut takibi bekleniyor';
  $('tracking-description').textContent=cameraStatus==='error'?$('camera-message').textContent:cameraStatus==='loading'?'Kamera ve yerel vücut takip modeli yükleniyor.':'Kolların ve kalçan kadrajda görünsün. Takip gelince uçuş devam edecek.';
  $('retry-camera').hidden=!['error','off'].includes(cameraStatus);
  if(engineGain&&audioContext){const on=soundEnabled&&active()&&!paused&&!hiddenPause&&!game.lost&&!game.finished;engineGain.gain.setTargetAtTime(on?.012:0,audioContext.currentTime,.12);engineOscillator.frequency.setTargetAtTime((game.stage===2?65:game.stage===1?45:25)+state.speed*.5+throttle*.2,audioContext.currentTime,.2);}
}
$('start-keyboard').onclick=keyboard;$('keyboard-mode').onclick=keyboard;$('tracking-keyboard').onclick=keyboard;$('start-camera').onclick=camera;$('camera-mode').onclick=camera;
$('retry-camera').onclick=camera;
$('camera-toggle').onclick=()=>{if(mode==='camera'&&['tracking','lost','loading'].includes(cameraStatus)){poseController.stop();mode='camera';}else camera();};
$('manual-angle').oninput=e=>angle(e.target.value);document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>angle(b.dataset.angle));
$('calibrate-body').onclick=()=>{poseController.resetBodyCalibration();if(pose)pose={...pose,bodyThrottle:0,bodyCalibrated:false};toast('Dik dur. Normal duruşun yeniden ayarlanıyor.');};
$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);$('reset').onclick=reset;$('restart-flight').onclick=reset;$('sound').onclick=sound;$('view-toggle').onclick=toggleView;$('fullscreen').onclick=fullscreen;
$('help').onclick=()=>{helpWasPaused=paused;$('help-dialog').showModal();setPaused(true);};
function closeHelp(){$('help-dialog').close();setPaused(helpWasPaused);} $('close-help').onclick=closeHelp;$('help-done').onclick=closeHelp;
$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});$('result-dialog').addEventListener('cancel',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(e.target instanceof HTMLInputElement&&['arrowup','arrowdown','arrowleft','arrowright','home','end','pageup','pagedown'].includes(key))return;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if($('help-dialog').open)return;
  if(!e.repeat){if(key==='r'){reset();return;}if(key===' '){setPaused(!paused);return;}if(key==='c')toggleView();if(key==='f')fullscreen();}
  if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d','g'].includes(key)&&!game.lost&&!game.finished){if(!started||mode!=='keyboard')keyboard();keys.add(key);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{hiddenPause=document.hidden;keys.clear();lastTime=performance.now();});window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;
  const running=active()&&!paused&&!hiddenPause&&!game.lost&&!game.finished;
  if(running){
    if(game.falling){if(stepFall(game,state,dt))result();}
    else{
      if(mode==='keyboard'){if(keys.has('arrowup')||keys.has('w'))angle(manualAngle+dt*45);if(keys.has('arrowdown')||keys.has('s'))angle(manualAngle-dt*45);}
      const previous={...state};stepFlight(state,{...input(),active:true,paused:false,boost:1},dt);handleEvents(updateAdventure(game,state,previous));
    }
  }
  scene?.update(state,dt,game,{started,active:running,paused:paused||hiddenPause});hudTime+=dt;if(hudTime>.1){updateHud();hudTime=0;}raf=requestAnimationFrame(frame);
}
refreshMode();updateHud();try{scene=createFlightScene($('world'));raf=requestAnimationFrame(frame);}catch(error){console.error('Uçuş sahnesi açılamadı',error);$('fatal-error').hidden=false;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);poseController.dispose();scene?.dispose();audioContext?.close();});
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,paused,started,cameraStatus,active:active(),health:game.health,coinCount:game.coinCount,stage:game.stage,falling:game.falling,lost:game.lost,finished:game.finished,manualAngle}),getAdventure:()=>JSON.parse(JSON.stringify(game))})});
