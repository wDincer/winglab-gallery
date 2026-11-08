import {COURSE_DESIGN} from './course-design.js?v=duck-waves-v1';

export const MAZE=Object.freeze(COURSE_DESIGN.backrooms);
export const DIRECTIONS=Object.freeze([
  {dx:0,dz:-1,name:'north',opposite:'south'},
  {dx:1,dz:0,name:'east',opposite:'west'},
  {dx:0,dz:1,name:'south',opposite:'north'},
  {dx:-1,dz:0,name:'west',opposite:'east'}
]);
const key=(x,z)=>`${x},${z}`;
const modulo=(value,n)=>((value%n)+n)%n;
export function hash(x,z,salt=0){
  let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul((MAZE.seed+salt)|0,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;
}
export const cellAt=point=>({x:Math.floor(point.x/MAZE.cellSize+.5),z:Math.floor(point.z/MAZE.cellSize+.5)});
export const cellCenter=cell=>({x:cell.x*MAZE.cellSize,z:cell.z*MAZE.cellSize});
export const EXIT_CELL=Object.freeze({...MAZE.exitCell});
export const EXIT=Object.freeze({...cellCenter(EXIT_CELL),radius:MAZE.exitRadius,cell:EXIT_CELL});

// A small priority queue keeps distant exit searches out of the render loop.
const before=(a,b)=>a.f<b.f||(a.f===b.f&&(a.h<b.h||(a.h===b.h&&a.order<b.order)));
function enqueue(heap,node){
  let index=heap.length;heap.push(node);
  while(index){const parent=(index-1)>>1;if(!before(node,heap[parent]))break;heap[index]=heap[parent];index=parent;}
  heap[index]=node;
}
function dequeue(heap){
  const first=heap[0],last=heap.pop();if(!heap.length)return first;
  let index=0;
  while(index*2+1<heap.length){
    let child=index*2+1;if(child+1<heap.length&&before(heap[child+1],heap[child]))child++;
    if(!before(heap[child],last))break;heap[index]=heap[child];index=child;
  }
  heap[index]=last;return first;
}

// Each 3x3 block has a seeded spanning tree. A shared doorway on every block
// boundary joins the trees into one connected, unbounded two-dimensional maze.
// Every internal leaf gets another door, so even rooms on closed block edges
// have at least two ways out. Adding doors cannot break global connectivity.
// Regenerating a discarded block produces the exact same walls and doorways.
export class InfiniteMaze{
  constructor(){this.chunks=new Map();this.layout=null;this.revision=0;}
  chunk(cx,cz){
    const id=key(cx,cz);if(this.chunks.has(id))return this.chunks.get(id);
    const n=MAZE.chunkCells,edges=new Set(),visited=new Set([0]),stack=[0];
    let random=hash(cx,cz,53)||1;
    const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
    const edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    while(stack.length){
      const a=stack.at(-1),x=a%n,z=Math.floor(a/n);
      const candidates=DIRECTIONS.map(d=>({x:x+d.dx,z:z+d.dz})).filter(p=>p.x>=0&&p.x<n&&p.z>=0&&p.z<n&&!visited.has(p.z*n+p.x));
      if(!candidates.length){stack.pop();continue;}
      const p=candidates[Math.floor(next()*candidates.length)],b=p.z*n+p.x;
      edges.add(edge(a,b));visited.add(b);stack.push(b);
    }
    // Occasional cross-links let players circle back and evade a pursuer.
    for(let z=0;z<n;z++)for(let x=0;x<n;x++)for(const[dx,dz]of[[1,0],[0,1]]){
      if(x+dx<n&&z+dz<n&&next()<.13)edges.add(edge(z*n+x,(z+dz)*n+x+dx));
    }
    // The square grid has at least two internal neighbours at every room.
    // Repairing its degree can only increase later rooms' degrees; one pass
    // therefore proves degree >= 2 independently of cross-block doorways.
    for(let a=0;a<n*n;a++){
      const x=a%n,z=Math.floor(a/n),adjacent=DIRECTIONS.map(d=>({x:x+d.dx,z:z+d.dz}))
        .filter(p=>p.x>=0&&p.x<n&&p.z>=0&&p.z<n).map(p=>p.z*n+p.x);
      const degree=adjacent.filter(b=>edges.has(edge(a,b))).length;
      const closed=adjacent.filter(b=>!edges.has(edge(a,b)));
      for(let needed=2-degree;needed>0&&closed.length;needed--){
        const index=Math.floor(next()*closed.length),[b]=closed.splice(index,1);edges.add(edge(a,b));
      }
    }
    const chunk={cx,cz,edges};this.chunks.set(id,chunk);
    // Path searches may touch distant blocks as well as rendered ones.
    // FIFO eviction is safe because generation never depends on cache contents.
    if(this.chunks.size>96)this.chunks.delete(this.chunks.keys().next().value);
    return chunk;
  }
  isOpen(x,z,direction){
    const d=typeof direction==='number'?DIRECTIONS[direction]:DIRECTIONS.find(d=>d.name===direction);
    const nx=x+d.dx,nz=z+d.dz,n=MAZE.chunkCells;
    const cx=Math.floor(x/n),cz=Math.floor(z/n),ncx=Math.floor(nx/n),ncz=Math.floor(nz/n);
    if(cx!==ncx){const west=Math.min(cx,ncx);return modulo(z,n)===hash(west,cz,109)%n;}
    if(cz!==ncz){const north=Math.min(cz,ncz);return modulo(x,n)===hash(cx,north,227)%n;}
    const a=modulo(z,n)*n+modulo(x,n),b=modulo(nz,n)*n+modulo(nx,n);
    return this.chunk(cx,cz).edges.has(a<b?`${a}:${b}`:`${b}:${a}`);
  }
  neighbors(cell){return DIRECTIONS.filter(d=>this.isOpen(cell.x,cell.z,d.name)).map(d=>({x:cell.x+d.dx,z:cell.z+d.dz}));}
  path(from,to,limit=8192){
    const first=key(from.x,from.z),last=key(to.x,to.z);
    if(first===last)return[{x:from.x,z:from.z}];
    const distance=cell=>Math.abs(cell.x-to.x)+Math.abs(cell.z-to.z);
    const h=distance(from),frontier=[{x:from.x,z:from.z,g:0,h,f:h,order:0}],best=new Map([[first,0]]),parents=new Map();
    let checked=0,order=0;
    while(frontier.length&&checked++<limit){
      const current=dequeue(frontier),id=key(current.x,current.z);
      if(current.g!==best.get(id))continue;
      if(id===last){
        const result=[{x:to.x,z:to.z}];let cursor=last;
        while(cursor!==first){const p=parents.get(cursor);result.push({x:p.x,z:p.z});cursor=key(p.x,p.z);}
        return result.reverse();
      }
      for(const next of this.neighbors(current)){
        const nextId=key(next.x,next.z),g=current.g+1;
        if(g>=(best.get(nextId)??Infinity))continue;
        const h=distance(next);best.set(nextId,g);parents.set(nextId,current);enqueue(frontier,{...next,g,h,f:g+h,order:++order});
      }
    }
    return[];
  }
  update(point){
    const cell=cellAt(point),n=MAZE.chunkCells,cx=Math.floor(cell.x/n),cz=Math.floor(cell.z/n);
    const id=key(cx,cz),navigationId=key(cell.x,cell.z);
    if(this.layout?.id===id){
      if(this.layout.navigationId!==navigationId)this.updateNavigation(cell);
      return this.layout;
    }
    const radius=MAZE.chunkRadius,minX=(cx-radius)*n,maxX=(cx+radius+1)*n-1,minZ=(cz-radius)*n,maxZ=(cz+radius+1)*n-1;
    const walls=[],rooms=[],edges=new Set(),size=MAZE.cellSize,half=size/2,thick=MAZE.wallThickness;
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
      rooms.push({x,z,...cellCenter({x,z}),cellX:x,cellZ:z,tone:hash(x,z,8)%3});
      for(let direction=0;direction<4;direction++){
        const d=DIRECTIONS[direction],nx=x+d.dx,nz=z+d.dz;
        const a=key(x,z),b=key(nx,nz),edgeId=a<b?`${a}/${b}`:`${b}/${a}`;
        if(edges.has(edgeId))continue;edges.add(edgeId);
        const center={x:x*size+d.dx*half,z:z*size+d.dz*half};
        const horizontal=d.dz!==0;
        const add=(offset,length)=>walls.push({x:center.x+(horizontal?offset:0),z:center.z+(horizontal?0:offset),w:horizontal?length:thick,d:horizontal?thick:length,h:MAZE.ceiling});
        if(this.isOpen(x,z,d.name)){
          const length=(size-MAZE.doorWidth)/2;
          for(const side of[-1,1])add(side*(size+MAZE.doorWidth)/4,length+thick);
        }else add(0,size+thick);
      }
      // Corner supports leave every centre-to-door navigation line clear.
      if(hash(x,z,19)%4===0){
        const side=hash(x,z,21)%2?1:-1;
        walls.push({x:x*size+side*5.5,z:z*size+5.4,w:1.1,d:1.1,h:MAZE.ceiling});
      }
    }
    this.layout={id,revision:++this.revision,cx,cz,minX,maxX,minZ,maxZ,walls,rooms,
      origin:{x:cx*n*size,z:cz*n*size}};
    this.updateNavigation(cell);
    return this.layout;
  }
  updateNavigation(cell){
    const layout=this.layout,path=this.path(cell,EXIT_CELL),signs=[];
    // Show a few intermittent reminders ahead, and always mark the current
    // room and turns. All arrows are actual edges of the shortest exit route.
    for(let i=0;i<Math.min(path.length-1,10);i++){
      const room=path[i],next=path[i+1],previous=path[i-1];
      if(room.x<layout.minX||room.x>layout.maxX||room.z<layout.minZ||room.z>layout.maxZ)continue;
      const dx=next.x-room.x,dz=next.z-room.z;
      const turning=previous&&(room.x-previous.x!==dx||room.z-previous.z!==dz);
      if(i!==0&&i%2!==0&&!turning)continue;
      signs.push({cellX:room.x,cellZ:room.z,...cellCenter(room),dx,dz,distance:(path.length-1-i)*MAZE.cellSize});
    }
    layout.exit=EXIT;layout.navigationId=key(cell.x,cell.z);layout.pathToExit=path;layout.signs=signs;
    layout.remainingDistance=path.length?(path.length-1)*MAZE.cellSize:Infinity;
  }
}
