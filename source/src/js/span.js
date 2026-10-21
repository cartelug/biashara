// The span on the home page: one 1px red line that runs from the bridge in the hero,
// down the margins and across each numbered section like a bridge deck between piers.
import { $, $$, clamp, reducedMotion } from './utils.js';

export function mountSpan(main, lenis) {
  const layer = $('[data-span-layer]', main);
  const svg = $('[data-span-svg]', main);
  const path = $('[data-span-path]', main);
  if (!layer || !svg || !path) return () => {};
  let segs = [], total = 0, layerTop = 0;

  function compute() {
    const lr = layer.getBoundingClientRect();
    layerTop = lr.top + window.scrollY;
    const W = lr.width;
    const H = lr.height;
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const margin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--margin')) || 24;
    const xL = Math.max(6, margin * 0.5), xR = W - Math.max(6, margin * 0.5);
    const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - lr.left, y: r.top - lr.top, w: r.width, h: r.height }; };
    const pts = [];
    const heroSpan = $('[data-hero-span]', main);
    if (heroSpan) { const r = rel(heroSpan); pts.push([r.x + r.w, r.y]); pts.push([xR, r.y]); }
    let side = 'R';
    for (const head of $$('.secthead[data-pier]', main)) {
      const r = rel(head);
      const y = r.y - 0.5;
      const xFrom = side === 'R' ? xR : xL;
      const xTo = side === 'R' ? xL : xR;
      pts.push([xFrom, y]); pts.push([xTo, y]);
      side = side === 'R' ? 'L' : 'R';
    }
    if (pts.length < 2) { path.setAttribute('d', ''); segs = []; return; }
    // Build segments; horizontal ones are drawn over a short scroll distance once the head reaches them.
    segs = []; total = 0;
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      segs.push({ y0, y1, len, horizontal: Math.abs(y1 - y0) < 1 });
      total += len;
      d += `L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    path.setAttribute('d', d);
    path.style.strokeDasharray = `${total} ${total}`;
    update();
  }

  function update() {
    if (!segs.length) return;
    if (reducedMotion()) { path.style.strokeDashoffset = '0'; return; }
    const vh = window.innerHeight;
    const head = window.scrollY + vh * 0.62 - layerTop;
    const hRun = vh * 0.32;
    let drawn = 0;
    for (const s of segs) {
      if (s.horizontal) {
        const k = clamp((head - s.y0) / hRun, 0, 1);
        drawn += s.len * k;
        if (k < 1) break;
      } else {
        const k = clamp((head - s.y0) / (s.y1 - s.y0), 0, 1);
        drawn += s.len * k;
        if (k < 1) break;
      }
    }
    path.style.strokeDashoffset = String(total - drawn);
  }

  const ST = window.ScrollTrigger;
  const onRefresh = () => compute();
  ST?.addEventListener('refresh', onRefresh);
  const onScroll = () => update();
  window.addEventListener('scroll', onScroll, { passive: true });
  lenis?.on('scroll', onScroll);
  const ro = new ResizeObserver(() => compute());
  ro.observe(main);
  compute();
  return () => {
    ST?.removeEventListener('refresh', onRefresh);
    window.removeEventListener('scroll', onScroll);
    lenis?.off?.('scroll', onScroll);
    ro.disconnect();
  };
}
