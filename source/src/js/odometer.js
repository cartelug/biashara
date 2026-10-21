// Writes a changing value into an <output> element. (The animated digit reels were removed in the redesign;
// this keeps the same two-call interface for the calculator and the Apply summary.)
export class Odometer {
  constructor(el) { this.el = el; this.value = el.textContent.trim(); }
  set(text) { if (text !== this.value) { this.value = text; this.el.textContent = text; } }
}
