// Results that roll like an odometer (MOTION.md section 5). The <output> keeps the exact text at all times, so tests,
// copy and assistive technology read the real figure; a decorative copy beside it (aria-hidden) rolls each digit.
import { reducedMotion } from './utils.js';

export class Odometer {
  constructor(el) {
    this.el = el; this.value = el.textContent.trim(); this.vis = null; this.cols = [];
  }
  build(text) {
    const host = this.el.parentElement;
    if (!this.vis) {
      this.vis = document.createElement('span');
      this.vis.className = 'odo__vis'; this.vis.setAttribute('aria-hidden', 'true');
      host.classList.add('odo-host'); host.append(this.vis);
    }
    this.vis.textContent = ''; this.cols = [];
    for (const ch of text) {
      const col = document.createElement('span'); col.className = 'odo__col';
      if (/\d/.test(ch)) {
        const reel = document.createElement('span'); reel.className = 'odo__reel';
        for (let d = 0; d <= 9; d++) { const s = document.createElement('span'); s.textContent = String(d); reel.append(s); }
        col.append(reel); this.cols.push(reel);
      } else { col.textContent = ch; this.cols.push(null); }
      this.vis.append(col);
    }
  }
  set(text) {
    if (text === this.value) return;
    const prev = this.value;
    this.value = text; this.el.textContent = text;
    if (reducedMotion() || !this.el.parentElement) { this.el.classList.remove('is-rolling'); if (this.vis) this.vis.hidden = true; return; }
    // same shape of number: roll the digits that changed; a different length rebuilds from the old figure
    if (!this.vis || prev.length !== text.length || this.cols.length !== text.length) {
      this.build(prev.length === text.length ? prev : text.replace(/\d/g, '0'));
      this.place(prev.length === text.length ? prev : text.replace(/\d/g, '0'));
      void this.vis.offsetWidth; // commit the start position before rolling
    }
    this.vis.hidden = false;
    this.el.classList.add('is-rolling');
    this.place(text);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.el.classList.remove('is-rolling'), 900);
  }
  place(text) {
    const h = this.el.offsetHeight || 20;
    this.vis.style.top = this.el.offsetTop + 'px';
    this.vis.style.setProperty('--lh', h + 'px');
    [...text].forEach((ch, i) => { const reel = this.cols[i]; if (reel && /\d/.test(ch)) reel.style.transform = `translateY(${-Number(ch) * h}px)`; });
  }
}
