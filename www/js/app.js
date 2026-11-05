// Latte Taktik — ana uygulama
import { Scene3D, CAMS, THEMES, PW, PL, loadImage } from './scene3d.js';
import { FORM_NAMES, formSlots, slotGroup, lateral } from './formations.js';
import * as D from './data.js';
import { Recorder, saveFile, shareFile, isApp, REC_W } from './recorder.js';
import { drawOverlay, OW, OH } from './overlay.js';

const $ = (s) => document.querySelector(s);
const HW = PW / 2, HL = PL / 2;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };

const COLORS = [['#22375A', 'Lacivert'], ['#FFFFFF', 'Beyaz'], ['#F2C94C', 'Sarı'], ['#D64545', 'Kırmızı'], ['#1A1310', 'Siyah'], ['#7EC3EA', 'Açık mavi'], ['#8B5E3C', 'Mocha']];
const I = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const TOOLS = [
  ['move', 'Taşı', I('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>')],
  ['pass', 'Pas', I('<path d="M4 20 19 5M19 5h-7M19 5v7"/>')],
  ['run', 'Koşu', I('<path d="M4 19c4-1 6-5 8-9" stroke-dasharray="3 3"/><path d="M12 10c1.5-3 4-5 7-5M19 5h-5M19 5v5"/>')],
  ['drib', 'Top sürme', I('<path d="M3 17c2-3 3 1 5-2s3 1 5-2 3 1 5-2"/><path d="M18 11h3v3"/>')],
  ['lob', 'Havadan', I('<path d="M4 19C6 6 15 4 20 18"/><path d="M20 18l-1-5M20 18l-4-3"/>')],
  ['line', 'Çizgi', I('<path d="M3 12h18" stroke-dasharray="4 3"/>')],
  ['circle', 'Daire', I('<circle cx="12" cy="12" r="8"/>')],
  ['zone', 'Bölge', I('<rect x="4" y="5" width="16" height="14" rx="2"/>')],
  ['x', 'Çarpı', I('<path d="M6 6l12 12M18 6 6 18"/>')],
  ['hl', 'Vurgu', I('<path d="M9 3h6l-1 8h-4z"/><ellipse cx="12" cy="19" rx="7" ry="2.5"/><path d="M10 11l-3 6M14 11l3 6"/>')],
  ['erase', 'Silgi', I('<path d="m16 3 5 5-11 11H5v-5z"/><path d="M12 7l5 5"/>')],
];
const DRAW_TOOLS = new Set(['pass', 'run', 'drib', 'lob', 'line', 'circle', 'zone']);
const MODE_LABEL = { free: 'Serbest', pre: 'Maç önü', post: 'Maç sonu' };
const POS_TR = { G: 'KL', D: 'DEF', M: 'OS', F: 'FV' };

// ---------------- ayarlar ----------------
const SET = Object.assign({ theme: 'latte', names: true, photos: true, figScale: 1, labelSize: 1, nameMode: 'kisa', scoreBar: true, stepDur: 1.3, hold: 0.8, mic: false, countdown: true, quality: 'hi', sign: '', camLock: false }, ls.get('lt-settings', {}));
const saveSet = () => ls.set('lt-settings', SET);

// ---------------- durum ----------------
let P = null;            // açık proje
let cur = 0;             // adım
let tool = 'move', color = SET.theme === 'latte' ? '#22375A' : '#FFFFFF';
let undo = [];
let playing = null;      // {t0}
let drag = null, draft = null;
let banners = [];
let ovDirty = true;
const imgs = new Map();  // logo/fotoğraf url → Image

// ---------------- 3D + kayıt ----------------
const gl = $('#gl'), ov = $('#ov'), og = ov.getContext('2d');
const scene = new Scene3D(gl);
gl.addEventListener('pointerdown', onDown); // OrbitControls'tan ÖNCE: oyuncuya dokununca kamera dönmesin
scene.initControls();
const rec = new Recorder(() => ({ gl, overlay: ov }));
let stageW = 0, stageH = 0;

scene.onBeforeRender = (now) => {
  if (!P) return false;
  if (playing) applyPlayback(now);
  if (banners.length) { banners = banners.filter((b) => now - b.t0 < 3800); ovDirty = true; }
  return rec.active || !!playing;
};
scene.onAfterRender = (now) => {
  if (!P) return;
  if (ovDirty || banners.length) { drawOverlay(og, overlayInfo(), now); ovDirty = false; }
  if (rec.active) { rec.frame(now); $('#recTime').textContent = fmtTime(rec.elapsed()); }
};
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function layout() {
  const wrap = $('#stageWrap'); const W = wrap.clientWidth - 12, H = wrap.clientHeight - 8;
  let w = Math.min(W, H * 9 / 16); let h = w * 16 / 9; w = Math.floor(w); h = Math.floor(h);
  const st = $('#stage'); st.style.width = w + 'px'; st.style.height = h + 'px';
  stageW = w; stageH = h; applyPixelRatio();
}
function applyPixelRatio() {
  const pr = rec.active ? REC_W / stageW : Math.min(window.devicePixelRatio || 1, 2);
  scene.resize(stageW, stageH, pr);
}
new ResizeObserver(layout).observe($('#stageWrap'));

// ---------------- takım ve oyuncu yardımcıları ----------------
// Kadrolar güncellense de eski projeler bozulmasın: takım ve oyuncu bilgisinin kopyası projede saklanır
function teamOf(side) { const s = P[side]; if (!s) return null; return P.ext?.[s.team] || D.team(s.lg, s.team) || (s.snap ? { ...s.snap, players: [] } : null); }
function snapTeams() {
  P.pcache ||= {};
  for (const s of sides()) {
    const t = D.team(P[s].lg, P[s].team) || P.ext?.[P[s].team];
    if (t) P[s].snap = { id: t.id, name: t.name, short: t.short, color: t.color, alt: t.alt, logo: t.logo, logoUrl: t.logoUrl || '' };
    const sq = squad(s); const used = new Set(P.steps.flatMap((st) => st.on[s] || []));
    for (const x of P.subs) if (x.side === s) { used.add(x.in); used.add(x.out); }
    for (const p of sq) if (used.has(p.id)) P.pcache[p.id] = { id: p.id, n: p.n, s: p.s, no: p.no, g: p.g, pa: p.pa, f: p.f, img: p.img || '' };
  }
}
function squad(side) {
  const t = teamOf(side); if (!t) return [];
  const list = [...(t.players || [])]; const ids = new Set(list.map((p) => p.id));
  for (const p of P.extra?.[t.id] || []) if (!ids.has(p.id)) { list.push(p); ids.add(p.id); }
  return list.map((p) => (P.custom?.[p.id] ? { ...p, ...P.custom[p.id] } : p));
}
function player(side, pid) {
  if (!pid) return null;
  const p = squad(side).find((x) => x.id === pid) || P.pcache?.[pid] || null;
  return p && P.custom?.[pid] ? { ...p, ...P.custom[pid] } : p;
}
function labelName(p) {
  if (!p) return '';
  if (P.custom?.[p.id]?.n) return P.custom[p.id].n;
  if (SET.nameMode === 'tam') return p.n;
  if (SET.nameMode === 'soyad') { const s = p.s || p.n; if (s.includes('. ')) return s.split('. ').slice(1).join('. '); const w = (p.n || '').split(' '); return w.length > 1 ? w.slice(1).join(' ') : p.n; }
  return p.s || p.n;
}
function hex(c) { c = (c || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) || 0); }
const cd = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const lum = (c) => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
function kits() {
  const mk = (t) => { let body = t?.color || '#8B5E3C', alt = t?.alt || '#FFFFFF';
    if (cd(body, alt) < 90) alt = lum(body) > 0.55 ? '#1A1310' : '#FFFFFF';
    return { body, shorts: alt, ring: alt, num: cd(body, alt) > 110 ? alt : (lum(body) > 0.55 ? '#1A1310' : '#FFFFFF') }; };
  const H = mk(teamOf('H')); let A = P.A ? mk(teamOf('A')) : null;
  if (A && cd(A.body, H.body) < 120) {
    const t = teamOf('A'); const alt = A.shorts;
    if (cd(alt, H.body) > 140) A = { body: alt, shorts: A.body, ring: A.body, num: cd(alt, A.body) > 110 ? A.body : (lum(alt) > .55 ? '#1A1310' : '#FFFFFF') };
    else A = lum(H.body) > 0.5 ? { body: '#22375A', shorts: '#FFFFFF', ring: '#FFFFFF', num: '#FFFFFF' } : { body: '#F4F1EC', shorts: '#22375A', ring: '#22375A', num: '#22375A' };
    void t;
  }
  const gk = (k, alt) => { let body = alt ? '#9AD0F5' : '#C6E35B'; if (cd(body, k.body) < 120) body = alt ? '#E8E8E8' : '#2B2B2B'; const num = lum(body) > .55 ? '#1A1310' : '#FFFFFF'; return { body, shorts: body, ring: num, num }; };
  return { H, A, HG: gk(H, false), AG: A ? gk(A, true) : null };
}

// diziliş yuvası → dünya koordinatı
function slotXZ(side, form, i) {
  const s = formSlots(form)[i]; const two = !!P.A;
  const x = (s[0] - 0.5) * PW * 0.9; const z = two ? (HL - 2.5) - s[1] * (HL - 4.5) : (HL - 2.5) - s[1] * (PL * 0.8);
  return side === 'H' ? [x, z] : [-x, -z];
}
function slotKeys(side) { return Array.from({ length: 11 }, (_, i) => side + i); }
function sides() { return P.A ? ['H', 'A'] : ['H']; }

