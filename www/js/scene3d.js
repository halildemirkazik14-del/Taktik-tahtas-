// 3D saha: Three.js sahnesi, oyuncu figürleri, top, çizimler, kamera açıları
import * as THREE from '../lib/three.module.min.js';
import { OrbitControls } from '../lib/OrbitControls.js';

export const PW = 68, PL = 105; // saha eni, boyu (metre)
const HW = PW / 2, HL = PL / 2;

export const THEMES = {
  latte: { name: 'Latte saha', s1: '#D7C0A1', s2: '#CCB28E', line: '#FBF5EC', around: '#C2A47F', sky: '#EFE4D6', fog: '#E9DCCB', net: '#FBF5EC' },
  cim: { name: 'Çim', s1: '#3E8A4E', s2: '#377C46', line: '#F4F7F2', around: '#2D6A3B', sky: '#1C2E22', fog: '#22382A', net: '#FFFFFF' },
  gece: { name: 'Gece', s1: '#1C2B41', s2: '#18263A', line: '#9DB6DE', around: '#111B2A', sky: '#0A111D', fog: '#0D1626', net: '#9DB6DE' },
  tebesir: { name: 'Tebeşir', s1: '#2F3A33', s2: '#2C362F', line: '#ECEDE6', around: '#252E28', sky: '#1A201C', fog: '#1E2520', net: '#ECEDE6' },
};

