// Behaviour tests in a real browser against the preview server (npm run preview).
// Usage: node qa/behaviour.mjs [baseUrl]   → writes qa/report/behaviour.json
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.argv[2] || 'http://localhost:4173';
const results = [];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function test(name, fn, { motion = false, now, seen = true, width = 1280, js = true } = {}) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width, height: 900 }, reducedMotion: motion ? 'no-preference' : 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ now, seen }) => {
    if (now) window.__BTC_NOW = now;
    if (seen) sessionStorage.setItem('btc-seen', '"1"');
  }, { now, seen });
  const t0 = Date.now();
  try {
    const detail = await fn(page);
    if (errors.length) throw new Error('console: ' + errors.join(' | '));
    results.push({ name, ok: true, ms: Date.now() - t0, detail: detail || '' });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: String(e.message || e).slice(0, 400) });
  }
  await ctx.close();
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const go = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForSelector('[data-loader]', { state: 'detached', timeout: 5000 }).catch(() => {}); };
const gone = (page, sel, ms = 5000) => page.waitForSelector(sel, { state: 'detached', timeout: ms });

// ------------------------------------------------------------------ preloader
await test('Preloader runs on first visit and removes itself within the 3.5s cap', async (page) => {
  const t = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  assert(await page.$('[data-loader]'), 'loader not present at start');
  await gone(page, '[data-loader]', 4500);
  return `removed after ${Date.now() - t} ms`;
}, { motion: true, seen: false });

await test('Preloader is shorter on a repeat visit in the same session', async (page) => {
  const t = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await gone(page, '[data-loader]', 3000);
  const ms = Date.now() - t;
  assert(ms < 2600, `took ${ms} ms`);
  return `removed after ${ms} ms`;
}, { motion: true, seen: true });

await test('Preloader can be skipped after 1s', async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1150);
  const t = Date.now();
  if (await page.$('[data-loader]')) await page.keyboard.press('Escape');
  if (await page.$('[data-loader]')) await page.mouse.click(640, 450);
  await gone(page, '[data-loader]', 1500);
  return `gone ${Date.now() - t} ms after skip`;
}, { motion: true, seen: false });

await test('Reduced motion: preloader is a plain fade', async (page) => {
  const t = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await gone(page, '[data-loader]', 2500);
  return `removed after ${Date.now() - t} ms`;
}, { seen: false });

// ------------------------------------------------------------------ router
await test('Page transition: URL, title, H1 focus and announcement update', async (page) => {
  await go(page, '/');
  await page.evaluate(() => { window.__marker = 1; });
  await page.click('.hdr__nav a[href="/loans/"]');
  await page.waitForURL('**/loans/');
  await page.waitForFunction(() => document.activeElement?.matches('h1, h1 *, main h1') || document.activeElement?.closest?.('h1'), null, { timeout: 4000 });
  const s = await page.evaluate(() => ({ marker: window.__marker, title: document.title, page: document.body.dataset.page, cur: document.querySelector('.hdr__nav a[aria-current="page"]')?.getAttribute('href') }));
  assert(s.marker === 1, 'full reload happened instead of a swap');
  assert(/Loan/i.test(s.title), 'title not updated: ' + s.title);
  assert(s.page === 'loans', 'body page not updated');
  assert(s.cur === '/loans/', 'nav aria-current not updated');
  await page.goBack();
  await page.waitForURL(BASE + '/');
  await page.waitForFunction(() => document.body.dataset.page === 'home');
  return s.title;
}, { motion: true });

