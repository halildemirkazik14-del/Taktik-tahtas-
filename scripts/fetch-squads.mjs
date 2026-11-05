// 6 ligin güncel kadrolarını (yedekler dahil) ESPN'den çeker ve uygulamaya gömer.
// Çıktı: www/data/squads.json, www/data/logos/<takımId>.png, www/data/faces/<oyuncuId>.png
// Bir lig çekilemezse uygulama js/fallback.js içindeki elle derlenmiş kadroya düşer.
import fs from 'node:fs';
import path from 'node:path';
import { rank, guessFormation } from '../www/js/data.js';

const LEAGUES = [
  ['tur.1', 'Süper Lig'], ['eng.1', 'Premier Lig'], ['esp.1', 'La Liga'],
  ['ita.1', 'Serie A'], ['ger.1', 'Bundesliga'], ['fra.1', 'Ligue 1'],
];
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const OUT = 'www/data';
const SAMPLES = 'ci-samples';
const FACES = process.env.SKIP_FACES ? false : true;

fs.mkdirSync(`${OUT}/logos`, { recursive: true });
fs.mkdirSync(`${OUT}/faces`, { recursive: true });
fs.mkdirSync(SAMPLES, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, kind = 'json', tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (LatteTaktik build)' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return kind === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) { console.log('  ! ' + url + ' → ' + e.message); return null; }
      await sleep(600 * (i + 1));
    }
  }
}
async function pool(items, n, fn) {
  let i = 0; const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: n }, run));
}

// ESPN mevki kısaltmasını 4 gruba indir
export function group(abbr = '', name = '') {
  const a = (abbr || '').toUpperCase(), n = (name || '').toLowerCase();
  if (a === 'G' || a === 'GK' || n.includes('goal')) return 'G';
  if (a === 'D' || /^(CB|CD|LB|RB|LWB|RWB|SW|D-|CD-)/.test(a) || n.includes('defen') || n.includes('back')) return 'D';
  if (a === 'F' || /^(CF|ST|LW|RW|F-|CF-|SS)/.test(a) || n.includes('forward') || n.includes('striker') || n.includes('wing')) return 'F';
  return 'M';
}

function flatAthletes(data) {
  const a = data?.athletes || [];
  if (a.length && a[0] && Array.isArray(a[0].items)) return a.flatMap((g) => g.items);
  return a;
}

const report = { updated: new Date().toISOString(), leagues: {} };
const out = { updated: report.updated, source: 'ESPN', leagues: {} };
const faceJobs = [];
const logoJobs = [];

for (const [slug, lname] of LEAGUES) {
  console.log(`== ${lname} (${slug})`);
  const td = await get(`${API}/${slug}/teams`);
  if (td && slug === 'tur.1') fs.writeFileSync(`${SAMPLES}/teams-${slug}.json`, JSON.stringify(td).slice(0, 20000));
  const teams = (td?.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => t.team).filter(Boolean);
  const lg = { name: lname, teams: [] };
  let sampleSaved = false;
  await pool(teams, 4, async (t) => {
    const rd = await get(`${API}/${slug}/teams/${t.id}/roster`);
    if (rd && !sampleSaved) { sampleSaved = true; fs.writeFileSync(`${SAMPLES}/roster-${slug}.json`, JSON.stringify(rd).slice(0, 30000)); }
    const ath = flatAthletes(rd);
    const players = [];
    for (const p of ath) {
      if (!p || !p.id) continue;
      const pa = p.position?.abbreviation || '';
      const hs = p.headshot?.href || '';
      players.push({
        id: String(p.id),
        n: p.displayName || p.fullName || p.shortName || '',
        s: p.shortName || p.displayName || '',
        no: p.jersey != null && p.jersey !== '' ? String(p.jersey) : '',
        g: group(pa, p.position?.name || p.position?.displayName),
        pa,
        f: hs ? 1 : 0,
      });
      if (hs && FACES) faceJobs.push(String(p.id));
    }
    const logo = t.logos?.[0]?.href || '';
    if (logo) logoJobs.push([String(t.id), logo]);
    lg.teams.push({
      id: String(t.id), name: t.displayName || t.name, short: t.shortDisplayName || t.name || t.displayName,
      abbr: t.abbreviation || '', color: t.color ? '#' + t.color : '', alt: t.alternateColor ? '#' + t.alternateColor : '',
      logo: logo ? 1 : 0, players,
    });
  });
  lg.teams.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const okTeams = lg.teams.filter((t) => t.players.length >= 14).length;
  report.leagues[slug] = { name: lname, teams: lg.teams.length, withSquad: okTeams, players: lg.teams.reduce((s, t) => s + t.players.length, 0) };
  console.log(`   ${lg.teams.length} takım, ${okTeams} tanesinde kadro var`);
  if (lg.teams.length && okTeams >= Math.max(1, lg.teams.length * 0.6)) out.leagues[slug] = lg;
}

