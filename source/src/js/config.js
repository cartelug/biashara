// ---------------------------------------------------------------------------
// SITE SETTINGS — the one file to edit for dates, the form endpoint and contacts.
// After editing, run `npm run build` so the pages pick up the change.
// ---------------------------------------------------------------------------

export const CONFIG = {
  // Money Lending Licence (Company Profile 2026, Appendix A, page 24).
  // Dates are YYYY-MM-DD. When the visitor's date (Kampala time) is after `expires`,
  // the licence page and the footer automatically show the verification notice.
  LICENCE: {
    number: '1451/ML',
    issued: '2026-03-11',
    expires: '2026-12-31',
    referenceYear: '2026',
  },

  // Where the Apply and Contact forms send their JSON. Leave empty ('') to use the
  // fallback: a pre-filled email and a pre-filled WhatsApp message the visitor sends themselves.
  // Example: 'https://formspree.io/f/xxxxxxx' or your own server URL.
  SUBMIT_ENDPOINT: '',

  // The folder the site is served from. '' when the site is at the top of a domain (Netlify, Cloudflare
  // Pages, cPanel, a custom domain). '/biashara' when it is at https://<user>.github.io/biashara/ (a GitHub
  // Pages project site). Every link, image, font and script is built with this prefix, so it must match
  // where the site really lives. No trailing slash. The BASE_PATH environment variable overrides it.
  BASE_PATH: '/biashara',

  // Offline shell (service worker). Set to false to switch it off.
  SERVICE_WORKER: true,

  // Contact details (Company Profile 2026, page 25).
  CONTACT: {
    email: 'inquiries@biasharafinance.com',
    phones: ['+256702634848', '+256392960002'],
    whatsapp: '256702634848',
    address: 'Conrad Plaza, Plot 24/25 Entebbe Road, Second Floor, Suite 2, Kampala, Uganda',
    mapsQuery: 'Conrad Plaza, Entebbe Road, Kampala, Uganda',
  },

  // Office hours (page 25): Monday to Friday, 8:00 AM to 4:00 PM, Kampala time.
  HOURS: { timeZone: 'Africa/Kampala', days: [1, 2, 3, 4, 5], open: 8 * 60, close: 16 * 60 },

  // The public address of the site, used for canonical links, the sitemap and social cards.
  SITE_URL: 'https://www.biasharafinance.com',
};
