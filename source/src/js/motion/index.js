// The scroll-driven motion (MOTION.md). Loaded after first paint as assets/js/motion.js.
// Tiers: full, lite (no ripples, lean, pins or parallax), still (reduced motion: the thread is drawn complete and still).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { D, E, STAGGER } from './tokens.js';
import { revealAll } from './reveal-all.js';
// The page-long thread (thread.js) was removed at the owner's request; its smaller roles remain.

gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const main = $('#main');
const tier = html.dataset.motion || 'full';
const still = tier === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = tier === 'lite';
const isMobile = () => matchMedia('(max-width: 1023.98px)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const page = document.body.dataset.page;

function ready(fn) {
  if (html.classList.contains('motion-entered') || !html.classList.contains('pl-on')) fn();
  else document.addEventListener('btc:revealed', fn, { once: true });
}

// ------------------------------------------------------------------ smooth scrolling (desktop with a mouse only)
let lenis = null;
if (!still && !lite && fine && !isMobile()) {
  lenis = new Lenis({ lerp: 0.14, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: { offset: -((parseFloat(getComputedStyle(html).scrollPaddingTop) || 90)) } });
  lenis.on('scroll', ScrollTrigger.update);
  html.classList.add('lenis');
  // the menu and modal viewers lock the page; Lenis pauses with them
  new MutationObserver(() => { document.body.classList.contains('menu-open') || document.body.style.position === 'fixed' ? lenis.stop() : lenis.start(); })
    .observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
}

// ------------------------------------------------------------------ section colour: dark and red blocks widen to full bleed
function bleeds() {
  $$('.section--night, .cta-band, .foot-cta', main).forEach((s) => {
    s.classList.add('bleed');
    if (still || lite) return;
    gsap.fromTo(s, { '--bleed-s': isMobile() ? 0.94 : 0.9, '--bleed-r': '32px' }, {
      '--bleed-s': 1, '--bleed-r': '0px', ease: 'none',
      scrollTrigger: { trigger: s, start: 'top bottom', end: 'top 35%', scrub: true },
    });
  });
}

// ------------------------------------------------------------------ pinned chapters (desktop, full tier)
function chapters() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (hover: hover) and (pointer: fine)', () => {
    if (still || lite) return;
    const cleanups = [];
    // The loan process: pin, and let the thread run through the four step numbers, lighting each.
    $$('.steps', main).forEach((steps) => {
      const section = steps.closest('section');
      const items = $$('.step', steps);
      if (!section || items.length < 2) return;
      section.dataset.pinned = 'true';
      section.classList.add('is-pinnable');
      const host = steps;
      host.classList.add('is-scrub');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'steps-thread'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.append(path);
      steps.parentElement.classList.add('steps-host');
      steps.parentElement.insertBefore(svg, steps);
      const draw = () => {
        const hr = steps.parentElement.getBoundingClientRect();
        const pts = $$('.step__n', steps).map((n) => { const r = n.getBoundingClientRect(); return [r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2]; });
        const [x0, y0] = pts[0];
        let d = `M${-hr.left - 10} ${y0 + 30}C${x0 - 80} ${y0 + 30} ${x0 - 40} ${y0} ${x0} ${y0}`;
        for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1]; const [x, y] = pts[i]; const mx = (a + x) / 2; d += `C${mx} ${b - 26} ${mx} ${y + 26} ${x} ${y}`; }
        const [lx, ly] = pts[pts.length - 1];
        d += `C${lx + 60} ${ly} ${lx + 80} ${ly + 40} ${innerWidth - hr.left + 10} ${ly + 40}`;
        path.setAttribute('d', d);
        const L = path.getTotalLength();
        path.style.strokeDasharray = `${L} ${L}`;
        return { L, pts, x0: -hr.left - 10, x1: innerWidth - hr.left + 10 };
      };
      let geo = draw();
      path.style.strokeDashoffset = String(geo.L);
      const st = ScrollTrigger.create({
        trigger: section, start: 'top top', end: () => '+=' + Math.round(innerHeight * 1.1), pin: true, pinSpacing: true, scrub: 0.6,
        onRefresh: () => { geo = draw(); },
        onUpdate: (self) => {
          const p = self.progress;
          path.style.strokeDashoffset = String(geo.L * (1 - p));
          items.forEach((it, i) => it.classList.toggle('is-lit', p >= (i + .35) / (items.length + .5)));
        },
        onLeave: () => items.forEach((it) => it.classList.add('is-lit')),
      });
      cleanups.push(() => { st.kill(); svg.remove(); host.classList.remove('is-scrub'); items.forEach((it) => it.classList.remove('is-lit')); delete section.dataset.pinned; });
    });
    // Products: a horizontal reel that slides past while the thread runs beneath it, snapping to whole cards.
    $$('[data-reel]', main).forEach((track) => {
      const section = track.closest('section');
      const cards = [...track.children];
      if (!section || cards.length < 2) return;
      section.dataset.pinned = 'true';
      const wrap = track.parentElement;
      wrap.classList.add('reel-on'); track.classList.add('reel');
      const rail = document.createElement('div'); rail.className = 'reel__rail'; rail.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('div'); fill.className = 'reel__fill'; rail.append(fill);
      track.after(rail);
      const dist = () => Math.max(0, track.scrollWidth - wrap.clientWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true,
          snap: { snapTo: 1 / (cards.length - 1), duration: { min: .2, max: .5 }, ease: E.out },
          onUpdate: (self) => { fill.style.transform = `scaleX(${self.progress})`; },
        },
      });
      // keyboard: focusing a card scrolls the page to the point where that card is in view
      const onFocus = (e) => {
        const i = cards.findIndex((c) => c.contains(e.target));
        const st = tween.scrollTrigger;
        if (i < 0 || !st) return;
        const y = st.start + (st.end - st.start) * (i / (cards.length - 1));
        lenis ? lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
      };
      track.addEventListener('focusin', onFocus);
      cleanups.push(() => { tween.scrollTrigger?.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); rail.remove(); wrap.classList.remove('reel-on'); track.classList.remove('reel'); track.removeEventListener('focusin', onFocus); delete section.dataset.pinned; });
    });
    return () => cleanups.forEach((f) => f());
  });
  return mm;
}

