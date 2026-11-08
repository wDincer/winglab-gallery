import * as THREE from './vendor/three.module.js';
import {eagleWingAngle,EAGLE_GEOMETRY} from './eagle-geometry.js';
import {COW_GEOMETRY as G} from './cow-geometry.js';

function coatTexture(spots=false){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');c.fillStyle='#eee9dc';c.fillRect(0,0,512,512);
  let seed=217;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(spots)for(const [x,y,rx,ry]of[[64,185,82,105],[259,290,97,77],[445,155,76,95],[372,431,99,58],[38,470,66,67]]){
    c.fillStyle='#242a27';c.beginPath();
    for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,r=.86+random()*.26,px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();
  }
  for(let i=0;i<18000;i++){const x=random()*512,y=random()*512;c.strokeStyle=i%2?'#ffffff0b':'#1419110d';c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+1,y+2+random()*3);c.stroke();}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

export function createCowModel(){
  const root=new THREE.Group();root.name='Holştayn · pervane kuyruklu uçan inek';
  const fur=coatTexture(),coat=coatTexture(true);
  const white=new THREE.MeshStandardMaterial({color:'#f6f2e6',map:fur,roughness:.92});
  const spotted=new THREE.MeshStandardMaterial({color:'#f5f1e9',map:coat,roughness:.94});
  const black=new THREE.MeshStandardMaterial({color:'#232923',roughness:.84});
  const hoof=new THREE.MeshStandardMaterial({color:'#292b27',roughness:.5});
  const pink=new THREE.MeshStandardMaterial({color:'#c9918a',roughness:.68});
  const nose=new THREE.MeshStandardMaterial({color:'#d8a29c',roughness:.47});
  const horn=new THREE.MeshStandardMaterial({color:'#d4c8a8',roughness:.63});
  const gold=new THREE.MeshStandardMaterial({color:'#a98c42',roughness:.38,metalness:.65});
  const eye=new THREE.MeshPhysicalMaterial({color:'#181a12',roughness:.12,clearcoat:1,clearcoatRoughness:.05});
  const sphere=new THREE.SphereGeometry(1,32,24);
  function ell(parent,p,s,m){const o=new THREE.Mesh(sphere,m);o.position.set(...p);o.scale.set(...s);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  function curve(parent,points,r,material){const line=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),o=new THREE.Mesh(new THREE.TubeGeometry(line,18,r,7,false),material);o.castShadow=true;parent.add(o);return o;}
  ell(root,[0,0,0],[G.bodyWidth,G.bodyHeight,G.bodyLength],spotted);
  ell(root,[0,.45,-1.9],[.92,.79,.9],white);
  for(const side of[-1,1]){
    for(const z of[-1.65,1.7]){
      ell(root,[side*.95,-1.05,z],[.29,.61,.29],z>0?spotted:white);
      ell(root,[side*.95,-1.62,z],[.32,.21,.35],hoof);
      curve(root,[[side*.95,-1.49,z-.28],[side*.95,-1.64,z-.34],[side*.95,-1.79,z-.26]],.018,black);
      ell(root,[side*.95,-.82,z+.04],[.31,.21,.31],white);
    }
  }
  ell(root,[0,.85,G.headZ],[.87,.91,.97],spotted);
  ell(root,[0,.35,G.noseZ],[.83,.43,.47],nose);
  for(const side of[-1,1]){
    const nostril=ell(root,[side*.37,.46,-4.36],[.115,.085,.032],black);nostril.rotation.z=side*.16;
    const ear=ell(root,[side*1.01,1.2,-2.88],[.55,.17,.3],white);ear.rotation.z=side*.26;
    const inner=ell(root,[side*1.1,1.21,-2.94],[.35,.105,.2],pink);inner.rotation.z=side*.26;
    ell(root,[side*.69,1.1,-3.72],[.17,.22,.11],white);
    ell(root,[side*.69,1.1,-3.815],[.095,.135,.045],eye);
    ell(root,[side*.7,1.15,-3.85],[.021,.029,.014],white);
    curve(root,[[side*.58,1.64,-2.88],[side*.67,1.95,-2.84],[side*.79,2.18,-2.8]],.105,horn);
    const tag=new THREE.Mesh(new THREE.BoxGeometry(.25,.32,.055),gold);tag.position.set(side*1.32,1.01,-3);tag.rotation.z=side*.12;root.add(tag);
    for(let dot=0;dot<3;dot++)ell(root,[side*(1.26+dot*.044),1.02,-3.033],[.009,.035,.007],black);
  }
  curve(root,[[-.48,.17,-4.29],[0,.1,-4.39],[.48,.17,-4.29]],.014,pink);
  ell(root,[0,-.94,.6],[.53,.36,.7],pink);
  for(const x of[-.24,.24])for(const z of[.3,.9])ell(root,[x,-1.31,z],[.075,.16,.075],pink);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.77,.065,10,40),gold);collar.position.set(0,.5,-2.25);root.add(collar);
  ell(root,[0,-.4,-2.6],[.19,.24,.17],gold);
  const wings=[];
  for(const side of[-1,1]){
    const hinge=new THREE.Group();hinge.position.set(side*EAGLE_GEOMETRY.shoulderX,EAGLE_GEOMETRY.shoulderY,EAGLE_GEOMETRY.shoulderZ);root.add(hinge);
    const wing=new THREE.Group();wing.scale.x=side;hinge.add(wing);wings.push({hinge,side});
    ell(wing,[2.7,0,.15],[3.25,.16,.79],white);
    for(let i=0;i<10;i++){
      const x=2.1+i*.59,feather=ell(wing,[x,0,.6+i*.04],[.82,.105,1.05-i*.03],i>7?black:white);feather.rotation.y=-.12-i*.055;
      curve(wing,[[x-.22,.11,-.2],[x,.12,.4],[x+.08,.08,1.32-i*.02]],.012,horn);
    }
    for(let i=0;i<8;i++){const cover=ell(wing,[1.1+i*.66,.13,-.13],[.58,.055,.54],i===3?black:white);cover.rotation.y=-.12;}
  }
  const tailStem=new THREE.Mesh(new THREE.CylinderGeometry(.11,.14,1.9,12),white);tailStem.rotation.x=Math.PI/2;tailStem.position.set(0,.45,3.1);root.add(tailStem);
  const rotor=new THREE.Group();rotor.position.set(0,.5,4.2);root.add(rotor);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,blade=ell(rotor,[Math.sin(a)*.85,Math.cos(a)*.85,0],[.21,1.14,.1],i%2?white:black);blade.rotation.z=-a;
  }
  ell(rotor,[0,0,.15],[.24,.24,.2],gold);
  let tailRotation=0;
  return {root,update(state,dt=0,active=true){
    for(const {hinge,side}of wings)hinge.rotation.z=side*(eagleWingAngle(side<0?state.leftWingAngle:state.rightWingAngle,state.altitude)-90)*Math.PI/180;
    if(active&&state.flying&&!state.crashed)tailRotation+=dt*(17+state.speed*.1);
    rotor.rotation.z=tailRotation;
  }};
}
