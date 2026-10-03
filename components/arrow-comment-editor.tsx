'use client';
import {useState} from 'react';
import type {LocalMark} from './measurement-overlay';
export function ArrowCommentEditor({mark,onSave,onClose}:{mark:LocalMark;onSave:(text:string)=>void;onClose:()=>void}){
 const [text,setText]=useState(mark.comment||'');
 return <form className="arrow-comment-editor" role="dialog" aria-label="Ox üçün şərh" onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}
  onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}} onSubmit={e=>{e.preventDefault();onSave(text.trim());onClose();}}>
  <label htmlFor={`comment-${mark.id}`}>Ox üçün şərh</label>
  <textarea id={`comment-${mark.id}`} autoFocus maxLength={500} rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Şərh yazın…"/>
  <div><button type="submit">Saxla</button><button type="button" onClick={onClose}>Ləğv et</button></div>
 </form>;
}
