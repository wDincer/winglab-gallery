// All camera frames remain in this browser. Only the bundled model is loaded.
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const visible = (point, threshold = 0.45) => point && Number.isFinite(point.x)
  && Number.isFinite(point.y) && (point.visibility ?? 1) >= threshold
  && (point.presence ?? 1) >= threshold;
const bodyPower = angle => Number.isFinite(angle) ? clamp((angle - 5) / 25, 0, 1) : 0;

// Positive values place a hand above the chest, in torso-length units. The
// dead zone and hysteresis prevent a hand resting on the line from chattering.
export function chestHandControl(leftHeight,rightHeight,previous={}) {
  const tracked=Number.isFinite(leftHeight)&&Number.isFinite(rightHeight);
  return {handsTracked:tracked,
    handsAboveChest:tracked&&Math.min(leftHeight,rightHeight)>(previous.handsAboveChest ? .025 : .06),
    handsBelowChest:tracked&&Math.max(leftHeight,rightHeight)<(previous.handsBelowChest ? -.16 : -.22)};
}

// Calibrate the pilot's upright stance once; never follow an intentional lean.
// A stable window accommodates camera tilt without using arm positions as gas.
export class BodyLeanCalibration {
  constructor() { this.reset(); }
  reset() { this.neutral = null; this.samples = []; }
  update(pitch, time) {
    if (!Number.isFinite(pitch) || !Number.isFinite(time)) {
      this.samples = [];
      return {bodyLean:null,bodyThrottle:0,bodyCalibrated:this.neutral!==null,bodyCalibrationProgress:0};
    }
    if (this.neutral === null) {
      const first = this.samples[0];
      const last = this.samples[this.samples.length-1];
      if (!first || time < first.time || time-last.time>250 || Math.abs(pitch-first.pitch)>3) this.samples = [];
      this.samples.push({pitch,time});
      const elapsed = time-this.samples[0].time;
      if (elapsed < 600) return {bodyLean:null,bodyThrottle:0,bodyCalibrated:false,bodyCalibrationProgress:clamp(elapsed/600,0,1)};
      this.neutral = this.samples.reduce((sum,sample)=>sum+sample.pitch,0)/this.samples.length;
      this.samples = [];
    }
    const bodyLean = pitch-this.neutral;
    return {bodyLean,bodyThrottle:bodyPower(bodyLean),bodyCalibrated:true,bodyCalibrationProgress:1};
  }
}

/** Shoulder-to-elbow elevation relative to the torso: down 0°, T-pose 90°. */
export function measurePose(landmarks, width = 1, height = 1, worldLandmarks) {
  if (!landmarks || !(width > 0) || !(height > 0)) return null;
  const required = [11, 12, 13, 14, 15, 16, 23, 24];
  if (!required.every((index) => visible(landmarks[index]))) return null;
  const point = (index) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });
  const elevation = (shoulderIndex, elbowIndex, hipIndex) => {
    const shoulder = point(shoulderIndex), elbow = point(elbowIndex), hip = point(hipIndex);
    const torso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y };
    const arm = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
    const scale = Math.hypot(torso.x, torso.y) * Math.hypot(arm.x, arm.y);
    if (scale < 0.000001) return NaN;
    return Math.acos(clamp((torso.x * arm.x + torso.y * arm.y) / scale, -1, 1)) * 180 / Math.PI;
  };
  const leftAngle = elevation(11, 13, 23);
  const rightAngle = elevation(12, 14, 24);
  if (!Number.isFinite(leftAngle) || !Number.isFinite(rightAngle)) return null;
  // Camera-facing depth comes from MediaPipe's 3D torso, never the head,
  // wrists or apparent 2D shortening. Sideways lean therefore adds no gas.
  let bodyPitch = null;
  if ([11,12,23,24].every(index=>visible(worldLandmarks?.[index])&&Number.isFinite(worldLandmarks[index].z))) {
    const axis = key => (worldLandmarks[23][key]+worldLandmarks[24][key]-worldLandmarks[11][key]-worldLandmarks[12][key])/2;
    const dx=axis('x'),dy=axis('y'),dz=axis('z');
    const verticalPlane = Math.hypot(dx,dy);
    if (dy>.03&&Math.hypot(verticalPlane,dz)>.08) bodyPitch=Math.atan2(dz,verticalPlane)*180/Math.PI;
  }
  // A small neutral zone keeps equal arms steady; modest movements turn decisively.
  const armDifference = leftAngle - rightAngle;
  const bank = Math.sign(armDifference) * clamp((Math.abs(armDifference) - 3) / 35, 0, 1);
  const shoulderLeft = point(11), shoulderRight = point(12);
  const centerX = (shoulderLeft.x + shoulderRight.x) / 2;
  const shoulderY = (shoulderLeft.y + shoulderRight.y) / 2;
  const hipY = (point(23).y + point(24).y) / 2;
  const shoulderWidth = Math.hypot(shoulderLeft.x - shoulderRight.x, shoulderLeft.y - shoulderRight.y);
  const hipCenter={x:(point(23).x+point(24).x)/2,y:hipY};
  const torsoAxis={x:hipCenter.x-centerX,y:hipCenter.y-shoulderY};
  const torsoLengthSquared=torsoAxis.x**2+torsoAxis.y**2;
  if(torsoLengthSquared<1e-6)return null;
  const handHeight=index=>{
    const wrist=point(index);
    return .24-((wrist.x-centerX)*torsoAxis.x+(wrist.y-shoulderY)*torsoAxis.y)/torsoLengthSquared;
  };
  const leftHandHeight=handHeight(15),rightHandHeight=handHeight(16);
  // Crossed or folded hands count only near the chest, never when raised overhead.
  const wristsFolded = [15, 16].every((index) => {
    if (!visible(landmarks[index])) return false;
    const wrist = point(index);
    return Math.abs(wrist.x - centerX) < shoulderWidth * 0.6
      && wrist.y >= shoulderY - Math.abs(hipY - shoulderY) * 0.08
      && wrist.y < hipY + Math.abs(hipY - shoulderY) * 0.2;
  });
  return {
    leftAngle, rightAngle,
    angle: (leftAngle + rightAngle) / 2,
    leftHandHeight,rightHandHeight,
    ...chestHandControl(leftHandHeight,rightHandHeight),
    bank,
    bodyPitch, bodyLean:bodyPitch, bodyThrottle:bodyPower(bodyPitch),
    bodyCalibrated:false, bodyCalibrationProgress:0,
    confidence: required.reduce((sum, index) => sum + Math.min(landmarks[index].visibility ?? 1, landmarks[index].presence ?? 1), 0) / required.length,
    closed: (leftAngle < 25 && rightAngle < 25) || wristsFolded,
  };
}

