import test from 'node:test';
import assert from 'node:assert/strict';
import {createEagleState,stepEagle} from '../public/oyunlar/ucan-inek/eagle.js';
import {measurePose,chestHandControl} from '../public/oyunlar/ucan-inek/pose.js';

const neutral={active:true,angle:90,leftAngle:90,rightAngle:90,bank:0,handsAboveChest:false,handsBelowChest:false};
const raise={...neutral,angle:25,leftAngle:25,rightAngle:25,handsAboveChest:true};
const lower={...neutral,angle:140,leftAngle:140,rightAngle:140,handsBelowChest:true};

function advance(state,seconds,input=neutral,fps=60){
  for(let frame=0;frame<Math.round(seconds*fps);frame++)stepEagle(state,input,1/fps);
}

function cameraPose(wristY=.32){
  const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:1,presence:1}));
  for(const [index,x,y]of [[11,.4,.3],[12,.6,.3],[13,.4,.5],[14,.6,.5],[15,.42,wristY],[16,.58,wristY],[23,.4,.7],[24,.6,.7]])Object.assign(points[index],{x,y});
  return points;
}

for(const fps of [30,60]){
  test(`tower launch uses held wrists and rises smoothly to the 500m ceiling at ${fps} FPS`,()=>{
    const state=createEagleState();
    assert.equal(state.altitude,80);
    advance(state,2,neutral,fps);
    assert.equal(state.flying,false,'a neutral pose leaves the cow on the tower');
    assert.equal(state.altitude,80);
    assert.equal(state.distance,0);
    assert.equal(state.x,0);
    assert.equal(state.speed,0);
    advance(state,.1,raise,fps);
    assert.equal(state.flying,false,'a brief noisy raised frame does not launch');
    advance(state,.1,raise,fps);
    assert.equal(state.flying,true);
    assert.ok(state.altitude>80&&state.altitude<82,'takeoff has no vertical teleport');
    assert.equal(state.flapCount,0,'holding the hands up is enough without a downstroke');
    for(let frame=0;frame<20*fps;frame++){
      stepEagle(state,raise,1/fps);
      assert.ok(state.altitude<=500,'ascent never exceeds the ceiling');
    }
    assert.equal(state.altitude,500);
    assert.equal(state.verticalSpeed,0);
    assert.equal(state.flapCount,0);
    assert.equal(state.crashed,false);
  });

  test(`neutral hands hold exact altitude and lowered hands descend during forward flight at ${fps} FPS`,()=>{
    const state=createEagleState();
    advance(state,4,raise,fps);
    const height=state.altitude;
    assert.ok(height>160&&height<210);
    for(let frame=0;frame<3*fps;frame++){
      stepEagle(state,neutral,1/fps);
      assert.equal(state.altitude,height,'returning hands to chest height immediately holds altitude');
    }
    const distance=state.distance;
    advance(state,2,lower,fps);
    assert.ok(state.altitude<height-25,'lowered wrists command descent even with high elbow angles');
    assert.ok(state.distance>distance+30,'descent keeps flying forward');
    const lowerHeight=state.altitude;
    advance(state,2,neutral,fps);
    assert.equal(state.altitude,lowerHeight);
  });

  test(`the cow makes a full turn and can travel backwards along the world at ${fps} FPS`,()=>{
    const state=createEagleState();
    advance(state,1,raise,fps);
    let turned=0,backwards=false;
    for(let frame=0;frame<27*fps;frame++){
      const beforeHeading=state.heading,beforeDistance=state.distance;
      stepEagle(state,{...neutral,bank:1},1/fps);
      turned+=(state.heading-beforeHeading+360)%360;
      if(state.distance<beforeDistance)backwards=true;
      assert.equal(state.flying,true);
      assert.equal(state.crashed,false);
      assert.ok(state.heading>=0&&state.heading<360);
    }
    assert.ok(turned>360,'the controls permit a full circle');
    assert.equal(backwards,true,'forward distance can decrease after turning south');
    assert.ok(state.travelled>500);
  });
}

