import {RoomScene} from './room-scene.js?v=duck-bounce-v1';
import {PoseController} from './pose.js';
import {stepEagle} from './eagle.js';
import {createRun,stepRun,ROOMS,worldSpeed,monsterDistance} from './rooms.js?v=duck-bounce-v1';
import {Soundscape} from './audio.js';

const $=id=>document.getElementById(id);
let run=createRun(),intro=true,paused=false,source='keyboard',pose=null,flap=false,modalAction=null;
const held=new Set();
let toastUntil=0;
function toast(message,seconds=3.5){$('toast').textContent=message;toastUntil=performance.now()+seconds*1000;$('toast').classList.add('visible');}
const sound=new Soundscape({onError:()=>toast('Ses oynatılamadı. ♪ düğmesine dokunarak yeniden dene.',6)});
let scene;
try{scene=new RoomScene($('world'));}catch(error){$('fatal').hidden=false;console.error(error);}

function clearInput(){held.clear();flap=false;stepEagle(run.flight,{active:false},0);}
function reset(){
  sound.reset();run=createRun();paused=false;clearInput();$('modal').hidden=true;
  toast(source==='keyboard'?'B tuşuna bir kez bas: ilk kanadını çırp.':'İki kolunu kaldır, birlikte aşağı çırp.',6);
}
function setSource(next){
  clearInput();source=next;pose=null;
  const camera=source==='camera';
  $('camera-view').hidden=!camera;$('keyboard-hint').hidden=camera;$('camera-status').hidden=!camera;
  $('source-label').textContent=camera?'VÜCUT KONTROLÜ':'KLAVYE KONTROLÜ';
  $('switch-source').textContent=camera?'KLAVYE ↗':'KAMERA ↗';
  if(!camera)tracker.stop();
}
async function start(mode){
  sound.unlock();intro=false;document.body.classList.add('playing');$('intro').hidden=true;$('hud').hidden=false;
  reset();setSource(mode);
  if(mode==='camera')await tracker.start();
}
const tracker=new PoseController({video:$('camera-video'),canvas:$('pose-map'),
  onPose:value=>{pose=value;if(!value)clearInput();},
  onStatus:({state,message})=>{
    $('camera-status').textContent=message;$('pilot-dot').style.background=state==='tracking'?'#e5ef89':'#f0a67c';
    if(state==='error'&&source==='camera'){
      showModal({kicker:'KAMERA BAĞLANTISI',title:'Kamera hazır değil.',copy:`<p>${message}</p><p>Klavye ile hemen devam edebilirsin.</p>`,primary:'KLAVYEYLE DEVAM ET',secondary:'TEKRAR DENE',action:()=>{setSource('keyboard');closeModal();},secondaryAction:()=>{closeModal();tracker.start();}});
    }
  }
});

