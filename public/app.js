/* =============================================================================
   Shukrullo's personal zettelkasten
   Vanilla JS single-page app. No build step. Sections in this file:
     1. utilities            5. work: overview / 1-1s
     2. storage + sync       6. reports (CSV engines)
     3. login + boot         7. university
     4. shell + router       8. notes vault, finances, calendar, settings
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------- 1. utils */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = (v) => esc(v);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };

const DAY = 86400000;
const todayISO = () => toISO(new Date());
/** local timestamp — toISOString() is UTC and would file late-evening edits under yesterday */
const nowStamp = () => {
  const d = new Date();
  return `${toISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
function toISO(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function fromISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const daysUntil = (iso) => { const d = fromISO(iso); return d == null ? null : daysBetween(new Date(), d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(iso, opts) {
  const d = fromISO(iso);
  if (!d) return '';
  return d.toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDay(iso) {
  const d = fromISO(iso);
  if (!d) return '';
  const diff = daysBetween(new Date(), d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
function relDays(iso) {
  const n = daysUntil(iso);
  if (n == null) return '';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 0) return `${-n}d overdue`;
  return `in ${n}d`;
}
function dueClass(iso) {
  const n = daysUntil(iso);
  if (n == null) return '';
  if (n < 0) return 'bad';
  if (n <= 2) return 'warn';
  return '';
}

/* ISO week helpers — the exam engine buckets everything into ISO weeks. */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function isoWeekStart(label) {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(label || ''));
  if (!m) return null;
  const simple = new Date(Date.UTC(+m[1], 0, 1 + (+m[2] - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() - dow + 1);
  return new Date(simple.getUTCFullYear(), simple.getUTCMonth(), simple.getUTCDate());
}
const weekKeyNow = () => isoWeek(new Date());

/* stats */
const sum = (a) => a.reduce((s, v) => s + v, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const round = (v, p = 1) => (v == null ? null : Math.round(v * 10 ** p) / 10 ** p);
const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const normName = (s) => norm(s).replace(/[^a-zЀ-ӿ0-9 ]/g, '').split(' ').filter(Boolean).sort().join(' ');
const titleCase = (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase());

function money(v, cur) {
  const c = cur || (DB.settings && DB.settings.currency) || 'UZS';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(v || 0);
  } catch { return `${Math.round(v || 0).toLocaleString()} ${c}`; }
}

function deltaHTML(now, prev, opts = {}) {
  if (prev == null || now == null || !Number.isFinite(prev) || !Number.isFinite(now)) return '';
  const d = round(now - prev, opts.p == null ? 1 : opts.p);
  if (!d) return `<div class="delta flat">— vs prev</div>`;
  const good = opts.lowerIsBetter ? d < 0 : d > 0;
  return `<div class="delta ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${opts.unit || ''} vs prev</div>`;
}

function statBox(value, label, extra = '') {
  return `<div class="stat"><div class="stat-v">${esc(value)}</div><div class="stat-l">${esc(label)}</div>${extra}</div>`;
}
function emptyState(title, hint) {
  return `<div class="empty"><strong>${esc(title)}</strong>${esc(hint)}</div>`;
}
function panel(title, bodyHTML, opts = {}) {
  return `<section class="panel">
    <header><div><h3>${esc(title)}</h3>${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ''}</div>
    <div class="wrap">${opts.actions || ''}</div></header>
    <div class="body${opts.flush ? ' flush' : ''}">${bodyHTML}</div></section>`;
}

/* toasts + dialogs */
function toast(msg, kind = '') {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, kind === 'bad' ? 5200 : 2600);
}

/** Open a native <dialog>. `fields` is raw HTML for the body. onSubmit(formData, dialog). */
function openDialog({ title, body, submitLabel = 'Save', wide = false, extraFooter = '', onSubmit, onOpen }) {
  const dlg = document.createElement('dialog');
  if (wide) dlg.className = 'wide';
  dlg.innerHTML = `<form method="dialog">
    <header><h3>${esc(title)}</h3><button class="btn ghost sm" value="cancel" type="submit">Esc</button></header>
    <div class="dbody">${body}</div>
    <footer>${extraFooter}<button class="btn" value="cancel" type="submit">Cancel</button>
    ${onSubmit ? `<button class="btn primary" value="ok" type="button" data-ok>${esc(submitLabel)}</button>` : ''}</footer>
  </form>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  const submit = () => {
    const data = {};
    $$('[name]', dlg).forEach((f) => {
      if (f.type === 'checkbox') data[f.name] = f.checked;
      else data[f.name] = f.value;
    });
    const res = onSubmit ? onSubmit(data, dlg) : true;
    if (res !== false) close();
  };
  const okBtn = $('[data-ok]', dlg);
  if (okBtn) okBtn.addEventListener('click', submit);
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && onSubmit) { e.preventDefault(); submit(); }
  });
  dlg.showModal();
  const first = $('input:not([type=hidden]), textarea, select', dlg);
  if (first) setTimeout(() => first.focus(), 20);
  if (onOpen) onOpen(dlg, close);
  return dlg;
}
function confirmDialog(title, message, onYes, yesLabel = 'Delete') {
  openDialog({
    title, body: `<p class="mut" style="margin:0">${esc(message)}</p>`, submitLabel: yesLabel,
    onSubmit: () => { onYes(); },
  });
}

/* misc dom */
function on(sel, evt, fn, root = document) {
  root.addEventListener(evt, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}
function download(filename, text, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* --------------------------------------------------- 2. storage + sync layer */

const COLLECTIONS = ['settings', 'notes', 'teachers', 'tasks', 'uni', 'finances', 'datasets'];
const LS = 'desk:';
const PASS_KEY = 'desk:pass';

const DEFAULTS = () => ({
  settings: {
    name: 'Shukrullo',
    currency: 'UZS',
    semStart: '',
    semEnd: '',
    konspektyRoot: 'NewUU',
    calcom: '',
    hiddenSources: [],
    collapsedFolders: [],
    lastFace: 'work',
  },
  notes: [],
  teachers: [],
  tasks: [],
  uni: { courses: [], slots: [] },
  finances: { tx: [], budgets: {} },
  datasets: [],
});

let DB = DEFAULTS();
let PASS = localStorage.getItem(PASS_KEY) || '';
/** 'cloud' | 'synced' | 'saving' | 'local' | 'error' */
let SYNC_MODE = 'local';
let REMOTE = false; // backend reachable

const bodyCache = new Map(); // note id -> text

function apiHeaders(extra = {}) {
  const h = { ...extra };
  if (PASS) h['x-passphrase'] = PASS;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts,
    headers: apiHeaders(opts.body ? { 'content-type': 'application/json', ...(opts.headers || {}) } : opts.headers),
  });
  if (res.status === 401) { const e = new Error('unauthorized'); e.status = 401; throw e; }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
    const e = new Error(detail || `HTTP ${res.status}`); e.status = res.status; throw e;
  }
  return res.json();
}

function setSync(mode, note) {
  SYNC_MODE = mode;
  const pill = $('#syncpill');
  if (!pill) return;
  const map = {
    cloud: ['cloud', 'var(--tx-3)'],
    synced: ['synced', 'var(--ok)'],
    saving: ['saving…', 'var(--warn)'],
    local: ['this device', 'var(--tx-3)'],
    error: ['not saved', 'var(--bad)'],
  };
  const [label, color] = map[mode] || map.local;
  pill.innerHTML = `<span class="dot" style="background:${color}"></span>${esc(label)}`;
  pill.title = note || label;
}

const pending = new Map();
function saveCollection(name, immediate = false) {
  try { localStorage.setItem(LS + name, JSON.stringify(DB[name])); }
  catch (e) { toast('Local storage is full — export a backup from Settings.', 'bad'); }
  if (!REMOTE) { setSync('local'); return; }
  clearTimeout(pending.get(name));
  const push = async () => {
    pending.delete(name); // clear first: the pill below asks whether anything is still queued
    setSync('saving');
    try {
      await api('/data/' + name, { method: 'PUT', body: JSON.stringify(DB[name]) });
      setSync(pending.size ? 'saving' : 'synced');
    } catch (err) {
      setSync('error', String(err.message || err));
      toast('Could not sync ' + name + ' — kept on this device.', 'bad');
    }
  };
  if (immediate) { push(); return; }
  pending.set(name, setTimeout(push, 700));
}
/** Save several collections and re-render the current page. */
function save(...names) { names.forEach((n) => saveCollection(n)); }
function saveRender(...names) { save(...names); render(); }

async function loadAll() {
  const local = {};
  COLLECTIONS.forEach((c) => {
    try { const raw = localStorage.getItem(LS + c); if (raw) local[c] = JSON.parse(raw); } catch { /* ignore */ }
  });
  let remote = {};
  if (REMOTE) {
    const results = await Promise.all(COLLECTIONS.map(async (c) => {
      try { return [c, await api('/data/' + c)]; } catch { return [c, undefined]; }
    }));
    results.forEach(([c, v]) => { if (v != null) remote[c] = v; });
  }
  const base = DEFAULTS();
  COLLECTIONS.forEach((c) => {
    const v = remote[c] != null ? remote[c] : local[c];
    DB[c] = v == null ? base[c] : v;
  });
  // shape guards — a half-written blob should never crash a page
  DB.settings = Object.assign(base.settings, DB.settings || {});
  if (!Array.isArray(DB.notes)) DB.notes = [];
  if (!Array.isArray(DB.teachers)) DB.teachers = [];
  if (!Array.isArray(DB.tasks)) DB.tasks = [];
  if (!Array.isArray(DB.datasets)) DB.datasets = [];
  DB.uni = Object.assign({ courses: [], slots: [] }, DB.uni || {});
  DB.finances = Object.assign({ tx: [], budgets: {} }, DB.finances || {});
  setSync(REMOTE ? 'cloud' : 'local');
}

/* note bodies live in their own keys so a big vault never hits value limits */
async function loadBody(id) {
  if (bodyCache.has(id)) return bodyCache.get(id);
  let text = '';
  try { const raw = localStorage.getItem(LS + 'n_' + id); if (raw != null) text = JSON.parse(raw).t || ''; } catch { /* ignore */ }
  if (REMOTE) {
    try {
      const remote = await api('/data/n_' + id);
      if (remote && typeof remote.t === 'string') text = remote.t;
    } catch { /* offline: keep local */ }
  }
  bodyCache.set(id, text);
  return text;
}
const bodyTimers = new Map();
function saveBody(id, text, immediate = false) {
  bodyCache.set(id, text);
  try { localStorage.setItem(LS + 'n_' + id, JSON.stringify({ t: text })); } catch { /* quota */ }
  if (!REMOTE) return;
  clearTimeout(bodyTimers.get(id));
  const push = async () => {
    setSync('saving');
    try { await api('/data/n_' + id, { method: 'PUT', body: JSON.stringify({ t: text }) }); setSync('synced'); }
    catch { setSync('error'); }
    finally { bodyTimers.delete(id); }
  };
  if (immediate) push(); else bodyTimers.set(id, setTimeout(push, 900));
}
function deleteBody(id) {
  bodyCache.delete(id);
  localStorage.removeItem(LS + 'n_' + id);
  if (REMOTE) api('/data/n_' + id, { method: 'DELETE' }).catch(() => {});
}

/* ------------------------------------------------------- 3. login page + boot */

/** Golden rectangle subdivided into 7 squares + the Fibonacci quarter-arc spiral. */
function goldenSVG(W = 880, H = 544) {
  const squares = [];
  let r = { x: 0, y: 0, w: W, h: H };
  const cut = (rect, dir) => {
    const s = Math.min(rect.w, rect.h);
    let sq, rest;
    if (dir === 0) { sq = { x: rect.x, y: rect.y, s }; rest = { x: rect.x + s, y: rect.y, w: rect.w - s, h: rect.h }; }
    else if (dir === 1) { sq = { x: rect.x, y: rect.y, s }; rest = { x: rect.x, y: rect.y + s, w: rect.w, h: rect.h - s }; }
    else if (dir === 2) { sq = { x: rect.x + rect.w - s, y: rect.y + rect.h - s, s }; rest = { x: rect.x, y: rect.y, w: rect.w - s, h: rect.h }; }
    else { sq = { x: rect.x, y: rect.y + rect.h - s, s }; rest = { x: rect.x, y: rect.y, w: rect.w, h: rect.h - s }; }
    return [sq, rest];
  };
  // 30 iterations to locate the pole, but only the first 7 squares are drawn
  let probe = { ...r };
  for (let i = 0; i < 30; i++) { const [, rest] = cut(probe, i % 4); if (rest.w < 0.01 || rest.h < 0.01) break; probe = rest; }
  const pole = { x: probe.x + probe.w / 2, y: probe.y + probe.h / 2 };

  for (let i = 0; i < 7; i++) { const [sq, rest] = cut(r, i % 4); squares.push(sq); r = rest; }

  const arcs = squares.map((sq) => {
    const corners = [
      { x: sq.x, y: sq.y }, { x: sq.x + sq.s, y: sq.y },
      { x: sq.x + sq.s, y: sq.y + sq.s }, { x: sq.x, y: sq.y + sq.s },
    ];
    let ci = 0, best = Infinity;
    corners.forEach((c, i) => { const d = (c.x - pole.x) ** 2 + (c.y - pole.y) ** 2; if (d < best) { best = d; ci = i; } });
    const C = corners[ci];
    const A = corners[(ci + 1) % 4];
    const B = corners[(ci + 3) % 4];
    const cross = (A.x - C.x) * (B.y - C.y) - (A.y - C.y) * (B.x - C.x);
    const sweep = cross > 0 ? 1 : 0;
    return `M ${A.x.toFixed(2)} ${A.y.toFixed(2)} A ${sq.s.toFixed(2)} ${sq.s.toFixed(2)} 0 0 ${sweep} ${B.x.toFixed(2)} ${B.y.toFixed(2)}`;
  });

  const rects = squares.map((s) =>
    `<rect x="${s.x.toFixed(2)}" y="${s.y.toFixed(2)}" width="${s.s.toFixed(2)}" height="${s.s.toFixed(2)}" fill="none" stroke="#f7e9df" stroke-width="1" opacity="0.25"/>`).join('');

  return `<svg viewBox="-6 -6 ${W + 12} ${H + 12}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#f7e9df" stroke-width="1.4" opacity="0.45"/>
    ${rects}
    <circle cx="${pole.x.toFixed(2)}" cy="${pole.y.toFixed(2)}" r="${(H / 6).toFixed(2)}" fill="none" stroke="#f7e9df" stroke-width="0.9" opacity="0.16"/>
    <path d="${arcs.join(' ')}" fill="none" stroke="#f7e9df" stroke-width="1.7" opacity="0.6" stroke-linecap="round"/>
  </svg>`;
}

const LOGO_SCHOOL = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 3 34 9v12c0 8-6 13.5-14 16C12 34.5 6 29 6 21V9l14-6Z" stroke="#f7e9df" stroke-width="1.6" opacity=".9"/>
  <path d="M13 24c1.9 1.4 4 2.1 6.3 2.1 3.2 0 5-1.3 5-3.2 0-4.6-11-2.2-11-8.4 0-3 2.6-5 6.6-5 2.2 0 4.2.6 5.8 1.7" stroke="#f7e9df" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const LOGO_UNI = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 15 20 7l16 8-16 8-16-8Z" stroke="#f7e9df" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M10 19v8c0 2.8 4.5 5 10 5s10-2.2 10-5v-8" stroke="#f7e9df" stroke-width="1.6"/>
  <path d="M33 16v8" stroke="#f7e9df" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function renderLogin(message = '') {
  document.documentElement.setAttribute('data-theme', 'work');
  document.body.classList.remove('zen');
  $('#app').innerHTML = `<div class="login">
    <div class="brand">
      <div class="grain"></div>
      <div class="logos">
        <span class="logo">${LOGO_SCHOOL}</span>
        <span class="logo">${LOGO_UNI}</span>
      </div>
      <div class="art">${goldenSVG()}</div>
      <div>
        <h1 class="title">Shukrullo's personal<br>zettelkasten</h1>
        <div class="tagline">a desk for the department and the degree</div>
        <div class="today">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      </div>
    </div>
    <div class="form-side">
      <form class="form" id="loginform">
        <h2>Welcome back</h2>
        <p class="hint">One passphrase, one desk. It stays on this device until you lock.</p>
        <label class="f"><span>Passphrase</span>
          <span class="pw"><input type="password" id="pw" autocomplete="current-password" autofocus>
          <button type="button" id="togglepw">Show</button></span>
        </label>
        <div class="err" id="loginerr">${esc(message)}</div>
        <button class="btn primary" style="width:100%;justify-content:center" type="submit">Unlock</button>
      </form>
    </div>
  </div>`;

  $('#togglepw').addEventListener('click', () => {
    const i = $('#pw');
    i.type = i.type === 'password' ? 'text' : 'password';
    $('#togglepw').textContent = i.type === 'password' ? 'Show' : 'Hide';
    i.focus();
  });
  $('#loginform').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#pw').value;
    if (!value) return;
    PASS = value;
    try {
      const res = await api('/data/_auth');
      if (!res.ok) throw new Error('nope');
      localStorage.setItem(PASS_KEY, PASS);
      await start();
    } catch (err) {
      PASS = localStorage.getItem(PASS_KEY) || '';
      $('#loginerr').textContent = err.status === 401 ? 'That passphrase does not match.' : 'Could not reach the server — try again.';
      $('#pw').select();
    }
  });
}

function lock() {
  localStorage.removeItem(PASS_KEY);
  PASS = '';
  location.reload();
}

async function boot() {
  try {
    const res = await fetch('/api/data/_auth', { headers: apiHeaders() });
    if (res.status === 401) { REMOTE = true; renderLogin(); return; }
    if (res.ok) {
      const info = await res.json();
      REMOTE = true;
      if (!info.kv) toast('KV namespace DESK is not bound — nothing will sync yet.', 'bad');
      await start();
      return;
    }
    throw new Error('no api');
  } catch {
    // no backend (opened as a plain static file / local preview): device-only mode
    REMOTE = false;
    await start();
    toast('No backend reachable — running on this device only.');
  }
}

async function start() {
  $('#app').innerHTML = `<div style="display:grid;place-items:center;height:100vh;color:var(--tx-3)">Loading your desk…</div>`;
  await loadAll();
  renderShell();
  window.addEventListener('hashchange', render);
  render();
}

/* ------------------------------------------------------- 4. shell + routing */

const NAV = {
  work: [
    { id: 'overview', label: 'Overview', ico: '◇' },
    { id: 'teachers', label: '1-1s', ico: '☺' },
    { id: 'tasks', label: 'Tasks', ico: '▤' },
    { id: 'reports', label: 'Reports', ico: '▦' },
  ],
  uni: [
    { id: 'overview', label: 'Overview', ico: '◇' },
    { id: 'timetable', label: 'Timetable', ico: '▥' },
    { id: 'courses', label: 'Courses', ico: '❐' },
    { id: 'tasks', label: 'Tasks', ico: '▤' },
    { id: 'konspekty', label: 'Konspekty', ico: '✎' },
  ],
  shared: [
    { id: 'calendar', label: 'Calendar', ico: '▣' },
    { id: 'notes', label: 'Notes', ico: '✦' },
    { id: 'finances', label: 'Finances', ico: '₮' },
    { id: 'settings', label: 'Settings', ico: '⚙' },
  ],
};

function route() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  let [face, page, param] = parts;
  if (!['work', 'uni', 'shared'].includes(face)) face = DB.settings.lastFace === 'uni' ? 'uni' : 'work';
  const pages = face === 'shared' ? NAV.shared : NAV[face];
  if (!pages.some((p) => p.id === page)) page = face === 'shared' ? 'calendar' : 'overview';
  return { face, page, param: param || '', rest: parts.slice(3) };
}
const currentFace = () => {
  const r = route();
  if (r.face !== 'shared') return r.face;
  return DB.settings.lastFace === 'uni' ? 'uni' : 'work';
};
const go = (hash) => { location.hash = hash; };
const href = (h) => `#${h}`;

function themeFor(r) {
  if (r.face === 'shared' && r.page === 'notes') return 'notes';
  if (r.face === 'uni' && r.page === 'konspekty') return 'notes';
  return currentFace();
}

function renderShell() {
  $('#app').innerHTML = `<div class="shell">
    <aside class="side">
      <div class="top">
        <div class="seg" id="faceseg">
          <button data-face="work">Work</button>
          <button data-face="uni">University</button>
        </div>
      </div>
      <nav id="nav"></nav>
      <div class="foot">
        <span class="pill" id="syncpill"><span class="dot"></span>…</span>
        <button class="btn ghost sm" id="lockbtn" title="Forget the passphrase on this device">Lock</button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar" id="topbar"></div>
      <div class="page" id="view"></div>
    </div>
  </div>
  <nav class="mobilebar" id="mobilebar"></nav>`;

  on('#faceseg button', 'click', (e, b) => switchFace(b.dataset.face));
  $('#lockbtn').addEventListener('click', lock);
  setSync(SYNC_MODE);
}

function switchFace(face) {
  DB.settings.lastFace = face;
  save('settings');
  go(`${face}/overview`);
  if (location.hash === `#${face}/overview`) render();
}

function renderNav() {
  const r = route();
  const face = currentFace();
  $$('#faceseg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.face === face)));

  const counts = {
    tasks: DB.tasks.filter((t) => t.face === face && t.status !== 'done').length,
    reports: DB.datasets.length,
    teachers: DB.teachers.filter((t) => !t.left).length,
    notes: DB.notes.length,
  };
  const group = (title, list, faceKey) => `<div class="navgroup">${esc(title)}</div>` + list.map((p) => {
    const active = r.face === faceKey && r.page === p.id;
    const badge = counts[p.id] ? `<span class="badge">${counts[p.id]}</span>` : '';
    return `<a class="navlink" href="${href(`${faceKey}/${p.id}`)}"${active ? ' aria-current="page"' : ''}>
      <span class="ico">${p.ico}</span>${esc(p.label)}${badge}</a>`;
  }).join('');

  $('#nav').innerHTML =
    group(face === 'work' ? 'SATashkent' : 'University', NAV[face], face) +
    group('Everywhere', NAV.shared, 'shared');

  const mob = [...NAV[face].slice(0, 3).map((p) => ({ ...p, face })),
    { ...NAV.shared[0], face: 'shared' }, { ...NAV.shared[1], face: 'shared' }];
  $('#mobilebar').innerHTML = mob.map((p) => {
    const active = r.face === p.face && r.page === p.id;
    return `<a href="${href(`${p.face}/${p.id}`)}"${active ? ' aria-current="page"' : ''}><span class="ico">${p.ico}</span>${esc(p.label)}</a>`;
  }).join('');
}

function topbar(title, { crumb = '', actions = '' } = {}) {
  const face = currentFace();
  $('#topbar').innerHTML = `<div>
      ${crumb ? `<div class="crumb">${crumb}</div>` : ''}
      <h1>${esc(title)}</h1>
    </div>
    <div class="spacer"></div>
    <div class="wrap">${actions}
      <span class="seg" id="faceseg-m" style="display:none">
        <button data-face="work"${face === 'work' ? ' aria-pressed="true"' : ''}>Work</button>
        <button data-face="uni"${face === 'uni' ? ' aria-pressed="true"' : ''}>Uni</button>
      </span>
    </div>`;
  if (window.matchMedia('(max-width: 900px)').matches) {
    const seg = $('#faceseg-m');
    seg.style.display = '';
    on('#faceseg-m button', 'click', (e, b) => switchFace(b.dataset.face));
  }
}

const PAGES = {}; // filled in by the module sections below

function render() {
  const r = route();
  if (!$('#view')) return; // login screen is up — leave its theme alone
  document.documentElement.setAttribute('data-theme', themeFor(r));
  renderNav();
  const key = `${r.face}/${r.page}`;
  const fn = PAGES[key];
  const view = $('#view');
  view.scrollTop = 0;
  if (!fn) { view.innerHTML = emptyState('Nothing here', 'That page does not exist — pick one from the sidebar.'); return; }
  try {
    fn(view, r);
  } catch (err) {
    console.error(err);
    view.innerHTML = emptyState('This page hit an error', String(err && err.message || err));
  }
  if (r.page !== 'notes' && r.page !== 'konspekty') document.body.classList.remove('zen');
}

/* --------------------------------------------------------------- 5a. tasks */

const STATUSES = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];

const taskById = (id) => DB.tasks.find((t) => t.id === id);
function taskProgress(t) {
  const steps = t.steps || [];
  if (steps.length) return { done: steps.filter((s) => s.done).length, total: steps.length, ratio: steps.filter((s) => s.done).length / steps.length };
  const r = clamp(Number(t.progress) || 0, 0, 100) / 100;
  return { done: null, total: 0, ratio: r };
}
const nextStep = (t) => (t.steps || []).filter((s) => !s.done)
  .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))[0];

