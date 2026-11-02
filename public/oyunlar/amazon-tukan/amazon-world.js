// Scene and collision share this deterministic triangulated landscape.
export const LAND = {width: 6400, depth: 10000, columns: 160, rows: 250, centerZ: -3200};
export const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const riverX=z=>240+260*Math.sin(-z*.00125)+120*Math.sin(-z*.0028);
export const riverWidth=z=>85+22*Math.sin(z*.0011);
export function groundHeight(x,z){
  const d=-z,river=Math.abs(x-riverX(z));
  const hills=(8+19*(1+Math.sin(x*.0028+z*.0017)*Math.cos(z*.0031)))*smooth(riverWidth(z),riverWidth(z)+60,river);
  const lateral=1-smooth(55,480,Math.abs(x));
  const peak=500*(1-smooth(0,230,d))*lateral*(1-smooth(350,1000,z));
  return Math.max(hills,peak);
}
export function groundSurface(x,z){
  const sx=LAND.width/LAND.columns,sz=LAND.depth/LAND.rows;
  const ix=Math.floor((x+LAND.width/2)/sx),iz=Math.floor((z-LAND.centerZ+LAND.depth/2)/sz);
  const x0=ix*sx-LAND.width/2,z0=iz*sz+LAND.centerZ-LAND.depth/2;
  const fx=(x-x0)/sx,fz=(z-z0)/sz;
  const a=Math.fround(groundHeight(x0,z0)),b=Math.fround(groundHeight(x0+sx,z0)),c=Math.fround(groundHeight(x0,z0+sz));
  if(fx+fz<=1)return a+fx*(b-a)+fz*(c-a);
  const e=Math.fround(groundHeight(x0+sx,z0+sz));return e+(1-fx)*(c-e)+(1-fz)*(b-e);
}
export function randomSource(seed=8091){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function makeTrees(count=32000){
  const random=randomSource(),trees=[];
  while(trees.length<count){
    const x=(random()-.5)*LAND.width,z=1600-random()*9800,y=groundSurface(x,z);
    if(Math.abs(x-riverX(z))<riverWidth(z)+18||(-z<650&&Math.abs(x)<125)||y>340)continue;
    const size=20+random()*20;trees.push({x,y,z,size,tint:random(),rotation:random()*Math.PI});
  }
  return trees;
}
