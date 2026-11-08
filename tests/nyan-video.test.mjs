import test from 'node:test';
import assert from 'node:assert/strict';
import {LossVideo} from '../public/oyunlar/nyan-duello/loss-video.js';

const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };
function element() {
  const listeners = new Map();
  return {
    hidden: false, attributes: new Map(), classes: new Set(),
    classList: {toggle(name, value) { if (value) this.owner.classes.add(name); else this.owner.classes.delete(name); }},
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; },
    emit(name, event = {}) { for (const listener of [...(listeners.get(name) || [])]) listener(event); },
    focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); }
  };
}
function setup({source = './assets/video/defeat.mp4', deferred = false, rejection} = {}) {
  const overlay = element(), video = element(), playButton = element(), closeButton = element(), fullscreenButton = element();
  for (const item of [overlay, video, playButton, closeButton, fullscreenButton]) item.classList.owner = item;
  const errors = [], pending = [];
  let fullscreenRequests = 0, fullscreenExits = 0;
  overlay.ownerDocument = Object.assign(element(), {fullscreenElement: null, exitFullscreen() { fullscreenExits++; this.fullscreenElement = null; return Promise.resolve(); }});
  for (const item of [video, playButton, closeButton, fullscreenButton]) item.ownerDocument = overlay.ownerDocument;
  overlay.requestFullscreen = () => { fullscreenRequests++; overlay.ownerDocument.fullscreenElement = overlay; return Promise.resolve(); };
  Object.assign(video, {
    paused: true, currentTime: 0, videoWidth: 1920, ended: false, plays: 0, pauses: 0,
    play() {
      this.plays++; this.paused = false; this.ended = false;
      if (deferred) return new Promise((resolve, reject) => pending.push({resolve() { video.paused = false; resolve(); }, reject}));
      return rejection ? Promise.reject(rejection) : Promise.resolve();
    },
    pause() { this.paused = true; this.pauses++; },
    load() {},
    end() { this.ended = true; this.paused = true; this.emit('ended'); }
  });
  const controller = new LossVideo({overlay, video, playButton, closeButton, fullscreenButton, source, onError: error => errors.push(error)});
  return {controller, overlay, video, playButton, closeButton, fullscreenButton, errors, pending,
    get fullscreenRequests() { return fullscreenRequests; }, get fullscreenExits() { return fullscreenExits; }};
}

test('a configured video opens the viewport overlay with native controls and inline playback', async () => {
  const {controller, overlay, video, playButton} = setup();
  assert.equal(overlay.hidden, true);
  assert.equal(await controller.play(), true);
  assert.equal(video.src, './assets/video/defeat.mp4');
  assert.equal(video.controls, true); assert.equal(video.playsInline, true);
  assert.equal(overlay.hidden, false); assert.equal(overlay.attributes.get('aria-hidden'), 'false');
  assert.equal(overlay.classes.has('is-visible'), true); assert.equal(playButton.hidden, true);
  assert.equal(video.paused, false); assert.equal(video.currentTime, 0);
});

test('an absent or audio-only source never opens or plays a pretend video', async () => {
  for (const source of [null, '', './reference.m4a', './sound.MP3?token=1', 'data:audio/mp4;base64,AA==']) {
    const {controller, overlay, video} = setup({source});
    assert.equal(await controller.play(), false);
    assert.equal(video.plays, 0); assert.equal(overlay.hidden, true); assert.equal(video.src, '');
    assert.equal(controller.getState().source, null);
  }
  const {controller, video} = setup({source: null});
  assert.equal(controller.setSource('./actual-video.mp4'), true);
  assert.equal(await controller.play(), true); assert.equal(video.src, './actual-video.mp4');
  controller.setSource(null); assert.equal(video.paused, true); assert.equal(controller.getState().visible, false);
});

test('reset cancels a pending play and late fulfillment cannot revive the scene', async () => {
  const {controller, video, overlay, pending, playButton, errors} = setup({deferred: true});
  const oldPlay = controller.play(); video.currentTime = 8;
  controller.reset(); pending[0].resolve();
  assert.equal(await oldPlay, false); assert.equal(video.paused, true); assert.equal(video.currentTime, 0);
  assert.equal(overlay.hidden, true); assert.equal(playButton.hidden, true); assert.deepEqual(errors, []);
  const nextPlay = controller.play(); pending[1].resolve();
  assert.equal(await nextPlay, true); assert.equal(video.paused, false);
});

test('late rejected play cannot add a retry button after reset or disrupt a newer play', async () => {
  const {controller, video, overlay, pending, playButton, errors} = setup({deferred: true});
  const oldPlay = controller.play(); controller.reset(); const nextPlay = controller.play();
  pending[1].resolve(); assert.equal(await nextPlay, true);
  pending[0].reject(new Error('obsolete play')); assert.equal(await oldPlay, false);
  assert.equal(video.paused, false); assert.equal(overlay.hidden, false); assert.equal(playButton.hidden, true);
  assert.deepEqual(errors, []);
});

test('visibility freezes and resumes the same video position only when playback was wanted', async () => {
  const {controller, video, overlay} = setup();
  controller.setHidden(true); controller.setHidden(false); assert.equal(video.plays, 0);
  await controller.play(); video.currentTime = 6.25;
  controller.setHidden(true); assert.equal(video.paused, true); assert.equal(overlay.hidden, false);
  controller.setEnabled(false); controller.setEnabled(true); assert.equal(video.paused, true);
  controller.setHidden(false); await flush(); assert.equal(video.paused, false); assert.equal(video.currentTime, 6.25);
  video.pause(); const plays = video.plays;
  controller.setHidden(true); controller.setHidden(false); await flush(); assert.equal(video.plays, plays, 'a native-controls pause remains paused');
  controller.reset(); controller.setHidden(true); controller.setHidden(false); assert.equal(video.plays, plays);
});