/** Every deadline a face owns — task finals and each undone step — as flat rows. */
function deadlineRows(face) {
  const rows = [];
  DB.tasks.filter((t) => t.face === face && t.status !== 'done').forEach((t) => {
    if (t.due) rows.push({ id: t.id, label: t.title, due: t.due, kind: 'task' });
    (t.steps || []).forEach((s) => {
      if (s.due && !s.done) rows.push({ id: t.id, label: `${t.title} › ${s.text}`, due: s.due, kind: 'step' });
    });
  });
  return rows.sort((a, b) => a.due.localeCompare(b.due));
}

function taskDialog(existing, face, presetCourse) {
  const t = existing || { id: uid(), face, title: '', due: '', link: '', notes: '', course: presetCourse || '', status: 'todo', progress: 0, steps: [] };
  const steps = (t.steps || []).map((s) => ({ ...s }));
  const courses = DB.uni.courses || [];

  const stepsHTML = () => steps.map((s, i) => `<div class="row" data-step="${i}" style="margin-bottom:6px;align-items:center">
      <label style="flex:0 0 auto"><input type="checkbox" data-sdone="${i}"${s.done ? ' checked' : ''}></label>
      <input data-stext="${i}" value="${attr(s.text)}" placeholder="Step" style="flex:3">
      <input data-sdue="${i}" type="date" value="${attr(s.due || '')}" style="flex:1.2">
      <button type="button" class="btn danger sm" data-sdel="${i}">✕</button>
    </div>`).join('') || `<p class="mini">No steps yet — the progress slider is used instead.</p>`;

  const body = `
    <label class="f"><span>Title</span><input name="title" value="${attr(t.title)}" placeholder="What needs doing"></label>
    <div class="row">
      <label class="f"><span>Final deadline</span><input name="due" type="date" value="${attr(t.due || '')}"></label>
      <label class="f"><span>Status</span><select name="status">${STATUSES.map(([v, l]) => `<option value="${v}"${t.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${face === 'uni' ? `<label class="f"><span>Course</span><select name="course"><option value="">— none —</option>
      ${courses.map((c) => `<option value="${attr(c.id)}"${t.course === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
    <label class="f"><span>Link</span><input name="link" value="${attr(t.link || '')}" placeholder="https://…"></label>
    <label class="f"><span>Notes</span><textarea name="notes" rows="3">${esc(t.notes || '')}</textarea></label>
    <div class="spread" style="margin:14px 0 6px"><span class="mini b">STEPS</span><button type="button" class="btn sm" id="addstep">+ Step</button></div>
    <div id="steplist">${stepsHTML()}</div>
    <label class="f" id="progwrap" style="margin-top:12px"><span>Progress (used only when there are no steps)</span>
      <input name="progress" type="range" min="0" max="100" step="5" value="${attr(t.progress || 0)}"></label>`;

  openDialog({
    title: existing ? 'Edit task' : 'New task',
    body,
    extraFooter: existing ? `<button type="button" class="btn danger left" id="deltask">Delete</button>` : '',
    onOpen: (dlg, close) => {
      const list = $('#steplist', dlg);
      const redraw = () => { list.innerHTML = stepsHTML(); };
      $('#addstep', dlg).addEventListener('click', () => { steps.push({ id: uid(), text: '', due: '', done: false }); redraw(); const inputs = $$('[data-stext]', list); if (inputs.length) inputs[inputs.length - 1].focus(); });
      list.addEventListener('input', (e) => {
        const el = e.target;
        if (el.dataset.stext != null) steps[+el.dataset.stext].text = el.value;
        if (el.dataset.sdue != null) steps[+el.dataset.sdue].due = el.value;
      });
      list.addEventListener('change', (e) => {
        const el = e.target;
        if (el.dataset.sdone != null) steps[+el.dataset.sdone].done = el.checked;
      });
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sdel]');
        if (b) { steps.splice(+b.dataset.sdel, 1); redraw(); }
      });
      const del = $('#deltask', dlg);
      if (del) del.addEventListener('click', () => {
        DB.tasks = DB.tasks.filter((x) => x.id !== t.id);
        close(); saveRender('tasks'); toast('Task deleted');
      });
    },
    onSubmit: (data) => {
      const title = data.title.trim();
      if (!title) { toast('A task needs a title.', 'bad'); return false; }
      Object.assign(t, {
        title, due: data.due || '', link: data.link.trim(), notes: data.notes,
        course: data.course || '', status: data.status, progress: Number(data.progress) || 0,
        steps: steps.filter((s) => s.text.trim()).map((s) => ({ ...s, text: s.text.trim() })),
        face,
      });
      if (!existing) DB.tasks.push(t);
      saveRender('tasks');
    },
  });
}

function taskCard(t) {
  const p = taskProgress(t);
  const ns = nextStep(t);
  const due = t.due ? `<span class="pill ${dueClass(t.due)}">${esc(fmtDay(t.due))}</span>` : '';
  const course = t.course ? (DB.uni.courses.find((c) => c.id === t.course) || {}).name : '';
  return `<article class="kcard" data-task="${attr(t.id)}">
    <div class="kt">${esc(t.title)}</div>
    ${ns ? `<div class="next">next: ${esc(ns.text)}${ns.due ? ` · ${esc(relDays(ns.due))}` : ''}</div>` : ''}
    <div class="kmeta">
      ${due}
      ${p.total ? `<span class="pill">${p.done}/${p.total} steps</span>` : ''}
      ${course ? `<span class="pill accent">${esc(course)}</span>` : ''}
      ${t.link ? `<a class="pill" href="${attr(t.link)}" target="_blank" rel="noopener" data-stop>link ↗</a>` : ''}
    </div>
    <div class="bar" style="margin-top:8px"><i style="width:${Math.round(p.ratio * 100)}%"></i></div>
    <div class="kbtns">
      <button class="btn ghost sm" data-move="-1" title="Move left">←</button>
      <button class="btn ghost sm" data-move="1" title="Move right">→</button>
    </div>
  </article>`;
}

function renderTasks(view, r) {
  const face = r.face;
  topbar(face === 'work' ? 'Tasks' : 'University tasks', {
    actions: `<button class="btn primary" id="newtask">+ New task</button>`,
  });
  const mine = DB.tasks.filter((t) => t.face === face);
  view.innerHTML = `<div class="kanban">${STATUSES.map(([id, label]) => {
    const list = mine.filter((t) => (t.status || 'todo') === id)
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    return `<div class="kcol" data-col="${id}">
      <header><h3>${label}</h3><span class="mini num">${list.length}</span></header>
      <div class="cards">${list.map(taskCard).join('') ||
        `<div class="empty" style="padding:14px">${id === 'todo' ? 'Nothing queued. Hit <b>+ New task</b> to add the first one.' : id === 'doing' ? 'Nothing in flight — move a card here with →.' : 'Finished work lands here.'}</div>`}</div>
    </div>`;
  }).join('')}</div>`;

  $('#newtask').addEventListener('click', () => taskDialog(null, face));
  view.addEventListener('click', (e) => {
    const move = e.target.closest('[data-move]');
    const card = e.target.closest('[data-task]');
    if (!card) return;
    const t = taskById(card.dataset.task);
    if (!t) return;
    if (e.target.closest('[data-stop]')) return;
    if (move) {
      e.stopPropagation();
      const order = STATUSES.map((s) => s[0]);
      const i = clamp(order.indexOf(t.status || 'todo') + Number(move.dataset.move), 0, 2);
      t.status = order[i];
      saveRender('tasks');
      return;
    }
    taskDialog(t, face);
  });
}
PAGES['work/tasks'] = renderTasks;
PAGES['uni/tasks'] = renderTasks;

/* ------------------------------------------------- 5b. work overview + 1-1s */

const KINDS = [['note', 'Note'], ['feedback', 'Feedback'], ['task_me', 'Task for me'], ['task_them', 'Task for them']];
const teacherById = (id) => DB.teachers.find((t) => t.id === id);
const activeTeachers = () => DB.teachers.filter((t) => !t.left);

function lastOneOnOne(t) {
  const dates = (t.entries || []).map((e) => e.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
function staleness(t) {
  const last = lastOneOnOne(t);
  if (!last) return null;
  return daysBetween(fromISO(last), new Date());
}
function openTasks(t, kind) {
  return (t.entries || []).filter((e) => e.kind === kind && !e.done);
}
function greeting() {
  const h = new Date().getHours();
  const name = (DB.settings.name || '').trim();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

function renderWorkOverview(view) {
  topbar(greeting(), {
    crumb: new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    actions: `<button class="btn" id="quicknote">Quick note</button><button class="btn primary" id="newtask">+ Task</button>`,
  });

  const deadlines = deadlineRows('work');
  const overdue = deadlines.filter((d) => daysUntil(d.due) < 0);
  const week = deadlines.filter((d) => daysUntil(d.due) >= 0 && daysUntil(d.due) <= 7);
  const owed = DB.teachers.flatMap((t) => openTasks(t, 'task_me').map((e) => ({ t, e })));
  const stale = activeTeachers().map((t) => ({ t, days: staleness(t) }))
    .sort((a, b) => (b.days == null ? 1e6 : b.days) - (a.days == null ? 1e6 : a.days));
  const recentNotes = [...DB.notes].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))).slice(0, 6);

  view.innerHTML = `
    <div class="stats">
      ${statBox(overdue.length, 'overdue')}
      ${statBox(week.length, 'due this week')}
      ${statBox(owed.length, 'tasks I owe teachers')}
      ${statBox(DB.datasets.length, 'datasets loaded')}
    </div>
    <div class="grid g-side">
      ${panel('Deadlines · next 7 days', week.length || overdue.length ? `<div class="list">${
        [...overdue, ...week].slice(0, 12).map((d) => `<div class="list-row click" data-open-task="${attr(d.id)}">
          <div class="grow"><div class="t trunc">${esc(d.label)}</div><div class="m">${d.kind === 'step' ? 'step' : 'final deadline'}</div></div>
          <span class="pill ${dueClass(d.due)}">${esc(relDays(d.due))}</span></div>`).join('')
      }</div>` : emptyState('Clear week', 'Nothing due in the next seven days. Add a task to fill it.'), { flush: true })}

      ${panel('Longest since a 1-1', stale.length ? `<div class="list">${stale.slice(0, 8).map(({ t, days }) => `
        <div class="list-row click" data-teacher="${attr(t.id)}">
          <div class="grow"><div class="t">${esc(t.name)}</div><div class="m">${esc(t.teaches || 'no subject set')}</div></div>
          <span class="pill ${days == null ? 'warn' : days > 21 ? 'bad' : ''}">${days == null ? 'never' : days + 'd ago'}</span>
        </div>`).join('')}</div>
        ${owed.length ? `<div class="body"><div class="mini b" style="margin-bottom:6px">I OWE THEM</div>${
          owed.slice(0, 6).map(({ t, e }) => `<div class="list-row" style="padding:6px 0;border:0"><div class="grow"><span class="t">${esc(e.text)}</span> <span class="m">— ${esc(t.name)}</span></div></div>`).join('')
        }</div>` : ''}`
        : emptyState('No teachers yet', 'Add your first teacher on the 1-1s page to start a journal.'), { flush: true })}
    </div>
    <div class="grid g-side">
      ${panel('Recent notes', recentNotes.length ? `<div class="list">${recentNotes.map((n) => `
        <div class="list-row click" data-note="${attr(n.id)}"><div class="grow"><div class="t trunc">${esc(n.title)}</div>
        <div class="m trunc">${esc(n.path || 'vault root')}</div></div>
        <span class="m">${esc(n.updated ? fmtDay(n.updated) : '')}</span></div>`).join('')}</div>`
        : emptyState('Vault is empty', 'Use Quick note above, or import your Obsidian folder from the Notes page.'), { flush: true })}

      ${panel('Reports', DB.datasets.length ? `<div class="list">${DB.datasets.slice(0, 6).map((d) => `
        <div class="list-row click" data-report="${attr(d.id)}"><div class="grow"><div class="t trunc">${esc(d.name)}</div>
        <div class="m">${esc(d.kind)} · ${esc(d.week || '')} · ${d.rows.length} rows</div></div><span class="pill">open</span></div>`).join('')}</div>`
        : emptyState('No CSVs yet', 'Drop your weekly exam export or the monthly survey on the Reports page.'), { flush: true })}
    </div>`;

  $('#newtask').addEventListener('click', () => taskDialog(null, 'work'));
  $('#quicknote').addEventListener('click', quickNoteDialog);
  on('[data-teacher]', 'click', (e, el) => go(`work/teachers/${el.dataset.teacher}`), view);
  on('[data-open-task]', 'click', (e, el) => { const t = taskById(el.dataset.openTask); if (t) taskDialog(t, 'work'); }, view);
  on('[data-note]', 'click', (e, el) => go(`shared/notes/${el.dataset.note}`), view);
  on('[data-report]', 'click', (e, el) => go(`work/reports/${el.dataset.report}`), view);
}
PAGES['work/overview'] = renderWorkOverview;

function quickNoteDialog() {
  openDialog({
    title: 'Quick note',
    submitLabel: 'File it',
    body: `<label class="f"><span>First line becomes the title</span><textarea name="text" rows="8" placeholder="Type…"></textarea></label>
      <label class="f"><span>Folder</span><input name="path" value="Inbox" list="folderlist"></label>${folderDatalist()}`,
    onSubmit: (d) => {
      const text = (d.text || '').trim();
      if (!text) return false;
      const [first, ...rest] = text.split('\n');
      const note = createNote({ title: first.slice(0, 90), path: (d.path || 'Inbox').trim(), body: rest.join('\n').trim() });
      toast('Filed into ' + (note.path || 'vault root'));
      render();
    },
  });
}

/* ---- 1-1s list ---- */
function renderTeachers(view, r) {
  if (r.param) return renderTeacherPage(view, r);
  topbar('1-1s', { actions: `<button class="btn primary" id="addteacher">+ Teacher</button>` });

  const rows = (list) => list.map((t) => {
    const days = staleness(t);
    const me = openTasks(t, 'task_me').length;
    const them = openTasks(t, 'task_them').length;
    return `<div class="list-row click" data-teacher="${attr(t.id)}">
      <div class="grow"><div class="t">${esc(t.name)}</div>
        <div class="m">${esc(t.teaches || 'no subject set')}${(t.groups || []).length ? ' · ' + esc((t.groups || []).join(', ')) : ''}</div></div>
      ${me ? `<span class="pill warn">${me} for me</span>` : ''}
      ${them ? `<span class="pill">${them} for them</span>` : ''}
      <span class="pill ${days == null ? 'warn' : days > 21 ? 'bad' : days > 14 ? 'warn' : 'ok'}">${days == null ? 'never met' : days + 'd ago'}</span>
    </div>`;
  }).join('');

  const active = activeTeachers().sort((a, b) => (staleness(b) ?? 1e6) - (staleness(a) ?? 1e6));
  const former = DB.teachers.filter((t) => t.left);

  view.innerHTML = `
    ${panel(`Teachers · ${active.length}`, active.length ? `<div class="list">${rows(active)}</div>`
      : emptyState('No teachers yet', 'Add one — you only need a name. Journals, tasks and exam attribution build up from there.'), { flush: true })}
    ${former.length ? `<details class="panel"><summary style="padding:12px 14px;cursor:pointer">Former teachers · ${former.length}</summary>
      <div class="list">${rows(former)}</div></details>` : ''}`;

  $('#addteacher').addEventListener('click', () => openDialog({
    title: 'Add teacher',
    body: `<label class="f"><span>Name</span><input name="name" placeholder="Full name"></label>
      <label class="f"><span>What they teach (optional)</span><input name="teaches" placeholder="e.g. SAT English"></label>`,
    onSubmit: (d) => {
      const name = d.name.trim();
      if (!name) return false;
      DB.teachers.push({ id: uid(), name, teaches: d.teaches.trim(), groups: [], joined: '', left: '', entries: [] });
      saveRender('teachers');
    },
  }));
  on('[data-teacher]', 'click', (e, el) => go(`work/teachers/${el.dataset.teacher}`), view);
}
PAGES['work/teachers'] = renderTeachers;

/* ---- 1-1s: one teacher's journal ---- */
function renderTeacherPage(view, r) {
  const t = teacherById(r.param);
  if (!t) { view.innerHTML = emptyState('Teacher not found', 'They may have been deleted. Go back to the 1-1s list.'); return; }
  if (!Array.isArray(t.entries)) t.entries = [];

  const days = staleness(t);
  const me = openTasks(t, 'task_me');
  const them = openTasks(t, 'task_them');

  topbar(t.name, {
    crumb: `<a href="${href('work/teachers')}">1-1s</a> · ${esc(t.teaches || 'no subject set')}${t.left ? ' · former' : ''}`,
    actions: `<button class="btn" id="editteacher">Edit</button>`,
  });

  const entries = [...t.entries].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  const byDate = {};
  entries.forEach((e) => { (byDate[e.date || 'undated'] = byDate[e.date || 'undated'] || []).push(e); });

  const kindPill = { note: '', feedback: 'accent', task_me: 'warn', task_them: '' };
  view.innerHTML = `
    <div class="stats">
      ${statBox(days == null ? '—' : days + 'd', 'since last 1-1', days != null && days > 21 ? `<div class="delta down">over three weeks</div>` : '')}
      ${statBox(me.length, 'open tasks for me')}
      ${statBox(them.length, 'waiting on them')}
      ${statBox(t.entries.length, 'journal entries')}
    </div>

    ${panel('Capture', `
      <div class="wrap" style="margin-bottom:8px">
        <span class="seg" id="kindseg">${KINDS.map(([v, l], i) => `<button data-kind="${v}"${i === 0 ? ' aria-pressed="true"' : ''}>${l}</button>`).join('')}</span>
        <input type="date" id="entrydate" value="${attr(todayISO())}" style="width:160px">
      </div>
      <textarea id="entrytext" rows="3" placeholder="What happened, what was agreed… (Ctrl+Enter saves)"></textarea>
      <div class="wrap" style="margin-top:8px"><button class="btn primary" id="saveentry">Save entry</button>
      <span class="mini">Ctrl+Enter</span></div>`)}

    <div id="scorecard">${panel('Scorecard', `<div class="mini">Reading your uploaded datasets…</div>`)}</div>

    ${panel('Journal', entries.length ? Object.keys(byDate).sort().reverse().map((date) => `
      <div class="daygroup">
        <h4>${date === 'undated' ? 'Undated' : esc(fmtDate(date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))}</h4>
        ${byDate[date].map((e) => `<div class="entry" data-entry="${attr(e.id)}">
          ${e.kind === 'task_me' || e.kind === 'task_them'
            ? `<label><input type="checkbox" data-done${e.done ? ' checked' : ''}></label>` : `<span class="pill ${kindPill[e.kind] || ''}" style="align-self:flex-start">${esc((KINDS.find((k) => k[0] === e.kind) || ['', 'Note'])[1])}</span>`}
          <div class="body ${e.done ? 'done-text' : ''}">${esc(e.text)}
            ${e.kind === 'task_me' ? '<span class="pill warn" style="margin-left:6px">for me</span>' : e.kind === 'task_them' ? '<span class="pill" style="margin-left:6px">for them</span>' : ''}</div>
          <button class="btn danger sm del" data-del>✕</button>
        </div>`).join('')}
      </div>`).join('') : emptyState('Empty journal', 'Capture the first note, feedback item or task above — it files itself under today.'), { flush: true })}`;

  let kind = 'note';
  on('#kindseg button', 'click', (e, b) => {
    kind = b.dataset.kind;
    $$('#kindseg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }, view);

  const addEntry = () => {
    const text = $('#entrytext').value.trim();
    if (!text) return;
    t.entries.push({ id: uid(), kind, text, date: $('#entrydate').value || todayISO(), done: false });
    $('#entrytext').value = '';
    saveRender('teachers');
  };
  $('#saveentry').addEventListener('click', addEntry);
  $('#entrytext').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addEntry(); }
  });

  view.addEventListener('click', (e) => {
    const row = e.target.closest('[data-entry]');
    if (!row) return;
    const entry = t.entries.find((x) => x.id === row.dataset.entry);
    if (!entry) return;
    if (e.target.closest('[data-del]')) { t.entries = t.entries.filter((x) => x.id !== entry.id); saveRender('teachers'); }
  });
  view.addEventListener('change', (e) => {
    const row = e.target.closest('[data-entry]');
    if (row && e.target.matches('[data-done]')) {
      const entry = t.entries.find((x) => x.id === row.dataset.entry);
      if (entry) { entry.done = e.target.checked; save('teachers'); render(); }
    }
  });

  $('#editteacher').addEventListener('click', () => editTeacherDialog(t));

  // scorecard is derived from potentially large datasets — do it off the paint path
  setTimeout(() => {
    const host = $('#scorecard');
    if (!host) return;
    try { host.innerHTML = teacherScorecardHTML(t); }
    catch (err) { host.innerHTML = panel('Scorecard', emptyState('Could not read the datasets', String(err.message || err))); }
  }, 0);
}

function editTeacherDialog(t) {
  openDialog({
    title: 'Edit teacher',
    body: `
      <label class="f"><span>Name</span><input name="name" value="${attr(t.name)}"></label>
      <label class="f"><span>What they teach</span><input name="teaches" value="${attr(t.teaches || '')}"></label>
      <details style="margin-top:10px"><summary class="mini b" style="cursor:pointer;padding:6px 0">ADMIN</summary>
        <label class="f"><span>Groups they teach (comma separated — used to attribute exam CSVs with no teacher column)</span>
          <input name="groups" value="${attr((t.groups || []).join(', '))}" placeholder="G-12A, Blue-2, evening group"></label>
        <div class="row">
          <label class="f"><span>Joined on</span><input name="joined" type="date" value="${attr(t.joined || '')}"></label>
          <label class="f"><span>Left on</span><input name="left" type="date" value="${attr(t.left || '')}"></label>
        </div>
        <p class="mini">Setting “Left on” archives them under Former teachers — the journal and their history stay.</p>
      </details>`,
    extraFooter: `<button type="button" class="btn danger left" id="delteacher">Delete for good</button>`,
    onOpen: (dlg, close) => {
      $('#delteacher', dlg).addEventListener('click', () => {
        close();
        confirmDialog('Delete teacher', `${t.name} and their whole journal will be removed. Archiving with “Left on” keeps the history instead.`, () => {
          DB.teachers = DB.teachers.filter((x) => x.id !== t.id);
          save('teachers'); go('work/teachers'); render();
        });
      });
    },
    onSubmit: (d) => {
      const name = d.name.trim();
      if (!name) return false;
      Object.assign(t, {
        name, teaches: d.teaches.trim(),
        groups: d.groups.split(',').map((s) => s.trim()).filter(Boolean),
        joined: d.joined || '', left: d.left || '',
      });
      saveRender('teachers');
    },
  });
}

/* ============================================================ 6. CSV reports */

/** Papa with header:false, then objects built by hand so repeated Google-Forms
 *  question headers survive as "Question", "Question (2)", … instead of collapsing. */
function parseCSV(text) {
  const out = Papa.parse(String(text).replace(/^﻿/, ''), { header: false, skipEmptyLines: 'greedy' });
  const table = out.data.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!table.length) return { headers: [], rows: [] };
  const seen = new Map();
  const headers = table[0].map((h, i) => {
    let name = String(h == null ? '' : h).trim() || `column ${i + 1}`;
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name} (${n})` : name;
  });
  const rows = table.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] == null ? '' : String(r[i]).trim(); });
    return o;
  });
  return { headers, rows };
}

