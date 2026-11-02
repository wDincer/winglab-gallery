import * as THREE from './vendor/three.module.js';
import {PLANETS,PORTALS,playerPosition,forward} from './mission.js';
const TAU=Math.PI*2;
const smooth=(a,b,t)=>{const k=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return k*k*(3-2*k);};
function rng(seed){return ()=>((seed=seed*16807%2147483647)-1)/2147483646;}
export function createFlightScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030710');
  const camera=new THREE.PerspectiveCamera(49,1,.1,16000);
  scene.add(new THREE.AmbientLight('#8ba7c6',1.1));
  const sun=new THREE.DirectionalLight('#e1eeff',3.3);sun.position.set(-200,160,120);scene.add(sun);
  const rim=new THREE.DirectionalLight('#73d7eb',2.2);rim.position.set(80,-30,-100);scene.add(rim);
  const rocket=new THREE.Group();scene.add(rocket);const flames=[];
  const standard=(color,metalness=.2,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const white=standard('#d8dad5',.48,.38),black=standard('#18242b',.6,.44),metal=standard('#657583',.8,.31),orange=standard('#a96532',.45,.47);
  const glow=new THREE.MeshBasicMaterial({color:'#bffff4',toneMapped:false});
  function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
  function cyl(parent,top,bottom,h,x,y,z,mat,n=32){return mesh(parent,new THREE.CylinderGeometry(top,bottom,h,n),mat,x,y,z);}
  function band(parent,r,y,mat,h=.12){return cyl(parent,r,r,h,0,y,0,mat);}
  // Soyuz silhouette: slim upper stage, four tapered strap-on boosters, dark interstage and copper bands.
  cyl(rocket,1.0,1.35,15,0,3,0,white);cyl(rocket,.5,1,4.7,0,12.8,0,white);cyl(rocket,0,.5,3,0,16.65,0,white);cyl(rocket,.05,.05,4,0,20,0,metal);
  band(rocket,1.37,-3.4,black,2.2);band(rocket,1.38,-.9,orange,.9);band(rocket,1.12,8.8,black,.5);
  for(const y of[-4.6,-2.2,0,3.5,6,10.5])band(rocket,y>9?1.03:1.36,y,metal,.08);
  const decalCanvas=document.createElement('canvas');decalCanvas.width=256;decalCanvas.height=512;const dc=decalCanvas.getContext('2d');dc.clearRect(0,0,256,512);dc.fillStyle='#b84332';dc.font='bold 39px Arial';dc.textAlign='center';[...'СОЮЗ'].forEach((c,i)=>dc.fillText(c,125,80+i*53));dc.fillStyle='#243b52';dc.fillRect(74,335,107,15);dc.fillStyle='#b64036';dc.fillRect(74,350,107,15);dc.fillStyle='#d6d5cd';dc.fillRect(74,320,107,15);
  const decal=new THREE.CanvasTexture(decalCanvas);decal.colorSpace=THREE.SRGBColorSpace;mesh(rocket,new THREE.PlaneGeometry(1.8,5),new THREE.MeshBasicMaterial({map:decal,transparent:true,depthWrite:false}),0,6,1.36);
  for(let j=0;j<4;j++){
    const a=j*TAU/4+Math.PI/4,x=Math.cos(a)*2,z=Math.sin(a)*2,b=new THREE.Group();b.position.set(x,-5,z);rocket.add(b);
    cyl(b,.34,1.2,9.7,0,1,0,white);cyl(b,1.2,1.04,2.8,0,-5.2,0,orange);cyl(b,1.04,1.18,1,0,-7.05,0,black);cyl(b,.65,.9,1,0,-7.8,0,metal);
    for(let k=0;k<3;k++){const nozzle=cyl(b,.17,.3,.48,Math.cos(k*TAU/3)*.4,-8.55,Math.sin(k*TAU/3)*.4,black);nozzle.material=black;}
    const fin=mesh(b,new THREE.BoxGeometry(1.4,1.6,.08),metal,Math.cos(a)*.6,-6,Math.sin(a)*.6);fin.rotation.y=-a;
    const flame=mesh(b,new THREE.ConeGeometry(.82,9,20,1,true),new THREE.MeshBasicMaterial({color:'#a8eaff',transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),0,-12,0);flame.rotation.z=Math.PI;flames.push(flame);
    const inner=mesh(b,new THREE.ConeGeometry(.42,6,16),new THREE.MeshBasicMaterial({color:'#fff4d0',transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),0,-10.8,0);inner.rotation.z=Math.PI;flames.push(inner);
  }
  cyl(rocket,.6,.86,1.1,0,-5.2,0,black);
  const engineLight=new THREE.PointLight('#99e4ff',65,50,1.8);rocket.add(engineLight);engineLight.position.y=-10;
  const pad=new THREE.Group();scene.add(pad);cyl(pad,14,16,1.4,0,-15.4,0,standard('#1a2835',.7,.5),64);cyl(pad,10,10,.15,0,-14.6,0,black,64);
  const padRing=mesh(pad,new THREE.TorusGeometry(12,.07,8,100),glow,0,-14.5,0);padRing.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*TAU/12;mesh(pad,new THREE.BoxGeometry(.2,.12,1.5),glow,Math.sin(a)*13,-14.45,Math.cos(a)*13).rotation.y=a;}
  const tower=mesh(pad,new THREE.BoxGeometry(1.2,27,1.2),metal,-9,-2,-3);mesh(pad,new THREE.BoxGeometry(7,.25,.35),metal,-5.5,6,-3);tower.rotation.z=.04;
  const starRoot=new THREE.Group();scene.add(starRoot);const random=rng(410);
  const positions=[],colors=[];
  for(let i=0;i<5000;i++){const z=random()*2-1,a=random()*TAU,r=2500+random()*2400,s=Math.sqrt(1-z*z);positions.push(Math.cos(a)*s*r,z*r,Math.sin(a)*s*r);const c=new THREE.Color().setHSL(.52+random()*.16,.1+random()*.4,.45+random()*.4);colors.push(c.r,c.g,c.b);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));starGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({size:2.8,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:.9}));starRoot.add(stars);
  function nebulaTexture(seed,color){
    const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d'),rand=rng(seed);ctx.clearRect(0,0,512,512);ctx.globalCompositeOperation='lighter';
    for(let i=0;i<95;i++){const t=rand(),x=30+t*450,y=256+Math.sin(t*6+seed)*80+(rand()-.5)*150,r=25+rand()*85,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`${color}${Math.floor(7+rand()*12).toString(16).padStart(2,'0')}`);g.addColorStop(.4,color+'08');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const nebulae=[];const tex=[nebulaTexture(23,'#487c96'),nebulaTexture(39,'#785298'),nebulaTexture(13,'#327e7d')];
  for(let i=0;i<12;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex[i%3],transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false}));s.position.set((i%4-1.5)*1000,((i*7)%5-2)*350,-1600-Math.floor(i/4)*700);s.scale.set(2700,1800,1);s.material.rotation=i*.73;starRoot.add(s);nebulae.push(s);}
  function planetTexture(type){
    const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),rand=rng(type.length*497);
    const palette={earth:['#173f73','#5a8a8c'],mars:['#a65f3d','#75432d'],jupiter:['#cfbda5','#8a6a57'],saturn:['#b9ac87','#94846c'],uranus:['#8ec8ce','#73aeb7']}[type];ctx.fillStyle=palette[0];ctx.fillRect(0,0,1024,512);
    if(type==='earth'){
      ctx.fillStyle='#587d69';const continents=[[[45,110],[100,80],[156,90],[201,130],[213,170],[171,186],[168,228],[126,231],[89,183],[55,174]],[[167,240],[214,252],[242,295],[224,349],[200,382],[181,346],[177,298]],[[433,125],[488,102],[527,127],[560,146],[531,183],[498,184],[485,167],[457,178]],[[482,183],[541,187],[562,228],[533,280],[509,316],[479,279],[457,220]],[[538,114],[621,77],[718,75],[803,117],[809,163],[758,171],[710,196],[671,169],[640,215],[602,200],[585,159]],[[754,294],[806,275],[855,294],[870,330],[814,349],[761,329]],[[327,45],[372,34],[392,56],[361,103],[332,90]]];
      for(const poly of continents){ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
      for(let i=0;i<600;i++){ctx.fillStyle=i%3?'#e8eeee13':'#efffff34';ctx.beginPath();ctx.ellipse(rand()*1024,rand()*512,8+rand()*60,2+rand()*7,rand()*.5,0,TAU);ctx.fill();}
      ctx.fillStyle='#b9cfd7';ctx.fillRect(0,0,1024,15);ctx.fillRect(0,488,1024,24);
    }else{
      for(let y=0;y<512;y++){const blend=Math.sin(y*.075)+Math.sin(y*.31)*.4+Math.sin(y*.023)*.6;ctx.fillStyle=palette[1];ctx.globalAlpha=(blend+2)*.085;ctx.fillRect(0,y,1024,1);}ctx.globalAlpha=1;
      for(let i=0;i<(type==='mars'?550:180);i++){ctx.fillStyle=type==='mars'?'#472e2321':'#f7e8d40a';ctx.beginPath();ctx.ellipse(rand()*1024,rand()*512,2+rand()*70,1+rand()*10,0,0,TAU);ctx.fill();}
      if(type==='jupiter'){ctx.fillStyle='#a26b53';ctx.beginPath();ctx.ellipse(670,321,55,22,.06,0,TAU);ctx.fill();ctx.strokeStyle='#dac6a5';ctx.lineWidth=4;ctx.stroke();}
    }
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const planets=PLANETS.map(d=>{
    const group=new THREE.Group(),body=mesh(group,new THREE.SphereGeometry(d.radius,72,48),new THREE.MeshStandardMaterial({map:planetTexture(d.id),roughness:1,metalness:0}));scene.add(group);
    const atmosphere=mesh(group,new THREE.SphereGeometry(d.radius*1.025,64,32),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(d.id==='mars'?'#c28969':d.id==='earth'?'#78bdff':'#a4e4e3')}},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 color; varying vec3 n; varying vec3 v; void main(){float a=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.8);gl_FragColor=vec4(color,a*.64);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    if(d.id==='saturn'||d.id==='uranus'){
      const rings=new THREE.Group();rings.rotation.x=d.id==='saturn'?1.16:.42;rings.rotation.z=d.id==='saturn'?-.32:.5;group.add(rings);
      const rand=rng(77);for(let i=0;i<(d.id==='saturn'?32:3);i++){const inner=d.radius*(1.3+i*(d.id==='saturn'?.026:.12));mesh(rings,new THREE.RingGeometry(inner,inner+d.radius*(d.id==='saturn'?.018:.008),100),new THREE.MeshBasicMaterial({color:d.id==='saturn'?new THREE.Color().setHSL(.11,.15,.35+rand()*.3):'#a6cfd0',side:THREE.DoubleSide,transparent:true,opacity:d.id==='saturn'?.6:.32,depthWrite:false}));}
    }
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const lc=labelCanvas.getContext('2d');lc.textAlign='center';lc.fillStyle='#d8f4ec';lc.font='26px Arial';lc.fillText(d.name.toLocaleUpperCase('tr'),256,44);lc.fillStyle='#8daab6';lc.font='13px monospace';lc.fillText({earth:'03 / KAYA GEZEGEN',mars:'04 / KIZIL GEZEGEN',jupiter:'05 / GAZ DEVİ',saturn:'06 / HALKALI DEV',uranus:'07 / BUZ DEVİ'}[d.id],256,76);
    const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false}));label.scale.set(.18,.045,1);label.position.set(0,-d.radius*1.16,0);group.add(label);
    return {...d,group,body,atmosphere,label};
  });
  const portals=PORTALS.map(d=>{const group=new THREE.Group();scene.add(group);const rings=[];
    for(let i=0;i<3;i++){const r=mesh(group,new THREE.TorusGeometry(105+i*5,.65-i*.13,8,128),new THREE.MeshBasicMaterial({color:i===1?'#95bbff':'#a7ffe3',transparent:true,opacity:.8-i*.2,blending:THREE.AdditiveBlending,toneMapped:false}));r.rotation.z=i*.3;rings.push(r);}
    for(let i=0;i<36;i++){const a=i*TAU/36,s=mesh(group,new THREE.BoxGeometry(2,6,2),glow,Math.cos(a)*104,Math.sin(a)*104,0);s.rotation.z=a;}
    const surface=mesh(group,new THREE.CircleGeometry(103,96),new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float q=sin(a*9.+r*23.-time*3.)*.5+.5;float edge=pow(r,4.);gl_FragColor=vec4(mix(vec3(.09,.14,.25),vec3(.3,.8,.7),q)*edge,(.05+q*.2)*edge);}',transparent:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));return {...d,group,rings,surface};});
  const actorMap=new Map(),shotMap=new Map(),effectMap=new Map(),warningMap=new Map();
  const meteorGeo=new THREE.IcosahedronGeometry(1,1);const pos=meteorGeo.attributes.position;const rr=rng(47);for(let i=0;i<pos.count;i++){const k=.8+rr()*.4;pos.setXYZ(i,pos.getX(i)*k,pos.getY(i)*k,pos.getZ(i)*k);}meteorGeo.computeVertexNormals();
  const meteorMat=standard('#736c66',.25,.95),ufoMetal=standard('#5b6570',.85,.28),ufoBlack=standard('#202d3b',.8,.3),ufoGlow=new THREE.MeshBasicMaterial({color:'#ffb26d',toneMapped:false});
  function ufo(){const g=new THREE.Group();const disc=mesh(g,new THREE.SphereGeometry(10,40,20),ufoMetal);disc.scale.y=.18;const dome=mesh(g,new THREE.SphereGeometry(4.2,32,20),ufoBlack,0,1.3,0);dome.scale.y=.57;const bottom=mesh(g,new THREE.SphereGeometry(5.8,32,16),ufoBlack,0,-1.1,0);bottom.scale.y=.21;
    for(const r of[4.8,8.4]){const ring=mesh(g,new THREE.TorusGeometry(r,.09,6,64),ufoGlow,0,-.8,0);ring.rotation.x=Math.PI/2;}
    for(let i=0;i<24;i++){const a=i*TAU/24;const light=mesh(g,new THREE.SphereGeometry(.23,8,6),ufoGlow,Math.cos(a)*7.6,-.45,Math.sin(a)*7.6);light.scale.y=.6;}return g;}
  function line(color,opacity=1){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);return new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,toneMapped:false,depthWrite:false}));}
  function updateLine(l,a,b){const arr=l.geometry.attributes.position;arr.setXYZ(0,a.x,a.y,a.z);arr.setXYZ(1,b.x,b.y,b.z);arr.needsUpdate=true;l.geometry.computeBoundingSphere();}
  function clean(map,ids,dispose=false){for(const [id,obj] of map)if(!ids.has(id)){scene.remove(obj);if(dispose){obj.geometry?.dispose();obj.material?.dispose();}else if(obj.isGroup){obj.traverse(child=>child.geometry?.dispose());}map.delete(id);}}
  let lastMode=null,visualTime=0;
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();
  function update(f,m,dt,{playing=false,active=false}={}){
    if(!playing||active)visualTime+=dt;
    const t=m.time,p=playerPosition(f),fw=forward(f),real=new THREE.Vector3(p.x,p.y,p.z),heading=f.heading*Math.PI/180;
    const launched=smooth(0,9,t),mobile=camera.aspect<.8;
    if(!playing){
      rocket.position.set(mobile?7:12,2+Math.sin(visualTime*.7)*.2,0);rocket.rotation.set(.04,-.25,-.12);rocket.scale.setScalar(mobile?.72:1);
      camera.position.set(mobile?32:47,17,mobile?85:76);camera.lookAt(mobile?-6:-9,7,-12);pad.position.set(mobile?7:12,0,0);
    }else{
      rocket.scale.setScalar(.63);rocket.position.copy(real);rocket.rotation.order='YXZ';rocket.rotation.set(-Math.PI/2*launched+f.pitch*Math.PI/180,-heading,-f.bank*Math.PI/180);
      const cockpit=f.camera==='cockpit';rocket.visible=!cockpit;
      const behind=cockpit?3:50,up=cockpit?3:10;
      const cp=real.clone().add(new THREE.Vector3(-fw.x*behind,up,-fw.z*behind));camera.position.copy(cp);camera.lookAt(real.clone().add(new THREE.Vector3(fw.x*100,cockpit?3:-15,fw.z*100)));camera.fov=cockpit?66:53;camera.updateProjectionMatrix();
      pad.position.set(0,-t*7,0);pad.visible=t<10;
    }
    if(!playing){rocket.visible=true;pad.visible=true;camera.fov=49;camera.updateProjectionMatrix();}
    rocket.visible=rocket.visible&&(m.invulnerable<=0||Math.floor(visualTime*18)%3!==0);
    flames.forEach((fl,i)=>{fl.visible=playing?active&&f.speed>5:true;fl.scale.y=(playing?.6+f.speed/150:.35)*(1+.13*Math.sin(visualTime*38+i));});engineLight.intensity=playing?45+f.speed*.5:22;
    starRoot.position.copy(camera.position);stars.rotation.y=visualTime*.0009;
    nebulae.forEach((n,i)=>{n.material.opacity=(!playing?.18:m.zone===0?.17:m.zone===1?.43:.7)*(i<4?1:i<8?(m.zone>0?.8:.25):(m.zone>1?1:.1));n.material.rotation=i*.73+visualTime*.001;});
    for(const planet of planets){
      planet.label.visible=playing;
      if(!playing){planet.group.visible=planet.id==='earth';planet.group.position.set(-180,105,-650);planet.group.scale.setScalar(1.05);planet.body.rotation.y=.8+visualTime*.006;continue;}
      planet.group.scale.setScalar(1);const delta=planet.time-t;
      planet.group.visible=planet.id==='earth'?t<28:t>=18&&delta<55&&delta>-28;
      if(planet.id==='earth'){planet.group.position.set(-100,-320-t*14,p.z-240+t*28);planet.group.scale.setScalar(1.5);}
      else {const side=planet.id==='mars'?-1:planet.id==='saturn'?-1:1;const offset=planet.id==='uranus'?70:planet.radius*1.55;const z=planet.id==='uranus'?Math.max(510,510+delta*20):520+delta*24;planet.group.position.set(side*offset,planet.id==='saturn'?100:planet.id==='uranus'?100:90,p.z-z);}
      planet.body.rotation.y=.8+visualTime*.008;
    }
    for(const portal of portals){const delta=portal.time-t;portal.group.visible=playing&&delta<18&&delta>-.8;portal.group.position.set(0,67,p.z-delta*65);portal.group.rotation.z=visualTime*.15;portal.rings[1].rotation.z=-visualTime*.35;portal.surface.material.uniforms.time.value=visualTime;}
    const actorIds=new Set();for(const a of m.actors){actorIds.add(a.id);let obj=actorMap.get(a.id);if(!obj){obj=a.type==='meteor'?new THREE.Mesh(meteorGeo,meteorMat):ufo();scene.add(obj);actorMap.set(a.id,obj);}obj.position.set(a.position.x,a.position.y,a.position.z);if(a.type==='meteor'){obj.scale.setScalar(a.radius);obj.rotation.set(a.age*.4+a.seed,a.age*.7,a.seed*5);}else obj.rotation.set(.14*Math.sin(a.age),a.rotation+a.age*.12,.1*Math.cos(a.age));}clean(actorMap,actorIds);
    const shotIds=new Set();for(const s of m.shots){shotIds.add(s.id);let obj=shotMap.get(s.id);if(!obj){obj=line(s.owner==='player'?'#b5fff0':'#ff775d');scene.add(obj);shotMap.set(s.id,obj);}const n=new THREE.Vector3(s.velocity.x,s.velocity.y,s.velocity.z).normalize().multiplyScalar(s.owner==='player'?21:15);updateLine(obj,s.position,{x:s.position.x-n.x,y:s.position.y-n.y,z:s.position.z-n.z});}clean(shotMap,shotIds,true);
    const warningIds=new Set();for(const a of m.actors)if(a.warning){warningIds.add(a.id);let obj=warningMap.get(a.id);if(!obj){obj=line('#ffad76',.24);scene.add(obj);warningMap.set(a.id,obj);}updateLine(obj,a.position,a.warning);obj.material.opacity=.12+(Math.sin(a.fireIn*30)+1)*.12;}clean(warningMap,warningIds,true);
    const effectIds=new Set();for(const e of m.effects){effectIds.add(e.id);let obj=effectMap.get(e.id);if(!obj){const rand=rng(Math.round(e.seed*100000)+1),points=[];for(let i=0;i<70;i++)points.push((rand()-.5)*2,(rand()-.5)*2,(rand()-.5)*2);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));obj=new THREE.Points(geo,new THREE.PointsMaterial({color:e.color,size:1.5,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));scene.add(obj);effectMap.set(e.id,obj);}obj.position.set(e.position.x,e.position.y,e.position.z);obj.scale.setScalar(3+e.age*35);obj.material.opacity=1-e.age/1.35;}clean(effectMap,effectIds,true);
    if(lastMode!==playing){lastMode=playing;resize();}renderer.render(scene,camera);
  }
  function aimDirection(clientX,clientY,f){const rect=canvas.getBoundingClientRect(),ndc=new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-((clientY-rect.top)/rect.height*2-1)),ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);const target=ray.ray.at(650,new THREE.Vector3()),p=playerPosition(f);return target.sub(new THREE.Vector3(p.x,p.y,p.z)).normalize();}
  function dispose(){scene.traverse(o=>{o.geometry?.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){mat.map?.dispose();mat.dispose();}}});tex.forEach(t=>t.dispose());renderer.dispose();}
  return {update,resize,dispose,aimDirection};
}
