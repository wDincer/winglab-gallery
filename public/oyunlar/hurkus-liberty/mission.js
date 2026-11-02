import {createFlightState,stepFlight,clamp,resolveAirplaneControl} from './flight.js';
import {PoseController} from './pose.js';
import {createFlightScene} from './liberty-scene.js';
import {RULES,STATUE,createMission,stepMission,fireMissile,loseMission,positionOf,forwardOf,targetSolution,handsTogether,TouchTrigger,distance} from './combat.js';
import {flightCollision} from './environment.js';
const $=id=>document.getElementById(id);
let flight=initialFlight(),mission=createMission(),screen='menu',mode='keyboard',paused=false,hidden=document.hidden,pose=null,cameraStatus='off',cameraMessage='',lastPose=0,manualAngle=90,lastTime=performance.now(),pendingFire=false,resultAt=null,helpPaused=false;
let scene,raf,toastTimer;const keys=new Set(),touch=new TouchTrigger(),markers=new Map();
function initialFlight(){return {...createFlightState(),altitude:135,speed:90,distance:-1800,flying:true,initialClimbComplete:true,vehicle:'airplane'};}
const menuAudio=new Audio('./assets/audio/menu.mp3');menuAudio.loop=true;menuAudio.volume=.35;
const shotAudio=new Audio('./assets/audio/missile.mp3');shotAudio.preload='auto';shotAudio.volume=.55;
let audioContext,engine,engineGain,soundEnabled=false,audioUnlocked=false;
async function enableAudio(){
  if(!audioContext){try{audioContext=new(window.AudioContext||window.webkitAudioContext)();engine=audioContext.createOscillator();engineGain=audioContext.createGain();const low=audioContext.createBiquadFilter();low.type='lowpass';low.frequency.value=165;engine.type='sawtooth';engineGain.gain.value=0;engine.connect(low);low.connect(engineGain);engineGain.connect(audioContext.destination);engine.start();}catch{/* HTML audio remains available. */}}
  if(audioContext?.state==='suspended')await audioContext.resume().catch(()=>{});
  soundEnabled=true;audioUnlocked=true;updateSound();if(screen==='menu')menuAudio.play().catch(()=>toast('Menü sesini başlatmak için ses düğmesine bas.'));
}
function updateSound(){
  $('sound').setAttribute('aria-label',soundEnabled?'Sesi kapat':'Sesi aç');$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound-label').textContent=soundEnabled?'SES AÇIK':'SESİ AÇ';
  menuAudio.muted=!soundEnabled;shotAudio.muted=!soundEnabled;
  if(!soundEnabled)engineGain?.gain.setTargetAtTime(0,audioContext.currentTime,.1);
}
function playShot(){if(!soundEnabled)return;shotAudio.currentTime=0;shotAudio.play().catch(()=>{});}
function impactSound(big=false){if(!soundEnabled||!audioContext)return;const duration=big?1.5:.65,samples=Math.floor(audioContext.sampleRate*duration),buffer=audioContext.createBuffer(1,samples,audioContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<samples;i++)data[i]=(Math.random()*2-1)*(1-i/samples)**2;const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=big?220:500;gain.gain.value=big?.3:.13;source.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
function toast(message,duration=3000){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
const controller=new PoseController({video:$('video'),canvas:$('skeleton'),onPose(value){pose=value;if(value)lastPose=performance.now();},onStatus({state,message}){cameraStatus=state;cameraMessage=message;}});
function activeInput(){return screen==='play'&&!paused&&!hidden&&!$('help-dialog').open&&mission.status==='playing'&&(mode==='keyboard'||(cameraStatus==='tracking'&&pose?.bodyCalibrated&&performance.now()-lastPose<650));}
function currentInput(){
  if(mode==='camera')return pose??{angle:0,bank:0,bodyThrottle:0,closed:false};
  return {angle:manualAngle,leftAngle:manualAngle,rightAngle:manualAngle,bank:(keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0),closed:manualAngle<25,bodyThrottle:keys.has('g')?1:0,bodyLean:keys.has('g')?30:0,bodyCalibrated:true};
}
function hideOverlays(){for(const id of['pause-overlay','result-overlay','tracking-overlay'])$(id).hidden=true;}
function start(controlMode=mode){
  if(!scene)return;
  screen='play';mode=controlMode;paused=false;mission=createMission();flight=initialFlight();keys.clear();manualAngle=90;touch.reset();pendingFire=false;resultAt=null;scene.reset();
  document.body.className='playing';$('menu').hidden=true;$('hud').hidden=false;$('mission-top').hidden=false;$('pause').hidden=false;$('pause').disabled=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Duraklat');hideOverlays();
  for(const m of markers.values())m.remove();markers.clear();$('score-dots').replaceChildren(...Array.from({length:10},()=>document.createElement('i')));
  menuAudio.pause();shotAudio.pause();if(!audioUnlocked)enableAudio();
  $('simulator').focus();lastTime=performance.now();
  if(mode==='camera'){if(cameraStatus==='off'||cameraStatus==='error')controller.start();toast('Dik dur, ardından kollarını yana aç. Kamera seni tanıyınca görev başlar.',4500);}
  else{controller.stop();toast('Oklar: uçuş · G: gaz · X: füze · L: düz uçuş',4200);}
  updateHud();
}
function toMenu(){screen='menu';paused=false;keys.clear();touch.reset();controller.stop();pose=null;hideOverlays();clearTimeout(toastTimer);$('toast').classList.remove('visible');scene?.reset();document.body.className='in-menu';$('menu').hidden=false;$('hud').hidden=true;$('mission-top').hidden=true;$('pause').hidden=true;mission=createMission();menuAudio.currentTime=0;if(soundEnabled)menuAudio.play().catch(()=>{});}
function setPaused(value){if(screen!=='play'||mission.status!=='playing')return;paused=value;keys.clear();pendingFire=false;touch.update(false,0,false);$('pause-overlay').hidden=!value;$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?'Uçuşa devam et':'Duraklat');if(value){menuAudio.pause();shotAudio.pause();}}
function requestFire(){if(!activeInput())return;const result=fireMissile(mission,positionOf(flight),forwardOf(flight));if(!result.ok)toast(result.reason==='cooldown'?'Füze yeniden hazırlanıyor.':'Hedefi 2.500 m içinde nişangâha al; yeşil kilidi bekle.',2200);}
function consumeEvents(){
  for(const e of mission.events.splice(0)){
    if(e.type==='spawn')toast(`F-16 TESPİT EDİLDİ · Hedef ${String(e.id).padStart(2,'0')} · Heykeli koru!`,3500);
    if(e.type==='launch'){playShot();toast('FÜZE ATEŞLENDİ · Hedef takip ediliyor',1800);}
    if(e.type==='explosion'){scene.explode(e.position);impactSound();toast(`HEDEF İMHA EDİLDİ · ${mission.score} / 10`,3000);}
    if(e.type==='statue-destroyed'){scene.breakStatue();impactSound(true);toast('ÖZGÜRLÜK HEYKELİ VURULDU',3000);}
    if(e.type==='crash'){scene.explode(positionOf(flight),true);impactSound(true);}
  }
}
function showResult(){
  if(resultAt!==null)return;resultAt=performance.now();hideOverlays();keys.clear();pendingFire=false;shotAudio.pause();$('pause').disabled=true;
  const won=mission.status==='won';document.body.classList.toggle('lost',!won);
  $('result-eyebrow').textContent=won?'GÖREV BAŞARIYLA TAMAMLANDI':'GÖREV BAŞARISIZ';$('result-symbol').textContent=won?'✦':'⌁';$('result-title').textContent=won?'Özgürlük güvende.':mission.reason==='statue'?'Özgürlük yıkıldı.':'Uçuş sona erdi.';
  $('result-copy').textContent=won?'10 F-16’yı imha ettin. New York semaları senin sayende güvende.':mission.reason==='statue'?'Bir F-16 savunmayı geçti ve heykele çarptı. Yeniden havalan, bu kez hiçbir hedefi kaçırma.':'Hürkuş bir engele çarptı. Yeni turda irtifanı koru ve şehir üzerinde yüksel.';
  $('result-score').textContent=`${mission.score} / 10`;$('result-time').textContent=formatTime(mission.time);
  // Let the player see the statue shattering before showing the result panel.
}
function formatTime(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function headingName(h){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(h/45)%8];}
const radar=$('radar').getContext('2d');
function drawRadar(){
  const ctx=radar,w=210,h=164,cx=105,cy=83,r=66;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#a3d5c322';ctx.lineWidth=1;for(const scale of[.33,.66,1]){ctx.beginPath();ctx.arc(cx,cy,r*scale,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy+r);ctx.stroke();
  const sweep=mission.time*.7;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(sweep)*r,cy-Math.cos(sweep)*r);ctx.strokeStyle='#a3d5c349';ctx.stroke();
  const p=positionOf(flight),a=flight.heading*Math.PI/180;
  function point(world,color,diamond=false){const dx=world.x-p.x,dz=world.z-p.z,x=dx*Math.cos(a)+dz*Math.sin(a),y=-dx*Math.sin(a)+dz*Math.cos(a),n=Math.hypot(x,y),scale=r/2500,edge=Math.min(1,2450/(n||1)),px=cx+x*scale*edge,py=cy+y*scale*edge;ctx.fillStyle=color;ctx.beginPath();if(diamond){ctx.moveTo(px,py-4);ctx.lineTo(px+3,py);ctx.lineTo(px,py+4);ctx.lineTo(px-3,py);ctx.closePath();}else ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();}
  point(STATUE,'#b6ffdb',true);for(const e of mission.enemies)if(e.alive)point(e.position,e.reserved?'#ffe0a1':'#ff9a90');ctx.fillStyle='#d7f0e9';ctx.beginPath();ctx.moveTo(cx,cy-5);ctx.lineTo(cx-4,cy+4);ctx.lineTo(cx+4,cy+4);ctx.closePath();ctx.fill();
  ctx.font='8px Segoe UI';ctx.fillStyle='#9bbcb8';ctx.textAlign='center';ctx.fillText(headingName(flight.heading),cx,11);
}
function updateMarkers(){
  const p=positionOf(flight);let offscreen=null;
  for(const e of mission.enemies){
    let m=markers.get(e.id);if(!e.alive){m?.remove();markers.delete(e.id);continue;}
    if(!m){m=document.createElement('div');m.className='target-marker';m.innerHTML='<small></small><em></em>';$('target-markers').append(m);markers.set(e.id,m);}
    const q=scene.project(e.position),range=distance(p,e.position),locked=mission.lockId===e.id&&mission.lockProgress>=1;
    m.hidden=!q.visible;if(q.visible){m.style.left=q.x*100+'%';m.style.top=q.y*100+'%';m.classList.toggle('locked',locked);m.querySelector('small').textContent=e.reserved?'FÜZE YOLDA':`F-16 · ${String(e.id).padStart(2,'0')}`;m.querySelector('em').textContent=`${Math.round(range)} m · ${Math.max(0,Math.ceil(e.duration-e.age))} sn`;}
    else if(!offscreen||range<offscreen.range)offscreen={e,range};
  }
  let direction=$('target-direction');if(offscreen){if(!direction){direction=document.createElement('div');direction.id='target-direction';direction.className='target-direction';$('target-markers').append(direction);}direction.hidden=false;const d=offscreen.e.position,angle=((Math.atan2(d.x-p.x,-(d.z-p.z))*180/Math.PI-flight.heading+540)%360)-180;direction.textContent=Math.abs(angle)<12?(d.y>p.y?'↑ HEDEF YUKARIDA · YÜKSEL':'↓ HEDEF AŞAĞIDA · ALÇAL'):`${angle<0?'← SOLA DÖN':'SAĞA DÖN →'} · F-16 ${Math.round(offscreen.range)} m`;}else if(direction)direction.hidden=true;
  const statue=scene.project({x:0,y:135,z:0});$('statue-marker').hidden=!statue.visible||mission.reason==='statue';if(statue.visible){$('statue-marker').style.left=statue.x*100+'%';$('statue-marker').style.top=statue.y*100+'%';}
  const f=forwardOf(flight),q=scene.project({x:p.x+f.x*1500,y:p.y+f.y*1500,z:p.z+f.z*1500});$('reticle').style.left=q.x*100+'%';$('reticle').style.top=q.y*100+'%';
}
function updateHud(){
  if(screen==='menu')return;
  const input=currentInput(),control=resolveAirplaneControl(input),live=activeInput(),locked=mission.lockProgress>=1&&mission.lockId!==null,ready=live&&locked&&mission.cooldown<=0;
  $('score').textContent=String(mission.score).padStart(2,'0');[...$('score-dots').children].forEach((d,i)=>d.classList.toggle('done',i<mission.score));
  $('speed').textContent=Math.round(flight.speed);$('altitude').textContent=Math.round(flight.altitude);$('heading').textContent=String(Math.round(flight.heading)%360).padStart(3,'0')+'° '+headingName(flight.heading);
  $('vertical').textContent=(flight.verticalSpeed>0?'+':'')+flight.verticalSpeed.toFixed(1)+' m/s';$('flight-time').textContent=formatTime(Math.floor(mission.time));
  $('throttle').textContent='%'+Math.round((live?control.throttle:0)*100);$('throttle-fill').style.width=Math.round((live?control.throttle:0)*100)+'%';$('body-lean').textContent=mode==='keyboard'?(keys.has('g')?'30°':'0°'):pose?.bodyCalibrated?Math.max(0,Math.round(pose.bodyLean))+'°':'—';
  const alive=mission.enemies.filter(e=>e.alive),soon=alive.length?Math.min(...alive.map(e=>e.duration-e.age)):Infinity;
  $('wave-label').textContent=soon<15?'HEYKEL TEHLİKEDE':mission.wave>=10?'SON HEDEF':`SONRAKİ SALDIRI`;
  $('wave-countdown').textContent=soon<15?formatTime(soon):mission.wave>=10?`${mission.wave} / 10`:formatTime(mission.nextSpawn-mission.time);$('wave-label').parentElement.classList.toggle('alert',soon<15);
  $('reticle').classList.toggle('locked',locked);$('lock-label').textContent=locked?'KİLİTLENDİ · ELLERİNİ BİRLEŞTİR':mission.lockId!==null?'HEDEFE KİLİTLENİYOR':alive.length?'HEDEFİ NİŞANGÂHA AL':'HEDEF ARANIYOR';$('lock-fill').style.width=mission.lockProgress*100+'%';
  $('fire').disabled=!ready;$('fire').classList.toggle('ready',ready);$('fire-label').textContent=mission.cooldown>0?'FÜZE HAZIRLANIYOR':ready?'FÜZE ATEŞLE':'KİLİT BEKLENİYOR';
  $('flight-status').textContent=paused?'UÇUŞ DURAKLATILDI':!live?'KONTROL BEKLENİYOR':control.attitudeBand.id==='descent'?'FREN VE ALÇALIŞ':control.forwardDescent?'İLERLE VE ALÇAL':control.throttling?'GÖVDE GAZI AKTİF':control.attitudeBand.id==='fast'?'TIRMANIŞ':'SEYİR UÇUŞU';
  $('control-hint').textContent=ready?(mode==='camera'?'Ellerini birbirine dokundur; füzeni ateşle.':'X’e bas; kilitli hedefe füze ateşle.'):mode==='keyboard'?`Kol açısı ${Math.round(manualAngle)}° · L ile 90° düz uçuş`:'Kollarını aç, kanatlarını dengede tut.';
  $('keyboard-hints').hidden=mode!=='keyboard';$('camera-label').textContent=mode==='camera'?'PİLOT KAMERASI':'KLAVYE KONTROLÜ';$('camera-placeholder').hidden=mode==='camera'&&!!controller.stream;
  $('tracking-status').textContent=mode==='keyboard'?'↑ ↓ kol açısı · ← → dönüş':pose?.bodyCalibrated?'Vücut takibi aktif':pose?'Dik dur, ayarlanıyor…':cameraStatus==='loading'?'Kamera hazırlanıyor…':'Takip bekleniyor';
  $('camera-toggle').textContent=mode==='camera'?'Klavye':'Kamerayı aç';$('camera-dot').style.background=mode==='camera'&&cameraStatus==='tracking'?'#9df4ce':'#7c929c';$('calibrate-body').hidden=mode!=='camera';$('calibrate-body').disabled=cameraStatus!=='tracking';
  const waiting=screen==='play'&&mission.status==='playing'&&mode==='camera'&&!live&&!paused&&!hidden&&!$('help-dialog').open;
  $('tracking-overlay').hidden=!waiting;
  if(waiting){$('tracking-title').textContent=cameraStatus==='error'?'Kamera bekleniyor.':pose&&!pose.bodyCalibrated?'Dik duruşunu ayarlıyoruz.':cameraStatus==='loading'?'Kameraya geçiyoruz.':'Seni yeniden görelim.';$('tracking-message').textContent=cameraStatus==='error'?cameraMessage:pose&&!pose.bodyCalibrated?'Kıpırdamadan dik dur; omuzların ve kalçan kamerada görünsün.':cameraStatus==='loading'?'Tarayıcının kamera iznini ver. Ardından bir adım geri çekil; omuzların, dirseklerin ve kalçan görünsün.':cameraMessage||'Bir adım geri çekil; omuzların, dirseklerin ve kalçan görünsün.';$('retry-camera').hidden=cameraStatus!=='error'&&cameraStatus!=='off';}
  const broken=mission.reason==='statue';$('statue-status').textContent=broken?'YIKILDI':soon<15?'TEHLİKEDE':'GÜVENDE';$('integrity-fill').style.width=broken?'0%':'100%';$('objective-note').textContent=broken?'Savunma hattı aşıldı.':alive.length?`${alive.length} F-16 yaklaşıyor. Hedefleri durdur.`:'New York hava sahasını koru.';
  drawRadar();updateMarkers();
}
function openHelp(){helpPaused=paused;if(screen==='play'&&mission.status==='playing')setPaused(true);$('help-dialog').showModal();}
$('help-dialog').addEventListener('close',()=>{if(screen==='play'&&mission.status==='playing')setPaused(helpPaused);});
$('help').onclick=openHelp;$('briefing-button').onclick=openHelp;$('close-help').onclick=()=>$('help-dialog').close();$('help-done').onclick=()=>$('help-dialog').close();
$('start-camera').onclick=()=>start('camera');$('start-keyboard').onclick=()=>start('keyboard');$('restart').onclick=()=>start(mode);$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>setPaused(false);
for(const id of['pause-menu','result-menu'])$(id).onclick=toMenu;$('brand').onclick=e=>{e.preventDefault();if(screen==='play')setPaused(true);else toMenu();};
$('sound').onclick=async()=>{if(!soundEnabled)await enableAudio();else{soundEnabled=false;updateSound();menuAudio.pause();}};
document.addEventListener('pointerdown',event=>{if(!audioUnlocked&&screen==='menu'&&!event.target.closest('#sound'))enableAudio();},{once:true});
$('fire').onclick=requestFire;
$('camera-toggle').onclick=()=>{keys.clear();touch.reset();if(mode==='camera'){controller.stop();mode='keyboard';manualAngle=90;pendingFire=false;}else{mode='camera';controller.start();}updateHud();};
$('tracking-keyboard').onclick=()=>{mode='keyboard';controller.stop();manualAngle=90;touch.reset();updateHud();};$('retry-camera').onclick=()=>controller.start();$('calibrate-body').onclick=()=>{controller.resetBodyCalibration();touch.reset();};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('simulator').requestFullscreen();}catch{toast('Tam ekran bu tarayıcıda açılamadı.');}}
$('fullscreen').onclick=fullscreen;$('level-flight').onclick=()=>manualAngle=90;
for(const b of document.querySelectorAll('[data-hold]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(mode!=='keyboard')return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.hold);});for(const type of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys.delete(b.dataset.hold));}
window.addEventListener('keydown',e=>{
  if($('help-dialog').open||e.target.matches('input,select,textarea'))return;
  const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(screen!=='play')return;
  if(key==='f'&&!e.repeat){fullscreen();return;}
  if(key==='r'&&!e.repeat){start(mode);return;}
  if(key===' '&&!e.repeat){setPaused(!paused);return;}
  if(!activeInput())return;
  if(key==='c'&&!e.repeat){flight.camera=flight.camera==='chase'?'cockpit':'chase';toast(flight.camera==='chase'?'Takip kamerası':'Pilot görünümü',1600);return;}
  if(mode==='keyboard'){if(key==='x'&&!e.repeat)requestFire();if(key==='l')manualAngle=90;keys.add(key);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(screen==='play'&&mission.status==='playing')setPaused(true);});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;keys.clear();pendingFire=false;touch.update(false,0,false);lastTime=performance.now();if(hidden){menuAudio.pause();shotAudio.pause();}else if(screen==='menu'&&soundEnabled)menuAudio.play().catch(()=>{});});
window.addEventListener('resize',()=>scene?.resize());
function frame(now){
  const dt=Math.max(0,Math.min((now-lastTime)/1000,.1));lastTime=now;
  const active=activeInput();
  if(active&&mode==='keyboard'){if(keys.has('arrowup'))manualAngle=clamp(manualAngle+dt*45,0,165);if(keys.has('arrowdown'))manualAngle=clamp(manualAngle-dt*45,0,165);}
  const fire=mode==='camera'?touch.update(handsTogether(pose?.landmarks,$('video').videoWidth||1,$('video').videoHeight||1),dt,active):false;
  stepFlight(flight,{...currentInput(),active,paused:!active},dt);
  if(active){const collision=flightCollision(flight);if(collision){flight.crashed=true;flight.speed=0;flight.verticalSpeed=0;loseMission(mission,collision);}}
  stepMission(mission,{player:positionOf(flight),forward:forwardOf(flight),active,paused:!active,fire},dt);
  consumeEvents();if(screen==='play'&&mission.status!=='playing')showResult();
  if(resultAt!==null&&now-resultAt>(mission.reason==='statue'?2400:1000))$('result-overlay').hidden=false;
  const animated=!hidden&&!paused&&!$('help-dialog').open;
  scene.update(flight,mission,animated?dt:0,screen==='menu'?'menu':mission.reason==='statue'?'defeat':'play');
  if(screen==='play')updateHud();
  if(audioContext&&engineGain){const sounding=soundEnabled&&active&&mission.status==='playing';engineGain.gain.setTargetAtTime(sounding?.018:0,audioContext.currentTime,.15);engine.frequency.setTargetAtTime(35+flight.speed*.45+flight.engineThrottle*26,audioContext.currentTime,.2);}
  raf=requestAnimationFrame(frame);
}
try{scene=createFlightScene($('world'));raf=requestAnimationFrame(frame);}catch(e){console.error('3D scene failed',e);$('fatal-error').hidden=false;$('start-camera').disabled=$('start-keyboard').disabled=true;}
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);controller.dispose();scene?.dispose();menuAudio.pause();shotAudio.pause();audioContext?.close();});
// Read-only state for troubleshooting. No camera images or landmarks are exposed.
Object.defineProperty(window,'winglab',{value:Object.freeze({getState:()=>({flight:{...flight},mission:{status:mission.status,time:mission.time,score:mission.score,wave:mission.wave,lockProgress:mission.lockProgress,enemies:mission.enemies.map(e=>({id:e.id,alive:e.alive,position:{...e.position}}))},screen,mode,paused,active:activeInput(),cameraStatus,manualAngle})})});