const cameraError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError': case 'PermissionDeniedError':
      return 'Kamera izni verilmedi. Tarayıcıdaki kamera iznini açıp yeniden deneyin.';
    case 'NotFoundError': case 'DevicesNotFoundError':
      return 'Kamera bulunamadı. Bir kamera bağlayın veya demo modunu kullanın.';
    case 'NotReadableError': case 'TrackStartError':
      return 'Kamera başka bir uygulamada açık olabilir. Diğer uygulamayı kapatıp yeniden deneyin.';
    case 'SecurityError':
      return 'Kamera için güvenli bağlantı (HTTPS veya localhost) gerekiyor.';
    default:
      return 'Vücut takibi başlatılamadı. Bağlantınızı kontrol edip yeniden deneyin veya demo modunu kullanın.';
  }
};

export class PoseController {
  constructor({ video, canvas, onPose = () => {}, onStatus = () => {} }) {
    this.video = video;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onPose = onPose;
    this.onStatus = onStatus;
    this.stream = null;
    this.model = null;
    this.modelPromise = null;
    this.frame = 0;
    this.generation = 0;
    this.disposed = false;
    this.status = '';
    this.smoothed = null;
    this.bodyCalibration = new BodyLeanCalibration();
    this.lastVideoTime = -1;
    this.lastInference = 0;
    this.trackEnded = null;
    this.video.muted = true;
    this.video.playsInline = true;
  }

  setStatus(state, message) {
    if (this.status === `${state}:${message}`) return;
    this.status = `${state}:${message}`;
    this.onStatus({ state, message });
  }

  resetBodyCalibration() {
    this.bodyCalibration.reset();
    if (this.smoothed) {
      this.smoothed = {...this.smoothed,bodyLean:null,bodyThrottle:0,bodyCalibrated:false,bodyCalibrationProgress:0};
      this.onPose({...this.smoothed});
    }
  }

  async loadModel() {
    if (this.model) return this.model;
    if (!this.modelPromise) {
      this.modelPromise = (async () => {
        const { FilesetResolver, PoseLandmarker } = await import('./vendor/vision_bundle.mjs');
        const vision = await FilesetResolver.forVisionTasks(new URL('./vendor/wasm', import.meta.url).href);
        const options = {
          baseOptions: { modelAssetPath: new URL('./assets/pose_landmarker_lite.task', import.meta.url).href, delegate: 'GPU' },
          runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55, outputSegmentationMasks: false,
        };
        let model;
        try { model = await PoseLandmarker.createFromOptions(vision, options); }
        catch { options.baseOptions.delegate = 'CPU'; model = await PoseLandmarker.createFromOptions(vision, options); }
        if (this.disposed) { model.close(); throw new Error('Controller disposed'); }
        this.model = model;
        return model;
      })().catch((error) => { this.modelPromise = null; throw error; });
    }
    return this.modelPromise;
  }

