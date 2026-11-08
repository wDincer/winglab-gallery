import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, ROOMS, DUCK, touchesWall, sweptWall, bodyProbes, worldHeight, worldSpeed, clearSight } from '../public/oyunlar/duckrooms/rooms.js';
import { createDuck } from '../public/oyunlar/duckrooms/duck-model.js';
import { EXIT, cellAt, cellCenter } from '../public/oyunlar/duckrooms/maze.js?v=duck-exit-v1';

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
  const walls = [{ x: 0, z: -.25, w: 12, d: .01, h: ROOMS.ceiling }];
  const run = arena(walls, { speed: ROOMS.maxWorldSpeed / (.514444 * ROOMS.flightScale) });
  const beyond = { ...run.player, y: 1, z: -ROOMS.maxWorldSpeed * .1 };
  assert.equal(touchesWall(run.player, run.flight, walls), false, 'the frame starts clear');
  assert.equal(touchesWall(beyond, run.flight, walls), false, 'the intended frame ends clear beyond the wall');
  assert.equal(sweptWall(run.player, beyond, run.flight, walls), true, 'only the swept segment detects the wall');
  assert.equal(tick(run, .1), true);
  assert.ok(run.player.z > -.25, 'swept collision preserves the near side');
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

function advance(run, seconds, input = control, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) tick(run, 1 / fps, input);
}

for (const fps of [30, 60]) {
  test(`one real downstroke launches smoothly and lowered arms never land at ${fps} FPS`, () => {
    const run = arena([], { flying: false, speed: 0 });
    advance(run, 1, control, fps);
    assert.equal(run.flight.flying, false, 'a neutral pose does not bypass the first flap');
    close(run.player.y, ROOMS.floorCenter, 'ground height before the first flap');
    advance(run, .3, { ...control, angle: 145 }, fps);
    tick(run, 1 / fps, { ...control, angle: 60 });
    assert.equal(run.flight.flapCount, 1, 'the original arm gesture recognises a downstroke');
    assert.equal(run.flight.flying, true);
    assert.ok(run.player.y > ROOMS.floorCenter && run.player.y < ROOMS.floorCenter + .03, 'the first frame rises smoothly without teleporting to the hover floor');
    let previousHeight = run.player.y, locked = false;
    for (let frame = 0; frame < 3 * fps; frame++) {
      tick(run, 1 / fps, { ...control, angle: 20 });
      assert.ok(Math.abs(run.player.y - previousHeight) < .04, 'each launch/descent step remains smooth');
      if (run.airborneLocked) locked = true;
      if (locked) assert.ok(run.player.y >= ROOMS.minFlightCenter - 1e-10, 'the height floor applies after the smooth first ascent');
      previousHeight = run.player.y;
    }
    assert.equal(locked, true);
    close(run.player.y, ROOMS.minFlightCenter, 'lowered arms settle on the safe hover floor');
    const heldHeight = run.player.y;
    advance(run, 4, control, fps);
    close(run.player.y, heldHeight, 'neutral wings hold the exact height');
    const distance = run.travelled;
    advance(run, 120, { ...control, angle: 20 }, fps);
    assert.equal(run.flight.flapCount, 1, 'no further flap is needed during a long flight');
    assert.equal(run.flight.flying, true);
    assert.equal(run.hasTakenOff, true);
    assert.equal(run.flight.landings, 0);
    assert.equal(run.flight.crashed, false);
    assert.equal(run.mode, 'playing');
    close(run.player.y, ROOMS.minFlightCenter, 'no ground descent after two minutes');
    assert.ok(run.travelled > distance + 120 * ROOMS.cruiseSpeed * .514444 * ROOMS.flightScale - .01, 'even lowered arms keep the cruise-speed floor');
  });

  test(`body banking turns more tightly and releasing the bank stops yaw immediately at ${fps} FPS`, () => {
    const run = arena([], { speed: ROOMS.cruiseSpeed });
    const duration = .4;
    advance(run, duration, { ...control, bank: 1 }, fps);
    const turnRate = 38 * .42 * ROOMS.turnGain;
    close(run.flight.heading, turnRate * duration, 'direct responsive body yaw');
    assert.ok(run.flight.heading > 38 * .42 * 6.5 * duration * 1.4, 'new full-bank turn exceeds the previous gain by at least forty percent');
    assert.ok(worldSpeed(run.flight) / (turnRate * Math.PI / 180) < 1.05, 'the cruise turn radius fits comfortably inside a doorway');
    const heading = run.flight.heading;
    tick(run, 1 / fps, control);
    close(run.flight.heading, heading, 'yaw stops on the first straight-body frame');
    assert.ok(run.flight.bank > 0, 'the visible bank still eases smoothly back to level');
    advance(run, .5, control, fps);
    close(run.flight.heading, heading, 'there is no residual turn while the bank animation settles');
    tick(run, 1 / fps, { ...control, bank: -1 });
    assert.ok(run.flight.heading < heading, 'reversing body lean steers immediately');
  });

  test(`repeated flaps keep actual world speed capped at ${fps} FPS`, () => {
    const run = arena([], { flying: false, speed: 0 });
    for (let frame = 0; frame < 10 * fps; frame++) {
      const previous = { ...run.player };
      tick(run, 1 / fps, { ...control, flap: true });
      assert.ok(worldSpeed(run.flight) <= ROOMS.maxWorldSpeed + 1e-10);
      assert.ok(Math.hypot(run.player.x - previous.x, run.player.z - previous.z) <= ROOMS.maxWorldSpeed / fps + 1e-10, 'flap trains cannot exceed the actual world limit');
      assert.ok(run.flight.speed >= ROOMS.cruiseSpeed);
    }
    assert.ok(run.flight.flapCount > 20, 'the speed check covers many detected strokes');
    assert.equal(run.flight.flying, true);
    assert.ok(run.player.y <= ROOMS.maxCenter);
  });

  test(`flying the real connected route reaches the distant exit at ${fps} FPS`, () => {
    const run = createRun();
    run.nextEncounter = Infinity;
    const path = run.maze.layout.pathToExit;
    assert.ok(path.length >= 30, 'the exit is many actual rooms away');
    assert.ok(run.initialExitDistance >= 500, 'the starting route is a distant escape');
    advance(run, .3, { ...control, angle: 145 }, fps);
    tick(run, 1 / fps, control);
    assert.equal(run.flight.flapCount, 1, 'a single real downstroke launches the entire route');
    let frames = 0;
    for (const cell of path.slice(1)) {
      const target = cellCenter(cell);
      while (Math.hypot(target.x - run.player.x, target.z - run.player.z) > 1.2 && run.mode === 'playing') {
        const desiredHeading = Math.atan2(target.x - run.player.x, run.player.z - target.z) * 180 / Math.PI;
        const headingError = ((desiredHeading - run.flight.heading + 540) % 360) - 180;
        const bank = Math.max(-1, Math.min(1, headingError / (38 * .42 * ROOMS.turnGain / fps)));
        tick(run, 1 / fps, { ...control, bank });
        assert.equal(run.flight.crashed, false);
        assert.equal(run.wallHits, 0, 'the complete route passes through actual open doorways');
        assert.ok(++frames < 350 * fps, 'the actual flight reaches the goal in bounded time');
      }
      if (run.mode === 'won') break;
    }
    assert.equal(run.mode, 'won');
    assert.equal(run.reason, 'exit');
    assert.ok(run.events.includes('won'));
    assert.ok(run.travelled > 500, 'winning requires physically flying across the route');
    assert.ok(Math.hypot(run.player.x - EXIT.x, run.player.z - EXIT.z) <= EXIT.radius);
    assert.equal(run.remainingDistance, 0);
    assert.equal(run.flight.speed, 0);
    assert.equal(run.flight.flapCount, 1, 'the full escape needs only its original flap');
  });
}

