import * as THREE from './vendor/three.module.js';
import {ROOMS,DUCK,clearSight} from './rooms.js';
import {createDuck} from './duck-model.js';

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
function textTexture(text,background='#1b2c21',color='#e5f2b1'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
  const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,512,160);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 64px monospace';ctx.fillText(text,256,86);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
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
    this.duck=createDuck();this.scene.add(this.duck.root);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
    const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,'#151b11aa');gradient.addColorStop(1,'#151b1100');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadowMap=new THREE.CanvasTexture(shadowCanvas);
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.5*DUCK.scale,1.4*DUCK.scale),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.012;this.scene.add(this.shadow);
    const monsterMap=new THREE.TextureLoader().load('./assets/monster.webp');monsterMap.colorSpace=THREE.SRGBColorSpace;
    this.monster=new THREE.Sprite(new THREE.SpriteMaterial({map:monsterMap,transparent:true,alphaTest:.1,color:0xb8b29a}));this.monster.scale.set(2.05,2.7,1);this.monster.visible=false;this.scene.add(this.monster);
    this.monsterShadow=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.7),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));this.monsterShadow.rotation.x=-Math.PI/2;this.monsterShadow.visible=false;this.monsterShadow.position.y=.014;this.scene.add(this.monsterShadow);
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
  }
  resize(){
    const{clientWidth:width,clientHeight:height}=this.renderer.domElement;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();
  }
  render(state,intro,dt,time){
    const layout=state.maze.layout;if(this.layoutId!==layout.id)this.buildRooms(layout);
    const p=state.player,flight=state.flight,ox=this.origin.x,oz=this.origin.z;
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
    const px=intro?0:p.x,pz=intro?0:p.z;
    const anchorX=Math.round(px/ROOMS.cellSize)*ROOMS.cellSize,anchorZ=Math.round(pz/ROOMS.cellSize)*ROOMS.cellSize;
    this.localLights.forEach((light,i)=>{light.position.set(anchorX-ox+(i%2?4.3:-4.3),ROOMS.ceiling-.2,anchorZ-oz+(i<2?-4.3:4.3));light.intensity=22*(1+Math.sin(time*11.7+i*5)*.025);});
    const m=state.monster;this.monster.visible=Boolean(m)&&!intro;this.monsterShadow.visible=this.monster.visible;
    if(m){const jitter=m.stage==='chasing'?Math.sin(time*34)*.022:0;this.monster.position.set(m.x-ox+jitter,1.36+Math.sin(time*10)*.035,m.z-oz);this.monster.scale.x=2.05+Math.sin(time*9)*.045;this.monsterShadow.position.set(m.x-ox,.015,m.z-oz);}
    this.renderer.render(this.scene,this.camera);
  }
}
