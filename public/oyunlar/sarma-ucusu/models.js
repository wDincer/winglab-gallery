import * as T from './vendor/three.module.js';
const materialCache=new Map(),textCache=new Map();
export const material=(color,extra={})=>{const key=extra.map?null:color+JSON.stringify(extra);if(key&&materialCache.has(key))return materialCache.get(key);const m=new T.MeshStandardMaterial({color,roughness:.65,...extra});if(key)materialCache.set(key,m);return m;};
// Collapse static detail into a few material batches without losing the model geometry.
export function optimize(root,exclude=[]){
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),batches=new Map(),remove=[];
  function visit(o){if(exclude.includes(o))return;if(o.isMesh&&!Array.isArray(o.material)){
    const m=o.material,key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.map?.uuid,m.transparent,m.opacity,m.side,m.emissive?.getHex(),m.emissiveIntensity].join('/');
    if(!batches.has(key))batches.set(key,{mat:m,positions:[],normals:[],uvs:[]});
    const batch=batches.get(key),geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
    for(let i=0;i<p.count;i++){batch.positions.push(p.getX(i),p.getY(i),p.getZ(i));batch.normals.push(n?.getX(i)??0,n?.getY(i)??1,n?.getZ(i)??0);batch.uvs.push(uv?.getX(i)??0,uv?.getY(i)??0);}geo.dispose();remove.push(o);
  }else for(const child of o.children)visit(child);}
  for(const child of root.children)visit(child);for(const o of remove)o.removeFromParent();
  for(const b of batches.values()){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));const m=mesh(root,geo,b.mat);m.castShadow=false;}
  return root;
}
export function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export const box=(p,w,h,d,m,x=0,y=0,z=0)=>mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);
export function ball(p,r,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=mesh(p,new T.SphereGeometry(r,24,16),m,x,y,z);o.scale.set(sx,sy,sz);return o;}
export function rod(p,a,b,r,m){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);const o=mesh(p,new T.CylinderGeometry(r,r,v.length(),10),m);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
export function textMap(text,{bg='transparent',color='#112e3a',size=512,font='900 100px Arial',subtitle=''}={}){
  const key=JSON.stringify([text,bg,color,size,font,subtitle]);if(textCache.has(key))return textCache.get(key);
  const c=document.createElement('canvas');c.width=size;c.height=size/2;const ctx=c.getContext('2d');
  if(bg!=='transparent'){ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font=font;ctx.fillText(text,size/2,subtitle?size*.20:size*.25,size*.92);
  if(subtitle){ctx.font='700 28px Arial';ctx.fillText(subtitle,size/2,size*.39,size*.9);}
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;textCache.set(key,map);return map;
}
export function sign(p,text,w,h,x,y,z,options={}){return mesh(p,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:textMap(text,options),transparent:true,side:T.DoubleSide}),x,y,z);}

