#!/usr/bin/env node
// Trace Solutions Global: vertical promo reel builder.
//
//   node make_video.js --calendar calendar.json --index 0      one video (post #1)
//   node make_video.js --calendar calendar.json --all          every post
//
// Options:
//   --voice-dir DIR   folder of voiceover MP3s (default ./voiceovers)
//   --music FILE      reference reel (mp4) or music file (default ./trace_solutions_reel_remastered.mp4)
//   --out DIR         output folder (default ./output)
//   --stills          also save a few PNG stills next to the video, for checking
//   --from N --to M   batch only posts N..M (0-based, inclusive)
//   --skip-existing   in batch mode, skip posts whose MP4 already exists
//
// Every frame is rendered by headless Chromium (Three.js scene in ./scene) and piped to ffmpeg.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const FPS = 30, W = 1080, H = 1920, MAX_MB = 30;
const ROOT = __dirname;
const LOGO_DIR = path.resolve(ROOT, '../../assets/logo');

// ---------------- args ----------------
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
const CAL = opt('calendar', 'calendar.json');
const VOICE_DIR = opt('voice-dir', 'voiceovers');
const MUSIC = opt('music', fs.existsSync('trace_solutions_reel_remastered.mp4') ? 'trace_solutions_reel_remastered.mp4' : null);
const OUT = opt('out', 'output');

// ---------------- calendar ----------------
function loadCalendar(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.posts || raw.calendar || raw.items || Object.values(raw).find(Array.isArray) || []);
  if (!list.length) throw new Error(`No posts found in ${file}`);
  return list;
}
const pick = (o, ...keys) => { for (const k of keys) if (o[k] != null && o[k] !== '') return o[k]; return undefined; };

// ---------------- caption -> four beats ----------------
const TAGLINE = 'Professional, affordable websites for local businesses';
function cleanCaption(text) {
  return String(text || '')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')                                   // hashtags
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')     // emoji
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[ \t]+/g, ' ').trim();
}
function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim().replace(/^[-–—•*]\s*/, '')).filter((s) => s.replace(/[^\p{L}\p{N}]/gu, '').length > 2);
}
// shorten at a word boundary, only when needed
function shorten(s, max) {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max + 1); const i = cut.lastIndexOf(' ');
  return cut.slice(0, i > max * .5 ? i : max).replace(/[,;:\-–—]+$/, '');
}
// split a long headline into a short head + remainder
function splitHead(s, max = 46) {
  if (!s || s.length <= max) return [s, ''];
  const m = s.slice(0, max + 8).match(/^(.{8,}?)([,:;]|\s[–—-])\s/);
  if (m && m[1].length <= max + 6) return [m[1], s.slice(m[0].length)];
  const words = s.split(' '); let h = '';
  while (words.length && (h + ' ' + words[0]).trim().length <= max) h = (h + ' ' + words.shift()).trim();
  return [h, words.join(' ')];
}
// split a body sentence into a white part and an accent-coloured part
function splitBody(s) {
  s = shorten((s || '').trim(), 96);
  if (!s) return ['', ''];
  const m = s.match(/^(.{8,}?)([,:;]|\s[–—-])\s+(.+)$/);
  if (m && m[3].length > 3) return [m[1] + (m[2].trim() === ':' ? ':' : ''), m[3]];
  const words = s.split(' ');
  if (words.length < 4) return ['', s];
  const half = Math.ceil(words.length * .45);
  return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}
