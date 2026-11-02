import * as T from './vendor/three.module.js';
import {createAircraftModels} from './aircraft-models.js';
import {birdPoint,cloudPuffs} from './ocean-game.js';

export function createFlightScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=false;
  const scene=new T.Scene();scene.background=new T.Color('#a5d7e2');scene.fog=new T.FogExp2('#b6dce1',.00034);
  const camera=new T.PerspectiveCamera(47,1,.2,24000);scene.add(new T.HemisphereLight('#e2f5ff','#628c8d',2.5));
  const sun=new T.DirectionalLight('#fff3cb',3.1);sun.position.set(-170,230,-280);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-45,right:45,top:40,bottom:-40,near:1,far:650});sun.shadow.normalBias=.06;scene.add(sun,sun.target);
  const sky=new T.Mesh(new T.SphereGeometry(18000,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 v;void main(){float h=normalize(v).y;vec3 c=mix(vec3(.78,.89,.87),vec3(.29,.64,.79),smoothstep(-.05,.72,h));float s=pow(max(0.,dot(normalize(v),normalize(vec3(-.45,.45,-.7)))),100.);gl_FragColor=vec4(c+s*vec3(.27,.2,.1),1.);}'
  }));sky.material.fog=false;scene.add(sky);
  const waterMaterial=new T.ShaderMaterial({uniforms:{time:{value:0},eye:{value:new T.Vector3()}},
    vertexShader:'varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}',
    fragmentShader:`uniform float time;uniform vec3 eye;varying vec3 w;
      float wave(vec2 p){return sin(p.x*.42+sin(p.y*.23+time*.24)*1.4+time*.55)*.6+sin(p.y*.66-p.x*.21+time*.48)*.25+sin(p.x*1.43+p.y*.83-time*.8)*.15;}
      void main(){vec2 p=w.xz;float a=wave(p);float b=wave(p+vec2(.35,0.));float c=wave(p+vec2(0.,.35));vec3 n=normalize(vec3((a-b)*.55,1.,(a-c)*.55));vec3 v=normalize(eye-w);float f=pow(1.-max(0.,dot(n,v)),3.);float sun=pow(max(0.,dot(reflect(-normalize(vec3(-.5,.8,-.8)),n),v)),110.);float ripple=pow(max(0.,a*.5+.5),9.);vec3 col=mix(vec3(.035,.36,.43),vec3(.29,.67,.69),f);col+=ripple*.045+sun*vec3(1.,.87,.58)*1.1;col=mix(col,vec3(.65,.82,.83),smoothstep(1300.,6500.,length(eye.xz-w.xz)));gl_FragColor=vec4(col,1.);}`});
  const water=new T.Mesh(new T.PlaneGeometry(120000,120000),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-2.25;scene.add(water);
  const mats={sand:new T.MeshStandardMaterial({color:'#e8d5a0',roughness:1}),green:new T.MeshStandardMaterial({color:'#348667',roughness:.9,side:T.DoubleSide}),trunk:new T.MeshStandardMaterial({color:'#84705b',roughness:1}),runway:new T.MeshStandardMaterial({color:'#647e79',roughness:.9}),white:new T.MeshStandardMaterial({color:'#e5e6c8',roughness:.8})};
  function mesh(g,m,p=scene,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o;}
  function box(sx,sy,sz,x,y,z,m,p=scene){const o=mesh(new T.BoxGeometry(sx,sy,sz),m,p,x,y,z);o.receiveShadow=true;return o;}
  function ellipsoid(p,x,y,z,sx,sy,sz,m){const o=mesh(new T.SphereGeometry(1,24,12),m,p,x,y,z);o.scale.set(sx,sy,sz);o.receiveShadow=true;return o;}
  function palm(parent,x,z,h){
    const tree=new T.Group();tree.position.set(x,4,z);parent.add(tree);
    const path=new T.CatmullRomCurve3([new T.Vector3(),new T.Vector3(h*.04,h*.4,0),new T.Vector3(h*.15,h*.8,0),new T.Vector3(h*.2,h,0)]);
    mesh(new T.TubeGeometry(path,12,.65,7,false),mats.trunk,tree).castShadow=true;
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9,verts=[],indices=[];
      for(let j=0;j<=8;j++){const r=j/8,l=h*.57*r,py=h+Math.sin(r*Math.PI)*3.8-r*r*3.4,width=Math.sin(r*Math.PI)*1.6;for(const s of[-1,1])verts.push(h*.2+Math.cos(a)*l+Math.cos(a+Math.PI/2)*width*s,py,Math.sin(a)*l+Math.sin(a+Math.PI/2)*width*s);if(j<8){const k=j*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,mats.green,tree).castShadow=true;
    }
  }
  function island(x,z,scale=1){
    const g=new T.Group();g.position.set(x,-3.8,z);g.scale.setScalar(scale);scene.add(g);
    ellipsoid(g,0,-3,0,100,6,170,mats.sand);ellipsoid(g,0,-2.3,0,80,6,140,mats.sand);
    const shallow=mesh(new T.RingGeometry(85,125,64),new T.MeshBasicMaterial({color:'#81d5bf',transparent:true,opacity:.22,side:T.DoubleSide,depthWrite:false}),g,0,1.7,0);shallow.rotation.x=-Math.PI/2;shallow.scale.y=1.7;
    for(const [px,pz,h] of [[-42,-15,23],[-63,-48,27],[50,-40,25],[38,55,21],[-40,76,20],[65,0,18]])palm(g,px,pz,h);
  }
  island(0,45);island(-580,-850,.72);island(900,-1800,1.7);island(-1100,-3300,2);island(700,-5600,1.3);
  box(24,.2,280,0,.16,30,mats.runway);for(let z=-95;z<165;z+=22)box(.7,.04,10,0,.29,z,mats.white);
  for(const x of[-10,10])box(.25,.04,270,x,.29,30,mats.white);for(let x=-8;x<=8;x+=4)box(1.7,.04,14,x,.29,-82,mats.white);
  const beaconMat=new T.MeshBasicMaterial({color:'#ffe6a3'});for(const x of[-13,13])for(let z=-105;z<165;z+=25)mesh(new T.SphereGeometry(.35,8,6),beaconMat,scene,x,.5,z);
  const player=new T.Group();scene.add(player);const models=createAircraftModels();models.all.forEach(g=>player.add(g));
  const cloudMat=new T.MeshStandardMaterial({color:'#f5f7ef',roughness:1});const puffGeometry=new T.SphereGeometry(1,14,10);
  const cloudObjects=new Map(),coinObjects=new Map(),birdObjects=new Map();let cloudInstances;
  const backgroundClouds=Array.from({length:28},(_,i)=>({id:i+50,x:Math.sin(i*3.2)*1700,y:220+i%5*80,distance:i*310-200,radius:70+i%4*23}));
  const coinTexture=new T.TextureLoader().load('./assets/coin.png');coinTexture.colorSpace=T.SRGBColorSpace;
  const coinMaterial=new T.SpriteMaterial({map:coinTexture,transparent:true,depthWrite:false});
  const haloGeometry=new T.TorusGeometry(8.5,.09,6,48),haloMaterial=new T.MeshBasicMaterial({color:'#f9d67b',transparent:true,opacity:.45});
  const birdMat=new T.MeshStandardMaterial({color:'#eef3ed',roughness:.8});
  function makeBird(){const b=new T.Group();ellipsoid(b,0,0,0,.7,.55,1.6,birdMat);const left=new T.Group(),right=new T.Group();b.add(left,right);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,-3.7,.25,.6,-2.1,0,-.8],3));geo.computeVertexNormals();
    const bm=new T.MeshStandardMaterial({color:'#f2f3e8',side:T.DoubleSide});mesh(geo,bm,left);mesh(geo,bm,right).scale.x=-1;
    mesh(new T.ConeGeometry(.17,.6,5),new T.MeshStandardMaterial({color:'#e8bc64'}),b,0,0,-1.6).rotation.x=-Math.PI/2;return {group:b,left,right};}
  const splash=mesh(new T.RingGeometry(1,1.6,48),new T.MeshBasicMaterial({color:'#edf7ec',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));splash.rotation.x=-Math.PI/2;splash.position.y=-2.1;
  let boundGame=null,displayStage=0,elapsed=0,lastLost=false;
  function bind(game){if(boundGame===game)return;boundGame=game;lastLost=false;
    for(const map of[cloudObjects,coinObjects,birdObjects]){for(const o of map.values())scene.remove(o.group??o);map.clear();}
    if(cloudInstances)scene.remove(cloudInstances);
    const allClouds=[...game.clouds,...backgroundClouds];cloudInstances=new T.InstancedMesh(puffGeometry,cloudMat,allClouds.length*9);const dummy=new T.Object3D();let idx=0;
    for(const c of allClouds)for(const p of cloudPuffs(c.radius,c.id)){dummy.position.set(c.x+p.x,c.y+p.y,-c.distance+p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();cloudInstances.setMatrixAt(idx++,dummy.matrix);}cloudInstances.instanceMatrix.needsUpdate=true;scene.add(cloudInstances);
    for(const c of game.coins){const g=new T.Group(),s=new T.Sprite(coinMaterial);s.scale.set(13,16,1);g.add(s);mesh(haloGeometry,haloMaterial,g).position.y=-1;g.position.set(c.x,c.y,-c.distance);scene.add(g);coinObjects.set(c.id,g);}
    for(const bird of game.birds){const o=makeBird();scene.add(o.group);birdObjects.set(bird.id,o);}}
  const desired=new T.Vector3(),look=new T.Vector3(),offset=new T.Vector3();let first=true;
  function update(state,dt,game,{started=false,active=false,paused=false}={}){
    bind(game);if(!paused&&active)elapsed+=dt;
    player.position.set(state.x,state.altitude+2.15,-state.distance);player.rotation.order='YXZ';player.rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,-state.bank*Math.PI/180);
    if(displayStage!==game.stage){displayStage=game.stage;models.all.forEach((o,i)=>o.visible=i===game.stage);}
    if(active&&!paused&&!game.lost){models.propeller.rotation.z+=dt*(14+state.speed*.6);models.flame.scale.y=.85+Math.sin(elapsed*35)*.15;}
    models.propDisc.visible=state.speed>20;player.visible=!game.lost;
    if(!started){const t=performance.now()*.0001;if(camera.aspect<.8){offset.set(30,18,50);look.set(0,8,-3);}else{offset.set(24+Math.sin(t)*2,10,30);look.set(-15,-5,-3);}desired.copy(player.position).add(offset);look.add(player.position);}
    else if(state.camera==='cockpit'){offset.set(0,2.7,-3.6).applyAxisAngle(new T.Vector3(0,1,0),-state.heading*Math.PI/180);desired.copy(player.position).add(offset);look.set(0,1,-100).applyAxisAngle(new T.Vector3(0,1,0),-state.heading*Math.PI/180).add(player.position);player.visible=false;}
    else{offset.set(0,9,31).applyAxisAngle(new T.Vector3(0,1,0),-state.heading*Math.PI/180);desired.copy(player.position).add(offset);look.set(0,-13,-60).applyAxisAngle(new T.Vector3(0,1,0),-state.heading*Math.PI/180).add(player.position);}
    if(first){camera.position.copy(desired);first=false;}else camera.position.lerp(desired,1-Math.exp(-dt*4));camera.lookAt(look);sky.position.copy(camera.position);water.position.x=state.x;water.position.z=-state.distance;
    waterMaterial.uniforms.time.value=elapsed;waterMaterial.uniforms.eye.value.copy(camera.position);
    sun.position.copy(player.position).add(new T.Vector3(-100,180,-120));sun.target.position.copy(player.position);sun.target.updateMatrixWorld();
    for(const c of game.coins){const o=coinObjects.get(c.id);o.visible=!c.collected&&Math.abs(c.distance-state.distance)<1800;o.position.y=c.y+Math.sin(elapsed*2+c.id)*.5;o.children[1].rotation.z=elapsed*.3;}
    for(const b of game.birds){const o=birdObjects.get(b.id),p=birdPoint(b,state.time);o.group.position.set(p.x,p.y,-p.distance);o.group.visible=Math.abs(p.distance-state.distance)<1400;o.left.rotation.z=Math.sin(elapsed*7+b.id)*.45;o.right.rotation.z=-o.left.rotation.z;}
    if(game.lost&&!lastLost){splash.position.set(state.x,-2.05,-state.distance);splash.scale.setScalar(2);splash.material.opacity=.8;lastLost=true;}
    if(splash.material.opacity>0&&!paused){splash.scale.multiplyScalar(1+dt*.8);splash.material.opacity=Math.max(0,splash.material.opacity-dt*.35);}
    renderer.render(scene,camera);
  }
  function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);camera.updateProjectionMatrix();}resize();
  return {update,resize,dispose(){scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});coinTexture.dispose();renderer.dispose();}};
}
