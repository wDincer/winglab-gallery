import {createFlightScene} from './scene.js?v=cow-freeflight-v1';
import {PoseController} from './pose.js?v=cow-freeflight-v1';
import {createEagleState,stepEagle} from './eagle.js?v=cow-freeflight-v1';
import {createGame,stepGame} from './gameplay.js?v=cow-freeflight-v1';
import {BUILDINGS} from './neighborhood.js?v=cow-freeflight-v1';
import {COW_WORLD} from './cow-world.js?v=cow-freeflight-v1';
import {CowAudio} from './audio.js?v=cow-freeflight-v1';

const $=id=>document.getElementById(id),keys=new Set();
let state=createEagleState(),game=createGame(),mode='keyboard',running=false,paused=false,hiddenPause=document.hidden;
let pose=null,cameraStatus='off',manualAngle=90,touchBank=0,pendingFlap=false,finished=false,scene,lastTime=performance.now(),toastTimer,warningUntil=0,raf;
let audio,soundEnabled=true,helpWasPaused=false,frameCount=0;
const pickupAudio=new CowAudio({createContext:()=>audio??=new (window.AudioContext||window.webkitAudioContext)(),onError:()=>toast('Möö sesi yüklenemedi. Ses düğmesiyle yeniden deneyebilirsin.',5000)});
const minimap=$('minimap').getContext('2d');
function toast(text,duration=2800){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function initSound(){pickupAudio.unlock();}
function tone(type='pickup'){
  if(!soundEnabled||!audio)return;const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
  osc.connect(gain);gain.connect(audio.destination);osc.type=type==='crash'?'sawtooth':'sine';
  const from=type==='pickup'?600:type==='flap'?140:type==='throw'?340:110,to=type==='pickup'?1100:type==='flap'?85:45;
  osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+.18);gain.gain.setValueAtTime(type==='crash'?.06:.035,t);gain.gain.exponentialRampToValueAtTime(.001,t+.25);osc.start(t);osc.stop(t+.28);
}
function clearGesture(){pendingFlap=false;stepEagle(state,{active:false},0);keys.clear();touchBank=0;}
function active(){return running&&!finished&&!state.crashed&&(mode==='keyboard'||cameraStatus==='tracking'&&pose!==null);}
function setAngle(value){manualAngle=Math.max(0,Math.min(180,Number(value)));$('manual-angle').value=manualAngle;$('angle-label').textContent=Math.round(manualAngle)+'°';}
const controller=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose(value){pose=value;if(!value)clearGesture();},onStatus(status){
  cameraStatus=status.state;$('camera-dot').classList.toggle('tracking',cameraStatus==='tracking');
  $('camera-message').textContent=status.state==='off'?'Kolların, kanatların olsun.':status.message;
  $('camera-placeholder').hidden=cameraStatus==='tracking'||cameraStatus==='lost'&&!!$('camera-video').srcObject;
  $('tracking-label').textContent=cameraStatus==='tracking'?'Vücut takibi açık':cameraStatus==='lost'?'Takip bekleniyor':cameraStatus==='loading'?'Model hazırlanıyor…':mode==='keyboard'?'Klavye kontrolü':'Kamera isteğe bağlı';
  if(cameraStatus==='error')toast(status.message,6500);
  if(cameraStatus!=='tracking')clearGesture();
}});
function refreshInput(){
  $('input-badge').textContent=mode==='camera'?'KAMERA · EL KONTROLÜ':running?'KLAVYE · SERBEST UÇUŞ':'KLAVYEYE HAZIR';
  $('angle-control').hidden=mode==='camera';$('camera-toggle').title=mode==='camera'?'Klavyeye geç':'Kamerayı aç';
  $('camera-toggle').setAttribute('aria-label',$('camera-toggle').title);
}
function startKeyboard(flapping=true){
  if(!running)setAngle(120);
  initSound();clearGesture();mode='keyboard';controller.stop();pose=null;running=true;document.body.classList.add('running');$('flight-controls').hidden=false;refreshInput();pendingFlap=flapping;
  toast('↑ eller yukarı · yüksel · Süzül: irtifayı tut · ← → yön',4500);
}
async function startCamera(){
  initSound();clearGesture();mode='camera';refreshInput();$('start-camera').disabled=true;
  try{const ok=await controller.start();if(ok){running=true;document.body.classList.add('running');$('flight-controls').hidden=false;toast('İki elini göğüs hizasının üstüne kaldır: kuleden kalk ve yüksel.');}else{mode='keyboard';refreshInput();}}
  finally{$('start-camera').disabled=false;}
}
function requestFlap(){
  if(state.crashed||finished||paused||hiddenPause||$('help-dialog').open)return;
  if(!running||mode!=='keyboard'){startKeyboard(false);}pendingFlap=true;initSound();
}
function pause(value){
  if(state.crashed||finished)return;paused=value;clearGesture();
  if(value&&!$('pause-dialog').open)$('pause-dialog').showModal();
  if(!value&&$('pause-dialog').open)$('pause-dialog').close();
  pickupAudio.setRunning(!value&&active()&&!hiddenPause);
  $('pause').setAttribute('aria-label',value?'Devam et':'Duraklat');
}
function reset(){
  for(const id of['end-dialog','pause-dialog','help-dialog'])if($(id).open)$(id).close();
  pickupAudio.reset();state=createEagleState();game=createGame();paused=false;finished=false;warningUntil=0;clearGesture();setAngle(running&&mode==='keyboard'?120:90);scene?.reset();
  document.body.classList.remove('crashed');$('chef-warning').classList.remove('visible');
  $('pickup-announcement').textContent='';
  if(running&&mode==='keyboard')pendingFlap=true;
  toast(mode==='camera'?'Kuledesin · İki elini göğüs hizasının üstüne kaldır.':'Yeni uçuş · Kuleden havalan, samanları keşfet!');hud();
}
function end(collision=null){
  if(!collision||state.crashed||finished)return;
  if(collision){state.crashed=true;state.crashTime=state.time;state.speed=0;state.verticalSpeed=0;document.body.classList.add('crashed');tone('crash');}
  clearGesture();pickupAudio.reset();pickupAudio.setRunning(false);$('chef-warning').classList.remove('visible');
  $('speech').textContent='Kaybettiniz!';
  $('end-eyebrow').textContent='YENİ BİR UÇUŞA HAZIR MISIN?';
  $('end-title').innerHTML=collision.type==='plate'?'Tabak geldi.<br>Uçuş bitti.':'Küçük bir çarpışma.<br>Yeni bir tur?';
  $('end-message').textContent=collision.message;
  $('end-hay').textContent=game.total;$('end-distance').textContent=Math.round(state.travelled).toLocaleString('tr-TR');$('end-time').textContent=formatTime(state.time);
  $('end-dialog').showModal();$('restart').focus();hud();
}
function formatTime(t){return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');}
function hud(){
  $('hay-count').textContent=String(game.total).padStart(2,'0');$('speed').textContent=Math.round(state.speed);$('altitude').textContent=Math.round(state.altitude);
  $('distance').textContent=`${(state.travelled/1000).toFixed(2)} KM · SERBEST UÇUŞ`;$('progress').style.width=(state.altitude/COW_WORLD.maxAltitude*100)+'%';
  const labels={climb:'Eller yukarı · yüksel',flap:'Kanat çırp · hızlan',glide:'İrtifanı koruyorsun',brake:'İrtifanı koruyorsun',dive:'Eller aşağı · alçal',descent:'Eller aşağı · alçal'};
  $('flight-status').textContent=paused?'Mola':state.crashed?'Uçuş bitti':!active()?'Kontrol bekleniyor':!state.flying?'Kuleden kalkmak için ellerini kaldır':state.altitude>=COW_WORLD.maxAltitude?'500 m · İrtifa sınırı':state.launching?'Kuleden kalkış · yükseliyorsun':labels[state.band]??'Serbest uçuş';
  const nearest=game.hay.filter(h=>!h.collected).reduce((best,h)=>{const range=Math.hypot(h.x-state.x,h.y-state.altitude-2.15,h.z+state.distance);return !best||range<best.range?{hay:h,range}:best;},null);
  $('hay-guide').textContent=nearest?`En yakın saman ${Math.round(nearest.range)} m · ${Math.round(nearest.hay.y)} m irtifada`:'Samanların hepsi toplandı · Keşfe devam et';
  $('flap-count').textContent=state.flapCount+' ÇIRPIŞ';
  $('arm-angles').textContent=mode==='camera'&&pose?`${Math.round(pose.leftAngle)}° / ${Math.round(pose.rightAngle)}°`:mode==='keyboard'&&running?`${Math.round(manualAngle)}° / ${Math.round(manualAngle)}°`:'— / —';
  $('chef-warning').classList.toggle('visible',state.time<warningUntil&&!state.crashed&&!finished);
  $('game').classList.toggle('tracking-lost',running&&mode==='camera'&&cameraStatus==='lost'&&!state.crashed&&!finished);
  drawMap();
}
function drawMap(){
  const c=minimap,w=420,h=300,scale=.22,px=210,py=150;
  c.fillStyle='#b8c3a3';c.fillRect(0,0,w,h);const at=(x,z)=>[px+(x-state.x)*scale,py+(z+state.distance)*scale];
  c.lineCap='round';c.lineJoin='round';c.strokeStyle='#a4b094';c.lineWidth=2;
  for(let grid=-1600;grid<=1600;grid+=200){const [x]=at(grid,0),[,z]=at(0,grid);c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.moveTo(0,z);c.lineTo(w,z);c.stroke();}
  {const[x,y]=at(COW_WORLD.tower.x,COW_WORLD.tower.z);c.fillStyle='#f3edd9';c.strokeStyle='#546b5b';c.beginPath();c.arc(x,y,Math.max(4,COW_WORLD.tower.radius*scale),0,Math.PI*2);c.fill();c.stroke();}
  for(const b of BUILDINGS){const [x,y]=at(b.x,b.z);if(y<-40||y>h+40)continue;c.fillStyle=b.color%2?'#899578':'#98a386';c.fillRect(x-b.width*scale/2,y-b.depth*scale/2,b.width*scale,b.depth*scale);c.strokeStyle='#79866c';c.lineWidth=1;c.strokeRect(x-b.width*scale/2,y-b.depth*scale/2,b.width*scale,b.depth*scale);}
  for(const b of game.hay){if(b.collected)continue;const [x,y]=at(b.x,b.z);c.globalAlpha=Math.abs(b.y-state.altitude)<80?1:.35;c.fillStyle='#e3be60';c.fillRect(x-3,y-3,6,6);c.strokeStyle='#a27e37';c.strokeRect(x-3,y-3,6,6);}c.globalAlpha=1;
  for(const p of game.plates){const [x,y]=at(p.x,p.z);c.fillStyle='#c76c4f';c.beginPath();c.arc(x,y,4,0,7);c.fill();}
  if(game.chef){const [x,y]=at(game.chef.x,game.chef.z);c.fillStyle='#ad6346';c.fillRect(x-4,y-4,8,8);}
  c.save();c.translate(px,py);c.rotate(state.heading*Math.PI/180);c.fillStyle='#2f5c42';c.strokeStyle='#f3efd7';c.lineWidth=3;c.beginPath();c.moveTo(0,-12);c.lineTo(8,8);c.lineTo(0,4);c.lineTo(-8,8);c.closePath();c.stroke();c.fill();c.restore();
}
$('start-keyboard').onclick=()=>startKeyboard();$('start-camera').onclick=startCamera;
$('camera-toggle').onclick=()=>mode==='camera'?startKeyboard(false):startCamera();$('flap-button').onclick=requestFlap;
$('manual-angle').oninput=e=>setAngle(e.target.value);
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{if(mode!=='keyboard')startKeyboard(false);setAngle(b.dataset.angle);});
document.querySelectorAll('[data-steer]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(mode!=='keyboard')startKeyboard(false);touchBank=Number(b.dataset.steer);};b.onpointerup=b.onpointercancel=()=>touchBank=0;});
$('pause').onclick=()=>pause(!paused);$('resume').onclick=()=>pause(false);$('reset-paused').onclick=reset;$('restart').onclick=reset;
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();pause(false);});$('end-dialog').addEventListener('cancel',e=>e.preventDefault());
$('help').onclick=()=>{helpWasPaused=paused;paused=true;pickupAudio.setRunning(false);clearGesture();$('help-dialog').showModal();};
function closeHelp(){$('help-dialog').close();paused=helpWasPaused;clearGesture();}
$('close-help').onclick=closeHelp;$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});
$('sound').onclick=()=>{initSound();soundEnabled=!soundEnabled;pickupAudio.setEnabled(soundEnabled);$('sound').classList.toggle('off',!soundEnabled);$('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Tam ekran tarayıcı tarafından desteklenmiyor.');}}
$('fullscreen').onclick=fullscreen;
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if(e.target instanceof HTMLInputElement)return;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(e.repeat)return;if(k==='r'){reset();return;}if($('help-dialog').open)return;
  if(k==='b'){requestFlap();return;}if(k===' '){pause(!paused);return;}if(k==='f'){fullscreen();return;}if(k==='c'){scene?.toggleView();return;}
  if(['arrowup','arrowdown','arrowleft','arrowright','w','s','a','d'].includes(k)){if(mode!=='keyboard'&&!paused)startKeyboard(false);keys.add(k);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{clearGesture();if(running&&!state.crashed&&!finished&&!paused)pause(true);});
