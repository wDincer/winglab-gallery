import { COURSE_DESIGN } from './course-design.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const COURSE = Object.freeze({...COURSE_DESIGN.course});

// Student route data is independent from vehicle mechanics.
// Each turn changes the incoming heading over its smooth transition.
let incomingHeading=0;
const TURNS = Object.freeze(COURSE_DESIGN.turns.map(turn=>{
  const fromHeading=incomingHeading;
  incomingHeading+=(turn.direction==='left'?-1:1)*turn.angle;
  return Object.freeze({...turn,fromHeading,heading:incomingHeading});
}));

/** Signed world heading: negative is left, positive is right of north. */
export function courseHeading(distance) {
  const forward = Number.isFinite(distance) ? distance : 0;
  let heading = 0;
  for (const turn of TURNS) {
    if (forward < turn.start) return heading;
    if (forward < turn.end) {
      const t = (forward - turn.start) / (turn.end - turn.start);
      return turn.fromHeading + (turn.heading - turn.fromHeading) * t * t * (3 - 2 * t);
    }
    heading = turn.heading;
  }
  return heading;
}

// Integrate dx/d(forward) = tan(heading) once. Terrain generation makes many
// queries; lookup and interpolation keep them constant-time and deterministic.
const routeX = new Float64Array(COURSE.length + 1);
const slope = distance => Math.tan(courseHeading(distance) * Math.PI / 180);
for (let distance = 1; distance <= COURSE.length; distance++) {
  routeX[distance] = routeX[distance - 1] + (slope(distance - 1) + slope(distance)) / 2;
}

/** Centerline uses world forward distance (-z); its cross-sections stay Z-aligned. */
export function coursePoint(distance) {
  const forward = Number.isFinite(distance) ? distance : 0;
  const sample = clamp(forward, 0, COURSE.length);
  const low = Math.floor(sample), high = Math.min(COURSE.length, low + 1);
  let x = routeX[low] + (routeX[high] - routeX[low]) * (sample - low);
  if (forward > COURSE.length) x += (forward - COURSE.length) * slope(COURSE.length);
  return { x, y: 2.15 + Math.min(55, 6 + Math.max(0, forward) * 0.06), z: -forward };
}

export function getCourseTurns() { return TURNS; }

const CAVES = Object.freeze(COURSE_DESIGN.caves.map(cave=>Object.freeze({...cave})));

const BOOST_ZONES = Object.freeze(COURSE_DESIGN.boosts.map(zone=>Object.freeze({
  y:57.15,halfWidth:80,halfHeight:38,multiplier:1.45,...zone,
  x:coursePoint((zone.start+zone.end)/2).x,
})));

export function getCourseCaves() { return CAVES; }
export function getBoostZones() { return BOOST_ZONES; }

/** Sections only activate when the aircraft actually occupies their three-dimensional opening. */
export function getCourseSection(flight = {}) {
  const inactive = { cave: null, boost: null };
  if (flight?.flying !== true || ![flight.distance, flight.x, flight.altitude].every(Number.isFinite)) return inactive;
  const y = flight.altitude + 2.15;
  const centerX = coursePoint(flight.distance).x;
  const withinDistance = section => flight.distance >= section.start && flight.distance <= section.end;
  return {
    cave: CAVES.find(cave => withinDistance(cave) && Math.abs(flight.x - centerX) <= cave.halfWidth
      && y >= cave.floorY && y <= cave.ceilingY) ?? null,
    boost: BOOST_ZONES.find(zone => withinDistance(zone) && Math.abs(flight.x - centerX) <= zone.halfWidth
      && Math.abs(y - zone.y) <= zone.halfHeight + 1e-9) ?? null,
  };
}

export function courseProgress(flight = {}) {
  const forward = Number.isFinite(flight.distance) ? flight.distance : 0;
  const distance = clamp(forward, 0, COURSE.length);
  return {
    distance,
    remaining: COURSE.length - distance,
    percent: distance / COURSE.length * 100,
    finished: forward >= COURSE.length && Number.isFinite(flight.x)
      && Math.abs(flight.x - coursePoint(COURSE.length).x) <= COURSE.corridorHalfWidth && flight.flying === true,
  };
}

const GATES = Object.freeze(COURSE_DESIGN.gates.map((distance, index) => {
  const previousDistance=COURSE_DESIGN.gates[index-1]??0;
  const turn=TURNS.filter(item=>item.end>previousDistance&&item.start<distance).at(-1)??null;
  return Object.freeze({ index: index + 1, distance, ...coursePoint(distance), heading: courseHeading(distance),
    turnAngle: turn?.angle ?? 0, direction: turn?.direction ?? null, finish: distance === COURSE.length });
}));
export function getCourseGates() { return GATES; }
export function getNextCourseGate(flight = {}) {
  const distance = Number.isFinite(flight?.distance) ? flight.distance : 0;
  return GATES.find(gate => gate.distance > distance) ?? null;
}