// Her takımın son oynadığı lig maçındaki ilk 11 ve diziliş → uygulamada varsayılan "olası 11"
let lastOk = 0;
const allTeams = Object.entries(out.leagues).flatMap(([slug, lg]) => lg.teams.map((t) => [slug, t]));
await pool(allTeams, 6, async ([slug, t]) => {
  const sc = await get(`${API}/${slug}/teams/${t.id}/schedule`, 'json', 2);
  const ev = (sc?.events || []).filter((e) => e?.competitions?.[0]?.status?.type?.completed).sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
  if (!ev) return;
  const sm = await get(`${API}/${slug}/summary?event=${ev.id}`, 'json', 2);
  const r = (sm?.rosters || []).find((x) => String(x.team?.id) === t.id);
  const st = (r?.roster || []).filter((x) => x.starter && x.athlete?.id).map((x) => ({ id: String(x.athlete.id), pa: x.position?.abbreviation || '', g: group(x.position?.abbreviation, x.position?.name) }));
  if (st.length !== 11) return;
  const c = ev.competitions[0].competitors || [];
  const opp = c.find((x) => String(x.team?.id) !== t.id);
  const form = (r.formation || '').replace(/\s/g, '') || guessFormation(st.map((x) => ({ ...x, r: rank(x.pa, x.g) })));
  t.last = { form, st, ev: String(ev.id), date: ev.date, vs: opp?.team?.displayName || '' };
  // maç kadrosunda olup kadro listesinde olmayan oyuncuyu ekle
  for (const x of r.roster) if (x.athlete?.id && !t.players.find((p) => p.id === String(x.athlete.id)))
    t.players.push({ id: String(x.athlete.id), n: x.athlete.displayName || '', s: x.athlete.shortName || x.athlete.displayName || '', no: x.jersey != null ? String(x.jersey) : '', g: group(x.position?.abbreviation, x.position?.name), pa: '', f: 0 });
  lastOk++;
});
report.lastXI = lastOk;
console.log(`Son maç ilk 11'i: ${lastOk}/${allTeams.length} takım`);

// Armalar (küçültülmüş) — yerel dosya olunca 3D ve kayıt için güvenli
await pool(logoJobs, 8, async ([id, href]) => {
  const small = `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(new URL(href).pathname)}&w=128&h=128`;
  const b = (await get(small, 'buf', 2)) || (await get(href, 'buf', 2));
  if (b) fs.writeFileSync(`${OUT}/logos/${id}.png`, b);
});
// Oyuncu fotoğrafları (küçük)
let faces = 0;
await pool(faceJobs, 16, async (id) => {
  const u = `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${id}.png&w=96&h=70&scale=crop&cquality=60`;
  const b = await get(u, 'buf', 2);
  if (b && b.length > 400) { fs.writeFileSync(`${OUT}/faces/${id}.png`, b); faces++; }
});
// fotoğrafı inmeyenlerin işaretini kaldır
for (const lg of Object.values(out.leagues)) for (const t of lg.teams) {
  t.logo = fs.existsSync(`${OUT}/logos/${t.id}.png`) ? 1 : 0;
  for (const p of t.players) p.f = p.f && fs.existsSync(`${OUT}/faces/${p.id}.png`) ? 1 : 0;
}
report.faces = faces; report.logos = logoJobs.length;
fs.writeFileSync(`${OUT}/squads.json`, JSON.stringify(out));
fs.writeFileSync(`${SAMPLES}/squads-report.json`, JSON.stringify(report, null, 2));
// Örnek: Süper Lig'in iki takımı tam haliyle (doğrulama için)
const tr = out.leagues['tur.1'];
if (tr) fs.writeFileSync(`${SAMPLES}/tur-sample.json`, JSON.stringify(tr.teams.slice(0, 6), null, 1));
// Fikstür ve maç özeti örneği (uygulama çalışırken bu uçları kullanır)
const fb = tr?.teams.find((t) => /fenerbah/i.test(t.name));
if (fb) {
  const sc = await get(`${API}/tur.1/teams/${fb.id}/schedule`);
  if (sc) fs.writeFileSync(`${SAMPLES}/schedule-fb.json`, JSON.stringify(sc).slice(0, 40000));
  const ev = (sc?.events || []).find((e) => e?.competitions?.[0]?.status?.type?.completed);
  if (ev) { const sm = await get(`${API}/tur.1/summary?event=${ev.id}`); if (sm) fs.writeFileSync(`${SAMPLES}/summary-fb.json`, JSON.stringify({ rosters: sm.rosters, keyEvents: (sm.keyEvents || []).slice(0, 40), header: sm.header }).slice(0, 80000)); }
}
console.log(JSON.stringify(report, null, 2));