test('elapsed time and accumulated travel alone cannot win from the starting room', () => {
  const run = arena([], { flying: false, speed: 0 });
  run.elapsed = 10000;
  run.travelled = 100000;
  advance(run, 1);
  assert.equal(run.mode, 'playing');
  assert.equal(run.reason, null);
  assert.ok(Math.hypot(EXIT.x, EXIT.z) > 400);
  assert.equal(run.exit, EXIT);
});

test('a fresh run faces the first legal exit-route doorway', () => {
  const run = createRun(),firstStep = run.maze.layout.pathToExit[1],start = cellAt(run.player);
  assert.ok(run.maze.neighbors(start).some(cell => cell.x === firstStep.x && cell.z === firstStep.z));
  const heading = (Math.atan2(firstStep.x - start.x, start.z - firstStep.z) * 180 / Math.PI + 360) % 360;
  close(run.flight.heading, heading, 'initial heading points toward the actual first doorway');
  assert.equal(run.flight.flying, false);
  assert.ok(Math.hypot(run.player.x - EXIT.x, run.player.z - EXIT.z) > 400, 'facing the first sign does not move the exit');
});

test('the final room keeps displaying the distance to the exit until arrival', () => {
  const run = arena([], { x: EXIT.x, z: EXIT.z + 7, speed: 78 });
  run.maze.layout.pathToExit = [EXIT.cell];
  run.maze.layout.remainingDistance = 0;
  tick(run);
  assert.equal(run.mode, 'playing');
  assert.ok(run.remainingDistance > EXIT.radius);
  close(run.remainingDistance, Math.hypot(run.player.x - EXIT.x, run.player.z - EXIT.z), 'remaining distance follows the actual exit');
});

