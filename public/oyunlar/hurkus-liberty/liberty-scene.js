import * as T from './vendor/three.module.js';
import {createHurkus,createF16,createStatue,mesh,box,ellipsoid,rod,palette} from './models.js';
import {BUILDINGS} from './environment.js';
import {positionOf,forwardOf} from './combat.js';

export function createFlightScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(52,1,.3,24000);
  scene.fog=new T.FogExp2('#b4d0d7',.00016);
  scene.add(new T.HemisphereLight('#d4ecff','#657a72',2.6));const sun=new T.DirectionalLight('#ffe2ac',3.1);sun.position.set(-1500,1800,700);scene.add(sun);
  const sky=mesh(scene,new T.SphereGeometry(18000,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;void main(){float h=normalize(v).y;vec3 c=mix(vec3(.80,.86,.82),vec3(.27,.51,.68),smoothstep(-.02,.75,h));gl_FragColor=vec4(c,1.);}'}));sky.material.fog=false;
  const water=mesh(scene,new T.PlaneGeometry(45000,45000),new T.ShaderMaterial({uniforms:{time:{value:0},eye:{value:new T.Vector3()},sunDirection:{value:new T.Vector3(-.6,.7,.3)}},vertexShader:'varying vec3 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`
    uniform float time;uniform vec3 eye;uniform vec3 sunDirection;varying vec3 w;
    void main(){vec2 p=w.xz;float a=sin(p.x*.065+p.y*.11+time*.8),b=sin(p.x*.22-p.y*.17+time*1.2),c=sin(p.x*.51+p.y*.47-time*1.4);float detail=1./(1.+length(eye-w)*.0015);vec3 n=normalize(vec3((a*.06+b*.03)*detail,1.,(c*.04+b*.03)*detail));vec3 v=normalize(eye-w);float fres=pow(1.-max(dot(n,v),0.),3.);float sparkle=pow(max(dot(reflect(-normalize(sunDirection),n),v),0.),120.);vec3 col=mix(vec3(.045,.20,.26),vec3(.32,.52,.57),fres);col+=vec3(.43,.57,.58)*pow(max(0.,b*.45+c*.45),8.)*.025;col+=vec3(1.,.83,.51)*sparkle*.8;float fog=1.-exp(-length(eye-w)*.0001);gl_FragColor=vec4(mix(col,vec3(.65,.77,.78),fog),1.);}` }));water.rotation.x=-Math.PI/2;water.position.y=-1;
  const stone=palette.stone,grass=new T.MeshStandardMaterial({color:'#738d68',roughness:1});
  const island=mesh(scene,new T.CylinderGeometry(150,157,8,48),stone,0,0,0);island.scale.z=.67;
  const lawn=mesh(scene,new T.CylinderGeometry(143,143,1.3,48),grass,0,4.4,0);lawn.scale.z=.66;
  const pathMat=new T.MeshStandardMaterial({color:'#ceccb3',roughness:1});box(scene,230,.15,8,0,5.2,50,pathMat);box(scene,8,.15,160,67,5.2,0,pathMat);
  for(let i=0;i<38;i++){
    const a=i*2.4,r=78+(i%7)*7,x=Math.cos(a)*r,z=Math.sin(a)*r*.57;
    if(Math.abs(x)<45&&Math.abs(z)<45)continue;
    rod(scene,[x,5,z],[x,12,z],.55,new T.MeshStandardMaterial({color:'#6e7260'}));ellipsoid(scene,4.3,6.2,4.3,x,14,z,new T.MeshStandardMaterial({color:i%2?'#5c805f':'#77945f',roughness:1}));
  }
  const statue=createStatue();scene.add(statue.root);
  box(scene,4600,12,1600,0,1,-2800,new T.MeshStandardMaterial({color:'#697a76',roughness:1}));
  const windowCanvas=document.createElement('canvas');windowCanvas.width=128;windowCanvas.height=256;const wc=windowCanvas.getContext('2d');wc.fillStyle='#83989e';wc.fillRect(0,0,128,256);
  let seed=23;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let y=5;y<256;y+=14)for(let x=5;x<128;x+=12){wc.fillStyle=random()>.89?'#e6cf9f':random()>.5?'#526f7c':'#6b8690';wc.fillRect(x,y,5,8);}
  const winTexture=new T.CanvasTexture(windowCanvas);winTexture.colorSpace=T.SRGBColorSpace;winTexture.wrapS=winTexture.wrapT=T.RepeatWrapping;
  for(const b of BUILDINGS){const mat=new T.MeshStandardMaterial({map:winTexture,color:b.color,roughness:.7,metalness:.15});box(scene,b.w,b.h,b.d,b.x,b.h/2+7,b.z,mat);if(b.tier)box(scene,b.w*.65,b.h*.15,b.d*.65,b.x,b.h*1.075+7,b.z,mat);}
  const empire=new T.Group();empire.position.set(380,7,-2750);scene.add(empire);const em=new T.MeshStandardMaterial({color:'#d0c1a2',map:winTexture,roughness:.8});for(const[w,h,y]of[[108,185,92.5],[76,110,240],[52,65,327.5],[30,40,380],[16,22,411]])box(empire,w,h,w,0,y,0,em);rod(empire,[0,421,0],[0,478,0],2.8,palette.metal,.3);
  const one=new T.Group();one.position.set(-680,7,-2500);scene.add(one);const oneM=new T.MeshStandardMaterial({color:'#8caeba',metalness:.65,roughness:.27,map:winTexture});const oneTower=mesh(one,new T.CylinderGeometry(30,63,410,4),oneM,0,205,0);oneTower.rotation.y=Math.PI/4;rod(one,[0,410,0],[0,490,0],1.8,palette.metal,.25);
  for(let i=0;i<9;i++){const x=(random()-.5)*2800,z=-500-random()*1100;ellipsoid(scene,9,2,19,x,1,z,palette.white);rod(scene,[x,2,z],[x,31,z],.25,palette.metal);const sh=new T.Shape();sh.moveTo(0,0);sh.lineTo(0,26);sh.lineTo(14,1);sh.closePath();mesh(scene,new T.ShapeGeometry(sh),new T.MeshStandardMaterial({color:'#dedcc4',side:T.DoubleSide}),x,3,z);}
  const aircraft=createHurkus();scene.add(aircraft.root);const enemyVisuals=new Map(),missileVisuals=new Map();
  const effects=[],debris=[];let time=0,previousMode='',shake=0,statueBroken=false;
  function makeGlow(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,252,225,1)');g.addColorStop(.17,'rgba(255,191,68,.95)');g.addColorStop(.45,'rgba(247,71,13,.45)');g.addColorStop(1,'rgba(240,51,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
  const glow=makeGlow();
  function explode(position,big=false){
    shake=big?1:.45;const group=new T.Group();group.position.set(position.x,position.y,position.z);scene.add(group);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));sprite.scale.setScalar(big?160:90);group.add(sprite);
    const positions=[],velocities=[];for(let i=0;i<(big?180:65);i++){positions.push(0,0,0);velocities.push(new T.Vector3((random()-.5)*110,(random()-.25)*100,(random()-.5)*110));}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));const particles=new T.Points(geo,new T.PointsMaterial({color:'#ffd296',size:big?3:1.8,transparent:true,depthWrite:false,toneMapped:false}));group.add(particles);
    const ring=mesh(group,new T.TorusGeometry(1,.025,5,64),new T.MeshBasicMaterial({color:'#ffdc8a',transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=Math.PI/2;
    effects.push({group,sprite,particles,velocities,ring,age:0,big});
  }
  function breakStatue(){
    if(statueBroken)return;statueBroken=true;statue.body.visible=false;explode({x:0,y:97,z:0},true);
    statue.body.updateMatrixWorld(true);statue.body.traverse(o=>{if(!o.isMesh)return;const m=o.clone();o.matrixWorld.decompose(m.position,m.quaternion,m.scale);scene.add(m);debris.push({mesh:m,velocity:new T.Vector3((random()-.5)*55,random()*38,(random()-.5)*55),spin:new T.Vector3(random()-.5,random()-.5,random()-.5)});});
    for(let i=0;i<35;i++){const m=box(scene,1+random()*5,1+random()*6,1+random()*4,(random()-.5)*20,75+random()*38,(random()-.5)*16,palette.green);debris.push({mesh:m,velocity:new T.Vector3((random()-.5)*65,random()*50,(random()-.5)*65),spin:new T.Vector3(random(),random(),random())});}
  }
  function reset(){statueBroken=false;statue.body.visible=true;for(const e of effects){scene.remove(e.group);e.particles.geometry.dispose();e.particles.material.dispose();e.sprite.material.dispose();e.ring.geometry.dispose();e.ring.material.dispose();}effects.length=0;for(const d of debris)scene.remove(d.mesh);debris.length=0;for(const v of enemyVisuals.values())scene.remove(v.root);enemyVisuals.clear();for(const v of missileVisuals.values())scene.remove(v);missileVisuals.clear();previousMode='';}
  const cameraPos=new T.Vector3(),cameraLook=new T.Vector3(),targetLook=new T.Vector3();
  function update(flight,mission,dt=0,mode='play'){
    time+=dt;water.material.uniforms.time.value=time;aircraft.prop.rotation.z+=dt*(25+(flight.engineThrottle||0)*80);aircraft.disc.visible=true;
    if(mode==='menu'){
      camera.position.set(235,170,410);camera.lookAt(-400,95,-450);
      aircraft.root.position.set(200,171+Math.sin(time*.6)*1.4,245);aircraft.root.scale.setScalar(3.2);aircraft.root.rotation.set(.05,.65,-.15+Math.sin(time*.35)*.025,'YXZ');aircraft.root.visible=true;
    }else if(mode==='defeat'){
      cameraPos.set(210,157,330);targetLook.set(-90,82,-230);const blend=previousMode!==mode?.08:1-Math.exp(-dt*1.5);camera.position.lerp(cameraPos,blend);cameraLook.lerp(targetLook,blend);camera.lookAt(cameraLook);aircraft.root.visible=false;
    }else{
      const p=positionOf(flight),f=forwardOf(flight),h=flight.heading*Math.PI/180;
      aircraft.root.scale.setScalar(1);aircraft.root.position.set(p.x,p.y,p.z);aircraft.root.rotation.set(flight.pitch*Math.PI/180,-h,-flight.bank*Math.PI/180,'YXZ');
      const cockpit=flight.camera==='cockpit';aircraft.root.visible=!cockpit;
      const chaseScale=Math.max(1,.85/camera.aspect),back=cockpit?-1.5:31*chaseScale;
      cameraPos.set(p.x-Math.sin(h)*back,p.y+(cockpit?1.5:5*chaseScale),p.z+Math.cos(h)*back);
      targetLook.set(p.x+f.x*600,p.y+f.y*600+(cockpit?1:0),p.z+f.z*600);
      const blend=previousMode!==mode?1:1-Math.exp(-dt*10);camera.position.lerp(cameraPos,blend);cameraLook.lerp(targetLook,blend);camera.lookAt(cameraLook);if(cockpit)camera.rotateZ(-flight.bank*Math.PI/180*.55);
      if(shake>0){camera.position.x+=(random()-.5)*shake*2;camera.position.y+=(random()-.5)*shake*2;}
    }
    previousMode=mode;shake=Math.max(0,shake-dt*.8);sky.position.copy(camera.position);water.material.uniforms.eye.value.copy(camera.position);
    for(const enemy of mission.enemies){let v=enemyVisuals.get(enemy.id);if(!v&&enemy.alive){v=createF16();scene.add(v.root);enemyVisuals.set(enemy.id,v);}if(!v)continue;v.root.visible=enemy.alive;if(enemy.alive){v.root.position.set(enemy.position.x,enemy.position.y,enemy.position.z);v.root.lookAt(0,95,0);v.root.rotateY(Math.PI);v.flame.scale.y=.85+Math.sin(time*35)*.15;}}
    const present=new Set();for(const missile of mission.missiles){present.add(missile.id);let v=missileVisuals.get(missile.id);if(!v){v=new T.Group();const b=mesh(v,new T.CylinderGeometry(.16,.16,2.7,8),palette.white);b.rotation.x=Math.PI/2;const s=new T.Sprite(new T.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));s.scale.set(4,4,1);v.add(s);scene.add(v);missileVisuals.set(missile.id,v);}v.position.set(missile.position.x,missile.position.y,missile.position.z);const target=mission.enemies.find(e=>e.id===missile.targetId);if(target)v.lookAt(target.position.x,target.position.y,target.position.z);}
    for(const[id,v]of missileVisuals)if(!present.has(id)){scene.remove(v);v.traverse(o=>{if(o.isSprite)o.material.dispose();});missileVisuals.delete(id);}
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.age+=dt;const a=e.age,attr=e.particles.geometry.attributes.position;for(let k=0;k<e.velocities.length;k++){const v=e.velocities[k];attr.setXYZ(k,v.x*a,v.y*a-12*a*a,v.z*a);}attr.needsUpdate=true;e.sprite.scale.setScalar((e.big?150:80)*(1+a*.4));e.sprite.material.opacity=Math.max(0,1-a/1.3);e.particles.material.opacity=Math.max(0,1-a/3.5);e.ring.scale.setScalar(1+a*(e.big?120:60));e.ring.material.opacity=Math.max(0,.7-a*.5);if(a>4){scene.remove(e.group);e.particles.geometry.dispose();e.particles.material.dispose();e.ring.geometry.dispose();e.ring.material.dispose();e.sprite.material.dispose();effects.splice(i,1);}}
    for(const d of debris){if(d.mesh.position.y>-5){d.velocity.y-=22*dt;d.mesh.position.addScaledVector(d.velocity,dt);d.mesh.rotation.x+=d.spin.x*dt;d.mesh.rotation.z+=d.spin.z*dt;}else d.mesh.visible=false;}
    camera.updateMatrixWorld();renderer.render(scene,camera);
  }
  function project(p){const v=new T.Vector3(p.x,p.y,p.z),view=v.clone().applyMatrix4(camera.matrixWorldInverse);v.project(camera);return {x:(v.x+1)*.5,y:(1-v.y)*.5,visible:view.z<0&&v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1,behind:view.z>=0};}
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();
  return {update,resize,project,explode,breakStatue,reset,dispose(){const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();renderer.dispose();}};
}

