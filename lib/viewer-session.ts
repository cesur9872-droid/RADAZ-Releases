const CHANNEL = 'radaz-viewer-open-v1';
const LAST_VIEWER = 'radaz-last-viewer';
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const validStudy = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && /^[0-9]+(?:\.[0-9]+)*$/.test(v);
const validName = (v: unknown): v is string => typeof v === 'string' && /^RADAZ_VIEWER(?:_[a-f0-9]{32})?$/.test(v);

/** Called in the click handler, before PACS downloads consume browser activation. */
export function focusViewer(): Window | null {
  let name = 'RADAZ_VIEWER';
  try { const saved = localStorage.getItem(LAST_VIEWER); if (validName(saved)) name = saved; } catch { /* Storage can be disabled. */ }
  try {
    if (window.opener && !window.opener.closed && window.opener.location.origin === window.location.origin && validName(window.opener.name)) {
      // Retarget within the user gesture: browsers may ignore focus() alone.
      const viewer = window.open('', window.opener.name) || window.opener;
      viewer.focus(); return viewer;
    }
  } catch { /* Cross-origin opener. */ }
  const tab = window.open('', name);
  if (tab) {
    try { if (tab.location.href === 'about:blank') tab.location.replace('/'); } catch { /* Discovery handles the existing tab. */ }
    tab.focus();
  }
  return tab;
}

export function registerViewer(load: (study: string) => Promise<void>) {
  const id = randomId();
  if (!validName(window.name)) window.name = `RADAZ_VIEWER_${id}`;
  const tabName = window.name, channel = new BroadcastChannel(CHANNEL);
  let focused = document.hasFocus() ? Date.now() : 0;
  const remember = () => { try { localStorage.setItem(LAST_VIEWER, tabName); } catch { /* Optional hint. */ } };
  const focus = () => { focused = Date.now(); remember(); };
  remember(); window.addEventListener('focus', focus);
  const seen = new Set<string>();
  channel.onmessage = event => {
    const data = event.data;
    if (data?.kind === 'DISCOVER' && typeof data.request === 'string') { channel.postMessage({ kind: 'VIEWER', request: data.request, id, focused, tabName }); return; }
    if (data?.kind !== 'OPEN' || data.target !== id || typeof data.request !== 'string' || !validStudy(data.study)) return;
    channel.postMessage({ kind: 'ACK', request: data.request, id });
    if (seen.has(data.request)) return;
    seen.add(data.request); if (seen.size > 100) seen.delete(seen.values().next().value!);
    window.focus(); void load(data.study).catch(() => {});
  };
  return () => { channel.close(); window.removeEventListener('focus', focus); };
}

export async function openStudyInViewer(study: string, reserved?: Window | null): Promise<'existing' | 'new'> {
  if (!validStudy(study)) throw new Error('DICOM Study UID düzgün deyil');
  const tab = reserved === undefined ? focusViewer() : reserved;
  const url = `/#archive-study=${encodeURIComponent(study)}`;
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL), request = randomId();
    try {
      const candidates: { id: string; focused: number; tabName: string }[] = [];
      await new Promise<void>(resolve => {
        channel.onmessage = e => { const d = e.data; if (d?.kind === 'VIEWER' && d.request === request && typeof d.id === 'string' && validName(d.tabName)) candidates.push(d); };
        channel.postMessage({ kind: 'DISCOVER', request }); setTimeout(resolve, 400);
      });
      const target = candidates.find(item => item.tabName === tab?.name) || candidates.sort((a, b) => b.focused - a.focused)[0];
      if (target) {
        const accepted = await new Promise<boolean>(resolve => {
          const timer = setTimeout(() => resolve(false), 2000);
          channel.onmessage = e => { if (e.data?.kind === 'ACK' && e.data.request === request && e.data.id === target.id) { clearTimeout(timer); resolve(true); } };
          channel.postMessage({ kind: 'OPEN', target: target.id, request, study });
        });
        if (accepted) { tab?.focus(); return 'existing'; }
      }
    } finally { channel.close(); }
  }
  if (tab && !tab.closed) { tab.location.assign(url); tab.focus(); }
  else window.location.assign(url);
  return 'new';
}
