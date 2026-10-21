// Odometer: vertical digit reels that roll to a value (tabular figures, transform only).
import { reducedMotion } from './utils.js';

const DIGITS = '0123456789';

function reel(d) {
  const r = document.createElement('span');
  r.className = 'reel';
  r.dataset.d = d;
  const s = document.createElement('span');
  s.className = 'reel__strip';
  for (const x of DIGITS) { const c = document.createElement('span'); c.textContent = x; s.appendChild(c); }
  r.appendChild(s);
  return r;
}
function stat(ch) {
  const s = document.createElement('span');
  s.className = 'reel-static';
  s.textContent = ch === ' ' ? ' ' : ch;
  return s;
}
const setStrip = (r, d, animate = true, delay = 0) => {
  const strip = r.firstElementChild;
  const y = `translateY(-${Number(d) * 10}%)`;
  if (!animate || reducedMotion() || !strip.animate) { strip.style.transform = y; r.classList.remove(...[...r.classList].filter((c) => c.startsWith('d-'))); return; }
  const from = getComputedStyle(strip).transform;
  strip.style.transform = y;
  r.classList.remove(...[...r.classList].filter((c) => c.startsWith('d-')));
  strip.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: y }], { duration: 640, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
};

// Live odometer for changing values (calculator, ledger). Keeps an sr-only copy of the value.
export class Odometer {
  constructor(el) {
    this.el = el;
    this.value = el.textContent.trim();
    el.textContent = '';
    this.sr = document.createElement('span'); this.sr.className = 'sr-only';
    this.box = document.createElement('span'); this.box.className = 'odo__reels'; this.box.setAttribute('aria-hidden', 'true');
    el.append(this.sr, this.box);
    this.render(this.value, false);
  }
  render(text, animate = true) {
    this.sr.textContent = text;
    const chars = [...text];
    const kids = [...this.box.children];
    const sameShape = kids.length === chars.length && chars.every((c, i) => /\d/.test(c) === kids[i].classList.contains('reel'));
    if (!sameShape) {
      this.box.textContent = '';
      chars.forEach((c, i) => {
        if (/\d/.test(c)) { const r = reel(c); this.box.appendChild(r); setStrip(r, c, animate, i * 18); }
        else this.box.appendChild(stat(c));
      });
    } else {
      chars.forEach((c, i) => {
        const k = kids[i];
        if (/\d/.test(c)) { if (k.dataset.d !== c) { k.dataset.d = c; setStrip(k, c, animate, i * 18); } }
        else if (k.textContent !== c) k.textContent = c === ' ' ? ' ' : c;
      });
    }
    this.value = text;
  }
  set(text) { if (text !== this.value) this.render(text, true); }
}

// Static odometers rendered by the build (<x-odo>): roll from zero when revealed.
export function rollIn(el, { delay = 0, stagger = 60 } = {}) {
  const reels = el.querySelectorAll('.reel');
  reels.forEach((r, i) => {
    const strip = r.firstElementChild;
    const d = Number(r.dataset.d);
    const y = `translateY(-${d * 10}%)`;
    r.className = 'reel';
    strip.style.transform = y;
    if (reducedMotion() || !strip.animate) return;
    strip.animate([{ transform: 'translateY(0)' }, { transform: y }], { duration: 1200 + i * 90, delay: delay + i * stagger, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  });
}

// Set a static (build-rendered) odometer to a number string of the same length, e.g. the loader counter.
export function setDigits(el, text) {
  const reels = el.querySelectorAll('.reel');
  [...text].forEach((c, i) => {
    const r = reels[i]; if (!r) return;
    r.dataset.d = c; r.className = 'reel';
    r.firstElementChild.style.transform = `translateY(-${Number(c) * 10}%)`;
  });
}