function captionToBeats(post) {
  if (Array.isArray(post.beats) && post.beats.length) return post.beats;
  const ss = sentences(cleanCaption(pick(post, 'caption', 'text', 'copy', 'body')));
  const isCta = (s) => /tracesolutionsglobal|\b(dm|message|call|whatsapp|book|visit|contact|get in touch|learn more|link in bio|reach out|let'?s talk)\b/i.test(s);
  const isBrand = (s) => /trace solutions|\bwe (build|design|make|create|help)\b/i.test(s);
  let cta = [...ss].reverse().find(isCta);
  const brand = ss.find((s) => isBrand(s) && s !== cta);
  const q = ss.filter((s) => s !== cta && s !== brand);

  const textBeat = (headSrc, bodySrc) => {
    const [head, rest] = splitHead(headSrc || '');
    const [white, accent] = splitBody([rest, bodySrc].filter(Boolean).join(' '));
    return { kind: 'text', head, white, accent };
  };
  let b1, b2;
  if (q.length >= 4) { b1 = textBeat(q[0], q[1]); b2 = textBeat(q[2], q[3]); }
  else if (q.length === 3) { b1 = textBeat(q[0], ''); b2 = textBeat(q[1], q[2]); }
  else if (q.length === 2) { b1 = textBeat(q[0], ''); b2 = textBeat(q[1], ''); }
  else { b1 = textBeat(q[0] || 'Is your website working for you?', ''); b2 = textBeat('First impressions matter', ''); }
  let b3;
  const bm = brand && brand.match(/^(.*?)(Trace Solutions Global)\s*[,:–—-]?\s*(.*)$/i);
  if (bm && bm[3]) b3 = { kind: 'brand', head: bm[2], accent: shorten(bm[3].charAt(0).toUpperCase() + bm[3].slice(1), 64) };
  else if (brand) b3 = { kind: 'brand', head: 'Trace Solutions Global', accent: shorten(brand, 70) };
  else b3 = { kind: 'brand', head: 'Trace Solutions Global', accent: TAGLINE };
  const leftover = q.slice(4);
  const ctaClean = cta ? cta.replace(/\s*(at|on|via)?\s*(https?:\/\/)?(www\.)?tracesolutionsglobal\.com\/?\.?/i, '').replace(/[\s:.,]+$/, '').trim() : '';
  const generic = !ctaClean || /^(learn more|find out more|visit us|visit|more info|link in bio)$/i.test(ctaClean);
  const ctaHead = leftover.length ? splitHead(leftover[leftover.length - 1])[0] : (!generic ? splitHead(ctaClean)[0] : "Don't get left behind");
  const ctaWhite = !generic && ctaHead !== splitHead(ctaClean)[0] ? shorten(ctaClean, 60) : 'Trace Solutions Global';
  const b4 = { kind: 'cta', head: ctaHead, white: ctaWhite, accent: 'Learn more:', url: 'tracesolutionsglobal.com' };
  [b1, b2, b3, b4].forEach((b) => { if (b.head) b.head = b.head.replace(/\.+$/, ''); });
  return [b1, b2, b3, b4];
}

// ---------------- per-post variation ----------------
const ACCENTS = ['#3291FF', '#3FBE63', '#4FA3FF', '#34C47C'];
const SITES = [
  { match: /caf[eé]|coffee|restaurant|food|bakery|cake|kitchen|eat/i, name: 'Bloom Café', url: 'bloomcafe.lk', tagline: 'Fresh coffee, made with love', cta: 'Order now', color: '#c0784a', color2: '#f2c38f' },
  { match: /salon|beauty|spa|hair|nail|barber/i, name: 'Glow Studio', url: 'glowstudio.lk', tagline: 'Look good, feel amazing', cta: 'Book now', color: '#c2577f', color2: '#f3a6c4' },
  { match: /shop|store|retail|boutique|fashion|ecommerce|sell/i, name: 'Urban Threads', url: 'urbanthreads.lk', tagline: 'New season, new styles', cta: 'Shop now', color: '#4b5bd6', color2: '#9fb0ff' },
  { match: /clinic|doctor|dental|health|pharmacy|care/i, name: 'CityCare Clinic', url: 'citycare.lk', tagline: 'Care you can trust, close to home', cta: 'Book a visit', color: '#1f9e8f', color2: '#8fe0d4' },
  { match: /build|construct|plumb|electric|trade|repair|garage|auto/i, name: 'Prime Builders', url: 'primebuilders.lk', tagline: 'Quality work, on time', cta: 'Get a quote', color: '#d9822b', color2: '#ffd08a' },
  { match: /gym|fitness|yoga|coach|training/i, name: 'Pulse Fitness', url: 'pulsefitness.lk', tagline: 'Stronger every single day', cta: 'Join today', color: '#e0533d', color2: '#ffb199' },
  { match: /.*/, name: 'Your Business', url: 'yourbusiness.lk', tagline: 'Your business, online and open 24/7', cta: 'Get started', color: '#3291FF', color2: '#8cc4ff' },
];
function hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
function variation(post, index) {
  const angle = pick(post, 'angle', 'theme', 'pillar', 'category', 'type') || '';
  const text = `${angle} ${pick(post, 'caption', 'text') || ''}`;
  let site = SITES.find((s) => s.match.test(angle)) || SITES.find((s) => s.match.test(text));
  if (site === SITES[SITES.length - 1]) site = SITES[index % (SITES.length - 1)];
  const accent = post.accent || ACCENTS[(angle ? hash(angle) : index) % ACCENTS.length];
  return { site: { ...site, match: undefined }, accent };
}

// ---------------- media helpers ----------------
function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim();
  return parseFloat(out);
}
function findVoice(post, index) {
  const given = pick(post, 'voiceover', 'voice', 'vo', 'audio', 'voiceover_file', 'mp3');
  const candidates = [];
  if (given) candidates.push(given, path.join(VOICE_DIR, given), path.join(VOICE_DIR, path.basename(given)));
  const date = pick(post, 'date', 'day'), slot = pick(post, 'slot', 'time_slot', 'time');
  if (date && slot) candidates.push(path.join(VOICE_DIR, `${date}_${slot}.mp3`));
  candidates.push(path.join(VOICE_DIR, `${index + 1}.mp3`), path.join(VOICE_DIR, `post-${index + 1}.mp3`), path.join(VOICE_DIR, `${String(index + 1).padStart(2, '0')}.mp3`));
  return candidates.find((c) => c && fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}
function outName(post, index) {
  const date = pick(post, 'date', 'day'), slot = pick(post, 'slot', 'time_slot', 'time');
  const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return date && slot ? `${safe(date)}_${safe(slot)}.mp4` : `post-${String(index + 1).padStart(2, '0')}.mp4`;
}

// ---------------- tiny static server for the scene ----------------
function startServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let file;
    if (u.startsWith('/logo/')) file = path.join(LOGO_DIR, path.basename(u));
    else if (u.startsWith('/node_modules/')) file = path.join(ROOT, u);
    else file = path.join(ROOT, 'scene', u === '/' ? 'index.html' : u);
    if (!file.startsWith(ROOT) && !file.startsWith(LOGO_DIR)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// ---------------- render one post ----------------
async function renderPost(browser, port, post, index) {
  const voice = findVoice(post, index);
  const duration = voice ? probeDuration(voice) + 1.5 : (post.duration || 20);
  const frames = Math.round(duration * FPS);
  const { site, accent } = variation(post, index);
  const beats = captionToBeats(post);
  fs.mkdirSync(OUT, { recursive: true });
  const outFile = path.join(OUT, outName(post, index));
  const tmpVideo = outFile.replace(/\.mp4$/, '.video.mp4');

  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 30000 }).catch(() => {
    throw new Error('3D scene did not start: ' + (errors.join(' | ') || 'no WebGL?'));
  });
  await page.evaluate((p) => window.setPost(p), { beats, site, accent, duration });

  // pass 1: video frames -> ffmpeg (no audio yet)
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmpVideo],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => c === 0 ? res() : rej(new Error('ffmpeg video encode failed: ' + c))));
  const t0 = Date.now();
  const stillTimes = flag('stills') ? [1.2, 3.5, duration * .3, duration * .45, duration * .62, duration * .8, duration - 1.5] : [];
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    const s = stillTimes.find((st) => Math.abs(st - t) < 0.5 / FPS);
    if (s != null) await page.screenshot({ path: outFile.replace(/\.mp4$/, `_t${t.toFixed(1)}.png`) });
    if (f % 60 === 0) process.stdout.write(`\r  ${outName(post, index)}: frame ${f}/${frames} (${((Date.now() - t0) / 1000 / Math.max(f, 1) * frames / 60).toFixed(1)} min est.)   `);
  }
  ff.stdin.end(); await ffDone; await page.close();
  if (errors.length) console.warn('\n  page warnings:', errors.slice(0, 3).join(' | '));
  process.stdout.write(`\r  ${outName(post, index)}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s                    \n`);

  // pass 2: audio mix + mux
  const fadeStart = Math.max(0, duration - 1.5).toFixed(2);
  const a = ['-v', 'error', '-y', '-i', tmpVideo];
  let filter;
  if (voice && MUSIC) {
    a.push('-i', voice, '-stream_loop', '-1', '-i', MUSIC);
    filter = `[1:a]aresample=48000,aformat=channel_layouts=stereo,apad[v];[v]asplit=2[vmix][vkey];` +
      `[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.30[m];` +
      `[m][vkey]sidechaincompress=threshold=0.03:ratio=3:attack=30:release=450:makeup=1[md];` +
      `[vmix][md]amix=inputs=2:normalize=0,atrim=0:${duration.toFixed(2)},afade=t=out:st=${fadeStart}:d=1.5[aout]`;
  } else if (voice) {
    a.push('-i', voice);
    filter = `[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${duration.toFixed(2)},afade=t=out:st=${fadeStart}:d=1.5[aout]`;
  } else if (MUSIC) {
    a.push('-stream_loop', '-1', '-i', MUSIC);
    filter = `[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${duration.toFixed(2)},afade=t=in:d=0.3,afade=t=out:st=${fadeStart}:d=1.5[aout]`;
  }
  if (filter) a.push('-filter_complex', filter, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  else a.push('-c', 'copy');
  a.push('-movflags', '+faststart', outFile);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  fs.unlinkSync(tmpVideo);

  const mb = fs.statSync(outFile).size / 1e6;
  if (mb > MAX_MB) console.warn(`  WARNING: ${outFile} is ${mb.toFixed(1)} MB (limit ${MAX_MB} MB)`);
  return { outFile, mb, duration, voice, beats };
}

