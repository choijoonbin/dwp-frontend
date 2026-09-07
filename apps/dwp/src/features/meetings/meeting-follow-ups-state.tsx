import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  getWorkAssignment,
  getWorkAssignmentCommand,
  transitionWorkAssignment,
} from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type {
  WorkAssignmentCommandReceipt,
  WorkAssignmentTask,
  WorkAssignmentTransition,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import {
  availableFollowUpActions,
  checkedFollowUpReceipt,
  checkedFollowUpTask,
  FOLLOW_UP_REASON_CODES,
  type FollowUpAttempt,
} from './meeting-follow-ups-model';

export function followUpAccessDenied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

export function useFollowUpDetail({
  assignmentId,
  actorId,
  scopeKey,
  onAccessDenied,
  onChanged,
}: {
  assignmentId: string;
  actorId: number;
  scopeKey: string;
  onAccessDenied: () => void;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const mounted = useRef(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const floor = useRef(0);
  const sourceReadGeneration = useRef(0);
  const attempt = useRef<FollowUpAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [receipt, setReceipt] = useState<WorkAssignmentCommandReceipt | null>(null);
  const queryKey = ['meetings', 'follow-ups', scopeKey, 'detail', assignmentId] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      sourceReadGeneration.current += 1;
      const task = checkedFollowUpTask(
        await getWorkAssignment(assignmentId),
        actorId,
        assignmentId
      );
      if (task.version < floor.current) throw new Error('Stale Work task version');
      floor.current = task.version;
      return task;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      attempt.current = null;
      client.removeQueries({
        queryKey: ['meetings', 'follow-ups', scopeKey, 'detail', assignmentId],
      });
    };
  }, [client, scopeKey, assignmentId]);
  useEffect(() => {
    if (!followUpAccessDenied(query.error)) return;
    generation.current += 1;
    attempt.current = null;
    setReceipt(null);
    onAccessDenied();
  }, [query.error, onAccessDenied]);

  const run = async (issued: FollowUpAttempt, recover: boolean) => {
    if (pending.current || query.isError || followUpAccessDenied(query.error)) return;
    pending.current = true;
    setBusy(true);
    const current = generation.current;
    const observedSourceRead = sourceReadGeneration.current;
    const active = () =>
      mounted.current &&
      generation.current === current &&
      !followUpAccessDenied(client.getQueryState(queryKey)?.error);
    try {
      const result = recover
        ? await getWorkAssignmentCommand(issued.commandId)
        : await transitionWorkAssignment(
            issued.assignmentId,
            issued.action,
            issued.input,
            issued.commandId
          );
      if (!active()) return;
      const task = checkedFollowUpReceipt(result, issued, actorId);
      const cached = client.getQueryData<WorkAssignmentTask>(queryKey);
      const minimum = Math.max(floor.current, cached?.version ?? 0);
      const sourceRechecked = observedSourceRead !== sourceReadGeneration.current;
      if (task.version < minimum) {
        // A valid historical receipt must not rewind a newer authorized view.
        await query.refetch();
        if (!active()) return;
      } else {
        floor.current = task.version;
        // Work versions do not order source ACL changes. Never resurrect a source from
        // an older in-flight mutation after a more recent source inspection started.
        client.setQueryData(
          queryKey,
          sourceRechecked
            ? {
                ...task,
                source: {
                  availability: 'UNAVAILABLE',
                  reference: null,
                  sourceVersion: null,
                  sourceRoute: null,
                },
              }
            : task
        );
        if (sourceRechecked) {
          await query.refetch();
          if (!active()) return;
        }
      }
      attempt.current = null;
      setUncertain(false);
      setReceipt(result.receipt);
      onChanged();
    } catch (error) {
      if (!active()) return;
      if (
        followUpAccessDenied(error) &&
        !(recover && error instanceof HttpError && error.status === 404)
      ) {
        generation.current += 1;
        attempt.current = null;
        setReceipt(null);
        onAccessDenied();
      } else if (!recover && error instanceof HttpError && error.status === 409) {
        attempt.current = null;
        setUncertain(false);
        setConflict(true);
        await query.refetch();
      } else {
        // A missing receipt is not proof that an uncertain command did not commit.
        setUncertain(true);
      }
    } finally {
      if (mounted.current && current === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const execute = (action: WorkAssignmentTransition, reasonCode?: string) => {
    const task = query.data;
    if (!task || query.isError || conflict || uncertain || pending.current || attempt.current)
      return;
    if (!availableFollowUpActions(task).includes(action)) return;
    if (
      (action === 'decline' || action === 'cancel') &&
      !(FOLLOW_UP_REASON_CODES[action] as readonly string[]).includes(reasonCode ?? '')
    )
      return;
    const issued: FollowUpAttempt = {
      commandId: crypto.randomUUID(),
      assignmentId,
      action,
      input: {
        version: task.version,
        assignmentRevision: task.assignmentRevision,
        ...(reasonCode ? { reasonCode } : {}),
      },
    };
    attempt.current = issued;
    setReceipt(null);
    void run(issued, false);
  };
  return {
    query,
    busy,
    uncertain,
    conflict,
    receipt,
    execute,
    reviewConflict: () => {
      if (!query.isError && !query.isFetching && query.data) setConflict(false);
    },
    recover: () => {
      if (attempt.current) void run(attempt.current, true);
    },
    retry: () => {
      if (attempt.current) void run(attempt.current, false);
    },
  };
}
