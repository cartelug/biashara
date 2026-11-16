// Entry point. Starts the site furniture, the live office-hours sign, the licence notice, the tools on the page,
// the opening film and the page-change wipe. The scroll-driven motion (the red thread) loads afterwards as its own
// file, so the first screen never waits for it. Everything degrades: if this file fails, the site is complete HTML.
import { CONFIG } from './config.js';
import { $, siteUrl } from './utils.js';
import { mountSite } from './site.js';
import { mountOpenNow } from './open-now.js';
import { applyLicenceGuard } from './licence-guard.js';
import { initPage } from './pages.js';
import { mountFilm, mountPageWipe, prefersReduced } from './intro.js';
import { mountEnhancements } from './enhance.js';

/* global __MOTION_V__ */
const html = document.documentElement;

function registerSW() {
  if (!CONFIG.SERVICE_WORKER || !('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register(siteUrl('/sw.js')).catch(() => {}); });
}

// Motion tier (MOTION.md section 3): full, lite (Save-Data or modest hardware) or still (reduced motion).
function motionTier() {
  if (prefersReduced()) return 'still';
  const asked = /[?&]motion=(full|lite|still)\b/.exec(location.search);
  if (asked) return asked[1];
  const c = navigator.connection || {};
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 2;
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  return c.saveData || /(^|-)2g$/.test(c.effectiveType || '') || lowMemory || fewCores ? 'lite' : 'full';
}

function loadMotion() {
  if (window.__btcNoMotion) return;
  html.dataset.motion = motionTier();
  const s = document.createElement('script');
  s.src = siteUrl('/assets/js/motion.js?v=' + __MOTION_V__);
  s.async = true;
  s.onerror = () => document.dispatchEvent(new CustomEvent('btc:motion-ready'));
  document.head.append(s);
}

try {
  html.classList.remove('no-js');
  html.classList.add('js');
  mountSite();
  applyLicenceGuard(document);
  mountOpenNow(document);
  const main = $('#main');
  if (main) { initPage(main); mountEnhancements(main); }
  if (!prefersReduced()) html.classList.add('motion-enabled');
  try { mountFilm(); mountPageWipe(); } catch (err) { html.classList.remove('pl-on', 'pl-full', 'pl-short', 'pl-exit'); console.error(err); }
  // The full film counts the motion code as part of loading; otherwise it waits until the page has loaded.
  if (html.classList.contains('pl-full')) loadMotion();
  else if (document.readyState === 'complete') setTimeout(loadMotion, 0);
  else window.addEventListener('load', () => setTimeout(loadMotion, 0), { once: true });
  registerSW();
  html.classList.add('ready'); // scripts started (used by the tests)
} catch (err) {
  console.error(err);
}
