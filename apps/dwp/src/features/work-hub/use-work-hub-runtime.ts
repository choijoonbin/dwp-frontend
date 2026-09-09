import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isAppPermissionEntitled,
  isAppReadEntitled,
} from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import type {
  WorkspaceWorkItem,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils/api/workspace-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { createWorkHubController } from './work-hub-controller';
import {
  workHubUrgency,
  type WorkHubItem,
  type WorkHubSnapshot,
  type WorkHubSourceId,
} from './work-hub-contracts';
import { workHubSummary } from './work-hub-model';
import { reconcileWorkHubRefresh } from './work-hub-refresh-policy';
import { useWorkHubOperationOwner } from './use-work-hub-operation-owner';
import { canExecuteWorkHubAction } from './work-hub-command-authority';
import { verifiedWorkHubSnapshotFromRefetch } from './work-hub-page-helpers';
import { loadWorkHub } from './work-hub-loader';
import { mergeWorkHubSourceRefresh } from './work-hub-source-refresh';

function queueItem(item: WorkHubItem, now: number): WorkspaceWorkItem {
  if (item.legacyItem) return item.legacyItem;
  return {
    workItemId: item.key,
    id: item.key,
    title: item.title,
    summary: item.summary,
    dataClassification: item.dataClassification,
    type:
      item.reference.sourceSystem === 'APPROVAL_TASK' ||
      item.reference.sourceSystem === 'APPROVAL_REQUEST'
        ? 'Approval'
        : item.reference.sourceSystem === 'SERVICE_REQUEST'
          ? 'Service'
          : 'Task',
    priority:
      item.priority === 'URGENT' || item.priority === 'HIGH'
        ? 'high'
        : item.priority === 'LOW'
          ? 'low'
          : 'medium',
    status:
      item.lifecycle === 'COMPLETED'
        ? 'completed'
        : item.lifecycle === 'CANCELLED'
          ? 'cancelled'
          : item.lifecycle === 'ARCHIVED'
            ? 'archived'
            : item.lifecycle === 'WAITING'
              ? 'waiting'
              : item.lifecycle === 'IN_PROGRESS'
                ? 'in-progress'
                : ['OVERDUE', 'DUE_SOON'].includes(workHubUrgency(item, now))
                  ? 'due-soon'
                  : 'open',
    owner: item.waitingFor,
    dueAt: item.dueAt,
    sourceSystem: item.reference.sourceSystem,
    sourceReference: item.reference.sourceReference,
    sourceRoute: item.sourceRoute,
    reason: item.reason,
    version: item.version,
    updatedAt: item.updatedAt ?? '',
  };
}

function queueSnapshot(
  snapshot: WorkHubSnapshot
): WorkspaceWorkQueue & { snapshot: WorkHubSnapshot } {
  const now = Date.now();
  const summary = workHubSummary(snapshot, now);
  const items = snapshot.items.map((item) => queueItem(item, now));
  const sourceTimes = snapshot.sources
    .filter((source) => source.state === 'READY')
    .map((source) => source.generatedAt ?? source.receivedAt)
    .filter((value): value is string => Boolean(value));
  const generatedAt =
    sourceTimes.sort((left, right) => Date.parse(left) - Date.parse(right))[0] ??
    snapshot.receivedAt;
  return {
    snapshot,
    items,
    generatedAt,
    summary: {
      total: items.length,
      completed: summary.completed,
      dueSoon: snapshot.items.filter((item) =>
        ['OVERDUE', 'DUE_SOON'].includes(workHubUrgency(item, now))
      ).length,
      inProgress: snapshot.items.filter((item) => item.lifecycle === 'IN_PROGRESS').length,
      waiting: summary.waiting,
    },
  };
}

/** Binds the canonical multi-source Work Hub owner to the responsive queue experience. */
export function useWorkHubRuntime() {
  const queryClient = useQueryClient();
  const owner = useWorkHubOperationOwner();
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const { user } = useAuth();
  const actorId = Number(user?.userId);
  const verifiedActorId = Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null;
  const { permissions } = usePermissions();
  const approvals = isAppReadEntitled('APP.APPROVALS', permissions);
  const services = isAppReadEntitled('APP.EMPLOYEE_SERVICES', permissions);
  const canUseCalendar = isAppReadEntitled('APP.CALENDAR', permissions);
  const canCreateCalendarEvent = isAppPermissionEntitled('APP.CALENDAR', 'CREATE', permissions);
  const canUseAssist = isAppReadEntitled('APP.ASK', permissions);
  const canUpdatePersonal = isAppPermissionEntitled('APP.WORK', 'UPDATE', permissions);
  const commandKeys = useMemo(() => ({ owner, keys: new Map<string, string>() }), [owner]);
  const lastUsable = useRef<{
    owner: ReturnType<typeof createWorkHubController>;
    snapshot: WorkHubSnapshot;
  } | null>(null);
  const sources = useMemo<WorkHubSourceId[]>(
    () => [
      'workspace',
      ...(verifiedActorId ? (['work-assignments'] as const) : []),
      'personal',
      ...(approvals
        ? (['approval-inbox', 'approval-completed', 'approval-needs-info'] as const)
        : []),
      ...(services ? (['services'] as const) : []),
    ],
    [approvals, services, verifiedActorId]
  );
  const controller = useMemo(
    () => ({
      owner,
      value: createWorkHubController(sources, undefined, {
        canUpdatePersonal,
        actorId: verifiedActorId,
      }),
    }),
    [sources, canUpdatePersonal, owner, verifiedActorId]
  );
  const scopedController = controller.value;
  const sourceRead = useRef<object | null>(null);
  const [sourceRefresh, setSourceRefresh] = useState<{
    owner: typeof scopedController;
    sourceId: WorkHubSourceId;
  } | null>(null);
  useEffect(
    () => () => {
      sourceRead.current = null;
    },
    [scopedController]
  );
  const queryKey = ['workspace', 'work-hub', 'queue', owner, sources, canUpdatePersonal];
  const query = useQuery({
    queryKey,
    enabled: owner !== null,
    queryFn: async ({ signal }) => {
      signal.throwIfAborted();
      const refreshed = await scopedController.refresh();
      signal.throwIfAborted();
      if (ownerRef.current !== owner) throw new DOMException('Work owner changed', 'AbortError');
      // An aggregate outage is still a useful, verified snapshot: callers need its
      // per-source receipts to explain the outage and offer scoped retries.
      const previous =
        lastUsable.current?.owner === scopedController ? lastUsable.current.snapshot : null;
      const snapshot = reconcileWorkHubRefresh(refreshed, previous);
      // A denial/missing-source response also replaces the retained snapshot. Otherwise a later
      // 503 could resurrect rows that the preceding successful authorization check removed.
      lastUsable.current = { owner: scopedController, snapshot };
      return queueSnapshot(snapshot);
    },
    staleTime: 30_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const canonical = (item: WorkspaceWorkItem) =>
    query.data?.snapshot.items.find((candidate) => {
      const reviewed = queueItem(candidate, Date.now());
      return (
        reviewed.workItemId === item.workItemId &&
        reviewed.version === item.version &&
        reviewed.sourceSystem === item.sourceSystem &&
        reviewed.sourceReference === item.sourceReference
      );
    });
  return {
    owner,
    query,
    controller: scopedController,
    canUpdatePersonal,
    canUseCalendar,
    canCreateCalendarEvent,
    canUseAssist,
    enabledSources: sources,
    sourceRefreshing: sourceRefresh?.owner === scopedController ? sourceRefresh.sourceId : null,
    async refreshSource(sourceId: WorkHubSourceId) {
      if (!owner || ownerRef.current !== owner || !sources.includes(sourceId) || sourceRead.current)
        return;
      const before = queryClient.getQueryState(queryKey);
      const cached = queryClient.getQueryData<ReturnType<typeof queueSnapshot>>(queryKey);
      if (!cached || !before || before.fetchStatus !== 'idle' || before.isInvalidated) return;
      const run = {};
      sourceRead.current = run;
      setSourceRefresh({ owner: scopedController, sourceId });
      try {
        const refreshed = await loadWorkHub({
          enabledSources: [sourceId],
          canUpdatePersonal,
          actorId: verifiedActorId,
        });
        if (sourceRead.current !== run || ownerRef.current !== owner) return;
        const current = queryClient.getQueryState(queryKey);
        // A complete refresh, permission transition or command invalidation takes precedence.
        if (
          !current ||
          current.dataUpdatedAt !== before.dataUpdatedAt ||
          current.fetchStatus !== 'idle' ||
          current.isInvalidated
        )
          return;
        queryClient.setQueryData<ReturnType<typeof queueSnapshot>>(queryKey, (latest) => {
          if (latest !== cached) return latest;
          const snapshot = mergeWorkHubSourceRefresh(cached.snapshot, refreshed, sourceId);
          if (!snapshot) return latest;
          lastUsable.current = { owner: scopedController, snapshot };
          scopedController.adopt(snapshot);
          return queueSnapshot(snapshot);
        });
      } finally {
        if (sourceRead.current === run) {
          sourceRead.current = null;
          setSourceRefresh(null);
        }
      }
    },
    resolveRequested(params: URLSearchParams) {
      const key = params.get('work');
      const taskId = params.get('personalTaskId');
      if (!key && !taskId) return params.get('item') ?? '';
      const item = query.data?.snapshot.items.find((candidate) =>
        key
          ? candidate.key === key
          : candidate.reference.sourceSystem === 'PERSONAL_TASK' &&
            candidate.reference.sourceReference === taskId
      );
      return item?.legacyItem
        ? item.legacyItem.type === 'Review'
          ? (item.legacyItem.sourceReference ?? key ?? taskId!)
          : item.legacyItem.id
        : (item?.key ?? key ?? taskId!);
    },
    canStatus(item: WorkspaceWorkItem, target: 'IN_PROGRESS' | 'COMPLETED') {
      const work = canonical(item);
      const kind =
        work?.reference.sourceSystem === 'PERSONAL_TASK'
          ? target === 'IN_PROGRESS'
            ? 'PERSONAL_START'
            : 'PERSONAL_COMPLETE'
          : target === 'IN_PROGRESS'
            ? 'WORKSPACE_START'
            : 'WORKSPACE_COMPLETE';
      return work ? canExecuteWorkHubAction(query.data?.snapshot, work, kind) : false;
    },
    async changeStatus(item: WorkspaceWorkItem, target: 'IN_PROGRESS' | 'COMPLETED') {
      const reviewed = canonical(item);
      if (!reviewed) throw new HttpError('Work is unavailable', 404);
      if (ownerRef.current !== owner || !owner)
        throw new DOMException('Work owner changed', 'AbortError');
      const kind =
        reviewed.reference.sourceSystem === 'PERSONAL_TASK'
          ? target === 'IN_PROGRESS'
            ? 'PERSONAL_START'
            : 'PERSONAL_COMPLETE'
          : target === 'IN_PROGRESS'
            ? 'WORKSPACE_START'
            : 'WORKSPACE_COMPLETE';
      const preflight = await query.refetch();
      if (ownerRef.current !== owner || !owner)
        throw new DOMException('Work owner changed', 'AbortError');
      const freshSnapshot = verifiedWorkHubSnapshotFromRefetch(preflight);
      if (!freshSnapshot || freshSnapshot.completeness === 'UNAVAILABLE')
        throw new HttpError('Work source is unavailable', 503);
      const work = freshSnapshot.items.find((candidate) => candidate.key === reviewed.key);
      if (!work || !canExecuteWorkHubAction(freshSnapshot, reviewed, kind))
        throw new HttpError('Work changed after review', 409);
      scopedController.adopt(freshSnapshot);
      scopedController.select(work.reference);
      const commandIdentity = `${work.key}:${work.version}:${kind}`;
      const idempotencyKey = commandKeys.keys.get(commandIdentity) ?? crypto.randomUUID();
      commandKeys.keys.set(commandIdentity, idempotencyKey);
      const result = await scopedController.execute(
        kind === 'PERSONAL_START' || kind === 'PERSONAL_COMPLETE'
          ? { kind, idempotencyKey }
          : { kind },
        { canContinue: () => ownerRef.current === owner && owner !== null }
      );
      if (ownerRef.current !== owner) throw new DOMException('Work owner changed', 'AbortError');
      if (result.state !== 'CONFIRMED')
        throw new HttpError(
          'Work transition was not confirmed',
          result.state === 'CONFLICT' ? 409 : result.state === 'FORBIDDEN' ? 403 : 503
        );
      commandKeys.keys.delete(commandIdentity);
      const refreshedQuery = await query.refetch();
      if (ownerRef.current !== owner) throw new DOMException('Work owner changed', 'AbortError');
      const refreshed = verifiedWorkHubSnapshotFromRefetch(refreshedQuery)?.items.find(
        (candidate) => candidate.key === work.key && candidate.version >= result.version
      );
      // A failed follow-up read cannot turn an owner-confirmed command into a failed mutation.
      // The query refresh will separately show the unavailable source and remove its rows.
      return refreshed ? queueItem(refreshed, Date.now()) : { ...item, version: result.version };
    },
  };
}
