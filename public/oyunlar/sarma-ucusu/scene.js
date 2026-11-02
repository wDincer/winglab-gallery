import * as T from './vendor/three.module.js';
import {COURSE,coursePoint} from './course.js';
import {RING,BOOK,BUILDINGS} from './game-rules.js';
import {createBatmobile,createRobin,createBuilding,material,mesh,box,ball,rod,sign,textMap,optimize} from './models.js';

export function createFlightScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#40c7e6');scene.fog=new T.FogExp2('#44c5d8',.00115);
  const camera=new T.PerspectiveCamera(55,1,.1,5500);
  const sunlight=new T.DirectionalLight('#fff4cb',3.3);sunlight.position.set(-100,250,150);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);Object.assign(sunlight.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:1,far:700});sunlight.shadow.normalBias=.06;scene.add(sunlight,sunlight.target);
  scene.add(new T.HemisphereLight('#c4f8ff','#ad8e45',2.5));
  let seed=391;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const groundMap=(()=>{const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#e5d99b';ctx.fillRect(0,0,512,512);for(let i=0;i<3000;i++){ctx.fillStyle=i%2?'#d0c48d':'#f5e6ae';ctx.fillRect(random()*512,random()*512,1.5,1.5);}const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(65,100);return map;})();
  const floor=mesh(scene,new T.PlaneGeometry(4500,6500),material('#f1dfa9',{map:groundMap}),0,-.08,-1900);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  // One road mesh follows exactly the same centerline as the floating rings.
  const verts=[],idx=[];
  for(let i=0;i<=160;i++){const d=-180+i*(COURSE.length+700)/160,p=coursePoint(d);verts.push(p.x-36,.06,-d,p.x+36,.06,-d);if(i<160){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const roadG=new T.BufferGeometry();roadG.setAttribute('position',new T.Float32BufferAttribute(verts,3));roadG.setIndex(idx);roadG.computeVertexNormals();mesh(scene,roadG,material('#53676a'));
  const white=material('#f5f4d9'),yellow=material('#f9d258');
  for(let d=-100;d<COURSE.length+300;d+=35){const p=coursePoint(d),line=box(scene,1.1,.06,14,white,p.x,.14,p.z);line.rotation.y=-Math.atan2(coursePoint(d+5).x-p.x,5);}
  for(let d=-80;d<COURSE.length+300;d+=36)for(const s of[-1,1]){const p=coursePoint(d);box(scene,1.3,.09,29,white,p.x+s*34,.15,p.z);}
  const buildings=BUILDINGS.map(item=>{const g=createBuilding(item);scene.add(g);return g;});
  // Branch roads, coral gardens, sea plants and pebbles populate the town.
  const coralMats=['#f278a2','#ba83c7','#f6af50','#52b391'].map(c=>material(c));
  const coralGeo=new T.SphereGeometry(1,8,6),garden=new T.Group();scene.add(garden);
  for(let i=0;i<185;i++){
    const d=random()*3400-100,center=coursePoint(d).x,x=center+(random()>.5?1:-1)*(65+random()*550),z=-d;
    if(BUILDINGS.some(b=>Math.hypot(b.x-x,b.z-z)<b.radius+15))continue;
    const mat=coralMats[i%4],g=new T.Group();g.position.set(x,0,z);garden.add(g);
    for(let j=0;j<3;j++){const h=3+random()*11;rod(g,[j*1.5,0,0],[j*1.5-1,h,0],.65,mat);ball(g,1.5,mat,j*1.5-1,h,0);rod(g,[j*1.5,h*.5,0],[j*1.5+3,h*.8,0],.65,mat);}
    const rock=mesh(g,coralGeo,material('#9a9997'));rock.scale.set(3,1.4,2.5);
  }
  optimize(garden);
  const townSign=new T.Group();scene.add(townSign);townSign.position.set(-77,0,-185);rod(townSign,[0,0,0],[0,85,0],1.3,material('#c59b4c'));
  sign(townSign,'BIKINI',60,22,0,78,0,{bg:'#ebdb8e',font:'900 105px Arial',color:'#a54d43'});sign(townSign,'BOTTOM',60,22,0,59,0,{bg:'#ebdb8e',font:'900 100px Arial',color:'#346f5c'});
  // Giant pastel flower silhouettes on the distant underwater backdrop.
  const flowers=[];
  for(let i=0;i<26;i++){
    const group=new T.Group();group.position.set((random()-.5)*2800,180+random()*650,-800-random()*3100);
    const size=35+random()*75,points=[];for(let j=0;j<=140;j++){const a=j/140*Math.PI*2,r=size*(.66+.34*Math.cos(5*a));points.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,0));}
    const mat=new T.MeshBasicMaterial({color:['#85a6d8','#87dccc','#b2c8eb','#72b5dc'][i%4],transparent:true,opacity:.24,depthWrite:false,fog:false});mesh(group,new T.TubeGeometry(new T.CatmullRomCurve3(points),140,1.6,5,false),mat);mesh(group,new T.TorusGeometry(size*.14,1.4,5,24),mat);scene.add(group);flowers.push(group);
  }
  const bubbles=[];
  const bubbleMat=new T.MeshPhysicalMaterial({color:'#d6ffff',roughness:.08,metalness:.1,transparent:true,opacity:.18,side:T.FrontSide});
  for(let i=0;i<90;i++){const b=mesh(scene,new T.SphereGeometry(.7+random()*2.3,12,8),bubbleMat,(random()-.5)*900,random()*220,-random()*3200);b.userData.y=b.position.y;bubbles.push(b);}
  // Soft shafts of sunlight are transparent planes, never opaque obstacles.
  for(let i=0;i<7;i++){const light=mesh(scene,new T.PlaneGeometry(70,900),new T.MeshBasicMaterial({color:'#dcffff',transparent:true,opacity:.045,depthWrite:false,side:T.DoubleSide}),(i-3)*180,400,-1000-i*250);light.rotation.z=-.3;}
  const car=createBatmobile();scene.add(car);
  const shadow=mesh(scene,new T.CircleGeometry(6,32),new T.MeshBasicMaterial({color:'#143d42',transparent:true,opacity:.18,depthWrite:false}));shadow.rotation.x=-Math.PI/2;
  const orange=material('#fc8b32',{roughness:.48}),purple=material('#b38bd1',{roughness:.55}),ropeMat=material('#ba6137'),letters=material('#1b2327');
  const rings=new Map(),books=new Map();
  function createRing(gate){
    const group=new T.Group();group.position.set(gate.x,gate.y,gate.z);scene.add(group);
    const torus=mesh(group,new T.TorusGeometry(RING.radius,RING.tube,16,96),orange);
    const rope=mesh(group,new T.TorusGeometry(RING.radius+6,.65,7,96),ropeMat);
    for(let j=0;j<60;j++){const a=j/60*Math.PI*2;const knot=mesh(group,new T.TorusGeometry(.92,.25,5,9),ropeMat,Math.cos(a)*(RING.radius+6),Math.sin(a)*(RING.radius+6),0);knot.rotation.z=a;knot.rotation.y=.6;}
    for(let i=0;i<4;i++){const wrap=mesh(group,new T.TorusGeometry(RING.radius,RING.tube+.2,10,10,.36),purple);wrap.rotation.z=Math.PI/4+i*Math.PI/2;for(let j=0;j<3;j++){const rib=mesh(group,new T.TorusGeometry(RING.radius,RING.tube+.3,7,8,.025),material('#9373bc'));rib.rotation.z=wrap.rotation.z+.055+j*.1;}}
    const label='BIKINI BOTTOM';
    for(let i=0;i<label.length;i++){if(label[i]===' ')continue;const a=Math.PI*.85-i/(label.length-1)*Math.PI*.70;const char=sign(group,label[i],6.2,7.8,Math.cos(a)*34,Math.sin(a)*34,4.05,{font:'900 190px Arial',color:'#181f25'});char.rotation.z=a-Math.PI/2;}
    sign(group,'SARMA MOLASI',30,7,0,-32,4.2,{color:'#4a2b61',font:'900 70px Arial'});
    sign(group,String(gate.index).padStart(2,'0'),13,7,0,49,0,{bg:'#174a5a',color:'#f9e5b4',font:'900 130px Arial'});
    const robin=createRobin();robin.scale.setScalar(2.6);robin.position.set(0,-24,-1);group.add(robin);
    const glow=mesh(group,new T.TorusGeometry(RING.radius-5,.15,5,72),new T.MeshBasicMaterial({color:'#ffeb9e',transparent:true,opacity:.65}));glow.position.z=1;
    optimize(group,[robin,glow]);rings.set(gate.index,{group,robin,torus,glow});return group;
  }
  const loader=new T.TextureLoader(),cover=loader.load('./assets/book-reference.jpg');cover.colorSpace=T.SRGBColorSpace;cover.repeat.set(306/400,399/600);cover.offset.set(47/400,100/600);
  const coverMat=new T.MeshBasicMaterial({map:cover}),bookSide=material('#f4f0d9'),bookBack=material('#69b843');
  function createBook(){const g=new T.Group();box(g,BOOK.width-.3,BOOK.height-.3,BOOK.depth,bookSide);box(g,BOOK.width,BOOK.height,.16,bookBack,0,0,-BOOK.depth/2);box(g,.4,BOOK.height,BOOK.depth+.2,bookBack,-BOOK.width/2,0,0);mesh(g,new T.PlaneGeometry(BOOK.width,BOOK.height),coverMat,0,0,BOOK.depth/2+.1);scene.add(g);return g;}
  // A second Robin lives in camera space and grows toward the player on impact.
  scene.add(camera);const impactRobin=createRobin();camera.add(impactRobin);impactRobin.visible=false;
  let crashClock=0,lastCrash=false,initialized=false;
  const carPos=new T.Vector3(),desired=new T.Vector3(),look=new T.Vector3();
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resize();
  function update(state,dt,run){
    for(const gate of run.gates){if(!rings.has(gate.index))createRing(gate);const v=rings.get(gate.index);v.group.visible=Math.abs(gate.distance-state.distance)<1050;v.glow.material.color.set(gate.status==='passed'?'#9dffbe':gate.status==='missed'?'#ff6655':'#ffeb9e');v.robin.rotation.y=Math.sin(state.time*.8+gate.index)*.06;}
    for(const b of run.books){if(!books.has(b.id))books.set(b.id,createBook());const v=books.get(b.id);v.position.set(b.x,b.y,b.z);v.rotation.set(.15*Math.sin(b.age*4),Math.sin(b.age*3)*.2,b.age*1.4);}
    for(const[id,v]of books)if(!run.books.some(b=>b.id===id)){scene.remove(v);books.delete(id);}
    carPos.set(state.x,state.altitude+2.15,-state.distance);car.position.copy(carPos);car.rotation.order='YXZ';car.rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,-state.bank*Math.PI/180);
    car.userData.flame.visible=state.speed>2&&!state.crashed;car.userData.flame.scale.y=.7+(state.engineThrottle??0)*.7+Math.sin(state.time*53)*.1;
    shadow.position.set(state.x,.18,-state.distance);shadow.scale.setScalar(1+state.altitude*.015);shadow.material.opacity=.18/(1+state.altitude*.04);
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-state.heading*Math.PI/180);
    if(state.camera==='cockpit'){desired.set(0,2,-1.6).applyQuaternion(q).add(carPos);look.set(0,2,-85).applyQuaternion(q).add(carPos);car.visible=false;}
    else{desired.set(0,14.5,32).applyQuaternion(q).add(carPos);look.set(0,-4,-45).applyQuaternion(q).add(carPos);car.visible=true;}
    if(!initialized){camera.position.copy(desired);initialized=true;}else camera.position.lerp(desired,1-Math.exp(-dt*6));camera.lookAt(look);
    sunlight.position.set(state.x-100,state.altitude+250,-state.distance+150);sunlight.target.position.copy(carPos);
    buildings.forEach(v=>v.visible=Math.abs(v.position.z+state.distance)<1150);
    for(const b of bubbles){b.position.y=(b.userData.y+state.time*1.2)%250;}
    if(state.crashed){if(!lastCrash)crashClock=0;crashClock+=dt;impactRobin.visible=true;const k=Math.min(1,crashClock/1.2),narrow=camera.aspect<.85;impactRobin.scale.setScalar(.18+(narrow?.57:state.crashType==='book'?1.05:.75)*(1-(1-k)**3));impactRobin.position.set(narrow?0:state.crashType==='book'?-4:-5,narrow?-1.8:-6.5,-17);impactRobin.rotation.y=.05;}
    else impactRobin.visible=false;lastCrash=state.crashed;
    renderer.render(scene,camera);
  }
  function dispose(){scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.map?.dispose();mat.dispose();}}});renderer.dispose();}
  return {update,resize,dispose,getStats:()=>({...renderer.info.render})};
}
