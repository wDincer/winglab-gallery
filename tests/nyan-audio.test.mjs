import test from 'node:test';
import assert from 'node:assert/strict';
import {NyanAudio,NYAN_AUDIO_URLS,HURT_SECONDS} from '../public/oyunlar/nyan-duello/audio.js';

const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function setup({duration=.4,fetchAudio=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),deferMedia=false}={}){
  const sources=[],media=[],errors=[],plays=[],lossVideos=[];
  const context={state:'suspended',currentTime:11,destination:{},
    resume(){this.state='running';return Promise.resolve();},
    suspend(){this.state='suspended';return Promise.resolve();},
    close(){this.state='closed';return Promise.resolve();},
    decodeAudioData:async()=>({duration}),
    createGain:()=>({gain:{value:0},connect(){},disconnect(){this.disconnected=true;}}),
    createBufferSource(){
      const source={ended:false,connect(){},disconnect(){this.disconnected=true;},
        start(...args){this.started=args;},
        stop(when){this.stopCalls??=[];this.stopCalls.push(when);this.stopAt=when??context.currentTime;if(this.stopAt<=context.currentTime)this.end();},
        end(){if(this.ended)return;this.ended=true;this.onended?.();}
      };sources.push(source);return source;
    },
    tick(seconds){if(this.state!=='running')return;this.currentTime+=seconds;for(const source of sources)if(!source.ended&&source.stopAt<=this.currentTime)source.end();}
  };
  const createMedia=url=>{
    const listeners=new Set();let src=url;
    const element={paused:true,ended:false,currentTime:0,pending:[],
      get src(){return src;},set src(value){src=value;this.currentTime=0;this.ended=false;},
      play(){this.paused=false;this.ended=false;plays.push({element:this,src:this.src,muted:this.muted});return deferMedia?new Promise((resolve,reject)=>this.pending.push({resolve,reject})):Promise.resolve();},
      pause(){this.paused=true;},
      addEventListener(name,listener){if(name==='ended')listeners.add(listener);},
      removeEventListener(name,listener){if(name==='ended')listeners.delete(listener);},
      end(){this.ended=true;this.paused=true;for(const listener of [...listeners])listener();},
      listeners(){return [...listeners];}
    };media.push(element);return element;
  };
  const audio=new NyanAudio({createContext:()=>context,createMedia,fetchAudio,onError:error=>errors.push(error),onLossVideo:()=>lossVideos.push(audio.getState())});
  return {audio,context,sources,media,errors,plays,lossVideos};
}
async function start(options){const result=setup(options);result.audio.unlock();result.audio.setRunning(true);await flush();return result;}
function audiblePlays(plays){return plays.filter(play=>!play.muted).map(play=>play.src);}

test('Nyan uses local supplied result recordings and existing gameplay recordings',()=>{
  assert.deepEqual(NYAN_AUDIO_URLS,{
    music:'./assets/audio/background.mp3',hurt:'./assets/audio/hurt.mp3',hit:'./assets/audio/hit.mp3',
    won:'./assets/audio/victory-tamek.mp3',lost:'./assets/audio/defeat-cokokrem.mp3',lostExtra:'./assets/audio/defeat-fah.mp3'
  });
  assert.equal(HURT_SECONDS,3);
});

test('every hurt loops a short sample and stops at exactly three audio-clock seconds',async()=>{
  const {audio,context,sources,media}=await start({duration:.23});
  assert.equal(await audio.playHurt(),true);
  const hurt=sources[0];assert.equal(hurt.loop,true);assert.equal(hurt.loopEnd,.23);
  assert.deepEqual(hurt.started,[11]);assert.deepEqual(hurt.stopCalls,[14]);
  assert.equal(media[0].loop,true);assert.equal(media[0].src,NYAN_AUDIO_URLS.music);
  context.tick(1);audio.setRunning(false);context.tick(50);
  assert.equal(context.currentTime,12);assert.equal(audio.getState().hurtVoices,1);
  audio.setRunning(true);context.tick(1.99);assert.equal(audio.getState().hurtVoices,1);
  context.tick(.02);assert.equal(audio.getState().hurtVoices,0);
});

