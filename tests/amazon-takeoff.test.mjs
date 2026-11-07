import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, RULES, createChocolates, collectChocolates } from '../public/oyunlar/amazon-tukan/amazon-game.js';
import { groundSurface } from '../public/oyunlar/amazon-tukan/amazon-world.js';
import { measurePose } from '../public/oyunlar/amazon-tukan/pose.js';

function advance(run, seconds, input = {}, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
    stepRun(run, { active: true, angle: 90, bank: 0, ...input }, 1 / fps);
    assert.equal(run.state.crashed, false, run.crashReason);
  }
}

function measuredArms(leftAngle, rightAngle = leftAngle) {
  const landmarks = [];
  for (const [shoulder, elbow, hip, x, side, angle] of [
    [11, 13, 23, .4, -1, leftAngle], [12, 14, 24, .6, 1, rightAngle],
  ]) {
    const radians = angle * Math.PI / 180;
    landmarks[shoulder] = { x, y: .35 };
    landmarks[hip] = { x, y: .7 };
    landmarks[elbow] = { x: x + side * 100 / 640 * Math.sin(radians), y: .35 + 100 / 480 * Math.cos(radians) };
  }
  return measurePose(landmarks, 640, 480);
}

function cameraMotion(run, fps, keyframes, transform = angle => measuredArms(angle)) {
  let smoothed, nextInference = 0, pose;
  const duration = keyframes.at(-1)[0];
  for (let frame = 0; frame <= Math.ceil(duration * fps); frame++) {
    const time = frame / fps;
    if (time + 1e-9 >= nextInference) {
      const end = keyframes.findIndex(([at]) => at >= time);
      const [t1, a1] = keyframes[Math.max(0, end - 1)];
      const [t2, a2] = keyframes[end < 0 ? keyframes.length - 1 : end];
      const angle = a1 + (a2 - a1) * (t2 === t1 ? 0 : (time - t1) / (t2 - t1));
      pose = transform(angle);
      if (smoothed) {
        for (const key of ['leftAngle', 'rightAngle', 'angle', 'bank']) {
          pose[key] = smoothed[key] + (pose[key] - smoothed[key]) * (key === 'bank' ? .85 : .8);
        }
      }
      smoothed = { ...pose };
      nextInference = time + 1 / 30;
    }
    stepRun(run, { ...pose, active: true }, 1 / fps);
    assert.equal(run.state.crashed, false, `${run.crashReason} at ${time.toFixed(3)}s: ${JSON.stringify(run.state)}`);
  }
}

for (const fps of [15, 30, 60]) {
  test(`two keyboard strokes launch smoothly from the summit at ${fps} FPS`, () => {
    const run = createRun();
    advance(run, 1, {}, fps);
    stepRun(run, { active: true, angle: 90, flap: true }, 1 / fps);
    advance(run, .4, {}, fps);
    assert.equal(run.state.flapCount, 1);
    assert.equal(run.state.flying, false);
    assert.equal(run.state.altitude, RULES.startAltitude);
    assert.equal(run.state.distance, 0);
    stepRun(run, { active: true, angle: 90, flap: true }, 1 / fps);
    assert.equal(run.state.flapCount, 2);
    assert.equal(run.state.flying, true);
    assert.ok(run.state.altitude > RULES.startAltitude);
    assert.ok(run.state.altitude < RULES.startAltitude + 10, 'takeoff must not teleport');
    advance(run, 2, {}, fps);
    assert.equal(run.state.altitude, RULES.startAltitude + 100, 'both takeoff strokes contribute 50 m');
    assert.ok(run.state.distance > 80);
    const height = run.state.altitude, speed = run.state.speed;
    advance(run, 1, {}, fps);
    assert.equal(run.state.altitude, height, 'level wings hold the cleared summit height');
    assert.ok(run.state.speed > speed * .8, 'gliding retains flap momentum');
    for (const gain of [50, 100]) {
      stepRun(run, { active: true, angle: 90, flap: true }, 1 / fps);
      advance(run, 1.5, {}, fps);
      assert.equal(run.state.altitude, height + gain, 'each airborne stroke adds exactly 50 m');
    }
  });

  test(`two shoulder-height camera flaps launch with 30 Hz pose smoothing at ${fps} FPS`, () => {
    const run = createRun();
    cameraMotion(run, fps, [
      [0, 45], [.2, 45], [.45, 90], [.6, 90], [.85, 45], [1, 45],
      [1.25, 90], [1.4, 90], [1.65, 45], [1.85, 45], [2.1, 90], [3.5, 90],
    ]);
    assert.equal(run.state.flapCount, 2);
    assert.equal(run.state.flying, true);
    assert.equal(run.state.launching, false);
    assert.equal(run.state.altitude, RULES.startAltitude + 100);
    assert.ok(run.state.distance > 80);
    for (const gain of [150, 200]) {
      cameraMotion(run, fps, [
        [0, 90], [2.1, 90], [2.35, 45], [2.5, 45], [2.8, 90], [4, 90],
      ]);
      assert.equal(run.state.altitude, RULES.startAltitude + gain, 'a shoulder-height stroke after a long glide adds 50 m');
    }
    assert.equal(run.state.flapCount, 4, 'shoulder-height strokes keep working while airborne');
  });
}