const H = (h) => norm(h);
/** first header whose normalised text contains any needle, needles in priority order */
function pickHeader(headers, needles, veto = []) {
  for (const needle of needles) {
    for (const h of headers) {
      const n = H(h);
      if (!n.includes(needle)) continue;
      if (veto.some((v) => n.includes(v))) continue;
      return h;
    }
  }
  return '';
}

const EXAM_ROLES = [
  ['student', 'Student name'], ['score', 'Score'], ['group', 'Group'], ['exam', 'Exam'],
  ['teacher', 'Teacher'], ['date', 'Date'], ['branch', 'Branch'],
  ['math', 'Math section'], ['ebrw', 'EBRW section'], ['total', 'Total'],
];
const SURVEY_ROLES = [
  ['period', 'Timestamp'], ['teacher', 'Teacher'], ['csat', 'Class rating (CSAT)'], ['nps', 'NPS 0–10'],
  ['comment', 'Comment'], ['group', 'Group'], ['student', 'Student name'],
];

function detectKind(headers) {
  const hs = headers.map(H);
  const has = (s) => hs.some((h) => h.includes(s));
  if (has('recommend') || has('quality of the class') || (has('timestamp') && headers.length > 12)) return 'survey';
  if (has('score') || has('mark') || (has('exam') && has('group'))) return 'exam';
  return 'generic';
}

function autoMap(kind, headers) {
  const m = {};
  if (kind === 'exam') {
    m.student = pickHeader(headers, ['student', 'full name', 'name'], ['group', 'teacher']);
    m.score = pickHeader(headers, ['total score', 'score', 'result', 'mark', 'percent'], ['math', 'ebrw', 'reading', 'writing']);
    m.group = pickHeader(headers, ['group', 'class']);
    m.exam = pickHeader(headers, ['exam', 'test', 'mock']);
    m.teacher = pickHeader(headers, ['teacher', 'tutor', 'instructor']);
    m.date = pickHeader(headers, ['date', 'timestamp', 'week']);
    m.branch = pickHeader(headers, ['branch', 'campus', 'location']);
    m.math = pickHeader(headers, ['math']);
    m.ebrw = pickHeader(headers, ['ebrw', 'english', 'verbal', 'reading and writing']);
    m.total = pickHeader(headers, ['total'], ['math', 'ebrw']);
  } else if (kind === 'survey') {
    // prioritised: the English-teacher question must beat any generic "teacher" column,
    // and must never be a math/support-teacher question.
    m.teacher = pickHeader(headers, ['choose your english teacher', 'your english teacher', 'english teacher', 'teacher'], ['math', 'support', 'assistant']);
    m.period = pickHeader(headers, ['timestamp', 'submitted', 'date']);
    m.csat = pickHeader(headers, ['quality of the class (english)', 'quality of the class', 'rate the class', 'quality', 'satisfied'], ['math']);
    m.nps = pickHeader(headers, ['extent would you recommend', 'recommend']);
    m.comment = pickHeader(headers, ['part of the lesson needs improvement', 'needs improvement', 'comment', 'suggestion', 'anything else'], ['math']);
    m.group = pickHeader(headers, ['choose your english group', 'english group', 'group'], ['math']);
    m.student = pickHeader(headers, ['full name', 'your name', 'student']);
  }
  Object.keys(m).forEach((k) => { if (!m[k]) delete m[k]; });
  return m;
}

/** ISO week guessed from a filename, e.g. "week 35", "2026-W35", "2026-08-31". */
function weekFromName(name) {
  const s = String(name || '');
  let m = /(\d{4})[-_ ]?w(\d{1,2})/i.exec(s);
  if (m) return `${m[1]}-W${String(+m[2]).padStart(2, '0')}`;
  m = /\bweek[ _-]?(\d{1,2})\b/i.exec(s);
  if (m) return `${new Date().getFullYear()}-W${String(+m[1]).padStart(2, '0')}`;
  m = /(\d{4})[-_.](\d{2})[-_.](\d{2})/.exec(s);
  if (m) return isoWeek(new Date(+m[1], +m[2] - 1, +m[3]));
  return weekKeyNow();
}

/** Tolerant date parse. `dmy` forces day-first when the file looks European. */
function parseDate(value, dmy) {
  const s = String(value || '').trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s);
  if (m) {
    let a = +m[1], b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const [d, mo] = (dmy || a > 12) ? [a, b] : [b, a];
    return new Date(y, mo - 1, d);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
/** Look at a whole column: if any first number exceeds 12, the file is day-first. */
function columnIsDayFirst(rows, key) {
  for (const r of rows) {
    const m = /^(\d{1,2})[\/.\-](\d{1,2})/.exec(String(r[key] || '').trim());
    if (m && +m[1] > 12) return true;
    if (m && +m[2] > 12) return false;
  }
  return false;
}

/* ---- dataset store ---- */
function addDataset({ name, text, url }) {
  const { headers, rows } = parseCSV(text);
  if (!headers.length) { toast('That file has no readable header row.', 'bad'); return null; }
  const kind = detectKind(headers);
  const ds = {
    id: uid(), name, kind, headers, rows,
    map: autoMap(kind, headers),
    week: kind === 'exam' ? weekFromName(name) : '',
    url: url || '',
    added: nowStamp(),
  };
  DB.datasets.unshift(ds);
  save('datasets');
  return ds;
}

async function refetchSheet(ds) {
  if (!ds.url) return;
  const res = await fetch(ds.url);
  if (!res.ok) throw new Error('sheet fetch failed (' + res.status + ') — is the link shared as “anyone with the link”?');
  const text = await res.text();
  const { headers, rows } = parseCSV(text);
  ds.headers = headers; ds.rows = rows;
  save('datasets');
}
function sheetCSVUrl(link) {
  const m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(link || '');
  if (!m) return '';
  const gid = /[#&?]gid=(\d+)/.exec(link);
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? '&gid=' + gid[1] : ''}`;
}

/* ------------------------------------------------------------ exam engine */

const SCALES = {
  percent: { name: 'percent', t1: 90, t2: 80, t3: 70, low: 60, bin: 10, min: 0, max: 100, unit: '%' },
  sat: { name: 'SAT', t1: 1500, t2: 1400, t3: 1300, low: 1200, bin: 100, min: 400, max: 1600, unit: '' },
};

const groupKey = (g) => norm(g).replace(/[^a-z0-9]/g, '');

/** Who held this group during that week? Falls back to the current holder. */
function teacherForGroup(group, weekLabel) {
  const key = groupKey(group);
  if (!key) return null;
  const when = isoWeekStart(weekLabel) || new Date();
  const holders = DB.teachers.filter((t) => (t.groups || []).some((g) => groupKey(g) === key));
  if (!holders.length) return null;
  const tenured = holders.filter((t) => {
    const inAt = t.joined ? fromISO(t.joined) <= when : true;
    const outAt = t.left ? fromISO(t.left) >= when : true;
    return inAt && outAt;
  });
  return tenured[0] || null; // nobody held it that week — the report nudges you to fix the group list
}

function examRecords(ds) {
  const m = ds.map || {};
  const dayFirst = m.date ? columnIsDayFirst(ds.rows, m.date) : false;
  return ds.rows.map((r) => {
    const math = m.math ? num(r[m.math]) : null;
    const ebrw = m.ebrw ? num(r[m.ebrw]) : null;
    let score = m.total ? num(r[m.total]) : (m.score ? num(r[m.score]) : null);
    if (score == null && math != null && ebrw != null) score = math + ebrw;
    let week = ds.week || weekKeyNow();
    if (m.date) { const d = parseDate(r[m.date], dayFirst); if (d) week = isoWeek(d); }
    const group = m.group ? r[m.group] : '';
    const explicit = m.teacher ? String(r[m.teacher] || '').trim() : '';
    const attributed = explicit || (teacherForGroup(group, week) || {}).name || '';
    return {
      student: m.student ? String(r[m.student] || '').trim() : '',
      score, math, ebrw, group: String(group || '').trim(),
      exam: m.exam ? String(r[m.exam] || '').trim() : '',
      branch: m.branch ? String(r[m.branch] || '').trim() : '',
      teacher: attributed, attributed: !explicit && !!attributed, week,
      dsId: ds.id,
    };
  }).filter((r) => r.score != null && Number.isFinite(r.score));
}

function allExamRecords() {
  return DB.datasets.filter((d) => d.kind === 'exam').flatMap(examRecords);
}

function detectScale(records) {
  const max = Math.max(0, ...records.map((r) => r.score));
  return max <= 100 ? SCALES.percent : SCALES.sat;
}

function aggregate(records, keyFn, scale) {
  const buckets = new Map();
  records.forEach((r) => {
    const k = keyFn(r) || '';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(r);
  });
  return [...buckets.entries()].map(([key, rs]) => {
    const scores = rs.map((r) => r.score);
    return {
      key: key || '(unset)',
      n: rs.length,
      median: round(median(scores), 1),
      avg: round(mean(scores), 1),
      best: Math.max(...scores),
      t1: pct(scores.filter((s) => s >= scale.t1).length, scores.length),
      t2: pct(scores.filter((s) => s >= scale.t2).length, scores.length),
      low: scores.filter((s) => s < scale.low).length,
    };
  }).sort((a, b) => (b.median || 0) - (a.median || 0));
}

function analyseExam(ds) {
  const pool = allExamRecords();
  const own = pool.filter((r) => r.dsId === ds.id);
  const scale = detectScale(pool.length ? pool : own);
  const periods = [...new Set(pool.map((r) => r.week))].sort();
  const current = [...new Set(own.map((r) => r.week))].sort().pop() || ds.week;
  const prev = periods.filter((p) => p < current).pop() || null;

  const cur = pool.filter((r) => r.week === current);
  const prv = prev ? pool.filter((r) => r.week === prev) : [];
  const curScores = cur.map((r) => r.score);
  const prvScores = prv.map((r) => r.score);

  const kpi = {
    median: round(median(curScores), 1), medianPrev: round(median(prvScores), 1),
    avg: round(mean(curScores), 1), avgPrev: round(mean(prvScores), 1),
    n: cur.length, nPrev: prv.length,
    t1: pct(curScores.filter((s) => s >= scale.t1).length, curScores.length),
    t1Prev: pct(prvScores.filter((s) => s >= scale.t1).length, prvScores.length),
    t2: pct(curScores.filter((s) => s >= scale.t2).length, curScores.length),
    t2Prev: pct(prvScores.filter((s) => s >= scale.t2).length, prvScores.length),
    low: curScores.filter((s) => s < scale.low).length,
    lowPrev: prvScores.filter((s) => s < scale.low).length,
  };

  const byTeacher = aggregate(cur.filter((r) => r.teacher), (r) => r.teacher, scale);
  const byTeacherPrev = new Map(aggregate(prv.filter((r) => r.teacher), (r) => r.teacher, scale).map((x) => [x.key, x]));
  byTeacher.forEach((t) => { const p = byTeacherPrev.get(t.key); t.prev = p ? p.median : null; t.change = p ? round(t.median - p.median, 1) : null; });

  const byGroup = aggregate(cur, (r) => r.group || '(no group)', scale);
  byGroup.forEach((g) => { g.teacher = (cur.find((r) => (r.group || '(no group)') === g.key) || {}).teacher || ''; });
  const byExam = aggregate(cur.filter((r) => r.exam), (r) => r.exam, scale);
  const byBranch = aggregate(cur.filter((r) => r.branch), (r) => r.branch, scale);

  // students matched by normalised name between the last two periods
  const movers = [];
  if (prv.length) {
    const prevByName = new Map();
    prv.forEach((r) => { if (r.student) prevByName.set(normName(r.student), r); });
    cur.forEach((r) => {
      if (!r.student) return;
      const p = prevByName.get(normName(r.student));
      if (p) movers.push({ student: r.student, group: r.group, teacher: r.teacher, from: p.score, to: r.score, change: round(r.score - p.score, 1) });
    });
    movers.sort((a, b) => b.change - a.change);
  }

  // duplicates: same group + same normalised name, twice in the current period
  const dupSeen = new Map();
  const duplicates = [];
  cur.forEach((r) => {
    if (!r.student) return;
    const k = groupKey(r.group) + '|' + normName(r.student);
    if (dupSeen.has(k)) duplicates.push(r.student); else dupSeen.set(k, r);
  });

  const unattributed = [...new Set(cur.filter((r) => !r.teacher).map((r) => r.group).filter(Boolean))];
  const dist = [];
  for (let s = scale.min; s < scale.max; s += scale.bin) {
    dist.push({ label: `${s}–${s + scale.bin - 1}`, from: s, count: cur.filter((r) => r.score >= s && r.score < s + scale.bin).length });
  }

  // median per teacher across every period in the pool (the cross-file trend)
  const trend = { periods, series: [] };
  const teacherNames = [...new Set(pool.filter((r) => r.teacher).map((r) => r.teacher))];
  teacherNames.forEach((name) => {
    trend.series.push({
      name,
      data: periods.map((p) => {
        const s = pool.filter((r) => r.week === p && r.teacher === name).map((r) => r.score);
        return s.length ? round(median(s), 1) : null;
      }),
    });
  });

  const sectionBalance = (() => {
    const withSections = cur.filter((r) => r.math != null && r.ebrw != null);
    if (withSections.length < 3) return null;
    return { math: round(mean(withSections.map((r) => r.math)), 1), ebrw: round(mean(withSections.map((r) => r.ebrw)), 1), n: withSections.length };
  })();

  return { scale, current, prev, cur, prv, kpi, byTeacher, byGroup, byExam, byBranch, movers, duplicates, unattributed, dist, trend, sectionBalance, periods };
}

function examFindings(a) {
  const f = [];
  const u = a.scale.unit;
  if (a.prev && a.kpi.medianPrev != null) {
    const d = round(a.kpi.median - a.kpi.medianPrev, 1);
    f.push({ kind: d > 0 ? 'good' : d < 0 ? 'bad' : '', text: d === 0
      ? `Median held at <b>${a.kpi.median}${u}</b> against ${a.prev}, over ${a.kpi.n} sittings.`
      : `Median ${d > 0 ? 'rose' : 'fell'} <b>${Math.abs(d)}${u}</b> against ${a.prev} — ${a.kpi.medianPrev}${u} → <b>${a.kpi.median}${u}</b> over ${a.kpi.n} sittings.` });
  } else {
    f.push({ kind: '', text: `First period on record (${a.current}): median <b>${a.kpi.median}${u}</b> across <b>${a.kpi.n}</b> sittings. Upload another week to unlock comparisons.` });
  }
  if (a.byTeacher.length >= 2) {
    const top = a.byTeacher[0], bot = a.byTeacher[a.byTeacher.length - 1];
    f.push({ kind: 'warn', text: `Widest teacher gap: <b>${esc(top.key)}</b> ${top.median}${u} vs <b>${esc(bot.key)}</b> ${bot.median}${u} — ${round(top.median - bot.median, 1)}${u} apart.` });
  }
  const risers = a.byTeacher.filter((t) => t.change != null).sort((x, y) => y.change - x.change);
  if (risers.length) {
    const r = risers[0];
    if (r.change > 0) f.push({ kind: 'good', text: `Biggest riser: <b>${esc(r.key)}</b>, up ${r.change}${u} on ${a.prev}.` });
    const droppers = risers.filter((t) => t.change <= -(a.scale.bin / 2));
    droppers.forEach((d) => f.push({ kind: 'bad', text: `Worth a 1-1: <b>${esc(d.key)}</b> is down ${Math.abs(d.change)}${u} (${d.prev}${u} → ${d.median}${u}, n=${d.n}).` }));
  }
  if (a.sectionBalance) {
    const b = a.sectionBalance;
    const gap = round(b.math - b.ebrw, 1);
    f.push({ kind: Math.abs(gap) > a.scale.bin ? 'warn' : '', text: `Section balance over ${b.n} students: math <b>${b.math}</b> vs EBRW <b>${b.ebrw}</b> (${gap > 0 ? 'math' : 'EBRW'} ahead by ${Math.abs(gap)}).` });
  }
  f.push({ kind: a.kpi.low ? 'warn' : 'good', text: `<b>${a.kpi.t1}%</b> at or above ${a.scale.t1}${u}, <b>${a.kpi.t2}%</b> above ${a.scale.t2}${u}, and <b>${a.kpi.low}</b> below ${a.scale.low}${u}.` });
  if (a.movers.length) {
    const up = a.movers.filter((m) => m.change > 0).length;
    const down = a.movers.filter((m) => m.change < 0).length;
    f.push({ kind: '', text: `Matched <b>${a.movers.length}</b> students across both periods — ${up} improved, ${down} slipped.` });
  }
  if (a.duplicates.length) f.push({ kind: 'warn', text: `Duplicate rows detected for ${a.duplicates.length} name(s) in the same group: ${esc([...new Set(a.duplicates)].slice(0, 5).join(', '))}.` });
  if (a.unattributed.length) f.push({ kind: 'warn', text: `${a.unattributed.length} group(s) have no teacher set — open a teacher, Edit → Admin, and list their groups: ${esc(a.unattributed.slice(0, 6).join(', '))}.` });
  return f;
}

/* ---------------------------------------------------------- survey engine */

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (k) => {
  const m = /^(\d{4})-(\d{2})$/.exec(k || '');
  return m ? `${MONTHS[+m[2] - 1].slice(0, 3)} ${m[1]}` : k || '—';
};

function surveyRecords(ds) {
  const m = ds.map || {};
  const dayFirst = m.period ? columnIsDayFirst(ds.rows, m.period) : false;
  const raw = ds.rows.map((r) => {
    const teacher = m.teacher ? String(r[m.teacher] || '').trim() : '';
    const csat = m.csat ? num(r[m.csat]) : null;
    const nps = m.nps ? num(r[m.nps]) : null;
    const d = m.period ? parseDate(r[m.period], dayFirst) : null;
    return {
      teacher, csat, nps,
      month: d ? monthKey(d) : (ds.week || monthKey(new Date())),
      comment: m.comment ? String(r[m.comment] || '').trim() : '',
      group: m.group ? String(r[m.group] || '').trim() : '',
      student: m.student ? String(r[m.student] || '').trim() : '',
    };
  });
  return raw.filter((r) => !/don'?t study|do not study|не изучаю/i.test(r.teacher) && (r.csat != null || r.nps != null));
}

function ratingScale(records) {
  const vals = records.map((r) => r.csat).filter((v) => v != null);
  const max = Math.max(0, ...vals);
  return max <= 5 ? 5 : max <= 10 ? 10 : 100;
}

function analyseSurvey(ds) {
  const recs = surveyRecords(ds);
  const scale = ratingScale(recs);
  const months = [...new Set(recs.map((r) => r.month))].sort();
  const current = months[months.length - 1] || '';
  const prev = months.length > 1 ? months[months.length - 2] : null;
  const cur = recs.filter((r) => r.month === current);
  const prv = prev ? recs.filter((r) => r.month === prev) : [];

  const npsOf = (list) => {
    const vals = list.map((r) => r.nps).filter((v) => v != null);
    if (!vals.length) return { nps: null, promoters: 0, passives: 0, detractors: 0, n: 0 };
    const promoters = vals.filter((v) => v >= 9).length;
    const passives = vals.filter((v) => v >= 7 && v < 9).length;
    const detractors = vals.filter((v) => v <= 6).length;
    return { nps: Math.round((promoters / vals.length - detractors / vals.length) * 100), promoters, passives, detractors, n: vals.length };
  };
  const unhappyOf = (list) => list.filter((r) => (r.nps != null && r.nps <= 6) || (r.csat != null && r.csat <= scale * 0.6)).length;
  const csatOf = (list) => { const v = list.map((r) => r.csat).filter((x) => x != null); return v.length ? round(mean(v), 2) : null; };

  const kpi = {
    responses: cur.length, responsesPrev: prv.length,
    csat: csatOf(cur), csatPrev: csatOf(prv),
    ...npsOf(cur),
    npsPrev: npsOf(prv).nps,
    unhappy: unhappyOf(cur), unhappyPrev: unhappyOf(prv),
  };

  const teacherRows = [...new Set(cur.map((r) => r.teacher).filter(Boolean))].map((name) => {
    const list = cur.filter((r) => r.teacher === name);
    const p = prv.filter((r) => r.teacher === name);
    const n = npsOf(list);
    return {
      key: name, n: list.length, csat: csatOf(list), prevCsat: csatOf(p),
      nps: n.nps, promoters: n.promoters, detractors: n.detractors,
      unhappy: unhappyOf(list),
      change: csatOf(list) != null && csatOf(p) != null ? round(csatOf(list) - csatOf(p), 2) : null,
    };
  }).sort((a, b) => (b.csat || 0) - (a.csat || 0));

  const trend = {
    months,
    series: [...new Set(recs.map((r) => r.teacher).filter(Boolean))].map((name) => ({
      name,
      data: months.map((mo) => {
        const v = recs.filter((r) => r.month === mo && r.teacher === name).map((r) => r.csat).filter((x) => x != null);
        return v.length ? round(mean(v), 2) : null;
      }),
    })),
  };

  const npsDist = Array.from({ length: 11 }, (_, i) => ({ v: i, count: cur.filter((r) => r.nps === i).length }));
  const comments = cur.filter((r) => r.comment)
    .map((r) => ({ ...r, sortKey: r.csat != null ? r.csat / scale : (r.nps != null ? r.nps / 10 : 1) }))
    .sort((a, b) => a.sortKey - b.sortKey);

  return { scale, months, current, prev, cur, prv, kpi, teacherRows, trend, npsDist, comments, dropped: ds.rows.length - recs.length };
}

function surveyFindings(a) {
  const f = [];
  const s = a.scale;
  if (a.prev && a.kpi.csatPrev != null && a.kpi.csat != null) {
    const d = round(a.kpi.csat - a.kpi.csatPrev, 2);
    f.push({ kind: d > 0 ? 'good' : d < 0 ? 'bad' : '', text: `CSAT ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'} <b>${Math.abs(d)}</b> on ${monthLabel(a.prev)} — ${a.kpi.csatPrev}/${s} → <b>${a.kpi.csat}/${s}</b> across ${a.kpi.responses} responses.` });
  } else {
    f.push({ kind: '', text: `${monthLabel(a.current)}: <b>${a.kpi.responses}</b> responses, CSAT <b>${a.kpi.csat == null ? '—' : a.kpi.csat + '/' + s}</b>. Upload next month's export to compare.` });
  }
  const total = a.kpi.promoters + a.kpi.passives + a.kpi.detractors;
  if (total) {
    const verdict = a.kpi.nps >= 50 ? 'strong' : a.kpi.nps >= 20 ? 'healthy' : a.kpi.nps >= 0 ? 'fragile' : 'in trouble';
    f.push({ kind: a.kpi.nps >= 20 ? 'good' : a.kpi.nps >= 0 ? 'warn' : 'bad', text: `NPS <b>${a.kpi.nps}</b> — ${verdict}. ${a.kpi.promoters} promoters · ${a.kpi.passives} passives · ${a.kpi.detractors} detractors of ${total}.` });
  }
  const solid = a.teacherRows.filter((t) => t.n >= 5 && t.csat != null);
  if (solid.length >= 2) {
    f.push({ kind: 'good', text: `Best rated: <b>${esc(solid[0].key)}</b> at ${solid[0].csat}/${s} (n=${solid[0].n}).` });
    const worst = solid[solid.length - 1];
    f.push({ kind: 'warn', text: `Lowest rated: <b>${esc(worst.key)}</b> at ${worst.csat}/${s} (n=${worst.n}) — ${worst.unhappy} unhappy response(s).` });
  }
  const small = a.teacherRows.filter((t) => t.n < 5);
  if (small.length) f.push({ kind: '', text: `Small samples (n&lt;5), read with care: ${esc(small.map((t) => `${t.key} (${t.n})`).join(', '))}.` });
  const slipped = a.teacherRows.filter((t) => t.change != null && t.change < -0.3);
  slipped.forEach((t) => f.push({ kind: 'bad', text: `<b>${esc(t.key)}</b> slipped ${Math.abs(t.change)} points since ${monthLabel(a.prev)} (${t.prevCsat} → ${t.csat}).` }));
  if (a.kpi.unhappy) f.push({ kind: 'warn', text: `<b>${a.kpi.unhappy}</b> unhappy response(s) this month — detractors or ratings at or below 60% of the scale. Their comments are listed worst-first below.` });
  if (a.dropped) f.push({ kind: '', text: `${a.dropped} row(s) ignored: “I don't study English” answers or responses with no rating at all.` });
  return f;
}

