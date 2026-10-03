'use client';
import { useEffect } from 'react';

/** F11 is a viewport action. Never turn it into browser-wide fullscreen. */
export function ViewerFullscreen() {
  useEffect(() => {
    let point: { x: number; y: number } | null = null;
    const move = (e: PointerEvent) => { point = { x: e.clientX, y: e.clientY }; };
    const leave = () => { point = null; };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'F11') return;
      e.preventDefault(); // Block the browser's global F11 even outside a viewport.
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || !point || document.querySelector('[role="dialog"],dialog[open]')) return;
      const focused = document.activeElement;
      if (focused?.matches('input,textarea,select,[contenteditable="true"]')) return;
      const target = document.elementFromPoint(point.x, point.y);
      if (!target || target.closest('button,input,textarea,select,[role="dialog"],.overlay,.pane-badge,.volume-help')) return;
      const viewport = target.closest<HTMLElement>('.viewport[data-has-image="true"],.cornerstone-volume-stage[data-ready="true"]');
      if (!viewport || !target.closest('canvas,.dicom-canvas,.cornerstone-volume-host,.viewer-interaction-overlay,svg')) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void viewport.requestFullscreen().catch(() => {});
    };
    const contextMenu=(event:MouseEvent)=>event.preventDefault();
    document.addEventListener('contextmenu',contextMenu);
    document.addEventListener('pointermove', move); document.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('contextmenu',contextMenu); document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); window.removeEventListener('blur', leave); window.removeEventListener('keydown', key, true); };
  }, []);
  return null;
}
