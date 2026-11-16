// Reveal everything: every heading, paragraph, list item, icon, chip, button, photo, table row and footer column
// arrives as it scrolls into view. One IntersectionObserver for the whole page; elements that enter in the same
// frame arrive together with the site's 60 ms stagger. Only elements below the first screen are ever hidden,
// keyboard focus shows an element at once, and reduced motion skips all of it.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { D, E, STAGGER } from './tokens.js';

gsap.registerPlugin(SplitText);

const SKIP = '.hero, .page-head, .nf, .pl, .menu, .reel, [data-apply], [data-done], [data-sendout], .acc__panel, [hidden], .sr-only, .cursor, .bigtype, .repay, .ticket';

// what each kind of element does as it arrives
const KINDS = [
  { sel: '.tile, .step__n, .cs__n, .acc__n', from: { opacity: 0, scale: 0.4, rotate: -25 }, ease: 'back.out(2)' },
  { sel: '.chip', from: { opacity: 0, scale: 0.8, y: 10 }, ease: 'back.out(2.2)' },
  { sel: '.btn, .link-arrow, .copy, .tool', from: { opacity: 0, y: 18 } },
  { sel: '.ph', from: { clipPath: 'inset(0 0 100% 0 round 16px)' }, to: { clipPath: 'inset(0 0 0% 0 round 16px)' }, ease: E.thread, dur: D.slow },
  { sel: 'tr, .ledger__row, .specs > div, .doclist__list li, .ticklist li, .plist li, .notes__list li, .site-footer__col li, .timeline > li, .termbar__track > li, .anatomy__seg', from: { opacity: 0, x: -16 } },
  { sel: '.eyebrow, .label, .stat dt, .stat__cap, .stats-note, figcaption, .acc__item, .callout, .field, .check', from: { opacity: 0, y: 14 } },
  { sel: 'h3, h4, .card p, .product-card p, .group p, .cs__item p, .step p, p, address, dl:not(.stats) > div', from: { opacity: 0, y: 22 } },
];

export function revealAll({ still, mobile }) {
  if (still || !('IntersectionObserver' in window)) return;
  const roots = [document.querySelector('#main'), document.querySelector('.site-footer')].filter(Boolean);
  const seen = new Set();
  const byEl = new Map();
  const fold = innerHeight * 0.92;
  const below = (el) => el.getBoundingClientRect().top > fold;
  let queue = [];
  let raf = 0;
  const flush = () => {
    raf = 0;
    queue.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    queue.forEach((it, i) => it.play(Math.min(i, 8)));
    queue = [];
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      (byEl.get(e.target) || []).forEach((it) => { if (!it.done) { it.done = true; queue.push(it); } });
    });
    if (queue.length && !raf) raf = requestAnimationFrame(flush);
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  // A fully clipped element never counts as visible, so clipped photos are watched through their container.
  const items = new Map();
  const add = (el, play, watch = el) => {
    const it = { el, play }; items.set(el, it);
    if (!byEl.has(watch)) { byEl.set(watch, []); io.observe(watch); }
    byEl.get(watch).push(it);
  };

  // Headings: masked lines that slide up; back to plain text when done.
  roots.forEach((root) => root.querySelectorAll('h2').forEach((h) => {
    if (h.matches('[data-entering]') || h.closest(SKIP) || !below(h)) return;
    seen.add(h);
    const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    gsap.set(split.lines, { yPercent: 110 });
    add(h, () => gsap.to(split.lines, { yPercent: 0, duration: D.slow, ease: E.out, stagger: STAGGER * 1.5, onComplete: () => split.revert() }));
  }));

  // Everything else, most specific kind first; an element is animated once.
  KINDS.forEach((k) => roots.forEach((root) => root.querySelectorAll(k.sel).forEach((el) => {
    if (seen.has(el) || el.matches('[data-entering]') || el.closest(SKIP) || !el.getClientRects().length || !below(el)) return;
    if (el.closest('[data-pinned="true"]') && !mobile) return; // a pinned block owns its transforms
    seen.add(el);
    gsap.set(el, k.from);
    const to = k.to || Object.fromEntries(Object.keys(k.from).map((p) => [p, p === 'opacity' || p === 'scale' ? 1 : 0]));
    add(el, (i) => gsap.to(el, { ...to, duration: k.dur || D.base, ease: k.ease || E.out, delay: i * STAGGER, clearProps: 'transform,opacity,clipPath' }), k.to ? el.parentElement : el);
  })));

  // keyboard focus and anchor links never wait for an animation
  const show = (el) => { const it = items.get(el); if (it && !it.done) { it.done = true; it.play(0); } };
  document.addEventListener('focusin', (e) => { for (let n = e.target; n && n !== document.body; n = n.parentElement) show(n); });
}