function showModal({kicker,title,copy,primary='DEVAM ET',secondary='YENİDEN BAŞLA',action=closeModal,secondaryAction=reset}){
  clearInput();paused=true;sound.sync(run,false);
  $('modal-kicker').textContent=kicker;$('modal-title').textContent=title;$('modal-copy').innerHTML=copy;
  $('modal-primary').textContent=primary+'  →';$('modal-secondary').textContent=secondary;
  $('modal-secondary').hidden=!secondary;$('modal').hidden=false;
  modalAction={primary:action,secondary:secondaryAction};$('modal-primary').focus();
}
function closeModal(){clearInput();paused=false;$('modal').hidden=true;}
function pause(){
  if(intro||run.mode!=='playing')return;
  if(paused){closeModal();return;}
  showModal({kicker:'BİR NEFES AL.',title:'Duraklatıldı.',copy:'<p>Odalar bekleyebilir. Kovalamaca ve tüm sesler durduruldu.</p><p><em>Esc</em> ile uçuşa dön.</p>'});
}
function help(){
  showModal({kicker:'UÇUŞ NOTLARI / DENEK 001',title:'Kanatların yeter.',copy:'<ul><li><em>B / Boşluk:</em> Bir kez kanat çırp. Tekrar hızlanmak için yeniden bas.</li><li><em>← / → veya A / D:</em> Yatış ve dönüş. Tuşu bırakınca mevcut yönünde süzülürsün; düzeltmek için ters yöne yat.</li><li><em>↑ / W:</em> Kanatları kaldır, frenle. <em>↓ / S:</em> Kanatları indir, dalış yap.</li><li><em>Kamerayla:</em> İki kolu birlikte kaldırıp indirerek çırp. Kolları yana açık tutarak süzül; dönmek istediğin kolunu indir.</li><li>18×18 metrelik odalar, geniş geçitler ve çevik dönüşler. Tavan <em>3.8 m</em>; ördek alçaktan uçar.</li><li>Duvara ya da sütuna çarpınca oyun bitmez. Çarpma efektiyle <em>180° geri dönüp</em> uçuşuna devam edersin.</li><li>Canavarla <em>1 m</em> aranı koru. Her takip <em>15 saniye</em>. Labirent dört yönde sınırsız uzar. İstediğin yöne uç, dön, geri gel ve keşfet.</li></ul>',primary:'ANLADIM',secondary:''});
}
function finish(){
  const reason='Canavar bir metrelik güvenli alanına girdi. Çırpışlarla hız kazan; geniş odalarda dönerek uzaklaş.';
  showModal({kicker:'SİNYAL KESİLDİ / SONSUZ LABİRENT',title:'Fazla yakındı.',copy:`<p>${reason}</p><p><em>${Math.floor(run.travelled)} metre</em> · ${run.roomsEntered} oda geçişi · ${run.escaped} takip atlatıldı · ${Math.floor(run.elapsed)} saniye</p>`,primary:'YENİDEN DENE',secondary:'ANA EKRAN',action:reset,secondaryAction:()=>{
    sound.reset();tracker.stop();clearInput();run=createRun();intro=true;paused=false;source='keyboard';
    $('modal').hidden=true;$('intro').hidden=false;$('hud').hidden=true;document.body.classList.remove('playing');
  }});
}

$('start-keyboard').addEventListener('click',()=>start('keyboard'));
$('start-camera').addEventListener('click',()=>start('camera'));
$('switch-source').addEventListener('click',async()=>{
  sound.unlock();setSource(source==='camera'?'keyboard':'camera');
  if(source==='camera')await tracker.start();else toast('Klavye kontrolü açık. B ile kanat çırp.');
});
$('pause').addEventListener('click',pause);$('help').addEventListener('click',help);$('help-intro').addEventListener('click',help);
$('modal-primary').addEventListener('click',()=>modalAction?.primary());$('modal-secondary').addEventListener('click',()=>modalAction?.secondary());
$('sound').addEventListener('click',()=>{
  sound.muted=!sound.muted;sound.failed.clear();sound.unlock();
  $('sound').textContent=sound.muted?'♫̸':'♪';$('sound').setAttribute('aria-pressed',String(sound.muted));$('sound').setAttribute('aria-label',sound.muted?'Sesi aç':'Sesi kapat');
});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}
  catch{toast('Bu tarayıcı tam ekranı desteklemiyor.');}
});
addEventListener('keydown',event=>{
  const controls=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','KeyB','Space','Escape','KeyR'];
  if(!controls.includes(event.code))return;
  // Keep keyboard activation of focused menu buttons available.
  if(intro&&event.code!=='Escape')return;
  event.preventDefault();
  if(event.repeat)return;
  if(event.code==='Escape'){if(!$('modal').hidden&&run.mode==='playing')closeModal();else pause();return;}
  if(event.code==='KeyR'){reset();return;}
  if(paused||source!=='keyboard'||run.mode!=='playing')return;
  held.add(event.code);if(event.code==='KeyB'||event.code==='Space')flap=true;
});
addEventListener('keyup',event=>held.delete(event.code));
addEventListener('blur',()=>{clearInput();if(!intro&&!paused&&run.mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(!intro&&!paused&&run.mode==='playing')pause();}});
document.querySelectorAll('[data-hold]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();if(source!=='keyboard'||paused)return;held.add(button.dataset.hold);button.setPointerCapture(event.pointerId);});
  for(const type of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>held.delete(button.dataset.hold));
});
$('touch-flap').addEventListener('pointerdown',event=>{event.preventDefault();if(source==='keyboard'&&!paused)flap=true;});

