import { describe, expect, it } from 'vitest';

import {
  approvalHrisSeparationWaiverTaskApproveCommand,
  assertApprovalTaskUsesStandardDecisionRoute,
  readApprovalHrisSeparationWaiverTaskBinding,
} from './approval-hris-separation-waiver-command';
import {
  createApprovalHighRiskAttempt,
  restartApprovalHighRiskAttempt,
} from './approval-high-risk-command-model';
import { snapshotApprovalHrisSeparationWaiverTaskApproveInput } from '@dwp-frontend/shared-utils/api/approval-hris-separation-waiver-contract';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';

const taskId = '10000000-0000-4000-8000-000000000001';
const requestId = '10000000-0000-4000-8000-000000000002';
const correlationId = '10000000-0000-4000-8000-000000000003';

function payload() {
  return {
    schemaName: 'SeparationWaiverApprovalRequestV1',
    schemaVersion: 1,
    approvalRequestId: requestId,
    casePublicId: '20000000-0000-4000-8000-000000000001',
    taskPublicId: '20000000-0000-4000-8000-000000000002',
    taskType: 'TERMINATION',
    caseMakerPublicId: '20000000-0000-4000-8000-000000000003',
    requestedByActorPublicId: '20000000-0000-4000-8000-000000000004',
    reasonCode: 'LEGAL_HOLD',
    taskOwnerRevision: 3,
    taskVersion: 2,
    requestedAt: '2026-10-29T00:00:00Z',
    payloadSha256: 'a'.repeat(64),
    correlationId,
  };
}

function detail(source: Record<string, unknown> = payload()): ApprovalTaskDetail {
  return {
    task: {
      taskId,
      requestId,
      requestNumber: 'APR-62',
      title: 'Separation waiver',
      summary: '',
      workflowNameKo: '분리 면제',
      workflowNameEn: 'Separation waiver',
      stepKey: 'REVIEW',
      stepName: 'Review',
      stepSequence: 1,
      status: 'PENDING',
      priority: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
      riskScore: 90,
      version: 7,
    },
    contentAccess: {
      state: 'FULL',
      reason: 'CURRENT_AUTHORITY_VERIFIED',
      evaluatedAt: '2026-10-29T00:00:00Z',
    },
    payload: source,
    timeline: [],
    canClaim: false,
    canDecide: true,
    selfApprovalBlocked: false,
  };
}

const commandInput = {
  decision: 'APPROVE',
  comment: 'Reviewed',
  expectedVersion: 7,
  quorum: {
    expectedRequestVersion: 11,
    generation: 2,
    expectedStageVersion: 3,
    pins: {
      workflowVersionId: '30000000-0000-4000-8000-000000000001',
      workflowVersion: 4,
      workflowDefinitionSha256: 'b'.repeat(64),
      formSchemaSha256: 'c'.repeat(64),
      policyVersion: 5,
      policySha256: 'd'.repeat(64),
    },
    payloadRevision: 6,
    payloadSha256: 'e'.repeat(64),
  },
} as const;

describe('HRIS separation-waiver Approval HIGH command', () => {
  it('recognizes only a complete native payload and preserves its original correlation', () => {
    expect(readApprovalHrisSeparationWaiverTaskBinding(detail())).toEqual({ correlationId });
    expect(
      readApprovalHrisSeparationWaiverTaskBinding(
        detail({ approvalRequestId: requestId, payloadSha256: 'display-only' })
      )
    ).toBeNull();
    expect(() =>
      readApprovalHrisSeparationWaiverTaskBinding(
        detail({ ...payload(), correlationId: 'not-a-uuid' })
      )
    ).toThrow('task source');
    expect(() =>
      readApprovalHrisSeparationWaiverTaskBinding(
        detail({ ...payload(), schemaName: 'UnexpectedSource' })
      )
    ).toThrow('task source');
    expect(() => assertApprovalTaskUsesStandardDecisionRoute(detail())).toThrow(
      'individual HIGH confirmation'
    );
    expect(() =>
      assertApprovalTaskUsesStandardDecisionRoute(
        detail({ ...payload(), correlationId: 'not-a-uuid' })
      )
    ).toThrow('task source');
    expect(() =>
      assertApprovalTaskUsesStandardDecisionRoute(
        detail({ approvalRequestId: requestId, payloadSha256: 'display-only' })
      )
    ).not.toThrow();
  });

  it('binds the canonical route, target, version, and exact serialized decision body', () => {
    const command = approvalHrisSeparationWaiverTaskApproveCommand(taskId, commandInput);
    const snapshot = snapshotApprovalHrisSeparationWaiverTaskApproveInput(commandInput);
    expect(command).toMatchObject({
      operation: 'HRIS_SEPARATION_WAIVER_TASK_APPROVE',
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/hris/separation-waiver-tasks/${taskId}/approve`,
      targetType: 'HRIS_SEPARATION_WAIVER_TASK',
      targetId: taskId,
      expectedObjectVersion: commandInput.expectedVersion,
    });
    expect(JSON.stringify(command.payload)).toBe(JSON.stringify(snapshot));
  });

  it('rotates only step-up idempotency identity while retaining the exact body', () => {
    const command = approvalHrisSeparationWaiverTaskApproveCommand(taskId, commandInput);
    const authority = {
      rolloutState: '110',
      expectedDecisionRevision: 'revision-62',
      contextKey: 'approvals-work',
      contextScopeKey: 'decidable-task',
    } as const;
    const first = createApprovalHighRiskAttempt(
      command,
      authority,
      '40000000-0000-4000-8000-000000000001'
    );
    const restarted = restartApprovalHighRiskAttempt(
      first,
      authority,
      '40000000-0000-4000-8000-000000000002'
    );
    expect(restarted.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(JSON.stringify(restarted.descriptor.payload)).toBe(
      JSON.stringify(first.descriptor.payload)
    );
    expect(restarted.descriptor).not.toHaveProperty('idempotencyKey');
  });
});
