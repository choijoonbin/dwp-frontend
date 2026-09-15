import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  approvalHighRiskMutationExecutionConfig,
  type ApprovalMutationExecution,
} from './approval-governed-mutation';

const base = '/api/approvals/v1/admin/operations';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_SIZE = 50;
const RECEIPT_OPERATIONS = new Set([
  'DELIVERY_RETRY',
  'DELIVERY_DEAD_LETTER',
  'DELIVERY_REPLAY',
  'DELIVERY_RECONCILE',
  'TASK_REASSIGN',
]);

export type ApprovalNativeDeliveryAction = 'RETRY' | 'DEAD_LETTER' | 'REPLAY' | 'RECONCILE';

export type ApprovalNativeDeliveryTarget = Readonly<{
  targetId: string;
  expectedVersion: number;
}>;

export type ApprovalNativeTaskTarget = ApprovalNativeDeliveryTarget &
  Readonly<{
    assigneeUserId: number;
    assigneePersonPublicId: string;
  }>;

export type ApprovalNativeOperationReceipt = Readonly<{
  operationId: string;
  operation: string;
  commandMode: 'SINGLE' | 'BATCH';
  actorUserId: number;
  managementResourceSetKey: string;
  itemCount: number;
  committedAt: string;
  items: readonly Readonly<{
    targetId: string;
    requestId: string | null;
    previousVersion: number;
    committedVersion: number;
    statusBefore: string;
    statusAfter: string;
    assigneeUserId: number | null;
  }>[];
}>;

type DispatchOptions = Readonly<{ beforeDispatch: () => void }>;
type SecureExecution = Extract<ApprovalMutationExecution, { mode: 'SECURE' }>;

function invalid(): never {
  throw new Error('Invalid native Approval operation contract');
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validReason(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 1000;
}

function assertExecution(execution: ApprovalMutationExecution, expectedVersion: number) {
  if (
    execution.mode !== 'SECURE' ||
    execution.objectVersion !== expectedVersion ||
    !execution.idempotencyKey?.trim()
  ) {
    invalid();
  }
  return execution as SecureExecution;
}

function assertTargets<T extends ApprovalNativeDeliveryTarget>(items: readonly T[]): T[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_BATCH_SIZE) invalid();
  const targetIds = new Set<string>();
  return items.map((item) => {
    if (!UUID.test(item.targetId) || !validVersion(item.expectedVersion)) invalid();
    const id = item.targetId.toLowerCase();
    if (targetIds.has(id)) invalid();
    targetIds.add(id);
    return { ...item };
  });
}

function assertTaskTargets(items: readonly ApprovalNativeTaskTarget[]): ApprovalNativeTaskTarget[] {
  return assertTargets(items).map((item) => {
    if (
      !Number.isSafeInteger(item.assigneeUserId) ||
      item.assigneeUserId < 1 ||
      !UUID.test(item.assigneePersonPublicId)
    ) {
      invalid();
    }
    return item;
  });
}

function readReceipt(value: unknown): ApprovalNativeOperationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const receipt = value as Record<string, unknown>;
  const items = receipt.items;
  if (
    !UUID.test(String(receipt.operationId ?? '')) ||
    !RECEIPT_OPERATIONS.has(String(receipt.operation ?? '')) ||
    (receipt.commandMode !== 'SINGLE' && receipt.commandMode !== 'BATCH') ||
    !Number.isSafeInteger(receipt.actorUserId) ||
    Number(receipt.actorUserId) < 1 ||
    typeof receipt.managementResourceSetKey !== 'string' ||
    !receipt.managementResourceSetKey.trim() ||
    !Number.isSafeInteger(receipt.itemCount) ||
    Number(receipt.itemCount) < 1 ||
    Number(receipt.itemCount) > MAX_BATCH_SIZE ||
    typeof receipt.committedAt !== 'string' ||
    !Number.isFinite(Date.parse(receipt.committedAt)) ||
    !Array.isArray(items) ||
    items.length !== receipt.itemCount
  ) {
    invalid();
  }
  const targetIds = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid();
    const row = item as Record<string, unknown>;
    if (
      !UUID.test(String(row.targetId ?? '')) ||
      (row.requestId !== null && !UUID.test(String(row.requestId ?? ''))) ||
      !validVersion(row.previousVersion) ||
      !validVersion(row.committedVersion) ||
      row.committedVersion !== Number(row.previousVersion) + 1 ||
      typeof row.statusBefore !== 'string' ||
      !row.statusBefore.trim() ||
      typeof row.statusAfter !== 'string' ||
      !row.statusAfter.trim() ||
      (row.assigneeUserId !== null &&
        (!Number.isSafeInteger(row.assigneeUserId) || Number(row.assigneeUserId) < 1))
    ) {
      invalid();
    }
    const targetId = String(row.targetId).toLowerCase();
    if (targetIds.has(targetId)) invalid();
    targetIds.add(targetId);
  }
  return structuredClone(value) as ApprovalNativeOperationReceipt;
}

