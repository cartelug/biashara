// Entry point. Starts the site furniture, the live office-hours sign, the licence notice and the tools on the page.
// Everything degrades: if this file fails to load, the site is still complete HTML.
import { CONFIG } from './config.js';
import { $, siteUrl } from './utils.js';
import { mountSite } from './site.js';
import { mountOpenNow } from './open-now.js';
import { applyLicenceGuard } from './licence-guard.js';
import { initPage } from './pages.js';
import { mountMotion } from './motion.js';

function registerSW() {
  if (!CONFIG.SERVICE_WORKER || !('serviceWorker' in navigator) || location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register(siteUrl('/sw.js')).catch(() => {}); });
}

try {
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');
  mountSite();
  applyLicenceGuard(document);
  mountOpenNow(document);
  const main = $('#main');
  if (main) initPage(main);
  try { mountMotion(); } catch (err) {
    document.documentElement.classList.remove('intro-pending', 'intro-finishing');
    document.querySelectorAll('.motion-wait').forEach((el) => el.classList.remove('motion-wait'));
    document.querySelectorAll('[data-intro-inert]').forEach((el) => { el.inert = false; delete el.dataset.introInert; });
    console.error(err);
  }
  registerSW();
  document.documentElement.classList.add('ready'); // scripts started (used by the tests)
} catch (err) {
  console.error(err);
}
