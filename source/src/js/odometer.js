// Update the real output immediately; a small movement makes calculator changes legible.
// No digit reels or intermediate values: assistive technology reads the exact result.
import { reducedMotion } from './utils.js';
export class Odometer {
  constructor(el) { this.el = el; this.value = el.textContent.trim(); }
  set(text) {
    if (text === this.value) return;
    this.value = text; this.el.textContent = text;
    this.animation?.cancel();
    if (!reducedMotion() && this.el.animate) this.animation = this.el.animate(
      [{ opacity: .4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240, easing: 'ease-out' });
  }
}