async function post(
  path: string,
  body: Readonly<Record<string, unknown>>,
  execution: ApprovalMutationExecution,
  expectedVersion: number,
  options: DispatchOptions
): Promise<ApprovalNativeOperationReceipt> {
  if (typeof options.beforeDispatch !== 'function') invalid();
  const authority = assertExecution(execution, expectedVersion);
  const payload = structuredClone(body);
  options.beforeDispatch();
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof payload>(path, payload, {
    ...approvalHighRiskMutationExecutionConfig(authority, { objectVersionHeader: true }),
    beforeDispatch: options.beforeDispatch,
    csrfReplay: 'NEVER',
  });
  options.beforeDispatch();
  return readReceipt(response.data.data);
}

export function deadLetterApprovalEvent(
  outboxId: string,
  expectedVersion: number,
  reason: string,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
) {
  if (!UUID.test(outboxId) || !validVersion(expectedVersion) || !validReason(reason)) invalid();
  return post(
    `${base}/events/${outboxId}/dead-letter`,
    { reason: reason.trim() },
    execution,
    expectedVersion,
    options
  );
}

export function replayApprovalEvent(
  outboxId: string,
  expectedVersion: number,
  reason: string,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
) {
  if (!UUID.test(outboxId) || !validVersion(expectedVersion) || !validReason(reason)) invalid();
  return post(
    `${base}/events/${outboxId}/replay`,
    { reason: reason.trim() },
    execution,
    expectedVersion,
    options
  );
}

export function runApprovalDeliveryBatch(
  action: ApprovalNativeDeliveryAction,
  operationId: string,
  items: readonly ApprovalNativeDeliveryTarget[],
  reason: string,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
) {
  const suffix = {
    RETRY: 'retry',
    DEAD_LETTER: 'dead-letter',
    REPLAY: 'replay',
    RECONCILE: 'reconcile',
  }[action];
  if (!suffix || !UUID.test(operationId) || !validReason(reason)) invalid();
  return post(
    `${base}/deliveries/${suffix}`,
    { operationId, items: assertTargets(items), reason: reason.trim() },
    execution,
    0,
    options
  );
}

export function reassignApprovalTask(
  taskId: string,
  expectedVersion: number,
  assigneeUserId: number,
  assigneePersonPublicId: string,
  reason: string,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
) {
  if (
    !UUID.test(taskId) ||
    !validVersion(expectedVersion) ||
    !Number.isSafeInteger(assigneeUserId) ||
    assigneeUserId < 1 ||
    !UUID.test(assigneePersonPublicId) ||
    !validReason(reason)
  ) {
    invalid();
  }
  return post(
    `${base}/tasks/${taskId}/reassign`,
    { assigneeUserId, assigneePersonPublicId, reason: reason.trim() },
    execution,
    expectedVersion,
    options
  );
}

export function reassignApprovalTasks(
  operationId: string,
  items: readonly ApprovalNativeTaskTarget[],
  reason: string,
  execution: ApprovalMutationExecution,
  options: DispatchOptions
) {
  if (!UUID.test(operationId) || !validReason(reason)) invalid();
  return post(
    `${base}/tasks/reassign`,
    { operationId, items: assertTaskTargets(items), reason: reason.trim() },
    execution,
    0,
    options
  );
}
