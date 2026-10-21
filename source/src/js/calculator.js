// Cost calculator (indicative) and the accessible custom slider it is built from.
// Interest is 2.8% per month, calculated on the approved principal (Company Profile p. 15).
// Interest over the term = interest per month × months. No instalment schedule is invented.
import { $, $$, clamp, fmtNumber, fmtUGX, parseAmount } from './utils.js';
import { Odometer } from './odometer.js';

export const RATE = 0.028;
export const MIN = 1_000_000;
export const MAX = 50_000_000;
export const STEP = 500_000;

export const interest = (principal, months) => {
  const monthly = Math.round(principal * RATE);
  return { monthly, total: monthly * months };
};

// role="slider" with pointer drag, arrows, Page Up/Down, Home/End.
export class Slider {
  constructor(el, { onInput, format } = {}) {
    this.el = el;
    this.min = Number(el.dataset.min); this.max = Number(el.dataset.max); this.step = Number(el.dataset.step) || 1;
    this.value = Number(el.dataset.value ?? el.getAttribute('aria-valuenow'));
    this.onInput = onInput; this.format = format || ((v) => String(v));
    this.thumb = $('[data-slider-thumb]', el); this.fill = $('[data-slider-fill]', el);
    this.page = el.dataset.page ? Number(el.dataset.page) : this.step * (this.max - this.min > 20 * this.step ? 10 : 1);
    this._down = this.down.bind(this); this._move = this.move.bind(this); this._up = this.up.bind(this); this._key = this.key.bind(this);
    el.addEventListener('pointerdown', this._down);
    el.addEventListener('keydown', this._key);
    this.ro = new ResizeObserver(() => this.paint());
    this.ro.observe(el);
    this.paint();
  }
  snap(v) { return clamp(Math.round((v - this.min) / this.step) * this.step + this.min, this.min, this.max); }
  set(v, { emit = true, snap = true, source = 'set' } = {}) {
    const nv = snap ? this.snap(v) : clamp(v, this.min, this.max);
    const changed = nv !== this.value;
    this.value = nv;
    this.paint();
    if (emit && changed) this.onInput?.(nv, source);
  }
  paint() {
    const p = (this.value - this.min) / (this.max - this.min || 1);
    const w = this.el.clientWidth;
    this.el.style.setProperty('--p', p.toFixed(4));
    if (this.thumb) this.thumb.style.transform = `translateX(${(p * w).toFixed(1)}px)`;
    if (this.fill) this.fill.style.transform = `scaleX(${p.toFixed(4)})`;
    this.el.setAttribute('aria-valuenow', String(this.value));
    this.el.setAttribute('aria-valuetext', this.format(this.value));
  }
  fromPointer(e) {
    const r = this.el.getBoundingClientRect();
    const p = clamp((e.clientX - r.left) / r.width, 0, 1);
    return this.min + p * (this.max - this.min);
  }
  down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    this.el.focus({ preventScroll: true });
    this.el.setPointerCapture?.(e.pointerId);
    this.el.classList.add('is-dragging');
    this.set(this.fromPointer(e), { source: 'pointer' });
    this.el.addEventListener('pointermove', this._move);
    this.el.addEventListener('pointerup', this._up);
    this.el.addEventListener('pointercancel', this._up);
  }
  move(e) { this.set(this.fromPointer(e), { source: 'pointer' }); }
  up() {
    this.el.classList.remove('is-dragging');
    this.el.removeEventListener('pointermove', this._move);
    this.el.removeEventListener('pointerup', this._up);
    this.el.removeEventListener('pointercancel', this._up);
  }
  key(e) {
    const k = e.key;
    let v = this.value;
    if (k === 'ArrowRight' || k === 'ArrowUp') v += this.step;
    else if (k === 'ArrowLeft' || k === 'ArrowDown') v -= this.step;
    else if (k === 'PageUp') v += this.page;
    else if (k === 'PageDown') v -= this.page;
    else if (k === 'Home') v = this.min;
    else if (k === 'End') v = this.max;
    else return;
    e.preventDefault();
    this.set(v, { source: 'key' });
  }
  destroy() {
    this.el.removeEventListener('pointerdown', this._down);
    this.el.removeEventListener('keydown', this._key);
    this.ro.disconnect();
  }
}

