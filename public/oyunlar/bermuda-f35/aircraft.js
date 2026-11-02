import * as T from './vendor/three.module.js';
function panel(points, material, parent) {
  const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false});g.rotateX(-Math.PI/2);
  const mesh=new T.Mesh(g,material);parent.add(mesh);return mesh;
}
export function createF35() {
  const jet=new T.Group();
  const metal=new T.MeshStandardMaterial({color:'#7b858d',metalness:.72,roughness:.48,flatShading:true});
  const dark=new T.MeshStandardMaterial({color:'#242e37',metalness:.65,roughness:.55});
  const edge=new T.MeshStandardMaterial({color:'#a0a8aa',metalness:.7,roughness:.4});
  const canopyMat=new T.MeshPhysicalMaterial({color:'#1b4050',metalness:.9,roughness:.12,clearcoat:1});
  // Cross sections keep the F-35's single-engine fuselage, pointed nose and broad shoulders.
  const sections=[[-10.4,.04,.05,-.3],[-8.2,.68,.52,0],[-5.7,1.2,1.05,.1],[-2.8,1.65,1.28,0],[1.8,1.8,1.05,-.12],[5.7,1.42,.94,-.03],[8.1,1.12,.8,0]];
  const vertices=[],indices=[],sides=8;
  for(const [z,w,h,y] of sections)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;vertices.push(Math.cos(a)*w,y+Math.sin(a)*h,z);}
  for(let j=0;j<sections.length-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();jet.add(new T.Mesh(geo,metal));
  for(const s of[-1,1]) {
    const wing=panel([[s*.9,-3.5],[s*8.7,2.2],[s*8.5,4.1],[s*2,3.8]],metal,jet);wing.position.y=-.05;
    const trim=panel([[s*2.6,.4],[s*8.5,2.4],[s*8.4,2.7],[s*2.6,.8]],edge,jet);trim.position.y=.22;
    const flap=panel([[s*3.2,3.0],[s*8.35,3.2],[s*8.3,3.8],[s*3.1,3.55]],dark,jet);flap.position.y=.23;
    const tail=panel([[s*.9,5.0],[s*4.65,7.2],[s*4.1,8.5],[s*1,7.8]],metal,jet);tail.position.y=.12;
    // Two outward-canted vertical stabilizers, no foreplanes.
    const fgeo=new T.BufferGeometry();fgeo.setAttribute('position',new T.Float32BufferAttribute([s*1.2,.5,3.4,s*2.5,4.6,5.7,s*2.8,4.3,7.4,s*1.45,.6,8.0],3));fgeo.setIndex([0,1,2,0,2,3]);fgeo.computeVertexNormals();
    const fin=new T.Mesh(fgeo,new T.MeshStandardMaterial({color:'#78838c',metalness:.6,roughness:.6,side:T.DoubleSide}));jet.add(fin);
    const intake=panel([[s*1.1,-4.3],[s*2.0,-3.9],[s*2.05,-1.0],[s*1.3,-1.6]],dark,jet);intake.position.y=-.15;
    const light=new T.Mesh(new T.SphereGeometry(.12,8,6),new T.MeshBasicMaterial({color:s<0?'#ff4e45':'#8fffc4'}));light.position.set(s*8.5,.25,3.0);jet.add(light);
  }
  const glass=new T.Mesh(new T.SphereGeometry(1,24,16),canopyMat);glass.scale.set(.91,.86,2.45);glass.position.set(0,1.02,-4.55);jet.add(glass);
  const frame=new T.Mesh(new T.TorusGeometry(.9,.065,6,24,Math.PI),edge);frame.rotation.x=Math.PI/2;frame.scale.y=2.55;frame.position.set(0,1.12,-4.55);jet.add(frame);
  const nozzle=new T.Mesh(new T.CylinderGeometry(.86,1.15,1.65,12,1,true),dark);nozzle.rotation.x=Math.PI/2;nozzle.position.z=8.2;jet.add(nozzle);
  const exhaust=new T.Mesh(new T.ConeGeometry(.64,5,18,1,true),new T.MeshBasicMaterial({color:'#8ac9ff',transparent:true,opacity:.6,side:T.DoubleSide,depthWrite:false}));exhaust.rotation.x=Math.PI/2;exhaust.position.z=10.7;jet.add(exhaust);
  const core=new T.Mesh(new T.CircleGeometry(.65,24),new T.MeshBasicMaterial({color:'#cdeaff',side:T.DoubleSide}));core.position.z=9.02;jet.add(core);
  // Painted insignia and fine service-panel seams are generated locally.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#d5dbd9';c.font='bold 58px monospace';c.textAlign='center';c.fillText('F — 35',256,85);c.font='22px monospace';c.fillText('WL  •  035',256,126);c.lineWidth=3;c.strokeStyle='#a3adaa';c.strokeRect(155,157,202,55);
  const decal=new T.Mesh(new T.PlaneGeometry(2.3,1.15),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false}));decal.rotation.x=-Math.PI/2;decal.position.set(0,1.15,2);jet.add(decal);
  jet.userData.exhaust=exhaust;return jet;
}
export function createShark() {
  const group=new T.Group(),skin=new T.MeshStandardMaterial({color:'#667b86',roughness:.65,metalness:.18}),belly=new T.MeshStandardMaterial({color:'#c3d0cb',roughness:.6});
  const body=new T.Mesh(new T.SphereGeometry(1,20,12),skin);body.scale.set(2.5,2.7,8.2);group.add(body);
  const underside=new T.Mesh(new T.SphereGeometry(1,16,10),belly);underside.scale.set(2.1,1.4,6.8);underside.position.y=-1.15;group.add(underside);
  const mouth=new T.Mesh(new T.SphereGeometry(1,16,12),new T.MeshStandardMaterial({color:'#240d14',roughness:1}));mouth.scale.set(1.9,.92,1.7);mouth.position.set(0,-1.35,-6.7);group.add(mouth);
  const toothMat=new T.MeshStandardMaterial({color:'#eff1db'});
  for(let i=0;i<9;i++){const tooth=new T.Mesh(new T.ConeGeometry(.2,.65,3),toothMat);tooth.rotation.z=Math.PI;tooth.position.set((i-4)*.36,-.95,-7.3+Math.abs(i-4)*.15);group.add(tooth);}
  const finGeo=new T.BufferGeometry();finGeo.setAttribute('position',new T.Float32BufferAttribute([0,1.5,-.5,0,7,2,0,1.8,4],3));finGeo.setIndex([0,1,2]);finGeo.computeVertexNormals();const finMat=new T.MeshStandardMaterial({color:'#526872',side:T.DoubleSide,roughness:.65});group.add(new T.Mesh(finGeo,finMat));
  for(const s of[-1,1]){const fin=panel([[s*1.5,-2],[s*7,2.8],[s*2,2.0]],skin,group);fin.position.y=-.4;const eye=new T.Mesh(new T.SphereGeometry(.27,10,8),new T.MeshBasicMaterial({color:'#03070a'}));eye.position.set(s*1.8,.5,-5.6);group.add(eye);}
  const tail=new T.Mesh(new T.ConeGeometry(3.5,6,3),finMat);tail.rotation.z=Math.PI/2;tail.position.set(0,.3,8);tail.scale.set(.32,1,1);group.add(tail);return group;
}
