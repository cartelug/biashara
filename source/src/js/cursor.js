// Desktop cursor (fine pointers only): a small red square that becomes VIEW on images,
// DRAG on the horizontal scroller and APPLY on primary calls to action. Buttons pull up to 8px.
import { finePointer, reducedMotion } from './utils.js';

export function mountCursor() {
  const el = document.querySelector('[data-cursor-el]');
  if (!el || !finePointer()) return () => {};
  const label = el.querySelector('[data-cursor-label]');
  const gs = window.gsap;
  document.documentElement.classList.add('has-cursor');
  const rm = reducedMotion();
  const xTo = rm ? (v) => gs.set(el, { x: v }) : gs.quickTo(el, 'x', { duration: 0.18, ease: 'power3.out' });
  const yTo = rm ? (v) => gs.set(el, { y: v }) : gs.quickTo(el, 'y', { duration: 0.18, ease: 'power3.out' });
  const words = { view: 'View', drag: 'Drag', apply: 'Apply' };
  let current = '';
  const onMove = (e) => {
    xTo(e.clientX); yTo(e.clientY);
    const t = e.target.closest?.('[data-cursor]');
    const kind = t ? t.dataset.cursor : '';
    if (kind !== current) {
      current = kind;
      el.classList.toggle('has-label', !!kind);
      label.textContent = words[kind] || '';
    }
    // hide the custom cursor over form fields so the text caret stays clear
    el.classList.toggle('is-hidden', !!e.target.closest?.('input, textarea, select, [role="slider"], dialog'));
  };
  const onDown = () => el.classList.add('is-down');
  const onUp = () => el.classList.remove('is-down');
  const onLeave = () => el.classList.add('is-hidden');
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  document.documentElement.addEventListener('pointerleave', onLeave);

  // Magnetic buttons: pull of at most 8px toward the pointer.
  const onMagMove = (e) => {
    const b = e.target.closest?.('[data-magnetic]');
    if (!b || rm) return;
    const r = b.getBoundingClientRect();
    const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * 8;
    const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * 8;
    gs.to(b, { x: Math.max(-8, Math.min(8, dx)), y: Math.max(-8, Math.min(8, dy)), duration: 0.3, ease: 'power3.out' });
  };
  const onMagOut = (e) => {
    const b = e.target.closest?.('[data-magnetic]');
    if (b && !b.contains(e.relatedTarget)) gs.to(b, { x: 0, y: 0, duration: 0.5, ease: 'expo.out', clearProps: 'transform' });
  };
  document.addEventListener('pointermove', onMagMove, { passive: true });
  document.addEventListener('pointerout', onMagOut);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointermove', onMagMove);
    document.removeEventListener('pointerout', onMagOut);
  };
}
