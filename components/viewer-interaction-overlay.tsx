'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type * as Core from '@cornerstonejs/core';
import { getLocalizerGeometry } from '@/lib/cornerstone';
import { sameCoordinateSpace, type ImageGeometry, type Point3 } from '@/lib/localizer';
import type { LocalMark } from './measurement-overlay';

export type CursorPosition = { world: Point3; geometry: ImageGeometry };

/** Coalesce slider/drag input: never race two asynchronous stack loads. */
export function useStackNavigation(viewport: Core.Types.IStackViewport | null, imageId: string, onError: (message: string) => void) {
  const pending = useRef<{ viewport: Core.Types.IStackViewport; index: number } | null>(null);
  const loading = useRef(false);
  const desired = useRef<number | null>(null);
  useEffect(() => { if (!loading.current) desired.current = null; }, [imageId]);
  useEffect(() => { pending.current = null; desired.current = null; }, [viewport]);
  return (value: number, relative = false) => {
    if (!viewport) return;
    const count = viewport.getImageIds().length;
    if (!count) return;
    const next = relative ? (desired.current ?? viewport.getCurrentImageIdIndex()) + value : value;
    const index = ((Math.round(next) % count) + count) % count;
    desired.current = index; pending.current = { viewport, index };
    if (loading.current) return;
    loading.current = true;
    void (async () => {
      try {
        while (pending.current) {
          const target = pending.current; pending.current = null;
          await target.viewport.setImageIdIndex(target.index);
        }
      } catch (error) { pending.current = null; onError(`Görüntü dəyişdirilə bilmədi: ${String(error)}`); }
      finally { loading.current = false; desired.current = null; }
    })();
  };
}

