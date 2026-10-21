// Guilloche: procedurally generated rosettes and wave bands (hypotrochoid / epitrochoid maths).
// The maths is shared by the build (static SVG fallbacks) and the browser (live hero canvas).

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// One trochoid curve, returned as a flat array of [x, y] points centred on 0,0.
export function trochoid({ R = 120, r = 37, d = 64, epi = false, steps = 1400, phase = 0 }) {
  const turns = r / gcd(R, r);
  const tMax = Math.PI * 2 * turns;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * tMax;
    let x, y;
    if (epi) {
      const k = (R + r) / r;
      x = (R + r) * Math.cos(t) - d * Math.cos(k * t);
      y = (R + r) * Math.sin(t) - d * Math.sin(k * t);
    } else {
      const k = (R - r) / r;
      x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
      y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    }
    const c = Math.cos(phase), s = Math.sin(phase);
    pts.push([x * c - y * s, x * s + y * c]);
  }
  return pts;
}

// A rosette is several trochoids layered with small changes, like an engraved security seal.
export function rosette(scale = 1) {
  const layers = [
    { R: 150, r: 41, d: 92, steps: 2400 },
    { R: 150, r: 41, d: 76, steps: 2400, phase: Math.PI / 41 },
    { R: 96, r: 23, d: 44, epi: true, steps: 2000 },
    { R: 60, r: 13, d: 30, steps: 1200 },
  ];
  return layers.map((l) => trochoid(l).map(([x, y]) => [x * scale, y * scale]));
}

// Wave band: stacked sine lines whose amplitude is modulated, like a cheque border.
export function waveBand({ width = 1200, height = 120, lines = 14, waves = 9 } = {}) {
  const out = [];
  for (let j = 0; j < lines; j++) {
    const pts = [];
    const off = (j / (lines - 1)) * Math.PI;
    for (let i = 0; i <= 600; i++) {
      const u = i / 600;
      const x = u * width;
      const amp = (height / 2) * (0.35 + 0.65 * Math.abs(Math.sin(u * Math.PI * 2 + off * 0.5)));
      const y = height / 2 + amp * Math.sin(u * Math.PI * 2 * waves + off);
      pts.push([x, y]);
    }
    out.push(pts);
  }
  return out;
}

export function toPath(pts, dp = 1) {
  const f = (n) => n.toFixed(dp).replace(/\.0$/, '');
  return 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L');
}

// ---------------------------------------------------------------------------
// Browser: the live hero rosette. Drawn once to the canvas, then the canvas
// element itself is rotated (transform only) very slowly, nudged by the cursor.
// ---------------------------------------------------------------------------
export function mountGuilloche(canvas, { color = 'rgba(15,16,18,1)', reduced = false } = {}) {
  if (!canvas || !canvas.getContext) return () => {};
  const ctx = canvas.getContext('2d');
  const draw = () => {
    const box = canvas.getBoundingClientRect();
    const size = Math.max(10, Math.round(Math.min(box.width, box.height)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    const scale = (size / 2) / 290;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    for (const layer of rosette(scale)) {
      ctx.beginPath();
      layer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  };
  draw();
  let raf = 0, angle = 0, nudge = 0, target = 0, last = performance.now(), visible = true;
  const onMove = (e) => { target = ((e.clientX / window.innerWidth) - 0.5) * 6; };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !reduced) raf = requestAnimationFrame(tick); });
  io.observe(canvas);
  function tick(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(64, now - last); last = now;
    angle += dt * 0.0012;            // one turn every ~5 minutes
    nudge += (target - nudge) * 0.04; // a few degrees with the cursor
    canvas.style.transform = `rotate(${(angle + nudge).toFixed(3)}deg)`;
    raf = requestAnimationFrame(tick);
  }
  if (!reduced) {
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
  }
  let rT;
  const onResize = () => { clearTimeout(rT); rT = setTimeout(draw, 150); };
  window.addEventListener('resize', onResize);
  return () => {
    cancelAnimationFrame(raf); io.disconnect();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', onResize);
  };
}
