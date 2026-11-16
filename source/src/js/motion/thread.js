// The red thread (MOTION.md sections 1 and 8): one SVG path laid through the page in document coordinates.
// The back copy runs behind the content containers; a front copy, clipped to a few rectangles, crosses over them,
// so the thread reads as woven. A white copy, clipped to red sections, keeps it visible on red.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent?.append(n); return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Catmull-Rom through the points, written as cubic Béziers. Returns the path string and the segments,
// so lengths and points are computed here in plain arithmetic (getPointAtLength is far too slow on a long path).
function toCurves(pts) {
  const segs = [];
  if (pts.length < 2) return { d: '', segs };
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const t = (p1.k ?? 1) * 0.5 / 3;
    const c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
    const t2 = (p2.k ?? 1) * 0.5 / 3;
    const c2x = p2.x - (p3.x - p1.x) * t2, c2y = p2.y - (p3.y - p1.y) * t2;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    segs.push([p1.x, p1.y, c1x, c1y, c2x, c2y, p2.x, p2.y]);
  }
  return { d, segs };
}
const toPath = (pts) => toCurves(pts).d;

// Sample the cubics into a table: cumulative length, x, y, and the running maximum of y (so lookups by height only move forward).
function sample(segs, step) {
  const L = [0], X = [], Y = [], M = [];
  let len = 0, maxY = -Infinity, px = null, py = null;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segs) {
    const n = Math.max(2, Math.ceil((Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)) / step));
    for (let i = px === null ? 0 : 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      if (px !== null) { len += Math.hypot(x - px, y - py); L.push(len); }
      px = x; py = y; maxY = Math.max(maxY, y);
      X.push(x); Y.push(y); M.push(maxY);
    }
  }
  return { len: Float32Array.from(L), px: Float32Array.from(X), py: Float32Array.from(Y), y: Float32Array.from(M), total: len, n: X.length - 1 };
}

