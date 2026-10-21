// Live "Open now / Closed" in Kampala time against Monday–Friday 8:00 AM–4:00 PM.
import { CONFIG } from './config.js';
import { kampalaParts, now } from './utils.js';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h} h ${mm} min`;
  if (h) return `${h} h`;
  return `${mm} min`;
};
const clock = (min) => { const h = Math.floor(min / 60), m = min % 60; const ap = h >= 12 ? 'PM' : 'AM'; const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, '0')} ${ap}`; };

export function officeStatus(date = now()) {
  const { days, open, close, timeZone } = CONFIG.HOURS;
  const { day, minutes } = kampalaParts(date, timeZone);
  const isDay = days.includes(day);
  if (isDay && minutes >= open && minutes < close) {
    return { open: true, minutes: close - minutes, text: `Open now · closes in ${dur(close - minutes)}`, short: 'Open now' };
  }
  // find the next opening
  let add = 0, d = day;
  if (isDay && minutes < open) { add = open - minutes; }
  else {
    add = 24 * 60 - minutes; d = (day + 1) % 7;
    while (!days.includes(d)) { add += 24 * 60; d = (d + 1) % 7; }
    add += open;
  }
  const when = add < 24 * 60 ? `opens in ${dur(add)}` : `opens ${DAY[d]} at ${clock(open)}`;
  return { open: false, minutes: add, nextDay: d, text: `Closed · ${when}`, short: 'Closed' };
}

export function mountOpenNow(root = document) {
  const els = [...root.querySelectorAll('[data-open-now]')];
  if (!els.length) return () => {};
  const paint = () => {
    const s = officeStatus();
    for (const el of els) {
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
      const t = el.querySelector('[data-open-now-text]');
      if (t) t.textContent = s.text;
    }
    const { day } = kampalaParts(now(), CONFIG.HOURS.timeZone);
    root.querySelectorAll('[data-week] li').forEach((li, i) => li.classList.toggle('is-today', ((i + 1) % 7) === day));
  };
  paint();
  const t = setInterval(paint, 30_000);
  return () => clearInterval(t);
}