function input(){
  if(source==='camera')return pose?{...pose,active:true,paused}:{active:false};
  const left=held.has('ArrowLeft')||held.has('KeyA'),right=held.has('ArrowRight')||held.has('KeyD');
  const up=held.has('ArrowUp')||held.has('KeyW'),down=held.has('ArrowDown')||held.has('KeyS');
  const bank=Number(right)-Number(left),angle=up?140:down?40:90;
  return {active:true,paused,angle,leftAngle:angle+bank*16,rightAngle:angle-bank*16,bank,flap};
}
let uiClock=0;
function updateHud(dt,active){
  uiClock-=dt;if(uiClock>0)return;uiClock=.08;
  $('speed').textContent=worldSpeed(run.flight).toFixed(1);$('altitude').textContent=run.player.y.toFixed(1);
  $('height-fill').style.width=(run.player.y/ROOMS.ceiling*100)+'%';
  $('route-fill').style.width=(run.monster?.stage==='chasing'?(1-run.chaseRemaining/ROOMS.chaseSeconds)*100:0)+'%';
  $('distance').textContent=String(Math.floor(run.travelled)).padStart(3,'0');
  $('encounters-label').textContent=`${run.escaped} TAKİP · ${run.roomsEntered} ODA`;
  const heading=run.flight.heading;
  $('bearing').textContent=['K','KD','D','GD','G','GB','B','KB'][Math.round(heading/45)%8]+' · '+String(Math.round(heading)%360).padStart(3,'0')+'°';
  const chasing=run.monster?.stage==='chasing';
  $('chase-status').classList.toggle('chasing',chasing);
  $('status-label').textContent=source==='camera'&&!pose?'TAKİP BEKLENİYOR · OYUN BEKLİYOR':chasing?'ARKANA BAKMA. UÇ.':run.safeUntil>0?'İZİNİ KAYBETTİRDİN':run.escaped>0?'LABİRENT DEVAM EDİYOR':'BURALAR FAZLA SESSİZ';
  $('chase-clock').textContent=chasing?run.chaseRemaining.toFixed(1)+'s':'';
  const range=monsterDistance(run);
  $('monster-distance').textContent=chasing?`MESAFE ${range.toFixed(1)} m`:'';
  const danger=chasing?Math.max(0,1-(range-1)/9):0;
  $('danger').style.boxShadow=`inset 0 0 150px 15px rgba(207,36,16,${danger*.65})`;
  $('flight-mode').textContent=!run.flight.flying?'İLK KANADINI ÇIRP':({flap:'KANAT ÇIRP · HIZLAN',glide:'SESSİZCE SÜZÜL',brake:'KANATLAR YUKARI · FREN',dive:'ALÇAKTAN DALIŞ'})[run.flight.band];
  if(source==='camera'&&!active)$('flight-mode').textContent='VÜCUT TAKİBİ BEKLENİYOR';
  if(performance.now()>toastUntil)$('toast').classList.remove('visible');
}
let previous=performance.now();
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
  if(!scene)return;
  const control=input(),active=!intro&&!paused&&control.active&&!document.hidden&&run.mode==='playing';
  if(!intro){
    const wasPlaying=run.mode==='playing';stepRun(run,{...control,active},dt);flap=false;
    if(run.events.includes('wall'))toast('Duvara çarptın · Geri dönüp devam ediyorsun.',2.2);
    if(run.events.includes('sighting'))toast('ONU GÖRDÜN. Kanat çırp ve 15 saniye uzak kal!',5);
    if(run.events.includes('escaped'))toast(`${run.escaped}. takip atlatıldı. Labirent devam ediyor.`,4);
    sound.sync(run,active&&run.mode==='playing');
    if(wasPlaying&&run.mode!=='playing')finish();
    updateHud(dt,active);
  }
  const impact=intro?0:(run.impact?.remaining??0)/(run.impact?.duration||.55);
  $('wall-impact').style.opacity=String(Math.max(0,impact)*.6);
  scene.render(run,intro,dt,now/1000);
}
requestAnimationFrame(frame);
// Read-only telemetry is convenient for local diagnostics without bypassing
// the gesture input or changing a run from the developer console.
Object.defineProperty(window,'duckrooms',{value:{get state(){return {mode:run.mode,source,paused,distance:run.travelled,x:run.player.x,z:run.player.z,heading:run.flight.heading,altitude:run.player.y,flaps:run.flight.flapCount,escaped:run.escaped,chaseRemaining:run.chaseRemaining,rooms:run.roomsEntered,duckScale:ROOMS.duckScale,wallHits:run.wallHits,impactRemaining:run.impact?.remaining??0,monsterDistance:monsterDistance(run),monsterSpeed:ROOMS.monsterSpeed,layout:run.maze.layout.id,cachedChunks:run.maze.chunks.size};}}});
