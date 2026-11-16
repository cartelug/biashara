// The opening film, the page-change wipe and the page-open reveal (MOTION.md sections 4 and 5).
// Small and library-free so it runs with the first script. The scroll-driven motion loads later (motion.js bundle).
import { $, $$ } from './utils.js';

const html = document.documentElement;
const E_OUT = 'cubic-bezier(.16, 1, .3, 1)';
const E_THREAD = 'cubic-bezier(.65, .05, .36, 1)';
const STAGGER = 60;
export const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- page-open reveal
// Headline by line (masked slide-up), supporting text rising, the photo opening through a diagonal mask, navigation last.
function splitLines(h) {
  const original = h.innerHTML;
  const tokens = [];
  [...h.childNodes].forEach((node) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { tokens.push(document.createTextNode(part)); return; }
        const w = document.createElement('span'); w.textContent = part; tokens.push(w);
      });
    } else tokens.push(node.cloneNode(true));
  });
  h.textContent = '';
  tokens.forEach((t) => h.append(t));
  const lines = [];
  let top = null;
  tokens.forEach((t) => {
    if (t.nodeType === 3) { if (lines.length) lines[lines.length - 1].push(t); return; }
    const y = Math.round(t.getBoundingClientRect().top);
    if (top === null || Math.abs(y - top) > 4) { lines.push([]); top = y; }
    lines[lines.length - 1].push(t);
  });
  h.textContent = '';
  const inners = lines.map((line) => {
    const mask = document.createElement('span'); mask.className = 'line-mask';
    const inner = document.createElement('span');
    line.forEach((t) => inner.append(t));
    mask.append(inner); h.append(mask); return inner;
  });
  h.classList.add('h1-lines');
  return { inners, restore: () => { h.innerHTML = original; h.classList.remove('h1-lines'); } };
}

let revealPrepared = null;
function prepareReveal() {
  if (revealPrepared !== null) return revealPrepared;
  revealPrepared = false;
  if (prefersReduced() || !document.body.animate) return false;
  const entry = $('#main .hero, #main .page-head, #main .nf');
  if (!entry) return false;
  const h = $('h1', entry);
  const parts = { entry, split: h ? splitLines(h) : null };
  parts.split?.inners.forEach((el) => { el.style.transform = 'translateY(105%)'; });
  parts.rise = $$('.hero__eyebrow, .crumbs, .hero__text > .lede, .hero__text > .btn-row > .btn, .hero__facts > li, .page-head .lede, .page-head .chips > li, .page-head .stats, .page-head .btn-row, .nf .lede, .nf__links > li', entry);
  parts.rise.forEach((el) => { el.style.opacity = '0'; });
  parts.media = $$('.hero__media .ph, .page-head__aside .ph', entry);
  parts.media.forEach((el) => { el.style.clipPath = 'polygon(0 0, 0% 0, -30% 100%, 0 100%)'; });
  parts.extra = $$('.hero__licence', entry);
  parts.extra.forEach((el) => { el.style.opacity = '0'; });
  parts.nav = $$('.site-header .brand, .primary-nav li, .site-header__tools > *');
  parts.nav.forEach((el) => { el.style.opacity = '0'; });
  revealPrepared = parts;
  return parts;
}

function runReveal() {
  const p = prepareReveal();
  if (!p) return;
  const anims = [];
  const a = (el, frames, opts) => { const x = el.animate(frames, { fill: 'both', easing: E_OUT, ...opts }); anims.push(x); return x; };
  p.split?.inners.forEach((el, i) => a(el, [{ transform: 'translateY(105%)' }, { transform: 'translateY(0)' }], { duration: 1100, delay: 40 + i * STAGGER * 1.5 }));
  p.rise.forEach((el, i) => a(el, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 220 + Math.min(i, 8) * STAGGER }));
  p.media.forEach((el, i) => {
    a(el, [{ clipPath: 'polygon(0 0, 0% 0, -30% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 130% 0, 100% 100%, 0 100%)' }], { duration: 1100, delay: 120 + i * STAGGER, easing: E_THREAD });
    const img = $('img', el); if (img) a(img, [{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 1500, delay: 120 });
  });
  p.extra.forEach((el) => a(el, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 780 }));
  p.nav.forEach((el, i) => a(el, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 520 + i * STAGGER * .75 }));
  // clean up so nothing keeps an inline style, and the headline reflows naturally on resize
  Promise.allSettled(anims.map((x) => x.finished)).then(() => {
    p.split?.restore();
    [...p.rise, ...p.media, ...p.extra, ...p.nav].forEach((el) => { el.style.opacity = ''; el.style.clipPath = ''; });
    anims.forEach((x) => x.cancel());
    $$('img', p.entry).forEach((img) => { img.style.transform = ''; });
    document.dispatchEvent(new CustomEvent('btc:reveal-done'));
  });
}

