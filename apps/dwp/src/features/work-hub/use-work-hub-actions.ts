import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { WorkHubActionResult } from './work-hub-actions';
import type { createWorkHubController } from './work-hub-controller';
import type { WorkHubActionKind, WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';
import {
  canExecuteWorkHubAction,
  isMutatingWorkHubAction,
  isWorkHubSourceCommandReady,
  workHubCommandScope,
} from './work-hub-command-authority';
import { isPersonalWorkAction, type WorkHubOperationFeedback } from './work-hub-page-helpers';
import type { WorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

type WorkHubActionRun = {
  item: WorkHubItem;
  kind: WorkHubActionKind;
  owner: string;
  snapshot: WorkHubSnapshot;
  controller: AbortController;
};

/** Keeps every direct Work command bound to the owner that reviewed and started it. */
export function useWorkHubActions({
  owner,
  snapshot,
  controller,
  onFeedback,
  onHandoff,
  refresh,
  mutationCoordinator,
}: {
  owner: string | null;
  snapshot: WorkHubSnapshot | undefined;
  controller: ReturnType<typeof createWorkHubController>;
  onFeedback: (feedback: WorkHubOperationFeedback) => void;
  onHandoff: (item: WorkHubItem, route: string) => boolean;
  /** Returns the newly read aggregate snapshot; mutation dispatch never trusts cached rows. */
  refresh: () => Promise<WorkHubSnapshot | null>;
  mutationCoordinator?: WorkTaskSaveCoordinator;
}) {
  const { t } = useTranslation('work');
  const queryClient = useQueryClient();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const mounted = useRef(false);
  const active = useRef<WorkHubActionRun | null>(null);
  const actionKeys = useRef(new Map<string, string>());
  const isCurrent = (run: WorkHubActionRun) =>
    mounted.current &&
    ownerRef.current === run.owner &&
    active.current === run &&
    !run.controller.signal.aborted &&
    (!isMutatingWorkHubAction(run.kind) ||
      canExecuteWorkHubAction(snapshotRef.current, run.item, run.kind));

  useEffect(() => {
    mounted.current = true;
    active.current?.controller.abort();
    active.current = null;
    actionKeys.current.clear();
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [owner]);

  useEffect(() => {
    const run = active.current;
    if (
      run &&
      isMutatingWorkHubAction(run.kind) &&
      !canExecuteWorkHubAction(snapshot, run.item, run.kind)
    ) {
      run.controller.abort();
    }
  }, [snapshot]);

  const mutation = useMutation({
    mutationFn: async (run: WorkHubActionRun) => {
      const { item, kind } = run;
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      let verifiedSnapshot = run.snapshot;
      if (isMutatingWorkHubAction(kind)) {
        const refreshed = await refresh();
        if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
        if (!refreshed || !isWorkHubSourceCommandReady(refreshed, item.sourceId)) {
          return { state: 'UNAVAILABLE', retryable: true } as const;
        }
        if (!canExecuteWorkHubAction(refreshed, item, kind)) {
          return { state: 'CONFLICT', retryable: true } as const;
        }
        verifiedSnapshot = refreshed;
      }
      controller.adopt(verifiedSnapshot);
      controller.select(item.reference);
      const guard = { signal: run.controller.signal, canContinue: () => isCurrent(run) };
      if (isPersonalWorkAction(kind)) {
        const identity = `ACTION:${item.key}:${item.version}:${kind}`;
        const requestedKey = actionKeys.current.get(identity) ?? crypto.randomUUID();
        actionKeys.current.set(identity, requestedKey);
        const idempotencyKey = mutationCoordinator
          ? mutationCoordinator.mutationKey(run.owner, identity, requestedKey)
          : requestedKey;
        return controller.execute(
          {
            kind: kind as
              | 'PERSONAL_START'
              | 'PERSONAL_WAIT'
              | 'PERSONAL_COMPLETE'
              | 'PERSONAL_REOPEN'
              | 'PERSONAL_ARCHIVE',
            idempotencyKey,
          },
          guard
        );
      }
      if (kind === 'WORKSPACE_START' || kind === 'WORKSPACE_COMPLETE' || kind === 'OPEN_SOURCE')
        return controller.execute({ kind }, guard);
      throw new Error('unsupported direct action');
    },
    onSuccess: async (result: WorkHubActionResult, run) => {
      if (!isCurrent(run)) return;
      if (result.state === 'HANDED_OFF') {
        if (!onHandoff(run.item, result.route)) {
          onFeedback({
            severity: 'error',
            title: t('workHub.results.UNAVAILABLE.title'),
            detail: t('workHub.results.UNAVAILABLE.detail'),
          });
        }
        return;
      }
      const identity = `ACTION:${run.item.key}:${run.item.version}:${run.kind}`;
      if (result.state === 'CONFIRMED') {
        actionKeys.current.delete(identity);
        mutationCoordinator?.acknowledgeMutation(run.owner, identity);
        onFeedback({
          severity: 'success',
          title: t('workHub.results.confirmedTitle'),
          detail: t('workHub.results.confirmedDetail'),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
          queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
        ]);
        return;
      }
      if (result.state === 'CONFLICT' || result.state === 'FORBIDDEN') {
        actionKeys.current.delete(identity);
        mutationCoordinator?.acknowledgeMutation(run.owner, identity);
        await refresh();
      }
      if (!isCurrent(run)) return;
      onFeedback({
        severity: result.state === 'CONFLICT' ? 'warning' : 'error',
        title: t(`workHub.results.${result.state}.title`),
        detail: t(`workHub.results.${result.state}.detail`),
      });
    },
    onError: (_error, run) => {
      if (!isCurrent(run)) return;
      onFeedback({
        severity: 'error',
        title: t('workHub.results.UNAVAILABLE.title'),
        detail: t('workHub.results.UNAVAILABLE.detail'),
      });
    },
    onSettled: (_data, _error, run) => {
      if (active.current === run) active.current = null;
    },
  });

  return {
    pending: mutation.isPending,
    pendingKind: mutation.isPending ? (mutation.variables?.kind ?? null) : null,
    run(item: WorkHubItem, kind: WorkHubActionKind) {
      const currentOwner = ownerRef.current;
      const currentSnapshot = snapshotRef.current;
      const reviewedItem = currentSnapshot?.items.find(
        (candidate) => workHubCommandScope(candidate) === workHubCommandScope(item)
      );
      if (
        !currentOwner ||
        !currentSnapshot ||
        !reviewedItem ||
        active.current ||
        (isMutatingWorkHubAction(kind) &&
          !canExecuteWorkHubAction(currentSnapshot, reviewedItem, kind))
      )
        return false;
      const request = {
        item: reviewedItem,
        kind,
        owner: currentOwner,
        snapshot: currentSnapshot,
        controller: new AbortController(),
      };
      active.current = request;
      mutation.mutate(request);
      return true;
    },
  };
}
