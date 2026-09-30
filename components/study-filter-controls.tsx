'use client';

import { CalendarRange, Check, ScanSearch } from 'lucide-react';

type Props = {
  from: string;
  to: string;
  modalities: string[];
  options: string[];
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onModalitiesChange: (value: string[]) => void;
};

const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export function StudyFilterControls({ from, to, modalities, options, onFromChange, onToChange, onModalitiesChange }: Props) {
  const chooseRange = (value: string) => {
    const today = new Date();
    if (value === 'all') { onFromChange(''); onToChange(''); return; }
    if (value === 'custom') return;
    const start = new Date(today);
    if (value === 'yesterday') start.setDate(today.getDate() - 1);
    if (value === 'week') start.setDate(today.getDate() - 6);
    if (value === 'month') start.setMonth(today.getMonth() - 1);
    if (value === 'year') start.setFullYear(today.getFullYear() - 1);
    onFromChange(iso(start));
    onToChange(value === 'yesterday' ? iso(start) : iso(today));
  };
  const allSelected = modalities.length === 0;
  const toggle = (modality: string) => onModalitiesChange(modalities.includes(modality)
    ? modalities.filter(item => item !== modality)
    : [...modalities, modality]);

  return <div className="study-filter-controls">
    <label className="date-preset"><CalendarRange size={15}/><select aria-label="Tarix üçün sürətli seçim" value="custom" onChange={event => chooseRange(event.currentTarget.value)}>
      <option value="custom">Tarix aralığı</option><option value="all">Bütün tarixlər</option><option value="today">Bu gün</option><option value="yesterday">Dünən</option><option value="week">Son həftə</option><option value="month">Son ay</option><option value="year">Son il</option>
    </select></label>
    <label className="compact-date"><span>Başlanğıc</span><input aria-label="Başlanğıc tarixi" type="date" value={from} max={to || undefined} onChange={event => onFromChange(event.currentTarget.value)}/></label>
    <label className="compact-date"><span>Son</span><input aria-label="Son tarix" type="date" value={to} min={from || undefined} onChange={event => onToChange(event.currentTarget.value)}/></label>
    <details className="modality-filter"><summary title="Müayinə növlərini seç"><ScanSearch size={15}/><span>{allSelected ? 'Bütün müayinələr' : modalities.join(', ')}</span></summary>
      <div className="modality-menu">
        <button type="button" className={allSelected ? 'selected' : ''} onClick={() => onModalitiesChange([])}><Check size={13}/> Bütün müayinələr</button>
        {options.map(modality => <label key={modality}><input type="checkbox" checked={modalities.includes(modality)} onChange={() => toggle(modality)}/><span>{modality}</span></label>)}
      </div>
    </details>
  </div>;
}
