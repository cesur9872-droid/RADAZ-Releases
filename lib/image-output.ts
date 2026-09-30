import { getViewer, getDefaultWindow } from './cornerstone';
import type { Types } from '@cornerstonejs/core';

export type DisplayState = { rotation: number; flipHorizontal: boolean; flipVertical: boolean; negative: boolean; voiRange?: { lower: number; upper: number } };
export async function readDisplayState(panel: string): Promise<DisplayState> {
  const { engine, core } = await getViewer();
  const vp = engine.getViewport(`panel-${panel}`) as Types.IStackViewport | undefined;
  if (!vp?.getCurrentImageId()) throw new Error('Əvvəlcə görüntü açın');
  const image = await core.imageLoader.loadAndCacheImage(vp.getCurrentImageId()!);
  const camera = vp.getCamera(), properties = vp.getProperties();
  return { rotation: vp.getRotation(), flipHorizontal: !!camera.flipHorizontal, flipVertical: !!camera.flipVertical,
    negative: !!properties.invert !== !!image.invert, voiRange: properties.voiRange };
}

/** An isolated viewport leaves the user's stack, camera and annotations untouched. */
export async function renderFullImage(imageId: string, state: DisplayState, maxSide = 4096, useWindow = true) {
  const { core } = await getViewer();
  const image = await core.imageLoader.loadAndCacheImage(imageId);
  const turned = Math.abs(Math.round(state.rotation / 90)) % 2 === 1;
  let width = turned ? image.rows : image.columns, height = turned ? image.columns : image.rows;
  if (!maxSide && (width > 16384 || height > 16384 || width * height > 64000000)) throw new Error('Orijinal görüntü çox böyükdür. “Ölçüyə sığdır” seçimini istifadə edin.');
  const scale = maxSide ? Math.min(1, maxSide / Math.max(width, height)) : 1; width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale));
  const element = document.createElement('div');
  // Account for devicePixelRatio so the backing canvas has the requested dimensions.
  const ratio = window.devicePixelRatio || 1;
  Object.assign(element.style, { position: 'fixed', left: '-100000px', top: '0', width: `${width / ratio}px`, height: `${height / ratio}px`, pointerEvents: 'none' });
  document.body.appendChild(element);
  const engine = new core.RenderingEngine(`output-${Date.now()}-${Math.random()}`);
  try {
    engine.enableElement({ viewportId: 'output', element, type: core.Enums.ViewportType.STACK });
    const vp = engine.getViewport('output') as Types.IStackViewport;
    await vp.setStack([imageId]);
    const { wl, ww } = getDefaultWindow(imageId);
    vp.setProperties({ voiRange: useWindow && state.voiRange ? state.voiRange : { lower: wl - ww / 2, upper: wl + ww / 2 }, invert: !!image.invert !== state.negative });
    vp.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
    vp.setCamera({ flipHorizontal: state.flipHorizontal, flipVertical: state.flipVertical });
    vp.setViewPresentation({ ...vp.getViewPresentation(), rotation: state.rotation });
    // resetCamera restores the original orientation, so rotate afterwards and
    // recompute the fit for quarter turns of non-square images.
    const physicalW = image.columns * (image.columnPixelSpacing || 1), physicalH = image.rows * (image.rowPixelSpacing || 1);
    const before = Math.min(width / physicalW, height / physicalH);
    const after = Math.min(width / (turned ? physicalH : physicalW), height / (turned ? physicalW : physicalH));
    vp.setZoom(after / before);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { element.removeEventListener(core.Enums.Events.IMAGE_RENDERED, done); reject(new Error('İxrac görüntüsü render olunmadı')); }, 15000);
      const done = () => { clearTimeout(timer); element.removeEventListener(core.Enums.Events.IMAGE_RENDERED, done); resolve(); };
      element.addEventListener(core.Enums.Events.IMAGE_RENDERED, done); vp.render();
    });
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(vp.getCanvas(), 0, 0, width, height);
    return canvas;
  } finally { engine.destroy(); element.remove(); }
}

export function canvasBlob(canvas: HTMLCanvasElement, format: 'png'|'jpeg'|'bmp', quality = .95): Promise<Blob> {
  if (format === 'bmp') return Promise.resolve(encodeBmp(canvas.width, canvas.height, canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data));
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Şəkil kodlaşdırılmadı')), `image/${format}`, quality));
}

/** 24-bit bottom-up Windows BMP, with DWORD-aligned scanlines. */
export function encodeBmp(width: number, height: number, rgba: Uint8ClampedArray): Blob {
  const stride = (width * 3 + 3) & ~3, size = 54 + stride * height;
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  bytes[0] = 0x42; bytes[1] = 0x4d; view.setUint32(2,size,true); view.setUint32(10,54,true);
  view.setUint32(14,40,true); view.setInt32(18,width,true); view.setInt32(22,height,true); view.setUint16(26,1,true); view.setUint16(28,24,true); view.setUint32(34,stride * height,true);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4, target = 54 + (height - 1 - y) * stride + x * 3;
    bytes[target] = rgba[source + 2]; bytes[target + 1] = rgba[source + 1]; bytes[target + 2] = rgba[source];
  }
  return new Blob([bytes], { type: 'image/bmp' });
}

export function resizeCanvas(source: HTMLCanvasElement, maxSide: number) {
  if (!maxSide || Math.max(source.width, source.height) <= maxSide) return source;
  const scale = maxSide / Math.max(source.width, source.height), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(source,0,0,canvas.width,canvas.height); return canvas;
}

/** Keep proportions and center the complete image in the requested output size. */
export function fitCanvas(source: HTMLCanvasElement, width: number, height: number) {
  if (![width, height].every(value => Number.isInteger(value) && value >= 16 && value <= 8192) || width * height > 32000000) throw new Error('Ölçülər 16–8192 px, sahə isə ən çox 32 milyon piksel olmalıdır.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!, scale = Math.min(width / source.width, height / source.height);
  const w = source.width * scale, h = source.height * scale;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
  return canvas;
}
