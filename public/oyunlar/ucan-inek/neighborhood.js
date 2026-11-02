import {coursePoint, COURSE} from './course.js';

// One description drives the rendered houses and their solid collision bounds.
export function seededRandom(seed=1731){return ()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}
const random=seededRandom();
export const BUILDINGS=[];
for(let d=-45;d<COURSE.length+650;d+=82){
  const center=coursePoint(Math.max(0,d)).x;
  for(const side of[-1,1])for(let row=0;row<2;row++){
    const width=24+random()*15,depth=25+random()*15,height=9+Math.floor(random()*2)*6;
    BUILDINGS.push({x:center+side*(92+row*74+random()*15),z:-d+(random()-.5)*17,width,depth,height,roof:4,color:Math.floor(random()*5),side,porch:row===0});
  }
}
export const ROAD_HALF_WIDTH=36;
export const DISTRICT='GROVE MAHALLESİ';
export const BRIDGE_SOLIDS=[
  {x:0,z:-510,width:600,depth:30,height:44,minY:40,roof:0,type:'bridge'},
  ...[-225,-135,-45,45,135,225].map(x=>({x,z:-510,width:5,depth:22,height:42,minY:0,roof:0,type:'bridge'})),
];