  async start() {
    if (this.disposed) return false;
    this.stop(false);
    const generation = ++this.generation;
    this.setStatus('loading', 'Kamera ve vücut takibi hazırlanıyor…');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        const error = new Error('Insecure context'); error.name = 'SecurityError'; throw error;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
      });
      if (generation !== this.generation || this.disposed) {
        stream.getTracks().forEach((track) => track.stop()); return false;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (generation !== this.generation || this.disposed) return false;
      this.trackEnded = () => {
        if (generation !== this.generation) return;
        this.stop(false);
        this.setStatus('error', 'Kamera bağlantısı kesildi. Kamerayı yeniden başlatın.');
      };
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', this.trackEnded));
      await this.loadModel();
      if (generation !== this.generation || this.disposed) return false;
      this.lastVideoTime = -1;
      this.lastInference = 0;
      let lastFrameSeen = performance.now();
      this.setStatus('lost', 'Omuzların, ellerin ve kalçan kamerada görünsün.');
      const tick = (now) => {
        if (generation !== this.generation || this.disposed) return;
        this.frame = requestAnimationFrame(tick);
        if (now - lastFrameSeen > 700) {
          this.smoothed = null;
          this.bodyCalibration.update(null,now);
          this.onPose(null);
          this.setStatus('lost', 'Kamera görüntüsü bekleniyor…');
        }
        if (now - this.lastInference < 33 || this.video.readyState < 2 || !this.video.videoWidth) return;
        if (this.video.currentTime === this.lastVideoTime) return;
        this.lastInference = now;
        lastFrameSeen = now;
        this.lastVideoTime = this.video.currentTime;
        try {
          const result = this.model.detectForVideo(this.video, now);
          const landmarks = result.landmarks?.[0];
          const pose = measurePose(landmarks, this.video.videoWidth, this.video.videoHeight, result.worldLandmarks?.[0]);
          this.draw(landmarks);
          if (pose) {
            if (this.smoothed) {
              for (const key of ['leftAngle', 'rightAngle', 'angle', 'bank']) {
                const alpha = key === 'bank' ? 0.85 : 0.8;
                pose[key] = this.smoothed[key] + (pose[key] - this.smoothed[key]) * alpha;
              }
              if (Number.isFinite(pose.bodyPitch) && Number.isFinite(this.smoothed.bodyPitch)) pose.bodyPitch=this.smoothed.bodyPitch+(pose.bodyPitch-this.smoothed.bodyPitch)*.7;
              for(const key of ['leftHandHeight','rightHandHeight'])pose[key]=this.smoothed[key]+(pose[key]-this.smoothed[key])*.65;
            }
            Object.assign(pose,chestHandControl(pose.leftHandHeight,pose.rightHandHeight,this.smoothed??{}));
            Object.assign(pose,this.bodyCalibration.update(pose.bodyPitch,now));
            this.smoothed = pose;
            this.setStatus('tracking', 'Vücut takibi aktif');
            this.onPose({ ...pose, landmarks });
          } else {
            this.smoothed = null;
            this.bodyCalibration.update(null,now);
            this.setStatus('lost', 'Takip için bir adım geri çekil; ellerin, kolların ve kalçan görünsün.');
            this.onPose(null);
          }
        } catch (error) {
          this.stop(false);
          this.setStatus('error', cameraError(error));
        }
      };
      this.frame = requestAnimationFrame(tick);
      return true;
    } catch (error) {
      if (generation !== this.generation || this.disposed) return false;
      this.stop(false);
      this.setStatus('error', cameraError(error));
      return false;
    }
  }

  draw(landmarks) {
    const width = this.video.videoWidth, height = this.video.videoHeight;
    if (!width || !height || !this.context) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const context = this.context;
    context.clearRect(0, 0, width, height);
    if (!landmarks) return;
    context.lineWidth = Math.max(2, width / 210);
    context.lineCap = 'round';
    context.strokeStyle = '#a8ffc3';
    context.shadowColor = '#50ed8b';
    context.shadowBlur = 6;
    // The video and canvas are mirrored together in CSS. Keep source coordinates
    // here; mirroring again makes the skeleton face the opposite way to the video.
    const xy = (index) => [landmarks[index].x * width, landmarks[index].y * height];
    for (const [start, end] of CONNECTIONS) {
      if (!visible(landmarks[start], 0.35) || !visible(landmarks[end], 0.35)) continue;
      context.beginPath(); context.moveTo(...xy(start)); context.lineTo(...xy(end)); context.stroke();
    }
    context.shadowBlur = 0;
    landmarks.forEach((landmark, index) => {
      if (!visible(landmark, 0.35)) return;
      const [x, y] = xy(index);
      const important = [11, 12, 13, 14, 15, 16, 23, 24].includes(index);
      context.beginPath(); context.arc(x, y, important ? 4 : 2.5, 0, Math.PI * 2);
      context.fillStyle = important ? '#ffffff' : '#a8ffc3'; context.fill();
      if (important) { context.strokeStyle = '#28bd74'; context.lineWidth = 1.5; context.stroke(); }
    });
  }

  stop(announce = true) {
    ++this.generation;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        if (this.trackEnded) track.removeEventListener('ended', this.trackEnded);
        track.stop();
      }
    }
    this.trackEnded = null;
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.smoothed = null;
    this.bodyCalibration.reset();
    this.onPose(null);
    if (announce) this.setStatus('off', 'Kamera kapalı');
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.model?.close();
    this.model = null;
  }
}
