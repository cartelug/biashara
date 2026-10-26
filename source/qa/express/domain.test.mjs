import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrincipal, transitionApplication, requestDisbursement, assessGraduation, collateralStatus, arrearsBucket } from '../../src/js/express/domain.js';
import { sampleData } from '../../src/js/express/sample.js';

const at = '2026-10-26T12:00:00Z';
const officer = { id: 'officer-1', role: 'officer' };
const supervisor = { id: 'supervisor-1', role: 'supervisor' };
const file = () => ({ id: 'TEST-1', principal: 2_000_000, status: 'submitted', checks: { identity: true, affordability: true }, history: [] });

test('principal accepts the exact ceiling and rejects all over-limit and malformed values', () => {
  assert.equal(validatePrincipal(2_000_000), '');
  for (const value of [2_000_001, 3_500_000, 6_000_000, 0, -1, NaN, Infinity, null, '2000000', 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.notEqual(validatePrincipal(value), '', String(value));
});
test('all sample applications obey the principal ceiling', () => {
  for (const record of sampleData().applications) assert.equal(validatePrincipal(record.principal), '');
});
test('separate officer and supervisor produce ordered decisions with immutable input', () => {
  const start = file();
  const reviewed = transitionApplication(start, 'review', officer, 'Evidence review started', at);
  const recommended = transitionApplication(reviewed, 'recommend', officer, 'Sample evidence reviewed', at);
  const approved = transitionApplication(recommended, 'approve', supervisor, 'Independent review completed', at);
  assert.equal(start.status, 'submitted'); assert.equal(start.history.length, 0);
  assert.equal(approved.status, 'approved'); assert.equal(approved.history.length, 3);
  assert.equal(approved.reviewedBy, officer.id); assert.equal(approved.approvedBy, supervisor.id);
});
test('skipping review, wrong roles, self-approval and missing reasons fail', () => {
  assert.throws(() => transitionApplication(file(), 'approve', supervisor, 'Approve directly', at), /stage/);
  assert.throws(() => transitionApplication(file(), 'review', { id: 'borrower', role: 'borrower' }, 'Review own file', at), /role/);
  const r = { ...file(), status: 'recommended', reviewedBy: officer.id };
  assert.throws(() => transitionApplication(r, 'approve', { ...officer, role: 'supervisor' }, 'Same person approves', at), /separate/);
  assert.throws(() => transitionApplication(r, 'approve', supervisor, 'ok', at), /reason/);
  assert.throws(() => transitionApplication(r, 'approve', supervisor, 'Review finished', 'invalid'), /timestamp/);
});
test('recommendations and approvals require both identity and affordability checks', () => {
  for (const checks of [{ identity: false, affordability: true }, { identity: true, affordability: false }]) {
    assert.throws(() => transitionApplication({ ...file(), status: 'in_review', checks }, 'recommend', officer, 'Review completed', at), /checks/);
    assert.throws(() => transitionApplication({ ...file(), status: 'recommended', checks, reviewedBy: officer.id }, 'approve', supervisor, 'Review completed', at), /checks/);
  }
});
test('each workflow action rechecks the ceiling even after record tampering', () => {
  for (const action of ['review', 'recommend', 'approve', 'decline', 'request_information', 'submit'])
    assert.throws(() => transitionApplication({ ...file(), principal: 2_000_001 }, action, officer, 'Sample action reason', at), /maximum/);
});
test('requests for more evidence can be resubmitted without inheriting approval', () => {
  const reviewed = transitionApplication(file(), 'review', officer, 'Start evidence review', at);
  const missing = transitionApplication(reviewed, 'request_information', officer, 'Request current income evidence', at);
  const resubmitted = transitionApplication(missing, 'submit', { id: 'borrower-1', role: 'borrower' }, 'New sample evidence supplied', at);
  assert.equal(resubmitted.status, 'submitted'); assert.equal(resubmitted.approvedBy, undefined);
});
test('disbursement always fails closed, including approved and over-limit records', () => {
  assert.throws(() => requestDisbursement({ ...file(), status: 'approved' }), /not connected/);
  assert.throws(() => requestDisbursement({ ...file(), principal: 2_000_001, status: 'approved' }), /maximum/);
});
test('graduation needs approved criteria and never automatically promotes a borrower', () => {
  const member = { currentArrears: 0, evidenceCurrent: true, satisfactoryClosedLoans: 4 };
  assert.match(assessGraduation(member, null), /await approval/);
  assert.match(assessGraduation(member, 3), /officer review/);
  assert.match(assessGraduation({ ...member, currentArrears: 1 }, 3), /paused/);
  assert.match(assessGraduation({ ...member, currentArrears: NaN }, 3), /needs review/);
  assert.match(assessGraduation({ ...member, evidenceCurrent: false }, 3), /Update/);
});
test('collateral cannot skip verification or advance without authorized evidence', () => {
  assert.throws(() => collateralStatus('proposed', 'legally_perfected', { authorized: true, evidence: 'Title scan' }), /process/);
  assert.throws(() => collateralStatus('verified', 'legally_perfected', { authorized: false, evidence: 'Title scan' }), /sign-off/);
  assert.throws(() => collateralStatus('verified', 'legally_perfected', { authorized: true, evidence: '' }), /sign-off/);
  assert.equal(collateralStatus('verified', 'legally_perfected', { authorized: true, evidence: 'Authorized legal instrument and registration reference' }), 'legally_perfected');
});
test('arrears bucket boundaries cover the V6 ranges', () => {
  for (const [days, label] of [[0, 'Current'], [1, '1–7 days late'], [7, '1–7 days late'], [8, '8–30 days late'], [30, '8–30 days late'], [31, '31–60 days late'], [60, '31–60 days late'], [61, '61–90 days late'], [90, '61–90 days late'], [91, 'Over 90 days late']]) assert.equal(arrearsBucket(days), label);
  assert.throws(() => arrearsBucket(-1));
});
