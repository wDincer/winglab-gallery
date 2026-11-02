import * as THREE from './vendor/three.module.js';
import {eagleWingAngle} from './eagle-geometry.js';

// A local, articulated model. The shoulder angles come from the pilot's arms;
// no looping animation runs independently of the body tracker.
export function createToucanModel(){
  const root=new THREE.Group();root.name='Tukan';
  const sourceGeometries=new Set();
  const material=(color)=>new THREE.MeshStandardMaterial({color,roughness:.89,metalness:0});
  const colors={body:material('#111921'),breast:material('#fff0b7'),mantle:material('#17202a'),gold:material('#131b24'),head:material('#11161e'),light:material('#fff1c9'),dark:material('#080d13'),feather:material('#101923'),edge:material('#28313a'),beak:material('#92928c'),tip:material('#332a23'),eye:material('#121a17'),iris:material('#ff9b16'),claw:material('#2a2723')};
  function mesh(geometry,mat,parent=root,source=true){if(source)sourceGeometries.add(geometry);const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const sphere=new THREE.SphereGeometry(1,24,16);
  function ellipsoid(parent,position,scale,mat){const m=mesh(sphere,mat,parent);m.position.set(...position);m.scale.set(...scale);return m;}
  function rod(parent,a,b,r,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const m=mesh(new THREE.CylinderGeometry(r,r*.8,d.length(),7),mat,parent);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
  // A thick, softly ridged feather: its curved perimeter and narrow tip remain
  // legible from the chase camera, including beneath the darker cave lighting.
  function featherGeometry(length,width){
    const verts=[],indices=[],rows=9;
    for(let i=0;i<=rows;i++){
      const t=i/rows,z=t*length;
      const w=width*Math.pow(Math.sin(Math.PI*Math.pow(t,.72)),.62)*.5;
      const ridge=Math.sin(t*Math.PI)*width*.12;
      verts.push(-w,-.015,z,0,ridge,z,w,-.015,z);
      if(i<rows){const j=i*3;indices.push(j,j+3,j+1,j+1,j+3,j+4,j+1,j+4,j+2,j+2,j+4,j+5);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  const featherCache=new Map();
  function feather(parent,length,width,position,angle,mat,roll=0){
    const key=`${length.toFixed(2)}:${width.toFixed(2)}`;let geometry=featherCache.get(key);if(!geometry){geometry=featherGeometry(length,width);featherCache.set(key,geometry);}
    const m=mesh(geometry,mat,parent);m.material.side=THREE.DoubleSide;m.position.set(...position);m.rotation.set(0,angle,roll);return m;
  }
  // Strong chest, tapered abdomen and a golden nape distinguish the eagle from
  // the original aircraft even when seen entirely from behind.
  ellipsoid(root,[0,0,-.05],[.76,.8,1.65],colors.body);
  ellipsoid(root,[0,-.2,-.75],[.63,.68,.94],colors.breast);
  ellipsoid(root,[0,.43,-1.48],[.5,.64,.8],colors.gold);
  ellipsoid(root,[0,.77,-2.02],[.48,.54,.63],colors.head);
  ellipsoid(root,[0,.48,-2.29],[.38,.3,.53],colors.light);
  // Crown and neck feathers overlap toward the back in short, warm streaks.
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const x=(col-2)*(.14+row*.035),z=-2.16+row*.4;
    feather(root,.65+row*.12,.19,[x,1.15-row*.19,z],(col-2)*.08,colors.gold);
  }
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
    const x=(col-2)*(.19-row*.015),z=-1.1+row*.43;
    feather(root,.82,.29,[x,.69-row*.06,z],(col-2)*.1,(row+col)%3?colors.mantle:colors.gold);
  }
  // Toco toucan: large yellow bill, orange lower edge and a black tip.
  const billPositions=[],billColors=[],billIndices=[];
  const rings=[[-2.45,.67,.28,.43],[-2.8,.83,.39,.65],[-3.5,.86,.42,.67],[-4.25,.78,.35,.59],[-4.95,.56,.22,.4],[-5.38,.25,.025,.08]];
  for(let j=0;j<rings.length;j++)for(let i=0;i<=20;i++){
    const a=i/20*Math.PI*2,[z,y,w,h]=rings[j];
    billPositions.push(Math.cos(a)*w,y+Math.sin(a)*h,z);
    const c=new THREE.Color(j===rings.length-1?'#171a1c':Math.sin(a)<-.1?'#f04913':Math.sin(a)<.4?'#ff9a05':'#ffda08');
    billColors.push(c.r,c.g,c.b);
    if(j<rings.length-1&&i<20){const k=j*21+i;billIndices.push(k,k+1,k+21,k+1,k+22,k+21);}
  }
  const bill=new THREE.BufferGeometry();bill.setAttribute('position',new THREE.Float32BufferAttribute(billPositions,3));bill.setAttribute('color',new THREE.Float32BufferAttribute(billColors,3));bill.setIndex(billIndices);bill.computeVertexNormals();
  mesh(bill,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.42,side:THREE.DoubleSide}));
  ellipsoid(root,[0,.38,-2.21],[.43,.35,.5],colors.light);
  ellipsoid(root,[0,-.04,1.55],[.54,.47,.64],material('#cc2632'));
  for(const side of[-1,1]){
    ellipsoid(root,[side*.417,.81,-2.28],[.058,.115,.12],colors.dark);
    ellipsoid(root,[side*.464,.82,-2.3],[.022,.072,.077],colors.iris);
    ellipsoid(root,[side*.482,.82,-2.32],[.014,.047,.044],colors.eye);
    ellipsoid(root,[side*.487,.85,-2.35],[.009,.017,.017],colors.light);


  }

  const wings=[];
  for(const side of[-1,1]){
    const hinge=new THREE.Group();hinge.position.set(side*.55,.55,-.35);root.add(hinge);
    const wing=new THREE.Group();wing.scale.x=side;hinge.add(wing);wings.push({hinge,wing,side});
    // A shallow, rounded leading surface supports several distinct rows of
    // coverts, secondaries and spread, finger-like primary flight feathers.
    ellipsoid(wing,[1.05,0,-.25],[1.55,.19,.71],colors.body);
    const outer=ellipsoid(wing,[3.35,-.005,-.1],[2.55,.14,.8],colors.body);outer.rotation.y=-.065;
    ellipsoid(wing,[5.5,-.02,.08],[.95,.12,.67],colors.feather);
    for(let i=0;i<15;i++){
      const x=.35+i*.36,t=i/14;
      feather(wing,1.65+t*.22,.54,[x,-.015,-.25+t*.16],.11+t*.22,i%3===0?colors.edge:colors.feather);
    }
    for(let i=0;i<8;i++){
      const angle=1.5-i*.115,length=2.65-i*.07;
      feather(wing,length,.54,[5.1+i*.1,-.035,-.58+i*.14],angle,i%3===0?colors.dark:colors.feather);
      // Narrow tawny panels taper before the dark, separated primary tips.
      feather(wing,length*.57,.25,[5.1+i*.1,.012,-.58+i*.14],angle,i%2?colors.edge:colors.mantle);
    }
    for(let row=0;row<3;row++)for(let i=0;i<14;i++){
      const t=i/13,x=.25+t*5.9,z=-.7+row*.33+t*.25;
      feather(wing,.78+row*.16,.37,[x,.1-row*.022,z],.17+t*.3,(i+row)%4===0?colors.gold:row===0?colors.mantle:colors.edge);
    }
    // The alula at the wrist creates a small, forward-facing notch.
    feather(wing,1.0,.38,[4.4,.08,-.6],2.55,colors.mantle);
  }

  // A wide fan of individual tail feathers is visible below the body's end.
  for(let i=0;i<9;i++){
    const t=(i-4)/4;
    feather(root,2.1-Math.abs(t)*.18,.51,[t*.38,-.23,1.12],t*.52,i%2?colors.feather:colors.edge);
    feather(root,1.38,.24,[t*.38,-.19,1.12],t*.52,colors.mantle);
  }
  for(const side of[-1,1]){
    ellipsoid(root,[side*.36,-.68,.5],[.23,.35,.41],colors.body);
    rod(root,[side*.34,-.75,.53],[side*.38,-1.16,.65],.095,colors.beak);
    for(let toe=0;toe<3;toe++){
      const x=side*.38+(toe-1)*.12;
      rod(root,[side*.38,-1.15,.65],[x,-1.26,.22],.043,colors.beak);
      rod(root,[x,-1.26,.22],[x,-1.38,.16],.035,colors.claw);
    }
    rod(root,[side*.38,-1.15,.66],[side*.38,-1.3,.94],.04,colors.claw);
  }

  // Keep every feather's silhouette while batching static pieces by material.
  // Only the two shoulder groups need independent draw transforms.
  function batch(group){
    const buckets=new Map();
    for(const child of [...group.children]){
      if(!child.isMesh||child.geometry.attributes.color)continue;
      child.updateMatrix();
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      let bucket=buckets.get(child.material);
      if(!bucket){bucket={positions:[],normals:[]};buckets.set(child.material,bucket);}
      bucket.positions.push(...geometry.attributes.position.array);bucket.normals.push(...geometry.attributes.normal.array);
      geometry.dispose();group.remove(child);
    }
    for(const [mat,{positions,normals}]of buckets){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));mesh(geometry,mat,group,false);
    }
  }
  for(const {wing}of wings)batch(wing);batch(root);
  for(const geometry of sourceGeometries)geometry.dispose();sourceGeometries.clear();featherCache.clear();

  function update(state){
    for(const {hinge,side}of wings){
      const input=side===-1?state.leftWingAngle:state.rightWingAngle;
      const angle=eagleWingAngle(Number.isFinite(input)?input:90,Number(state.altitude)||0);
      hinge.rotation.z=side*(angle-90)*Math.PI/180;
    }
  }
  update({altitude:0,leftWingAngle:90,rightWingAngle:90});
  return {root,update};
}
