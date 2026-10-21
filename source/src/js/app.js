// Entry point. Boots the motion engine, global furniture and the router, then runs each page's
// init/destroy lifecycle. Everything degrades: if this file fails, the site is still complete HTML.
import { CONFIG } from './config.js';
import { $, reducedMotion } from './utils.js';
import { mountChrome, syncPageChrome } from './chrome.js';
import { mountCursor } from './cursor.js';
import { mountPalette } from './palette.js';
import { mountGridOverlay } from './grid-overlay.js';
import { mountOpenNow } from './open-now.js';
import { applyLicenceGuard } from './licence-guard.js';
import { createRouter, createCurtain } from './router.js';
import { runPreloader } from './preloader.js';
import { initReveals, initTicker, pageIntro } from './motion.js';
import { pageModules } from './pages.js';

const gs = window.gsap;
const ST = window.ScrollTrigger;
let lenis = null;
let current = null; // { ctx, destroy }

function setupScroll() {
  if (!gs || !ST) return;
  gs.registerPlugin(ST);
  gs.defaults({ overwrite: 'auto' });
  if (window.Lenis && !reducedMotion()) {
    lenis = new window.Lenis({ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true, anchors: false });
    lenis.on('scroll', ST.update);
    gs.ticker.add((t) => lenis.raf(t * 1000));
    gs.ticker.lagSmoothing(0);
  }
}

function scrollTo(target, { immediate = false, settle = false } = {}) {
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header')) || 72;
  let el = null, y = 0;
  if (typeof target === 'number') y = target;
  else { el = typeof target === 'string' ? document.querySelector(target) : target; if (!el) return; y = el.getBoundingClientRect().top + window.scrollY - header - 16; }
  const go = () => {
    if (lenis) lenis.scrollTo(y, { immediate: immediate || reducedMotion(), duration: 1.1, force: true });
    else window.scrollTo({ top: y, behavior: immediate || reducedMotion() ? 'auto' : 'smooth' });
  };
  go();
  if (settle) requestAnimationFrame(() => { ST?.refresh(); if (el) { y = el.getBoundingClientRect().top + window.scrollY - header - 16; go(); } });
  if (el && !immediate) setTimeout(() => { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }, 600);
}

function enterPage(main, { first = false } = {}) {
  syncPageChrome(main);
  applyLicenceGuard(document);
  const id = main.dataset.page;
  const mod = pageModules[id];
  const cleanups = [];
  const ctx = gs ? gs.context(() => {
    initReveals(main);
    const t = initTicker(main, lenis); if (t) cleanups.push(t);
    const r = mod?.init?.(main, { lenis, scrollTo, first }); if (typeof r === 'function') cleanups.push(r);
  }, main) : null;
  if (!gs) { const r = mod?.init?.(main, { lenis, scrollTo, first }); if (typeof r === 'function') cleanups.push(r); }
  cleanups.push(mountOpenNow(main));
  current = { ctx, cleanups };
  requestAnimationFrame(() => ST?.refresh());
  // A hash in the address (direct load) scrolls once the layout is settled
  if (first && location.hash) setTimeout(() => scrollTo(location.hash, { immediate: true, settle: true }), 60);
}

function leavePage() {
  if (!current) return;
  current.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
  current.ctx?.revert();
  ST?.getAll().forEach((t) => t.kill());
  current = null;
}

function boot() {
  setupScroll();
  const chrome = mountChrome(lenis);
  const grid = mountGridOverlay();
  mountCursor();
  mountOpenNow(document.querySelector('[data-footer]') || document);
  const main = $('#main');
  const curtain = createCurtain();
  const router = createRouter({
    curtain, scrollTo,
    onLeave: leavePage,
    onEnter: (m) => enterPage(m),
    onIntro: (m) => pageIntro(m),
  });
  mountPalette({ navigate: (to) => (to.startsWith('#') ? scrollTo(to) : router.go(to)), grid, chrome });
  if (main) enterPage(main, { first: true });
  runPreloader({ onReveal: () => main && pageIntro(main) });
  registerSW();
}

function registerSW() {
  if (!CONFIG.SERVICE_WORKER || !('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

try { boot(); } catch (err) {
  console.error(err);
  document.documentElement.classList.add('rm', 'motion-ready');
  document.querySelector('[data-loader]')?.remove();
}
