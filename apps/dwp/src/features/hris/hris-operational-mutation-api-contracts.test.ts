import { describe, expect, it } from 'vitest';

import { HCM_OPERATIONAL_MUTATION_API_CONTRACTS } from './hris-operational-mutation-api-contracts';

const EXPECTED_ROUTE_CONTRACT_KEYS = [
  'route.hcm.management.controlled-transfer-create.action',
  'route.hcm.operations.assignment-event-create.action',
  'route.hcm.operations.assignment-event-publish.action',
  'route.hcm.operations.assignment-event-submit.action',
  'route.hcm.operations.assignment-event-validate.action',
  'route.hcm.operations.certificate-issue.action',
  'route.hcm.operations.country-pack-activate.action',
  'route.hcm.operations.employee-change-request-apply.action',
  'route.hcm.operations.employee-change-request-create.action',
  'route.hcm.operations.employee-change-request-submit.action',
  'route.hcm.operations.employment-contract-issue.action',
  'route.hcm.operations.payroll-run-approve.action',
  'route.hcm.operations.payroll-run-calculate.action',
  'route.hcm.operations.payroll-run-finalize.action',
  'route.hcm.operations.payroll-run.action',
  'route.hcm.operations.separation-case.action',
  'route.hcm.operations.time-close-validate.action',
  'route.hcm.operations.time-close.action',
  'route.hcm.operations.time-interpretation-run.action',
  'route.hcm.operations.time-payroll-handoff-create.action',
  'route.hcm.operations.time-reopen.action',
  'route.hcm.operations.workforce-ingestion.action',
  'route.hcm.performance.assigned-review-draft-update.action',
  'route.hcm.performance.assigned-review-submit.action',
  'route.hcm.performance.feedback-request-create.action',
  'route.hcm.personal.feedback-response-submit.action',
  'route.hcm.time.timecard-correction.action',
  'route.hcm.time.timecard-decision.action',
  'route.hcm.time.timecard-submit.action',
  'route.hcm.utility.explorer-preferences-update.action',
  'route.hcm.utility.explorer-recent-create.action',
] as const;

describe('HRIS operational mutation API contracts', () => {
  it('owns exactly the 31 production-connected non-configuration ACTION boundaries', () => {
    expect(HCM_OPERATIONAL_MUTATION_API_CONTRACTS).toHaveLength(31);
    expect(
      HCM_OPERATIONAL_MUTATION_API_CONTRACTS.map(({ routeContractKey }) => routeContractKey).sort()
    ).toEqual([...EXPECTED_ROUTE_CONTRACT_KEYS].sort());
    expect(
      new Set(HCM_OPERATIONAL_MUTATION_API_CONTRACTS.map(({ apiFunction }) => apiFunction)).size
    ).toBe(31);
  });
});
