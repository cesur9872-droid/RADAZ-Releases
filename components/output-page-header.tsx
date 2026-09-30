import { RadazLogo } from './radaz-logo';
import { AppHelpMenu } from './app-product';
import type { ReactNode } from 'react';
import { Activity, ArrowLeft, Database, Disc3, Printer, Settings2 } from 'lucide-react';

export function OutputPageHeader({ kind, children }: { kind: 'print' | 'media' | 'settings'; children?: ReactNode }) {
  const Icon = kind === 'media' ? Disc3 : kind === 'settings' ? Settings2 : Printer;
  const title = kind === 'media' ? 'CD / DVD' : kind === 'settings' ? 'Printer ayarları' : 'Çap önbaxışı';
  return <header className={`output-page-header ${kind === 'print' ? 'print-header' : ''}`}>
    <div className="output-page-brand"><RadazLogo size={34}/><span><strong>RADAZ</strong><small>RADIOLOGY WORKSPACE</small></span></div>
    <div className="output-page-title"><Icon size={20}/><div><h1>{title}</h1>{children && <p>{children}</p>}</div></div>
    <nav className="toolbar-group output-page-nav" aria-label="İş sahələri"><a href="/"><ArrowLeft size={16}/><span>Viewer</span></a><a href="/archive"><Database size={16}/><span>Local arxiv</span></a>{kind !== 'settings' && <a href="/printer-settings" target="_blank" rel="noreferrer"><Settings2 size={16}/><span>Printer ayarları</span></a>}<AppHelpMenu/></nav>
  </header>;
}
