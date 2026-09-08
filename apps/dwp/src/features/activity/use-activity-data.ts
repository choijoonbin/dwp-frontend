import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getActivityPage,
  getActivityEvent,
  getActivityExecutionSummary,
  getDwaionUserRun,
  getWorkspaceActivityAuditEvidence,
  getWorkspaceActivityEventEvidence,
  getWorkspaceActivitySourceStatuses,
  HttpError,
  useAuth,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import type { WorkspaceActivityFilters } from '@dwp-frontend/shared-utils';

import { activityQueryKeys, validActivityTimeRange } from './activity-model';

function retryActivity(failureCount: number, error: Error) {
  return (
    !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && failureCount < 1
  );
}

export function useActivityData(filters: WorkspaceActivityFilters, eventId = '') {
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const enabled =
    isAuthenticated && Boolean(user) && isLoaded && hasPermission('APP.ACTIVITY', 'VIEW');
  const canLoadAgentEvidence = enabled && hasPermission('APP.ASK', 'VIEW');
  // Disabled observers retain cached data, so access state must also partition the cache
  // while the surrounding route guard is being re-evaluated after permission loss.
  const identity = [
    user?.tenantId ?? '',
    user?.userId ?? '',
    enabled,
    isLoaded && hasPermission('APP.ASK', 'VIEW'),
  ].join(':');
  const validRange = validActivityTimeRange(filters);
  const requireAccess = () => {
    // React Query's imperative refetch bypasses `enabled`. Keep retry/refresh safe too.
    if (!enabled) throw new HttpError('Activity access is unavailable.', 403);
  };
  const options = {
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: retryActivity,
    meta: { accessSensitive: true },
  };
  const feed = useQuery({
    ...options,
    enabled: enabled && validRange,
    queryKey: activityQueryKeys.feed(identity, filters),
    queryFn: ({ signal }) => {
      requireAccess();
      if (!validRange) throw new HttpError('Invalid activity time range.', 400);
      return getActivityPage(filters, signal);
    },
  });
  const summary = useQuery({
    ...options,
    queryKey: activityQueryKeys.summary(identity),
    queryFn: ({ signal }) => {
      requireAccess();
      return getActivityExecutionSummary(signal);
    },
  });
  const detail = useQuery({
    ...options,
    enabled: enabled && Boolean(eventId),
    queryKey: activityQueryKeys.detail(identity, eventId),
    queryFn: ({ signal }) => {
      requireAccess();
      if (!eventId) throw new HttpError('Activity event is unavailable.', 404);
      return getActivityEvent(eventId, signal);
    },
  });
  const selectedEvent = detail.isError ? undefined : detail.data;
  const candidateExecutionId =
    selectedEvent?.source === 'DWAI_ON' ? (selectedEvent.executionId ?? '') : '';
  const agentExecutionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    candidateExecutionId
  )
    ? candidateExecutionId
    : '';
  const executionRun = useQuery({
    ...options,
    enabled: canLoadAgentEvidence && Boolean(agentExecutionId),
    queryKey: [...activityQueryKeys.detail(identity, eventId), 'run', agentExecutionId],
    queryFn: ({ signal }) => {
      requireAccess();
      if (!canLoadAgentEvidence) throw new HttpError('Agent evidence access is unavailable.', 403);
      return getDwaionUserRun(agentExecutionId, signal);
    },
  });
  const evidenceTarget = selectedEvent
    ? selectedEvent.source === 'DWAI_ON'
      ? selectedEvent.auditRecordId
      : selectedEvent.id
    : null;
  const canLoadEvidence =
    enabled &&
    Boolean(evidenceTarget) &&
    (selectedEvent?.source !== 'DWAI_ON' || canLoadAgentEvidence);
  const evidence = useQuery({
    ...options,
    enabled: canLoadEvidence,
    queryKey: [...activityQueryKeys.detail(identity, eventId), 'evidence', evidenceTarget],
    queryFn: ({ signal }) => {
      requireAccess();
      if (!selectedEvent || !evidenceTarget) {
        throw new HttpError('Activity evidence is unavailable.', 404);
      }
      if (selectedEvent.source === 'DWAI_ON' && !canLoadAgentEvidence) {
        throw new HttpError('Agent evidence access is unavailable.', 403);
      }
      return selectedEvent.source === 'DWAI_ON'
        ? getWorkspaceActivityAuditEvidence(evidenceTarget, agentExecutionId, signal)
        : getWorkspaceActivityEventEvidence(evidenceTarget, signal);
    },
  });
  const sources = useQuery({
    ...options,
    queryKey: activityQueryKeys.sources(identity),
    queryFn: ({ signal }) => {
      requireAccess();
      return getWorkspaceActivitySourceStatuses(signal);
    },
  });
  // Repaint freshness when polling is paused/offline; an old success must not stay "live".
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = async () => {
    if (!enabled) return;
    await Promise.all([
      ...(validRange ? [feed.refetch()] : []),
      summary.refetch(),
      sources.refetch(),
      ...(eventId ? [detail.refetch()] : []),
      ...(agentExecutionId && canLoadAgentEvidence ? [executionRun.refetch()] : []),
      ...(canLoadEvidence ? [evidence.refetch()] : []),
    ]);
  };
  return { feed, summary, detail, executionRun, evidence, sources, now, refresh };
}
