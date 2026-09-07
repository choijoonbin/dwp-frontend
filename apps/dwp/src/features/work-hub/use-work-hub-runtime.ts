import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
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
  const { permissions } = usePermissions();
  const approvals = isAppReadEntitled('APP.APPROVALS', permissions);
  const services = isAppReadEntitled('APP.SERVICES', permissions);
  const canUseCalendar = isAppReadEntitled('APP.CALENDAR', permissions);
  const canUseAssist = isAppReadEntitled('APP.ASK', permissions);
  const updatePermissions = permissions.filter(
    (permission) =>
      permission.resourceType === 'APP' &&
      permission.resourceKey === 'APP.WORK' &&
      permission.permissionCode === 'UPDATE'
  );
  const canUpdatePersonal =
    updatePermissions.some((permission) => permission.effect === 'ALLOW') &&
    !updatePermissions.some((permission) => permission.effect === 'DENY');
  const commandKeys = useRef(new Map<string, string>());
  const lastUsable = useRef<{
    owner: ReturnType<typeof createWorkHubController>;
    snapshot: WorkHubSnapshot;
  } | null>(null);
  const sources = useMemo<WorkHubSourceId[]>(
    () => [
      'workspace',
      'personal',
      ...(approvals
        ? (['approval-inbox', 'approval-completed', 'approval-needs-info'] as const)
        : []),
      ...(services ? (['services'] as const) : []),
    ],
    [approvals, services]
  );
  const controller = useMemo(
    () => createWorkHubController(sources, undefined, { canUpdatePersonal }),
    [sources, canUpdatePersonal]
  );
  const query = useQuery({
    queryKey: ['workspace', 'work-hub', sources, canUpdatePersonal],
    queryFn: async () => {
      const refreshed = await controller.refresh();
      // An aggregate outage is still a useful, verified snapshot: callers need its
      // per-source receipts to explain the outage and offer scoped retries.
      const previous =
        lastUsable.current?.owner === controller ? lastUsable.current.snapshot : null;
      const snapshot = reconcileWorkHubRefresh(refreshed, previous);
      if (refreshed.completeness !== 'UNAVAILABLE') {
        lastUsable.current = { owner: controller, snapshot: refreshed };
      }
      return queueSnapshot(snapshot);
    },
    staleTime: 30_000,
    retry: 1,
    meta: { accessSensitive: true },
  });
  const canonical = (item: WorkspaceWorkItem) =>
    query.data?.snapshot.items.find(
      (candidate) => (candidate.legacyItem?.workItemId ?? candidate.key) === item.workItemId
    );
  return {
    query,
    controller,
    canUpdatePersonal,
    canUseCalendar,
    canUseAssist,
    enabledSources: sources,
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
      return (
        work?.actions.some(
          (action) => action.kind === kind && action.availability === 'AVAILABLE'
        ) ?? false
      );
    },
    async changeStatus(item: WorkspaceWorkItem, target: 'IN_PROGRESS' | 'COMPLETED') {
      const work = canonical(item);
      if (!work) throw new HttpError('Work is unavailable', 404);
      if (query.data) controller.adopt(query.data.snapshot);
      controller.select(work.reference);
      const kind =
        work.reference.sourceSystem === 'PERSONAL_TASK'
          ? target === 'IN_PROGRESS'
            ? 'PERSONAL_START'
            : 'PERSONAL_COMPLETE'
          : target === 'IN_PROGRESS'
            ? 'WORKSPACE_START'
            : 'WORKSPACE_COMPLETE';
      const commandIdentity = `${work.key}:${work.version}:${kind}`;
      const idempotencyKey = commandKeys.current.get(commandIdentity) ?? crypto.randomUUID();
      commandKeys.current.set(commandIdentity, idempotencyKey);
      const result = await controller.execute(
        kind === 'PERSONAL_START' || kind === 'PERSONAL_COMPLETE'
          ? { kind, idempotencyKey }
          : { kind }
      );
      if (result.state !== 'CONFIRMED')
        throw new HttpError(
          'Work transition was not confirmed',
          result.state === 'CONFLICT' ? 409 : result.state === 'FORBIDDEN' ? 403 : 503
        );
      commandKeys.current.delete(commandIdentity);
      const refreshed = controller
        .state()
        .snapshot?.items.find((candidate) => candidate.key === work.key);
      // A failed follow-up read cannot turn an owner-confirmed command into a failed mutation.
      // The query refresh will separately show the unavailable source and remove its rows.
      return refreshed ? queueItem(refreshed, Date.now()) : { ...item, version: result.version };
    },
  };
}
