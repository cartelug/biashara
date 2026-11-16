(function(h) {
  h.classList.remove('no-js');
  h.classList.add('js');
  try { if (localStorage.getItem('btc-contrast') === 'high') h.setAttribute('data-contrast', 'high'); } catch (e) {}
  // The opening film (MOTION.md section 4): the full version once per visit, a short one on later pages,
  // a plain fade with reduced motion, nothing when the page comes back from the back/forward cache.
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    var back = nav && nav.type === 'back_forward';
    var seen = sessionStorage.getItem('btc-film');
    var mode = back ? '' : matchMedia('(prefers-reduced-motion: reduce)').matches ? 'pl-fade' : seen ? 'pl-short' : 'pl-full';
    if (mode) { h.classList.add('pl-on', mode); window.__btcFilm = { mode: mode, t0: performance.now() }; }
    sessionStorage.setItem('btc-film', '1');
  } catch (e) {}
  // A failed or slow main script must never leave the film or any hidden content in place.
  setTimeout(function() {
    if (h.classList.contains('ready')) return;
    h.classList.remove('pl-on', 'pl-full', 'pl-short', 'pl-exit', 'js');
    h.classList.add('no-js');
    document.querySelectorAll('.motion-wait').forEach(function(el) { el.classList.remove('motion-wait'); });
  }, 4000);
  if (location.protocol === 'file:') document.addEventListener('DOMContentLoaded', function() {
    var links = document.querySelectorAll('a[href]'), i, value, match;
    for (i = 0; i < links.length; i++) {
      value = links[i].getAttribute('href');
      if (!value || /^(#|[a-z][a-z0-9+.-]*:)/i.test(value)) continue;
      match = /^([^?#]*)(.*)$/.exec(value);
      if (/\/$/.test(match[1])) links[i].setAttribute('href', match[1] + 'index.html' + match[2]);
    }
  });
})(document.documentElement);
