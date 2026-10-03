/** Local timing diagnostics. Never includes patient names, identifiers or DICOM bytes. */
export const viewerPerformance = {
  decodeCount: 0, decodeMs: 0, volumeBuildCount: 0, volumeBuildMs: 0,
  volumeCacheHits: 0, gpuUploadAndFirstRenderMs: 0, first3DFrameMs: 0,
  frameTimes: [] as number[], voxelBytes: 0, estimatedGpuBytes: 0,
  gpuTimerMs: null as number | null, gpuUploadCpuMs: 0,
};
export function performanceSnapshot() {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const times = [...viewerPerformance.frameTimes].sort((a,b)=>a-b);
  return { ...viewerPerformance, frameTimes: undefined,
    interactionFps: times.length ? 1000 / (times.reduce((a,b)=>a+b,0) / times.length) : null,
    p95FrameMs: times.length ? times[Math.floor((times.length-1)*.95)] : null,
    jsHeapBytes: memory?.usedJSHeapSize ?? null, gpuMemoryIsEstimate: true };
}
if (typeof window !== 'undefined') Object.assign(window, { radazPerformance: performanceSnapshot });

/** EXT timer measures GPU commands; wall time is reported separately, never as GPU time. */
const instrumentedContexts = new WeakSet<WebGL2RenderingContext>();
export function instrumentVolumeUpload(gl:WebGL2RenderingContext) {
  if(instrumentedContexts.has(gl))return;
  instrumentedContexts.add(gl);
  const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  for(const method of ['texImage3D','texSubImage3D'] as const){
    const original=(gl[method] as Function).bind(gl);
    (gl as any)[method]=(...args:unknown[])=>{
      const started=performance.now();
      const query=extension&&!gl.getQuery(extension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)?gl.createQuery():null;
      if(query)gl.beginQuery(extension!.TIME_ELAPSED_EXT,query);
      try{return original(...args);}finally{
        viewerPerformance.gpuUploadCpuMs+=performance.now()-started;
        if(query){
          gl.endQuery(extension!.TIME_ELAPSED_EXT);
          let attempts=0;const collect=()=>{
            if(gl.isContextLost()||gl.getParameter(extension!.GPU_DISJOINT_EXT)||attempts++>120){gl.deleteQuery(query);return;}
            if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){setTimeout(collect,50);return;}
            viewerPerformance.gpuTimerMs=(viewerPerformance.gpuTimerMs||0)+gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);
          };setTimeout(collect,50);
        }
      }
    };
  }
}
