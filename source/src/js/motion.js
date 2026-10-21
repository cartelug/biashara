// Motion system. Tokens mirror the CSS: durations 120/240/480/800/1200ms, 60ms line stagger,
// 40ms row stagger, 24px maximum travel. Only transform, opacity and clip-path are animated.
import { $$, reducedMotion } from './utils.js';
import { rollIn } from './odometer.js';

export const D = { d1: 0.12, d2: 0.24, d3: 0.48, d4: 0.8, d5: 1.2 };
export const EASE = { outExpo: 'expo.out', inOut: 'power3.inOut', snap: 'back.out(1.2)' };
export const STAGGER = { line: 0.06, row: 0.04 };
export const TRAVEL = 24;

const g = () => window.gsap;
const ST = () => window.ScrollTrigger;

// Split a heading into lines (by measured word positions) wrapped in overflow masks.
export function splitLines(el) {
  if (el.querySelector('.line')) return $$('.line-inner', el);
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); words.push(s); }
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.matches('br')) {
        n.classList.add('w-el'); words.push(n);
      }
    }
  };
  walk(el);
  const lines = [];
  let top = null;
  for (const w of words) {
    const t = Math.round(w.offsetTop);
    if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
    lines[lines.length - 1].push(w);
  }
  el.textContent = '';
  for (const ln of lines) {
    const line = document.createElement('span'); line.className = 'line';
    const inner = document.createElement('span'); inner.className = 'line-inner';
    ln.forEach((w, i) => { if (i) inner.appendChild(document.createTextNode(' ')); inner.appendChild(w.classList.contains('w') ? document.createTextNode(w.textContent) : w); });
    line.appendChild(inner); el.appendChild(line);
  }
  return $$('.line-inner', el);
}

export function revealLines(el, { delay = 0 } = {}) {
  const inners = splitLines(el);
  if (reducedMotion()) { el.classList.add('is-in'); return null; }
  return g().fromTo(inners, { yPercent: 105 }, {
    yPercent: 0, duration: D.d4 + 0.1, ease: EASE.outExpo, stagger: STAGGER.line, delay,
    onStart: () => el.classList.add('is-in'), onComplete: () => g().set(inners, { clearProps: 'transform' }),
  });
}

export function revealImage(media, { delay = 0 } = {}) {
  const ph = media.querySelector('.ph');
  if (!ph) return;
  if (reducedMotion()) { media.classList.add('is-revealed'); return; }
  const img = ph.querySelector('img');
  let wipe = media.querySelector(':scope > .wipe');
  if (!wipe) { wipe = document.createElement('span'); wipe.className = 'wipe'; wipe.setAttribute('aria-hidden', 'true'); media.appendChild(wipe); }
  const tl = g().timeline({ delay, onComplete: () => { wipe.remove(); g().set(img, { clearProps: 'transform,willChange' }); } });
  tl.set(img, { willChange: 'transform', scale: 1.1 })
    .fromTo(wipe, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.25, ease: 'power2.in' })
    .add(() => media.classList.add('is-revealed'))
    .set(ph, { clipPath: 'inset(0 0 0 0)' })
    .to(wipe, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.25, ease: 'power2.out' })
    .to(img, { scale: 1, duration: D.d5, ease: EASE.outExpo }, '<');
  return tl;
}