// ---------------- main ----------------
(async () => {
  const posts = loadCalendar(CAL);
  if (!MUSIC) console.warn('No music file found (pass --music trace_solutions_reel_remastered.mp4).');
  let indices;
  if (flag('all')) {
    const from = parseInt(opt('from', '0'), 10), to = parseInt(opt('to', String(posts.length - 1)), 10);
    indices = posts.map((_, i) => i).filter((i) => i >= from && i <= to);
  } else indices = [parseInt(opt('index', '0'), 10)];

  const srv = await startServer();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const results = [];
  try {
    for (const i of indices) {
      if (!posts[i]) { console.error(`No post at index ${i}`); continue; }
      if (flag('skip-existing') && fs.existsSync(path.join(OUT, outName(posts[i], i)))) { console.log(`  skip ${outName(posts[i], i)}`); continue; }
      try {
        const r = await renderPost(browser, srv.address().port, posts[i], i);
        console.log(`  -> ${r.outFile}  ${r.duration.toFixed(1)}s  ${r.mb.toFixed(1)} MB  voice: ${r.voice ? path.basename(r.voice) : 'none (music only)'}`);
        results.push({ index: i, ...r });
      } catch (e) { console.error(`  FAILED post ${i}: ${e.message}`); results.push({ index: i, error: e.message }); }
    }
  } finally { await browser.close(); srv.close(); }
  fs.writeFileSync(path.join(OUT, 'render-log.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.error).length;
  console.log(`Done: ${results.length - failed} rendered, ${failed} failed. Log: ${path.join(OUT, 'render-log.json')}`);
})().catch((e) => { console.error(e); process.exit(1); });
