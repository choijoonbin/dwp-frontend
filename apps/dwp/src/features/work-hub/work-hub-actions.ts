import {
  ACCESS_REVIEW_REASON_MAX_LENGTH,
  ACCESS_REVIEW_REASON_MIN_LENGTH,
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  isAccessReviewDecisionSource,
  isExactAccessReviewDecisionReceipt,
} from '@dwp-frontend/shared-utils/api/access-review-work-api';
import { transitionPersonalWorkTask } from '@dwp-frontend/shared-utils/api/personal-work-api';
import {
  getWorkspaceWorkQueue,
  updateWorkspaceWorkStatus,
} from '@dwp-frontend/shared-utils/api/workspace-api';
import {
  canChangeWorkspaceWorkStatus,
  workspaceWorkSourceRoute,
} from '@dwp-frontend/shared-utils/api/workspace-work-policy';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { WorkHubActionKind, WorkHubItem } from './work-hub-contracts';
import { isPersonalTaskLifecycleReceipt } from './work-hub-personal-save-receipt';

export type WorkHubCommand =
  | { kind: 'OPEN_SOURCE' | 'WORKSPACE_START' | 'WORKSPACE_COMPLETE' }
  | {
      kind: 'ACCESS_REVIEW_DECIDE';
      decision: 'APPROVE' | 'REVOKE';
      reason: string;
      expectedVersion: number;
      authorize: (reference: string, version: number) => Promise<boolean>;
    }
  | {
      kind:
        | 'PERSONAL_START'
        | 'PERSONAL_WAIT'
        | 'PERSONAL_COMPLETE'
        | 'PERSONAL_REOPEN'
        | 'PERSONAL_ARCHIVE';
      idempotencyKey: string;
    };

export type WorkHubActionResult =
  | { state: 'HANDED_OFF'; route: string; sourceChanged: false }
  | {
      state: 'CONFIRMED';
      outcome: 'STATUS_CHANGED' | 'DECISION_RECORDED';
      sourceReference: string;
      version: number;
      sourceStatus: string;
      remediationState?: string;
    }
  | { state: 'CONFLICT' | 'FORBIDDEN' | 'UNAVAILABLE'; retryable: boolean };

export const workHubActionClients = {
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  transitionPersonalWorkTask,
  getWorkspaceWorkQueue,
  updateWorkspaceWorkStatus,
};
export type WorkHubActionClients = typeof workHubActionClients;
export type WorkHubActionGuard = {
  signal?: AbortSignal;
  canContinue?: () => boolean;
};

function denied(): WorkHubActionResult {
  return { state: 'FORBIDDEN', retryable: false };
}
function conflict(): WorkHubActionResult {
  return { state: 'CONFLICT', retryable: true };
}
function cancelled(): WorkHubActionResult {
  return { state: 'UNAVAILABLE', retryable: false };
}
function unconfirmed(): WorkHubActionResult {
  return { state: 'UNAVAILABLE', retryable: true };
}

function isAdvancedVersion(value: unknown, reviewedVersion: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > reviewedVersion;
}

/**
 * Source apps may be independently deployed, so a source handoff must cross the document
 * boundary instead of asking the current product Router to resolve a foreign route.
 */
export function openWorkHubSourceRoute(
  route: string,
  assign: (route: string) => void = (target) => window.location.assign(target)
): boolean {
  const target = workspaceWorkSourceRoute({ sourceRoute: route });
  if (!target) return false;
  assign(target);
  return true;
}