document.addEventListener('visibilitychange',()=>{hiddenPause=document.hidden;pickupAudio.setRunning(!hiddenPause&&!paused&&active());clearGesture();lastTime=performance.now();});
window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.min((now-lastTime)/1000,.1);lastTime=now;const advancing=active()&&!paused&&!hiddenPause;
  if(advancing&&mode==='keyboard'){
    if(keys.has('arrowup')||keys.has('w'))setAngle(manualAngle+dt*45);
    if(keys.has('arrowdown')||keys.has('s'))setAngle(manualAngle-dt*45);
  }
  const input=mode==='camera'?pose??{angle:90,bank:0}:{angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,handsAboveChest:manualAngle>100,handsBelowChest:manualAngle<70,bank:touchBank||((keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0))};
  const previous={...state},flaps=state.flapCount;
  pickupAudio.setRunning(advancing);
  stepEagle(state,{...input,active:active(),paused:paused||hiddenPause,flap:pendingFlap},dt);pendingFlap=false;
  const collision=stepGame(game,previous,state,dt,{active:active(),paused:paused||hiddenPause});
  if(state.flapCount>flaps)tone('flap');
  for(const event of game.events){
    if(event.type==='hay'){
      pickupAudio.playPickup();$('pickup-announcement').textContent=`${game.total} saman balyası toplandı.`;
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('pickup').animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(-5px)',offset:.3},{opacity:0,transform:'translateY(-25px)'}],{duration:900});
    }
    if(event.type==='warning')warningUntil=state.time+4.5;
    if(event.type==='throw')tone('throw');
  }
  if(collision)end(collision);
  scene?.update(state,game,dt,advancing&&!collision);game.events=[];
  if(frameCount++%6===0)hud();raf=requestAnimationFrame(frame);
}
try{scene=createFlightScene($('world'));hud();refreshInput();raf=requestAnimationFrame(frame);}catch(error){console.error(error);$('fatal-error').hidden=false;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);controller.dispose();scene?.dispose();pickupAudio.dispose();});
// Read-only diagnostic data; gameplay state cannot be changed through this API.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({...state,mode,paused,cameraStatus,manualAngle,running,active:active(),finished,hayCount:game.total,plateCount:game.plates.length,chef:game.chef?{...game.chef}:null,seed:game.seed}),getWorld:()=>({hay:game.hay.map(h=>({...h})),plates:game.plates.map(p=>({...p}))})})});