test('a play requested while hidden waits, and stale fulfillment while hidden stays paused', async () => {
  const {controller, video, pending, playButton} = setup({deferred: true});
  controller.setHidden(true); assert.equal(await controller.play(), false); assert.equal(video.plays, 0);
  controller.setHidden(false); assert.equal(video.plays, 1);
  controller.setHidden(true); pending[0].resolve(); await flush(); assert.equal(video.paused, true);
  assert.equal(playButton.hidden, true);
  controller.setHidden(false); pending[1].resolve(); await flush(); assert.equal(video.paused, false);
});

test('autoplay rejection exposes one gesture retry and does not automatically repeat', async () => {
  const denial = Object.assign(new Error('gesture required'), {name: 'NotAllowedError'});
  const {controller, video, playButton, errors} = setup({rejection: denial});
  assert.equal(await controller.play(), false); assert.equal(playButton.hidden, false); assert.equal(video.plays, 1);
  controller.setHidden(true); controller.setHidden(false); await flush(); assert.equal(video.plays, 1);
  video.play = function () { this.plays++; this.paused = false; return Promise.resolve(); };
  playButton.emit('click'); await flush(); assert.equal(video.plays, 2); assert.equal(playButton.hidden, true);
  assert.deepEqual(errors, []);
});

test('sound preference only mutes the video and survives reset', async () => {
  const {controller, video} = setup(); controller.setEnabled(false);
  assert.equal(await controller.play(), true); assert.equal(video.muted, true); assert.equal(video.paused, false);
  controller.setEnabled(true); assert.equal(video.muted, false);
  controller.setEnabled(false); controller.reset(); await controller.play(); assert.equal(video.muted, true);
});

test('natural end and close return to the result behind the overlay', async () => {
  const {controller, video, overlay, closeButton} = setup();
  await controller.play(); video.emit('ended'); assert.equal(overlay.hidden, false, 'an obsolete event cannot close active playback');
  video.end(); assert.equal(overlay.hidden, true); assert.equal(video.currentTime, 0);
  await controller.play(); closeButton.emit('click'); assert.equal(overlay.hidden, true); assert.equal(video.paused, true);
  assert.equal(controller.getState().wantedPlaying, false);
});

test('Escape closes playback and restores the element focused before playback', async () => {
  const {controller, overlay, closeButton} = setup();
  const trigger = element(); trigger.ownerDocument = overlay.ownerDocument; trigger.focus();
  await controller.play(); assert.equal(overlay.ownerDocument.activeElement, closeButton);
  overlay.ownerDocument.emit('keydown', {key: 'Escape'});
  assert.equal(overlay.hidden, true); assert.equal(overlay.ownerDocument.activeElement, trigger);
});

test('Fullscreen API is used only by its button and reset exits it', async () => {
  const result = setup(); const {controller, fullscreenButton, overlay} = result;
  fullscreenButton.emit('click'); assert.equal(result.fullscreenRequests, 0);
  await controller.play(); assert.equal(result.fullscreenRequests, 0, 'viewport playback never demands browser fullscreen');
  fullscreenButton.emit('click'); assert.equal(result.fullscreenRequests, 1); assert.equal(overlay.ownerDocument.fullscreenElement, overlay);
  controller.reset(); assert.equal(result.fullscreenExits, 1);
  overlay.ownerDocument.fullscreenElement = element();
  await controller.play(); controller.reset();
  assert.equal(result.fullscreenExits, 1, 'a pre-existing game fullscreen belongs to the game');
});

test('a fullscreen request resolving after close exits only the video overlay', async () => {
  const result = setup(); const {controller, fullscreenButton, overlay} = result;
  let resolveFullscreen;
  overlay.requestFullscreen = () => new Promise(resolve => { resolveFullscreen = () => { overlay.ownerDocument.fullscreenElement = overlay; resolve(); }; });
  await controller.play(); fullscreenButton.emit('click'); controller.reset(); resolveFullscreen(); await flush();
  assert.equal(result.fullscreenExits, 1); assert.equal(overlay.ownerDocument.fullscreenElement, null);
});

test('audio-only metadata and loading failures close the overlay', async () => {
  const {controller, video, overlay, errors} = setup(); await controller.play();
  video.videoWidth = 0; video.emit('loadedmetadata'); assert.equal(overlay.hidden, true); assert.equal(errors.length, 1);
  video.videoWidth = 1920; await controller.play(); video.error = new Error('broken video'); video.emit('error');
  assert.equal(overlay.hidden, true); assert.equal(errors.length, 2);
  video.readyState = 1; video.videoWidth = 0;
  assert.equal(await controller.play(), false); assert.equal(overlay.hidden, true);
  assert.equal(errors.length, 3, 'metadata loaded before play is also checked');
});

test('dispose removes every handler and late promises cannot revive playback', async () => {
  const {controller, video, overlay, playButton, closeButton, fullscreenButton, pending} = setup({deferred: true});
  const playing = controller.play(); controller.dispose(); pending[0].resolve(); assert.equal(await playing, false);
  for (const item of [video, playButton, closeButton, fullscreenButton]) assert.equal(item.listenerCount(), 0);
  assert.equal(overlay.ownerDocument.listenerCount(), 0);
  assert.equal(await controller.play(), false); assert.equal(controller.setSource('./replacement.mp4'), false);
  assert.equal(video.paused, true); assert.equal(overlay.hidden, true); assert.equal(controller.getState().disposed, true);
});
