// Grid overlay (press G, desktop): the 12-column grid and the 8px rhythm.
export function mountGridOverlay() {
  const el = document.querySelector('[data-gridov]');
  if (!el) return { toggle() {} };
  const toggle = (force) => {
    const show = typeof force === 'boolean' ? force : el.hidden;
    el.hidden = !show;
  };
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable], [role="slider"], dialog')) return;
    if (e.key === 'g' || e.key === 'G') toggle();
  });
  return { toggle };
}
