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
import {
  delegationAdmission,
  delegationCommandAdmission,
  workflowAdmission,
  workflowCommandAdmission,
} from './hris-approval-adapter-fixtures.test-support';

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
    expect(
      Object.values(HRIS_APPROVAL_SHARED_API_CONTRACTS).every(
        (contract) => !Object.hasOwn(contract, 'duty')
      )
    ).toBe(true);
  });

  it('requires exact same-revision HCM PAGE and native Approval PAGE read evidence', () => {
    const workflow = workflowAdmission();
    expect(workflowReadAdmitted(workflow)).toBe(true);
    expect(workflowReadAdmitted({ ...workflow, ownerTenantId: 'tenant-99' })).toBe(false);
    expect(workflowReadAdmitted({ ...workflow, ownerActorId: '99' })).toBe(false);
    expect(
      workflowReadAdmitted({
        ...workflow,
        hcmPageRouteContractKey: 'route.hcm.team.delegation.page',
      })
    ).toBe(false);
    expect(
      workflowReadAdmitted({
        ...workflow,
        read: { ...workflow.read, contextScopeKey: 'approval-admin-scope-99' },
      })
    ).toBe(false);
    expect(
      workflowReadAdmitted({
        ...workflow,
        read: { ...workflow.read, decisionRevision: 'stale' },
      })
    ).toBe(false);

    const team = delegationAdmission();
    expect(delegationReadAdmitted(team)).toBe(true);
    expect(delegationReadAdmitted({ ...team, populationScopeKey: undefined })).toBe(false);
    expect(
      delegationReadAdmitted({
        ...team,
        populationScopeKey: 'different-hcm-population',
      })
    ).toBe(false);
  });

  it('keeps commands absent by default and admits only exact native Approval ACTION evidence', () => {
    const workflow = workflowAdmission();
    expect(workflowPublishAdmitted(workflow)).toBe(false);
    expect(workflowPublishAdmitted({ ...workflow, command: workflowCommandAdmission() })).toBe(
      true
    );
    expect(
      workflowPublishAdmitted({
        ...workflow,
        command: workflowCommandAdmission({ decisionRevision: 'stale' }),
      })
    ).toBe(false);
    expect(
      workflowPublishAdmitted({
        ...workflow,
        command: workflowCommandAdmission({
          routeContractKeys: ['route.approvals.admin.policy-create.action'],
        }),
      })
    ).toBe(false);

    const team = delegationAdmission();
    expect(delegationManageAdmitted(team)).toBe(false);
    expect(delegationManageAdmitted({ ...team, command: delegationCommandAdmission() })).toBe(true);
    expect(
      delegationManageAdmitted({
        ...team,
        command: delegationCommandAdmission({
          routeContractKeys: ['route.approvals.work.delegation-create.action'],
        }),
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
        contextScopeKey: mismatch === 'scope' ? 'owner-scope-42' : admission.ownerContextScopeKey,
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