// ------------------------------------------------------------------ entrances: one per section, neighbours differ
function entrances() {
  if (still) return;
  const sections = [...main.children].filter((s) => s.matches('section, .section') && !s.matches('.hero, .page-head, .nf'));
  let prev = '';
  const kinds = ['rise', 'deal', 'scale'];
  sections.forEach((s) => {
    let kind = s.classList.contains('bleed') ? 'ink'
      : $(':scope > .container > .ph, :scope > .container > figure > .ph', s) && !$('.section-head', s) ? 'mask'
      : $('.cards, .cs, .portraits, .people, .org, .group-list, .photo-pair, .gallery, .next-links, .contact-list', s) ? 'deal'
      : $('.calc, .licence-strip, .two-up, .licence, .anatomy', s) ? 'scale' : 'rise';
    if (kind === prev) kind = kinds.find((k) => k !== prev) || 'rise';
    prev = kind;
    s.dataset.enter = kind;
    if (s.getBoundingClientRect().top < innerHeight * .9) return; // already on screen: leave it be
    const head = $$('.section-head > *', s);
    const trig = { trigger: s, start: 'top 82%', once: true };
    const tl = gsap.timeline({ scrollTrigger: trig, defaults: { ease: E.out, duration: D.base } });
    const reveal = (targets, from, at = 0) => { if (!targets.length) return; targets.forEach((t) => { t.dataset.entering = ''; }); gsap.set(targets, from); tl.to(targets, { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, stagger: STAGGER, clearProps: 'transform,opacity' }, at); };
    // headings and text inside sections are revealed piece by piece by reveal-all.js
    const blocks = $$(':scope > .container > *:not(.section-head), :scope > .container > .split > *:not(.section-head)', s).filter((b) => !b.matches('.split'));

    if (kind === 'scale') reveal(blocks, { opacity: 0, scale: .96, y: 20 }, .1);
    if (kind === 'deal') {
      const cards = $$('.cards > *, .cs > *, .portraits > *, .people > *, .org > *, .group-list > *, .photo-pair > *, .gallery > *, .next-links > *, .contact-list > *', s);
      const rest = blocks.filter((b) => !cards.some((c) => b.contains(c)));
      reveal(rest, { opacity: 0, y: 24 }, .05);
      cards.forEach((c) => { c.dataset.entering = ''; });
      if (cards.length) { const sx = isMobile() ? 0 : 40; cards.forEach((c, i) => gsap.set(c, { opacity: 0, x: (i % 2 ? 1 : -1) * sx, y: isMobile() ? 44 : 30, rotate: sx ? (i % 2 ? 1.5 : -1.5) : 0 })); tl.to(cards, { opacity: 1, x: 0, y: 0, rotate: 0, stagger: STAGGER, duration: D.base, clearProps: 'transform,opacity' }, .1); }
    }
    if (kind === 'mask') {
      const ph = $$('.ph', s);
      ph.forEach((x) => { x.dataset.entering = ''; });
      gsap.set(ph, { clipPath: 'polygon(0 0, 0% 0, -30% 100%, 0 100%)' });
      tl.to(ph, { clipPath: 'polygon(0 0, 130% 0, 100% 100%, 0 100%)', duration: D.slow, ease: E.thread, clearProps: 'clipPath' }, 0);
      $$('.ph img', s).forEach((img) => tl.fromTo(img, { scale: 1.15 }, { scale: 1, duration: D.slow * 1.3, clearProps: 'transform' }, 0));
    }
    // keyboard focus or an anchor link into a hidden block shows it at once
    s.addEventListener('focusin', () => tl.progress(1), { once: true });
  });
}

