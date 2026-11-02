// Simulation is independent of rendering and camera input. Coordinates: forward -Z.
export const RULES = Object.freeze({points:25,lives:3,upgrade:1.1,lockRadius:.078,cooldown:1.1,missileSpeed:330,enemySpeed:145,warning:1.6,invulnerability:2.8});
const copy=p=>({x:p.x,y:p.y,z:p.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const length=p=>Math.hypot(p.x,p.y,p.z);
const unit=p=>{const d=length(p)||1;return{x:p.x/d,y:p.y/d,z:p.z/d};};
const add=(a,b,s=1)=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
export const playerPosition=f=>({x:f.x,y:f.altitude+2.15,z:-f.distance});
export function segmentDistance(a,b,p){const d=sub(b,a),v=sub(p,a),den=d.x*d.x+d.y*d.y+d.z*d.z;const t=Math.max(0,Math.min(1,(v.x*d.x+v.y*d.y+v.z*d.z)/(den||1)));return length(sub(add(a,d,t),p));}
export function createCombat(){return{time:0,score:0,kills:0,lives:3,ability:1,enemies:[],missiles:[],effects:[],events:[],nextId:1,nextSpawn:1.2,nextAttack:7,cooldown:0,invulnerable:0,gameOver:false,lockId:null};}
export function chooseTarget(projections,aim){return projections.filter(p=>p.visible&&Math.hypot(p.x-aim.x,p.y-aim.y)<=RULES.lockRadius+(p.radius||0)).sort((a,b)=>Math.hypot(a.x-aim.x,a.y-aim.y)-Math.hypot(b.x-aim.x,b.y-aim.y))[0]?.id??null;}
export function spawnEnemy(c,f,slot=c.enemies.length){
 const h=f.heading*Math.PI/180,forward={x:Math.sin(h),y:0,z:-Math.cos(h)},right={x:Math.cos(h),y:0,z:Math.sin(h)},p=playerPosition(f);
 const side=slot===0?0:(slot%2?1:-1)*(160+slot*25),ahead=slot===0?430:510+slot*80;
 const e={id:c.nextId++,age:0,position:add(add(p,forward,ahead),right,side),heading:h,phase:slot*2.1,side,ahead,alive:true,warning:0,fireAt:null,attackPoint:null};e.position.y+=slot===0?24:40+slot*28;c.enemies.push(e);return e;
}
export function firePlayer(c,f,aimDirection){
 if(c.gameOver||c.cooldown>0)return false;
 const target=c.enemies.find(e=>e.id===c.lockId&&e.alive),p=playerPosition(f);
 const heading=f.heading*Math.PI/180,direction=target?unit(sub(target.position,p)):unit(aimDirection||{x:Math.sin(heading),y:0,z:-Math.cos(heading)});
 c.missiles.push({id:c.nextId++,owner:'player',position:add(p,direction,20),direction,targetId:target?.id??null,age:0,speed:RULES.missileSpeed*c.ability,trail:[]});c.cooldown=RULES.cooldown/c.ability;c.events.push({type:'launch',locked:!!target});return true;
}
export function destroyEnemy(c,id){const e=c.enemies.find(e=>e.id===id&&e.alive);if(!e)return false;e.alive=false;c.kills++;c.score=c.kills*RULES.points;c.ability=Math.pow(RULES.upgrade,c.kills);c.effects.push({id:c.nextId++,position:copy(e.position),age:0,kind:'explosion'});c.events.push({type:'kill',score:c.score,ability:c.ability});if(c.lockId===id)c.lockId=null;return true;}
export function damagePlayer(c,f,reason='missile'){if(c.gameOver||c.invulnerable>0)return false;c.lives=Math.max(0,c.lives-1);c.invulnerable=RULES.invulnerability;c.effects.push({id:c.nextId++,position:playerPosition(f),age:0,kind:'hit'});c.events.push({type:'damage',lives:c.lives,reason});if(c.lives===0){c.gameOver=true;c.events.push({type:'defeat'});}return true;}
function intercept(origin,target,velocity,speed){
 const r=sub(target,origin),a=velocity.x**2+velocity.y**2+velocity.z**2-speed**2,b=2*(r.x*velocity.x+r.y*velocity.y+r.z*velocity.z),cc=r.x**2+r.y**2+r.z**2;
 const discriminant=b*b-4*a*cc;let t=0;
 if(Math.abs(a)>.0001&&discriminant>=0){const roots=[(-b+Math.sqrt(discriminant))/(2*a),(-b-Math.sqrt(discriminant))/(2*a)].filter(v=>v>0);if(roots.length)t=Math.min(...roots);}
 return add(target,velocity,t);
}
export function stepCombat(c,f,dt,{active=true,paused=false}={}){
 if(!active||paused||c.gameOver)return;c.events=[];dt=Math.min(.05,Math.max(0,dt));c.time+=dt;c.cooldown=Math.max(0,c.cooldown-dt);c.invulnerable=Math.max(0,c.invulnerable-dt);
 const p=playerPosition(f),h=f.heading*Math.PI/180,forward={x:Math.sin(h),y:0,z:-Math.cos(h)},right={x:Math.cos(h),y:0,z:Math.sin(h)};
 if(c.time>=c.nextSpawn&&c.enemies.filter(e=>e.alive).length<4){spawnEnemy(c,f);c.nextSpawn=c.time+2.7;}
 for(const e of c.enemies){if(!e.alive)continue;e.age+=dt;
   // Independent motion: fly the heading at which the enemy entered, never follow the reticle.
   const dir={x:Math.sin(e.heading),y:0,z:-Math.cos(e.heading)};
   e.position=add(e.position,dir,Math.max(32,f.speed*.514444*.83)*dt);
   e.position.x+=Math.cos(e.age*.57+e.phase)*7*dt;e.position.y+=Math.sin(e.age*.7+e.phase)*3*dt;
   if(length(sub(e.position,p))>2300||e.position.y<30){e.alive=false;continue;}
   if(e.fireAt!==null){e.warning=Math.max(0,e.fireAt-c.time);
     if(c.time>=e.fireAt){const direction=unit(sub(e.attackPoint,e.position));c.missiles.push({id:c.nextId++,owner:'enemy',position:copy(e.position),direction,age:0,speed:RULES.enemySpeed,trail:[]});e.fireAt=null;e.warning=0;c.events.push({type:'enemyLaunch'});}
   }
 }
 if(c.time>=c.nextAttack){const e=c.enemies.find(e=>e.alive&&e.fireAt===null);if(e){
   const speed=f.speed*.514444*c.ability,velocity={x:forward.x*speed,y:f.verticalSpeed*c.ability,z:forward.z*speed};
   const enemySpeed=Math.max(32,f.speed*.514444*.83),enemyVelocity={x:Math.sin(e.heading)*enemySpeed+Math.cos(e.age*.57+e.phase)*7,y:Math.sin(e.age*.7+e.phase)*3,z:-Math.cos(e.heading)*enemySpeed};
   e.attackPoint=intercept(add(e.position,enemyVelocity,RULES.warning),add(p,velocity,RULES.warning),velocity,RULES.enemySpeed);e.fireAt=c.time+RULES.warning;e.warning=RULES.warning;c.events.push({type:'warning'});
 }c.nextAttack=c.time+6.5;}
 for(const m of c.missiles){const previous=copy(m.position);m.age+=dt;
   if(m.owner==='player'&&m.targetId!==null){const target=c.enemies.find(e=>e.id===m.targetId&&e.alive);if(target)m.direction=unit(sub(target.position,m.position));else m.targetId=null;}
   m.position=add(m.position,m.direction,m.speed*dt);m.trail.push(copy(m.position));if(m.trail.length>20)m.trail.shift();
   if(m.owner==='player'){for(const e of c.enemies){if(e.alive&&segmentDistance(previous,m.position,e.position)<14){destroyEnemy(c,e.id);m.age=99;break;}}}
   else if(segmentDistance(previous,m.position,p)<9){damagePlayer(c,f);m.age=99;}
 }
 c.missiles=c.missiles.filter(m=>m.age<12);for(const effect of c.effects)effect.age+=dt;c.effects=c.effects.filter(e=>e.age<2);c.enemies=c.enemies.filter(e=>e.alive);
}
// Upgrades wrap the retained flight model, leaving its approved body/arm controls intact.
export function stepUpgradedFlight(step,f,input,dt,ability){
 const before={x:f.x,distance:f.distance,heading:f.heading,altitude:f.altitude};step(f,input,dt);
 if(!input.active||input.paused||f.crashed)return;
 const gain=Math.max(1,ability);f.x=before.x+(f.x-before.x)*gain;f.distance=before.distance+(f.distance-before.distance)*gain;
 const turn=((f.heading-before.heading+540)%360)-180;f.heading=(before.heading+turn*gain+360)%360;
 f.altitude=Math.min(1200,Math.max(0,before.altitude+(f.altitude-before.altitude)*gain));
}