/* --------------------------------------------------------- generic engine */
function analyseGeneric(ds) {
  const numeric = ds.headers.filter((h) => {
    const vals = ds.rows.map((r) => num(r[h])).filter((v) => v != null);
    return vals.length >= Math.max(3, ds.rows.length * 0.5);
  });
  const categorical = ds.headers.filter((h) => {
    if (numeric.includes(h)) return false;
    const uniq = new Set(ds.rows.map((r) => r[h]));
    return uniq.size > 1 && uniq.size <= Math.max(12, ds.rows.length / 4);
  });
  const stats = numeric.map((h) => {
    const v = ds.rows.map((r) => num(r[h])).filter((x) => x != null);
    return { key: h, n: v.length, mean: round(mean(v), 2), median: round(median(v), 2), min: Math.min(...v), max: Math.max(...v) };
  });
  const cat = categorical[0];
  const measure = numeric[0];
  let bars = [];
  if (cat && measure) {
    const map = new Map();
    ds.rows.forEach((r) => {
      const v = num(r[measure]); if (v == null) return;
      const k = String(r[cat] || '(blank)');
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(v);
    });
    bars = [...map.entries()].map(([k, v]) => ({ key: k, mean: round(mean(v), 2), n: v.length })).sort((a, b) => b.mean - a.mean);
  }
  return { stats, bars, cat, measure };
}

/* ----------------------------------------------------------- reports pages */

const charts = new Map();
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function drawChart(id, config) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  if (charts.has(id)) { charts.get(id).destroy(); charts.delete(id); }
  const grid = cssVar('--line-2');
  const tick = cssVar('--tx-3');
  const base = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: cssVar('--tx-2'), boxWidth: 10, font: { size: 11 } } } },
    scales: {
      x: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { size: 10 } } },
      y: { grid: { color: grid, drawBorder: false }, ticks: { color: tick, font: { size: 10 } } },
    },
  };
  const merged = { ...config, options: deepMerge(base, config.options || {}) };
  charts.set(id, new Chart(el.getContext('2d'), merged));
}
function deepMerge(a, b) {
  const out = { ...a };
  Object.keys(b).forEach((k) => {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k];
  });
  return out;
}
const PALETTE = ['#c42a4a', '#3ecf8e', '#f0b344', '#5b8def', '#8b7cf6', '#e08a5c', '#4bbfc3', '#d46bb3'];

function ingestFiles(files, after) {
  const list = [...files].filter((f) => /\.csv$|\.tsv$|text\/csv/i.test(f.name + f.type));
  if (!list.length) { toast('Only CSV files, please.', 'bad'); return; }
  let done = 0;
  list.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ds = addDataset({ name: file.name.replace(/\.(csv|tsv)$/i, ''), text: reader.result });
      done++;
      if (done === list.length) { toast(`${list.length} file(s) loaded`); after && after(ds); }
    };
    reader.onerror = () => toast('Could not read ' + file.name, 'bad');
    reader.readAsText(file);
  });
}

function renderReports(view, r) {
  if (r.param) return renderDataset(view, r);
  topbar('Reports', {
    actions: `<button class="btn" id="linksheet">Link a Google Sheet</button><button class="btn primary" id="pickcsv">Upload CSV</button>`,
  });

  const exams = DB.datasets.filter((d) => d.kind === 'exam');
  view.innerHTML = `
    <div class="drop" id="drop">Drop CSV files here — exam exports, survey exports, anything tabular.
      <div class="mini" style="margin-top:6px">Detected automatically; you can override every column afterwards.</div></div>
    <input type="file" id="csvinput" accept=".csv,.tsv,text/csv" multiple class="sr">
    ${exams.length >= 2 ? panel('Weekly trend across files', `<div class="chart-wrap" id="trendwrap"><canvas id="crossTrend"></canvas></div>`, { sub: 'Median per teacher, one point per file week' }) : ''}
    ${panel(`Datasets · ${DB.datasets.length}`, DB.datasets.length ? `<div class="list">${DB.datasets.map((d) => `
      <div class="list-row click" data-ds="${attr(d.id)}">
        <div class="grow"><div class="t trunc">${esc(d.name)}</div>
          <div class="m">${esc(d.kind)} · ${d.rows.length} rows · ${d.headers.length} columns${d.week ? ' · ' + esc(d.week) : ''}${d.url ? ' · linked sheet' : ''}</div></div>
        <span class="pill ${d.kind === 'exam' ? 'accent' : d.kind === 'survey' ? 'ok' : ''}">${esc(d.kind)}</span>
        <button class="btn danger sm" data-delds="${attr(d.id)}">✕</button>
      </div>`).join('')}</div>`
      : emptyState('No datasets yet', 'Drop your weekly “Student, Score, Group, Exam” export above, or link the monthly survey sheet.'), { flush: true })}`;

  const input = $('#csvinput');
  $('#pickcsv').addEventListener('click', () => input.click());
  input.addEventListener('change', () => ingestFiles(input.files, (ds) => go(`work/reports/${ds.id}`)));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => ingestFiles(e.dataTransfer.files, (ds) => go(`work/reports/${ds.id}`)));

  $('#linksheet').addEventListener('click', () => openDialog({
    title: 'Link a Google Sheet',
    submitLabel: 'Fetch',
    body: `<label class="f"><span>Share link (anyone with the link can view)</span>
      <input name="link" placeholder="https://docs.google.com/spreadsheets/d/…"></label>
      <p class="mini">Converted to an /export?format=csv URL and refetched every time you open the report.</p>`,
    onSubmit: async (d) => {
      const url = sheetCSVUrl(d.link.trim());
      if (!url) { toast('That does not look like a Google Sheets link.', 'bad'); return false; }
      try {
        const text = await (await fetch(url)).text();
        const ds = addDataset({ name: 'Google Sheet · ' + new Date().toLocaleDateString(), text, url });
        if (ds) go(`work/reports/${ds.id}`);
      } catch { toast('Could not fetch that sheet — check the sharing setting.', 'bad'); }
    },
  }));

  on('[data-ds]', 'click', (e, el) => {
    if (e.target.closest('[data-delds]')) return;
    go(`work/reports/${el.dataset.ds}`);
  }, view);
  on('[data-delds]', 'click', (e, el) => {
    e.stopPropagation();
    const ds = DB.datasets.find((d) => d.id === el.dataset.delds);
    confirmDialog('Remove dataset', `“${ds ? ds.name : ''}” will be removed from the desk. The original file is untouched.`, () => {
      DB.datasets = DB.datasets.filter((d) => d.id !== el.dataset.delds);
      saveRender('datasets');
    }, 'Remove');
  }, view);

  if (exams.length >= 2) {
    const a = analyseExam(exams[0]);
    setTimeout(() => drawChart('crossTrend', {
      type: 'line',
      data: {
        labels: a.trend.periods,
        datasets: a.trend.series.slice(0, 8).map((s, i) => ({
          label: s.name, data: s.data, borderColor: PALETTE[i % PALETTE.length],
          backgroundColor: PALETTE[i % PALETTE.length], tension: .3, spanGaps: true, pointRadius: 3,
        })),
      },
    }), 0);
  }
}
PAGES['work/reports'] = renderReports;

/* ------------------------------------------------------- one dataset page */

function roleOf(ds, header) {
  const m = ds.map || {};
  return Object.keys(m).find((k) => m[k] === header) || '';
}

function columnsDialog(ds) {
  const roles = ds.kind === 'exam' ? EXAM_ROLES : ds.kind === 'survey' ? SURVEY_ROLES : [];
  const opts = (sel) => `<option value="">— not mapped —</option>` +
    ds.headers.map((h) => `<option value="${attr(h)}"${sel === h ? ' selected' : ''}>${esc(h.length > 70 ? h.slice(0, 70) + '…' : h)}</option>`).join('');
  openDialog({
    title: 'Columns',
    wide: true,
    body: `<label class="f"><span>Dataset kind</span><select name="kind">
        ${['exam', 'survey', 'generic'].map((k) => `<option value="${k}"${ds.kind === k ? ' selected' : ''}>${k}</option>`).join('')}
      </select></label>
      <p class="mini">Changing the kind re-detects the columns when you save.</p>
      ${roles.map(([role, label]) => `<label class="f"><span>${esc(label)}</span>
        <select name="role_${role}">${opts((ds.map || {})[role] || '')}</select></label>`).join('')}
      ${ds.kind === 'exam' ? `<label class="f"><span>Week label (used when the file has no date column)</span>
        <input name="week" value="${attr(ds.week || '')}" placeholder="2026-W35"></label>` : ''}`,
    onSubmit: (d) => {
      if (d.kind !== ds.kind) { ds.kind = d.kind; ds.map = autoMap(d.kind, ds.headers); }
      else {
        const m = {};
        roles.forEach(([role]) => { const v = d['role_' + role]; if (v) m[role] = v; });
        ds.map = m;
      }
      if (d.week !== undefined) ds.week = d.week.trim();
      saveRender('datasets');
    },
  });
}

function rankTable(rows, scale, cols) {
  if (!rows.length) return emptyState('Nothing to rank', 'No rows carried this column — map it under Columns.');
  const maxMedian = Math.max(...rows.map((r) => r.median || 0)) || 1;
  return `<div class="scroll-x"><table class="data"><thead><tr>
      <th>${esc(cols.label)}</th><th class="n">median</th><th></th><th class="n">avg</th><th class="n">n</th>
      <th class="n">≥${scale.t1}</th><th class="n">≥${scale.t2}</th><th class="n">best</th>${cols.prev ? '<th class="n">vs prev</th>' : ''}
    </tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td>${esc(r.key)}${r.teacher ? `<span class="mut"> · ${esc(r.teacher)}</span>` : ''}</td>
      <td class="n">${r.median}</td>
      <td style="width:110px"><span class="hbar" style="width:${Math.round((r.median / maxMedian) * 100)}px"></span></td>
      <td class="n">${r.avg}</td><td class="n">${r.n}</td>
      <td class="n">${r.t1}%</td><td class="n">${r.t2}%</td><td class="n">${r.best}</td>
      ${cols.prev ? `<td class="n">${r.change == null ? '<span class="mut">—</span>' : `<span class="${r.change > 0 ? 'delta up' : r.change < 0 ? 'delta down' : 'mut'}">${r.change > 0 ? '▲' : r.change < 0 ? '▼' : ''} ${Math.abs(r.change)}</span>`}</td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;
}

