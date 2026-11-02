import * as THREE from './vendor/three.module.js';
import {createKaan,createDurum} from './models.js';

export function createCombatScene(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d2dfe0',.00021);
  const camera=new THREE.PerspectiveCamera(51,1,.25,28000);
  scene.add(new THREE.HemisphereLight('#c9e7ff','#8a7956',2.65));
  const sun=new THREE.DirectionalLight('#fff1cf',3.2);sun.position.set(-700,1200,-1600);scene.add(sun);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(24000,24,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 v;void main(){vec3 n=normalize(v);float h=smoothstep(-.05,.75,n.y);vec3 c=mix(vec3(.86,.88,.83),vec3(.22,.48,.69),h);float s=pow(max(0.,dot(n,normalize(vec3(-.3,.45,-.8)))),220.);c+=vec3(1.,.83,.5)*s*.6;gl_FragColor=vec4(c,1.);}'
  }));sky.material.fog=false;scene.add(sky);
  let seed=861;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  const fields=texture(1024,1024,(c,w,h)=>{
    c.fillStyle='#a9a36b';c.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=128)for(let x=0;x<w;x+=128){
      c.fillStyle=['#b1a74e','#8c9860','#b8a763','#c5ad58','#99a16d'][Math.floor(random()*5)];c.fillRect(x+2,y+2,124,124);
      c.strokeStyle='rgba(65,77,37,.22)';c.lineWidth=1;
      for(let j=0;j<124;j+=5){c.beginPath();c.moveTo(x+j,y+2);c.lineTo(x+j,y+126);c.stroke();}
      for(let i=0;i<80;i++){c.fillStyle=random()>.4?'#d6b943':'#7e8943';c.fillRect(x+random()*124,y+random()*124,2,2);}
    }
  });fields.wrapS=fields.wrapT=THREE.RepeatWrapping;fields.repeat.set(35,35);fields.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(70000,70000),new THREE.MeshStandardMaterial({map:fields,roughness:1,color:'#d3c99b'}));ground.rotation.x=-Math.PI/2;ground.position.y=-.22;scene.add(ground);
  const concrete=new THREE.MeshStandardMaterial({color:'#525c60',roughness:.95}),white=new THREE.MeshStandardMaterial({color:'#f1eee0',roughness:.8});
  function box(x,y,z,w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);scene.add(o);return o;}
  box(0,-.07,-900,44,.18,2400,concrete);
  for(const s of[-1,1])box(s*20.5,.04,-900,.5,.02,2380,white);
  for(let z=210;z>-2100;z-=70)box(0,.05,z,.65,.02,28,white);
  for(const z of[200,-2070])for(const s of[-1,1])for(let j=0;j<5;j++)box(s*(5+j*2.8),.06,z,1.5,.02,24,white);
  const numberMap=texture(256,256,c=>{c.clearRect(0,0,256,256);c.fillStyle='#edeadd';c.font='bold 185px Arial';c.textAlign='center';c.fillText('36',128,196);});
  const number=new THREE.Mesh(new THREE.PlaneGeometry(15,23),new THREE.MeshBasicMaterial({map:numberMap,transparent:true}));number.rotation.x=-Math.PI/2;number.position.set(0,.07,150);scene.add(number);
  const lightMat=new THREE.MeshBasicMaterial({color:'#ffda92'});
  for(let z=270;z>-2100;z-=65)for(const s of[-1,1])box(s*23,.2,z,.24,.34,.24,lightMat);
  // Distant low hills leave the open arena free of invisible obstacles.
  for(let i=0;i<72;i++){
    const s=i%2?1:-1,x=s*(3200+random()*8500),z=-4500-random()*19000;
    const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.13+random()*.04,.15,.42+random()*.13),roughness:1,flatShading:true}));
    hill.position.set(x,-60,z);hill.scale.set(600+random()*1300,120+random()*360,500+random()*1300);scene.add(hill);
  }
  const cloudMap=texture(256,128,c=>{
    for(let i=0;i<12;i++){const x=35+random()*185,y=35+random()*55,r=15+random()*35,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,250,.65)');g.addColorStop(1,'rgba(255,255,250,0)');c.fillStyle=g;c.fillRect(0,0,256,128);}
  });
  for(let i=0;i<74;i++){
    const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudMap,transparent:true,opacity:.6,depthWrite:false,fog:true}));cloud.position.set((random()-.5)*16000,380+random()*1000,-random()*20000+3000);cloud.scale.set(500+random()*1800,200+random()*500,1);scene.add(cloud);
  }
  // Sunflowers along the airfield echo the supplied keepsake photograph.
  const count=1600,flowers=new THREE.InstancedMesh(new THREE.CircleGeometry(.4,7),new THREE.MeshStandardMaterial({color:'#f2ba26',side:THREE.DoubleSide,roughness:1}),count);
  const centers=new THREE.InstancedMesh(new THREE.CircleGeometry(.15,7),new THREE.MeshStandardMaterial({color:'#584021',side:THREE.DoubleSide}),count);
  const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.035,1.3,3),new THREE.MeshStandardMaterial({color:'#65764b'}),count);
  const dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const x=(i%2?1:-1)*(35+random()*370),z=400-random()*2900;
    dummy.position.set(x,.65,z);dummy.rotation.set(0,0,0);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
    dummy.position.y=1.32;dummy.rotation.set(-.24,-.1,.1);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);
    dummy.position.z+=.015;dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix);
  }
  scene.add(flowers,centers,stems);
  const player=createKaan();scene.add(player);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(25,25),new THREE.MeshBasicMaterial({map:texture(128,128,c=>{const g=c.createRadialGradient(64,64,3,64,64,63);g.addColorStop(0,'rgba(17,29,35,.3)');g.addColorStop(1,'rgba(17,29,35,0)');c.fillStyle=g;c.fillRect(0,0,128,128);}),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.08;scene.add(shadow);
  const enemies=new Map(),missiles=new Map(),bursts=new Map();
  let lastCamera='';const look=new THREE.Vector3(),wanted=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function project(point){return new THREE.Vector3(point.x,point.y,point.z).project(camera);}
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}
  resize();
  function prepare(state,dt=0) {
    const yaw=THREE.MathUtils.degToRad(-state.heading);
    player.position.set(state.x,state.altitude+2.15,-state.distance);player.rotation.order='YXZ';player.rotation.set(THREE.MathUtils.degToRad(state.pitch),yaw,-THREE.MathUtils.degToRad(state.bank));
    player.userData.gear.visible=state.altitude<5;player.visible=state.camera!=='cockpit';
    player.userData.afterburners.forEach(m=>m.opacity=.08+state.speed/190*.5);
    shadow.position.x=state.x;shadow.position.z=-state.distance;shadow.material.opacity=Math.max(0,1-state.altitude/150);
    const cockpit=state.camera==='cockpit';
    wanted.set(0,cockpit?2:6.5,cockpit?-6.5:Math.max(31,24/camera.aspect)).applyAxisAngle(up,yaw).add(player.position);
    look.set(0,cockpit?2:6,-180).applyAxisAngle(up,yaw).add(player.position);
    if(lastCamera!==state.camera || dt===0)camera.position.copy(wanted);else camera.position.lerp(wanted,1-Math.exp(-dt*9));
    lastCamera=state.camera;camera.up.set(0,1,0);camera.lookAt(look);camera.updateMatrixWorld();sky.position.copy(player.position);
  }
  function render(state,game) {
    for(const target of game.targets){
      let mesh=enemies.get(target.id);
      if(!mesh){mesh=createKaan({enemy:true});mesh.scale.setScalar(.9);mesh.userData.gear.visible=false;enemies.set(target.id,mesh);scene.add(mesh);}
      mesh.visible=target.alive;if(!target.alive)continue;
      mesh.position.set(target.x,target.y,target.z);mesh.rotation.order='YXZ';mesh.rotation.set(target.pitch||0,-target.heading,-(target.bank||0));mesh.userData.setLocked(target.id===game.lockId&&game.locked);
    }
    for(const missile of game.missiles){
      let mesh=missiles.get(missile.id);
      if(!mesh){
        mesh=createDurum();mesh.scale.setScalar(2.1);scene.add(mesh);missiles.set(missile.id,mesh);
        const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(90),3));trailGeometry.setDrawRange(0,0);
        const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#ffe0a1',transparent:true,opacity:.65}));trail.frustumCulled=false;
        scene.add(trail);mesh.userData.trail=trail;mesh.userData.history=[];
      }
      mesh.position.set(missile.x,missile.y,missile.z);
      if(mesh.userData.lastAge!==missile.age){
        mesh.userData.lastAge=missile.age;mesh.userData.history.push(missile.x,missile.y,missile.z);
        if(mesh.userData.history.length>90)mesh.userData.history.splice(0,3);
        const trailGeometry=mesh.userData.trail.geometry;trailGeometry.attributes.position.array.set(mesh.userData.history);trailGeometry.attributes.position.needsUpdate=true;trailGeometry.setDrawRange(0,mesh.userData.history.length/3);
      }
      const t=game.targets.find(t=>t.id===missile.targetId);
      if(t){direction.set(t.x-missile.x,t.y-missile.y,t.z-missile.z).normalize();mesh.quaternion.setFromUnitVectors(up,direction);mesh.rotateY(state.time*8);}
    }
    for(const [id,mesh] of missiles)if(!game.missiles.some(m=>m.id===id)){
      scene.remove(mesh,mesh.userData.trail);mesh.userData.trail.geometry.dispose();mesh.userData.trail.material.dispose();mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});missiles.delete(id);
    }
    for(const burst of game.bursts){
      let visual=bursts.get(burst.id);
      if(!visual){
        const positions=[],colors=[],velocities=[];
        for(let i=0;i<90;i++){positions.push(0,0,0);const a=random()*Math.PI*2,r=6+random()*20;velocities.push(Math.cos(a)*r,(random()-.25)*r,Math.sin(a)*r);const c=new THREE.Color(['#ffbc52','#ff6535','#fcdea0','#91b744','#ced0bd'][i%5]);colors.push(c.r,c.g,c.b);}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
        visual=new THREE.Points(geometry,new THREE.PointsMaterial({size:2.7,vertexColors:true,transparent:true,depthWrite:false}));visual.position.set(burst.x,burst.y,burst.z);visual.userData.velocities=velocities;scene.add(visual);bursts.set(burst.id,visual);
      }
      const p=visual.geometry.attributes.position,v=visual.userData.velocities;
      for(let i=0;i<p.count;i++)p.setXYZ(i,v[i*3]*burst.age,v[i*3+1]*burst.age-4*burst.age**2,v[i*3+2]*burst.age);
      p.needsUpdate=true;visual.material.opacity=Math.max(0,1-burst.age/1.8);visual.material.size=2.7+burst.age*1.3;
    }
    for(const [id,v] of bursts)if(!game.bursts.some(b=>b.id===id)){scene.remove(v);v.geometry.dispose();v.material.dispose();bursts.delete(id);}
    renderer.render(scene,camera);
  }
  function dispose(){const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());renderer.dispose();}
  return {prepare,project,render,resize,dispose};
}
