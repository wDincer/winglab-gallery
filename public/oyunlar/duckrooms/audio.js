export const AUDIO_FILES=Object.freeze({sighting:'./assets/sighting.mp3',ambience:'./assets/ambience.mp3',chase:'./assets/chase.mp3'});

export class Soundscape{
  constructor({makeAudio=src=>new Audio(src),onError=()=>{}}={}){
    this.tracks=Object.fromEntries(Object.entries(AUDIO_FILES).map(([name,src])=>[name,makeAudio(src)]));
    this.muted=false;this.running=false;this.unlocked=false;this.onError=onError;this.failed=new Set();
    for(const[name,track]of Object.entries(this.tracks)){
      track.preload='auto';track.loop=name!=='sighting';
      track.addEventListener?.('error',()=>this.report(name));
    }
  }
  report(name){if(!this.failed.has(name)){this.failed.add(name);this.onError(name);}}
  play(name){
    const track=this.tracks[name];
    if(!track.paused)return;
    const promise=track.play();
    promise?.catch(()=>{if(this.running)this.report(name);});
  }
  // Called synchronously in a user gesture, including camera/keyboard start.
  unlock(){
    this.unlocked=true;
    for(const track of Object.values(this.tracks)){
      track.volume=0;
      const promise=track.play();
      promise?.then(()=>{if(!this.running){track.pause();track.currentTime=0;}}).catch(()=>{});
    }
  }
  reset(){this.running=false;for(const track of Object.values(this.tracks)){track.pause();track.currentTime=0;}}
  sync(state,active){
    this.running=Boolean(active&&this.unlocked);
    if(!this.running){for(const track of Object.values(this.tracks))track.pause();return;}
    const chasing=state.monster?.stage==='chasing';
    this.tracks.ambience.volume=this.muted?0:chasing?.14:.42;
    this.tracks.chase.volume=this.muted?0:.7;
    this.tracks.sighting.volume=this.muted?0:.85;
    this.play('ambience');
    for(const name of['chase','sighting']){
      const wanted=name==='chase'?chasing:state.sightingRemaining>1e-8;
      if(wanted){
        if(state.events.includes(name==='chase'?'chase-start':'sighting'))this.tracks[name].currentTime=0;
        // The duck cue is shorter than five seconds, so repeat within the
        // five-second simulation window; pausing freezes that window as well.
        this.tracks[name].loop=true;
        this.play(name);
      }else{this.tracks[name].pause();this.tracks[name].currentTime=0;}
    }
  }
}
