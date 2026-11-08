/* New Mart concept: catalogue, deals, Smart Basket, delivery slots, rewards, basket drawer, 3D + motion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const rs = n => 'Rs ' + Math.round(n).toLocaleString('en-LK');
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- data (sample prices, LKR) ---------- */
  const P = [
    ['bananas', 'Ambul bananas', '1 kg', 380, 420, 'fruit'],
    ['papaya', 'Papaya', 'about 1 kg', 350, 400, 'fruit'],
    ['onions', 'Red onions', '1 kg', 520, 0, 'veg'],
    ['carrots', 'Carrots', '500 g', 290, 340, 'veg'],
    ['chicken', 'Chicken breast fillets', '500 g', 1150, 0, 'meat'],
    ['prawns', 'Fresh prawns', '250 g', 1350, 1550, 'seafood'],
    ['eggs', 'Brown eggs', 'pack of 10', 520, 0, 'dairy'],
    ['milk', 'Fresh milk', '1 L', 640, 0, 'dairy'],
    ['bread', 'Sandwich bread', '450 g', 260, 0, 'bakery'],
    ['rice', 'Red raw rice', '5 kg', 1250, 1400, 'rice'],
    ['dhal', 'Red dhal', '1 kg', 420, 0, 'rice'],
    ['coconut-oil', 'Coconut oil', '1 L', 980, 0, 'pantry'],
    ['sugar', 'White sugar', '1 kg', 290, 0, 'pantry'],
    ['tea', 'Ceylon black tea', '200 g', 590, 650, 'drinks'],
    ['biscuits', 'Cream crackers', '190 g', 240, 270, 'snacks'],
    ['dish-liquid', 'Dishwash liquid', '500 ml', 450, 0, 'household'],
    ['washing-powder', 'Washing powder', '1 kg', 690, 790, 'household'],
    ['soap', 'Bath soap', '100 g', 160, 0, 'care'],
  ].map(([id, n, u, p, was, cat]) => ({ id, n, u, p, was, cat, img: `img/p-${id}.webp` }));
  const byId = Object.fromEntries(P.map(x => [x.id, x]));
  const CATS = [
    ['veg', 'Vegetables', 'cat-veg'], ['fruit', 'Fruit', 'cat-fruit'], ['meat', 'Meat & poultry', 'cat-meat'], ['seafood', 'Seafood', 'cat-seafood'],
    ['dairy', 'Dairy & eggs', 'cat-dairy'], ['bakery', 'Bakery', 'cat-bakery'], ['rice', 'Rice & grains', 'cat-rice'], ['pantry', 'Pantry', 'cat-spices'],
    ['drinks', 'Tea & drinks', 'cat-drinks'], ['snacks', 'Biscuits', 'p-biscuits'], ['household', 'Household', 'p-washing-powder'], ['care', 'Personal care', 'p-soap'],
  ];
  const RECIPES = [
    { id: 'curry', n: 'Chicken curry', s: 'with red rice', items: [['chicken', .25], ['onions', .1], ['coconut-oil', .1], ['rice', .1]] },
    { id: 'prawn', n: 'Prawn curry', s: 'coconut &amp; red rice', items: [['prawns', .5], ['onions', .1], ['coconut-oil', .1], ['rice', .1]] },
    { id: 'dhal', n: 'Dhal &amp; rice', s: 'everyday comfort', items: [['dhal', .15], ['onions', .1], ['coconut-oil', .1], ['rice', .1]] },
    { id: 'breakfast', n: 'Breakfast', s: 'eggs, toast &amp; tea', items: [['eggs', .25], ['bread', .25], ['milk', .25], ['bananas', .25], ['tea', .1], ['sugar', .1]] },
  ];
  const STORES = [
    ['Colombo 05', 'Havelock Road, Colombo 05', '011 000 0001'],
    ['Kandy', 'Peradeniya Road, Kandy', '081 000 0002'],
    ['Galle', 'Wakwella Road, Galle', '091 000 0003'],
  ];

  /* ---------- basket state ---------- */
  const cart = new Map();
  let slot = null, store = 'Colombo 05';
  const subtotal = () => [...cart].reduce((a, [id, q]) => a + byId[id].p * q, 0);
  const count = () => [...cart.values()].reduce((a, q) => a + q, 0);
  const delivery = () => (subtotal() >= 5000 || !cart.size) ? 0 : 300;
  const toastEl = $('#toast'); let tt;
  const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2400); };

  const ctrl = id => {
    const q = cart.get(id) || 0;
    return q ? `<span class="qty"><button type="button" data-dec="${id}" aria-label="One less ${esc(byId[id].n)}">−</button><b>${q}</b><button type="button" data-inc="${id}" aria-label="One more ${esc(byId[id].n)}">+</button></span>`
             : `<button class="add" type="button" data-inc="${id}" aria-label="Add ${esc(byId[id].n)} to basket">+ Add</button>`;
  };
  const card = x => `<article class="pc" data-id="${x.id}" data-cat="${x.cat}" data-name="${esc(x.n.toLowerCase())}">
    <div class="pc-img">${x.was ? `<span class="off">−${Math.round((1 - x.p / x.was) * 100)}%</span>` : ''}<img src="${x.img}" alt="${esc(x.n)}" width="360" height="360" loading="lazy" decoding="async"></div>
    <h3>${esc(x.n)}</h3><span class="unit">${x.u}</span>
    <div class="pc-row"><span class="price"><b>${rs(x.p)}</b>${x.was ? `<s>${rs(x.was)}</s>` : ''}</span><span class="pc-ctrl" data-for="${x.id}">${ctrl(x.id)}</span></div>
  </article>`;

  const sync = () => {
    $$('.pc-ctrl').forEach(el => { el.innerHTML = ctrl(el.dataset.for); });
    const st = subtotal();
    $('#cartN').textContent = count(); $('#cartT').textContent = rs(st);
    // drawer
    $('#drItems').innerHTML = cart.size ? [...cart].map(([id, q]) => { const x = byId[id]; return `<li><img src="${x.img}" alt=""><div><b>${esc(x.n)}</b><small>${x.u} · ${rs(x.p)}</small></div><span class="pc-ctrl" data-for="${id}">${ctrl(id)}</span></li>`; }).join('')
      : '<li class="empty-b">Your basket is empty. Add something fresh!</li>';
    $('#dSub').textContent = rs(st); $('#dDel').textContent = cart.size ? (delivery() ? rs(delivery()) : 'Free') : '—';
    $('#dSlot').textContent = slot || 'Not chosen'; $('#dPts').textContent = Math.floor(st / 100); $('#dTot').textContent = rs(st + delivery());
    // rewards
    const pts = Math.floor(st / 100);
    countUp($('#pts'), pts);
    $('#rFg').style.setProperty('--fill', Math.min(100, pts / 500 * 100).toFixed(1));
    $('#rwLine').textContent = pts >= 500 ? 'This basket unlocks a Rs 500 voucher!' : `${500 - pts} more points to a Rs 500 voucher.`;
    $('#slotNote').textContent = st >= 5000 ? 'Free delivery on this basket.' : cart.size ? `Delivery Rs 300 · add ${rs(5000 - st)} more for free delivery` : 'Delivery Rs 300 · free on baskets over Rs 5,000';
  };
  const countUp = (el, v) => {
    const from = +el.dataset.v || 0; el.dataset.v = v;
    if (reduce || from === v) { el.textContent = v; return; }
    const t0 = performance.now();
    const f = now => { const k = Math.min(1, (now - t0) / 600), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (v - from) * e); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  const fly = (fromEl, img) => {
    if (reduce || !fromEl) return;
    const a = fromEl.getBoundingClientRect(), b = $('#cartBtn').getBoundingClientRect();
    const f = document.createElement('img'); f.className = 'fly'; f.src = img; f.alt = '';
    f.style.left = `${a.left + a.width / 2 - 32}px`; f.style.top = `${a.top + a.height / 2 - 32}px`; document.body.append(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * .5}px, ${dy * .5 - 120}px) scale(.8)`, opacity: 1, offset: .55 }, { transform: `translate(${dx}px, ${dy}px) scale(.25)`, opacity: .4 }],
      { duration: 800, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { f.remove(); const c = $('#cartBtn'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); };
  };
  const addQ = (id, q = 1, srcEl) => {
    cart.set(id, (cart.get(id) || 0) + q); if (cart.get(id) <= 0) cart.delete(id);
    if (q > 0) fly(srcEl, byId[id].img);
    sync();
  };
  document.addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) { const id = inc.dataset.inc; const was = cart.get(id) || 0; addQ(id, 1, inc.closest('.pc')?.querySelector('.pc-img img') || inc); if (!was) toast(`${byId[id].n} added to your basket`); }
    if (dec) addQ(dec.dataset.dec, -1);
  });

  /* ---------- deals + catalogue ---------- */
  $('#dealTrack').innerHTML = P.filter(x => x.was).map(card).join('');
  $('#pGrid').innerHTML = P.map(card).join('') + '<p class="empty" id="empty" hidden>No matches. Try “rice”, “milk” or “prawns”.</p>';
  $('#catGrid').innerHTML = CATS.map(([id, n, img]) => `<button type="button" class="cat" data-cat="${id}" aria-pressed="false"><img src="img/${img}.webp" alt="" width="360" height="360" loading="lazy">${n}</button>`).join('');
  let filter = null, query = '';
  const applyFilter = () => {
    let n = 0;
    $$('#pGrid .pc').forEach(c => { const ok = (!filter || c.dataset.cat === filter) && (!query || c.dataset.name.includes(query)); c.classList.toggle('hide', !ok); if (ok) n++; });
    $('#empty').hidden = n > 0;
    $$('.cat').forEach(c => c.setAttribute('aria-pressed', c.dataset.cat === filter));
    const cn = filter ? CATS.find(c => c[0] === filter)[1] : null;
    $('#count').textContent = `${n} product${n === 1 ? '' : 's'}` + (cn ? ` in ${cn}` : '') + (query ? ` matching “${query}”` : '');
    $('#clearFilter').hidden = !filter && !query;
  };
  $('#catGrid').addEventListener('click', e => { const c = e.target.closest('.cat'); if (!c) return; filter = filter === c.dataset.cat ? null : c.dataset.cat; applyFilter(); });
  $('#clearFilter').addEventListener('click', () => { filter = null; query = ''; $('#q').value = ''; applyFilter(); });
  const q = $('#q');
  q.addEventListener('input', () => { query = q.value.trim().toLowerCase(); filter = null; applyFilter(); });
  $('#search').addEventListener('submit', e => { e.preventDefault(); const t = $('#aisles'); lenis ? lenis.scrollTo(t, { offset: -70 }) : t.scrollIntoView({ behavior: 'smooth' }); });
  applyFilter();

  /* ---------- deals countdown (ends Sunday 23:59) ---------- */
  const cd = $('#cd');
  const tick = () => {
    const now = new Date(), end = new Date(now); end.setDate(now.getDate() + ((7 - now.getDay()) % 7)); end.setHours(23, 59, 59, 0);
    let s = Math.max(0, (end - now) / 1000 | 0); const d = s / 86400 | 0; s %= 86400; const h = s / 3600 | 0; s %= 3600; const m = s / 60 | 0; s %= 60;
    cd.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };
  tick(); setInterval(tick, 1000);

  /* ---------- Smart Basket ---------- */
  let recipe = RECIPES[0], serves = 4;
  $('#recipes').innerHTML = RECIPES.map((r, i) => `<button type="button" class="rc" role="tab" data-r="${r.id}" aria-selected="${!i}"><b>${r.n}</b><small>${r.s}</small></button>`).join('');
  const recipeItems = () => recipe.items.map(([id, per]) => [id, Math.max(1, Math.ceil(per * serves))]);
  const drawRecipe = () => {
    const items = recipeItems();
    $('#scList').innerHTML = items.map(([id, qn], k) => { const x = byId[id]; return `<li style="--k:${k}"><img src="${x.img}" alt=""><div><b>${esc(x.n)}</b><small>${qn} × ${x.u}</small></div><span class="lp">${rs(x.p * qn)}</span></li>`; }).join('');
    countUpRs($('#scTotal'), items.reduce((a, [id, qn]) => a + byId[id].p * qn, 0));
    $('#serves').textContent = serves;
  };
  const countUpRs = (el, v) => {
    const from = +el.dataset.v || 0; el.dataset.v = v;
    if (reduce) { el.textContent = rs(v); return; }
    const t0 = performance.now();
    const f = now => { const k = Math.min(1, (now - t0) / 500), e = 1 - Math.pow(1 - k, 3); el.textContent = rs(from + (v - from) * e); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  $('#recipes').addEventListener('click', e => { const b = e.target.closest('.rc'); if (!b) return; recipe = RECIPES.find(r => r.id === b.dataset.r); $$('.rc').forEach(x => x.setAttribute('aria-selected', x === b)); drawRecipe(); });
  $('#servesDown').addEventListener('click', () => { serves = Math.max(1, serves - 1); drawRecipe(); });
  $('#servesUp').addEventListener('click', () => { serves = Math.min(12, serves + 1); drawRecipe(); });
  $('#scAdd').addEventListener('click', () => {
    const imgs = $$('#scList img');
    recipeItems().forEach(([id, qn], k) => setTimeout(() => addQ(id, qn, imgs[k]), k * 140));
    toast(`${recipe.n.replace('&amp;', '&')} for ${serves}: ${recipeItems().length} items added`);
  });
  drawRecipe();

  /* ---------- delivery slots ---------- */
  const SL = [[8, 10], [12, 14], [16, 18], [19, 21]];
  const fmt = h => `${((h + 11) % 12) + 1}${h < 12 ? ' am' : ' pm'}`;
  const days = [0, 1, 2].map(o => { const d = new Date(); d.setDate(d.getDate() + o); return d; });
  let day = 0;
  $('#days').innerHTML = days.map((d, i) => `<button type="button" class="day" role="tab" data-d="${i}" aria-selected="${!i}">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'long' })}<small>${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></button>`).join('');
  const drawSlots = () => {
    const now = new Date();
    $('#slots').innerHTML = SL.map(([a, b]) => {
      const past = day === 0 && now.getHours() >= a - 1;
      const label = `${days[day].toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmt(a)}–${fmt(b)}`;
      return `<button type="button" class="slot" data-label="${label}" aria-pressed="${slot === label}" ${past ? 'disabled' : ''}>${fmt(a)} – ${fmt(b)}<small>${past ? 'Closed' : (a === 19 ? 'Evening' : a < 12 ? 'Morning' : 'Afternoon')}</small></button>`;
    }).join('');
  };
  $('#days').addEventListener('click', e => { const b = e.target.closest('.day'); if (!b) return; day = +b.dataset.d; $$('.day').forEach(x => x.setAttribute('aria-selected', x === b)); drawSlots(); });
  $('#slots').addEventListener('click', e => { const b = e.target.closest('.slot'); if (!b || b.disabled) return; slot = b.dataset.label; drawSlots(); sync(); toast(`Delivery booked for ${slot} (${store})`); });
  drawSlots();
  const nextSlot = () => {
    const now = new Date(), s = SL.find(([a]) => now.getHours() < a - 1);
    $('#nextSlot').textContent = `Next delivery slot (${store}): ` + (s ? `today ${fmt(s[0])}–${fmt(s[1])}` : `tomorrow ${fmt(SL[0][0])}–${fmt(SL[0][1])}`);
  };
  $$('.sp').forEach(b => b.addEventListener('click', () => { store = b.dataset.store; $$('.sp').forEach(x => x.classList.toggle('on', x === b)); nextSlot(); toast(`Showing prices and delivery for ${store}`); }));
  nextSlot();

  /* ---------- stores ---------- */
  $('#storeGrid').innerHTML = STORES.map(([n, a, t]) => `<article class="store"><span class="open">Open today · 7 am – 10 pm</span><h3>${n}</h3><p>${a}</p><p>${t} (sample)</p></article>`).join('');

  /* ---------- drawer ---------- */
  const dr = $('#drawer');
  const openDr = () => { dr.hidden = false; requestAnimationFrame(() => dr.classList.add('open')); lenis && lenis.stop(); setTimeout(() => $('.x', dr).focus(), 50); };
  const closeDr = () => { dr.classList.remove('open'); lenis && lenis.start(); setTimeout(() => { dr.hidden = true; }, 450); $('#cartBtn').focus(); };
  $('#cartBtn').addEventListener('click', openDr);
  dr.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDr(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !dr.hidden) closeDr(); });
  $('#checkout').addEventListener('click', () => {
    if (!cart.size) { toast('Your basket is empty'); return; }
    if (!slot) { closeDr(); toast('Pick a delivery slot first'); const t = $('#rewards'); setTimeout(() => lenis ? lenis.scrollTo(t, { offset: -80 }) : t.scrollIntoView(), 300); return; }
    toast(`Demo order: ${count()} items, ${rs(subtotal() + delivery())}, ${slot}. Checkout is not live in this concept.`);
  });
  sync();

  /* ---------- motion: Lenis + GSAP, split headings, 3D reveals, tilt, magnets ---------- */
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var lenis = null;
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ anchors: { offset: -70 }, lerp: 0.11 }); window.__lenis = lenis;
    if (hasGsap) { gsap.registerPlugin(ScrollTrigger); lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { const f = t => { lenis.raf(t); requestAnimationFrame(f); }; requestAnimationFrame(f); }
    $$('.deal-track').forEach(el => el.setAttribute('data-lenis-prevent-wheel', ''));
  }
  const splitWords = el => {
    let n = 0;
    const walk = node => [...node.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return; if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--w', n++); wi.textContent = part; w.append(wi); frag.append(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1) walk(c);
    });
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); walk(el);
  };
  const splits = $$('.split'); splits.forEach(splitWords);
  const r3 = $$('.pc, .cat, .store, .slots-card, .rewards-card, .smart-card, .rc');
  r3.forEach((el, i) => { el.classList.add('r3'); el.style.transitionDelay = `${(i % 4) * 70}ms`; });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    [...splits, ...r3].forEach(el => io.observe(el));
  } else [...splits, ...r3].forEach(el => el.classList.add('in'));
  // product cards get their delay cleared after reveal so tilt stays snappy
  setTimeout(() => r3.forEach(el => { el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true }); }), 50);

  if (fine && !reduce) {
    const tilt = (el, max) => {
      if (!$('.glare', el)) { const g = document.createElement('span'); g.className = 'glare'; g.setAttribute('aria-hidden', 'true'); el.append(g); }
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--ry', `${((x - .5) * max * 2).toFixed(2)}deg`); el.style.setProperty('--rx', `${((.5 - y) * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`); el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    };
    $$('.pc').forEach(el => tilt(el, 8)); $$('.cat').forEach(el => tilt(el, 10)); $$('.store').forEach(el => tilt(el, 5));
    const hero = $('.hero'), bk = $('.hero-basket');
    hero.addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      bk.style.setProperty('--bx', `${(x * 22).toFixed(1)}px`); bk.style.setProperty('--by', `${(y * 16).toFixed(1)}px`);
      bk.style.setProperty('--bry', `${(x * 16).toFixed(2)}deg`); bk.style.setProperty('--brx', `${(y * -12).toFixed(2)}deg`);
    });
    const sc = $('#smartCard');
    sc.addEventListener('pointermove', e => { const r = sc.getBoundingClientRect(); sc.style.setProperty('--sry', `${(((e.clientX - r.left) / r.width - .5) * 8).toFixed(2)}deg`); sc.style.setProperty('--srx', `${(((e.clientY - r.top) / r.height - .5) * -6).toFixed(2)}deg`); });
    sc.addEventListener('pointerleave', () => { sc.style.setProperty('--sry', '0deg'); sc.style.setProperty('--srx', '0deg'); });
    $$('.magnet').forEach(b => {
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .25).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * .35).toFixed(1)}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }
  // hero photo eases out as you scroll; marquee speeds up with scroll velocity
  if (!reduce) {
    const hi = $('.hero-bg img'), hero = $('.hero');
    const onS = () => { const r = hero.getBoundingClientRect(); if (r.bottom < 0) return; hi.style.setProperty('--hz', (1.06 + Math.min(1, -r.top / r.height) * .1).toFixed(4)); };
    addEventListener('scroll', onS, { passive: true }); onS();
    const mq = $('.mq');
    if (lenis && mq) lenis.on('scroll', e => mq.getAnimations().forEach(a => { a.playbackRate = 1 + Math.min(Math.abs(e.velocity) / 4, 5); }));
  }
})();
