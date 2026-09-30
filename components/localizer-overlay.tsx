'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type * as Core from '@cornerstonejs/core';
import { getLocalizerGeometry } from '@/lib/cornerstone';
import { localizerSegment, type Point3 } from '@/lib/localizer';

type Props = {
  element: HTMLDivElement | null;
  viewport: Core.Types.IStackViewport | null;
  imageId: string;
  otherImages: { panel: string; imageId: string }[];
  enabled: boolean;
  onMoveSource: (panel: string, world: Point3) => void;
  targetPanel?: string;
  onRotateSource?: (sourcePanel: string, targetPanel: string, angleRadians: number) => void;
  onRotateStart?: (sourcePanel: string, targetPanel: string) => void;
  onPreviewRotateSource?: (sourcePanel: string, targetPanel: string, angleRadians: number) => void;
};

export function LocalizerOverlay({ element, viewport, imageId, otherImages, enabled, onMoveSource, targetPanel, onRotateSource, onRotateStart, onPreviewRotateSource }: Props) {
  const [, setRevision] = useState(0);
  const [rotation, setRotation] = useState<{ panel: string; origin: [number, number]; start: number; delta: number } | null>(null);
  const rotationRef = useRef<typeof rotation>(null);
  useEffect(() => {
    if (!element || !viewport) return;
    const repaint = () => setRevision(value => value + 1);
    const observer = new ResizeObserver(repaint);
    observer.observe(element);
    element.addEventListener('CORNERSTONE_CAMERA_MODIFIED', repaint);
    return () => { observer.disconnect(); element.removeEventListener('CORNERSTONE_CAMERA_MODIFIED', repaint); };
  }, [element, viewport]);

  if (!enabled || !viewport || !imageId || !element) return null;
  const target = getLocalizerGeometry(imageId);
  if (!target) return null;
  const lines = otherImages.flatMap(({ panel, imageId: sourceId }) => {
    const source = getLocalizerGeometry(sourceId);
    const segment = source && localizerSegment(target, source);
    if (!segment) return [];
    const a = viewport.worldToCanvas(segment[0]) as [number, number];
    const b = viewport.worldToCanvas(segment[1]) as [number, number];
    if (![...a, ...b].every(Number.isFinite)) return [];
    return [{ panel, a, b }];
  });
  if (!lines.length) return null;
  const intersection = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]): [number, number] | null => {
    const dx = b[0]-a[0], dy = b[1]-a[1], ex = d[0]-c[0], ey = d[1]-c[1];
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-5) return null;
    const t = ((c[0]-a[0])*ey - (c[1]-a[1])*ex) / denominator;
    return [a[0]+t*dx, a[1]+t*dy];
  };
  const pivot = lines.length > 1 ? intersection(lines[0].a, lines[0].b, lines[1].a, lines[1].b) : null;
  const pointerAngle = (event: ReactPointerEvent<SVGCircleElement>, origin: [number, number]) => {
    const rect = element.getBoundingClientRect();
    return Math.atan2(event.clientY - rect.top - origin[1], event.clientX - rect.left - origin[0]);
  };
  const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const move = (event: ReactPointerEvent<SVGGElement>, panel: string) => {
    if (!element || !viewport) return;
    event.preventDefault(); event.stopPropagation();
    const rect = element.getBoundingClientRect();
    const world = viewport.canvasToWorld([event.clientX - rect.left, event.clientY - rect.top]) as Point3;
    onMoveSource(panel, world);
  };
  return <svg className="localizer-overlay" aria-label="Lokayzer xətləri">
    {lines.map(({ panel, a, b }) => {
      const origin: [number, number] = pivot || [(a[0]+b[0])/2, (a[1]+b[1])/2];
      const endpoint = Math.hypot(a[0]-origin[0], a[1]-origin[1]) > Math.hypot(b[0]-origin[0], b[1]-origin[1]) ? a : b;
      const handle: [number, number] = [origin[0] + (endpoint[0]-origin[0])*.57, origin[1] + (endpoint[1]-origin[1])*.57];
      return <g key={panel} data-source={panel} className="localizer-line" onClick={event => event.stopPropagation()}
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); move(event, panel); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event, panel); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      transform={!onPreviewRotateSource && rotation?.panel === panel ? `rotate(${rotation.delta*180/Math.PI} ${origin[0]} ${origin[1]})` : undefined}>
      <line className="localizer-glow" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>
      <line className="localizer-stroke" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>
      <line className="localizer-hit" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>
      {onRotateSource && targetPanel && <>
        <circle className="localizer-rotate-dot" cx={handle[0]} cy={handle[1]} r={3.5}/>
        <circle className="localizer-rotate-hit" cx={handle[0]} cy={handle[1]} r={15} role="button" tabIndex={0}
          aria-label={`${panel} rekonstruksiya müstəvisini fırlat`} onClick={event => event.stopPropagation()}
          onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onRotateSource(panel, targetPanel, (event.key === 'ArrowRight' ? 1 : -1) * Math.PI / 36); } }}
          onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
            const start = { panel, origin, start: pointerAngle(event, origin), delta: 0 };
            rotationRef.current=start; setRotation(start); onRotateStart?.(panel, targetPanel); }}
          onPointerMove={event => { const active = rotationRef.current;
            if (event.currentTarget.hasPointerCapture(event.pointerId) && active?.panel === panel) {
              const delta = wrapAngle(pointerAngle(event, active.origin) - active.start);
              rotationRef.current={ ...active, delta }; setRotation(rotationRef.current);
              onPreviewRotateSource?.(panel, targetPanel, delta);
            } }}
          onPointerUp={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; event.preventDefault(); event.stopPropagation();
            event.currentTarget.releasePointerCapture(event.pointerId);
            const active = rotationRef.current;
            const angle = active?.panel === panel ? wrapAngle(pointerAngle(event, active.origin) - active.start) : 0;
            rotationRef.current=null; setRotation(null); onRotateSource(panel, targetPanel, angle); }}
          onPointerCancel={() => { rotationRef.current=null; setRotation(null); }}/>
      </>}
      <text x={origin[0] + 7} y={origin[1] - 7}>{panel}</text>
    </g>})}
  </svg>;
}
