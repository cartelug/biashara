// Page lifecycles: each page exports init(main, ctx) and returns its own cleanup.
import { $, $$, reducedMotion } from './utils.js';
import { mountGuilloche } from './guilloche.js';
import { mountSpan } from './span.js';
import { mountHScroll, mountSteps, mountTenure } from './pinned.js';
import { mountCalculator } from './calculator.js';
import { mountApply } from './apply.js';
import { mountEnquiry } from './enquiry.js';
import { mountLicence } from './licence.js';

// Accordions and the Five Cs share one disclosure pattern.
function mountDisclosure(root, { single = true, groupClass } = {}) {
  const btns = $$('button[aria-controls]', root);
  const group = root;
  const set = (b, open) => {
    b.setAttribute('aria-expanded', String(open));
    const panel = document.getElementById(b.getAttribute('aria-controls'));
    if (panel) panel.hidden = !open;
    b.closest('li')?.classList.toggle('is-open', open);
    if (groupClass) group.classList.toggle(groupClass, btns.some((x) => x.getAttribute('aria-expanded') === 'true'));
  };
  btns.forEach((b) => set(b, b.getAttribute('aria-expanded') === 'true'));
  const onClick = (e) => {
    const b = e.target.closest('button[aria-controls]'); if (!b || !root.contains(b)) return;
    const open = b.getAttribute('aria-expanded') !== 'true';
    if (single) btns.forEach((x) => x !== b && set(x, false));
    set(b, open);
    window.ScrollTrigger?.refresh();
  };
  const onKey = (e) => {
    const i = btns.indexOf(document.activeElement); if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowDown') j = (i + 1) % btns.length; else if (e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
    if (j >= 0) { e.preventDefault(); btns[j].focus(); }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); };
}

function calculators(main) {
  return $$('[data-calculator]', main).map((c) => mountCalculator(c));
}

export const pageModules = {
  home: {
    init(main, { lenis }) {
      const off = [];
      const canvas = $('[data-guilloche]', main);
      if (canvas && !reducedMotion()) off.push(mountGuilloche(canvas, { color: 'rgba(15,16,18,1)' }));
      const prod = $('#products', main); if (prod) { const h = mountHScroll(prod, lenis); off.push(() => h?.revert()); }
      const steps = $('[data-steps]', main); if (steps) { const m = mountSteps(steps); off.push(() => m?.revert?.()); }
      const cs = $('[data-cs]', main); if (cs) off.push(mountDisclosure(cs, { groupClass: 'has-open' }));
      const calcs = calculators(main); off.push(() => calcs.forEach((c) => c.destroy()));
      off.push(mountSpan(main, lenis));
      return () => off.forEach((f) => f && f());
    },
  },
  about: {
    init(main) {
      const off = [];
      $$('[data-acc]', main).forEach((a) => off.push(mountDisclosure(a, { single: false })));
      return () => off.forEach((f) => f());
    },
  },
  loans: {
    init(main) {
      const off = [];
      mountTenure(main);
      const calcs = calculators(main); off.push(() => calcs.forEach((c) => c.destroy()));
      // Product matrix: highlight the column under the pointer
      const table = $('.matrix', main);
      if (table) {
        const onOver = (e) => {
          const cell = e.target.closest('td, th'); if (!cell) return;
          const i = cell.cellIndex;
          $$('tr', table).forEach((tr) => [...tr.children].forEach((c, j) => c.classList.toggle('is-col', j === i && i > 0)));
        };
        const onOut = () => $$('.is-col', table).forEach((c) => c.classList.remove('is-col'));
        table.addEventListener('pointerover', onOver); table.addEventListener('pointerleave', onOut);
        off.push(() => { table.removeEventListener('pointerover', onOver); table.removeEventListener('pointerleave', onOut); });
      }
      return () => off.forEach((f) => f());
    },
  },
  'how-we-lend': {
    init(main) {
      const off = [];
      const steps = $('[data-steps]', main); if (steps) mountSteps(steps);
      const cs = $('[data-cs]', main); if (cs) off.push(mountDisclosure(cs, { groupClass: 'has-open' }));
      off.push(mountSelfCheck(main));
      $$('[data-print]', main).forEach((b) => {
        const f = () => {
          const h = document.documentElement;
          h.classList.add('print-checklist');
          const done = () => { h.classList.remove('print-checklist'); window.removeEventListener('afterprint', done); };
          window.addEventListener('afterprint', done);
          window.print();
          setTimeout(done, 1000);
        };
        b.addEventListener('click', f); off.push(() => b.removeEventListener('click', f));
      });
      return () => off.forEach((f) => f && f());
    },
  },
  terms: {
    init(main) {
      const bar = $('[data-anatomy]', main);
      if (bar && !reducedMotion() && window.gsap) {
        const segs = $$('.anatomy__seg', bar);
        window.gsap.from(segs, { scaleX: 0, transformOrigin: '0% 50%', duration: 0.8, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: bar, start: 'top 85%', once: true } });
      }
    },
  },
  faq: { init(main) { const a = $('[data-acc]', main); return a ? mountDisclosure(a, { single: false }) : undefined; } },
  licence: { init(main) { return mountLicence(main); } },
  contact: { init(main) { return mountEnquiry(main); } },
  apply: { init(main) { return mountApply(main); } },
  profile: { init(main) { $$('[data-print]', main).forEach((b) => b.addEventListener('click', () => window.print())); } },
};

// Non-binding self-check: six yes/no questions drawn from the eligibility list. No score, no verdict.
function mountSelfCheck(main) {
  const form = $('[data-selfcheck]', main);
  if (!form) return () => {};
  const out = $('[data-selfcheck-out]', main);
  const onChange = () => {
    const total = $$('fieldset', form).length;
    const answered = $$('input[type="radio"]:checked', form).length;
    if (out) out.hidden = answered < total;
  };
  form.addEventListener('change', onChange);
  return () => form.removeEventListener('change', onChange);
}
