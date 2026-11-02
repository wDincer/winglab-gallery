import * as T from './vendor/three.module.js';
import {createFighter,createCruiser,getGlow} from './starships.js';
import {flightFrame,length,sub} from './combat.js';

export function createSpaceScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.setClearColor(0,0);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(47,1,.1,8000);
  scene.add(new T.HemisphereLight('#c4e7ff','#363449',2));
  const sun=new T.DirectionalLight('#fff1d6',3.8);sun.position.set(-60,80,-90);scene.add(sun);
  const rim=new T.DirectionalLight('#6b9bff',3.1);rim.position.set(70,-20,30);scene.add(rim);
  const warm=new T.DirectionalLight('#ff9e62',1.2);warm.position.set(-30,-10,70);scene.add(warm);
  const player=createFighter();scene.add(player);
  const enemies=new Map(),shots=new Map(),effects=new Map();let lastSize={width:0,height:0},introTime=0;
  let seed=892;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  const starPositions=[],starColors=[];
  for(let i=0;i<1700;i++){const a=rand()*Math.PI*2,z=rand()*2-1,r=1000+rand()*2500,s=Math.sqrt(1-z*z);starPositions.push(Math.cos(a)*s*r,z*r,Math.sin(a)*s*r);const b=.35+rand()*.65;starColors.push(b*.8,b*.9,b);}
  const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new T.Float32BufferAttribute(starColors,3));
  const stars=new T.Points(starGeometry,new T.PointsMaterial({size:2.6,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true,depthWrite:false}));scene.add(stars);
  const dustGeo=new T.BufferGeometry(),dustData=new Float32Array(210*3);for(let i=0;i<dustData.length;i+=3){dustData[i]=(rand()-.5)*700;dustData[i+1]=(rand()-.5)*500;dustData[i+2]=-rand()*1100;}
  dustGeo.setAttribute('position',new T.BufferAttribute(dustData,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({color:'#b1d6f7',size:.45,transparent:true,opacity:.55}));scene.add(dust);
  const shotGeometry=new T.CylinderGeometry(.065,.065,11,6),haloGeometry=new T.CylinderGeometry(.32,.32,10,6);
  const shotMats={player:new T.MeshBasicMaterial({color:'#c3fff4'}),enemy:new T.MeshBasicMaterial({color:'#ffdbb3'})};
  const haloMats={player:new T.MeshBasicMaterial({color:'#3dffc1',transparent:true,opacity:.32,blending:T.AdditiveBlending,depthWrite:false}),enemy:new T.MeshBasicMaterial({color:'#ff5335',transparent:true,opacity:.4,blending:T.AdditiveBlending,depthWrite:false})};
  const up=new T.Vector3(0,1,0),scratch=new T.Vector3();
  function createShot(shot){const g=new T.Group(),core=new T.Mesh(shotGeometry,shotMats[shot.owner]),halo=new T.Mesh(haloGeometry,haloMats[shot.owner]);g.add(core,halo);scene.add(g);return g;}
  function createEffect(effect){
    const g=new T.Group();g.position.set(effect.position.x,effect.position.y,effect.position.z);
    const flash=new T.Sprite(new T.SpriteMaterial({map:getGlow(),color:effect.type==='explosion'?'#ffb96c':'#afffe8',blending:T.AdditiveBlending,transparent:true,depthWrite:false}));g.add(flash);
    if(effect.type==='explosion'){
      const positions=[],vel=[];for(let i=0;i<90;i++){positions.push(0,0,0);const d=new T.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize().multiplyScalar((.3+rand())*effect.size*1.6);vel.push(d.x,d.y,d.z);}
      const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));const pts=new T.Points(geom,new T.PointsMaterial({map:getGlow(),size:effect.size*.3,transparent:true,blending:T.AdditiveBlending,color:'#ffae57',depthWrite:false}));g.add(pts);g.userData.vel=vel;
      const ring=new T.Mesh(new T.RingGeometry(.88,1,70),new T.MeshBasicMaterial({color:'#ffcc8a',transparent:true,opacity:.8,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}));g.add(ring);
    }scene.add(g);return g;
  }
  function clearGroup(g){scene.remove(g);g.traverse(o=>{if(o.isSprite){o.material.dispose();}else if(o.isPoints){o.geometry.dispose();o.material.dispose();}else if(o.isMesh&&g.userData.effect){o.geometry.dispose();o.material.dispose();}});}
  function resize(){const width=canvas.clientWidth,height=canvas.clientHeight;if(width===lastSize.width&&height===lastSize.height)return;lastSize={width,height};renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();}
  function update(state,combat,dt,{intro=false,active=true}={}){
    resize();state.viewAspect=camera.aspect;const f=flightFrame(state);
    player.visible=intro||!combat.lost;
    if(intro){
      const narrow=camera.aspect<.75,medium=!narrow&&camera.aspect<1.25;
      introTime+=dt;player.position.set(0,(narrow?-13:0)+Math.sin(introTime*.5)*.25,narrow?-8:0);player.scale.setScalar(narrow?.5:medium?.85:1);player.rotation.set(.05,Math.sin(introTime*.17)*.08,-.06,'YXZ');
      camera.position.set(22,14,-30);camera.lookAt(narrow?0:medium?6:9,0,0);camera.fov=narrow?63:medium?50:44;camera.updateProjectionMatrix();
    }else{
      player.scale.setScalar(1);player.position.set(f.position.x,f.position.y,f.position.z);player.rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,-state.bank*Math.PI/180,'YXZ');
      camera.position.set(f.camera.x,f.camera.y,f.camera.z);camera.lookAt(f.look.x,f.look.y,f.look.z);camera.fov=47+(state.speed>110?(state.speed-110)*.025:0);camera.updateProjectionMatrix();
      player.visible=player.visible&&state.camera!=='cockpit';
    }
    for(const s of player.userData.engines){const v=s.userData.base*(.8+state.speed/180+Math.sin(state.time*40)*.04);s.scale.set(v,v,v);}
    stars.position.copy(camera.position);stars.rotation.y=intro?introTime*.003:state.heading*Math.PI/180*.03;
    dust.position.set(f.position.x,f.position.y,f.position.z);
    if(active&&!intro){for(let i=2;i<dustData.length;i+=3){dustData[i]+=state.speed*.514*dt;if(dustData[i]>40)dustData[i]=-1100;}dustGeo.attributes.position.needsUpdate=true;}
    dust.visible=!intro;
    for(const enemy of combat.enemies){
      if(!enemies.has(enemy.id)){const model=enemy.type==='cruiser'?createCruiser():createFighter(enemy.type);scene.add(model);enemies.set(enemy.id,model);}
      const model=enemies.get(enemy.id);model.visible=!intro&&!enemy.dead;model.position.set(enemy.position.x,enemy.position.y,enemy.position.z);model.rotation.set(enemy.pitch*Math.PI/180,-enemy.heading*Math.PI/180,-enemy.bank*Math.PI/180,'YXZ');
      for(const engine of model.userData.engines)engine.material.opacity=enemy.flash>0?1:.8;
    }
    const aliveShots=new Set(combat.projectiles.map(s=>s.id));for(const [id,g]of shots)if(!aliveShots.has(id)){scene.remove(g);shots.delete(id);}
    for(const shot of combat.projectiles){if(!shots.has(shot.id))shots.set(shot.id,createShot(shot));const g=shots.get(shot.id);g.position.set(shot.position.x,shot.position.y,shot.position.z);g.quaternion.setFromUnitVectors(up,scratch.set(shot.velocity.x,shot.velocity.y,shot.velocity.z).normalize());}
    const aliveEffects=new Set(combat.effects.map(e=>e.id));for(const[id,g]of effects)if(!aliveEffects.has(id)){clearGroup(g);effects.delete(id);}
    for(const effect of combat.effects){
      if(!effects.has(effect.id)){const g=createEffect(effect);g.userData.effect=true;effects.set(effect.id,g);}
      const g=effects.get(effect.id),a=effect.age,explosion=effect.type==='explosion',duration=explosion?2.5:.35;
      g.children[0].scale.setScalar(effect.size*(explosion?5:4)*(1+a*2));g.children[0].material.opacity=Math.max(0,1-a/(explosion?1.2:duration));
      if(explosion){const pts=g.children[1],pos=pts.geometry.attributes.position.array;for(let i=0;i<pos.length;i++)pos[i]=g.userData.vel[i]*a;pts.geometry.attributes.position.needsUpdate=true;pts.material.opacity=Math.max(0,1-a/2.5);const ring=g.children[2];ring.scale.setScalar(effect.size*(1+a*3));ring.material.opacity=Math.max(0,.7-a*.45);ring.lookAt(camera.position);}
    }
    renderer.render(scene,camera);
  }
  function projectEnemies(combat,state){camera.updateMatrixWorld();return combat.enemies.filter(e=>!e.dead).map(e=>{const p=new T.Vector3(e.position.x,e.position.y,e.position.z).project(camera);return {id:e.id,x:(p.x+1)/2,y:(1-p.y)/2,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<.96&&Math.abs(p.y)<.9,distance:Math.round(length(sub(e.position,flightFrame(state).position)))};});}
  function dispose(){scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});renderer.dispose();}
  return {update,resize,projectEnemies,dispose,getStats:()=>({...renderer.info.render})};
}
