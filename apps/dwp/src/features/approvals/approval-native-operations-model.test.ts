import { describe, expect, it } from 'vitest';
import {
  approvalDeliverySupports,
  approvalNativeOperationCommand,
  approvalNativeOperationReceiptMatches,
  approvalNativeOperationSnapshotCurrent,
  createApprovalDeliveryOperationProposal,
  createApprovalTaskReassignmentProposal,
  toggleApprovalOperationSelection,
} from './approval-native-operations-model';
import { approvalOperationsFullData } from './approval-operations-workbench-model';

import type {
  ApprovalIntegrationDelivery,
  ApprovalOperations,
  ApprovalTask,
} from '@dwp-frontend/shared-utils';

const eventId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const generatedAt = '2026-09-14T02:00:00Z';

function delivery(status = 'FAILED'): ApprovalIntegrationDelivery {
  return {
    outboxId: eventId,
    eventId: '44444444-4444-4444-8444-444444444444',
    requestId: null,
    eventType: 'approval.request.updated',
    status,
    attemptCount: 3,
    manualRetryCount: 0,
    version: 7,
    availableAt: generatedAt,
    createdAt: generatedAt,
    retryEligibility: {
      eligible: status === 'FAILED' || status === 'DEAD',
      reason: status === 'FAILED' || status === 'DEAD' ? 'ELIGIBLE' : 'STATUS_NOT_RETRYABLE',
      expectedVersion: 7,
      evaluatedAt: generatedAt,
    },
  };
}

function task(): ApprovalTask {
  return {
    taskId,
    requestId: '55555555-5555-4555-8555-555555555555',
    requestNumber: 'APR-16A',
    title: 'Restore queue ownership',
    summary: 'Task requires reassignment',
    workflowNameKo: '운영 복구',
    workflowNameEn: 'Operations recovery',
    stepKey: 'review',
    stepName: 'Review',
    stepSequence: 1,
    status: 'CLAIMED',
    priority: 'URGENT',
    dataClassification: 'INTERNAL',
    riskScore: 70,
    version: 4,
  };
}

function state(data: ApprovalOperations) {
  return {
    status: 'success',
    fetchStatus: 'idle',
    error: null,
    fetchFailureCount: 0,
    data,
  };
}

