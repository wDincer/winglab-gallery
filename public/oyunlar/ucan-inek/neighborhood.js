import {COW_WORLD} from './cow-world.js?v=cow-freeflight-v1';

// One description drives the rendered houses and their solid collision bounds.
export function seededRandom(seed=1731){
  let value=((Math.trunc(seed)%2147483646)+2147483646)%2147483646+1;
  return ()=>{value=value*16807%2147483647;return (value-1)/2147483646;};
}
const random=seededRandom(1731);
export const BUILDINGS=[];
// Roads cross every 180 metres. There is no centreline or fixed direction.
for(let gx=-8;gx<8;gx++)for(let gz=-8;gz<8;gz++){
  const width=44+random()*42,depth=44+random()*42;
  const x=(gx+.5)*180+(random()-.5)*14,z=(gz+.5)*180+(random()-.5)*14;
  const nearX=Math.max(0,Math.abs(x-COW_WORLD.tower.x)-width/2);
  const nearZ=Math.max(0,Math.abs(z-COW_WORLD.tower.z)-depth/2);
  if(Math.hypot(nearX,nearZ)<80)continue;
  const floors=3+Math.floor(random()*13),height=floors*4;
  BUILDINGS.push({x,z,width,depth,height,roof:2+random()*4,color:Math.floor(random()*5),side:x<0?-1:1,porch:floors<=5});
}
export const ROAD_HALF_WIDTH=13;
export const DISTRICT='KULE MAHALLESİ';
export const BRIDGE_SOLIDS=[];
