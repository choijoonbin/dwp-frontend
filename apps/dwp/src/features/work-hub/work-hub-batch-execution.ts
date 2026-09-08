import {
  canChangeWorkspaceWorkStatus,
  updateWorkspaceWorkStatuses,
} from '@dwp-frontend/shared-utils';
import { transitionPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { WorkHubItem } from './work-hub-contracts';
export type WorkHubBatchTarget = 'IN_PROGRESS' | 'COMPLETED';

export type WorkHubBatchReceipt = {
  item: WorkHubItem;
  state: 'CONFIRMED' | 'CONFLICT' | 'FORBIDDEN' | 'UNKNOWN' | 'EXCLUDED';
  idempotencyKey: string;
  version?: number;
  reason?: 'CANCELLED';
};

export function canRetryWorkHubBatchReceipt(receipt: WorkHubBatchReceipt) {
  return (
    receipt.state === 'UNKNOWN' &&
    receipt.reason !== 'CANCELLED' &&
    receipt.item.reference.sourceSystem === 'PERSONAL_TASK'
  );
}

export type WorkHubBatchExecutionGuard = {
  signal?: AbortSignal;
  canContinue?: () => boolean;
};
function failure(error: unknown): WorkHubBatchReceipt['state'] {
  if (error instanceof HttpError) {
    if (error.status === 409) return 'CONFLICT';
    if ([401, 403, 404].includes(error.status)) return 'FORBIDDEN';
    if (error.status >= 400 && error.status < 500) return 'EXCLUDED';
  }
  return 'UNKNOWN';
}
export function workHubBatchEligible(item: WorkHubItem, target: WorkHubBatchTarget) {
  if (item.reference.sourceSystem === 'PERSONAL_TASK') {
    const kind = target === 'COMPLETED' ? 'PERSONAL_COMPLETE' : 'PERSONAL_START';
    return item.actions.some(
      (action) => action.kind === kind && action.availability === 'AVAILABLE'
    );
  }
  return Boolean(item.legacyItem && canChangeWorkspaceWorkStatus(item.legacyItem, target));
}
/** Personal retries replay only unconfirmed commands with the same key; Workspace remains atomic. */
export async function executeWorkHubBatch(
  target: WorkHubBatchTarget,
  items: readonly WorkHubItem[],
  previous: readonly WorkHubBatchReceipt[] = [],
  clients = { transitionPersonalWorkTask, updateWorkspaceWorkStatuses },
  guard: WorkHubBatchExecutionGuard = {}
): Promise<WorkHubBatchReceipt[]> {
  if (items.length === 0 || items.length > 50) throw new Error('Select between 1 and 50 items');
  const results = new Map(previous.map((receipt) => [receipt.item.key, receipt]));
  const workspace: WorkHubItem[] = [];
  const canContinue = () => !guard.signal?.aborted && (guard.canContinue?.() ?? true);
  const cancelled = (item: WorkHubItem, idempotencyKey: string, sent: boolean) => ({
    item,
    idempotencyKey,
    state: sent ? ('UNKNOWN' as const) : ('EXCLUDED' as const),
    reason: 'CANCELLED' as const,
  });
  for (const item of items) {
    const prior = results.get(item.key);
    if (prior && !canRetryWorkHubBatchReceipt(prior)) continue;
    const idempotencyKey = prior?.idempotencyKey ?? crypto.randomUUID();
    if (!canContinue()) {
      // A prior unknown command may already have reached its source; never call it unsent.
      results.set(item.key, cancelled(item, idempotencyKey, Boolean(prior)));
      continue;
    }
    if (!workHubBatchEligible(item, target)) {
      results.set(item.key, { item, idempotencyKey, state: 'EXCLUDED' });
      continue;
    }
    if (item.reference.sourceSystem !== 'PERSONAL_TASK') {
      workspace.push(item);
      results.set(item.key, { item, idempotencyKey, state: 'UNKNOWN' });
      continue;
    }
    try {
      const result = await clients.transitionPersonalWorkTask(
        item.reference.sourceReference,
        target === 'COMPLETED' ? 'complete' : 'status',
        {
          version: item.version,
          ...(target === 'IN_PROGRESS' ? { status: 'IN_PROGRESS' as const } : {}),
        },
        idempotencyKey,
        guard.signal
      );
      const confirmed =
        result.taskId === item.reference.sourceReference &&
        result.status === target &&
        result.version > item.version;
      results.set(item.key, {
        item,
        idempotencyKey,
        state: confirmed ? 'CONFIRMED' : 'UNKNOWN',
        version: confirmed ? result.version : undefined,
        ...(!confirmed && !canContinue() ? { reason: 'CANCELLED' as const } : {}),
      });
    } catch (error) {
      results.set(
        item.key,
        canContinue()
          ? { item, idempotencyKey, state: failure(error) }
          : cancelled(item, idempotencyKey, true)
      );
    }
  }
  if (workspace.length && !canContinue()) {
    for (const item of workspace)
      results.set(item.key, cancelled(item, results.get(item.key)!.idempotencyKey, false));
  } else if (workspace.length) {
    try {
      const response = await clients.updateWorkspaceWorkStatuses(
        workspace.map((item) => ({
          workItemId: item.legacyItem!.workItemId,
          version: item.legacyItem!.version,
        })),
        target,
        guard.signal
      );
      for (const item of workspace) {
        const row = response.find(
          (candidate) => candidate.workItemId === item.legacyItem!.workItemId
        );
        const confirmed =
          row?.status === (target === 'COMPLETED' ? 'completed' : 'in-progress') &&
          row.version > item.version;
        results.set(item.key, {
          ...results.get(item.key)!,
          state: confirmed ? 'CONFIRMED' : 'UNKNOWN',
          version: confirmed ? row.version : undefined,
          ...(!confirmed && !canContinue() ? { reason: 'CANCELLED' as const } : {}),
        });
      }
    } catch (error) {
      for (const item of workspace)
        results.set(
          item.key,
          canContinue()
            ? { ...results.get(item.key)!, state: failure(error) }
            : cancelled(item, results.get(item.key)!.idempotencyKey, true)
        );
    }
  }
  return items.map((item) => results.get(item.key)!);
}
