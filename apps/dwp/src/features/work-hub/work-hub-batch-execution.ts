import {
  canChangeWorkspaceWorkStatus,
  updateWorkspaceWorkStatuses,
} from '@dwp-frontend/shared-utils';
import { transitionPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { WorkHubItem, WorkHubLifecycle } from './work-hub-contracts';
import { canUseWorkHubGenericAdjunct } from './work-hub-command-authority';
export type WorkHubBatchTarget = 'IN_PROGRESS' | 'COMPLETED';

export type WorkHubBatchCommandKind =
  'PERSONAL_START' | 'PERSONAL_COMPLETE' | 'WORKSPACE_START' | 'WORKSPACE_COMPLETE';

export type WorkHubBatchReviewedCommand = {
  kind: WorkHubBatchCommandKind | null;
  lifecycle: WorkHubLifecycle;
  version: number;
};

export type WorkHubBatchReceipt = {
  item: WorkHubItem;
  state: 'CONFIRMED' | 'CONFLICT' | 'FORBIDDEN' | 'UNKNOWN' | 'EXCLUDED';
  idempotencyKey: string;
  /** Immutable request identity captured on the review screen and reused after a remount. */
  reviewedCommand: WorkHubBatchReviewedCommand;
  version?: number;
  reason?: 'CANCELLED';
};

export function canRetryWorkHubBatchReceipt(receipt: WorkHubBatchReceipt) {
  return (
    receipt.state === 'UNKNOWN' &&
    receipt.reason !== 'CANCELLED' &&
    receipt.item.reference.sourceSystem === 'PERSONAL_TASK' &&
    (receipt.reviewedCommand.kind === 'PERSONAL_START' ||
      receipt.reviewedCommand.kind === 'PERSONAL_COMPLETE')
  );
}

export type WorkHubBatchExecutionGuard = {
  signal?: AbortSignal;
  canContinue?: () => boolean;
  /** Request identities durably recorded before any source request is allowed to start. */
  idempotencyKeys?: ReadonlyMap<string, string>;
  reviewedCommands?: ReadonlyMap<string, WorkHubBatchReviewedCommand>;
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
  if (!canUseWorkHubGenericAdjunct(item, 'BATCH')) return false;
  if (item.reference.sourceSystem === 'PERSONAL_TASK') {
    const kind = target === 'COMPLETED' ? 'PERSONAL_COMPLETE' : 'PERSONAL_START';
    return item.actions.some(
      (action) => action.kind === kind && action.availability === 'AVAILABLE'
    );
  }
  return Boolean(item.legacyItem && canChangeWorkspaceWorkStatus(item.legacyItem, target));
}

export function workHubBatchReviewedCommand(
  item: WorkHubItem,
  target: WorkHubBatchTarget
): WorkHubBatchReviewedCommand {
  const eligible = workHubBatchEligible(item, target);
  const kind: WorkHubBatchCommandKind | null = !eligible
    ? null
    : item.reference.sourceSystem === 'PERSONAL_TASK'
      ? target === 'COMPLETED'
        ? 'PERSONAL_COMPLETE'
        : 'PERSONAL_START'
      : target === 'COMPLETED'
        ? 'WORKSPACE_COMPLETE'
        : 'WORKSPACE_START';
  return {
    kind,
    lifecycle: item.lifecycle,
    version:
      item.reference.sourceSystem === 'PERSONAL_TASK'
        ? item.version
        : (item.legacyItem?.version ?? item.version),
  };
}

function personalCommandMatchesTarget(
  command: WorkHubBatchReviewedCommand,
  target: WorkHubBatchTarget
) {
  return command.kind === (target === 'COMPLETED' ? 'PERSONAL_COMPLETE' : 'PERSONAL_START');
}

function isAdvancedVersion(value: unknown, reviewedVersion: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > reviewedVersion;
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
  const cancelled = (
    item: WorkHubItem,
    idempotencyKey: string,
    reviewedCommand: WorkHubBatchReviewedCommand,
    sent: boolean
  ) => ({
    item,
    idempotencyKey,
    reviewedCommand,
    state: sent ? ('UNKNOWN' as const) : ('EXCLUDED' as const),
    reason: 'CANCELLED' as const,
  });
  for (const item of items) {
    const prior = results.get(item.key);
    if (!canUseWorkHubGenericAdjunct(item, 'BATCH')) {
      const reviewedCommand = workHubBatchReviewedCommand(item, target);
      const idempotencyKey =
        prior?.idempotencyKey ?? guard.idempotencyKeys?.get(item.key) ?? crypto.randomUUID();
      results.set(item.key, { item, idempotencyKey, reviewedCommand, state: 'EXCLUDED' });
      continue;
    }
    if (prior && !canRetryWorkHubBatchReceipt(prior)) continue;
    const reviewedCommand =
      prior?.reviewedCommand ??
      guard.reviewedCommands?.get(item.key) ??
      workHubBatchReviewedCommand(item, target);
    const idempotencyKey =
      prior?.idempotencyKey ?? guard.idempotencyKeys?.get(item.key) ?? crypto.randomUUID();
    if (!canContinue()) {
      // A prior unknown command may already have reached its source; never call it unsent.
      results.set(item.key, cancelled(item, idempotencyKey, reviewedCommand, Boolean(prior)));
      continue;
    }
    if (reviewedCommand.kind === null) {
      results.set(item.key, { item, idempotencyKey, reviewedCommand, state: 'EXCLUDED' });
      continue;
    }
    if (item.reference.sourceSystem !== 'PERSONAL_TASK') {
      workspace.push(item);
      results.set(item.key, { item, idempotencyKey, reviewedCommand, state: 'UNKNOWN' });
      continue;
    }
    if (!personalCommandMatchesTarget(reviewedCommand, target)) {
      results.set(item.key, { item, idempotencyKey, reviewedCommand, state: 'EXCLUDED' });
      continue;
    }
    try {
      const result = await clients.transitionPersonalWorkTask(
        item.reference.sourceReference,
        reviewedCommand.kind === 'PERSONAL_COMPLETE' ? 'complete' : 'status',
        {
          version: reviewedCommand.version,
          ...(reviewedCommand.kind === 'PERSONAL_START' ? { status: 'IN_PROGRESS' as const } : {}),
        },
        idempotencyKey,
        guard.signal
      );
      const confirmed =
        result.taskId === item.reference.sourceReference &&
        result.status === target &&
        isAdvancedVersion(result.version, reviewedCommand.version);
      results.set(item.key, {
        item,
        idempotencyKey,
        reviewedCommand,
        state: confirmed ? 'CONFIRMED' : 'UNKNOWN',
        version: confirmed ? result.version : undefined,
        ...(!confirmed && !canContinue() ? { reason: 'CANCELLED' as const } : {}),
      });
    } catch (error) {
      results.set(
        item.key,
        canContinue()
          ? { item, idempotencyKey, reviewedCommand, state: failure(error) }
          : cancelled(item, idempotencyKey, reviewedCommand, true)
      );
    }
  }
  if (workspace.length && !canContinue()) {
    for (const item of workspace)
      results.set(
        item.key,
        cancelled(
          item,
          results.get(item.key)!.idempotencyKey,
          results.get(item.key)!.reviewedCommand,
          false
        )
      );
  } else if (workspace.length) {
    try {
      const response = await clients.updateWorkspaceWorkStatuses(
        workspace.map((item) => ({
          workItemId: item.legacyItem!.workItemId,
          version: results.get(item.key)!.reviewedCommand.version,
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
          isAdvancedVersion(row.version, results.get(item.key)!.reviewedCommand.version);
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
            : cancelled(
                item,
                results.get(item.key)!.idempotencyKey,
                results.get(item.key)!.reviewedCommand,
                true
              )
        );
    }
  }
  return items.map((item) => results.get(item.key)!);
}
