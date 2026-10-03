'use client';

import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { getViewer, getVolumeTexture } from '@/lib/cornerstone';
import type { VolumeStyle } from '@/lib/volume-renderer';
import { WorkProgress } from './work-progress';
import { type WorkProgress as LoadingProgress, yieldToBrowser } from '@/lib/work-progress';

type Props = {
  sourceProgress?: LoadingProgress | null;
  series?: { id: string; imageIds: string[]; name: string; modality: string };
  preset: VolumeStyle['preset']; threshold: number; opacity: number;
  settings: VolumeRenderSettings;
  resetToken: number;
  onThresholdChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
};

export type VolumeRenderSettings = { ambient: number; diffuse: number; specular: number; specularPower: number; quality: number };

type NativeViewport = {
  render: () => void;
  resetCamera: (options?: unknown) => boolean;
  getCamera: () => { parallelScale?: number };
  setCamera: (camera: { parallelScale?: number }) => void;
  setPreset: (preset: unknown, volumeId?: string, suppressEvents?: boolean) => void;
  setSampleDistanceMultiplier?: (value: number) => void;
  getDefaultActor?: () => { actor?: { getProperty?: () => {
    setShade?: (component: number, enabled: boolean) => void;
    setAmbient?: (component: number, value: number) => void;
    setDiffuse?: (component: number, value: number) => void;
    setSpecular?: (component: number, value: number) => void;
    setSpecularPower?: (component: number, value: number) => void;
  } } };
};

type Drag = { x: number; y: number; threshold: number; opacity: number };
type VtkPreset = { name: string; scalarOpacity: string; colorTransfer: string; gradientOpacity: string;
  shade: string; ambient: string; diffuse: string; specular: string; specularPower: string; interpolation: string };

const viewportId = 'RADAZ-PROFESSIONAL-3D';
const toolGroupId = 'RADAZ-PROFESSIONAL-3D-TOOLS';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const presetMap: Record<VolumeStyle['preset'], { vtk: string; baseThreshold: number }> = {
  bone: { vtk: 'CT-Bone', baseThreshold: 260 },
  boneVessel: { vtk: 'CT-AAA', baseThreshold: 140 },
  vascular: { vtk: 'CT-Coronary-Arteries-3', baseThreshold: 120 },
  skin: { vtk: 'CT-Muscle', baseThreshold: -280 },
  soft: { vtk: 'CT-Soft-Tissue', baseThreshold: -20 },
  lung: { vtk: 'CT-Lung', baseThreshold: -760 },
};

function mapTransfer(serialized: string, stride: number, range: [number, number], shift: number, opacity = 1) {
  const values = serialized.trim().split(/\s+/).map(Number);
  const mapped = [values[0]];
  for (let i = 1; i < values.length; i += stride) {
    mapped.push(clamp((values[i] + shift - range[0]) / (range[1] - range[0]) * 255, 0, 255));
    for (let j = 1; j < stride; j++) mapped.push(stride === 2 && j === 1 ? clamp(values[i + j] * opacity, 0, 1) : values[i + j]);
  }
  return mapped.map(value => Number.isInteger(value) ? String(value) : value.toFixed(5)).join(' ');
}

function professionalPreset(core: Awaited<ReturnType<typeof getViewer>>['core'], preset: VolumeStyle['preset'], threshold: number, opacity: number, range: [number, number], settings: VolumeRenderSettings) {
  const definition = presetMap[preset];
  const source = (core.CONSTANTS.VIEWPORT_PRESETS as VtkPreset[]).find(item => item.name === definition.vtk);
  if (!source) throw new Error(`${definition.vtk} 3D preseti tapılmadı`);
  const shift = threshold - definition.baseThreshold;
  return {
    ...source,
    name: `RADAZ-${preset}`,
    scalarOpacity: mapTransfer(source.scalarOpacity, 2, range, shift, opacity),
    colorTransfer: mapTransfer(source.colorTransfer, 4, range, shift),
    gradientOpacity: '8 0 0.08 2 0.38 8 0.88 32 1',
    shade: '1', ambient: String(settings.ambient), diffuse: String(settings.diffuse),
    specular: String(settings.specular), specularPower: String(settings.specularPower), interpolation: '1',
  };
}

