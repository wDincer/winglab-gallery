import * as THREE from './vendor/three.module.js';

let camo, tortilla, flag;
function canvasTexture(width,height,draw) {
  const c=document.createElement('canvas');c.width=width;c.height=height;
  draw(c.getContext('2d'),width,height);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function camouflage() {
  return camo ??= canvasTexture(1024,1024,(c,w,h)=>{
    c.fillStyle='#8d989d';c.fillRect(0,0,w,h);
    let seed=614;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<38;i++){
      const x=r()*w,y=r()*h;c.fillStyle=['#68767c','#a7b0b2','#7d8a90','#b1b9b8'][i%4];
      c.beginPath();c.moveTo(x,y);
      for(let j=0;j<7;j++){const a=j/7*Math.PI*2,rad=35+r()*90;c.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad*.6);}c.closePath();c.fill();
    }
    c.strokeStyle='rgba(32,45,51,.25)';c.lineWidth=2;
    for(let y=0;y<h;y+=128){c.beginPath();c.moveTo(0,y);c.lineTo(w,y+24);c.stroke();}
    for(let i=0;i<900;i++){c.fillStyle='rgba(225,232,230,.23)';c.fillRect(r()*w,r()*h,2,2);}
  });
}
function makeFlag() {
  return flag ??= canvasTexture(192,128,c=>{
    c.fillStyle='#d3383c';c.fillRect(0,0,192,128);
    c.fillStyle='#fff';c.beginPath();c.arc(78,64,34,0,Math.PI*2);c.fill();
    c.fillStyle='#d3383c';c.beginPath();c.arc(88,59,28,0,Math.PI*2);c.fill();
    c.fillStyle='#fff';c.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?8:20;c.lineTo(123+Math.cos(a)*r,64+Math.sin(a)*r);}c.closePath();c.fill();
  });
}
function add(parent,g,m,x=0,y=0,z=0) {const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
function panel(parent,points,extrude,material) {
  const positions=[],indices=[],uvs=[],n=points.length;
  for(let side=0;side<2;side++)for(const p of points){positions.push(p[0]+extrude[0]*side,p[1]+extrude[1]*side,p[2]+extrude[2]*side);uvs.push((p[0]+11)/22,(p[2]+11)/22);}
  for(let i=1;i<n-1;i++){indices.push(0,i,i+1,n,n+i+1,n+i);}
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  return add(parent,g,material);
}

export function createKaan({enemy=false}={}) {
  const group=new THREE.Group();
  const afterburners=[];
  const skin=new THREE.MeshStandardMaterial({map:camouflage(),color:enemy?'#9da6a8':'#c9d1d0',metalness:.42,roughness:.57,side:THREE.DoubleSide});
  const dark=new THREE.MeshStandardMaterial({color:'#17232c',metalness:.65,roughness:.35});
  const nozzle=new THREE.MeshStandardMaterial({color:'#424950',metalness:.86,roughness:.42});
  const canopy=new THREE.MeshStandardMaterial({color:'#182d39',metalness:.72,roughness:.13});
  const points=[],uvs=[],indices=[],sides=8;
  const stations=[[-11,.04,.03,-.06],[-8.2,.7,.42,0],[-5,1.35,.8,.12],[-2.7,2.25,1.02,0],[1.6,2.5,1.06,-.1],[5.8,2.3,.82,-.05],[8.2,1.9,.52,0]];
  for(const [z,rx,ry,cy] of stations)for(let i=0;i<sides;i++){
    const a=i/sides*Math.PI*2;points.push(Math.cos(a)*rx,Math.sin(a)*ry+cy,z);uvs.push((Math.cos(a)+1)/2,(z+11)/19.2);
  }
  for(let row=0;row<stations.length-1;row++)for(let i=0;i<sides;i++){const a=row*sides+i,b=row*sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
  const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(points,3));hull.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));hull.setIndex(indices);hull.computeVertexNormals();add(group,hull,skin);
  for(const s of[-1,1]){
    panel(group,[[s*1.7,.05,-3.1],[s*9.8,-.12,3.3],[s*9.5,-.12,5.7],[s*2,.05,4.5]],[0,.23,0],skin);
    panel(group,[[s*1.6,.2,4.8],[s*5.1,.15,7.7],[s*4.5,.15,9],[s*1.5,.2,8.1]],[0,.13,0],skin);
    const tail=new THREE.Group();tail.position.set(s*2,.55,4.5);tail.rotation.z=-s*.3;group.add(tail);
    panel(tail,[[0,0,0],[0,4.6,1.4],[0,4.5,2.8],[0,0,4.2]],[.16,0,0],skin);
    const decal=add(tail,new THREE.PlaneGeometry(.92,.6),new THREE.MeshBasicMaterial({map:makeFlag(),side:THREE.DoubleSide}),s<0?-.025:.185,3.2,1.95);decal.rotation.y=Math.PI/2;
    const engine=add(group,new THREE.CylinderGeometry(.86,.94,2.7,12,1,true),nozzle,s*1.25,-.12,7.4);engine.rotation.x=Math.PI/2;
    const hole=add(group,new THREE.CircleGeometry(.76,16),dark,s*1.25,-.12,8.78);
    const ember=new THREE.MeshBasicMaterial({color:'#ed7136',transparent:true,opacity:.16,toneMapped:false});afterburners.push(ember);
    add(group,new THREE.CircleGeometry(.49,16),ember,s*1.25,-.12,8.79);
    const intake=add(group,new THREE.BoxGeometry(1.08,1.05,.18),dark,s*1.9,-.28,-3.05);intake.rotation.y=-s*.12;
    add(group,new THREE.BoxGeometry(1.25,.12,1.6),skin,s*1.9,.35,-2.45);
    const lamp=add(group,new THREE.SphereGeometry(.12,6,4),new THREE.MeshBasicMaterial({color:s<0?'#ff7868':'#a8ffd0'}),s*9.65,.03,4.5);
    lamp.userData.nav=true;
  }
  const glass=add(group,new THREE.SphereGeometry(1,14,8),canopy,0,.88,-5.4);glass.scale.set(.72,.67,2.45);
  const frame=add(group,new THREE.TorusGeometry(.69,.035,4,24,Math.PI),skin,0,.9,-5.2);frame.scale.y=.94;
  add(group,new THREE.BoxGeometry(.035,.06,1.6),dark,0,.15,-11.45);
  const gear=new THREE.Group();group.add(gear);
  for(const [x,z] of [[0,-5.6],[-2,3.2],[2,3.2]]){
    add(gear,new THREE.CylinderGeometry(.07,.07,1.05,6),nozzle,x,-1.35,z);
    const wheel=add(gear,new THREE.CylinderGeometry(.4,.4,.25,12),dark,x,-1.8,z);wheel.rotation.z=Math.PI/2;
  }
  const marking=canvasTexture(512,128,c=>{c.clearRect(0,0,512,128);c.fillStyle='#35474c';c.font='bold 70px Arial';c.fillText('KAAN',30,79);c.font='22px Arial';c.fillText('TÜRKİYE  /  001',31,112);});
  const label=add(group,new THREE.PlaneGeometry(2.9,.72),new THREE.MeshBasicMaterial({map:marking,transparent:true,depthWrite:false}),3.7,.2,3);label.rotation.x=-Math.PI/2;label.rotation.z=Math.PI/2;
  group.userData={skin,gear,afterburners,model:'KAAN',setLocked(value){skin.emissive.set(value?'#33ff88':'#000000');skin.emissiveIntensity=value?.65:0;}};
  return group;
}