export const CAMS = {
  ustten: { label: 'Üstten', p: [0, 186, -2.2], t: [0, 0, -3.5] },
  taktik: { label: 'Taktik', p: [0, 112, 96], t: [0, 0, -3] },
  yayin: { label: 'Yayın', p: [0, 40, 86], t: [0, 0, -8] },
  kale: { label: 'Kale arkası', p: [0, 9, 70], t: [0, 2, 24] },
  rakip: { label: 'Rakip kale', p: [0, 9, -70], t: [0, 2, -24] },
  yan: { label: 'Yan', p: [-96, 58, 0], t: [0, 0, 0] },
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function pitchTexture(th) {
  const S = 12, M = 7; // piksel/metre, saha dışı pay
  const W = (PW + 2 * M) * S, H = (PL + 2 * M) * S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = th.around; g.fillRect(0, 0, W, H);
  const bands = 18;
  for (let i = 0; i < bands; i++) { g.fillStyle = i % 2 ? th.s2 : th.s1; g.fillRect(M * S - 3 * S, M * S + (i * PL * S) / bands, (PW + 6) * S, (PL * S) / bands + 1); }
  // ince doku
  const rnd = (a) => { let s = a; return () => (s = (s * 16807) % 2147483647) / 2147483647; }; const r = rnd(7);
  g.globalAlpha = 0.05; for (let i = 0; i < 9000; i++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(r() * W, r() * H, 2, 2); } g.globalAlpha = 1;
  const X = (x) => (M + x) * S, Y = (y) => (M + y) * S;
  g.strokeStyle = th.line; g.fillStyle = th.line; g.lineWidth = 0.14 * S * 1.4; g.lineCap = 'round';
  g.strokeRect(X(0), Y(0), PW * S, PL * S);
  g.beginPath(); g.moveTo(X(0), Y(HL)); g.lineTo(X(PW), Y(HL)); g.stroke();
  g.beginPath(); g.arc(X(HW), Y(HL), 9.15 * S, 0, Math.PI * 2); g.stroke();
  const dot = (x, y, rr) => { g.beginPath(); g.arc(X(x), Y(y), rr * S, 0, Math.PI * 2); g.fill(); };
  dot(HW, HL, 0.35);
  for (const top of [true, false]) {
    const gy = top ? 0 : PL, d = top ? 1 : -1;
    g.strokeRect(X(HW - 20.16), Y(top ? 0 : PL - 16.5), 40.32 * S, 16.5 * S);
    g.strokeRect(X(HW - 9.16), Y(top ? 0 : PL - 5.5), 18.32 * S, 5.5 * S);
    dot(HW, gy + d * 11, 0.3);
    const a = Math.acos(5.5 / 9.15);
    g.beginPath(); if (top) g.arc(X(HW), Y(11), 9.15 * S, Math.PI / 2 - a, Math.PI / 2 + a); else g.arc(X(HW), Y(PL - 11), 9.15 * S, -Math.PI / 2 - a, -Math.PI / 2 + a); g.stroke();
  }
  for (const [cx, cy, s, e] of [[0, 0, 0, Math.PI / 2], [PW, 0, Math.PI / 2, Math.PI], [0, PL, -Math.PI / 2, 0], [PW, PL, Math.PI, Math.PI * 1.5]]) { g.beginPath(); g.arc(X(cx), Y(cy), 1 * S, s, e); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, w: PW + 2 * M, h: PL + 2 * M };
}

function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#1E1612';
  const pent = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
  [[32, 32], [96, 64], [160, 32], [224, 64], [32, 96], [160, 96], [96, 8], [224, 120]].forEach(([x, y]) => pent(x, y, 15));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function labelTexture(no, name, kit, showName) {
  const c = document.createElement('canvas'); const H = 88;
  const g0 = c.getContext('2d'); g0.font = '700 44px "Bricolage Grotesque", "Onest", sans-serif';
  const nameW = showName && name ? Math.min(420, g0.measureText(name).width) : 0;
  const pill = 88; const W = Math.ceil(pill + (nameW ? nameW + 34 : 0)) + 8;
  c.width = W; c.height = H + 8; const g = c.getContext('2d');
  if (nameW) { g.fillStyle = 'rgba(24,17,13,0.78)'; roundRect(g, 4, 10, W - 8, H - 12, (H - 12) / 2); g.fill(); }
  g.fillStyle = kit.body; g.beginPath(); g.arc(4 + pill / 2, 4 + H / 2, H / 2 - 2, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = kit.num; g.stroke();
  g.fillStyle = kit.num; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = String(no || '');
  g.font = `800 ${txt.length > 2 ? 34 : 44}px "Bricolage Grotesque", "Onest", sans-serif`; g.fillText(txt, 4 + pill / 2, 4 + H / 2 + 2);
  if (nameW) { g.fillStyle = '#FFFFFF'; g.textAlign = 'left'; g.font = '700 40px "Bricolage Grotesque", "Onest", sans-serif';
    let n = name; while (g.measureText(n).width > nameW && n.length > 3) n = n.slice(0, -1); g.fillText(n, pill + 18, 4 + H / 2 + 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  return { t, aspect: c.width / c.height };
}

function photoTexture(img, ring) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.save(); g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#E2D2BE'; g.fillRect(0, 0, 128, 128);
  const s = Math.max(116 / img.width, 116 / img.height) * 1.08; const w = img.width * s, h = img.height * s;
  g.drawImage(img, 64 - w / 2, 64 - h / 2 + 8, w, h); g.restore();
  g.lineWidth = 7; g.strokeStyle = ring; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const imgCache = new Map();
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  imgCache.set(url, p); return p;
}

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(40, 9 / 16, 1, 900);
    this.cam.position.set(...CAMS.taktik.p);
    this.figScale = 1; this.labelSize = 1; this.showNames = true; this.showPhotos = true;
    this.players = new Map(); this.anim = []; this.dirty = true; this.highlights = new Set();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7560, 1.5); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6); this.sun.position.set(-30, 80, 40); this.scene.add(this.sun);
    this.pitchGroup = new THREE.Group(); this.scene.add(this.pitchGroup);
    this.annGroup = new THREE.Group(); this.scene.add(this.annGroup);
    this.draftGroup = new THREE.Group(); this.scene.add(this.draftGroup);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
    this.ball.position.set(0, 0.8, 0); this.scene.add(this.ball);
    const bs = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    bs.rotation.x = -Math.PI / 2; bs.position.y = 0.03; this.ballShadow = bs; this.scene.add(bs);
    this.controls = null; // app.js kendi işaretçi dinleyicisini önce ekledikten sonra initControls çağırır
    this.setTheme('latte');
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }
  initControls() {
    const c = new OrbitControls(this.cam, this.canvas);
    c.target.set(...CAMS.taktik.t); c.enableDamping = true; c.dampingFactor = 0.12;
    c.maxPolarAngle = Math.PI * 0.47; c.minDistance = 10; c.maxDistance = 280;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('change', () => (this.dirty = true));
    c.update(); this.controls = c;
  }
  setTheme(name) {
    const th = THEMES[name] || THEMES.latte; this.theme = name; this.th = th;
    this.pitchGroup.clear();
    const { tex, w, h } = pitchTexture(th);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    pm.rotation.x = -Math.PI / 2; this.pitchGroup.add(pm);
    const big = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: th.around }));
    big.rotation.x = -Math.PI / 2; big.position.y = -0.05; this.pitchGroup.add(big);
    // kaleler
    const post = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const netM = new THREE.MeshBasicMaterial({ color: th.net, wireframe: true, transparent: true, opacity: 0.35 });
    const GW = 7.32, GH = 2.44, GD = 2.2, R = 0.14;
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const v = new THREE.CylinderGeometry(R, R, GH, 10);
      const l = new THREE.Mesh(v, post); l.position.set(-GW / 2, GH / 2, 0); const rr = l.clone(); rr.position.x = GW / 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GW, 10), post); bar.rotation.z = Math.PI / 2; bar.position.y = GH;
      const net = new THREE.Mesh(new THREE.BoxGeometry(GW, GH, GD, 10, 4, 3), netM); net.position.set(0, GH / 2, -GD / 2);
      g.add(l, rr, bar, net); g.position.z = s * HL; if (s > 0) g.rotation.y = Math.PI; else g.rotation.y = 0;
      g.scale.setScalar(1.25); this.pitchGroup.add(g);
    }
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 230, 520);
    this.dirty = true;
  }

  // ---------- oyuncular ----------
  _figure(kit) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.y = 0.03;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.85, 40), new THREE.MeshBasicMaterial({ color: kit.ring, transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    const mat = new THREE.MeshStandardMaterial({ color: kit.body, roughness: 0.6 });
    const smat = new THREE.MeshStandardMaterial({ color: kit.shorts, roughness: 0.7 });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 1.3, 20), smat); legs.position.y = 0.65;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 1.5, 6, 20), mat); body.position.y = 2.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), new THREE.MeshStandardMaterial({ color: kit.head || '#EADCCB', roughness: 0.7 })); head.position.y = 4.15;
    const fig = new THREE.Group(); fig.add(legs, body, head);
    g.add(s, ring, fig);
    g.userData = { fig, ring, mat, smat, shadow: s };
    return g;
  }
  syncPlayers(list) {
    const keep = new Set(list.map((p) => p.key));
    for (const [k, o] of this.players) if (!keep.has(k)) { this.scene.remove(o.group); this.players.delete(k); }
    for (const p of list) {
      let o = this.players.get(p.key);
      const sig = [p.kit.body, p.kit.shorts, p.kit.ring, p.kit.num, p.no, p.name, this.showNames, this.showPhotos, p.photo, p.pid].join('|');
      if (!o) { const group = this._figure(p.kit); group.position.set(p.x, 0, p.z); this.scene.add(group); o = { group, key: p.key, sig: '' }; this.players.set(p.key, o); }
      o.side = p.side; o.pid = p.pid;
      if (o.sig !== sig) {
        const u = o.group.userData; u.mat.color.set(p.kit.body); u.smat.color.set(p.kit.shorts); u.ring.material.color.set(p.kit.ring);
        if (o.label) { o.group.remove(o.label); o.label.material.map.dispose(); o.label.material.dispose(); }
        const { t, aspect } = labelTexture(p.no, p.name, p.kit, this.showNames);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: false, transparent: true }));
        sp.center.set(0.5, 0); sp.position.y = 5.1; sp.renderOrder = 10; sp.userData.aspect = aspect; o.label = sp; o.group.add(sp);
        if (o.photoSp) { o.group.remove(o.photoSp); o.photoSp = null; }
        if (this.showPhotos && p.photo) {
          const want = p.photo;
          loadImage(p.photo).then((img) => {
            if (!img || o.photoWant !== want || !this.players.has(o.key)) return;
            const ps = new THREE.Sprite(new THREE.SpriteMaterial({ map: photoTexture(img, p.kit.body), sizeAttenuation: false, depthTest: false, transparent: true }));
            ps.center.set(0.5, -0.62); ps.position.y = 5.1; ps.renderOrder = 11; o.photoSp = ps; o.group.add(ps); this._sizeLabels(); this.dirty = true;
          });
          o.photoWant = want;
        } else o.photoWant = null;
        o.sig = sig;
      }
    }
    this._sizeLabels(); this.dirty = true;
  }
  _sizeLabels() {
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const h = 0.026 * this.labelSize * k;
    for (const o of this.players.values()) {
      if (o.label) o.label.scale.set(h * o.label.userData.aspect, h, 1);
      if (o.photoSp) { const ph = h * 1.55; o.photoSp.scale.set(ph, ph, 1); }
      o.group.userData.fig.scale.setScalar(this.figScale);
      o.group.userData.ring.scale.setScalar(this.figScale); o.group.userData.shadow.scale.setScalar(this.figScale);
      if (o.label) o.label.position.y = 5.1 * this.figScale; if (o.photoSp) o.photoSp.position.y = 5.1 * this.figScale;
    }
    this.dirty = true;
  }
  setPositions(pos, ball) {
    for (const [k, o] of this.players) { const p = pos[k]; if (p) { o.group.position.x = p[0]; o.group.position.z = p[1]; } }
    if (ball) this.setBall(ball);
    this.dirty = true;
  }
  setBall(b) {
    const dx = b[0] - this.ball.position.x, dz = b[1] - this.ball.position.z;
    const air = b[2] || 0;
    this.ball.position.set(b[0], 0.8 + air, b[1]); this.ballShadow.position.set(b[0], 0.03, b[1]);
    this.ballShadow.material.opacity = 0.25 / (1 + air * 0.15);
    const d = Math.hypot(dx, dz); if (d > 0.001) { const ax = new THREE.Vector3(dz, 0, -dx).normalize(); this.ball.rotateOnWorldAxis(ax, d / 0.8); }
    this.dirty = true;
  }
  // değişiklik efekti: çıkan oyuncu batar, giren yükselir
  popPlayer(key) {
    const o = this.players.get(key); if (!o) return;
    const fig = o.group.userData.fig, t0 = performance.now();
    this.anim.push((now) => { const t = Math.min(1, (now - t0) / 650); const y = t < 0.5 ? -t * 2 * 4.5 : -(1 - t) * 2 * 4.5; fig.position.y = y; return t < 1; });
  }
  setHighlights(keys) {
    this.highlights = new Set(keys || []);
    for (const [k, o] of this.players) {
      const on = this.highlights.has(k);
      if (on && !o.hl) {
        const g = new THREE.Group();
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.2, 14, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        cone.position.y = 7;
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.75, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;
        g.add(cone, ring); g.userData.ring = ring; o.group.add(g); o.hl = g;
      } else if (!on && o.hl) { o.group.remove(o.hl); o.hl = null; }
      if (o.hl) o.hl.scale.setScalar(this.figScale);
    }
    this.dirty = true;
  }

  // ---------- çizimler ----------
  setAnnotations(list, draft) {
    this._build(this.annGroup, list || []);
    this._build(this.draftGroup, draft ? [draft] : []);
    this.dirty = true;
  }
  _build(group, list) {
    for (const ch of group.children) ch.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
    group.clear();
    list.forEach((a, i) => { const m = this._annMesh(a, 0.06 + i * 0.004); if (m) group.add(m); });
  }
  _annMesh(a, y) {
    const col = new THREE.Color(a.c || '#22375A');
    const mat = (op = 1) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op * (a.op ?? 1), depthWrite: false, side: THREE.DoubleSide });
    const g = new THREE.Group(); const sc = this.figScale;
    if (a.t === 'pass' || a.t === 'run' || a.t === 'drib' || a.t === 'line') {
      const [x1, z1] = a.a, [x2, z2] = a.b; const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) return null;
      const nx = -(z2 - z1) / L, nz = (x2 - x1) / L; const pts = [];
      const N = 48;
      for (let i = 0; i <= N; i++) {
        const t = i / N; let x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        if (a.t === 'run') { const bend = (a.bend ?? 0.16) * L * 4 * t * (1 - t); x += nx * bend; z += nz * bend; }
        if (a.t === 'drib') { const w = Math.sin(t * Math.PI * Math.max(3, Math.round(L / 4))) * 0.9 * sc * Math.min(1, t * 8, (1 - t) * 8); x += nx * w; z += nz * w; }
        pts.push([x, z]);
      }
      const head = a.t === 'line' ? 0 : 2.8 * sc; const width = (a.t === 'line' ? 0.45 : 0.62) * sc;
      // ok başı için yolu kısalt
      let cut = pts.length - 1; if (head) { let acc = 0; for (let i = pts.length - 1; i > 0; i--) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= head * 0.85) { cut = i - 1; break; } } }
      const body = pts.slice(0, cut + 1);
      const dashed = a.t === 'run' || a.t === 'line';
      const segs = []; if (!dashed) segs.push(body); else {
        const dash = 2.2 * sc, gap = 1.5 * sc; let cur = [body[0]], acc = 0, on = true;
        for (let i = 1; i < body.length; i++) { const d = Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]); acc += d; if (on) cur.push(body[i]);
          if (on && acc >= dash) { segs.push(cur); on = false; acc = 0; } else if (!on && acc >= gap) { on = true; acc = 0; cur = [body[i]]; } }
        if (on && cur.length > 1) segs.push(cur);
      }
      for (const s of segs) if (s.length > 1) g.add(new THREE.Mesh(ribbon(s, width, y), mat()));
      if (head) {
        const e = pts[pts.length - 1], b = pts[Math.max(0, cut)]; const dx = e[0] - b[0], dz = e[1] - b[1], dl = Math.hypot(dx, dz) || 1;
        const ux = dx / dl, uz = dz / dl, px = -uz, pz = ux, hw = 1.25 * sc;
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([
          e[0], y, e[1], e[0] - ux * head + px * hw, y, e[1] - uz * head + pz * hw, e[0] - ux * head - px * hw, y, e[1] - uz * head - pz * hw], 3));
        g.add(new THREE.Mesh(geo, mat()));
      }
    } else if (a.t === 'lob') {
      const [x1, z1] = a.a, [x2, z2] = a.b; const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) return null;
      const h = Math.min(14, 3 + L * 0.22);
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x1, 1, z1), new THREE.Vector3((x1 + x2) / 2, h * 2, (z1 + z2) / 2), new THREE.Vector3(x2, 1, z2));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.28 * sc, 8, false), mat(0.95)));
      const end = new THREE.Mesh(new THREE.RingGeometry(1.1 * sc, 1.6 * sc, 32), mat()); end.rotation.x = -Math.PI / 2; end.position.set(x2, y, z2); g.add(end);
    } else if (a.t === 'circle') {
      const r = Math.max(1.5, a.r || 6);
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4 * sc, r, 72), mat()); ring.rotation.x = -Math.PI / 2;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 72), mat(0.18)); fill.rotation.x = -Math.PI / 2;
      ring.position.set(a.a[0], y + 0.002, a.a[1]); fill.position.set(a.a[0], y, a.a[1]); g.add(fill, ring);
    } else if (a.t === 'zone') {
      const x0 = Math.min(a.a[0], a.b[0]), x1 = Math.max(a.a[0], a.b[0]), z0 = Math.min(a.a[1], a.b[1]), z1 = Math.max(a.a[1], a.b[1]);
      const w = x1 - x0, d = z1 - z0; if (w < 0.5 || d < 0.5) return null;
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0.2)); fill.rotation.x = -Math.PI / 2; fill.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); g.add(fill);
      const t = 0.35 * sc;
      for (const [cx, cz, ww, dd] of [[(x0 + x1) / 2, z0, w, t], [(x0 + x1) / 2, z1, w, t], [x0, (z0 + z1) / 2, t, d], [x1, (z0 + z1) / 2, t, d]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), mat()); m.rotation.x = -Math.PI / 2; m.position.set(cx, y + 0.002, cz); g.add(m); }
    } else if (a.t === 'x') {
      for (const r of [Math.PI / 4, -Math.PI / 4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2 * sc, 0.8 * sc), mat()); m.rotation.set(-Math.PI / 2, 0, r); m.position.set(a.a[0], y, a.a[1]); g.add(m); }
    }
    return g;
  }

  // ---------- kamera ----------
  getCam() { return { p: this.cam.position.toArray().map((v) => +v.toFixed(2)), t: this.controls.target.toArray().map((v) => +v.toFixed(2)) }; }
  setCam(c, dur = 900) {
    if (!c) return;
    const p0 = this.cam.position.clone(), t0 = this.controls.target.clone();
    const p1 = new THREE.Vector3(...c.p), t1 = new THREE.Vector3(...c.t);
    if (!dur) { this.cam.position.copy(p1); this.controls.target.copy(t1); this.controls.update(); this.dirty = true; return; }
    const start = performance.now(); this._camAnim = true;
    this.anim.push((now) => { const k = ease(Math.min(1, (now - start) / dur)); this.cam.position.lerpVectors(p0, p1, k); this.controls.target.lerpVectors(t0, t1, k); this.controls.update(); if (k >= 1) this._camAnim = false; return k < 1; });
  }
  lerpCam(a, b, k) { // adım oynatırken
    const p = new THREE.Vector3(...a.p).lerp(new THREE.Vector3(...b.p), k), t = new THREE.Vector3(...a.t).lerp(new THREE.Vector3(...b.t), k);
    this.cam.position.copy(p); this.controls.target.copy(t); this.controls.update(); this.dirty = true;
  }

  // ---------- ekran ↔ saha ----------
  project(x, z, y = 0) {
    const v = new THREE.Vector3(x, y, z).project(this.cam); const r = this.canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, v.z];
  }
  groundAt(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(nd, this.cam);
    const hit = new THREE.Vector3(); if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
    return [THREE.MathUtils.clamp(hit.x, -HW - 5, HW + 5), THREE.MathUtils.clamp(hit.z, -HL - 5, HL + 5)];
  }
  pick(cx, cy, radius = 34) {
    let best = null, bd = radius;
    for (const [k, o] of this.players) {
      const p = o.group.position; const pts = [this.project(p.x, p.z, 0), this.project(p.x, p.z, 2.4 * this.figScale)];
      for (const s of pts) { const d = Math.hypot(s[0] - cx, s[1] - cy); if (d < bd) { bd = d; best = k; } }
    }
    const b = this.ball.position, sb = this.project(b.x, b.z, b.y); const db = Math.hypot(sb[0] - cx, sb[1] - cy);
    if (db < Math.min(bd, 26)) return 'ball';
    return best;
  }

  resize(w, h, pr) {
    this.r.setPixelRatio(pr); this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this._sizeLabels(); this.dirty = true;
  }
  _loop(now) {
    requestAnimationFrame(this._loop);
    if (this.anim.length) { this.anim = this.anim.filter((f) => f(now)); this.dirty = true; }
    if (this.controls) this.controls.update();
    if (this.highlights.size) { const s = 1 + Math.sin(now / 260) * 0.08; for (const o of this.players.values()) if (o.hl) { o.hl.userData.ring.scale.setScalar(s); } this.dirty = true; }
    const force = this.onBeforeRender ? this.onBeforeRender(now) : false;
    if (this.dirty || force) { this.r.render(this.scene, this.cam); this.dirty = false; if (this.onAfterRender) this.onAfterRender(now); }
  }
}

// Yerde düz şerit (kalın çizgi) geometrisi
function ribbon(pts, w, y) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const px = -dz * w / 2, pz = dx * w / 2;
    pos.push(pts[i][0] + px, y, pts[i][1] + pz, pts[i][0] - px, y, pts[i][1] - pz);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
