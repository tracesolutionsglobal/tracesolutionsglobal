// Trace Solutions Global reel scene.
// Everything on screen is a pure function of time t (seconds), so the renderer can
// step frame by frame: window.setPost(post) once, then window.renderFrame(t) per frame.
import * as THREE from 'three';

const W = 1080, H = 1920;
const CYCLE = 6;              // seconds for one "website builds itself" loop
const TAU = Math.PI * 2;
const deg = (d) => d * Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOutBack = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

// ---------- state set per post ----------
let POST = null;
let ACCENT = '#3291FF';
const GREEN = '#3FBE63';
const NAVY = '#071628';

// ---------- helpers ----------
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function shapeWithUV(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 16);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}
function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Seeded random so every render of a post is identical.
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- the website that builds itself ----------
function drawCheck(ctx, cx, cy, r, s) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = GREEN; ctx.shadowColor = 'rgba(63,190,99,.6)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * .22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * .42, 0); ctx.lineTo(-r * .1, r * .32); ctx.lineTo(r * .45, -r * .3); ctx.stroke();
  ctx.restore();
}
function drawLive(ctx, x, y, a, t, scale = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(63,190,99,.15)'; rr(ctx, 0, -22, 112, 44, 22); ctx.fill();
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3; rr(ctx, 0, -22, 112, 44, 22); ctx.stroke();
  const pulse = .5 + .5 * Math.sin(t * TAU * 1.5);
  ctx.fillStyle = `rgba(63,190,99,${.25 + .35 * pulse})`; ctx.beginPath(); ctx.arc(26, 0, 9 + 6 * pulse, 0, TAU); ctx.fill();
  ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(26, 0, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#16803c'; ctx.font = '700 26px Poppins'; ctx.textBaseline = 'middle'; ctx.fillText('Live', 44, 2);
  ctx.restore();
}

function drawSite(ctx, cw, ch, t, mobile) {
  const site = POST.site;
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  const k = mobile ? 0.5 : 1;                      // phone texture is half the width
  ctx.clearRect(0, 0, cw, ch);
  // page
  ctx.fillStyle = '#f3f7fc'; ctx.fillRect(0, 0, cw, ch);
  // browser chrome (always there; it's the window, not the site)
  const barH = mobile ? 54 : 64;
  ctx.fillStyle = '#16365f'; ctx.fillRect(0, 0, cw, barH);
  if (!mobile) {
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(34 + i * 30, barH / 2, 10, 0, TAU); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, 150, 14, cw - 300, 36, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '600 20px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(site.url, cw / 2, barH / 2 + 1); ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '600 18px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(site.url, cw / 2, barH / 2 + 1); ctx.textAlign = 'left';
  }

  // the whole build fades away at the end of the loop, so frame CYCLE == frame 0
  const fade = c > 5.4 ? 1 - easeInOut((c - 5.4) / 0.6) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.beginPath(); ctx.rect(0, barH, cw, ch - barH); ctx.clip();

  // 1. nav bar slides in from the left
  const nav = easeOutCubic(c / 0.6);
  const navH = mobile ? 70 : 78;
  ctx.save(); ctx.translate(-cw * (1 - nav), 0);
  ctx.fillStyle = NAVY; ctx.fillRect(0, barH, cw, navH);
  ctx.fillStyle = site.color; ctx.beginPath(); ctx.arc(mobile ? 36 : 50, barH + navH / 2, mobile ? 16 : 18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `700 ${mobile ? 22 : 28}px Poppins`; ctx.textBaseline = 'middle';
  ctx.fillText(site.name, mobile ? 62 : 80, barH + navH / 2 + 2);
  if (!mobile) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    [0, 1, 2].forEach((i) => { rr(ctx, cw - 330 + i * 100, barH + navH / 2 - 6, 70, 12, 6); ctx.fill(); });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    [0, 1, 2].forEach((i) => ctx.fillRect(cw - 52, barH + navH / 2 - 12 + i * 11, 30, 4));
  }
  ctx.restore();

  // 2. headline types out
  const top = barH + navH;
  const title = site.tagline;
  const n = Math.floor(title.length * clamp((c - 0.6) / 1.0));
  const titleSize = mobile ? 34 : 50;
  ctx.fillStyle = NAVY; ctx.font = `800 ${titleSize}px Poppins`; ctx.textBaseline = 'alphabetic';
  const tx = mobile ? 26 : 56, ty = top + (mobile ? 64 : 90);
  const words = title.slice(0, n);
  // wrap to two lines at the space nearest the middle
  const mid = title.indexOf(' ', Math.floor(title.length / 2) - 2);
  const l1 = words.slice(0, mid > 0 ? mid : words.length), l2 = mid > 0 && n > mid ? words.slice(mid + 1) : '';
  ctx.fillText(l1, tx, ty); if (l2) ctx.fillText(l2, tx, ty + titleSize * 1.15);
  if (c > 0.6 && c < 2.6 && Math.floor(c * 3) % 2 === 0) {           // blinking caret
    const lineW = ctx.measureText(l2 || l1).width;
    ctx.fillStyle = site.color; ctx.fillRect(tx + lineW + 4, (l2 ? ty + titleSize * 1.15 : ty) - titleSize * .8, 4, titleSize * .9);
  }

  // 3. body text lines grow
  const linesY = ty + titleSize * 1.15 + (mobile ? 34 : 46);
  const lineMax = mobile ? [300, 270, 220] : [470, 430, 340];
  ctx.fillStyle = '#c5d2e3';
  lineMax.forEach((w, i) => {
    const p = easeOutCubic((c - 1.5 - i * 0.25) / 0.6);
    if (p > 0) { rr(ctx, tx, linesY + i * (mobile ? 26 : 32), w * p, mobile ? 12 : 16, 8); ctx.fill(); }
  });

  // 4. button pops in
  const bp = easeOutBack((c - 2.4) / 0.45);
  const by = linesY + (mobile ? 96 : 120), bw = mobile ? 170 : 210, bh = mobile ? 50 : 60;
  if (bp > 0) {
    ctx.save(); ctx.translate(tx + bw / 2, by + bh / 2); ctx.scale(bp, bp);
    ctx.fillStyle = ACCENT; ctx.shadowColor = ACCENT; ctx.shadowBlur = 20; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = `700 ${mobile ? 20 : 24}px Poppins`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(site.cta, 0, 2); ctx.textAlign = 'left';
    ctx.restore();
  }

  // 5. image block fades in
  const ip = easeOutCubic((c - 2.8) / 0.7);
  if (ip > 0) {
    let ix, iy, iw, ih;
    if (mobile) { ix = 26; iy = by + bh + 30; iw = cw - 52; ih = ch - iy - 30; }
    else { ix = 600; iy = top + 46; iw = cw - 600 - 56; ih = 330; }
    ctx.save(); ctx.globalAlpha *= ip;
    ctx.translate(ix + iw / 2, iy + ih / 2); ctx.scale(.92 + .08 * ip, .92 + .08 * ip); ctx.translate(-iw / 2, -ih / 2);
    const g = ctx.createLinearGradient(0, 0, iw, ih); g.addColorStop(0, site.color); g.addColorStop(1, site.color2);
    ctx.fillStyle = g; rr(ctx, 0, 0, iw, ih, 22); ctx.fill();
    // simple "photo": sun and hills
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(iw * .72, ih * .32, ih * .12, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, ih); ctx.lineTo(iw * .35, ih * .45); ctx.lineTo(iw * .7, ih); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(iw * .3, ih); ctx.lineTo(iw * .65, ih * .55); ctx.lineTo(iw, ih * .9); ctx.lineTo(iw, ih); ctx.fill();
    ctx.restore();
  }

  // 6. feature cards (desktop only)
  if (!mobile) {
    const cy = top + 420, cwid = (cw - 112 - 40) / 3;
    [0, 1, 2].forEach((i) => {
      const p = easeOutCubic((c - 3.1 - i * 0.15) / 0.5);
      if (p <= 0) return;
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 30);
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(7,22,40,.12)'; ctx.shadowBlur = 16;
      rr(ctx, 56 + i * (cwid + 20), cy, cwid, 150, 18); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = i === 1 ? GREEN : ACCENT; ctx.beginPath(); ctx.arc(56 + i * (cwid + 20) + 40, cy + 42, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c5d2e3'; rr(ctx, 56 + i * (cwid + 20) + 24, cy + 82, cwid - 70, 12, 6); ctx.fill();
      rr(ctx, 56 + i * (cwid + 20) + 24, cy + 106, cwid - 120, 12, 6); ctx.fill();
      ctx.restore();
    });
  }

  // 7. green check + Live
  const ck = easeOutBack((c - 3.7) / 0.4);
  if (mobile) { drawCheck(ctx, cw - 44, top + 40, 22, ck); drawLive(ctx, cw - 190, top + 40, clamp((c - 4.0) / 0.3), t, .9); }
  else { drawCheck(ctx, cw - 60, top + 410 - 16, 34, ck); drawLive(ctx, cw - 230, top + 410 - 16, clamp((c - 4.0) / 0.3), t); }
  ctx.restore();
}

// ---------- three.js scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100); camera.position.set(0, 0, 10);
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3, 5, 7); scene.add(key);
const rim = new THREE.PointLight(0x3291ff, 30, 20); rim.position.set(-3, 2, 3); scene.add(rim);

