import {createDuelState,stepDuel,ClapGesture} from './duel.js';
import {stepEagle} from './eagle.js';
import {PoseController} from './pose.js';
import {createDuelScene} from './duel-scene.js';

const $=id=>document.getElementById(id);
let state=createDuelState(),source='camera',pose=null,manualPaused=false,loading=false,queuedFlap=false,queuedFire=false;
let cameraAttempt=0;
let toastUntil=0,flashUntil=0,reticleUntil=0;
const keys=new Set(),clap=new ClapGesture();
const formatTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const sounds={hurt:new Audio('./assets/audio/hurt.mp3'),over:new Audio('./assets/audio/game-over.mp3'),hit:new Audio('./assets/audio/hit.mp3'),music:new Audio('./assets/audio/background.mp3')};
sounds.music.loop=true;sounds.music.volume=.24;sounds.hurt.volume=.75;sounds.hit.volume=.72;sounds.over.volume=.68;
for(const audio of Object.values(sounds))audio.preload='auto';
let muted=false;try{muted=localStorage.getItem('nyan-muted')==='true';}catch{}
function applyMute(){for(const audio of Object.values(sounds))audio.muted=muted;$('sound').textContent=muted?'♪̸':'♫';$('sound').setAttribute('aria-label',muted?'Sesi aç':'Sesi kapat');$('sound').setAttribute('aria-pressed',String(muted));}
applyMute();
function play(name){if(muted)return;const a=sounds[name];a.currentTime=0;void a.play().catch(()=>{});}
function toast(message,seconds=2){$('toast').textContent=message;toastUntil=performance.now()+seconds*1000;}
let view;
try{view=createDuelScene($('space'));}catch(error){$('fatal-error').hidden=false;$('fatal-error').textContent='3B sahne başlatılamadı. Tarayıcında WebGL ve donanım hızlandırmasını açıp sayfayı yenile.';console.error(error);throw error;}
const controller=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose(value){
  pose=value;
  if(!value){clap.reset();queuedFire=false;queuedFlap=false;stepEagle(state.flight,{active:false},0);return;}
  const gesture=clap.update(value.landmarks,$('camera-video').videoWidth,$('camera-video').videoHeight);
  pose.handsTogether=gesture.together;
  if(source==='camera'&&state.status==='playing'&&!manualPaused&&!document.hidden&&!$('help-dialog').open&&gesture.fire)queuedFire=true;
},onStatus({state:status,message}){
  $('tracking-status').textContent=message;$('camera-dot').classList.toggle('active',status==='tracking');
  $('camera-placeholder').hidden=status==='tracking';$('camera-message').textContent=status==='loading'?'KAMERA HAZIRLANIYOR':status==='error'?'KAMERA BAŞLATILAMADI':'KOLLARIN VE KALÇAN GÖRÜNSÜN';
  if(status==='error')toast(message,5);
}});
function resetInput(){keys.clear();queuedFlap=queuedFire=false;clap.reset();stepEagle(state.flight,{active:false},0);}
function updateSource(){
  $('source-switch').textContent=source==='camera'?'KLAVYE ↗':'KAMERA ↗';
  $('camera-title').textContent=source==='camera'?'PİLOT KAMERASI':'KLAVYE KONTROLÜ';
  $('controls-hint').innerHTML=source==='camera'?'<span><kbd>↟</kbd> Kanat çırp</span><span><kbd>↔</kbd> Yönel</span><span><kbd>⋈</kbd> Elleri birleştir · ateş</span>':'<span><kbd>B</kbd> Kanat çırp</span><span><kbd>← →</kbd> Yönel</span><span><kbd>BOŞLUK</kbd> Reçel fırlat</span>';
  $('touch-controls').hidden=source==='camera'||state.status==='ready';
  if(source==='keyboard'){$('camera-placeholder').hidden=false;$('camera-message').textContent='B · ÇIRP / BOŞLUK · ATEŞ';$('tracking-status').textContent='Klavye kontrolü aktif';$('camera-dot').classList.remove('active');}
}
function begin(){
  state=createDuelState();state.status='playing';manualPaused=false;view.reset();resetInput();
  $('intro').hidden=true;$('result').hidden=true;document.body.classList.add('playing');
  sounds.over.pause();sounds.over.currentTime=0;if(!muted)void sounds.music.play().catch(()=>{});
  updateSource();toast(source==='camera'?'İKİ KOLUNU KALDIR VE ÇIRP':'KALKIŞ İÇİN B TUŞUNA BAS',4);
}
async function startCamera(){
  if(loading)return;
  const attempt=++cameraAttempt;
  loading=true;resetInput();source='camera';pose=null;updateSource();
  $('camera-start').disabled=true;$('camera-start').textContent='Kamera hazırlanıyor…';
  // Audio is unlocked from this click; tracking and all video remain local.
  if(!muted)void sounds.music.play().catch(()=>{});
  const ok=await controller.start();
  if(attempt!==cameraAttempt)return;
  loading=false;
  $('camera-start').disabled=false;$('camera-start').innerHTML='<span>◉</span> Kamerayla uç <b>↗</b>';
  if(ok){if(state.status==='ready')begin();else{manualPaused=false;toast('KAMERAYLA UÇUŞA DEVAM',2);}}
  else if(state.status==='ready')sounds.music.pause();
}
function useKeyboard(){cameraAttempt++;loading=false;$('camera-start').disabled=false;$('camera-start').innerHTML='<span>◉</span> Kamerayla uç <b>↗</b>';source='keyboard';controller.stop();pose=null;manualPaused=false;resetInput();updateSource();if(state.status==='ready')begin();else toast('KLAVYE KONTROLÜ AKTİF',2);}
$('camera-start').onclick=startCamera;$('keyboard-start').onclick=useKeyboard;
$('source-switch').onclick=()=>source==='camera'?useKeyboard():startCamera();
$('pause-keyboard').onclick=useKeyboard;
$('restart').onclick=()=>begin();
function togglePause(){if(state.status!=='playing')return;manualPaused=!manualPaused;resetInput();}
$('pause').onclick=togglePause;
$('resume').onclick=()=>{if(source==='camera'&&!pose){toast('Kamerada bir adım geri çekil veya klavyeye geç.',3);return;}manualPaused=false;resetInput();};
$('sound').onclick=()=>{muted=!muted;applyMute();try{localStorage.setItem('nyan-muted',String(muted));}catch{}if(!muted&&state.status==='playing')void sounds.music.play().catch(()=>{});};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('Tam ekran bu tarayıcıda kullanılamıyor.',3);}};
let helpWasPaused=false;
$('help').onclick=()=>{helpWasPaused=manualPaused;manualPaused=true;resetInput();$('help-dialog').showModal();};
$('help-close').onclick=()=>$('help-dialog').close();
$('help-dialog').addEventListener('close',()=>{manualPaused=helpWasPaused;resetInput();});
window.addEventListener('keydown',event=>{
  if($('help-dialog').open)return;
  if(state.status!=='ready'&&['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
  if(event.repeat)return;
  if(event.code==='KeyP'||event.code==='Escape'){togglePause();return;}
  if(event.code==='KeyR'&&state.status!=='ready'){begin();return;}
  if(source!=='keyboard'||state.status!=='playing'||manualPaused)return;
  keys.add(event.code);
  if(event.code==='KeyB')queuedFlap=true;
  if(event.code==='Space')queuedFire=true;
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{if(state.status==='playing'){manualPaused=true;resetInput();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.status==='playing'){manualPaused=true;resetInput();}});
for(const [id,key]of[['touch-left','ArrowLeft'],['touch-right','ArrowRight']]){
  $(id).onpointerdown=e=>{e.preventDefault();keys.add(key);$(id).setPointerCapture(e.pointerId);};
  $(id).onpointerup=$(id).onpointercancel=()=>keys.delete(key);
}
$('touch-flap').onpointerdown=e=>{e.preventDefault();queuedFlap=true;};$('touch-fire').onpointerdown=e=>{e.preventDefault();queuedFire=true;};
function finish(){
  const won=state.status==='won';$('result-title').textContent=won?'Tatlı zafer!':'Bir dahaki galaksi.';
  $('result-symbol').textContent=won?'✦':'✧';$('result-description').textContent=won?'Shadow Cat üç reçele dayanamadı. Gökkuşağı senin!':'Nyan Cat üç Çokokrem isabeti aldı. Yeniden uçmaya ne dersin?';
  $('result-hits').textContent=state.hits;$('result-time').textContent=formatTime(state.time);$('result-accuracy').textContent=`${state.shots?Math.round(state.hits/state.shots*100):0}%`;
  $('result').hidden=false;$('paused-panel').hidden=true;document.body.classList.remove('playing');
  $('touch-controls').hidden=true;
  sounds.music.pause();play('over');resetInput();
}
function hearts(id,value){const el=$(id);el.innerHTML=Array.from({length:3},(_,i)=>`<span class="${i>=value?'empty':''}">♥</span>`).join(' ');el.setAttribute('aria-label',`${value} can`);}
let last=performance.now(),lastHud=0,wasPaused=false;
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  const playing=state.status==='playing',trackingLost=source==='camera'&&!pose;
  const paused=playing&&(manualPaused||trackingLost||document.hidden||$('help-dialog').open);
  if(paused&&!wasPaused){resetInput();sounds.music.pause();}
  if(!paused&&wasPaused&&playing&&!muted)void sounds.music.play().catch(()=>{});
  wasPaused=paused;
  let input={active:playing&&!paused,paused,angle:90,bank:0};
  if(source==='camera'&&pose)input={...input,...pose};
  else if(source==='keyboard'){
    const left=keys.has('ArrowLeft')||keys.has('KeyA'),right=keys.has('ArrowRight')||keys.has('KeyD');
    input.bank=(right?1:0)-(left?1:0);
    input.angle=keys.has('ArrowDown')||keys.has('KeyS')?45:keys.has('ArrowUp')||keys.has('KeyW')?140:90;
    input.leftAngle=input.angle+(left?-25:right?25:0);input.rightAngle=input.angle+(right?-25:left?25:0);
  }
  input.flap=queuedFlap;input.fire=queuedFire;queuedFlap=queuedFire=false;
  stepDuel(state,input,dt);
  for(const ev of state.events){
    if(ev.type==='fire'){reticleUntil=now+150;toast('REÇEL YOLDA',.6);}
    if(ev.type==='flap')toast(state.flight.flapCount===1?'TEK ÇIRPIŞ · KALKIŞ TAMAM':'GÜÇLÜ ÇIRPIŞ · YÜKSELİYORSUN',1.4);
    if(ev.type==='player-hit'){play('hurt');flashUntil=now+280;toast(`İSABET ALDIN · ${state.health} CAN`,2);}
    if(ev.type==='enemy-hit'){play('hit');play('hurt');toast(`TAM İSABET · ${state.hits} / 3`,2);}
    if(ev.type==='won'||ev.type==='lost')finish();
  }
  const visible=view.render(state,dt,paused);state.events=[];
  $('paused-panel').hidden=!paused||$('help-dialog').open;
  if(paused){$('pause-reason').textContent=trackingLost?'Kolların ve kalçan kamerada görünsün. Takip gelince düello devam eder.':'Hazır olduğunda kaldığın yerden devam et.';$('pause-keyboard').hidden=source!=='camera';$('resume').hidden=trackingLost;}
  const locked=playing&&!paused&&state.locked&&state.flight.flying;
  $('reticle').classList.toggle('locked',locked);$('lock-glow').classList.toggle('on',locked);$('lock-label').textContent=locked?'HEDEF KİLİTLENDİ · ATEŞLE':'HEDEFİ ORTALA';
  $('reticle').classList.toggle('fired',now<reticleUntil);$('hit-flash').classList.toggle('hit',now<flashUntil);$('toast').classList.toggle('show',now<toastUntil&&playing&&!paused);
  const marker=$('enemy-marker');marker.hidden=!playing||!visible.enemyScreen.visible||state.enemy.health===0;
  if(!marker.hidden){marker.style.left=`${visible.enemyScreen.x}px`;marker.style.top=`${visible.enemyScreen.y}px`;marker.classList.toggle('locked',locked);}
  $('combat-notice').textContent=playing&&!paused&&state.warning?'⚠ ÇOKOKREM GELİYOR · YÖN DEĞİŞTİR':'';
  if(now-lastHud>90){
    lastHud=now;hearts('player-health',state.health);hearts('enemy-health',state.enemy.health);
    $('timer').textContent=formatTime(state.time);$('altitude').innerHTML=`${Math.round(state.flight.altitude)}<small> M</small>`;$('speed').innerHTML=`${Math.round(state.flight.speed)}<small> KT</small>`;$('flaps').textContent=String(state.flight.flapCount).padStart(2,'0');
    $('altitude-bar').style.width=`${Math.min(100,state.flight.altitude/1.6)}%`;$('speed-bar').style.width=`${Math.min(100,state.flight.speed/2.4)}%`;
    $('flight-mode').textContent=!state.flight.flying?'KALKIŞ BEKLİYOR':({flap:'GÜÇLÜ YÜKSELİŞ',glide:'DENGELİ SÜZÜLÜŞ',brake:'YAVAŞLAMA',dive:'DALIŞ'})[state.flight.band];
    $('weapon-ready').textContent=state.cooldown>0?'YENİDEN HAZIRLANIYOR':!state.flight.flying?'ÖNCE KANAT ÇIRP':'ATIŞA HAZIR';$('ammo-light').classList.toggle('wait',state.cooldown>0||!state.flight.flying);
    $('game-status').textContent=state.status==='ready'?'UÇUŞA HAZIR':paused?'DÜELLO DURAKLATILDI':playing?'DÜELLO AKTİF':state.status==='won'?'ZAFER SENİN':'DÜELLO BİTTİ';
    $('pause').textContent=manualPaused?'▶ DEVAM ET':'Ⅱ DURAKLAT';
  }
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>{controller.dispose();for(const a of Object.values(sounds))a.pause();});
updateSource();requestAnimationFrame(frame);
