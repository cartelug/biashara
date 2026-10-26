# Biashara Express V6 — implementation baseline

Source: [V6 proposal, 26 October 2026](https://docs.google.com/document/d/177_3BmBZ5t9AzTHVAP_g6LMGZxjkr4Xf/edit).
Working requirements: [existing Drive document](https://docs.google.com/document/d/1prTaRb5TS2hSbx6qK2ud5SnoVb1CRMXXQaBWpoGsMQ0/edit).

## This increment

`/express/` is an explicitly labelled interactive preview within the existing site. It uses synthetic, in-memory records and performs no network writes. Reloading resets all changes. It does not collect real identity, collateral, banking, contact or biometric information.

- Borrower: three-step sample application, principal boundary validation, evidence checklist, review acknowledgement, tracking and illustrative member progression.
- Staff: searchable and filterable queue; officer evidence review, requests for information, recommendations and independent supervisor decisions with reasons.
- Collections: synthetic arrears cases, days-past-due buckets and session-only follow-up notes.
- Collateral: evidence and verification-status explanation; no claim that an upload or location pin creates registered security.
- Readiness view: distinguishes implemented interactions from policy, backend and provider dependencies.

All navigation, typography, company content and public product tools are retained. Express has a separate rule set from the corporate site's existing published 1M–50M facilities. The new preview is excluded from search indexing and the sitemap. The existing site-wide offline manifest is retained; this is not a separate production PWA release.

## Confirmed and proposed rules

The **UGX 2,000,000 maximum principal per Express loan** is confirmed. The browser and shared domain module reject larger amounts, including exactly UGX 2,000,001. Every simulated workflow transition rechecks principal. The domain module is designed for reuse in a server, but no server boundary has been implemented in this increment.

V6's combined borrower exposure cap, minimum loan, five graduation bands, number of closed loans for progression and concurrent-loan policy are proposals. Rates, fees, repayment terms and eligibility must be supplied by management. This preview invents none of them. The positive-integer input rule is a technical validation, not an approved minimum product amount.

Officer review, evidence checks, recorded reasons and a different supervisor are required before the simulated approval state. Approval is explicitly **release pending**. The disbursement function always fails closed because no payment adapter is connected.

The role selector is a demonstration control, not authentication. Session histories demonstrate event structure, not a durable or tamper-proof audit ledger. Collateral sign-off is represented by a domain rule, not verified legal authority.

## Next production increment

1. Approve product policy: rates, term, fees, minimum, aggregate exposure, concurrent loans, role thresholds, progression criteria and disclosures.
2. Add authenticated services: borrower ownership, staff assignment, MFA, session controls, authorization on every endpoint, protected uploads, retention and deletion.
3. Add a transactional database: borrowers, applications, decisions, loans, schedules, ledger entries, payment orders/events, follow-up cases, collateral, stage reviews and append-only audit events.
4. Enforce the principal ceiling on application creation/update, approvals, disbursement orders and administrative imports. Do not use client checks as authorization.
5. Use independent release authority, transaction-level concurrency control and idempotency before payouts. Only provider-confirmed settlement changes balances or issues receipts.
6. Connect contracted payment, identity and messaging adapters in a sandbox. Device biometrics use device authentication; no raw fingerprint storage is implied.
7. Complete reconciliation, error/reversal tests, permission isolation, backup restoration, security review, UAT and a controlled pilot before real lending.

These are implementation dependencies from V6, not new legal advice or a new commercial quote. The historical USD 2,800 estimate and conditional launch ambition are not expanded or accepted by this code increment. Native apps remain a later phase.

## Validation

From `source/`:

```sh
npm ci --ignore-scripts
npm run test:express
npm run release
node qa/static.mjs
node qa/references.mjs
```

Domain tests cover exact-cap acceptance, over-limit and malformed inputs, state ordering, role checks, independent approval, mandatory evidence/reasons, resubmission, disconnected payments, graduation review, collateral progression and arrears boundaries. Browser QA should cover the application, queue actions, notes and keyboard/focus behavior on narrow and wide screens. Existing calculator and application behavior must continue to use the corporate site's separate rules.

### Checks completed on 26 October 2026

- 11 domain tests passed.
- Release build, static checks and file-reference checks passed; JavaScript and CSS remain below existing budgets.
- Browser: UGX 2,000,001 blocked; UGX 2,000,000 sample application created, reviewed, recommended and independently approved with release pending. Missing evidence blocked recommendation. Payment availability failed closed. A follow-up note appeared in its correct case.
- All eight workspace views checked inside 320px and 768px frames. Document scroll width matched client width in every view; the narrow workspace navigation intentionally scrolls horizontally.
- The existing company calculator still accepts 1M and 50M and gives the original 2.8% indicative calculations. This is a targeted regression check, not a claim that the full existing browser suite was run.
- Screenshots are in `docs/screens/express-v6-*.jpg`.
