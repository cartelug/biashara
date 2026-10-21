// Apply: a five-step loan file. Left, the current step; right, the "Your file" ledger
// (a bottom sheet on small screens). The red span is the progress bar.
// The page never says a facility is approved: it prepares and sends an application.
import { $, $$, store, announce, copyText, reducedMotion, fmtUGX, mq, withBase } from './utils.js';
import { CONFIG } from './config.js';
import { Odometer } from './odometer.js';
import { amountControl, termControl, interest, MIN, MAX } from './calculator.js';
import { products } from '../data/site.mjs';
import {
  normalisePhone, phonePretty, phoneE164, PHONE_RE, EMAIL_RE, setError, showSummary, mountCounters,
  makeReference, hasEndpoint, post, looksAutomated, fallbackActions,
} from './form-kit.js';

const KEY = 'btc-apply-v1';
const STEPS = ['Product', 'Amount and term', 'Your details', 'Purpose and documents', 'Review'];
const DOCS_TOTAL = 7;
const months = (n) => `${n} month${n === 1 ? '' : 's'}`;
const productBySlug = (s) => products.find((p) => p.slug === s);

const blank = () => ({
  step: 1, product: '', amount: 10_000_000, term: 3, applicant: 'individual', organisation: '', name: '', phone: '',
  email: '', district: '', employer: '', years: '', purpose: '', target: '', docs: [], ref: '', savedAt: 0,
});

