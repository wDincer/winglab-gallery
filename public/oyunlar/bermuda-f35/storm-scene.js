import * as T from './vendor/three.module.js';
import {createF35,createShark} from './aircraft.js';
import {RULES,sharkPosition} from './survival.js';
const R=Math.PI/180;
export function createStormScene(canvas) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.3,14000);scene.fog=new T.FogExp2('#283f4c',.00024);
  scene.add(new T.HemisphereLight('#b2c9db','#213544',2.5));const sun=new T.DirectionalLight('#c2d6e7',3.2);sun.position.set(-300,550,100);scene.add(sun);
  const flashLight=new T.DirectionalLight('#d8e9ff',0);flashLight.position.set(100,700,-300);scene.add(flashLight);
  const sky=new T.Mesh(new T.SphereGeometry(6500,40,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    uniforms:{time:{value:0},flash:{value:0}},vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 v;uniform float time;uniform float flash;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.54);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+7.;a*=.5;}return n;}
    void main(){vec3 d=normalize(v);vec2 p=d.xz/(max(.13,d.y+.32))*1.7+vec2(time*.006,0);float n=fbm(p*3.);float clouds=smoothstep(.23,.82,n);vec3 col=mix(vec3(.24,.32,.37),vec3(.025,.045,.065),clouds);col*=1.-max(0.,d.y)*.48;col+=vec3(.13,.17,.2)*pow(max(0.,1.-abs(d.y)),12.);col+=flash*vec3(.42,.51,.6);gl_FragColor=vec4(col,1.);}` }));scene.add(sky);
  const uniforms={time:{value:0},vortex:{value:new T.Vector2(230,-800)},radius:{value:RULES.vortexRadius},depth:{value:RULES.vortexDepth},zone:{value:new T.Vector2()},zoneDir:{value:new T.Vector2(1,0)},extent:{value:new T.Vector2()},red:{value:0},flash:{value:0}};
  const oceanMat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,
    vertexShader:`uniform float time;uniform vec2 vortex;uniform float radius;uniform float depth;varying vec3 world;varying float depression;void main(){vec3 p=position;vec2 w=p.xz+vec2(modelMatrix[3].x,modelMatrix[3].z);float r=length(w-vortex);float f=pow(max(0.,1.-r/radius),1.6);p.y=sin(w.x*.027+time*1.1)*2.+sin(w.y*.043-time*1.6)*1.5+sin(w.x*.095+w.y*.07-time*2.)*.6-depth*f;depression=f;world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`uniform float time;uniform vec2 vortex;uniform float radius;uniform vec2 zone;uniform vec2 zoneDir;uniform vec2 extent;uniform float red;uniform float flash;varying vec3 world;varying float depression;
    void main(){vec2 p=world.xz;vec2 delta=p-vortex;float r=length(delta);float a=atan(delta.y,delta.x);float swirl=sin(r*.22+a*8.+time*3.5+sin(a*5.+r*.028-time)*2.);float foam=smoothstep(.52,.98,swirl)*smoothstep(radius+80.,radius*.28,r);float wave=(sin(p.x*.13+p.y*.21+sin(p.y*.032+time)*3.-time*2.)+sin(p.x*.36-p.y*.06+sin(p.x*.021)*3.+time*.8)*.45+sin(p.x*.9+p.y*.3-time*2.)*.15)/1.6;float fine=sin(p.x*1.7+p.y*.9-time*3.)*.5+.5;vec3 col=mix(vec3(.055,.12,.155),vec3(.22,.33,.37),wave*.5+.5);col=mix(col,vec3(.44,.55,.57),foam*.75);col+=fine*.035;col*=1.-depression*.8;vec3 normal=normalize(cross(dFdx(world),dFdy(world)));float light=pow(max(0.,dot(reflect(normalize(vec3(.3,-.7,-.4)),normal),normalize(cameraPosition-world))),18.);col+=vec3(.32,.43,.49)*light*.55;vec2 z=p-zone;vec2 q=vec2(dot(z,zoneDir),dot(z,vec2(-zoneDir.y,zoneDir.x)));float inside=step(abs(q.x),extent.x)*step(abs(q.y),extent.y)*red;float border=(1.-smoothstep(0.,6.,abs(abs(q.x)-extent.x)))*step(abs(q.y),extent.y)*red;col=mix(col,vec3(.42,.045,.045),inside*.34);col+=vec3(1.,.11,.065)*border*.8;float fog=1.-exp(-length(cameraPosition-world)*.00027);col=mix(col,vec3(.18,.25,.29),fog);col+=flash*.16;if(cameraPosition.y< -5.)col=mix(col,vec3(.02,.15,.20),.68);gl_FragColor=vec4(col,1.);}`});
  const ocean=new T.Mesh(new T.PlaneGeometry(14000,14000,384,384).rotateX(-Math.PI/2),oceanMat);scene.add(ocean);
  const jet=createF35();scene.add(jet);const jetLight=new T.PointLight('#c4e5ff',30,35);jetLight.position.set(0,5,-4);jet.add(jetLight);
  const zoneGroup=new T.Group();scene.add(zoneGroup);
  const redMat=new T.MeshBasicMaterial({color:'#ff493f',transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide});
  const zoneFrame=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)),new T.LineBasicMaterial({color:'#ff493f',transparent:true,opacity:.27}));zoneGroup.add(zoneFrame);
  const rim=new T.LineLoop(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#ff6652',transparent:true,opacity:.85}));zoneGroup.add(rim);
  const beacons=[];for(let i=0;i<4;i++){const b=new T.Mesh(new T.CylinderGeometry(.7,.7,360,5),redMat);zoneGroup.add(b);beacons.push(b);}
  const bolts=new T.Group();scene.add(bolts);let boltLife=0,lastStrike=-1;
  const boltMat=new T.LineBasicMaterial({color:'#eff5ff',transparent:true,opacity:1});
  function lightning(x,z,y=0){for(const obj of [...bolts.children]){obj.geometry.dispose();bolts.remove(obj);}const pts=[];let px=x+110,py=1000,pz=z-70;for(let i=0;i<19;i++){const t=(i+1)/19,nx=x+(1-t)*110+(Math.random()-.5)*85*(1-t),ny=1000+(y-1000)*t,nz=z+(Math.random()-.5)*70*(1-t);pts.push(px,py,pz,nx,ny,nz);if(i>4&&i<15&&i%3===0)pts.push(nx,ny,nz,nx+90,ny-80,nz+20);px=nx;py=ny;pz=nz;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));bolts.add(new T.LineSegments(geo,boltMat));boltLife=.6;}
  const rainCount=2000,arr=new Float32Array(rainCount*6);for(let i=0;i<rainCount;i++){const x=(Math.random()-.5)*700,y=Math.random()*450,z=(Math.random()-.5)*700;arr.set([x,y,z,x-1,y-7,z],i*6);}const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(arr,3));const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:'#9db9c7',transparent:true,opacity:.18}));scene.add(rain);
  const sharks=new Map();
  const bubbleCanvas=document.createElement('canvas');bubbleCanvas.width=64;bubbleCanvas.height=64;const bc=bubbleCanvas.getContext('2d');bc.strokeStyle='#d9f6ff';bc.lineWidth=3;bc.beginPath();bc.arc(32,32,23,0,Math.PI*2);bc.stroke();const bubbleMap=new T.CanvasTexture(bubbleCanvas);const bubbles=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({size:1.5,color:'#c3e9ee',map:bubbleMap,transparent:true,opacity:.6,depthWrite:false,alphaTest:.02}));const bub=new Float32Array(220*3);for(let i=0;i<220;i++)bub.set([(Math.random()-.5)*90,Math.random()*200,(Math.random()-.5)*90],i*3);bubbles.geometry.setAttribute('position',new T.BufferAttribute(bub,3));scene.add(bubbles);bubbles.visible=false;
  const target=new T.Vector3(),eye=new T.Vector3(),vortex=new T.Vector2(230,-800);let visualTime=0;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();
  function update(flight,game,dt) {
    visualTime+=dt;const ready=game.phase==='ready',falling=game.phase==='falling'||game.phase==='over';const h=flight.heading*R;
    let x=flight.x,y=flight.altitude+2.15,z=-flight.distance,rotation=new T.Euler(flight.pitch*R,-h,-flight.bank*R,'YXZ');
    if(falling){const l=game.loss,t=game.lossTime,k=Math.min(1,t/4),ease=k*k*(3-2*k),r=95*(1-ease),theta=t*1.4;vortex.set(l.vortexX,-l.vortexDistance);x=l.x+(vortex.x-l.x)*ease+Math.sin(theta)*r*k;z=-l.distance+(vortex.y+l.distance)*ease+Math.cos(theta)*r*k;y=l.altitude*(1-ease)-Math.max(0,t-3.2)*32;rotation.set(-.35,-l.heading*R+t*1.3,Math.sin(t*2)*.6+1,'YXZ');}
    else if(ready){vortex.set(x-450,z+650);}else {vortex.set(flight.x+Math.cos(h)*-220+Math.sin(h)*520,-flight.distance+Math.sin(h)*-220-Math.cos(h)*520);}
    jet.position.set(x,y,z);jet.rotation.copy(rotation);jet.visible=flight.camera!=='cockpit'||falling||ready;jet.userData.exhaust.scale.y=.8+flight.speed/170;jet.userData.exhaust.material.opacity=falling?.1:.42+Math.sin(visualTime*40)*.08;
    if(ready){eye.set(x+25,y+15,z-30);target.set(x+8,y+1,z+10);jet.rotation.y=-.18;}
    else if(flight.camera==='cockpit'&&!falling){eye.set(x+Math.sin(h)*6,y+2,z-Math.cos(h)*6);target.set(x+Math.sin(h)*200,y+flight.pitch,z-Math.cos(h)*200);}
    else {const pull=falling?1:0;eye.set(x-Math.sin(h)*43+Math.cos(h)*12,y+32+pull*12,z+Math.cos(h)*43+Math.sin(h)*12);target.set(x+Math.sin(h)*5,y+1,z-Math.cos(h)*5);}
    camera.position.lerp(eye,ready||dt===0?1:1-Math.exp(-dt*5));camera.up.set(Math.sin(flight.bank*R)*.14,1,0);camera.lookAt(target);
    sky.position.copy(camera.position);sky.material.uniforms.time.value=visualTime;sky.material.uniforms.flash.value=Math.max(game.flash,boltLife*.8);
    ocean.position.x=Math.round(x/100)*100;ocean.position.z=Math.round(z/100)*100;
    uniforms.time.value=visualTime;uniforms.vortex.value.copy(vortex);uniforms.flash.value=Math.max(game.flash,boltLife);
    const zone=game.zone,zh=zone.heading*R;uniforms.zone.value.set(zone.x,-zone.distance);uniforms.zoneDir.value.set(Math.cos(zh),Math.sin(zh));uniforms.extent.value.set(zone.halfWidth,zone.halfLength);uniforms.red.value=ready||falling?0:1;
    zoneGroup.visible=!ready&&!falling;zoneGroup.position.set(zone.x,0,-zone.distance);zoneGroup.rotation.y=-zh;
    zoneFrame.position.y=160;zoneFrame.scale.set(zone.halfWidth*2,320,zone.halfLength*2);
    if(rim.userData.width!==zone.halfWidth){rim.geometry.dispose();rim.geometry=new T.BufferGeometry().setFromPoints([new T.Vector3(-zone.halfWidth,4,-zone.halfLength),new T.Vector3(zone.halfWidth,4,-zone.halfLength),new T.Vector3(zone.halfWidth,4,zone.halfLength),new T.Vector3(-zone.halfWidth,4,zone.halfLength)]);rim.userData.width=zone.halfWidth;}
    beacons.forEach((b,i)=>b.position.set((i%2?1:-1)*zone.halfWidth,180,(i<2?1:-1)*zone.halfLength));
    if(game.strike&&game.strike.at!==lastStrike){lastStrike=game.strike.at;lightning(game.strike.x,-game.strike.distance,game.strike.altitude);}
    boltLife=Math.max(0,boltLife-dt);bolts.visible=boltLife>0;boltMat.opacity=boltLife>.35?1:Math.max(0,boltLife*2.8);flashLight.intensity=Math.max(game.flash,boltLife)*7;
    rain.position.set(x,y+(visualTime*95)%200,z);rain.visible=y>0;
    const live=new Set();for(const s of game.sharks){live.add(s.id);if(!sharks.has(s.id)){const model=createShark();scene.add(model);const ring=new T.Mesh(new T.RingGeometry(11,12,48),new T.MeshBasicMaterial({color:'#ffb478',transparent:true,opacity:.7,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;scene.add(ring);sharks.set(s.id,{model,ring});}const {model,ring}=sharks.get(s.id),p=sharkPosition(s);model.position.set(p.x,p.altitude,-p.distance);model.rotation.set((.5-p.t)*-2.1,s.direction>0?Math.PI/2:-Math.PI/2,Math.sin(p.t*Math.PI)*.2);model.visible=s.age>=RULES.sharkWarningSeconds;ring.position.set(s.target.x,4,-s.target.distance);ring.scale.setScalar(1+(s.age%1)*1.1);ring.material.opacity=s.age<RULES.sharkWarningSeconds?.8:.3;}
    for(const [id,o]of sharks)if(!live.has(id)){scene.remove(o.model,o.ring);o.model.traverse(c=>{c.geometry?.dispose();});o.ring.geometry.dispose();o.ring.material.dispose();sharks.delete(id);}
    bubbles.visible=y<0;bubbles.position.set(x,y-90+(visualTime*18)%70,z);scene.fog.color.set(y<0?'#073342':'#283f4c');scene.fog.density=y<0?.012:.00024;renderer.setClearColor(y<0?'#062c3b':'#283f4c');
    renderer.render(scene,camera);
  }
  return {update,resize,ambientLightning(flight){lightning(flight.x+900,-flight.distance-1400);},dispose(){renderer.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});}};
}
