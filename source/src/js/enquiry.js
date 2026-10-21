// Contact page: the enquiry form (same delivery as Apply) and the open-now card.
import { $, $$, announce, copyText } from './utils.js';
import { CONFIG } from './config.js';
import { products } from '../data/site.mjs';
import {
  normalisePhone, phonePretty, phoneE164, PHONE_RE, EMAIL_RE, setError, showSummary, mountCounters,
  makeReference, hasEndpoint, post, looksAutomated, fallbackActions,
} from './form-kit.js';

export function mountEnquiry(main) {
  const form = $('[data-enquiry]', main);
  if (!form) return () => {};
  const offs = [mountCounters(form)];
  const startedAt = Date.now();
  const el = (n) => form.elements[n];
  const errsum = $('[data-errsum]', form);
  const out = $('[data-sendout]', form);

  const RULES = {
    name: () => (el('name').value.trim().length < 2 ? 'Enter your full name.' : ''),
    phone: () => {
      const v = el('phone').value.trim();
      if (!v) return 'Enter a phone number.';
      return PHONE_RE.test(normalisePhone(v)) ? '' : 'Enter a Ugandan phone number with 9 digits after +256, for example 702 634 848.';
    },
    email: () => {
      const v = el('email').value.trim();
      return v && !EMAIL_RE.test(v) ? 'Enter an email address in the format name@example.com, or leave it blank.' : '';
    },
    message: () => (el('message').value.trim().length < 5 ? 'Write your question.' : ''),
    consent: () => (el('consent').checked ? '' : 'Agree to Biashara using these details to reply.'),
  };
  const check = (name) => {
    const msg = RULES[name]();
    setError(el(name), document.getElementById(`enq-${name}-e`), msg);
    return msg;
  };
  const onInput = (e) => { const n = e.target.name; if (RULES[n] && e.target.getAttribute('aria-invalid') === 'true') check(n); };
  form.addEventListener('input', onInput); form.addEventListener('change', onInput);
  offs.push(() => { form.removeEventListener('input', onInput); form.removeEventListener('change', onInput); });

  const onSubmit = async (e) => {
    e.preventDefault();
    const errors = Object.keys(RULES).map((n) => ({ n, msg: check(n) })).filter((x) => x.msg).map((x) => ({ id: el(x.n).id, msg: x.msg }));
    showSummary(errsum, errors);
    if (errors.length) return;
    const bot = looksAutomated(form, startedAt, 3000);
    if (bot === 'fast') { showSummary(errsum, [{ id: 'enq-msg', msg: 'Take a moment to check your enquiry, then send it again.' }]); return; }
    const ref = makeReference();
    const n = normalisePhone(el('phone').value);
    const product = products.find((p) => p.slug === el('product').value);
    const data = {
      kind: 'enquiry', reference: ref, submittedAt: new Date().toISOString(),
      name: el('name').value.trim(), phone: phoneE164(n), email: el('email').value.trim(),
      product: product?.name || '', message: el('message').value.trim(), consent: true,
      website: el('website').value, elapsedMs: Date.now() - startedAt,
    };
    if (bot === 'honeypot') { render('post', ref, data, n); return; }
    if (!hasEndpoint()) { render('fallback', ref, data, n); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      const res = await post(data);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      render('post', ref, data, n);
    } catch (err) {
      console.warn(err);
      render('failed', ref, data, n);
    } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  };
  form.addEventListener('submit', onSubmit);
  offs.push(() => form.removeEventListener('submit', onSubmit));

  function render(mode, ref, data, n) {
    out.textContent = '';
    const head = document.createElement('p'); head.className = 'label accent tnum'; head.textContent = `Reference ${ref}`;
    const h = document.createElement('h3'); h.className = 'sendout__t';
    const p = document.createElement('p');
    out.append(head, h, p);
    if (mode === 'post') {
      h.textContent = 'Enquiry sent';
      p.textContent = 'The Kampala team will reply using the details you gave. Review time runs during office hours.';
      form.reset(); $$('[data-count-for]', form).forEach((o) => { o.textContent = '0 / 400'; });
    } else {
      h.textContent = mode === 'failed' ? 'Your enquiry could not be sent' : 'Your enquiry is ready to send';
      p.textContent = mode === 'failed'
        ? 'The connection failed, and nothing was lost. Send the same text by email or WhatsApp instead.'
        : 'Choose how to send it. Your email or WhatsApp opens with the enquiry written out; nothing is sent until you press send there.';
      const text = [
        `Enquiry · ${ref}`, '',
        `Name: ${data.name}`, `Phone: ${phonePretty(n)}`, ...(data.email ? [`Email: ${data.email}`] : []),
        ...(data.product ? [`Product: ${data.product}`] : []), '', data.message,
      ].join('\n');
      out.appendChild(fallbackActions({
        subject: `Enquiry ${ref}${data.product ? ' · ' + data.product : ''}`, body: text, text,
        onCopy: async (b) => { try { await copyText(text); b.lastChild.textContent = 'Copied'; announce('Enquiry text copied'); } catch { announce('Copy failed'); } },
      }));
      const note = document.createElement('p'); note.className = 'field__help mt-4';
      note.textContent = `Email goes to ${CONFIG.CONTACT.email}. Your details go into the message only when you open it.`;
      out.appendChild(note);
    }
    out.hidden = false;
    out.classList.toggle('is-sent', mode === 'post');
    out.focus();
    announce(h.textContent);
  }
  return () => offs.forEach((f) => f());
}