// Wire up scroll reveals inside a scope. Returns nothing; everything lives in the caller's gsap.context.
export function initReveals(scope) {
  const gs = g(); const st = ST();
  document.documentElement.classList.add('motion-ready');
  const rm = reducedMotion();
  for (const el of $$('[data-lines]', scope)) {
    // Page headings are revealed by pageIntro (after the preloader or the curtain), not by scroll.
    if (el.closest('[data-hero]') || el.closest('.phero') || el.dataset.manual !== undefined) { splitLines(el); if (rm) el.classList.add('is-in'); continue; }
    if (rm) { el.classList.add('is-in'); continue; }
    splitLines(el);
    st.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => revealLines(el) });
  }
  for (const el of $$('[data-reveal]', scope)) {
    if (rm) { el.classList.add('is-in'); continue; }
    st.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => {
      gs.fromTo(el, { opacity: 0, y: TRAVEL }, { opacity: 1, y: 0, duration: D.d4, ease: EASE.outExpo, onStart: () => el.classList.add('is-in'), onComplete: () => gs.set(el, { clearProps: 'transform,opacity' }) });
    } });
  }
  // Rows: list items slide up 40ms apart
  for (const list of $$('.rows, .cs, .acc, .steps__list, .certledger, .contactcard', scope)) {
    const rows = [...list.children];
    if (rm || !rows.length) continue;
    gs.set(rows, { opacity: 0, y: TRAVEL / 2 });
    st.create({ trigger: list, start: 'top 88%', once: true, onEnter: () => gs.to(rows, { opacity: 1, y: 0, duration: D.d4, ease: EASE.outExpo, stagger: STAGGER.row, clearProps: 'transform,opacity' }) });
  }
  for (const m of $$('.fig__media, .portrait, [data-img-reveal]', scope)) {
    if (m.closest('[data-hero]')) continue;
    if (rm) { m.classList.add('is-revealed'); continue; }
    st.create({ trigger: m, start: 'top 92%', once: true, onEnter: () => revealImage(m) });
  }
  for (const o of $$('.odo[data-odo]', scope)) {
    if (o.closest('[data-loader]') || o.closest('[data-hero]')) continue;
    st.create({ trigger: o, start: 'top 92%', once: true, onEnter: () => rollIn(o) });
  }
  if (!rm) {
    for (const p of $$('[data-parallax]', scope)) {
      const amt = Number(p.dataset.parallax) || 6;
      gs.fromTo(p, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }
  // FIG numbers count up on hover
  for (const fig of $$('.fig', scope)) {
    const n = fig.querySelector('[data-fig]');
    if (!n) continue;
    const final = Number(n.dataset.fig);
    let raf = 0;
    fig.addEventListener('pointerenter', () => {
      if (rm) return;
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 600); n.textContent = 'Fig. ' + String(Math.max(0, Math.round(final * k))).padStart(2, '0'); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    });
  }
}

// Ledger ticker: slow marquee that reverses with scroll direction.
export function initTicker(scope, lenis) {
  const track = scope.querySelector('[data-ticker-track]');
  if (!track || reducedMotion()) return;
  const gs = g();
  const set = track.firstElementChild;
  const tween = gs.to(track, { x: () => -set.offsetWidth, duration: 38, ease: 'none', repeat: -1, modifiers: { x: (x) => (parseFloat(x) % set.offsetWidth) + 'px' } });
  let dir = 1;
  const onScroll = ({ direction }) => { if (direction && direction !== dir) { dir = direction; gs.to(tween, { timeScale: dir, duration: 0.6, ease: 'power2.out', overwrite: true }); } };
  lenis?.on('scroll', onScroll);
  return () => { tween.kill(); lenis?.off?.('scroll', onScroll); };
}

// Hero intro: headline lines rise, the banknote photo settles from 1.15 to 1, the span draws across the gap.
export function heroIntro(scope) {
  const hero = scope.querySelector('[data-hero]');
  const gs = g();
  const title = scope.querySelector('main h1, h1');
  if (!hero) { if (title && title.closest('[data-lines]')) revealLines(title.closest('[data-lines]')); else if (title?.matches('[data-lines]')) revealLines(title); return; }
  const h1 = hero.querySelector('[data-lines]');
  const img = hero.querySelector('[data-hero-img] img');
  const span = hero.querySelector('[data-hero-span]');
  const side = hero.querySelector('.hero__side');
  if (reducedMotion()) { h1?.classList.add('is-in'); if (span) span.style.transform = 'none'; return; }
  const tl = gs.timeline();
  if (h1) tl.add(revealLines(h1), 0);
  if (img) tl.fromTo(img, { scale: 1.15 }, { scale: 1, duration: 1.6, ease: EASE.outExpo, clearProps: 'transform' }, 0);
  if (span) tl.fromTo(span, { scaleX: 0 }, { scaleX: 1, duration: D.d4, ease: 'power3.inOut' }, 0.45);
  if (side) tl.fromTo(side.children, { opacity: 0, y: TRAVEL }, { opacity: 1, y: 0, duration: D.d4, ease: EASE.outExpo, stagger: STAGGER.line, clearProps: 'transform,opacity' }, 0.25);
  return tl;
}

// Page heading intro for inner pages (after the curtain or preloader).
export function pageIntro(scope) {
  const h = scope.querySelector('.phero [data-lines], .hero [data-lines]');
  if (scope.querySelector('[data-hero]')) return heroIntro(scope);
  if (h) return revealLines(h);
}
