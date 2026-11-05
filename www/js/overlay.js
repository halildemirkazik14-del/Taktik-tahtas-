// Videoya da giren yazı katmanı: skor bandı, adım notu, oyuncu değişikliği bandı
export const OW = 1080, OH = 1920;
const F = '"Bricolage Grotesque", "Onest", system-ui, sans-serif';

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fit(g, text, max, size, weight = 800) { let s = size; do { g.font = `${weight} ${s}px ${F}`; s -= 2; } while (g.measureText(text).width > max && s > 18); return s + 2; }

export function drawOverlay(g, o, now) {
  g.clearRect(0, 0, OW, OH);
  if (o.scoreBar) {
    const y = 70, h = 150, x = 40, w = OW - 80;
    g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 6;
    g.fillStyle = 'rgba(239,228,214,.94)'; rr(g, x, y, w, h, 34); g.fill(); g.restore();
    // mod çipi
    if (o.chip) {
      g.font = `800 30px ${F}`; const cw = g.measureText(o.chip).width + 44;
      g.fillStyle = '#22375A'; rr(g, OW / 2 - cw / 2, y - 26, cw, 52, 26); g.fill();
      g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.chip, OW / 2, y + 1);
    }
    const cy = y + h / 2 + 8;
    const side = (t, left) => {
      if (!t) return;
      const lx = left ? x + 34 : x + w - 34 - 86;
      if (t.logo) g.drawImage(t.logo, lx, cy - 43, 86, 86);
      else { g.fillStyle = t.color; g.beginPath(); g.arc(lx + 43, cy, 38, 0, Math.PI * 2); g.fill(); g.lineWidth = 6; g.strokeStyle = t.alt || '#fff'; g.stroke(); }
      g.fillStyle = '#2B1E17'; g.textBaseline = 'middle'; g.textAlign = left ? 'left' : 'right';
      const nx = left ? lx + 104 : lx - 18; const maxw = o.away ? 250 : 700;
      fit(g, t.name, maxw, 44); g.fillText(t.name, nx, cy - 14);
      g.font = `600 28px ${F}`; g.fillStyle = '#8B5E3C'; g.fillText(t.form || '', nx, cy + 26);
    };
    side(o.home, true); side(o.away, false);
    if (o.away) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (o.score && (o.score[0] !== '' || o.score[1] !== '')) {
        g.fillStyle = '#2B1E17'; g.font = `800 76px ${F}`; g.fillText(`${o.score[0] || 0} – ${o.score[1] || 0}`, OW / 2, cy + 4);
      } else { g.fillStyle = '#8B5E3C'; g.font = `800 46px ${F}`; g.fillText('vs', OW / 2, cy + 2); }
    }
    if (o.title) {
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#FFFFFF';
      const s = fit(g, o.title, OW - 120, 46);
      g.lineWidth = 8; g.strokeStyle = 'rgba(24,17,13,.75)'; g.lineJoin = 'round';
      g.strokeText(o.title, OW / 2, y + h + 66); g.fillText(o.title, OW / 2, y + h + 66);
    }
  }
  // oyuncu değişikliği bantları
  let by = o.scoreBar ? 330 : 90;
  for (const b of o.banners || []) {
    const t = (now - b.t0) / 1000; if (t < 0 || t > 3.6) continue;
    const slide = Math.min(1, t / 0.35), out = t > 3.2 ? (t - 3.2) / 0.4 : 0;
    const k = (1 - Math.pow(1 - slide, 3)) * (1 - out);
    g.save(); g.globalAlpha = Math.min(1, k * 1.2);
    const text = b.text; g.font = `700 36px ${F}`; const w = g.measureText(text).width + 130;
    const x = -w + (40 + w) * k;
    g.fillStyle = '#22375A'; rr(g, x, by, w, 76, 22); g.fill();
    g.fillStyle = b.color || '#C9A27E'; rr(g, x + 14, by + 14, 48, 48, 14); g.fill();
    g.fillStyle = b.textColor || '#FFFFFF'; g.font = `800 30px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⇄', x + 38, by + 39);
    g.fillStyle = '#FFFFFF'; g.textAlign = 'left'; g.font = `700 36px ${F}`; g.fillText(text, x + 82, by + 40);
    g.restore(); by += 92;
  }
  // adım notu: beyaz, ince siyah kontur, küçük harf
  if (o.note) {
    const words = o.note.toLocaleLowerCase('tr').split(/\s+/).filter(Boolean); const lines = []; let cur = '';
    g.font = `800 64px ${F}`;
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > OW - 160 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    const L = lines.slice(-3); let y = OH - 250 - (L.length - 1) * 76;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    for (const l of L) { g.lineWidth = 10; g.strokeStyle = '#0D0907'; g.strokeText(l, OW / 2, y); g.fillStyle = '#FFFFFF'; g.fillText(l, OW / 2, y); y += 76; }
  }
  if (o.sign) { g.font = `700 30px ${F}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.lineWidth = 6; g.strokeStyle = 'rgba(13,9,7,.6)'; g.strokeText(o.sign, OW - 44, OH - 70); g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText(o.sign, OW - 44, OH - 70); }
}
