// Progressive motion: the content, navigation and forms stay native HTML.
// A tab sees the introduction once; reduced-motion visitors bypass it entirely.
import { $, $$ } from './utils.js';

export function mountMotion() {
  const html = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
  const active = new Set();
  const waiting = new Set();
  let entranceStarted = false;
  let observer;
  let introTimer;
  let exitTimer;
  let startTimer;
  let introDone = !html.classList.contains('intro-pending');
  const intro = $('[data-preloader]');
  const inertTargets = [];

  function animate(el, frames, options = {}) {
    if (!el?.animate || preference.matches) return null;
    const animation = el.animate(frames, { duration: 640, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards', ...options });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }

  function rise(el, delay = 0, distance = 24) {
    return animate(el, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }], { delay });
  }

  function reveal(el, immediate = false) {
    waiting.delete(el);
    observer?.unobserve(el);
    el.classList.remove('motion-wait');
    el.classList.add('motion-revealed');
    if (!immediate) rise(el, Number(el.dataset.motionDelay || 0));
  }

  function enterPage() {
    if (entranceStarted) return;
    entranceStarted = true;
    const entry = $('#main .hero, #main .page-head');
    if (entry && !preference.matches) {
      const heading = $('h1', entry);
      if (heading) {
        // Wrap text nodes only: inline accents, links and the accessible text survive.
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) if (!walker.currentNode.parentElement.closest('.sr-only, .fn')) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
          const fragment = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach((word) => {
            if (!word.trim()) { fragment.append(document.createTextNode(word)); return; }
            const clip = document.createElement('span');
            const inner = document.createElement('span');
            clip.className = 'motion-word'; inner.className = 'motion-word__in';
            inner.textContent = word; clip.append(inner); fragment.append(clip);
          });
          node.replaceWith(fragment);
        });
        $$('.motion-word__in', heading).forEach((word, i) => animate(word,
          [{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
          { duration: 820, delay: 90 + Math.min(i, 12) * 55 }));
      }
      rise($('.hero__eyebrow, .crumbs', entry), 0, 12);
      $$('.hero__text > .lede, .hero__text > .btn-row > .btn, .hero__facts > li, .hero__media, .page-head .lede, .page-head__aside, .page-head .stat', entry)
        .forEach((el, i) => rise(el, 170 + Math.min(i, 5) * 65, el.matches('.hero__media') ? 32 : 18));
    }
    for (const el of [...waiting]) {
      if (el.getBoundingClientRect().top < innerHeight + 40) reveal(el, preference.matches);
    }
    html.classList.add('motion-entered');
  }

  function releaseIntro() {
    clearTimeout(introTimer); clearTimeout(exitTimer); clearTimeout(startTimer);
    introDone = true;
    html.classList.remove('intro-pending', 'intro-finishing');
    inertTargets.forEach(({ el, previous }) => { el.inert = previous; delete el.dataset.introInert; });
    try { sessionStorage.setItem('btc-intro-v1', 'seen'); } catch { /* privacy mode */ }
    if (intro?.contains(document.activeElement)) $('#main')?.focus({ preventScroll: true });
    enterPage();
  }

  function dismissIntro(immediate = false) {
    if (introDone) { enterPage(); return; }
    if (immediate || preference.matches) { releaseIntro(); return; }
    html.classList.add('intro-finishing');
    startTimer = setTimeout(enterPage, 180);
    exitTimer = setTimeout(releaseIntro, 700);
  }

  if (!preference.matches) html.classList.add('motion-enabled');
  if (!introDone && intro) {
    $$('#main, .site-header, .site-footer, .to-top, .skip').forEach((el) => {
      inertTargets.push({ el, previous: el.inert }); el.inert = true; el.dataset.introInert = '';
    });
    $('[data-skip-intro]', intro)?.addEventListener('click', () => dismissIntro(true));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !introDone) dismissIntro(true); });
    document.addEventListener('btc:intro-timeout', () => { if (!introDone) releaseIntro(); }, { once: true });
    // Wait only for the brand font/logo, never the whole page or lazy photographs.
    const logo = $('img', intro);
    const assets = Promise.allSettled([document.fonts?.ready, logo?.decode?.()]);
    Promise.race([assets, new Promise((resolve) => setTimeout(resolve, 650))]).then(() => {
      if (introDone) return;
      const elapsed = performance.now() - (window.__btcIntroStarted || performance.now());
      introTimer = setTimeout(() => dismissIntro(), Math.max(0, 1250 - elapsed));
    });
  } else enterPage();

  // One observer for all page sections. Nested cards never get two entrances.
  const selector = '.section-head, .product-card, .product-row, .card, .panel, .stat, .step, .stair__step, .cs__item, .group, .portrait, .quote-card, .timeline > li, .termbar__track > li, .anatomy__seg, .calc__inputs, .calc__out, .licence-strip, .next-link, .contact-item, .hours-card, .photo-pair > figure, .site-footer__col, .site-footer__brand, .cta-band__grid > div';
  if (!preference.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => { if (isIntersecting && entranceStarted) reveal(target); });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
    $$(selector).forEach((el) => {
      if (el.closest('.hero, .page-head') || el.parentElement.closest(selector)) return;
      el.dataset.motionDelay = String(Math.min([...el.parentElement.children].indexOf(el), 3) * 60);
      el.classList.add('motion-wait'); waiting.add(el); observer.observe(el);
    });
  }

  // Keyboard and anchored navigation always reveal their destination immediately.
  document.addEventListener('focusin', (e) => {
    const target = e.target.closest?.('.motion-wait');
    if (target) reveal(target, true);
  });
  const revealHash = () => {
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target) return;
      const parent = target.closest('.motion-wait');
      if (parent) reveal(parent, true);
      $$('.motion-wait', target).forEach((el) => reveal(el, true));
    } catch { /* malformed hash */ }
  };
  window.addEventListener('hashchange', revealHash); revealHash();

  // Native accordion semantics, with a short answer entrance on supporting browsers.
  $$('details.acc__item').forEach((details) => {
    details.addEventListener('toggle', () => { if (details.open) rise($('.acc__panel', details), 0, 7); });
  });

  // Animate newly displayed application steps without altering validation or focus.
  const apply = $('[data-apply]');
  if (apply) new MutationObserver((records) => {
    records.forEach(({ target }) => { if (target.matches('.astep') && !target.hidden) rise(target, 0, 12); });
  }).observe(apply, { subtree: true, attributes: true, attributeFilter: ['hidden'] });

  // A single frame per scroll. Parallax runs only on large screens with a mouse.
  const progress = $('[data-reading-progress]');
  const hero = $('.hero__media');
  let scrollFrame = 0;
  let pageHeight = document.documentElement.scrollHeight;
  const paintScroll = () => {
    scrollFrame = 0;
    if (document.body.classList.contains('menu-open')) return;
    const max = Math.max(1, pageHeight - innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / max))})`;
    if (hero && !preference.matches && finePointer.matches && scrollY < innerHeight * 1.5) {
      hero.style.setProperty('--hero-drift', `${-Math.min(12, scrollY * .035)}px`);
    }
  };
  const requestScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(paintScroll); };
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', () => { pageHeight = document.documentElement.scrollHeight; requestScroll(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { pageHeight = document.documentElement.scrollHeight; requestScroll(); }).observe(document.body);
  paintScroll();

  preference.addEventListener?.('change', () => {
    html.classList.toggle('motion-enabled', !preference.matches);
    if (preference.matches) {
      active.forEach((animation) => animation.cancel());
      [...waiting].forEach((el) => reveal(el, true));
      observer?.disconnect();
      hero?.style.removeProperty('--hero-drift');
      dismissIntro(true);
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    active.forEach((animation) => animation.cancel());
    [...waiting].forEach((el) => reveal(el, true));
    releaseIntro(); requestScroll();
  });
}