export function createBatmobile(){
  const g=new T.Group();
  const black=material('#29333f',{metalness:.35,roughness:.32}),edge=material('#475665',{metalness:.5,roughness:.3}),rubber=material('#080c11',{roughness:.95}),chrome=material('#8195a3',{metalness:.65,roughness:.25});
  const glass=material('#295d71',{metalness:.55,roughness:.11}),red=material('#ff492b',{emissive:'#ff310d',emissiveIntensity:2}),blue=material('#5ddcff',{emissive:'#21c9ff',emissiveIntensity:2});
  ball(g,1,black,0,.1,0,2.9,1,5.4);box(g,5.7,.65,8,black,0,-.5,-.1);
  // Split long nose and broad rear wheel haunches, matching the reference car.
  for(const s of[-1,1]){
    ball(g,1,black,s*2.15,.12,-1.3,1.13,1.04,4.45);
    ball(g,1,black,s*2.3,.45,3.3,1.2,1.5,2.1);
    box(g,1,.2,1.2,red,s*2.1,-.25,-5.55);
    for(const z of[-3.15,3.45]){
      const tire=mesh(g,new T.CylinderGeometry(1.38,1.38,.7,32),rubber,s*2.85,-.6,z);tire.rotation.z=Math.PI/2;
      const hub=mesh(g,new T.CylinderGeometry(.98,.98,.74,32),edge,s*2.9,-.6,z);hub.rotation.z=Math.PI/2;
      const cap=mesh(g,new T.CylinderGeometry(.56,.56,.77,24),black,s*2.93,-.6,z);cap.rotation.z=Math.PI/2;
      for(let j=0;j<5;j++){const a=j*Math.PI*2/5;rod(g,[s*3.33,-.6+Math.cos(a)*.37,z+Math.sin(a)*.37],[s*3.33,-.6+Math.cos(a)*.75,z+Math.sin(a)*.75],.065,chrome);}
    }
    // Tall, scalloped bat fins.
    const sh=new T.Shape();sh.moveTo(-1.2,.9);sh.lineTo(-4.95,4.7);sh.quadraticCurveTo(-5.65,5.2,-5.9,4.9);sh.lineTo(-5.65,4.15);sh.quadraticCurveTo(-5.1,4.1,-5.45,3.3);sh.quadraticCurveTo(-4.8,3.4,-5.05,2.55);sh.lineTo(-4.9,.9);sh.closePath();
    const fin=mesh(g,new T.ExtrudeGeometry(sh,{depth:.22,bevelEnabled:true,bevelSize:.1,bevelThickness:.1,bevelSegments:2,steps:1}),black,s*2.3,.2,0);fin.rotation.y=Math.PI/2;
    for(let j=0;j<5;j++)box(g,.65,.1,.18,chrome,s*2.9,.5+j*.19,1.4);
    for(let j=0;j<3;j++){const pipe=mesh(g,new T.CylinderGeometry(.16,.16,2.1-j*.2,10),chrome,s*(2.7+j*.12),-.7,1);pipe.rotation.x=Math.PI/2;}
    box(g,1.2,.22,.14,red,s*2.1,.5,5.15);
  }
  ball(g,1,edge,0,1.05,.5,1.75,1.25,2.25);ball(g,1,glass,0,1.15,.25,1.58,1.2,2.05);
  rod(g,[-1.35,1.45,-1.1],[1.35,1.45,-1.1],.09,chrome);rod(g,[0,2.2,-.65],[0,2.3,1.4],.15,black);
  const intake=mesh(g,new T.CylinderGeometry(.77,.77,1.4,24),chrome,0,.2,-4.25);intake.rotation.x=Math.PI/2;
  const nose=mesh(g,new T.ConeGeometry(.55,1.9,24),black,0,.2,-5.35);nose.rotation.x=-Math.PI/2;
  const engine=mesh(g,new T.CylinderGeometry(.78,.78,1.35,24),chrome,0,.1,4.95);engine.rotation.x=Math.PI/2;
  const flame=mesh(g,new T.ConeGeometry(.63,3,24),blue,0,.1,6.8);flame.rotation.x=Math.PI/2;g.userData.flame=flame;
  box(g,4.8,.08,6.6,blue,0,-1.15,-.2);
  // Bat emblem on the rear deck.
  const emblem=sign(g,'🦇',1.2,.6,0,1.36,3.3,{color:'#e6bd67',font:'900 100px Arial'});emblem.rotation.x=-Math.PI/2;
  optimize(g,[flame]);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;
}