test('one high-to-low downstroke never counts as two takeoff strokes', () => {
  const run = createRun();
  cameraMotion(run, 60, [[0, 90], [.25, 155], [.45, 155], [1.1, 25], [1.5, 25]]);
  assert.equal(run.state.flapCount, 1);
  assert.equal(run.state.flying, false);
  assert.equal(run.state.altitude, RULES.startAltitude);
});

test('held arms, small tracking jitter and one-arm movements do not launch', () => {
  for (const transform of [angle => measuredArms(angle), angle => measuredArms(angle, 90)]) {
    const run = createRun();
    cameraMotion(run, 30, [[0, 90], [.5, 94], [1, 86], [1.5, 92], [2, 90]], transform);
    assert.equal(run.state.flapCount, 0);
    assert.equal(run.state.flying, false);
  }
  const run = createRun();
  cameraMotion(run, 30, [[0, 90], [.3, 145], [.5, 145], [.9, 45], [1.2, 45]], angle => measuredArms(angle, 90));
  assert.equal(run.state.flapCount, 0);
});

test('pausing or losing tracking discards an unfinished stroke and restarting clears takeoff progress', () => {
  for (const inactive of [{ active: false }, { active: true, paused: true }]) {
    const run = createRun();
    advance(run, .3, { angle: 130 });
    const frozen = { ...run.state };
    stepRun(run, inactive, .1);
    assert.deepEqual(run.state, frozen);
    advance(run, .3, { angle: 45 });
    assert.equal(run.state.flapCount, 0);
    assert.equal(run.state.flying, false);
    stepRun(run, { active: true, angle: 90, flap: true }, 1 / 60);
    assert.equal(run.state.flapCount, 1);
    assert.equal(createRun().state.flapCount, 0);
  }
});

test('terrain contact still ends a flight after clearing the summit', () => {
  const run = createRun();
  Object.assign(run.state, { flying: true, launching: false, altitude: RULES.startAltitude - 3, speed: 100 });
  const events = stepRun(run, { active: true, angle: 90, bank: 0 }, 1 / 60);
  assert.equal(run.state.crashed, true);
  assert.equal(events[0]?.type, 'crash');
});

test('rapid strokes queue the full climb, obey the ceiling, and freeze while paused', () => {
  const run = createRun();
  for (let stroke = 0; stroke < 4; stroke++) {
    stepRun(run, { active: true, angle: 90, flap: true }, 1 / 60);
    advance(run, .25);
  }
  const frozen = { ...run.state };
  stepRun(run, { active: true, paused: true }, .1);
  assert.deepEqual(run.state, frozen);
  advance(run, 4);
  assert.equal(run.state.altitude, 700);
  for (let stroke = 0; stroke < 12; stroke++) {
    stepRun(run, { active: true, angle: 90, flap: true }, 1 / 60);
    advance(run, .25);
  }
  advance(run, 4);
  assert.equal(run.state.altitude, RULES.maxAltitude);
  assert.equal(run.state.climbTarget, null, 'the ceiling leaves no unfinished climb');
  advance(run, 1, { angle: 45 });
  assert.ok(run.state.altitude < RULES.maxAltitude, 'a deliberate dive still works at the ceiling');
  assert.equal(createRun().state.climbTarget, null);
});

test('chocolates cover the width, height and length of the course above the forest', () => {
  const chocolates = createChocolates();
  assert.deepEqual(chocolates, createChocolates(), 'a restart keeps the same scattered course');
  assert.equal(chocolates.length, 240);
  assert.equal(chocolates.filter(c => c.type === 'positive').length, 180);
  assert.equal(chocolates.filter(c => c.type === 'negative').length, 60);
  assert.equal(new Set(chocolates.map(c => c.z)).size, chocolates.length, 'no paired rows');
  for (const c of chocolates) {
    assert.ok(Math.abs(c.x) <= RULES.collectibleHalfWidth);
    assert.ok(c.y >= groundSurface(c.x, c.z) + 60, 'rewards clear the canopy');
    assert.ok(c.y >= RULES.collectibleMinAltitude && c.y <= RULES.collectibleMaxAltitude);
    assert.ok(-c.z > 0 && -c.z < RULES.length);
  }
  for (let third = 0; third < 3; third++) {
    const section = chocolates.filter(c => -c.z >= third * RULES.length / 3 && -c.z < (third + 1) * RULES.length / 3);
    for (const region of [c => c.x < -250, c => c.x > 250, c => c.y < 350, c => c.y > 850]) {
      assert.ok(section.filter(region).length >= 8, 'every course section has lateral and vertical variety');
    }
  }
});

test('scattered chocolates collect along swept flight paths and cannot score twice', () => {
  for (const type of ['positive', 'negative']) {
    const run = createRun();
    const c = run.chocolates.find(c => c.type === type && Math.abs(c.x) > 300 && c.y > 850);
    assert.ok(c);
    run.chocolates = [c];
    Object.assign(run.state, { flying: true, altitude: c.y - 2.15, x: c.x, distance: -c.z + 25 });
    const previous = { ...run.state, distance: -c.z - 25 };
    assert.equal(collectChocolates(run, previous).length, 1);
    assert.equal(run.score, c.points);
    assert.equal(collectChocolates(run, previous).length, 0);
  }
});
