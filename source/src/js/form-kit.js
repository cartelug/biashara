// Shared form pieces for Apply and Contact: validation messages, the error summary,
// character counters, the reference number and the two ways a file can leave the page
// (a POST to CONFIG.SUBMIT_ENDPOINT, or a pre-filled email / WhatsApp message).
import { CONFIG } from './config.js';
import { $, $$, kampalaParts, now } from './utils.js';

export const PHONE_RE = /^[347]\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Ugandan numbers: accept 07XX…, 7XX…, +2567XX…, 2567XX… with spaces or dashes.
export function normalisePhone(raw) {
  let d = String(raw || '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('256')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}
export const phoneE164 = (n) => '+256' + n;
export const phonePretty = (n) => `+256 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;

// Show or clear one field's message, keeping aria-invalid in step.
export function setError(input, errEl, msg) {
  if (errEl) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
  const targets = input instanceof Element ? [input] : (input || []);
  targets.forEach((el) => el.setAttribute('aria-invalid', msg ? 'true' : 'false'));
}

// The summary at the top of a form: a list of links to each problem, focused on submit.
export function showSummary(box, errors) {
  if (!box) return;
  const list = $('[data-errsum-list]', box);
  list.textContent = '';
  for (const e of errors) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + e.id; a.textContent = e.msg;
    a.addEventListener('click', (ev) => { ev.preventDefault(); const t = document.getElementById(e.id); t?.focus(); t?.scrollIntoView?.({ block: 'center' }); });
    li.appendChild(a); list.appendChild(li);
  }
  box.hidden = !errors.length;
  if (errors.length) box.focus();
}

export function mountCounters(root) {
  const offs = $$('[data-count-for]', root).map((out) => {
    const ta = document.getElementById(out.dataset.countFor);
    if (!ta) return () => {};
    const max = Number(ta.getAttribute('maxlength')) || 400;
    const paint = () => {
      const n = ta.value.length;
      out.textContent = `${n} / ${max}`;
      out.classList.toggle('is-near', n > max * 0.9);
    };
    ta.addEventListener('input', paint); paint();
    return () => ta.removeEventListener('input', paint);
  });
  return () => offs.forEach((f) => f());
}

// BTC-YYYYMMDD-XXXX: the Kampala date plus four characters that are hard to misread.
const ALPHA = 'ACDEFGHJKMNPQRTUVWXY3479';
export function makeReference(date = now()) {
  const { iso } = kampalaParts(date);
  const bytes = new Uint8Array(4);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  const tail = [...bytes].map((b) => ALPHA[b % ALPHA.length]).join('');
  return `BTC-${iso.replaceAll('-', '')}-${tail}`;
}

export const hasEndpoint = () => typeof CONFIG.SUBMIT_ENDPOINT === 'string' && /^https:\/\//.test(CONFIG.SUBMIT_ENDPOINT.trim());

// Field names in the email the inbox receives, in reading order.
const LABELS = {
  kind: 'Type', reference: 'Reference', submittedAt: 'Sent at', product: 'Product', amountUGX: 'Amount (UGX)', termMonths: 'Term (months)',
  indicativeInterestPerMonthUGX: 'Indicative interest per month (UGX)', indicativeInterestOverTermUGX: 'Indicative interest over the term (UGX)',
  applicant: 'Applying as', organisation: 'Organisation', name: 'Name', phone: 'Phone', email: 'Email', district: 'District',
  employer: 'Employer or business', years: 'Years in work or business', purpose: 'Purpose', targetDate: 'Funds needed by',
  documents: 'Documents ready', message: 'Message', consent: 'Consent',
};
const plain = (v) => (Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? Object.entries(v).filter(([, x]) => x).map(([k]) => k).join(', ') : String(v ?? ''));
const isFormSubmit = (url) => /(^|\.)formsubmit\.co$/i.test(new URL(url).hostname);

// FormSubmit turns each field into a row of the email; nested values are written out and a subject and reply-to are set.
function forFormSubmit(payload) {
  const out = {
    _subject: payload.kind === 'application'
      ? `Loan application ${payload.reference} · ${payload.product || ''} · ${payload.name || ''}`
      : `Website enquiry ${payload.reference} · ${payload.name || ''}`,
    _template: 'table', _captcha: 'false',
  };
  if (payload.email) out._replyto = payload.email;
  for (const [k, label] of Object.entries(LABELS)) {
    if (!(k in payload)) continue;
    const v = k === 'kind' ? (payload.kind === 'application' ? 'Loan application' : 'Enquiry') : plain(payload[k]);
    if (v !== '') out[label] = v;
  }
  return out;
}

// POST the payload. Resolves { ok, status } or rejects on network failure / timeout. Counts as sent only when the
// service says so: FormSubmit answers 200 with success "false" until the inbox has activated the form.
export async function post(payload) {
  const url = CONFIG.SUBMIT_ENDPOINT.trim();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(isFormSubmit(url) ? forFormSubmit(payload) : payload),
      signal: ctrl.signal,
      credentials: 'omit',
      mode: 'cors',
    });
    let ok = res.ok;
    if (ok && isFormSubmit(url)) {
      const data = await res.json().catch(() => ({}));
      ok = String(data.success) === 'true';
    }
    return { ok, status: res.status };
  } finally { clearTimeout(t); }
}

export const mailtoHref = (subject, body) => `mailto:${CONFIG.CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const whatsappHref = (text) => `https://wa.me/${CONFIG.CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
// For phones and computers without an email app: Gmail in the browser, with the same message.
export const gmailHref = (subject, body) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONFIG.CONTACT.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// Bot checks: a hidden field people never fill, and a minimum time on the form.
export function looksAutomated(form, startedAt, minMs) {
  const hp = form.querySelector('input[name="website"]');
  if (hp && hp.value.trim()) return 'honeypot';
  if (Date.now() - startedAt < minMs) return 'fast';
  return '';
}

// Markup for the three fallback actions (email, WhatsApp, copy). Built with DOM calls, never innerHTML on user text.
export function fallbackActions({ subject, body, text, onCopy }) {
  const wrap = document.createElement('div');
  wrap.className = 'sendvia';
  const mk = (tag, cls, label, icon) => {
    const el = document.createElement(tag); el.className = cls;
    el.insertAdjacentHTML('afterbegin', `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${icon}"/></svg>`);
    el.append(label);
    return el;
  };
  const mail = mk('a', 'btn', 'Send by email', 'mail'); mail.href = mailtoHref(subject, body);
  const wa = mk('a', 'btn btn--ink', 'Send on WhatsApp', 'chat'); wa.href = whatsappHref(text); wa.target = '_blank'; wa.rel = 'noopener';
  const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' (opens in a new tab)'; wa.appendChild(sr);
  const gm = mk('a', 'btn btn--secondary', 'Send with Gmail', 'mail'); gm.href = gmailHref(subject, body); gm.target = '_blank'; gm.rel = 'noopener';
  const sr2 = document.createElement('span'); sr2.className = 'sr-only'; sr2.textContent = ' (opens in a new tab)'; gm.appendChild(sr2);
  const copy = mk('button', 'btn btn--ghost', 'Copy the text', 'copy'); copy.type = 'button';
  copy.addEventListener('click', () => onCopy?.(copy));
  // the inbox address is always visible, so it can be typed into any email service
  const to = document.createElement('p'); to.className = 'sendvia__to';
  to.append('Our email: ');
  const a = document.createElement('a'); a.href = `mailto:${CONFIG.CONTACT.email}`; a.textContent = CONFIG.CONTACT.email; to.append(a);
  wrap.append(mail, gm, wa, copy, to);
  return wrap;
}
