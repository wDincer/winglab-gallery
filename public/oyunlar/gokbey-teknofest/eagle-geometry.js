// Shared by the visible wings and their collision probes.
export const EAGLE_GEOMETRY = Object.freeze({
  shoulderX: .55, shoulderY: .55, shoulderZ: -.35,
  wingReach: 8.15, maxWingAngle: 160,
});

export function eagleWingAngle(angle, altitude = 0) {
  const safeAngle = Number.isFinite(angle) ? angle : 90;
  const height = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
  // A perched bird folds its downstroke before its feathers pass through the ground.
  // Above wing clearance the full measured arm angle is available again.
  const clearance = Math.min(1, (height + 2.15) / EAGLE_GEOMETRY.wingReach);
  const minimum = 90 - Math.asin(clearance) * 180 / Math.PI;
  return Math.max(minimum, Math.min(EAGLE_GEOMETRY.maxWingAngle, safeAngle));
}
