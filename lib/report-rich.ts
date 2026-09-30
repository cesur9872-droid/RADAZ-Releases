const fonts = ['Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
export const reportFonts = fonts;
export const reportSizes = [9, 10, 11, 12, 14, 16, 18, 22, 26, 32];

export const escapeReportHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const plainReportHtml = (value: string) => value.split(/\r?\n/)
  .map(line => `<p>${escapeReportHtml(line) || '<br>'}</p>`).join('');

const allowed = new Set(['P', 'DIV', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'FONT', 'UL', 'OL', 'LI', 'BR']);
const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'IMG', 'LINK', 'META', 'FORM']);
const sizeMap: Record<string, number> = { '1': 9, '2': 10, '3': 12, '4': 14, '5': 18, '6': 22, '7': 32 };

function color(value: string): string | null {
  const input = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input.toLowerCase();
  const rgb = input.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb || rgb.slice(1).some(part => Number(part) > 255)) return null;
  return `#${rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

function safeStyle(source: HTMLElement, output: HTMLElement) {
  const alignment = source.style.textAlign || source.getAttribute('align') || '';
  if (['left', 'center', 'right', 'justify'].includes(alignment)) output.style.textAlign = alignment;
  const size = source.style.fontSize;
  const parsed = size.match(/^(\d{1,2})(px|pt)$/);
  if (parsed) {
    const points = parsed[2] === 'px' ? Math.round(Number(parsed[1]) * .75) : Number(parsed[1]);
    if (points >= 8 && points <= 36) output.style.fontSize = `${points}pt`;
  } else if (source.tagName === 'FONT' && sizeMap[source.getAttribute('size') || '']) {
    output.style.fontSize = `${sizeMap[source.getAttribute('size') || '']}pt`;
  }
  const family = source.style.fontFamily.replaceAll(/["']/g, '').trim() || source.getAttribute('face') || '';
  const font = fonts.find(item => item.toLowerCase() === family.toLowerCase());
  if (font) output.style.fontFamily = font;
  const safeColor = color(source.style.color || source.getAttribute('color') || '');
  if (safeColor) output.style.color = safeColor;
  if (source.style.fontWeight === 'bold' || Number(source.style.fontWeight) >= 600) output.style.fontWeight = 'bold';
  if (source.style.fontStyle === 'italic') output.style.fontStyle = 'italic';
  if (source.style.textDecorationLine.includes('underline')) output.style.textDecoration = 'underline';
}

/** Restrict saved/pasted markup before displaying or exporting medical reports. */
export function sanitizeReportHtml(html: string): string {
  const document = new DOMParser().parseFromString('<div></div>', 'text/html');
  const source = new DOMParser().parseFromString(html, 'text/html').body;
  const target = document.body.firstElementChild!;
  const visit = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (blocked.has(element.tagName)) return;
    if (!allowed.has(element.tagName)) { element.childNodes.forEach(child => visit(child, parent)); return; }
    const name = element.tagName === 'FONT' ? 'span' : element.tagName.toLowerCase();
    const clean = document.createElement(name);
    safeStyle(element, clean);
    parent.appendChild(clean);
    element.childNodes.forEach(child => visit(child, clean));
  };
  source.childNodes.forEach(node => visit(node, target));
  return target.innerHTML;
}

export function reportHtmlText(html: string): string {
  const container = new DOMParser().parseFromString(sanitizeReportHtml(html), 'text/html').body;
  const lines: string[] = [];
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    if (element.tagName === 'BR') return '\n';
    const inner = [...element.childNodes].map(walk).join('');
    if (['P', 'DIV', 'H2', 'H3', 'LI'].includes(element.tagName)) {
      lines.push(element.tagName === 'LI' ? `• ${inner.trim()}` : inner.trim());
      return '';
    }
    if (['UL', 'OL'].includes(element.tagName)) return inner;
    return inner;
  };
  const leftover = [...container.childNodes].map(walk).join('').trim();
  if (leftover) lines.push(leftover);
  return lines.join('\n').trim();
}

export function safeReportLogo(value: string | undefined): string {
  return value && value.length <= 1_600_000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
}
