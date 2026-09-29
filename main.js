(() => {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const sda = root.classList.contains('sda');
  const hasIO = 'IntersectionObserver' in window;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2); // matches --e-inout closely
  // one duration scale, mirrored from the CSS variables
  const T = { t3: 560, t4: 900, t5: 1400 };

  /* ---------------- 1. Header + menu ---------------- */
  const hdr = $('#hdr');
  const menuBtn = $('.menu-btn');
  const label = $('.menu-label');
  const setMenu = (open) => {
    hdr.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    label.textContent = open ? 'Chiudi' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
    // keep keyboard focus inside the open menu
    $$('main, footer, .skip').forEach((el) => { el.inert = open; });
    if (open) $('#nav a').focus({ preventScroll: true });
  };
  menuBtn.addEventListener('click', () => setMenu(!hdr.classList.contains('is-open')));
  $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hdr.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', () => setMenu(false));

  /* ---------------- Reveal vocabulary ---------------- */
  const onView = (els, fn, opts = { threshold: 0.2, rootMargin: '0px 0px -6% 0px' }) => {
    if (!hasIO) { els.forEach(fn); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { io.unobserve(en.target); fn(en.target); }
    }), opts);
    els.forEach((el) => io.observe(el));
  };
  const reveals = $$('[data-reveal]');
  if (motion) onView(reveals, (el) => el.classList.add('is-in'));
  else reveals.forEach((el) => el.classList.add('is-in'));

  /* ---------------- The scan figure (signature) ---------------- */
  // Keep line weight and label size constant on screen, whatever size the drawing is shown at.
  const sizeFigs = () => $$('.scanfig').forEach((fig) => {
    const vb = fig.querySelector('svg').viewBox.baseVal, w = fig.clientWidth, h = fig.clientHeight;
    if (!w || !vb.width) return;
    const k = fig.classList.contains('ba') ? Math.max(w / vb.width, h / vb.height) : w / vb.width;
    fig.style.setProperty('--sw', (1.05 / k).toFixed(3));
    fig.style.setProperty('--cs', clamp(0.95 / k, 0.5, 1.35).toFixed(3));
  });
  sizeFigs();
  const setP = (fig, p) => fig.style.setProperty('--p', p.toFixed(2));
  const tagOf = (fig) => $('.scan-tag', fig);

  // Prepare line tracing: dash length in px from the real path length.
  const prepare = (fig) => {
    if (!motion || fig.classList.contains('is-ready')) return;
    const shapes = $$('.trace :is(path, circle, ellipse)', fig).filter((el) => !el.classList.contains('pc'));
    const n = shapes.length;
    shapes.forEach((el, i) => {
      const len = Math.ceil(el.getTotalLength()) + 1;
      el.classList.add('s');
      el.style.setProperty('--len', len + 'px');
      el.style.setProperty('--dl', Math.round((i / n) * 520) + 'ms');
    });
    fig.classList.add('is-ready');
  };

  // Move the scanner from -> to. Resolves when done. Cancels a running scan on the same figure.
  const scan = (fig, from, to, dur, done) => {
    cancelAnimationFrame(fig._raf);
    const tag = tagOf(fig), auto = fig.dataset.scan === 'auto';
    if (!motion) { setP(fig, to); if (auto) tag.textContent = '✓ Pulito'; done && done(); return; }
    fig.classList.add('is-scanning');
    let t0;
    const tick = (t) => {
      t0 = t0 || t;
      const k = clamp((t - t0) / dur, 0, 1), p = from + (to - from) * inOut(k);
      setP(fig, p);
      tag.textContent = auto ? (k < 1 ? `Scansione ${Math.round(p)}%` : '✓ Pulito') : `Pulito ${Math.round(p)}%`;
      if (k < 1) fig._raf = requestAnimationFrame(tick);
      else { fig.classList.remove('is-scanning'); done && done(); }
    };
    fig._raf = requestAnimationFrame(tick);
  };

  // Choreography: trace the lines, let the dirt appear, then scan it away.
  const play = (fig, delay = 0) => {
    prepare(fig);
    if (!motion) return;
    setTimeout(() => {
      fig.classList.add('is-drawn');
      setTimeout(() => scan(fig, 0, 100, T.t5), T.t5 + 300);
    }, delay);
  };

  // hero plays on load, the others when they come into view
  const heroFig = $('.hero .scanfig');
  $$('.scanfig').forEach(prepare);
  if (motion) play(heroFig, 250);

  /* ---------------- 3. Services: tabs + sheets ---------------- */
  const sheets = $('[data-tabs]');
  const tabs = $$('[role="tab"]', sheets);
  const panels = $$('[role="tabpanel"]', sheets);
  let sheetsSeen = false;
  sheets.classList.add('is-tabs');
  $('.sheet-tabs', sheets).hidden = false;
  const select = (i, focus) => {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
    const fig = $('.scanfig', panels[i]);
    sizeFigs();
    if (!sheetsSeen || !motion) { if (!motion) setP(fig, 100); return; }
    if (!fig.classList.contains('is-drawn')) { play(fig, 0); return; }
    setP(fig, 0);
    scan(fig, 0, 100, T.t4);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (k) { e.preventDefault(); select((i + k + tabs.length) % tabs.length, true); }
      if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  select(0);
  if (motion) onView([sheets], () => { sheetsSeen = true; play($('.scanfig', panels.find((p) => !p.hidden)), 0); }, { threshold: 0.25 });

  /* ---------------- 4. Before / after: the scanner under your finger ---------------- */
  const ba = $('#ba');
  const range = $('.ba-range', ba);
  const baTag = tagOf(ba);
  let touched = false, dragging = false;
  const setBA = (v) => { v = clamp(v, 0, 100); setP(ba, v); range.value = Math.round(v); baTag.textContent = `Pulito ${Math.round(v)}%`; };
  const fromPointer = (e) => { const r = ba.getBoundingClientRect(); setBA((e.clientX - r.left) / r.width * 100); };
  ba.addEventListener('pointerdown', (e) => {
    touched = dragging = true;
    cancelAnimationFrame(ba._raf);
    ba.classList.remove('is-scanning');
    try { ba.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events have no active pointer */ }
    ba.classList.add('is-drag');
    fromPointer(e);
  });
  ba.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
  const stop = () => { dragging = false; ba.classList.remove('is-drag'); };
  ba.addEventListener('pointerup', stop);
  ba.addEventListener('pointercancel', stop);
  range.addEventListener('input', () => { touched = true; cancelAnimationFrame(ba._raf); setBA(+range.value); });
  if (motion) {
    setP(ba, 0);
    onView([ba], () => {
      ba.classList.add('is-drawn');
      setTimeout(() => { if (!touched) scan(ba, 0, 62, T.t5, () => { range.value = 62; }); }, T.t5 + 200);
    }, { threshold: 0.35 });
  }

  /* ---------------- 5. Method chain (CSS scroll-driven, JS fallback) ---------------- */
  const chain = $('#chain');
  const track = $('.chain-track', chain);
  const fill = $('.chain-fill', chain);
  const head = $('.chain-head', chain);
  const marks = $$('.ph-mark', chain);
  const phases = $$('.phase', chain);
  const layoutChain = () => {
    const a = marks[0].getBoundingClientRect(), b = marks[marks.length - 1].getBoundingClientRect();
    track.style.setProperty('--track', (b.top - a.top) + 'px');
  };
  // Fallback when CSS scroll-driven animations are missing:
  // IntersectionObserver switches the phase marks and wakes the fill only while the chain is on screen.
  let chainVisible = false;
  const updateChain = () => {
    if (!motion || sda || !chainVisible) return;
    const r = track.getBoundingClientRect();
    const p = clamp((innerHeight * 0.6 - r.top) / Math.max(r.height, 1), 0, 1);
    fill.style.transform = `scaleY(${p})`;
    head.style.transform = `translateY(${p * 100}%)`;
  };
  if (motion && !sda && hasIO) {
    new IntersectionObserver(([en]) => { chainVisible = en.isIntersecting; updateChain(); }).observe(chain);
    const mio = new IntersectionObserver((entries) => entries.forEach((en) => {
      const i = marks.indexOf(en.target);
      phases[i].classList.toggle('is-on', en.boundingClientRect.top + en.boundingClientRect.height / 2 < en.rootBounds.bottom);
    }), { rootMargin: '0px 0px -40% 0px', threshold: [0, 0.5, 1] });
    marks.forEach((m) => mio.observe(m));
  } else if (motion && !sda) {
    phases.forEach((ph) => ph.classList.add('is-on'));
  }

  /* ---------------- Header scan progress fallback ---------------- */
  const bar = $('.hdr-scan');
  const updateBar = () => {
    if (!motion || sda) return;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max, 0, 1) : 0})`;
  };

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; updateChain(); updateBar(); });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { sizeFigs(); layoutChain(); onScroll(); });
  layoutChain();
  onScroll();
  if (document.fonts) document.fonts.ready.then(() => { layoutChain(); onScroll(); });

  /* ---------------- 6. Counters on the dimension lines ---------------- */
  const counters = $$('[data-count]');
  if (motion) {
    counters.forEach((el) => { el.textContent = '0'; });
    onView(counters, (el) => {
      const end = +el.dataset.count;
      let t0;
      const tick = (t) => {
        t0 = t0 || t;
        const k = clamp((t - t0) / T.t5, 0, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 250);
    }, { threshold: 0.6 });
  }

  /* ---------------- 8. Demo form: never sends anything ---------------- */
  const form = $('#form');
  const done = $('#form-done');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.reset();
    done.hidden = false;
    done.classList.remove('is-show');
    void done.offsetWidth; // restart the stamp animation
    done.classList.add('is-show');
    $('#form-reset').focus();
  });
  $('#form-reset').addEventListener('click', () => {
    done.hidden = true;
    done.classList.remove('is-show');
    $('#f-name').focus();
  });

  // placeholder policy links: stay on the page
  $$('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
})();
