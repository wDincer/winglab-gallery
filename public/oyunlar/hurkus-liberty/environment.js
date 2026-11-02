// Shared by the city renderer and flight collision checks.
let seed=1783;
function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
export const BUILDINGS=[];
for(let row=0;row<8;row++)for(let col=0;col<28;col++){
  const x=(col-13.5)*125+(random()-.5)*30,z=-2100-row*135;
  const w=55+random()*48,d=55+random()*40,h=38+random()**1.8*(row<2?190:290);
  BUILDINGS.push({x,z,w,d,h,color:['#9aadaf','#b8b1a0','#c4b89e','#758f99','#7b969e','#b9a794'][Math.floor(random()*6)],tier:random()>.68});
}
export function flightCollision(flight){
  const p={x:flight.x,y:flight.altitude+2.15,z:-flight.distance};
  if(p.y<5)return 'water';
  if(Math.hypot(p.x,p.z)<25&&p.y<126)return 'statue-flight';
  for(const b of BUILDINGS)if(Math.abs(p.x-b.x)<b.w/2+5&&Math.abs(p.z-b.z)<b.d/2+5&&p.y<b.h*(b.tier?1.15:1)+4)return 'building';
  if(Math.abs(p.x-380)<60&&Math.abs(p.z+2750)<60&&p.y<485)return 'building';
  if(Math.abs(p.x+680)<65&&Math.abs(p.z+2500)<65&&p.y<500)return 'building';
  return null;
}