// Amount field: typed input + slider + quick-pick chips, kept in sync.
export function amountControl(root, { value = 10_000_000, onChange } = {}) {
  const input = $('[data-amount-input]', root);
  const err = $('[data-amount-error]', root);
  const chips = $$('[data-chip]', root);
  let amount = value;
  const slider = new Slider($('[data-slider="amount"]', root), {
    format: (v) => fmtUGX(v),
    onInput: (v) => { amount = v; input.value = fmtNumber(v); showError(''); paintChips(); onChange?.(v); },
  });
  function paintChips() { chips.forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.chip) === amount))); }
  function showError(msg) {
    if (!err) return;
    err.textContent = msg; err.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate(v) {
    if (!Number.isFinite(v)) return 'Enter an amount in Uganda shillings, for example 5,000,000.';
    if (v < MIN) return 'The minimum facility is UGX 1,000,000.';
    if (v > MAX) return 'The maximum facility is UGX 50,000,000.';
    return '';
  }
  function commit(fromBlur) {
    const v = parseAmount(input.value);
    const msg = validate(v);
    if (msg) { if (fromBlur) showError(msg); return false; }
    showError('');
    amount = v;
    slider.set(v, { emit: false, snap: false });
    if (fromBlur) input.value = fmtNumber(v);
    paintChips();
    onChange?.(v);
    return true;
  }
  input.addEventListener('input', () => {
    // keep digits and grouping while typing; never move the caret unexpectedly for pasted text
    const raw = input.value;
    const v = parseAmount(raw);
    if (Number.isFinite(v) && !/[km]$/i.test(raw.trim())) {
      const pos = input.selectionStart, before = raw.length;
      input.value = fmtNumber(v);
      const after = input.value.length;
      try { input.setSelectionRange(Math.max(0, pos + after - before), Math.max(0, pos + after - before)); } catch { /* ignore */ }
    }
    commit(false);
  });
  input.addEventListener('blur', () => commit(true));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(true); } });
  chips.forEach((c) => c.addEventListener('click', () => { slider.set(Number(c.dataset.chip), { snap: false }); input.value = fmtNumber(amount); }));
  input.value = fmtNumber(amount);
  slider.set(amount, { emit: false, snap: false });
  paintChips();
  return {
    get value() { return amount; },
    set(v) { amount = v; input.value = fmtNumber(v); slider.set(v, { emit: false, snap: false }); paintChips(); showError(''); },
    validate: () => { const m = validate(parseAmount(input.value)); showError(m); return !m; },
    input, slider,
    destroy() { slider.destroy(); },
  };
}

export function termControl(root, { value = 3, onChange } = {}) {
  const el = $('[data-slider="term"]', root);
  const s = new Slider(el, { format: (v) => `${v} month${v === 1 ? '' : 's'}`, onInput: (v) => onChange?.(v) });
  s.set(value, { emit: false });
  // Clicking a month tick label selects it
  return s;
}

// The calculator component (Home, Loans, Apply share this module).
export function mountCalculator(root, { onChange } = {}) {
  const odo = Object.fromEntries($$('[data-calc]', root).map((o) => [o.dataset.calc, new Odometer(o)]));
  const monthsLabel = $('[data-calc-months]', root);
  const termLabel = $('[data-calc-term-label]', root);
  const applyLink = $('[data-calc-apply]', root);
  const state = { amount: 10_000_000, months: 3 };
  const render = () => {
    const { monthly, total } = interest(state.amount, state.months);
    odo.principal?.set(fmtUGX(state.amount));
    odo.monthly?.set(fmtUGX(monthly));
    odo.total?.set(fmtUGX(total));
    const m = `${state.months} month${state.months === 1 ? '' : 's'}`;
    if (monthsLabel) monthsLabel.textContent = m;
    if (termLabel) termLabel.textContent = m;
    if (applyLink) applyLink.href = `/apply/?amount=${state.amount}&term=${state.months}`;
    onChange?.({ ...state, monthly, total });
  };
  const amt = amountControl(root, { value: state.amount, onChange: (v) => { state.amount = v; render(); } });
  const term = termControl(root, { value: state.months, onChange: (v) => { state.months = v; render(); } });
  render();
  return {
    state,
    set({ amount, months }) { if (amount) { state.amount = amount; amt.set(amount); } if (months) { state.months = months; term.set(months, { emit: false }); } render(); },
    amount: amt, term,
    destroy() { amt.destroy(); term.destroy(); },
  };
}