export function createDurum() {
  tortilla ??= canvasTexture(512,512,(c,w,h)=>{
    c.fillStyle='#edce96';c.fillRect(0,0,w,h);
    let seed=47;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let i=0;i<420;i++){
      c.fillStyle=`rgba(134,77,32,${.13+r()*.28})`;c.beginPath();c.ellipse(r()*w,r()*h,1+r()*9,1+r()*5,r()*4,0,Math.PI*2);c.fill();
    }
    c.strokeStyle='rgba(255,244,207,.7)';c.lineWidth=8;c.beginPath();c.moveTo(0,100);c.bezierCurveTo(200,200,320,380,512,400);c.stroke();
  });
  const g=new THREE.Group();
  const bread=new THREE.MeshStandardMaterial({map:tortilla,roughness:.92,side:THREE.DoubleSide});
  add(g,new THREE.CylinderGeometry(.57,.27,2.65,18,1,true),bread,0,0,0);
  const filling=new THREE.MeshStandardMaterial({color:'#a3491c',roughness:1});
  const top=add(g,new THREE.SphereGeometry(.55,14,6),filling,0,1.32,0);top.scale.y=.22;
  const green=new THREE.MeshStandardMaterial({color:'#72ac23',roughness:.9,side:THREE.DoubleSide});
  const tomato=new THREE.MeshStandardMaterial({color:'#d74627',roughness:.7});
  for(let i=0;i<9;i++){
    const a=i*2.4,r=.2+(i%3)*.1;
    const leaf=add(g,new THREE.SphereGeometry(.18,5,3),i%3?green:tomato,Math.cos(a)*r,1.42+(i%2)*.13,Math.sin(a)*r);leaf.scale.set(.85,.45,1.5);leaf.rotation.y=a;
  }
  const onion=new THREE.MeshStandardMaterial({color:'#d89aab',roughness:.8});
  const ring=add(g,new THREE.TorusGeometry(.22,.035,5,12,Math.PI*1.6),onion,.1,1.54,.04);ring.rotation.x=Math.PI/2;
  const flame=add(g,new THREE.ConeGeometry(.23,1.3,7),new THREE.MeshBasicMaterial({color:'#ffc269',transparent:true,opacity:.8}),0,-1.9,0);flame.rotation.z=Math.PI;
  return g;
}
