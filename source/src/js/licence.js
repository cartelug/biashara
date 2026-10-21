// Licence page: numbered hotspots on the certificate tied to the details ledger,
// a zoom-and-pan lightbox, and the red span drawn under the licence number.
import { $, $$, clamp, reducedMotion } from './utils.js';

export function mountLicence(main) {
  const offs = [];
  const listen = (el, type, fn, o) => { if (!el) return; el.addEventListener(type, fn, o); offs.push(() => el.removeEventListener(type, fn, o)); };
  const doc = $('[data-licence-doc]', main);
  const ledger = $('[data-certledger]', main);
  const spots = $$('.hotspot', doc || main);

  // Hotspots: placed from data-x / data-y (percent of the certificate image)
  spots.forEach((b) => { b.style.left = b.dataset.x + '%'; b.style.top = b.dataset.y + '%'; b.classList.remove('needs-js'); });
  const rowOf = (b) => document.getElementById(b.getAttribute('aria-controls'));
  const light = (b, on) => {
    b.classList.toggle('is-hot', on);
    rowOf(b)?.classList.toggle('is-hot', on);
  };
  const select = (b) => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    spots.forEach((x) => { x.setAttribute('aria-expanded', 'false'); x.classList.remove('is-on'); rowOf(x)?.classList.remove('is-on'); });
    if (open) {
      b.setAttribute('aria-expanded', 'true'); b.classList.add('is-on');
      const row = rowOf(b); row?.classList.add('is-on');
      if (row && !window.matchMedia('(min-width: 1100px)').matches) row.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  };
  spots.forEach((b) => {
    listen(b, 'click', (e) => { e.stopPropagation(); select(b); });
    listen(b, 'pointerenter', () => light(b, true));
    listen(b, 'pointerleave', () => light(b, false));
    listen(b, 'focus', () => light(b, true));
    listen(b, 'blur', () => light(b, false));
  });
  $$('[id^="lr-"]', ledger || main).forEach((row) => {
    const b = spots.find((x) => x.getAttribute('aria-controls') === row.id);
    if (!b) return;
    listen(row, 'pointerenter', () => light(b, true));
    listen(row, 'pointerleave', () => light(b, false));
  });

  // The span under the licence number
  const span = $('[data-licence-span]', main);
  if (span) {
    if (window.gsap && !reducedMotion()) {
      window.gsap.fromTo(span, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', delay: 0.2, scrollTrigger: { trigger: span, start: 'top 90%', once: true } });
    } else span.classList.add('is-drawn');
  }

  // Lightbox with zoom and pan
  const dlg = $('[data-lightbox]', main);
  const openBtn = $('[data-lightbox-open]', main);
  if (dlg && openBtn && typeof dlg.showModal === 'function') {
    const stage = $('[data-lightbox-stage]', dlg);
    const img = $('[data-lightbox-img]', dlg);
    let z = 1, x = 0, y = 0;
    const paint = () => {
      const r = stage.getBoundingClientRect();
      const w = img.clientWidth * z, h = img.clientHeight * z;
      const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
      x = clamp(x, -mx, mx); y = clamp(y, -my, my);
      img.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
      stage.classList.toggle('is-zoomed', z > 1);
      $('[data-zoom="out"]', dlg).disabled = z <= 1;
      $('[data-zoom="in"]', dlg).disabled = z >= 4;
    };
    const zoom = (dz) => { z = clamp(+(z + dz).toFixed(2), 1, 4); if (z === 1) { x = 0; y = 0; } paint(); };
    listen(openBtn, 'click', () => { z = 1; x = 0; y = 0; img.loading = 'eager'; dlg.showModal(); document.documentElement.classList.add('has-dialog'); paint(); });
    listen(dlg, 'close', () => { document.documentElement.classList.remove('has-dialog'); openBtn.focus(); });
    listen($('[data-lightbox-close]', dlg), 'click', () => dlg.close());
    listen($('[data-zoom="in"]', dlg), 'click', () => zoom(0.5));
    listen($('[data-zoom="out"]', dlg), 'click', () => zoom(-0.5));
    listen(dlg, 'click', (e) => { if (e.target === dlg) dlg.close(); });
    listen(stage, 'wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 0.25 : -0.25); }, { passive: false });
    listen(stage, 'dblclick', () => zoom(z > 1 ? -9 : 1));
    let drag = null;
    listen(stage, 'pointerdown', (e) => { if (z <= 1) return; drag = { sx: e.clientX - x, sy: e.clientY - y }; stage.setPointerCapture(e.pointerId); stage.classList.add('is-dragging'); });
    listen(stage, 'pointermove', (e) => { if (!drag) return; x = e.clientX - drag.sx; y = e.clientY - drag.sy; paint(); });
    const end = () => { drag = null; stage.classList.remove('is-dragging'); };
    listen(stage, 'pointerup', end); listen(stage, 'pointercancel', end);
    listen(dlg, 'keydown', (e) => {
      const k = e.key;
      if (k === '+' || k === '=') zoom(0.5);
      else if (k === '-') zoom(-0.5);
      else if (k === '0') zoom(-9);
      else if (z > 1 && k.startsWith('Arrow')) {
        e.preventDefault();
        const d = 40;
        if (k === 'ArrowLeft') x += d; if (k === 'ArrowRight') x -= d; if (k === 'ArrowUp') y += d; if (k === 'ArrowDown') y -= d;
        paint();
      } else return;
    });
    listen(window, 'resize', () => dlg.open && paint());
  }
  return () => offs.forEach((f) => f());
}