export function VolumePreview({ series, sourceProgress, preset, threshold, opacity, settings, resetToken, onThresholdChange, onOpacityChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<NativeViewport | null>(null);
  const volumeIdRef = useRef('');
  const volumeRangeRef = useRef<[number, number]>([-1024, 2048]);
  const dragRef = useRef<Drag | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<LoadingProgress | null>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || !series) { setReady(false); setError(''); return; }
    let disposed = false;
    const controller = new AbortController();
    let resizeObserver: ResizeObserver | undefined;
    let viewer: Awaited<ReturnType<typeof getViewer>> | undefined;
    let volumeId = '';
    setReady(false); setError('');
    setProgress({label:'3D görüntü hazırlanır',done:0,total:0,phase:'Volume məlumatı hazırlanır'});

    (async () => {
      viewer = await getViewer();
      const { core, tools, engine } = viewer;
      if (disposed) return;
      if (engine.getViewport(viewportId)) engine.disableElement(viewportId);

      const gl = document.createElement('canvas').getContext('webgl2');
      const textureLimit = gl?.getParameter(gl.MAX_3D_TEXTURE_SIZE) || 256;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      const sample = await getVolumeTexture(series.imageIds, textureLimit >= 512 ? 448 : 320, textureLimit >= 512 ? 384 : 280,
        (done,total)=>{if(!disposed)setProgress({label:'3D görüntü hazırlanır',done,total:total+2,unit:'iş vahidi',phase:'Volume kəsitləri hazırlanır'});},controller.signal);
      if(disposed)return;
      if (!sample) throw new Error('Professional 3D üçün eyni ölçülü, düzgün məkan koordinatlı ən azı 3 DICOM kəsiti lazımdır');
      volumeRangeRef.current = sample.range;
      volumeId = `radaz-volume:${series.id}:${series.imageIds.length}`;
      volumeIdRef.current = volumeId;
      setProgress({label:'3D görüntü hazırlanır',done:sample.slices,total:sample.slices+2,unit:'iş vahidi',phase:'GPU teksturası hazırlanır'});
      await yieldToBrowser(); if(disposed)return;
      if (core.cache.getVolume(volumeId)) core.cache.removeVolumeLoadObject(volumeId);
      core.volumeLoader.createLocalVolume(volumeId, {
        metadata: {
          FrameOfReferenceUID: `RADAZ-${series.id}`, Modality: sample.modality,
          BitsAllocated: 8, BitsStored: 8, HighBit: 7, PixelRepresentation: 0,
          SamplesPerPixel: 1, PhotometricInterpretation: 'MONOCHROME2',
          Rows: sample.height, Columns: sample.width, ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
          PixelSpacing: [sample.size[1] / sample.height, sample.size[0] / sample.width],
          voiLut: [{ windowWidth: 255, windowCenter: 127.5 }], VOILUTFunction: 'LINEAR',
        },
        dimensions: [sample.width, sample.height, sample.slices],
        spacing: [sample.size[0] / sample.width, sample.size[1] / sample.height, sample.size[2] / sample.slices],
        origin: [0, 0, 0], direction: [1, 0, 0, 0, 1, 0, 0, 0, 1], scalarData: sample.data,
      });
      engine.enableElement({ viewportId, element, type: core.Enums.ViewportType.VOLUME_3D,
        defaultOptions: { background: [0, 0, 0] } });
      await core.setVolumesForViewports(engine, [{ volumeId }], [viewportId], true);
      if (disposed) return;
      setProgress({label:'3D görüntü hazırlanır',done:sample.slices+1,total:sample.slices+2,unit:'iş vahidi',phase:'İlk render gözlənilir'});
      const viewport = engine.getViewport(viewportId) as unknown as NativeViewport;
      viewportRef.current = viewport;
      viewport.setSampleDistanceMultiplier?.(settings.quality);
      viewport.setPreset(professionalPreset(core, preset, threshold, opacity, sample.range, settings), volumeId, true);
      const property = viewport.getDefaultActor?.()?.actor?.getProperty?.();
      property?.setShade?.(0, true);
      property?.setAmbient?.(0, settings.ambient);
      property?.setDiffuse?.(0, settings.diffuse);
      property?.setSpecular?.(0, settings.specular);
      property?.setSpecularPower?.(0, settings.specularPower);
      viewport.resetCamera({ resetPan: true, resetZoom: true });
      await new Promise<void>((resolve,reject)=>{
        const rendered=()=>{cleanup();resolve();};
        const cancelled=()=>{cleanup();reject(controller.signal.reason);};
        const cleanup=()=>{element.removeEventListener(core.Enums.Events.IMAGE_RENDERED,rendered);controller.signal.removeEventListener('abort',cancelled);};
        element.addEventListener(core.Enums.Events.IMAGE_RENDERED,rendered,{once:true});
        controller.signal.addEventListener('abort',cancelled,{once:true});
        viewport.render();
      });
      if(disposed)return;

      tools.ToolGroupManager.destroyToolGroup(toolGroupId);
      const group = tools.ToolGroupManager.createToolGroup(toolGroupId);
      group?.addTool(tools.TrackballRotateTool.toolName);
      group?.addTool(tools.PanTool.toolName);
      group?.setToolActive(tools.TrackballRotateTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Primary }] });
      group?.setToolActive(tools.PanTool.toolName, { bindings: [{ mouseButton: tools.Enums.MouseBindings.Auxiliary }] });
      group?.addViewport(viewportId, engine.id);
      resizeObserver = new ResizeObserver(() => { engine.resize(true, true); viewport.render(); });
      resizeObserver.observe(element);
      setReady(true); setProgress(null);
    })().catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : String(cause)); });

    return () => {
      disposed = true; controller.abort(); resizeObserver?.disconnect(); viewportRef.current = null; volumeIdRef.current = ''; dragRef.current = null; setReady(false); setProgress(null);
      if (viewer) {
        viewer.tools.ToolGroupManager.destroyToolGroup(toolGroupId);
        if (viewer.engine.getViewport(viewportId)) viewer.engine.disableElement(viewportId);
        if (volumeId && viewer.core.cache.getVolume(volumeId)) viewer.core.cache.removeVolumeLoadObject(volumeId);
      }
    };
  }, [series?.id]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !ready) return;
    void getViewer().then(({ core }) => {
      viewport.setSampleDistanceMultiplier?.(settings.quality);
      viewport.setPreset(professionalPreset(core, preset, threshold, opacity, volumeRangeRef.current, settings), volumeIdRef.current, true);
      const property = viewport.getDefaultActor?.()?.actor?.getProperty?.();
      property?.setShade?.(0, true);
      property?.setAmbient?.(0, settings.ambient);
      property?.setDiffuse?.(0, settings.diffuse);
      property?.setSpecular?.(0, settings.specular);
      property?.setSpecularPower?.(0, settings.specularPower);
      viewport.render();
    }).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [preset, threshold, opacity, settings, ready]);

  useEffect(() => {
    if (!viewportRef.current || !ready) return;
    viewportRef.current.resetCamera({ resetPan: true, resetZoom: true });
    viewportRef.current.render();
  }, [resetToken, ready]);

  const finishAdjust = () => { dragRef.current = null; };

  return <section className="volume-workspace" aria-label="3D həcm görünüşü">
    <div className="volume-stage cornerstone-volume-stage" data-ready={ready}
      onContextMenu={event => event.preventDefault()}
      onDoubleClick={() => { viewportRef.current?.resetCamera({ resetPan: true, resetZoom: true }); viewportRef.current?.render(); }}
      onPointerDownCapture={event => {
        if (event.button !== 2) return;
        event.preventDefault(); event.stopPropagation();
        dragRef.current = { x: event.clientX, y: event.clientY, threshold, opacity };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMoveCapture={event => {
        const drag = dragRef.current;
        if (!drag) return;
        event.preventDefault(); event.stopPropagation();
        onThresholdChange(Math.round(clamp(drag.threshold + (event.clientX - drag.x) * 4, -1000, 1400) / 10) * 10);
        onOpacityChange(Math.round(clamp(drag.opacity - (event.clientY - drag.y) * .012, .2, 2) * 10) / 10);
      }}
      onPointerUpCapture={finishAdjust} onPointerCancelCapture={finishAdjust}
      onWheel={event => {
        event.preventDefault();
        const viewport = viewportRef.current, camera = viewport?.getCamera();
        if (!viewport || !camera?.parallelScale) return;
        viewport.setCamera({ parallelScale: camera.parallelScale * (event.deltaY > 0 ? 1.1 : .9) }); viewport.render();
      }}>
      {series && <div key={series.id} ref={hostRef} className="cornerstone-volume-host" aria-label="İşıqlandırılmış professional 3D DICOM renderi"/>}
      {ready && !error && <div className="volume-help"><span><b>Sol mouse</b> fırlat</span><span><b>Sağ mouse</b> HU / şəffaflıq</span><span><b>Orta mouse</b> sürüşdür</span><span><b>Təkər</b> zoom</span><span><b>İki klik</b> sıfırla</span></div>}
      {(!ready || error) && <div className="volume-cover"><Box size={34}/>{error ? <><strong>3D həcm açıla bilmədi</strong><span>{error}</span></> : progress || sourceProgress ? <WorkProgress progress={progress || {...sourceProgress!,label:'3D görüntü hazırlanır'}}/> : <strong>3D üçün ardıcıl DICOM seriyası seçin</strong>}</div>}
    </div>
  </section>;
}
