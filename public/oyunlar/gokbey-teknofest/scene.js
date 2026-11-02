import * as T from './vendor/three.module.js';
import {BRIDGES,CONFIG,COINS,EFFECTS,WEATHER,birdAt} from './festival.js';
import {createHelicopter} from './helicopter.js';
import {createEagleModel} from './eagle-model.js';
export function createFlightScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(52,1,.2,6000);
  const ambient=new T.HemisphereLight('#e2f3ff','#52624b',2.6),sun=new T.DirectionalLight('#fff4dd',3.5);sun.position.set(-150,260,100);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:650});sun.shadow.normalBias=.1;scene.add(ambient,sun,sun.target);
  const mat=(color,roughness=.78)=>new T.MeshStandardMaterial({color,roughness});
  const M={concrete:mat('#b1b8b6'),red:mat('#cd263d'),black:mat('#151f2e'),metal:mat('#515d62'),grass:mat('#7b9267'),asphalt:mat('#545f64'),white:mat('#f8f4e9'),gold:new T.MeshStandardMaterial({color:'#ffc843',metalness:.7,roughness:.24,emissive:'#ad6612',emissiveIntensity:.25})};
  function mesh(g,m,p=scene){const o=new T.Mesh(g,m);p.add(o);return o;}
  function box(w,h,d,x,y,z,m,p=scene){const o=mesh(new T.BoxGeometry(w,h,d),m,p);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;}
  function rod(a,b,r,m,p=scene){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.CylinderGeometry(r,r,v.length(),6),m,p);o.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function sign(text,w,h,color='#ffffff',bg='#162834'){
    const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 110px Arial';ctx.fillText(text,512,135,970);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}));
  }
  const sky=mesh(new T.SphereGeometry(5000,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#69b9ed')},bottom:{value:new T.Color('#d8eafa')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(v).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.04,.6,h)),1.);}'}));
  const ground=mesh(new T.PlaneGeometry(10000,10000),M.grass);ground.rotation.x=-Math.PI/2;ground.position.z=-1500;ground.receiveShadow=true;
  box(44,.15,3550,0,.05,-1550,M.asphalt);for(let d=0;d<3400;d+=24){box(.5,.08,10,0,.17,-d,M.white);for(const x of[-19,19])box(.3,.08,22,x,.17,-d,M.white);}
  const sea=mesh(new T.PlaneGeometry(5000,8000),new T.MeshStandardMaterial({color:'#51a9bd',roughness:.24,metalness:.3}));sea.rotation.x=-Math.PI/2;sea.position.set(-3200,-.5,-1800);
  let seed=4281;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<110;i++){const x=(i%2?1:-1)*(280+rand()*1200),z=200-rand()*3700,h=8+rand()*38;const b=box(15+rand()*30,h,18+rand()*30,x,h/2,z,mat(['#d7d4c7','#c1c7c6','#e6dfce'][i%3]));if(i%3===0)box(b.geometry.parameters.width+1,1,b.geometry.parameters.depth+1,x,h+.5,z,M.red);}
  // Tower-top helipad, 52 metres above the festival grounds.
  for(const x of[-12,12])for(const z of[-12,12])box(3.5,50,3.5,x,25,z,M.concrete);
  for(let y=6;y<40;y+=10)for(const z of[-12,12]){rod([-12,y,z],[12,y+10,z],.4,M.metal);rod([12,y,z],[-12,y+10,z],.4,M.metal);}
  box(31,3,31,0,49.8,0,M.black);box(37,.6,37,0,51.5,0,M.concrete);
  const pad=mesh(new T.CircleGeometry(16.5,64),M.asphalt);pad.rotation.x=-Math.PI/2;pad.position.y=51.82;
  const ring=mesh(new T.RingGeometry(13.8,14.15,80),M.white);ring.rotation.x=-Math.PI/2;ring.position.y=51.84;
  for(const x of[-3.5,3.5])box(1,.06,10,x,51.86,0,M.white);box(7,.06,1,0,51.86,0,M.white);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,l=mesh(new T.SphereGeometry(.2,8,6),new T.MeshBasicMaterial({color:'#87ffe0'}));l.position.set(Math.cos(a)*16.5,52,Math.sin(a)*16.5);}
  const towerLabel=sign('GÖKBEY / KALKIŞ KULESİ',27,5);towerLabel.position.set(0,46.5,15.6);
  // Exact supplied festival photograph on a large LED stage wall.
  const stage=new T.Group();stage.position.set(-140,0,-85);scene.add(stage);
  box(115,4,40,0,4,0,M.black,stage);box(116,50,3,0,29,-12,M.black,stage);
  const photo=new T.TextureLoader().load('./assets/teknofest-reference.webp');photo.colorSpace=T.SRGBColorSpace;
  const led=mesh(new T.PlaneGeometry(108,48),new T.MeshBasicMaterial({map:photo}),stage);led.position.set(0,29,-10.3);
  for(const x of[-69,69]){box(18,39,3,x,24,-10,M.red,stage);for(let y=10;y<43;y+=7)box(12,4,3.5,x,y,-8,M.black,stage);}
  for(const [text,x]of[['TEKNOFEST',-30],['İSTANBUL',30]]){const s=sign(text,55,10,'#ffffff','#cd263d');s.position.set(x,61,-9);stage.add(s);}
  for(let x=-58;x<=58;x+=8){const l=mesh(new T.SphereGeometry(.55,8,6),new T.MeshBasicMaterial({color:'#d2efff'}),stage);l.position.set(x,55,-8);}
  const crowd=new T.InstancedMesh(new T.CylinderGeometry(.48,.65,1.65,5),mat('#ffffff'),650),heads=new T.InstancedMesh(new T.SphereGeometry(.36,6,5),mat('#c89776'),650),dummy=new T.Object3D();for(let i=0;i<650;i++){dummy.position.set(-205+rand()*130,.9,-40+rand()*125);dummy.updateMatrix();crowd.setMatrixAt(i,dummy.matrix);crowd.setColorAt(i,new T.Color(['#ba3044','#ba3044','#d7d9df','#305677','#443d50'][i%5]));dummy.position.y=2.05;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}scene.add(crowd,heads);
  for(let i=0;i<36;i++){const x=(i%2?1:-1)*(85+(i%4)*24),z=-230-Math.floor(i/2)*105;box(16,5,16,x,2.5,z,i%3?M.white:M.red);const roof=mesh(new T.ConeGeometry(12,7,4),i%2?M.red:M.white);roof.rotation.y=Math.PI/4;roof.position.set(x,8,z);}
  for(let i=0;i<16;i++){const x=i%2?-66:66,z=90-i*110;rod([x,0,z],[x,24,z],.18,M.metal);box(7,4.5,.08,x+3.6,21,z,M.red);const moon=sign('☾ ★',6,3.5);moon.position.set(x+3.6,21,z+.08);}
  for(let i=0;i<8;i++){const x=130+(i%2)*40,z=-150-i*180;box(1.8,1.8,13,x,3,z,M.white);box(16,.35,3,x,3,z+1,M.white);box(5,.25,2,x,3,z+5,M.red);}
  for(const b of BRIDGES){
    const g=new T.Group();g.position.z=-b.distance;scene.add(g);
    for(const x of[-b.halfWidth,b.halfWidth]){box(4,122,9,x,61,0,M.concrete,g);box(7,2,12,x,1,0,M.concrete,g);}
    for(const y of CONFIG.deckLevels){box(128,2,8,0,y,0,M.concrete,g);box(127,.08,7.8,0,y+1.04,0,M.asphalt,g);
      for(const z of[-4,4]){for(const ry of[1.5,2.3,3])box(128,.16,.16,0,y+ry,z,M.metal,g);for(let x=-64;x<=64;x+=8)box(.17,2,.17,x,y+2,z,M.metal,g);}
      for(let x=-58;x<60;x+=9)box(4,.05,.18,x,y+1.1,0,M.white,g);
      for(const side of[-1,1]){const ramp=box(45,1.4,8,side*84,y-9,10,M.concrete,g);ramp.rotation.z=side*-.4;}
    }
    for(const [index,tier]of b.tiers.entries()){
      const info=EFFECTS[tier.effect],light=new T.MeshBasicMaterial({color:info.color});for(const x of[-45,45])box(.35,34,.35,x,tier.y,4.4,light,g);box(90,.35,.35,0,tier.y+17,4.4,light,g);
      const plate=sign(`${String(b.id).padStart(2,'0')} / ${index?'ÜST':'ALT'} / ${info.label}`,38,4,'#142a3a',info.color);plate.position.set(0,tier.y+14,4.5);g.add(plate);
      for(const x of[-33,33]){const arrow=sign('››',6,5,info.color,'#223745');arrow.position.set(x,tier.y,4.6);g.add(arrow);}
    }
  }
  // Batch stationary festival geometry to keep thousands of railings and tents inexpensive.
  scene.updateMatrixWorld(true);const batches=new Map(),staticMeshes=[];scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o!==sky)staticMeshes.push(o);});
  for(const o of staticMeshes){const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;let b=batches.get(key);if(!b){b={material:o.material,cast:o.castShadow,receive:o.receiveShadow,positions:[],normals:[],uvs:[]};batches.set(key,b);}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);b.positions.push(g.attributes.position.array);b.normals.push(g.attributes.normal.array);b.uvs.push(g.attributes.uv.array);g.dispose();o.parent.remove(o);o.geometry.dispose();}
  function join(arrays){const out=new Float32Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){out.set(a,offset);offset+=a.length;}return out;}
  for(const b of batches.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(join(b.positions),3));g.setAttribute('normal',new T.BufferAttribute(join(b.normals),3));g.setAttribute('uv',new T.BufferAttribute(join(b.uvs),2));const o=mesh(g,b.material);o.castShadow=b.cast;o.receiveShadow=b.receive;}
  const coinMeshes=new Map();for(const c of COINS){const coin=mesh(new T.CylinderGeometry(2.3,2.3,.55,32),M.gold);coin.rotation.x=Math.PI/2;coin.position.set(c.x,c.y,-c.distance);const inner=mesh(new T.TorusGeometry(1.75,.12,5,32),M.white,coin);inner.rotation.x=Math.PI/2;inner.position.y=.3;coinMeshes.set(c.id,coin);}
  const birds=[];for(let i=0;i<8;i++){const e=createEagleModel(T);e.root.scale.setScalar(.52);scene.add(e.root);birds.push(e);}
  const clouds=[],cloudMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,transparent:true,opacity:.9});for(let i=0;i<30;i++){const g=new T.Group();for(let j=0;j<4;j++){const c=mesh(new T.SphereGeometry(1,10,7),cloudMat,g);c.position.set(j*18,rand()*8,rand()*10);c.scale.set(23+rand()*15,9+rand()*7,15+rand()*8);}g.position.set((rand()-.5)*2300,240+rand()*210,500-rand()*4000);scene.add(g);clouds.push(g);}
  const rainGeometry=new T.BufferGeometry(),rainPositions=new Float32Array(3000);for(let i=0;i<1000;i++){rainPositions[i*3]=(rand()-.5)*180;rainPositions[i*3+1]=rand()*100;rainPositions[i*3+2]=(rand()-.5)*180;}rainGeometry.setAttribute('position',new T.BufferAttribute(rainPositions,3));const rain=new T.Points(rainGeometry,new T.PointsMaterial({color:'#d6e8f5',size:.22,transparent:true,opacity:.65}));scene.add(rain);
  const heli=createHelicopter();scene.add(heli.root);let weatherKey='',initialized=false;const target=new T.Vector3(),desired=new T.Vector3(),look=new T.Vector3();
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();
  function update(s,dt,run){
    const w=WEATHER[run.weather];if(weatherKey!==run.weather){weatherKey=run.weather;sky.material.uniforms.top.value.set(w.sky);sky.material.uniforms.bottom.value.set(w.horizon);sun.color.set(w.sun);clouds.forEach((g,i)=>g.visible=i<w.clouds);ground.material.color.set(run.weather==='sunset'?'#8c8861':'#7b9267');}
    scene.fog=s.time<run.fogUntil?new T.FogExp2('#d8e4ec',.024):null;
    target.set(s.x,s.altitude+2.15,-s.distance);heli.root.position.copy(target);heli.root.rotation.set(s.pitch*Math.PI/180,-s.heading*Math.PI/180,-s.bank*Math.PI/180,'YXZ');heli.root.visible=s.camera!=='cockpit';heli.update(s,s.frozen?0:dt,run.red);
    const yaw=s.heading*Math.PI/180;
    if(s.camera==='cockpit'){desired.copy(target).add(new T.Vector3(Math.sin(yaw)*4,1,-Math.cos(yaw)*4));look.copy(target).add(new T.Vector3(Math.sin(yaw)*150,1,-Math.cos(yaw)*150));}
    else if(!s.started&&camera.aspect<.85){desired.set(26,80,50);look.set(0,70,0);}
    else if(!s.started){desired.set(25,65,32);look.set(-20,54,-3);}
    else{desired.copy(target).add(new T.Vector3(-Math.sin(yaw)*33,12,Math.cos(yaw)*33));look.copy(target).add(new T.Vector3(Math.sin(yaw)*45,1,-Math.cos(yaw)*45));}
    if(!initialized){camera.position.copy(desired);initialized=true;}else camera.position.lerp(desired,1-Math.exp(-dt*4));camera.lookAt(look);
    sky.position.copy(camera.position);sun.position.copy(target).add(new T.Vector3(-150,260,100));sun.target.position.copy(target);sun.target.updateMatrixWorld();
    coinMeshes.forEach((o,id)=>{o.visible=!run.collected.has(id);if(!s.frozen)o.rotation.z+=dt*1.6;});
    birds.forEach((b,i)=>{const p=birdAt(i,s.time);b.root.position.set(p.x,p.y,p.z);b.root.rotation.y=Math.cos(s.time*.24+i*1.7)>0?Math.PI/2:-Math.PI/2;b.root.rotation.z=Math.sin(s.time*.38+i)*.12;b.update({altitude:p.y,leftWingAngle:90+Math.sin(s.time*3+i)*22,rightWingAngle:90+Math.sin(s.time*3+i)*22});});
    rain.visible=run.weather==='rain';rain.position.copy(target);if(rain.visible&&!s.frozen){for(let i=0;i<1000;i++){rainPositions[i*3+1]-=dt*55;if(rainPositions[i*3+1]<-20)rainPositions[i*3+1]=80;}rainGeometry.attributes.position.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  return {update,resize,dispose(){scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.map?.dispose();m.dispose();}});renderer.dispose();}};
}