function clearReveal() {
  const p = revealPrepared;
  if (!p) return;
  p.split?.restore();
  [...p.rise, ...p.media, ...p.extra, ...p.nav].forEach((el) => { el.style.opacity = ''; el.style.clipPath = ''; });
}

// The thread's straight cut: sized to the screen in pixels so its stroke is even and its dash maths exact.
export function sizeThreadSvg(svg, w, h, d) {
  const path = svg?.querySelector('path');
  if (!path) return;
  svg.setAttribute('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`);
  path.setAttribute('d', d(w, h));
}
const tautD = (w, h) => `M${-0.04 * w} ${0.84 * h}L${1.04 * w} ${0.16 * h}`;

// ---------------------------------------------------------------- the film
export function mountFilm() {
  const film = window.__btcFilm;
  const pl = $('[data-preloader]');
  let revealed = false;
  const reveal = () => { if (revealed) return; revealed = true; html.classList.add('motion-entered'); runReveal(); document.dispatchEvent(new CustomEvent('btc:revealed')); };
  const finish = () => html.classList.remove('pl-on', 'pl-full', 'pl-short', 'pl-exit', 'pl-fade');

  if (!film || !pl || !html.classList.contains('pl-on')) { reveal(); return; }
  if (film.mode === 'pl-fade') { setTimeout(finish, 500); reveal(); return; }

  prepareReveal();
  sizeThreadSvg($('.pl__taut', pl), innerWidth, innerHeight, tautD);
  const full = film.mode === 'pl-full';
  const home = document.body.dataset.page === 'home';
  const MIN = full ? (home ? 1250 : 1400) : 160;
  const CAP = full ? 1540 : 420;
  const EXIT = full ? 760 : 460;

  // Real loading progress: fonts, the logo, the first photo and (full film only) the motion code.
  const img = $('#main .hero img, #main .page-head img');
  const tasks = [
    document.fonts?.ready,
    $('.pl__logo', pl)?.decode?.(),
    img && !img.complete ? new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }) : null,
    full ? new Promise((r) => { document.addEventListener('btc:motion-ready', r, { once: true }); setTimeout(r, 1300); }) : null,
  ].filter(Boolean);
  let done = 0;
  tasks.forEach((t) => Promise.resolve(t).catch(() => {}).then(() => { done++; }));

  const counter = $('[data-pl-count]', pl);
  let shown = 0;
  let exiting = false;
  let raf = 0;
  const fmt = (v) => (Math.round(v / 50000) * 50000).toLocaleString('en-US');
  const tick = () => {
    const t = performance.now() - film.t0;
    const loaded = tasks.length ? done / tasks.length : 1;
    if (full && counter) {
      const target = Math.min(t / MIN, .25 + .75 * loaded);
      shown += (Math.min(1, target) - shown) * .18;
      counter.textContent = fmt(1e6 + 49e6 * (exiting ? 1 : shown));
    }
    if (!exiting && ((t >= MIN && done >= tasks.length) || t >= CAP)) exit();
    if (!exiting) raf = requestAnimationFrame(tick);
  };
  function exit() {
    if (exiting) return;
    exiting = true; cancelAnimationFrame(raf);
    if (counter) counter.textContent = '50,000,000';
    html.classList.add('pl-exit');
    setTimeout(reveal, full ? 140 : 70);
    setTimeout(finish, EXIT);
  }
  // Tap, click or any key skips.
  pl.addEventListener('pointerdown', exit, { once: true });
  addEventListener('keydown', exit, { once: true });
  // a page restored from the back/forward cache never shows the film
  addEventListener('pageshow', (e) => { if (e.persisted) { exit(); finish(); } });
  raf = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- page change: the same wipe, closing
export function mountPageWipe() {
  const pl = $('[data-preloader]');
  if (!pl) return;
  const internal = (a) => {
    if (!a || a.target && a.target !== '_self' || a.hasAttribute('download') || a.dataset.noWipe !== undefined) return false;
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript|https?:\/\/wa\.me)/i.test(href)) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false; // same page (anchors)
    return true;
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!internal(a) || prefersReduced() || html.classList.contains('pl-on')) return;
    e.preventDefault();
    sizeThreadSvg($('.pl__taut', pl), innerWidth, innerHeight, tautD);
    html.classList.add('pl-leave');
    setTimeout(() => { location.href = a.href; }, 400);
    // if navigation is cancelled or blocked, never leave the page covered
    setTimeout(() => html.classList.remove('pl-leave'), 4000);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { html.classList.remove('pl-leave'); clearReveal(); } });
}
