import * as T from './vendor/three.module.js';

export function createAircraftModels(){
  const mat=(color,roughness=.6,metalness=.08)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const dark=mat('#263139'),black=mat('#182326'),metal=mat('#8a9b9b',.3,.6),white=mat('#f2f4ef',.35,.25),blue=mat('#174d76',.4,.3),grey=mat('#728d96',.42,.5);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#dfbb70';ctx.fillRect(0,0,256,256);
  for(let x=0;x<256;x+=26){ctx.fillStyle='rgba(92,58,26,.22)';ctx.fillRect(x,0,2,256);ctx.fillStyle='rgba(255,235,177,.3)';ctx.fillRect(x+3,0,2,256);}
  for(let y=0;y<256;y+=4){ctx.fillStyle='rgba(111,76,36,.035)';ctx.fillRect(0,y,256,1);}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const fabric=new T.MeshStandardMaterial({map:texture,color:'#f6ce84',roughness:.88,side:T.DoubleSide});
  const wood=mat('#85562f',.8),glass=new T.MeshStandardMaterial({color:'#163943',roughness:.15,metalness:.55});
  function mesh(g,m,p,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
  function box(p,sx,sy,sz,x,y,z,m){return mesh(new T.BoxGeometry(sx,sy,sz),m,p,x,y,z);}
  function sphere(p,sx,sy,sz,x,y,z,m){const o=mesh(new T.SphereGeometry(1,24,14),m,p,x,y,z);o.scale.set(sx,sy,sz);return o;}
  function rod(p,a,b,r,m){const v=new T.Vector3(...b).sub(new T.Vector3(...a));const o=mesh(new T.CylinderGeometry(r,r,v.length(),7),m,p);o.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function wing(p,vertices,y,m){const shape=new T.Shape();vertices.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:1,steps:1});g.rotateX(Math.PI/2);return mesh(g,m,p,0,y,0);}
  const vintage=new T.Group();
  sphere(vintage,.83,.8,1.7,0,.12,-2.6,wood);
  sphere(vintage,.86,.82,.5,0,.12,-3.6,dark);
  box(vintage,1.2,.17,3.1,0,-.3,-.6,wood);
  // Open wooden truss and fabric wings follow the first reference photograph.
  for(const side of[-1,1]){
    rod(vintage,[side*.58,-.3,-.2],[side*.19,0,6],.046,dark);
    rod(vintage,[side*.58,.55,-.2],[side*.19,.35,6],.04,dark);
    for(let j=0;j<5;j++){
      const a=j*1.18,b=(j+1)*1.18;const xa=side*(.56-a*.06),xb=side*(.56-b*.06);
      rod(vintage,[xa,-.29,a],[xb,.51-b*.025,b],.024,dark);
      rod(vintage,[xa,.51-a*.025,a],[xb,-.29,b],.022,dark);
      rod(vintage,[xb,-.29,b],[xb,.51-b*.025,b],.025,dark);
    }
  }
  wing(vintage,[[-7.6,-2.75],[-8,-2],[-7.5,.7],[7.5,.7],[8,-2],[7.6,-2.75]],.4,fabric);
  for(const side of[-1,1]){
    rod(vintage,[0,2.5,-1.5],[side*6,.5,-2],.025,dark);
    rod(vintage,[side*.5,-.4,-1],[side*6,.4,.3],.026,dark);
    rod(vintage,[0,1.3,-2.2],[0,2.5,-1.5],.044,dark);
    rod(vintage,[side*.6,-.3,-2.2],[side*1.3,-1.45,-2],.075,metal);
    const wheel=mesh(new T.TorusGeometry(.67,.09,8,28),black,vintage,side*1.3,-1.42,-2);wheel.rotation.y=Math.PI/2;
    for(let j=0;j<8;j++){const a=j*Math.PI/4;rod(vintage,[side*1.3,-1.42,-2],[side*1.3,-1.42+Math.sin(a)*.6,-2+Math.cos(a)*.6],.012,metal);}
  }
  rod(vintage,[-1.3,-1.42,-2],[1.3,-1.42,-2],.06,metal);
  wing(vintage,[[-2.4,4.8],[-2.5,6.2],[2.5,6.2],[2.4,4.8]],.25,fabric);
  const fin=box(vintage,.1,1.7,1.5,0,1,5.7,fabric);fin.rotation.x=-.08;
  sphere(vintage,.36,.44,.36,0,1.2,-.4,black);box(vintage,.7,.6,.5,0,.7,-.1,dark);
  const propeller=new T.Group();propeller.position.set(0,.15,-4.15);vintage.add(propeller);
  box(propeller,.15,4.8,.12,0,0,0,wood);sphere(propeller,.24,.24,.2,0,0,-.05,metal);
  const propDisc=mesh(new T.CircleGeometry(2.5,32),new T.MeshBasicMaterial({color:'#dfc194',transparent:true,opacity:.05,side:T.DoubleSide,depthWrite:false}),vintage,0,.15,-4.2);

  const airliner=new T.Group();
  sphere(airliner,1.35,1.35,8.6,0,.4,0,white);
  wing(airliner,[[-.6,-2],[-10.5,3],[-11,5],[-1.1,2],[1.1,2],[11,5],[10.5,3],[.6,-2]],.1,white);
  wing(airliner,[[-.5,5],[-4,7.3],[-4,8],[4,8],[4,7.3],[.5,5]],1.1,white);
  const tail=wing(airliner,[[0,4.5],[3,7],[3.1,8],[0,8]],0,blue);tail.rotation.z=Math.PI/2;tail.position.set(0,1,0);
  for(const side of[-1,1]){
    sphere(airliner,1.03,1.04,2.25,side*4.3,-.7,.25,white);
    const engine=mesh(new T.CylinderGeometry(.78,.82,.25,32),dark,airliner,side*4.3,-.7,-1.85);engine.rotation.x=Math.PI/2;
    const fan=mesh(new T.TorusGeometry(.69,.05,6,24),metal,airliner,side*4.3,-.7,-2);fan.rotation.x=0;
    for(let j=0;j<23;j++)sphere(airliner,.037,.13,.09,side*1.3,.8,-5+j*.43,glass);
    for(let j=0;j<3;j++)sphere(airliner,.22,.2,.32,side*(.35+j*.24),1,-7.55,glass);
    box(airliner,.18,1.3,1,side*10.5,.6,4.4,blue).rotation.z=side*.2;
  }
  const fighter=new T.Group();
  sphere(fighter,.9,.83,6.1,0,.15,0,grey);
  const nose=mesh(new T.ConeGeometry(.76,3.4,24),dark,fighter,0,.15,-6.1);nose.rotation.x=-Math.PI/2;
  wing(fighter,[[-.6,-2.7],[-6.8,1.7],[-6.5,3.3],[-.8,2.1],[.8,2.1],[6.5,3.3],[6.8,1.7],[.6,-2.7]],.25,grey);
  wing(fighter,[[-.6,3],[-3.7,5],[-3,6.2],[3,6.2],[3.7,5],[.6,3]],.55,grey);
  const ff=box(fighter,.15,2.4,2.3,0,1.9,4.5,grey);ff.rotation.x=-.28;
  sphere(fighter,.65,.73,1.8,0,1,-2.1,glass);
  for(const side of[-1,1]){
    box(fighter,.3,.3,4.2,side*6.3,.2,1.9,grey);
    sphere(fighter,.35,.35,2.7,side*3.6,-.5,1.4,metal);
  }
  const flame=mesh(new T.ConeGeometry(.48,3,20),new T.MeshBasicMaterial({color:'#ffb354',transparent:true,opacity:.75}),fighter,0,.05,6.5);flame.rotation.x=Math.PI/2;
  const all=[vintage,airliner,fighter];all.forEach((g,i)=>{g.visible=i===0;});
  return {all,propeller,propDisc,flame};
}