/** Source-specific commands, refreshed versions and actual owner receipts; never optimistic completion. */
export async function executeWorkHubAction(
  item: WorkHubItem,
  command: WorkHubCommand,
  clients: WorkHubActionClients = workHubActionClients,
  guard: WorkHubActionGuard = {}
): Promise<WorkHubActionResult> {
  const canContinue = () => !guard.signal?.aborted && (guard.canContinue?.() ?? true);
  if (!canContinue()) return cancelled();
  if (!item.actions.some((action) => action.kind === command.kind)) return denied();
  const sourceReference = item.reference.sourceReference;
  try {
    if (command.kind === 'OPEN_SOURCE') {
      const route = workspaceWorkSourceRoute(item);
      return route
        ? { state: 'HANDED_OFF', route, sourceChanged: false }
        : { state: 'UNAVAILABLE', retryable: false };
    }
    if (command.kind === 'WORKSPACE_START' || command.kind === 'WORKSPACE_COMPLETE') {
      if (item.reference.sourceSystem !== 'WORKSPACE') return denied();
      const queue = guard.signal
        ? await clients.getWorkspaceWorkQueue(guard.signal)
        : await clients.getWorkspaceWorkQueue();
      if (!canContinue()) return cancelled();
      const current = queue.items.find((row) => row.workItemId === sourceReference);
      if (!current) return denied();
      if (current.version !== item.version) return conflict();
      const status = command.kind === 'WORKSPACE_START' ? 'IN_PROGRESS' : 'COMPLETED';
      if (!canChangeWorkspaceWorkStatus(current, status)) return denied();
      const result = guard.signal
        ? await clients.updateWorkspaceWorkStatus(
            current.workItemId,
            status,
            current.version,
            guard.signal
          )
        : await clients.updateWorkspaceWorkStatus(current.workItemId, status, current.version);
      if (!canContinue()) return cancelled();
      const expectedStatus = status === 'COMPLETED' ? 'completed' : 'in-progress';
      if (
        result.workItemId !== sourceReference ||
        result.status !== expectedStatus ||
        !isAdvancedVersion(result.version, current.version)
      )
        return unconfirmed();
      return {
        state: 'CONFIRMED',
        outcome: 'STATUS_CHANGED',
        sourceReference,
        version: result.version,
        sourceStatus: result.status,
      };
    }
    if (command.kind === 'ACCESS_REVIEW_DECIDE') {
      if (
        item.reference.sourceSystem !== 'IDENTITY_GOVERNANCE' ||
        (command.decision !== 'APPROVE' && command.decision !== 'REVOKE') ||
        command.reason.trim().length < ACCESS_REVIEW_REASON_MIN_LENGTH ||
        command.reason.length > ACCESS_REVIEW_REASON_MAX_LENGTH
      )
        return denied();
      if (item.version !== command.expectedVersion) return conflict();
      if (!(await command.authorize(sourceReference, command.expectedVersion))) return denied();
      if (!canContinue()) return cancelled();
      const current = guard.signal
        ? await clients.getAccessReviewWorkDetail(sourceReference, guard.signal)
        : await clients.getAccessReviewWorkDetail(sourceReference);
      if (!canContinue()) return cancelled();
      if (current.workItemRef !== sourceReference) return unconfirmed();
      if (current.version !== command.expectedVersion) return conflict();
      if (current.decision !== 'PENDING') return denied();
      if (!isAccessReviewDecisionSource(current)) return unconfirmed();
      const decision = {
        decision: command.decision,
        reason: command.reason.trim(),
        version: current.version,
      };
      const result = guard.signal
        ? await clients.decideAccessReviewWork(sourceReference, decision, guard.signal)
        : await clients.decideAccessReviewWork(sourceReference, decision);
      if (!canContinue()) return cancelled();
      if (!isExactAccessReviewDecisionReceipt(result, current, decision)) return unconfirmed();
      return {
        state: 'CONFIRMED',
        outcome: 'DECISION_RECORDED',
        sourceReference,
        version: result.version,
        sourceStatus: result.decision,
        remediationState: result.remediationState,
      };
    }
    if (item.reference.sourceSystem !== 'PERSONAL_TASK' || !('idempotencyKey' in command))
      return denied();
    const kinds: Record<string, WorkHubActionKind[]> = {
      OPEN: ['PERSONAL_START', 'PERSONAL_WAIT', 'PERSONAL_COMPLETE', 'PERSONAL_ARCHIVE'],
      IN_PROGRESS: ['PERSONAL_WAIT', 'PERSONAL_COMPLETE', 'PERSONAL_ARCHIVE'],
      WAITING: ['PERSONAL_START', 'PERSONAL_COMPLETE', 'PERSONAL_ARCHIVE'],
      COMPLETED: ['PERSONAL_REOPEN', 'PERSONAL_ARCHIVE'],
      ARCHIVED: ['PERSONAL_REOPEN'],
    };
    if (!kinds[item.sourceStatus]?.includes(command.kind)) return denied();
    const lifecycleCommand =
      command.kind === 'PERSONAL_COMPLETE'
        ? 'complete'
        : command.kind === 'PERSONAL_REOPEN'
          ? 'reopen'
          : command.kind === 'PERSONAL_ARCHIVE'
            ? 'archive'
            : 'status';
    if (!canContinue()) return cancelled();
    const transition = {
      version: item.version,
      ...(lifecycleCommand === 'status'
        ? {
            status:
              command.kind === 'PERSONAL_START' ? ('IN_PROGRESS' as const) : ('WAITING' as const),
          }
        : {}),
    };
    const result = guard.signal
      ? await clients.transitionPersonalWorkTask(
          sourceReference,
          lifecycleCommand,
          transition,
          command.idempotencyKey,
          guard.signal
        )
      : await clients.transitionPersonalWorkTask(
          sourceReference,
          lifecycleCommand,
          transition,
          command.idempotencyKey
        );
    if (!canContinue()) return cancelled();
    const expectedStatus =
      command.kind === 'PERSONAL_START'
        ? 'IN_PROGRESS'
        : command.kind === 'PERSONAL_WAIT'
          ? 'WAITING'
          : command.kind === 'PERSONAL_COMPLETE'
            ? 'COMPLETED'
            : command.kind === 'PERSONAL_ARCHIVE'
              ? 'ARCHIVED'
              : 'OPEN';
    if (
      !isPersonalTaskLifecycleReceipt(result, {
        taskId: sourceReference,
        title: item.title,
        description: item.summary,
        priority: item.priority,
        dueAt: item.dueAt,
        status: expectedStatus,
        version: item.version,
        updatedAt: item.updatedAt,
      })
    )
      return unconfirmed();
    return {
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference,
      version: result.version,
      sourceStatus: result.status,
    };
  } catch (error) {
    if (!canContinue() || (error instanceof DOMException && error.name === 'AbortError')) {
      return cancelled();
    }
    if (error instanceof HttpError) {
      if (error.status === 409) return conflict();
      if (error.status === 401 || error.status === 403 || error.status === 404) return denied();
    }
    return { state: 'UNAVAILABLE', retryable: true };
  }
}
