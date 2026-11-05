// Kadro verisi: gömülü ESPN verisi → uygulama içinde güncellenen veri → elle derlenmiş yedek
import FALLBACK from './fallback.js';

export const LEAGUE_ORDER = ['tur.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1'];
export const LEAGUE_NAMES = { 'tur.1': 'Süper Lig', 'eng.1': 'Premier Lig', 'esp.1': 'La Liga', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1' };
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LS_KEY = 'lt-squads-live';

export const DB = { leagues: {}, updated: '', source: '' };

function ls(get, k, v) { try { if (get) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

export async function loadSquads() {
  let bundled = null, live = null;
  try { const r = await fetch('data/squads.json', { cache: 'no-store' }); if (r.ok) bundled = await r.json(); } catch (e) { }
  try { live = JSON.parse(ls(true, LS_KEY) || 'null'); } catch (e) { }
  // Her lig için en yeni ve dolu kaynağı seç
  const pick = (slug) => {
    const c = [live, bundled].filter((s) => s && s.leagues && s.leagues[slug] && s.leagues[slug].teams.length)
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    if (c[0]) return { lg: c[0].leagues[slug], src: c[0] === live ? 'live' : 'bundled', upd: c[0].updated };
    return { lg: FALLBACK.leagues[slug], src: 'fallback', upd: FALLBACK.updated };
  };
  let newest = '', srcs = new Set();
  for (const slug of LEAGUE_ORDER) {
    const p = pick(slug);
    DB.leagues[slug] = { ...p.lg, name: LEAGUE_NAMES[slug], src: p.src };
    if (p.src !== 'fallback') fixTeams(slug, DB.leagues[slug]);
    srcs.add(p.src); if (String(p.upd) > newest) newest = String(p.upd);
  }
  DB.updated = newest; DB.source = [...srcs].join('+');
  return DB;
}

// ESPN takım adlarında Türkçe karakter yok, bazı renkler siyah/siyah geliyor:
// elle derlenmiş listeden (fallback) eşleşen takımın adını (Süper Lig) ve forma renklerini al
const STOP = new Set(['fc', 'cf', 'sk', 'ac', 'as', 'afc', 'sc', 'sv', 'ssc', 'us', 'rc', 'ogc', 'losc', 'stade', 'de', 'la', 'club', 'bb', 'fk', 'sfk', 'vfb', 'vfl', 'tsg', 'the', 'cd', 'ud', 'rcd', 'ca', 'calcio', 'and', 'hove', 'albion']);
const ALIAS = { cologne: 'koln', rennais: 'rennes', brestois: 'brest', munich: 'munchen', internazionale: 'inter', saintgermain: 'psg' };
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9 ]+/g, ' ');
const toks = (s) => norm(s).split(/\s+/).map((w) => ALIAS[w] || w).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
function matchScore(a, b) {
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  if (A.join(' ') === B.join(' ')) return 10;
  let s = 0; for (const x of A) for (const y of B) { if (x === y) s += 2; else if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) s += 1.5; }
  return s / Math.sqrt(A.length * B.length);
}
function fixTeams(slug, lg) {
  const fb = FALLBACK.leagues[slug]?.teams || []; const used = new Set();
  const pairs = [];
  for (const t of lg.teams) for (const f of fb) { const s = matchScore(t.name, f.name); if (s > 0.9) pairs.push([s, t, f]); }
  pairs.sort((a, b) => b[0] - a[0]);
  const done = new Set();
  for (const [, t, f] of pairs) {
    if (done.has(t.id) || used.has(f.id)) continue; done.add(t.id); used.add(f.id);
    t.color = f.color; t.alt = f.alt;
    if (slug === 'tur.1') { t.name = f.name; t.short = f.name; }
  }
  for (const t of lg.teams) { // eşleşmeyen ve rengi bozuk olanlar
    if (!done.has(t.id) && (!t.color || t.color === t.alt)) { t.alt = t.color && t.color.toLowerCase() !== '#ffffff' ? '#FFFFFF' : '#22375A'; t.color = t.color || '#8B5E3C'; }
  }
  lg.teams.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function team(slug, id) { return DB.leagues[slug]?.teams.find((t) => t.id === String(id)) || null; }
export function teams(slug) { return DB.leagues[slug]?.teams || []; }
export function findTeamByName(slug, rx) { return teams(slug).find((t) => rx.test(t.name)) || null; }

export function faceUrl(p) { return p && p.f ? `data/faces/${p.id}.png` : (p && p.img ? p.img : ''); }
export function logoUrl(t) { return t && t.logo ? `data/logos/${t.id}.png` : ''; }

// ---------- Ağ (APK içinde CapacitorHttp ile CORS'suz) ----------
function capHttp() { return window.Capacitor?.Plugins?.CapacitorHttp || null; }
export async function getJSON(url) {
  const ch = capHttp();
  if (ch) {
    const r = await ch.get({ url, headers: { accept: 'application/json' }, connectTimeout: 15000, readTimeout: 20000 });
    if (r.status >= 400) throw new Error('HTTP ' + r.status);
    return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
// Uzak resmi yerel blob olarak al (3D doku ve video kaydı için güvenli)
export async function getImageBlobUrl(url) {
  const ch = capHttp();
  if (ch) {
    const r = await ch.get({ url, responseType: 'blob' });
    if (r.status >= 400 || !r.data) throw new Error('img');
    const bin = atob(r.data); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u8], { type: 'image/png' }));
  }
  const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('img');
  return URL.createObjectURL(await r.blob());
}

