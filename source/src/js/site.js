// Global behaviour: header shadow, mobile menu, back to top, copy buttons and the high-contrast toggle.
// Everything here is an enhancement: links, navigation and content work without it.
import { $, $$, copyText, announce, reducedMotion } from './utils.js';

export function mountSite() {
  const html = document.documentElement;
  const header = $('[data-header]');
  const totops = $$('.to-top');

  // Header shadow after a few pixels of scroll; back-to-top button after about two screens
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      header?.classList.toggle('is-scrolled', y > 8);
      totops.forEach((t) => t.classList.toggle('is-on', y > window.innerHeight * 1.5));
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-totop]')) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    $('#main')?.focus({ preventScroll: true });
  });

  // Menu panel (below 1024px)
  const btn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (btn && menu) {
    const icon = $('[data-menu-icon]', btn);
    const label = $('[data-menu-label]', btn);
    const wide = window.matchMedia('(min-width: 1024px)');
    const isOpen = () => !menu.hidden;
    const paint = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      icon?.setAttribute('href', open ? '#i-close' : '#i-menu');
      if (label) label.textContent = open ? 'Close' : 'Menu';
      document.body.classList.toggle('menu-open', open);
    };
    const open = () => { paint(true); $('a', menu)?.focus(); };
    const close = (focus = false) => { paint(false); if (focus) btn.focus(); };
    btn.addEventListener('click', () => (isOpen() ? close() : open()));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) paint(false); });
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key !== 'Tab') return;
      // keep keyboard focus inside the header and the open menu
      const items = $$('a[href], button:not([disabled])', header).filter((el) => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    const onWide = () => { if (wide.matches && isOpen()) paint(false); };
    wide.addEventListener?.('change', onWide);
  }

  // Copy buttons
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const text = b.querySelector('.copy__t');
    try {
      await copyText(b.dataset.copy);
      b.classList.add('is-done');
      if (text) text.textContent = 'Copied';
      const use = b.querySelector('use');
      const prev = use?.getAttribute('href');
      use?.setAttribute('href', '#i-check');
      announce('Copied to clipboard');
      setTimeout(() => { b.classList.remove('is-done'); if (text) text.textContent = 'Copy'; if (prev) use.setAttribute('href', prev); }, 1800);
    } catch { announce('Copy is not available in this browser'); }
  });

  // High contrast, remembered on this device
  const syncContrast = () => $$('[data-contrast-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(html.dataset.contrast === 'high')));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-contrast-toggle]')) return;
    const on = html.dataset.contrast !== 'high';
    if (on) html.dataset.contrast = 'high'; else delete html.dataset.contrast;
    try { localStorage.setItem('btc-contrast', on ? 'high' : 'normal'); } catch { /* storage may be blocked */ }
    syncContrast();
    announce(on ? 'High contrast on' : 'High contrast off');
  });
  syncContrast();
}
