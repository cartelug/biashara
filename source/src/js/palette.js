// Command palette (K, / or Ctrl/Cmd+K): jump to any page or section, Apply, Call, WhatsApp, Show grid.
import { $, $$, withBase } from './utils.js';
import { CONFIG } from './config.js';
import { pages } from '../data/site.mjs';

export function mountPalette({ navigate, grid, chrome }) {
  const dlg = $('[data-palette]');
  if (!dlg) return { open() {} };
  const q = $('[data-palette-q]', dlg);
  const list = $('[data-palette-list]', dlg);
  let items = [], shown = [], active = 0;
  const phone = (p) => p.replace(/^\+256(\d{3})(\d{3})(\d{3})$/, '+256 $1 $2 $3');

  function collect() {
    const out = [];
    for (const p of pages) out.push({ group: 'Pages', n: p.num, t: p.name, k: p.nav, run: () => navigate(withBase(p.path)) });
    const main = $('#main');
    for (const h of $$('section[id] h2[id], section[id] > .wrap h2', main)) {
      const sec = h.closest('section[id]');
      if (!sec) continue;
      const num = sec.dataset.chapter || '·';
      out.push({ group: 'On this page', n: num, t: h.textContent.trim().replace(/\s+/g, ' '), k: 'Section', run: () => navigate('#' + sec.id) });
    }
    out.push({ group: 'Actions', n: '→', t: 'Apply now', k: 'Assemble your loan file', run: () => navigate(withBase('/apply/')) });
    CONFIG.CONTACT.phones.forEach((p) => out.push({ group: 'Actions', n: '☎', t: `Call ${phone(p)}`, k: 'Telephone', run: () => { location.href = 'tel:' + p; } }));
    out.push({ group: 'Actions', n: 'W', t: `WhatsApp ${phone('+' + CONFIG.CONTACT.whatsapp)}`, k: 'Opens WhatsApp', run: () => window.open('https://wa.me/' + CONFIG.CONTACT.whatsapp, '_blank', 'noopener') });
    out.push({ group: 'Actions', n: '@', t: `Email ${CONFIG.CONTACT.email}`, k: 'Opens your mail app', run: () => { location.href = 'mailto:' + CONFIG.CONTACT.email; } });
    out.push({ group: 'Actions', n: 'G', t: 'Show grid', k: 'Press G', run: () => grid.toggle() });
    out.push({ group: 'Actions', n: '◐', t: 'High contrast', k: 'Toggle', run: () => chrome.toggleContrast() });
    out.push({ group: 'Actions', n: 'P', t: 'Print this page', k: 'Print', run: () => window.print() });
    return out;
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    shown = items.filter((it) => !term || (it.t + ' ' + it.k + ' ' + it.group + ' ' + it.n).toLowerCase().includes(term));
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.textContent = '';
    if (!shown.length) {
      const li = document.createElement('li'); li.className = 'palette__empty'; li.setAttribute('role', 'presentation'); li.textContent = 'No match. Try “loans”, “apply” or “call”.';
      list.appendChild(li); q.removeAttribute('aria-activedescendant'); return;
    }
    let g = '';
    shown.forEach((it, i) => {
      if (it.group !== g) {
        g = it.group;
        const h = document.createElement('li'); h.className = 'palette__group label'; h.setAttribute('role', 'presentation'); h.textContent = g; list.appendChild(h);
      }
      const li = document.createElement('li');
      li.className = 'palette__opt'; li.id = 'pal-' + i; li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = '<span class="n tnum"></span><span class="t"></span><span class="k"></span>';
      li.children[0].textContent = it.n; li.children[1].textContent = it.t; li.children[2].textContent = it.k;
      li.addEventListener('click', () => choose(i));
      li.addEventListener('pointermove', () => { if (active !== i) { active = i; paint(); } });
      list.appendChild(li);
    });
    paint();
  }
  function paint() {
    $$('.palette__opt', list).forEach((li) => li.setAttribute('aria-selected', String(li.id === 'pal-' + active)));
    q.setAttribute('aria-activedescendant', 'pal-' + active);
    $('#pal-' + active, list)?.scrollIntoView({ block: 'nearest' });
  }
  function choose(i) {
    const it = shown[i]; if (!it) return;
    dlg.close();
    setTimeout(() => it.run(), 10);
  }
  function open() {
    if (dlg.open) return;
    items = collect(); q.value = ''; active = 0; render();
    dlg.showModal(); q.focus();
  }
  q.addEventListener('input', () => { active = 0; render(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable], [role="slider"]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'k' || e.key === 'K' || e.key === '/') { e.preventDefault(); open(); }
  });
  return { open };
}
