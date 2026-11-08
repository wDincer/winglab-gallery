export const NYAN_AUDIO_URLS=Object.freeze({
  music:'./assets/audio/background.mp3',
  hurt:'./assets/audio/hurt.mp3',
  hit:'./assets/audio/hit.mp3',
  won:'./assets/audio/victory-tamek.mp3',
  lost:'./assets/audio/defeat-cokokrem.mp3',
  lostExtra:'./assets/audio/defeat-fah.mp3'
});
export const HURT_SECONDS=3;

// A suspended AudioContext preserves the remaining three seconds of each meow.
// Result recordings use one media element so their real ended event, rather than
// a timer or an estimated MP3 duration, advances the defeat sequence.
export class NyanAudio{
  constructor({createContext=()=>new (window.AudioContext||window.webkitAudioContext)(),createMedia=url=>new Audio(url),fetchAudio=url=>fetch(url),onError=()=>{},onLossVideo=()=>{}}={}){
    this.createContext=createContext;this.createMedia=createMedia;this.fetchAudio=fetchAudio;this.onError=onError;this.onLossVideo=onLossVideo;
    this.context=null;this.contextIntent=null;this.buffers=new Map();this.loads=new Map();this.voices=new Set();
    this.enabled=true;this.running=false;this.hidden=false;this.unlocked=false;this.disposed=false;
    this.generation=0;this.effectVersions={hurt:0,hit:0};this.outcome=null;this.music=null;this.result=null;this.resultEnded=null;
  }
  report(error){if(!this.disposed)try{this.onError(error);}catch{}}
  makeMedia(url,volume,loop=false){
    const media=this.createMedia(url);media.preload='auto';media.volume=volume;media.loop=loop;media.muted=true;
    return {media,requested:false,priming:false,serial:0};
  }
  unlock(){
    if(this.disposed)return;
    try{
      this.context??=this.createContext();
      this.music??=this.makeMedia(NYAN_AUDIO_URLS.music,.24,true);
      const needsResult=!this.result;
      this.result??=this.makeMedia(NYAN_AUDIO_URLS.won,.68);
      this.unlocked=true;
      if(needsResult&&this.outcome)this.prepareResult();
      // Invoke resume and muted media play synchronously inside the gesture.
      if(this.enabled&&!this.hidden){this.setContextRunning(true);this.prime(this.music,'music');this.prime(this.result,'result');}
      this.sync();
      this.load('hurt').catch(()=>{});this.load('hit').catch(()=>{});
    }catch(error){this.report(error);}
  }
  gates(){return this.enabled&&!this.hidden&&this.unlocked&&!this.disposed;}
  gameAudible(){return this.gates()&&this.running&&!this.outcome;}
  resultAudible(){return this.gates()&&Boolean(this.outcome&&!this.outcome.completed);}
  wanted(slot){return slot==='music'?this.gameAudible():this.resultAudible();}
  setContextRunning(running){
    if(!this.context||this.contextIntent===running)return;
    this.contextIntent=running;
    try{Promise.resolve(running?this.context.resume():this.context.suspend()).catch(error=>this.report(error));}catch(error){this.report(error);}
  }
  prime(slot,name){
    if(!slot||slot.requested||slot.priming||this.wanted(name))return;
    const serial=++slot.serial;slot.priming=true;slot.media.muted=true;
    try{Promise.resolve(slot.media.play()).then(()=>{
      if(serial!==slot.serial)return;
      slot.priming=false;
      if(this.wanted(name)){slot.requested=true;slot.media.muted=false;}
      else this.pauseMedia(slot,true);
    },()=>{if(serial===slot.serial){slot.priming=false;this.pauseMedia(slot,true);}});}catch{slot.priming=false;}
  }
  pauseMedia(slot,rewind=false){
    if(!slot)return;
    slot.serial++;slot.requested=false;slot.priming=false;slot.media.muted=true;
    try{slot.media.pause();if(rewind)slot.media.currentTime=0;}catch{}
  }
  syncMedia(slot,name){
    if(!slot)return;
    if(!this.wanted(name)){
      slot.media.muted=true;
      if(slot.requested||(slot.priming&&!this.gates()))this.pauseMedia(slot);
      return;
    }
    slot.media.muted=false;
    if(slot.requested)return;
    const serial=++slot.serial;slot.requested=true;slot.priming=false;
    try{Promise.resolve(slot.media.play()).then(()=>{
      if(serial===slot.serial&&!this.wanted(name))this.pauseMedia(slot);
    },error=>{
      if(serial!==slot.serial)return;
      slot.requested=false;
      if(error?.name!=='AbortError')this.report(error);
    });}catch(error){slot.requested=false;this.report(error);}
  }
  sync(){
    // A lethal hit retains its already started/requested meow on the result screen.
    const finalMeow=this.outcome?.kind==='lost'&&[...this.voices].some(voice=>voice.kind==='hurt');
    this.setContextRunning(this.gates()&&(this.gameAudible()||finalMeow));
    this.syncMedia(this.music,'music');this.syncMedia(this.result,'result');
  }
  cancelPending(){this.effectVersions.hurt++;this.effectVersions.hit++;}
  setRunning(running){
    const next=Boolean(running);if(this.running===next)return;
    if(this.running&&!next)this.cancelPending();
    this.running=next;this.sync();
  }
  setEnabled(enabled){
    const next=Boolean(enabled);if(this.enabled===next)return;
    if(!next)this.cancelPending();
    this.enabled=next;this.sync();
  }
  setHidden(hidden){
    const next=Boolean(hidden);if(this.hidden===next)return;
    if(next)this.cancelPending();
    this.hidden=next;this.sync();
  }
  async load(kind){
    if(this.buffers.has(kind))return this.buffers.get(kind);
    if(!this.loads.has(kind)){
      const loading=(async()=>{
        const response=await this.fetchAudio(NYAN_AUDIO_URLS[kind]);
        if(!response.ok)throw new Error(`Nyan ses dosyası yüklenemedi: ${kind}`);
        const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
        if(!(buffer.duration>0))throw new Error(`Nyan ses dosyası boş: ${kind}`);
        this.buffers.set(kind,buffer);return buffer;
      })().catch(error=>{this.loads.delete(kind);this.report(error);throw error;});
      this.loads.set(kind,loading);
    }
    return this.loads.get(kind);
  }
  playHurt(){return this.playEffect('hurt');}
  playHit(){return this.playEffect('hit');}
  async playEffect(kind){
    if(!this.gameAudible())return false;
    const generation=this.generation,version=this.effectVersions[kind];
    let buffer;try{buffer=await this.load(kind);}catch{return false;}
    const retainedFinalMeow=kind==='hurt'&&this.outcome?.kind==='lost';
    if(generation!==this.generation||version!==this.effectVersions[kind]||!this.gates()||(!this.gameAudible()&&!retainedFinalMeow))return false;
    const siblings=[...this.voices].filter(voice=>voice.kind===kind),limit=kind==='hurt'?3:4;
    if(siblings.length>=limit)this.stopVoice(siblings[0]);
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;gain.gain.value=kind==='hurt'?.75:.72;source.connect(gain);gain.connect(this.context.destination);
    const voice={kind,source,gain};this.voices.add(voice);
    source.onended=()=>{this.releaseVoice(voice);this.sync();};
    const now=this.context.currentTime;
    if(kind==='hurt'){
      // Loop short recordings, but stop on the audio clock after exactly 3 s.
      source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;
      source.start(now);source.stop(now+HURT_SECONDS);
    }else source.start(now);
    this.sync();return true;
  }
  releaseVoice(voice){
    if(!this.voices.delete(voice))return;
    voice.source.onended=null;
    try{voice.source.disconnect();voice.gain.disconnect();}catch{}
  }
  stopVoice(voice){
    if(!voice||!this.voices.has(voice))return;
    this.releaseVoice(voice);try{voice.source.stop();}catch{}
  }
  clearResultListener(){
    if(this.resultEnded&&this.result)this.result.media.removeEventListener('ended',this.resultEnded);
    this.resultEnded=null;
  }
  prepareResult(){
    this.clearResultListener();
    const outcome=this.outcome;if(!outcome||outcome.completed||!this.result)return;
    this.pauseMedia(this.result,true);
    const media=this.result.media,track=outcome.tracks[outcome.index],generation=this.generation,index=outcome.index;
    media.src=track;
    this.resultEnded=()=>{
      if(this.disposed||generation!==this.generation||this.outcome!==outcome||outcome.index!==index||!this.resultAudible()||!media.ended)return;
      this.pauseMedia(this.result);
      outcome.index++;
      if(outcome.index>=outcome.tracks.length){
        outcome.completed=true;this.clearResultListener();this.sync();
        if(outcome.kind==='lost')try{this.onLossVideo();}catch(error){this.report(error);}
      }
      else{this.prepareResult();this.sync();}
    };
    media.addEventListener('ended',this.resultEnded);
  }
  finish(kind){
    if(this.disposed||!['won','lost'].includes(kind)||this.outcome)return;
    this.running=false;this.effectVersions.hit++;
    if(kind==='won')this.effectVersions.hurt++;
    for(const voice of [...this.voices])if(kind==='won'||voice.kind!=='hurt')this.stopVoice(voice);
    this.pauseMedia(this.music,true);
    this.outcome={kind,index:0,completed:false,tracks:kind==='won'?[NYAN_AUDIO_URLS.won]:[NYAN_AUDIO_URLS.lost,NYAN_AUDIO_URLS.lostExtra]};
    this.prepareResult();this.sync();
  }
  reset(){
    this.generation++;this.cancelPending();this.running=false;this.outcome=null;this.clearResultListener();
    for(const voice of [...this.voices])this.stopVoice(voice);
    this.pauseMedia(this.music,true);this.pauseMedia(this.result,true);this.sync();
  }
  getState(){
    return {enabled:this.enabled,running:this.running,hidden:this.hidden,unlocked:this.unlocked,disposed:this.disposed,voices:this.voices.size,hurtVoices:[...this.voices].filter(voice=>voice.kind==='hurt').length,
      outcome:this.outcome?{kind:this.outcome.kind,index:this.outcome.index,completed:this.outcome.completed,track:this.outcome.tracks[this.outcome.index]??null}:null};
  }
  dispose(){
    if(this.disposed)return;
    this.reset();this.disposed=true;this.unlocked=false;
    try{Promise.resolve(this.context?.close()).catch(()=>{});}catch{}
  }
}
