(() => {
  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  const waLink = (msg) => `https://wa.me/${S.wa}?text=${encodeURIComponent(msg)}`;

  /* ---------- split headings into words ---------- */
  $$('.split').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${w}</span></span>`).join(' ');
  });

  /* ---------- loader → curtains → 3D intro ---------- */
  const body = document.body;
  const heroH1 = $('.hero h1');
  let opened = false;
  function open() {
    if (opened) return; opened = true;
    body.classList.add('is-open');
    body.classList.remove('is-loading');
    setTimeout(() => heroH1 && heroH1.classList.add('in'), 450);
    document.dispatchEvent(new CustomEvent('hall:intro'));
    setTimeout(() => body.classList.add('is-done'), 1300);
  }
  if (reduce) open();
  else {
    let ready = false, minDone = false;
    const tryOpen = () => { if (ready && minDone) open(); };
    document.addEventListener('hall:ready', () => { ready = true; tryOpen(); }, { once: true });
    setTimeout(() => { minDone = true; tryOpen(); }, 1600);
    setTimeout(open, 4200); // если 3D не загрузилось — всё равно открываем
  }

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
    if (e.target.classList.contains('count')) countUp(e.target);
  }), { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .split:not(.hero h1), .orn, .count').forEach((el) => io.observe(el));
  // ступенчатая задержка в группах
  $$('.facts li, .steps li, .contact-card, .faq details, .menu-cards > *').forEach((el, i, arr) => {
    const sib = [...el.parentNode.children].indexOf(el); el.style.setProperty('--d', sib);
  });

  function countUp(el) {
    const to = +el.dataset.to; const t0 = performance.now(); const dur = reduce ? 1 : 1600;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- header, dock ---------- */
  const top = $('#top-bar'), dock = $('.dock');
  const onScroll = () => {
    const y = scrollY;
    top.classList.toggle('is-solid', y > 40);
    dock && dock.classList.toggle('show', y > innerHeight * 0.6);
    const st = $('#steps-list');
    if (st) { const r = st.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.3))); st.style.setProperty('--prog', p.toFixed(3)); }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- cursor glow + magnetic buttons ---------- */
  if (!reduce && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const g = $('.glow-cursor'); let x = 0, y = 0, gx = 0, gy = 0;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() { gx += (x - gx) * 0.12; gy += (y - gy) * 0.12; g.style.transform = `translate(${gx}px,${gy}px)`; requestAnimationFrame(loop); })();
    $$('.magnet').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- WhatsApp links ---------- */
  $$('.js-wa').forEach((a) => { a.href = waLink(a.dataset.msg || 'Здравствуйте!'); a.target = '_blank'; a.rel = 'noopener'; });

  /* ---------- range fill ---------- */
  const fill = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');

  /* ---------- state ---------- */
  const st = { guests: 200, occasion: (S.occasions || [])[0], tier: 'prem', extras: new Set(['host', 'decor']), date: null };

  /* hero slider ↔ calc slider ↔ 3D */
  const hg = $('#guests'), cg = $('#calc-guests');
  function setGuests(v, from) {
    st.guests = +v;
    [hg, cg].forEach((r) => { if (r && r !== from) r.value = v; r && fill(r); });
    $('#guests-n2').textContent = v;
    $('#tables-n').textContent = Math.ceil(v / 10);
    $('#calc-guests-out').textContent = v;
    document.dispatchEvent(new CustomEvent('hall:guests', { detail: { guests: +v } }));
    calc();
  }
  hg && hg.addEventListener('input', () => setGuests(hg.value, hg));
  cg && cg.addEventListener('input', () => setGuests(cg.value, cg));

  function chipGroup(id, attr, ev) {
    const g = $(id); if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', g).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
      document.dispatchEvent(new CustomEvent(ev, { detail: { value: b.dataset[attr] } }));
    });
  }
  chipGroup('#theme', 'theme', 'hall:theme');
  chipGroup('#light', 'light', 'hall:light');

  /* ---------- calculator ---------- */
  const occ = $('#occasion');
  (S.occasions || []).forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pill' + (i ? '' : ' is-on'); b.textContent = o; b.setAttribute('aria-pressed', !i);
    b.onclick = () => { st.occasion = o; $$('.pill', occ).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); }); };
    occ.appendChild(b);
  });
  const tiers = $('#tiers');
  (S.tiers || []).forEach((t) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tier' + (t.id === st.tier ? ' is-on' : ''); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', t.id === st.tier);
    b.innerHTML = `<b>${t.name}</b><span>${fmt(t.price)} ₸ / гость</span>`;
    b.onclick = () => { st.tier = t.id; $$('.tier', tiers).forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on); }); calc(); };
    tiers.appendChild(b);
  });
  const ex = $('#extras');
  (S.extras || []).forEach((x) => {
    const b = document.createElement('button'); b.type = 'button'; const on = st.extras.has(x.id);
    b.className = 'extra' + (on ? ' is-on' : ''); b.setAttribute('aria-pressed', on);
    b.innerHTML = `<span>${x.name}<small>+${fmt(x.price)} ₸</small></span><i class="sw" aria-hidden="true"></i>`;
    b.onclick = () => { const now = !st.extras.has(x.id); now ? st.extras.add(x.id) : st.extras.delete(x.id); b.classList.toggle('is-on', now); b.setAttribute('aria-pressed', now); calc(); };
    ex.appendChild(b);
  });

  const sumEl = $('#sum'), ppEl = $('#sum-pp'), rows = $('#sum-rows');
  let shown = 0, anim;
  function calc() {
    const t = (S.tiers || []).find((x) => x.id === st.tier) || { price: 0, name: '' };
    const food = t.price * st.guests;
    const extras = (S.extras || []).filter((x) => st.extras.has(x.id));
    const total = food + extras.reduce((a, x) => a + x.price, 0);
    rows.innerHTML = `<div><dt>Меню «${t.name}» × ${st.guests}</dt><dd>${fmt(food)} ₸</dd></div>` + extras.map((x) => `<div><dt>${x.name}</dt><dd>${fmt(x.price)} ₸</dd></div>`).join('');
    ppEl.textContent = fmt(total / st.guests);
    cancelAnimationFrame(anim);
    const from = shown, t0 = performance.now(), dur = reduce ? 1 : 700;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); shown = from + (total - from) * (1 - Math.pow(1 - k, 3)); sumEl.textContent = fmt(shown); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
    const p = sumEl.parentNode; p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump');
    st.total = total;
  }
  $('#calc-send').addEventListener('click', () => {
    const t = (S.tiers || []).find((x) => x.id === st.tier);
    const extras = (S.extras || []).filter((x) => st.extras.has(x.id)).map((x) => x.name).join(', ') || 'нет';
    const msg = `Здравствуйте! Хочу забронировать зал.\nПовод: ${st.occasion}\nДата: ${st.date ? dateRu(st.date) : 'пока не выбрана'}\nГостей: ${st.guests}\nМеню: ${t.name}\nДополнительно: ${extras}\nРасчёт на сайте: ${fmt(st.total)} ₸`;
    window.open(waLink(msg), '_blank', 'noopener');
  });

  /* ---------- calendar ---------- */
  const busy = new Set(S.busy || []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dateRu(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }); }
  const grid = $('#cal-grid');
  function renderCal() {
    $('#cal-title').textContent = view.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    $('#cal-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    const first = (view.getDay() + 6) % 7, days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < first; i++) html += '<span class="day empty"></span>';
    for (let d = 1; d <= days; d++) {
      const dt = new Date(view.getFullYear(), view.getMonth(), d), k = iso(dt);
      const cls = dt < today ? 'past' : busy.has(k) ? 'busy' : 'free';
      const pick = st.date === k ? ' pick' : '';
      const label = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + (cls === 'busy' ? ', занято' : cls === 'free' ? ', свободно' : '');
      html += `<button type="button" class="day ${cls}${pick}" style="--i:${d}" data-d="${k}" aria-label="${label}" ${cls !== 'free' ? 'disabled' : ''}>${d}</button>`;
    }
    grid.innerHTML = html;
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.day.free'); if (!b) return;
    st.date = b.dataset.d;
    $$('.day.pick', grid).forEach((x) => x.classList.remove('pick'));
    b.classList.add('pick');
    $('#sum-date').textContent = dateRu(st.date);
    confetti(b);
  });
  $('#cal-prev').onclick = () => { view.setMonth(view.getMonth() - 1); renderCal(); };
  $('#cal-next').onclick = () => { view.setMonth(view.getMonth() + 1); renderCal(); };
  renderCal();

  function confetti(el) {
    if (reduce) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const cols = ['#F3D58E', '#D9A84A', '#FFFFFF', '#9E2436', '#B9852F'];
    for (let i = 0; i < 34; i++) {
      const p = document.createElement('i'); p.className = 'confetti';
      p.style.background = cols[i % cols.length]; p.style.left = cx + 'px'; p.style.top = cy + 'px';
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 140;
      p.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v - 60}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * v * 1.2}px,${Math.sin(a) * v + 120}px) rotate(${Math.random() * 900}deg)`, opacity: 0 }
      ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }

  /* ---------- menu cards with tilt ---------- */
  const mc = $('#menu-cards');
  (S.tiers || []).forEach((t, i) => {
    const c = document.createElement('article'); c.className = 'mcard reveal' + (i === 1 ? ' hot' : ''); c.style.setProperty('--d', i);
    c.innerHTML = `${i === 1 ? '<span class="tag">Чаще выбирают</span>' : ''}<h3>${t.name}</h3><p class="price"><b>${fmt(t.price)}</b> ₸ за гостя</p><ul>${t.items.map((x) => `<li>${x}</li>`).join('')}</ul><button type="button" class="btn ${i === 1 ? 'btn-gold' : 'btn-line'} btn-full">Выбрать</button>`;
    $('button', c).onclick = () => { $$('.tier', tiers)[i].click(); $('#calc').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    if (!reduce && matchMedia('(hover:hover)').matches) {
      c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; c.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`; });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    }
    mc.appendChild(c); io.observe(c);
  });

  setGuests(200);
})();
