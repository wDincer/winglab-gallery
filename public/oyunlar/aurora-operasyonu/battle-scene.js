import * as T from './vendor/three.module.js';
import {createAircraft} from './aircraft.js';
import {fjordHeight,fjordSurface,CELL} from './aurora-world.js';
import {playerPosition} from './combat.js';
const RAD=Math.PI/180;
export function createBattleScene(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new T.Scene();scene.fog=new T.FogExp2('#142d4c',.000095);
 const camera=new T.PerspectiveCamera(58,1,.3,24000);const sun=new T.DirectionalLight('#a5ccff',2.4);sun.position.set(-2000,5000,-2500);scene.add(sun,new T.HemisphereLight('#a4dff5','#122034',2));
 const skyUniform={time:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(19000,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyUniform,vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
 precision highp float;varying vec3 vDir;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec3 d=normalize(vDir);float h=d.y;float a=atan(d.x,-d.z);float el=asin(h);
 vec3 c=mix(vec3(.065,.16,.265),vec3(.008,.021,.081),smoothstep(-.02,.8,h));
 float haze=pow(max(0.,1.-abs(h-.16)),6.);c+=vec3(.018,.014,.06)*haze;
 for(int i=0;i<3;i++){float fi=float(i);float center=.24+fi*.19+.20*sin(a*2.1+fi*2.+time*.025)+.045*sin(a*6.5+fi+time*.04);float height=el-center;
 float ribbon=exp(-pow(height/.05,2.));float curtain=exp(-max(height,0.)*4.)*smoothstep(-.02,.035,height)*smoothstep(.65,.25,height);
 float folds=.55+.3*sin(a*24.+fi*9.+sin(a*8.)*3.+time*.12)+.15*sin(a*97.+fi*6.);
 vec3 hue=mix(vec3(.19,1.,.58),vec3(.36,.17,.65),smoothstep(.08,.43,height));
 c+=hue*(ribbon*.85+curtain*.38)*folds*(.7+.3*sin(a*1.4+fi));}
 c+=vec3(.07,.015,.095)*exp(-pow((el-.7)/.3,2.))*(.4+.6*sin(a*1.6)*sin(a*1.6));
 vec2 uv=vec2(a*250.,el*260.);vec2 cell=floor(uv);vec2 f=fract(uv)-.5;float star=step(.978,hash(cell))*pow(max(0.,1.-length(f)*2.3),4.)*smoothstep(.01,.13,h);c+=vec3(.65,.8,1.)*star*(.9+hash(cell+3.));
 gl_FragColor=vec4(c,1.);}` }));scene.add(sky);
 const waterU={time:{value:0}};const water=new T.Mesh(new T.PlaneGeometry(30000,30000),new T.ShaderMaterial({uniforms:waterU,vertexShader:`varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,fragmentShader:`precision highp float;varying vec3 p;uniform float time;void main(){float ripple=sin(p.z*.065+sin(p.x*.022)+time*.5)*sin(p.x*.08+time*.2);float reflection=pow(.5+.5*sin(p.x*.0018+sin(p.z*.0004)*2.),6.);vec3 c=vec3(.025,.075,.13)+ripple*.009;c+=vec3(.05,.21,.16)*reflection*.5;float streak=pow(.5+.5*sin(p.z*.3+p.x*.09+time*.8),14.);c+=vec3(.03,.1,.1)*streak*reflection;gl_FragColor=vec4(c,1.);}` }));water.rotation.x=-Math.PI/2;water.position.y=-.4;scene.add(water);
 const terrain=new T.Group();scene.add(terrain);let tileKey='';
 function makeTerrain(px,pz){
  for(const child of [...terrain.children]){terrain.remove(child);child.geometry?.dispose();child.material?.dispose();}
  const size=3200,cols=size/CELL;const positions=[],colors=[],indices=[];const snow=new T.Color('#99b0c7'),rock=new T.Color('#253b51');
  for(let tz=-1;tz<=1;tz++)for(let tx=-1;tx<=1;tx++){
   const start=positions.length/3,x0=(px+tx)*size,z0=(pz+tz)*size;
   for(let row=0;row<=cols;row++)for(let col=0;col<=cols;col++){
    const x=x0+col*CELL,z=z0+row*CELL,y=fjordHeight(x,z);positions.push(x,y,z);
    const slope=Math.hypot(fjordHeight(x+40,z)-fjordHeight(x-40,z),fjordHeight(x,z+40)-fjordHeight(x,z-40))/80;
    const c=snow.clone().lerp(rock,Math.min(.87,slope*.65+(y<30?.3:0)));c.multiplyScalar(.85+.15*Math.sin(x*.011+z*.017));colors.push(c.r,c.g,c.b);
    if(col<cols&&row<cols){const a=start+row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
   }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();terrain.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.93,metalness:.08})));
  const pineGeometry=new T.ConeGeometry(5,24,5);pineGeometry.translate(0,12,0);const pine=new T.InstancedMesh(pineGeometry,new T.MeshStandardMaterial({color:'#112d3a',roughness:1}),620);let count=0;const dummy=new T.Object3D();
  for(let i=0;i<1800&&count<620;i++){const a=Math.sin(i*127.1+px*53+pz*17)*43758.5453,b=Math.sin(i*311.7+px*37)*73513.7;const x=(px-1)*size+(a-Math.floor(a))*size*3,z=(pz-1)*size+(b-Math.floor(b))*size*3,y=fjordSurface(x,z);if(y>10&&y<300){dummy.position.set(x,y,z);dummy.scale.setScalar(.6+(i%7)*.12);dummy.updateMatrix();pine.setMatrixAt(count++,dummy.matrix);}}
  pine.count=count;terrain.add(pine);
 }
 const plane=createAircraft();scene.add(plane);const enemyModels=new Map(),missileModels=new Map(),effectModels=new Map();
 const cyan=new T.MeshBasicMaterial({color:'#98ffe4',toneMapped:false}),orange=new T.MeshBasicMaterial({color:'#ff8e57',toneMapped:false});
 const temp=new T.Vector3(),forward=new T.Vector3(),right=new T.Vector3();let initialized=false,lastState=null,projections=[];
 function remove(map,id){const g=map.get(id);scene.remove(g);g?.traverse(o=>{o.geometry?.dispose();if(o.material?.userData?.unique)o.material.dispose();});map.delete(id);}
 function update(f,c,dt,animate=true){
  lastState=f;const pp=playerPosition(f),p=new T.Vector3(pp.x,pp.y,pp.z);plane.position.copy(p);plane.rotation.set(f.pitch*RAD,-f.heading*RAD,-f.bank*RAD,'YXZ');plane.visible=f.camera!=='cockpit'&&(!c.invulnerable||Math.floor(c.time*12)%3!==0);
  forward.set(Math.sin(f.heading*RAD),0,-Math.cos(f.heading*RAD));right.set(Math.cos(f.heading*RAD),0,Math.sin(f.heading*RAD));
  let eye,target;
  if(f.camera==='cockpit'){eye=p.clone().addScaledVector(forward,3).add(new T.Vector3(0,2.3,0));target=p.clone().addScaledVector(forward,500).add(new T.Vector3(0,f.pitch*3+2,0));}
  else{eye=p.clone().addScaledVector(forward,-88).add(new T.Vector3(0,25,0));target=p.clone().addScaledVector(forward,260).add(new T.Vector3(0,f.pitch*1.2,0));}
  if(!initialized||!animate){camera.position.copy(eye);initialized=true;}else camera.position.lerp(eye,1-Math.exp(-dt*5));camera.up.set(0,1,0);camera.lookAt(target);
  sky.position.copy(p);skyUniform.time.value=c.time;waterU.time.value=c.time;water.position.x=p.x;water.position.z=p.z;
  const px=Math.floor(p.x/3200),pz=Math.floor(p.z/3200),key=px+','+pz;if(key!==tileKey){makeTerrain(px,pz);tileKey=key;}
  for(const [id]of enemyModels)if(!c.enemies.some(e=>e.id===id))remove(enemyModels,id);
  for(const e of c.enemies){let model=enemyModels.get(e.id);if(!model){model=createAircraft(true);enemyModels.set(e.id,model);scene.add(model);}model.position.set(e.position.x,e.position.y,e.position.z);model.rotation.set(.025*Math.sin(e.age),-e.heading,.12*Math.sin(e.age*.6+e.phase),'YXZ');}
  for(const [id,g]of missileModels)if(!c.missiles.some(m=>m.id===id)){scene.remove(g.userData.trail);g.userData.trail.geometry.dispose();g.userData.trail.material.dispose();remove(missileModels,id);}
  for(const m of c.missiles){let group=missileModels.get(m.id);if(!group){group=new T.Group();const body=new T.Mesh(new T.ConeGeometry(.65,5,8),m.owner==='player'?cyan:orange);body.rotation.x=-Math.PI/2;group.add(body);const flame=new T.Mesh(new T.ConeGeometry(1.1,8,8),m.owner==='player'?cyan:orange);flame.rotation.x=Math.PI/2;flame.position.z=5;group.add(flame);const lineGeo=new T.BufferGeometry();lineGeo.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(60),3));const line=new T.Line(lineGeo,new T.LineBasicMaterial({color:m.owner==='player'?'#8fffe2':'#ff795a',transparent:true,opacity:.65}));line.frustumCulled=false;group.userData.trail=line;scene.add(group,line);missileModels.set(m.id,group);}
   group.position.set(m.position.x,m.position.y,m.position.z);group.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),temp.set(m.direction.x,m.direction.y,m.direction.z));group.children[1].scale.setScalar(.8+.3*Math.sin(m.age*40));const line=group.userData.trail;const a=line.geometry.attributes.position;for(let i=0;i<m.trail.length;i++){const q=m.trail[i];a.setXYZ(i,q.x,q.y,q.z);}a.needsUpdate=true;line.geometry.setDrawRange(0,m.trail.length);
  }
  for(const [id,g]of missileModels)if(!c.missiles.some(m=>m.id===id)){scene.remove(g.userData.trail);g.userData.trail.geometry.dispose();g.userData.trail.material.dispose();remove(missileModels,id);}
  for(const [id]of effectModels)if(!c.effects.some(e=>e.id===id))remove(effectModels,id);
  for(const e of c.effects){let g=effectModels.get(e.id);if(!g){g=new T.Group();const material=new T.PointsMaterial({color:'#ffb75c',size:9,transparent:true,opacity:1,blending:T.AdditiveBlending,depthWrite:false});material.userData.unique=true;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(48*3),3));g.add(new T.Points(geometry,material));const coreMat=new T.MeshBasicMaterial({color:'#ffe3a0',transparent:true,blending:T.AdditiveBlending,depthWrite:false});coreMat.userData.unique=true;g.add(new T.Mesh(new T.SphereGeometry(1,12,8),coreMat));effectModels.set(e.id,g);scene.add(g);}g.position.set(e.position.x,e.position.y,e.position.z);const a=g.children[0].geometry.attributes.position;for(let i=0;i<48;i++){const angle=i*2.39996,u=(i/48)*2-1,r=Math.sqrt(1-u*u),speed=18+(i%9)*4;a.setXYZ(i,Math.cos(angle)*r*e.age*speed,u*e.age*speed-12*e.age*e.age,Math.sin(angle)*r*e.age*speed);}a.needsUpdate=true;g.children[0].material.opacity=Math.max(0,1-e.age/2);g.children[1].scale.setScalar(3+e.age*16);g.children[1].material.opacity=Math.max(0,.95-e.age*2);}
  camera.updateMatrixWorld();projections=c.enemies.map(e=>{const v=new T.Vector3(e.position.x,e.position.y,e.position.z).project(camera);const distance=camera.position.distanceTo(new T.Vector3(e.position.x,e.position.y,e.position.z));return{id:e.id,x:(v.x+1)/2,y:(1-v.y)/2,distance,warning:e.warning,radius:Math.min(.045,18/distance),visible:v.z>0&&v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1};});renderer.render(scene,camera);
 }
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 resize();return{update,resize,getProjections:()=>projections,aimDirection(aim){const v=new T.Vector3(aim.x*2-1,1-aim.y*2,.5).unproject(camera).sub(camera.position).normalize();return{x:v.x,y:v.y,z:v.z};},dispose(){scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});renderer.dispose();},renderer};
}

