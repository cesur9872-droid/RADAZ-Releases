type Dimensions = [number, number, number];

/** Keep every acquisition plane unless the GPU's actual limits require fewer. */
export function volumeDimensions(source:Dimensions,maxDimension:number,budgetBytes:number,nativeBytes=4):Dimensions {
  if(maxDimension<3||budgetBytes<108)throw Error('GPU həcm limiti kifayət deyil');
  if(source.every(n=>n<=maxDimension)&&source.reduce((n,d)=>n*d,nativeBytes)<=budgetBytes)return [...source];
  const depth=Math.min(source[2],Math.floor(maxDimension),Math.floor(budgetBytes/4));
  const scale=Math.min(1,maxDimension/source[0],maxDimension/source[1],Math.sqrt(budgetBytes/(4*depth*source[0]*source[1])));
  return [Math.max(1,Math.floor(source[0]*scale)),Math.max(1,Math.floor(source[1]*scale)),depth];
}

/** Area weights include all source voxels, including the last partial bin. */
export function areaWeights(input:number,output:number) {
  const ratio=input/output;
  return Array.from({length:output},(_,index)=>{
    const start=index*ratio,end=(index+1)*ratio;
    const weights:{index:number;weight:number}[]=[];
    for(let i=Math.floor(start);i<Math.min(input,Math.ceil(end));i++){
      const overlap=Math.min(end,i+1)-Math.max(start,i);
      if(overlap>1e-10)weights.push({index:i,weight:overlap/ratio});
    }
    return weights;
  });
}

export function resamplePlane(pixels:ArrayLike<number>,columns:number,xWeights:ReturnType<typeof areaWeights>,yWeights:ReturnType<typeof areaWeights>) {
  const result=new Float32Array(xWeights.length*yWeights.length);
  for(let y=0;y<yWeights.length;y++)for(let x=0;x<xWeights.length;x++){
    let sum=0;
    for(const row of yWeights[y])for(const column of xWeights[x])sum+=pixels[row.index*columns+column.index]*row.weight*column.weight;
    result[y*xWeights.length+x]=sum;
  }
  return result;
}
