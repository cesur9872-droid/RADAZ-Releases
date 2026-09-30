'use client';

import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { reportFonts, reportHtmlText, reportSizes, sanitizeReportHtml } from '@/lib/report-rich';

type Props = { html: string; onChange: (html: string, plain: string) => void };

export function ReportRichEditor({ html, onChange }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [font, setFont] = useState('Arial');
  const [size, setSize] = useState(12);

  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== html) editor.current.innerHTML = sanitizeReportHtml(html);
  }, [html]);

  useEffect(() => {
    const remember = () => {
      const current = window.getSelection();
      if (current?.rangeCount && editor.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
  }, []);

  const emit = () => {
    const markup = editor.current?.innerHTML || '';
    onChange(markup, reportHtmlText(markup));
  };

  const apply = (command: string, value?: string) => {
    const root = editor.current;
    if (!root) return;
    root.focus();
    const current = window.getSelection();
    if (selection.current && root.contains(selection.current.commonAncestorContainer)) {
      current?.removeAllRanges(); current?.addRange(selection.current);
    }
    document.execCommand(command, false, command === 'fontSize' ? '7' : value);
    if (command === 'fontSize') root.querySelectorAll('font[size="7"]').forEach(item => {
      const fontElement = item as HTMLElement;
      fontElement.style.fontSize = `${value}pt`;
      fontElement.removeAttribute('size');
    });
    emit();
    root.focus();
  };

  return <div className="rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="Hesabat mətni formatı">
      <select aria-label="Şrift" value={font} onChange={event => { setFont(event.target.value); apply('fontName', event.target.value); }}>
        {reportFonts.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <select aria-label="Şrift ölçüsü" value={size} onChange={event => { const next = Number(event.target.value); setSize(next); apply('fontSize', String(next)); }}>
        {reportSizes.map(item => <option key={item} value={item}>{item} pt</option>)}
      </select>
      <span className="rich-divider"/>
      {([{ name: 'Qalın', command: 'bold', Icon: Bold }, { name: 'İtalik', command: 'italic', Icon: Italic },
        { name: 'Altıxətli', command: 'underline', Icon: Underline }] as const).map(({ name, command, Icon }) =>
        <button key={command} type="button" aria-label={name} title={name} onMouseDown={event => event.preventDefault()} onClick={() => apply(command)}><Icon size={16}/></button>)}
      <span className="rich-divider"/>
      <button type="button" aria-label="Sola düzlə" title="Sola düzlə" onMouseDown={event => event.preventDefault()} onClick={() => apply('justifyLeft')}><AlignLeft size={16}/></button>
      <button type="button" aria-label="Mərkəzə düzlə" title="Mərkəzə düzlə" onMouseDown={event => event.preventDefault()} onClick={() => apply('justifyCenter')}><AlignCenter size={16}/></button>
      <button type="button" aria-label="Sağa düzlə" title="Sağa düzlə" onMouseDown={event => event.preventDefault()} onClick={() => apply('justifyRight')}><AlignRight size={16}/></button>
      <span className="rich-divider"/>
      <button type="button" aria-label="Maddəli siyahı" title="Maddəli siyahı" onMouseDown={event => event.preventDefault()} onClick={() => apply('insertUnorderedList')}><List size={16}/></button>
      <button type="button" aria-label="Nömrəli siyahı" title="Nömrəli siyahı" onMouseDown={event => event.preventDefault()} onClick={() => apply('insertOrderedList')}><ListOrdered size={16}/></button>
    </div>
    <div ref={editor} className="rich-content" role="textbox" aria-label="Hesabat mətni" aria-multiline="true" contentEditable suppressContentEditableWarning
      data-placeholder="Müayinə tapıntılarını və nəticəni daxil edin…" onInput={emit}
      onPaste={event => {
        event.preventDefault();
        const formatted = event.clipboardData.getData('text/html');
        if (formatted) document.execCommand('insertHTML', false, sanitizeReportHtml(formatted));
        else document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
        emit();
      }}
      onDrop={event => event.preventDefault()}/>
  </div>;
}
