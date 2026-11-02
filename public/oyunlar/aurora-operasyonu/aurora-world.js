export const CELL=100;
export function fjordHeight(x,z){
 const channel=180*Math.sin(z*.00035),side=Math.abs(x-channel);
 const ramp=Math.max(0,Math.min(1,(side-650)/750));
 const ridge=280+260*Math.pow(.5+.5*Math.sin(z*.0017+x*.0006),2)+180*Math.pow(.5+.5*Math.sin(x*.004-z*.0032),3);
 return ramp*ramp*(3-2*ramp)*ridge-2;
}
// Identical grid triangulation to the rendered patches.
export function fjordSurface(x,z){const x0=Math.floor(x/CELL)*CELL,z0=Math.floor(z/CELL)*CELL,fx=(x-x0)/CELL,fz=(z-z0)/CELL;
 const a=Math.fround(fjordHeight(x0,z0)),b=Math.fround(fjordHeight(x0+CELL,z0)),c=Math.fround(fjordHeight(x0,z0+CELL)),d=Math.fround(fjordHeight(x0+CELL,z0+CELL));
 return fx+fz<=1?a+fx*(b-a)+fz*(c-a):d+(1-fx)*(c-d)+(1-fz)*(b-d);
}
