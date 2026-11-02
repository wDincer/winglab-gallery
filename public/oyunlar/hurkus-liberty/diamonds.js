import { COURSE_DESIGN } from './course-design.js';
import { COURSE, coursePoint } from './course.js';

const PICKUP_RADIUS = 18;
const MAX_UNCOLLECTED = 35;
const MAX_ITEMS = 80;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function addDiamond(field, x, y, z) {
  const diamond = { id: field.nextId++, x, y, z, collected: false, collectedAt: null };
  field.items.push(diamond);
  return diamond;
}

export function createDiamondField() {
  const field = { items: [], total: 0, nextId: 1, nextDistance: COURSE_DESIGN.diamonds.start, previousPosition: null };
  for (let i = 0; i < 24 && field.nextDistance <= COURSE.length; i++) {
    const point = coursePoint(field.nextDistance);
    addDiamond(field, point.x, point.y, point.z);
    field.nextDistance += COURSE_DESIGN.diamonds.spacing;
  }
  return field;
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

// Test the entire movement segment, so fast flight cannot skip a small collectible.
function segmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const t = lengthSquared === 0 ? 0 : clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy + (point.z - start.z) * dz) / lengthSquared,
    0, 1,
  );
  const x = start.x + dx * t, y = start.y + dy * t, z = start.z + dz * t;
  return (point.x - x) ** 2 + (point.y - y) ** 2 + (point.z - z) ** 2;
}

function refillRoute(field, position) {
  // The course stays fixed when the pilot turns; diamonds do not create side routes.
  const aheadLimit = Math.min(COURSE.length, Math.max(0, -position.z) + 2800);
  let available = field.items.filter(diamond => !diamond.collected).length;
  while (field.nextDistance <= aheadLimit && available < MAX_UNCOLLECTED) {
    const point = coursePoint(field.nextDistance);
    addDiamond(field, point.x, point.y, point.z);
    field.nextDistance += COURSE_DESIGN.diamonds.spacing;
    available++;
  }
}

function prune(field, position, time) {
  field.items = field.items.filter((diamond) => diamond.collected
    ? time - diamond.collectedAt <= 0.8
    : distanceSquared(diamond, position) <= 3000 ** 2);
  const available = field.items.filter((diamond) => !diamond.collected);
  if (available.length > MAX_UNCOLLECTED) {
    const retain = new Set(available.sort((a, b) => distanceSquared(a, position) - distanceSquared(b, position))
      .slice(0, MAX_UNCOLLECTED).map((diamond) => diamond.id));
    field.items = field.items.filter((diamond) => diamond.collected || retain.has(diamond.id));
  }
  if (field.items.length > MAX_ITEMS) {
    // Recently collected gems may animate briefly, but never grow without a limit.
    const recent = field.items.filter((diamond) => diamond.collected)
      .sort((a, b) => b.collectedAt - a.collectedAt);
    const keep = new Set(recent.slice(0, MAX_ITEMS - Math.min(available.length, MAX_UNCOLLECTED))
      .map((diamond) => diamond.id));
    field.items = field.items.filter((diamond) => !diamond.collected || keep.has(diamond.id));
  }
}

export function updateDiamondField(field, flight, { active = true, paused = false } = {}) {
  const position = { x: flight.x, y: flight.altitude + 2.15, z: -flight.distance };
  if (!active || paused || !flight.flying || !Object.values(position).every(Number.isFinite)) {
    field.previousPosition = null;
    return [];
  }
  const time = Number.isFinite(flight.time) ? flight.time : 0;
  const start = field.previousPosition ?? position;
  const collected = [];
  for (const diamond of field.items) {
    if (!diamond.collected && segmentDistanceSquared(diamond, start, position) <= PICKUP_RADIUS ** 2) {
      diamond.collected = true;
      diamond.collectedAt = time;
      field.total++;
      collected.push(diamond);
    }
  }
  field.previousPosition = position;
  prune(field, position, time);
  refillRoute(field, position);
  prune(field, position, time);
  return collected;
}
