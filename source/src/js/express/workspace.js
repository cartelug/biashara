import { MAX_PRINCIPAL, STATES, validatePrincipal, transitionApplication, requestDisbursement, assessGraduation, arrearsBucket } from './domain.js';
import { sampleData } from './sample.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (value) => 'UGX ' + value.toLocaleString('en-UG');
const badge = (status) => `<span class="bx-badge bx-badge--${esc(status)}">${esc(STATES[status] || status)}</span>`;
const heading = (kicker, title, copy) => `<header class="bx-view-head"><p class="label accent">${kicker}</p><h2 data-bx-heading tabindex="-1">${title}</h2><p>${copy}</p></header>`;
const go = (view, label, primary = false) => `<button type="button" class="${primary ? 'btn' : 'bx-link'}" data-bx-view="${view}">${label}<span aria-hidden="true"> →</span></button>`;
const note = (text) => `<div class="bx-notice">${text}</div>`;

export function mountExpress(main) {
  const root = main.querySelector('[data-express]');
  if (!root) return () => {};
  const content = root.querySelector('[data-bx-content]');
  const announcer = root.querySelector('[data-bx-announcer]');
  let data = sampleData(), view = 'home', selected = data.applications[0].id;
  let role = 'officer', step = 1, search = '', filter = 'all', message = '';
  let draft = { principal: 500_000, product: 'Business', identity: false, income: false, consent: false };
  const current = () => data.applications.find((record) => record.id === selected) || data.applications[0];
  const say = (text) => { announcer.textContent = text; };
  const focusHeading = () => content.querySelector('[data-bx-heading]')?.focus({ preventScroll: true });
  const fileOptions = () => data.applications.map((r) => `<option value="${esc(r.id)}"${selected === r.id ? ' selected' : ''}>${esc(r.id)} / ${esc(r.member)}</option>`).join('');

  function overview() {
    const waiting = data.applications.filter((r) => ['submitted', 'in_review', 'recommended'].includes(r.status)).length;
    return heading('YOUR NEXT STEP', 'Good decisions start with a clear file.', 'Explore the borrower experience, then see how the same file reaches an officer.') +
      `<div class="bx-summary"><div><span>Files in review queues</span><strong>${waiting.toString().padStart(2, '0')}</strong><small>Synthetic applications</small></div><div><span>Follow-up cases</span><strong>${data.cases.length.toString().padStart(2, '0')}</strong><small>Sample cases, assigned for review</small></div><div><span>Money moved</span><strong>None</strong><small>Payment services are not connected</small></div></div>
      <div class="bx-next"><div><p class="label">01 / Start here</p><h3>A short application.<br>A decision made by a person.</h3><p>Choose an amount, check your evidence and review your file. Try the entire journey using sample details.</p>${go('apply', 'Try an application', true)}</div><div class="bx-next__path"><ol><li><span>01</span><div><strong>Build your file</strong><small>Amount, purpose and evidence</small></div></li><li><span>02</span><div><strong>Follow the review</strong><small>Requests and decisions in one timeline</small></div></li><li><span>03</span><div><strong>Build your history</strong><small>Progress reviewed by an officer</small></div></li></ol></div></div>
      <div class="bx-two"><article class="bx-card"><span class="label accent">For the borrower</span><h3>Know where things stand.</h3><p>Track your sample application and see what is needed next.</p>${go('track', 'View a sample file')}</article><article class="bx-card"><span class="label accent">For the team</span><h3>Review with context.</h3><p>Check evidence, record reasons and send recommendations to a supervisor.</p>${go('officer', 'Open the review desk')}</article></div>`;
  }

  function application() {
    const error = validatePrincipal(draft.principal);
    const tabs = ['Amount & purpose', 'Evidence', 'Review'];
    let fields = '';
    if (step === 1) fields = `<label for="bx-product">What would the loan support?</label><select id="bx-product" name="product" class="input">${['Business', 'Education', 'Personal'].map((p) => `<option${p === draft.product ? ' selected' : ''}>${p}</option>`).join('')}</select>
      <label for="bx-amount">Requested principal <span class="muted">(UGX)</span></label><input class="input bx-amount tnum" id="bx-amount" type="number" inputmode="numeric" name="principal" min="1" max="2000000" step="1" value="${Number.isFinite(draft.principal) ? draft.principal : ''}" aria-describedby="bx-amount-help bx-error">
      <p class="field__help" id="bx-amount-help">Maximum UGX 2,000,000 per loan. The product minimum, fees and term await policy approval.</p>
      <div class="bx-picks" aria-label="Example amounts">${[250_000, 500_000, 1_200_000, MAX_PRINCIPAL].map((n) => `<button type="button" data-bx-amount="${n}" aria-pressed="${draft.principal === n}">${money(n)}</button>`).join('')}</div>
      ${note('Example purposes only. A request does not guarantee a loan. No pricing or repayment terms are being offered in this preview.')}`;
    if (step === 2) fields = `<h3>What can be reviewed?</h3><p>Use the sample checklist. Do not enter an ID number or upload real documents.</p><label class="bx-check"><input type="checkbox" name="identity"${draft.identity ? ' checked' : ''}><span>Sample identity evidence available</span></label><label class="bx-check"><input type="checkbox" name="income"${draft.income ? ' checked' : ''}><span>Sample income evidence available</span></label>${note('Missing evidence can be requested by an officer. Secure uploads and identity verification will be added with the protected backend.')}`;
    if (step === 3) fields = `<dl class="bx-record"><div><dt>Applicant</dt><dd>New demo member</dd></div><div><dt>Purpose</dt><dd>${esc(draft.product)}</dd></div><div><dt>Requested principal</dt><dd>${Number.isFinite(draft.principal) ? money(draft.principal) : 'Choose an amount'}</dd></div><div><dt>Identity evidence</dt><dd>${draft.identity ? 'Sample available' : 'To be requested'}</dd></div><div><dt>Income evidence</dt><dd>${draft.income ? 'Sample available' : 'To be requested'}</dd></div><div><dt>Rate, fees & term</dt><dd>Awaiting approved policy</dd></div></dl><label class="bx-check"><input type="checkbox" name="consent"${draft.consent ? ' checked' : ''}><span>I understand this creates a sample file only. This is not a real loan application or offer.</span></label>`;
    return heading('BORROWER / APPLICATION', 'Let’s put your file together.', 'Three short steps. No real personal details needed.') +
      `<ol class="bx-steps" aria-label="Application steps">${tabs.map((t, i) => `<li${step === i + 1 ? ' aria-current="step"' : ''}><span>${i + 1}</span>${t}</li>`).join('')}</ol><div class="bx-form-grid"><form data-bx-form novalidate><div class="bx-form-fields">${fields}</div><p id="bx-error" class="bx-error" role="alert">${esc(message || (step === 1 && error ? error : ''))}</p><div class="bx-form-actions">${step > 1 ? '<button type="button" class="btn btn--ghost" data-bx-back>Back</button>' : ''}<button class="btn" type="submit">${step === 3 ? 'Create sample file' : 'Continue'}<span aria-hidden="true"> →</span></button><small>Step ${step} of 3</small></div></form><aside class="bx-form-aside"><span class="label">A clear agreement first</span><h3>No surprises.<br>No automatic decisions.</h3><p>Before a real loan can be accepted, you must see the full borrowing cost, approved schedule and contract.</p><dl><div><dt>Loan ceiling</dt><dd>UGX 2,000,000</dd></div><div><dt>Review</dt><dd>Officer-led</dd></div><div><dt>Terms & fees</dt><dd>Policy pending</dd></div></dl></aside></div>`;
  }

  function track() {
    const r = current();
    const sequence = ['submitted', 'in_review', 'recommended', 'approved'];
    const reached = r.status === 'needs_information' ? 1 : sequence.indexOf(r.status);
    const next = { submitted: 'An officer will review the file.', in_review: 'Identity and affordability evidence need review.', needs_information: 'More evidence has been requested. An officer can help with the next steps.', recommended: 'A separate supervisor must review the recommendation.', approved: 'Release is pending. No disbursement service is connected.', declined: 'The decision reason belongs in the file history.' }[r.status];
    return heading('BORROWER / TRACKING', 'Every step, in view.', 'Choose a synthetic file to explore its current status.') +
      `<label class="label" for="bx-track-file">Sample file</label><select id="bx-track-file" class="input bx-file-select" data-bx-file>${fileOptions()}</select><div class="bx-status-card"><div><span class="label">${esc(r.id)} / ${esc(r.member)}</span><h3>${money(r.principal)}</h3><p>${esc(r.product)} / Sample application</p></div>${badge(r.status)}</div>
      <ol class="bx-timeline">${['File submitted', 'Officer review', 'Supervisor decision', 'Ready for release'].map((t, i) => `<li class="${i <= reached ? 'is-reached' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><div><strong>${t}</strong><small>${i <= reached ? 'Sample stage reached' : 'Not yet reached'}</small></div></li>`).join('')}</ol>${note(`<strong>Next step:</strong> ${esc(next)}`)}
      <div class="bx-two"><article class="bx-card"><h3>Payment status</h3><p>No payment request exists for this sample. A receipt should appear only after a provider confirms settlement.</p><button type="button" class="bx-link" data-bx-payment>Check payment availability →</button></article><article class="bx-card"><h3>Your evidence</h3><p>Identity: ${r.checks.identity ? 'sample reviewed' : 'awaiting review'}<br>Affordability: ${r.checks.affordability ? 'sample reviewed' : 'awaiting review'}</p>${go('officer', 'See the team’s view')}</article></div><div class="bx-feedback" role="status">${esc(message)}</div>`;
  }

  function progress() {
    return heading('BORROWER / MY PROGRESS', 'Build a history. Earn a review.', 'Progression is a chance for reassessment. An officer reviews each application and stage change.') +
      `<div class="bx-progress-banner"><div><span class="label">Illustrative starting stage</span><h3>01 / Start</h3><p>Make your first record a clear one.</p></div><span class="bx-progress-mark" aria-hidden="true">01<span>/ 05</span></span></div>
      <ol class="bx-stage-list">${[['Start', '100,000–250,000'], ['Build', '250,001–500,000'], ['Grow', '500,001–1,000,000'], ['Advance', '1,000,001–1,500,000'], ['Excel', '1,500,001–2,000,000']].map(([name, range], i) => `<li><span class="label">0${i + 1}</span><strong>${name}</strong><span>UGX ${range}</span><small>Illustrative band</small></li>`).join('')}</ol>
      ${note('These stages and loan bands are proposals from V6, not eligibility promises. Review criteria and the product minimum need management approval.')}
      <h3 class="bx-subheading">What a review should consider</h3><ul class="bx-checklist"><li>Current identity and income evidence</li><li>Satisfactorily closed loans and repayment punctuality</li><li>Current arrears, affordability and other obligations</li><li>Officer recommendation and required supervisor sign-off</li></ul><p class="bx-policy-status"><strong>Current rule status:</strong> ${esc(assessGraduation({currentArrears: 0, evidenceCurrent: true, satisfactoryClosedLoans: 1}, null))}.</p>`;
  }

  function queueRows() {
    const records = data.applications.filter((r) => (filter === 'all' || r.status === filter) && `${r.id} ${r.member} ${r.product}`.toLowerCase().includes(search.toLowerCase()));
    return records.length ? records.map((r) => `<button type="button" class="bx-queue-item${selected === r.id ? ' is-selected' : ''}" data-bx-select="${esc(r.id)}" aria-pressed="${selected === r.id}"><span class="bx-queue-item__top"><strong>${esc(r.member)}</strong><span>${money(r.principal)}</span></span><span class="bx-queue-item__meta">${esc(r.id)} / ${esc(r.product)}</span>${badge(r.status)}</button>`).join('') : '<p class="bx-empty">No sample files match. Try another search or status.</p>';
  }

  function officer() {
    const r = current();
    const editable = role === 'officer' && r.status === 'in_review';
    const actions = role === 'officer' ? (r.status === 'submitted' ? [['review', 'Begin review']] : r.status === 'in_review' ? [['request_information', 'Request evidence'], ['recommend', 'Recommend'], ['decline', 'Decline']] : []) : (r.status === 'recommended' ? [['approve', 'Approve for release'], ['decline', 'Decline']] : []);
    return heading('TEAM / REVIEW DESK', 'The right context. A recorded decision.', 'Try the officer and supervisor roles on synthetic records. This role selector is a preview control, not authentication.') +
      `<div class="bx-toolbar"><div><label for="bx-search">Find a sample file</label><input id="bx-search" class="input" type="search" placeholder="Reference, member or purpose" data-bx-search value="${esc(search)}"></div><div><label for="bx-filter">Status</label><select id="bx-filter" class="input" data-bx-filter><option value="all">All statuses</option>${Object.entries(STATES).filter(([key]) => key !== 'draft').map(([key, label]) => `<option value="${key}"${filter === key ? ' selected' : ''}>${label}</option>`).join('')}</select></div><div><label for="bx-role">Preview role</label><select class="input" id="bx-role" data-bx-role><option value="officer"${role === 'officer' ? ' selected' : ''}>Credit officer</option><option value="supervisor"${role === 'supervisor' ? ' selected' : ''}>Supervisor</option></select></div></div>
      <div class="bx-review-grid"><div class="bx-queue" data-bx-queue aria-label="Sample review queue">${queueRows()}</div><section class="bx-review" aria-labelledby="bx-review-title"><div class="bx-review__head"><div><span class="label">${esc(r.id)}</span><h3 id="bx-review-title">${esc(r.member)}</h3></div>${badge(r.status)}</div><dl class="bx-record"><div><dt>Principal requested</dt><dd>${money(r.principal)}</dd></div><div><dt>Purpose</dt><dd>${esc(r.product)}</dd></div><div><dt>Rate, fees & term</dt><dd>Awaiting policy approval</dd></div><div><dt>Source</dt><dd>Synthetic preview record</dd></div></dl>
      <fieldset class="bx-evidence"><legend>Evidence review</legend><label class="bx-check"><input type="checkbox" data-bx-check="identity"${r.checks.identity ? ' checked' : ''}${editable ? '' : ' disabled'}><span>Sample identity evidence reviewed</span></label><label class="bx-check"><input type="checkbox" data-bx-check="affordability"${r.checks.affordability ? ' checked' : ''}${editable ? '' : ' disabled'}><span>Sample affordability evidence reviewed</span></label></fieldset>
      ${actions.length ? `<label for="bx-reason">Decision or action reason</label><textarea id="bx-reason" class="input" rows="2" maxlength="300" placeholder="Sample reason only; at least 8 characters" aria-describedby="bx-action-result"></textarea><div class="bx-actions">${actions.map(([action, label]) => `<button type="button" class="btn${['recommend', 'approve', 'review'].includes(action) ? '' : ' btn--ghost'}" data-bx-action="${action}">${label}</button>`).join('')}</div>` : note(r.status === 'recommended' ? 'Choose the supervisor preview role to review this recommendation.' : r.status === 'approved' ? 'Release pending. Approval has not moved any money.' : 'No decision action is available to this role at this stage.')}
      <p class="bx-feedback" id="bx-action-result" role="status">${esc(message)}</p><h4>Session event history</h4>${r.history.length ? `<ol class="bx-events">${r.history.map((event) => `<li><strong>${esc(STATES[event.to] || event.action)}</strong><span>${esc(event.reason)}</span><small>${esc(event.role)} / ${esc(event.at.replace('T', ' ').slice(0, 16))} UTC</small></li>`).join('')}</ol>` : '<p class="muted">No events recorded in this preview session yet.</p>'}</section></div>`;
  }

  function collections() {
    return heading('TEAM / FOLLOW-UPS', 'A useful next step for every case.', 'Sample arrears and principal balances. Charges and repayment schedules await approved policy.') +
      `<div class="bx-case-list">${data.cases.map((c) => `<article class="bx-case"><div class="bx-case__head"><div><span class="label">${esc(c.id)}</span><h3>${esc(c.member)}</h3></div><span class="bx-badge bx-badge--needs_information">${arrearsBucket(c.days)}</span></div><dl class="bx-case__numbers"><div><dt>Principal remaining</dt><dd>${money(c.principalRemaining)}</dd></div><div><dt>Principal overdue</dt><dd>${money(c.principalOverdue)}</dd></div></dl><p><strong>Next action:</strong> ${esc(c.next)}</p><form data-bx-followup="${c.id}"><label for="note-${c.id}">Sample follow-up note</label><div class="bx-inline-form"><input class="input" id="note-${c.id}" name="note" required minlength="8" maxlength="240" placeholder="Use fictional details only"><button class="btn btn--sm" type="submit">Add note</button></div></form>${c.notes.length ? `<ol class="bx-events">${c.notes.map((n) => `<li>${esc(n.text)}<small>${esc(n.at.replace('T', ' ').slice(0, 16))} UTC / demo collections officer</small></li>`).join('')}</ol>` : ''}</article>`).join('')}</div>${note('Respectful, assigned follow-ups only. A third party making a payment does not gain access to the borrower’s account. Real messaging and payment services are not connected.')}<p class="bx-feedback" role="status">${esc(message)}</p>`;
  }

  function collateral() {
    return heading('TEAM / COLLATERAL', 'Evidence first. Status follows.', 'A title scan or a map pin is evidence for review. It does not create registered security.') +
      `<div class="bx-status-card"><div><span class="label">SAMPLE RECORD / COLL-01</span><h3>Land-title review</h3><p>Demo member 04 / illustrative evidence only</p></div><span class="bx-badge">Under review</span></div><dl class="bx-record"><div><dt>Title / plot reference</dt><dd>Fictional reference / SAMPLE-01</dd></div><div><dt>Ownership check</dt><dd>Awaiting authorized evidence</dd></div><div><dt>Location pin</dt><dd>Optional evidence; none collected</dd></div><div><dt>Valuation</dt><dd>Awaiting review</dd></div><div><dt>Legal sign-off</dt><dd>Not supplied</dd></div></dl>
      <ol class="bx-timeline"><li class="is-reached"><span>01</span><div><strong>Proposed</strong><small>Record the claimed collateral</small></div></li><li class="is-reached"><span>02</span><div><strong>Under review</strong><small>Check ownership and supporting evidence</small></div></li><li><span>03</span><div><strong>Verified</strong><small>Authorized officer confirms checks</small></div></li><li><span>04</span><div><strong>Legally perfected</strong><small>Required legal evidence and sign-off</small></div></li><li><span>05</span><div><strong>Released</strong><small>Document authorized release</small></div></li></ol>
      ${note('Security PINs protect account actions. GPS pins describe a location. These are separate records with separate permissions. No real documents, coordinates or biometric data are collected in this preview.')}`;
  }

  function readiness() {
    const rows = [
      ['Borrower application & tracking', 'Interactive preview', 'Sample files, amount validation, evidence checklist and status timeline.'],
      ['Officer decisions & reasons', 'Interactive preview', 'Review, evidence request, recommendation and separate supervisor approval.'],
      ['Follow-ups & event history', 'Session only', 'Synthetic case notes and in-memory events; reset on reload.'],
      ['UGX 2M principal rule', 'Shared rule tested', 'Production APIs, database, imports and payout boundaries still need enforcement.'],
      ['Accounts, roles & secure storage', 'Backend required', 'Authentication, MFA, assignment permissions, protected uploads and durable audit.'],
      ['Rates, fees & repayment terms', 'Policy required', 'No prices or approved minimum are invented.'],
      ['Payments & reconciliation', 'Provider required', 'No real collections, disbursements, receipts or settled transactions.'],
      ['Biometrics, OTP & identity checks', 'Integration required', 'No fingerprint collection or claim of connected verification.'],
      ['Graduation & collateral', 'Rules / screen preview', 'Stages remain illustrative; authorized criteria and legal evidence are required.'],
      ['App stores & production launch', 'Later phase', 'Approval, integration testing, security review and controlled pilot first.'],
    ];
    return heading('V6 / DELIVERY STATUS', 'A foundation you can inspect.', 'This build follows the V6 proposal dated 26 October 2026. It is a reviewable first implementation, before production services.') +
      `<div class="bx-readiness">${rows.map(([title, status, desc]) => `<article><div><h3>${title}</h3><p>${desc}</p></div><span class="bx-badge">${status}</span></article>`).join('')}</div>${note('Confirmed: UGX 2,000,000 maximum principal per loan. Proposed: combined exposure cap, minimum principal, graduation bands and concurrent-loan settings. Terms, fees and release policy need approval.')}<p class="muted">The historical USD 2,800 estimate does not confirm pricing for additional integrations or native apps.</p>`;
  }

  const views = { home: overview, apply: application, track, progress, officer, collections, collateral, readiness };
  function render(focus = false) {
    content.innerHTML = views[view]();
    root.querySelectorAll('.bx-nav [data-bx-view]').forEach((b) => { if (b.dataset.bxView === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (focus) focusHeading();
  }
  function saveDraft(form) {
    const f = new FormData(form);
    if (step === 1) { draft.principal = Number(f.get('principal')); draft.product = String(f.get('product')); }
    if (step === 2) { draft.identity = f.has('identity'); draft.income = f.has('income'); }
    if (step === 3) draft.consent = f.has('consent');
  }
  function click(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute('data-bx-view')) {
      const next = button.dataset.bxView;
      if (!views[next]) return;
      if (view === 'apply') { const form = content.querySelector('[data-bx-form]'); if (form) saveDraft(form); }
      view = next; message = ''; render(true);
    } else if (button.hasAttribute('data-bx-reset')) {
      data = sampleData(); selected = data.applications[0].id; step = 1; role = 'officer'; search = ''; filter = 'all';
      draft = { principal: 500_000, product: 'Business', identity: false, income: false, consent: false };
      message = ''; view = 'home'; render(true); say('Sample data reset.');
    } else if (button.hasAttribute('data-bx-amount')) {
      const form = content.querySelector('[data-bx-form]'); saveDraft(form);
      draft.principal = Number(button.dataset.bxAmount); message = ''; render();
      content.querySelector('#bx-amount')?.focus();
    } else if (button.hasAttribute('data-bx-back')) {
      saveDraft(content.querySelector('[data-bx-form]')); step = Math.max(1, step - 1); message = ''; render(true);
    } else if (button.hasAttribute('data-bx-select')) {
      selected = button.dataset.bxSelect; message = ''; render();
      content.querySelector('#bx-review-title')?.scrollIntoView({ block: 'nearest' });
      content.querySelector(`[data-bx-select="${selected}"]`)?.focus({ preventScroll: true });
    } else if (button.hasAttribute('data-bx-action')) {
      try {
        const r = current();
        const result = transitionApplication(r, button.dataset.bxAction, { id: `demo-${role}`, role }, content.querySelector('#bx-reason')?.value, new Date().toISOString());
        data.applications = data.applications.map((item) => item.id === r.id ? result : item);
        message = 'Sample action recorded. No real application or funds have changed.';
      } catch (error) { message = error.message; }
      render(); say(message);
      const reasonField = content.querySelector('#bx-reason');
      if (reasonField) reasonField.focus(); else focusHeading();
    } else if (button.hasAttribute('data-bx-payment')) {
      try { requestDisbursement(current()); } catch (error) { message = error.message; }
      render(); say(message); content.querySelector('[data-bx-payment]')?.focus();
    }
  }
  function change(event) {
    const el = event.target;
    if (el.hasAttribute('data-bx-file')) { selected = el.value; message = ''; render(); content.querySelector('[data-bx-file]')?.focus(); }
    if (el.hasAttribute('data-bx-role')) { role = el.value; message = ''; render(); content.querySelector('[data-bx-role]')?.focus(); }
    if (el.hasAttribute('data-bx-filter')) { filter = el.value; render(); content.querySelector('[data-bx-filter]')?.focus(); }
    if (el.hasAttribute('data-bx-check')) {
      const r = current();
      if (role === 'officer' && r.status === 'in_review') {
        r.checks[el.dataset.bxCheck] = el.checked;
        r.history.push({ action: 'evidence_review', to: r.status, actorId: `demo-${role}`, role, reason: `Sample ${el.dataset.bxCheck} evidence ${el.checked ? 'reviewed' : 'reopened'}`, at: new Date().toISOString() });
        say('Sample evidence review updated.');
      }
    }
  }
  function input(event) {
    if (event.target.hasAttribute('data-bx-search')) {
      search = event.target.value; content.querySelector('[data-bx-queue]').innerHTML = queueRows();
    }
    if (event.target.id === 'bx-amount') {
      const error = validatePrincipal(Number(event.target.value));
      event.target.setAttribute('aria-invalid', String(Boolean(error)));
      content.querySelector('#bx-error').textContent = error;
      content.querySelectorAll('[data-bx-amount]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.bxAmount) === Number(event.target.value))));
    }
  }
  function submit(event) {
    if (event.target.matches('[data-bx-form]')) {
      event.preventDefault(); saveDraft(event.target);
      message = validatePrincipal(draft.principal);
      if (message) { step = 1; render(true); content.querySelector('#bx-amount')?.focus(); return; }
      if (step < 3) { step++; message = ''; render(true); return; }
      if (!draft.consent) { message = 'Confirm you understand this is a sample file only.'; render(); content.querySelector('[name="consent"]')?.focus(); return; }
      const id = 'BX-' + (2605 + data.applications.length - 4);
      const record = { id, member: 'New demo member', product: draft.product, principal: draft.principal, status: 'draft', checks: { identity: false, affordability: false }, supplied: { identity: draft.identity, income: draft.income }, history: [] };
      data.applications.unshift(transitionApplication(record, 'submit', { id: 'demo-borrower', role: 'borrower' }, 'Sample file created in the interactive preview', new Date().toISOString()));
      selected = id; view = 'track'; step = 1; draft.consent = false; message = 'Sample file created. Nothing has been sent to Biashara.'; render(true); say(message);
    }
    if (event.target.matches('[data-bx-followup]')) {
      event.preventDefault();
      const text = String(new FormData(event.target).get('note') || '').trim();
      if (text.length < 8) { say('Use at least 8 characters for the sample note.'); return; }
      const c = data.cases.find((item) => item.id === event.target.dataset.bxFollowup);
      c.notes.push({ text: text.slice(0, 240), at: new Date().toISOString() });
      message = 'Sample follow-up recorded for this session.'; render(); say(message);
      content.querySelector(`[data-bx-followup="${c.id}"] input`)?.focus();
    }
  }
  root.addEventListener('click', click); root.addEventListener('change', change); root.addEventListener('input', input); root.addEventListener('submit', submit);
  render();
  return () => { root.removeEventListener('click', click); root.removeEventListener('change', change); root.removeEventListener('input', input); root.removeEventListener('submit', submit); };
}
