import * as THREE from './vendor/three.module.js';
import {createToucanModel} from './toucan-model.js';
import {createEagleModel} from './eagle-model.js';
import {LAND,groundHeight,groundSurface,riverX,riverWidth,makeTrees,randomSource,smooth} from './amazon-world.js';
import {eaglePose} from './amazon-game.js';
export function createAmazonScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.96;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b9d8d4');scene.fog=new THREE.FogExp2('#b6d4c8',.00023);
  const camera=new THREE.PerspectiveCamera(53,1,.2,14000);
  scene.add(new THREE.HemisphereLight('#d7eeff','#47683a',1.5));
  const sun=new THREE.DirectionalLight('#fff0bf',2.2);sun.position.set(-1000,1800,-1400);scene.add(sun);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.95,...extra});
  const random=randomSource(99),dummy=new THREE.Object3D();
  const terrain=new THREE.PlaneGeometry(LAND.width,LAND.depth,LAND.columns,LAND.rows);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,LAND.centerZ);
  const pos=terrain.attributes.position,colors=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=groundHeight(x,z);pos.setY(i,y);
    const c=new THREE.Color(y>270?'#71816b':y>180?'#526e45':'#315d37');c.multiplyScalar(.85+random()*.25);colors.push(c.r,c.g,c.b);
  }
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  scene.add(new THREE.Mesh(terrain,mat('#ffffff',{vertexColors:true})));
  // The water follows the same river mask that keeps trees off its banks.
  const rv=[],ri=[];
  for(let i=0;i<=400;i++){const z=1800-i*25,x=riverX(z),w=riverWidth(z);rv.push(x-w,.8,z,x+w,.8,z);if(i<400){const k=i*2;ri.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rv,3));rg.setIndex(ri);rg.computeVertexNormals();
  const water=mat('#088d97',{metalness:.05,roughness:.27});scene.add(new THREE.Mesh(rg,water));
  const bankLine=new THREE.LineBasicMaterial({color:'#91c6ac',transparent:true,opacity:.34});
  for(const side of[-1,1]){const pts=[];for(let i=0;i<400;i++){const z=1800-i*25;pts.push(new THREE.Vector3(riverX(z)+side*riverWidth(z)*.96,1.3,z));}scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),bankLine));}
  const trees=makeTrees();
  const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#ffffff',{vertexColors:false}),trees.length*2);
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,1.1,1,5),mat('#66583a'),trees.length);
  const tc=new THREE.Color();
  trees.forEach((t,i)=>{
    dummy.position.set(t.x,t.y+t.size*.48,t.z);dummy.rotation.set(0,t.rotation,0);dummy.scale.set(1,t.size,1);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
    for(let j=0;j<2;j++){
      dummy.position.set(t.x+(j?4:0),t.y+t.size*(j?1.03:.82),t.z+(j?-3:0));
      dummy.scale.set(t.size*(j?.53:.68),t.size*(j?.48:.6),t.size*(j?.55:.65));dummy.updateMatrix();crown.setMatrixAt(i*2+j,dummy.matrix);
      tc.setHSL(.23+t.tint*.08,.4+t.tint*.17,.15+t.tint*.105+(j?.025:0));crown.setColorAt(i*2+j,tc);
    }
  });
  scene.add(crown,trunk);
  // Layered, distant escarpments frame the broad Amazon basin.
  for(let i=0;i<26;i++){
    const h=160+random()*330,g=new THREE.ConeGeometry(350+random()*420,h,6,1),m=new THREE.Mesh(g,mat(i%2?'#658a79':'#759787'));
    m.position.set((i%2?-1:1)*(2100+random()*1700),h/2-20,-500-i*320);m.rotation.y=random()*3;scene.add(m);
  }
  const sky=new THREE.Mesh(new THREE.SphereGeometry(11000,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#80bad0')},bottom:{value:new THREE.Color('#dce5cc')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float a=clamp(normalize(v).y*1.5,0.,1.);gl_FragColor=vec4(mix(bottom,top,a),1.);}'}));scene.add(sky);
  const cloudCanvas=document.createElement('canvas');cloudCanvas.width=256;cloudCanvas.height=128;const ctx=cloudCanvas.getContext('2d');
  for(let i=0;i<26;i++){const x=40+random()*170,y=40+random()*48,r=20+random()*33,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,239,.2)');g.addColorStop(1,'rgba(255,255,239,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,128);}
  const cloudMap=new THREE.CanvasTexture(cloudCanvas);
  for(let i=0;i<32;i++){const c=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudMap,transparent:true,opacity:.38,depthWrite:false,fog:true}));c.position.set((random()-.5)*9000,650+random()*550,500-random()*8500);c.scale.set(1000+random()*1800,300+random()*500,1);scene.add(c);}
  // A clear summit edge establishes the 500 m launch point.
  const ledge=new THREE.Mesh(new THREE.CylinderGeometry(19,40,22,9),mat('#7a8070'));ledge.position.set(0,488,10);scene.add(ledge);
  const toucan=createToucanModel();scene.add(toucan.root);
  const eagleModels=new Map(),chocolates=new Map();
  const loader=new THREE.TextureLoader();
  const positiveMap=loader.load('./assets/milat.png'),negativeMap=loader.load('./assets/feastables.jpg');
  positiveMap.colorSpace=negativeMap.colorSpace=THREE.SRGBColorSpace;
  const ringGeo=new THREE.TorusGeometry(7.8,.095,4,48);
  const maps={positive:positiveMap,negative:negativeMap};
  let first=true;
  const desired=new THREE.Vector3(),look=new THREE.Vector3(),target=new THREE.Vector3();
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resize();
  function update(run,dt=.016){
    const s=run.state,heading=s.heading*Math.PI/180,center=new THREE.Vector3(s.x,s.altitude+2.15,-s.distance);
    toucan.root.position.copy(center);toucan.root.rotation.set(s.pitch*Math.PI/180,-heading,-s.bank*Math.PI/180,'YXZ');
    toucan.update({...s,altitude:Math.max(0,s.altitude-groundSurface(s.x,-s.distance))});
    toucan.root.visible=s.camera!=='cockpit';
    if(s.camera==='cockpit'){
      desired.copy(center).add(new THREE.Vector3(Math.sin(heading)*5,2,-Math.cos(heading)*5));target.copy(center).add(new THREE.Vector3(Math.sin(heading)*250,-18,-Math.cos(heading)*250));
    }else{
      desired.copy(center).add(new THREE.Vector3(-Math.sin(heading)*26+Math.cos(heading)*11,9,Math.cos(heading)*26+Math.sin(heading)*11));
      target.copy(center).add(new THREE.Vector3(Math.sin(heading)*26,-2,-Math.cos(heading)*26));
    }
    const blend=first?1:1-Math.exp(-Math.min(dt,.1)*7);camera.position.lerp(desired,blend);look.lerp(target,blend);camera.lookAt(look);
    sky.position.copy(camera.position);
    for(const e of run.eagles){
      let model=eagleModels.get(e.id);if(!model){model=createEagleModel();scene.add(model.root);eagleModels.set(e.id,model);}
      const p=eaglePose(e,s.time);model.root.position.set(p.x,p.altitude+2.15,-p.distance);model.root.rotation.set(0,-p.heading*Math.PI/180,-p.bank*Math.PI/180,'YXZ');model.update(p);model.root.visible=Math.abs(p.distance-s.distance)<2000;
    }
    for(const c of run.chocolates){
      let v=chocolates.get(c.id);
      if(!v){
        const root=new THREE.Group(),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:maps[c.type],transparent:true,alphaTest:.1,depthWrite:false,toneMapped:false}));
        sprite.scale.set(12,c.type==='positive'?8:5.1,1);root.add(sprite);
        const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:c.type==='positive'?'#ffe6a1':'#fc805d',transparent:true,opacity:.65}));root.add(ring);scene.add(root);v={root,ring};chocolates.set(c.id,v);
      }
      v.root.position.set(c.x,c.y,c.z);v.root.visible=!c.collected&&Math.abs(-c.z-s.distance)<1200;
      v.ring.quaternion.copy(camera.quaternion);v.ring.material.opacity=.45+Math.sin(s.time*2+c.id)*.12;
    }
    first=false;renderer.render(scene,camera);
  }
  return {update,resize};
}
