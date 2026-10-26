// Synthetic records only. No customer information, rates or provider credentials.
export function sampleData() {
  return {
    applications: [
      { id: 'BX-2601', member: 'Demo member 01', product: 'Business', principal: 250_000, status: 'submitted', checks: { identity: false, affordability: false }, history: [] },
      { id: 'BX-2602', member: 'Demo member 02', product: 'Education', principal: 500_000, status: 'in_review', reviewedBy: 'demo-officer', checks: { identity: true, affordability: false }, history: [] },
      { id: 'BX-2603', member: 'Demo member 03', product: 'Business', principal: 1_200_000, status: 'recommended', reviewedBy: 'demo-officer', checks: { identity: true, affordability: true }, history: [] },
      { id: 'BX-2604', member: 'Demo member 04', product: 'Personal', principal: 2_000_000, status: 'needs_information', reviewedBy: 'demo-officer', checks: { identity: false, affordability: true }, history: [] },
    ],
    cases: [
      { id: 'CASE-01', member: 'Demo member 05', principalRemaining: 250_000, principalOverdue: 125_000, days: 4, next: 'Confirm a suitable callback time', notes: [] },
      { id: 'CASE-02', member: 'Demo member 06', principalRemaining: 500_000, principalOverdue: 250_000, days: 12, next: 'Review the repayment enquiry', notes: [] },
      { id: 'CASE-03', member: 'Demo member 07', principalRemaining: 1_200_000, principalOverdue: 500_000, days: 35, next: 'Supervisor case review', notes: [] },
    ],
  };
}
