// The loss scene is a real video. An absent (or known audio-only) source leaves
// the game's result screen visible until a suitable video is configured.
function videoSource(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const source = value.trim();
  if (/^data:audio\//i.test(source) || /\.(?:m4a|mp3|aac|wav|flac|opus)(?:[?#]|$)/i.test(source)) return null;
  return source;
}

export class LossVideo {
  constructor({overlay, video, playButton, closeButton, fullscreenButton, source = null, onError = () => {}}) {
    if (!overlay || !video) throw new TypeError('LossVideo requires an overlay and a video element.');
    Object.assign(this, {overlay, video, playButton, closeButton, fullscreenButton, onError});
    this.source = null;
    this.enabled = true;
    this.hidden = false;
    this.disposed = false;
    this.wantedPlaying = false;
    this.visible = false;
    this.needsGesture = false;
    this.resumeAfterHidden = false;
    this.generation = 0;
    this.attempt = 0;
    this.pendingAttempt = null;
    this.reportedError = false;
    this.previousFocus = null;
    video.controls = true;
    video.playsInline = true;
    video.muted = false;
    this.listeners = [];
    this.listen(playButton, 'click', () => {
      if (this.visible && this.wantedPlaying && !this.hidden) void this.attemptPlay();
    });
    this.listen(closeButton, 'click', () => this.reset());
    this.listen(overlay.ownerDocument, 'keydown', event => {
      if (event.key === 'Escape' && this.visible) this.reset();
    });
    this.listen(fullscreenButton, 'click', () => {
      if (!this.visible || this.disposed || !overlay.requestFullscreen) return;
      const generation = this.generation;
      try {
        Promise.resolve(overlay.requestFullscreen()).then(() => {
          if (this.disposed || !this.visible || generation !== this.generation) this.exitFullscreen();
        }, () => {});
      } catch {}
    });
    this.listen(video, 'ended', () => {
      if (this.visible && this.wantedPlaying && video.ended) this.reset();
    });
    this.listen(video, 'error', () => {
      if (!this.visible || !this.wantedPlaying) return;
      this.reportError(video.error || new Error('Video could not be loaded.'));
      this.reset();
    });
    this.listen(video, 'loadedmetadata', () => {
      if (!this.visible || !this.wantedPlaying || video.videoWidth !== 0) return;
      this.reportError(new Error('The loss scene requires a video with an image track.'));
      this.reset();
    });
    this.reset();
    if (!this.setSource(source)) video.removeAttribute?.('src');
  }

  listen(element, event, callback) {
    if (!element?.addEventListener) return;
    element.addEventListener(event, callback);
    this.listeners.push(() => element.removeEventListener(event, callback));
  }

  setSource(value) {
    if (this.disposed) return false;
    const source = videoSource(value);
    if (source === this.source) return Boolean(source);
    this.reset();
    this.source = source;
    if (source) this.video.src = source;
    else this.video.removeAttribute?.('src');
    try { this.video.load?.(); } catch {}
    return Boolean(source);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.video.muted = !this.enabled;
  }

  setHidden(hidden) {
    if (this.disposed || this.hidden === Boolean(hidden)) return;
    this.hidden = Boolean(hidden);
    if (this.hidden) {
      this.resumeAfterHidden = this.visible && this.wantedPlaying && !this.needsGesture &&
        (!this.video.paused || this.pendingAttempt !== null);
      this.attempt++;
      this.pendingAttempt = null;
      this.pause();
    } else if (this.resumeAfterHidden && this.visible && this.wantedPlaying) {
      this.resumeAfterHidden = false;
      void this.attemptPlay();
    }
  }

  play() {
    if (this.disposed || !this.source) return Promise.resolve(false);
    this.reset();
    if (this.video.readyState >= 1 && this.video.videoWidth === 0) {
      this.reportError(new Error('The loss scene requires a video with an image track.'));
      return Promise.resolve(false);
    }
    this.previousFocus = this.overlay.ownerDocument?.activeElement;
    this.wantedPlaying = true;
    this.show(true);
    this.closeButton?.focus?.({preventScroll: true});
    this.video.muted = !this.enabled;
    if (this.hidden) {
      this.resumeAfterHidden = true;
      return Promise.resolve(false);
    }
    return this.attemptPlay();
  }

  attemptPlay() {
    if (this.disposed || !this.visible || !this.wantedPlaying || this.hidden) return Promise.resolve(false);
    // Only an explicit play/retry or a visibility transition reaches this path.
    // A denied autoplay never retries itself in a loop.
    const generation = this.generation, attempt = ++this.attempt;
    this.pendingAttempt = attempt;
    this.setNeedsGesture(false);
    let started;
    try { started = this.video.play(); } catch (error) { started = Promise.reject(error); }
    return Promise.resolve(started).then(() => {
      if (!this.isCurrent(generation, attempt)) {
        this.pauseIfInactive();
        return false;
      }
      this.pendingAttempt = null;
      return true;
    }, error => {
      if (!this.isCurrent(generation, attempt)) {
        this.pauseIfInactive();
        return false;
      }
      this.pendingAttempt = null;
      this.setNeedsGesture(true);
      if (error?.name !== 'NotAllowedError') this.reportError(error);
      return false;
    });
  }

  isCurrent(generation, attempt) {
    return !this.disposed && generation === this.generation && attempt === this.attempt &&
      this.visible && this.wantedPlaying && !this.hidden;
  }

  pauseIfInactive() {
    if (this.disposed || !this.visible || !this.wantedPlaying || this.hidden) this.pause();
  }

  pause() {
    try { this.video.pause(); } catch {}
  }

  show(visible) {
    this.visible = visible;
    this.overlay.hidden = !visible;
    this.overlay.setAttribute?.('aria-hidden', String(!visible));
    this.overlay.classList?.toggle('is-visible', visible);
  }

  setNeedsGesture(needed) {
    this.needsGesture = needed;
    if (this.playButton) this.playButton.hidden = !needed;
    if (needed && this.visible) this.playButton?.focus?.({preventScroll: true});
  }

  reportError(error) {
    if (this.reportedError) return;
    this.reportedError = true;
    try { this.onError(error); } catch {}
  }

  reset() {
    const previousFocus = this.visible ? this.previousFocus : null;
    this.previousFocus = null;
    this.generation++;
    this.attempt++;
    this.pendingAttempt = null;
    this.wantedPlaying = false;
    this.resumeAfterHidden = false;
    this.reportedError = false;
    this.pause();
    try { this.video.currentTime = 0; } catch {}
    this.show(false);
    this.setNeedsGesture(false);
    this.exitFullscreen();
    if (previousFocus?.isConnected !== false) previousFocus?.focus?.({preventScroll: true});
  }

  exitFullscreen() {
    const document = this.overlay.ownerDocument;
    if (document?.fullscreenElement === this.overlay && document.exitFullscreen) {
      try { Promise.resolve(document.exitFullscreen()).catch(() => {}); } catch {}
    }
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    for (const remove of this.listeners) remove();
    this.listeners.length = 0;
  }

  getState() {
    return {source: this.source, enabled: this.enabled, hidden: this.hidden, visible: this.visible,
      wantedPlaying: this.wantedPlaying, needsGesture: this.needsGesture,
      pending: this.pendingAttempt !== null, disposed: this.disposed};
  }
}
