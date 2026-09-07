import {
  claimApprovalTask,
  decideApprovalTask,
  getApprovalTask,
} from '@dwp-frontend/shared-utils/api/approval-api';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';
import {
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
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

export type WorkHubCommand =
  | { kind: 'OPEN_SOURCE' | 'WORKSPACE_START' | 'WORKSPACE_COMPLETE' }
  | { kind: 'APPROVAL_CLAIM'; execution: ApprovalMutationExecution }
  | {
      kind: 'APPROVAL_DECIDE';
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
      comment?: string;
      execution: ApprovalMutationExecution;
    }
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
  claimApprovalTask,
  decideApprovalTask,
  getApprovalTask,
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  transitionPersonalWorkTask,
  getWorkspaceWorkQueue,
  updateWorkspaceWorkStatus,
};
export type WorkHubActionClients = typeof workHubActionClients;

function denied(): WorkHubActionResult {
  return { state: 'FORBIDDEN', retryable: false };
}
function conflict(): WorkHubActionResult {
  return { state: 'CONFLICT', retryable: true };
}

/** Source-specific commands, refreshed versions and actual owner receipts; never optimistic completion. */
export async function executeWorkHubAction(
  item: WorkHubItem,
  command: WorkHubCommand,
  clients: WorkHubActionClients = workHubActionClients
): Promise<WorkHubActionResult> {
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
      const current = (await clients.getWorkspaceWorkQueue()).items.find(
        (row) => row.workItemId === sourceReference
      );
      if (!current) return denied();
      if (current.version !== item.version) return conflict();
      const status = command.kind === 'WORKSPACE_START' ? 'IN_PROGRESS' : 'COMPLETED';
      if (!canChangeWorkspaceWorkStatus(current, status)) return denied();
      const result = await clients.updateWorkspaceWorkStatus(
        current.workItemId,
        status,
        current.version
      );
      return {
        state: 'CONFIRMED',
        outcome: 'STATUS_CHANGED',
        sourceReference,
        version: result.version,
        sourceStatus: result.status,
      };
    }
    if (command.kind === 'APPROVAL_CLAIM' || command.kind === 'APPROVAL_DECIDE') {
      if (item.reference.sourceSystem !== 'APPROVAL_TASK') return denied();
      const current = await clients.getApprovalTask(sourceReference);
      if (current.task.version !== item.version) return conflict();
      if (
        current.task.taskId !== sourceReference ||
        current.task.stepKey !== item.reference.obligationKey
      )
        return denied();
      if (
        command.kind === 'APPROVAL_CLAIM'
          ? !current.canClaim
          : !current.canDecide || current.selfApprovalBlocked
      )
        return denied();
      const result =
        command.kind === 'APPROVAL_CLAIM'
          ? await clients.claimApprovalTask(
              sourceReference,
              current.task.version,
              command.execution
            )
          : await clients.decideApprovalTask(
              sourceReference,
              {
                decision: command.decision,
                comment: command.comment,
                expectedVersion: current.task.version,
              },
              command.execution
            );
      return {
        state: 'CONFIRMED',
        outcome: command.kind === 'APPROVAL_CLAIM' ? 'STATUS_CHANGED' : 'DECISION_RECORDED',
        sourceReference,
        version: result.task.version,
        sourceStatus: result.task.status,
      };
    }
    if (command.kind === 'ACCESS_REVIEW_DECIDE') {
      if (
        item.reference.sourceSystem !== 'IDENTITY_GOVERNANCE' ||
        command.reason.trim().length < 10
      )
        return denied();
      if (!(await command.authorize(sourceReference, command.expectedVersion))) return denied();
      const current = await clients.getAccessReviewWorkDetail(sourceReference);
      if (current.version !== command.expectedVersion) return conflict();
      if (current.decision !== 'PENDING') return denied();
      const result = await clients.decideAccessReviewWork(sourceReference, {
        decision: command.decision,
        reason: command.reason.trim(),
        version: current.version,
      });
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
    const result = await clients.transitionPersonalWorkTask(
      sourceReference,
      lifecycleCommand,
      {
        version: item.version,
        ...(lifecycleCommand === 'status'
          ? {
              status:
                command.kind === 'PERSONAL_START' ? ('IN_PROGRESS' as const) : ('WAITING' as const),
            }
          : {}),
      },
      command.idempotencyKey
    );
    return {
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference,
      version: result.version,
      sourceStatus: result.status,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 409) return conflict();
      if (error.status === 401 || error.status === 403 || error.status === 404) return denied();
    }
    return { state: 'UNAVAILABLE', retryable: true };
  }
}
