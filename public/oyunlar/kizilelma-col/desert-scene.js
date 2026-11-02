import * as T from './vendor/three.module.js';
import {COURSE,getCourseGates} from './course.js';
import {RULES} from './mission.js';
import {terrainHeight,terrainSurfaceHeight,TERRAIN} from './world.js';
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.72,...extra});
function part(p,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function ball(p,m,x,y,z,sx,sy,sz){const o=part(p,new T.SphereGeometry(1,16,12),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
function wing(p,points,m){const s=new T.Shape();s.moveTo(...points[0]);points.slice(1).forEach(v=>s.lineTo(...v));s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.18,bevelEnabled:false});g.rotateX(Math.PI/2);return part(p,g,m);}
function apple(){const g=new T.Group(),red=mat('#c91329',{roughness:.2,metalness:.1});ball(g,red,-.6,0,0,1.4,1.6,1.45);ball(g,red,.6,0,0,1.4,1.6,1.45);const stem=part(g,new T.CylinderGeometry(.1,.14,.8,7),mat('#674522'),0,1.7,0);stem.rotation.z=-.3;ball(g,mat('#5b8336'),.65,1.95,0,.8,.1,.33).rotation.z=.35;return g;}
function fighter(){
  const root=new T.Group(),grey=mat('#555c60',{metalness:.6,roughness:.43}),edge=mat('#747b7e',{metalness:.55}),dark=mat('#182830',{metalness:.8,roughness:.2});
  const sections=[[-10,.03,.03],[-7,.8,.55],[-3,1.55,.95],[2,1.8,1.15],[6,1.1,.8],[8,.75,.65]],v=[],idx=[];
  for(const [z,w,h]of sections)for(let i=0;i<8;i++){const a=i*Math.PI/4;v.push(Math.cos(a)*w,Math.sin(a)*h,z);}
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8;idx.push(a,b,a+8,b,b+8,a+8);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(idx);geo.computeVertexNormals();part(root,geo,grey);
  for(const side of[-1,1]){
    wing(root,[[side*1,-3],[side*8.5,4.2],[side*6.7,5.3],[side*1.1,3.5]],grey);
    wing(root,[[side*.8,-6.3],[side*3.3,-3.9],[side*2.9,-3.1],[side*1,-4.1]],edge);
    wing(root,[[side*.7,4],[side*4,7],[side*3.7,7.8],[side*.7,6.7]],grey);
    const fin=wing(root,[[0,0],[0,3.8],[2.5,2.9],[3.3,0]],grey);fin.rotation.set(-Math.PI/2,side*.18,side*-.3);fin.position.set(side*1.1,.55,4.4);
    ball(root,dark,side*1.5,-.3,-1,.4,.7,1.8);
    part(root,new T.SphereGeometry(.13,8,6),new T.MeshBasicMaterial({color:side<0?'#ff5544':'#a7ffb2'}),side*8.3,.1,4.1);
  }
  ball(root,dark,0,.8,-4.7,.65,.45,1.65);const nozzle=part(root,new T.CylinderGeometry(.7,.8,1,20,1,true),dark,0,0,8);nozzle.rotation.x=Math.PI/2;
  const exhaust=part(root,new T.ConeGeometry(.6,4,20),new T.MeshBasicMaterial({color:'#8fc3ff',transparent:true,opacity:.28,depthWrite:false}),0,0,10.3);exhaust.rotation.x=-Math.PI/2;
  const decal=document.createElement('canvas');decal.width=256;decal.height=128;const c=decal.getContext('2d');c.fillStyle='#e9e6de';c.font='700 28px Arial';c.textAlign='center';c.fillText('KIZILELMA',128,84);c.font='18px Arial';c.fillText('☾ ★',128,44);
  const badge=part(root,new T.PlaneGeometry(2.7,1.35),new T.MeshBasicMaterial({map:new T.CanvasTexture(decal),transparent:true}),0,1.18,1);badge.rotation.x=-Math.PI/2;
  return {root,exhaust};
}
function camel(){
  const root=new T.Group(),tan=mat('#ac7949'),light=mat('#c3935d'),hoof=mat('#634e37');ball(root,tan,0,4,0,2.6,1.5,1.2);ball(root,light,-.5,5,0,1.4,1.8,1.1);ball(root,tan,2,5.6,0,.64,2.7,.65).rotation.z=-.3;ball(root,light,3,7.5,0,1.25,.62,.59);ball(root,hoof,4,7.4,0,.4,.32,.45);
  for(const z of[-.48,.48]){ball(root,tan,2.5,8.1,z,.2,.45,.13);ball(root,hoof,3.1,7.7,z*.99,.1,.11,.08);}
  const legs=[];for(const x of[-1.6,1.6])for(const z of[-.7,.7]){const leg=new T.Group();leg.position.set(x,3.6,z);root.add(leg);part(leg,new T.CylinderGeometry(.18,.13,3.3,8),tan,0,-1.6,0);ball(leg,hoof,.15,-3.25,0,.43,.2,.28);legs.push(leg);}
  part(root,new T.CylinderGeometry(.08,.06,2,6),tan,-2.6,3.6,0).rotation.z=-.5;return {root,legs};
}
function bear(){
  const root=new T.Group(),fur=mat('#f4efdf'),white=mat('#fff9eb'),black=mat('#252b2b');ball(root,fur,0,3.2,0,2.3,2.15,3.5);ball(root,white,0,4.4,-2.4,1.9,1.8,1.8);ball(root,fur,0,3.9,-4,1.1,.8,1.1);ball(root,black,0,4,-4.9,.63,.48,.3);
  for(const s of[-1,1]){ball(root,white,s*1.3,5.8,-2.4,.5,.6,.4);ball(root,black,s*.91,4.9,-3.84,.16,.19,.12);for(const z of[-1.7,2]){ball(root,fur,s*1.5,1.6,z,.7,1.7,.85);ball(root,white,s*1.5,.4,z-.35,.85,.4,1.1);}}
  ball(root,white,0,3.1,3.4,.5,.5,.5);const arm=new T.Group();arm.position.set(-1.8,3.6,-1.7);root.add(arm);ball(arm,fur,0,-.7,-.2,.7,1.5,.7);return {root,arm};
}
function fish(){const g=new T.Group(),blue=mat('#68b9c6',{metalness:.42,roughness:.3});ball(g,blue,0,0,0,.65,.85,2);const tail=part(g,new T.ConeGeometry(1.1,1.5,3),blue,0,0,2);tail.rotation.x=Math.PI/2;tail.rotation.z=Math.PI/2;for(const s of[-1,1])ball(g,mat('#172d35'),s*.48,.35,-1.25,.15,.16,.16);return g;}
export function createFlightScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#dfebeb');scene.fog=new T.FogExp2('#e7ccb0',.00066);const camera=new T.PerspectiveCamera(53,1,.2,8500);scene.add(new T.HemisphereLight('#fff7e6','#bf8759',2.6));
  const sun=new T.DirectionalLight('#fff0cc',3.1);sun.position.set(-130,240,100);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,far:700});sun.shadow.bias=-.0003;scene.add(sun,sun.target);
  const terrain=new T.PlaneGeometry(TERRAIN.width,TERRAIN.depth,TERRAIN.columns,TERRAIN.rows);terrain.rotateX(-Math.PI/2);terrain.translate(TERRAIN.centerX,0,TERRAIN.centerZ);const p=terrain.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=terrainHeight(x,z);p.setY(i,y);const c=new T.Color(y>110?'#c18a5a':'#e5b77f');c.multiplyScalar(.94+.06*Math.sin(x*.01+z*.006));colors.push(c.r,c.g,c.b);}terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();part(scene,terrain,mat('#fff',{vertexColors:true}));
  part(scene,new T.BoxGeometry(26,.09,210),mat('#b59674'),0,.08,-40);for(let z=35;z>-140;z-=25)part(scene,new T.BoxGeometry(.5,.02,10),mat('#f7e8c9'),0,.14,z);
  const plane=fighter();scene.add(plane.root);const camels=[];
  for(let i=0;i<43;i++){const c=camel(),side=i%2?-1:1,d=i<5?35+i*37:160+(i-5)*95;c.baseX=side*(35+(i*29)%145);c.baseZ=-d;c.phase=i*2.3;c.root.rotation.y=side>0?.5:2.7;c.root.scale.setScalar(1.05+(i%3)*.13);scene.add(c.root);camels.push(c);}
  for(const gate of getCourseGates()){const ring=part(scene,new T.TorusGeometry(1,.018,8,80),mat('#edd6aa',{emissive:'#dca44d',emissiveIntensity:.22}),gate.x,gate.y,gate.z);ring.scale.set(gate.finish?73:62,gate.finish?39:32,1);}
  const bearModels=new Map(),apples=new Map(),fishes=new Map(),drops=new Map();
  function prune(map,ids){for(const [id,m]of map)if(!ids.has(id)){const root=m.root??m;scene.remove(root);root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});map.delete(id);}}
  const target=new T.Vector3(),desired=new T.Vector3(),look=new T.Vector3();let first=true;
  function update(s,dt=.016){
    const time=s.mission?.elapsed??s.time??0,h=(s.heading??0)*Math.PI/180,x=s.x??0,y=(s.altitude??0)+2.15,z=-(s.distance??0),ready=s.mission?.status==='ready';
    plane.root.position.set(x,y,z);plane.root.rotation.set((s.pitch??0)*Math.PI/180,-h,-(s.bank??0)*Math.PI/180,'YXZ');plane.exhaust.visible=s.speed>40;plane.exhaust.scale.y=1+(s.engineThrottle??0)*1.2;
    if(ready){desired.set(x+32,y+20,z+38);target.set(x-8,y+1,z-22);}else if(s.camera==='cockpit'){desired.set(x+Math.sin(h)*7,y+1,z-Math.cos(h)*7);target.set(x+Math.sin(h)*200,y+3,z-Math.cos(h)*200);}else{desired.set(x-Math.sin(h)*35,y+13,z+Math.cos(h)*35);target.set(x+Math.sin(h)*65,y+3,z-Math.cos(h)*65);}
    plane.root.visible=s.camera!=='cockpit'||ready;const blend=first?1:1-Math.exp(-Math.min(dt,.1)*6);camera.position.lerp(desired,blend);look.lerp(target,blend);camera.lookAt(look);first=false;sun.position.set(x-130,y+240,z+100);sun.target.position.set(x,y,z);
    for(const c of camels){c.root.visible=Math.abs(c.baseZ-z)<1700;c.root.position.set(c.baseX+Math.sin(time*.09+c.phase)*9,0,c.baseZ+Math.sin(time*.06+c.phase)*14);c.root.position.y=terrainSurfaceHeight(c.root.position.x,c.root.position.z);c.legs.forEach((l,i)=>l.rotation.z=Math.sin(time*2.2+c.phase+i*Math.PI*.85)*.32);c.root.rotation.z=Math.sin(time*4.4+c.phase)*.012;}
    const ids=new Set();for(const a of s.diamonds??[]){ids.add(a.id);let m=apples.get(a.id);if(!m){m=apple();scene.add(m);apples.set(a.id,m);}m.visible=!a.collected&&Math.abs(a.z-z)<1900;m.position.set(a.x,a.y+Math.sin(time*2+a.id)*.4,a.z);m.rotation.y=time*.7+a.id;m.scale.setScalar(2.15);}prune(apples,ids);
    for(const b of s.mission?.bears??[]){let m=bearModels.get(b.id);if(!m){m=bear();scene.add(m.root);bearModels.set(b.id,m);}m.root.position.set(b.x,terrainSurfaceHeight(b.x,b.z),b.z);m.root.visible=Math.abs(b.z-z)<1500;m.root.rotation.y=Math.atan2(x-b.x,z-b.z)+Math.PI;m.arm.rotation.x=b.throwing>0?-1.9:0;}
    const fishIds=new Set();for(const shot of s.mission?.shots??[]){fishIds.add(shot.id);let m=fishes.get(shot.id);if(!m){const root=new T.Group(),f=fish();f.scale.setScalar(RULES.fishScale);root.add(f);const warning=part(root,new T.TorusGeometry(6,.22,6,32),new T.MeshBasicMaterial({color:'#ef553b',transparent:true,opacity:.8}));warning.rotation.x=Math.PI/2;m={root,fish:f,warning};scene.add(root);fishes.set(shot.id,m);}const p=shot.age<0?shot.target:shot.position;m.root.position.set(p.x,p.y,p.z);m.fish.visible=shot.age>=0;m.warning.visible=shot.age<0;m.warning.scale.setScalar(1+Math.sin(time*15)*.15);if(shot.age>=0){m.fish.lookAt(shot.target.x-p.x,shot.target.y-p.y,shot.target.z-p.z);m.fish.rotation.z+=time*8;}}prune(fishes,fishIds);
    const dropIds=new Set();for(const d of s.mission?.drops??[]){dropIds.add(d.id);let m=drops.get(d.id);if(!m){m=apple();m.scale.setScalar(2);scene.add(m);drops.set(d.id,m);}m.position.set(d.x+d.age*5,Math.max(1.7,d.y-14*d.age*d.age),d.z+d.age*8);m.rotation.z=d.age*4;}prune(drops,dropIds);renderer.render(scene,camera);
  }
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resize();return {update,resize,dispose(){const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){resources.add(o.material);for(const v of Object.values(o.material))if(v?.isTexture)resources.add(v);}});resources.forEach(r=>r.dispose());renderer.dispose();}};
}
