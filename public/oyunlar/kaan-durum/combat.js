// Pure gameplay rules; rendering and camera inference stay outside this module.
export const LOCK_RADIUS = .17;
export const LOCK_RANGE = 950;
export const LOCK_TIME = .22;
export const SHOT_COOLDOWN = .9;

export function selectNearestTarget(targets, origin) {
  let nearest = null, best = Infinity;
  for (const target of targets) {
    if (!target.alive || target.incoming) continue;
    const distance = Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z);
    if (distance < best && distance <= LOCK_RANGE) { nearest = target; best = distance; }
  }
  return nearest ? { target: nearest, distance: best } : null;
}

export function targetIsCentered(projected) {
  return !!projected && projected.z > -1 && projected.z < 1
    && Math.hypot(projected.x,projected.y) <= LOCK_RADIUS;
}

export class TargetLock {
  constructor() { this.clear(); }
  clear() { this.id = null; this.elapsed = 0; this.locked = false; }
  update(target, projected, dt, active = true) {
    if (!active || !target || !targetIsCentered(projected)) { this.clear(); return false; }
    if (target.id !== this.id) { this.id = target.id; this.elapsed = 0; }
    this.elapsed += Math.max(0,Math.min(dt,.1));
    this.locked = this.elapsed >= LOCK_TIME;
    return this.locked;
  }
}

// A clap is an apart -> closing -> contact gesture, never a held folded pose.
// Distances use shoulder width and video aspect, so camera size does not matter.
export class ClapDetector {
  constructor() { this.reset(); }
  reset() {
    this.armed = false; this.apartSince = null; this.lastApart = -Infinity;
    this.lastClap = -Infinity; this.previous = null; this.lastTime = null;
  }
  update(landmarks, time, aspect = 1) {
    const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
      && (p.visibility ?? 1) >= .5 && (p.presence ?? 1) >= .5;
    if (!Number.isFinite(time) || ![11,12,15,16,23,24].every(i=>valid(landmarks?.[i]))) {
      this.armed=false;this.apartSince=null;this.previous=null;this.lastTime=null;
      return {clap:false,holding:false};
    }
    if (this.lastTime !== null && (time-this.lastTime>.3 || time<this.lastTime)) {
      this.armed=false;this.apartSince=null;this.previous=null;
    }
    this.lastTime=time;
    const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
    const width=distance(landmarks[11],landmarks[12]);
    if (width<.025) { this.reset();return {clap:false,holding:false}; }
    const ratio=distance(landmarks[15],landmarks[16])/width;
    const shoulderY=(landmarks[11].y+landmarks[12].y)/2;
    const hipY=(landmarks[23].y+landmarks[24].y)/2;
    const chest=[15,16].every(i=>landmarks[i].y>shoulderY-.16 && landmarks[i].y<hipY+.08);
    if (ratio>1.05) {
      this.apartSince ??= time;
      if(time-this.apartSince>=.07)this.armed=true;
      this.lastApart=time;
    } else this.apartSince=null;
    const clap=this.armed && chest && ratio<.32 && this.previous!==null
      && this.previous>ratio && time-this.lastApart<.65 && time-this.lastClap>=.9;
    if(clap) { this.lastClap=time;this.armed=false; }
    const holding=chest && ((this.armed&&ratio<1.05&&time-this.lastApart<.65) || time-this.lastClap<.65);
    if(time-this.lastApart>.65)this.armed=false;
    this.previous=ratio;
    return {clap,holding};
  }
}

export function canFire({active,locked,target,time,lastShot}) {
  return !!(active&&locked&&target?.alive&&!target.incoming&&time-lastShot>=SHOT_COOLDOWN);
}

export function advanceMissile(missile, target, dt) {
  if (!target?.alive) return 'lost';
  const dx=target.x-missile.x,dy=target.y-missile.y,dz=target.z-missile.z;
  const distance=Math.hypot(dx,dy,dz),step=155*Math.min(.1,Math.max(0,dt));
  if(distance<=step+5)return 'hit';
  missile.x+=dx/distance*step;missile.y+=dy/distance*step;missile.z+=dz/distance*step;
  return 'flying';
}

export function destroyTarget(target, score) {
  if(!target?.alive)return false;
  target.alive=false;target.incoming=false;score.destroyed++;
  return true;
}
