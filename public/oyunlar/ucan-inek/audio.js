export const MOO_AUDIO_URL='./assets/cow-moo.mp3';

export class CowAudio{
  constructor({createContext=()=>new (window.AudioContext||window.webkitAudioContext)(),fetchAudio=url=>fetch(url),onError=()=>{}}={}){
    this.createContext=createContext;this.fetchAudio=fetchAudio;this.onError=onError;
    this.context=null;this.buffer=null;this.loading=null;this.voices=new Set();
    this.enabled=true;this.running=false;this.unlocked=false;this.generation=0;this.disposed=false;
  }
  unlock(){
    if(this.disposed)return;
    try{this.context??=this.createContext();this.unlocked=true;this.sync();this.load().catch(()=>{});}
    catch{this.onError();}
  }
  async load(){
    if(this.buffer)return this.buffer;
    if(!this.loading)this.loading=(async()=>{
      const response=await this.fetchAudio(MOO_AUDIO_URL);
      if(!response.ok)throw new Error('Möö sesi yüklenemedi.');
      return this.buffer=await this.context.decodeAudioData(await response.arrayBuffer());
    })().catch(error=>{this.loading=null;this.onError();throw error;});
    return this.loading;
  }
  sync(){
    if(!this.context)return;
    const audible=this.running&&this.enabled&&this.unlocked&&!this.disposed;
    if(audible&&this.context.state==='suspended')this.context.resume()?.catch(()=>{});
    if(!audible&&this.context.state==='running')this.context.suspend()?.catch(()=>{});
  }
  setRunning(running){
    const next=Boolean(running);
    if(this.running&&!next)this.generation++;
    this.running=next;this.sync();
  }
  setEnabled(enabled){this.enabled=Boolean(enabled);if(!this.enabled)this.reset();this.sync();}
  async playPickup(){
    if(!this.running||!this.enabled||!this.unlocked||this.disposed)return false;
    const generation=this.generation;
    let buffer;try{buffer=await this.load();}catch{return false;}
    if(generation!==this.generation||!this.running||!this.enabled||this.disposed)return false;
    // Nearby bales may be collected together; cap overlapping full moo samples.
    if(this.voices.size>=3)this.stopVoice(this.voices.values().next().value);
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;gain.gain.value=.8;source.connect(gain);gain.connect(this.context.destination);
    const voice={source,gain};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(0);return true;
  }
  stopVoice(voice){if(!voice)return;this.voices.delete(voice);try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}
  reset(){this.generation++;for(const voice of [...this.voices])this.stopVoice(voice);}
  dispose(){this.reset();this.disposed=true;this.running=false;this.context?.close();}
}