test('camera wrist position controls height independently of bent elbows, framing and torso roll',()=>{
  const points=cameraPose(),pose=measurePose(points,640,480);
  assert.ok(pose.leftAngle<30&&pose.rightAngle<30,'elbows remain below the shoulders');
  assert.equal(pose.handsAboveChest,true);
  assert.equal(pose.handsBelowChest,false);
  assert.equal(pose.handsTracked,true);
  const state=createEagleState();
  advance(state,2,{...pose,active:true});
  assert.equal(state.flying,true);
  assert.ok(state.altitude>110);
  assert.equal(state.flapCount,0);
  // Rotate the same body in image pixels and move/scale it inside the frame.
  const angle=.35,c=Math.cos(angle),s=Math.sin(angle);
  const transformed=points.map(p=>{
    const x=(p.x-.5)*640*.7,y=(p.y-.5)*480*.7;
    return {...p,x:(x*c-y*s+390)/640,y:(x*s+y*c+220)/480};
  });
  const rolled=measurePose(transformed,640,480);
  assert.equal(rolled.handsAboveChest,true);
  assert.ok(Math.abs(rolled.leftHandHeight-pose.leftHandHeight)<1e-10);
  assert.ok(Math.abs(rolled.rightHandHeight-pose.rightHandHeight)<1e-10);
  const chest=measurePose(cameraPose(.396),640,480);
  assert.equal(chest.handsAboveChest,false);
  assert.equal(chest.handsBelowChest,false);
  assert.equal(measurePose(cameraPose(.6),640,480).handsBelowChest,true);
});

test('occluded wrists lose tracking and pause freezes flight without storing a partial launch',()=>{
  const points=cameraPose();points[15].visibility=.2;
  assert.equal(measurePose(points,640,480),null,'elbows alone must not replace a missing hand');
  const state=createEagleState();
  advance(state,.1,raise);
  const perched=structuredClone(state);
  stepEagle(state,{active:false},.1);
  assert.deepEqual(state,perched);
  advance(state,.1,raise);
  assert.equal(state.flying,false,'tracking loss discards the partial launch hold');
  advance(state,2,raise);
  const frozen=structuredClone(state);
  stepEagle(state,{...raise,paused:true},.1);
  assert.deepEqual(state,frozen);
  stepEagle(state,{active:false},.1);
  assert.deepEqual(state,frozen);
  const restart=createEagleState();
  assert.equal(restart.altitude,80);
  assert.equal(restart.flying,false);
  assert.equal(restart.flapCount,0);
});

test('chest-height dead zone filters hand jitter and requires both hands',()=>{
  assert.equal(chestHandControl(.04,.04).handsAboveChest,false);
  assert.equal(chestHandControl(.04,.04,{handsAboveChest:true}).handsAboveChest,true);
  assert.equal(chestHandControl(.01,.04,{handsAboveChest:true}).handsAboveChest,false);
  assert.equal(chestHandControl(.3,-.3).handsAboveChest,false);
  assert.equal(chestHandControl(.3,-.3).handsBelowChest,false);
  assert.equal(chestHandControl(-.19,-.19).handsBelowChest,false);
  assert.equal(chestHandControl(-.19,-.19,{handsBelowChest:true}).handsBelowChest,true);
  assert.equal(chestHandControl(Number.NaN,.3).handsTracked,false);
});

test('an explicit flap boosts momentum while vertical movement still follows the hands',()=>{
  const state=createEagleState();
  stepEagle(state,{...neutral,flap:true},1/60);
  assert.equal(state.flying,true);
  assert.equal(state.flapCount,1);
  assert.equal(state.altitude,80,'flapping alone must not override the held-hand height control');
  advance(state,.8,neutral);
  const speed=state.speed;
  advance(state,1,neutral);
  assert.equal(state.altitude,80);
  assert.ok(state.speed>speed*.8,'gliding retains earned flap momentum');
  assert.ok(state.distance>30);
});
