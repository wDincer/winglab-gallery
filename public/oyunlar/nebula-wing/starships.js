import * as T from './vendor/three.module.js';
const metal=(color,roughness=.66)=>new T.MeshStandardMaterial({color,roughness,metalness:.48});
let palette;
function materials(){
  if(palette)return palette;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');
  c.fillStyle='#d2d7d5';c.fillRect(0,0,512,512);
  let seed=34;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  for(let y=0;y<512;y+=32)for(let x=0;x<512;x+=64){c.fillStyle=`rgba(13,26,35,${.03+rand()*.12})`;c.fillRect(x+1,y+1,62,30);c.strokeStyle='#55616a';c.lineWidth=.65;c.strokeRect(x+1,y+1,62,30);for(let j=0;j<3;j++){c.fillStyle='#41515c';c.fillRect(x+rand()*54,y+rand()*26,1+rand()*8,.6);}}
  for(let i=0;i<8000;i++){c.fillStyle=rand()>.5?'#09142124':'#ffffff21';c.fillRect(rand()*512,rand()*512,rand()*3+.3,.8);}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  palette={hull:new T.MeshStandardMaterial({color:'#e1e3d9',map,roughness:.62,metalness:.42}),red:metal('#993e3e'),dark:metal('#1a2530',.7),steel:metal('#788b99',.4),black:metal('#080f17'),glass:new T.MeshStandardMaterial({color:'#142c3e',roughness:.13,metalness:.8,emissive:'#14252d',emissiveIntensity:.25}),enemy:metal('#a9b5af'),copper:metal('#a76951'),blue:metal('#607a90'),window:new T.MeshBasicMaterial({color:'#ffe7a9'}),engine:new T.MeshBasicMaterial({color:'#ff9fc3'}),enemyEngine:new T.MeshBasicMaterial({color:'#ff6b37'})};
  return palette;
}
const cube=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,16,10),cylinder=new T.CylinderGeometry(1,1,1,16),ring=new T.TorusGeometry(1,.12,7,20);
function mesh(parent,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
const box=(p,m,x,y,z,sx,sy,sz)=>mesh(p,cube,m,x,y,z,sx,sy,sz);
function tube(p,m,x,y,z,r,l){const o=mesh(p,cylinder,m,x,y,z,r,l,r);o.rotation.x=Math.PI/2;return o;}
function rod(p,m,a,b,r){const d=new T.Vector3().subVectors(b,a),o=new T.Mesh(cylinder,m);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.set(r,d.length(),r);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());p.add(o);return o;}
function wedge(p,m,vertices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));g.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);g.computeVertexNormals();return mesh(p,g,m);}
let glowTexture;
export function getGlow(){if(glowTexture)return glowTexture;const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.15,'#ffffffdd');g.addColorStop(.4,'#ffffff55');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);glowTexture=new T.CanvasTexture(c);return glowTexture;}
export function glow(parent,color,x,y,z,size){const s=new T.Sprite(new T.SpriteMaterial({map:getGlow(),color,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));s.position.set(x,y,z);s.scale.setScalar(size);parent.add(s);return s;}

export function createFighter(variant='player'){
  const m=materials(),ship=new T.Group(),player=variant==='player',striker=variant==='striker',body=player?m.hull:m.enemy,accent=player?m.red:(striker?m.copper:m.blue);
  ship.userData.engines=[];
  // Long tapered nose, flat armor panels and raised glass cockpit.
  wedge(ship,body,[[-.32,-.28,-11],[.32,-.28,-11],[1.22,-.68,4],[-1.22,-.68,4],[-.23,.15,-11],[.23,.15,-11],[1.15,.72,4],[-1.15,.72,4]]);
  box(ship,m.dark,0,.76,2,1.12,.5,3.4);
  wedge(ship,m.glass,[[-.68,.55,-3.6],[.68,.55,-3.6],[.8,.65,.8],[-.8,.65,.8],[-.42,1.04,-2.5],[.42,1.04,-2.5],[.62,1.8,.65],[-.62,1.8,.65]]);
  for(const side of [-1,1]){
    rod(ship,m.steel,new T.Vector3(side*.67,.58,-3.6),new T.Vector3(side*.61,1.81,.7),.045);
    box(ship,accent,side*.91,-.02,-3.4,.045,.36,3.4);box(ship,accent,side*1.05,-.03,1.5,.05,.45,2.4);
  }
  box(ship,accent,0,.28,-7.5,.5,.04,1.8);
  box(ship,m.steel,0,1.3,2.3,.8,.8,.75);mesh(ship,sphere,m.blue,0,1.78,2.3,.4,.24,.4);box(ship,m.window,0,1.65,1.92,.12,.07,.04);
  for(const side of [-1,1])for(const tier of [-1,1]){
    const wing=new T.Group();wing.position.set(side*1.15,.05,1.1);wing.rotation.z=side*tier*(striker?.42:.26);ship.add(wing);
    const tip=side*(striker?8.5:8);
    wedge(wing,body,[[0,-.1,-1.1],[tip,-.1,.1],[tip,-.1,2.2],[0,-.1,3.1],[0,.1,-1.1],[tip,.1,.1],[tip,.1,2.2],[0,.1,3.1]]);
    box(wing,accent,side*5.3,.12,1.12,2.8,.035,1.75);
    for(let j=0;j<3;j++)box(wing,body,side*(4.55+j*.55),.145,1.12,.2,.03,1.78);
    box(wing,m.dark,side*6.7,.14,1.05,.09,.02,1.85);
    tube(wing,body,side*1.4,0,1.4,.79,4.6);tube(wing,m.dark,side*1.4,0,2.8,.82,1.15);
    tube(wing,m.steel,side*1.4,0,3.5,.67,.5);tube(wing,m.black,side*1.4,0,3.78,.51,.16);
    tube(wing,player?m.engine:m.enemyEngine,side*1.4,0,3.89,.39,.04);
    mesh(wing,ring,m.steel,side*1.4,0,-.92,.68,.68,.68);
    tube(wing,m.black,side*1.4,0,-.91,.55,.08);
    for(let j=0;j<3;j++){
      const a=j*Math.PI*2/3;rod(wing,m.steel,new T.Vector3(side*1.4,0,-.98),new T.Vector3(side*1.4+Math.cos(a)*.6,Math.sin(a)*.6,-.98),.035);
    }
    tube(wing,m.steel,tip,0,-.7,.25,5.2);tube(wing,m.dark,tip,0,-1.6,.29,1);
    tube(wing,body,tip,0,-3.4,.12,2.6);tube(wing,m.dark,tip,0,-4.65,.19,.3);
    const engine=glow(wing,player?'#ff77b8':'#ff542b',side*1.4,0,4.2,2.2);engine.userData.base=2.2;ship.userData.engines.push(engine);
  }
  box(ship,m.dark,0,.81,3.2,1.15,.15,1.8);for(let i=0;i<6;i++)box(ship,m.steel,0,.91,2.5+i*.25,.86,.05,.07);
  ship.userData.variant=variant;return ship;
}

export function createCruiser(){
  const m=materials(),ship=new T.Group();ship.userData.engines=[];
  // Layered organic hull, offset blisters, bridge, turret pods and window rows.
  mesh(ship,sphere,m.enemy,0,0,0,13,5.2,31);mesh(ship,sphere,m.steel,0,-1,1,13.4,3.8,26);
  mesh(ship,sphere,m.enemy,0,1.4,-7,10.5,4.7,23);
  mesh(ship,sphere,m.dark,0,-.2,-22,6.5,2.6,10);
  mesh(ship,sphere,m.enemy,0,.4,-21,6.8,2.4,9.5);
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const z=-17+i*7,x=side*(7.7+Math.sin((i+1)*.45)*4.3),s=3.3+(i%3)*.5;
    mesh(ship,sphere,i%2?m.enemy:m.steel,x,1.6+(i%2)*1.4,z,s,2,6);
    box(ship,m.copper,x,3.3,z,.3,.12,4);
    if(i%2===0){tube(ship,m.dark,x,3.1,z,.8,.9);rod(ship,m.steel,new T.Vector3(x,3.5,z),new T.Vector3(x,3.5,z-4),.16);}
  }
  mesh(ship,sphere,m.enemy,0,5.4,12,5.3,3,8);mesh(ship,sphere,m.steel,0,8,16,2.2,1.2,3.2);
  rod(ship,m.steel,new T.Vector3(0,7,16),new T.Vector3(0,12,16),.25);mesh(ship,sphere,m.enemy,0,12.2,16,1.8,.75,1.8);
  const windowGeo=new T.BoxGeometry(.22,.12,.13),windows=new T.InstancedMesh(windowGeo,m.window,200);const matrix=new T.Matrix4();let n=0;
  for(const side of [-1,1])for(let row=0;row<2;row++)for(let i=0;i<50;i++){
    const z=-24+i*.96,x=side*(Math.sqrt(Math.max(0,1-(z/32)**2))*12.7);
    matrix.makeTranslation(x,row*.8-1.4,z);windows.setMatrixAt(n++,matrix);
  }ship.add(windows);
  for(const x of [-6,0,6]){tube(ship,m.dark,x,-.8,27,2,3.8);tube(ship,m.steel,x,-.8,29.1,1.7,.6);tube(ship,m.enemyEngine,x,-.8,29.5,1.4,.1);const s=glow(ship,'#ff8857',x,-.8,30,6);s.userData.base=6;ship.userData.engines.push(s);}
  ship.scale.setScalar(.85);return ship;
}
