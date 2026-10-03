type Point2 = [number, number];

/** Two screen-sized rotation handles, clipped to the visible part of the line. */
export function localizerRotationHandles(a:Point2,b:Point2,origin:Point2,width:number,height:number,pointer?:Point2) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<1||width<40||height<40)return [];
  const direction:Point2=[(b[0]-a[0])/length,(b[1]-a[1])/length];
  const project=(p:Point2)=>(p[0]-origin[0])*direction[0]+(p[1]-origin[1])*direction[1];
  let low=Math.min(project(a),project(b)),high=Math.max(project(a),project(b));
  for(const [axis,limit] of [[0,width],[1,height]]){
    if(Math.abs(direction[axis])<1e-8){if(origin[axis]<16||origin[axis]>limit-16)return [];continue;}
    const edges=[(16-origin[axis])/direction[axis],(limit-16-origin[axis])/direction[axis]];
    low=Math.max(low,Math.min(...edges));high=Math.min(high,Math.max(...edges));
  }
  const hovered=pointer?project(pointer):0;
  return ([-1,1] as const).flatMap(side=>{
    const min=side<0?Math.max(32,-high):Math.max(32,low),max=side<0?-low:high;
    if(max<min)return [];
    const follows=pointer&&Math.sign(hovered)===side;
    const distance=Math.max(min,Math.min(max,follows?Math.abs(hovered)+22:Math.min(120,max*.57)));
    return [{side,point:[origin[0]+direction[0]*distance*side,origin[1]+direction[1]*distance*side] as Point2}];
  });
}