describe('Approval native operations model', () => {
  it('matches backend status eligibility for all delivery operations', () => {
    expect(approvalDeliverySupports(delivery('FAILED'), 'RETRY')).toBe(true);
    expect(approvalDeliverySupports(delivery('FAILED'), 'DEAD_LETTER')).toBe(true);
    expect(approvalDeliverySupports(delivery('DEAD'), 'REPLAY')).toBe(true);
    expect(approvalDeliverySupports(delivery('SENDING'), 'RECONCILE')).toBe(true);
    expect(approvalDeliverySupports(delivery('PUBLISHED'), 'RECONCILE')).toBe(false);
  });

  it('keeps a maximum of 50 unique checked targets', () => {
    let selected = new Set<string>();
    for (let index = 0; index < 51; index++) {
      selected = toggleApprovalOperationSelection(selected, `target-${index}`, true);
    }
    expect(selected).toHaveLength(50);
    selected = toggleApprovalOperationSelection(selected, 'target-4', false);
    expect(selected).toHaveLength(49);
  });

  it('captures exact all-or-nothing delivery material and HIGH descriptor', () => {
    const proposal = createApprovalDeliveryOperationProposal({
      action: 'RECONCILE',
      targets: [delivery('SENDING')],
      reason: 'recover expired lease',
      generatedAt,
      scopeFingerprint: 'scope-a',
      operationId,
    });
    expect(approvalNativeOperationCommand(proposal)).toMatchObject({
      operation: 'DELIVERY_RECONCILE',
      targetType: 'OPERATION_BATCH',
      targetId: operationId,
      expectedObjectVersion: 0,
      commandPath: '/api/approvals/v1/admin/operations/deliveries/reconcile',
    });
  });

  it('captures exact candidate identity for task reassignment', () => {
    const proposal = createApprovalTaskReassignmentProposal({
      targets: [task()],
      candidate: {
        userId: 71,
        personPublicId: '66666666-6666-4666-8666-666666666666',
        displayName: 'Queue Operator',
      },
      reason: 'restore active owner',
      generatedAt,
      scopeFingerprint: 'scope-a',
    });
    expect(approvalNativeOperationCommand(proposal)).toMatchObject({
      operation: 'TASK_REASSIGN',
      targetType: 'APPROVAL_TASK',
      expectedObjectVersion: 4,
      payload: { assigneeUserId: 71 },
    });
  });

  it('invalidates on first read failure, fetch, expiry, selection, scope or target drift', () => {
    const wireDelivery = delivery();
    const data = {
      generatedAt,
      signals: [],
      breachedTasks: [],
      integrationDeliveries: [wireDelivery],
    };
    const original = approvalOperationsFullData(data)!.integrationDeliveries[0]!;
    const proposal = createApprovalDeliveryOperationProposal({
      action: 'DEAD_LETTER',
      targets: [original],
      reason: 'isolate failed event',
      generatedAt,
      scopeFingerprint: 'scope-a',
    });
    const current = {
      selectedIds: new Set([eventId]),
      scopeFingerprint: 'scope-a',
      canOperate: true,
    };
    const now = Date.parse(generatedAt) + 10_000;
    expect(approvalNativeOperationSnapshotCurrent(state(data), proposal, current, now)).toBe(true);
    expect(
      approvalNativeOperationSnapshotCurrent(
        { ...state(data), fetchStatus: 'fetching' },
        proposal,
        current,
        now
      )
    ).toBe(false);
    expect(
      approvalNativeOperationSnapshotCurrent(
        { ...state(data), fetchFailureCount: 1 },
        proposal,
        current,
        now
      )
    ).toBe(false);
    expect(
      approvalNativeOperationSnapshotCurrent(
        state(data),
        proposal,
        current,
        Date.parse(generatedAt) + 45_000
      )
    ).toBe(false);
    expect(
      approvalNativeOperationSnapshotCurrent(
        state(data),
        proposal,
        { ...current, selectedIds: new Set() },
        now
      )
    ).toBe(false);
    expect(
      approvalNativeOperationSnapshotCurrent(
        state(data),
        proposal,
        { ...current, scopeFingerprint: 'scope-b' },
        now
      )
    ).toBe(false);
    expect(
      approvalNativeOperationSnapshotCurrent(
        state({ ...data, integrationDeliveries: [{ ...original, version: 8 }] }),
        proposal,
        current,
        now
      )
    ).toBe(false);
  });

  it('accepts only the exact committed operation, mode and target transition', () => {
    const proposal = createApprovalDeliveryOperationProposal({
      action: 'DEAD_LETTER',
      targets: [delivery()],
      reason: 'isolate failed delivery',
      generatedAt,
      scopeFingerprint: 'scope-a',
    });
    const receipt = {
      operationId,
      operation: 'DELIVERY_DEAD_LETTER',
      commandMode: 'SINGLE' as const,
      actorUserId: 71,
      managementResourceSetKey: 'RS_APPROVALS',
      itemCount: 1,
      committedAt: generatedAt,
      items: [
        {
          targetId: eventId,
          requestId: null,
          previousVersion: 7,
          committedVersion: 8,
          statusBefore: 'FAILED',
          statusAfter: 'DEAD',
          assigneeUserId: null,
        },
      ],
    };
    expect(approvalNativeOperationReceiptMatches(proposal, receipt)).toBe(true);
    expect(
      approvalNativeOperationReceiptMatches(proposal, {
        ...receipt,
        operation: 'DELIVERY_REPLAY',
      })
    ).toBe(false);
    expect(
      approvalNativeOperationReceiptMatches(proposal, {
        ...receipt,
        items: [{ ...receipt.items[0]!, previousVersion: 6, committedVersion: 7 }],
      })
    ).toBe(false);
    expect(
      approvalNativeOperationReceiptMatches(proposal, {
        ...receipt,
        items: [{ ...receipt.items[0]!, statusAfter: 'PENDING' }],
      })
    ).toBe(false);
  });
});