export function createThread({ main, tier, mobile, still }) {
  const back = el('svg', { class: 'thread', 'aria-hidden': 'true', focusable: 'false' });
  const defs = el('defs', {}, back);
  const uid = Math.random().toString(36).slice(2, 7);
  const redClip = el('clipPath', { id: `tr-${uid}` }, defs);
  const shade = el('path', { class: 'thread__shade' }, back);
  const line = el('path', { class: 'thread__line' }, back);
  const altG = el('g', { 'clip-path': `url(#tr-${uid})` }, back);
  const alt = el('path', { class: 'thread__alt' }, altG);
  const glow = el('circle', { class: 'thread__tipglow', r: mobile ? 7 : 10 }, back);
  const tip = el('circle', { class: 'thread__tip', r: mobile ? 3.5 : 4.5 }, back);
  const front = el('svg', { class: 'thread thread--front', 'aria-hidden': 'true', focusable: 'false' });
  const fClip = el('clipPath', { id: `tf-${uid}` }, el('defs', {}, front));
  const fG = el('g', { 'clip-path': `url(#tf-${uid})` }, front);
  const fLine = el('path', { class: 'thread__line' }, fG);
  const fAlt = el('path', { class: 'thread__alt' }, el('g', { 'clip-path': `url(#tr-${uid})` }, fG));
  main.prepend(back);
  if (tier === 'full' && !mobile) main.append(front);
  document.documentElement.classList.add('has-thread');
  const paths = [shade, line, alt, fLine, fAlt];

  let base = [];          // waypoints (main coordinates)
  let lut = { len: [], x: [], y: [], total: 0 };
  let mainTop = 0;
  let drawn = 0;          // current drawn length
  let knotLen = 0;        // the end of the route
  const state = { vel: 0, lean: null, tilt: 0, tiltTarget: 0, deformed: false, time: 0 };

  // ------------------------------------------------------------ route: measured from the page
  function route() {
    const mr = main.getBoundingClientRect();
    mainTop = mr.top + scrollY;
    const W = main.clientWidth;
    // Layout positions, ignoring transforms: entrances move things for a moment, the thread must not follow them.
    const R = (n) => {
      let x = 0, y = 0, e = n;
      while (e && e !== main && e !== document.body) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      if (e !== main) { const mb = main.getBoundingClientRect(); const r = n.getBoundingClientRect(); x = r.left - mb.left; y = r.top - mb.top; }
      const w = n.offsetWidth ?? n.getBoundingClientRect().width, h = n.offsetHeight ?? n.getBoundingClientRect().height;
      return { l: x, r: x + w, t: y, b: y + h, w, h, cx: x + w / 2, cy: y + h / 2 };
    };
    // The last line of a heading's text, so the underline sits under the words, not under the whole box.
    const lastLine = (h) => {
      const H = R(h);
      try {
        const range = document.createRange(); range.selectNodeContents(h);
        const rects = [...range.getClientRects()].filter((q) => q.width > 2);
        if (!rects.length) return H;
        const bottom = Math.max(...rects.map((q) => q.bottom));
        const line = rects.filter((q) => Math.abs(q.bottom - bottom) < 6);
        const hb = h.getBoundingClientRect();
        const left = Math.min(...line.map((q) => q.left)) - hb.left, right = Math.max(...line.map((q) => q.right)) - hb.left;
        return { ...H, l: H.l + left, r: H.l + right, w: right - left };
      } catch { return H; }
    };
    const firstContainer = main.querySelector('.container');
    const c = firstContainer ? R(firstContainer) : { l: 0, r: W };
    const pad = parseFloat(getComputedStyle(firstContainer || main).paddingLeft) || 20;
    const gl = clamp(c.l + pad * 0.42, 6, 60);
    const gr = W - gl;
    const pts = [];
    const fronts = [];
    const reds = [];
    const P = (x, y, k) => pts.push({ x: clamp(x, 3, W - 3), y, k });
    const visible = (n) => n && n.offsetParent !== null && n.getClientRects().length;

    const sections = [...main.children].filter((s) => s.matches('section, .section, .notes') && !s.matches('.thread') && visible(s));
    let side = 'l';
    sections.forEach((s, si) => {
      const S = R(s);
      if (s.matches('.cta-band, .section--red') || s.classList.contains('bleed') && s.matches('.cta-band')) reds.push(S);
      const h = s.querySelector('.hero h1, .page-head h1, .nf h1, .section-head h2, .licence-strip__no, .cta-band h2');
      const media = s.matches('.hero') ? s.querySelector('.hero__media .ph') : s.querySelector(':scope > .container > .ph, :scope > .container > figure > .ph, .page-head__aside .ph, .split > .ph');
      const steps = s.querySelector('.steps');
      const stats = s.querySelector('.stats');
      const knot = s.matches('.cta-band, .foot-cta') ? s.querySelector('.btn') : null;
      const pinned = s.dataset.pinned === 'true';

      if (si === 0 && s.matches('.hero') && h && media && !mobile) {
        // Desktop hero: the thread enters from the left where the film's cut left the screen, underlines the headline,
        // rises to the photo, crosses over its top-left corner, runs behind it and leaves from its bottom-right.
        const L = lastLine(h), M = R(media);
        const uy = L.b + 10;
        P(-30, uy + 40); P(L.l - 10, uy + 4, .9); P(L.l + L.w * .5, uy + 8, .9); P(L.r + 6, uy, .9);
        fronts.push({ l: L.l - 14, t: uy - 16, r: L.r + 18, b: uy + 18 });
        P(M.l - 30, M.t + 40, 1.1); P(M.l + 20, M.t - 22, .9);
        fronts.push({ l: M.l - 50, t: M.t - 44, r: M.l + 50, b: M.t + 30 });
        P(M.cx, M.cy, 1.1); P(M.r + 22, M.b - 30, .9);
        fronts.push({ l: M.r - 30, t: M.b - 70, r: Math.min(W, M.r + 50), b: M.b + 10 });
        P(gr, M.b + 20); P(gr, S.b - 20); side = 'r';
        return;
      }
      if (si === 0) { P(-30, S.t + 70); P(gl, S.t + 96); }
      else {
        // cross from the side we are on to the left gutter in the section's top padding
        const y0 = S.t + Math.min(36, S.h * .1);
        if (side === 'r') { P(gr, S.t - 10); P((gl + gr) / 2, y0, 1.1); }
        P(gl, y0 + 24);
        side = 'l';
      }
      if (pinned) { P(gl, S.b - 30); side = 'l'; return; }
      if (h && visible(h)) {
        const H = lastLine(h);
        // underline: under the heading's first line, left to right, with a little lift at the end
        const lh = parseFloat(getComputedStyle(h).lineHeight) || 40;
        const uy = H.b + Math.min(10, lh * .2);
        const ul = Math.max(Math.min(H.w + 12, W - H.l - gl - 8), 60);
        P(gl, uy - 8);
        P(H.l - 4, uy, .8);
        P(H.l + ul * .55, uy + 3, .9);
        P(H.l + ul, uy - 4, .9);
        fronts.push({ l: H.l - 8, t: uy - 14, r: H.l + ul + 12, b: uy + 14 });
        if (!knot) { P(gr, uy + 6); side = 'r'; } else if (mobile) { P(gl, uy + 18); side = 'l'; }
      }
      if (stats && visible(stats)) {
        // the thread bends into a growth curve above the figures; each point is one statistic
        const T = R(stats);
        const cells = [...stats.children].filter(visible).map(R);
        // stay inside the gap between the introduction and the figures
        const above = stats.previousElementSibling ? R(stats.previousElementSibling).b : T.t - 60;
        const gap = Math.max(16, T.t - above);
        const top = T.t - Math.min(16, gap * .3);
        const cellsInRow = [...stats.children].filter((x) => visible(x) && Math.abs(R(x).t - T.t) < 4).length || 1;
        const rise = Math.max(0, Math.min(14, (top - above - 10) / (cellsInRow + 1)));
        const rowOne = cells.filter((x) => Math.abs(x.t - cells[0].t) < 4);
        const curve = rowOne.map((cell, i) => ({ x: cell.cx, y: top - i * rise }));
        const peak = top - rowOne.length * rise - 4;
        // A growth curve reads left to right; coming from the right it is simply drawn from its high end.
        if (side === 'r') {
          P(gr, peak - 6); P(T.r - 2, peak, .8);
          curve.reverse().forEach((q) => P(q.x, q.y, .9));
          P(gl, top + 8); side = 'l';
        } else {
          P(gl, top + 6);
          curve.forEach((q) => P(q.x, q.y, .9));
          P(T.r - 2, peak, .8); P(gr, peak + 10); side = 'r';
        }
        fronts.push({ l: T.l - 10, t: peak - 18, r: T.r + 10, b: top + 12 });
        P(side === 'r' ? gr : gl, T.b + 10);
      }
      if (steps && visible(steps)) {
        // through the step numbers: beads on a string
        const nums = [...steps.querySelectorAll('.step__n')].map(R);
        const horizontal = nums.length > 1 && Math.abs(nums[1].t - nums[0].t) < 4;
        P(side === 'r' ? gr : gl, nums[0].cy - (horizontal ? 40 : 30));
        nums.forEach((n) => P(n.cx, n.cy, horizontal ? 1 : .6));
        const last = nums[nums.length - 1];
        P(horizontal ? gr : last.cx, horizontal ? last.cy + 30 : last.cy + 60);
        side = horizontal ? 'r' : 'l';
      }
      if (media && visible(media)) {
        // wrap the photo: over its top-right corner, behind it, out at the bottom-left
        const M = R(media);
        P(side === 'r' ? gr : M.r + 22, M.t - 26);
        P(M.r + 20, M.t + 26, .9);
        fronts.push({ l: M.r - 60, t: M.t - 40, r: Math.min(W, M.r + 40), b: M.t + 34 });
        P(M.cx, M.cy, 1.1);
        P(M.l - 18, M.b - 12, .9);
        fronts.push({ l: Math.max(0, M.l - 40), t: M.b - 50, r: M.l + 30, b: M.b + 30 });
        P(gl, M.b + 30); side = 'l';
      }
      if (knot && visible(knot)) {
        // the finale: the thread ties a knot around the call to action and leaves a loose end
        const B = R(knot);
        const rx = B.w / 2 + 8, ry = B.h / 2 + 10;
        if (mobile) P(gl, B.t - 30); else P(B.l - 34, B.t - 26, .9);
        P(B.l - 26, B.cy, .9);
        P(B.cx, B.t - ry + B.h / 2 - 2, .9);
        P(B.cx + rx, B.cy, .9);
        P(B.cx, B.cy + ry, .9);
        P(B.cx - rx + 8, B.cy - 6, .9);
        P(B.cx - rx * .4, B.t - 12, .8);
        fronts.push({ l: B.l - 30, t: B.t - 30, r: B.cx, b: B.cy });
        P(B.l - 36, B.b + 36, .8);
        knotLen = -1; // marks the end
        return;
      }
      // descend this section in the current gutter
      P(side === 'r' ? gr : gl, S.b - 20);
    });
    // densify long straight gutter runs so ripples have something to bend
    const dense = [];
    pts.forEach((p, i) => {
      const q = pts[i + 1];
      dense.push(p);
      if (!q) return;
      const dy = q.y - p.y, dx = q.x - p.x;
      if (Math.abs(dy) > 180 && Math.abs(dx) < Math.abs(dy) * .4) {
        const n = Math.floor(Math.abs(dy) / 140);
        for (let j = 1; j <= n; j++) dense.push({ x: p.x + dx * j / (n + 1), y: p.y + dy * j / (n + 1), k: 1, g: true });
      }
    });
    return { pts: dense, fronts, reds, height: main.scrollHeight };
  }

  function setRects(clip, rects) {
    clip.textContent = '';
    rects.forEach((r) => el('rect', { x: r.l, y: r.t, width: Math.max(0, r.r - r.l), height: Math.max(0, r.b - r.t) }, clip));
  }

  let segs = [];
  function buildLut() {
    lut = sample(segs, mobile ? 8 : 6);
    // the drawn length is measured in the same units as the table, whatever the browser's own measurement
    paths.forEach((p) => p.setAttribute('pathLength', lut.total.toFixed(1)));
  }
  const lenAtY = (ty) => {
    const { y, len, n } = lut;
    if (!n) return 0;
    if (ty <= y[0]) return 0;
    if (ty >= y[n]) return lut.total;
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (y[m] < ty) lo = m; else hi = m; }
    const f = (ty - y[lo]) / ((y[hi] - y[lo]) || 1);
    return len[lo] + (len[hi] - len[lo]) * f;
  };
  const pointAt = (l) => {
    const { n, len } = lut;
    if (!n) return { x: 0, y: 0 };
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] < l) lo = m; else hi = m; }
    const f = clamp((l - len[lo]) / ((len[hi] - len[lo]) || 1), 0, 1);
    return { x: lut.px[lo] + (lut.px[hi] - lut.px[lo]) * f, y: lut.py[lo] + (lut.py[hi] - lut.py[lo]) * f };
  };

  function setD(d) { paths.forEach((p) => p.setAttribute('d', d)); }

  function layout() {
    const r = route();
    base = r.pts;
    [back, front].forEach((s) => { s.style.height = r.height + 'px'; s.setAttribute('viewBox', `0 0 ${main.clientWidth} ${r.height}`); s.style.width = main.clientWidth + 'px'; });
    setRects(redClip, r.reds);
    setRects(fClip, r.fronts);
    const curves = toCurves(base);
    segs = curves.segs;
    setD(curves.d);
    buildLut();
    paths.forEach((p) => { p.style.strokeDasharray = `${lut.total} ${lut.total * 2 + 10}`; });
    state.deformed = false;
    if (still) { drawn = lut.total; paint(true); }
  }

  // ------------------------------------------------------------ deformation: ripple with speed, lean to pointer, tilt
  function deform(vy) {
    const strong = tier === 'full';
    const amp = strong ? clamp(Math.abs(state.vel) * (mobile ? .25 : .5), 0, mobile ? 12 : 26) : 0;
    const lean = state.lean;
    const tilt = state.tilt;
    const active = amp > .4 || (lean && lean.s > .02) || Math.abs(tilt) > .5;
    if (!active) { if (state.deformed) { setD(toPath(base)); state.deformed = false; } return; }
    const top = vy - 300, bottom = vy + innerHeight + 300;
    const t = state.time;
    const pts = base.map((p) => {
      if (p.y < top || p.y > bottom) return p;
      let dx = amp * Math.sin(p.y * .011 + t * 5.5) * (p.g ? 1 : .55) + tilt;
      let dy = 0;
      if (lean && lean.s > .02) {
        const ax = lean.x - p.x, ay = lean.y - p.y;
        const dist = Math.hypot(ax, ay);
        const R = mobile ? 200 : 280;
        if (dist < R) { const f = (1 - dist / R) ** 2 * lean.s; dx += clamp(ax * .22 * f, -44, 44); dy += clamp(ay * .1 * f, -24, 24); }
      }
      return { x: p.x + dx, y: p.y + dy, k: p.k };
    });
    setD(toPath(pts));
    state.deformed = true;
  }

  // ------------------------------------------------------------ paint: the drawn length follows the reading position
  function paint(force) {
    const off = lut.total - drawn;
    paths.forEach((p) => { p.style.strokeDashoffset = off.toFixed(1); });
    const pt = pointAt(drawn);
    const show = drawn > 2 && drawn < lut.total - 2;
    tip.setAttribute('cx', pt.x.toFixed(1)); tip.setAttribute('cy', pt.y.toFixed(1));
    glow.setAttribute('cx', pt.x.toFixed(1)); glow.setAttribute('cy', pt.y.toFixed(1));
    const o = show || force ? '1' : '0';
    if (tip.style.opacity !== o) { tip.style.opacity = o; glow.style.opacity = show ? '' : '0'; }
  }

  let last = performance.now();
  function frame(scrollTop, velocity) {
    const now = performance.now(); const dt = Math.min(64, now - last) / 16.67; last = now;
    state.time += dt / 60;
    state.vel += (velocity - state.vel) * .2;
    if (state.lean) { state.lean.s += ((state.lean.on ? 1 : 0) - state.lean.s) * .08 * dt; if (!state.lean.on && state.lean.s < .01) state.lean = null; }
    state.tilt += (state.tiltTarget - state.tilt) * .06 * dt;
    if (still) return;
    const vy = scrollTop - mainTop;
    const atEnd = scrollTop >= document.documentElement.scrollHeight - innerHeight - 4;
    const lead = clamp(state.vel * 10, -100, mobile ? 160 : 280);
    const target = atEnd ? lut.total : lenAtY(vy + innerHeight * .65 + lead);
    drawn += (target - drawn) * Math.min(1, .16 * dt);
    if (Math.abs(target - drawn) < .5) drawn = target;
    deform(vy);
    paint();
  }

  // pointer, touch and tilt
  function setLean(clientX, clientY, on) {
    const x = clientX - main.getBoundingClientRect().left;
    const y = clientY + scrollY - mainTop;
    if (!state.lean) state.lean = { x, y, s: 0, on };
    state.lean.x = x; state.lean.y = y; state.lean.on = on;
  }
  const offs = [];
  if (tier === 'full' && !still) {
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) {
      const mv = (e) => setLean(e.clientX, e.clientY, true);
      const lv = () => { if (state.lean) state.lean.on = false; };
      addEventListener('pointermove', mv, { passive: true }); document.addEventListener('pointerleave', lv);
      offs.push(() => { removeEventListener('pointermove', mv); document.removeEventListener('pointerleave', lv); });
    } else {
      const tm = (e) => { const t = e.touches[0]; if (t) setLean(t.clientX, t.clientY, true); };
      const te = () => { if (state.lean) state.lean.on = false; };
      addEventListener('touchmove', tm, { passive: true }); addEventListener('touchend', te, { passive: true });
      offs.push(() => { removeEventListener('touchmove', tm); removeEventListener('touchend', te); });
      // Device tilt only where the browser offers it without a permission prompt (not iOS Safari).
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
        const or = (e) => { if (e.gamma != null) state.tiltTarget = clamp(e.gamma * .5, -16, 16); };
        addEventListener('deviceorientation', or, { passive: true });
        offs.push(() => removeEventListener('deviceorientation', or));
      }
    }
  }

  layout();
  return {
    layout, frame,
    get total() { return lut.total; },
    lenAtY, pointAt,
    destroy() { offs.forEach((f) => f()); back.remove(); front.remove(); document.documentElement.classList.remove('has-thread'); },
  };
}