const CENTER_Y = 0.76;                        // world y of the window centre (about 760px down the frame)
const WIN_W = 3.0, WIN_H = 2.05;

// window
const win = new THREE.Group(); scene.add(win);
const frameGeo = new THREE.ExtrudeGeometry(roundedRectShape(WIN_W + .1, WIN_H + .1, .14),
  { depth: .12, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 3, curveSegments: 12 });
frameGeo.translate(0, 0, -.15);
const frameMat = new THREE.MeshStandardMaterial({ color: 0x10294a, metalness: .45, roughness: .35 });
win.add(new THREE.Mesh(frameGeo, frameMat));
const rimMat = new THREE.MeshBasicMaterial({ color: 0x3291ff, toneMapped: false });
const rimMesh = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(WIN_W + .05, WIN_H + .05, .12), 16), rimMat);
rimMesh.position.z = .002; win.add(rimMesh);
const siteCanvas = document.createElement('canvas'); siteCanvas.width = 1200; siteCanvas.height = 820;
const siteCtx = siteCanvas.getContext('2d');
const siteTex = new THREE.CanvasTexture(siteCanvas); siteTex.colorSpace = THREE.SRGBColorSpace; siteTex.anisotropy = 8;
const screen = new THREE.Mesh(shapeWithUV(WIN_W, WIN_H, .1), new THREE.MeshBasicMaterial({ map: siteTex, toneMapped: false }));
screen.position.z = .006; win.add(screen);