export function createRobin(){
  const g=new T.Group(),skin=material('#ffbd92'),hair=material('#080b13'),green=material('#39dc72'),red=material('#ed344d'),yellow=material('#ffcb42'),white=material('#fffdf3'),leaf=material('#718523',{roughness:.5}),vein=material('#3c531d');
  // Cape behind the body.
  const cape=new T.Shape();cape.moveTo(-1.4,4.8);cape.lineTo(-3.4,.3);cape.quadraticCurveTo(0,-.8,3.5,.5);cape.lineTo(1.5,4.8);cape.closePath();mesh(g,new T.ShapeGeometry(cape),material('#f5b92e',{side:T.DoubleSide}),0,0,-.9);
  ball(g,1,red,0,3.4,0,1.45,1.8,.8);box(g,2.6,.4,1.6,yellow,0,1.95,0);
  for(const s of[-1,1]){
    rod(g,[s*.7,1.9,0],[s*.95,.2,.15],.4,green);ball(g,.5,hair,s*.95,.2,.4,1,.8,1.5);
    ball(g,.6,green,s*1.45,4.1,0);rod(g,[s*1.55,3.9,0],[s*2.05,2.5,1.8],.36,skin);rod(g,[s*2.05,2.5,1.8],[s*1.7,2.7,3.5],.42,green);ball(g,.49,green,s*1.7,2.75,3.4);
    ball(g,.58,skin,s*2.05,6.25,.15,.65,1,.5);
  }
  ball(g,2.15,skin,0,6.5,.1,1,1.05,.8);ball(g,2.18,hair,0,7.45,-.13,1,.8,.73);
  for(let i=0;i<7;i++){const s=(i-3)*.55;const spike=mesh(g,new T.ConeGeometry(.68,1.7+(i%3)*.3,4),hair,s,8.7-Math.abs(s)*.4,-.05);spike.rotation.z=-s*.26;}
  // Pointed black domino mask with large white eyes.
  for(const s of[-1,1]){
    const shape=new T.Shape();shape.moveTo(s*.05,6.5);shape.lineTo(s*1.8,7.2);shape.quadraticCurveTo(s*2,5.7,s*.9,5.8);shape.quadraticCurveTo(s*.35,5.85,s*.05,6.5);
    mesh(g,new T.ShapeGeometry(shape),hair,0,0,1.78);
    const eye=new T.Shape();eye.moveTo(s*.35,6.5);eye.lineTo(s*1.53,6.95);eye.quadraticCurveTo(s*1.7,6,s*.92,6.05);eye.quadraticCurveTo(s*.55,6.1,s*.35,6.5);
    mesh(g,new T.ShapeGeometry(eye),white,0,0,1.8);
  }
  const smile=new T.CatmullRomCurve3([new T.Vector3(-.52,5.65,1.7),new T.Vector3(0,5.5,1.82),new T.Vector3(.52,5.65,1.7)]);mesh(g,new T.TubeGeometry(smile,10,.035,5,false),hair);
  sign(g,'R',.8,.55,.73,3.85,.78,{bg:'#ffcb42',font:'900 140px Arial'});
  for(let y=3;y<=4;y+=.38)box(g,.45,.1,.05,yellow,-.3,y,.82);
  // A shallow, oval ceramic plate, tilted toward the player.
  const plate=new T.Group();plate.position.set(0,2.45,3.5);plate.rotation.x=.25;g.add(plate);
  ball(plate,1,white,0,0,0,3.8,.22,2.55);
  const rim=mesh(plate,new T.TorusGeometry(1,.06,8,64),white);rim.rotation.x=Math.PI/2;rim.scale.set(3.8,2.55,1);
  for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
    const x=col*1.23,z=row*.81;if((x/3.3)**2+(z/2.2)**2>1.1)continue;
    const roll=new T.Group();roll.position.set(x,.33,z);roll.rotation.y=(row%2)*.14;plate.add(roll);
    const dolma=mesh(roll,new T.CylinderGeometry(.31,.3,1.13,12),leaf);dolma.rotation.z=Math.PI/2;
    ball(roll,.31,leaf,-.56,0,0,.4,1,1);ball(roll,.31,leaf,.56,0,0,.4,1,1);
    for(const dx of[-.3,0,.3]){rod(roll,[dx-.12,.28,-.08],[dx+.12,.28,.12],.018,vein);}
  }
  return optimize(g);
}