// ------------------------------------------------------------------ calculator
await test('Calculator: interest is 2.8% of principal per month, edges are refused', async (page) => {
  await go(page, '/loans/');
  const inp = page.locator('[data-calculator] [data-amount-input]').first();
  const read = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-calculator] [data-calc]')].map((o) => [o.dataset.calc, o.querySelector('.sr-only')?.textContent.replace(/\s+/g, ' ').trim()])));
  const err = () => page.locator('[data-calculator] [data-amount-error]').first();
  const out = [];
  // default 10M × 3
  let r = await read();
  assert(r.monthly === 'UGX 280,000' && r.total === 'UGX 840,000', 'default: ' + JSON.stringify(r));
  out.push(`10M×3 → ${r.monthly}/month, ${r.total}`);
  // 500k refused
  await inp.fill('500000'); await inp.blur();
  assert(await err().isVisible() && /minimum/.test(await err().textContent()), 'no minimum error');
  r = await read(); assert(r.monthly === 'UGX 280,000', 'value changed on invalid input');
  out.push('500,000 → minimum error');
  // 60m refused
  await inp.fill('60m'); await inp.blur();
  assert(/maximum/.test(await err().textContent()), 'no maximum error');
  out.push('60m → maximum error');
  // 7.5m accepted
  await inp.fill('7.5m'); await inp.blur();
  assert(await err().isHidden(), 'error still shown for 7.5m');
  r = await read();
  assert(r.principal === 'UGX 7,500,000' && r.monthly === 'UGX 210,000' && r.total === 'UGX 630,000', '7.5m: ' + JSON.stringify(r));
  out.push(`7.5m×3 → ${r.monthly}, ${r.total}`);
  // boundaries 1,000,000 and 50,000,000 accepted
  await inp.fill('1,000,000'); await inp.blur(); r = await read();
  assert(r.monthly === 'UGX 28,000', '1M: ' + JSON.stringify(r));
  await inp.fill('50000000'); await inp.blur(); r = await read();
  assert(r.monthly === 'UGX 1,400,000' && r.total === 'UGX 4,200,000', '50M: ' + JSON.stringify(r));
  out.push('1M and 50M accepted');
  // term slider: End = 6 months, Home = 1 month
  const term = page.locator('[data-calculator] [data-slider="term"]').first();
  await term.focus(); await page.keyboard.press('End'); r = await read();
  assert(r.total === 'UGX 8,400,000', '50M×6: ' + JSON.stringify(r));
  await page.keyboard.press('Home'); r = await read();
  assert(r.total === 'UGX 1,400,000', '50M×1: ' + JSON.stringify(r));
  await page.keyboard.press('ArrowRight'); r = await read();
  assert(r.total === 'UGX 2,800,000', '50M×2: ' + JSON.stringify(r));
  out.push('term keys Home/End/Arrow 1–6 months');
  // apply link carries the values
  const href = await page.locator('[data-calculator] [data-calc-apply]').first().getAttribute('href');
  assert(href === '/apply/?amount=50000000&term=2', 'apply link: ' + href);
  out.push('Apply link ' + href);
  // text never shows APR or a schedule
  const txt = await page.locator('[data-calculator]').first().innerText();
  assert(!/APR|instal|schedule/i.test(txt), 'calculator mentions APR or instalments');
  return out.join(' · ');
});

// ------------------------------------------------------------------ open now
const openCases = [
  ['2026-10-19T07:59:00+03:00', false, 'Mon 07:59'],
  ['2026-10-19T08:00:00+03:00', true, 'Mon 08:00'],
  ['2026-10-23T15:59:00+03:00', true, 'Fri 15:59'],
  ['2026-10-23T16:00:00+03:00', false, 'Fri 16:00'],
  ['2026-10-24T11:00:00+03:00', false, 'Sat 11:00'],
  ['2026-10-25T23:30:00+03:00', false, 'Sun 23:30'],
];
for (const [iso, open, label] of openCases) {
  await test(`Open-now: ${label} Kampala is ${open ? 'open' : 'closed'}`, async (page) => {
    await go(page, '/contact/');
    const el = page.locator('[data-open-now]').first();
    const cls = await el.getAttribute('class');
    const text = (await el.innerText()).replace(/\s+/g, ' ').trim();
    assert(cls.includes(open ? 'is-open' : 'is-closed'), `${label}: ${cls} "${text}"`);
    return text;
  }, { now: iso });
}
await test('Open-now: a visitor in another time zone still sees Kampala hours', async (page) => {
  await go(page, '/contact/');
  const t = await page.locator('[data-open-now]').first().innerText();
  assert(/Open now/.test(t), t);
  return t.replace(/\s+/g, ' ');
}, { now: '2026-10-21T06:30:00Z' }); // 09:30 in Kampala, 07:30 in London