test('effects need a gesture and an active duel, and both kinds have bounded overlap',async()=>{
  const {audio,sources}=setup();audio.setRunning(true);
  assert.equal(await audio.playHurt(),false);assert.equal(await audio.playHit(),false);
  audio.unlock();await flush();
  for(let i=0;i<8;i++){assert.equal(await audio.playHurt(),true);assert.equal(await audio.playHit(),true);}
  assert.equal(audio.getState().hurtVoices,3);assert.equal(audio.getState().voices,7);
  assert.equal(sources[0].ended,true);assert.equal(sources[1].ended,true);
  const hit=sources.findLast(source=>!source.loop);assert.equal(hit.stopCalls,undefined);
  audio.setRunning(false);assert.equal(await audio.playHurt(),false);
});

test('loss plays Cokokrem then Fah and requests the video only after their natural ends',async()=>{
  const {audio,media,plays,lossVideos}=await start();audio.finish('lost');
  const result=media[1];assert.equal(result.src,NYAN_AUDIO_URLS.lost);assert.equal(result.paused,false);
  assert.deepEqual(audiblePlays(plays),[NYAN_AUDIO_URLS.music,NYAN_AUDIO_URLS.lost]);
  // A dispatched event without an actually ended media element cannot advance.
  result.listeners()[0]();assert.equal(result.src,NYAN_AUDIO_URLS.lost);
  await flush();assert.equal(result.src,NYAN_AUDIO_URLS.lost);
  assert.equal(lossVideos.length,0);
  result.end();assert.equal(result.src,NYAN_AUDIO_URLS.lostExtra);assert.equal(result.paused,false);
  assert.deepEqual(audiblePlays(plays),[NYAN_AUDIO_URLS.music,NYAN_AUDIO_URLS.lost,NYAN_AUDIO_URLS.lostExtra]);
  assert.equal(lossVideos.length,0);
  const finalEnded=result.listeners()[0];finalEnded();assert.equal(lossVideos.length,0);
  result.end();assert.equal(audio.getState().outcome.completed,true);assert.equal(result.paused,true);
  assert.equal(lossVideos.length,1);assert.equal(lossVideos[0].outcome.completed,true);
  assert.equal(lossVideos[0].outcome.index,2);
  assert.equal(result.listeners().length,0);assert.equal(media[0].paused,true);
  finalEnded();result.end();audio.finish('lost');audio.setRunning(true);
  assert.equal(lossVideos.length,1);assert.equal(media[0].paused,true);
  assert.equal(plays.some(play=>play.src.includes('defeat-explosion')),false);
});

test('victory plays only the first supplied recording and stops gameplay effects',async()=>{
  const {audio,context,sources,media,plays,lossVideos}=await start();await audio.playHurt();await audio.playHit();
  audio.finish('won');audio.finish('won');
  assert.equal(audio.getState().voices,0);assert.equal(sources.every(source=>source.ended),true);
  assert.equal(context.state,'suspended');assert.equal(media[0].paused,true);
  assert.equal(media[1].src,NYAN_AUDIO_URLS.won);media[1].end();
  assert.deepEqual(audiblePlays(plays),[NYAN_AUDIO_URLS.music,NYAN_AUDIO_URLS.won]);
  assert.equal(audio.getState().outcome.completed,true);assert.equal(await audio.playHurt(),false);
  assert.equal(lossVideos.length,0);
});

