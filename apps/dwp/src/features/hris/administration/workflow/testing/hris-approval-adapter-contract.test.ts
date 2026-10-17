import { describe, expect, it, vi } from 'vitest';

import {
  delegationManageAdmitted,
  delegationReadAdmitted,
  HRIS_APPROVAL_SHARED_API_CONTRACTS,
  mergeHrisApprovalQueryState,
  parseHrisApprovalQueryState,
  runWithTrustedApprovalMutationExecution,
  workflowPublishAdmitted,
  workflowReadAdmitted,
} from '../model/hris-approval-adapter-contract';
import { delegationAdmission, workflowAdmission } from './hris-approval-adapter-fixtures.test-support';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';

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
    expect(workflowReadAdmitted({ ...workflow, hcmProductAccess: 'DENY' as 'VIEW' })).toBe(false);
    expect(workflowReadAdmitted({ ...workflow, approvalsProductAccess: 'DENY' as 'VIEW' })).toBe(
      false
    );
    expect(workflowReadAdmitted({ ...workflow, ownerTenantId: 'tenant-99' })).toBe(false);
    expect(workflowReadAdmitted({ ...workflow, ownerActorId: '99' })).toBe(false);
    expect(workflowReadAdmitted({ ...workflow, rolePlane: 'MANAGER' })).toBe(false);
    expect(
      workflowReadAdmitted({
        ...workflow,
        read: { ...workflow.read, duty: 'HRIS_DUTY_MANAGER_TEAM_READER' },
      })
    ).toBe(false);
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

  it.each([
    ['publish', 'scope', workflowAdmission()],
    ['create', 'scope', delegationAdmission()],
    ['revoke', 'scope', delegationAdmission()],
    ['publish', 'mode', workflowAdmission()],
    ['publish', 'revision', workflowAdmission()],
    ['publish', 'idempotency', workflowAdmission()],
  ] as const)(
    'fails closed when %s receives a mutation execution with mismatched %s',
    async (_operation, mismatch, admission) => {
      const ownerCommand = vi.fn().mockResolvedValue('owner-result');
      const secureExecution: ApprovalMutationExecution = {
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision:
          mismatch === 'revision' ? 'stale-decision' : admission.pageDecisionRevision,
        contextKey: 'approval-owner',
        contextScopeKey:
          mismatch === 'scope' ? 'owner-scope-42' : admission.ownerContextScopeKey,
        idempotencyKey: mismatch === 'idempotency' ? '' : 'sys003-command-0002',
      };
      const execution: ApprovalMutationExecution =
        mismatch === 'mode'
          ? { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }
          : secureExecution;

      await expect(
        runWithTrustedApprovalMutationExecution(admission, execution, ownerCommand)
      ).rejects.toThrow('does not match the admitted owner scope');
      expect(ownerCommand).not.toHaveBeenCalled();
    }
  );

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