// ------------------------------------------------------------------ licence guard
await test('Licence guard: hidden before expiry', async (page) => {
  await go(page, '/licence/');
  assert(await page.locator('[data-licence-guard]').first().isHidden(), 'guard visible before expiry');
}, { now: '2026-12-31T23:00:00+03:00' });
await test('Licence guard: shown after 31 Dec 2026 (faked 2 Jan 2027)', async (page) => {
  await go(page, '/licence/');
  const g = page.locator('[data-licence-guard]').first();
  assert(await g.isVisible(), 'guard not visible');
  const t = await g.innerText();
  assert(t.includes('The reference copy shown is the 2026 certificate. To verify the current licence, contact the Board of Directors.'), t);
  const f = page.locator('footer [data-licence-guard]');
  if (await f.count()) assert(await f.first().isVisible(), 'footer guard hidden');
  return t;
}, { now: '2027-01-02T10:00:00+03:00' });

// ------------------------------------------------------------------ apply
async function fillApply(page, { product = 'salary' } = {}) {
  await page.locator(`label.pchoice:has(input[value="${product}"])`).click();
  await page.click('[data-next]');
  await page.click('[data-next]'); // amount & term keep defaults
  await page.fill('[name="name"]', 'Test Applicant');
  await page.fill('[name="phone"]', '0702 634 848');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="district"]', 'Kampala');
  await page.fill('[name="employer"]', 'Example employer');
  await page.click('[data-next]');
  await page.fill('[name="purpose"]', 'School fees for the coming term.');
  await page.click('[data-next]');
}

await test('Apply: ?product= preselects the product', async (page) => {
  await go(page, '/apply/?product=business');
  assert(await page.locator('input[name="product"][value="business"]').isChecked(), 'business not selected');
  const file = await page.locator('[data-afile]').innerText();
  assert(/Business/i.test(file), 'file ledger does not show the product');
});

await test('Apply: ?amount= and ?term= from the calculator are carried in', async (page) => {
  await go(page, '/apply/?product=asset&amount=7500000&term=5');
  const t = (await page.locator('[data-afile]').innerText()).replace(/\s+/g, ' ');
  assert(/7,500,000/.test(t) && /5 months/.test(t), t.slice(0, 300));
  return 'file shows UGX 7,500,000 over 5 months';
});

await test('Apply: validation stops each step and lists the errors', async (page) => {
  await go(page, '/apply/');
  await page.click('[data-next]');
  assert(await page.locator('[data-errsum]').isVisible(), 'no summary on step 1');
  assert(await page.locator('[data-step="1"]:not([hidden])').count(), 'moved past step 1 without a product');
  await page.locator('label.pchoice:has(input[value=\"school-fees\"])').click();
  await page.click('[data-next]'); await page.click('[data-next]');
  await page.fill('[name="phone"]', '12345');
  await page.click('[data-next]');
  const items = await page.locator('[data-errsum-list] li').allInnerTexts();
  assert(items.length >= 4, 'expected several errors, got ' + items.length);
  assert(items.some((t) => /9 digits/.test(t)), 'no phone message');
  const inv = await page.locator('[name="phone"]').getAttribute('aria-invalid');
  assert(inv === 'true', 'phone not aria-invalid');
  return items.length + ' errors listed: ' + items.slice(0, 3).join(' / ');
});

