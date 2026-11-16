// Small interaction details that belong with the first script (MOTION.md section 5): smooth accordions,
// the products carousel on phones, friendly validation and the success moment. None of them changes what a form does.
import { $, $$ } from './utils.js';
import { prefersReduced } from './intro.js';

const E_OUT = 'cubic-bezier(.16, 1, .3, 1)';

// ---------------------------------------------------------------- accordions: smooth height, staggered answer
function mountAccordions(root) {
  $$('details.acc__item', root).forEach((d) => {
    const summary = $('summary', d);
    const panel = $('.acc__panel', d);
    if (!summary || !panel) return;
    let anim = null;
    summary.addEventListener('click', (e) => {
      if (prefersReduced() || !d.animate) return; // native behaviour
      e.preventDefault();
      const start = d.offsetHeight;
      anim?.cancel();
      if (!d.open) {
        d.open = true;
        const end = d.offsetHeight;
        anim = d.animate([{ height: start + 'px' }, { height: end + 'px' }], { duration: 640, easing: E_OUT });
        [...panel.children].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 80 + i * 60, easing: E_OUT, fill: 'backwards' }));
        anim.onfinish = () => { anim = null; };
      } else {
        const end = summary.offsetHeight + (parseFloat(getComputedStyle(d).borderBottomWidth) || 0);
        anim = d.animate([{ height: start + 'px' }, { height: end + 'px' }], { duration: 420, easing: 'cubic-bezier(.65,.05,.36,1)' });
        anim.onfinish = () => { d.open = false; anim = null; };
      }
    });
  });
}

// ---------------------------------------------------------------- products: snap carousel on phones
function mountCarousels(root) {
  $$('[data-carousel]', root).forEach((track) => {
    const nav = track.nextElementSibling?.matches('[data-carousel-nav]') ? track.nextElementSibling : null;
    if (!nav) return;
    const items = [...track.children];
    const count = $('[data-carousel-count]', nav);
    const prev = $('[data-carousel-prev]', nav);
    const next = $('[data-carousel-next]', nav);
    let index = 0;
    const paint = () => {
      const w = items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
      index = Math.max(0, Math.min(items.length - 1, Math.round(track.scrollLeft / (w || 1))));
      if (count) count.textContent = String(index + 1);
      nav.style.setProperty('--cp', String((index + 1) / items.length));
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === items.length - 1;
    };
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { passive: true });
    const go = (d) => items[Math.max(0, Math.min(items.length - 1, index + d))].scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
    prev?.addEventListener('click', () => go(-1));
    next?.addEventListener('click', () => go(1));
    paint();
  });
}

// ---------------------------------------------------------------- friendly validation and the success moment
function mountForms(root) {
  const shake = (el) => {
    if (!el || prefersReduced()) return;
    el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
    setTimeout(() => el.classList.remove('is-shake'), 400);
  };
  const tie = (box) => {
    if (!box || $('.tie', box)) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'tie'); svg.setAttribute('viewBox', '0 0 72 72'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('pathLength', '1');
    // the thread loops once (a knot) and pulls into a tick
    p.setAttribute('d', 'M4 40C14 40 20 30 30 30C40 30 40 46 30 46C20 46 22 32 34 36L46 50L68 18');
    svg.append(p); box.prepend(svg);
  };
  const watch = new MutationObserver((records) => {
    records.forEach(({ target }) => {
      if (target.hidden) return;
      if (target.matches('.field__err, [data-amount-error], .errsum')) shake(target.closest('.field, .form__row, .errsum') || target);
      if (target.matches('[data-done], [data-sendout]')) tie(target.matches('[data-done]') ? ($('.done__intro', target) || target) : target);
    });
  });
  watch.observe(root, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
}

export function mountEnhancements(main) {
  if (!main) return;
  mountAccordions(main);
  mountCarousels(main);
  mountForms(main);
}
