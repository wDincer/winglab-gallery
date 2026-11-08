import * as THREE from './vendor/three.module.js';
import {BUILDINGS,seededRandom} from './neighborhood.js?v=cow-freeflight-v1';
import {COW_WORLD} from './cow-world.js?v=cow-freeflight-v1';
import {createCowModel} from './cow-model.js?v=cow-freeflight-v1';

export function createFlightScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b5d2e1');scene.fog=new THREE.FogExp2('#b1c6cd',.00023);
  const camera=new THREE.PerspectiveCamera(57,1,.2,6500),random=seededRandom(754);
  scene.add(new THREE.HemisphereLight('#c5def1','#546743',1.7));
  const sun=new THREE.DirectionalLight('#fff1d7',3.4);sun.position.set(-180,360,160);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-135,right:135,top:135,bottom:-135,near:1,far:1000});sun.shadow.normalBias=.035;sun.shadow.bias=-.00012;scene.add(sun,sun.target);
  const staticWorld=new THREE.Group();scene.add(staticWorld);
  const mats=new Map(),textures=new Set(),cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,12,9),plane=new THREE.PlaneGeometry(1,1);
  function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.89}));return mats.get(c);}
  function mesh(g,m,parent=staticWorld){const o=new THREE.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function box(parent,size,x,y,z,m){const o=mesh(cube,typeof m==='string'?mat(m):m,parent);o.scale.set(...size);o.position.set(x,y,z);return o;}
  function ell(parent,size,x,y,z,m){const o=mesh(sphere,typeof m==='string'?mat(m):m,parent);o.scale.set(...size);o.position.set(x,y,z);return o;}
  function rod(parent,a,b,r,m){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);const o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),typeof m==='string'?mat(m):m,parent);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
  function texture(draw,size=512){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.add(t);return t;}
  function repeat(t,x,y=x){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);return t;}
  const grass=texture((c,s)=>{c.fillStyle='#7e895a';c.fillRect(0,0,s,s);for(let i=0;i<26000;i++){c.fillStyle=['#8d9867','#6b7948','#a5a16e','#707f53'][i%4];c.fillRect(random()*s,random()*s,.7+random()*1.1,1+random()*4);}});
  const groundMat=new THREE.MeshStandardMaterial({map:repeat(grass,130),roughness:1});
  const ground=mesh(new THREE.PlaneGeometry(10000,10000),groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.08;ground.castShadow=false;
  const asphalt=texture((c,s)=>{c.fillStyle='#626b69';c.fillRect(0,0,s,s);for(let i=0;i<24000;i++){c.fillStyle=i%3?'#91988c35':'#1f292638';c.fillRect(random()*s,random()*s,1,1);}c.strokeStyle='#3b45423a';c.lineWidth=.7;for(let i=0;i<7;i++){c.beginPath();c.moveTo(random()*s,0);c.lineTo(random()*s,s);c.stroke();}});
  const roadMat=new THREE.MeshStandardMaterial({map:repeat(asphalt,2,85),roughness:.96});
  const roadLength=3060,roadWidth=26,curb=mat('#bcb9a7'),paint=mat('#e1d6ac');
  for(let n=-8;n<=8;n++){
    const d=n*180;
    box(staticWorld,[roadWidth,.09,roadLength],d,.01,0,roadMat);box(staticWorld,[roadLength,.08,roadWidth],0,.025,d,roadMat);
    for(const side of[-1,1]){box(staticWorld,[2,.16,roadLength],d+side*14,.08,0,curb);box(staticWorld,[roadLength,.16,2],0,.08,d+side*14,curb);}
    for(let q=-1450;q<1500;q+=44){if(Math.abs(q%180)<24)continue;box(staticWorld,[.22,.02,15],d,.073,q,paint);box(staticWorld,[15,.02,.22],q,.078,d,paint);}
  }
  const brick=texture((c,s)=>{c.fillStyle='#aca493';c.fillRect(0,0,s,s);for(let row=0;row<32;row++)for(let col=-1;col<12;col++){const x=col*48+(row%2?24:0),y=row*16;c.fillStyle=`hsl(37 9% ${57+random()*13}%)`;c.fillRect(x+1,y+1,46,14);}for(let i=0;i<16000;i++){c.fillStyle='#2e2c2511';c.fillRect(random()*s,random()*s,1,1);}});
  const towerMat=new THREE.MeshStandardMaterial({map:repeat(brick,5,3),roughness:.92});
  const roofTex=texture((c,s)=>{c.fillStyle='#6a6057';c.fillRect(0,0,s,s);for(let y=0;y<s;y+=22)for(let x=-32;x<s;x+=64){const dx=x+(y%44?32:0);c.fillStyle=random()>.5?'#817064':'#695b50';c.fillRect(dx+1,y+1,62,20);c.fillStyle='#403f3828';c.fillRect(dx+1,y+18,62,3);}});
  const roofMat=new THREE.MeshStandardMaterial({map:repeat(roofTex,3),roughness:.91});
  const colors=['#c4b29a','#b8b6a2','#b7a18c','#a4afa9','#d0c1a8'];
  const windowMat=new THREE.MeshStandardMaterial({color:'#52717b',roughness:.26,metalness:.28,side:THREE.DoubleSide});
  const warmWindow=new THREE.MeshStandardMaterial({color:'#a8996f',roughness:.45,emissive:'#51472d',emissiveIntensity:.12,side:THREE.DoubleSide});
  function windowAt(group,x,y,z,w,h,angle){const o=mesh(plane,random()>.85?warmWindow:windowMat,group);o.scale.set(w,h,1);o.position.set(x,y,z);o.rotation.y=angle;o.castShadow=false;}
  for(const b of BUILDINGS){
    const group=new THREE.Group();group.position.set(b.x,0,b.z);staticWorld.add(group);
    box(group,[b.width,b.height,b.depth],0,b.height/2,0,colors[b.color%colors.length]);
    box(group,[b.width+1,.6,b.depth+1],0,.3,0,'#8e9085');box(group,[b.width+1.2,.6,b.depth+1.2],0,b.height-.2,0,'#8b8679');
    if(b.height<45){const roof=mesh(new THREE.CylinderGeometry(.02,1,1,4),roofMat,group);roof.rotation.y=Math.PI/4;roof.scale.set(b.width*.73,b.roof||4,b.depth*.73);roof.position.y=b.height+(b.roof||4)/2;box(group,[2.1,4,2.4],b.width*.23,b.height+1.5,b.depth*.22,'#7c7063');}
    else{box(group,[b.width,(b.roof||3),b.depth],0,b.height+(b.roof||3)/2,0,'#8f938a');box(group,[b.width*.2,2.5,b.depth*.2],b.width*.2,b.height+(b.roof||3)+1.25,0,'#6d7e7b');for(const dx of[-.3,.3])box(group,[b.width*.13,1,b.depth*.18],b.width*dx,b.height+(b.roof||3)+.5,b.depth*.2,'#8a9a99');}
    const levels=Math.min(7,Math.max(1,Math.floor(b.height/6))),step=(b.height-3)/levels;
    for(let level=0;level<levels;level++)for(const side of[-1,1])for(const slot of[-.3,0,.3]){const y=3.2+level*step;windowAt(group,b.width*slot,y,side*(b.depth/2+.035),Math.min(4.5,b.width*.13),3.3,side<0?Math.PI:0);windowAt(group,side*(b.width/2+.035),y,b.depth*slot,Math.min(4.5,b.depth*.13),3.3,side*Math.PI/2);}
    if(b.porch){box(group,[3.8,5,.16],0,2.5,b.depth/2+.12,'#485650');box(group,[8,.35,4],0,5.1,b.depth/2+1.7,'#9f9481');for(const x of[-3.6,3.6])rod(group,[x,0,b.depth/2+3.3],[x,5,b.depth/2+3.3],.13,'#c4bcac');}
  }
  // The visible tower and its solid cylinder use the same shared dimensions.
  const tower=COW_WORLD.tower,shaft=mesh(new THREE.CylinderGeometry(tower.radius,tower.radius,tower.height,64),towerMat);shaft.position.set(tower.x,tower.height/2,tower.z);
  const base=mesh(new THREE.CylinderGeometry(tower.radius,tower.radius,1.2,64),mat('#9b9b8c'));base.position.set(tower.x,.6,tower.z);
  for(let y=16;y<tower.height-7;y+=15)for(let i=0;i<10;i++){const a=i*Math.PI/5,x=tower.x+Math.sin(a)*(tower.radius+.025),z=tower.z+Math.cos(a)*(tower.radius+.025);const o=mesh(plane,windowMat);o.scale.set(1.5,4,1);o.position.set(x,y,z);o.rotation.y=a;o.castShadow=false;const sill=box(staticWorld,[1.8,.22,.35],x,y-2.1,z,'#d0c8b4');sill.rotation.y=a;}
  for(const y of[10,38,66]){const ring=mesh(new THREE.TorusGeometry(tower.radius-.11,.12,6,80),mat('#858b7c'));ring.rotation.x=Math.PI/2;ring.position.set(tower.x,y,tower.z);}
  const platform=mesh(new THREE.CylinderGeometry(tower.radius,tower.radius,.3,64),mat('#b2b3a1'));platform.position.set(tower.x,tower.height-.15,tower.z);
  const pad=mesh(new THREE.CircleGeometry(12,64),mat('#465952'));pad.rotation.x=-Math.PI/2;pad.position.set(tower.x,tower.height+.015,tower.z);
  const padRing=mesh(new THREE.RingGeometry(10.6,10.9,64),paint);padRing.rotation.x=-Math.PI/2;padRing.position.set(tower.x,tower.height+.025,tower.z);
  const padSign=texture((c,s)=>{c.clearRect(0,0,s,s);c.fillStyle='#e7e2c7';c.textAlign='center';c.font='bold 96px Arial';c.fillText('MÖÖ',s/2,260);c.font='26px Arial';c.fillText('KALKIŞ KULESİ',s/2,313);});
  const padText=mesh(new THREE.PlaneGeometry(15,15),new THREE.MeshBasicMaterial({map:padSign,transparent:true,depthWrite:false}));padText.rotation.x=-Math.PI/2;padText.position.set(tower.x,tower.height+.04,tower.z);
  // Keep the northern half open for takeoff; rails guard the rear edge.
  for(let i=0;i<=16;i++){const a=-Math.PI/2+i/16*Math.PI,r=tower.radius-1.1;rod(staticWorld,[tower.x+Math.sin(a)*r,tower.height,tower.z+Math.cos(a)*r],[tower.x+Math.sin(a)*r,tower.height+1.7,tower.z+Math.cos(a)*r],.055,'#697b75');if(i<16){const b=-Math.PI/2+(i+1)/16*Math.PI;rod(staticWorld,[tower.x+Math.sin(a)*r,tower.height+1.6,tower.z+Math.cos(a)*r],[tower.x+Math.sin(b)*r,tower.height+1.6,tower.z+Math.cos(b)*r],.055,'#697b75');}}
  const treeTrunk=mat('#6b614b'),leafA=mat('#4e6945'),leafB=mat('#627b4b');
  for(let i=0;i<280;i++){
    const gx=Math.floor(random()*16)-8,gz=Math.floor(random()*16)-8,x=gx*180+24+random()*10,z=gz*180+24+random()*10;if(Math.hypot(x,z)<45)continue;const h=7+random()*10;
    rod(staticWorld,[x,0,z],[x,h,z],.32,treeTrunk);ell(staticWorld,[4+random()*2,4.5,4.3],x,h+2,z,i%2?leafA:leafB);ell(staticWorld,[3.6,3.3,3.5],x+2,h+4,z+1,leafB);
    if(i%3===0){const car=new THREE.Group();car.position.set(gx*180+9,.2,gz*180+55);staticWorld.add(car);box(car,[2.5,1.05,5.2],0,1,0,['#496b76','#9f6854','#b0afa0','#59665b'][i%4]);box(car,[2.25,.8,2.6],0,1.9,-.25,'#64787c');box(car,[2.05,.6,.08],0,1.9,1.12,windowMat);for(const side of[-1,1])for(const dz of[-1.6,1.6]){const wheel=mesh(new THREE.CylinderGeometry(.55,.55,.27,12),mat('#303731'),car);wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.15,.55,dz);}}
  }
  for(let i=0;i<65;i++){const a=random()*Math.PI*2,r=1900+random()*1500,x=Math.cos(a)*r,z=Math.sin(a)*r,width=170+random()*280;ell(staticWorld,[width,80+random()*180,width*.8],x,-20,z,['#748d70','#7a906b','#859776'][i%3]);}
  // Bake all static facade details by material to keep draw calls low.
  staticWorld.updateMatrixWorld(true);const buckets=new Map(),old=[];
  staticWorld.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);let bucket=buckets.get(o.material);if(!bucket){bucket={positions:[],normals:[],uvs:[]};buckets.set(o.material,bucket);}const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}geometry.dispose();old.push(o);});
  for(const o of old)o.removeFromParent();for(const [material,b]of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));mesh(g,material);}
  const sky=new THREE.Mesh(new THREE.SphereGeometry(5600,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color('#528bb7')},horizon:{value:new THREE.Color('#d6e5e8')},sunDirection:{value:new THREE.Vector3(-.45,.72,.34).normalize()}},vertexShader:'varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 direction;uniform vec3 top;uniform vec3 horizon;uniform vec3 sunDirection;void main(){vec3 d=normalize(direction);float h=pow(max(0.0,d.y),0.48);vec3 color=mix(horizon,top,h);float s=max(0.0,dot(d,sunDirection));color+=vec3(1.0,0.81,0.54)*(pow(s,450.0)*1.1+pow(s,15.0)*0.12);gl_FragColor=vec4(color,1.0);}'}));sky.renderOrder=-100;scene.add(sky);
  const cloudTexture=texture((c,s)=>{c.clearRect(0,0,s,s);for(let i=0;i<30;i++){const x=90+random()*330,y=190+random()*100,r=40+random()*75,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fffffff0');g.addColorStop(.6,'#ffffff60');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}});
  const cloudMaterial=new THREE.SpriteMaterial({map:cloudTexture,color:'#ffffff',transparent:true,opacity:.74,depthWrite:false,fog:true});
  for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=1800+random()*1300,o=new THREE.Sprite(cloudMaterial);o.position.set(Math.cos(a)*r,650+random()*450,Math.sin(a)*r);o.scale.set(550+random()*500,220+random()*140,1);scene.add(o);}
  const cow=createCowModel();scene.add(cow.root);
  const hayTexture=texture((c,s)=>{c.fillStyle='#b9964f';c.fillRect(0,0,s,s);for(let i=0;i<13000;i++){const x=random()*s,y=random()*s;c.strokeStyle=['#e2c67e','#9f783b','#d4b465','#edd498'][i%4];c.lineWidth=.5+random();c.beginPath();c.moveTo(x,y);c.lineTo(x+5+random()*22,y-2-random()*7);c.stroke();}});
  const hayMat=new THREE.MeshStandardMaterial({map:hayTexture,color:'#ead19a',roughness:.96}),ropeMat=new THREE.MeshStandardMaterial({color:'#756947',roughness:1});
  const hayBody=new THREE.InstancedMesh(new THREE.BoxGeometry(5.4,3.6,4,2,2,2),hayMat,COW_WORLD.hayCount),hayRopes=[];hayBody.frustumCulled=false;hayBody.castShadow=true;scene.add(hayBody);
  for(const side of[-1,1]){const rope=new THREE.InstancedMesh(new THREE.BoxGeometry(.105,3.68,4.08),ropeMat,COW_WORLD.hayCount);rope.frustumCulled=false;scene.add(rope);hayRopes.push({rope,side});}
  const dummy=new THREE.Object3D(),ropeDummy=new THREE.Object3D(),ropeMatrix=new THREE.Matrix4();
  const plateMeshes=new Map(),bursts=[],plateBodyGeometry=new THREE.CylinderGeometry(2.2,1.75,.22,32),plateRimGeometry=new THREE.TorusGeometry(2.05,.12,8,40),riceGeometry=new THREE.SphereGeometry(1,6,4);
  function plateModel(){const group=new THREE.Group(),dish=mesh(plateBodyGeometry,mat('#ecece4'),group);dish.position.y=-.2;const rim=mesh(plateRimGeometry,mat('#99afb0'),group);rim.rotation.x=Math.PI/2;rim.position.y=-.1;ell(group,[1.53,.59,1.53],0,.33,0,'#e0c998');for(let i=0;i<32;i++){const a=i*2.399,r=Math.sqrt((i+.5)/32)*1.35,o=mesh(riceGeometry,mat(i%5?'#e7d6a7':'#a68751'),group);o.scale.set(.16,.07,.06);o.position.set(Math.cos(a)*r,.48+(1-r/1.5)*.39,Math.sin(a)*r);o.rotation.y=a;}for(let i=0;i<7;i++){const a=i*2.4;ell(group,[.28,.17,.27],Math.cos(a)*1.08,.73,Math.sin(a)*1.08,i%2?'#b57147':'#8d714c');}return group;}
  const chef=new THREE.Group();scene.add(chef);chef.visible=false;const cloth=mat('#eee9dc'),skin=mat('#b98965'),trousers=mat('#303d3d');
  ell(chef,[1.3,1.72,.8],0,3.03,0,cloth);box(chef,[1.8,2.75,.18],0,2.92,.78,'#c4bba3');for(const side of[-1,1]){ell(chef,[.4,1.3,.43],side*.64,1,0,trousers);ell(chef,[.43,.26,.72],side*.64,.06,.18,'#343a36');}
  ell(chef,[.96,1.13,.89],0,5.6,0,skin);ell(chef,[1.01,.35,.92],0,6.44,0,'#493d31');
  const portrait=new THREE.TextureLoader().load('./assets/chef.jpg');portrait.colorSpace=THREE.SRGBColorSpace;textures.add(portrait);const face=mesh(new THREE.PlaneGeometry(1.8,1.93),new THREE.MeshStandardMaterial({map:portrait,roughness:.82}),chef);face.position.set(0,5.61,.9);const uv=face.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.36+uv.getX(i)*.4,.72+uv.getY(i)*.265);uv.needsUpdate=true;
  const hat=mesh(new THREE.CylinderGeometry(.98,1,1.1,24),cloth,chef);hat.position.set(0,6.98,0);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ell(chef,[.64,.57,.62],Math.cos(a)*.49,7.58,Math.sin(a)*.44,cloth);}
  const throwArm=new THREE.Group();throwArm.position.set(-1.08,4.05,0);chef.add(throwArm);rod(throwArm,[0,0,0],[-1.2,-.35,.35],.34,cloth);ell(throwArm,[.34,.34,.34],-1.3,-.38,.43,skin);rod(chef,[1.05,4.04,0],[1.85,3.85,1.1],.35,cloth);ell(chef,[.33,.33,.35],1.9,3.85,1.15,skin);
  const heldPlate=plateModel();heldPlate.position.set(-1.6,-.2,.7);heldPlate.scale.setScalar(.72);throwArm.add(heldPlate);box(chef,[1.8,2.6,.9],0,3.2,-1.05,'#657c79');const propellers=[];
  for(const side of[-1,1]){rod(chef,[side*.7,3.5,-1.1],[side*2.65,4.2,-1.1],.12,'#778c86');const guard=mesh(new THREE.TorusGeometry(1.3,.08,8,32),mat('#889995'),chef);guard.rotation.x=Math.PI/2;guard.position.set(side*2.65,4.2,-1.1);const rotor=new THREE.Group();rotor.position.copy(guard.position);chef.add(rotor);box(rotor,[2.4,.045,.18],0,0,0,'#394d49');box(rotor,[.18,.045,2.4],0,0,0,'#394d49');propellers.push(rotor);}
  const camPos=new THREE.Vector3(),look=new THREE.Vector3(),target=new THREE.Vector3(),at=new THREE.Vector3();let initialized=false,pilot=false,rotorTime=0;
  function resize(){const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();}resize();
  function burst(h){const group=new THREE.Group();group.position.set(h.x,h.y,h.z);scene.add(group);const parts=[];for(let i=0;i<18;i++){const o=box(group,[.08+random()*.12,.1,.7+random()*1.1],0,0,0,i%3?'#e5ce8e':'#ad8847');o.rotation.set(random()*3,random()*3,random()*3);parts.push({o,v:new THREE.Vector3((random()-.5)*23,random()*16-2,(random()-.5)*23)});}bursts.push({group,parts,age:0});}
  function update(state,game,dt,active){
    cow.root.position.set(state.x,state.altitude+2.15,-state.distance);cow.root.rotation.order='YXZ';cow.root.rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,-state.bank*Math.PI/180);cow.update(state,dt,active);cow.root.visible=!pilot;
    const yaw=state.heading*Math.PI/180,narrow=camera.aspect<.8,back=narrow?43:34;
    if(pilot){target.set(state.x+Math.sin(yaw)*2,state.altitude+3.5,-state.distance-Math.cos(yaw)*2);at.set(state.x+Math.sin(yaw)*90,state.altitude+3,-state.distance-Math.cos(yaw)*90);}
    else{target.set(state.x-Math.sin(yaw)*back,state.altitude+(narrow?17:12.5),-state.distance+Math.cos(yaw)*back);at.set(state.x+Math.sin(yaw)*20,state.altitude+3.7,-state.distance-Math.cos(yaw)*20);}
    if(!initialized){camPos.copy(target);look.copy(at);initialized=true;}else{camPos.lerp(target,1-Math.exp(-dt*4));look.lerp(at,1-Math.exp(-dt*5));}
    camera.position.copy(camPos);camera.lookAt(look);sky.position.copy(camera.position);sun.position.set(state.x-180,state.altitude+360,-state.distance+160);sun.target.position.set(state.x,state.altitude*.25,-state.distance);
    hayBody.count=Math.min(game.hay.length,COW_WORLD.hayCount);for(const {rope}of hayRopes)rope.count=hayBody.count;
    for(let i=0;i<hayBody.count;i++){const h=game.hay[i];dummy.position.set(h.x,h.y+Math.sin(state.time*1.3+h.phase)*.25,h.z);dummy.rotation.set(.07,state.time*.12+h.phase,.06);dummy.scale.setScalar(h.collected?0:1);dummy.updateMatrix();hayBody.setMatrixAt(i,dummy.matrix);for(const {rope,side}of hayRopes){ropeDummy.position.set(side*1.58,0,0);ropeDummy.rotation.set(0,0,0);ropeDummy.scale.setScalar(1);ropeDummy.updateMatrix();ropeMatrix.multiplyMatrices(dummy.matrix,ropeDummy.matrix);rope.setMatrixAt(i,ropeMatrix);}}
    hayBody.instanceMatrix.needsUpdate=true;for(const {rope}of hayRopes)rope.instanceMatrix.needsUpdate=true;
    const pids=new Set();for(const p of game.plates){pids.add(p.id);let o=plateMeshes.get(p.id);if(!o){o=plateModel();scene.add(o);plateMeshes.set(p.id,o);}o.position.set(p.x,p.y,p.z);o.rotation.set(p.age*5,p.age*3,p.age*1.3);}for(const [id,o]of plateMeshes)if(!pids.has(id)){scene.remove(o);plateMeshes.delete(id);}
    for(const event of game.events)if(event.type==='hay')burst(event.hay);
    const c=game.chef;chef.visible=Boolean(c);if(c){chef.position.set(c.x,c.y,c.z);const dx=state.x-c.x,dz=-state.distance-c.z;chef.rotation.y=Math.atan2(c.throwDirection?.x??dx,c.throwDirection?.z??dz);chef.rotation.z=c.stage==='approaching'?Math.sin(state.time*1.8)*.07:c.thrown?-.08:0;const windup=c.stage==='warning'?Math.max(0,Math.min(1,1-(c.throwAt-state.time)/1.35)):0;throwArm.rotation.x=c.thrown?-.9:windup*.6;throwArm.rotation.z=c.thrown?-.45:-windup*.7;heldPlate.visible=!c.thrown;}
    if(active)rotorTime+=dt*70;for(const rotor of propellers)rotor.rotation.y=rotorTime;
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];if(active)b.age+=dt;for(const {o,v}of b.parts){if(active){v.y-=dt*13;o.position.addScaledVector(v,dt);o.rotation.x+=dt*6;}o.scale.setScalar(Math.max(0,1-b.age/1.15));}if(b.age>1.15){scene.remove(b.group);bursts.splice(i,1);}}
    renderer.render(scene,camera);
  }
  return {update,resize,toggleView(){pilot=!pilot;initialized=false;},reset(){for(const o of plateMeshes.values())scene.remove(o);plateMeshes.clear();for(const b of bursts)scene.remove(b.group);bursts.length=0;initialized=false;},dispose(){const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();renderer.dispose();}};
}
