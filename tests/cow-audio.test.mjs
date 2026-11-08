import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CowAudio,MOO_AUDIO_URL} from '../public/oyunlar/ucan-inek/audio.js';

function setup(fetchAudio=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})){
  const sources=[];
  const context={state:'suspended',destination:{},resume(){this.state='running';return Promise.resolve();},suspend(){this.state='suspended';return Promise.resolve();},close(){this.state='closed';return Promise.resolve();},
    decodeAudioData:async()=>({duration:3}),
    createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),
    createBufferSource(){const source={connect(){},disconnect(){},start(...args){this.started=args;},stop(){this.stopped=true;this.onended?.();}};sources.push(source);return source;}
  };
  const audio=new CowAudio({createContext:()=>context,fetchAudio});
  return {audio,context,sources};
}

test('the hay pickup uses the exact supplied cow recording',async()=>{
  const bytes=await readFile(new URL('../public/oyunlar/ucan-inek/assets/cow-moo.mp3',import.meta.url));
  assert.equal(MOO_AUDIO_URL,'./assets/cow-moo.mp3');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'ea4b094d4e465628b4eb8dd8148a234309ecaacf50cd902938968c8b4706aad0');
});

test('moo requires a user gesture and a running flight; clustered pickups have bounded overlap',async()=>{
  const {audio,sources}=setup();audio.setRunning(true);
  assert.equal(await audio.playPickup(),false);
  audio.unlock();
  for(let i=0;i<5;i++)assert.equal(await audio.playPickup(),true);
  assert.equal(audio.voices.size,3);assert.equal(sources[0].stopped,true);
  assert.deepEqual(sources[4].started,[0],'play the full sample from its beginning');
});

test('pause freezes a moo and mute clears it without playing stale sounds',async()=>{
  const {audio,context,sources}=setup();audio.unlock();audio.setRunning(true);await audio.playPickup();
  audio.setRunning(false);assert.equal(context.state,'suspended');assert.equal(await audio.playPickup(),false);
  audio.setRunning(true);assert.equal(context.state,'running');assert.equal(audio.voices.size,1);
  audio.setEnabled(false);assert.equal(audio.voices.size,0);assert.equal(sources[0].stopped,true);
  assert.equal(await audio.playPickup(),false);
  audio.setEnabled(true);assert.equal(await audio.playPickup(),true);
  audio.reset();assert.equal(audio.voices.size,0);
});

test('an audio download finishing after a restart cannot play an old pickup',async()=>{
  let finish;const pending=new Promise(resolve=>{finish=resolve;});
  const {audio,sources}=setup(()=>pending);audio.unlock();audio.setRunning(true);
  const played=audio.playPickup();audio.reset();
  finish({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  assert.equal(await played,false);assert.equal(sources.length,0);
  assert.equal(await audio.playPickup(),true);
});
