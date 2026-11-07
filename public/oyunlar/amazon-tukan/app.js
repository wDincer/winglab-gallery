import {createAmazonScene} from './amazon-scene.js?v=flap-rise-50';
import {createRun,stepRun,RULES} from './amazon-game.js?v=flap-rise-50';
import {PoseController} from './pose.js';
import {stepEagle,eagleBand} from './eagle.js?v=flap-rise-50';
import {CollectionAudio} from './collection-audio.js';
const $=id=>document.getElementById(id);
let run=createRun(),mode='camera',started=false,paused=false,hiddenPause=false,helpPause=false,pose=null,cameraStatus='off',angle=90,pendingFlap=false;
let lastTime=performance.now(),hudTime=0,toastTimer;
const keys=new Set(),audio=new CollectionAudio();
let scene;
try{scene=createAmazonScene($('flight-canvas'));}catch(e){$('welcome').innerHTML='<h2>Görüntü başlatılamadı.</h2><p>Tarayıcıda WebGL desteğini açıp sayfayı yenile.</p>';console.error(e);throw e;}
function toast(text,duration=3200){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function clearGesture(){pendingFlap=false;keys.clear();stepEagle(run.state,{active:false},0);}
function stopActivity(){clearGesture();audio.stop();}
function active(){return started&&!paused&&!hiddenPause&&!helpPause&&!run.state.crashed&&!run.finished&&(mode==='keyboard'||cameraStatus==='tracking'&&pose!==null);}
function refreshMode(){
  $('camera-mode').classList.toggle('active',mode==='camera');$('keyboard-mode').classList.toggle('active',mode==='keyboard');
  $('camera-mode').setAttribute('aria-pressed',String(mode==='camera'));$('keyboard-mode').setAttribute('aria-pressed',String(mode==='keyboard'));
  $('keyboard-panel').hidden=mode!=='keyboard'||!started;
  $('camera-placeholder').hidden=cameraStatus==='tracking'||cameraStatus==='lost'&&!!$('camera-video').srcObject;
  $('camera-title').textContent=mode==='keyboard'?'KLAVYE KONTROLÜ':'PİLOT KAMERASI';
}
const poseController=new PoseController({video:$('camera-video'),canvas:$('pose-canvas'),onPose(p){pose=p;if(!p)stopActivity();},onStatus(status){
  cameraStatus=status.state;$('camera-dot').classList.toggle('tracking',status.state==='tracking');$('tracking-badge').hidden=status.state!=='tracking';
  $('camera-message').textContent=status.state==='off'?(mode==='keyboard'?'B ile kanat çırp.':'Kollarını aç, kontrolü devral.'):status.message;
  $('camera-toggle').setAttribute('aria-label',['tracking','lost','loading'].includes(cameraStatus)?'Kamerayı kapat':'Kamerayı aç');
  if(status.state==='error')toast(status.message,6000);refreshMode();
}});
function startKeyboard(){stopActivity();mode='keyboard';poseController.stop();started=true;paused=false;document.body.classList.add('started');refreshMode();$('game').focus();toast('B ile iki çırpışta kalkış. Her çırpış +50 m · ← → yön.');}
async function startCamera(){
  stopActivity();mode='camera';refreshMode();$('start-camera').disabled=true;
  try{if(await poseController.start()){started=true;paused=false;document.body.classList.add('started');refreshMode();$('game').focus();toast('Kollarını omuz hizasına açıp iki kez çırp. Her çırpış +50 m.');}}
  finally{$('start-camera').disabled=false;}
}
function togglePause(){if(!started||run.state.crashed||run.finished)return;paused=!paused;if(paused)stopActivity();hud();}
function reset(){const view=run.state.camera;stopActivity();run=createRun();run.state.camera=view;paused=false;angle=90;$('manual-angle').value='90';$('angle-label').textContent='90°';if($('result-dialog').open)$('result-dialog').close();hud();scene.update(run,1);$('game').focus();toast('Zirveye döndün. Kalkış için iki kez kanat çırp.');}
function flap(){if(!active())return;pendingFlap=true;}
function result(event){stopActivity();$('result-label').textContent=event.type==='finish'?'AMAZON KEŞFİ TAMAMLANDI':'YENİDEN KANATLAN';$('result-title').textContent=event.type==='finish'?'Harika bir uçuştu.':'Uçuş sona erdi.';$('result-message').textContent=event.message||'Amazon üzerinde 6 kilometrelik parkuru tamamladın.';$('result-score').textContent=run.score;$('result-count').textContent=run.positive+run.negative;$('result-distance').textContent=Math.round(run.state.distance).toLocaleString('tr-TR');$('result-dialog').showModal();}
function pickup(event){audio.play(event.type);const n=$('pickup');n.textContent=(event.points>0?'+':'−')+Math.abs(event.points);n.classList.toggle('negative',event.type==='negative');n.classList.remove('animate');void n.offsetWidth;n.classList.add('animate');toast(event.type==='positive'?'Milat topladın · +1 puan':'Feastables topladın · −2 puan',1800);}
function hud(){
  const s=run.state,source=mode==='camera'?pose:{angle};const band=eagleBand(source?.angle??90,s.flapping);
  $('score').textContent=run.score;$('positive-count').textContent=run.positive;$('negative-count').textContent=run.negative;$('collected-count').textContent=`${run.positive+run.negative} / ${RULES.collectibleCount}`;
  $('speed').innerHTML=`${Math.round(s.speed)} <small>KT</small>`;$('altitude').innerHTML=`${Math.round(s.altitude).toLocaleString('tr-TR')} <small>m</small>`;
  $('flight-time').textContent=`${String(Math.floor(s.time/60)).padStart(2,'0')}:${String(Math.floor(s.time%60)).padStart(2,'0')}`;
  $('distance').textContent=`${(s.distance/1000).toFixed(2).replace('.',',')} / 6,00 km`;$('progress').style.width=Math.max(0,Math.min(100,s.distance/RULES.length*100))+'%';
  const label=!started?'Dağın zirvesi · İki çırpışta +100 m':s.crashed?'Uçuş sona erdi':run.finished?'Amazon keşfi tamamlandı':paused||hiddenPause||helpPause?'Uçuş duraklatıldı':mode==='camera'&&cameraStatus!=='tracking'?'Vücut takibi bekleniyor':!s.flying?`Kalkış · ${s.flapCount}/${RULES.takeoffFlaps} çırpış · ${s.flapCount===1?'Bir kez daha kanat çırp':'İki kez kanat çırp'}`:Number.isFinite(s.climbTarget)&&s.climbTarget>s.altitude?`Yükseliyorsun · Hedef ${Math.round(s.climbTarget)} m`:{flap:'Kanat çırpışı · +50 m yükseliş',glide:'Amazon üzerinde · Dengeli süzülüş',brake:'Kanatlar yukarı · Yavaşlıyorsun',dive:'Kanatlar aşağı · Hızlı dalış'}[band.id];
  $('flight-status').innerHTML='<span class="live-dot"></span>'+label;
  $('gesture-status').textContent=`${Math.round(source?.angle??90)}° · `+{flap:'Kanat çırpışı',glide:'Dengeli süzülüş',brake:'Fren',dive:'Hızlı dalış'}[band.id];
  $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Uçuşa devam et':'Uçuşu duraklat');
  const lost=started&&mode==='camera'&&cameraStatus==='lost';$('paused-overlay').hidden=!(paused||hiddenPause||lost);
  $('pause-reason').textContent=lost?'Kolların kadraja girince uçuş devam eder.':'Devam etmek için Boşluk tuşuna bas.';
}
$('start-keyboard').addEventListener('click',startKeyboard);$('keyboard-mode').addEventListener('click',startKeyboard);$('start-camera').addEventListener('click',startCamera);$('camera-mode').addEventListener('click',startCamera);
$('camera-toggle').addEventListener('click',()=>{if(['tracking','lost','loading'].includes(cameraStatus)){stopActivity();poseController.stop();}else startCamera();});
$('flap').addEventListener('click',flap);$('pause').addEventListener('click',togglePause);$('restart').addEventListener('click',reset);$('restart-result').addEventListener('click',reset);
$('manual-angle').addEventListener('input',e=>{angle=Number(e.target.value);$('angle-label').textContent=Math.round(angle)+'°';});
$('sound').addEventListener('click',()=>{audio.setEnabled(!audio.enabled);$('sound').textContent=audio.enabled?'♪':'♩';$('sound').setAttribute('aria-label',audio.enabled?'Sesi kapat':'Sesi aç');$('sound').title=audio.enabled?'Ses açık':'Ses kapalı';});
$('view').addEventListener('click',()=>{run.state.camera=run.state.camera==='chase'?'cockpit':'chase';$('view').setAttribute('aria-label',run.state.camera==='chase'?'Pilot görünümüne geç':'Tukanı dışarıdan izle');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('Bu görünüm tam ekranı desteklemiyor.');}});
$('help').addEventListener('click',()=>{helpPause=true;stopActivity();$('help-dialog').showModal();});$('close-help').addEventListener('click',()=>$('help-dialog').close());$('help-dialog').addEventListener('close',()=>{helpPause=false;clearGesture();});
$('result-dialog').addEventListener('cancel',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||$('help-dialog').open)return;
  const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','b','r','v'].includes(k))e.preventDefault();
  if(e.repeat)return;
  if(k==='r'){reset();return;}if(k===' '){togglePause();return;}if(k==='v'){$('view').click();return;}
  if(!active()||mode!=='keyboard')return;keys.add(k);if(k==='b')flap();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{if(started){hiddenPause=true;stopActivity();hud();}});window.addEventListener('focus',()=>{hiddenPause=document.hidden;lastTime=performance.now();});
document.addEventListener('visibilitychange',()=>{hiddenPause=document.hidden;if(hiddenPause)stopActivity();lastTime=performance.now();});window.addEventListener('resize',()=>scene.resize());
window.addEventListener('pagehide',()=>{audio.stop();poseController.stop();});
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
  const enabled=active();
  if(enabled&&mode==='keyboard'){
    angle=Math.max(0,Math.min(180,angle+((keys.has('arrowup')?1:0)-(keys.has('arrowdown')?1:0))*80*dt));
    $('manual-angle').value=angle;$('angle-label').textContent=Math.round(angle)+'°';
  }
  const input=mode==='camera'?{...pose,active:enabled,paused:!enabled}:{active:enabled,paused:!enabled,angle,leftAngle:angle,rightAngle:angle,bank:(keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),flap:pendingFlap};
  const events=stepRun(run,input,dt);pendingFlap=false;for(const event of events){if(event.type==='crash'||event.type==='finish')result(event);else pickup(event);}
  scene.update(run,dt);hudTime+=dt;if(hudTime>.1){hud();hudTime=0;}requestAnimationFrame(frame);
}
refreshMode();hud();scene.update(run);requestAnimationFrame(frame);
