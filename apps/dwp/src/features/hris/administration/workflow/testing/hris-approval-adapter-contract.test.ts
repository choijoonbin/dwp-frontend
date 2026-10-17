import { describe, expect, it } from 'vitest';

import {
  delegationManageAdmitted,
  delegationReadAdmitted,
  HRIS_APPROVAL_SHARED_API_CONTRACTS,
  mergeHrisApprovalQueryState,
  parseHrisApprovalQueryState,
  workflowPublishAdmitted,
  workflowReadAdmitted,
} from '../model/hris-approval-adapter-contract';
import { delegationAdmission, workflowAdmission } from './hris-approval-adapter-fixtures.test-support';

describe('HRIS Approval adapter authority contract', () => {
  it('seals all five shared routes and methods without a local proxy', () => {
    expect(HRIS_APPROVAL_SHARED_API_CONTRACTS).toEqual({
      policyList: expect.objectContaining({ id: 'SHARED-API-005', method: 'GET' }),
      policyPublish: expect.objectContaining({ id: 'SHARED-API-006', method: 'POST' }),
      delegationList: expect.objectContaining({ id: 'SHARED-API-010', method: 'GET' }),
      delegationCreate: expect.objectContaining({ id: 'SHARED-API-011', method: 'POST' }),
      delegationRevoke: expect.objectContaining({ id: 'SHARED-API-012', method: 'POST' }),
    });
  });

  it('separates read and command authority and fails closed on cross-product near misses', () => {
    const workflow = workflowAdmission();
    expect(workflowReadAdmitted(workflow)).toBe(true);
    expect(workflowPublishAdmitted(workflow)).toBe(true);
    expect(workflowPublishAdmitted({ ...workflow, command: undefined })).toBe(false);
    expect(workflowReadAdmitted({ ...workflow, approvalsProductAccess: 'DENY' as 'VIEW' })).toBe(
      false
    );
    expect(workflowReadAdmitted({ ...workflow, purposeBound: false as true })).toBe(false);
    expect(
      workflowPublishAdmitted({
        ...workflow,
        command: { ...workflow.command!, decisionRevision: 'stale' },
      })
    ).toBe(false);

    const team = delegationAdmission();
    expect(delegationReadAdmitted(team)).toBe(true);
    expect(delegationManageAdmitted(team)).toBe(true);
    expect(delegationReadAdmitted({ ...team, populationScopeKey: undefined })).toBe(false);
    expect(
      delegationManageAdmitted({
        ...team,
        command: { ...team.command!, separationOfDuties: [] },
      })
    ).toBe(false);
  });

  it('keeps only safe overview and focus URL state', () => {
    const parsed = parseHrisApprovalQueryState(
      new URLSearchParams('tab=internal&focus=../../policy&recovery=retry')
    );
    expect(parsed).toEqual({ tab: 'overview', focus: null });
    const next = mergeHrisApprovalQueryState(new URLSearchParams('recovery=retry'), {
      focus: 'policy-0001',
    });
    expect(next.get('tab')).toBe('overview');
    expect(next.get('focus')).toBe('policy-0001');
  });
});
