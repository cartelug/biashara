// When the visitor's date (Kampala) is after the licence expiry date in config.js,
// show the verification notice on the licence page and in the footer.
import { CONFIG } from './config.js';
import { kampalaParts, now } from './utils.js';

export function licenceExpired(date = now()) {
  const { iso } = kampalaParts(date, CONFIG.HOURS.timeZone);
  return iso > CONFIG.LICENCE.expires;
}

export function applyLicenceGuard(root = document) {
  const expired = licenceExpired();
  root.querySelectorAll('[data-licence-guard]').forEach((el) => { el.hidden = !expired; });
  root.querySelectorAll('[data-licence-current]').forEach((el) => { el.hidden = expired; });
  document.documentElement.classList.toggle('licence-expired', expired);
  return expired;
}
