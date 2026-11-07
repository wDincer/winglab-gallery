import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, ROOMS, DUCK, touchesWall, bodyProbes, worldHeight } from '../public/oyunlar/duckrooms/rooms.js';
import { createDuck } from '../public/oyunlar/duckrooms/duck-model.js';

const control = { active: true, angle: 90, bank: 0 };
const close = (actual, expected, message, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} != ${expected}`);

function arena(walls = [], { x = 0, z = 0, heading = 0, speed = 160, flying = true } = {}) {
  const run = createRun();
  run.nextEncounter = Infinity;
  run.maze.update = () => {};
  run.maze.layout = { ...run.maze.layout, walls };
  Object.assign(run.flight, { heading, speed, flying, altitude: flying ? 10 : 0, launching: false });
  Object.assign(run.player, { x, z, y: worldHeight(run.flight.altitude) });
  return run;
}

function tick(run, dt = 1 / 60, input = control) {
  stepRun(run, input, dt);
  return run.events.includes('wall');
}

function untilImpact(run, fps) {
  for (let frame = 0; frame < 3 * fps; frame++) {
    if (tick(run, 1 / fps)) return;
    assert.equal(run.mode, 'playing');
  }
  assert.fail('the duck should reach the obstacle');
}

test('duck grows ten percent in both its visible model and collision geometry', () => {
  close(DUCK.scale, .46 * 1.1, 'shared size');
  const duck = createDuck();
  for (const dimension of ['x', 'y', 'z']) close(duck.root.scale[dimension], .46 * 1.1, `visible ${dimension} scale`);
  close(DUCK.radius, .30 * .46 * 1.1, 'body collision radius');
  const probes = bodyProbes({ x: 0, y: 1, z: 0 }, { heading: 0, bank: 0, leftWingAngle: 90, rightWingAngle: 90 });
  close(probes[2].x, (.245 + .59) * .46 * 1.1, 'extended wing collision reach');
});

for (const fps of [30, 60]) {
  test(`wall impact turns the duck around and flight continues at ${fps} FPS`, () => {
    const walls = [{ x: 0, z: -2, w: 12, d: .26, h: ROOMS.ceiling }];
    const run = arena(walls);
    untilImpact(run, fps);
    assert.equal(run.mode, 'playing');
    assert.equal(run.flight.crashed, false);
    assert.equal(run.reason, null);
    close(run.flight.heading, 180, 'automatic half turn');
    assert.ok(run.impact?.remaining > 0, 'collision starts the effect');
    assert.ok(run.player.z > -2, 'duck remains on the near side of the wall');
    assert.equal(touchesWall(run.player, run.flight, walls), false, 'duck is outside the wall after turning');
    const z = run.player.z, distance = run.travelled;
    let extraHits = 0;
    for (let frame = 0; frame < fps; frame++) {
      if (tick(run, 1 / fps)) extraHits++;
      assert.equal(run.mode, 'playing');
      assert.equal(touchesWall(run.player, run.flight, walls), false);
    }
    assert.ok(run.player.z > z + .5, 'duck immediately travels away');
    assert.ok(run.travelled > distance, 'telemetry continues');
    assert.equal(extraHits, 0, 'one collision does not retrigger while leaving');
    assert.ok(!run.impact || run.impact.remaining <= 0, 'effect clears');
  });

  test(`a wing touching a pillar also safely reverses flight at ${fps} FPS`, () => {
    const x = (.245 + .59) * DUCK.scale;
    const walls = [{ x, z: -1.5, w: .12, d: .24, h: ROOMS.ceiling }];
    const run = arena(walls);
    untilImpact(run, fps);
    assert.equal(run.mode, 'playing');
    close(run.flight.heading, 180, 'wing-triggered half turn');
    assert.ok(Math.abs(run.player.x - x) > DUCK.radius + .06, 'the body itself would clear the pillar');
    assert.equal(touchesWall(run.player, run.flight, walls), false);
    const z = run.player.z;
    for (let frame = 0; frame < fps / 2; frame++) tick(run, 1 / fps);
    assert.ok(run.player.z > z, 'wing collision leaves the player able to fly');
  });

  test(`corner impact and subsequent impacts never trap the duck at ${fps} FPS`, () => {
    const walls = [
      { x: 0, z: 0, w: .26, d: 20, h: ROOMS.ceiling },
      { x: 0, z: 0, w: 20, d: .26, h: ROOMS.ceiling },
    ];
    const run = arena(walls, { x: 1.5, z: 1.5, heading: 315 });
    untilImpact(run, fps);
    assert.equal(run.mode, 'playing');
    close(run.flight.heading, 135, 'corner half turn');
    assert.equal(touchesWall(run.player, run.flight, walls), false);
    const { x, z } = run.player;
    for (let frame = 0; frame < fps; frame++) tick(run, 1 / fps);
    assert.ok(run.player.x > x && run.player.z > z, 'duck exits the corner');
    run.flight.heading = 315;
    untilImpact(run, fps);
    assert.equal(run.mode, 'playing', 'later collisions also remain nonfatal');
    assert.equal(run.flight.crashed, false);
    assert.equal(touchesWall(run.player, run.flight, walls), false);
  });
}

test('a fast frame cannot tunnel through a thin wall', () => {
  const walls = [{ x: 0, z: -.7, w: 12, d: .1, h: ROOMS.ceiling }];
  const run = arena(walls, { speed: 1000 });
  assert.equal(tick(run, .1), true);
  assert.ok(run.player.z > -.7, 'swept collision preserves the near side');
  assert.equal(touchesWall(run.player, run.flight, walls), false);
  close(run.flight.heading, 180, 'fast-frame reversal');
  assert.equal(run.mode, 'playing');
});

test('pause and tracking loss freeze the impact effect and world state', () => {
  const run = arena([{ x: 0, z: -1, w: 12, d: .26, h: ROOMS.ceiling }]);
  untilImpact(run, 60);
  const before = structuredClone({ player: run.player, flight: run.flight, elapsed: run.elapsed, impact: run.impact });
  for (const input of [{ ...control, paused: true }, { active: false }]) {
    for (let frame = 0; frame < 60; frame++) tick(run, 1 / 60, input);
    assert.deepEqual({ player: run.player, flight: run.flight, elapsed: run.elapsed, impact: run.impact }, before);
  }
  tick(run);
  assert.ok(run.impact.remaining < before.impact.remaining, 'effect resumes when tracking resumes');
  assert.ok(run.player.z > before.player.z);
});

test('monster movement is twenty-five percent slower in every stage', () => {
  for (const [stage, expected, escaped] of [
    ['emerging', 4.3 * .75, 0],
    ['chasing', 3.4 * .75, 0],
    ['chasing', (3.4 + .65) * .75, 20],
    ['retreating', 5 * .75, 0],
  ]) {
    const run = arena([], { flying: false, speed: 0 });
    run.escaped = escaped;
    run.chaseRemaining = ROOMS.chaseSeconds;
    run.monster = { x: 20, z: 0, stage, age: 0, seen: true, path: [], repath: 0, spawnCell: { x: 2, z: 0 }, retreatAge: 0 };
    for (let frame = 0; frame < 60; frame++) tick(run);
    assert.ok(run.monster, `${stage} remains visible during movement measurement`);
    close(Math.abs(run.monster.x - 20), expected, `${stage} movement with ${escaped} previous escapes`);
    assert.equal(run.mode, 'playing');
  }
});

test('the monster can still catch the duck while wall impacts remain nonfatal', () => {
  const run = arena([], { flying: false, speed: 0 });
  run.chaseRemaining = ROOMS.chaseSeconds;
  run.monster = { x: .5, z: 0, stage: 'chasing', age: 0, seen: true, path: [], repath: 0, spawnCell: { x: 0, z: 0 } };
  tick(run);
  assert.equal(run.mode, 'lost');
  assert.equal(run.reason, 'monster');
  assert.equal(run.flight.crashed, true);
  assert.ok(run.events.includes('caught'));
});