function group(abbr = '', name = '') {
  const a = (abbr || '').toUpperCase(), n = (name || '').toLowerCase();
  if (a === 'G' || a === 'GK' || n.includes('goal')) return 'G';
  if (a === 'D' || /^(CB|CD|LB|RB|LWB|RWB|SW)/.test(a) || n.includes('defen') || n.includes('back')) return 'D';
  if (a === 'F' || /^(CF|ST|LW|RW|SS)/.test(a) || n.includes('forward') || n.includes('striker') || n.includes('wing')) return 'F';
  return 'M';
}
const flat = (d) => { const a = d?.athletes || []; return a.length && Array.isArray(a[0]?.items) ? a.flatMap((g) => g.items) : a; };

// Tüm ligleri telefondan yeniden çek
export async function refreshSquads(onProgress) {
  const out = { updated: new Date().toISOString(), source: 'ESPN', leagues: {} };
  let done = 0, total = 0, okLeagues = 0;
  for (const slug of LEAGUE_ORDER) {
    let td; try { td = await getJSON(`${API}/${slug}/teams`); } catch (e) { continue; }
    const tlist = (td?.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => t.team).filter(Boolean);
    total += tlist.length;
    const old = DB.leagues[slug];
    const lg = { name: LEAGUE_NAMES[slug], teams: [] };
    let i = 0;
    await Promise.all([0, 1, 2, 3].map(async () => {
      while (i < tlist.length) {
        const t = tlist[i++];
        let ath = [];
        try { ath = flat(await getJSON(`${API}/${slug}/teams/${t.id}/roster`)); } catch (e) { }
        const prev = old?.teams.find((x) => x.id === String(t.id));
        const players = ath.filter((p) => p && p.id).map((p) => {
          const id = String(p.id), pp = prev?.players.find((x) => x.id === id);
          return { id, n: p.displayName || p.shortName || '', s: p.shortName || p.displayName || '', no: p.jersey != null ? String(p.jersey) : '',
            g: group(p.position?.abbreviation, p.position?.name), pa: p.position?.abbreviation || '',
            f: pp?.f || 0, img: !pp?.f && p.headshot?.href ? p.headshot.href : '' };
        });
        lg.teams.push({ id: String(t.id), name: t.displayName || t.name, short: t.shortDisplayName || t.name, abbr: t.abbreviation || '',
          color: t.color ? '#' + t.color : prev?.color || '', alt: t.alternateColor ? '#' + t.alternateColor : prev?.alt || '',
          logo: prev?.logo || 0, logoUrl: t.logos?.[0]?.href || '', last: prev?.last, players: players.length ? players : (prev?.players || []) });
        done++; onProgress && onProgress(done, total, LEAGUE_NAMES[slug]);
      }
    }));
    lg.teams.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (lg.teams.filter((t) => t.players.length >= 14).length >= lg.teams.length * 0.6) { out.leagues[slug] = lg; okLeagues++; }
  }
  if (!okLeagues) throw new Error('Kadrolara ulaşılamadı. İnternet bağlantını kontrol et.');
  ls(false, LS_KEY, JSON.stringify(out));
  await loadSquads();
  return okLeagues;
}

