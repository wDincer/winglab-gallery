import * as THREE from './vendor/three.module.js';
import {COURSE,coursePoint} from './course.js';
import {BUILDINGS,BRIDGE_SOLIDS,seededRandom} from './neighborhood.js';
import {createCowModel} from './cow-model.js';

export function createFlightScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ced3ad');scene.fog=new THREE.Fog('#d9d9b4',180,1120);
  const camera=new THREE.PerspectiveCamera(53,1,.15,3800),random=seededRandom(754);
  scene.add(new THREE.HemisphereLight('#fff9de','#6a7752',2.3));
  const sun=new THREE.DirectionalLight('#fff0c5',3.1);sun.position.set(-130,230,70);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-125,right:125,top:125,bottom:-125,near:1,far:600});sun.shadow.normalBias=.08;scene.add(sun,sun.target);
  const mats=new Map(),sphere=new THREE.SphereGeometry(1,10,7),cube=new THREE.BoxGeometry(1,1,1);
  function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.9}));return mats.get(c);}
  function mesh(g,m,p=scene){const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
  function box(p,s,x,y,z,c){const o=mesh(cube,typeof c==='string'?mat(c):c,p);o.scale.set(...s);o.position.set(x,y,z);return o;}
  function ell(p,s,x,y,z,c){const o=mesh(sphere,typeof c==='string'?mat(c):c,p);o.scale.set(...s);o.position.set(x,y,z);return o;}
  function rod(p,a,b,r,c){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const o=mesh(new THREE.CylinderGeometry(r,r,d.length(),6),mat(c),p);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
  function texture(draw,size=256){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const asphalt=texture((c,s)=>{c.fillStyle='#74766b';c.fillRect(0,0,s,s);for(let i=0;i<4500;i++){c.fillStyle=random()>.5?'#88897c':'#676c61';c.fillRect(random()*s,random()*s,1,1);}});
  asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(6,6);
  const roadMat=new THREE.MeshStandardMaterial({map:asphalt,roughness:1});
  box(scene,[8000,.3,8000],0,-.24,-1200,'#8a9164');
  const roadPoints=[];for(let d=-170;d<=COURSE.length+550;d+=20)roadPoints.push(new THREE.Vector3(coursePoint(d).x,0,-d));
  function ribbon(offset,width,y,material){const p=[],idx=[];for(let i=0;i<roadPoints.length;i++){const v=roadPoints[i];p.push(v.x+offset-width/2,y,v.z,v.x+offset+width/2,y,v.z);if(i<roadPoints.length-1){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();const o=mesh(g,material);o.castShadow=false;return o;}
  ribbon(0,72,.015,roadMat);
  for(const side of[-1,1]){ribbon(side*39,6,.18,mat('#c2baa0'));ribbon(side*36.3,.7,.22,mat('#c1a483'));ribbon(side*49,13,.03,mat('#778654'));}
  const circle=mesh(new THREE.CylinderGeometry(64,64,.15,64),roadMat);circle.position.set(0,.02,32);circle.castShadow=false;
  const pavement=mesh(new THREE.TorusGeometry(65,2.3,4,64),mat('#b9b498'));pavement.rotation.x=Math.PI/2;pavement.position.set(0,.06,32);
  for(let d=75;d<COURSE.length+450;d+=32){const x=coursePoint(d).x;box(scene,[.28,.03,11],x-.65,.05,-d,'#c3ae69');box(scene,[.28,.03,11],x+.65,.05,-d,'#c3ae69');}
  const palette=['#cfbf95','#baa27d','#b29c80','#a8ad91','#d2c6ad'];
  const tiles=texture((c,s)=>{c.fillStyle='#625440';c.fillRect(0,0,s,s);c.strokeStyle='#89705a';c.lineWidth=2;for(let y=0;y<s;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(s,y);c.stroke();for(let x=0;x<s;x+=32){c.beginPath();c.moveTo(x+(y%48?16:0),y);c.lineTo(x+(y%48?16:0),y+24);c.stroke();}}});
  tiles.wrapS=tiles.wrapT=THREE.RepeatWrapping;tiles.repeat.set(3,3);const roofMat=new THREE.MeshStandardMaterial({map:tiles,color:'#bba28d',roughness:1});
  for(const b of BUILDINGS){
    const g=new THREE.Group();g.position.set(b.x,0,b.z);scene.add(g);box(g,[b.width,b.height,b.depth],0,b.height/2,0,palette[b.color]);
    const roof=mesh(new THREE.CylinderGeometry(.1,1,1,4),roofMat,g);roof.rotation.y=Math.PI/4;roof.scale.set(b.width*.76,b.roof,b.depth*.76);roof.position.y=b.height+b.roof/2;
    box(g,[b.width+2,.6,b.depth+2],0,b.height-.2,0,'#665b48');
    for(let level=0;level<Math.floor(b.height/6);level++)for(const wx of[-.29,.29]){
      box(g,[3,3.6,.2],b.width*wx,3.8+level*6,b.depth/2+.1,'#625f4f');box(g,[2.4,3,.23],b.width*wx,3.8+level*6,b.depth/2+.24,random()>.7?'#e1bc6b':'#46544f');box(g,[.12,3,.3],b.width*wx,3.8+level*6,b.depth/2+.35,'#b9b399');
      const front=-b.side;box(g,[.2,3.5,3],front*(b.width/2+.1),3.8+level*6,wx*b.depth,'#655d4a');box(g,[.23,2.8,2.4],front*(b.width/2+.24),3.8+level*6,wx*b.depth,'#53605a');
    }
    if(b.porch){const front=-b.side;box(g,[4.5,5,.4],0,2.5,b.depth/2+.3,'#4f5548');box(g,[8,.7,6],front*(b.width/2+2),4.9,0,'#817259');
      for(const dz of[-2.4,2.4])box(g,[.35,4.7,.35],front*(b.width/2+3.6),2.35,dz,'#ded2b6');box(g,[14,.4,2.2],front*(b.width/2+8),.2,0,'#b7b298');
      const fx=b.x+front*(b.width/2+13);for(const dz of[-b.depth/2-4,b.depth/2+4]){box(scene,[1,2.4,1],fx,1.2,b.z+dz,'#b8b49a');box(scene,[19,.25,.3],fx+front*9,1.2,b.z+dz,'#8c917c');}
    }
    box(g,[2,4,2],b.width*.28,b.height+1,b.depth*.2,'#8a7359');
  }
  const leafMat=mat('#49673f');leafMat.side=THREE.DoubleSide;
  function palm(x,z,h=36){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);rod(g,[0,0,0],[2,h,1],.73,'#8c8060');
    for(let i=0;i<11;i++){const a=i*Math.PI*2/11,p=[],idx=[];for(let j=0;j<=7;j++){const t=j/7,r=13*t,w=1.5*Math.sin(t*Math.PI),y=-5*t*t+2*Math.sin(t*Math.PI);p.push(Math.cos(a)*r-Math.sin(a)*w,y,Math.sin(a)*r+Math.cos(a)*w,Math.cos(a)*r+Math.sin(a)*w,y,Math.sin(a)*r-Math.cos(a)*w);if(j<7){const k=j*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();const leaf=mesh(geo,leafMat,g);leaf.position.set(2,h,1);}
    ell(g,[2.3,1.6,2.3],2,h-.3,1,'#455a3c');
    for(let y=2;y<h;y+=3){const ring=mesh(new THREE.TorusGeometry(.74,.05,3,7),mat('#a09575'),g);ring.rotation.x=Math.PI/2;ring.position.set(y/h*2,y,y/h);}
  }
  for(let d=-45;d<COURSE.length+500;d+=95){const c=coursePoint(Math.max(0,d));for(const side of[-1,1])palm(c.x+side*(53+random()*9),-d+random()*18,30+random()*18);}
  for(let d=15;d<COURSE.length+400;d+=152){const c=coursePoint(d),side=d%304<152?-1:1,x=c.x+side*41,z=-d;
    rod(scene,[x,0,z],[x,17,z],.22,'#575f53');rod(scene,[x,17,z],[x-side*5,18,z],.18,'#575f53');box(scene,[3,.5,1.3],x-side*5,17.9,z,'#e9cb7e');
    const car=new THREE.Group();car.position.set(c.x-side*29,.6,z-30);scene.add(car);box(car,[4.4,1.8,9],0,1.1,0,d%3?'#789d98':'#ac775f');box(car,[3.9,1.6,4.7],0,2.6,-.5,'#668079');box(car,[3.5,1.15,.1],0,2.6,1.9,'#354e50');
    for(const dx of[-2.15,2.15])for(const dz of[-2.8,2.8]){const w=mesh(new THREE.CylinderGeometry(.95,.95,.5,10),mat('#303931'),car);w.rotation.z=Math.PI/2;w.position.set(dx,.5,dz);}
    const wireX=c.x-side*47;rod(scene,[wireX,0,z],[wireX,22,z],.3,'#67684c');const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(wireX,21,z),new THREE.Vector3(wireX,18,z-75),new THREE.Vector3(coursePoint(d+152).x-side*47,21,z-152)]);mesh(new THREE.TubeGeometry(curve,12,.055,3),mat('#4a5143'));
  }
  // Reference-inspired concrete bridge and the distant, faceted arena.
  for(const b of BRIDGE_SOLIDS)box(scene,[b.width,b.height-b.minY,b.depth],b.x,(b.height+b.minY)/2,b.z,'#a1a38c');
  for(let x=-180;x<=180;x+=90){const arch=mesh(new THREE.TorusGeometry(43,1.5,5,24,Math.PI),mat('#737d6b'));arch.position.set(x,43,-493);}
  const arena=mesh(new THREE.CylinderGeometry(90,96,62,12),mat('#aaad91'));arena.position.set(-260,31,-760);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(scene,[4,64,5],-260+Math.sin(a)*93,32,-760+Math.cos(a)*93,'#c1baa0');}
  for(let i=0;i<50;i++){const x=(random()-.5)*1800,z=-500-random()*2600;if(Math.abs(x-coursePoint(-z).x)<260)continue;box(scene,[25+random()*35,35+random()*100,30+random()*30],x,25,z,'#a9af99');}
  function sign(text,x,y,z,width=40){const map=texture((c,s)=>{c.fillStyle='#275c47';c.fillRect(0,0,s,s);c.strokeStyle='#eae5bf';c.lineWidth=4;c.strokeRect(7,50,s-14,145);c.fillStyle='#f7f0d7';c.textAlign='center';c.font='bold 29px sans-serif';c.fillText(text,s/2,120);c.font='18px sans-serif';c.fillText('MAHALLEYE HOŞ GELDİN',s/2,160);});const board=mesh(new THREE.PlaneGeometry(width,width*.52),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));board.position.set(x,y,z);}
  sign('GROVE STREET',-66,12,-15,23);
  for(const d of[800,1600,2400]){const x=coursePoint(d).x;sign(d===2400?'FİNİŞ':'MÖÖ AIR',x,76,-d,48);for(const side of[-1,1])rod(scene,[x+side*47,0,-d],[x+side*47,82,-d],.5,'#8a947a');}
  // Merge the static neighborhood by material to keep draw calls low.
  scene.updateMatrixWorld(true);
  const buckets=new Map(),remove=[];
  scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);let bucket=buckets.get(o.material);if(!bucket){bucket={positions:[],normals:[],uvs:[]};buckets.set(o.material,bucket);}const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}g.dispose();remove.push(o);});
  for(const o of remove)o.removeFromParent();
  for(const [material,b]of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));mesh(g,material);}
  const cow=createCowModel();scene.add(cow.root);
  const hayTex=texture((c,s)=>{c.fillStyle='#cfa354';c.fillRect(0,0,s,s);for(let i=0;i<2700;i++){const x=random()*s,y=random()*s;c.strokeStyle=['#ecd08a','#b88439','#dec071','#f5dba0'][i%4];c.lineWidth=.6+random();c.beginPath();c.moveTo(x,y);c.lineTo(x+6+random()*18,y-2-random()*5);c.stroke();}});
  const hayMat=new THREE.MeshStandardMaterial({map:hayTex,color:'#f7c776',roughness:1}),hayMeshes=new Map(),plateMeshes=new Map(),bursts=[];
  function hayModel(){const g=new THREE.Group();box(g,[5.4,3.6,4],0,0,0,hayMat);for(const x of[-1.6,1.6])box(g,[.11,3.7,4.1],x,0,0,'#77673b');return g;}
  function plateModel(){const g=new THREE.Group();const dish=mesh(new THREE.CylinderGeometry(2.2,1.75,.22,24),mat('#f0f0d8'),g);dish.position.y=-.2;const rim=mesh(new THREE.TorusGeometry(2.05,.14,6,24),mat('#becdbe'),g);rim.rotation.x=Math.PI/2;rim.position.y=-.1;ell(g,[1.55,.7,1.55],0,.38,0,'#ddbd72');ell(g,[1.1,.32,1.1],0,1,0,'#926044');for(let i=0;i<7;i++){const a=i*2.4;ell(g,[.3,.25,.3],Math.cos(a)*1.15,.9,Math.sin(a)*1.15,i%2?'#e29145':'#9b9b4d');}return g;}
  const chefGroup=new THREE.Group();scene.add(chefGroup);chefGroup.visible=false;box(chefGroup,[2.9,3.5,1.6],0,2.8,0,'#f3ecda');
  for(const side of[-1,1]){box(chefGroup,[1,2.5,1],side*.75,.75,0,'#313a32');rod(chefGroup,[side*1.3,3.8,0],[side*2.2,3.7,1],.43,'#f0e9d7');}
  ell(chefGroup,[1.13,1.3,1.03],0,5.6,0,'#cfaa87');ell(chefGroup,[1.07,.47,1.05],0,6.5,0,'#453d31');
  const portrait=new THREE.TextureLoader().load('./assets/chef.jpg');portrait.colorSpace=THREE.SRGBColorSpace;
  const face=mesh(new THREE.PlaneGeometry(2.2,2.35),new THREE.MeshBasicMaterial({map:portrait,side:THREE.DoubleSide}),chefGroup);face.position.set(0,5.6,1.04);
  const uv=face.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.36+uv.getX(i)*.4,.72+uv.getY(i)*.265);uv.needsUpdate=true;
  const heldPlate=plateModel();heldPlate.position.set(1.5,4,2);heldPlate.scale.setScalar(.8);chefGroup.add(heldPlate);
  const camPos=new THREE.Vector3(),look=new THREE.Vector3();let initialized=false,pilot=false;
  function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}resize();
  function burst(h){const g=new THREE.Group();g.position.set(h.x,h.y,h.z);scene.add(g);const parts=[];for(let i=0;i<24;i++){const p=box(g,[.1+random()*.15,.15,.7+random()*1.1],0,0,0,i%3?'#f5d58a':'#c79649');p.rotation.set(random()*3,random()*3,random()*3);parts.push({p,v:new THREE.Vector3((random()-.5)*23,random()*16-2,(random()-.5)*23)});}bursts.push({g,parts,age:0});}
  function update(state,game,dt,active){
    cow.root.position.set(state.x,state.altitude+2.15,-state.distance);cow.root.rotation.order='YXZ';cow.root.rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,-state.bank*Math.PI/180);cow.update(state,dt,active);cow.root.visible=!pilot;
    const yaw=state.heading*Math.PI/180;
    const narrow=camera.aspect<.8,back=narrow?45:31,side=narrow?0:-7;
    const target=pilot?new THREE.Vector3(state.x,state.altitude+3.5,-state.distance-4):new THREE.Vector3(state.x-Math.sin(yaw)*back+side,state.altitude+(narrow?18:14.5),-state.distance+Math.cos(yaw)*back);
    const at=pilot?new THREE.Vector3(state.x+Math.sin(yaw)*80,state.altitude+3,-state.distance-Math.cos(yaw)*80):new THREE.Vector3(state.x+Math.sin(yaw)*24,state.altitude+4.5,-state.distance-Math.cos(yaw)*24);
    if(!initialized){camPos.copy(target);look.copy(at);initialized=true;}else{camPos.lerp(target,1-Math.exp(-dt*4));look.lerp(at,1-Math.exp(-dt*5));}
    camera.position.copy(camPos);camera.lookAt(look);sun.position.set(state.x-130,230,-state.distance+70);sun.target.position.set(state.x,0,-state.distance);
    const ids=new Set();for(const h of game.hay){if(h.z>-state.distance+120||h.z<-state.distance-1050)continue;ids.add(h.id);let o=hayMeshes.get(h.id);if(!o){o=hayModel();scene.add(o);hayMeshes.set(h.id,o);}o.visible=!h.collected;o.position.set(h.x,h.y+Math.sin(state.time*1.5+h.phase)*.4,h.z);o.rotation.set(.1,state.time*.2+h.phase,.08);}
    for(const [id,o]of hayMeshes)if(!ids.has(id)){scene.remove(o);hayMeshes.delete(id);}
    const pids=new Set();for(const p of game.plates){pids.add(p.id);let o=plateMeshes.get(p.id);if(!o){o=plateModel();scene.add(o);plateMeshes.set(p.id,o);}o.position.set(p.x,p.y,p.z);o.rotation.set(p.age*5,p.age*3,p.age*1.3);}
    for(const [id,o]of plateMeshes)if(!pids.has(id)){scene.remove(o);plateMeshes.delete(id);}
    for(const e of game.events)if(e.type==='hay')burst(e.hay);
    if(game.chef){const c=game.chef;chefGroup.visible=true;chefGroup.position.set(c.x,c.y,c.z);chefGroup.rotation.y=Math.atan2(c.throwDirection?.x??-c.side,c.throwDirection?.z??0);heldPlate.visible=!c.thrown;chefGroup.rotation.z=c.thrown?Math.sin(Math.min(1,(state.time-c.throwAt)*5)*Math.PI)*-.2:0;}else chefGroup.visible=false;
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];if(active)b.age+=dt;for(const {p,v}of b.parts){if(active){v.y-=dt*13;p.position.addScaledVector(v,dt);p.rotation.x+=dt*6;}p.scale.setScalar(Math.max(0,1-b.age/1.15));}if(b.age>1.15){scene.remove(b.g);bursts.splice(i,1);}}
    renderer.render(scene,camera);
  }
  return {update,resize,toggleView(){pilot=!pilot;},reset(){for(const o of hayMeshes.values())scene.remove(o);hayMeshes.clear();for(const o of plateMeshes.values())scene.remove(o);plateMeshes.clear();for(const b of bursts)scene.remove(b.g);bursts.length=0;initialized=false;},dispose(){renderer.dispose();}};
}

