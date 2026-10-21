// Small shared helpers.

// Where the site's root folder is, relative to this page ('' on the home page, '../' one folder down). The build writes
// it into <html data-root>; links made in script use siteUrl() so they work wherever the site is placed.
export const ROOT = document.documentElement.dataset.root || '';
// siteUrl('/apply/?amount=1') -> 'apply/?amount=1' or '../apply/?amount=1'. Opened from disk, a folder link needs index.html.
export const siteUrl = (path) => {
  const url = ROOT + path.replace(/^\//, '');
  return location.protocol === 'file:' ? url.replace(/^([^?#]*\/)($|[?#])/, '$1index.html$2') : url;
};
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const mq = (q) => window.matchMedia(q);
export const reducedMotion = () => document.documentElement.classList.contains('rm') || mq('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => mq('(hover: hover) and (pointer: fine)').matches;
export const isDesktop = () => mq('(min-width: 1100px)').matches;

const NBSP = ' ';
export const fmtNumber = (n) => Math.round(n).toLocaleString('en-US');
export const fmtUGX = (n) => 'UGX' + NBSP + fmtNumber(n);
export const parseAmount = (s) => {
  const t = String(s ?? '').trim().toLowerCase().replace(/ugx|shs?|,|\s| /g, '');
  if (!t) return NaN;
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  const mult = m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  return Math.round(parseFloat(m[1]) * mult);
};

// Storage that never throws (private mode, blocked storage).
export const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function announce(msg) {
  const el = document.querySelector('[data-announcer]');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 60);
}

// "Now" in Kampala. Tests may set window.__BTC_NOW to an ISO date string.
export function now() {
  const o = window.__BTC_NOW;
  return o ? new Date(o) : new Date();
}
export function kampalaParts(date = now(), timeZone = 'Africa/Kampala') {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: days[p.weekday], minutes: Number(p.hour) * 60 + Number(p.minute), iso: `${p.year}-${p.month}-${p.day}` };
}

export function on(el, type, fn, opts) {
  el.addEventListener(type, fn, opts);
  return () => el.removeEventListener(type, fn, opts);
}

// Collect teardown functions and run them together.
export function disposer() {
  const list = [];
  const d = (fn) => { if (typeof fn === 'function') list.push(fn); return fn; };
  d.run = () => { while (list.length) { try { list.pop()(); } catch (e) { console.warn(e); } } };
  return d;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
    ta.remove();
  });
}