// glow behind the window and a soft shadow under it
const glowTex = radialTexture('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x3291ff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
glow.scale.set(5.6, 4.2, 1); glow.position.set(0, CENTER_Y, -1.2); scene.add(glow);
const shadow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture('rgba(0,0,0,.85)', 'rgba(0,0,0,0)'), transparent: true, opacity: .7, depthWrite: false }));
shadow.scale.set(3.4, .5, 1); scene.add(shadow);
const floorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x3291ff, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
floorGlow.scale.set(2.6, .28, 1); scene.add(floorGlow);

// orbiting phone (shows the same site, mobile layout)
const phone = new THREE.Group(); scene.add(phone);
const PH_W = .44, PH_H = .88;
const phoneGeo = new THREE.ExtrudeGeometry(roundedRectShape(PH_W, PH_H, .07), { depth: .05, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2, curveSegments: 10 });
phoneGeo.translate(0, 0, -.065);
phone.add(new THREE.Mesh(phoneGeo, new THREE.MeshStandardMaterial({ color: 0x0c1f38, metalness: .6, roughness: .3 })));
const phoneCanvas = document.createElement('canvas'); phoneCanvas.width = 400; phoneCanvas.height = 820;
const phoneCtx = phoneCanvas.getContext('2d');
const phoneTex = new THREE.CanvasTexture(phoneCanvas); phoneTex.colorSpace = THREE.SRGBColorSpace;
const phoneScreen = new THREE.Mesh(shapeWithUV(PH_W - .04, PH_H - .06, .05), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false }));
phoneScreen.position.z = .004; phone.add(phoneScreen);

// orbiting globe
const globe = new THREE.Group(); scene.add(globe);
const globeMat = new THREE.MeshStandardMaterial({ color: 0x15457f, metalness: .3, roughness: .5, emissive: 0x0a2a55, emissiveIntensity: .6 });
globe.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 40, 24), globeMat));
const gridMat = new THREE.LineBasicMaterial({ color: 0x3fbe63, transparent: true, opacity: .8 });
const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(.305, 12, 8)), gridMat);
globe.add(grid);