function rawTable(ds) {
  const rows = ds.rows.slice(0, 200);
  return `<details class="panel raw"><summary>Raw data · ${ds.rows.length} rows${ds.rows.length > 200 ? ' (first 200 shown)' : ''}</summary>
    <div class="scroll-x scroll-y"><table class="data"><thead><tr>${ds.headers.map((h) => {
      const role = roleOf(ds, h);
      return `<th>${esc(h.length > 40 ? h.slice(0, 40) + '…' : h)}${role ? `<span class="badge-role">${esc(role)}</span>` : ''}</th>`;
    }).join('')}</tr></thead><tbody>
    ${rows.map((r) => `<tr>${ds.headers.map((h) => `<td>${esc(String(r[h] ?? '').slice(0, 90))}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></details>`;
}

function findingsHTML(list) {
  if (!list.length) return emptyState('Nothing to report', 'Map at least a score column under Columns.');
  return `<div class="findings">${list.map((f) => `<div class="finding ${f.kind || ''}"><span>${f.text}</span></div>`).join('')}</div>`;
}

function renderDataset(view, r) {
  const ds = DB.datasets.find((d) => d.id === r.param);
  if (!ds) { view.innerHTML = emptyState('Dataset not found', 'It may have been removed. Go back to Reports.'); return; }
  topbar(ds.name, {
    crumb: `<a href="${href('work/reports')}">Reports</a> · ${esc(ds.kind)} · ${ds.rows.length} rows`,
    actions: `${ds.url ? `<button class="btn" id="refetch">Refetch sheet</button>` : ''}<button class="btn" id="cols">Columns</button>`,
  });
  view.innerHTML = `<div id="reportbody"></div>`;
  $('#cols').addEventListener('click', () => columnsDialog(ds));
  const rf = $('#refetch');
  if (rf) rf.addEventListener('click', async () => {
    try { await refetchSheet(ds); toast('Sheet refetched'); render(); }
    catch (err) { toast(String(err.message || err), 'bad'); }
  });

  const host = $('#reportbody');
  if (ds.kind === 'exam') renderExamReport(host, ds);
  else if (ds.kind === 'survey') renderSurveyReport(host, ds);
  else renderGenericReport(host, ds);

  if (ds.url) refetchSheet(ds).then(() => { if (route().param === ds.id) render(); }).catch(() => {});
}

function renderExamReport(host, ds) {
  const a = analyseExam(ds);
  const u = a.scale.unit;
  if (!a.cur.length) {
    host.innerHTML = emptyState('No scores read', 'Open Columns and point “Score” at the right column — nothing numeric came through.');
    return;
  }
  host.innerHTML = `
    <div class="stats">
      ${statBox(a.kpi.median + u, 'median', deltaHTML(a.kpi.median, a.kpi.medianPrev, { unit: u }))}
      ${statBox(a.kpi.avg + u, 'average', deltaHTML(a.kpi.avg, a.kpi.avgPrev, { unit: u }))}
      ${statBox(a.kpi.n, 'students sat', deltaHTML(a.kpi.n, a.kpi.nPrev, { p: 0 }))}
      ${statBox(a.kpi.t1 + '%', `at or above ${a.scale.t1}${u}`, deltaHTML(a.kpi.t1, a.kpi.t1Prev, { unit: 'pp' }))}
      ${statBox(a.kpi.t2 + '%', `above ${a.scale.t2}${u}`, deltaHTML(a.kpi.t2, a.kpi.t2Prev, { unit: 'pp' }))}
      ${statBox(a.kpi.low, `below ${a.scale.low}${u}`, deltaHTML(a.kpi.low, a.kpi.lowPrev, { p: 0, lowerIsBetter: true }))}
    </div>
    ${panel(`Findings · ${a.current}${a.prev ? ` vs ${a.prev}` : ''}`, findingsHTML(examFindings(a)), { sub: `${a.scale.name} scale detected` })}
    <div class="grid g-side">
      ${panel('Median by teacher', `<div class="chart-wrap"><canvas id="exTeacher"></canvas></div>`, { sub: 'across every uploaded week' })}
      ${panel('Score distribution', `<div class="chart-wrap"><canvas id="exDist"></canvas></div>`, { sub: `red below ${a.scale.low}${u}` })}
    </div>
    ${panel('Teachers', rankTable(a.byTeacher, a.scale, { label: 'teacher', prev: true }), { sub: a.byTeacher.some((t) => a.cur.find((r) => r.teacher === t.key && r.attributed)) ? 'attributed through group lists where the file had no teacher column' : '' })}
    ${panel('Groups', rankTable(a.byGroup.map((g) => ({ ...g, teacher: g.teacher || '(no teacher set)' })), a.scale, { label: 'group' }))}
    ${a.byExam.length ? panel('Exams', rankTable(a.byExam, a.scale, { label: 'exam' })) : ''}
    ${a.byBranch.length ? panel('Branches', rankTable(a.byBranch, a.scale, { label: 'branch' })) : ''}
    <div class="grid g2">
      ${panel('Student movers', a.movers.length ? `<div class="scroll-y"><table class="data">
        <thead><tr><th>student</th><th>group</th><th class="n">${a.prev}</th><th class="n">${a.current}</th><th class="n">Δ</th></tr></thead><tbody>
        ${[...a.movers.slice(0, 8), ...a.movers.slice(-8).reverse()].filter((v, i, arr) => arr.indexOf(v) === i).map((m) => `<tr>
          <td>${esc(m.student)}</td><td class="mut">${esc(m.group)}</td><td class="n">${m.from}</td><td class="n">${m.to}</td>
          <td class="n"><span class="${m.change > 0 ? 'delta up' : m.change < 0 ? 'delta down' : 'mut'}">${m.change > 0 ? '+' : ''}${m.change}</span></td></tr>`).join('')}
        </tbody></table></div>` : emptyState('No matched students', 'Upload a second week and names common to both are matched automatically.'), { flush: true, sub: 'top gains and drops' })}
      ${panel('Needs attention', (() => {
        const risky = a.cur.filter((r) => r.score < a.scale.low).sort((x, y) => x.score - y.score).slice(0, 12);
        return risky.length ? `<div class="list">${risky.map((r) => `<div class="list-row">
          <div class="grow"><div class="t">${esc(r.student || '(unnamed)')}</div><div class="m">${esc(r.group || 'no group')}${r.teacher ? ' · ' + esc(r.teacher) : ''}</div></div>
          <span class="pill bad">${r.score}${u}</span></div>`).join('')}</div>`
          : emptyState('Nobody below the line', `Every student sat at or above ${a.scale.low}${u} this period.`);
      })(), { flush: true })}
    </div>
    ${rawTable(ds)}`;

  drawChart('exTeacher', {
    type: 'line',
    data: {
      labels: a.trend.periods,
      datasets: a.trend.series.slice(0, 8).map((s, i) => ({
        label: s.name, data: s.data, borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length],
        tension: .3, spanGaps: true, pointRadius: 3,
      })),
    },
  });
  drawChart('exDist', {
    type: 'bar',
    data: {
      labels: a.dist.map((d) => d.label),
      datasets: [{
        label: 'students', data: a.dist.map((d) => d.count),
        backgroundColor: a.dist.map((d) => (d.from < a.scale.low ? cssVar('--bad') : d.from >= a.scale.t2 ? cssVar('--accent') : cssVar('--line-2'))),
        borderRadius: 4,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

function renderSurveyReport(host, ds) {
  const a = analyseSurvey(ds);
  if (!a.cur.length) {
    host.innerHTML = emptyState('No usable responses', 'Open Columns and point “Class rating (CSAT)” and “Teacher” at the right questions.');
    return;
  }
  host.innerHTML = `
    <div class="stats">
      ${statBox(a.kpi.responses, 'responses', deltaHTML(a.kpi.responses, a.kpi.responsesPrev, { p: 0 }))}
      ${statBox(a.kpi.csat == null ? '—' : `${a.kpi.csat}/${a.scale}`, 'CSAT', deltaHTML(a.kpi.csat, a.kpi.csatPrev, { p: 2 }))}
      ${statBox(a.kpi.nps == null ? '—' : a.kpi.nps, 'NPS', deltaHTML(a.kpi.nps, a.kpi.npsPrev, { p: 0 }))}
      ${statBox(a.kpi.unhappy, 'unhappy', deltaHTML(a.kpi.unhappy, a.kpi.unhappyPrev, { p: 0, lowerIsBetter: true }))}
    </div>
    ${panel(`Findings · ${monthLabel(a.current)}${a.prev ? ` vs ${monthLabel(a.prev)}` : ''}`, findingsHTML(surveyFindings(a)), { sub: `rating scale 1–${a.scale}` })}
    <div class="grid g-side">
      ${panel('CSAT by teacher', `<div class="chart-wrap"><canvas id="svCsat"></canvas></div>`, { sub: 'month by month' })}
      ${panel('Recommendation spread', `<div class="chart-wrap"><canvas id="svNps"></canvas></div>`, { sub: '0–6 detractors · 7–8 passives · 9–10 promoters' })}
    </div>
    ${panel('Teachers', a.teacherRows.length ? `<div class="scroll-x"><table class="data"><thead><tr>
        <th>teacher</th><th class="n">n</th><th class="n">CSAT</th><th></th><th class="n">NPS</th><th class="n">pro</th><th class="n">det</th><th class="n">unhappy</th><th class="n">vs prev</th>
      </tr></thead><tbody>
      ${a.teacherRows.map((t) => `<tr>
        <td>${esc(t.key)}${t.n < 5 ? ' <span class="pill warn">small n</span>' : ''}</td>
        <td class="n">${t.n}</td><td class="n">${t.csat == null ? '—' : t.csat}</td>
        <td style="width:110px"><span class="hbar" style="width:${Math.round(((t.csat || 0) / a.scale) * 100)}px"></span></td>
        <td class="n">${t.nps == null ? '—' : t.nps}</td><td class="n">${t.promoters}</td><td class="n">${t.detractors}</td><td class="n">${t.unhappy}</td>
        <td class="n">${t.change == null ? '<span class="mut">—</span>' : `<span class="${t.change > 0 ? 'delta up' : t.change < 0 ? 'delta down' : 'mut'}">${t.change > 0 ? '▲' : '▼'} ${Math.abs(t.change)}</span>`}</td>
      </tr>`).join('')}</tbody></table></div>` : emptyState('No teacher column', 'Map the “choose your English teacher” question under Columns.'))}
    ${panel(`Comments · ${a.comments.length}`, a.comments.length ? `<div class="list">${a.comments.slice(0, 40).map((c) => `
      <div class="list-row"><div class="grow"><div class="t">${esc(c.comment)}</div>
        <div class="m">${esc(c.teacher || 'no teacher')}${c.group ? ' · ' + esc(c.group) : ''}${c.student ? ' · ' + esc(c.student) : ''}</div></div>
      ${c.csat != null ? `<span class="pill ${c.csat <= a.scale * 0.6 ? 'bad' : c.csat >= a.scale * 0.85 ? 'ok' : 'warn'}">${c.csat}/${a.scale}</span>` : ''}
      ${c.nps != null ? `<span class="pill ${c.nps <= 6 ? 'bad' : c.nps <= 8 ? '' : 'ok'}">NPS ${c.nps}</span>` : ''}
      </div>`).join('')}</div>` : emptyState('No written comments', 'Map the “what needs improvement” question under Columns to surface them here.'), { flush: true, sub: 'worst rating first' })}
    ${rawTable(ds)}`;

  drawChart('svCsat', {
    type: 'line',
    data: {
      labels: a.trend.months.map(monthLabel),
      datasets: a.trend.series.slice(0, 8).map((s, i) => ({
        label: s.name, data: s.data, borderColor: PALETTE[i % PALETTE.length], backgroundColor: PALETTE[i % PALETTE.length],
        tension: .3, spanGaps: true, pointRadius: 3,
      })),
    },
    options: { scales: { y: { suggestedMin: 0, suggestedMax: a.scale } } },
  });
  drawChart('svNps', {
    type: 'bar',
    data: {
      labels: a.npsDist.map((d) => d.v),
      datasets: [{
        label: 'responses', data: a.npsDist.map((d) => d.count), borderRadius: 4,
        backgroundColor: a.npsDist.map((d) => (d.v <= 6 ? cssVar('--bad') : d.v <= 8 ? cssVar('--line-2') : cssVar('--ok'))),
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

function renderGenericReport(host, ds) {
  const a = analyseGeneric(ds);
  host.innerHTML = `
    ${panel('Unrecognised shape', `<div class="finding warn"><span>This file did not look like an exam export or the quality survey, so it is summarised generically.
      Use <b>Columns</b> to set the kind and map the roles, and the full engine takes over.</span></div>`)}
    ${panel('Numeric columns', a.stats.length ? `<div class="scroll-x"><table class="data"><thead><tr>
      <th>column</th><th class="n">n</th><th class="n">mean</th><th class="n">median</th><th class="n">min</th><th class="n">max</th></tr></thead><tbody>
      ${a.stats.map((s) => `<tr><td>${esc(s.key)}</td><td class="n">${s.n}</td><td class="n">${s.mean}</td><td class="n">${s.median}</td><td class="n">${s.min}</td><td class="n">${s.max}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('No numeric columns', 'Nothing in this file parses as a number.'), { flush: true })}
    ${a.bars.length ? panel(`Mean ${esc(a.measure)} by ${esc(a.cat)}`, `<div class="chart-wrap"><canvas id="gnBar"></canvas></div>`) : ''}
    ${a.bars.length ? panel('Ranking', `<div class="scroll-x"><table class="data"><thead><tr><th>${esc(a.cat)}</th><th class="n">mean</th><th class="n">n</th></tr></thead>
      <tbody>${a.bars.map((b) => `<tr><td>${esc(b.key)}</td><td class="n">${b.mean}</td><td class="n">${b.n}</td></tr>`).join('')}</tbody></table></div>`, { flush: true }) : ''}
    ${rawTable(ds)}`;
  if (a.bars.length) drawChart('gnBar', {
    type: 'bar',
    data: { labels: a.bars.map((b) => b.key), datasets: [{ label: a.measure, data: a.bars.map((b) => b.mean), backgroundColor: cssVar('--accent'), borderRadius: 4 }] },
    options: { plugins: { legend: { display: false } } },
  });
}

/* ------------------------------------------- teacher scorecard from datasets */
function teacherScorecardHTML(teacher) {
  const keys = new Set((teacher.groups || []).map(groupKey));
  const nameKey = normName(teacher.name);
  const examDs = DB.datasets.filter((d) => d.kind === 'exam');
  const surveyDs = DB.datasets.filter((d) => d.kind === 'survey');

  const exam = examDs.flatMap(examRecords).filter((r) => normName(r.teacher) === nameKey || keys.has(groupKey(r.group)));
  const survey = surveyDs.flatMap(surveyRecords).filter((r) => normName(r.teacher) === nameKey || keys.has(groupKey(r.group)));

  if (!exam.length && !survey.length) {
    return panel('Scorecard', emptyState('No data matched this teacher',
      'Upload an exam or survey CSV on the Reports page, and list their groups under Edit → Admin so group-only files attribute correctly.'));
  }

  let examBlock = '';
  if (exam.length) {
    const scale = detectScale(exam);
    const weeks = [...new Set(exam.map((r) => r.week))].sort();
    const last = weeks[weeks.length - 1];
    const cur = exam.filter((r) => r.week === last);
    const scores = cur.map((r) => r.score);
    const prevWeek = weeks[weeks.length - 2];
    const prevScores = prevWeek ? exam.filter((r) => r.week === prevWeek).map((r) => r.score) : [];
    examBlock = `<div class="stats" style="margin-bottom:12px">
      ${statBox(round(median(scores), 1) + scale.unit, `median · ${last}`, deltaHTML(round(median(scores), 1), prevScores.length ? round(median(prevScores), 1) : null, { unit: scale.unit }))}
      ${statBox(cur.length, 'students sat')}
      ${statBox(pct(scores.filter((s) => s >= scale.t2).length, scores.length) + '%', `above ${scale.t2}${scale.unit}`)}
    </div>`;
  }

  let surveyBlock = '';
  if (survey.length) {
    const scale = ratingScale(survey);
    const months = [...new Set(survey.map((r) => r.month))].sort();
    const last = months[months.length - 1];
    const cur = survey.filter((r) => r.month === last);
    const csat = cur.map((r) => r.csat).filter((v) => v != null);
    const npsVals = cur.map((r) => r.nps).filter((v) => v != null);
    const promoters = npsVals.filter((v) => v >= 9).length;
    const detractors = npsVals.filter((v) => v <= 6).length;
    const nps = npsVals.length ? Math.round((promoters / npsVals.length - detractors / npsVals.length) * 100) : null;
    const comments = cur.filter((r) => r.comment).sort((a, b) => (a.csat ?? 99) - (b.csat ?? 99)).slice(0, 4);
    surveyBlock = `<div class="stats" style="margin-bottom:12px">
      ${statBox(csat.length ? `${round(mean(csat), 2)}/${scale}` : '—', `class rating · ${monthLabel(last)}`)}
      ${statBox(nps == null ? '—' : nps, 'NPS', `<div class="delta flat">${promoters} promoters · ${detractors} detractors</div>`)}
      ${statBox(cur.length, 'responses')}
    </div>
    ${comments.length ? `<div class="mini b" style="margin:6px 0">LATEST COMMENTS</div>${comments.map((c) => `
      <div class="list-row" style="padding:6px 0"><div class="grow"><div class="t">${esc(c.comment)}</div></div>
      ${c.csat != null ? `<span class="pill ${c.csat <= scale * .6 ? 'bad' : 'ok'}">${c.csat}/${scale}</span>` : ''}</div>`).join('')}` : ''}`;
  }

  return panel('Scorecard', examBlock + surveyBlock, { sub: 'from the uploaded datasets' });
}

/* ========================================================== 7. university */

const SLOT_TYPES = [['lecture', 'Lecture'], ['tutorial', 'Tutorial'], ['lab', 'Lab'], ['seminar', 'Seminar'], ['other', 'Other']];
const DAYS6 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const courseById = (id) => (DB.uni.courses || []).find((c) => c.id === id);
const courseName = (id) => (courseById(id) || {}).name || '';
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? +m[1] * 60 + +m[2] : null; };
const fromMin = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const slotsOf = (courseId) => (DB.uni.slots || []).filter((s) => s.courseId === courseId);
const weeklyHours = () => round(sum((DB.uni.slots || []).map((s) => Math.max(0, (toMin(s.end) - toMin(s.start)) / 60))), 1);

function allExams() {
  return (DB.uni.courses || []).flatMap((c) => (c.exams || []).map((e) => ({ ...e, courseId: c.id, course: c.name })))
    .filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
}
function nextExam() { return allExams().find((e) => daysUntil(e.date) >= 0) || null; }
function semester() {
  const { semStart, semEnd } = DB.settings;
  const a = fromISO(semStart), b = fromISO(semEnd);
  if (!a || !b || b <= a) return null;
  const now = new Date();
  const total = daysBetween(a, b);
  const gone = clamp(daysBetween(a, now), 0, total);
  return { start: a, end: b, total, gone, left: total - gone, pct: Math.round((gone / total) * 100), week: Math.floor(gone / 7) + 1, weeks: Math.ceil(total / 7) };
}
function classesOn(dayIdx) { // 0 = Monday
  return (DB.uni.slots || []).filter((s) => Number(s.day) === dayIdx).sort((a, b) => (toMin(a.start) || 0) - (toMin(b.start) || 0));
}

function renderUniOverview(view) {
  const sem = semester();
  const today = (new Date().getDay() + 6) % 7; // 0 = Monday
  const todays = today <= 5 ? classesOn(today) : [];
  const deadlines = deadlineRows('uni');
  const overdue = deadlines.filter((d) => daysUntil(d.due) < 0);
  const ne = nextExam();

  topbar(greeting(), {
    crumb: new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    actions: `<button class="btn primary" id="newtask">+ Task</button>`,
  });

  view.innerHTML = `
    ${sem ? `<section class="panel"><div class="body">
      <div class="spread" style="margin-bottom:8px">
        <div><span class="b">Semester week ${sem.week}</span> <span class="mut">of ${sem.weeks}</span></div>
        <div class="mini num">${sem.left} days left · ${sem.pct}%</div>
      </div>
      <div class="bar"><i style="width:${sem.pct}%"></i></div>
      <div class="mini" style="margin-top:6px">${esc(fmtDate(toISO(sem.start)))} → ${esc(fmtDate(toISO(sem.end)))}</div>
    </div></section>`
      : `<div class="empty"><strong>No semester dates yet</strong>Set the start and end in Settings to unlock the progress bar and week number.</div>`}

    <div class="stats">
      ${statBox(DB.uni.courses.length, 'courses', `<div class="delta flat">${weeklyHours()} h/week</div>`)}
      ${statBox(todays.length, 'classes today')}
      ${statBox(overdue.length, 'overdue')}
      ${statBox(ne ? daysUntil(ne.date) : '—', 'days to next exam', ne ? `<div class="delta flat">${esc(ne.course)}</div>` : '')}
    </div>

    <div class="grid g-side">
      ${panel("Today's classes", todays.length ? `<div class="list">${todays.map((s) => `
        <div class="list-row click" data-slot="${attr(s.id)}"><div class="grow">
          <div class="t">${esc(courseName(s.courseId) || 'Unassigned')}</div>
          <div class="m">${esc(titleCase(s.type))}${s.room ? ' · ' + esc(s.room) : ''}</div></div>
        <span class="pill num">${esc(s.start)}–${esc(s.end)}</span></div>`).join('')}</div>`
        : emptyState(today > 5 ? 'Nothing on a Sunday' : 'No classes today', 'Add your week on the Timetable page.'), { flush: true })}

      ${panel('Deadlines', deadlines.length ? `<div class="list">${deadlines.slice(0, 10).map((d) => `
        <div class="list-row click" data-open-task="${attr(d.id)}"><div class="grow">
          <div class="t trunc">${esc(d.label)}</div><div class="m">${d.kind === 'step' ? 'step' : 'final deadline'}</div></div>
        <span class="pill ${dueClass(d.due)}">${esc(relDays(d.due))}</span></div>`).join('')}</div>`
        : emptyState('Nothing due', 'Add a task with steps and every step deadline shows up here.'), { flush: true })}
    </div>

    <div class="grid g-side">
      ${panel('Exams', allExams().length ? `<div class="list">${allExams().slice(0, 8).map((e) => `
        <div class="list-row click" data-course="${attr(e.courseId)}"><div class="grow">
          <div class="t">${esc(e.course)}</div><div class="m">${esc(fmtDate(e.date))}${e.time ? ' · ' + esc(e.time) : ''}${e.room ? ' · ' + esc(e.room) : ''}</div></div>
        <span class="pill ${dueClass(e.date)}">${esc(relDays(e.date))}</span></div>`).join('')}</div>`
        : emptyState('No exams scheduled', 'Open a course and add its exam date — the countdown appears everywhere.'), { flush: true })}

      ${panel('Courses', DB.uni.courses.length ? `<div class="list">${DB.uni.courses.map((c) => `
        <div class="list-row click" data-course="${attr(c.id)}"><div class="grow">
          <div class="t">${esc(c.name)}</div><div class="m">${esc(c.code || '')}${c.instructor ? ' · ' + esc(c.instructor) : ''}</div></div>
        <span class="pill">${slotsOf(c.id).length} slots</span></div>`).join('')}</div>`
        : emptyState('No courses yet', 'Add courses first — the timetable, exams and konspekty all hang off them.'), { flush: true })}
    </div>`;

  $('#newtask').addEventListener('click', () => taskDialog(null, 'uni'));
  on('[data-course]', 'click', (e, el) => go(`uni/courses/${el.dataset.course}`), view);
  on('[data-slot]', 'click', (e, el) => go('uni/timetable'), view);
  on('[data-open-task]', 'click', (e, el) => { const t = taskById(el.dataset.openTask); if (t) taskDialog(t, 'uni'); }, view);
}
PAGES['uni/overview'] = renderUniOverview;

/* ---- timetable ---- */
function slotDialog(existing) {
  const s = existing || { id: uid(), courseId: (DB.uni.courses[0] || {}).id || '', type: 'lecture', day: 0, start: '09:00', end: '10:30', room: '' };
  if (!DB.uni.courses.length) { toast('Add a course first — slots hang off courses.', 'bad'); return; }
  openDialog({
    title: existing ? 'Edit class' : 'Add class',
    body: `
      <label class="f"><span>Course</span><select name="courseId">${DB.uni.courses.map((c) => `<option value="${attr(c.id)}"${s.courseId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="row">
        <label class="f"><span>Type</span><select name="type">${SLOT_TYPES.map(([v, l]) => `<option value="${v}"${s.type === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f"><span>Day</span><select name="day">${DAYS6.map((d, i) => `<option value="${i}"${Number(s.day) === i ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <div class="row">
        <label class="f"><span>Start</span><input name="start" type="time" value="${attr(s.start)}"></label>
        <label class="f"><span>End</span><input name="end" type="time" value="${attr(s.end)}"></label>
      </div>
      <label class="f"><span>Room</span><input name="room" value="${attr(s.room || '')}" placeholder="e.g. B-204"></label>`,
    extraFooter: existing ? `<button type="button" class="btn danger left" id="delslot">Delete</button>` : '',
    onOpen: (dlg, close) => {
      const del = $('#delslot', dlg);
      if (del) del.addEventListener('click', () => {
        DB.uni.slots = DB.uni.slots.filter((x) => x.id !== s.id);
        close(); saveRender('uni');
      });
    },
    onSubmit: (d) => {
      if (toMin(d.end) == null || toMin(d.start) == null || toMin(d.end) <= toMin(d.start)) { toast('The end time has to come after the start.', 'bad'); return false; }
      Object.assign(s, { courseId: d.courseId, type: d.type, day: Number(d.day), start: d.start, end: d.end, room: d.room.trim() });
      if (!existing) DB.uni.slots.push(s);
      saveRender('uni');
    },
  });
}

function renderTimetable(view) {
  topbar('Timetable', { actions: `<button class="btn primary" id="addslot">+ Class</button>` });
  const slots = DB.uni.slots || [];
  const starts = slots.map((s) => toMin(s.start)).filter((v) => v != null);
  const ends = slots.map((s) => toMin(s.end)).filter((v) => v != null);
  const from = Math.floor(Math.min(8 * 60, ...(starts.length ? starts : [8 * 60])) / 60) * 60;
  const to = Math.ceil(Math.max(19 * 60, ...(ends.length ? ends : [19 * 60])) / 60) * 60;
  const hours = (to - from) / 60;
  const PX = 52;
  const todayIdx = (new Date().getDay() + 6) % 7;

  view.innerHTML = `
    ${slots.length ? '' : `<div class="empty"><strong>Empty week</strong>Add your first class with <b>+ Class</b> — blocks are positioned by their real start and end times.</div>`}
    <div class="tt" style="grid-template-rows:auto ${hours * PX}px">
      <div class="hd corner"></div>
      ${DAYS6.map((d, i) => `<div class="hd${i === todayIdx ? ' b' : ''}">${d}</div>`).join('')}
      <div class="hours">${Array.from({ length: hours }, (_, i) => `<div class="hourlab">${fromMin(from + i * 60)}</div>`).join('')}</div>
      ${DAYS6.map((d, i) => `<div class="col" data-day="${i}">
        ${Array.from({ length: hours }, () => `<div class="hourline"></div>`).join('')}
        ${classesOn(i).map((s) => {
          const top = ((toMin(s.start) - from) / 60) * PX;
          const h = Math.max(20, ((toMin(s.end) - toMin(s.start)) / 60) * PX - 2);
          return `<div class="ttblock type-${esc(s.type)}" data-slot="${attr(s.id)}" style="top:${top}px;height:${h}px">
            <b>${esc(courseName(s.courseId) || 'Unassigned')}</b>${esc(s.start)}–${esc(s.end)}${s.room ? ' · ' + esc(s.room) : ''}
            <div style="opacity:.8">${esc(titleCase(s.type))}</div></div>`;
        }).join('')}
      </div>`).join('')}
    </div>
    <div class="wrap">${SLOT_TYPES.map(([v, l]) => `<span class="pill"><span class="dot type-${v}" style="width:9px;height:9px"></span>${l}</span>`).join('')}</div>`;

  $('#addslot').addEventListener('click', () => slotDialog(null));
  on('[data-slot]', 'click', (e, el) => {
    e.stopPropagation();
    slotDialog((DB.uni.slots || []).find((s) => s.id === el.dataset.slot));
  }, view);
}
PAGES['uni/timetable'] = renderTimetable;

/* ---- courses ---- */
function courseDialog(existing) {
  const c = existing || { id: uid(), name: '', code: '', instructor: '', credits: '', exams: [] };
  openDialog({
    title: existing ? 'Edit course' : 'New course',
    body: `<label class="f"><span>Name</span><input name="name" value="${attr(c.name)}"></label>
      <div class="row">
        <label class="f"><span>Code</span><input name="code" value="${attr(c.code || '')}" placeholder="MATH-201"></label>
        <label class="f"><span>Credits</span><input name="credits" value="${attr(c.credits || '')}"></label>
      </div>
      <label class="f"><span>Instructor</span><input name="instructor" value="${attr(c.instructor || '')}"></label>
      <p class="mini">No grades and no GPA anywhere — on purpose.</p>`,
    extraFooter: existing ? `<button type="button" class="btn danger left" id="delcourse">Delete</button>` : '',
    onOpen: (dlg, close) => {
      const del = $('#delcourse', dlg);
      if (del) del.addEventListener('click', () => {
        close();
        confirmDialog('Delete course', `“${c.name}” and its timetable slots will be removed. Tasks keep their text but lose the course tag.`, () => {
          DB.uni.courses = DB.uni.courses.filter((x) => x.id !== c.id);
          DB.uni.slots = DB.uni.slots.filter((s) => s.courseId !== c.id);
          DB.tasks.forEach((t) => { if (t.course === c.id) t.course = ''; });
          save('uni', 'tasks'); go('uni/courses'); render();
        });
      });
    },
    onSubmit: (d) => {
      if (!d.name.trim()) return false;
      Object.assign(c, { name: d.name.trim(), code: d.code.trim(), credits: d.credits.trim(), instructor: d.instructor.trim() });
      if (!existing) { c.exams = []; DB.uni.courses.push(c); }
      saveRender('uni');
    },
  });
}

function renderCourses(view, r) {
  if (r.param) return renderCoursePage(view, r);
  topbar('Courses', { actions: `<button class="btn primary" id="addcourse">+ Course</button>` });
  const cs = DB.uni.courses || [];
  view.innerHTML = cs.length ? `<div class="grid g3">${cs.map((c) => {
    const slots = slotsOf(c.id);
    const types = [...new Set(slots.map((s) => s.type))];
    const hours = round(sum(slots.map((s) => (toMin(s.end) - toMin(s.start)) / 60)), 1);
    const ex = (c.exams || []).filter((e) => e.date && daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `<section class="panel click" data-course="${attr(c.id)}" style="cursor:pointer">
      <div class="body">
        <h3 style="font-size:16px">${esc(c.name)}</h3>
        <div class="mini" style="margin:3px 0 10px">${esc(c.code || 'no code')}${c.instructor ? ' · ' + esc(c.instructor) : ''}</div>
        <div class="wrap">${types.map((t) => `<span class="pill">${esc(titleCase(t))}</span>`).join('') || '<span class="pill">no classes yet</span>'}</div>
        <div class="wrap" style="margin-top:10px">
          ${c.credits ? `<span class="mini num">${esc(c.credits)} credits</span>` : ''}
          <span class="mini num">${hours} h/week</span>
          ${ex ? `<span class="pill ${dueClass(ex.date)}">exam ${esc(relDays(ex.date))}</span>` : ''}
        </div>
      </div></section>`;
  }).join('')}</div>` : emptyState('No courses yet', 'Add one with + Course — the timetable, exams, tasks and konspekty all attach to it.');
  $('#addcourse').addEventListener('click', () => courseDialog(null));
  on('[data-course]', 'click', (e, el) => go(`uni/courses/${el.dataset.course}`), view);
}
PAGES['uni/courses'] = renderCourses;

function renderCoursePage(view, r) {
  const c = courseById(r.param);
  if (!c) { view.innerHTML = emptyState('Course not found', 'Pick one from the Courses page.'); return; }
  if (!Array.isArray(c.exams)) c.exams = [];
  const slots = slotsOf(c.id);
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = [...slots].sort((a, b) => {
    const ra = ((Number(a.day) - todayIdx + 7) % 7) * 1440 + toMin(a.start);
    const rb = ((Number(b.day) - todayIdx + 7) % 7) * 1440 + toMin(b.start);
    const fix = (x, s) => (Number(s.day) === todayIdx && toMin(s.end) < nowMin ? x + 7 * 1440 : x);
    return fix(ra, a) - fix(rb, b);
  })[0];
  const ex = c.exams.filter((e) => e.date && daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  const tasks = DB.tasks.filter((t) => t.face === 'uni' && t.course === c.id && t.status !== 'done');
  const steps = tasks.flatMap((t) => (t.steps || []).filter((s) => !s.done && s.due).map((s) => ({ label: `${t.title} › ${s.text}`, due: s.due, id: t.id })));
  const konspekty = courseNotes(c);

  topbar(c.name, {
    crumb: `<a href="${href('uni/courses')}">Courses</a> · ${esc(c.code || 'no code')}${c.instructor ? ' · ' + esc(c.instructor) : ''}`,
    actions: `<button class="btn" id="editcourse">Edit</button><button class="btn" id="addexam">+ Exam</button><button class="btn primary" id="addtask">+ Task</button>`,
  });

  view.innerHTML = `
    <div class="stats">
      ${statBox(upcoming ? `${DAYS6[upcoming.day]} ${upcoming.start}` : '—', 'next class', upcoming ? `<div class="delta flat">${esc(titleCase(upcoming.type))}${upcoming.room ? ' · ' + esc(upcoming.room) : ''}</div>` : '')}
      ${statBox(ex ? daysUntil(ex.date) : '—', 'days to next exam')}
      ${statBox(tasks.length, 'open tasks')}
      ${statBox(konspekty.length, 'konspekty')}
    </div>
    <div class="grid g-side">
      ${panel('Schedule', slots.length ? SLOT_TYPES.filter(([t]) => slots.some((s) => s.type === t)).map(([t, label]) => `
        <div class="mini b" style="margin:8px 0 4px">${label.toUpperCase()}</div>
        ${slots.filter((s) => s.type === t).map((s) => `<div class="list-row" style="padding:6px 0">
          <div class="grow"><span class="t">${DAYS6[s.day]}</span> <span class="m">${esc(s.room || '')}</span></div>
          <span class="pill num">${esc(s.start)}–${esc(s.end)}</span></div>`).join('')}`).join('')
        : emptyState('No classes', 'Add them on the Timetable page and they group by type here.'))}

      ${panel('Exams', c.exams.length ? `<div class="list">${[...c.exams].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => `
        <div class="list-row"><div class="grow"><div class="t">${esc(fmtDate(e.date))}${e.time ? ' · ' + esc(e.time) : ''}</div>
          <div class="m">${esc(e.room || 'no room set')}</div></div>
        <span class="pill ${dueClass(e.date)}">${esc(relDays(e.date))}</span>
        <button class="btn danger sm" data-delexam="${attr(e.id)}">✕</button></div>`).join('')}</div>`
        : emptyState('No exams yet', 'Add the date with + Exam and the countdown shows on every overview.'), { flush: true })}
    </div>
    <div class="grid g-side">
      ${panel('Open tasks', tasks.length ? `<div class="list">${[...tasks.map((t) => ({ label: t.title, due: t.due, id: t.id })), ...steps]
        .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).map((t) => `
        <div class="list-row click" data-open-task="${attr(t.id)}"><div class="grow"><div class="t trunc">${esc(t.label)}</div></div>
        ${t.due ? `<span class="pill ${dueClass(t.due)}">${esc(relDays(t.due))}</span>` : '<span class="m">no date</span>'}</div>`).join('')}</div>`
        : emptyState('No open tasks', 'Add one with + Task — it is tagged to this course automatically.'), { flush: true })}

      ${panel('Konspekty', konspekty.length ? `<div class="list">${konspekty.map((n) => `
        <div class="list-row click" data-note="${attr(n.id)}"><div class="grow"><div class="t trunc">${esc(n.title)}</div>
        <div class="m trunc">${esc(n.path || 'vault root')}</div></div><span class="m">${esc(n.updated ? fmtDay(n.updated) : '')}</span></div>`).join('')}</div>`
        : emptyState('No matching notes', `Any vault note whose title or folder mentions “${esc(c.code || c.name)}” shows up here.`), { flush: true })}
    </div>`;

  $('#editcourse').addEventListener('click', () => courseDialog(c));
  $('#addtask').addEventListener('click', () => taskDialog(null, 'uni', c.id));
  $('#addexam').addEventListener('click', () => openDialog({
    title: 'Add exam',
    body: `<div class="row"><label class="f"><span>Date</span><input name="date" type="date" value="${attr(todayISO())}"></label>
      <label class="f"><span>Time</span><input name="time" type="time" value="09:00"></label></div>
      <label class="f"><span>Room</span><input name="room" placeholder="e.g. Main hall"></label>`,
    onSubmit: (d) => {
      if (!d.date) return false;
      c.exams.push({ id: uid(), date: d.date, time: d.time, room: d.room.trim() });
      saveRender('uni');
    },
  }));
  on('[data-delexam]', 'click', (e, el) => {
    c.exams = c.exams.filter((x) => x.id !== el.dataset.delexam);
    saveRender('uni');
  }, view);
  on('[data-open-task]', 'click', (e, el) => { const t = taskById(el.dataset.openTask); if (t) taskDialog(t, 'uni'); }, view);
  on('[data-note]', 'click', (e, el) => go(`uni/konspekty/${el.dataset.note}`), view);
}

/** Vault notes whose path or title mentions the course code or name. */
function courseNotes(c) {
  const needles = [c.code, c.name].filter(Boolean).map(norm);
  if (!needles.length) return [];
  return DB.notes.filter((n) => {
    const hay = norm(`${n.path || ''} ${n.title || ''}`);
    return needles.some((x) => x.length > 2 && hay.includes(x));
  }).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
}

/* ============================================================== 8. the vault */

function createNote({ title, path = '', body = '', kind = 'md', tags = null }) {
  const note = {
    id: uid(), title: (title || 'Untitled').trim() || 'Untitled',
    path: cleanPath(path), tags: tags || (kind === 'md' ? inlineTags(body) : []),
    kind, updated: nowStamp(), links: extractLinks(body),
  };
  DB.notes.unshift(note);
  saveBody(note.id, body, true);
  save('notes');
  return note;
}
const cleanPath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
const noteById = (id) => DB.notes.find((n) => n.id === id);
function noteByTitle(title) {
  const t = norm(title).replace(/\.md$/, '');
  return DB.notes.find((n) => norm(n.title) === t)
    || DB.notes.find((n) => norm(`${n.path}/${n.title}`) === t)
    || DB.notes.find((n) => norm(n.title).replace(/\.md$/, '') === t);
}
function extractLinks(body) {
  const out = new Set();
  String(body || '').replace(/!?\[\[([^\]]+)\]\]/g, (_, inner) => {
    out.add(String(inner).split('|')[0].split('#')[0].trim());
    return '';
  });
  return [...out];
}
const backlinksOf = (note) => DB.notes.filter((n) => n.id !== note.id && (n.links || []).some((l) => norm(l) === norm(note.title)));

function folders() {
  const set = new Set();
  DB.notes.forEach((n) => {
    const parts = (n.path || '').split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('/'));
  });
  return [...set].sort();
}
function folderDatalist() {
  return `<datalist id="folderlist">${folders().map((f) => `<option value="${attr(f)}"></option>`).join('')}</datalist>`;
}

/** Markdown → HTML with Obsidian wikilinks resolved against the vault. */
function renderMarkdown(body) {
  const withLinks = String(body || '').replace(/(!?)\[\[([^\]]+)\]\]/g, (m, bang, inner) => {
    const [targetRaw, alias] = String(inner).split('|');
    const target = targetRaw.split('#')[0].trim();
    const heading = targetRaw.includes('#') ? targetRaw.split('#')[1].trim() : '';
    const found = noteByTitle(target);
    const label = (alias || targetRaw).trim();
    if (bang) {
      return found
        ? `<a class="wl" data-wl="${attr(target)}">${esc(label)} ↗</a>`
        : `<span class="pill warn">attachment not imported: ${esc(label)}</span>`;
    }
    return `<a class="wl${found ? '' : ' missing'}" data-wl="${attr(target)}"${heading ? ` title="${attr('# ' + heading)}"` : ''}>${esc(label)}</a>`;
  });
  if (typeof marked === 'undefined') return `<pre>${esc(withLinks)}</pre>`;
  return marked.parse(withLinks, { breaks: true, headerIds: false, mangle: false });
}

/* ---- vault page ---- */
function vaultRoot(r) { return r.face === 'uni' ? cleanPath(DB.settings.konspektyRoot || '') : ''; }
function notesIn(root) {
  if (!root) return DB.notes;
  const k = norm(root);
  return DB.notes.filter((n) => norm(n.path) === k || norm(n.path).startsWith(k + '/'));
}

let vaultQuery = '';
function renderVault(view, r) {
  const root = vaultRoot(r);
  const base = r.face === 'uni' ? 'uni/konspekty' : 'shared/notes';
  if (r.param) return renderWriter(view, r, base, root);

  const list = notesIn(root);
  topbar(r.face === 'uni' ? 'Konspekty' : 'Notes', {
    crumb: root ? `scoped to <b>${esc(root)}</b> — change it in Settings` : `${DB.notes.length} notes in the vault`,
    actions: `<button class="btn" id="importvault">Import vault</button>
      <button class="btn" id="newdraw">+ Drawing</button><button class="btn primary" id="newnote">+ Note</button>`,
  });

  const q = norm(vaultQuery);
  const matched = q ? list.filter((n) => norm(`${n.title} ${n.path} ${(n.tags || []).join(' ')}`).includes(q)) : list;
  const sorted = [...matched].sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));

  view.innerHTML = `<input type="file" id="vaultinput" webkitdirectory directory multiple class="sr">
    <div class="vault">
      <section class="panel">
        <div class="body" style="padding:10px">
          <input id="vaultsearch" placeholder="Search title, path, #tag" value="${attr(vaultQuery)}">
        </div>
        <div class="body" style="padding:4px 8px 10px" id="tree">${treeHTML(list, root, r.param)}</div>
        <div class="body mini" style="border-top:1px solid var(--line)">${list.length} note${list.length === 1 ? '' : 's'}${root ? ` under ${esc(root)}` : ''}</div>
      </section>
      <section class="panel">
        <header><h3>${q ? `Search · ${sorted.length}` : 'Recently updated'}</h3></header>
        <div class="body flush">${sorted.length ? `<div class="list">${sorted.slice(0, 120).map((n) => `
          <div class="list-row click" data-note="${attr(n.id)}">
            <div class="grow"><div class="t trunc">${esc(n.title)}${n.kind === 'excalidraw' ? ' <span class="pill">drawing</span>' : ''}</div>
              <div class="m trunc">${esc(n.path || 'vault root')}${(n.tags || []).length ? ' · ' + esc((n.tags || []).map((t) => '#' + t).join(' ')) : ''}</div></div>
            <span class="m">${esc(n.updated ? fmtDay(n.updated) : '')}</span></div>`).join('')}</div>`
          : emptyState(q ? 'No note matches' : 'Empty vault', q ? 'Try a shorter query, or clear the search box.' : 'Create your first note with + Note, or import an Obsidian folder with Import vault.')}
        </div>
      </section>
    </div>`;

  const search = $('#vaultsearch');
  search.addEventListener('input', () => {
    vaultQuery = search.value;
    const pos = search.selectionStart;
    render();
    const s2 = $('#vaultsearch');
    if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); }
  });
  $('#newnote').addEventListener('click', () => {
    const n = createNote({ title: 'Untitled', path: root });
    go(`${base}/${n.id}`);
  });
  $('#newdraw').addEventListener('click', () => {
    const n = createNote({ title: 'Drawing ' + fmtDate(todayISO()), path: root, kind: 'excalidraw', body: '' });
    go(`${base}/${n.id}`);
  });
  const vi = $('#vaultinput');
  $('#importvault').addEventListener('click', () => vi.click());
  vi.addEventListener('change', () => importVault(vi.files));

  on('[data-note]', 'click', (e, el) => go(`${base}/${el.dataset.note}`), view);
  on('[data-fold]', 'click', (e, el) => {
    const f = el.dataset.fold;
    const set = new Set(DB.settings.collapsedFolders || []);
    if (set.has(f)) set.delete(f); else set.add(f);
    DB.settings.collapsedFolders = [...set];
    saveRender('settings');
  }, view);
}
PAGES['shared/notes'] = renderVault;
PAGES['uni/konspekty'] = renderVault;

function treeHTML(list, root, currentId) {
  const collapsed = new Set(DB.settings.collapsedFolders || []);
  const tree = {};
  list.forEach((n) => {
    let rel = n.path || '';
    if (root && norm(rel).startsWith(norm(root))) rel = rel.slice(root.length).replace(/^\//, '');
    const parts = rel.split('/').filter(Boolean);
    let node = tree;
    parts.forEach((p) => { node.dirs = node.dirs || {}; node.dirs[p] = node.dirs[p] || {}; node = node.dirs[p]; });
    (node.files = node.files || []).push(n);
  });
  const walk = (node, prefix, depth) => {
    let html = '';
    Object.keys(node.dirs || {}).sort().forEach((name) => {
      const full = prefix ? `${prefix}/${name}` : name;
      const isCollapsed = collapsed.has(full);
      html += `<div class="fold" data-fold="${attr(full)}" style="padding-left:${depth * 12 + 6}px">${isCollapsed ? '▸' : '▾'} ${esc(name)}</div>`;
      if (!isCollapsed) html += walk(node.dirs[name], full, depth + 1);
    });
    (node.files || []).sort((a, b) => a.title.localeCompare(b.title)).forEach((n) => {
      html += `<div class="file" data-note="${attr(n.id)}"${n.id === currentId ? ' aria-current="page"' : ''} style="padding-left:${depth * 12 + 16}px">${esc(n.title)}</div>`;
    });
    return html;
  };
  const html = walk(tree, '', 0);
  return html || `<div class="mini" style="padding:8px">No folders yet.</div>`;
}

/* ---- writer ---- */
function renderWriter(view, r, base, root) {
  const n = noteById(r.param);
  if (!n) { view.innerHTML = emptyState('Note not found', 'It may have been deleted. Go back to the vault.'); return; }

  topbar(' ', {
    crumb: `<a href="${href(base)}">${base.includes('konspekty') ? 'Konspekty' : 'Notes'}</a> · ${esc(n.path || 'vault root')}`,
    actions: `<div class="wctl">
      ${n.kind === 'excalidraw' ? `<button class="btn sm" id="fullscreen">Fullscreen</button>` : `<span class="seg" id="modeseg"><button data-mode="write">Write</button><button data-mode="read">Read</button></span>`}
      <button class="btn sm" id="movenote">Move</button>
      <button class="btn sm" id="zen">Zen</button>
      <button class="btn danger sm" id="delnote">Delete</button></div>`,
  });
  $('#topbar').querySelector('h1').remove();

  view.innerHTML = `<div id="noteroot"><div class="mini">Loading note…</div></div>`;

  $('#movenote').addEventListener('click', () => openDialog({
    title: 'Move note',
    submitLabel: 'Move',
    body: `<label class="f"><span>Folder</span><input name="path" value="${attr(n.path || '')}" list="folderlist" placeholder="Folder/Subfolder"></label>${folderDatalist()}`,
    onSubmit: (d) => { n.path = cleanPath(d.path); n.updated = nowStamp(); saveRender('notes'); },
  }));
  $('#zen').addEventListener('click', () => document.body.classList.toggle('zen'));
  $('#delnote').addEventListener('click', () => confirmDialog('Delete note', `“${n.title}” will be removed from the vault for good.`, () => {
    DB.notes = DB.notes.filter((x) => x.id !== n.id);
    deleteBody(n.id);
    save('notes'); go(base); render();
  }));

  loadBody(n.id).then((body) => {
    const host = $('#noteroot');
    if (!host || route().param !== n.id) return;
    if (n.kind === 'excalidraw') { mountExcalidraw(host, n, body); return; }

    let mode = body.length > 1200 ? 'read' : 'write';
    const draw = () => {
      $$('#modeseg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      const words = (body.trim().match(/\S+/g) || []).length;
      const back = backlinksOf(n);
      host.innerHTML = `<div class="writer">
        <input class="wtitle" id="wtitle" value="${attr(n.title)}" placeholder="Untitled">
        <input class="wtags" id="wtags" value="${attr((n.tags || []).map((t) => '#' + t).join(' '))}" placeholder="#tags">
        ${mode === 'write'
          ? `<textarea class="wbody" id="wbody" spellcheck="true" placeholder="Start writing… [[link]] to another note.">${esc(body)}</textarea>`
          : `<div class="read" id="wread">${renderMarkdown(body)}</div>`}
        <div class="wfoot">
          <span>${words} words</span>
          <span>${(n.links || []).length} links</span>
          <span>${back.length} backlinks</span>
          <span>updated ${esc(n.updated ? fmtDate(n.updated.slice(0, 10)) : '—')}</span>
        </div>
        ${back.length ? `<div style="margin-top:14px"><div class="mini b">LINKED FROM</div>
          ${back.map((b) => `<div class="list-row click" data-note="${attr(b.id)}" style="padding:6px 0;border:0"><span class="wl">${esc(b.title)}</span></div>`).join('')}</div>` : ''}
      </div>`;

      const ta = $('#wbody');
      if (ta) {
        const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
        grow();
        ta.addEventListener('input', () => {
          body = ta.value;
          grow();
          n.links = extractLinks(body);
          n.updated = nowStamp();
          saveBody(n.id, body);
          save('notes');
        });
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const s = ta.selectionStart;
            ta.setRangeText('  ', s, ta.selectionEnd, 'end');
            ta.dispatchEvent(new Event('input'));
          }
        });
      }
      $('#wtitle').addEventListener('input', (e) => {
        n.title = e.target.value.trim() || 'Untitled';
        n.updated = nowStamp();
        save('notes');
      });
      $('#wtags').addEventListener('input', (e) => {
        n.tags = e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean);
        save('notes');
      });
      on('[data-wl]', 'click', (e, el) => {
        const target = el.dataset.wl;
        const found = noteByTitle(target);
        if (found) { go(`${base}/${found.id}`); return; }
        const made = createNote({ title: target, path: n.path || root });
        toast('Created “' + target + '”');
        go(`${base}/${made.id}`);
      }, host);
      on('[data-note]', 'click', (e, el) => go(`${base}/${el.dataset.note}`), host);
    };
    const seg = $('#modeseg');
    if (seg) on('#modeseg button', 'click', (e, b) => { mode = b.dataset.mode; draw(); }, document);
    draw();
  });
}

/* ---- excalidraw ---- */
let excalidrawLoading = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src.endsWith(src))) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}
function ensureExcalidraw() {
  if (!excalidrawLoading) {
    window.EXCALIDRAW_ASSET_PATH = '/vendor/';
    excalidrawLoading = loadScript('/vendor/react.production.min.js')
      .then(() => loadScript('/vendor/react-dom.production.min.js'))
      .then(() => loadScript('/vendor/excalidraw.production.min.js'));
  }
  return excalidrawLoading;
}

function mountExcalidraw(host, note, body) {
  host.innerHTML = `<div class="exwrap" id="exwrap"><div style="display:grid;place-items:center;height:100%;color:var(--tx-3)">Loading the canvas…</div></div>`;
  const fs = $('#fullscreen');
  if (fs) fs.addEventListener('click', () => $('#exwrap').classList.toggle('full'));

  ensureExcalidraw().then(() => {
    let initial = { elements: [], appState: {} };
    try {
      const parsed = JSON.parse(body || '{}');
      if (parsed && Array.isArray(parsed.elements)) initial = parsed;
    } catch { /* new or non-JSON body: start empty */ }

    const { Excalidraw } = window.ExcalidrawLib;
    const React = window.React;
    const root = window.ReactDOM.createRoot($('#exwrap'));
    let timer;
    const onChange = (elements, appState, files) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = {
          type: 'excalidraw', version: 2, source: 'zettelkasten',
          elements, files: files || {},
          appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize },
        };
        note.updated = nowStamp();
        saveBody(note.id, JSON.stringify(payload));
        save('notes');
      }, 900);
    };
    root.render(React.createElement(Excalidraw, {
      initialData: {
        elements: initial.elements || [],
        files: initial.files || {},
        appState: { ...(initial.appState || {}), theme: 'dark', zoom: (initial.elements || []).length ? undefined : { value: 1 } },
        scrollToContent: (initial.elements || []).length > 0,
      },
      theme: 'dark',
      onChange,
      UIOptions: { canvasActions: { loadScene: false, export: false, saveToActiveFile: false } },
    }));
  }).catch((err) => {
    host.innerHTML = emptyState('Drawing editor did not load', String(err.message || err) + ' — the vendored Excalidraw bundle is missing from /vendor/.');
  });
}

/* ---- vault import (webkitdirectory) ---- */
function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) return;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
    meta[kv[1].toLowerCase()] = v;
  });
  return { meta, body: text.slice(m[0].length) };
}
function inlineTags(body) {
  const out = new Set();
  String(body).replace(/(^|\s)#([A-Za-z0-9_\/-]{2,40})/g, (_, __, tag) => { out.add(tag); return ''; });
  return [...out];
}
/** `.excalidraw.md` files hide the scene in a fenced json block, or an lz-compressed one. */
function extractExcalidraw(text) {
  let m = /```json\r?\n([\s\S]*?)```/.exec(text);
  if (m) { try { return JSON.stringify(JSON.parse(m[1])); } catch { /* fall through */ } }
  m = /```compressed-json\r?\n([\s\S]*?)```/.exec(text);
  if (m && typeof LZString !== 'undefined') {
    const packed = m[1].replace(/[\s\r\n]/g, '');
    const json = LZString.decompressFromBase64(packed);
    if (json) { try { return JSON.stringify(JSON.parse(json)); } catch { /* ignore */ } }
  }
  return '';
}

function importVault(fileList) {
  const files = [...fileList].filter((f) => {
    const rel = f.webkitRelativePath || f.name;
    if (/(^|\/)\.(obsidian|trash|git)(\/|$)/i.test(rel)) return false;
    return /\.md$/i.test(f.name);
  });
  if (!files.length) { toast('No markdown files found in that folder.', 'bad'); return; }

  let prefix = '';
  const dlg = openDialog({
    title: 'Import vault',
    submitLabel: 'Import',
    body: `<p class="mini">${files.length} markdown file(s) found. Folders are kept as note paths; the vault root folder name is stripped.</p>
      <label class="f"><span>Optional prefix for every path</span><input name="prefix" placeholder="e.g. NewUU"></label>
      <div id="progress" class="mini"></div>`,
    onSubmit: (d, dialog) => {
      prefix = cleanPath(d.prefix);
      runImport(files, prefix, dialog);
      return false; // keep the dialog open to show progress
    },
  });

  async function runImport(list, pre, dialog) {
    const prog = $('#progress', dialog);
    let added = 0, updated = 0, skipped = 0, done = 0;
    const queue = [...list];
    const worker = async () => {
      while (queue.length) {
        const file = queue.shift();
        try {
          const text = await file.text();
          const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
          const parts = rel.split('/');
          if (parts.length > 1) parts.shift(); // strip the vault root folder
          const filename = parts.pop();
          const isDraw = /\.excalidraw\.md$/i.test(filename);
          const title = filename.replace(/\.excalidraw\.md$/i, '').replace(/\.md$/i, '');
          const path = cleanPath([pre, ...parts].filter(Boolean).join('/'));
          const { meta, body } = parseFrontMatter(text);
          const drawing = isDraw ? extractExcalidraw(text) : '';
          if (isDraw && !drawing) { skipped++; continue; }
          const tags = [].concat(meta.tags || [], inlineTags(body)).map((t) => String(t).replace(/^#/, '')).filter(Boolean);
          const existing = DB.notes.find((n) => norm(n.path) === norm(path) && norm(n.title) === norm(title));
          const content = isDraw ? drawing : body.trim();
          if (existing) {
            existing.tags = [...new Set(tags)];
            existing.kind = isDraw ? 'excalidraw' : 'md';
            existing.links = isDraw ? [] : extractLinks(content);
            existing.updated = nowStamp();
            saveBody(existing.id, content, false);
            updated++;
          } else {
            createNote({ title, path, body: content, kind: isDraw ? 'excalidraw' : 'md', tags: [...new Set(tags)] });
            added++;
          }
        } catch { skipped++; }
        done++;
        if (prog) prog.textContent = `${done} / ${list.length} · ${added} added · ${updated} updated · ${skipped} skipped`;
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    save('notes');
    dialog.close();
    toast(`Import finished — ${added} added, ${updated} updated, ${skipped} skipped`, 'ok');
    render();
  }
}

/* =============================================================== finances */

let finMonth = monthKey(new Date());
const txOf = (mk) => (DB.finances.tx || []).filter((t) => String(t.date || '').slice(0, 7) === mk);
const shiftMonth = (mk, by) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + by, 1); return monthKey(d); };
const income = (list) => sum(list.filter((t) => t.amount > 0).map((t) => t.amount));
const spent = (list) => -sum(list.filter((t) => t.amount < 0).map((t) => t.amount));

function txDialog(existing) {
  const t = existing || { id: uid(), date: todayISO(), amount: 0, category: '', account: '', note: '' };
  const cats = [...new Set((DB.finances.tx || []).map((x) => x.category).filter(Boolean))];
  const accs = [...new Set((DB.finances.tx || []).map((x) => x.account).filter(Boolean))];
  openDialog({
    title: existing ? 'Edit transaction' : 'Add transaction',
    body: `<div class="seg" id="signseg" style="margin-bottom:12px">
        <button type="button" data-sign="-1"${t.amount <= 0 ? ' aria-pressed="true"' : ''}>Expense</button>
        <button type="button" data-sign="1"${t.amount > 0 ? ' aria-pressed="true"' : ''}>Income</button></div>
      <input type="hidden" name="sign" value="${t.amount > 0 ? 1 : -1}">
      <div class="row">
        <label class="f"><span>Amount</span><input name="amount" inputmode="decimal" value="${attr(Math.abs(t.amount) || '')}"></label>
        <label class="f"><span>Date</span><input name="date" type="date" value="${attr(t.date)}"></label>
      </div>
      <div class="row">
        <label class="f"><span>Category</span><input name="category" value="${attr(t.category)}" list="catlist"></label>
        <label class="f"><span>Account</span><input name="account" value="${attr(t.account)}" list="acclist"></label>
      </div>
      <datalist id="catlist">${cats.map((c) => `<option value="${attr(c)}"></option>`).join('')}</datalist>
      <datalist id="acclist">${accs.map((c) => `<option value="${attr(c)}"></option>`).join('')}</datalist>
      <label class="f"><span>Note</span><input name="note" value="${attr(t.note)}"></label>`,
    extraFooter: existing ? `<button type="button" class="btn danger left" id="deltx">Delete</button>` : '',
    onOpen: (dlg, close) => {
      on('#signseg button', 'click', (e, b) => {
        $$('#signseg button', dlg).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        $('[name=sign]', dlg).value = b.dataset.sign;
      }, dlg);
      const del = $('#deltx', dlg);
      if (del) del.addEventListener('click', () => {
        DB.finances.tx = DB.finances.tx.filter((x) => x.id !== t.id);
        close(); saveRender('finances');
      });
    },
    onSubmit: (d) => {
      const amt = Math.abs(num(d.amount) || 0);
      if (!amt) { toast('Enter an amount.', 'bad'); return false; }
      Object.assign(t, {
        amount: amt * (Number(d.sign) < 0 ? -1 : 1), date: d.date || todayISO(),
        category: d.category.trim() || 'Uncategorised', account: d.account.trim(), note: d.note.trim(),
      });
      if (!existing) DB.finances.tx.push(t);
      finMonth = t.date.slice(0, 7);
      saveRender('finances');
    },
  });
}

function renderFinances(view) {
  const cur = txOf(finMonth);
  const prevMk = shiftMonth(finMonth, -1);
  const prev = txOf(prevMk);
  const inc = income(cur), out = spent(cur);
  const net = inc - out;
  const all = sum((DB.finances.tx || []).map((t) => t.amount));
  const [y, m] = finMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isNow = finMonth === monthKey(new Date());
  const dayOfMonth = isNow ? new Date().getDate() : daysInMonth;
  const pace = out / Math.max(1, dayOfMonth);

  topbar('Finances', {
    actions: `<button class="btn" id="impcsv">Import CSV</button><button class="btn" id="expcsv">Export</button><button class="btn primary" id="addtx">+ Transaction</button>`,
  });

  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(finMonth, i - 5));
  const cats = {};
  cur.filter((t) => t.amount < 0).forEach((t) => { cats[t.category || 'Uncategorised'] = (cats[t.category || 'Uncategorised'] || 0) - t.amount; });
  const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const budgets = DB.finances.budgets || {};

  view.innerHTML = `
    <div class="spread">
      <div class="wrap"><button class="btn sm" id="prevm">←</button>
        <span class="b">${esc(monthLabel(finMonth))}</span>
        <button class="btn sm" id="nextm">→</button>
        ${!isNow ? `<button class="btn ghost sm" id="thism">This month</button>` : ''}</div>
      <span class="mini num">${cur.length} transactions</span>
    </div>
    <div class="stats">
      ${statBox(money(inc), 'income')}
      ${statBox(money(out), 'spent', deltaHTML(round(out, 0), round(spent(prev), 0), { p: 0, lowerIsBetter: true, unit: '' }))}
      ${statBox(money(net), 'net', `<div class="delta flat">≈ ${money(pace)}/day</div>`)}
      ${statBox(money(all), 'balance, all time')}
    </div>
    <div class="grid g-side">
      ${panel('Six months in / out', `<div class="chart-wrap"><canvas id="finBars"></canvas></div>`)}
      ${panel('Where it went', catRows.length ? `<div class="chart-wrap"><canvas id="finDough"></canvas></div>` : emptyState('Nothing spent yet', 'Add an expense and the split appears here.'))}
    </div>
    <div class="grid g-side">
      ${panel('Transactions', cur.length ? `<div class="list">${[...cur].sort((a, b) => b.date.localeCompare(a.date)).map((t) => `
        <div class="list-row click" data-tx="${attr(t.id)}">
          <span class="m num" style="width:52px">${esc(fmtDate(t.date, { day: '2-digit', month: 'short' }))}</span>
          <div class="grow"><div class="t trunc">${esc(t.note || t.category || 'Transaction')}</div>
            <div class="m trunc">${esc(t.category || 'Uncategorised')}${t.account ? ' · ' + esc(t.account) : ''}</div></div>
          <span class="num ${t.amount > 0 ? 'delta up' : ''}">${t.amount > 0 ? '+' : '−'}${esc(money(Math.abs(t.amount)))}</span>
        </div>`).join('')}</div>`
        : emptyState('No transactions this month', 'Add one with + Transaction, or import a CSV with date/amount/category columns.'), { flush: true })}

      ${panel('Budgets', `${catRows.length || Object.keys(budgets).length ? `<div class="list">${
        [...new Set([...Object.keys(budgets), ...catRows.map((c) => c[0])])].map((cat) => {
          const limit = Number(budgets[cat]) || 0;
          const usedC = cats[cat] || 0;
          const share = limit ? usedC / limit : 0;
          const expected = limit * (dayOfMonth / daysInMonth);
          const verdict = !limit ? 'no budget set' : usedC > limit ? `over by ${money(usedC - limit)}`
            : usedC > expected ? 'ahead of pace' : 'on pace';
          return `<div class="list-row" style="display:block">
            <div class="spread"><span class="t">${esc(cat)}</span>
              <span class="mini num">${esc(money(usedC))}${limit ? ' / ' + esc(money(limit)) : ''}</span></div>
            <div class="bar ${!limit ? '' : usedC > limit ? 'bad' : usedC > expected ? 'warn' : 'ok'}" style="margin:6px 0 4px"><i style="width:${clamp(Math.round(share * 100), 0, 100)}%"></i></div>
            <div class="spread"><span class="mini">${esc(verdict)}</span>
              <button class="btn ghost sm" data-budget="${attr(cat)}">set limit</button></div>
          </div>`;
        }).join('')}</div>` : emptyState('No categories yet', 'Spend something first, then set a monthly limit per category.')}`, { flush: true })}
    </div>`;

  $('#prevm').addEventListener('click', () => { finMonth = shiftMonth(finMonth, -1); render(); });
  $('#nextm').addEventListener('click', () => { finMonth = shiftMonth(finMonth, 1); render(); });
  const tm = $('#thism');
  if (tm) tm.addEventListener('click', () => { finMonth = monthKey(new Date()); render(); });
  $('#addtx').addEventListener('click', () => txDialog(null));
  on('[data-tx]', 'click', (e, el) => txDialog((DB.finances.tx || []).find((t) => t.id === el.dataset.tx)), view);
  on('[data-budget]', 'click', (e, el) => {
    const cat = el.dataset.budget;
    openDialog({
      title: 'Monthly budget · ' + cat,
      body: `<label class="f"><span>Limit (${esc(DB.settings.currency)})</span><input name="limit" inputmode="decimal" value="${attr(budgets[cat] || '')}"></label>`,
      onSubmit: (d) => {
        const v = num(d.limit);
        if (!v) delete DB.finances.budgets[cat]; else DB.finances.budgets[cat] = v;
        saveRender('finances');
      },
    });
  }, view);

  $('#expcsv').addEventListener('click', () => {
    const rows = [['date', 'amount', 'category', 'account', 'note', 'type'],
      ...(DB.finances.tx || []).map((t) => [t.date, t.amount, t.category, t.account, t.note, t.amount > 0 ? 'income' : 'expense'])];
    download('finances.csv', rows.map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  });
  $('#impcsv').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const { headers, rows } = parseCSV(reader.result);
        const find = (needles) => pickHeader(headers, needles);
        const hDate = find(['date', 'time']), hAmt = find(['amount', 'sum', 'value']),
          hCat = find(['category', 'cat']), hNote = find(['note', 'description', 'memo']),
          hAcc = find(['account', 'wallet', 'card']), hType = find(['type', 'kind']);
        if (!hDate || !hAmt) { toast('Need at least date and amount columns.', 'bad'); return; }
        const dayFirst = columnIsDayFirst(rows, hDate);
        let added = 0;
        rows.forEach((r) => {
          const d = parseDate(r[hDate], dayFirst);
          let amt = num(r[hAmt]);
          if (!d || amt == null) return;
          const type = norm(hType ? r[hType] : '');
          if (type.includes('expense') || type.includes('debit')) amt = -Math.abs(amt);
          else if (type.includes('income') || type.includes('credit')) amt = Math.abs(amt);
          DB.finances.tx.push({
            id: uid(), date: toISO(d), amount: amt,
            category: (hCat ? r[hCat] : '') || 'Uncategorised', account: hAcc ? r[hAcc] : '', note: hNote ? r[hNote] : '',
          });
          added++;
        });
        saveRender('finances');
        toast(`${added} transaction(s) imported`, 'ok');
      };
      reader.readAsText(f);
    };
    input.click();
  });

  drawChart('finBars', {
    type: 'bar',
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: 'in', data: months.map((mk) => income(txOf(mk))), backgroundColor: cssVar('--ok'), borderRadius: 4 },
        { label: 'out', data: months.map((mk) => spent(txOf(mk))), backgroundColor: cssVar('--bad'), borderRadius: 4 },
      ],
    },
  });
  if (catRows.length) drawChart('finDough', {
    type: 'doughnut',
    data: { labels: catRows.map((c) => c[0]), datasets: [{ data: catRows.map((c) => c[1]), backgroundColor: PALETTE, borderWidth: 0 }] },
    options: { cutout: '62%', scales: { x: { display: false }, y: { display: false } }, plugins: { legend: { position: 'right' } } },
  });
}
PAGES['shared/finances'] = renderFinances;

/* =============================================================== calendar */

let calView = 'week';
let calAnchor = new Date();
let googleState = { configured: false, connected: false, email: null };
let googleCals = [];
let googleEvents = [];
let googleRangeKey = '';
let googleBusy = false;

const SOURCES = {
  timetable: { label: 'Timetable', color: '#8b7cf6' },
  exams: { label: 'Exams', color: '#ef6b6b' },
  deadlines: { label: 'Deadlines', color: '#f0b344' },
  oneonones: { label: '1-1s logged', color: '#c42a4a' },
};
const hidden = () => new Set(DB.settings.hiddenSources || []);
function toggleSource(key) {
  const set = hidden();
  if (set.has(key)) set.delete(key); else set.add(key);
  DB.settings.hiddenSources = [...set];
  save('settings');
}

const atTime = (date, hhmm) => { const d = startOfDay(date); const m = toMin(hhmm) || 0; d.setMinutes(m); return d; };
function rangeFor(view, anchor) {
  if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (view === 'week') {
    const start = addDays(startOfDay(anchor), -((anchor.getDay() + 6) % 7));
    return { from: start, to: addDays(start, 7) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  return { from: gridStart, to: addDays(gridStart, 42) };
}

/** All desk-side events inside [from,to). */
function deskEvents(from, to) {
  const out = [];
  const h = hidden();
  const sem = semester();

  if (!h.has('timetable')) {
    (DB.uni.slots || []).forEach((s) => {
      for (let d = new Date(from); d < to; d = addDays(d, 1)) {
        if (((d.getDay() + 6) % 7) !== Number(s.day)) continue;
        if (sem && (startOfDay(d) < startOfDay(sem.start) || startOfDay(d) > startOfDay(sem.end))) continue;
        out.push({
          id: 'tt-' + s.id + '-' + toISO(d), title: courseName(s.courseId) || 'Class',
          start: atTime(d, s.start), end: atTime(d, s.end), allDay: false,
          source: 'timetable', color: SOURCES.timetable.color,
          meta: `${titleCase(s.type)}${s.room ? ' · ' + s.room : ''}`, link: 'uni/timetable',
        });
      }
    });
  }
  if (!h.has('exams')) {
    allExams().forEach((e) => {
      const d = fromISO(e.date);
      if (!d || d < from || d >= to) return;
      out.push({
        id: 'ex-' + e.id, title: e.course + ' exam',
        start: e.time ? atTime(d, e.time) : startOfDay(d), end: e.time ? new Date(atTime(d, e.time).getTime() + 2 * 3600e3) : startOfDay(d),
        allDay: !e.time, source: 'exams', color: SOURCES.exams.color, meta: e.room || '', link: `uni/courses/${e.courseId}`,
      });
    });
  }
  if (!h.has('deadlines')) {
    ['work', 'uni'].forEach((face) => deadlineRows(face).forEach((row) => {
      const d = fromISO(row.due);
      if (!d || d < from || d >= to) return;
      out.push({
        id: 'dl-' + face + row.id + row.label, title: row.label, start: startOfDay(d), end: startOfDay(d),
        allDay: true, source: 'deadlines', color: SOURCES.deadlines.color, meta: face === 'work' ? 'work' : 'university',
        link: `${face}/tasks`,
      });
    }));
  }
  if (!h.has('oneonones')) {
    DB.teachers.forEach((t) => {
      const dates = [...new Set((t.entries || []).map((e) => e.date).filter(Boolean))];
      dates.forEach((iso) => {
        const d = fromISO(iso);
        if (!d || d < from || d >= to) return;
        out.push({
          id: '1v1-' + t.id + iso, title: `1-1 · ${t.name}`, start: startOfDay(d), end: startOfDay(d),
          allDay: true, source: 'oneonones', color: SOURCES.oneonones.color, meta: '', link: `work/teachers/${t.id}`,
        });
      });
    });
  }
  return out;
}

function gEventsToItems() {
  const h = hidden();
  return googleEvents.filter((e) => !h.has('g:' + e.calendarId)).map((e) => {
    const cal = googleCals.find((c) => c.id === e.calendarId) || {};
    const allDay = !!(e.start && e.start.date);
    const start = allDay ? fromISO(e.start.date) : new Date(e.start.dateTime);
    const end = allDay ? fromISO(e.end.date) : new Date(e.end.dateTime);
    return {
      id: 'g-' + e.id, gid: e.id, calendarId: e.calendarId, title: e.summary || '(no title)',
      start, end, allDay, source: 'g:' + e.calendarId, color: cal.backgroundColor || '#5b8def',
      meta: e.location || '', writable: ['owner', 'writer'].includes(cal.accessRole), raw: e,
    };
  });
}

async function loadGoogle(from, to, force) {
  if (!REMOTE) return;
  try {
    if (!googleState.connected) {
      googleState = await api('/google/status');
      if (!googleState.connected) return;
    }
    if (!googleCals.length) {
      const list = await api('/google/calendars');
      googleCals = (list.items || []).map((c) => ({ id: c.id, summary: c.summary, backgroundColor: c.backgroundColor, accessRole: c.accessRole, primary: c.primary }));
    }
    const key = `${toISO(from)}|${toISO(to)}|${googleCals.length}`;
    if (key === googleRangeKey && !force) return;
    googleBusy = true;
    const all = await Promise.all(googleCals.map(async (c) => {
      try {
        const res = await api(`/google/events?cal=${encodeURIComponent(c.id)}&timeMin=${from.toISOString()}&timeMax=${to.toISOString()}`);
        return (res.items || []).map((e) => ({ ...e, calendarId: c.id }));
      } catch { return []; }
    }));
    googleEvents = all.flat();
    googleRangeKey = key;
  } catch (err) {
    if (err.status !== 401) console.warn('google', err);
  } finally { googleBusy = false; }
}

/** Column-pack overlapping timed events. */
function packLanes(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed = [];
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    const lanes = [];
    cluster.forEach((ev) => {
      let lane = lanes.findIndex((end) => end <= ev.start);
      if (lane === -1) { lanes.push(ev.end); lane = lanes.length - 1; } else lanes[lane] = ev.end;
      ev._lane = lane;
    });
    cluster.forEach((ev) => { ev._lanes = lanes.length; placed.push(ev); });
    cluster = [];
  };
  let clusterEnd = null;
  sorted.forEach((ev) => {
    if (clusterEnd && ev.start >= clusterEnd) { flush(); clusterEnd = null; }
    cluster.push(ev);
    clusterEnd = clusterEnd ? new Date(Math.max(clusterEnd, ev.end)) : new Date(ev.end);
  });
  flush();
  return placed;
}

/* ---- calendar page ---- */
const HOUR_PX = 46;

function renderCalendar(view) {
  const { from, to } = rangeFor(calView, calAnchor);
  const label = calView === 'month'
    ? `${MONTHS[calAnchor.getMonth()]} ${calAnchor.getFullYear()}`
    : calView === 'day' ? calAnchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      : `${fmtDate(toISO(from), { day: 'numeric', month: 'short' })} – ${fmtDate(toISO(addDays(to, -1)), { day: 'numeric', month: 'short', year: 'numeric' })}`;

  topbar('Calendar', {
    crumb: label,
    actions: `<span class="seg" id="calviewseg">${['day', 'week', 'month'].map((v) => `<button data-cv="${v}"${calView === v ? ' aria-pressed="true"' : ''}>${titleCase(v)}</button>`).join('')}</span>
      <button class="btn sm" id="calprev">←</button><button class="btn sm" id="caltoday">Today</button><button class="btn sm" id="calnext">→</button>`,
  });

  const cal = DB.settings.calcom ? (/^https?:/.test(DB.settings.calcom) ? DB.settings.calcom : `https://cal.com/${DB.settings.calcom.replace(/^\/+/, '')}`) : '';

  view.innerHTML = `
    <div class="legend" id="callegend"></div>
    <div id="calgrid"><div class="mini">Building the grid…</div></div>
    ${cal ? `<details class="panel"><summary style="padding:12px 14px;cursor:pointer">Booking link · ${esc(cal)}</summary>
      <div class="body"><div class="wrap" style="margin-bottom:10px">
        <button class="btn sm" id="copycal">Copy link</button>
        <a class="btn sm" href="${attr(cal)}" target="_blank" rel="noopener">Open ↗</a></div>
        <iframe class="bookframe" src="${attr(cal + (cal.includes('?') ? '&' : '?') + 'theme=dark')}" loading="lazy" referrerpolicy="no-referrer"></iframe>
      </div></details>` : ''}`;

  on('#calviewseg button', 'click', (e, b) => { calView = b.dataset.cv; render(); }, document);
  $('#calprev').addEventListener('click', () => { calAnchor = shiftAnchor(-1); render(); });
  $('#calnext').addEventListener('click', () => { calAnchor = shiftAnchor(1); render(); });
  $('#caltoday').addEventListener('click', () => { calAnchor = new Date(); render(); });
  const cc = $('#copycal');
  if (cc) cc.addEventListener('click', () => { navigator.clipboard.writeText(cal).then(() => toast('Booking link copied', 'ok'), () => toast('Copy failed', 'bad')); });

  drawLegend();
  drawCalGrid(from, to);
  loadGoogle(from, to).then(() => {
    if (route().page !== 'calendar') return;
    drawLegend();
    drawCalGrid(from, to);
  });
}
PAGES['shared/calendar'] = renderCalendar;

function shiftAnchor(dir) {
  if (calView === 'day') return addDays(calAnchor, dir);
  if (calView === 'week') return addDays(calAnchor, 7 * dir);
  return new Date(calAnchor.getFullYear(), calAnchor.getMonth() + dir, 1);
}

function drawLegend() {
  const host = $('#callegend');
  if (!host) return;
  const h = hidden();
  const chips = [
    ...Object.entries(SOURCES).map(([key, s]) => ({ key, label: s.label, color: s.color })),
    ...googleCals.map((c) => ({ key: 'g:' + c.id, label: c.summary, color: c.backgroundColor || '#5b8def' })),
  ];
  host.innerHTML = chips.map((c) => `<button data-src="${attr(c.key)}" aria-pressed="${!h.has(c.key)}">
      <span class="sw" style="background:${attr(c.color)}"></span>${esc(c.label)}</button>`).join('')
    + (googleState.connected ? `<span class="pill ok" title="${attr(googleState.email || '')}">Google connected</span>`
      : REMOTE ? `<a class="pill" href="${href('shared/settings')}">Connect Google →</a>` : '');
  on('[data-src]', 'click', (e, b) => {
    toggleSource(b.dataset.src);
    const { from, to } = rangeFor(calView, calAnchor);
    drawLegend(); drawCalGrid(from, to);
  }, host);
}

function eventChip(ev, style, cls = '') {
  return `<div class="ev ${cls}" data-ev="${attr(ev.id)}" style="${style};background:${attr(ev.color)}"
    title="${attr(ev.title + (ev.meta ? ' · ' + ev.meta : ''))}">${ev.allDay ? '' : `<b class="num">${esc(fmtTime(ev.start))}</b> `}${esc(ev.title)}</div>`;
}
const fmtTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function drawCalGrid(from, to) {
  const host = $('#calgrid');
  if (!host) return;
  const items = [...deskEvents(from, to), ...gEventsToItems().filter((e) => e.end >= from && e.start < to)];
  window.__calItems = items;

  if (calView === 'month') { host.innerHTML = monthGrid(from, items); wireCal(host, items); return; }

  const days = calView === 'day' ? [new Date(from)] : Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const cols = `56px repeat(${days.length}, minmax(0,1fr))`;
  const allDayItems = items.filter((e) => e.allDay);
  const timed = items.filter((e) => !e.allDay);

  const dayCol = (d, i) => {
    const dayStart = startOfDay(d);
    const dayEnd = addDays(dayStart, 1);
    const list = packLanes(timed.filter((e) => e.start < dayEnd && e.end > dayStart));
    const isToday = daysBetween(new Date(), d) === 0;
    return `<div class="daycol${isToday ? ' today' : ''}" data-day="${toISO(d)}">
      ${Array.from({ length: 24 }, (_, h) => `<div class="hr" data-hour="${h}"></div>`).join('')}
      ${list.map((ev) => {
        const s = Math.max(ev.start, dayStart), e = Math.min(ev.end, dayEnd);
        const top = ((s - dayStart) / 3600000) * HOUR_PX;
        const height = Math.max(18, ((e - s) / 3600000) * HOUR_PX - 2);
        const w = 100 / (ev._lanes || 1);
        return eventChip(ev, `top:${top}px;height:${height}px;left:calc(${ev._lane * w}% + 2px);width:calc(${w}% - 5px)`);
      }).join('')}
      ${isToday ? `<div class="nowline" style="top:${((new Date() - startOfDay(new Date())) / 3600000) * HOUR_PX}px"></div>` : ''}
    </div>`;
  };

  host.innerHTML = `<div class="cal">
    <div class="cal-head" style="grid-template-columns:${cols}"><div class="d" style="border-left:0"></div>
      ${days.map((d) => `<div class="d${daysBetween(new Date(), d) === 0 ? ' today' : ''}">
        <div>${DOW[d.getDay()]}</div><div class="dn">${d.getDate()}</div></div>`).join('')}</div>
    <div class="allday" style="grid-template-columns:${cols}"><div class="cell mini" style="border-left:0;padding-left:6px">all day</div>
      ${days.map((d) => `<div class="cell" data-day="${toISO(d)}">${allDayItems.filter((e) => daysBetween(e.start, d) === 0)
        .map((ev) => eventChip(ev, '', 'allday-chip')).join('')}</div>`).join('')}</div>
    <div class="gridwrap" id="gridwrap"><div class="grid-body" style="grid-template-columns:${cols}">
      <div class="gutter">${Array.from({ length: 24 }, (_, h) => `<div class="h">${String(h).padStart(2, '0')}:00</div>`).join('')}</div>
      ${days.map(dayCol).join('')}
    </div></div>
  </div>`;

  const wrap = $('#gridwrap');
  if (wrap) {
    const nowTop = ((new Date() - startOfDay(new Date())) / 3600000) * HOUR_PX;
    wrap.scrollTop = Math.max(0, nowTop - wrap.clientHeight / 2);
  }
  wireCal(host, items);
}

function monthGrid(gridStart, items) {
  const month = calAnchor.getMonth();
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return `<div class="cal">
    <div class="cal-head" style="grid-template-columns:repeat(7,minmax(0,1fr))">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="d">${d}</div>`).join('')}</div>
    <div class="month">${cells.map((d) => {
      const day = items.filter((e) => daysBetween(e.start, d) === 0 || (e.start <= d && e.end > d && e.allDay))
        .sort((a, b) => a.allDay - b.allDay || a.start - b.start);
      const show = day.slice(0, 3);
      return `<div class="mcell${d.getMonth() !== month ? ' out' : ''}${daysBetween(new Date(), d) === 0 ? ' today' : ''}" data-day="${toISO(d)}">
        <div class="mn">${d.getDate()}</div>
        ${show.map((ev) => `<div class="mchip" data-ev="${attr(ev.id)}" style="background:${attr(ev.color)}">${esc(ev.title)}</div>`).join('')}
        ${day.length > 3 ? `<div class="mini" data-more="${toISO(d)}">+${day.length - 3} more</div>` : ''}
      </div>`;
    }).join('')}</div></div>`;
}

function wireCal(host, items) {
  on('[data-more]', 'click', (e, el) => {
    e.stopPropagation();
    calAnchor = fromISO(el.dataset.more); calView = 'day'; render();
  }, host);
  on('[data-ev]', 'click', (e, el) => {
    e.stopPropagation();
    const ev = items.find((x) => x.id === el.dataset.ev);
    if (!ev) return;
    if (ev.gid) googleEventDialog(ev);
    else if (ev.link) go(ev.link);
  }, host);
  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-ev]') || e.target.closest('[data-more]')) return;
    const cell = e.target.closest('[data-day]');
    if (!cell) return;
    const hourEl = e.target.closest('[data-hour]');
    const iso = cell.dataset.day;
    let hour = 9;
    if (hourEl) hour = Number(hourEl.dataset.hour);
    else if (calView !== 'month') {
      const rect = cell.getBoundingClientRect();
      hour = clamp(Math.floor((e.clientY - rect.top) / HOUR_PX), 0, 23);
    }
    newEventDialog(iso, hour);
  });
}

/* ---- calendar dialogs ---- */
const writableCals = () => googleCals.filter((c) => ['owner', 'writer'].includes(c.accessRole));

function eventPayload(d) {
  const start = d.allday ? { date: d.date } : { dateTime: new Date(`${d.date}T${d.start || '09:00'}:00`).toISOString() };
  const end = d.allday ? { date: toISO(addDays(fromISO(d.date), 1)) } : { dateTime: new Date(`${d.date}T${d.end || '10:00'}:00`).toISOString() };
  return { summary: d.title, location: d.location || '', description: d.notes || '', start, end };
}

function newEventDialog(iso, hour) {
  const dests = [...writableCals().map((c) => ({ v: 'g:' + c.id, l: c.summary })), { v: 'desk', l: 'Desk · task deadline' }];
  openDialog({
    title: 'New event',
    submitLabel: 'Create',
    body: `<label class="f"><span>Title</span><input name="title" placeholder="What is it"></label>
      <div class="row">
        <label class="f"><span>Date</span><input name="date" type="date" value="${attr(iso)}"></label>
        <label class="f"><span>All day</span><span style="display:block;padding-top:8px"><input type="checkbox" name="allday"> whole day</span></label>
      </div>
      <div class="row" id="times">
        <label class="f"><span>Start</span><input name="start" type="time" value="${attr(fromMin(hour * 60))}"></label>
        <label class="f"><span>End</span><input name="end" type="time" value="${attr(fromMin((hour + 1) * 60))}"></label>
      </div>
      <label class="f"><span>Destination</span><select name="dest">${dests.map((d) => `<option value="${attr(d.v)}">${esc(d.l)}</option>`).join('')}</select></label>
      ${!googleState.connected ? `<p class="mini">Google is not connected — only the desk destination is available. Connect it in Settings.</p>` : ''}
      <label class="f"><span>Location</span><input name="location"></label>
      <label class="f"><span>Notes</span><textarea name="notes" rows="3"></textarea></label>`,
    onOpen: (dlg) => {
      const cb = $('[name=allday]', dlg);
      cb.addEventListener('change', () => { $('#times', dlg).style.display = cb.checked ? 'none' : ''; });
    },
    onSubmit: async (d) => {
      if (!d.title.trim()) { toast('Give it a title.', 'bad'); return false; }
      if (d.dest === 'desk') {
        DB.tasks.push({ id: uid(), face: currentFace(), title: d.title.trim(), due: d.date, link: '', notes: d.notes, course: '', status: 'todo', progress: 0, steps: [] });
        saveRender('tasks');
        toast('Added as a task deadline', 'ok');
        return;
      }
      const calId = d.dest.slice(2);
      try {
        await api(`/google/events?cal=${encodeURIComponent(calId)}`, { method: 'POST', body: JSON.stringify(eventPayload(d)) });
        googleRangeKey = '';
        toast('Added to Google Calendar', 'ok');
        const { from, to } = rangeFor(calView, calAnchor);
        await loadGoogle(from, to, true);
        render();
      } catch (err) { toast('Google refused it: ' + err.message, 'bad'); }
    },
  });
}

function googleEventDialog(ev) {
  const e = ev.raw || {};
  const iso = ev.allDay ? toISO(ev.start) : toISO(ev.start);
  if (!ev.writable) {
    openDialog({
      title: ev.title,
      body: `<p class="mini">${esc(fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' }))}${ev.allDay ? ' · all day' : ` · ${fmtTime(ev.start)}–${fmtTime(ev.end)}`}</p>
        ${ev.meta ? `<p>${esc(ev.meta)}</p>` : ''}${e.description ? `<p class="mut" style="white-space:pre-wrap">${esc(e.description)}</p>` : ''}
        <p class="mini">This calendar is read-only for your account, so it cannot be edited here.</p>`,
    });
    return;
  }
  openDialog({
    title: 'Edit event',
    body: `<label class="f"><span>Title</span><input name="title" value="${attr(ev.title)}"></label>
      <div class="row">
        <label class="f"><span>Date</span><input name="date" type="date" value="${attr(iso)}"></label>
        <label class="f"><span>All day</span><span style="display:block;padding-top:8px"><input type="checkbox" name="allday"${ev.allDay ? ' checked' : ''}> whole day</span></label>
      </div>
      <div class="row" id="times" ${ev.allDay ? 'style="display:none"' : ''}>
        <label class="f"><span>Start</span><input name="start" type="time" value="${attr(fmtTime(ev.start))}"></label>
        <label class="f"><span>End</span><input name="end" type="time" value="${attr(fmtTime(ev.end))}"></label>
      </div>
      <label class="f"><span>Location</span><input name="location" value="${attr(ev.meta || '')}"></label>
      <label class="f"><span>Notes</span><textarea name="notes" rows="3">${esc(e.description || '')}</textarea></label>`,
    extraFooter: `<button type="button" class="btn danger left" id="delev">Delete</button>`,
    onOpen: (dlg, close) => {
      const cb = $('[name=allday]', dlg);
      cb.addEventListener('change', () => { $('#times', dlg).style.display = cb.checked ? 'none' : ''; });
      $('#delev', dlg).addEventListener('click', async () => {
        close();
        try {
          await api(`/google/events/${encodeURIComponent(ev.gid)}?cal=${encodeURIComponent(ev.calendarId)}`, { method: 'DELETE' });
          toast('Deleted from Google', 'ok');
          const { from, to } = rangeFor(calView, calAnchor);
          await loadGoogle(from, to, true);
          render();
        } catch (err) { toast('Could not delete: ' + err.message, 'bad'); }
      });
    },
    onSubmit: async (d) => {
      try {
        await api(`/google/events/${encodeURIComponent(ev.gid)}?cal=${encodeURIComponent(ev.calendarId)}`, { method: 'PATCH', body: JSON.stringify(eventPayload(d)) });
        toast('Saved to Google', 'ok');
        const { from, to } = rangeFor(calView, calAnchor);
        await loadGoogle(from, to, true);
        render();
      } catch (err) { toast('Could not save: ' + err.message, 'bad'); }
    },
  });
}

/* =============================================================== settings */

function renderSettings(view) {
  topbar('Settings');
  const s = DB.settings;
  const noteCount = DB.notes.length;
  const bytes = COLLECTIONS.reduce((n, c) => n + (localStorage.getItem(LS + c) || '').length, 0);

  view.innerHTML = `
    <div class="grid g2">
      ${panel('You', `
        <label class="f"><span>Name (used in greetings)</span><input id="s_name" value="${attr(s.name)}"></label>
        <label class="f"><span>Currency</span><input id="s_cur" value="${attr(s.currency)}" placeholder="UZS"></label>
        <div class="row">
          <label class="f"><span>Semester start</span><input id="s_ss" type="date" value="${attr(s.semStart)}"></label>
          <label class="f"><span>Semester end</span><input id="s_se" type="date" value="${attr(s.semEnd)}"></label>
        </div>
        <label class="f"><span>Konspekty root folder</span><input id="s_root" value="${attr(s.konspektyRoot)}" list="folderlist"></label>
        <label class="f"><span>cal.com link or username</span><input id="s_cal" value="${attr(s.calcom)}" placeholder="shukrullo"></label>
        ${folderDatalist()}
        <button class="btn primary" id="savesettings">Save settings</button>`)}

      ${panel('Google Calendar', `<div id="gstate" class="mini">Checking…</div>
        <div class="wrap" style="margin-top:10px">
          <button class="btn primary" id="gconnect">Connect</button>
          <button class="btn danger" id="gdisconnect">Disconnect</button>
        </div>
        <p class="mini" style="margin-top:10px">Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set on the Pages project, and
        <code>/api/google/callback</code> registered as the OAuth redirect URI.</p>`)}
    </div>

    <div class="grid g2">
      ${panel('Storage', `<div class="list">
        <div class="list-row"><div class="grow">Sync</div><span class="pill ${REMOTE ? 'ok' : 'warn'}">${REMOTE ? 'cloud (KV)' : 'this device only'}</span></div>
        <div class="list-row"><div class="grow">Notes</div><span class="num">${noteCount}</span></div>
        <div class="list-row"><div class="grow">Teachers</div><span class="num">${DB.teachers.length}</span></div>
        <div class="list-row"><div class="grow">Tasks</div><span class="num">${DB.tasks.length}</span></div>
        <div class="list-row"><div class="grow">Datasets</div><span class="num">${DB.datasets.length}</span></div>
        <div class="list-row"><div class="grow">Transactions</div><span class="num">${(DB.finances.tx || []).length}</span></div>
        <div class="list-row"><div class="grow">Local cache</div><span class="num">${Math.round(bytes / 1024)} KB</span></div>
      </div>`, { flush: true })}

      ${panel('Backup', `<p class="mini">A single JSON file with every collection <b>and every note body</b> — enough to rebuild the desk from nothing.</p>
        <div class="wrap"><button class="btn" id="backup">Download backup</button>
        <button class="btn" id="restore">Restore from file</button>
        <button class="btn danger" id="locknow">Lock this device</button></div>`)}
    </div>`;

  $('#savesettings').addEventListener('click', () => {
    Object.assign(s, {
      name: $('#s_name').value.trim(), currency: $('#s_cur').value.trim().toUpperCase() || 'UZS',
      semStart: $('#s_ss').value, semEnd: $('#s_se').value,
      konspektyRoot: cleanPath($('#s_root').value), calcom: $('#s_cal').value.trim(),
    });
    saveRender('settings');
    toast('Settings saved', 'ok');
  });
  $('#locknow').addEventListener('click', lock);

  $('#backup').addEventListener('click', async () => {
    const payload = { exported: new Date().toISOString(), collections: {}, bodies: {} };
    COLLECTIONS.forEach((c) => { payload.collections[c] = DB[c]; });
    for (const n of DB.notes) payload.bodies[n.id] = await loadBody(n.id);
    download(`zettelkasten-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2));
  });
  $('#restore').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.collections) throw new Error('not a desk backup');
          confirmDialog('Restore backup', 'Everything currently on this desk is replaced by the file contents.', () => {
            COLLECTIONS.forEach((c) => { if (data.collections[c] != null) DB[c] = data.collections[c]; });
            Object.entries(data.bodies || {}).forEach(([id, text]) => saveBody(id, text, true));
            COLLECTIONS.forEach((c) => saveCollection(c, true));
            toast('Restored', 'ok');
            render();
          }, 'Restore');
        } catch (err) { toast('That file is not a desk backup.', 'bad'); }
      };
      reader.readAsText(f);
    };
    input.click();
  });

  const gs = $('#gstate');
  const paint = (st) => {
    googleState = st;
    gs.innerHTML = !st.configured
      ? `<span class="pill warn">not configured</span> — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the project.`
      : st.connected ? `<span class="pill ok">connected</span> as <b>${esc(st.email || 'your Google account')}</b>`
        : `<span class="pill">not connected</span> — press Connect and approve the consent screen.`;
  };
  if (!REMOTE) gs.innerHTML = `<span class="pill warn">no backend</span> — Google sync needs the Pages Functions deployment.`;
  else api('/google/status').then(paint).catch(() => { gs.textContent = 'Could not read the Google status.'; });

  $('#gconnect').addEventListener('click', async () => {
    try {
      const { url } = await api('/google/auth');
      location.href = url;
    } catch (err) { toast(err.message, 'bad'); }
  });
  $('#gdisconnect').addEventListener('click', async () => {
    try {
      await api('/google/disconnect', { method: 'POST' });
      googleCals = []; googleEvents = []; googleRangeKey = '';
      toast('Disconnected', 'ok');
      render();
    } catch (err) { toast(err.message, 'bad'); }
  });
}
PAGES['shared/settings'] = renderSettings;

/* ------------------------------------------------------------------- init */
window.addEventListener('DOMContentLoaded', boot);
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if ($('#view')) render(); }, 250);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('zen')) document.body.classList.remove('zen');
});