test('a swept goal crossing wins even when both frame endpoints lie outside the exit radius', () => {
  const run = arena([], { x: EXIT.x + EXIT.radius - .005, z: EXIT.z + .24, speed: 1000 });
  assert.ok(Math.hypot(run.player.x - EXIT.x, run.player.z - EXIT.z) > EXIT.radius);
  tick(run, .1);
  assert.ok(Math.hypot(run.player.x - EXIT.x, run.player.z - EXIT.z) > EXIT.radius, 'the far endpoint alone would miss the goal');
  assert.equal(run.mode, 'won');
  assert.equal(run.reason, 'exit');
  assert.ok(run.events.includes('won'));
});

test('arrival wins before a pursuer can catch the duck and freezes the completed run', () => {
  const run = arena([], { x: EXIT.x, z: EXIT.z + EXIT.radius + .1, speed: 1000 });
  run.monster = { x: run.player.x, z: run.player.z - .2, stage: 'chasing', age: 0, seen: true, path: [], repath: 0, spawnCell: EXIT.cell };
  run.chaseRemaining = ROOMS.chaseSeconds;
  tick(run, .1);
  assert.equal(run.mode, 'won');
  assert.equal(run.reason, 'exit');
  assert.equal(run.flight.crashed, false);
  assert.ok(!run.events.includes('caught'));
  const frozen = structuredClone({ player: run.player, flight: run.flight, elapsed: run.elapsed, monster: run.monster });
  advance(run, 10, { ...control, flap: true, bank: 1 });
  assert.deepEqual({ player: run.player, flight: run.flight, elapsed: run.elapsed, monster: run.monster }, frozen);
  const reset = createRun();
  assert.equal(reset.mode, 'playing');
  assert.equal(reset.hasTakenOff, false);
  assert.equal(reset.flight.flying, false);
});

test('a wall blocks victory when the intended segment would reach the exit', () => {
  const wallZ = EXIT.z + EXIT.radius + .15;
  const run = arena([{ x: EXIT.x, z: wallZ, w: 12, d: .01, h: ROOMS.ceiling }], { x: EXIT.x, z: wallZ + .25, speed: 1000 });
  tick(run, .1);
  assert.ok(run.events.includes('wall'));
  assert.equal(run.mode, 'playing');
  assert.ok(run.player.z > wallZ);
});

test('the first monster waits for both twenty seconds and forty-five metres', () => {
  const waitingForTime = arena();
  waitingForTime.nextEncounter = ROOMS.firstEncounterAfter;
  waitingForTime.elapsed = 19;
  waitingForTime.travelled = 100;
  advance(waitingForTime, .5);
  assert.equal(waitingForTime.monster, null, 'distance alone does not unlock an early encounter');
  const waitingForDistance = arena();
  waitingForDistance.nextEncounter = ROOMS.firstEncounterAfter;
  waitingForDistance.elapsed = 30;
  advance(waitingForDistance, 1);
  assert.equal(waitingForDistance.monster, null, 'time alone does not unlock an encounter at the starting position');
  advance(waitingForTime, .6);
  assert.ok(waitingForTime.monster, 'an encounter starts after both requirements are met');
});

test('a monster emerges at least two connected rooms away outside the immediate front view', () => {
  for (const heading of [0, 90, 180, 270]) {
    const run = arena([], { heading });
    run.nextEncounter = ROOMS.firstEncounterAfter;
    run.elapsed = ROOMS.firstEncounterAfter;
    run.travelled = ROOMS.firstEncounterDistance;
    tick(run);
    assert.ok(run.monster);
    const spawn = cellCenter(run.monster.spawnCell),path = run.maze.path(cellAt(run.player), run.monster.spawnCell);
    assert.ok(path.length - 1 >= ROOMS.monsterSpawnMinRooms, 'spawn distance is counted through actual doorways');
    assert.ok(run.monster.spawnRoomsAway >= 2);
    const dx = spawn.x - run.player.x, dz = spawn.z - run.player.z, radians = heading * Math.PI / 180;
    const forward = (dx * Math.sin(radians) - dz * Math.cos(radians)) / Math.hypot(dx, dz);
    assert.ok(forward <= .15 || !clearSight(run.player, spawn, run.maze.layout.walls), 'spawn is behind/side or hidden by a wall');
    assert.equal(run.mode, 'playing');
  }
});

test('tracking loss discards an unfinished flap without changing the flight state', () => {
  const run = arena([], { flying: false, speed: 0 });
  advance(run, .3, { ...control, angle: 145 });
  const frozen = structuredClone(run.flight);
  advance(run, 1, { active: false });
  assert.deepEqual(run.flight, frozen);
  advance(run, .2, control);
  assert.equal(run.flight.flapCount, 0, 'an old raised pose cannot finish its downstroke after tracking loss');
  advance(run, .3, { ...control, angle: 145 });
  tick(run, 1 / 60, control);
  assert.equal(run.flight.flapCount, 1, 'a new complete gesture still launches normally');
});