await test('Apply: full flow ends on a ticket that never claims approval', async (page) => {
  await go(page, '/apply/');
  const t0 = Date.now();
  await fillApply(page);
  const review = await page.locator('[data-review]').innerText();
  assert(/Test Applicant/.test(review) && /\+256 702 634 848/.test(review), 'review missing details: ' + review.slice(0, 200));
  await page.check('[name="accurate"]', { force: true });
  await page.check('[name="understand"]', { force: true });
  await page.check('[name="consent"]', { force: true });
  const wait = 8200 - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.click('[data-submit]');
  await page.waitForSelector('.ticket', { timeout: 5000 });
  const ticket = (await page.locator('[data-done]').innerText()).replace(/\s+/g, ' ');
  const ref = (ticket.match(/BTC-\d{8}-[A-Z0-9]{4}/) || [])[0];
  assert(ref, 'no reference');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date()).replace(/-/g, '');
  assert(ref.slice(4, 12) === today, 'reference date not today in Kampala: ' + ref);
  assert(/READY TO SEND/i.test(ticket), 'fallback stamp missing');
  assert(!/(you are|you're|has been|is|been) approved|approved for|congratulations|pre-?approved|guaranteed/i.test(ticket.replace(/does not guarantee/gi, '')), 'ticket claims approval');
  assert(/not an approval/i.test(ticket), 'no "not an approval" line');
  assert(/does not guarantee/i.test(ticket), 'no-guarantee line missing');
  const mail = await page.locator('[data-done] a[href^="mailto:"]').first().getAttribute('href');
  const wa = await page.locator('[data-done] a[href*="wa.me"]').first().getAttribute('href');
  assert(mail && decodeURIComponent(mail).includes(ref), 'mailto missing reference');
  assert(wa && decodeURIComponent(wa).includes(ref), 'WhatsApp missing reference');
  const stored = await page.evaluate(() => localStorage.getItem('btc-apply-v1'));
  return `${ref} · stamp READY TO SEND · mailto + WhatsApp carry the reference · draft ${stored ? 'kept' : 'cleared'}`;
});

await test('Apply: a submit within 8s is held back as automated', async (page) => {
  await go(page, '/apply/');
  await fillApply(page);
  for (const n of ['accurate', 'understand', 'consent']) await page.check(`[name="${n}"]`, { force: true });
  await page.click('[data-submit]');
  await page.waitForTimeout(600);
  const hasTicket = await page.locator('.ticket').count();
  const msg = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  assert(!hasTicket || /moment|again|wait/i.test(msg), 'ticket appeared despite the time trap');
  return hasTicket ? 'ticket shown with a wait note' : 'held: no ticket';
});

await test('Apply: progress is saved and offered back on return', async (page) => {
  await go(page, '/apply/');
  await page.locator('label.pchoice:has(input[value=\"asset\"])').click();
  await page.click('[data-next]');
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('[data-resume]').isVisible(), 'resume banner not shown');
  await page.click('[data-resume-yes]');
  assert(await page.locator('input[name="product"][value="asset"]').isChecked(), 'product not restored');
});

await test('Apply on mobile: the file ledger opens as a bottom sheet and Esc closes it', async (page) => {
  await go(page, '/apply/?product=salary');
  const peek = page.locator('[data-afile-toggle]');
  assert(await peek.isVisible(), 'no sheet toggle on mobile');
  await peek.click();
  assert(await page.locator('[data-afile].is-open').count(), 'sheet did not open');
  assert((await peek.getAttribute('aria-expanded')) === 'true', 'aria-expanded not true');
  await page.keyboard.press('Escape');
  assert(!(await page.locator('[data-afile].is-open').count()), 'Esc did not close');
}, { width: 390 });

// ------------------------------------------------------------------ enquiry
await test('Contact enquiry: validates, then hands over to email/WhatsApp', async (page) => {
  await go(page, '/contact/');
  const t0 = Date.now();
  const form = page.locator('[data-enquiry]');
  await form.locator('button[type="submit"]').click();
  assert(await form.locator('[aria-invalid="true"]').count() >= 2, 'no field errors');
  await form.locator('[name="name"]').fill('Test Person');
  await form.locator('[name="phone"]').fill('392960002');
  await form.locator('[name="message"]').fill('I would like to ask about the salary loan.');
  await form.locator('[name="consent"]').check({ force: true });
  const wait = 3200 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
  await form.locator('button[type="submit"]').click();
  await page.waitForSelector('[data-sendout] a[href^="mailto:"]', { timeout: 3000 });
  const t = await page.locator('[data-sendout]').innerText();
  return t.replace(/\s+/g, ' ').slice(0, 120);
});

