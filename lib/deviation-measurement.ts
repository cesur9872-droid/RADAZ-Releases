import type { WorldPoint } from './arch-measurement';

/** Image horizontal/vertical axes in physical space; independent of zoom and pan. */
export function measureDeviation([a,b]:WorldPoint[], horizontal:WorldPoint, vertical:WorldPoint) {
  if(!a||!b)return null;
  const hLength=Math.hypot(...horizontal),vLength=Math.hypot(...vertical);
  if(!hLength||!vLength)return null;
  const h=horizontal.map(v=>v/hLength),v=vertical.map(n=>n/vLength),delta=b.map((n,i)=>n-a[i]);
  const dx=delta.reduce((n,d,i)=>n+d*h[i],0),dy=delta.reduce((n,d,i)=>n+d*v[i],0);
  if(!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<1e-3)return null;
  return {foot:a.map((n,i)=>n+dx*h[i]) as WorldPoint,height:Math.abs(dy),angle:Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI};
}
