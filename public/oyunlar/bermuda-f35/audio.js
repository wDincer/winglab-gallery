export class StormAudio {
  constructor(){this.enabled=true;this.context=null;this.buffers={};this.sources=new Set();this.loading=null;}
  async start(){
    if(!this.context){
      this.context=new(window.AudioContext||window.webkitAudioContext)();this.master=this.context.createGain();this.master.gain.value=this.enabled?.8:0;this.master.connect(this.context.destination);
      this.loading=Promise.all(['ocean','thunder','shark'].map(async name=>{const r=await fetch(`assets/audio/${name}.mp3`);if(!r.ok)throw new Error('Ses dosyası yüklenemedi: '+name);this.buffers[name]=await this.context.decodeAudioData(await r.arrayBuffer());}));
    }
    await this.context.resume();await this.loading;
    if(!this.loop){this.loop=this.context.createBufferSource();this.loop.buffer=this.buffers.ocean;this.loop.loop=true;const g=this.context.createGain();g.gain.value=.55;this.loop.connect(g);g.connect(this.master);this.loop.start();
      this.engine=this.context.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=65;this.engineGain=this.context.createGain();this.engineGain.gain.value=.012;const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=160;this.engine.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();}
  }
  play(name){if(!this.context||!this.buffers[name])return;const s=this.context.createBufferSource();s.buffer=this.buffers[name];const g=this.context.createGain();g.gain.value=name==='thunder'?.8:.6;s.connect(g);g.connect(this.master);s.start(0,0,name==='thunder'?Math.min(4,s.buffer.duration):s.buffer.duration);this.sources.add(s);s.onended=()=>{s.disconnect();g.disconnect();this.sources.delete(s);};}
  toggle(){this.enabled=!this.enabled;this.master?.gain.setTargetAtTime(this.enabled?.8:0,this.context.currentTime,.08);return this.enabled;}
  setPaused(value){if(!this.context||this.paused===value)return;this.paused=value;(value?this.context.suspend():this.context.resume()).catch(()=>{});}
  reset(){for(const s of this.sources)try{s.stop();}catch{}this.sources.clear();}
  update(flight,falling){if(this.engine)this.engine.frequency.setTargetAtTime(falling?24:30+flight.speed*.4+flight.engineThrottle*25,this.context.currentTime,.2);}
  dispose(){this.context?.close();}
}
