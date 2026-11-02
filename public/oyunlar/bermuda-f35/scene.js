import * as THREE from './vendor/three.module.js';
import { COURSE, coursePoint, getCourseGates, getCourseCaves, getBoostZones, getCourseTurns } from './course.js';
import { coastAt as coast, smooth, terrainHeight as height, TERRAIN, CAVE_ARCH_STEPS, caveSection, caveCenterXAt } from './world.js';
import {createEagleModel} from './eagle-model.js';

// The landscape, aircraft and textures are generated locally; no remote imagery is required.
export function createFlightScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#b9dce6', 0.00013);
  const camera = new THREE.PerspectiveCamera(48, 1, .2, 33000);
  const sun = new THREE.DirectionalLight('#fff3d4', 3.4);
  sun.position.set(-120, 240, -100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 650 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .06;
  scene.add(sun, sun.target);
  const ambient=new THREE.HemisphereLight('#c7eaff', '#6b7751', 2.25);
  scene.add(ambient);
  const objects = [];
  let seed = 727;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const mat = (color, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness, metalness: .02 });
  const materials = { white: mat('#f3f1e7', .4), orange: mat('#f28336', .5), dark: mat('#263742', .5), rubber: mat('#232b2d'), metal: mat('#8b9698', .3), glass: new THREE.MeshStandardMaterial({ color: '#294e62', metalness: .28, roughness: .22 }), runway: mat('#667071'), line: mat('#e8e9d9'), sand: mat('#dacda0') };
  function mesh(geometry, material, parent = scene) { const m = new THREE.Mesh(geometry, material); parent.add(m); objects.push(m); return m; }
  function box(parent, sx, sy, sz, x, y, z, material) { const m = mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent); m.position.set(x, y, z); return m; }
  function rod(parent, a, b, radius, material) { const d = new THREE.Vector3().subVectors(b, a); const m = mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 8), material, parent); m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
  function texture(draw, size = 1024) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

  const sky = mesh(new THREE.SphereGeometry(25000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#70b7df') }, bottom: { value: new THREE.Color('#deebe6') } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){float h=normalize(vPosition).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.02,.65,h)),1.);}'
  }));
  sky.material.fog = false;

  const waterMap = texture((ctx,s) => { ctx.fillStyle='#65aeb7';ctx.fillRect(0,0,s,s);for(let i=0;i<2900;i++){const x=random()*s,y=random()*s;ctx.strokeStyle=`rgba(220,248,238,${random()*.11})`;ctx.lineWidth=.4+random();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5+random()*35,y-random()*2);ctx.stroke();} });
  waterMap.wrapS = waterMap.wrapT = THREE.RepeatWrapping; waterMap.repeat.set(180,180);
  const sea = mesh(new THREE.PlaneGeometry(65000,65000), new THREE.MeshStandardMaterial({ color:'#73c0c7', map:waterMap, roughness:.38, metalness:.17 }));
  sea.rotation.x=-Math.PI/2;sea.position.y=-1.6;
  const fields = texture((ctx,s) => {ctx.fillStyle='#8b9d60';ctx.fillRect(0,0,s,s);for(let y=0;y<s;y+=64){for(let x=0;x<s;x+=64){const hue=67+random()*22;ctx.fillStyle=`hsl(${hue},${19+random()*14}%,${42+random()*14}%)`;ctx.fillRect(x+1,y+1,62,62);if(random()>.55){ctx.strokeStyle='rgba(225,217,165,.15)';ctx.lineWidth=1;for(let k=4;k<60;k+=4){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k,y+64);ctx.stroke();}}}}for(let i=0;i<14000;i++){ctx.fillStyle=random()>.5?'rgba(255,255,195,.05)':'rgba(31,56,21,.06)';ctx.fillRect(random()*s,random()*s,1+random()*3,1+random()*3);}});
  fields.wrapS=fields.wrapT=THREE.RepeatWrapping;fields.repeat.set(22,28);fields.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const terrainDetail=texture((ctx,s)=>{ctx.fillStyle='#c2c4b2';ctx.fillRect(0,0,s,s);for(let i=0;i<28000;i++){const shade=random()>.5?'255,255,240':'42,56,44';ctx.fillStyle=`rgba(${shade},${.025+random()*.07})`;const r=1+random()*6;ctx.fillRect(random()*s,random()*s,r,r*.6);}for(let i=0;i<100;i++){ctx.strokeStyle='rgba(68,79,66,.035)';ctx.beginPath();const y=random()*s;ctx.moveTo(0,y);ctx.lineTo(s,y+random()*26-13);ctx.stroke();}},512);
  terrainDetail.wrapS=terrainDetail.wrapT=THREE.RepeatWrapping;terrainDetail.repeat.set(38,38);terrainDetail.anisotropy=fields.anisotropy;
  const terrainG=new THREE.PlaneGeometry(TERRAIN.width,TERRAIN.depth,TERRAIN.columns,TERRAIN.rows);terrainG.rotateX(-Math.PI/2);terrainG.translate(TERRAIN.centerX,0,TERRAIN.centerZ);
  const pos=terrainG.attributes.position;const colors=[];
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const edge=coast(z)-x;const h=height(x,z);pos.setY(i,h);const slope=Math.abs(height(x+12,z)-height(x-12,z))/24;const c=new THREE.Color('#9bad78');if(h>150)c.lerp(new THREE.Color('#929983'),Math.min(1,(h-150)/500));if(slope>.6)c.lerp(new THREE.Color('#8b9290'),Math.min(.7,(slope-.6)*.45));if(h>850)c.lerp(new THREE.Color('#c0ccc6'),Math.min(.85,(h-850)/360));if(edge<100)c.set('#dacda9');if(edge<0)c.set('#77bfc4');colors.push(c.r,c.g,c.b);}
  terrainG.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainG.computeVertexNormals();
  const terrain=mesh(terrainG,new THREE.MeshStandardMaterial({map:terrainDetail,vertexColors:true,roughness:1}));terrain.receiveShadow=true;
  // Thin shoreline ribbons follow the island instead of a straight water edge.
  const beachV=[];for(let i=0;i<=300;i++){const z=4000-i*90;const x=coast(z);beachV.push(x-52,-.13,z,x+12,-.85,z);}const beachIdx=[];for(let i=0;i<300;i++){const k=i*2;beachIdx.push(k,k+2,k+1,k+1,k+2,k+3);}const beachG=new THREE.BufferGeometry();beachG.setAttribute('position',new THREE.Float32BufferAttribute(beachV,3));beachG.setIndex(beachIdx);beachG.computeVertexNormals();mesh(beachG,materials.sand);

  // Hollow rock bridges follow the training route with a generous opening.
  const caves=getCourseCaves(),boostZones=getBoostZones();
  const caveRockMap=texture((ctx,s)=>{
    ctx.fillStyle='#98958a';ctx.fillRect(0,0,s,s);
    for(let i=0;i<12000;i++){const r=1+random()*17;ctx.fillStyle=random()>.5?`rgba(225,222,204,${.025+random()*.09})`:`rgba(34,44,40,${.025+random()*.1})`;ctx.fillRect(random()*s,random()*s,r,r*.45);}
    for(let i=0;i<100;i++){const x=random()*s,y=random()*s;ctx.strokeStyle='rgba(38,45,42,.18)';ctx.lineWidth=.5+random()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+20+random()*75,y+10+random()*36);ctx.lineTo(x+15+random()*100,y+30+random()*75);ctx.stroke();}
  },512);
  caveRockMap.wrapS=caveRockMap.wrapT=THREE.RepeatWrapping;caveRockMap.anisotropy=fields.anisotropy;
  const caveRock=new THREE.MeshStandardMaterial({map:caveRockMap,color:'#b2ad9c',emissive:'#9a8c78',emissiveMap:caveRockMap,emissiveIntensity:.38,roughness:1,vertexColors:true,side:THREE.DoubleSide});
  const caveInside=new THREE.MeshStandardMaterial({map:caveRockMap,color:'#929b90',emissive:'#778478',emissiveMap:caveRockMap,emissiveIntensity:.25,roughness:1,vertexColors:true,side:THREE.DoubleSide});
  const caveFloor=new THREE.MeshStandardMaterial({map:caveRockMap,color:'#6d7466',roughness:1});
  const caveLampMat=new THREE.MeshBasicMaterial({color:'#ffd78b',toneMapped:false});
  const caveLampBack=mat('#414b47');
  const archSteps=CAVE_ARCH_STEPS;
  function rockSurface(cave,outer){
    const slices=Math.ceil((cave.end-cave.start)/34),positions=[],uvs=[],colors=[],indices=[];
    const count=archSteps+3;
    for(let row=0;row<=slices;row++){
      const distance=cave.start+(cave.end-cave.start)*row/slices;
      const section=caveSection(cave,distance,outer),centerX=coursePoint(distance).x;
      for(let col=0;col<count;col++){
        const [x,y]=section[col];positions.push(centerX+x,y,-distance);uvs.push(distance/85,col/5);
        const variation=.81+.15*Math.sin(row*1.7+col*1.21+cave.id);
        const c=new THREE.Color(outer?'#b5b5a3':'#c3c4b4').multiplyScalar(variation);colors.push(c.r,c.g,c.b);
        if(row<slices&&col<count-1){const a=row*count+col,b=a+count;indices.push(a,b,a+1,a+1,b,b+1);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const shell=mesh(geometry,outer?caveRock:caveInside);shell.castShadow=true;shell.receiveShadow=true;
  }
  function caveMouth(cave,distance){
    const inner=caveSection(cave,distance),outer=caveSection(cave,distance,true),positions=[],uvs=[],colors=[],indices=[],centerX=caveCenterXAt(cave,distance);
    for(let i=0;i<inner.length;i++){
      positions.push(centerX+inner[i][0],inner[i][1],-distance,centerX+outer[i][0],outer[i][1],-distance);
      uvs.push(inner[i][0]/85,inner[i][1]/85,outer[i][0]/85,outer[i][1]/85);
      const c=new THREE.Color('#b5b6a6').multiplyScalar(.85+.12*Math.sin(i*1.9+cave.id));colors.push(c.r,c.g,c.b,c.r,c.g,c.b);
      if(i<inner.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mouth=mesh(geometry,caveRock);mouth.castShadow=true;mouth.receiveShadow=true;
  }
  function caveFloorStrip(cave){
    const slices=Math.ceil((cave.end-cave.start)/34),positions=[],uvs=[],indices=[];
    for(let row=0;row<=slices;row++){
      const distance=cave.start+(cave.end-cave.start)*row/slices,centerX=coursePoint(distance).x;
      for(const [side,y]of[[-1,.22],[1,.22],[-1,.34],[1,.34]]){
        positions.push(centerX+side*cave.halfWidth,y,-distance);uvs.push(side*cave.halfWidth/85,distance/85);
      }
      if(row<slices){const a=row*4,b=a+4;indices.push(a+2,a+3,b+2,a+3,b+3,b+2,a,b,a+1,a+1,b,b+1,a,b+2,b,a,a+2,b+2,a+1,b+1,b+3,a+1,b+3,a+3);}
    }
    const last=slices*4;indices.push(0,1,2,1,3,2,last,last+2,last+1,last+1,last+2,last+3);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const floor=mesh(geometry,caveFloor);floor.receiveShadow=true;
  }
  for(const cave of caves){
    rockSurface(cave,false);rockSurface(cave,true);caveMouth(cave,cave.start);caveMouth(cave,cave.end);
    caveFloorStrip(cave);
    for(let distance=cave.start+25;distance<cave.end;distance+=85){
      const centerX=caveCenterXAt(cave,distance);
      for(const side of[-1,1]){box(scene,1.3,4,1.6,centerX+side*112,7,-distance,caveLampBack);box(scene,1.4,2,1.7,centerX+side*112,7.6,-distance,caveLampMat);}
    }
    const middle=(cave.start+cave.end)*.5,warmLight=new THREE.PointLight('#ffd6a0',18000,430,2);warmLight.position.set(caveCenterXAt(cave,middle),95,-middle);scene.add(warmLight);
    const caveLabelMap=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#263a37';ctx.fillRect(7,42,s-14,166);ctx.strokeStyle='#e6bd80';ctx.lineWidth=4;ctx.strokeRect(7,42,s-14,166);ctx.fillStyle='#f8e8ca';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 42px Arial';ctx.fillText('MAĞARA',s/2,105);ctx.font='500 57px Arial';ctx.fillText(String(cave.id).padStart(2,'0'),s/2,164);},256);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:caveLabelMap,transparent:true,depthWrite:false}));label.position.set(caveCenterXAt(cave,cave.start),cave.ceilingY+19,-cave.start+3);label.scale.set(42,25,1);scene.add(label);
  }

  // Turquoise acceleration corridors are visually distinct from orange route gates.
  const boostTube=new THREE.TorusGeometry(1,.012,5,56),boostVisuals=[];
  const boostSignMap=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#123d39';ctx.fillRect(8,42,s-16,172);ctx.strokeStyle='#71f6cc';ctx.lineWidth=5;ctx.strokeRect(8,42,s-16,172);ctx.fillStyle='#b5ffe9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 62px Arial';ctx.fillText('İVME',s/2,105);ctx.font='500 32px Arial';ctx.fillText('HIZLAN',s/2,169);},256);
  const boostSignMaterial=new THREE.SpriteMaterial({map:boostSignMap,transparent:true,depthWrite:false,toneMapped:false});
  const boostArrowMaterial=new THREE.MeshBasicMaterial({color:'#75f8cc',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  for(const zone of boostZones){
    for(let i=0;i<5;i++){
      const ring=mesh(boostTube,new THREE.MeshBasicMaterial({color:'#61f8cb',transparent:true,opacity:.4,depthWrite:false,toneMapped:false}));
      const distance=zone.start+(zone.end-zone.start)*i/4;
      ring.position.set(coursePoint(distance).x,zone.y,-distance);ring.scale.set(zone.halfWidth,zone.halfHeight,35);boostVisuals.push({ring,index:i});
    }
    for(let distance=zone.start+25;distance<zone.end;distance+=65){
      const base=coursePoint(distance-13),tip=coursePoint(distance+10);
      rod(scene,new THREE.Vector3(base.x-23,8,base.z),new THREE.Vector3(tip.x,8,tip.z),.75,boostArrowMaterial);
      rod(scene,new THREE.Vector3(base.x+23,8,base.z),new THREE.Vector3(tip.x,8,tip.z),.75,boostArrowMaterial);
    }
    const sign=new THREE.Sprite(boostSignMaterial);sign.position.set(coursePoint(zone.start).x,zone.y+zone.halfHeight+15,-zone.start+2);sign.scale.set(38,25,1);scene.add(sign);
  }
  let caveShade=0;

  // The first five numbered arches are straight; later arches teach graduated turns.
  const gateOrange=new THREE.MeshStandardMaterial({color:'#f5a363',emissive:'#c97839',emissiveIntensity:.35,roughness:.55});
  const gateWhite=new THREE.MeshStandardMaterial({color:'#e7eee4',roughness:.65});
  const gateTube=new THREE.TorusGeometry(1,.018,6,64);
  const gateStripe=new THREE.TorusGeometry(1,.02,6,12,Math.PI/5);
  const markerLight=new THREE.MeshBasicMaterial({color:'#9ce9de',toneMapped:false});
  for(let distance=COURSE.mountainStart;distance<=COURSE.length;distance+=180){
    const centerX=coursePoint(distance).x;
    for(const side of[-1,1]){box(scene,1.5,3,1.5,centerX+side*125,1.5,-distance,materials.metal);box(scene,2,.35,2,centerX+side*125,3.2,-distance,markerLight);}
  }
  const gateVisuals=[];
  for(const [index,gate]of getCourseGates().entries()){
    const p=coursePoint(gate.distance),group=new THREE.Group();scene.add(group);group.position.set(p.x,p.y,p.z);
    const ring=mesh(gateTube,gateOrange,group);ring.scale.set(gate.finish?73:62,gate.finish?39:32,36);
    const stripeGroup=new THREE.Group();group.add(stripeGroup);stripeGroup.scale.copy(ring.scale);
    for(let i=0;i<4;i++){const stripe=mesh(gateStripe,gateWhite,stripeGroup);stripe.rotation.z=i*Math.PI/2+.15;}
    const foot=gate.finish?73:62;
    for(const side of[-1,1]){box(scene,1.2,p.y,1.2,p.x+side*foot,p.y*.5,p.z,gateWhite);box(scene,5,.55,5,p.x+side*foot,.5,p.z,gateOrange);}
    const instruction=gate.finish?'PARKUR TAMAM':!gate.turnAngle?'DÜZ':gate.direction==='left'?`← ${gate.turnAngle}°`:`${gate.turnAngle}° →`;
    const labelMap=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#183b43';ctx.fillRect(s*.08,s*.13,s*.84,s*.74);ctx.strokeStyle='#f5a363';ctx.lineWidth=5;ctx.strokeRect(s*.08,s*.13,s*.84,s*.74);ctx.fillStyle='#eef4e8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${gate.finish?57:100}px Arial`;ctx.fillText(gate.finish?'FİNİŞ':String(index+1).padStart(2,'0'),s/2,s*.41);ctx.font=`600 ${gate.finish?21:36}px Arial`;ctx.fillStyle=!gate.turnAngle?'#b9d9cf':'#ffd1a1';ctx.fillText(instruction,s/2,s*.71);},256);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelMap,transparent:true,depthWrite:false}));label.position.set(0,(gate.finish?39:32)+15,0);label.scale.set(gate.finish?34:28,24,1);group.add(label);
    gateVisuals.push({group,distance:gate.distance});
    if(gate.finish){for(const side of[-1,1]){const flag=mesh(new THREE.PlaneGeometry(12,18),new THREE.MeshStandardMaterial({color:'#f5a363',side:THREE.DoubleSide,roughness:.7}));flag.position.set(p.x+side*87,p.y+17,p.z);}}
  }
  const turnVisuals=[];
  for(const turn of getCourseTurns()){
    const distance=turn.start-95,p=coursePoint(distance),left=turn.direction==='left';
    const map=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#183b43';ctx.fillRect(8,36,s-16,184);ctx.strokeStyle='#ffb878';ctx.lineWidth=5;ctx.strokeRect(8,36,s-16,184);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#cce1d8';ctx.font='600 23px Arial';ctx.fillText('DÖNÜŞ ALANI',s/2,76);ctx.fillStyle='#ffe1b6';ctx.font='600 75px Arial';ctx.fillText(left?`← ${turn.angle}°`:`${turn.angle}° →`,s/2,140);ctx.font='600 24px Arial';ctx.fillText(left?'SOLA':'SAĞA',s/2,192);},256);
    const sign=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));sign.position.set(p.x+(left?-92:92),p.y+28,p.z);sign.scale.set(42,36,1);scene.add(sign);turnVisuals.push({sign,distance});
  }

  // The runway is an actual surface, with threshold bars, touchdown markings and edge lights.
  const runway=box(scene,46,.12,2300,0,.11,-950,materials.runway);runway.receiveShadow=true;
  box(scene,1.3,.025,2270,-21,.19,-950,materials.line);box(scene,1.3,.025,2270,21,.19,-950,materials.line);
  for(let z=110;z>-2050;z-=90)box(scene,.8,.03,40,0,.2,z,materials.line);
  for(const end of [140,-2040])for(const side of [-1,1])for(let i=0;i<5;i++)box(scene,1.4,.04,35,side*(5+i*3),.22,end,materials.line);
  for(const z of [-100,-350,-600])for(const side of [-1,1])box(scene,5,.03,27,side*13,.21,z,materials.line);
  const runwayNumber=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#f1f0df';ctx.font='bold 600px Arial';ctx.textAlign='center';ctx.fillText('36',s/2,740);});
  const number=mesh(new THREE.PlaneGeometry(23,38),new THREE.MeshBasicMaterial({map:runwayNumber,transparent:true,depthWrite:false}));number.rotation.x=-Math.PI/2;number.position.set(0,.24,80);
  const taxi=box(scene,18,.08,1500,-125,.08,-700,mat('#8e9687'));taxi.receiveShadow=true;
  box(scene,110,.08,19,-65,.1,-10,mat('#8e9687'));box(scene,150,.08,250,-190,.08,-540,mat('#8e9687'));
  const yellow=mat('#d9c86d');box(scene,.3,.03,1450,-125,.15,-700,yellow);
  for(let z=160;z>-2100;z-=65){for(const side of [-1,1]){box(scene,.5,.5,.5,side*24,.38,z,mat('#e7e0b0'));}}
  function hangar(x,z,w=70){const g=new THREE.Group();scene.add(g);const cream=mat('#d5d4bd'),roof=mat('#818f8c');box(g,w,15,45,x,7.5,z,cream);const r=box(g,w+3,2,48,x,16,z,roof);r.rotation.z=.035;box(g,w*.8,11,.25,x,5.5,z+22.7,mat('#596c6b'));for(let i=0;i<7;i++)box(g,.15,11,.15,x-w*.38+i*w*.125,5.5,z+22.95,mat('#9ca8a1'));}
  hangar(-205,-470);hangar(-205,-560,90);hangar(-205,-660,65);
  const tower=new THREE.Group();scene.add(tower);box(tower,13,29,15,-290,14.5,-790,mat('#c9cfc3'));box(tower,22,7,22,-290,32,-790,materials.glass);box(tower,25,1,25,-290,36,-790,mat('#6b7c7b'));box(tower,.5,8,.5,-290,40,-790,materials.metal);
  for(let i=0;i<30;i++){const x=-400-random()*500,z=200-random()*2700;box(scene,16+random()*40,5+random()*12,13+random()*25,x,5,z,mat(i%2?'#b5b5a3':'#c4c5ae'));}
  // Trees share geometry and materials to keep the camera and pose model responsive.
  const treeCount=1800;const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.45,.6,5,5),mat('#776e50'),treeCount);const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(1,2.2,6),mat('#4f745d'),treeCount);const dummy=new THREE.Object3D();
  let ti=0;while(ti<treeCount){const x=-2800+random()*5600,z=1800-random()*12000;if(Math.abs(x-coursePoint(-z).x)<190||(x<-85&&x>-550&&z>-1300&&z<300)||x>coast(z)-100)continue;const y=height(x,z);if(y>680)continue;const s=4+random()*6;dummy.position.set(x,y+2.5,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(ti,dummy.matrix);dummy.position.y=y+s*.8+2;dummy.scale.set(s*.65,s,s*.65);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();crowns.setMatrixAt(ti,dummy.matrix);ti++;}scene.add(trunks,crowns);
  const cloudMap=texture((ctx,s)=>{for(let i=0;i<21;i++){const x=s*(.2+random()*.6),y=s*(.34+random()*.28),r=s*(.08+random()*.1);const gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.65)');gr.addColorStop(.55,'rgba(255,255,255,.42)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,r*2,r*2);}},256);
  for(let i=0;i<32;i++){const m=new THREE.SpriteMaterial({map:cloudMap,transparent:true,opacity:.4+random()*.35,depthWrite:false,fog:true});const c=new THREE.Sprite(m);c.position.set((random()-.5)*16000,1300+random()*1600,-3000-random()*13000);const s=1200+random()*2600;c.scale.set(s,s*.47,1);scene.add(c);}

  const aircraft=new THREE.Group();scene.add(aircraft);
  const profile=[new THREE.Vector2(.22,-5.3),new THREE.Vector2(.66,-4.7),new THREE.Vector2(.83,-3.2),new THREE.Vector2(.86,-1.3),new THREE.Vector2(.73,.9),new THREE.Vector2(.48,3.4),new THREE.Vector2(.18,5.4),new THREE.Vector2(.11,5.9)];
  const body=mesh(new THREE.LatheGeometry(profile,32),materials.white,aircraft);body.rotation.x=Math.PI/2;body.scale.z=.88;body.castShadow=true;
  // Clear, dark cabin windows sit under the shoulder-mounted wing.
  const canopy=mesh(new THREE.SphereGeometry(1,24,16),materials.glass,aircraft);canopy.scale.set(.79,.69,1.48);canopy.position.set(0,.65,-1.75);
  for(const side of [-1,1]){rod(aircraft,new THREE.Vector3(side*.76,.5,-2.6),new THREE.Vector3(side*.7,1.08,-1.05),.052,materials.white);rod(aircraft,new THREE.Vector3(side*.74,.55,-.5),new THREE.Vector3(side*.55,1.1,-.5),.045,materials.white);}
  function wingShape(points,thickness,material,y=0){const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p[0],p[1]):shape.moveTo(p[0],p[1]));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.055,bevelThickness:.035});geo.rotateX(Math.PI/2);const m=mesh(geo,material,aircraft);m.position.y=y;m.castShadow=true;return m;}
  wingShape([[-8.9,-.9],[-8.55,-1.55],[-.7,-1.85],[.7,-1.85],[8.55,-1.55],[8.9,-.9],[8.7,.65],[.7,1.05],[-.7,1.05],[-8.7,.65]],.2,materials.white,1.45);
  for(const side of [-1,1]){wingShape([[side*7.6,-1.58],[side*8.55,-1.55],[side*8.9,-.9],[side*8.7,.65],[side*7.6,.72]],.21,materials.orange,1.47);rod(aircraft,new THREE.Vector3(side*.64,-.25,-.25),new THREE.Vector3(side*4.8,1.29,-.48),.055,materials.white);box(aircraft,5.45,.016,.025,side*4.4,1.48,.42,materials.metal);box(aircraft,.028,.017,1.9,side*6.9,1.48,-.46,materials.metal);}
  wingShape([[-3.2,4.2],[-2.7,3.8],[0,4.15],[2.7,3.8],[3.2,4.2],[3.05,5.3],[0,5.7],[-3.05,5.3]],.12,materials.white,.4);
  for(const side of [-1,1])wingShape([[side*2.5,3.86],[side*2.7,3.8],[side*3.2,4.2],[side*3.05,5.3],[side*2.5,5.38]],.13,materials.orange,.42);
  const finShape=new THREE.Shape();finShape.moveTo(3.3,.1);finShape.lineTo(4.45,2.9);finShape.quadraticCurveTo(4.6,3.25,5.15,3.25);finShape.lineTo(5.7,3.05);finShape.lineTo(5.85,.1);finShape.closePath();const finGeo=new THREE.ExtrudeGeometry(finShape,{depth:.15,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:1,steps:1});const fin=mesh(finGeo,materials.orange,aircraft);fin.rotation.y=-Math.PI/2;fin.position.x=.075;fin.castShadow=true;
  // Long orange fuselage accent is visible from either side.
  for(const side of [-1,1]){const vertices=[];for(const [z,r]of[[-4.6,.55],[-3.1,.84],[-1,.84],[1,.7],[3.3,.49],[5.3,.18]])vertices.push(side*r,.02,z,side*(r*.985),-.2,z);const idx=[];for(let i=0;i<5;i++){let k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(idx);g.computeVertexNormals();const stripe=mesh(g,new THREE.MeshStandardMaterial({color:'#ee8235',roughness:.55,side:THREE.DoubleSide}),aircraft);}
  const gear=new THREE.Group();aircraft.add(gear);
  for(const side of [-1,1]){rod(gear,new THREE.Vector3(side*.6,-.55,-.2),new THREE.Vector3(side*1.65,-1.65,-.1),.075,materials.metal);const wheel=mesh(new THREE.CylinderGeometry(.4,.4,.26,18),materials.rubber,gear);wheel.rotation.z=Math.PI/2;wheel.position.set(side*1.65,-1.68,-.1);const hub=mesh(new THREE.CylinderGeometry(.18,.18,.28,14),materials.metal,gear);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);}
  rod(gear,new THREE.Vector3(0,-.4,-3.65),new THREE.Vector3(0,-1.65,-3.65),.075,materials.metal);const noseWheel=mesh(new THREE.CylinderGeometry(.31,.31,.25,16),materials.rubber,gear);noseWheel.rotation.z=Math.PI/2;noseWheel.position.set(0,-1.75,-3.65);
  const spinner=mesh(new THREE.ConeGeometry(.37,.9,24),materials.orange,aircraft);spinner.rotation.x=-Math.PI/2;spinner.position.set(0,0,-5.63);
  const prop=new THREE.Group();prop.position.z=-5.5;aircraft.add(prop);for(let i=0;i<2;i++){const blade=box(prop,.18,3.45,.07,0,0,0,materials.dark);blade.rotation.z=i*Math.PI/2;}
  const propDisc=mesh(new THREE.CircleGeometry(1.7,40),new THREE.MeshBasicMaterial({color:'#b5c9ca',transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false}),aircraft);propDisc.position.z=-5.52;
  const navRed=new THREE.MeshBasicMaterial({color:'#ff5b40'}),navGreen=new THREE.MeshBasicMaterial({color:'#74fbc8'});const nr=mesh(new THREE.SphereGeometry(.07,8,6),navRed,aircraft);nr.position.set(-8.85,1.48,-.25);const ng=mesh(new THREE.SphereGeometry(.07,8,6),navGreen,aircraft);ng.position.set(8.85,1.48,-.25);
  const wingDecal=texture((ctx,s)=>{ctx.clearRect(0,0,s,s);ctx.fillStyle='#47565a';ctx.font='bold 130px Arial';ctx.textAlign='center';ctx.fillText('WINGLAB',s/2,s/2);ctx.fillStyle='#ef8c41';ctx.fillRect(s*.14,s*.6,s*.72,10);},512);
  for(const side of [-1,1]){const decal=mesh(new THREE.PlaneGeometry(3.6,1.45),new THREE.MeshBasicMaterial({map:wingDecal,transparent:true,depthWrite:false}),aircraft);decal.rotation.x=-Math.PI/2;decal.rotation.z=side<0?0:Math.PI;decal.position.set(side*4.7,1.53,-.34);}
  const eagle=createEagleModel();scene.add(eagle.root);eagle.root.visible=false;
  // Contact shadow remains readable even with a sunlit white aircraft.
  const shadowMap=texture((ctx,s)=>{const gr=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.5);gr.addColorStop(0,'rgba(24,42,34,.32)');gr.addColorStop(.65,'rgba(24,42,34,.16)');gr.addColorStop(1,'rgba(24,42,34,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,s,s);},128);
  const contact=mesh(new THREE.PlaneGeometry(22,13),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.25;
  // Shared, faceted collectible gems stay bright against both sky and landscape.
  const gemVertices=[];
  const facet=(a,b,c)=>gemVertices.push(...a,...b,...c);
  const gemRing=(radius,y,index)=>[Math.cos(index*Math.PI/3)*radius,y,Math.sin(index*Math.PI/3)*radius];
  for(let i=0;i<6;i++){
    const top=gemRing(1.05,1.4,i),nextTop=gemRing(1.05,1.4,i+1),waist=gemRing(2.15,.45,i),nextWaist=gemRing(2.15,.45,i+1);
    facet([0,1.4,0],nextTop,top);facet(top,nextTop,nextWaist);facet(top,nextWaist,waist);facet(waist,nextWaist,[0,-2.1,0]);
  }
  const gemGeometry=new THREE.BufferGeometry();gemGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gemVertices,3));gemGeometry.computeVertexNormals();
  const gemMaterial=new THREE.MeshStandardMaterial({color:'#5af3ed',emissive:'#04c6d0',emissiveIntensity:.85,roughness:.18,metalness:.28,flatShading:true,toneMapped:false});
  const gemEdgesGeometry=new THREE.EdgesGeometry(gemGeometry,24),gemEdgesMaterial=new THREE.LineBasicMaterial({color:'#d5ffff',transparent:true,opacity:.8,toneMapped:false});
  const gemHaloGeometry=new THREE.TorusGeometry(4.8,.045,4,48),gemHaloMaterial=new THREE.MeshBasicMaterial({color:'#88fff0',transparent:true,opacity:.32,depthWrite:false,toneMapped:false});
  const gemGlowMap=texture((ctx,s)=>{const glow=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);glow.addColorStop(0,'rgba(120,255,250,.65)');glow.addColorStop(.22,'rgba(32,249,244,.25)');glow.addColorStop(1,'rgba(10,246,244,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,s,s);},128);
  const gemGlowMaterial=new THREE.SpriteMaterial({map:gemGlowMap,color:'#5cfff2',transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const sparklePositions=[];
  for(let i=0;i<16;i++){const angle=i*2.399963,vertical=1-2*(i+.5)/16,horizontal=Math.sqrt(1-vertical*vertical);sparklePositions.push(Math.cos(angle)*horizontal,vertical,Math.sin(angle)*horizontal);}
  const sparkleGeometry=new THREE.BufferGeometry();sparkleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sparklePositions,3));
  const diamondResources=[gemGeometry,gemMaterial,gemEdgesGeometry,gemEdgesMaterial,gemHaloGeometry,gemHaloMaterial,gemGlowMap,gemGlowMaterial,sparkleGeometry];
  const diamondVisuals=new Map();
  function makeDiamond(){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);scene.add(root);
    body.add(new THREE.Mesh(gemGeometry,gemMaterial),new THREE.LineSegments(gemEdgesGeometry,gemEdgesMaterial));
    const halo=new THREE.Mesh(gemHaloGeometry,gemHaloMaterial);root.add(halo);
    const glow=new THREE.Sprite(gemGlowMaterial);glow.scale.set(15,15,1);root.add(glow);
    const burst=new THREE.Points(sparkleGeometry,new THREE.PointsMaterial({color:'#bafff6',size:.65,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));root.add(burst);burst.visible=false;
    return {root,body,halo,glow,burst};
  }
  function updateDiamonds(state){
    const present=new Set(),time=Number(state.time)||0;
    for(const gem of state.diamonds||[]){
      present.add(gem.id);let visual=diamondVisuals.get(gem.id);
      if(!visual){visual=makeDiamond();diamondVisuals.set(gem.id,visual);}
      const {root,body,halo,glow,burst}=visual;
      const age=gem.collected&&Number.isFinite(gem.collectedAt)?time-gem.collectedAt:Infinity;
      const sparkling=gem.collected&&age>=0&&age<.6;
      root.visible=(!gem.collected||sparkling)&&Math.hypot(gem.x-camera.position.x,gem.y-camera.position.y,gem.z-camera.position.z)<4500;
      root.position.set(gem.x,gem.y+(gem.collected?0:Math.sin(time*2+gem.id*.7)*.35),gem.z);
      body.visible=halo.visible=glow.visible=!gem.collected;
      body.rotation.y=time*1.2+gem.id*.9;body.rotation.z=Math.sin(time*1.6+gem.id)*.08;
      halo.quaternion.copy(camera.quaternion);glow.material.rotation=0;
      burst.visible=sparkling;
      if(sparkling){burst.scale.setScalar(1+age*18);burst.material.opacity=1-age/.6;}
    }
    for(const [id,visual]of diamondVisuals){if(!present.has(id)){scene.remove(visual.root);visual.burst.material.dispose();diamondVisuals.delete(id);}}
  }
  let first=true;
  const cameraTarget=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),lookAt=new THREE.Vector3(),headingVec=new THREE.Vector3(),rightVec=new THREE.Vector3();
  function resize(){const width=canvas.clientWidth||innerWidth,height=canvas.clientHeight||innerHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  resize();
  function update(state,dt=.016){
    const targetFov=(state.camera==='cockpit'?50:48)+Math.min(1,(Number(state.speed)||0)/170)*7+(state.courseBoostActive?5:0);
    if(Math.abs(camera.fov-targetFov)>.01){camera.fov+=(targetFov-camera.fov)*(1-Math.exp(-Math.min(dt,.1)*4));camera.updateProjectionMatrix();}
    const alt=Math.max(0,Number(state.altitude)||0),heading=(Number(state.heading)||0)*Math.PI/180;
    const px=Number(state.x)||0,pz=-(Number(state.distance)||0),py=2.15+alt;
    for(const {sign,distance}of turnVisuals){const ahead=distance+(pz||0);sign.visible=ahead>=-130&&ahead<=850;}
    let targetShade=0;
    if(state.inCave){for(const cave of caves){const distance=-pz;if(distance>=cave.start&&distance<=cave.end)targetShade=Math.min(smooth(cave.start,cave.start+65,distance),1-smooth(cave.end-65,cave.end,distance));}}
    caveShade+=(targetShade-caveShade)*(1-Math.exp(-Math.min(dt,.1)*4));
    sun.intensity=3.4-caveShade*2.7;ambient.intensity=2.25-caveShade*1.05;
    for(const {ring,index}of boostVisuals)ring.material.opacity=.25+(.5+.5*Math.sin((Number(state.time)||0)*4-index*.8))*(state.courseBoostActive ? .42 : .25);
    aircraft.position.set(px,py,pz);aircraft.rotation.set((Number(state.pitch)||0)*Math.PI/180,-heading,-(Number(state.bank)||0)*Math.PI/180,'YXZ');
    const eagleMode=state.vehicle==='eagle';
    eagle.root.position.copy(aircraft.position);eagle.root.rotation.copy(aircraft.rotation);
    if(eagleMode&&!state.crashed)eagle.update(state);
    if(!state.crashed&&!eagleMode)prop.rotation.z+=(2+(Number(state.speed)||0)*.5)*Math.min(dt,.05);propDisc.visible=(Number(state.speed)||0)>8;prop.visible=(Number(state.speed)||0)<25;
    headingVec.set(Math.sin(heading),0,-Math.cos(heading));rightVec.set(Math.cos(heading),0,Math.sin(heading));
    if(state.camera==='cockpit'){
      aircraft.visible=false;eagle.root.visible=false;desiredCamera.copy(aircraft.position).addScaledVector(headingVec,2.9);desiredCamera.y+=1.05;cameraTarget.copy(desiredCamera).addScaledVector(headingVec,180);cameraTarget.y+=Math.sin((Number(state.pitch)||0)*Math.PI/180)*130;
    }else{
      aircraft.visible=!eagleMode;eagle.root.visible=eagleMode;desiredCamera.copy(aircraft.position).addScaledVector(headingVec,-25);desiredCamera.y+=8.8;cameraTarget.copy(aircraft.position).addScaledVector(headingVec,4);cameraTarget.y+=3.3;
    }
    const blend=first?1:1-Math.exp(-Math.min(dt,.1)*9);camera.position.lerp(desiredCamera,blend);lookAt.lerp(cameraTarget,blend);camera.lookAt(lookAt);if(state.camera==='cockpit')camera.rotateZ(-(Number(state.bank)||0)*Math.PI/180*.65);
    sky.position.copy(camera.position);sun.position.set(px-120,py+240,pz-100);sun.target.position.copy(aircraft.position);contact.position.set(px,.245,pz);contact.scale.setScalar(1+alt*.02);contact.material.opacity=Math.max(0,1-alt/70);contact.rotation.z=-heading;
    updateDiamonds(state);
    waterMap.offset.x=(Number(state.time)||0)*.000025;first=false;renderer.render(scene,camera);
  }
  update({altitude:0,speed:0,heading:0,bank:0,pitch:0,distance:0,x:0,time:0,camera:'chase'},.016);
  return {update,resize,dispose(){const resources=new Set(diamondResources);scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}}});for(const resource of resources)resource.dispose();diamondVisuals.clear();renderer.dispose();}};
}