test('the final player hit retains its full meow even if its download completes after loss',async()=>{
  let resolveDownload;
  const download=new Promise(resolve=>{resolveDownload=resolve;});
  const {audio,context,sources,media}=setup({fetchAudio:()=>download});
  audio.unlock();audio.setRunning(true);
  const hurt=audio.playHurt(),hit=audio.playHit();audio.finish('lost');
  resolveDownload({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  assert.equal(await hurt,true);assert.equal(await hit,false);
  assert.equal(sources.length,1);assert.deepEqual(sources[0].stopCalls,[14]);
  assert.equal(context.state,'running');assert.equal(media[0].paused,true);
  assert.equal(media[1].src,NYAN_AUDIO_URLS.lost);
  context.tick(3);assert.equal(audio.getState().hurtVoices,0);assert.equal(context.state,'suspended');
});

test('mute and page visibility freeze voices, music, and the current result clip',async()=>{
  const {audio,context,media}=await start();await audio.playHurt();context.tick(1);
  audio.setEnabled(false);context.tick(10);assert.equal(context.currentTime,12);
  assert.equal(media[0].paused,true);assert.equal(await audio.playHit(),false);
  audio.setEnabled(true);assert.equal(context.state,'running');
  audio.finish('lost');const result=media[1];result.currentTime=1.25;
  audio.setHidden(true);assert.equal(result.paused,true);assert.equal(context.state,'suspended');
  audio.setEnabled(false);audio.setEnabled(true);assert.equal(result.paused,true,'unmuting a hidden result cannot resume it');
  assert.equal(result.currentTime,1.25);audio.setHidden(false);assert.equal(result.paused,false);
  assert.equal(result.currentTime,1.25);assert.equal(context.state,'running');
  audio.setEnabled(false);result.end();assert.equal(result.src,NYAN_AUDIO_URLS.lost,'a muted ended event cannot queue the next clip');
  audio.setEnabled(true);assert.equal(result.src,NYAN_AUDIO_URLS.lost);result.end();
  assert.equal(result.src,NYAN_AUDIO_URLS.lostExtra);
});

test('mute and hiding require a resumed natural final end before requesting the video',async()=>{
  for(const gate of ['enabled','hidden']){
    const {audio,media,lossVideos}=await start();audio.finish('lost');
    const result=media[1];result.end();assert.equal(result.src,NYAN_AUDIO_URLS.lostExtra);
    const setPaused=paused=>gate==='enabled'?audio.setEnabled(!paused):audio.setHidden(paused);
    setPaused(true);assert.equal(result.paused,true);result.end();
    assert.equal(lossVideos.length,0);assert.equal(audio.getState().outcome.completed,false);
    setPaused(false);assert.equal(result.paused,false);assert.equal(lossVideos.length,0);
    result.listeners()[0]();assert.equal(lossVideos.length,0);
    result.end();assert.equal(lossVideos.length,1);assert.equal(media[0].paused,true);
  }
});

test('reset cancels pending effects and obsolete result-ended callbacks before a new duel',async()=>{
  let resolveDownload;const pending=new Promise(resolve=>{resolveDownload=resolve;});
  const {audio,sources,media,lossVideos}=setup({fetchAudio:()=>pending});audio.unlock();audio.setRunning(true);
  const oldHurt=audio.playHurt();audio.finish('lost');media[1].end();
  assert.equal(media[1].src,NYAN_AUDIO_URLS.lostExtra);const oldEnded=media[1].listeners()[0];
  audio.reset();audio.setRunning(true);resolveDownload({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  assert.equal(await oldHurt,false);assert.equal(sources.length,0);
  media[1].ended=true;oldEnded();assert.equal(audio.getState().outcome,null);
  assert.equal(lossVideos.length,0);
  assert.equal(media[1].paused,true);assert.equal(media[0].paused,false);
  assert.equal(await audio.playHurt(),true);assert.equal(audio.getState().voices,1);
  audio.reset();assert.equal(audio.getState().voices,0);assert.equal(sources[0].ended,true);
});

test('pause, mute and hiding cancel a download requested before that interruption',async()=>{
  for(const interrupt of [audio=>audio.setRunning(false),audio=>audio.setEnabled(false),audio=>audio.setHidden(true)]){
    let resolveDownload;const pending=new Promise(resolve=>{resolveDownload=resolve;});
    const {audio,sources}=setup({fetchAudio:()=>pending});audio.unlock();audio.setRunning(true);
    const oldHurt=audio.playHurt();interrupt(audio);audio.setRunning(true);audio.setEnabled(true);audio.setHidden(false);
    resolveDownload({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
    assert.equal(await oldHurt,false);assert.equal(sources.length,0);
  }
});

test('late media promises cannot resume audio after reset, hiding, or disposal',async()=>{
  const {audio,media,errors}=setup({deferMedia:true});audio.unlock();audio.setRunning(true);audio.finish('lost');
  audio.setHidden(true);for(const item of media)for(const pending of item.pending)pending.resolve();await flush();
  assert.equal(media.every(item=>item.paused),true);
  audio.setHidden(false);const result=media[1];const oldEnded=result.listeners()[0];audio.reset();
  for(const pending of result.pending)pending.resolve();await flush();assert.equal(result.paused,true);
  audio.dispose();result.ended=true;oldEnded();audio.unlock();audio.finish('lost');
  assert.equal(audio.getState().disposed,true);assert.equal(audio.getState().outcome,null);assert.equal(errors.length,0);
});

test('an outcome requested before unlock selects the right recording on the next gesture',async()=>{
  const {audio,media,plays}=setup();audio.finish('lost');audio.unlock();await flush();
  assert.equal(media[1].src,NYAN_AUDIO_URLS.lost);
  assert.deepEqual(audiblePlays(plays),[NYAN_AUDIO_URLS.lost]);
});
