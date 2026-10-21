// Preloader: one GSAP timeline, about 2.6s on the first visit of a session, 0.9s afterwards.
// 1 rosette draws itself · 2 the span draws across · 3 the logo is revealed by a red-square block wipe
// 4 counter 000→100 and the edition line · 5 tagline lines rise · 6 the span splits into two shutters.
// Hard cap 3.5s; skippable after 1s; reduced motion gets a plain fade; never blocks without JS (CSS rule).
import { $, $$, reducedMotion, session } from './utils.js';
import { rosette, toPath } from './guilloche.js';
import { setDigits } from './odometer.js';

export function runPreloader({ onReveal } = {}) {
  const el = $('[data-loader]');
  const html = document.documentElement;
  if (!el || html.classList.contains('no-js')) { onReveal?.(); return Promise.resolve(); }
  const gs = window.gsap;
  const seen = !!session.get('btc-seen');
  session.set('btc-seen', '1');
  let revealed = false;
  const reveal = () => { if (!revealed) { revealed = true; onReveal?.(); } };
  const finish = () => { el.remove(); };

  // Wait for fonts and the hero image so the reveal never stutters (never longer than the cap).
  const heroImg = $('[data-hero-img] img');
  const ready = Promise.race([
    Promise.all([document.fonts?.ready, heroImg?.decode?.().catch(() => {})]),
    new Promise((r) => setTimeout(r, 1800)),
  ]);

  if (!gs || reducedMotion()) {
    return ready.then(() => new Promise((resolve) => {
      reveal();
      const a = el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      setTimeout(() => { finish(); resolve(); }, 320);
      if (!a) { finish(); resolve(); }
    }));
  }

  const top = $('[data-shutter-top]', el), bot = $('[data-shutter-bot]', el);
  const span = $('[data-loader-span]', el), logo = $('[data-loader-logo]', el), wipe = $('[data-loader-wipe]', el);
  const tag = $$('.loader__tag .line-inner', el), count = $('.odo--loader', el);
  const ros = $('[data-loader-rosette]', el), stage = $('.loader__stage', el);
  const meta = $$('.loader__count, .loader__ed', el);
  gs.set(el, { animation: 'none' }); // the JS timeline replaces the CSS failsafe

  return new Promise((resolve) => {
    const done = () => { finish(); resolve(); };
    const tl = gs.timeline({ onComplete: done });
    const hardCap = setTimeout(() => { tl.progress(1); reveal(); done(); }, 3500);
    tl.eventCallback('onComplete', () => { clearTimeout(hardCap); done(); });

    if (!seen) {
      // 1. rosette draws itself
      if (ros) {
        ros.innerHTML = rosette(1).map((p) => `<path d="${toPath(p.filter((_, i) => i % 3 === 0), 1)}" fill="none" stroke="currentColor" stroke-width=".7"/>`).join('');
        const paths = $$('path', ros);
        paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = String(L); });
        tl.to(paths, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.06 }, 0);
      }
      // 2. the span
      tl.fromTo(span, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'expo.inOut' }, 0.3);
      // 3. logo block wipe
      tl.fromTo(wipe, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.32, ease: 'power3.in' }, 0.75)
        .set(logo, { clipPath: 'inset(0 0% 0 0)' })
        .to(wipe, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.36, ease: 'power3.out' });
      // 4. counter
      const c = { v: 0 };
      tl.fromTo(meta, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.1);
      tl.to(c, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: () => setDigits(count, String(Math.round(c.v)).padStart(3, '0')) }, 0.15);
      // 5. tagline
      tl.fromTo(tag, { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08 }, 1.25);
      // 6. shutters
      tl.addLabel('open', 2.05)
        .to([stage, ...meta], { opacity: 0, duration: 0.25, ease: 'power2.in' }, 'open')
        .to(span, { scaleY: 0, duration: 0.2 }, 'open')
        .to(top, { yPercent: -100, duration: 0.62, ease: 'expo.inOut' }, 'open+=0.05')
        .to(bot, { yPercent: 100, duration: 0.62, ease: 'expo.inOut' }, 'open+=0.05')
        .add(() => reveal(), 'open+=0.2');
    } else {
      // Short version: logo plus shutters (0.9s)
      gs.set([tag, ...meta], { opacity: 0 });
      gs.set(span, { scaleX: 1 });
      tl.fromTo(wipe, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.2, ease: 'power3.in' }, 0)
        .set(logo, { clipPath: 'inset(0 0% 0 0)' })
        .to(wipe, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.22, ease: 'power3.out' })
        .addLabel('open', 0.45)
        .to([stage], { opacity: 0, duration: 0.2 }, 'open')
        .to(top, { yPercent: -100, duration: 0.45, ease: 'expo.inOut' }, 'open')
        .to(bot, { yPercent: 100, duration: 0.45, ease: 'expo.inOut' }, 'open')
        .add(() => reveal(), 'open+=0.1');
    }

    // Hold before the shutters until fonts and the hero image are ready (within the cap).
    let held = false;
    tl.add(() => {
      ready.then(() => { if (held) tl.play(); });
      if (!readyDone) { held = true; tl.pause(); }
    }, 'open-=0.01');
    let readyDone = false; ready.then(() => { readyDone = true; });

    // Skip after 1s with a click or key
    const skipAt = performance.now() + 1000;
    setTimeout(() => el.classList.add('can-skip'), seen ? 0 : 1000);
    const skip = () => { if (performance.now() < skipAt && !seen) return; tl.seek('open').play(); tl.timeScale(1.6); };
    el.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: false });
    tl.eventCallback('onComplete', () => { clearTimeout(hardCap); window.removeEventListener('keydown', skip); reveal(); done(); });
  });
}