// takımın son maçtaki dizilişi (yoksa verilen ya da 4-2-3-1)
function defForm(lg, id, fb) { const f = D.team(lg, id)?.last?.form; return f && formSlots(f).length === 11 && /^\d(-\d){2,4}$/.test(f) ? f : (fb || '4-2-3-1'); }
// dizilişe göre otomatik ilk 11
function autoXI(side, form) {
  const sq = squad(side); const used = new Set(); const out = Array(11).fill(null);
  // son maçın ilk 11'i varsa: aynı dizilişte birebir yerleştir, farklı dizilişte bu oyunculara öncelik ver
  const last = teamOf(side)?.last; const ids = new Set(sq.map((p) => p.id));
  if (last && last.st?.length === 11 && last.st.every((x) => ids.has(x.id))) {
    const lf = last.form && formSlots(last.form).length === 11 ? last.form : '';
    if (lf && lf === form) return D.placeStarters(formSlots(form), form, last.st.map((x) => ({ ...x, r: D.rank(x.pa, x.g) })));
  }
  const pref = new Set(last?.st?.map((x) => x.id) || []);
  const lastPa = new Map((last?.st || []).map((x) => [x.id, x.pa]));
  const sorted = [...sq].map((p) => (lastPa.get(p.id) ? { ...p, pa: lastPa.get(p.id) } : p))
    .sort((a, b) => (pref.has(b.id) - pref.has(a.id)) || (a.xi ?? 99) - (b.xi ?? 99) || ((+a.no || 99) - (+b.no || 99)));
  const xs = formSlots(form);
  // önce her mevki grubu için oyuncu seç, sonra grubun içinde sağ-sol sırasına göre yuvalara diz
  for (const g of ['G', 'D', 'M', 'F']) {
    const slots = [...Array(11).keys()].filter((i) => slotGroup(form, i) === g).sort((a, b) => xs[a][0] - xs[b][0]);
    const picks = [];
    for (let k = 0; k < slots.length; k++) { const p = sorted.find((x) => !used.has(x.id) && x.g === g); if (p) { used.add(p.id); picks.push(p); } }
    picks.sort((a, b) => lateral(a) - lateral(b));
    slots.forEach((si, k) => { if (picks[k]) out[si] = picks[k].id; });
  }
  // eksik kalan yuvaları (ör. yeterli orta saha yoksa) kalanlardan doldur; kaleciyi sahaya sürme
  for (let i = 0; i < 11; i++) if (!out[i]) { const p = sorted.find((x) => !used.has(x.id) && (i === 0 ? true : x.g !== 'G')) || sorted.find((x) => !used.has(x.id)); if (p) { used.add(p.id); out[i] = p.id; } }
  return out;
}
function baseStep() {
  const st = { on: {}, pos: {}, ball: [0, 0, 0], ann: [], hl: [], note: '', cam: null };
  for (const s of sides()) { st.on[s] = autoXI(s, P[s].form); slotKeys(s).forEach((k, i) => (st.pos[k] = slotXZ(s, P[s].form, i))); }
  if (!P.A) st.ball = [0, -10, 0];
  return st;
}

// ---------------- proje ----------------
function newProject(opts = {}) {
  const tr = D.teams('tur.1');
  const fbT = (D.findTeamByName('tur.1', /fenerbah/i) || tr[0]).id, gsT = (D.findTeamByName('tur.1', /galatasaray/i) || tr[1]).id;
  const H = opts.H || { lg: 'tur.1', team: fbT, form: defForm('tur.1', fbT) };
  const A = opts.A === null ? null : opts.A || { lg: 'tur.1', team: gsT, form: defForm('tur.1', gsT) };
  P = { v: 1, id: uid(), name: opts.name || 'Yeni taktik', mode: opts.mode || 'free', created: Date.now(), updated: Date.now(),
    H, A, match: null, score: ['', ''], title: '', custom: {}, extra: {}, ext: {}, subs: [], realSubs: [], steps: [] };
  P.steps = [baseStep()]; cur = 0; undo = [];
  return P;
}
function sampleProject() {
  newProject({ name: 'Örnek: kanat organizasyonu', mode: 'pre' });
  const s1 = P.steps[0]; s1.note = 'kurulum';
  const s2 = clone(s1); const mv = (k, dx, dz) => { s2.pos[k] = [s2.pos[k][0] + dx, s2.pos[k][1] + dz]; };
  mv('H1', 0, -16); mv('H4', 0, -18); ['H5', 'H6'].forEach((k) => mv(k, 0, -8)); mv('H7', 2, -8); mv('H8', -2, -6); mv('H9', 0, -6); mv('H10', -3, -6);
  for (let i = 1; i < 11; i++) { const k = 'A' + i; s2.pos[k] = [s2.pos[k][0] + 3, s2.pos[k][1] + 2]; }
  s2.ball = [...s2.pos.H6, 0]; s2.ann = [{ t: 'pass', a: [...s2.pos.H6], b: [27, -30], c: '#22375A' }, { t: 'run', a: [...s2.pos.H4], b: [28, -33], c: '#22375A' }, { t: 'zone', a: [14, -40], b: [34, -24], c: '#F2C94C' }];
  s2.note = 'bek bindiriyor, kanada pas'; s2.hl = ['H4'];
  const s3 = clone(s2); s3.ann = []; s3.hl = [];
  s3.pos.H4 = [28, -33]; s3.ball = [28, -33, 0]; s3.pos.H9 = [-2, -40]; s3.pos.H10 = [-14, -36]; s3.pos.H8 = [6, -30];
  s3.ann = [{ t: 'pass', a: [28, -33], b: [-1.5, -39], c: '#22375A' }, { t: 'circle', a: [-2, -40], r: 6, c: '#FFFFFF' }]; s3.note = 'ortaya yerden kesme';
  P.steps.push(s2, s3);
  return P;
}
function step() { return P.steps[cur]; }
function snapshot() { undo.push(JSON.stringify({ P, cur })); if (undo.length > 40) undo.shift(); $('#bUndo').disabled = false; }
function doUndo() { const u = undo.pop(); if (!u) return; const o = JSON.parse(u); P = o.P; cur = Math.min(o.cur, P.steps.length - 1); $('#bUndo').disabled = !undo.length; full(); persist(); }

let persistT = 0;
function persist() {
  clearTimeout(persistT);
  persistT = setTimeout(() => {
    try { snapTeams(); } catch (e) { }
    P.updated = Date.now(); ls.set('lt-p-' + P.id, P);
    const idx = ls.get('lt-index', []).filter((x) => x.id !== P.id);
    idx.unshift({ id: P.id, name: P.name, mode: P.mode, updated: P.updated, teams: teamLine() });
    ls.set('lt-index', idx); ls.set('lt-last', P.id);
  }, 400);
}
function teamLine() { const h = teamOf('H'), a = teamOf('A'); return h ? h.short + (a ? ' – ' + a.short : '') : ''; }
function openProject(id) {
  const p = ls.get('lt-p-' + id, null); if (!p) return false;
  P = p; P.ext ||= {}; P.extra ||= {}; P.custom ||= {}; P.subs ||= []; P.realSubs ||= []; P.pcache ||= {};
  if (!teamOf('H')) { const t = D.teams(P.H.lg)[0]; if (t) P.H.team = t.id; }
  if (P.A && !teamOf('A')) { const t = D.teams(P.A.lg)[1]; if (t) P.A.team = t.id; }
  cur = 0; undo = []; full(); return true;
}

// ---------------- sahneyi güncelle ----------------
function playersFor(st) {
  const K = kits(); const list = [];
  for (const s of sides()) {
    (st.on[s] || []).forEach((pid, i) => {
      const p = pid ? player(s, pid) : null; const key = s + i;
      const pos = st.pos[key] || slotXZ(s, P[s].form, i);
      const kit = i === 0 ? K[s + 'G'] : K[s];
      list.push({ key, side: s, pid, x: pos[0], z: pos[1], kit, no: p?.no || (p ? '' : i + 1), name: p ? labelName(p) : '', photo: SET.photos ? photoFor(p) : '' });
    });
  }
  return list;
}
const blobFaces = new Map();
function photoFor(p) {
  if (!p) return '';
  const u = D.faceUrl(p); if (!u) return '';
  if (!/^https?:/.test(u)) return u;
  if (blobFaces.has(p.id)) return blobFaces.get(p.id) || '';
  blobFaces.set(p.id, '');
  if (isApp()) D.getImageBlobUrl(u).then((b) => { blobFaces.set(p.id, b); refreshPlayers(); }).catch(() => { });
  return '';
}
function refreshPlayers() { if (!playing) { scene.syncPlayers(playersFor(step())); } }
function refresh() {
  const st = step();
  scene.syncPlayers(playersFor(st));
  scene.setPositions(st.pos, st.ball);
  scene.setAnnotations(st.ann, draft);
  scene.setHighlights(st.hl);
  ovDirty = true; scene.dirty = true;
}
function full() {
  scene.figScale = SET.figScale; scene.labelSize = SET.labelSize; scene.showNames = SET.names; scene.showPhotos = SET.photos;
  if (scene.theme !== SET.theme) scene.setTheme(SET.theme);
  loadLogos(); renderChips(); refresh();
}
function loadLogos() {
  for (const s of ['H', 'A']) { const t = s === 'A' && !P.A ? null : teamOf(s); if (!t) continue;
    const u = D.logoUrl(t) || t.logoUrl || ''; if (!u || imgs.has(u)) continue; imgs.set(u, null);
    const go = (src) => loadImage(src).then((im) => { imgs.set(u, im); ovDirty = true; scene.dirty = true; });
    if (/^https?:/.test(u)) { if (isApp()) D.getImageBlobUrl(u).then(go).catch(() => { }); } else go(u);
  }
}
function overlayInfo() {
  const side = (s) => { const t = teamOf(s); if (!t) return null; const K = kits()[s]; const u = D.logoUrl(t) || t.logoUrl || '';
    return { name: t.short || t.name, form: P[s].form, color: K.body, alt: K.ring, logo: imgs.get(u) || null }; };
  let chip = '';
  if (P.mode === 'pre') { chip = 'MAÇ ÖNÜ · OLASI 11'; if (P.match?.date) chip = 'MAÇ ÖNÜ · ' + new Date(P.match.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }).toLocaleUpperCase('tr'); }
  if (P.mode === 'post') chip = 'MAÇ SONU';
  const note = playing ? playing.note : step()?.note;
  return { scoreBar: SET.scoreBar, chip, home: side('H'), away: P.A ? side('A') : null, score: P.mode === 'pre' ? null : P.score, title: P.title, note, banners, sign: SET.sign };
}

