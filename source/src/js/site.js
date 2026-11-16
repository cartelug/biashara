// Global behaviour: header shadow, mobile menu, back to top, copy buttons and the high-contrast toggle.
// Everything here is an enhancement: links, navigation and content work without it.
import { $, $$, copyText, announce, reducedMotion } from './utils.js';
import { sizeThreadSvg } from './intro.js';

export function mountSite() {
  const html = document.documentElement;
  const header = $('[data-header]');
  const totops = $$('.to-top');

  // Header: shadow after a few pixels; hides on the way down and returns on the way up; compacts after the hero.
  // The header's layout height never changes (compaction is a transform), so nothing below it moves.
  let ticking = false;
  let lastY = window.scrollY;
  let travel = 0;
  const hero = $('#main .hero, #main .page-head');
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      const dy = y - lastY; lastY = y;
      header?.classList.toggle('is-scrolled', y > 8);
      totops.forEach((t) => t.classList.toggle('is-on', y > window.innerHeight * 1.5));
      if (!header || document.body.classList.contains('menu-open')) return;
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - header.offsetHeight : window.innerHeight * .6;
      header.classList.toggle('is-compact', y > heroEnd);
      travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      const hide = y > heroEnd && travel > 24 ? true : travel < -12 || y < header.offsetHeight * 2 ? false : null;
      if (hide !== null && hide !== header.classList.contains('is-hidden')) {
        header.classList.toggle('is-hidden', hide);
        html.classList.toggle('header-hidden', hide);
      }
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

  // Keep the sheet below the actual header, including browser text scaling.
  if (header && 'ResizeObserver' in window) new ResizeObserver(() => {
    html.style.setProperty('--header-offset', `${header.getBoundingClientRect().height}px`);
  }).observe(header);

  // Menu sheet: interruptible animation, native links, focus control and iOS scroll lock.
  const btn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (btn && menu) {
    const icon = $('[data-menu-icon]', btn);
    const label = $('[data-menu-label]', btn);
    const wide = window.matchMedia('(min-width: 1024px)');
    let opened = false;
    let sheetAnimation;
    let linkAnimations = [];
    let revision = 0;
    let scrollPosition = 0;
    let bodyStyles;
    let blocked = [];
    const cancelAnimations = () => {
      sheetAnimation?.cancel(); linkAnimations.forEach((animation) => animation.cancel()); linkAnimations = [];
    };
    const lock = () => {
      scrollPosition = window.scrollY;
      bodyStyles = ['position', 'top', 'width'].map((key) => [key, document.body.style[key]]);
      document.body.style.position = 'fixed'; document.body.style.top = `-${scrollPosition}px`; document.body.style.width = '100%';
      document.body.classList.add('menu-open');
      blocked = $$('#main, .site-footer, .to-top, .skip').map((el) => ({ el, previous: el.inert }));
      blocked.forEach(({ el }) => { el.inert = true; });
    };
    const unlock = () => {
      blocked.forEach(({ el, previous }) => { el.inert = previous; }); blocked = [];
      bodyStyles?.forEach(([key, value]) => { document.body.style[key] = value; }); bodyStyles = null;
      document.body.classList.remove('menu-open');
      const oldBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto'; window.scrollTo(0, scrollPosition); html.style.scrollBehavior = oldBehavior;
    };
    const open = () => {
      const wasVisible = !menu.hidden;
      opened = true; revision++; cancelAnimations();
      if (!wasVisible) lock();
      menu.hidden = false; menu.dataset.state = 'opening'; menu.scrollTop = 0;
      btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'Close navigation');
      icon?.setAttribute('href', '#i-close'); if (label) label.textContent = 'Close';
      $('a', menu)?.focus({ preventScroll: true });
      if (reducedMotion() || !menu.animate) { menu.dataset.state = 'open'; return; }
      const current = revision;
      // The thread sweeps across the screen and the sheet opens behind it; the oversized links follow, 60 ms apart.
      sheetAnimation = menu.animate([{ clipPath: 'polygon(100% 0, 100% 0, 100% 0, 100% 0)' }, { clipPath: 'polygon(100% 0, -60% 0, -60% 0, 100% 160%)' }, { clipPath: 'polygon(100% 0, -100% 0, -100% 200%, 100% 200%)' }], { duration: 640, easing: 'cubic-bezier(.65,.05,.36,1)' });
      const sweep = $('.menu__thread path', menu);
      sizeThreadSvg($('.menu__thread', menu), menu.clientWidth, menu.clientHeight, (w, h) => `M${w * 1.04} ${-0.04 * h}C${w * .7} ${h * .2} ${w * .6} ${h * .3} ${w * .5} ${h * .48}S${w * .2} ${h * .8} ${-0.04 * w} ${h * 1.04}`);
      if (sweep) linkAnimations.push(sweep.animate([{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .7 }, { strokeDashoffset: -1, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.65,.05,.36,1)' }));
      $$('.menu__intro, .menu__list > li, .menu__h, .menu__cta', menu).forEach((el, i) => {
        linkAnimations.push(el.animate([{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 640, delay: 180 + Math.min(i, 10) * 60, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' }));
      });
      sheetAnimation.finished.then(() => { if (current === revision) menu.dataset.state = 'open'; }, () => {});
    };
    const close = (focus = false, immediate = false) => {
      if (menu.hidden) return;
      opened = false; revision++; cancelAnimations();
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open navigation');
      icon?.setAttribute('href', '#i-menu'); if (label) label.textContent = 'Menu';
      const current = revision;
      const done = () => {
        if (current !== revision) return;
        menu.hidden = true; menu.dataset.state = 'closed'; unlock(); if (focus) btn.focus({ preventScroll: true });
      };
      if (immediate || reducedMotion() || !menu.animate) { done(); return; }
      menu.dataset.state = 'closing';
      sheetAnimation = menu.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 240, easing: 'cubic-bezier(.65,.05,.36,1)' });
      sheetAnimation.finished.then(done, () => {});
    };
    btn.addEventListener('click', () => (opened ? close(true) : open()));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(false, true); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key !== 'Tab') return;
      // keep keyboard focus inside the header and the open menu
      const items = $$('a[href], button:not([disabled])', header).filter((el) => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    const onWide = () => { if (wide.matches && !menu.hidden) close(false, true); };
    wide.addEventListener?.('change', onWide);
    window.addEventListener('pagehide', () => close(false, true));
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
      if (e.matches && menu.dataset.state === 'closing') close(true, true);
      else if (e.matches) { cancelAnimations(); if (opened) menu.dataset.state = 'open'; }
    });
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
