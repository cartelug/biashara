// A small client-side router: fetch the next page, swap <main>, update head tags and JSON-LD,
// run page lifecycle hooks, restore scroll, move focus to the new H1 and announce the change.
// Any failure falls back to a normal navigation.
import { $, $$, announce, reducedMotion, wait } from './utils.js';
import { pages } from '../data/site.mjs';

const cache = new Map();
const SKIP_PROTO = /^(mailto:|tel:|sms:|javascript:)/i;
const pageFor = (path) => pages.find((p) => p.path === path) || null;
const normal = (u) => { const url = new URL(u, location.href); return url.pathname + url.search; };

function eligible(a, e) {
  if (!a || !a.href) return false;
  if (e && (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return false;
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute('download') || a.dataset.noRouter !== undefined || a.closest('[data-no-router]')) return false;
  const raw = a.getAttribute('href') || '';
  if (SKIP_PROTO.test(raw)) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (/\.(?!html?$)[a-z0-9]{2,5}$/i.test(url.pathname)) return false; // files
  return true;
}

export function prefetch(url) {
  const key = normal(url);
  if (!cache.has(key)) {
    const p = fetch(key, { credentials: 'same-origin', headers: { 'X-Requested-With': 'router' } })
      .then((r) => { if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) throw new Error('bad response ' + r.status); return r.text(); })
      .catch((err) => { cache.delete(key); throw err; });
    cache.set(key, p);
  }
  return cache.get(key);
}

export function createRouter({ curtain, onLeave, onEnter, onIntro, scrollTo }) {
  let busy = false;
  history.scrollRestoration = 'manual';
  // remember scroll position per history entry
  let saveT;
  window.addEventListener('scroll', () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, ''); } catch { /* ignore */ } }, 120);
  }, { passive: true });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!eligible(a, e)) return;
    const url = new URL(a.href, location.href);
    // same page, hash only: smooth scroll
    if (url.pathname === location.pathname && url.search === location.search) {
      if (url.hash) {
        e.preventDefault(); scrollTo(url.hash); history.pushState({ scroll: window.scrollY }, '', url.hash);
        // move keyboard focus with the scroll (skip link, contents links)
        const t = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (t) { if (!t.matches('a[href], button, input, select, textarea, [tabindex]')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
      }
      else { e.preventDefault(); scrollTo(0); }
      return;
    }
    e.preventDefault();
    go(url.href, { push: true });
  });
  const warm = (e) => { const a = e.target.closest?.('a[href]'); if (eligible(a)) prefetch(a.href).catch(() => {}); };
  document.addEventListener('pointerenter', warm, { capture: true, passive: true });
  document.addEventListener('touchstart', warm, { capture: true, passive: true });
  document.addEventListener('focusin', warm);

  window.addEventListener('popstate', (e) => {
    const target = location.pathname + location.search;
    if (document.querySelector('#main')?.dataset.path === target) { // hash change on same page
      if (location.hash) scrollTo(location.hash, { immediate: true });
      return;
    }
    go(location.href, { push: false, scroll: e.state?.scroll ?? 0 });
  });
  const m = $('#main'); if (m) m.dataset.path = location.pathname + location.search;

  async function go(href, { push = true, scroll = 0 } = {}) {
    if (busy) { location.href = href; return; }
    busy = true;
    const url = new URL(href, location.href);
    const meta = pageFor(url.pathname);
    try {
      const htmlP = prefetch(url.href);
      const cover = curtain.in(meta);
      const [html] = await Promise.all([htmlP, cover]);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('main#main');
      if (!next) throw new Error('no main');
      if (push) history.pushState({ scroll: 0 }, '', url.href);
      const swap = () => {
        onLeave();
        const cur = $('#main');
        const fresh = document.importNode(next, true);
        fresh.dataset.path = url.pathname + url.search;
        cur.replaceWith(fresh);
        syncHead(doc);
        return fresh;
      };
      let fresh;
      if (document.startViewTransition && !reducedMotion()) {
        const vt = document.startViewTransition(() => { fresh = swap(); });
        await vt.updateCallbackDone;
      } else fresh = swap();
      // scroll: hash target, saved position, or top
      if (url.hash && fresh.querySelector(url.hash)) scrollTo(url.hash, { immediate: true, settle: true });
      else scrollTo(push ? 0 : scroll, { immediate: true });
      onEnter(fresh, { fromRouter: true });
      await curtain.out();
      onIntro?.(fresh);
      const h1 = fresh.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      announce(`${doc.title.split(' · ')[0]} page loaded`);
    } catch (err) {
      console.warn('Router fallback:', err);
      location.href = href;
      return;
    } finally {
      busy = false;
    }
  }

  return { go, prefetch };
}

function syncHead(doc) {
  document.title = doc.title;
  const sel = ['meta[name="description"]', 'link[rel="canonical"]', 'meta[name="robots"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]'];
  for (const s of sel) {
    $$(s, document.head).forEach((n) => n.remove());
    $$(s, doc.head).forEach((n) => document.head.appendChild(document.importNode(n, true)));
  }
  const ld = doc.getElementById('ld');
  const curLd = document.getElementById('ld');
  if (ld && curLd) curLd.textContent = ld.textContent;
  document.body.dataset.page = doc.body.dataset.page || '';
}

// The branded curtain: a red panel sweeps in with an ink panel behind it, showing the logo mark,
// the destination number and name and a mini counter. ~800ms in, ~700ms out.
export function createCurtain() {
  const el = $('[data-curtain]');
  const ink = el?.querySelector('.curtain__ink');
  const red = el?.querySelector('.curtain__red');
  const num = el?.querySelector('[data-curtain-num]');
  const name = el?.querySelector('[data-curtain-name]');
  const count = el?.querySelector('[data-curtain-count]');
  const inner = el?.querySelector('.curtain__in');
  const gs = () => window.gsap;
  return {
    async in(meta) {
      if (!el) return;
      if (num) num.textContent = meta?.num || '··';
      if (name) name.textContent = meta?.name || 'Biashara';
      if (reducedMotion() || !gs()) {
        const main = $('#main');
        main?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
        await wait(200);
        return;
      }
      el.classList.add('is-on');
      const c = { v: 0 };
      await new Promise((resolve) => {
        gs().timeline({ onComplete: resolve })
          .set([ink, red], { xPercent: -101 })
          .set(inner, { opacity: 0, y: 12 })
          .to(ink, { xPercent: 0, duration: 0.62, ease: 'expo.inOut' }, 0)
          .to(red, { xPercent: 0, duration: 0.62, ease: 'expo.inOut' }, 0.1)
          .to(inner, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.5)
          .to(c, { v: 100, duration: 0.8, ease: 'power2.out', onUpdate: () => { if (count) count.textContent = String(Math.round(c.v)).padStart(3, '0'); } }, 0);
      });
    },
    async out() {
      if (!el) return;
      if (reducedMotion() || !gs()) {
        $('#main')?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        return;
      }
      await new Promise((resolve) => {
        gs().timeline({ onComplete: () => { el.classList.remove('is-on'); resolve(); } })
          .to(inner, { opacity: 0, y: -12, duration: 0.2, ease: 'power2.in' }, 0)
          .to(red, { xPercent: 101, duration: 0.6, ease: 'expo.inOut' }, 0.08)
          .to(ink, { xPercent: 101, duration: 0.6, ease: 'expo.inOut' }, 0.16);
      });
    },
  };
}
