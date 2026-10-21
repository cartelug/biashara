// Global furniture: header (hides on scroll down), progress line, chapter rail, folio page number,
// back-to-top, copy buttons, high-contrast toggle and the Index (contents) dialog.
import { $, $$, copyText, store, announce } from './utils.js';

export function mountChrome(lenis) {
  const html = document.documentElement;
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const railFill = $('[data-rail-fill]');
  const folio = $('[data-folio-page]');
  const totops = $$('.totop');
  let lastY = window.scrollY, ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, y / max));
      if (progress) progress.style.transform = `scaleX(${p.toFixed(4)})`;
      if (railFill) railFill.style.transform = `scaleY(${p.toFixed(4)})`;
      if (folio) folio.textContent = String(Math.floor(y / Math.max(1, window.innerHeight)) + 1).padStart(2, '0');
      const down = y > lastY + 2, up = y < lastY - 2;
      if (header && !header.contains(document.activeElement)) {
        if (down && y > 120) header.classList.add('is-hidden');
        else if (up || y < 120) header.classList.remove('is-hidden');
      }
      totops.forEach((t) => t.classList.toggle('is-on', y > window.innerHeight * 1.2));
      lastY = y;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  onScroll();

  // Back to top
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-totop]');
    if (!a) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#main')?.focus({ preventScroll: true });
  });

  // Copy buttons with a square-tick confirmation
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const label = b.querySelector('.copy__t');
    try {
      await copyText(b.dataset.copy);
      b.classList.add('is-done');
      if (label) label.textContent = 'Copied';
      const use = b.querySelector('use'); const prev = use?.getAttribute('href');
      use?.setAttribute('href', '#i-check');
      announce('Copied to clipboard');
      setTimeout(() => { b.classList.remove('is-done'); if (label) label.textContent = 'Copy'; if (prev) use.setAttribute('href', prev); }, 1800);
    } catch { announce('Copy is not available in this browser'); }
  });

  // High contrast
  const syncContrast = () => $$('[data-contrast-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(html.dataset.contrast === 'high')));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-contrast-toggle]')) return;
    toggleContrast();
  });
  syncContrast();

  // Index dialog
  const index = $('[data-index]');
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-index-open]')) { openIndex(); }
    else if (e.target.closest('[data-index-close]')) { index?.close(); }
  });
  index?.addEventListener('click', (e) => { if (e.target.closest('a[href]')) index.close(); });
  index?.addEventListener('close', () => { lenis?.start(); $('[data-index-open]')?.focus({ preventScroll: true }); });
  function openIndex() {
    if (!index) return;
    const path = location.pathname;
    $$('a[data-nav]', index).forEach((a) => { if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    lenis?.stop();
    index.showModal();
  }

  function toggleContrast() {
    const on = html.dataset.contrast !== 'high';
    if (on) html.dataset.contrast = 'high'; else delete html.dataset.contrast;
    try { localStorage.setItem('btc-contrast', on ? 'high' : 'normal'); } catch { /* ignore */ }
    syncContrast();
    announce(on ? 'High contrast on' : 'High contrast off');
  }

  return { openIndex, toggleContrast, onScroll };
}

// Update labels that follow the current page (called by the router after a swap).
export function syncPageChrome(main) {
  document.body.dataset.page = main.dataset.page || '';
  const part = main.dataset.part || '';
  const num = main.dataset.num || '';
  const rp = $('[data-rail-part]'); if (rp) rp.textContent = part;
  const rn = $('[data-rail-num]'); if (rn) rn.textContent = num;
  const rh = $('[data-runhead]'); if (rh) rh.textContent = part;
  const path = location.pathname;
  $$('.hdr__nav a[data-nav]').forEach((a) => { if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.body.dataset.page = main.dataset.page || '';
}
