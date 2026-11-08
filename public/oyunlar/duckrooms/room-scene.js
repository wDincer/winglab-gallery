import * as THREE from './vendor/three.module.js';
import {ROOMS,DUCK,clearSight} from './rooms.js?v=duck-waves-v1';
import {createDuck} from './duck-model.js?v=duck-waves-v1';

function seeded(seed=78){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function surfaceTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),random=seeded(kind==='wall'?17:39);
  ctx.fillStyle=kind==='wall'?'#b4a35f':kind==='floor'?'#8a7952':'#c2bd93';ctx.fillRect(0,0,256,256);
  const image=ctx.getImageData(0,0,256,256);
  for(let i=0;i<image.data.length;i+=4){const noise=(random()-.5)*(kind==='floor'?34:15);for(let c=0;c<3;c++)image.data[i+c]+=noise;}
  ctx.putImageData(image,0,0);
  if(kind==='wall'){
    ctx.strokeStyle='#746a3520';ctx.lineWidth=.7;
    for(let y=-16;y<280;y+=32)for(let x=-12;x<280;x+=24){
      const px=x+(y%64?12:0);ctx.beginPath();ctx.moveTo(px,y-9);ctx.bezierCurveTo(px+9,y-2,px+9,y+4,px,y+12);ctx.bezierCurveTo(px-9,y+4,px-9,y-2,px,y-9);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px-5,y+2);ctx.lineTo(px+5,y+2);ctx.stroke();
    }
    ctx.fillStyle='#514c2326';ctx.fillRect(255,0,1,256);
  }else if(kind==='ceiling'){
    ctx.strokeStyle='#645f4a70';ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);ctx.strokeStyle='#ded7ae90';ctx.lineWidth=1;ctx.strokeRect(3,3,250,250);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function exitSignTexture(arrow='forward'){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=224;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e8edcc';ctx.fillRect(0,0,768,224);
  ctx.fillStyle='#145d3a';ctx.fillRect(9,9,750,206);
  ctx.strokeStyle='#e8edcc';ctx.lineWidth=4;ctx.strokeRect(22,22,724,180);
  ctx.fillStyle='#f3f3d6';ctx.textAlign=arrow?'left':'center';ctx.textBaseline='middle';
  ctx.font='bold 112px Arial, sans-serif';ctx.fillText('ÇIKIŞ',arrow?52:384,118);
  if(arrow){
    // The same four cached arrows describe the route in each wall's local view.
    // Paths avoid platform-dependent arrow-font substitutions.
    ctx.save();ctx.translate(628,112);ctx.rotate({forward:0,right:Math.PI/2,back:Math.PI,left:-Math.PI/2}[arrow]??0);
    ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(-58,-3);ctx.lineTo(-21,-3);
    ctx.lineTo(-21,63);ctx.lineTo(21,63);ctx.lineTo(21,-3);ctx.lineTo(58,-3);ctx.closePath();ctx.fill();ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function powerBoxTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#efd270';ctx.fillRect(0,0,256,256);
  ctx.fillStyle='#154e54';ctx.fillRect(17,17,222,222);
  ctx.strokeStyle='#61e4d4';ctx.lineWidth=5;ctx.strokeRect(26,26,204,204);
  ctx.fillStyle='#fff2b5';ctx.font='bold 184px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',128,141);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export class RoomScene{
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#625d38');this.scene.fog=new THREE.Fog('#817547',12,65);
    this.camera=new THREE.PerspectiveCamera(66,1,.04,110);
    this.scene.add(new THREE.HemisphereLight(0xfff4c4,0x5b4c2f,2.1));
    this.scene.add(new THREE.AmbientLight(0xbab176,.4));
    const sun=new THREE.DirectionalLight(0xfff3b9,1.1);sun.position.set(-2,6,2);this.scene.add(sun);
    this.localLights=[];
    for(let i=0;i<4;i++){const light=new THREE.PointLight(0xffffd2,22,23,2);this.localLights.push(light);this.scene.add(light);}
    const wallMap=surfaceTexture('wall'),floorMap=surfaceTexture('floor'),ceilingMap=surfaceTexture('ceiling');
    this.materials={
      wall:new THREE.MeshStandardMaterial({map:wallMap,roughness:.98}),
      trim:new THREE.MeshStandardMaterial({color:0x8d8252,roughness:1}),
      floor:new THREE.MeshStandardMaterial({map:floorMap,roughness:1,color:0xc4b993}),
      ceiling:new THREE.MeshStandardMaterial({map:ceilingMap,roughness:1}),
      lamp:new THREE.MeshBasicMaterial({color:0xffffe1}),
      rim:new THREE.MeshStandardMaterial({color:0x797556,roughness:.9}),
      dust:new THREE.PointsMaterial({color:0xfff6c1,size:.018,transparent:true,opacity:.36,depthWrite:false})
    };
    this.cube=new THREE.BoxGeometry(1,1,1);this.origin={x:0,z:0};this.layoutId=null;this.worldGroup=null;
    this.signMaterials={
      arrows:Object.fromEntries(['forward','right','back','left'].map(arrow=>[arrow,new THREE.MeshBasicMaterial({map:exitSignTexture(arrow),toneMapped:false})])),
      destination:new THREE.MeshBasicMaterial({map:exitSignTexture(false),toneMapped:false}),
      backing:new THREE.MeshStandardMaterial({color:0x174a32,roughness:.72}),
      screws:new THREE.MeshStandardMaterial({color:0xd3d0b7,roughness:.35,metalness:.6}),
      glow:new THREE.MeshBasicMaterial({color:0xa9ffc2,toneMapped:false}),
      frame:new THREE.MeshStandardMaterial({color:0x32754b,emissive:0x176c3c,emissiveIntensity:.7,roughness:.5}),
      door:new THREE.MeshStandardMaterial({color:0x164d31,emissive:0x0f6c39,emissiveIntensity:.5,roughness:.66,side:THREE.DoubleSide}),
      threshold:new THREE.MeshBasicMaterial({color:0x68efa1,transparent:true,opacity:.21,depthWrite:false})
    };
    this.signGroup=new THREE.Group();this.scene.add(this.signGroup);this.navigationId=null;
    this.exitGroup=null;this.exitKey=null;
    this.duck=createDuck();this.scene.add(this.duck.root);
    this.impact=new THREE.Group();this.impact.visible=false;this.scene.add(this.impact);
    this.impactMaterial=new THREE.MeshBasicMaterial({color:0xfff1a6,transparent:true,depthWrite:false});
    this.impactRing=new THREE.Mesh(new THREE.RingGeometry(.26,.29,40),this.impactMaterial);this.impactRing.rotation.x=-Math.PI/2;this.impact.add(this.impactRing);
    this.impactStars=[];
    const sparkGeometry=new THREE.OctahedronGeometry(.065);
    for(let i=0;i<6;i++){const spark=new THREE.Mesh(sparkGeometry,this.impactMaterial);this.impactStars.push(spark);this.impact.add(spark);}
    this.wallHits=0;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
    const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,'#151b11aa');gradient.addColorStop(1,'#151b1100');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadowMap=new THREE.CanvasTexture(shadowCanvas);
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.5*DUCK.scale,1.4*DUCK.scale),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.012;this.scene.add(this.shadow);
    const monsterMap=new THREE.TextureLoader().load('./assets/monster.webp');monsterMap.colorSpace=THREE.SRGBColorSpace;
    // Actor pools share textures, geometry and materials across the whole run.
    this.monsterMaterial=new THREE.SpriteMaterial({map:monsterMap,transparent:true,alphaTest:.1,color:0xb8b29a});
    this.monsterShadowGeometry=new THREE.PlaneGeometry(2.3,1.7);
    this.monsterShadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false});
    this.monsterPool=[];this.boxPool=[];
    this.boxMaterials={
      body:new THREE.MeshStandardMaterial({map:powerBoxTexture(),roughness:.34,metalness:.15,emissive:0x89c4a4,emissiveIntensity:.32}),
      ribbon:new THREE.MeshStandardMaterial({color:0xf3d775,roughness:.26,metalness:.45,emissive:0xd6a837,emissiveIntensity:.35}),
      halo:new THREE.MeshBasicMaterial({color:0x78ead5,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
    };
    this.boxHaloGeometry=new THREE.RingGeometry(.44,.48,36);
    this.powerEffect=new THREE.Group();this.scene.add(this.powerEffect);
    this.powerHaloMaterial=new THREE.MeshBasicMaterial({color:0x8df5db,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    this.powerRing=new THREE.Mesh(new THREE.RingGeometry(.59,.63,48),this.powerHaloMaterial);this.powerRing.rotation.x=-Math.PI/2;this.powerEffect.add(this.powerRing);
    this.powerShieldMaterial=new THREE.MeshBasicMaterial({color:0x8df5db,transparent:true,opacity:.11,depthWrite:false,toneMapped:false});
    this.powerShield=new THREE.Mesh(new THREE.SphereGeometry(.62,24,16),this.powerShieldMaterial);this.powerEffect.add(this.powerShield);
    this.powerEffect.visible=false;
    this.lookTarget=new THREE.Vector3();this.followPosition=new THREE.Vector3();this.started=false;
    this.resize();this.onResize=()=>this.resize();addEventListener('resize',this.onResize);
  }
  buildRooms(layout){
    // Only nine nearby blocks are drawn. GPU geometry is released on a block
    // change; coordinates are rebased so distant travel retains smooth motion.
    if(this.worldGroup){
      this.scene.remove(this.worldGroup);
      this.worldGroup.traverse(item=>{if(item.geometry&&item.geometry!==this.cube)item.geometry.dispose();if(item.isInstancedMesh)item.dispose?.();});
    }
    this.worldGroup=new THREE.Group();this.scene.add(this.worldGroup);
    this.origin={...layout.origin};this.layoutId=layout.id;this.started=false;
    const group=this.worldGroup,dummy=new THREE.Object3D(),ox=this.origin.x,oz=this.origin.z;
    const walls=new THREE.InstancedMesh(this.cube,this.materials.wall,layout.walls.length);
    const trim=new THREE.InstancedMesh(this.cube,this.materials.trim,layout.walls.length);
    layout.walls.forEach((wall,index)=>{
      dummy.position.set(wall.x-ox,wall.h/2,wall.z-oz);dummy.scale.set(wall.w,wall.h,wall.d);dummy.updateMatrix();walls.setMatrixAt(index,dummy.matrix);
      dummy.position.y=.055;dummy.scale.set(wall.w+.045,.11,wall.d+.045);dummy.updateMatrix();trim.setMatrixAt(index,dummy.matrix);
    });group.add(walls,trim);
    const width=(layout.maxX-layout.minX+1)*ROOMS.cellSize,depth=(layout.maxZ-layout.minZ+1)*ROOMS.cellSize;
    const centerX=(layout.minX+layout.maxX)*ROOMS.cellSize/2-ox,centerZ=(layout.minZ+layout.maxZ)*ROOMS.cellSize/2-oz;
    this.materials.floor.map.repeat.set(width*1.6,depth*1.6);this.materials.ceiling.map.repeat.set(width,depth);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),this.materials.floor);floor.rotation.x=-Math.PI/2;floor.position.set(centerX,0,centerZ);group.add(floor);
    const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),this.materials.ceiling);ceiling.rotation.x=Math.PI/2;ceiling.position.set(centerX,ROOMS.ceiling,centerZ);group.add(ceiling);
    const fixtures=[];
    for(const room of layout.rooms)for(const x of[-4.3,4.3])for(const z of[-4.3,4.3])fixtures.push({x:room.x+x,z:room.z+z});
    const lamps=new THREE.InstancedMesh(this.cube,this.materials.lamp,fixtures.length);
    const rims=new THREE.InstancedMesh(this.cube,this.materials.rim,fixtures.length);
    fixtures.forEach((p,i)=>{dummy.position.set(p.x-ox,ROOMS.ceiling-.028,p.z-oz);dummy.scale.set(.83,.025,1.5);dummy.updateMatrix();rims.setMatrixAt(i,dummy.matrix);dummy.position.y-=.019;dummy.scale.set(.74,.018,1.4);dummy.updateMatrix();lamps.setMatrixAt(i,dummy.matrix);});group.add(rims,lamps);
    const random=seeded(63),positions=new Float32Array(6000);
    for(let i=0;i<2000;i++){positions[i*3]=centerX+(random()-.5)*width;positions[i*3+1]=random()*(ROOMS.ceiling-.1);positions[i*3+2]=centerZ+(random()-.5)*depth;}
    const dust=new THREE.BufferGeometry();dust.setAttribute('position',new THREE.BufferAttribute(positions,3));group.add(new THREE.Points(dust,this.materials.dust));
    // A chunk change also rebases signs, even if the navigation cell is unchanged.
    this.navigationId=null;
  }
  buildSigns(layout){
    this.signGroup.traverse(item=>{if(item.geometry&&item.geometry!==this.cube)item.geometry.dispose();});
    this.signGroup.clear();this.navigationId=layout.navigationId??layout.id;
    const half=ROOMS.cellSize/2,jambOffset=(half+ROOMS.doorWidth/2)/2;
    const width=Math.min(2.85,(ROOMS.cellSize-ROOMS.doorWidth)/2-.4),height=.83;
    const mountPanel=(sign,wallDX,wallDZ,primary=false)=>{
      const dx=sign.dx,dz=sign.dz,tx=-wallDZ,tz=wallDX;
      const doorX=sign.x+wallDX*half,doorZ=sign.z+wallDZ*half;
      // A repeater uses a closed wall's centre when possible, or a real jamb
      // when this side also has a doorway. Nothing occupies the doorway hole.
      let placement=null;
      for(const offset of primary?[jambOffset,-jambOffset]:[0,jambOffset,-jambOffset]){
        const x=doorX+tx*offset,z=doorZ+tz*offset;
        const wall=layout.walls.find(w=>{
          const along=wallDX!==0?w.d:w.w,across=wallDX!==0?w.w:w.d;
          const centerAcross=wallDX!==0?Math.abs(w.x-doorX):Math.abs(w.z-doorZ);
          const centerAlong=wallDX!==0?Math.abs(w.z-z):Math.abs(w.x-x);
          return across<ROOMS.wallThickness+.1&&centerAcross<.02&&centerAlong+width/2<along/2-.06&&w.h>2.95;
        });
        if(wall){placement={x:x-wallDX*(ROOMS.wallThickness/2+.035),z:z-wallDZ*(ROOMS.wallThickness/2+.035)};break;}
      }
      if(!placement)return;
      const nx=-wallDX,nz=-wallDZ;
      const right=dx*nz-dz*nx,forward=-(dx*nx+dz*nz);
      const arrow=Math.abs(right)>.5?(right>0?'right':'left'):(forward>0?'forward':'back');
      const panel=new THREE.Group();panel.position.set(placement.x-this.origin.x,2.5,placement.z-this.origin.z);
      panel.rotation.y=Math.atan2(nx,nz);
      const backing=new THREE.Mesh(new THREE.BoxGeometry(width+.08,height+.08,.045),this.signMaterials.backing);panel.add(backing);
      const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),this.signMaterials.arrows[arrow]);face.position.z=.025;panel.add(face);
      const strip=new THREE.Mesh(this.cube,this.signMaterials.glow);strip.scale.set(width-.1,.035,.018);strip.position.set(0,height/2+.02,.03);panel.add(strip);
      for(const x of[-width/2+.075,width/2-.075])for(const y of[-height/2+.075,height/2-.075]){
        const screw=new THREE.Mesh(new THREE.CircleGeometry(.018,6),this.signMaterials.screws);screw.position.set(x,y,.027);panel.add(screw);
      }
      panel.userData={cellX:sign.cellX,cellZ:sign.cellZ,dx,dz,distance:sign.distance,arrow,repeater:!primary,wallDX,wallDZ};this.signGroup.add(panel);
    };
    const path=layout.pathToExit??[],indices=new Map(path.map((cell,index)=>[`${cell.x},${cell.z}`,index]));
    for(const sign of layout.signs??[]){
      if(Math.abs(sign.dx)+Math.abs(sign.dz)!==1)continue;
      mountPanel(sign,sign.dx,sign.dz,true);
      const id=`${sign.cellX},${sign.cellZ}`,index=indices.get(id),previous=index>0?path[index-1]:null;
      const turn=previous&&(sign.cellX-previous.x!==sign.dx||sign.cellZ-previous.z!==sign.dz);
      if(id!==layout.navigationId&&!turn)continue;
      // Three views of each current/turn room make the instruction visible on
      // approach, rather than only beside the outgoing door at close range.
      for(const[wallDX,wallDZ]of[[0,-1],[1,0],[0,1],[-1,0]]){
        if(wallDX===sign.dx&&wallDZ===sign.dz)continue;
        mountPanel(sign,wallDX,wallDZ);
      }
    }
  }
  updateExit(layout){
    const exit=layout.exit;
    const key=exit?`${exit.x},${exit.z},${exit.radius}`:null;
    if(this.exitKey!==key){
      if(this.exitGroup){this.scene.remove(this.exitGroup);this.exitGroup.traverse(item=>{if(item.geometry&&item.geometry!==this.cube)item.geometry.dispose();});}
      this.exitGroup=null;this.exitKey=key;
      if(exit){
        const group=new THREE.Group();
        const box=(width,height,depth,x,y,z,material)=>{const mesh=new THREE.Mesh(this.cube,material);mesh.scale.set(width,height,depth);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
        for(const x of[-2,2]){
          box(.2,3.12,.35,x,1.56,0,this.signMaterials.frame);
          box(.042,2.91,.37,x,1.55,0,this.signMaterials.glow);
        }
        box(4.2,.2,.35,0,3.06,0,this.signMaterials.frame);
        box(3.84,.045,.38,0,2.98,0,this.signMaterials.glow);
        const door=new THREE.Mesh(new THREE.PlaneGeometry(3.78,2.95),this.signMaterials.door);door.position.y=1.48;group.add(door);
        // This frame is a destination visual; movement keeps the same circular
        // reach radius supplied by the run state and adds no collision surface.
        for(const side of[-1,1]){
          box(.055,1.9,.028,-1.48,1.43,side*.018,this.signMaterials.frame);
          box(3.02,.055,.028,0,.48,side*.018,this.signMaterials.frame);
          box(3.02,.055,.028,0,2.39,side*.018,this.signMaterials.frame);
          box(.09,.43,.095,1.37,1.27,side*.085,this.signMaterials.screws);
        }
        box(3.18,.79,.12,0,3.44,0,this.signMaterials.backing);
        for(const side of[-1,1]){
          const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.1,.71),this.signMaterials.destination);sign.position.set(0,3.44,side*.065);sign.rotation.y=side<0?Math.PI:0;group.add(sign);
        }
        const threshold=new THREE.Mesh(new THREE.RingGeometry(Math.max(.1,exit.radius-.18),exit.radius,64),this.signMaterials.threshold);threshold.rotation.x=-Math.PI/2;threshold.position.y=.019;group.add(threshold);
        const light=new THREE.PointLight(0x71ffa4,17,9,2);light.position.set(0,2.3,.55);group.add(light);
        const approach=layout.pathToExit?.at(-2),cell=exit.cell;
        if(approach&&cell)group.rotation.y=Math.atan2(approach.x-cell.x,approach.z-cell.z);
        this.exitGroup=group;this.scene.add(group);
      }
    }
    if(this.exitGroup){
      this.exitGroup.position.set(exit.x-this.origin.x,0,exit.z-this.origin.z);
      const cell=exit.cell??{x:Math.round(exit.x/ROOMS.cellSize),z:Math.round(exit.z/ROOMS.cellSize)};
      this.exitInLayout=cell.x>=layout.minX&&cell.x<=layout.maxX&&cell.z>=layout.minZ&&cell.z<=layout.maxZ;
    }
  }
  monsterVisual(index){
    if(this.monsterPool[index])return this.monsterPool[index];
    const sprite=new THREE.Sprite(this.monsterMaterial);sprite.scale.set(2.05,2.7,1);
    const shadow=new THREE.Mesh(this.monsterShadowGeometry,this.monsterShadowMaterial);shadow.rotation.x=-Math.PI/2;
    this.scene.add(sprite,shadow);const pair={sprite,shadow};this.monsterPool.push(pair);return pair;
  }
  boxVisual(index){
    if(this.boxPool[index])return this.boxPool[index];
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const box=new THREE.Mesh(this.cube,this.boxMaterials.body);box.scale.setScalar(.68);body.add(box);
    for(const axis of['x','z']){
      const band=new THREE.Mesh(this.cube,this.boxMaterials.ribbon);band.scale.set(axis==='x'?.73:.09,.025,axis==='z'?.73:.09);band.position.y=.355;body.add(band);
    }
    const halo=new THREE.Mesh(this.boxHaloGeometry,this.boxMaterials.halo);halo.rotation.x=-Math.PI/2;halo.position.y=-.39;root.add(halo);
    this.scene.add(root);const visual={root,body,halo};this.boxPool.push(visual);return visual;
  }
  updateActors(state,intro){
    const monsters=state.monsters??(state.monster?[state.monster]:[]),boxes=state.boxes??[];
    const time=state.elapsed??0,ox=this.origin.x,oz=this.origin.z;
    const power=state.power?.remaining>0?state.power.type:null;
    this.monsterMaterial.color.set(power==='freeze'?0x8ce5fa:power==='slow'?0xc6a1ed:0xb8b29a);
    for(let i=0;i<monsters.length;i++){
      const monster=monsters[i],visual=this.monsterVisual(i),animation=power==='freeze'?0:time;
      const jitter=monster.stage==='chasing'?Math.sin(animation*34+i)*.022:0;
      visual.sprite.visible=visual.shadow.visible=!intro;
      visual.sprite.position.set(monster.x-ox+jitter,1.36+Math.sin(animation*10+i)*.035,monster.z-oz);
      visual.sprite.scale.x=2.05+Math.sin(animation*9+i)*.045;
      visual.shadow.position.set(monster.x-ox,.015,monster.z-oz);
    }
    for(let i=monsters.length;i<this.monsterPool.length;i++)this.monsterPool[i].sprite.visible=this.monsterPool[i].shadow.visible=false;
    // Keep two spare actors for wave transitions, releasing scene references
    // after a reset instead of retaining the largest wave forever.
    while(this.monsterPool.length>monsters.length+2){const visual=this.monsterPool.pop();this.scene.remove(visual.sprite,visual.shadow);}
    for(let i=0;i<boxes.length;i++){
      const box=boxes[i],visual=this.boxVisual(i),phase=time*1.3+i*.7;
      visual.root.visible=!intro;visual.root.userData.boxId=box.id;
      visual.root.position.set(box.x-ox,box.y+Math.sin(phase)*.05,box.z-oz);
      visual.body.rotation.y=time*.65+i*.8;visual.body.rotation.z=Math.sin(phase*.8)*.045;
      visual.halo.scale.setScalar(1+Math.sin(phase*1.5)*.08);
    }
    for(let i=boxes.length;i<this.boxPool.length;i++)this.boxPool[i].root.visible=false;
    while(this.boxPool.length>boxes.length+2)this.scene.remove(this.boxPool.pop().root);
    this.powerEffect.visible=!intro&&Boolean(power);
    if(this.powerEffect.visible){
      const color=power==='boost'?0xffd777:power==='slow'?0xc8acff:power==='freeze'?0x8de7ff:0x8df5db;
      this.powerHaloMaterial.color.set(color);this.powerShieldMaterial.color.set(color);
      this.powerEffect.position.set(state.player.x-ox,state.player.y+.03,state.player.z-oz);
      this.powerRing.rotation.z=time*.6;this.powerRing.scale.setScalar(1+Math.sin(time*3)*.035);
      this.powerShield.visible=power==='shield';
    }
  }
  resize(){
    const{clientWidth:width,clientHeight:height}=this.renderer.domElement;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();
  }
  render(state,intro,dt,time){
    const layout=state.maze.layout;if(this.layoutId!==layout.id)this.buildRooms(layout);
    if(this.navigationId!==(layout.navigationId??layout.id))this.buildSigns(layout);
    this.updateExit(layout);
    const p=state.player,flight=state.flight,ox=this.origin.x,oz=this.origin.z;
    this.signGroup.visible=!intro;
    if(this.exitGroup){
      // Standard depth-tested meshes keep the distant exit behind room walls.
      // Fog and this local visibility limit prevent a beacon at the starting room.
      this.exitGroup.visible=!intro&&this.exitInLayout&&Math.hypot(p.x-layout.exit.x,p.z-layout.exit.z)<60;
      this.signMaterials.frame.emissiveIntensity=state.mode==='won'?1.25:.7;
      this.signMaterials.threshold.opacity=state.mode==='won'?.38:.21;
    }
    if(this.wallHits!==state.wallHits){this.wallHits=state.wallHits;this.started=false;}
    if(intro){
      this.duck.root.position.set(1.15,.5,-3.8);
      this.duck.update({...flight,leftWingAngle:75,rightWingAngle:75,heading:180,pitch:0,bank:0},.5);
      this.duck.root.rotation.y=Math.PI-.25;this.duck.root.rotation.z=Math.sin(time*.55)*.025;
      this.duck.root.position.y+=Math.sin(time*.9)*.015;
      this.camera.position.set(1.65,1.1,-1.4);this.camera.lookAt(.4,.65,-4.1);
      this.shadow.position.set(1.15,.013,-3.8);this.started=false;
    }else{
      this.duck.root.position.set(p.x-ox,p.y,p.z-oz);this.duck.update(flight,p.y);
      const heading=flight.heading*Math.PI/180;
      let distance=3.8;
      while(distance>.55&&!clearSight(p,{x:p.x-Math.sin(heading)*distance,z:p.z+Math.cos(heading)*distance},layout.walls))distance-=.25;
      this.followPosition.set(p.x-ox-Math.sin(heading)*distance,Math.min(ROOMS.ceiling-.3,p.y+.95),p.z-oz+Math.cos(heading)*distance);
      this.lookTarget.set(p.x-ox+Math.sin(heading)*2,Math.max(.55,p.y+.1),p.z-oz-Math.cos(heading)*2);
      if(!this.started){this.camera.position.copy(this.followPosition);this.started=true;}
      this.camera.position.lerp(this.followPosition,1-Math.exp(-dt*12));
      if(!clearSight(p,{x:this.camera.position.x+ox,z:this.camera.position.z+oz},layout.walls))this.camera.position.copy(this.followPosition);
      this.camera.lookAt(this.lookTarget);
      this.shadow.position.set(p.x-ox,.013,p.z-oz);this.shadow.material.opacity=Math.max(.25,1-p.y*.2);
    }
    const remaining=state.impact?.remaining??0,progress=1-remaining/(state.impact?.duration||.55);
    this.impact.visible=!intro&&remaining>0;
    if(this.impact.visible){
      this.impact.position.set(p.x-ox,p.y+.45,p.z-oz);
      this.impactRing.scale.setScalar(1+progress*2.4);this.impactMaterial.opacity=(1-progress)*.9;
      this.impactStars.forEach((spark,i)=>{const angle=i*Math.PI/3+progress*1.1,radius=.32+progress*.5;spark.position.set(Math.cos(angle)*radius,.1+Math.sin(progress*Math.PI)*.16,Math.sin(angle)*radius);spark.rotation.set(progress*3,angle,Math.PI/4);});
      if(!this.reducedMotion){const shake=Math.sin(progress*34)*(1-progress)*.035;this.camera.position.x+=shake;this.camera.position.y+=Math.cos(progress*27)*(1-progress)*.018;}
    }
    const px=intro?0:p.x,pz=intro?0:p.z;
    const anchorX=Math.round(px/ROOMS.cellSize)*ROOMS.cellSize,anchorZ=Math.round(pz/ROOMS.cellSize)*ROOMS.cellSize;
    this.localLights.forEach((light,i)=>{light.position.set(anchorX-ox+(i%2?4.3:-4.3),ROOMS.ceiling-.2,anchorZ-oz+(i<2?-4.3:4.3));light.intensity=22*(1+Math.sin(time*11.7+i*5)*.025);});
    this.updateActors(state,intro);
    this.renderer.render(this.scene,this.camera);
  }
}
