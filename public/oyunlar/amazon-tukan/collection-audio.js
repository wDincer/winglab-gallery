import {RULES} from './amazon-game.js';
// Restart on a new pickup; stop at the requested duration, loop short source clips.
export class CollectionAudio {
  constructor(makeAudio=src=>new Audio(src),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)){
    this.channels={positive:makeAudio('./assets/toucan-positive.mp3'),negative:makeAudio('./assets/phoenix-negative.mp3')};
    this.schedule=schedule;this.cancel=cancel;this.enabled=true;this.timer=null;this.current=null;
    for(const a of Object.values(this.channels)){a.loop=true;a.volume=.6;a.preload='auto';}
  }
  play(type){
    this.stop();if(!this.enabled)return;
    const a=this.channels[type];if(!a)return;this.current=a;a.currentTime=0;
    const promise=a.play();if(promise?.catch)promise.catch(()=>{});
    this.timer=this.schedule(()=>this.stop(),1000*(type==='positive'?RULES.positiveAudioSeconds:RULES.negativeAudioSeconds));
  }
  stop(){if(this.timer!==null)this.cancel(this.timer);this.timer=null;if(this.current){this.current.pause();this.current.currentTime=0;}this.current=null;}
  setEnabled(value){this.enabled=value;if(!value)this.stop();}
}