// ---------- Fikstür ve maç kadrosu ----------
export async function schedule(slug, teamId) {
  const d = await getJSON(`${API}/${slug}/teams/${teamId}/schedule`);
  let evs = d?.events || [];
  try { // gelecek maçlar ayrı istenebiliyor
    const f = await getJSON(`${API}/${slug}/teams/${teamId}/schedule?fixture=true`);
    const seen = new Set(evs.map((e) => e.id)); for (const e of f?.events || []) if (!seen.has(e.id)) evs.push(e);
  } catch (e) { }
  return evs.map((e) => {
    const c = e.competitions?.[0] || {}; const cs = c.competitors || [];
    const side = (h) => { const x = cs.find((k) => k.homeAway === h) || {}; const sc = x.score;
      return { id: String(x.team?.id || x.id || ''), name: x.team?.displayName || x.team?.name || '?', score: sc == null ? '' : String(typeof sc === 'object' ? (sc.displayValue ?? sc.value ?? '') : sc) }; };
    return { id: String(e.id), date: e.date, name: e.name || e.shortName || '', comp: c.type?.abbreviation || e.season?.displayName || '',
      completed: !!(c.status?.type?.completed || e.status?.type?.completed), home: side('home'), away: side('away') };
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Mevki kısaltmasından derinlik ve yan bilgisi
export function rank(abbr = '', g = 'M') {
  const a = abbr.toUpperCase();
  let d = { G: 0, D: 1, M: 3, F: 5 }[g] ?? 3;
  if (/WB/.test(a)) d = 1.6; else if (/^(DM|CDM)/.test(a)) d = 2; else if (/^(AM|CAM)/.test(a)) d = 4; else if (/^(LW|RW|LM|RM)$/.test(a)) d = g === 'F' ? 4.6 : 3.2;
  let lat = 0;
  if (/^L/.test(a)) lat = -2; else if (/-L$/.test(a)) lat = -1;
  if (/^R/.test(a)) lat = 2; else if (/-R$/.test(a)) lat = 1;
  return [d, lat];
}
// İlk 11'i diziliş yuvalarına yerleştir: hatlara böl, her hatta soldan sağa diz
export function placeStarters(slots, form, starters) {
  const on = Array(11).fill(null); if (!starters.length) return on;
  const st = [...starters].sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]);
  const gk = st.find((x) => x.r[0] === 0) || st[0];
  on[0] = gk.id;
  const rest = st.filter((x) => x !== gk);
  let lines = String(form || '').split('-').map((n) => parseInt(n, 10)).filter((n) => n > 0);
  if (lines.reduce((a, b) => a + b, 0) !== 10) lines = [10];
  const order = [...Array(10).keys()].map((i) => i + 1).sort((a, b) => slots[a][1] - slots[b][1] || slots[a][0] - slots[b][0]);
  let k = 0;
  for (const n of lines) {
    const sl = order.slice(k, k + n).sort((a, b) => slots[a][0] - slots[b][0]);
    const pl = rest.slice(k, k + n).sort((a, b) => a.r[1] - b.r[1]);
    sl.forEach((si, j) => { if (pl[j]) on[si] = pl[j].id; });
    k += n;
  }
  return on;
}
// ESPN diziliş vermezse ilk 11'in mevkilerinden tahmin et (ör. 4-2-3-1)
export function guessFormation(st) {
  const lines = { d: 0, dm: 0, m: 0, am: 0, f: 0 };
  for (const x of st) { const d = x.r[0]; if (d === 0) continue; if (d <= 1.6) lines.d++; else if (d === 2) lines.dm++; else if (d < 4) lines.m++; else if (d < 5) lines.am++; else lines.f++; }
  const out = [lines.d, lines.dm, lines.m, lines.am, lines.f].filter((n) => n > 0);
  return out.reduce((a, b) => a + b, 0) === 10 ? out.join('-') : '';
}
export async function matchSummary(slug, eventId, homeId) {
  const d = await getJSON(`${API}/${slug}/summary?event=${eventId}`);
  const res = { formation: {}, starters: {}, bench: {}, subs: [], score: ['', ''], teams: {} };
  const comp = d?.header?.competitions?.[0];
  for (const c of comp?.competitors || []) {
    const s = String(c.team?.id) === String(homeId) || c.homeAway === 'home' ? 'H' : 'A';
    res.score[s === 'H' ? 0 : 1] = c.score ?? '';
    res.teams[s] = String(c.team?.id || '');
  }
  for (const r of d?.rosters || []) {
    const s = String(r.team?.id) === String(homeId) || r.homeAway === 'home' ? 'H' : 'A';
    const list = (r.roster || []).map((x) => ({
      id: String(x.athlete?.id || ''), n: x.athlete?.displayName || '', s: x.athlete?.shortName || x.athlete?.displayName || '',
      no: x.jersey != null ? String(x.jersey) : '', g: group(x.position?.abbreviation, x.position?.name), pa: x.position?.abbreviation || '',
      img: x.athlete?.headshot?.href || '', starter: !!x.starter, fp: parseInt(x.formationPlace || '0', 10) || 0, subIn: !!x.subbedIn, subOut: !!x.subbedOut,
      inFor: x.subbedInFor?.athlete?.id ? String(x.subbedInFor.athlete.id) : '',
      subMin: (x.plays || []).find((pl) => pl.substitution)?.clock?.displayValue || '',
    })).filter((x) => x.id);
    const st = list.filter((x) => x.starter).map((x) => ({ ...x, r: rank(x.pa, x.g) }));
    st.sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.fp - b.fp);
    res.starters[s] = st; res.bench[s] = list.filter((x) => !x.starter);
    res.formation[s] = (r.formation || '').replace(/\s/g, '') || guessFormation(st);
    // değişiklikler: giren oyuncunun kaydında kimin yerine ve hangi dakikada girdiği yazıyor
    for (const x of list) if (x.subIn && x.inFor) res.subs.push({ side: s, min: x.subMin, in: x.id, out: x.inFor });
  }
  res.subs.sort((a, b) => (parseInt(a.min, 10) || 0) - (parseInt(b.min, 10) || 0));
  if (res.subs.length) return res;
  // Yedek yol: olay listesinden değişiklikler
  const evs = [...(d?.keyEvents || []), ...(d?.commentary || []).map((c) => c.play).filter(Boolean)];
  const seen = new Set();
  for (const e of evs) {
    const t = (e.type?.text || e.type?.type || '').toLowerCase();
    if (!t.includes('substitution')) continue;
    const key = e.id || (e.clock?.displayValue + JSON.stringify(e.participants || []));
    if (seen.has(key)) continue; seen.add(key);
    const ps = (e.participants || []).map((p) => String(p.athlete?.id || ''));
    const side = String(e.team?.id) === String(res.teams.H) ? 'H' : 'A';
    // ESPN genelde [giren, çıkan] sırasıyla verir; kadro bilgisiyle doğrula
    let [pin, pout] = ps;
    const B = res.bench[side] || [];
    if (pin && !B.find((x) => x.id === pin) && pout && B.find((x) => x.id === pout)) [pin, pout] = [pout, pin];
    res.subs.push({ side, min: e.clock?.displayValue || '', in: pin, out: pout });
  }
  return res;
}
