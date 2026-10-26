// Shared, side-effect-free V6 rules. A future server must call these at every
// write boundary; browser enforcement alone is not a security boundary.
export const MAX_PRINCIPAL = 2_000_000;
export const STATES = Object.freeze({
  draft: 'Draft', submitted: 'Submitted', in_review: 'In review',
  needs_information: 'More information needed', recommended: 'Awaiting supervisor',
  approved: 'Approved · release pending', declined: 'Declined',
});

export function validatePrincipal(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    return 'Enter a positive whole amount in Uganda shillings.';
  if (value > MAX_PRINCIPAL) return 'The Biashara Express maximum is UGX 2,000,000 per loan.';
  return '';
}

export function requirePrincipal(value) {
  const error = validatePrincipal(value);
  if (error) throw new Error(error);
  return value;
}

const permissions = {
  submit: { from: ['draft', 'needs_information'], to: 'submitted', roles: ['borrower'] },
  review: { from: ['submitted'], to: 'in_review', roles: ['officer'] },
  request_information: { from: ['in_review'], to: 'needs_information', roles: ['officer'] },
  recommend: { from: ['in_review'], to: 'recommended', roles: ['officer'] },
  approve: { from: ['recommended'], to: 'approved', roles: ['supervisor'] },
  decline: { from: ['in_review', 'recommended'], to: 'declined', roles: ['officer', 'supervisor'] },
};

export function transitionApplication(record, action, actor, reason, at) {
  requirePrincipal(record.principal);
  const rule = permissions[action];
  if (!actor?.id || !rule || !rule.roles.includes(actor.role)) throw new Error('This role cannot perform that action.');
  if (!rule.from.includes(record.status)) throw new Error('The application is not at the required review stage.');
  if (typeof reason !== 'string' || reason.trim().length < 8) throw new Error('Record a clear reason of at least 8 characters.');
  if (!at || Number.isNaN(Date.parse(at))) throw new Error('A valid event timestamp is required.');
  if (['recommend', 'approve'].includes(action) && (!record.checks?.identity || !record.checks?.affordability))
    throw new Error('Identity and affordability checks must be reviewed first.');
  if (action === 'approve' && (!record.reviewedBy || record.reviewedBy === actor.id))
    throw new Error('Approval requires a separate supervisor from the reviewing officer.');
  const event = { action, from: record.status, to: rule.to, actorId: actor.id, role: actor.role, reason: reason.trim(), at };
  return {
    ...record, status: rule.to,
    reviewedBy: action === 'review' ? actor.id : record.reviewedBy,
    approvedBy: action === 'approve' ? actor.id : record.approvedBy,
    history: [...(record.history || []), event],
  };
}

// Intentionally fail closed until a real authenticated provider adapter exists.
export function requestDisbursement(record) {
  requirePrincipal(record.principal);
  throw new Error('Disbursement is not connected. No funds have moved.');
}

export function assessGraduation({ currentArrears, evidenceCurrent, satisfactoryClosedLoans }, minimumClosedLoans) {
  if (!Number.isSafeInteger(minimumClosedLoans) || minimumClosedLoans < 1) return 'Policy criteria await approval';
  if (!Number.isSafeInteger(satisfactoryClosedLoans) || satisfactoryClosedLoans < 0) return 'Repayment history needs review';
  if (!Number.isFinite(currentArrears) || currentArrears < 0) return 'Arrears information needs review';
  if (currentArrears > 0) return 'Progression paused · arrears review required';
  if (!evidenceCurrent) return 'Update identity and income evidence';
  return satisfactoryClosedLoans >= minimumClosedLoans ? 'Eligible for officer review' : 'Continue building repayment history';
}

export function collateralStatus(current, next, { authorized = false, evidence = '' } = {}) {
  const stages = ['proposed', 'under_review', 'verified', 'legally_perfected', 'released'];
  if (stages.indexOf(current) < 0 || stages.indexOf(next) !== stages.indexOf(current) + 1)
    throw new Error('Collateral must follow the verification process.');
  if (!authorized || !evidence.trim()) throw new Error('Authorized evidence and sign-off are required.');
  return next;
}

export function arrearsBucket(days) {
  if (!Number.isInteger(days) || days < 0) throw new Error('Days past due must be a non-negative whole number.');
  if (days === 0) return 'Current';
  if (days <= 7) return '1–7 days late';
  if (days <= 30) return '8–30 days late';
  if (days <= 60) return '31–60 days late';
  if (days <= 90) return '61–90 days late';
  return 'Over 90 days late';
}
