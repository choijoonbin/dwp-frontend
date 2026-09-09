import { useEffect, useRef, useState } from 'react';
import {
  deletePersonalWorkTask,
  getPersonalWorkTask,
  transitionPersonalWorkTask,
  updatePersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import type {
  PersonalWorkChecklistItem,
  PersonalWorkDeleteResult,
  PersonalWorkStatus,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import {
  canExecuteWorkHubAction,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
  workHubCommandScope,
} from './work-hub-command-authority';
import type { WorkHubActionKind, WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import {
  isPersonalTaskCommandReceipt,
  isPersonalTaskDeleteReceipt,
  isPersonalTaskReviewedReceipt,
} from './work-hub-personal-save-receipt';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

export type PersonalWorkDetailCommand =
  | { kind: 'CHECKLIST'; version: number; checklist: PersonalWorkChecklistItem[] }
  | { kind: 'DELETE'; version: number }
  | { kind: 'STATUS'; version: number; status: PersonalWorkStatus };

export type PersonalWorkDetailCommandResult = PersonalWorkTask | PersonalWorkDeleteResult;

export type PersonalWorkDetailCommandClients = {
  getPersonalWorkTask: typeof getPersonalWorkTask;
  updatePersonalWorkTask: typeof updatePersonalWorkTask;
  deletePersonalWorkTask: typeof deletePersonalWorkTask;
  transitionPersonalWorkTask: typeof transitionPersonalWorkTask;
};

export const personalWorkDetailCommandClients: PersonalWorkDetailCommandClients = {
  getPersonalWorkTask,
  updatePersonalWorkTask,
  deletePersonalWorkTask,
  transitionPersonalWorkTask,
};

type PersonalWorkCommandRun = {
  command: PersonalWorkDetailCommand;
  ownerFingerprint: string;
  reviewedScope: string;
  controller: AbortController;
};

export type PersonalWorkDetailCommandGuard = {
  signal: AbortSignal;
  canContinue: () => boolean;
  reviewedItem: WorkHubItem;
  preflight: () => Promise<WorkHubSnapshot | null>;
};

function abortError() {
  return new DOMException('Personal work owner changed', 'AbortError');
}

function assertCurrent(signal: AbortSignal, canContinue: () => boolean) {
  if (signal.aborted || !canContinue()) throw abortError();
}

export function personalWorkStatusActionKind(status: PersonalWorkStatus): WorkHubActionKind | null {
  if (status === 'IN_PROGRESS') return 'PERSONAL_START';
  if (status === 'WAITING') return 'PERSONAL_WAIT';
  if (status === 'COMPLETED') return 'PERSONAL_COMPLETE';
  return status === 'OPEN' ? 'PERSONAL_REOPEN' : null;
}

/** Executes a reviewed Personal Work command and rejects unrelated or stale success receipts. */
export async function executePersonalWorkDetailCommand(
  taskId: string,
  command: PersonalWorkDetailCommand,
  idempotencyKey: string,
  guard: PersonalWorkDetailCommandGuard,
  clients: PersonalWorkDetailCommandClients = personalWorkDetailCommandClients
): Promise<PersonalWorkDetailCommandResult> {
  assertCurrent(guard.signal, guard.canContinue);
  const snapshot = await guard.preflight();
  assertCurrent(guard.signal, guard.canContinue);
  if (!isWorkHubSourceCommandReady(snapshot, 'personal')) {
    throw new HttpError('Personal work source is unavailable', 503);
  }
  if (
    guard.reviewedItem.reference.sourceSystem !== 'PERSONAL_TASK' ||
    guard.reviewedItem.reference.sourceReference !== taskId ||
    !isWorkHubItemCommandReady(snapshot, guard.reviewedItem)
  ) {
    throw new HttpError('Personal work selection changed', 409);
  }
  if (command.kind === 'STATUS') {
    const action = personalWorkStatusActionKind(command.status);
    if (!action || !canExecuteWorkHubAction(snapshot, guard.reviewedItem, action)) {
      throw new HttpError('Personal work transition is unavailable', 409);
    }
  }
  const latest = await clients.getPersonalWorkTask(taskId, guard.signal);
  assertCurrent(guard.signal, guard.canContinue);
  if (
    command.version !== guard.reviewedItem.version ||
    !isPersonalTaskReviewedReceipt(latest, taskId, command.version) ||
    latest.status !== guard.reviewedItem.lifecycle ||
    latest.status !== guard.reviewedItem.sourceStatus
  ) {
    throw new HttpError('Personal work version changed', 409);
  }

  if (command.kind === 'DELETE') {
    const result = await clients.deletePersonalWorkTask(
      taskId,
      { version: command.version },
      idempotencyKey,
      guard.signal
    );
    assertCurrent(guard.signal, guard.canContinue);
    if (!isPersonalTaskDeleteReceipt(result, latest)) {
      throw new HttpError('Personal work deletion receipt was invalid', 409);
    }
    return result;
  }

  if (command.kind === 'CHECKLIST') {
    const result = await clients.updatePersonalWorkTask(
      taskId,
      {
        title: latest.title,
        description: latest.description,
        priority: latest.priority,
        dueAt: latest.dueAt,
        checklist: command.checklist,
        version: command.version,
      },
      idempotencyKey,
      guard.signal
    );
    assertCurrent(guard.signal, guard.canContinue);
    if (!isPersonalTaskCommandReceipt(result, latest, command)) {
      throw new HttpError('Personal work checklist receipt did not match the submitted list', 409);
    }
    return result;
  }

  const transition =
    command.status === 'COMPLETED'
      ? 'complete'
      : command.status === 'OPEN' && ['COMPLETED', 'ARCHIVED'].includes(latest.status)
        ? 'reopen'
        : 'status';
  const result = await clients.transitionPersonalWorkTask(
    taskId,
    transition,
    {
      version: command.version,
      ...(transition === 'status' ? { status: command.status } : {}),
    },
    idempotencyKey,
    guard.signal
  );
  assertCurrent(guard.signal, guard.canContinue);
  if (!isPersonalTaskCommandReceipt(result, latest, command)) {
    throw new HttpError('Personal work status receipt did not match the requested state', 409);
  }
  return result;
}

/** Owns in-flight detail commands so tenant, user, permission and route changes fail closed. */
export function useWorkHubPersonalCommand(
  {
    ownerFingerprint,
    taskId,
    reviewedItem,
    preflight,
    canEdit,
    mutationCoordinator,
    onConfirmed,
    onError,
  }: {
    ownerFingerprint: string | null;
    taskId: string;
    reviewedItem: WorkHubItem;
    preflight: () => Promise<WorkHubSnapshot | null>;
    canEdit: boolean;
    mutationCoordinator?: WorkTaskSaveCoordinator;
    onConfirmed: (
      result: PersonalWorkDetailCommandResult,
      command: PersonalWorkDetailCommand
    ) => void | Promise<void>;
    onError: (error: unknown, command: PersonalWorkDetailCommand) => void | Promise<void>;
  },
  clients: PersonalWorkDetailCommandClients = personalWorkDetailCommandClients
) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);
  const owner = useRef(ownerFingerprint);
  const selectedTask = useRef(taskId);
  const reviewedScope = workHubCommandScope(reviewedItem);
  const selectedReviewedScope = useRef(reviewedScope);
  const permission = useRef(canEdit);
  const active = useRef<PersonalWorkCommandRun | null>(null);
  const intent = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const callbacks = useRef({ onConfirmed, onError });
  owner.current = ownerFingerprint;
  selectedTask.current = taskId;
  selectedReviewedScope.current = reviewedScope;
  permission.current = canEdit;
  callbacks.current = { onConfirmed, onError };

  const isCurrent = (run: PersonalWorkCommandRun) =>
    mounted.current &&
    active.current === run &&
    owner.current === run.ownerFingerprint &&
    selectedTask.current === taskId &&
    selectedReviewedScope.current === run.reviewedScope &&
    permission.current &&
    !run.controller.signal.aborted;

  useEffect(() => {
    mounted.current = true;
    active.current?.controller.abort();
    active.current = null;
    intent.current = null;
    setPending(false);
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [ownerFingerprint, reviewedScope, taskId]);

  useEffect(() => {
    if (canEdit) return;
    active.current?.controller.abort();
    active.current = null;
    intent.current = null;
    setPending(false);
  }, [canEdit]);

  return {
    isPending: pending,
    async run(command: PersonalWorkDetailCommand) {
      if (!ownerFingerprint || !canEdit || active.current) throw abortError();
      const fingerprint = JSON.stringify([taskId, command]);
      if (intent.current?.fingerprint !== fingerprint) {
        intent.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
      }
      const idempotencyKey = mutationCoordinator
        ? mutationCoordinator.mutationKey(
            ownerFingerprint,
            `DETAIL:${fingerprint}`,
            intent.current.idempotencyKey
          )
        : intent.current.idempotencyKey;
      const run: PersonalWorkCommandRun = {
        command,
        ownerFingerprint,
        reviewedScope,
        controller: new AbortController(),
      };
      active.current = run;
      setPending(true);
      try {
        const result = await executePersonalWorkDetailCommand(
          taskId,
          command,
          idempotencyKey,
          {
            signal: run.controller.signal,
            canContinue: () => isCurrent(run),
            reviewedItem,
            preflight,
          },
          clients
        );
        if (!isCurrent(run)) throw abortError();
        mutationCoordinator?.acknowledgeMutation(ownerFingerprint, `DETAIL:${fingerprint}`);
        intent.current = null;
        await callbacks.current.onConfirmed(result, command);
      } catch (error) {
        if (isCurrent(run)) {
          await callbacks.current.onError(error, command);
          if (error instanceof HttpError && [401, 403, 404, 409].includes(error.status)) {
            mutationCoordinator?.acknowledgeMutation(ownerFingerprint, `DETAIL:${fingerprint}`);
            intent.current = null;
          }
        }
        throw error;
      } finally {
        if (active.current === run) {
          active.current = null;
          if (mounted.current) setPending(false);
        }
      }
    },
  };
}