// orbiting star-rating badge
const starCanvas = document.createElement('canvas'); starCanvas.width = 512; starCanvas.height = 192;
function drawStars() {
  const g = starCanvas.getContext('2d'); g.clearRect(0, 0, 512, 192);
  g.fillStyle = '#fff'; rr(g, 6, 6, 500, 180, 90); g.fill();
  const star = (cx, cy, R) => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? R * .45 : R, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.fill(); };
  g.fillStyle = '#FFC531'; for (let i = 0; i < 5; i++) star(70 + i * 68, 82, 30);
  g.fillStyle = '#071628'; g.font = '800 40px Poppins'; g.textBaseline = 'middle'; g.fillText('5.0', 400, 84);
  g.fillStyle = '#6a7d95'; g.font = '600 24px Poppins'; g.fillText('Google reviews', 60, 142);
}
const starTex = new THREE.CanvasTexture(starCanvas); starTex.colorSpace = THREE.SRGBColorSpace;
const stars = new THREE.Mesh(new THREE.PlaneGeometry(.82, .307), new THREE.MeshBasicMaterial({ map: starTex, transparent: true, toneMapped: false }));
scene.add(stars);

// glowing particles
const PCOUNT = 80;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PCOUNT * 3), pCol = new Float32Array(PCOUNT * 3), pSeed = [];
{
  const r = rng(7);
  for (let i = 0; i < PCOUNT; i++) pSeed.push({ x: (r() - .5) * 4.4, y: -0.7 + r() * 3.0, z: -2.5 + r() * 3.5, s: .2 + r() * .5, p: r() * TAU, g: r() < .3 });
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .09, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(particles);

// ---------- text beats (DOM) ----------
const textEl = document.getElementById('text');
const badgeEl = document.getElementById('badge');
const stageEl = document.getElementById('stage');
let beatEls = [], beatTimes = [], DURATION = 20;

function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }
function fit(el, maxH, minSize) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollHeight > maxH && size > minSize) { size -= 2; el.style.fontSize = size + 'px'; }
}

