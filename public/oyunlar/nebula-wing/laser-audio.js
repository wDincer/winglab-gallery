export const LASER_CLIP_SECONDS=3;
export const PLAYER_SHOT_GAIN=.72;
export const MAX_AUDIBLE_DISTANCE=1200;

export function enemyShotGain(distance){
  if(!Number.isFinite(distance))return 0;
  const d=Math.max(0,distance);
  return .6/(1+(d/180)**2)*Math.max(0,1-d/MAX_AUDIBLE_DISTANCE);
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

// One voice per ship: each volley restarts the first three seconds, never loops.
// Volume follows the ship's current distance for the entire audible tail.
export class LaserAudio{
  constructor(context,url,{fetchAudio=globalThis.fetch,onError=()=>{}}={}){
    this.context=context;this.buffer=null;this.enabled=true;this.active=false;
    this.listener={x:0,y:0,z:0};this.emitters=new Map();this.voices=new Map();this.pending=new Map();
    this.disposed=false;this.counts={player:0,enemy:0};this.lastShot=null;this.error=null;
    this.ready=(async()=>{
      const response=await fetchAudio(url);
      if(!response.ok)throw new Error('Ateş sesi yüklenemedi: '+response.status);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      if(!(buffer.duration>0))throw new Error('Ateş sesi boş.');
      if(this.disposed)return false;
      this.buffer=buffer;
      const waiting=[...this.pending.values()];this.pending.clear();
      for(const event of waiting)this.play(event);
      return true;
    })().catch(error=>{this.error=error.message;this.pending.clear();if(!this.disposed)onError(error);return false;});
  }
  update({enabled,active,listener,enemies}){
    this.enabled=enabled;this.active=active;this.listener=listener;
    this.emitters=new Map(enemies.map(e=>[e.id,e.position]));
    if(!enabled||!active){this.stopAll();return;}
    for(const voice of this.voices.values()){
      const position=voice.owner==='player'?listener:this.emitters.get(voice.enemyId)??voice.position;
      voice.position=position;voice.distance=voice.owner==='player'?0:distance(position,listener);
      voice.volume=voice.owner==='player'?PLAYER_SHOT_GAIN:enemyShotGain(voice.distance);
      voice.gain.gain.setTargetAtTime(voice.volume,this.context.currentTime,.06);
    }
  }
  play(event){
    if(this.disposed||!this.enabled||!this.active||!['player','enemy'].includes(event.owner))return false;
    const key=event.owner==='player'?'player':'enemy-'+event.enemyId;
    const position=event.owner==='player'?this.listener:this.emitters.get(event.enemyId);
    if(!position)return false;
    if(!this.buffer){if(!this.error)this.pending.set(key,{owner:event.owner,enemyId:event.enemyId});return false;}
    this.stopVoice(key);
    const source=this.context.createBufferSource(),gain=this.context.createGain(),envelope=this.context.createGain();
    const seconds=Math.min(LASER_CLIP_SECONDS,this.buffer.duration),now=this.context.currentTime;
    const d=event.owner==='player'?0:distance(position,this.listener);
    const volume=event.owner==='player'?PLAYER_SHOT_GAIN:enemyShotGain(d);
    source.buffer=this.buffer;source.loop=false;
    gain.gain.setValueAtTime(volume,now);
    envelope.gain.setValueAtTime(1,now);envelope.gain.setValueAtTime(1,now+Math.max(0,seconds-.02));
    envelope.gain.linearRampToValueAtTime(0,now+seconds);
    source.connect(envelope).connect(gain).connect(this.context.destination);
    const voice={source,gain,envelope,owner:event.owner,enemyId:event.enemyId,position,distance:d,volume,seconds};
    this.voices.set(key,voice);
    source.onended=()=>{if(this.voices.get(key)===voice)this.voices.delete(key);source.disconnect();envelope.disconnect();gain.disconnect();};
    source.start(now,0,seconds);
    this.counts[event.owner]++;this.lastShot={owner:event.owner,enemyId:event.enemyId,duration:seconds,gain:volume,distance:d};
    return true;
  }
  stopVoice(key){
    const voice=this.voices.get(key);if(!voice)return;
    voice.source.onended=null;
    try{voice.source.stop();}catch{/* The browser may have ended it in this frame. */}
    voice.source.disconnect();voice.envelope.disconnect();voice.gain.disconnect();this.voices.delete(key);
  }
  stopAll(){this.pending.clear();for(const key of [...this.voices.keys()])this.stopVoice(key);}
  dispose(){this.disposed=true;this.stopAll();this.buffer=null;}
  getStats(){return {loaded:!!this.buffer,error:this.error,clipDuration:this.buffer?Math.min(LASER_CLIP_SECONDS,this.buffer.duration):null,played:{...this.counts},lastShot:this.lastShot,voices:[...this.voices.values()].map(v=>({owner:v.owner,enemyId:v.enemyId,distance:v.distance,gain:v.volume,duration:v.seconds}))};}
}
