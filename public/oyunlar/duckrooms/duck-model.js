import * as THREE from './vendor/three.module.js';
import {wingAngle,DUCK} from './rooms.js?v=duck-bounce-v1';

export function createDuck(){
  const root=new THREE.Group();
  root.scale.setScalar(DUCK.scale);
  const yellow=new THREE.MeshStandardMaterial({color:0xffd331,roughness:.93});
  const down=new THREE.MeshStandardMaterial({color:0xffe34f,roughness:1});
  const orange=new THREE.MeshStandardMaterial({color:0xe78b31,roughness:.78});
  const black=new THREE.MeshStandardMaterial({color:0x080b09,roughness:.15});
  const white=new THREE.MeshBasicMaterial({color:0xfffce4});
  const sphere=new THREE.SphereGeometry(1,24,18);
  function oval(parent,material,x,y,z,sx,sy,sz){
    const mesh=new THREE.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  oval(root,yellow,0,0,.03,.29,.34,.34);
  oval(root,down,0,.13,-.13,.245,.29,.24);
  oval(root,down,0,.42,-.14,.255,.25,.24);
  oval(root,yellow,0,-.1,.29,.16,.13,.22).rotation.x=-.42;
  // Soft down around the silhouette, generated as geometry, not a photo card.
  const tuftGeometry=new THREE.ConeGeometry(.006,.052,3);
  const tufts=new THREE.InstancedMesh(tuftGeometry,down,900);
  const dummy=new THREE.Object3D();
  let seed=91;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<900;i++){
    const head=i>590;
    const u=random()*Math.PI*2,v=Math.acos(2*random()-1);
    const normal=new THREE.Vector3(Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u));
    dummy.position.set(normal.x*(head?.25:.29),normal.y*(head?.25:.34)+(head?.42:0),normal.z*(head?.24:.34)+(head?-.14:.03));
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    dummy.scale.setScalar(.6+random()*.7);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);
  }
  root.add(tufts);
  for(const side of[-1,1]){
    const eye=oval(root,black,side*.155,.46,-.334,.049,.062,.034);eye.rotation.y=side*-.3;
    oval(root,white,side*.147,.478,-.363,.012,.016,.008);
    const foot=oval(root,orange,side*.13,-.285,-.03,.105,.028,.16);foot.rotation.y=side*.18;
  }
  oval(root,orange,0,.334,-.39,.113,.052,.115);
  oval(root,new THREE.MeshStandardMaterial({color:0x4b271e,roughness:1}),0,.297,-.397,.082,.032,.071);
  oval(root,orange,0,.274,-.39,.087,.022,.085);
  for(const side of[-1,1])oval(root,black,side*.041,.365,-.453,.007,.006,.009);
  const wings=[];
  for(const side of[-1,1]){
    const wing=new THREE.Group();wing.position.set(side*.245,.08,.015);root.add(wing);
    oval(wing,yellow,side*.18,-.01,.02,.25,.065,.16);
    for(let i=0;i<7;i++){
      const feather=oval(wing,i%2?yellow:down,side*(.31+i*.021),-.014,.13-i*.041,.18-i*.008,.035,.046);
      feather.rotation.y=side*(-.28+i*.07);
    }
    wings.push({wing,side});
  }
  return {root,update(flight,height){
    root.rotation.set(flight.pitch*Math.PI/180*.45,-flight.heading*Math.PI/180,-flight.bank*Math.PI/180);
    for(const{wing,side}of wings){
      const angle=wingAngle(side<0?flight.leftWingAngle:flight.rightWingAngle,height,flight.bank,side);
      wing.rotation.z=side*(angle-90)*Math.PI/180;
    }
  }};
}
