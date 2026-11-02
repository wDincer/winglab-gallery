import { getCourseCaves, getCourseGates } from './course.js';
import { terrainSurfaceHeight, caveSectionAt, caveCenterXAt } from './world.js';
import { EAGLE_GEOMETRY, eagleWingAngle } from './eagle-geometry.js';

// Separate airframe probes preserve wing clearance without treating the whole aircraft as a large ball.
const AIRFRAME = [
  [0, 0, 0, .8], [0, 0, -5.2, .5], [0, 0, 5.5, .35], [0, 2.8, 5.1, .3],
  [-8.8, 1.45, -.3, .3], [8.8, 1.45, -.3, .3],
  [-4.4, 1.45, -.3, .25], [4.4, 1.45, -.3, .25],
  [-1.65, -1.68, -.1, .4], [1.65, -1.68, -.1, .4], [0, -1.75, -3.65, .31],
];
const EAGLE_BODY = [
  [0, 0, 0, .72], [0, .8, -2.1, .5], [0, .8, -3.05, .22],
  [0, 0, 1.4, .55], [0, -.05, 3.15, .2],
  [-1.6, -.1, 2.8, .22], [1.6, -.1, 2.8, .22],
  [-.4, -1.2, .4, .18], [.4, -1.2, .4, .18],
];
// [outward span from shoulder, trailing distance from shoulder, radius]
const EAGLE_WING = [
  [1.4, -.3, .38], [2.8, .05, .4], [4.2, .25, .38], [5.5, .6, .35],
  [6.9, .75, .32], [8.15, .65, .18], [7.2, 1.85, .23],
  [5.5, 1.65, .25], [3.5, 1.35, .28], [3.5, -.95, .28], [6, -.55, .25],
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const radians = value => value * Math.PI / 180;
const angleDelta = (a, b) => ((b - a + 540) % 360 + 360) % 360 - 180;
const wingAngle = (state, side) => Number.isFinite(state[side]) ? state[side] : 90;

export function eagleProbes(leftAngle, rightAngle, altitude) {
  const probes = [...EAGLE_BODY];
  for (const [side, angle] of [[-1, leftAngle], [1, rightAngle]]) {
    const rotation = radians(eagleWingAngle(angle, altitude) - 90);
    for (const [span, z, radius] of EAGLE_WING) {
      probes.push([
        side * (EAGLE_GEOMETRY.shoulderX + span * Math.cos(rotation)),
        EAGLE_GEOMETRY.shoulderY + span * Math.sin(rotation),
        EAGLE_GEOMETRY.shoulderZ + z,
        radius,
      ]);
    }
  }
  return probes;
}
const GATES = getCourseGates().map(gate => ({
  ...gate,
  halfWidth: gate.finish ? 73 : 62,
  halfHeight: gate.finish ? 39 : 32,
  tubeRadius: gate.finish ? 1.35 : 1.15,
  ring: Array.from({ length: 65 }, (_, index) => {
    const angle = index * Math.PI * 2 / 64;
    return { x: gate.x + Math.cos(angle) * (gate.finish ? 73 : 62),
      y: gate.y + Math.sin(angle) * (gate.finish ? 39 : 32), z: gate.z };
  }),
}));

function edgeDistanceSquared(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const fraction = length ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / length, 0, 1) : 0;
  return (x - a[0] - dx * fraction) ** 2 + (y - a[1] - dy * fraction) ** 2;
}

function polygonLocation(x, y, polygon) {
  let inside = false, distanceSquared = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    distanceSquared = Math.min(distanceSquared, edgeDistanceSquared(x, y, a, b));
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return { inside, distanceSquared };
}

function caveContact(probe, cave) {
  const distance = -probe.z;
  const sectionDistance = clamp(distance, cave.start, cave.end);
  const longitudinalGap = Math.abs(distance - sectionDistance);
  if (longitudinalGap > probe.radius) return null;
  const radius = Math.sqrt(Math.max(0, probe.radius ** 2 - longitudinalGap ** 2));
  const lateral = probe.x - caveCenterXAt(cave, sectionDistance);
  // The visible stone floor is a 0.12 m slab centered at y=0.28.
  if (Math.abs(lateral) <= cave.halfWidth + radius && probe.y - radius <= .34
    && probe.y + radius >= .22) return 'Mağara zeminine çarptın.';

  const outer = polygonLocation(lateral, probe.y, caveSectionAt(cave, sectionDistance, true));
  if (!outer.inside && outer.distanceSquared > radius ** 2) return null;
  const inner = polygonLocation(lateral, probe.y, caveSectionAt(cave, sectionDistance));
  if (inner.inside && inner.distanceSquared > radius ** 2) return null;
  return 'Mağaranın kayalık yüzeyine çarptın.';
}