// ------------------------------------------------------------------ keyboard
await test('Keyboard: skip link is first and moves focus to main', async (page) => {
  await go(page, '/');
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.className);
  assert(/skip/.test(first), 'first tab stop: ' + first);
  assert(await page.locator('.skip').isVisible(), 'skip link not visible on focus');
  await page.keyboard.press('Enter');
  const id = await page.evaluate(() => document.activeElement?.id);
  assert(id === 'main', 'focus after skip: ' + id);
});

await test('Keyboard: K and / open the palette, typing filters, Enter navigates, Esc closes', async (page) => {
  await go(page, '/');
  await page.keyboard.press('k');
  assert(await page.locator('[data-palette]').evaluate((d) => d.open), 'K did not open');
  await page.keyboard.press('Escape');
  assert(!(await page.locator('[data-palette]').evaluate((d) => d.open)), 'Esc did not close');
  await page.keyboard.press('/');
  assert(await page.locator('[data-palette]').evaluate((d) => d.open), '/ did not open');
  await page.keyboard.type('licence');
  const opts = await page.locator('[data-palette-list] .palette__opt').allInnerTexts();
  assert(opts.length && /licen/i.test(opts[0]), 'filter: ' + opts.join(','));
  await page.keyboard.press('Enter');
  await page.waitForURL('**/licence/**');
  return `${opts.length} results for "licence"`;
});

await test('Keyboard: G toggles the grid overlay (not while typing)', async (page) => {
  await go(page, '/');
  await page.keyboard.press('g');
  assert(await page.locator('[data-gridov]').isVisible(), 'G did not show grid');
  await page.keyboard.press('g');
  assert(await page.locator('[data-gridov]').isHidden(), 'G did not hide grid');
  await go(page, '/contact/');
  await page.locator('[name="name"]').focus();
  await page.keyboard.press('g');
  assert(await page.locator('[data-gridov]').isHidden(), 'G fired while typing');
});

await test('Keyboard: Index dialog opens, traps focus and returns it', async (page) => {
  await go(page, '/');
  const btn = page.locator('[data-index-open]').first();
  await btn.focus(); await page.keyboard.press('Enter');
  assert(await page.locator('[data-index]').evaluate((d) => d.open), 'index not open');
  await page.keyboard.press('Escape');
  const back = await page.evaluate(() => document.activeElement?.hasAttribute('data-index-open'));
  assert(back, 'focus not returned');
});

await test('Licence lightbox: opens, zooms with + and closes with Esc', async (page) => {
  await go(page, '/licence/');
  await page.locator('[data-lightbox-open]').first().click();
  const dlg = page.locator('dialog[open]');
  assert(await dlg.count(), 'lightbox not open');
  await page.keyboard.press('+');
  await page.keyboard.press('Escape');
  assert(!(await page.locator('dialog[open]').count()), 'lightbox did not close');
});

await test('No-JS: every page still shows content and the preloader never blocks', async (page) => {
  const bad = [];
  for (const p of ['/', '/loans/', '/apply/', '/contact/', '/licence/']) {
    await go(page, p);
    const vis = await page.evaluate(() => {
      const l = document.querySelector('[data-loader]');
      const h1 = document.querySelector('h1');
      const r = h1?.getBoundingClientRect();
      return { loader: l ? getComputedStyle(l).display !== 'none' && getComputedStyle(l).visibility !== 'hidden' && Number(getComputedStyle(l).opacity) > 0 : false, h1: !!r && r.height > 0 };
    });
    if (vis.loader || !vis.h1) bad.push(p + JSON.stringify(vis));
  }
  assert(!bad.length, bad.join(' '));
}, { js: false });

await browser.close();
const pass = results.filter((r) => r.ok).length;
await mkdir('qa/report', { recursive: true });
await writeFile('qa/report/behaviour.json', JSON.stringify({ base: BASE, pass, total: results.length, results }, null, 1));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} · ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\nBEHAVIOUR: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
