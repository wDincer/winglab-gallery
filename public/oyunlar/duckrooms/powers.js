import {EXIT_CELL,cellCenter,hash} from './maze.js?v=duck-waves-v1';

export const POWER_DURATION=15;
export const BOX_PICKUP_RADIUS=.9;
const boxLayouts=new WeakMap();
const labels=Object.freeze({freeze:'DONDURMA',slow:'YAVAŞLATMA',shield:'KALKAN',boost:'HIZLANMA'});
const activePower=state=>state.power?.remaining>0?state.power:null;
const excluded=(x,z)=>(x===0&&z===0)||(x===EXIT_CELL.x&&z===EXIT_CELL.z);

export function createPowerState(){
  return {boxes:[],collectedBoxes:new Set(),power:null,boxesCollected:0};
}
function selectedCell(groupX,groupZ){
  const start=hash(groupX,groupZ,409)%10;
  // A fixed 5 by 2 group always contains exactly one reward room. Excluding
  // the launch and exit rooms relocates that reward instead of deleting it.
  for(let offset=0;offset<10;offset++){
    const index=(start+offset)%10,x=groupX*5+index%5,z=groupZ*2+Math.floor(index/5);
    if(!excluded(x,z))return {x,z};
  }
}
export function syncPowerBoxes(state){
  const layout=state.maze?.layout,rooms=layout?.rooms??[];
  state.collectedBoxes??=new Set();
  const memo=boxLayouts.get(state);
  if(memo?.layout===layout&&memo?.collected===state.collectedBoxes&&memo?.count===state.collectedBoxes.size)return state.boxes;
  const boxes=[];
  for(const room of rooms){
    const x=room.cellX,z=room.cellZ;
    const selected=selectedCell(Math.floor(x/5),Math.floor(z/2));
    if(selected.x!==x||selected.z!==z)continue;
    const id=x+','+z;if(state.collectedBoxes.has(id))continue;
    // The room centre and centre-to-door flight lines are clear of all
    // generated corner supports; the box sits at normal cruising height.
    boxes.push({id,cellX:x,cellZ:z,...cellCenter({x,z}),y:1.3,radius:BOX_PICKUP_RADIUS});
  }
  state.boxes=boxes;
  boxLayouts.set(state,{layout,collected:state.collectedBoxes,count:state.collectedBoxes.size});
  return boxes;
}
function sweptPickup(previous,player,box){
  const dx=player.x-previous.x,dy=player.y-previous.y,dz=player.z-previous.z;
  const lengthSquared=dx*dx+dy*dy+dz*dz;
  const t=lengthSquared?Math.max(0,Math.min(1,((box.x-previous.x)*dx+(box.y-previous.y)*dy+(box.z-previous.z)*dz)/lengthSquared)):0;
  return Math.hypot(previous.x+dx*t-box.x,previous.y+dy*t-box.y,previous.z+dz*t-box.z)<=box.radius?t:null;
}
function rewardType(state){
  const monsters=Array.isArray(state.monsters)?state.monsters:(state.monster?[state.monster]:[]);
  const danger=monsters.some(monster=>monster&&monster.stage!=='retreating');
  const choices=danger?['freeze','slow','shield']:['boost','shield'];
  const sample=Number((state.random??Math.random)());
  const index=Math.min(choices.length-1,Math.floor(Math.max(0,Number.isFinite(sample)?sample:0)*choices.length));
  return choices[index];
}
export function stepPowers(state,previous,dt){
  if(!(Number.isFinite(dt)&&dt>0))return;
  state.events??=[];
  if(state.power){
    state.power.remaining=Math.max(0,state.power.remaining-dt);
    if(state.power.remaining<=1e-8){state.power=null;state.events.push('power-ended');}
  }
  syncPowerBoxes(state);
  let selected=null,first=Infinity;
  for(const box of state.boxes){
    const t=sweptPickup(previous,state.player,box);
    if(t!==null&&t<first){selected=box;first=t;}
  }
  if(!selected)return;
  state.collectedBoxes.add(selected.id);
  state.boxesCollected=(state.boxesCollected??0)+1;
  const type=rewardType(state);
  state.power={type,label:labels[type],remaining:POWER_DURATION,duration:POWER_DURATION};
  state.events.push('power-collected');
  syncPowerBoxes(state);
}
export const monsterPowerFactor=state=>activePower(state)?.type==='freeze'?0:activePower(state)?.type==='slow'?.45:1;
export const hasMonsterShield=state=>activePower(state)?.type==='shield';
export const playerPowerFactor=state=>activePower(state)?.type==='boost'?1.35:1;
