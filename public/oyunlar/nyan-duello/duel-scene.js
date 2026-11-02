import * as THREE from './vendor/three.module.js';
import {createCatModel} from './cat-model.js';
import {CAT_GEOMETRY} from './cat-geometry.js';

const rainbow=['#ff5d91','#ffa052','#ffe775','#83ebc1','#77b8ff','#bd8bff'];
export function createDuelScene(container){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor('#090817',0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(49,1,.1,9000);
  scene.add(new THREE.HemisphereLight('#e5dcff','#4b2e62',2.7));
  const sun=new THREE.DirectionalLight('#fff1df',4);sun.position.set(-25,50,20);scene.add(sun);
  const rim=new THREE.DirectionalLight('#e66eff',3);rim.position.set(40,5,-40);scene.add(rim);
  let seed=7319;const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  function gradientTexture(stops){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),g=x.createRadialGradient(128,128,0,128,128,128);for(const [n,color]of stops)g.addColorStop(n,color);x.fillStyle=g;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c);}
  const glow=gradientTexture([[0,'rgba(255,255,255,1)'],[.12,'rgba(255,255,255,.5)'],[.4,'rgba(255,255,255,.13)'],[1,'rgba(255,255,255,0)']]);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(4500,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 p;uniform float time;float h(vec3 q){return fract(sin(dot(q,vec3(127.1,311.7,74.7)))*43758.5453);}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 d=normalize(p);float cloud=n(d*4.)*.5+n(d*9.)*.3+n(d*20.)*.2;float band=pow(max(0.,1.-abs(d.y+.22+d.x*.2)*1.7),3.);vec3 col=vec3(.024,.021,.062);col+=vec3(.14,.053,.19)*pow(cloud,2.)*band*2.7;col+=vec3(.025,.08,.17)*pow(cloud,3.)*(1.-band);gl_FragColor=vec4(col,1.);}`}));scene.add(sky);
  const starG=new THREE.BufferGeometry(),positions=[],colors=[];
  for(let i=0;i<2100;i++){const r=950+rand()*2300,theta=rand()*Math.PI*2,z=rand()*2-1,k=Math.sqrt(1-z*z);positions.push(Math.cos(theta)*k*r,z*r,Math.sin(theta)*k*r);const c=new THREE.Color().setHSL(.58+rand()*.25,.12+rand()*.35,.55+rand()*.45);colors.push(c.r,c.g,c.b);}
  starG.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));starG.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const stars=new THREE.Points(starG,new THREE.PointsMaterial({size:8,sizeAttenuation:true,vertexColors:true,transparent:true,map:glow,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(stars);
  const decor=new THREE.Group();scene.add(decor);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(105,48,32),new THREE.ShaderMaterial({uniforms:{light:{value:new THREE.Vector3(-1,1,1).normalize()}},vertexShader:'varying vec3 p;varying vec3 n;void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;varying vec3 n;uniform vec3 light;void main(){float b=sin(p.y*.095+sin(p.x*.04)*.8)*.08;vec3 c=mix(vec3(.48,.22,.35),vec3(.91,.59,.52),.5+b*2.);c*=.15+max(0.,dot(n,light))*.75;gl_FragColor=vec4(c,1.);}'}));planet.position.set(380,205,-850);decor.add(planet);
  const ring=new THREE.Mesh(new THREE.RingGeometry(137,202,96),new THREE.MeshBasicMaterial({color:'#b587a3',side:THREE.DoubleSide,transparent:true,opacity:.25}));ring.rotation.x=1.25;ring.rotation.y=.2;planet.add(ring);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(35,24,18),new THREE.MeshStandardMaterial({color:'#7d86ae',roughness:1}));moon.position.set(175,-170,-730);decor.add(moon);
  const player=createCatModel(),enemy=createCatModel(true);scene.add(player.root,enemy.root);
  function trail(dark=false){
    const root=new THREE.Group(),strips=[];scene.add(root);
    for(let i=0;i<6;i++){
      const g=new THREE.BufferGeometry(),v=new Float32Array(52*6);g.setAttribute('position',new THREE.BufferAttribute(v,3));
      const indices=[];for(let k=0;k<51;k++){const a=k*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}g.setIndex(indices);
      const material=new THREE.MeshBasicMaterial({color:dark?['#ffffff','#b6bce0','#eae7ff','#cdd3ee','#b1b6d2','#ffffff'][i]:rainbow[i],side:THREE.DoubleSide,transparent:true,opacity:dark?.18:.6,depthWrite:false,blending:THREE.AdditiveBlending});
      const strip=new THREE.Mesh(g,material);strip.frustumCulled=false;root.add(strip);strips.push(strip);
    }
    return {root,update(t,length=65,flat=false){for(let i=0;i<6;i++){const v=strips[i].geometry.attributes.position;for(let k=0;k<52;k++){const z=3+k/51*length,fall=k/51,side=(i-2.5)*.63;for(let j=0;j<2;j++){v.setXYZ(k*2+j,(flat?side+(j-.5)*.65:0)+Math.sin(t*2-k*.16)*fall*.6,.5+(flat?0:side+(j-.5)*.65)+Math.sin(k*.16-t*2)*fall*1.1,z);}}v.needsUpdate=true;}}};
  }
  const playerTrail=trail(),enemyTrail=trail(true),shotTextures={};
  const loader=new THREE.TextureLoader();for(const name of['jam','choco']){shotTextures[name]=loader.load(`./assets/projectiles/${name}.png`);shotTextures[name].colorSpace=THREE.SRGBColorSpace;}
  const shotMeshes=new Map(),bursts=[];
  function burst(position,color,count=45){const g=new THREE.BufferGeometry(),pos=new Float32Array(count*3),vel=[];for(let i=0;i<count;i++)vel.push(new THREE.Vector3((rand()-.5)*30,(rand()-.35)*30,(rand()-.5)*30));g.setAttribute('position',new THREE.BufferAttribute(pos,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color,size:1.7,map:glow,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));m.position.set(position.x,position.y,position.z);scene.add(m);bursts.push({m,vel,life:1.5});}
  let width=1,height=1;
  function resize(){width=container.clientWidth;height=container.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}resize();window.addEventListener('resize',resize);
  let introTime=0;
  function render(state,dt,paused=false){
    const p=state.flight,t=state.time;
    if(state.status==='ready'){
      introTime+=dt;const narrow=width<700,tablet=width<1000;
      camera.position.set(0,10,41);camera.lookAt(0,4,-20);
      player.root.position.set(narrow?6:tablet?8:12,narrow?0:5+Math.sin(introTime*.8)*.5,-1);player.root.rotation.set(-.12,2.05,-.12);player.root.scale.setScalar(narrow?1.05:tablet?1.65:2.05);
      enemy.root.position.set(narrow?5:tablet?16:26,narrow?-12:9+Math.sin(introTime*.7+2)*.5,-30);enemy.root.rotation.set(.08,2.7,.16);enemy.root.scale.setScalar(narrow?1:1.6);
      player.update({...p,altitude:25,time:introTime});enemy.update({...p,altitude:25,time:introTime});
    }else{
      const h=p.heading*Math.PI/180;
      camera.position.set(p.x-Math.sin(h)*22,p.altitude+9,-p.distance+Math.cos(h)*22);
      camera.lookAt(p.x+Math.sin(h)*100,p.altitude+2.15,-p.distance-Math.cos(h)*100);
      player.root.position.set(p.x,p.altitude+2.15,-p.distance);player.root.rotation.set(-p.pitch*Math.PI/180,-h,-p.bank*Math.PI/180);player.root.scale.setScalar(1);
      enemy.root.position.set(state.enemy.x,state.enemy.altitude+2.15,-state.enemy.distance);enemy.root.rotation.set(.05,Math.PI+Math.sin(t*.24)*.25,Math.cos(t*.6)*.1);enemy.root.scale.setScalar(CAT_GEOMETRY.enemyScale);
      player.update(p);enemy.update({...p,altitude:state.enemy.altitude,leftWingAngle:90,rightWingAngle:90});
    }
    player.root.visible=state.health>0;enemy.root.visible=state.enemy.health>0;
    if(state.invulnerable>0&&Math.sin(t*35)>0)player.root.visible=false;
    for(const [cat,tail]of[[player,playerTrail],[enemy,enemyTrail]]){tail.root.position.copy(cat.root.position);tail.root.quaternion.copy(cat.root.quaternion);if(cat===player&&state.status!=='ready')tail.root.rotation.x=0;tail.root.scale.copy(cat.root.scale);tail.root.visible=cat.root.visible;tail.update(state.status==='ready'?introTime:t,state.status==='ready'?45:cat===player?10:65,cat===player&&state.status!=='ready');}
    sky.position.copy(camera.position);stars.position.set(camera.position.x*.95,camera.position.y*.95,camera.position.z*.95);decor.position.set(camera.position.x*.98,camera.position.y*.98,camera.position.z*.98);
    for(const ev of state.events){if(ev.type==='explosion')burst(ev.position,'#ffc989',120);else if(ev.type==='enemy-hit'||ev.type==='player-hit')burst(ev.position,ev.type==='enemy-hit'?'#ff91cf':'#f0efff',36);}
    const ids=new Set(state.projectiles.map(s=>s.id));for(const [id,m]of shotMeshes)if(!ids.has(id)){scene.remove(m);m.material.dispose();shotMeshes.delete(id);}
    for(const shot of state.projectiles){let m=shotMeshes.get(shot.id);if(!m){m=new THREE.Sprite(new THREE.SpriteMaterial({map:shotTextures[shot.owner==='player'?'jam':'choco'],transparent:true,depthWrite:false}));m.scale.set(shot.owner==='player'?3.3:6,shot.owner==='player'?5.1:6,1);scene.add(m);shotMeshes.set(shot.id,m);}m.position.set(shot.x,shot.y,shot.z);m.material.rotation=shot.age*(shot.owner==='player'?2:-3);}
    if(!paused)for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.life-=dt;const v=b.m.geometry.attributes.position;for(let j=0;j<v.count;j++){v.setXYZ(j,v.getX(j)+b.vel[j].x*dt,v.getY(j)+b.vel[j].y*dt,v.getZ(j)+b.vel[j].z*dt);}v.needsUpdate=true;b.m.material.opacity=Math.max(0,b.life/1.5);if(b.life<=0){scene.remove(b.m);b.m.geometry.dispose();b.m.material.dispose();bursts.splice(i,1);}}
    renderer.render(scene,camera);
    const v=enemy.root.position.clone().project(camera);return {enemyScreen:{x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height,visible:v.z<1&&v.z>0&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2}};
  }
  return {render,reset(){for(const m of shotMeshes.values()){scene.remove(m);m.material.dispose();}shotMeshes.clear();for(const b of bursts){scene.remove(b.m);b.m.geometry.dispose();b.m.material.dispose();}bursts.length=0;},renderer,scene,camera};
}
