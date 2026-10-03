export type GpuCapabilities={renderer:string;maxTextureSize:number;max3DTextureSize:number;budgetBytes:number;tier:'low'|'medium'|'high';timerQuery:boolean};
let cached:GpuCapabilities|undefined;
export function gpuCapabilities():GpuCapabilities {
  if(cached)return cached;
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false});
  if(!gl)throw Error('Bu cihazda WebGL2 yoxdur. 2D və MPR istifadə edin.');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL||gl.RENDERER));
  const max3DTextureSize=Number(gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)),maxTextureSize=Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory||4;
  const low=/swiftshader|software|llvmpipe|basic render/i.test(renderer)||max3DTextureSize<512||memory<=2;
  const high=!low&&/nvidia|radeon rx|apple m[234]/i.test(renderer)&&memory>=8;
  cached={renderer,max3DTextureSize,maxTextureSize,tier:low?'low':high?'high':'medium',
    budgetBytes:(low?64:high?384:192)*1024**2,timerQuery:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};
  gl.getExtension('WEBGL_lose_context')?.loseContext();return cached;
}
