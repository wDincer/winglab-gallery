import { COURSE, coursePoint } from './course.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const TERRAIN = Object.freeze({
  width: 14000, depth: 16000, columns: 280, rows: 320, centerX: 0, centerZ: -6000,
});
export const CAVE_ARCH_STEPS = 24;

export const coastAt = z => 6200 + 330 * Math.sin(z * .00048) + 120 * Math.sin(z * .0014);

export function smooth(a, b, value) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Analytic heights sampled by the visible terrain's vertices. */
export function terrainHeight(x,z){
  const lateral=Math.abs(x-coursePoint(-z).x);
  const apron=smooth(COURSE.corridorHalfWidth+80,680,lateral);
  const dunes=90+55*Math.sin(x*.003+z*.0017)+30*Math.cos(z*.004-x*.0015);
  return Math.max(0,dunes)*apron;
}

/** Height of the actual triangulated mesh, rather than an approximation of its slope. */
export function terrainSurfaceHeight(x, z) {
  const minX = TERRAIN.centerX - TERRAIN.width / 2;
  const minZ = TERRAIN.centerZ - TERRAIN.depth / 2;
  if (![x, z].every(Number.isFinite) || x < minX || x > minX + TERRAIN.width
    || z < minZ || z > minZ + TERRAIN.depth) return -1.6;
  const cellX = TERRAIN.width / TERRAIN.columns, cellZ = TERRAIN.depth / TERRAIN.rows;
  const gridX = (x - minX) / cellX, gridZ = (z - minZ) / cellZ;
  const column = Math.min(TERRAIN.columns - 1, Math.floor(gridX));
  const row = Math.min(TERRAIN.rows - 1, Math.floor(gridZ));
  const fx = gridX - column, fz = gridZ - row;
  const x0 = minX + column * cellX, z0 = minZ + row * cellZ;
  // Three.js stores positions in Float32Array; match those vertex heights as well.
  const h00 = Math.fround(terrainHeight(x0, z0));
  const h10 = Math.fround(terrainHeight(x0 + cellX, z0));
  const h01 = Math.fround(terrainHeight(x0, z0 + cellZ));
  if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
  const h11 = Math.fround(terrainHeight(x0 + cellX, z0 + cellZ));
  return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
}

/** A single row of the same hollow shell used to render each cave. */
export function caveSection(cave, distance, outer = false) {
  const points = [], half = outer ? 340 : cave.halfWidth;
  const wallTop = outer ? 100 : 75, roof = outer ? cave.ceilingY + 165 : cave.ceilingY;
  const rough = angle => outer
    ? 14 + 14 * Math.sin(distance * .021 + angle * 3 + cave.id)
    : 3 + 3 * Math.sin(distance * .028 + angle * 4 + cave.id);
  points.push([half, 0]);
  for (let i = 0; i <= CAVE_ARCH_STEPS; i++) {
    const angle = i * Math.PI / CAVE_ARCH_STEPS, r = rough(angle);
    points.push([Math.cos(angle) * (half + r), wallTop + (roof - wallTop + r) * Math.sin(angle)]);
  }
  points.push([-half, 0]);
  return points;
}

const caveCenters = new WeakMap();
/** Match the centers of the actual shell rows, including the bends between them. */
export function caveCenterXAt(cave, distance) {
  let centers = caveCenters.get(cave);
  if (!centers) {
    const slices = Math.max(1, Math.ceil((cave.end - cave.start) / 34));
    centers = Array.from({length:slices+1}, (_,row) =>
      coursePoint(cave.start + (cave.end - cave.start) * row / slices).x);
    caveCenters.set(cave, centers);
  }
  const forward = clamp(Number.isFinite(distance) ? distance : cave.start, cave.start, cave.end);
  const scaled = (forward - cave.start) / (cave.end - cave.start) * (centers.length - 1);
  const row = Math.min(centers.length - 2, Math.floor(scaled)), alpha = scaled - row;
  return centers[row] + (centers[row + 1] - centers[row]) * alpha;
}

/** Interpolate between rendered shell rows, so collisions follow the wavy cave walls. */
export function caveSectionAt(cave, distance, outer = false) {
  const slices = Math.max(1, Math.ceil((cave.end - cave.start) / 34));
  const forward = clamp(Number.isFinite(distance) ? distance : cave.start, cave.start, cave.end);
  const scaled = (forward - cave.start) / (cave.end - cave.start) * slices;
  const row = Math.min(slices - 1, Math.floor(scaled)), alpha = scaled - row;
  const start = caveSection(cave, cave.start + (cave.end - cave.start) * row / slices, outer);
  const end = caveSection(cave, cave.start + (cave.end - cave.start) * (row + 1) / slices, outer);
  return start.map(([x, y], index) => [x + (end[index][0] - x) * alpha, y + (end[index][1] - y) * alpha]);
}