// ---------------- işaretçi (dokunma) ----------------
let downAt = null;
function onDown(e) {
  if (!e.isPrimary) { if (drag || draft) e.stopImmediatePropagation(); return; }
  closePop();
  if (playing) { if (SET.camLock) e.stopImmediatePropagation(); return; }
  const x = e.clientX, y = e.clientY; downAt = [x, y];
  if (tool === 'move' || tool === 'hl') {
    const hit = scene.pick(x, y);
    if (hit) {
      e.stopImmediatePropagation(); gl.setPointerCapture(e.pointerId);
      const st = step(); let carry = null;
      if (hit !== 'ball' && tool === 'move') { const p = st.pos[hit]; if (p && Math.hypot(st.ball[0] - p[0], st.ball[1] - p[1]) < 3.2) carry = [st.ball[0] - p[0], st.ball[1] - p[1]]; }
      drag = { key: hit, moved: false, carry, snap: false };
      return;
    }
    if (SET.camLock) e.stopImmediatePropagation();
    return;
  }
  e.stopImmediatePropagation(); gl.setPointerCapture(e.pointerId);
  const g = scene.groundAt(x, y); if (!g) return;
  if (tool === 'x') { drag = { xmark: g }; return; }
  if (tool === 'erase') { drag = { erase: true }; return; }
  const a = snapToPlayer(g);
  draft = tool === 'circle' ? { t: 'circle', a: g, r: 1.5, c: color } : { t: tool, a, b: a, c: color };
  scene.setAnnotations(step().ann, draft);
}
function snapToPlayer(g) {
  const st = step(); let best = null, bd = 3.5;
  for (const [k, p] of Object.entries(st.pos)) { const d = Math.hypot(p[0] - g[0], p[1] - g[1]); if (d < bd && keyActive(k)) { bd = d; best = p; } }
  const bdist = Math.hypot(st.ball[0] - g[0], st.ball[1] - g[1]); if (bdist < Math.min(bd, 2.5)) best = st.ball;
  return best ? [best[0], best[1]] : g;
}
function keyActive(k) { return P.A || k[0] === 'H'; }
gl.addEventListener('pointermove', (e) => {
  if (!e.isPrimary) return;
  if (drag && drag.key) {
    if (!drag.moved && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) return;
    if (!drag.moved) { snapshot(); drag.moved = true; }
    const g = scene.groundAt(e.clientX, e.clientY); if (!g) return; const st = step();
    if (drag.key === 'ball') st.ball = [g[0], g[1], 0];
    else { st.pos[drag.key] = g; if (drag.carry) st.ball = [g[0] + drag.carry[0], g[1] + drag.carry[1], 0]; }
    scene.setPositions(st.pos, st.ball);
  } else if (draft) {
    const g = scene.groundAt(e.clientX, e.clientY); if (!g) return;
    if (draft.t === 'circle') draft.r = Math.max(1.5, Math.hypot(g[0] - draft.a[0], g[1] - draft.a[1]));
    else draft.b = draft.t === 'zone' ? g : g;
    scene.setAnnotations(step().ann, draft);
  }
});
function endPointer(e) {
  if (!e.isPrimary) return;
  if (drag && drag.key) {
    const d = drag; drag = null;
    if (d.moved) { persist(); ovDirty = true; return; }
    if (tool === 'hl') { if (d.key !== 'ball') toggleHl(d.key); return; }
    if (d.key !== 'ball') openPop(d.key, e.clientX, e.clientY);
    return;
  }
  if (drag && drag.xmark) { snapshot(); step().ann.push({ t: 'x', a: drag.xmark, c: color }); drag = null; refresh(); persist(); return; }
  if (drag && drag.erase) { drag = null; eraseAt(e.clientX, e.clientY); return; }
  if (draft) {
    const d = draft; draft = null;
    let ok = d.t === 'circle' ? d.r > 1.8 : Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) > 2;
    if (ok) { if (d.t !== 'circle' && d.t !== 'zone') d.b = snapToPlayer(d.b); snapshot(); step().ann.push(d); persist(); }
    scene.setAnnotations(step().ann, null);
  }
}
gl.addEventListener('pointerup', endPointer);
gl.addEventListener('pointercancel', () => { drag = null; draft = null; scene.setAnnotations(step().ann, null); });

function toggleHl(key) { snapshot(); const st = step(); const i = st.hl.indexOf(key); if (i >= 0) st.hl.splice(i, 1); else st.hl.push(key); scene.setHighlights(st.hl); persist(); }
function eraseAt(x, y) {
  const st = step(); let best = -1, bd = 34;
  st.ann.forEach((a, i) => {
    const pts = [a.a, a.b, a.a && a.b ? [(a.a[0] + a.b[0]) / 2, (a.a[1] + a.b[1]) / 2] : null].filter(Boolean);
    if (a.t === 'circle') for (let k = 0; k < 8; k++) pts.push([a.a[0] + Math.cos(k * Math.PI / 4) * a.r, a.a[1] + Math.sin(k * Math.PI / 4) * a.r]);
    for (const p of pts) { const s = scene.project(p[0], p[1]); const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; best = i; } }
  });
  if (best >= 0) { snapshot(); st.ann.splice(best, 1); refresh(); persist(); toast('Çizim silindi'); return; }
  const k = scene.pick(x, y); if (k && k !== 'ball' && st.hl.includes(k)) toggleHl(k);
}

// oyuncu açılır menüsü
function openPop(key, cx, cy) {
  const side = key[0], i = +key.slice(1), pid = step().on[side][i], p = player(side, pid);
  const pop = $('#pop'); const r = $('#stage').getBoundingClientRect();
  const face = p && photoFor(p);
  pop.innerHTML = `<div class="ph"><span class="av" style="background-color:${kits()[side].body};${face ? `background-image:url('${face}')` : ''}">${face ? '' : esc(p?.no || '')}</span><div><b>${esc(p ? labelName(p) : 'Boş yuva')}</b><div class="note">${esc(teamOf(side)?.short || '')} · ${POS_TR[slotGroup(P[side].form, i)]}</div></div></div>
    <div class="pa"><button data-a="hl">${step().hl.includes(key) ? 'Vurguyu kaldır' : 'Vurgula'}</button><button data-a="sub">Değiştir</button><button data-a="ball">Topu ver</button><button data-a="edit">Düzenle</button></div>`;
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(6, Math.min(r.width - pw - 6, cx - r.left - pw / 2)) + 'px';
  pop.style.top = Math.max(6, Math.min(r.height - ph - 6, cy - r.top - ph - 18)) + 'px';
  pop.onclick = (ev) => { const a = ev.target.closest('button')?.dataset.a; if (!a) return; closePop();
    if (a === 'hl') toggleHl(key);
    if (a === 'ball') { snapshot(); const pp = step().pos[key]; const dir = side === 'H' ? -1 : 1; step().ball = [pp[0], pp[1] + dir * 1.8, 0]; refresh(); persist(); }
    if (a === 'sub') openSquad(side, i);
    if (a === 'edit' && p) editPlayer(side, p, () => full());
  };
}
function closePop() { $('#pop').hidden = true; }

// ---------------- araç çubuğu ----------------
function renderTools() {
  $('#tools').innerHTML = TOOLS.map(([id, l, ic]) => `<button class="tool${id === tool ? ' on' : ''}" data-t="${id}" aria-label="${l}">${ic}<span>${l}</span></button>`).join('');
  $('#colors').innerHTML = COLORS.map(([c, n]) => `<button class="dot${c === color ? ' on' : ''}" style="background:${c}" data-c="${c}" aria-label="${n}"></button>`).join('');
}
$('#tools').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tool = b.dataset.t; closePop(); renderTools(); if (DRAW_TOOLS.has(tool)) toast(tool === 'circle' ? 'Merkezden dışa doğru sürükle' : tool === 'zone' ? 'Köşeden köşeye sürükle' : 'Başlangıçtan bitişe sürükle'); if (tool === 'hl') toast('Vurgulamak için oyuncuya dokun'); if (tool === 'erase') toast('Silmek için çizime dokun'); };
$('#colors').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; color = b.dataset.c; renderTools(); };
$('#bUndo').onclick = doUndo; $('#bUndo').disabled = true;
$('#bClear').onclick = () => { const st = step(); if (!st.ann.length && !st.hl.length) return; snapshot(); st.ann = []; st.hl = []; refresh(); persist(); toast('Çizimler temizlendi · Geri al ile dönebilirsin'); };

// ---------------- kamera ----------------
$('#bCam').onclick = () => { const m = $('#camMenu'); if (!m.hidden) { m.hidden = true; return; }
  m.innerHTML = Object.entries(CAMS).map(([k, c]) => `<button data-c="${k}">${c.label}</button>`).join('') + '<button data-c="__step">Kamerayı bu adıma kaydet</button>' + (step().cam ? '<button data-c="__clr">Adım kamerasını sil</button>' : '');
  m.hidden = false; };
$('#camMenu').onclick = (e) => { const k = e.target.closest('[data-c]')?.dataset.c; if (!k) return; $('#camMenu').hidden = true;
  if (k === '__step') { snapshot(); step().cam = scene.getCam(); renderChips(); persist(); toast(`Kamera ${cur + 1}. adıma kaydedildi. Oynatırken kamera bu açıya gelir.`); return; }
  if (k === '__clr') { snapshot(); step().cam = null; renderChips(); persist(); return; }
  scene.setCam(CAMS[k]); };
$('#bLock').onclick = () => { SET.camLock = !SET.camLock; saveSet(); $('#bLock').classList.toggle('on', SET.camLock); scene.controls.enabled = !SET.camLock; toast(SET.camLock ? 'Kamera kilitli' : 'Kamera serbest'); };

