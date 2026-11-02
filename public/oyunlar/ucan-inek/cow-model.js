import * as THREE from './vendor/three.module.js';
import {eagleWingAngle,EAGLE_GEOMETRY} from './eagle-geometry.js';
import {COW_GEOMETRY as G} from './cow-geometry.js';

export function createCowModel(){
  const root=new THREE.Group();root.name='Pervane kuyruklu uçan inek';
  const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.82});
  const white=mat('#f8f2db'),black=mat('#242a28'),pink=mat('#e9a4a2'),horn=mat('#e3c69a'),gold=mat('#f3bc43');
  const sphere=new THREE.SphereGeometry(1,18,12);
  function ell(parent,p,s,m){const o=new THREE.Mesh(sphere,m);o.position.set(...p);o.scale.set(...s);o.castShadow=true;parent.add(o);return o;}
  ell(root,[0,0,0],[G.bodyWidth,G.bodyHeight,G.bodyLength],white);
  for(const side of[-1,1]){
    for(const [y,z,s]of[[.25,-.9,.78],[-.1,1.4,.7],[.65,.65,.55]])ell(root,[side*1.2,y,z],[.38,s,s*.95],black);
    for(const z of[-1.65,1.7]){ell(root,[side*.95,-1.05,z],[.32,.64,.34],white);ell(root,[side*.95,-1.64,z],[.34,.22,.37],black);}
  }
  ell(root,[0,.85,G.headZ],[.87,.91,.97],white);
  ell(root,[.38,1,G.headZ-.36],[.5,.65,.62],black);
  ell(root,[0,.35,G.noseZ],[.83,.43,.47],pink);
  for(const side of[-1,1]){
    ell(root,[side*.39,.45,-4.36],[.105,.075,.035],black);
    const ear=ell(root,[side*1.01,1.2,-2.88],[.56,.18,.3],white);ear.rotation.z=side*.26;
    ell(root,[side*1.1,1.21,-2.94],[.36,.13,.21],pink);
    ell(root,[side*.69,1.1,-3.72],[.17,.22,.11],white);
    ell(root,[side*.69,1.1,-3.815],[.085,.13,.045],black);
    ell(root,[side*.7,1.15,-3.85],[.028,.04,.02],white);
    const h=new THREE.Mesh(new THREE.ConeGeometry(.16,.7,10),horn);h.position.set(side*.58,1.97,-2.88);h.rotation.z=-side*.3;root.add(h);
    const tag=new THREE.Mesh(new THREE.BoxGeometry(.27,.35,.07),gold);tag.position.set(side*1.32,1.01,-3);root.add(tag);
  }
  ell(root,[0,-.94,.6],[.53,.36,.7],pink);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.77,.09,8,24),gold);collar.position.set(0,.5,-2.25);root.add(collar);
  ell(root,[0,-.4,-2.6],[.19,.24,.17],gold);
  const wings=[];
  for(const side of[-1,1]){
    const hinge=new THREE.Group();hinge.position.set(side*EAGLE_GEOMETRY.shoulderX,EAGLE_GEOMETRY.shoulderY,EAGLE_GEOMETRY.shoulderZ);root.add(hinge);
    const wing=new THREE.Group();wing.scale.x=side;hinge.add(wing);wings.push({hinge,side});
    ell(wing,[2.7,0,.15],[3.25,.18,.79],white);
    for(let i=0;i<10;i++){
      const x=2.1+i*.59,feather=ell(wing,[x,0,.6+i*.04],[.82,.12,1.05-i*.03],i>7?black:white);feather.rotation.y=-.12-i*.055;
    }
    ell(wing,[2.5,.12,0],[.9,.06,.45],black);
  }
  const tailStem=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,1.9,8),white);tailStem.rotation.x=Math.PI/2;tailStem.position.set(0,.45,3.1);root.add(tailStem);
  const rotor=new THREE.Group();rotor.position.set(0,.5,4.2);root.add(rotor);
  for(let i=0;i<3;i++){
    const blade=ell(rotor,[Math.sin(i*Math.PI*2/3)*.85,Math.cos(i*Math.PI*2/3)*.85,0],[.24,1.14,.13],i%2?white:black);blade.rotation.z=-i*Math.PI*2/3;
  }
  ell(rotor,[0,0,.15],[.24,.24,.2],pink);
  let tailRotation=0;
  return {root,update(state,dt=0,active=true){
    for(const {hinge,side}of wings)hinge.rotation.z=side*(eagleWingAngle(side<0?state.leftWingAngle:state.rightWingAngle,state.altitude)-90)*Math.PI/180;
    if(active&&state.flying&&!state.crashed)tailRotation+=dt*(17+state.speed*.1);
    rotor.rotation.z=tailRotation;
  }};
}
