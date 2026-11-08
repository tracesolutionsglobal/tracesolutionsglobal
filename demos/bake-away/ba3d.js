/* Bake Away v2: smooth scroll, the how-it's-made story, 3D gâteau ring, tilt and reveals. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ss = t => t * t * (3 - 2 * t);
  document.documentElement.classList.add('ba-js');

  /* ---- Lenis smooth scroll driven by GSAP's ticker ---- */
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  let lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ anchors: { offset: -70 }, lerp: 0.11 }); window.__lenis = lenis;
    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    } else { const f = t => { lenis.raf(t); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    $$('dialog, #menu, .track').forEach(el => el.setAttribute('data-lenis-prevent', ''));
    const dlg = $('#menuDlg');
    dlg && new MutationObserver(() => dlg.open ? lenis.stop() : lenis.start()).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  }

  /* ---- headings rise word by word ---- */
  const splitWords = el => {
    let n = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--w', n++); wi.textContent = part;
          w.append(wi); frag.append(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.classList.contains('w')) {
        if (getComputedStyle(c).display.includes('inline-block')) { const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true'); const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--w', n++); c.replaceWith(w); wi.append(c); w.append(wi); }
        else walk(c);
      }
    });
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
  };
  const heads = $$('.h2, .hero h1');
  heads.forEach(h => { h.classList.add('split'); splitWords(h); });

  /* ---- 3D reveals for cards and blocks ---- */
  const r3 = $$('.s3, .menu-card, .cake-hero, .g-card, .recipe, .story-points > div, .hours, .wa-card, .order-form, .poster');
  r3.forEach((el, i) => { el.classList.add('r3'); el.style.transitionDelay = `${(i % 3) * 90}ms`; });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
    [...heads, ...r3].forEach(el => io.observe(el));
    // the hero title is on screen at load
    const h1 = $('.hero h1'); h1 && setTimeout(() => h1.classList.add('in'), 150);
  } else [...heads, ...r3].forEach(el => el.classList.add('in'));
  // gallery cards are rendered by the main script; make sure late ones still reveal
  setTimeout(() => $$('.g-card:not(.r3)').forEach(el => el.classList.add('r3', 'in')), 1200);

  /* ---- how it's made: hold → transition → hold, per scroll segment ---- */
  $$('.bstory').forEach(st => {
    const frames = $$('.bframe', st), caps = $$('.bcap', st), ticks = $$('.bticks li', st), bar = $('.bbar', st);
    const n = frames.length; let last = -1, cur = 0, target = 0, raf = 0;
    const paint = f => {
      frames.forEach((fr, i) => {
        if (!i) { fr.style.setProperty('--s', (fr.hasAttribute('data-zoom') && !reduce ? 1.16 - .16 * ss(clamp(f)) : 1).toFixed(4)); return; }
        const t = ss(clamp((f - (i - 1) - .14) / .72)), tx = fr.dataset.tx;
        if (tx === 'rise' || tx === 'drip') { fr.style.setProperty('--o', clamp(t * 5).toFixed(3)); fr.style.setProperty('--m', t.toFixed(4)); }
        else fr.style.setProperty('--o', t.toFixed(3));
        if (!reduce) fr.style.setProperty('--s', (1.07 - .07 * clamp(f - i + 1, 0, 2) / 2).toFixed(4));
      });
      bar && bar.style.setProperty('--p', (f / (n - 1)).toFixed(4));
      const a = Math.min(n - 1, Math.floor(f + .5));
      if (a !== last) {
        last = a;
        caps.forEach((c, i) => { const on = i === a; c.classList.toggle('on', on); c.inert = !on; });
        ticks.forEach((t, i) => t.classList.toggle('on', i <= a));
      }
    };
    const loop = () => {
      cur += (target - cur) * (reduce ? 1 : .16);
      if (Math.abs(target - cur) < .0005) cur = target;
      paint(cur); raf = cur !== target ? requestAnimationFrame(loop) : 0;
    };
    const measure = () => {
      const r = st.getBoundingClientRect(), span = r.height - innerHeight;
      if (r.bottom < -innerHeight || r.top > innerHeight * 2) return;
      target = (span > 0 ? clamp(-r.top / span) : 0) * (n - 1);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const warm = () => frames.forEach(fr => { const im = $('img', fr); im && im.decode && im.decode().catch(() => {}); });
    'IntersectionObserver' in window ? new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { warm(); o.disconnect(); } }, { rootMargin: '150% 0px' }).observe(st) : warm();
    addEventListener('scroll', measure, { passive: true }); addEventListener('resize', measure);
    measure(); paint(target); cur = target;
  });

  /* ---- tilt with glare ---- */
  const tilt = (el, max = 8) => {
    if (!$('.glare', el) && getComputedStyle(el).overflow === 'hidden') { const g = document.createElement('span'); g.className = 'glare'; g.setAttribute('aria-hidden', 'true'); el.append(g); }
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('tilting');
      el.style.setProperty('--ry', `${((x - .5) * max * 2).toFixed(2)}deg`); el.style.setProperty('--rx', `${((.5 - y) * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`); el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  };
  if (fine && !reduce) {
    const apply = () => $$('.bake:not(.t3d), .g-card:not(.t3d), .recipe:not(.t3d), .s3:not(.t3d), .cake-hero:not(.t3d), .menu-card:not(.t3d)').forEach(el => {
      el.classList.add('t3d'); tilt(el, el.matches('.menu-card, .cake-hero') ? 4 : 8);
      // a 3D-revealed card keeps its reveal until it is in, then tilts
    });
    apply(); setTimeout(apply, 1300);
    $$('.gtilt').forEach(el => tilt(el, 10));

    /* hero photos follow the pointer at different depths */
    const hero = $('.hero'), stage = $('.photo-stage');
    hero && stage && hero.addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      stage.style.setProperty('--hx', `${(x * 18).toFixed(1)}px`); stage.style.setProperty('--hy', `${(y * 14).toFixed(1)}px`);
      stage.style.setProperty('--hry', `${(x * 14).toFixed(2)}deg`); stage.style.setProperty('--hrx', `${(y * -10).toFixed(2)}deg`);
    });
    /* builder preview turns toward the pointer */
    const pv = $('.preview');
    pv && pv.addEventListener('pointermove', e => {
      const r = pv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      pv.style.setProperty('--bry', `${(x * 10).toFixed(2)}deg`); pv.style.setProperty('--brx', `${(y * -8).toFixed(2)}deg`);
    });
    pv && pv.addEventListener('pointerleave', () => { pv.style.setProperty('--bry', '0deg'); pv.style.setProperty('--brx', '0deg'); });
    /* magnetic main buttons */
    $$('.hero .btn, .bcap .btn, .donuts .btn, #sendCake, #submitBtn').forEach(b => {
      b.classList.add('magnet');
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .25).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * .35).toFixed(1)}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---- gâteau ring: scroll, drag, arrows, keyboard ---- */
  $$('.gateaux').forEach(sec => {
    const stage = $('.gring-stage', sec), ring = $('.gring', sec), cards = $$('.gcard', sec), cnt = $('.gcount b', sec);
    const n = cards.length, step = 360 / n;
    let target = 0, cur = 0, scrollOff = 0, dragOff = 0, raf = 0;
    const norm = a => ((a % 360) + 540) % 360 - 180;
    const render = () => {
      cur += (target + scrollOff + dragOff - cur) * (reduce ? 1 : .12);
      ring.style.setProperty('--rot', `${cur.toFixed(2)}deg`);
      let best = 0, bestD = 999;
      cards.forEach((c, i) => {
        const d = Math.abs(norm(i * step + cur));
        if (d < bestD) { bestD = d; best = i; }
        c.style.setProperty('--vis', d > 100 ? 0 : (1 - Math.max(0, d - 45) / 55).toFixed(3));
        c.style.setProperty('--lit', (1 - Math.min(d, 90) / 90 * .5).toFixed(3));
        $('button', c).tabIndex = d > 50 ? -1 : 0;
      });
      cnt && (cnt.textContent = String(best + 1).padStart(2, '0'));
      raf = Math.abs(target + scrollOff + dragOff - cur) > .05 ? requestAnimationFrame(render) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(render); };
    $$('.gbtn', sec).forEach(b => b.addEventListener('click', () => { target -= Number(b.dataset.dir) * step; kick(); }));
    cards.forEach((c, i) => $('button', c).addEventListener('focus', () => { target = -i * step - scrollOff; kick(); }));
    let down = false, x0 = 0, moved = false;
    stage.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; down = true; moved = false; x0 = e.clientX; stage.classList.add('dragging'); });
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 6) moved = true; dragOff = dx * .25; kick(); });
    addEventListener('pointerup', () => { if (!down) return; down = false; stage.classList.remove('dragging'); const total = target + dragOff; dragOff = 0; target = Math.round(total / step) * step; kick(); });
    stage.addEventListener('dragstart', e => e.preventDefault());
    if (!reduce) {
      const onS = () => { const r = sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; scrollOff = -((innerHeight - r.top) / (innerHeight + r.height) - .5) * step * 2.2; kick(); };
      addEventListener('scroll', onS, { passive: true }); onS();
    }
    render();
  });

  /* ---- donut strip speeds up and leans with scroll velocity ---- */
  const strip = $('.strip-track');
  if (strip && lenis && !reduce) {
    let skew = 0;
    lenis.on('scroll', e => {
      skew += (Math.max(-6, Math.min(6, -e.velocity * .3)) - skew) * .25;
      strip.parentElement.style.transform = `skewX(${skew.toFixed(2)}deg)`;
      strip.getAnimations().forEach(a => { a.playbackRate = 1 + Math.min(Math.abs(e.velocity) / 5, 4); });
    });
  }
})();