// ---------------- adımlar ----------------
function renderChips() {
  $('#stepChips').innerHTML = P.steps.map((s, i) => `<button class="chip${i === cur ? ' on' : ''}" data-i="${i}" aria-label="Adım ${i + 1}">${i + 1}${s.cam ? '<i></i>' : ''}</button>`).join('');
  $('#stepChips').querySelector('.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
$('#stepChips').onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; stopPlay(); goStep(+b.dataset.i); };
function goStep(i, cam = true) { cur = i; renderChips(); refresh(); if (cam && step().cam) scene.setCam(step().cam, 700); }
$('#bAddStep').onclick = () => { stopPlay(); snapshot(); const s = clone(step()); s.ann = []; s.hl = []; s.note = ''; s.cam = null; P.steps.splice(cur + 1, 0, s); goStep(cur + 1, false); persist(); toast(`${cur + 1}. adım eklendi. Oyuncuları yeni yerlerine taşı.`); };
$('#bStepMenu').onclick = () => stepSheet();
$('#bPlay').onclick = () => (playing ? stopPlay() : play());

function play(fromStart = true) {
  if (P.steps.length < 2) { toast('Oynatmak için en az 2 adım ekle (+)'); return; }
  closePop(); playing = { t0: performance.now(), start: fromStart ? 0 : cur, lastIdx: -1, note: '' };
  if (P.steps[playing.start].cam) scene.setCam(P.steps[playing.start].cam, 0);
  $('#bPlay').classList.add('on');
}
function stopPlay() { if (!playing) return; playing = null; $('#bPlay').classList.remove('on'); refresh(); }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function applyPlayback(now) {
  const seg = SET.hold + SET.stepDur; const n = P.steps.length; const s0 = playing.start;
  const t = (now - playing.t0) / 1000; let i = s0 + Math.floor(t / seg);
  if (i >= n - 1) { // son adımda dur
    const last = n - 1; if (playing.lastIdx !== last) enterStep(last, true);
    settle(last);
    if (!playing.done && t > (n - 1 - s0) * seg + 1.2) { playing.done = true; setTimeout(() => { stopPlay(); goStep(n - 1, false); }, 0); }
    return;
  }
  const lt = t - (i - s0) * seg; const A = P.steps[i], B = P.steps[i + 1];
  if (lt < SET.hold) { if (playing.lastIdx !== i) enterStep(i, false); settle(i); return; }
  playing.settled = -1;
  const k = ease(Math.min(1, (lt - SET.hold) / SET.stepDur));
  if (k >= 0.5 && playing.lastIdx === i) enterStep(i + 1, true, true);
  const pos = {}; for (const key of Object.keys(B.pos)) { const a = A.pos[key] || B.pos[key], b = B.pos[key]; pos[key] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  // top: havadan pas varsa yay çiz
  const lob = A.ann.find((x) => x.t === 'lob' && Math.hypot(x.a[0] - A.ball[0], x.a[1] - A.ball[1]) < 4);
  const L = Math.hypot(B.ball[0] - A.ball[0], B.ball[1] - A.ball[1]);
  const air = lob ? 4 * Math.min(14, 3 + L * 0.22) * k * (1 - k) : 0;
  scene.setPositions(pos, [A.ball[0] + (B.ball[0] - A.ball[0]) * k, A.ball[1] + (B.ball[1] - A.ball[1]) * k, air]);
  // çizimler: öncekinin okları erken solar, yenisi sonda belirir
  const fadeA = Math.max(0, 1 - k * 2.4), fadeB = Math.max(0, (k - 0.65) / 0.35);
  scene.setAnnotations([...A.ann.map((x) => ({ ...x, op: fadeA })).filter((x) => x.op > 0.02), ...B.ann.map((x) => ({ ...x, op: fadeB })).filter((x) => x.op > 0.02)]);
  if (A.cam && B.cam) scene.lerpCam(A.cam, B.cam, k);
}
// adımın tam konumlarına otur (geçişin son karesi %100'e denk gelmeyebilir)
function settle(i) {
  if (playing.settled === i) return; playing.settled = i;
  const st = P.steps[i]; scene.setPositions(st.pos, st.ball); scene.setAnnotations(st.ann); scene.setHighlights(st.hl);
  if (st.cam && P.steps[i - 1]?.cam) scene.lerpCam(st.cam, st.cam, 1);
}
function enterStep(i, withSubs, midTransition = false) {
  const st = P.steps[i]; playing.lastIdx = i; playing.note = st.note; ovDirty = true;
  // kadro değiştiyse (oyuncu değişikliği) figürleri güncelle + bant
  const before = new Map(); for (const [k, o] of scene.players) before.set(k, o.pid);
  scene.syncPlayers(playersFor(st)); scene.setHighlights(st.hl);
  if (!midTransition) { scene.setPositions(st.pos, st.ball); scene.setAnnotations(st.ann); }
  for (const [k, o] of scene.players) if (before.has(k) && before.get(k) && before.get(k) !== o.pid) scene.popPlayer(k);
  if (withSubs) for (const s of P.subs.filter((x) => x.step === i)) pushBanner(s);
  if (!midTransition && st.cam && i === playing.start) scene.setCam(st.cam, 0);
}
function pushBanner(s) {
  const out = player(s.side, s.out), inn = player(s.side, s.in); const K = kits()[s.side];
  banners.push({ t0: performance.now(), color: K.body, textColor: K.num, text: `${s.min ? s.min + "'  " : ''}↓ ${out ? labelName(out) : '?'}   ↑ ${inn ? labelName(inn) : '?'}` });
  ovDirty = true; scene.dirty = true;
}

// ---------------- kayıt ----------------
$('#bRec').onclick = async () => {
  if (rec.active) return stopRec();
  closePop();
  if (SET.countdown) {
    const c = $('#count'); c.hidden = false;
    for (const n of [3, 2, 1]) { c.textContent = n; await new Promise((r) => setTimeout(r, 750)); }
    c.hidden = true;
  }
  try {
    await rec.start({ fps: 30, mic: SET.mic, bitrate: SET.quality === 'hi' ? 14e6 : 8e6 });
  } catch (e) { toast(e.message || 'Kayıt başlatılamadı'); return; }
  applyPixelRatio(); ovDirty = true;
  $('#bRec').classList.add('on'); $('#bRec span').textContent = 'Bitir'; $('#recTime').hidden = false;
  if (rec.micErr) { toast(rec.micErr + ' Kayıt sessiz devam ediyor.'); rec.micErr = null; }
};
async function stopRec() {
  $('#bRec').classList.remove('on'); $('#bRec span').textContent = 'Kayıt'; $('#recTime').hidden = true;
  let res; try { res = await rec.stop(); } catch (e) { applyPixelRatio(); toast('Video tamamlanamadı: ' + (e.message || e)); return; }
  applyPixelRatio(); if (!res) return;
  const base = (P.title || teamLine() || 'taktik').toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/g, '-').replace(/^-|-$/g, '') || 'taktik';
  const d = new Date(); const name = `${base}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.${res.ext}`;
  const url = URL.createObjectURL(res.blob);
  openSheet(`<div class="hd"><h2>Kayıt hazır</h2><button class="x" data-close aria-label="Kapat">${I('<path d="M6 6l12 12M18 6 6 18"/>')}</button></div>
    <video src="${url}" controls playsinline></video>
    <p class="note">${esc(name)} · ${(res.blob.size / 1048576).toFixed(1)} MB · ${res.dur.toFixed(1)} sn · 1080×1920${res.ext !== 'mp4' ? ' · Bu cihaz MP4 yazamadı, WebM oldu.' : ''}</p>
    <div class="btns"><button class="btn pri" id="vSave">Telefona kaydet</button><button class="btn" id="vShare"${isApp() ? '' : ' hidden'}>Paylaş / gönder</button><button class="btn warn" id="vDel">Sil</button></div>
    <p class="note" id="vMsg"></p>`, () => URL.revokeObjectURL(url));
  let saved = null;
  const doSave = async () => { if (saved) return saved; $('#vMsg').textContent = 'Kaydediliyor…'; try { saved = await saveFile(res.blob, name, 'Videolar'); $('#vMsg').textContent = 'Kaydedildi: ' + saved.where; } catch (e) { $('#vMsg').textContent = 'Kaydedilemedi: ' + (e.message || e); } return saved; };
  $('#vSave').onclick = doSave;
  $('#vShare').onclick = async () => { const s = await doSave(); if (s?.uri) try { await shareFile(s.uri, name); } catch (e) { } };
  $('#vDel').onclick = () => closeSheet();
}

// ---------------- alt sayfa yardımcıları ----------------
let onSheetClose = null;
function openSheet(html, onClose) { $('#shBody').innerHTML = html; $('#sheet').hidden = false; onSheetClose = onClose || null; $('#shBody').scrollTop = 0; }
function closeSheet() { $('#sheet').hidden = true; if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); } }
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
const xBtn = `<button class="x" data-close aria-label="Kapat">${I('<path d="M6 6l12 12M18 6 6 18"/>')}</button>`;
const leagueOpts = (sel) => D.LEAGUE_ORDER.map((s) => `<option value="${s}"${s === sel ? ' selected' : ''}>${D.LEAGUE_NAMES[s]}</option>`).join('');
const teamOpts = (lg, sel) => D.teams(lg).map((t) => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
const formOpts = (sel) => { const all = FORM_NAMES.includes(sel) ? FORM_NAMES : [sel, ...FORM_NAMES]; return all.map((f) => `<option${f === sel ? ' selected' : ''}>${f}</option>`).join(''); };

// ---------------- Maç sayfası ----------------
$('#bMatch').onclick = () => matchSheet();
function matchSheet() {
  const extA = P.A && P.ext[P.A.team];
  openSheet(`<div class="hd"><h2>Maç</h2>${xBtn}</div>
  <div class="grp"><h3>Senaryo</h3><div class="seg" id="mMode">${['free', 'pre', 'post'].map((m) => `<button data-m="${m}" class="${P.mode === m ? 'on' : ''}">${MODE_LABEL[m]}</button>`).join('')}</div>
  <p class="note" id="mModeNote"></p></div>
  <div class="grp"><h3>Ev sahibi</h3><div class="three"><select id="mLgH">${leagueOpts(P.H.lg)}</select><select id="mTmH">${P.ext[P.H.team] ? `<option value="${P.H.team}">${esc(P.ext[P.H.team].name)}</option>` : ''}${teamOpts(P.H.lg, P.H.team)}</select><select id="mFmH">${formOpts(P.H.form)}</select></div></div>
  <div class="grp"><h3>Rakip</h3><div class="three"><select id="mLgA"><option value="">Rakip yok</option>${leagueOpts(P.A?.lg)}</select><select id="mTmA"${P.A ? '' : ' disabled'}>${extA ? `<option value="${P.A.team}">${esc(extA.name)}</option>` : ''}${P.A ? teamOpts(P.A.lg, P.A.team) : ''}</select><select id="mFmA"${P.A ? '' : ' disabled'}>${formOpts(P.A?.form || '4-3-3')}</select></div>
  <p class="note">Takımı veya rakibi değiştirince ilk 11 dizilişe göre yeniden kurulur ve adımlar sıfırlanır. Sadece diziliş değişirse oyuncular en yakın yuvaya kayar.</p></div>
  <div class="grp"><h3>Fikstürden seç</h3><div class="btns"><button class="btn" id="mFix">${P.mode === 'post' ? 'Oynanan maçlar' : 'Gelecek ve oynanan maçlar'}</button></div><div class="list" id="mFixList"></div></div>
  <div class="grp"><h3>Video yazıları</h3>
    <div class="two"><input type="text" id="mScH" inputmode="numeric" placeholder="Ev skor" value="${esc(P.score[0])}"><input type="text" id="mScA" inputmode="numeric" placeholder="Rakip skor" value="${esc(P.score[1])}"></div>
    <input type="text" id="mTitle" maxlength="70" placeholder="Başlık (ör. Fenerbahçe'nin sağ kanat planı)" value="${esc(P.title)}">
  </div>
  <div class="grp"><h3>Kadrolar</h3><p class="note" id="mData"></p><div class="prog" id="mProg" hidden><i></i></div><div class="btns"><button class="btn" id="mRefresh">Kadroları internetten güncelle</button></div></div>`);
  const modeNote = () => { $('#mModeNote').textContent = { free: 'Serbest çizim: skor bandında sadece takımlar görünür.', pre: 'Maç önü: "olası 11" anlatımı. Fikstürden maçı seçersen tarih banda yazılır. Kadro sayfasında son maçın 11\'ini yükleyebilirsin.', post: 'Maç sonu: oynanmış maçı seçince gerçek ilk 11, diziliş, skor ve oyuncu değişiklikleri gelir.' }[P.mode]; };
  modeNote(); dataNote();
  $('#mMode').onclick = (e) => { const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; snapshot(); P.mode = m; $('#mMode').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === m)); modeNote(); $('#mFix').textContent = m === 'post' ? 'Oynanan maçlar' : 'Gelecek ve oynanan maçlar'; ovDirty = true; persist(); };
  $('#mLgH').onchange = (e) => { const lg = e.target.value; $('#mTmH').innerHTML = teamOpts(lg); setTeam('H', lg, D.teams(lg)[0]?.id); };
  $('#mTmH').onchange = (e) => setTeam('H', $('#mLgH').value, e.target.value);
  $('#mFmH').onchange = (e) => setForm('H', e.target.value);
  $('#mLgA').onchange = (e) => { const lg = e.target.value; if (!lg) { setTeam('A', null); $('#mTmA').innerHTML = ''; $('#mTmA').disabled = $('#mFmA').disabled = true; return; } $('#mTmA').disabled = $('#mFmA').disabled = false; $('#mTmA').innerHTML = teamOpts(lg); setTeam('A', lg, D.teams(lg).find((t) => t.id !== P.H.team)?.id); };
  $('#mTmA').onchange = (e) => setTeam('A', $('#mLgA').value, e.target.value);
  $('#mFmA').onchange = (e) => setForm('A', e.target.value);
  $('#mScH').oninput = (e) => { P.score[0] = e.target.value.trim(); ovDirty = true; persist(); };
  $('#mScA').oninput = (e) => { P.score[1] = e.target.value.trim(); ovDirty = true; persist(); };
  $('#mTitle').oninput = (e) => { P.title = e.target.value; ovDirty = true; persist(); };
  $('#mFix').onclick = loadFixtures;
  $('#mRefresh').onclick = async () => {
    const b = $('#mRefresh'), pg = $('#mProg'); b.disabled = true; pg.hidden = false;
    try { const n = await D.refreshSquads((d, t, l) => { pg.firstElementChild.style.width = (d / t * 100) + '%'; b.textContent = `${l} · ${d}/${t}`; });
      toast(`${n} ligin kadrosu güncellendi`); full(); }
    catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = 'Kadroları internetten güncelle'; pg.hidden = true; dataNote();
  };
}
function dataNote() {
  const el = $('#mData'); if (!el) return;
  const src = { live: 'telefonda güncellendi', bundled: 'uygulamayla geldi', fallback: 'elle derlenmiş yedek' };
  const d = D.DB.updated ? new Date(D.DB.updated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const fb = Object.values(D.DB.leagues).filter((l) => l.src === 'fallback').map((l) => l.name);
  const allFb = fb.length === D.LEAGUE_ORDER.length;
  el.innerHTML = (allFb ? `Elle derlenmiş yedek kadrolar (${esc(d)}). ` : `Kaynak: ESPN · son güncelleme ${esc(d)}. ` + [...new Set(Object.values(D.DB.leagues).map((l) => src[l.src]))].join(', ') + '. ') + (fb.length ? `<br><span class="warnbox" style="display:block;margin-top:6px">${esc(fb.join(', '))}: tam kadro alınamadı, elle derlenmiş yedek kullanılıyor (yedek kulübesi eksik olabilir). "Kadroları güncelle" ile tamamla.</span>` : '');
}
function setTeam(side, lg, id) {
  snapshot();
  if (side === 'A' && !lg) { P.A = null; }
  else { P[side] = { lg, team: String(id), form: defForm(lg, id, P[side]?.form) }; }
  P.match = null; P.subs = []; P.realSubs = []; P.steps = [baseStep()]; cur = 0; full(); persist();
}
function setForm(side, form) {
  snapshot(); P[side].form = form;
  // eski yuva → yeni yuva eşlemesi (1. adımdaki konumlara göre en yakın; kaleci hep kalede)
  const slots = Array.from({ length: 11 }, (_, i) => slotXZ(side, form, i));
  const map = [0]; const pairs = [];
  for (let i = 1; i < 11; i++) for (let k = 1; k < 11; k++) { const c = P.steps[0].pos[side + i] || slots[i]; pairs.push([Math.hypot(c[0] - slots[k][0], c[1] - slots[k][1]), i, k]); }
  pairs.sort((a, b) => a[0] - b[0]); const ui = new Set(), uk = new Set();
  for (const [, i, k] of pairs) { if (ui.has(i) || uk.has(k)) continue; ui.add(i); uk.add(k); map[i] = k; }
  P.steps.forEach((st, si) => {
    const on = [...st.on[side]], pos = { ...st.pos }, newOn = Array(11).fill(null);
    for (let i = 0; i < 11; i++) { const k = map[i]; newOn[k] = on[i]; st.pos[side + k] = si === 0 ? slots[k] : (pos[side + i] || slots[k]); }
    st.on[side] = newOn;
    st.hl = st.hl.map((key) => (key[0] === side ? side + map[+key.slice(1)] : key));
  });
  full(); persist(); toast(`${form} uygulandı`);
}
async function loadFixtures() {
  const box = $('#mFixList'); box.innerHTML = '<p class="note">Fikstür yükleniyor…</p>';
  const t = teamOf('H');
  try {
    const evs = await D.schedule(P.H.lg, t.id);
    const now = Date.now();
    let list = P.mode === 'post' ? evs.filter((e) => e.completed).reverse() : [...evs.filter((e) => !e.completed && new Date(e.date) > now - 864e5), ...evs.filter((e) => e.completed).reverse()];
    list = list.slice(0, 14);
    if (!list.length) { box.innerHTML = '<p class="note">Maç bulunamadı.</p>'; return; }
    box.innerHTML = list.map((e, i) => `<button class="fx" data-i="${i}"><span class="d">${new Date(e.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}<br>${esc(e.comp || '')}</span><span><b>${esc(e.home.name)}</b> – <b>${esc(e.away.name)}</b></span><span class="s">${e.completed ? esc(e.home.score) + '–' + esc(e.away.score) : new Date(e.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></button>`).join('');
    box.onclick = (ev) => { const b = ev.target.closest('[data-i]'); if (b) applyFixture(list[+b.dataset.i]); };
  } catch (e) { box.innerHTML = `<p class="note">Fikstür alınamadı (${esc(e.message)}). İnternet bağlantını kontrol et.</p>`; }
}
function findTeamAnywhere(id, name) {
  for (const lg of D.LEAGUE_ORDER) { const t = D.team(lg, id); if (t) return { lg, t }; }
  const n = (name || '').toLowerCase().replace(/[^a-zğüşöçı]/g, '');
  for (const lg of D.LEAGUE_ORDER) for (const t of D.teams(lg)) { const m = t.name.toLowerCase().replace(/[^a-zğüşöçı]/g, ''); if (n && (m.includes(n) || n.includes(m))) return { lg, t }; }
  return null;
}
async function applyFixture(ev) {
  snapshot(); const schedLg = P.H.lg;
  const resolve = (side, info) => {
    const f = findTeamAnywhere(info.id, info.name);
    if (f) return { lg: f.lg, team: f.t.id, form: defForm(f.lg, f.t.id, P[side]?.form) };
    P.ext[info.id] = { id: info.id, name: info.name, short: info.name, color: side === 'H' ? '#8B5E3C' : '#22375A', alt: '#FFFFFF', players: [] };
    return { lg: P.H.lg, team: info.id, form: '4-2-3-1' };
  };
  P.H = resolve('H', ev.home); P.A = resolve('A', ev.away);
  P.match = { event: ev.id, date: ev.date, comp: ev.comp, lg: schedLg }; P.subs = []; P.realSubs = [];
  P.score = ev.completed ? [ev.home.score, ev.away.score] : ['', ''];
  if (ev.completed) P.mode = 'post'; else P.mode = 'pre';
  P.name = `${ev.home.name} – ${ev.away.name}`;
  P.steps = [baseStep()]; cur = 0;
  if (ev.completed) {
    toast('Maç kadrosu yükleniyor…');
    try { await applySummary(ev.id, ev.home.id); toast('Gerçek ilk 11, diziliş ve değişiklikler yüklendi'); }
    catch (e) { toast('Maç kadrosu alınamadı, olası 11 kuruldu'); }
  } else toast('Maç önü: olası 11 kuruldu. Kadro sayfasından düzenle.');
  closeSheet(); full(); persist();
}
async function applySummary(eventId, homeId, only) {
  const m = await D.matchSummary(P.match?.lg || P.H.lg, eventId, homeId);
  for (const s of only ? [only] : ['H', 'A']) {
    if (!P[s] || !m.starters[s]?.length) continue;
    const t = teamOf(s); P.extra[t.id] ||= [];
    const known = new Set(squad(s).map((p) => p.id));
    for (const p of [...m.starters[s], ...(m.bench[s] || [])]) if (!known.has(p.id)) { P.extra[t.id].push({ id: p.id, n: p.n, s: p.s, no: p.no, g: p.g, pa: p.pa, f: 0, img: p.img }); known.add(p.id); }
    if (m.formation[s]) P[s].form = m.formation[s].replace(/\s/g, '');
    // yuvalara yerleştir: derinlik ve sağ-sol sırasına göre
    const on = D.placeStarters(formSlots(P[s].form), P[s].form, m.starters[s].slice(0, 11));
    for (const step of P.steps) { step.on[s] = [...on]; slotKeys(s).forEach((k, i) => (step.pos[k] = slotXZ(s, P[s].form, i))); }
  }
  if (!only) { P.realSubs = m.subs.filter((x) => x.in && x.out); if (m.score[0] !== '') P.score = m.score; }
}

// ---------------- Kadro / oyuncu değişikliği sayfası ----------------
$('#bSquad').onclick = () => openSquad('H');
let sqSel = null; let sqMode = null; let sqMin = '';
function openSquad(side, slot) {
  if (side === 'A' && !P.A) side = 'H';
  sqSel = slot != null ? { kind: 'on', i: slot } : null;
  if (!sqMode) sqMode = cur === 0 ? 'xi' : 'sub';
  if (slot != null && cur > 0) sqMode = 'sub';
  renderSquad(side);
}
function renderSquad(side) {
  const st = step(); const t = teamOf(side); const sq = squad(side); const on = st.on[side] || [];
  const onSet = new Set(on.filter(Boolean)); const bench = sq.filter((p) => !onSet.has(p.id)).sort((a, b) => 'GDMF'.indexOf(a.g || 'M') - 'GDMF'.indexOf(b.g || 'M') || (+a.no || 99) - (+b.no || 99));
  const K = kits()[side];
  const av = (p) => { const f = photoFor(p); return `<span class="av" style="background-color:${K.body};color:${K.num};${f ? `background-image:url('${f}')` : ''}">${f ? '' : esc(p?.no || '')}</span>`; };
  const row = (p, kind, i, pos) => `<button class="pl${sqSel && sqSel.kind === kind && (kind === 'on' ? sqSel.i === i : sqSel.id === p?.id) ? ' sel' : ''}" data-k="${kind}" data-i="${i}" data-id="${p?.id || ''}">
     <span class="pos">${pos}</span>${av(p)}<span class="nm">${esc(p ? (p.no ? p.no + ' · ' : '') + labelName(p) : 'Boş')}<small>${esc(p ? [p.n !== labelName(p) ? p.n : '', p.pa && p.pa.length > 1 ? p.pa : ''].filter(Boolean).join(' · ') : '')}</small></span>
     ${p ? `<span class="ed" data-ed="${p.id}" role="button" aria-label="Düzenle">${I('<path d="M4 20h4L19 9l-4-4L4 16z"/>')}</span>` : '<span></span>'}</button>`;
  const subsHere = P.subs.filter((s) => s.side === side);
  const real = (P.realSubs || []).filter((s) => s.side === side);
  openSheet(`<div class="hd"><h2>Kadro</h2>${xBtn}</div>
   ${P.A ? `<div class="seg" id="sqSide"><button data-s="H" class="${side === 'H' ? 'on' : ''}">${esc(teamOf('H').short)}</button><button data-s="A" class="${side === 'A' ? 'on' : ''}">${esc(teamOf('A').short)}</button></div>` : ''}
   <div class="grp"><div class="two"><select id="sqForm" aria-label="Diziliş">${formOpts(P[side].form)}</select><button class="btn" id="sqAuto">Otomatik 11</button></div>
   <div class="btns"><button class="btn" id="sqLast">Son maçın 11'ini yükle</button><button class="btn" id="sqAdd">+ Oyuncu ekle</button></div></div>
   <div class="grp"><div class="seg" id="sqMode"><button data-m="xi" class="${sqMode === 'xi' ? 'on' : ''}">İlk 11'i düzenle</button><button data-m="sub" class="${sqMode === 'sub' ? 'on' : ''}">Oyuncu değişikliği</button></div>
   <p class="note">${sqMode === 'xi' ? 'Değişiklik tüm adımlara uygulanır, banda yazılmaz. İki ilk 11 oyuncusuna dokunursan yerlerini değiştirirler.' : `${cur + 1}. adımdan itibaren uygulanır, videoda değişiklik bandı çıkar.`}</p>
   ${sqMode === 'sub' ? `<input type="text" id="sqMin" inputmode="numeric" maxlength="6" placeholder="Dakika (ör. 63)" value="${esc(sqMin)}">` : ''}
   <p class="note"><b>${sqSel ? 'Şimdi ' + (sqSel.kind === 'on' ? 'yedeklerden girecek oyuncuyu' : 'çıkacak oyuncuyu') + ' seç.' : 'Önce bir oyuncu seç, sonra yerine geçecek oyuncuyu.'}</b></p></div>
   <div class="grp"><h3>Sahada · ${esc(t?.short || '')}</h3><div class="list" id="sqOn">${on.map((pid, i) => row(pid ? player(side, pid) : null, 'on', i, POS_TR[slotGroup(P[side].form, i)])).join('')}</div></div>
   <div class="grp"><h3>Yedekler ve kadro (${bench.length})</h3><div class="list" id="sqBench">${bench.map((p) => row(p, 'bench', 0, POS_TR[p.g] || '')).join('') || '<p class="note">Bu takım için yedek bilgisi yok. "+ Oyuncu ekle" ile ekleyebilir ya da Maç → "Kadroları güncelle" ile tam kadroyu alabilirsin.</p>'}</div></div>
   ${subsHere.length ? `<div class="grp"><h3>Yapılan değişiklikler</h3><div class="list">${subsHere.map((s) => `<div class="prj"><span><b>${esc(s.min ? s.min + "'" : '')} ↓ ${esc(labelName(player(side, s.out)))} ↑ ${esc(labelName(player(side, s.in)))}</b><small>${s.step + 1}. adımdan itibaren</small></span><button class="btn" data-undo="${P.subs.indexOf(s)}">Geri al</button></div>`).join('')}</div></div>` : ''}
   ${real.length ? `<div class="grp"><h3>Maçtaki gerçek değişiklikler</h3><div class="list">${real.map((s, k) => `<div class="prj"><span><b>${esc(s.min)} ↓ ${esc(labelName(player(side, s.out)) || '?')} ↑ ${esc(labelName(player(side, s.in)) || '?')}</b><small>${P.subs.find((x) => x.real === s.min + s.in) ? 'uygulandı' : 'henüz uygulanmadı'}</small></span><button class="btn" data-real="${k}">${cur + 1}. adımda uygula</button></div>`).join('')}</div></div>` : ''}
  `);
  $('#sqSide')?.addEventListener('click', (e) => { const s = e.target.closest('[data-s]')?.dataset.s; if (s) { sqSel = null; renderSquad(s); } });
  $('#sqMin') && ($('#sqMin').oninput = (e) => { sqMin = e.target.value.trim(); });
  $('#sqMode').onclick = (e) => { const m = e.target.closest('[data-m]')?.dataset.m; if (m) { sqMode = m; renderSquad(side); } };
  $('#sqForm').onchange = (e) => { setForm(side, e.target.value); renderSquad(side); };
  $('#sqAuto').onclick = () => { snapshot(); const xi = autoXI(side, P[side].form); for (const s of P.steps) s.on[side] = [...xi]; P.subs = P.subs.filter((x) => x.side !== side); full(); persist(); renderSquad(side); toast('İlk 11 otomatik kuruldu'); };
  $('#sqLast').onclick = async () => {
    const b = $('#sqLast'); b.disabled = true; b.textContent = 'Yükleniyor…';
    try {
      const tt = teamOf(side); const evs = await D.schedule(P[side].lg, tt.id); const last = evs.filter((e) => e.completed).pop();
      if (!last) throw new Error('Oynanmış maç yok');
      snapshot();
      const homeIsUs = String(last.home.id) === String(tt.id);
      const m = await D.matchSummary(P[side].lg, last.id, last.home.id);
      const ms = homeIsUs ? 'H' : 'A';
      if (!m.starters[ms]?.length) throw new Error('Bu maçın kadrosu yok');
      P.extra[tt.id] ||= []; const known = new Set(squad(side).map((p) => p.id));
      for (const p of [...m.starters[ms], ...(m.bench[ms] || [])]) if (!known.has(p.id)) { P.extra[tt.id].push({ id: p.id, n: p.n, s: p.s, no: p.no, g: p.g, pa: p.pa, f: 0, img: p.img }); known.add(p.id); }
      if (m.formation[ms]) P[side].form = m.formation[ms].replace(/\s/g, '');
      const on = D.placeStarters(formSlots(P[side].form), P[side].form, m.starters[ms].slice(0, 11));
      for (const s of P.steps) { s.on[side] = [...on]; slotKeys(side).forEach((k, i) => (s.pos[k] = slotXZ(side, P[side].form, i))); }
      full(); persist(); toast(`Son maçın 11'i yüklendi: ${last.home.name} ${last.home.score}–${last.away.score} ${last.away.name}`); renderSquad(side);
    } catch (e) { toast('Yüklenemedi: ' + e.message); b.disabled = false; b.textContent = "Son maçın 11'ini yükle"; }
  };
  $('#sqAdd').onclick = () => addPlayer(side, () => renderSquad(side));
  $('#shBody').onclick = (e) => {
    const ed = e.target.closest('[data-ed]'); if (ed) { e.stopPropagation(); const p = player(side, ed.dataset.ed); if (p) editPlayer(side, p, () => { full(); renderSquad(side); }); return; }
    const un = e.target.closest('[data-undo]'); if (un) { undoSub(+un.dataset.undo); renderSquad(side); return; }
    const rl = e.target.closest('[data-real]'); if (rl) { const s = real[+rl.dataset.real]; doSub(side, s.out, s.in, s.min, s.min + s.in); renderSquad(side); return; }
    const b = e.target.closest('.pl'); if (!b) return;
    const kind = b.dataset.k, i = +b.dataset.i, id = b.dataset.id;
    if (!sqSel) { sqSel = kind === 'on' ? { kind, i } : { kind, id }; renderSquad(side); return; }
    if (sqSel.kind === kind && (kind === 'on' ? sqSel.i === i : sqSel.id === id)) { sqSel = null; renderSquad(side); return; }
    const a = sqSel; sqSel = null;
    if (a.kind === 'on' && kind === 'on') { swapSlots(side, a.i, i); }
    else if (a.kind === 'bench' && kind === 'bench') { sqSel = { kind, id }; }
    else { const slotI = a.kind === 'on' ? a.i : i; const inId = a.kind === 'bench' ? a.id : id; const outId = step().on[side][slotI];
      if (sqMode === 'xi' || !outId) setStarter(side, slotI, inId); else { doSub(side, outId, inId, sqMin); sqMin = ''; } }
    renderSquad(side);
  };
}
function swapSlots(side, a, b) { snapshot(); for (const s of P.steps.slice(sqMode === 'xi' ? 0 : cur)) { const on = s.on[side]; [on[a], on[b]] = [on[b], on[a]]; } full(); persist(); toast('Yer değiştirdiler'); }
function setStarter(side, slotI, inId) { snapshot(); for (const s of P.steps) { const j = s.on[side].indexOf(inId); if (j >= 0) s.on[side][j] = s.on[side][slotI]; s.on[side][slotI] = inId; } full(); persist(); toast(`${labelName(player(side, inId))} ilk 11'de`); }
function doSub(side, outId, inId, min, realKey) {
  snapshot();
  const from = cur; let applied = false;
  for (let k = from; k < P.steps.length; k++) { const on = P.steps[k].on[side]; const j = on.indexOf(outId); if (j >= 0) { on[j] = inId; applied = true; } }
  if (!applied) { undo.pop(); toast('Çıkan oyuncu bu adımda sahada değil'); return; }
  P.subs.push({ step: from, side, out: outId, in: inId, min, real: realKey || null });
  // ekranda efekt + bant (kayıttaysan videoya da girer)
  const keyIdx = step().on[side].indexOf(inId); refresh(); if (keyIdx >= 0) scene.popPlayer(side + keyIdx);
  pushBanner(P.subs[P.subs.length - 1]); persist();
}
function undoSub(idx) {
  const s = P.subs[idx]; if (!s) return; snapshot();
  for (let k = s.step; k < P.steps.length; k++) { const on = P.steps[k].on[s.side]; const j = on.indexOf(s.in); if (j >= 0) on[j] = s.out; }
  P.subs.splice(idx, 1); full(); persist();
}
function editPlayer(side, p, after) {
  const prev = $('#shBody').innerHTML; void prev;
  openSheet(`<div class="hd"><h2>Oyuncuyu düzenle</h2>${xBtn}</div>
   <div class="grp"><input type="text" id="eN" maxlength="28" value="${esc(P.custom[p.id]?.n || labelName(p))}" aria-label="Ekranda görünen ad"><input type="text" id="eNo" inputmode="numeric" maxlength="3" value="${esc(p.no)}" placeholder="Forma no" aria-label="Forma numarası">
   <p class="note">Tam adı: ${esc(p.n)}</p></div>
   <div class="btns"><button class="btn pri" id="eOk">Kaydet</button><button class="btn" id="eReset">Orijinale dön</button></div>`);
  $('#eOk').onclick = () => { snapshot(); P.custom[p.id] = { n: $('#eN').value.trim(), no: $('#eNo').value.trim() }; persist(); closeSheet(); after && after(); };
  $('#eReset').onclick = () => { snapshot(); delete P.custom[p.id]; persist(); closeSheet(); after && after(); };
}
function addPlayer(side, after) {
  openSheet(`<div class="hd"><h2>Oyuncu ekle</h2>${xBtn}</div>
   <div class="grp"><input type="text" id="aN" maxlength="28" placeholder="Ad"><div class="two"><input type="text" id="aNo" inputmode="numeric" maxlength="3" placeholder="Forma no"><select id="aG"><option value="G">Kaleci</option><option value="D">Defans</option><option value="M" selected>Orta saha</option><option value="F">Forvet</option></select></div></div>
   <div class="btns"><button class="btn pri" id="aOk">Ekle</button></div>`);
  $('#aOk').onclick = () => { const n = $('#aN').value.trim(); if (!n) { toast('Bir ad yaz'); return; } snapshot(); const t = teamOf(side); P.extra[t.id] ||= []; P.extra[t.id].push({ id: 'c-' + uid(), n, s: n, no: $('#aNo').value.trim(), g: $('#aG').value, pa: '', f: 0 }); persist(); closeSheet(); after && after(); };
}

// ---------------- Adım sayfası ----------------
function stepSheet() {
  const st = step();
  openSheet(`<div class="hd"><h2>${cur + 1}. adım</h2>${xBtn}</div>
   <div class="grp"><h3>Not (videonun altında yazar)</h3><input type="text" id="sNote" maxlength="90" placeholder="ör. bek bindiriyor, kanada pas" value="${esc(st.note)}"></div>
   <div class="grp"><h3>Kamera</h3><p class="note">${st.cam ? 'Bu adımın kendi kamerası var. Oynatırken kamera bu açıya kayar.' : 'Kamera serbest. Bir açı ayarlayıp kaydedersen oynatırken kamera adımlar arasında süzülür.'}</p>
     <div class="btns"><button class="btn" id="sCam">Şu anki açıyı kaydet</button>${st.cam ? '<button class="btn" id="sCamClr">Kamerayı sil</button>' : ''}</div></div>
   <div class="grp"><h3>Hız</h3><div class="range"><span style="min-width:auto">Geçiş</span><input type="range" id="sDur" min="0.5" max="3" step="0.1" value="${SET.stepDur}"><span id="sDurV">${SET.stepDur.toFixed(1)} sn</span></div>
     <div class="range"><span style="min-width:auto">Bekleme</span><input type="range" id="sHold" min="0.2" max="3" step="0.1" value="${SET.hold}"><span id="sHoldV">${SET.hold.toFixed(1)} sn</span></div></div>
   <div class="grp"><h3>Kayıt</h3><div class="btns"><button class="btn pri" id="sRecPlay">Kaydı başlat ve adımları oynat</button></div><p class="note">Geri sayımdan sonra kayıt başlar, tüm adımlar oynar, sonunda kayıt kendiliğinden biter.</p></div>
   <div class="btns"><button class="btn" id="sDup">Kopyala</button><button class="btn" id="sLeft"${cur === 0 ? ' disabled' : ''}>← Öne al</button><button class="btn" id="sRight"${cur === P.steps.length - 1 ? ' disabled' : ''}>Sona al →</button><button class="btn warn" id="sDel"${P.steps.length < 2 ? ' disabled' : ''}>Sil</button></div>`);
  $('#sNote').oninput = (e) => { st.note = e.target.value; ovDirty = true; persist(); };
  $('#sCam').onclick = () => { snapshot(); st.cam = scene.getCam(); renderChips(); persist(); closeSheet(); toast('Kamera kaydedildi'); };
  $('#sCamClr') && ($('#sCamClr').onclick = () => { snapshot(); st.cam = null; renderChips(); persist(); closeSheet(); });
  $('#sDur').oninput = (e) => { SET.stepDur = +e.target.value; $('#sDurV').textContent = SET.stepDur.toFixed(1) + ' sn'; saveSet(); };
  $('#sHold').oninput = (e) => { SET.hold = +e.target.value; $('#sHoldV').textContent = SET.hold.toFixed(1) + ' sn'; saveSet(); };
  $('#sDup').onclick = () => { snapshot(); P.steps.splice(cur + 1, 0, clone(st)); closeSheet(); goStep(cur + 1); persist(); };
  $('#sLeft').onclick = () => { snapshot(); const [s] = P.steps.splice(cur, 1); P.steps.splice(cur - 1, 0, s); closeSheet(); goStep(cur - 1); persist(); };
  $('#sRight').onclick = () => { snapshot(); const [s] = P.steps.splice(cur, 1); P.steps.splice(cur + 1, 0, s); closeSheet(); goStep(cur + 1); persist(); };
  $('#sDel').onclick = () => { if (P.steps.length < 2) return; snapshot(); P.steps.splice(cur, 1); P.subs = P.subs.filter((s) => s.step !== cur).map((s) => (s.step > cur ? { ...s, step: s.step - 1 } : s)); closeSheet(); goStep(Math.max(0, cur - 1)); persist(); toast('Adım silindi · Geri al ile dönebilirsin'); };
  $('#sRecPlay').onclick = async () => {
    if (P.steps.length < 2) { toast('En az 2 adım gerekir'); return; }
    closeSheet(); goStep(0); await $('#bRec').onclick(); if (!rec.active) return;
    await new Promise((r) => setTimeout(r, 400)); play(true);
    const wait = () => { if (!rec.active) return; if (!playing) setTimeout(() => rec.active && stopRec(), 600); else setTimeout(wait, 200); }; setTimeout(wait, 500);
  };
}

// ---------------- Görünüm sayfası ----------------
$('#bView').onclick = () => viewSheet();
function viewSheet() {
  openSheet(`<div class="hd"><h2>Görünüm ve kayıt</h2>${xBtn}</div>
   <div class="grp"><h3>Saha</h3><div class="seg" id="vTheme">${Object.entries(THEMES).map(([k, t]) => `<button data-v="${k}" class="${SET.theme === k ? 'on' : ''}">${t.name}</button>`).join('')}</div></div>
   <div class="grp"><h3>Oyuncular</h3>
     <label class="chk">İsimleri göster<input type="checkbox" id="vNames"${SET.names ? ' checked' : ''}></label>
     <label class="chk">Fotoğrafları göster<input type="checkbox" id="vPhotos"${SET.photos ? ' checked' : ''}></label>
     <div class="seg" id="vNameMode">${[['kisa', 'Kısa ad'], ['soyad', 'Soyad'], ['tam', 'Tam ad']].map(([k, l]) => `<button data-v="${k}" class="${SET.nameMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
     <div class="range"><span style="min-width:auto">Figür</span><input type="range" id="vFig" min="0.6" max="1.6" step="0.05" value="${SET.figScale}"><span>${Math.round(SET.figScale * 100)}%</span></div>
     <div class="range"><span style="min-width:auto">Etiket</span><input type="range" id="vLab" min="0.6" max="1.8" step="0.05" value="${SET.labelSize}"><span>${Math.round(SET.labelSize * 100)}%</span></div></div>
   <div class="grp"><h3>Video</h3>
     <label class="chk">Skor bandı ve başlık<input type="checkbox" id="vBar"${SET.scoreBar ? ' checked' : ''}></label>
     <label class="chk">Mikrofonla anlatım kaydet<input type="checkbox" id="vMic"${SET.mic ? ' checked' : ''}></label>
     <label class="chk">3-2-1 geri sayım<input type="checkbox" id="vCount"${SET.countdown ? ' checked' : ''}></label>
     <div class="seg" id="vQ"><button data-v="std" class="${SET.quality === 'std' ? 'on' : ''}">Standart (8 Mbps)</button><button data-v="hi" class="${SET.quality === 'hi' ? 'on' : ''}">Yüksek (14 Mbps)</button></div>
     <input type="text" id="vSign" maxlength="30" placeholder="İmza (sağ altta, ör. kanal adın)" value="${esc(SET.sign)}">
     <p class="note">Video her zaman dikey 1080×1920 ve 30 kare/sn. Ekranda gördüğün sahne ve yazılar aynen kaydedilir; menüler ve düğmeler videoya girmez.</p></div>`);
  const seg = (id, key, after) => { $(id).onclick = (e) => { const v = e.target.closest('[data-v]')?.dataset.v; if (!v) return; SET[key] = v; saveSet(); $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); after && after(); }; };
  seg('#vTheme', 'theme', () => { scene.setTheme(SET.theme); color = SET.theme === 'latte' ? '#22375A' : '#FFFFFF'; renderTools(); refresh(); });
  seg('#vNameMode', 'nameMode', () => refresh()); seg('#vQ', 'quality');
  const chk = (id, key, after) => { $(id).onchange = (e) => { SET[key] = e.target.checked; saveSet(); after && after(); }; };
  chk('#vNames', 'names', () => { scene.showNames = SET.names; refresh(); }); chk('#vPhotos', 'photos', () => { scene.showPhotos = SET.photos; refresh(); });
  chk('#vBar', 'scoreBar', () => (ovDirty = true)); chk('#vMic', 'mic'); chk('#vCount', 'countdown');
  $('#vFig').oninput = (e) => { SET.figScale = +e.target.value; e.target.nextElementSibling.textContent = Math.round(SET.figScale * 100) + '%'; scene.figScale = SET.figScale; scene._sizeLabels(); refresh(); saveSet(); };
  $('#vLab').oninput = (e) => { SET.labelSize = +e.target.value; e.target.nextElementSibling.textContent = Math.round(SET.labelSize * 100) + '%'; scene.labelSize = SET.labelSize; scene._sizeLabels(); saveSet(); };
  $('#vSign').oninput = (e) => { SET.sign = e.target.value; saveSet(); ovDirty = true; scene.dirty = true; };
}

// ---------------- Projeler ----------------
$('#bProjects').onclick = () => projectsSheet();
function projectsSheet(confirmId) {
  persist();
  const idx = ls.get('lt-index', []);
  openSheet(`<div class="hd"><h2>Projeler</h2>${xBtn}</div>
   <div class="grp"><h3>Açık proje</h3><input type="text" id="pName" maxlength="60" value="${esc(P.name)}" aria-label="Proje adı"></div>
   <div class="btns"><button class="btn pri" id="pNew">Yeni proje</button><button class="btn" id="pDup">Kopyasını oluştur</button></div>
   <div class="grp"><h3>Kayıtlı projeler (${idx.length})</h3><div class="list" id="pList">${idx.map((x) => `<div class="prj${x.id === P.id ? ' on' : ''}"><span><b>${esc(x.name)}<span class="tag">${MODE_LABEL[x.mode] || ''}</span></b><small>${esc(x.teams || '')} · ${new Date(x.updated).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>
      <span class="btns">${x.id === P.id ? '' : `<button class="btn" data-open="${x.id}">Aç</button>`}${confirmId === x.id ? `<button class="btn warn" data-delok="${x.id}">Evet, sil</button>` : `<button class="btn" data-del="${x.id}" aria-label="Sil">Sil</button>`}</span></div>`).join('')}</div></div>
   <div class="grp"><h3>Yedek</h3><div class="btns"><button class="btn" id="pExport">Projeyi dosyaya kaydet</button><label class="btn" for="pImport">Dosyadan yükle</label><input type="file" id="pImport" accept=".json,application/json" hidden></div>
   <p class="note">Projeler telefonda otomatik saklanır. Uygulamayı silmeden önce önemli projeleri dosyaya kaydet; dosyalar Belgeler/LatteTaktik/Projeler klasörüne gider.</p><p class="note" id="pMsg"></p></div>`);
  $('#pName').oninput = (e) => { P.name = e.target.value || 'Adsız'; persist(); };
  $('#pNew').onclick = () => { persist(); const h = P.H, a = P.A; newProject({ H: { ...h }, A: a ? { ...a } : null, mode: P.mode }); P.name = 'Yeni taktik'; full(); persist(); closeSheet(); toast('Yeni proje açıldı'); };
  $('#pDup').onclick = () => { persist(); const c = clone(P); c.id = uid(); c.name = P.name + ' (kopya)'; c.created = Date.now(); P = c; full(); persist(); setTimeout(() => projectsSheet(), 450); };
  $('#pList').onclick = (e) => {
    const o = e.target.closest('[data-open]'); if (o) { persist(); if (openProject(o.dataset.open)) { ls.set('lt-last', P.id); closeSheet(); } return; }
    const d = e.target.closest('[data-del]'); if (d) { projectsSheet(d.dataset.del); return; }
    const ok = e.target.closest('[data-delok]'); if (ok) { const id = ok.dataset.delok; ls.del('lt-p-' + id); ls.set('lt-index', ls.get('lt-index', []).filter((x) => x.id !== id)); if (id === P.id) { sampleProject(); full(); persist(); } projectsSheet(); }
  };
  $('#pExport').onclick = async () => { try { const r = await saveFile(new Blob([JSON.stringify(P)], { type: 'application/json' }), (P.name || 'proje').replace(/[^\wğüşöçıĞÜŞÖÇİ -]+/g, '').trim().replace(/\s+/g, '-') + '.json', 'Projeler'); $('#pMsg').textContent = 'Kaydedildi: ' + r.where; } catch (e) { $('#pMsg').textContent = 'Kaydedilemedi: ' + (e.message || e); } };
  $('#pImport').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await f.text()); if (!o.steps || !o.H) throw new Error('Geçersiz dosya'); o.id = uid(); ls.set('lt-p-' + o.id, o); openProject(o.id); persist(); closeSheet(); toast('Proje yüklendi'); } catch (er) { $('#pMsg').textContent = 'Yüklenemedi: ' + er.message; } };
}

// Android geri tuşu: önce açık pencereyi kapat
window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => {
  if (!$('#sheet').hidden) return closeSheet();
  if (!$('#pop').hidden) return closePop();
  if (!$('#camMenu').hidden) { $('#camMenu').hidden = true; return; }
  if (playing) return stopPlay();
  window.Capacitor.Plugins.App.minimizeApp?.();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); if (rec.active) stopRec(); } });

// ---------------- başlat ----------------
(async function boot() {
  await D.loadSquads();
  try { await document.fonts.load('700 40px "Bricolage Grotesque"'); } catch (e) { }
  const last = ls.get('lt-last', null);
  if (!last || !openProject(last)) { sampleProject(); persist(); }
  scene.setCam(P.steps[0].cam || CAMS.taktik, 0);
  $('#bLock').classList.toggle('on', SET.camLock); scene.controls.enabled = !SET.camLock;
  renderTools(); layout(); full();
  window.__lt = { P: () => P, scene, D, SET, rec };
})();
