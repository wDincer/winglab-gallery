import * as T from './vendor/three.module.js';
const material=(color,roughness=.55,metalness=.08)=>new T.MeshStandardMaterial({color,roughness,metalness});
export const palette={red:material('#c70f2d',.35),white:material('#f1eee4',.35),dark:material('#172936',.35),metal:material('#8e9b9c',.25,.7),glass:new T.MeshPhysicalMaterial({color:'#172e41',metalness:.45,roughness:.12,clearcoat:1}),green:material('#79a99a',.8),stone:material('#c7b497',.95)};
export function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
export const box=(p,w,h,d,x,y,z,m)=>mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);
export function ellipsoid(p,sx,sy,sz,x,y,z,m){const a=mesh(p,new T.SphereGeometry(1,24,14),m,x,y,z);a.scale.set(sx,sy,sz);return a;}
export function rod(p,a,b,r,m,r2=r){a=new T.Vector3(...a);b=new T.Vector3(...b);const d=b.clone().sub(a);const o=mesh(p,new T.CylinderGeometry(r2,r,d.length(),10),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
export function wing(p,points,thickness,mat,y=0){const s=new T.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();const g=new T.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelSize:.045,bevelThickness:.025,bevelSegments:1,steps:1});g.rotateX(Math.PI/2);return mesh(p,g,mat,0,y,0);}
function decal(text,color='#fff',background=null){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');if(background){x.fillStyle=background;x.fillRect(0,0,512,256);}x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.font='bold 116px Arial';x.fillText(text,256,135);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:t,transparent:true,side:T.DoubleSide,depthWrite:false});}
export function createHurkus(){
  const root=new T.Group(),{red,white,dark,metal,glass}=palette;
  // A long tandem canopy, low tapered wings, five-blade propeller and the red/white 103 livery.
  const profile=[[-5.5,.18],[-5.1,.5],[-4.4,.64],[-3,.72],[-1,.74],[1,.66],[3.7,.36],[5.2,.12],[5.8,.02]].map(([z,r])=>new T.Vector2(r,z));
  const body=mesh(root,new T.LatheGeometry(profile,40),white);body.rotation.x=Math.PI/2;
  ellipsoid(root,.7,.43,3.6,0,-.18,-1.4,red);
  const nose=mesh(root,new T.CylinderGeometry(.53,.62,1.6,32),red,0,0,-4.45);nose.rotation.x=Math.PI/2;
  ellipsoid(root,.71,.84,2.15,0,.62,-.95,glass);
  for(const z of[-2.65,-1,.8]){
    const curve=new T.EllipseCurve(0,0,.735,.85,0,Math.PI,false,0),pts=curve.getPoints(24).map(p=>new T.Vector3(p.x,.59+p.y,z));
    mesh(root,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.045,6,false),red);
  }
  for(const side of[-1,1]){
    wing(root,[[side*.5,-1.7],[side*7.8,-.4],[side*8.15,.4],[side*7.8,1.7],[side*.45,1.15]],.16,white,-.24);
    wing(root,[[side*5.5,-.8],[side*7.8,-.4],[side*8.15,.4],[side*7.8,1.7],[side*5.3,1.55]],.18,red,-.22);
    wing(root,[[side*.25,3.2],[side*3.15,4.25],[side*3.25,5.1],[side*.2,4.8]],.12,red,.05);
    wing(root,[[side*.3,3.35],[side*2.6,4.3],[side*2.9,4.75],[side*.3,4.4]],.13,white,.06);
    const stripe=box(root,.03,.12,7,side*.62,.01,-.1,red);stripe.rotation.x=.035;
    const label=mesh(root,new T.PlaneGeometry(1.5,.74),decal('103'),side*.648,.09,-3.6);label.rotation.y=side*Math.PI/2;
    const roundel=mesh(root,new T.RingGeometry(.17,.3,32),red,side*3.7,-.14,.3);roundel.rotation.x=-Math.PI/2;
    const light=ellipsoid(root,.09,.05,.16,side*7.9,-.14,.7,new T.MeshBasicMaterial({color:side<0?'#ff273c':'#88ffce'}));light.userData.nav=true;
    // Two small training missiles under the wings.
    const missile=mesh(root,new T.CylinderGeometry(.09,.09,1.8,8),white,side*3.15,-.8,.05);missile.rotation.x=Math.PI/2;
    mesh(root,new T.ConeGeometry(.09,.42,8),dark,side*3.15,-.8,-1.05).rotation.x=-Math.PI/2;
  }
  const shape=new T.Shape();shape.moveTo(3.2,0);shape.lineTo(4.4,2.65);shape.lineTo(5.25,2.85);shape.lineTo(5.65,0);shape.closePath();
  const finG=new T.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:false});finG.rotateY(-Math.PI/2);mesh(root,finG,red,-.065,0,0);
  const flag=decal('☾ ★');for(const side of[-1,1]){const f=mesh(root,new T.PlaneGeometry(1.1,.64),flag,side*.077,1.8,4.75);f.rotation.y=side*Math.PI/2;}
  const spinner=mesh(root,new T.ConeGeometry(.43,.95,32),metal,0,0,-5.7);spinner.rotation.x=-Math.PI/2;
  const prop=new T.Group();prop.position.z=-5.35;root.add(prop);for(let i=0;i<5;i++){const b=box(prop,.17,1.78,.055,0,.86,0,dark);const pivot=new T.Group();prop.remove(b);pivot.add(b);pivot.rotation.z=i*Math.PI*2/5;prop.add(pivot);}
  const disc=mesh(root,new T.CircleGeometry(1.8,48),new T.MeshBasicMaterial({color:'#dce9ed',transparent:true,opacity:.095,side:T.DoubleSide,depthWrite:false}),0,0,-5.39);
  return {root,prop,disc};
}
export function createF16(){
  const root=new T.Group(),gray=material('#7b8e9c',.4,.3),light=material('#adb9c0',.4,.3),dark=palette.dark;
  const profile=[[-7,.015],[-5.7,.35],[-3.6,.65],[-1,.72],[2,.68],[4.8,.6],[5.6,.48]].map(([z,r])=>new T.Vector2(r,z));
  const body=mesh(root,new T.LatheGeometry(profile,20),gray);body.rotation.x=Math.PI/2;body.scale.x=.85;
  ellipsoid(root,.48,.56,1.6,0,.63,-2.5,palette.glass);
  for(const s of[-1,1]){wing(root,[[s*.4,-2.3],[s*4.5,1.8],[s*4.7,2.9],[s*.4,2.1]],.15,gray,-.15);wing(root,[[s*.35,3.3],[s*2.8,4.3],[s*2.9,5.5],[s*.3,4.9]],.1,light,.2);box(root,.08,.15,2.6,s*4.6,-.1,2.2,light);}
  const fin=new T.Shape();fin.moveTo(2.3,0);fin.lineTo(4.5,2.9);fin.lineTo(5.3,3.1);fin.lineTo(5.6,0);fin.closePath();const g=new T.ExtrudeGeometry(fin,{depth:.1,bevelEnabled:false});g.rotateY(-Math.PI/2);mesh(root,g,gray,.05,.2,0);
  const intake=mesh(root,new T.CylinderGeometry(.5,.46,1.5,16),dark,0,-.6,-.5);intake.rotation.x=Math.PI/2;
  const exhaust=mesh(root,new T.CylinderGeometry(.38,.46,.6,16),dark,0,0,5.6);exhaust.rotation.x=Math.PI/2;
  const flame=mesh(root,new T.ConeGeometry(.33,2.3,12),new T.MeshBasicMaterial({color:'#ffb75c',transparent:true,opacity:.9}),0,0,6.9);flame.rotation.x=Math.PI/2;
  return {root,flame};
}
export function createStatue(){
  const root=new T.Group(),body=new T.Group();root.add(body);const green=palette.green,stone=palette.stone,fold=material('#648f83',.95);
  // Fort Wood and the terraced stone pedestal.
  const fort=mesh(root,new T.CylinderGeometry(63,70,7,11),stone,0,4,0);fort.rotation.y=.2;
  for(const [w,h,y]of[[45,5,10],[35,6,15.5],[29,30,33.5],[34,4,50.5],[31,4,54.5]])box(root,w,h,w,0,y,0,stone);
  const dark=material('#665f50');for(let i=-2;i<=2;i++){box(root,2.2,7,.2,i*4.8,42,14.56,dark);box(root,.2,7,2.2,14.56,42,i*4.8,dark);}
  const robe=mesh(body,new T.LatheGeometry([[10,56],[9,59],[7,68],[6,78],[5,87],[6.2,94],[4.5,98]].map(([r,y])=>new T.Vector2(r,y)),28),green);robe.scale.z=.72;
  for(let i=0;i<15;i++){const a=i*Math.PI*2/15;rod(body,[Math.cos(a)*9,57,Math.sin(a)*6],[Math.cos(a)*4.5,91,Math.sin(a)*3.5],.4,i%3?green:fold,.17);}
  // Draped diagonal folds and the tablet-bearing arm.
  for(let i=0;i<6;i++)rod(body,[-5,74+i*2,3.5],[5,87+i*1.7,2],.43,green,.23);
  ellipsoid(body,4.1,2.6,3.2,0,97,0,green);
  rod(body,[-4,94,0],[-8,86,4],2.6,green,2.3);rod(body,[-8,86,4],[-5.5,89,7],2.1,green,1.8);
  const tablet=box(body,6.5,10,1.7,-5.2,88,6.6,green);tablet.rotation.z=.22;tablet.rotation.y=-.25;
  ellipsoid(body,3.25,4.5,2.9,0,104,0,green);ellipsoid(body,2.55,3.1,1.3,0,104,2.1,green);
  rod(body,[0,104,3],[0,103,4.2],.5,green,.14); // nose
  box(body,2.6,.26,.18,0,101.8,3.06,fold);
  const crown=mesh(body,new T.CylinderGeometry(3.5,3.4,1.4,24),green,0,107.6,0);
  for(let i=0;i<7;i++){const a=(i/6)*Math.PI;rod(body,[Math.cos(a)*3,108,Math.sin(a)*2],[Math.cos(a)*6.8,111+Math.sin(a)*1.2,Math.sin(a)*4.1],.43,green,.015);}
  // Raised right arm, torch handle, bowl and golden flame.
  rod(body,[4.5,95,0],[8.2,103.5,0],2.45,green,1.9);rod(body,[8.2,103.5,0],[10.2,117,1],1.8,green,1.25);
  ellipsoid(body,1.6,2,1.5,10.2,117,1,green);rod(body,[10.2,115,1],[10.2,122,1],.7,green);
  mesh(body,new T.CylinderGeometry(3.5,1.4,3,16),green,10.2,123,1);
  const gold=material('#e8b654',.3,.5);const flame=ellipsoid(body,1.55,3.25,1.5,10.1,127,1,gold);flame.rotation.z=-.15;
  return {root,body};
}
