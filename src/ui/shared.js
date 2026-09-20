// Shared helpers. The categorical palette rule (docs/UI-BRIEF.md 3.3): three
// slots in a fixed order, lav, warm, amber; slot 4 and later are grey and the
// legend names them "other". Slots go to shapes by session count, largest
// first, keyed to the shape's largest community's centroid session id so a
// colour follows the entity when the graph is rebuilt. Hex literals, never
// var(): the 2D canvas cannot parse a CSS variable.
export const SLOT_HEX = ['#b7a6ff', '#e07a4a', '#e9b949'];
export const NODE_GREY = '#8A8A8E';
export const MINT = '#3ddc97', RED = '#f0616d', SKY = '#38bdf8', WHITE = '#ffffff';
export const MUTED = 'rgb(161,161,161)', SUBTLE = 'rgb(138,138,138)';

const slotByCentroid = new Map();
export function assignSlots(shapes) {
  const order = shapes.slice().sort((a, b) => b.size - a.size || a.id - b.id);
  const fresh = new Map();
  let next = 0;
  // keep a centroid's slot if it already had one, then hand out the rest in order
  for (const s of order) if (slotByCentroid.has(s.centroid)) fresh.set(s.centroid, slotByCentroid.get(s.centroid));
  const taken = new Set(fresh.values());
  for (const s of order) { if (fresh.has(s.centroid)) continue; while (taken.has(next)) next++; if (next < SLOT_HEX.length) { fresh.set(s.centroid, next); taken.add(next); next++; } }
  slotByCentroid.clear(); for (const [k, v] of fresh) slotByCentroid.set(k, v);
  return new Map(shapes.map(s => [s.id, slotByCentroid.has(s.centroid) ? slotByCentroid.get(s.centroid) : -1]));
}
export const slotHex = (slot) => (slot >= 0 && slot < SLOT_HEX.length) ? SLOT_HEX[slot] : NODE_GREY;

export const $ = (s) => document.querySelector(s);
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const score = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(/^0\./, '.');
export const MINUS = '−';

// the fired ladder: 1m ago minimum, then m, h, yesterday, d
export function ago(iso) {
  if (!iso) return '';
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

let HARNESS = { claude: 'Claude Code', devin: 'Devin CLI', codex: 'Codex', cursor: 'Cursor' };
export const setHarnessMap = (m) => { if (m) HARNESS = m; };
export const harnessName = (k) => HARNESS[k] || k || '';
// 14px glyphs, 1.25 stroke, currentColor, no fill (docs/UI-BRIEF.md 4.5)
const GLYPH = {
  claude: '<path d="M7 2.5 3.2 11.5M7 2.5l3.8 9M4.6 8.2h4.8"/>',
  devin: '<path d="M3 3h4.5a4 4 0 0 1 0 8H3z"/>',
  codex: '<circle cx="7" cy="7" r="4.4"/><path d="M7 4.2v5.6M4.2 7h5.6"/>',
  cursor: '<path d="M3.5 2.5 11 7.2 7.4 8.4 6 12z"/>',
};
export const glyph = (k, size = 14) => `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-label="${esc(harnessName(k))}" role="img"><title>${esc(harnessName(k))}</title>${GLYPH[k] || '<circle cx="7" cy="7" r="4.4"/><circle cx="7" cy="7" r="1" fill="currentColor"/>'}</svg>`;

const tipEl = () => $('#tip');
export function tip(ev, text) { const t = tipEl(); t.textContent = text; t.style.display = 'block'; t.style.left = (ev.clientX + 14) + 'px'; t.style.top = (ev.clientY + 14) + 'px'; }
export function hideTip() { tipEl().style.display = 'none'; }
export function card(ev, title, line) { const t = $('#hover'); t.innerHTML = `<div class="hc-title">${esc(title)}</div><div class="hc-line">${esc(line)}</div>`; t.style.display = 'block'; t.style.left = (ev.clientX + 14) + 'px'; t.style.top = (ev.clientY + 14) + 'px'; }
export function hideCard() { $('#hover').style.display = 'none'; }

export function shortPath(s) {
  return String(s || '').replace(/^cd\s+\S+\s*(&&|;)\s*/, '').replace(/\/.*?\/work\/[^/]+\//g, '').replace(/\/private\/tmp\/[^/]+\//g, '').replace(/\/tmp\/[^/]+\//g, '').replace(/\s+2>&1/g, '').slice(0, 100);
}
const CLS = { Bash: 'execute', exec: 'execute', shell: 'execute', Read: 'read', read: 'read', Grep: 'search', Glob: 'search', LS: 'search', grep: 'search', glob: 'search', Edit: 'write', Write: 'write', MultiEdit: 'write', edit: 'write', write: 'write', apply_patch: 'write' };
export const toolClass = (n) => CLS[n] || (/edit|write|patch/i.test(n) ? 'write' : /grep|find|glob|search|ls/i.test(n) ? 'search' : /read|view|cat/i.test(n) ? 'read' : /exec|bash|shell/i.test(n) ? 'execute' : 'other');
export const harnessOfTool = (n) => /^(exec|edit|read)$/.test(n) ? 'devin' : /^(Bash|Edit|Read|Grep|Glob|Write|MultiEdit)$/.test(n) ? 'claude' : /shell|apply_patch/.test(n) ? 'codex' : null;

const handlers = {};
export const bus = { on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); }, emit(ev, data) { for (const fn of handlers[ev] || []) fn(data); } };