// ------------------------------------------------------------------ statistics count up as the thread draws over them
function stats() {
  $$('.stats', main).forEach((box) => {
    const figs = $$('.stat__fig', box);
    const jobs = figs.map((fig) => {
      const node = [...fig.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
      if (!node) return null;
      const text = node.textContent;
      const m = text.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
      if (!m) return null;
      const end = parseFloat(m[1]);
      const dec = (m[1].split('.')[1] || '').length;
      const pad = m[1].length;
      const start = end >= 1900 ? end - 14 : end < 10 && dec ? 0 : /^0/.test(m[1]) ? 0 : Math.max(0, Math.round(end * .02));
      const fmt = (v) => { let s = v.toFixed(dec); if (!dec && pad > s.length && /^0/.test(m[1])) s = s.padStart(pad, '0'); return text.slice(0, m.index) + s + text.slice(m.index + m[1].length); };
      return { fig, node, text, end, start, fmt };
    }).filter(Boolean);
    if (still) return;
    if (box.getBoundingClientRect().top < innerHeight * .8) return;
    jobs.forEach((j) => { j.node.textContent = j.fmt(j.start); j.fig.setAttribute('aria-label', j.fig.textContent.replace(j.node.textContent, j.text).trim()); });
    ScrollTrigger.create({
      trigger: box, start: 'top 78%', once: true,
      onEnter: () => jobs.forEach((j, i) => {
        const o = { v: j.start };
        gsap.to(o, { v: j.end, duration: D.slow * 1.4, delay: i * STAGGER * 2, ease: E.out, onUpdate: () => { j.node.textContent = j.fmt(o.v); }, onComplete: () => { j.node.textContent = j.text; j.fig.removeAttribute('aria-label'); } });
      }),
    });
  });
}

// ------------------------------------------------------------------ depth: photos drift, the closing word drifts and grows
function depth() {
  if (still || lite) return;
  const k = isMobile() ? .35 : 1;
  $$('.ph', main).forEach((ph) => {
    if (ph.closest('.hero, .page-head, .reel, .carousel, .portrait, .person, .card, .product-card, .licence, .ticket')) return;
    const img = $('img', ph);
    if (!img) return;
    gsap.set(img, { scale: 1.1 });
    gsap.fromTo(img, { yPercent: -5 * k }, { yPercent: 5 * k, ease: 'none', scrollTrigger: { trigger: ph, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.photo-pair', main).forEach((pair) => {
    const [a, b] = pair.children;
    if (a) gsap.fromTo(a, { y: 24 * k }, { y: -24 * k, ease: 'none', scrollTrigger: { trigger: pair, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (b) gsap.fromTo(b, { y: 64 * k }, { y: -40 * k, ease: 'none', scrollTrigger: { trigger: pair, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // the hero copy drifts up as the hero leaves (translation only: text is never scaled)
  const heroText = $('.hero__text');
  if (heroText && !isMobile()) gsap.to(heroText, { y: -50, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  $$('.bigtype', main).forEach((t) => {
    gsap.fromTo(t, { xPercent: 6, scale: .96 }, { xPercent: -22, scale: 1.06, ease: 'none', scrollTrigger: { trigger: t.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

// ------------------------------------------------------------------ interaction: magnetic buttons, liquid fill origin, tilt, cursor
function interaction() {
  // liquid fill floods from where the pointer entered
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.('.btn');
    if (!b || e.pointerType !== 'mouse' || b.contains(e.relatedTarget)) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${e.clientX - r.left}px`); b.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  if (!fine || still) return;
  // magnetic pull on the larger calls to action
  $$('.btn--lg, .hero .btn, .cta-band .btn, .foot-cta .btn').forEach((b) => {
    b.classList.add('is-magnet');
    const xTo = gsap.quickTo(b, 'x', { duration: D.base, ease: E.out }), yTo = gsap.quickTo(b, 'y', { duration: D.base, ease: E.out });
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .22); yTo((e.clientY - r.top - r.height / 2) * .3); });
    b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
  // gentle 3D tilt on cards
  if (!lite) $$('.product-card, .card:not(.card--flat), .cs__item, .group, .contact-item, .quote-card').forEach((c) => {
    c.classList.add('tilt');
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      c.classList.add('is-tilting');
      c.style.setProperty('--ry', `${(px * 5).toFixed(2)}deg`); c.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`); c.style.setProperty('--ty', '-4px');
    });
    c.addEventListener('pointerleave', () => { c.classList.remove('is-tilting'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.style.setProperty('--ty', '0px'); });
  });
  // the cursor ring: View over photos, Drag over the reel, sliders and the licence image, Apply over apply links
  const cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); label.className = 'cursor__label'; cur.append(label);
  document.body.append(cur);
  const xTo = gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    cur.classList.add('is-on'); xTo(e.clientX); yTo(e.clientY);
    const t = e.target;
    const word = t.closest?.('a[href*="apply"], [data-calc-apply]') ? 'Apply'
      : t.closest?.('.reel, [role="slider"], .licence__fig, [data-zoom]') ? 'Drag'
      : t.closest?.('.ph, .portrait, .person') ? 'View' : '';
    cur.classList.toggle('is-label', !!word);
    if (word && label.textContent !== word) label.textContent = word;
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  addEventListener('pointerdown', () => cur.classList.add('is-press'));
  addEventListener('pointerup', () => cur.classList.remove('is-press'));
  // the logo lifts and tilts a little
  const brand = $('.site-header .brand img');
  if (brand) { brand.parentElement.addEventListener('pointerenter', () => gsap.to(brand, { rotate: -6, y: -2, duration: D.base, ease: E.out })); brand.parentElement.addEventListener('pointerleave', () => gsap.to(brand, { rotate: 0, y: 0, duration: D.base, ease: E.out })); }
}

// ------------------------------------------------------------------ calculator: the thread draws the interest month by month
function repayment() {
  $$('[data-calculator]', main).forEach((calc) => {
    const card = $('.ledgercard', calc);
    const monthlyOut = $('[data-calc="monthly"]', calc);
    const term = $('[data-slider="term"]', calc);
    if (!card || !monthlyOut || !term) return;
    const ns = 'http://www.w3.org/2000/svg';
    const box = document.createElement('div'); box.className = 'repay'; box.setAttribute('aria-hidden', 'true');
    const head = document.createElement('p'); head.className = 'repay__h'; head.innerHTML = '<span>Interest builds month by month</span><span class="tnum" data-r-end></span>';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 300 110');
    box.append(head, svg);
    const callout = $('.callout', card); card.insertBefore(box, callout);
    const W = 300, H = 92, X0 = 8, MAXI = 50e6 * .028 * 6; // fixed scale: the largest facility over the longest term
    const g = (tag, a) => { const n = document.createElementNS(ns, tag); for (const k in a) n.setAttribute(k, a[k]); svg.append(n); return n; };
    for (let m = 0; m <= 6; m++) { const x = X0 + (W - X0 * 2) * m / 6; g('line', { class: 'repay__grid', x1: x, x2: x, y1: 4, y2: H }); if (m) { const t = g('text', { class: 'repay__lbl', x, y: H + 15, 'text-anchor': 'middle' }); t.textContent = String(m); } }
    const area = g('path', { class: 'repay__area' });
    const line = g('path', { class: 'repay__line' });
    const dots = [];
    const end = $('[data-r-end]', head);
    let lastKey = '';
    const draw = (animate) => {
      const monthly = Number(monthlyOut.textContent.replace(/[^\d]/g, '')) || 0;
      const months = Number(term.getAttribute('aria-valuenow')) || 1;
      const key = monthly + ':' + months; if (key === lastKey) return; lastKey = key;
      const pts = [];
      for (let m = 0; m <= months; m++) pts.push([X0 + (W - X0 * 2) * m / 6, H - (H - 8) * Math.min(1, (monthly * m) / MAXI)]);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
      line.setAttribute('d', d);
      area.setAttribute('d', `${d}L${pts[pts.length - 1][0].toFixed(1)} ${H}L${X0} ${H}Z`);
      dots.forEach((c) => c.remove()); dots.length = 0;
      pts.slice(1).forEach((p) => dots.push(g('circle', { class: 'repay__dot', cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.5 })));
      end.textContent = $('[data-calc="total"]', calc)?.textContent || '';
      const L = line.getTotalLength();
      if (animate && !still) {
        gsap.fromTo(line, { strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDashoffset: 0, duration: D.base, ease: E.thread });
        gsap.fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: D.quick, stagger: STAGGER / 2, ease: 'back.out(2)', delay: D.quick });
      } else { line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''; }
    };
    draw(false);
    new MutationObserver(() => draw(true)).observe(calc, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-valuenow'] });
    if (!still) ScrollTrigger.create({ trigger: box, start: 'top 85%', once: true, onEnter: () => { lastKey = ''; draw(true); } });
  });
}

// ------------------------------------------------------------------ 404: a loose end you can pull
function rope() {
  const nf = $('.nf', main);
  if (!nf) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', 'nf-rope'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path'); const bead = document.createElementNS(ns, 'circle'); bead.setAttribute('r', '7');
  svg.append(path, bead); nf.prepend(svg);
  const hint = document.createElement('p'); hint.className = 'nf__hint'; hint.textContent = fine ? 'The thread came loose here. Move the pointer to pull it.' : 'The thread came loose here. Drag it with your finger.';
  $('.lede', nf)?.after(hint);
  const N = 22; const seg = isMobile() ? 14 : 20;
  const anchor = () => { const c = $('.nf__code', nf); const r = c.getBoundingClientRect(), n = nf.getBoundingClientRect(); return { x: r.right - n.left - 10, y: r.top - n.top + r.height * .55 }; };
  let a = anchor();
  const pts = Array.from({ length: N }, (_, i) => ({ x: a.x + i * seg * .7, y: a.y + i * seg * .7, px: a.x + i * seg * .7, py: a.y + i * seg * .7 }));
  let target = null; let dragging = false;
  const nfRect = () => nf.getBoundingClientRect();
  const toLocal = (e) => { const r = nfRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  if (fine) nf.addEventListener('pointermove', (e) => { target = toLocal(e); });
  nf.addEventListener('pointerleave', () => { if (!dragging) target = null; });
  svg.style.pointerEvents = 'none';
  nf.addEventListener('pointerdown', (e) => { const p = toLocal(e); const end = pts[N - 1]; if (Math.hypot(p.x - end.x, p.y - end.y) < 60) { dragging = true; target = p; nf.setPointerCapture?.(e.pointerId); } });
  nf.addEventListener('pointermove', (e) => { if (dragging) target = toLocal(e); });
  nf.addEventListener('pointerup', () => { dragging = false; if (!fine) target = null; });
  const step = () => {
    a = anchor();
    pts[0].x = a.x; pts[0].y = a.y;
    for (let i = 1; i < N; i++) { const p = pts[i]; const vx = (p.x - p.px) * .96, vy = (p.y - p.py) * .96; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + (still ? 0 : .45); }
    if (target) { const e = pts[N - 1]; e.x += (target.x - e.x) * .25; e.y += (target.y - e.y) * .25; }
    for (let k = 0; k < 6; k++) for (let i = 1; i < N; i++) {
      const p = pts[i - 1], q = pts[i]; const dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 1; const diff = (d - seg) / d;
      if (i - 1 !== 0) { p.x += dx * diff * .5; p.y += dy * diff * .5; q.x -= dx * diff * .5; q.y -= dy * diff * .5; } else { q.x -= dx * diff; q.y -= dy * diff; }
    }
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < N - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; d += `Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
    path.setAttribute('d', d);
    bead.setAttribute('cx', pts[N - 1].x.toFixed(1)); bead.setAttribute('cy', pts[N - 1].y.toFixed(1));
  };
  if (still) { for (let i = 0; i < 400; i++) step(); return; }
  gsap.ticker.add(step);
}

// ------------------------------------------------------------------ start
let thread = null;
try {
  bleeds();
  chapters();
  thread = null;
  stats();
  repayment();
  rope();
  ready(() => { entrances(); revealAll({ still, mobile: isMobile() }); depth(); interaction(); ScrollTrigger.refresh(); });
} catch (err) { console.error(err); }

// one frame loop for everything (GSAP's ticker)
let lastY = scrollY;
gsap.ticker.add((time) => {
  lenis?.raf(time * 1000);
  const y = lenis ? lenis.animatedScroll : scrollY;
  const v = lenis ? lenis.velocity : (y - lastY);
  lastY = y;
  thread?.frame(y, v);
});
gsap.ticker.lagSmoothing(500, 33);

// re-measure after fonts, images, resizes and orientation changes (debounced); ScrollTrigger refreshes first
let t = 0;
const relayout = () => { clearTimeout(t); t = setTimeout(() => { ScrollTrigger.refresh(); }, 160); };
ScrollTrigger.addEventListener('refresh', () => thread?.layout());
document.fonts?.ready.then(relayout);
addEventListener('load', relayout);
$$('img[loading="lazy"]', main).forEach((img) => { if (!img.complete) img.addEventListener('load', relayout, { once: true }); });
if ('ResizeObserver' in window && main) { let w = main.clientWidth, h = main.scrollHeight; new ResizeObserver(() => { if (Math.abs(main.clientWidth - w) > 1 || Math.abs(main.scrollHeight - h) > 40) { w = main.clientWidth; h = main.scrollHeight; relayout(); } }).observe(main); }
addEventListener('orientationchange', relayout);
// accordion toggles and form steps change the page height
document.addEventListener('toggle', relayout, true);
document.addEventListener('btc:reveal-done', relayout);
ScrollTrigger.refresh();
document.dispatchEvent(new CustomEvent('btc:motion-ready'));
html.classList.add('motion-ready');