function gateContact(probe, gate) {
  if (Math.abs(probe.z - gate.z) > probe.radius + gate.tubeRadius) return false;
  for (const side of [-1, 1]) {
    const dx = Math.max(0, Math.abs(probe.x - gate.x - side * gate.halfWidth) - .6);
    const dy = Math.max(0, -probe.y, probe.y - gate.y);
    const dz = Math.max(0, Math.abs(probe.z - gate.z) - .6);
    if (dx * dx + dy * dy + dz * dz <= probe.radius ** 2) return true;
  }
  for (let i = 1; i < gate.ring.length; i++) {
    const a = gate.ring[i - 1], b = gate.ring[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const fraction = clamp(((probe.x - a.x) * dx + (probe.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const separation = (probe.x - a.x - dx * fraction) ** 2 + (probe.y - a.y - dy * fraction) ** 2
      + (probe.z - gate.z) ** 2;
    if (separation <= (probe.radius + gate.tubeRadius) ** 2) return true;
  }
  return false;
}

export function transformedProbe(local, center, heading, bank, pitch) {
  // The renderer uses Euler YXZ: local roll, then pitch, then heading.
  const roll = -radians(bank), tilt = radians(pitch), yaw = -radians(heading);
  const rolledX = Math.cos(roll) * local[0] - Math.sin(roll) * local[1];
  const rolledY = Math.sin(roll) * local[0] + Math.cos(roll) * local[1];
  const pitchedY = Math.cos(tilt) * rolledY - Math.sin(tilt) * local[2];
  const pitchedZ = Math.sin(tilt) * rolledY + Math.cos(tilt) * local[2];
  return {
    x: center.x + Math.cos(yaw) * rolledX + Math.sin(yaw) * pitchedZ,
    y: center.y + pitchedY,
    z: center.z - Math.sin(yaw) * rolledX + Math.cos(yaw) * pitchedZ,
    radius: local[3],
  };
}

/** Find the first airframe contact along a frame's entire movement, including fast boosted flight. */
export function detectCollision(previous, current) {
  if (!previous || !current || (!previous.flying && !current.flying)) return null;
  if (![previous.x, previous.distance, previous.altitude, current.x, current.distance, current.altitude].every(Number.isFinite)) return null;
  const start = { x: previous.x, y: previous.altitude + 2.15, z: -previous.distance };
  const end = { x: current.x, y: current.altitude + 2.15, z: -current.distance };
  const headingStart = Number.isFinite(previous.heading) ? previous.heading : 0;
  const bankStart = Number.isFinite(previous.bank) ? previous.bank : 0;
  const pitchStart = Number.isFinite(previous.pitch) ? previous.pitch : 0;
  const headingChange = angleDelta(headingStart, Number.isFinite(current.heading) ? current.heading : 0);
  const bankChange = angleDelta(bankStart, Number.isFinite(current.bank) ? current.bank : 0);
  const pitchChange = angleDelta(pitchStart, Number.isFinite(current.pitch) ? current.pitch : 0);
  const eagle = current.vehicle === 'eagle';
  const leftStart = wingAngle(previous, 'leftWingAngle'), rightStart = wingAngle(previous, 'rightWingAngle');
  const leftChange = wingAngle(current, 'leftWingAngle') - leftStart;
  const rightChange = wingAngle(current, 'rightWingAngle') - rightStart;
  const moved = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  const rotationSweep = radians(Math.max(Math.abs(headingChange), Math.abs(bankChange), Math.abs(pitchChange))) * 10;
  const wingSweep = eagle ? radians(Math.max(Math.abs(leftChange), Math.abs(rightChange),
    Math.abs(eagleWingAngle(leftStart + leftChange, current.altitude) - eagleWingAngle(leftStart, previous.altitude)),
    Math.abs(eagleWingAngle(rightStart + rightChange, current.altitude) - eagleWingAngle(rightStart, previous.altitude))))
    * EAGLE_GEOMETRY.wingReach : 0;
  const samples = Math.max(1, Math.ceil(Math.max(moved, rotationSweep, wingSweep) / 1.5));
  const nearCaves = getCourseCaves().filter(cave => cave.end + 10 >= Math.min(previous.distance, current.distance)
    && cave.start - 10 <= Math.max(previous.distance, current.distance));
  const nearGates = GATES.filter(gate => gate.distance + 10 >= Math.min(previous.distance, current.distance)
    && gate.distance - 10 <= Math.max(previous.distance, current.distance));

  for (let sample = 0; sample <= samples; sample++) {
    const fraction = sample / samples;
    const position = { x: lerp(start.x, end.x, fraction), y: lerp(start.y, end.y, fraction), z: lerp(start.z, end.z, fraction) };
    const heading = headingStart + headingChange * fraction;
    const bank = bankStart + bankChange * fraction, pitch = pitchStart + pitchChange * fraction;
    const probes = eagle ? eagleProbes(leftStart + leftChange * fraction, rightStart + rightChange * fraction,
      lerp(previous.altitude, current.altitude, fraction)) : AIRFRAME;
    for (const local of probes) {
      const probe = transformedProbe(local, position, heading, bank, pitch);
      if (probe.y - probe.radius <= terrainSurfaceHeight(probe.x, probe.z)) {
        return { type: 'terrain', message: 'Yere veya dağa çarptın.', position, fraction };
      }
      for (const cave of nearCaves) {
        const message = caveContact(probe, cave);
        if (message) return { type: 'cave', message, position, fraction };
      }
      for (const gate of nearGates) {
        if (gateContact(probe, gate)) return { type: 'gate', message: 'Geçiş halkasına çarptın.', position, fraction };
      }
    }
  }
  // Flight physics clamps landings to altitude zero; descending contact still counts as a crash.
  if (previous.flying && current.altitude < previous.altitude && current.altitude <= .03) {
    return { type: 'ground', message: 'Yere çarptın.', position: end, fraction: 1 };
  }
  return null;
}
