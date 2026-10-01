'use client';

import { useEffect, useRef, useState } from 'react';

/** Selections only apply to visible rows. Changing a filter cannot delete hidden studies. */
export function useStudySelection(uids: string[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const key = uids.join('|');
  useEffect(() => { setSelected(current => current.filter(uid => key.split('|').includes(uid))); }, [key]);
  const checked = selected.filter(uid => uids.includes(uid));
  return {
    checked,
    clear: () => setSelected([]),
    toggle: (uid: string, on: boolean) => setSelected(current => on ? [...new Set([...current, uid])] : current.filter(value => value !== uid)),
    all: <SelectAll checked={!!uids.length && checked.length === uids.length} mixed={!!checked.length && checked.length !== uids.length} disabled={!uids.length} onChange={on => setSelected(on ? uids : [])}/>,
  };
}

function SelectAll({ checked, mixed, disabled, onChange }: { checked: boolean; mixed: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <input ref={ref} type="checkbox" aria-label="Hamısını seç" title="Görünən müayinələrin hamısını seç" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)}/>;
}
