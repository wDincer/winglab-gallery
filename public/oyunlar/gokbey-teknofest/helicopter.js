import * as T from './vendor/three.module.js';
export function createHelicopter(){
  const root=new T.Group(),blue=new T.MeshStandardMaterial({color:'#087cad',metalness:.48,roughness:.31}),white=new T.MeshStandardMaterial({color:'#f4f4df',metalness:.4,roughness:.34}),dark=new T.MeshStandardMaterial({color:'#122636',metalness:.65,roughness:.2}),glass=new T.MeshStandardMaterial({color:'#183b52',metalness:.68,roughness:.08}),rubber=new T.MeshStandardMaterial({color:'#17222a',roughness:.82}),orange=new T.MeshStandardMaterial({color:'#f07026'});
  const mesh=(g,m,p=root)=>{const o=new T.Mesh(g,m);p.add(o);o.castShadow=true;return o;};
  function ell(s,x,y,z,m=blue){const o=mesh(new T.SphereGeometry(1,32,20),m);o.scale.set(...s);o.position.set(x,y,z);return o;}
  function box(s,x,y,z,m=blue,p=root){const o=mesh(new T.BoxGeometry(...s),m,p);o.position.set(x,y,z);return o;}
  function rod(a,b,r,m=white,p=root){const d=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.CylinderGeometry(r,r,d.length(),10),m,p);o.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
  ell([1.9,1.75,4.05],0,.05,-.9);ell([1.65,1.3,1.9],0,.05,-3.45);ell([1.45,.63,2.65],0,1.6,.2);
  // Turboshaft intakes and exhausts, characteristic high tail and rounded cabin.
  for(const side of[-1,1]){ell([.62,.55,1.85],side*.86,1.65,.6);const exhaust=mesh(new T.CylinderGeometry(.42,.42,.8,20),dark);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.85,1.8,2.4);}
  const boom=mesh(new T.CylinderGeometry(.3,.78,7.6,20),blue);boom.rotation.x=Math.PI/2;boom.position.set(0,.4,6);
  box([.18,2.8,2.2],0,1.4,8.8);box([4.4,.13,1.1],0,.8,7.2,white);box([.2,.8,1.1],0,2.5,8.6,orange);
  ell([1.35,.91,.16],0,.45,-4.84,glass);const wind=box([.07,1.6,.17],0,.45,-4.99,white);wind.rotation.z=.08;
  for(const side of[-1,1]){
    for(let i=0;i<4;i++){const z=-2.85+i*1.43;box([.08,1.38,1.14],side*1.77,.35,z,white);box([.085,1.16,.93],side*1.825,.36,z,glass);}
    for(let i=0;i<2;i++){box([.05,2.45,.045],side*1.86,-.1,-1.6+i*2.8,white);box([.05,.07,.45],side*1.9,-.15,-.9+i*2.8,dark);}
    rod([side*1.1,-1.15,1.7],[side*1.55,-2.1,2],.11);rod([side*.85,-1.2,-3.3],[side*.9,-2.05,-3.5],.1);
    for(const [x,z,r]of[[side*1.55,2,.43],[side*.9,-3.5,.3]]){const wheel=mesh(new T.CylinderGeometry(r,r,.28,20),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-1.9,z);}
  }
  function label(text,w,h){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.font='italic bold 100px Arial';ctx.textAlign='center';ctx.fillText(text,512,160);const tex=new T.CanvasTexture(c);const m=new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide,depthWrite:false});return new T.Mesh(new T.PlaneGeometry(w,h),m);}
  for(const side of[-1,1]){const l=label('GÖKBEY',3.15,.78);l.rotation.y=side*Math.PI/2;l.position.set(side*1.91,-.75,0);root.add(l);const t=label('TC-HLI',2.5,.6);t.rotation.y=side*Math.PI/2;t.position.set(side*.55,.5,5.1);root.add(t);}
  rod([0,1.9,0],[0,3.15,0],.19,dark);ell([.48,.23,.48],0,3.1,0,white);
  const rotor=new T.Group();rotor.position.y=3.2;root.add(rotor);
  for(let i=0;i<5;i++){const blade=box([.37,.055,6.7],0,0,-3.2,dark,new T.Group());const arm=blade.parent;arm.rotation.y=i*Math.PI*2/5;rotor.add(arm);box([.38,.06,.6],0,.01,-6.2,white,arm);}
  const disc=mesh(new T.CircleGeometry(6.6,64),new T.MeshBasicMaterial({color:'#b8d0da',transparent:true,opacity:.08,side:T.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.y=3.2;
  const tailRotor=new T.Group();tailRotor.position.set(.5,1.5,9.2);root.add(tailRotor);for(let i=0;i<4;i++){const blade=box([.09,1.8,.19],0,0,0,dark,tailRotor);blade.rotation.x=i*Math.PI/2;}
  const navs=[];for(const [x,c]of[[-1.9,'#ff2d36'],[1.9,'#66ff9d']]){const m=new T.MeshBasicMaterial({color:c});const o=ell([.12,.12,.12],x,.5,1.8,m);navs.push(o);}
  return {root,update(state,dt,red){blue.color.set(red?'#d92d3a':'#087cad');const rpm=state.flying&&!state.frozen?48:5;rotor.rotation.y+=dt*rpm;tailRotor.rotation.x+=dt*rpm*1.6;disc.visible=state.flying;navs.forEach(o=>o.visible=Math.sin(state.time*4)>-.4);}};
}
