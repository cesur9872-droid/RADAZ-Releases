'use client';

import { useEffect, useState } from 'react';
import { RotateCw, RotateCcw, FlipHorizontal2, FlipVertical2, Undo2, Contrast, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { getViewer, getDefaultWindow } from '@/lib/cornerstone';
import type { Types } from '@cornerstonejs/core';

export function ViewerDisplayControls({ panel, imageId, onStatus }: { panel: string; imageId?: string; onStatus: (text: string) => void }) {
  const [custom, setCustom] = useState(false);
  const [level, setLevel] = useState('50'), [width, setWidth] = useState('400');
  const [negative, setNegative] = useState(false);
  const action = async (kind: string, wl?: number, ww?: number) => {
    try {
      const { engine, core } = await getViewer();
      const vp = engine.getViewport(`panel-${panel}`) as Types.IStackViewport | undefined;
      if (!vp?.getCurrentImageId()) throw new Error('Əvvəlcə görüntü açın');
      const camera = vp.getCamera();
      if (kind === 'left' || kind === 'right' || kind === 'half') vp.setViewPresentation({ ...vp.getViewPresentation(), rotation: (vp.getRotation() + (kind === 'left' ? 270 : kind === 'right' ? 90 : 180)) % 360 });
      if (kind === 'horizontal') vp.setCamera({ flipHorizontal: !camera.flipHorizontal });
      if (kind === 'vertical') vp.setCamera({ flipVertical: !camera.flipVertical });
      if (kind === 'reset') { vp.setCamera({ flipHorizontal: false, flipVertical: false }); vp.resetCamera(); vp.setViewPresentation({ ...vp.getViewPresentation(), rotation: 0 }); }
      if (kind === 'negative') {
        const original = await core.imageLoader.loadAndCacheImage(vp.getCurrentImageId()!);
        const invert = !vp.getProperties().invert; vp.setProperties({ invert }); setNegative(invert !== !!original.invert);
      }
      if (kind === 'default') ({ wl, ww } = getDefaultWindow(vp.getCurrentImageId()!));
      if (kind === 'full') {
        const image = await core.imageLoader.loadAndCacheImage(vp.getCurrentImageId()!);
        wl = (image.minPixelValue + image.maxPixelValue) / 2; ww = Math.max(1, image.maxPixelValue - image.minPixelValue);
      }
      if (kind === 'custom') {
        const range = vp.getProperties().voiRange;
        if (range) { setLevel(String((range.lower + range.upper) / 2)); setWidth(String(range.upper - range.lower)); }
        setCustom(true); return;
      }
      if (wl !== undefined && ww !== undefined) {
        if (!Number.isFinite(wl) || !Number.isFinite(ww) || ww <= 0) throw new Error('WL ədəd, WW isə sıfırdan böyük olmalıdır');
        vp.setProperties({ voiRange: { lower: wl - ww / 2, upper: wl + ww / 2 } });
      }
      vp.render();
    } catch (error) { onStatus(String(error instanceof Error ? error.message : error)); }
  };
  useEffect(() => {
    let disposed = false;
    void getViewer().then(async ({ engine, core }) => {
      const vp = engine.getViewport(`panel-${panel}`) as Types.IStackViewport | undefined;
      if (!vp?.getCurrentImageId()) return;
      const original = await core.imageLoader.loadAndCacheImage(vp.getCurrentImageId()!);
      if (!disposed) setNegative(!!vp.getProperties().invert !== !!original.invert);
    }).catch(() => {});
    return () => { disposed = true; };
  }, [panel, imageId]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement).tagName) || (event.target as HTMLElement).isContentEditable || document.querySelector('[role="dialog"]')) return;
      let kind = '';
      if (event.ctrlKey && event.code === 'BracketLeft') kind = event.shiftKey ? 'horizontal' : 'left';
      if (event.ctrlKey && event.code === 'BracketRight') kind = event.shiftKey ? 'vertical' : 'right';
      if (event.ctrlKey && event.shiftKey && event.code === 'Backslash') kind = 'reset';
      if (kind) { event.preventDefault(); void action(kind); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="header-control" aria-label="Fırlat və çevir"><RotateCw size={18}/><span>Fırlat</span><ChevronDown size={13}/></Button></DropdownMenuTrigger><DropdownMenuContent className="header-menu" align="end">
      <DropdownMenuItem onSelect={() => void action('left')}><RotateCcw size={17}/>90° sola fırlat <kbd>Ctrl+[</kbd></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void action('right')}><RotateCw size={17}/>90° sağa fırlat <kbd>Ctrl+]</kbd></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void action('half')}><RotateCw size={17}/>180° fırlat</DropdownMenuItem><div className="menu-separator"/>
      <DropdownMenuItem onSelect={() => void action('horizontal')}><FlipHorizontal2 size={17}/>Üfüqi çevir <kbd>Ctrl+Shift+[</kbd></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void action('vertical')}><FlipVertical2 size={17}/>Şaquli çevir <kbd>Ctrl+Shift+]</kbd></DropdownMenuItem><div className="menu-separator"/>
      <DropdownMenuItem onSelect={() => void action('reset')}><Undo2 size={17}/>Çevirmələri sıfırla <kbd>Ctrl+Shift+\</kbd></DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="header-control" aria-label="Pozitiv, neqativ və window"><Contrast size={18}/><span>Pozitiv / neqativ</span><ChevronDown size={13}/></Button></DropdownMenuTrigger><DropdownMenuContent className="header-menu" align="end">
      <DropdownMenuItem onSelect={() => void action('default')}>DICOM standart pəncərə</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void action('full')}>Tam dinamik diapazon</DropdownMenuItem><div className="menu-separator"/>
      {[20,40,80,160,320,640,1280,2560].map(wl => <DropdownMenuItem key={wl} onSelect={() => void action('window', wl, wl * 2)}>WL {wl} / WW {wl * 2}</DropdownMenuItem>)}<div className="menu-separator"/>
      <DropdownMenuItem onSelect={() => void action('negative')}>{negative ? '✓ ' : ''}Neqativ / pozitiv</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void action('custom')}>Xüsusi pəncərə</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>
    <Dialog open={custom} onOpenChange={setCustom}><DialogContent className="output-dialog"><DialogHeader><DialogTitle>Xüsusi window</DialogTitle><DialogDescription>Aktiv görüntü üçün parlaqlıq və kontrast.</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); if (Number(width) > 0 && level.trim()) { void action('window', Number(level), Number(width)); setCustom(false); } }}><div className="output-fields"><label>Window level (WL)<input required type="number" step="any" value={level} onChange={e => setLevel(e.target.value)}/></label><label>Window width (WW)<input required type="number" min="0.001" step="any" value={width} onChange={e => setWidth(e.target.value)}/></label></div><button className="output-primary" type="submit">Tətbiq et</button></form>
    </DialogContent></Dialog>
  </>;
}
