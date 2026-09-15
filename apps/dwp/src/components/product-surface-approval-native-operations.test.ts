import { describe, expect, it } from 'vitest';
import {
  approvalDeliveryBatchCommand,
  approvalDeliveryDeadLetterCommand,
  approvalDeliveryReplayCommand,
  approvalTaskBatchReassignCommand,
  approvalTaskReassignCommand,
  productSurfaceHighRiskOperationBinding,
} from './product-surface-high-risk-command-model';

const eventId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';
const personId = '44444444-4444-4444-8444-444444444444';

describe('Approval native operation HIGH bindings', () => {
  it.each([
    ['DELIVERY_DEAD_LETTER', 'route.approvals.admin.operations.dead-letter.action'],
    ['DELIVERY_REPLAY', 'route.approvals.admin.operations.replay.action'],
    ['DELIVERY_BATCH_RETRY', 'route.approvals.admin.operations.batch-retry.action'],
    ['DELIVERY_BATCH_DEAD_LETTER', 'route.approvals.admin.operations.batch-dead-letter.action'],
    ['DELIVERY_BATCH_REPLAY', 'route.approvals.admin.operations.batch-replay.action'],
    ['DELIVERY_RECONCILE', 'route.approvals.admin.operations.reconcile.action'],
    ['TASK_REASSIGN', 'route.approvals.admin.operations.task-reassign.action'],
    ['TASK_BATCH_REASSIGN', 'route.approvals.admin.operations.task-batch-reassign.action'],
  ] as const)('binds %s to the exact Approval admin route', (operation, routeContractKey) => {
    expect(productSurfaceHighRiskOperationBinding(operation)).toEqual({
      routeContractKey,
      target: { productKey: 'approvals', surfaceKey: 'approvals.admin' },
    });
  });

  it('builds exact single event bodies, paths, types, and CAS versions', () => {
    expect(approvalDeliveryDeadLetterCommand(eventId, 7, 'isolate')).toMatchObject({
      operation: 'DELIVERY_DEAD_LETTER',
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/admin/operations/events/${eventId}/dead-letter`,
      targetType: 'OUTBOX_EVENT',
      targetId: eventId,
      expectedObjectVersion: 7,
      payload: { reason: 'isolate' },
    });
    expect(approvalDeliveryReplayCommand(eventId, 8, 'recover')).toMatchObject({
      operation: 'DELIVERY_REPLAY',
      commandPath: `/api/approvals/v1/admin/operations/events/${eventId}/replay`,
      targetType: 'OUTBOX_EVENT',
      expectedObjectVersion: 8,
      payload: { reason: 'recover' },
    });
  });

  it.each([
    ['DELIVERY_BATCH_RETRY', 'retry'],
    ['DELIVERY_BATCH_DEAD_LETTER', 'dead-letter'],
    ['DELIVERY_BATCH_REPLAY', 'replay'],
    ['DELIVERY_RECONCILE', 'reconcile'],
  ] as const)('builds exact %s all-or-nothing batch material', (operation, suffix) => {
    const items = [{ targetId: eventId, expectedVersion: 7 }];
    expect(approvalDeliveryBatchCommand(operation, operationId, items, 'batch reason')).toEqual({
      operation,
      commandMethod: 'POST',
      commandPath: `/api/approvals/v1/admin/operations/deliveries/${suffix}`,
      targetType: 'OPERATION_BATCH',
      targetId: operationId,
      expectedObjectVersion: 0,
      payload: { operationId, items, reason: 'batch reason' },
    });
  });

  it('builds exact single and batch task reassignment material', () => {
    expect(approvalTaskReassignCommand(taskId, 5, 71, personId, 'restore owner')).toMatchObject({
      operation: 'TASK_REASSIGN',
      commandPath: `/api/approvals/v1/admin/operations/tasks/${taskId}/reassign`,
      targetType: 'APPROVAL_TASK',
      targetId: taskId,
      expectedObjectVersion: 5,
      payload: { assigneeUserId: 71, assigneePersonPublicId: personId, reason: 'restore owner' },
    });
    const items = [
      {
        targetId: taskId,
        expectedVersion: 5,
        assigneeUserId: 71,
        assigneePersonPublicId: personId,
      },
    ];
    expect(approvalTaskBatchReassignCommand(operationId, items, 'restore owners')).toEqual({
      operation: 'TASK_BATCH_REASSIGN',
      commandMethod: 'POST',
      commandPath: '/api/approvals/v1/admin/operations/tasks/reassign',
      targetType: 'OPERATION_BATCH',
      targetId: operationId,
      expectedObjectVersion: 0,
      payload: { operationId, items, reason: 'restore owners' },
    });
  });
});