export function mountApply(main) {
  const root = $('[data-apply]', main);
  const form = $('[data-apply-form]', main);
  if (!root || !form) return () => {};
  const offs = [];
  const listen = (el, type, fn, o) => { el.addEventListener(type, fn, o); offs.push(() => el.removeEventListener(type, fn, o)); };
  const startedAt = Date.now();

  const steps = $$('[data-step]', form);
  const errsum = $('[data-errsum]', form);
  const prevBtn = $('[data-prev]', form), nextBtn = $('[data-next]', form), submitBtn = $('[data-submit]', form);
  const savedOut = $('[data-saved]', form);
  const piers = $$('[data-aspan] li', main);
  const fill = $('[data-aspan-fill]', main);
  const fileEl = $('[data-afile]', main);
  const done = $('[data-done]', main);
  const grid = $('.apply__grid', main);
  const aspan = $('[data-aspan]', main);
  const f = (name) => form.elements[name];
  const out = Object.fromEntries($$('[data-f]', fileEl).map((el) => [el.dataset.f, el]));
  const odo = { amount: new Odometer(out.amount), monthly: new Odometer(out.monthly), total: new Odometer(out.total) };

  let state = blank();

  // ---- URL parameters: ?product=, ?amount=, ?term= (from product pages and the calculator)
  const q = new URLSearchParams(location.search);
  const fromUrl = {};
  if (productBySlug(q.get('product'))) fromUrl.product = q.get('product');
  const qa = Number(q.get('amount')); if (qa >= MIN && qa <= MAX) fromUrl.amount = Math.round(qa);
  const qt = Number(q.get('term')); if (qt >= 1 && qt <= 6) fromUrl.term = Math.round(qt);
  Object.assign(state, fromUrl);

  // ---- amount and term controls (the same components as the calculator)
  const amt = amountControl($('[data-amount-field]', form), { value: state.amount, onChange: (v) => { state.amount = v; paintFile(); save(); } });
  const term = termControl($('[data-term-field]', form), { value: state.term, onChange: (v) => { state.term = v; paintFile(); save(); } });
  offs.push(() => { amt.destroy(); term.destroy(); });
  offs.push(mountCounters(form));

  // ---- read and write the form <-> state
  function readForm() {
    state.product = f('product').value || '';
    state.applicant = f('applicant').value || 'individual';
    for (const k of ['organisation', 'name', 'phone', 'email', 'district', 'employer', 'years', 'purpose', 'target']) state[k] = f(k).value.trim();
    state.docs = $$('input[name="docs"]:checked', form).map((x) => x.value);
  }
  function writeForm() {
    $$('input[name="product"]', form).forEach((r) => { r.checked = r.value === state.product; });
    $$('input[name="applicant"]', form).forEach((r) => { r.checked = r.value === state.applicant; });
    for (const k of ['organisation', 'name', 'phone', 'email', 'district', 'employer', 'years', 'purpose', 'target']) f(k).value = state[k] || '';
    $$('input[name="docs"]', form).forEach((c) => { c.checked = state.docs.includes(c.value); });
    amt.set(state.amount); term.set(state.term, { emit: false });
    $$('[data-count-for]', form).forEach((o) => document.getElementById(o.dataset.countFor)?.dispatchEvent(new Event('input')));
    paintApplicant();
  }
  function paintApplicant() {
    const company = state.applicant === 'company';
    $$('[data-only]', form).forEach((el) => { el.hidden = el.dataset.only !== (company ? 'company' : 'individual'); });
  }

  // ---- the "Your file" ledger
  function paintFile() {
    const p = productBySlug(state.product);
    const { monthly, total } = interest(state.amount, state.term);
    out.product.textContent = p ? p.name : 'Not chosen';
    odo.amount.set(fmtUGX(state.amount));
    out.term.textContent = months(state.term);
    out.months.textContent = months(state.term);
    odo.monthly.set(fmtUGX(monthly));
    odo.total.set(fmtUGX(total));
    const who = state.applicant === 'company' ? (state.organisation || state.name) : state.name;
    out.applicant.textContent = who || 'Not entered';
    out.docs.textContent = `${state.docs.length} of ${DOCS_TOTAL}`;
    const peek = $('[data-peek]', fileEl);
    if (peek) peek.textContent = `${p ? p.short + ' · ' : ''}${fmtUGX(state.amount)} · ${months(state.term)}`;
    const ref = $('[data-file-ref]', fileEl); if (ref) ref.textContent = state.ref || 'BTC-········-····';
  }

  // ---- saving (this browser only)
  let saveTimer = 0;
  // Hold off saving while an earlier file is waiting for "Continue" or "Start again".
  const saved = store.get(KEY);
  const meaningful = saved && (saved.name || saved.product || saved.purpose || saved.phone);
  let canSave = !meaningful;
  function save() {
    if (!canSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      state.savedAt = Date.now();
      if (store.set(KEY, state) && savedOut) savedOut.textContent = 'Saved in this browser';
    }, 400);
  }
  offs.push(() => clearTimeout(saveTimer));

  listen(form, 'input', (e) => {
    if (e.target.closest('[data-amount-field]')) return;
    if (!canSave && resume && !resume.hidden) { resume.hidden = true; store.remove(KEY); canSave = true; }
    readForm(); paintFile(); save();
    if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target.name);
  });
  listen(form, 'change', (e) => {
    readForm();
    if (e.target.name === 'applicant') paintApplicant();
    paintFile(); save();
    if (e.target.name === 'product') setError($$('input[name="product"]', form), $('#err-product'), '');
  });

  // ---- validation, per step
  const RULES = {
    product: () => (state.product ? '' : 'Choose a product.'),
    organisation: () => (state.applicant === 'company' && !state.organisation ? 'Enter the company or organisation name.' : ''),
    name: () => (state.name.length < 2 ? (state.applicant === 'company' ? 'Enter the name of the contact person.' : 'Enter your full name.') : ''),
    phone: () => {
      if (!state.phone) return 'Enter a phone number.';
      return PHONE_RE.test(normalisePhone(state.phone)) ? '' : 'Enter a Ugandan phone number with 9 digits after +256, for example 702 634 848.';
    },
    email: () => {
      if (!state.email) return 'Enter an email address.';
      return EMAIL_RE.test(state.email) ? '' : 'Enter an email address in the format name@example.com.';
    },
    district: () => (state.district.length < 2 ? 'Enter your district.' : ''),
    employer: () => (!state.employer ? (state.applicant === 'company' ? 'Enter the line of business.' : 'Enter your employer or business.') : ''),
    years: () => (state.years && !/^\d{1,2}$/.test(state.years) ? 'Enter the years as a whole number, or leave it blank.' : ''),
    purpose: () => (state.purpose.length < 10 ? 'Describe the purpose in a sentence or two.' : ''),
    accurate: () => (f('accurate').checked ? '' : 'Confirm that the information is accurate.'),
    understand: () => (f('understand').checked ? '' : 'Confirm that you understand an application does not guarantee a facility.'),
    consent: () => (f('consent').checked ? '' : 'Agree to Biashara using these details to assess your application.'),
  };
  const STEP_FIELDS = { 1: ['product'], 2: [], 3: ['organisation', 'name', 'phone', 'email', 'district', 'employer', 'years'], 4: ['purpose'], 5: ['accurate', 'understand', 'consent'] };
  const fieldTarget = (name) => (name === 'product' ? $$('input[name="product"]', form) : f(name));
  const focusId = (name) => (name === 'product' ? $('input[name="product"]', form).id || setId($('input[name="product"]', form), 'ap-product-1') : f(name).id || setId(f(name), 'ap-' + name));
  function setId(el, id) { el.id = id; return id; }

  function validateField(name) {
    const rule = RULES[name]; if (!rule) return '';
    const msg = rule();
    setError(fieldTarget(name), document.getElementById('err-' + name), msg);
    return msg;
  }
  function validateStep(n) {
    readForm();
    const errors = [];
    if (n === 2 && !amt.validate()) errors.push({ id: 'ap-amt-in', msg: $('[data-amount-error]', form).textContent || 'Check the amount.' });
    for (const name of STEP_FIELDS[n]) {
      const msg = validateField(name);
      if (msg) errors.push({ id: focusId(name), msg });
    }
    showSummary(errsum, errors);
    return !errors.length;
  }

  // ---- steps
  function go(n, { focus = true, animate = true, persist = true } = {}) {
    n = Math.min(5, Math.max(1, n));
    const from = state.step;
    state.step = n;
    if (n === 5) { if (!state.ref) state.ref = makeReference(); renderReview(); }
    steps.forEach((s) => { s.hidden = Number(s.dataset.step) !== n; });
    prevBtn.hidden = n === 1;
    nextBtn.hidden = n === 5;
    submitBtn.hidden = n !== 5;
    piers.forEach((li, i) => {
      li.classList.toggle('is-done', i + 1 < n);
      li.classList.toggle('is-current', i + 1 === n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    const p = (n - 1) / 4;
    if (fill) {
      if (window.gsap && animate && !reducedMotion()) window.gsap.to(fill, { scaleX: p, duration: 0.9, ease: 'expo.out' });
      else fill.style.transform = `scaleX(${p})`;
    }
    const cur = steps[n - 1];
    if (animate && from !== n && window.gsap && !reducedMotion()) {
      window.gsap.fromTo(cur, { autoAlpha: 0, x: n > from ? 28 : -28 }, { autoAlpha: 1, x: 0, duration: 0.55, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    }
    paintFile(); if (persist) save();
    if (focus) {
      const h = $('.astep__t', cur);
      h?.focus({ preventScroll: true });
      const top = aspan.getBoundingClientRect().top + window.scrollY - 96;
      if (window.scrollY > top) window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' });
      announce(`Step ${n} of 5, ${STEPS[n - 1]}`);
    }
  }
  listen(nextBtn, 'click', () => { if (validateStep(state.step)) { showSummary(errsum, []); go(state.step + 1); } });
  listen(prevBtn, 'click', () => { showSummary(errsum, []); go(state.step - 1); });
  // Enter in a text field moves forward instead of submitting early.
  listen(form, 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"]):not([type="radio"])') && state.step < 5) { e.preventDefault(); nextBtn.click(); }
  });

  // ---- review
  function renderReview() {
    const dl = $('[data-review]', form);
    dl.textContent = '';
    const p = productBySlug(state.product);
    const { monthly, total } = interest(state.amount, state.term);
    const company = state.applicant === 'company';
    const rows = [
      [1, 'Product', p ? p.name : '—'],
      [2, 'Amount requested', fmtUGX(state.amount)],
      [2, 'Term', months(state.term)],
      [2, 'Indicative interest', `${fmtUGX(monthly)} per month · ${fmtUGX(total)} over ${months(state.term)}`],
      [3, 'Applying as', company ? 'A company or organisation' : 'An individual'],
      ...(company ? [[3, 'Organisation', state.organisation]] : []),
      [3, company ? 'Contact person' : 'Name', state.name],
      [3, 'Phone', PHONE_RE.test(normalisePhone(state.phone)) ? phonePretty(normalisePhone(state.phone)) : state.phone],
      [3, 'Email', state.email],
      [3, 'District', state.district],
      [3, company ? 'Line of business' : 'Employer or business', state.employer],
      ...(state.years ? [[3, company ? 'Years in operation' : 'Years', state.years]] : []),
      [4, 'Purpose', state.purpose],
      ...(state.target ? [[4, 'Target date', state.target]] : []),
      [4, 'Documents ticked', state.docs.length ? state.docs.join('; ') : 'None ticked yet. Come in anyway.'],
    ];
    for (const [step, k, v] of rows) {
      const row = document.createElement('div'); row.className = 'review__row';
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v || '—';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'review__edit'; b.textContent = 'Edit';
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' ' + k.toLowerCase(); b.appendChild(sr);
      b.addEventListener('click', () => go(step));
      row.append(dt, dd, b); dl.appendChild(row);
    }
  }

  // ---- plain-text file for email and WhatsApp
  function fileText() {
    const p = productBySlug(state.product);
    const { monthly, total } = interest(state.amount, state.term);
    const company = state.applicant === 'company';
    const phone = PHONE_RE.test(normalisePhone(state.phone)) ? phonePretty(normalisePhone(state.phone)) : state.phone;
    return [
      `Loan application · ${state.ref}`,
      '',
      `Product: ${p ? p.name : ''}`,
      `Amount requested: ${fmtUGX(state.amount)}`,
      `Term: ${months(state.term)}`,
      `Indicative interest (2.8% per month on the principal): ${fmtUGX(monthly)} per month, ${fmtUGX(total)} over ${months(state.term)}`,
      '',
      `Applying as: ${company ? 'Company or organisation' : 'Individual'}`,
      ...(company ? [`Organisation: ${state.organisation}`] : []),
      `${company ? 'Contact person' : 'Name'}: ${state.name}`,
      `Phone: ${phone}`,
      `Email: ${state.email}`,
      `District: ${state.district}`,
      `${company ? 'Line of business' : 'Employer or business'}: ${state.employer}`,
      ...(state.years ? [`Years: ${state.years}`] : []),
      '',
      `Purpose: ${state.purpose}`,
      ...(state.target ? [`Target date: ${state.target}`] : []),
      `Documents I can provide: ${state.docs.length ? state.docs.join('; ') : 'none ticked yet'}`,
      '',
      'I understand that an application does not guarantee a facility, and that final terms are confirmed in writing at approval.',
    ].join('\n');
  }
  function payload() {
    const p = productBySlug(state.product);
    const { monthly, total } = interest(state.amount, state.term);
    const n = normalisePhone(state.phone);
    return {
      kind: 'application', reference: state.ref, submittedAt: new Date().toISOString(),
      product: p?.name || '', productSlug: state.product, amountUGX: state.amount, termMonths: state.term,
      indicativeInterestPerMonthUGX: monthly, indicativeInterestOverTermUGX: total,
      applicant: state.applicant, organisation: state.organisation, name: state.name,
      phone: PHONE_RE.test(n) ? phoneE164(n) : state.phone, email: state.email, district: state.district,
      employer: state.employer, years: state.years, purpose: state.purpose, targetDate: state.target, documents: state.docs,
      consent: { accurate: true, understandsNoGuarantee: true, dataUse: true },
      website: f('website').value, elapsedMs: Date.now() - startedAt,
    };
  }

  // ---- submit
  listen(form, 'submit', async (e) => {
    e.preventDefault();
    if (state.step !== 5) { nextBtn.click(); return; }
    // every earlier step must still be valid (the visitor may have edited and come back)
    for (const n of [1, 2, 3, 4]) {
      if (!validateStepQuiet(n)) { go(n); validateStep(n); return; }
    }
    if (!validateStep(5)) return;
    const bot = looksAutomated(form, startedAt, 8000);
    if (bot === 'honeypot') { finish('post'); return; } // quietly drop
    if (bot === 'fast') { showSummary(errsum, [{ id: 'st5-t', msg: 'Take a moment to check your file, then send it again.' }]); return; }
    if (!hasEndpoint()) { finish('fallback'); return; }
    submitBtn.disabled = true;
    const label = submitBtn.lastChild; const old = label.textContent;
    submitBtn.setAttribute('aria-busy', 'true'); label.textContent = 'Sending…';
    try {
      const res = await post(payload());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      finish('post');
    } catch (err) {
      console.warn(err);
      finish('failed');
    } finally {
      submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); label.textContent = old;
    }
  });
  function validateStepQuiet(n) {
    readForm();
    if (n === 2) return state.amount >= MIN && state.amount <= MAX;
    return STEP_FIELDS[n].every((name) => !RULES[name]());
  }

  // ---- the ticket
  function finish(mode) {
    const sent = mode === 'post';
    if (sent) store.remove(KEY);
    const p = productBySlug(state.product);
    const { monthly, total } = interest(state.amount, state.term);
    const phone = PHONE_RE.test(normalisePhone(state.phone)) ? phonePretty(normalisePhone(state.phone)) : state.phone;
    const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const stampText = sent ? 'RECEIVED' : 'READY TO SEND';
    const title = sent ? 'Your file has been sent' : mode === 'failed' ? 'Your file could not be sent' : 'Your file is ready to send';
    const lede = sent
      ? 'Biashara has your application. The team will contact you using the details you gave.'
      : mode === 'failed'
        ? 'The connection failed, and nothing was lost. Send the same file by email or WhatsApp instead.'
        : 'Choose how to send it. Your email or WhatsApp opens with the whole file written out; nothing is sent until you press send there.';

    done.textContent = '';
    done.insertAdjacentHTML('afterbegin', `
      <div class="grid done__grid">
        <div class="s-5 md-s-12 done__intro">
          <p class="label accent tnum">Step 05 of 05 · ${sent ? 'Sent' : 'Prepared'}</p>
          <h2 class="h2 mt-4" id="done-t"></h2>
          <p class="secthead__lede" data-done-lede></p>
          <div class="mt-6" data-done-actions></div>
          <p class="mt-6 done__restart"><button class="link-arrow" type="button" data-restart>Start a new file<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></button></p>
        </div>
        <article class="ticket s-6 o-7 md-s-12" aria-label="Application ticket">
          <div class="ticket__perf" aria-hidden="true"></div>
          <div class="ticket__body">
            <header class="ticket__head">
              <img src="${withBase('/assets/img/logo/biashara-logo-96.png')}" width="48" height="62" alt="">
              <div><p class="ticket__co">Biashara Trading Company Limited</p><p class="label muted">Loan application · Money Lending Licence 1451/ML</p></div>
            </header>
            <div class="ticket__stamp${sent ? '' : ' ticket__stamp--wait'}" aria-hidden="true">
              <svg viewBox="0 0 300 120" width="300" height="120" focusable="false">
                <defs><filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 .85 1 1 .9 1"/></feComponentTransfer></filter></defs>
                <g filter="url(#ink)" fill="none" stroke="currentColor">
                  <rect x="4" y="4" width="292" height="112" stroke-width="4"/>
                  <rect x="12" y="12" width="276" height="96" stroke-width="1.5"/>
                  <text x="150" y="${sent ? 70 : 68}" text-anchor="middle" fill="currentColor" stroke="none" class="ticket__stamp-t">${stampText}</text>
                  <text x="150" y="96" text-anchor="middle" fill="currentColor" stroke="none" class="ticket__stamp-s" data-stamp-date></text>
                </g>
              </svg>
            </div>
            <p class="label">Reference</p>
            <p class="ticket__ref tnum" data-t="ref"></p>
            <dl class="ledger ticket__ledger">
              <div class="ledger__row"><dt>Date</dt><dd class="tnum" data-t="when"></dd></div>
              <div class="ledger__row"><dt>Product</dt><dd data-t="product"></dd></div>
              <div class="ledger__row"><dt>Amount requested</dt><dd class="tnum" data-t="amount"></dd></div>
              <div class="ledger__row"><dt>Term</dt><dd class="tnum" data-t="term"></dd></div>
              <div class="ledger__row"><dt>Indicative interest</dt><dd class="tnum" data-t="interest"></dd></div>
              <div class="ledger__row ledger__row--hatch"><dt>Processing fee, other charges</dt><dd>Disclosed at approval</dd></div>
              <div class="ledger__row"><dt>Applicant</dt><dd data-t="who"></dd></div>
              <div class="ledger__row"><dt>Phone</dt><dd class="tnum" data-t="phone"></dd></div>
            </dl>
            <div class="tearline" aria-hidden="true"></div>
            <h3 class="label accent">What happens next</h3>
            <ol class="ticket__next" role="list">
              <li><b>Assess.</b> Complete files: review target within 4 working hours. We check purpose, affordability and required security.</li>
              <li><b>Approve &amp; accept.</b> Approved terms, interest and any loan charges are scheduled in writing. You accept them before signing.</li>
              <li><b>Disburse.</b> Funds are released once verification, accepted terms and all conditions are complete.</li>
            </ol>
            <p class="ticket__fine">This ticket is not an approval. An application does not guarantee a facility. Review time runs during office hours. Figures are the standard published terms; final terms are confirmed in writing at approval.</p>
          </div>
          <div class="ticket__perf ticket__perf--b" aria-hidden="true"></div>
        </article>
      </div>`);
    $('#done-t', done).textContent = title;
    $('[data-done-lede]', done).textContent = lede;
    $('[data-stamp-date]', done).textContent = state.ref;
    const set = (k, v) => { $(`[data-t="${k}"]`, done).textContent = v; };
    set('ref', state.ref); set('when', when); set('product', p?.name || '');
    set('amount', fmtUGX(state.amount)); set('term', months(state.term));
    set('interest', `${fmtUGX(monthly)} per month · ${fmtUGX(total)} in total`);
    set('who', state.applicant === 'company' ? `${state.organisation} (${state.name})` : state.name);
    set('phone', phone);

    const actions = $('[data-done-actions]', done);
    if (!sent) {
      const text = fileText();
      actions.appendChild(fallbackActions({
        subject: `Loan application ${state.ref} · ${p?.name || ''}`,
        body: text, text,
        onCopy: async (btn) => {
          try { await copyText(text); btn.lastChild.textContent = 'Copied'; announce('File text copied'); } catch { announce('Copy failed. Select the text in the review instead.'); }
        },
      }));
      const note = document.createElement('p'); note.className = 'field__help mt-4';
      note.textContent = `Email goes to ${CONFIG.CONTACT.email}; WhatsApp goes to +${CONFIG.CONTACT.whatsapp.replace(/^256(\d{3})(\d{3})(\d{3})$/, '256 $1 $2 $3')}. Your details go into the message only when you open it.`;
      actions.appendChild(note);
    }
    const print = document.createElement('button'); print.type = 'button'; print.className = 'btn btn--ghost btn--sm mt-4';
    print.insertAdjacentHTML('afterbegin', '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-print"/></svg>');
    print.append('Print the ticket'); print.addEventListener('click', () => window.print());
    actions.appendChild(print);
    $('[data-restart]', done).addEventListener('click', () => { store.remove(KEY); state = blank(); writeForm(); done.hidden = true; grid.hidden = false; aspan.hidden = false; go(1); });

    grid.hidden = true; aspan.hidden = true; done.hidden = false;
    root.classList.add('is-done');
    window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.scrollY - 96), behavior: 'auto' });
    done.focus({ preventScroll: true });
    announce(title);
    if (window.gsap && !reducedMotion()) {
      const t = $('.ticket', done), st = $('.ticket__stamp', done);
      window.gsap.from(t, { y: 40, autoAlpha: 0, duration: 0.8, ease: 'expo.out' });
      window.gsap.from(st, { scale: 1.6, autoAlpha: 0, rotation: -8, duration: 0.42, delay: 0.55, ease: 'power4.in', clearProps: 'transform' });
    }
    window.ScrollTrigger?.refresh();
  }

  // ---- bottom sheet on small screens
  const toggle = $('[data-afile-toggle]', fileEl);
  listen(toggle, 'click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    fileEl.classList.toggle('is-open', open);
  });
  listen(document, 'keydown', (e) => { if (e.key === 'Escape' && fileEl.classList.contains('is-open')) { toggle.click(); toggle.focus(); } });
  const mqDesk = mq('(min-width: 1100px)');
  const onMq = () => { if (mqDesk.matches) { fileEl.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); } };
  mqDesk.addEventListener?.('change', onMq); offs.push(() => mqDesk.removeEventListener?.('change', onMq));

  // ---- resume a saved file
  const resume = $('[data-resume]', main);
  if (meaningful && resume) {
    resume.hidden = false;
    const when = $('[data-resume-when]', resume);
    if (when && saved.savedAt) when.textContent = 'Last saved ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(saved.savedAt)) + '.';
    $('[data-resume-yes]', resume).addEventListener('click', () => {
      state = { ...blank(), ...saved, ...fromUrl };
      canSave = true; writeForm(); resume.hidden = true; go(Math.min(saved.step || 1, 5));
    });
    $('[data-resume-no]', resume).addEventListener('click', () => { store.remove(KEY); canSave = true; resume.hidden = true; $('.astep__t', steps[0])?.focus(); });
  }

  writeForm();
  go(1, { focus: false, animate: false, persist: false });
  return () => offs.forEach((fn) => fn && fn());
}
