(function(h) {
  h.classList.remove('no-js');
  h.classList.add('js');
  try { if (localStorage.getItem('btc-contrast') === 'high') h.setAttribute('data-contrast', 'high'); } catch (e) {}
  try {
    var navigation = performance.getEntriesByType('navigation')[0];
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !sessionStorage.getItem('btc-intro-v1') && (!navigation || navigation.type !== 'back_forward')) {
      h.classList.add('intro-pending');
      window.__btcIntroStarted = performance.now();
    }
  } catch (e) {}
  // A failed or slow main script must never leave the intro or navigation stuck.
  setTimeout(function() {
    if (h.classList.contains('ready')) return;
    h.classList.remove('intro-pending', 'intro-finishing', 'js');
    h.classList.add('no-js');
    document.querySelectorAll('[data-intro-inert]').forEach(function(el) { el.inert = false; el.removeAttribute('data-intro-inert'); });
    document.querySelectorAll('.motion-wait').forEach(function(el) { el.classList.remove('motion-wait'); });
    document.dispatchEvent(new Event('btc:intro-timeout'));
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