export function ViewerInteractionOverlay({ viewport, element, imageId, tool, slice, count, marks, selectedMarkId, onSelectMark, cursor, onCursor, onAdd, onRemove, onSelect, onEditArrow, navigate }: {
  viewport: Core.Types.IStackViewport | null; element: HTMLDivElement | null; imageId: string;
  tool: string; slice: number; count: number; marks: LocalMark[]; cursor: CursorPosition | null;
  onCursor: (position: CursorPosition) => void; onAdd: (mark: LocalMark) => void;
  onEditArrow: (id:string)=>void;
  onRemove: (id: string) => void; onSelect: () => void; navigate: (index: number, relative?: boolean) => void;
  selectedMarkId?: string | null; onSelectMark?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Point3[]>([]);
  const [, repaint] = useState(0);
  const gesture = useRef<{ id: number; y: number; points: Point3[]; last: [number, number] } | null>(null);
  const active = ['scroll', 'arrow', 'pencil', 'cursor3d'].includes(tool);
  const geometry = imageId ? getLocalizerGeometry(imageId) : null;
  useEffect(() => { gesture.current = null; setDraft([]); }, [tool, viewport]);
  useEffect(() => { if (tool !== 'scroll' && tool !== 'cursor3d') { gesture.current = null; setDraft([]); } }, [tool, imageId]);
  useEffect(() => {
    if (!element) return;
    const update = () => repaint(n => n + 1);
    const clear=()=>{gesture.current=null;setDraft([]);};
    element.addEventListener('radaz-clear-measurements',clear);
    element.addEventListener('CORNERSTONE_IMAGE_RENDERED', update);
    return () => {element.removeEventListener('radaz-clear-measurements',clear);element.removeEventListener('CORNERSTONE_IMAGE_RENDERED', update);};
  }, [element]);
  const world = (event: PointerEvent<SVGSVGElement>) => {
    const rect = element!.getBoundingClientRect();
    return viewport!.canvasToWorld([event.clientX - rect.left, event.clientY - rect.top]) as Point3;
  };
  const updateGesture = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId || !viewport || !element) return;
    if (tool === 'scroll') {
      const steps = Math.trunc((event.clientY - current.y) / 14);
      if (steps) { navigate(steps, true); current.y += steps * 14; }
    } else if (tool === 'cursor3d') {
      if (geometry) onCursor({ world: world(event), geometry });
    } else {
      if (Math.hypot(event.clientX - current.last[0], event.clientY - current.last[1]) < 2) return;
      const point = world(event);
      current.points = tool === 'arrow' ? [current.points[0], point] : [...current.points, point];
      current.last = [event.clientX, event.clientY]; setDraft(current.points);
    }
  };
  const points = (values: Point3[]) => values.map(point => viewport!.worldToCanvas(point).join(',')).join(' ');
  const arrowHead = (values: Point3[]) => {
    const a = viewport!.worldToCanvas(values[0]), b = viewport!.worldToCanvas(values[values.length - 1]);
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return `${b[0] - 14 * Math.cos(angle - .45)},${b[1] - 14 * Math.sin(angle - .45)} ${b[0]},${b[1]} ${b[0] - 14 * Math.cos(angle + .45)},${b[1] - 14 * Math.sin(angle + .45)}`;
  };
  if (!viewport || !imageId) return null;
  const cursorPoint = cursor && geometry && sameCoordinateSpace(geometry, cursor.geometry) ? viewport.worldToCanvas(cursor.world) : null;
  return <>
    <svg className={`drawing-overlay ${active ? 'drawing-active' : ''} ${tool === 'scroll' ? 'scroll-active' : ''}`} aria-label="Barmaqla görüntü idarəsi"
      onWheel={event => { event.stopPropagation(); if (event.deltaY) navigate(Math.sign(event.deltaY), true); }}
      onDoubleClick={event => event.stopPropagation()}
      onPointerDown={event => {
        if (!active || event.button !== 0 || gesture.current || !element) return;
        event.preventDefault(); event.stopPropagation(); onSelect();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = world(event);
        gesture.current = { id: event.pointerId, y: event.clientY, points: [point], last: [event.clientX, event.clientY] };
        if (tool === 'cursor3d' && geometry) onCursor({ world: point, geometry });
        if (tool === 'arrow' || tool === 'pencil') setDraft([point]);
      }} onPointerMove={updateGesture} onPointerUp={event => {
        updateGesture(event);
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        if ((tool === 'arrow' || tool === 'pencil') && current.points.length > 1) {
          onAdd({ id: `draw-${`${Date.now()}-${Math.random().toString(36).slice(2)}`}`, imageId, kind: tool, points: current.points, labelOffset: [0, 0] });
        }
        gesture.current = null; setDraft([]);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={() => { gesture.current = null; setDraft([]); }} onLostPointerCapture={() => { gesture.current = null; setDraft([]); }}>
      {marks.filter(mark => mark.imageId === imageId && (mark.kind === 'arrow' || mark.kind === 'pencil')).map(mark => <g key={mark.id} data-drawing={mark.kind} data-mark-id={mark.id} className={selectedMarkId === mark.id ? 'selected-measurement' : undefined}
        onClick={event=>event.stopPropagation()} onDoubleClick={event=>{event.stopPropagation();if(mark.kind==='arrow')onEditArrow(mark.id);}}
        onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();if(tool==='erase')onRemove(mark.id);else onSelectMark?.(mark.id);}}>
        <polyline points={points(mark.points)} />
        {mark.kind === 'arrow' && <polyline points={arrowHead(mark.points)} />}
        <polyline className="drawing-hit" points={points(mark.points)} />
        {mark.kind==='arrow'&&mark.comment&&(()=>{
          const [x,y]=viewport.worldToCanvas(mark.points[0]);
          const lines=mark.comment.split('\n').flatMap(line=>line.match(/.{1,32}(?:\s|$)|.{1,32}/g)||['']);
          const width=Math.min(320,Math.max(80,...lines.map(line=>line.length*9))+16);
          return <g className="arrow-comment" transform={`translate(${x+12},${y+12})`}><rect width={width} height={lines.length*21+12} rx={4}/><text x={8} y={21}>{lines.map((line,i)=><tspan key={i} x={8} dy={i?21:0}>{line.trim()}</tspan>)}</text></g>;
        })()}
      </g>)}
      {draft.length > 1 && <g className="drawing-draft"><polyline points={points(draft)}/>{tool === 'arrow' && <polyline points={arrowHead(draft)}/>}</g>}
      {cursorPoint && <g className="world-cursor"><path d={`M ${cursorPoint[0]-18} ${cursorPoint[1]} h 36 M ${cursorPoint[0]} ${cursorPoint[1]-18} v 36`}/><circle cx={cursorPoint[0]} cy={cursorPoint[1]} r="6"/></g>}
    </svg>
    {count > 1 && <div className="vertical-stack-scroll" onPointerDown={event => { event.stopPropagation(); onSelect(); }} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <input type="range" min="0" max={count - 1} step="1" value={slice} aria-label="Görüntü nömrəsi" aria-orientation="vertical" aria-valuetext={`${slice + 1} / ${count}`} title={`${slice + 1} / ${count}`} onChange={event => navigate(Number(event.currentTarget.value))}/>
    </div>}
    {tool === 'cursor3d' && <div className="cursor-readout">{!geometry ? 'Bu görüntüdə 3D məkan koordinatları yoxdur' : cursorPoint && cursor ? `LPS (mm): ${cursor.world.map(n => n.toFixed(1)).join(' / ')}` : '3D nöqtəni seçin · uyğun panellər həmin nöqtəyə keçir'}</div>}
  </>;
}
