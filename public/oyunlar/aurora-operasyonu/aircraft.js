import * as T from './vendor/three.module.js';
export function createAircraft(enemy=false){
 const group=new T.Group();
 const metal=new T.MeshStandardMaterial({color:enemy?'#4d2938':'#4a5864',metalness:.68,roughness:.49});
 const dark=new T.MeshStandardMaterial({color:'#091321',metalness:.5,roughness:.25});
 const accent=new T.MeshBasicMaterial({color:enemy?'#ff6c55':'#86f6e0',toneMapped:false});
 const add=(geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;};
 // B-2 reference: continuous swept flying wing, clipped tips, sawtooth trailing edge, no tail.
 const outline=[ [0,-12],[26,8.5],[25.2,10.2],[13.2,5.4],[10.7,9.2],[7.8,7.5],[5.4,10.7],[3.5,9.9],[0,11.1],[-3.5,9.9],[-5.4,10.7],[-7.8,7.5],[-10.7,9.2],[-13.2,5.4],[-25.2,10.2],[-26,8.5] ];
 const contours=outline.map(([x,z])=>new T.Vector2(x,z));const triangles=T.ShapeUtils.triangulateShape(contours,[]),v=[],indices=[];
 for(const [x,z]of outline)v.push(x,.2+Math.max(0,1-Math.abs(x)/12)*.34,z);
 for(const [x,z]of outline)v.push(x,-.4,z);
 const n=outline.length;for(const tri of triangles){indices.push(tri[0],tri[2],tri[1],tri[0]+n,tri[1]+n,tri[2]+n);}for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,i+n,j,j+n,i+n);}
 const wing=new T.BufferGeometry();wing.setAttribute('position',new T.Float32BufferAttribute(v,3));wing.setIndex(indices);wing.computeVertexNormals();add(wing,metal);
 const body=add(new T.SphereGeometry(1,24,12),metal,0,.52,-.2);body.scale.set(3.8,1.12,9.2);
 const canopy=add(new T.SphereGeometry(1,16,8),dark,0,1.28,-6.2);canopy.scale.set(2.15,.58,2.2);
 // Split windshield panels, recessed intakes and paired exhaust slots.
 for(const side of[-1,1]){
  const window=add(new T.BoxGeometry(1.25,.07,1.5),new T.MeshStandardMaterial({color:'#558b9e',metalness:.75,roughness:.13,emissive:'#153c4d',emissiveIntensity:.5}),side*.77,1.73,-6.1);window.rotation.y=side*.13;
  const intake=add(new T.BoxGeometry(1.45,.12,3.9),dark,side*4.25,.69,-.2);intake.rotation.y=side*.14;
  add(new T.BoxGeometry(2.4,.2,.85),dark,side*3.9,.42,8.1);
  add(new T.BoxGeometry(2,.1,.16),accent,side*3.9,.43,8.57);
  const tip=add(new T.SphereGeometry(.16,6,4),new T.MeshBasicMaterial({color:side===1?'#ff5b69':'#8effda',toneMapped:false}),side*25.3,.28,8.7);
  tip.userData.nav=true;
 }
 const panelMaterial=new T.LineBasicMaterial({color:enemy?'#b86665':'#81959f',transparent:true,opacity:.38});
 const lines=[[-22,7.3,-12,4],[-12,4,-7,-2],[-7,-2,0,-10.7],[22,7.3,12,4],[12,4,7,-2],[7,-2,0,-10.7],[-12.8,5.2,-7.7,6.5],[12.8,5.2,7.7,6.5],[-5.8,6,-3.3,3.6],[5.8,6,3.3,3.6]];
 for(const [a,b,c,d]of lines){const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(a,.68,b),new T.Vector3(c,.68,d)]);group.add(new T.Line(geo,panelMaterial));}
 const marking=add(new T.PlaneGeometry(2.2,.13),accent,enemy?8:-8,.76,3);marking.rotation.x=-Math.PI/2;
 if(enemy){group.scale.setScalar(.62);for(const side of[-1,1]){const fin=add(new T.ConeGeometry(1.8,4.3,3),metal,side*5,1.7,6.1);fin.rotation.z=side*-.45;} }
 group.traverse(object=>{if(object.material)object.material.userData.unique=true;});
 return group;
}