export function createBuilding(item){
  const g=new T.Group();g.position.set(item.x,0,item.z);
  const blue=material('#3e99b1'),metal=material('#4d7080'),dark=material('#123d51'),sand=material('#eac774'),white=material('#fff3c6'),green=material('#42a73b');
  const window=(x,y,z,r=3)=>{const o=mesh(g,new T.TorusGeometry(r,.6,8,24),metal,x,y,z);mesh(g,new T.CircleGeometry(r,24),dark,x,y,z+.1);return o;};
  if(item.type==='pineapple'){
    const body=ball(g,1,material('#f6a323'),0,29,0,22,30,20);
    // Raised diamond lattice follows the pineapple surface.
    const lineMat=material('#c77717');
    for(const direction of[-1,1])for(let j=0;j<10;j++){
      const pts=[];for(let k=0;k<=50;k++){const t=.1+k/50*(Math.PI-.2),phi=j*Math.PI/5+direction*t*1.9;pts.push(new T.Vector3(22.15*Math.sin(t)*Math.cos(phi),29+30*Math.cos(t),20.15*Math.sin(t)*Math.sin(phi)));}
      mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),40,.38,4,false),lineMat);
    }
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;const blade=mesh(g,new T.ConeGeometry(5,29,4),green,Math.sin(a)*9,61,Math.cos(a)*8);blade.rotation.z=-Math.sin(a)*.5;blade.rotation.x=Math.cos(a)*.5;}
    window(-8,35,18);window(9,21,18);const door=mesh(g,new T.CylinderGeometry(6,6,1.5,24),blue,0,9,20);door.rotation.x=Math.PI/2;rod(g,[-4,9,21],[4,9,21],.5,metal);sign(g,'124',10,5,0,17,21,{color:'#204459',font:'bold 120px Arial'});
  }else if(item.type==='moai'){
    const stone=material('#3d7995');const b=box(g,32,61,28,stone,0,30,0);b.rotation.z=-.03;
    ball(g,1,stone,0,59,0,19,17,17);box(g,14,31,14,stone,0,39,19);
    for(const s of[-1,1]){box(g,10,5,4,stone,s*11,52,17);window(s*10,45,16,4.1);ball(g,1,stone,s*18,36,0,6,15,10);}
    box(g,11,17,2,dark,0,8,15);box(g,12,2,6,metal,0,1,18);
  }else if(item.type==='rock'){
    ball(g,1,material('#93616a'),0,4,0,27,19,24);const stick=rod(g,[0,21,0],[0,34,0],.6,material('#d4b7a9'));mesh(g,new T.ConeGeometry(3,6,4),material('#ffba20'),0,32,0);
  }else if(item.type==='krusty'){
    box(g,77,22,51,material('#a16d3d'),0,12,0);
    const roof=mesh(g,new T.CylinderGeometry(29,29,79,20,1,false,0,Math.PI),material('#a87c38'),0,23,0);roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2;
    for(let x=-28;x<=28;x+=14){box(g,10,14,.5,blue,x,13,26);box(g,.7,15,1,white,x,13,26.5);}
    box(g,12,20,1,material('#663b24'),0,10,27);sign(g,'KRUSTY KRAB',66,15,0,34,28,{bg:'#e7ce89',color:'#873736',font:'900 63px Arial'});
    for(let i=0;i<5;i++){const flag=mesh(g,new T.PlaneGeometry(7,9),material(['#e44142','#f6de4d','#51adcc'][i%3],{side:T.DoubleSide}),-29+i*14,45,0);rod(g,[-29+i*14,36,0],[-29+i*14,50,0],.25,white);}
  }else{
    const colors=['#db7ab0','#9c83d5','#63b9c1','#da9d55','#608bca','#c68aa5'];const mat=material(colors[item.color]);const h=item.height;
    mesh(g,new T.CylinderGeometry(12,15,h,16),mat,0,h/2,0);ball(g,1,mat,0,h,0,13,4,13);
    for(let i=0;i<3;i++)window(0,12+i*12,14,2.8);
    for(const s of[-1,1]){rod(g,[s*9,h-6,0],[s*20,h-6,0],3,mat);rod(g,[s*20,h-6,0],[s*20,h+5,0],3,mat);mesh(g,new T.TorusGeometry(3,.6,6,12),metal,s*20,h+5,0).rotation.x=Math.PI/2;}
    box(g,7,11,.7,dark,0,5,15);
  }
  return optimize(g);
}
