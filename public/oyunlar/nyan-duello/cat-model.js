import * as THREE from './vendor/three.module.js';
import {eagleWingAngle} from './eagle-geometry.js';
import {CAT_GEOMETRY} from './cat-geometry.js';

const materials=new Map();
function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.03}));return materials.get(color);}
function roundedBox(w,h,d,r=.2){
  const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.01,d-r),bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r/2,bevelThickness:r/2,curveSegments:5});g.translate(0,0,-d/2+r/2);return g;
}
function mesh(parent,g,color,x=0,y=0,z=0){const m=new THREE.Mesh(g,mat(color));m.position.set(x,y,z);parent.add(m);return m;}
function ball(parent,color,x,y,z,sx,sy=sx,sz=sx){const m=mesh(parent,new THREE.SphereGeometry(1,16,12),color,x,y,z);m.scale.set(sx,sy,sz);return m;}
function line(parent,points,color,r=.035){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,new THREE.TubeGeometry(c,12,r,5,false),color);}
export function createCatModel(dark=false){
  const root=new THREE.Group(),fur=dark?'#292735':'#a7adb7',light=dark?'#eee8f2':'#d7d9df',pink=dark?'#c3597e':'#ffaccd';
  mesh(root,roundedBox(3.5,1.65,4.25,.35),dark?'#d29a43':'#e7b777');
  const icing=mesh(root,roundedBox(3.15,.25,3.83,.3),dark?'#f5b645':'#ff8ecb',0,.94,0);
  for(const sign of[-1,1]){
    const side=mesh(root,roundedBox(3.74,1.25,.12,.17),dark?'#eda845':'#ff94cd',sign*1.94,.03,0);side.rotation.y=Math.PI/2;
    if(!dark)for(let i=0;i<15;i++){
      const sprinkle=mesh(root,new THREE.CapsuleGeometry(.035,.14,3,5),['#e64b8c','#a374c8','#fff0c6'][i%3],sign*2.07,Math.sin(i*8.1)*.46,Math.cos(i*3.91)*1.53);sprinkle.rotation.x=i;}
  }
  if(dark){for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){mesh(root,new THREE.BoxGeometry(.54,.08,.7),'#b26e30',x*.88,1.1,z*1.1);}}
  else for(let i=0;i<34;i++){const x=Math.sin(i*17.1)*1.35,z=Math.cos(i*5.23)*1.6;const s=mesh(root,new THREE.CapsuleGeometry(.035,.17,3,5),['#ee487a','#a87bd1','#fff2c8'][i%3],x,1.12,z);s.rotation.z=i*1.7;}
  const head=new THREE.Group();head.position.set(0,.12,-2.35);root.add(head);
  mesh(head,roundedBox(3.2,2.25,1.45,.4),fur);
  for(const sign of[-1,1]){
    const ear=mesh(head,new THREE.ConeGeometry(.64,1.34,3),fur,sign*1.05,1.35,-.02);ear.rotation.y=Math.PI/2;ear.rotation.z=-sign*.12;
    const inner=mesh(head,new THREE.ConeGeometry(.37,.86,3),pink,sign*1.05,1.37,-.22);inner.rotation.y=Math.PI/2;
    if(dark){mesh(head,new THREE.BoxGeometry(.67,.21,.12),'#ff405b',sign*.66,.26,-.81).rotation.z=sign*.25;}
    else{ball(head,'#1d2030',sign*.66,.2,-.8,.18,.25,.07);ball(head,'#ffffff',sign*.61,.3,-.862,.06);}
    ball(head,pink,sign*1.04,-.28,-.79,.32,.16,.04);
    for(let k=0;k<2;k++)line(head,[[sign*1.18,-.12-k*.23,-.75],[sign*1.94,-.1-k*.42,-.85]],dark?'#716978':'#d6d8e2',.025);
  }
  if(dark){mesh(head,roundedBox(.55,1.15,.09,.15),light,0,.12,-.78);}
  ball(head,dark?'#e0a6bf':'#e578a6',0,-.15,-.86,.14,.09,.06);
  line(head,[[-.4,-.35,-.83],[-.22,-.48,-.86],[0,-.33,-.86],[.22,-.48,-.86],[.4,-.35,-.83]],'#3c3249',.045);
  const wings=[];
  for(const sign of[-1,1]){
    const pivot=new THREE.Group();root.add(pivot);pivot.position.set(sign*CAT_GEOMETRY.shoulderX,.15,-.15);wings.push(pivot);
    const arm=ball(pivot,fur,sign*1.1,0,0,1.6,.42,.57);arm.rotation.z=sign*.06;
    ball(pivot,fur,sign*CAT_GEOMETRY.pawCenter,-.02,-.06,CAT_GEOMETRY.pawRadius,.54,.7);
    ball(pivot,pink,sign*2.84,.45,-.03,.3,.07,.29);
    for(let i=0;i<3;i++)ball(pivot,pink,sign*(2.5+i*.27),.43,-.45,.105,.09,.12);
    ball(root,fur,sign*1.1,-.8,1.65,.45,.49,.8);
  }
  const tail=line(root,[[0,-.12,2.1],[.5,.1,3.5],[1.1,1.3,3.8],[.9,1.7,3.2]],fur,.23);
  if(dark)ball(root,light,.9,1.5,3.38,.27,.36,.25);
  return {root,update(state){
    for(let i=0;i<2;i++){const a=eagleWingAngle(i===0?state.leftWingAngle:state.rightWingAngle,state.altitude);wings[i].rotation.z=(i===0?-1:1)*(a-90)*Math.PI/180;}
    tail.rotation.z=Math.sin((state.time||0)*2.4)*.06;
    icing.material.emissive.set(dark?'#7a3600':'#822650');icing.material.emissiveIntensity=.12;
  }};
}
