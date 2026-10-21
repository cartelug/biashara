// The three pinned sequences: home products (horizontal), how-we-lend (4 steps), loans (tenure ruler).
// Each pins only on desktop with motion allowed; everywhere else it falls back to normal flow.
import { $, $$, reducedMotion } from './utils.js';

const PIN_MQ = '(min-width: 1100px) and (prefers-reduced-motion: no-preference)';
const allowPin = () => !document.documentElement.classList.contains('rm');

export function mountHScroll(section, lenis) {
  const gs = window.gsap;
  const box = $('[data-hscroll]', section);
  const track = $('[data-hscroll-track]', section);
  const bar = $('[data-hscroll-bar]', section);
  if (!box || !track) return;
  let mm = gs.matchMedia();
  const setup = () => mm.add(PIN_MQ, () => {
    if (!allowPin()) return;
    section.classList.add('is-pinnable');
    // Pin only when every panel fits the screen height; on short laptop screens the
    // Apply button would sit below the fold for the whole sequence, so keep the stacked layout.
    if ($$('[data-hpanel]', track).some((el) => el.scrollHeight > el.clientHeight + 2)) { section.classList.remove('is-pinnable'); return; }
    const dist = () => Math.max(0, track.scrollWidth - box.clientWidth);
    const tween = gs.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: box, pin: true, start: 'top top', end: () => '+=' + dist(), scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => { if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; },
      },
    });
    // Drag to move through the panels (mouse only; touch scrolls normally)
    let down = false, x0 = 0, s0 = 0;
    const st = tween.scrollTrigger;
    const onDown = (e) => { if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('a, button')) return; down = true; x0 = e.clientX; s0 = window.scrollY; box.setPointerCapture(e.pointerId); box.classList.add('is-dragging'); };
    const onMove = (e) => {
      if (!down) return;
      const dx = x0 - e.clientX;
      const target = Math.min(st.end, Math.max(st.start, s0 + dx * 1.2));
      if (lenis) lenis.scrollTo(target, { immediate: true }); else window.scrollTo(0, target);
    };
    const onUp = () => { down = false; box.classList.remove('is-dragging'); };
    box.addEventListener('pointerdown', onDown); box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp); box.addEventListener('pointercancel', onUp);
    // Keyboard focus inside a panel scrolls that panel into view
    const onFocus = (e) => {
      const panel = e.target.closest('[data-hpanel]'); if (!panel) return;
      const i = [...track.children].indexOf(panel);
      const k = i / Math.max(1, track.children.length - 1);
      const y = st.start + (st.end - st.start) * k;
      if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
    };
    track.addEventListener('focusin', onFocus);
    return () => {
      section.classList.remove('is-pinnable');
      box.removeEventListener('pointerdown', onDown); box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp); box.removeEventListener('pointercancel', onUp);
      track.removeEventListener('focusin', onFocus);
    };
  });
  setup();
  // re-check the fit when the window height changes (matchMedia only watches the width)
  let lastH = window.innerHeight, t;
  const onResize = () => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(window.innerHeight - lastH) < 40) return; lastH = window.innerHeight; mm.revert(); mm = gs.matchMedia(); setup(); window.ScrollTrigger?.refresh(); }, 250); };
  window.addEventListener('resize', onResize);
  return { revert() { window.removeEventListener('resize', onResize); mm.revert(); } };
}

// Steps: the span connects the four steps; each lights its tile in turn.
export function mountSteps(section) {
  const gs = window.gsap;
  const pinEl = $('[data-steps-pin]', section);
  const line = $('[data-steps-line]', section);
  const steps = $$('[data-step]', section);
  if (!pinEl || !steps.length) return;
  const light = (k) => steps.forEach((s, i) => s.classList.toggle('is-lit', k >= (i + 0.15) / steps.length || (k >= 1 && i === steps.length - 1)));
  const mm = gs.matchMedia();
  mm.add(PIN_MQ, () => {
    if (!allowPin()) return;
    section.classList.add('is-pinnable');
    gs.set(line, { scaleX: 0 });
    gs.to(line, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: pinEl, pin: true, start: 'top top', end: '+=' + Math.round(window.innerHeight * 1.4), scrub: 0.5,
        onUpdate: (self) => light(self.progress), invalidateOnRefresh: true },
    });
    return () => section.classList.remove('is-pinnable');
  });
  mm.add('(max-width: 1099px), (prefers-reduced-motion: reduce)', () => {
    if (line) gs.set(line, { scaleX: 1 });
    const triggers = steps.map((s) => window.ScrollTrigger.create({ trigger: s, start: 'top 75%', onEnter: () => s.classList.add('is-lit'), onLeaveBack: () => s.classList.remove('is-lit') }));
    if (reducedMotion()) steps.forEach((s) => s.classList.add('is-lit'));
    return () => triggers.forEach((t) => t.kill());
  });
  return mm;
}

// Loans: the tenure ruler. Hovering or choosing a product slides its marker up to 6 months.
export function mountTenure(root) {
  const gs = window.gsap;
  const ruler = $('[data-tenure]', root);
  if (!ruler) return;
  const line = $('[data-tenure-line]', ruler);
  const marker = $('[data-tenure-marker]', ruler);
  const name = $('[data-tenure-name]', ruler);
  const buttons = $$('[data-tenure-product]', root);
  const track = $('.tenure__track', ruler);
  const go = (btn, instant) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    if (name) name.textContent = btn.dataset.tenureProduct + ' · up to 6 months';
    const w = track.clientWidth;
    if (reducedMotion() || instant) { gs.set(marker, { x: w }); gs.set(line, { scaleX: 1 }); return; }
    gs.fromTo(marker, { x: 0 }, { x: w, duration: 1.2, ease: 'expo.out', overwrite: true });
    gs.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', overwrite: true });
  };
  buttons.forEach((b) => { b.addEventListener('mouseenter', () => go(b)); b.addEventListener('focus', () => go(b)); b.addEventListener('click', () => go(b)); });
  const mm = gs.matchMedia();
  mm.add(PIN_MQ, () => {
    if (!allowPin()) return;
    const k = { v: 0 };
    gs.set(line, { scaleX: 0 });
    const st = gs.to(k, {
      v: 1, ease: 'none',
      scrollTrigger: { trigger: $('[data-tenure-pin]', root) || ruler, pin: true, start: 'top top+=' + Math.round(window.innerHeight * 0.12), end: '+=' + Math.round(window.innerHeight * 1.1), scrub: 0.5, invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          gs.set(line, { scaleX: p });
          gs.set(marker, { x: track.clientWidth * p });
          const i = Math.min(buttons.length - 1, Math.floor(p * buttons.length * 0.999));
          buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
          if (name && buttons[i]) name.textContent = buttons[i].dataset.tenureProduct + ' · up to 6 months';
        } },
    });
    return () => st.kill();
  });
  mm.add('(max-width: 1099px), (prefers-reduced-motion: reduce)', () => {
    if (buttons[0]) go(buttons[0], reducedMotion());
  });
  return mm;
}
