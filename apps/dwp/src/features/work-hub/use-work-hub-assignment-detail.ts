import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  getWorkAssignment,
  getWorkAssignmentCommand,
  transitionWorkAssignment,
} from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type {
  WorkAssignmentCommandReceipt,
  WorkAssignmentTask,
  WorkAssignmentTransition,
  WorkAssignmentVersionCommand,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import {
  availableWorkAssignmentActions,
  checkedWorkAssignmentMutation,
  checkedWorkAssignmentTask,
  sameReviewedWorkAssignment,
  WORK_ASSIGNMENT_REASON_CODES,
} from './work-hub-assignment-model';
import type { WorkHubItem } from './work-hub-contracts';

type AssignmentAttempt = {
  commandId: string;
  action: WorkAssignmentTransition;
  input: WorkAssignmentVersionCommand;
  reviewed: WorkAssignmentTask;
};

export type WorkAssignmentOutcome = {
  receipt: WorkAssignmentCommandReceipt;
  currentAdvanced: boolean;
};

export function workAssignmentAccessDenied(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function withoutAssignmentSource(task: WorkAssignmentTask): WorkAssignmentTask {
  return {
    ...task,
    source: {
      availability: 'UNAVAILABLE',
      reference: null,
      sourceVersion: null,
      sourceRoute: null,
    },
    capabilities: { ...task.capabilities, canReassign: false },
  };
}

export function useWorkHubAssignmentDetail({
  item,
  actorId,
  commandsEnabled,
  onAccessDenied,
  onChanged,
}: {
  item: WorkHubItem;
  actorId: number;
  commandsEnabled: boolean;
  onAccessDenied: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const owner = useWorkHubOperationOwner();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const callbacks = useRef({ onAccessDenied, onChanged });
  callbacks.current = { onAccessDenied, onChanged };
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const attempt = useRef<AssignmentAttempt | null>(null);
  const assignmentId = item.reference.sourceReference;
  const detailIdentity = `${owner ?? ''}:${assignmentId}`;
  const versionFloor = useRef({ identity: detailIdentity, value: item.version });
  if (versionFloor.current.identity !== detailIdentity) {
    versionFloor.current = { identity: detailIdentity, value: item.version };
  } else {
    versionFloor.current.value = Math.max(versionFloor.current.value, item.version);
  }
  const sourceReadGeneration = useRef(0);
  const [sourceTrusted, setSourceTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [outcome, setOutcome] = useState<WorkAssignmentOutcome | null>(null);
  const queryPrefix = ['work-hub', 'work-assignment-detail', owner, assignmentId] as const;
  const queryKey = [...queryPrefix, item.version] as const;
  const query = useQuery({
    queryKey,
    enabled:
      owner !== null &&
      Number.isSafeInteger(actorId) &&
      actorId > 0 &&
      item.reference.sourceSystem === 'WORK_ASSIGNMENT',
    queryFn: async ({ signal }) => {
      sourceReadGeneration.current += 1;
      setSourceTrusted(false);
      const task = checkedWorkAssignmentTask(
        await getWorkAssignment(assignmentId, signal),
        actorId,
        assignmentId,
        'DETAIL'
      );
      signal.throwIfAborted();
      if (task.version < versionFloor.current.value)
        throw new Error('Stale Work assignment detail');
      versionFloor.current.value = task.version;
      setSourceTrusted(true);
      return task;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    meta: { accessSensitive: true, ownerFingerprint: owner },
  });

  useEffect(() => {
    generation.current += 1;
    active.current?.abort();
    active.current = null;
    pending.current = false;
    attempt.current = null;
    sourceReadGeneration.current = 0;
    setSourceTrusted(false);
    setBusy(false);
    setConflict(false);
    setUncertain(false);
    setOutcome(null);
    return () => {
      generation.current += 1;
      active.current?.abort();
      active.current = null;
      attempt.current = null;
      queryClient.removeQueries({ queryKey: queryPrefix });
    };
    // queryKey primitives define the complete security and task owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, assignmentId, queryClient]);

  useEffect(() => {
    if (!workAssignmentAccessDenied(query.error)) return;
    generation.current += 1;
    active.current?.abort();
    active.current = null;
    attempt.current = null;
    pending.current = false;
    setBusy(false);
    setConflict(false);
    setUncertain(false);
    setOutcome(null);
    setSourceTrusted(false);
    queryClient.removeQueries({
      queryKey: ['work-hub', 'work-assignment-detail', owner, assignmentId],
    });
    callbacks.current.onAccessDenied();
  }, [assignmentId, owner, query.error, queryClient]);

  const run = async (issued: AssignmentAttempt, mode: 'command' | 'recover') => {
    if (
      !owner ||
      ownerRef.current !== owner ||
      pending.current ||
      (mode === 'command' && (!commandsEnabled || query.isError))
    )
      return;
    const controller = new AbortController();
    active.current = controller;
    pending.current = true;
    setBusy(true);
    const currentGeneration = generation.current;
    const observedSourceRead = sourceReadGeneration.current;
    const current = () =>
      generation.current === currentGeneration &&
      active.current === controller &&
      ownerRef.current === owner &&
      !controller.signal.aborted;
    try {
      let result;
      if (mode === 'recover') {
        result = await getWorkAssignmentCommand(issued.commandId, controller.signal);
      } else {
        const preflight = checkedWorkAssignmentTask(
          await getWorkAssignment(assignmentId, controller.signal),
          actorId,
          assignmentId,
          'DETAIL'
        );
        if (!current()) return;
        queryClient.setQueryData(queryKey, preflight);
        versionFloor.current.value = Math.max(versionFloor.current.value, preflight.version);
        if (
          !sameReviewedWorkAssignment(preflight, issued.reviewed) ||
          !availableWorkAssignmentActions(preflight).includes(issued.action)
        ) {
          attempt.current = null;
          setUncertain(false);
          setOutcome(null);
          setConflict(true);
          callbacks.current.onChanged();
          return;
        }
        result = await transitionWorkAssignment(
          assignmentId,
          issued.action,
          issued.input,
          issued.commandId,
          controller.signal
        );
      }
      if (!current()) return;
      const task = checkedWorkAssignmentMutation(
        result,
        issued.reviewed,
        issued.action,
        issued.commandId,
        actorId
      );
      const sourceRechecked = sourceReadGeneration.current !== observedSourceRead;
      setSourceTrusted(!sourceRechecked);
      const publishable = sourceRechecked ? withoutAssignmentSource(task) : task;
      const cached = queryClient.getQueryData<WorkAssignmentTask>(queryKey);
      if (!cached || publishable.version >= cached.version) {
        queryClient.setQueryData(queryKey, publishable);
        versionFloor.current.value = Math.max(versionFloor.current.value, publishable.version);
      }
      let refreshed: Awaited<ReturnType<typeof query.refetch>> | null = null;
      if (sourceRechecked) {
        refreshed = await query.refetch();
        if (!current()) return;
        if (refreshed.isError && workAssignmentAccessDenied(refreshed.error)) {
          generation.current += 1;
          controller.abort();
          active.current = null;
          attempt.current = null;
          pending.current = false;
          setBusy(false);
          setConflict(false);
          setUncertain(false);
          setOutcome(null);
          setSourceTrusted(false);
          queryClient.removeQueries({ queryKey: queryPrefix });
          callbacks.current.onAccessDenied();
          return;
        }
      }
      attempt.current = null;
      setConflict(false);
      setUncertain(false);
      setOutcome({
        receipt: result.receipt,
        currentAdvanced:
          Math.max(task.version, cached?.version ?? 0, refreshed?.data?.version ?? 0) >
          result.receipt.appliedVersion,
      });
      callbacks.current.onChanged();
    } catch (error) {
      if (!current()) return;
      if (mode === 'recover' && error instanceof HttpError && error.status === 404) {
        const latest = await query.refetch();
        if (!current()) return;
        if (latest.isError && workAssignmentAccessDenied(latest.error)) {
          generation.current += 1;
          controller.abort();
          active.current = null;
          attempt.current = null;
          pending.current = false;
          setBusy(false);
          setConflict(false);
          setUncertain(false);
          setOutcome(null);
          setSourceTrusted(false);
          queryClient.removeQueries({ queryKey: queryPrefix });
          callbacks.current.onAccessDenied();
          return;
        }
        setUncertain(true);
        return;
      }
      if (workAssignmentAccessDenied(error)) {
        generation.current += 1;
        controller.abort();
        active.current = null;
        attempt.current = null;
        pending.current = false;
        setBusy(false);
        setConflict(false);
        setUncertain(false);
        setOutcome(null);
        setSourceTrusted(false);
        queryClient.removeQueries({ queryKey: queryPrefix });
        callbacks.current.onAccessDenied();
        return;
      }
      if (mode === 'command' && error instanceof HttpError && error.status === 409) {
        attempt.current = null;
        setUncertain(false);
        setOutcome(null);
        setConflict(true);
        const latest = await query.refetch();
        if (!current()) return;
        if (latest.isError && workAssignmentAccessDenied(latest.error)) {
          generation.current += 1;
          controller.abort();
          active.current = null;
          pending.current = false;
          setBusy(false);
          setConflict(false);
          setUncertain(false);
          setOutcome(null);
          setSourceTrusted(false);
          queryClient.removeQueries({ queryKey: queryPrefix });
          callbacks.current.onAccessDenied();
          return;
        }
        callbacks.current.onChanged();
        return;
      }
      setUncertain(true);
    } finally {
      if (active.current === controller) {
        active.current = null;
        pending.current = false;
        setBusy(false);
      }
    }
  };

  const recoveryTask =
    uncertain && attempt.current ? withoutAssignmentSource(attempt.current.reviewed) : undefined;
  const task = query.data
    ? !sourceTrusted || query.isFetching || query.isRefetchError
      ? withoutAssignmentSource(query.data)
      : query.data
    : recoveryTask;

  return {
    query,
    task,
    busy,
    conflict,
    uncertain,
    outcome,
    execute(action: WorkAssignmentTransition, reasonCode?: string) {
      const reviewed = query.data;
      if (
        !commandsEnabled ||
        !reviewed ||
        query.isError ||
        query.isFetching ||
        conflict ||
        uncertain ||
        pending.current ||
        attempt.current ||
        !availableWorkAssignmentActions(reviewed).includes(action)
      )
        return false;
      if (
        (action === 'decline' || action === 'cancel') &&
        !(WORK_ASSIGNMENT_REASON_CODES[action] as readonly string[]).includes(reasonCode ?? '')
      )
        return false;
      const issued: AssignmentAttempt = {
        commandId: crypto.randomUUID(),
        action,
        reviewed,
        input: {
          version: reviewed.version,
          assignmentRevision: reviewed.assignmentRevision,
          ...(reasonCode ? { reasonCode } : {}),
        },
      };
      attempt.current = issued;
      setOutcome(null);
      void run(issued, 'command');
      return true;
    },
    reviewConflict() {
      if (query.data && !query.isError && !query.isFetching) setConflict(false);
    },
    recover() {
      const issued = attempt.current;
      if (issued) void run(issued, 'recover');
    },
    retry() {
      const issued = attempt.current;
      if (issued && commandsEnabled && !query.isError && !query.isFetching)
        void run(issued, 'command');
    },
    canRecover: Boolean(attempt.current) && !busy,
    canRetry:
      Boolean(attempt.current) && commandsEnabled && !query.isError && !query.isFetching && !busy,
  };
}
