// Shared dimensions for flight, the visible tower, hay placement and collisions.
export const COW_WORLD=Object.freeze({
  startAltitude:80,
  maxAltitude:500,
  climbRate:28,
  descentRate:20,
  tower:Object.freeze({x:0,z:0,height:80,radius:18}),
  hayCount:360,
  haySpread:1200,
});
