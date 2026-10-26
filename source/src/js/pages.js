// Page behaviour: each page starts only the tools it contains.
import { $, $$ } from './utils.js';
import { mountCalculator } from './calculator.js';
import { mountApply } from './apply.js';
import { mountEnquiry } from './enquiry.js';
import { mountLicence } from './licence.js';
import { mountExpress } from './express/workspace.js';

// "Print this checklist" prints the documents checklist alone; other print buttons print the page.
function mountPrint(main) {
  const offs = [];
  $$('[data-print]', main).forEach((b) => {
    const run = () => {
      const html = document.documentElement;
      if (b.dataset.print !== 'checklist') { window.print(); return; }
      html.classList.add('print-checklist');
      const done = () => { html.classList.remove('print-checklist'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
    };
    b.addEventListener('click', run);
    offs.push(() => b.removeEventListener('click', run));
  });
  return () => offs.forEach((f) => f());
}

// Non-binding self-check: six yes/no questions drawn from the eligibility list. No score, no verdict.
function mountSelfCheck(main) {
  const form = $('[data-selfcheck]', main);
  if (!form) return () => {};
  const out = $('[data-selfcheck-out]', main);
  const onChange = () => {
    const total = $$('fieldset', form).length;
    const answered = $$('input[type="radio"]:checked', form).length;
    if (out) out.hidden = answered < total;
  };
  form.addEventListener('change', onChange);
  return () => form.removeEventListener('change', onChange);
}

export function initPage(main) {
  const off = [];
  const calcs = $$('[data-calculator]', main).map((c) => mountCalculator(c));
  off.push(() => calcs.forEach((c) => c.destroy()));
  off.push(mountPrint(main), mountSelfCheck(main));
  const id = main.dataset.page;
  if (id === 'apply') off.push(mountApply(main));
  if (id === 'contact') off.push(mountEnquiry(main));
  if (id === 'licence') off.push(mountLicence(main));
  if (id === 'express') off.push(mountExpress(main));
  return () => off.forEach((f) => f && f());
}