window.setPost = async (post) => {
  POST = post;
  ACCENT = post.accent || '#3291FF';
  DURATION = post.duration || 20;
  document.documentElement.style.setProperty('--accent', ACCENT);
  const a = new THREE.Color(ACCENT);
  rimMat.color.copy(a); glow.material.color.copy(a); floorGlow.material.color.copy(a); rim.color.copy(a);
  // colour the particles: mostly accent, some green, some white
  pSeed.forEach((s, i) => { const col = s.g ? new THREE.Color(GREEN) : (i % 4 === 0 ? new THREE.Color('#ffffff') : a); pCol.set([col.r, col.g, col.b], i * 3); });
  pGeo.attributes.color.needsUpdate = true;

  textEl.innerHTML = '';
  beatEls = post.beats.map((b) => {
    const d = document.createElement('div'); d.className = 'beat';
    let body = '';
    if (b.kind === 'brand') body = `<div class="bigbadge"><img src="/logo/wordmark.jpg" alt=""></div>` + (b.accent ? `<span class="a" style="margin-top:24px;font-size:44px">${esc(b.accent)}</span>` : '');
    else if (b.kind === 'cta') body = (b.white ? `<span class="w">${esc(b.white)}</span>` : '') + (b.accent ? `<span class="a">${esc(b.accent)}</span>` : '') + `<span class="url">${esc(b.url || 'tracesolutionsglobal.com')}</span>`;
    else body = (b.white ? `<span class="w">${esc(b.white)}</span>` : '') + (b.accent ? `<span class="a">${esc(b.accent)}</span>` : '');
    d.innerHTML = `<div class="headline">${esc(b.head || '')}</div><div class="divider"></div><div class="body">${body}</div>`;
    textEl.appendChild(d);
    return { root: d, head: d.querySelector('.headline'), div: d.querySelector('.divider'), body: d.querySelector('.body'), kind: b.kind };
  });
  await Promise.all(['600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Poppins`)));
  await document.fonts.ready;
  drawStars(); starTex.needsUpdate = true;
  await Promise.all([...document.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
  // keep headline to ~2 lines and the body above the logo badge
  beatEls.forEach((b) => { b.root.style.opacity = 1; fit(b.head, 190, 48); fit(b.body, 300, 34); b.root.style.opacity = 0; });
  const n = beatEls.length;
  beatTimes = beatEls.map((_, i) => [i * DURATION / n, (i + 1) * DURATION / n]);
  return true;
};

function updateText(t) {
  let brandVis = 0;
  beatEls.forEach((b, i) => {
    const [s, e] = beatTimes[i];
    const last = i === beatEls.length - 1;
    const start = i === 0 ? 0.25 : s - 0.1;
    const inH = easeOutCubic((t - start) / 0.5);
    const inB = easeOutCubic((t - start - 0.15) / 0.5);
    const out = last ? clamp((DURATION - 0.2 - t) / 0.6) : clamp((e - t) / 0.4);
    const vis = Math.min(Math.max(inH, inB), out);
    b.root.style.opacity = vis > 0.001 ? 1 : 0;
    b.head.style.opacity = Math.min(inH, out); b.head.style.transform = `translateY(${(1 - inH) * 50}px)`;
    b.body.style.opacity = Math.min(inB, out); b.body.style.transform = `translateY(${(1 - inB) * 50}px)`;
    b.div.style.opacity = Math.min(inH, out); b.div.style.transform = `scaleX(${.3 + .7 * inH})`;
    if (b.kind === 'brand') brandVis = Math.max(brandVis, Math.min(inB, out));
  });
  const endFade = clamp((DURATION - 0.2 - t) / 0.6);
  badgeEl.style.opacity = Math.min(1 - brandVis, clamp((t - 0.4) / 0.6), endFade);
}

// ---------- per-frame ----------
window.renderFrame = (t) => {
  // gentle slow zoom on the scene (text is not zoomed, so it stays in the safe area)
  stageEl.style.transform = `scale(${1 + 0.06 * (t / DURATION)})`;

  // window motion: eased Y swing of about 25 degrees each way, slight tilt, floating bob
  const swing = Math.sin(TAU * t / 9);
  win.rotation.y = deg(25) * swing;
  win.rotation.x = deg(-4) + deg(5) * Math.sin(TAU * t / 11 + 1);
  win.rotation.z = deg(1.5) * Math.sin(TAU * t / 13);
  const bob = 0.09 * Math.sin(TAU * t / 4.5);
  win.position.set(0, CENTER_Y + bob, 0);
  glow.position.y = CENTER_Y + bob;
  const lowY = CENTER_Y - WIN_H / 2 - 0.5;
  shadow.position.set(0, lowY, -.5); shadow.material.opacity = .55 - bob * 1.5;
  shadow.scale.set(3.4 * (1 - bob * .8), .5, 1);
  floorGlow.position.set(0, lowY + .02, -.4);

  drawSite(siteCtx, siteCanvas.width, siteCanvas.height, t, false); siteTex.needsUpdate = true;
  drawSite(phoneCtx, phoneCanvas.width, phoneCanvas.height, t - 0.35, true); phoneTex.needsUpdate = true;

  // orbit: a tilted ring, low when passing in front of the window, high when behind
  const orbit = (theta, rx = 1.42, rz = 1.35) => ({ x: rx * Math.cos(theta), z: rz * Math.sin(theta), y: CENTER_Y - 0.95 * Math.sin(theta) });
  const w = TAU / 26;
  let o = orbit(0.2 + w * t);
  phone.position.set(o.x, o.y + 0.05 * Math.sin(TAU * t / 3), o.z);
  phone.rotation.set(deg(-6), -0.45 * Math.cos(0.2 + w * t) + deg(10) * Math.sin(TAU * t / 7), deg(6) * Math.sin(TAU * t / 5));
  o = orbit(0.2 + TAU / 3 + w * t);
  globe.position.set(o.x, o.y, o.z); globe.rotation.set(deg(18), t * 0.8, 0);
  o = orbit(0.2 + 2 * TAU / 3 + w * t);
  stars.position.set(o.x, o.y, o.z);
  stars.quaternion.copy(camera.quaternion); stars.rotateY(deg(14) * Math.sin(TAU * t / 6)); stars.rotateZ(deg(4) * Math.sin(TAU * t / 5));

  for (let i = 0; i < PCOUNT; i++) {
    const s = pSeed[i];
    pPos[i * 3] = s.x + 0.12 * Math.cos(t * s.s + s.p);
    pPos[i * 3 + 1] = s.y + 0.18 * Math.sin(t * s.s * 0.8 + s.p);
    pPos[i * 3 + 2] = s.z;
  }
  pGeo.attributes.position.needsUpdate = true;

  updateText(t);
  renderer.render(scene, camera);
  return true;
};

window.sceneReady = true;
