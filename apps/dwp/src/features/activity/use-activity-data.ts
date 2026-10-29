import { useEffect, useState } from 'react';
import { useQuery, type QueryObserverOptions } from '@tanstack/react-query';
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
import type {
  DwaionUserRun,
  WorkspaceActivityEvidence,
  WorkspaceActivityFilters,
} from '@dwp-frontend/shared-utils';

import {
  ACTIVITY_RUNNING_REFRESH_INTERVAL_MS,
  activityDetailRefetchOnWindowFocus,
  activityDetailRefreshInterval,
  activityDetailStaleTime,
  isAuthoritativeActivityRootDenial,
  usableActivityQueryData,
} from '../../components/activity/activity-query-contract';
import { activityQueryKeys, validActivityTimeRange } from './activity-model';

function retryActivity(failureCount: number, error: Error) {
  return (
    !(error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) && failureCount < 1
  );
}

export const ACTIVITY_FEED_REFRESH_INTERVAL_MS = 60_000;
export const ACTIVITY_SOURCE_REFRESH_INTERVAL_MS = 5 * 60_000;

type ActivityEvidenceObserverPolicy = Pick<
  QueryObserverOptions<WorkspaceActivityEvidence>,
  'staleTime' | 'retry' | 'refetchInterval' | 'refetchOnWindowFocus'
>;

export const activityEvidenceObserverPolicy = {
  staleTime: Infinity,
  retry: false,
  refetchInterval: false,
  refetchOnWindowFocus: false,
} as const satisfies ActivityEvidenceObserverPolicy;

export function activityRunRefreshInterval(
  run: Pick<DwaionUserRun, 'runState'> | undefined
): number | false {
  return run?.runState === 'RUNNING' ? ACTIVITY_RUNNING_REFRESH_INTERVAL_MS : false;
}

export function activityEvidenceRefreshInterval(
  _evidence: Pick<WorkspaceActivityEvidence, 'integrityStatus'> | undefined
): number | false {
  return false;
}

export function activityRunStaleTime(run: Pick<DwaionUserRun, 'runState'> | undefined): number {
  return run && activityRunRefreshInterval(run) === false ? Infinity : 15_000;
}

export function activityRunRefetchOnWindowFocus(
  run: Pick<DwaionUserRun, 'runState'> | undefined
): boolean {
  return activityRunRefreshInterval(run) !== false;
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
    refetchInterval: ACTIVITY_FEED_REFRESH_INTERVAL_MS,
  });
  const summary = useQuery({
    ...options,
    queryKey: activityQueryKeys.summary(identity),
    queryFn: ({ signal }) => {
      requireAccess();
      return getActivityExecutionSummary(signal);
    },
    refetchInterval: ACTIVITY_FEED_REFRESH_INTERVAL_MS,
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
    staleTime: (query) => activityDetailStaleTime(query.state.data),
    refetchInterval: (query) => activityDetailRefreshInterval(query.state.data),
    refetchOnWindowFocus: (query) => activityDetailRefetchOnWindowFocus(query.state.data),
  });
  const selectedEvent = usableActivityQueryData(detail);
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
    staleTime: (query) => activityRunStaleTime(query.state.data),
    refetchInterval: (query) => activityRunRefreshInterval(query.state.data),
    refetchOnWindowFocus: (query) => activityRunRefetchOnWindowFocus(query.state.data),
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
    ...activityEvidenceObserverPolicy,
  });
  const sources = useQuery({
    ...options,
    queryKey: activityQueryKeys.sources(identity),
    queryFn: ({ signal }) => {
      requireAccess();
      return getWorkspaceActivitySourceStatuses(signal);
    },
    refetchInterval: ACTIVITY_SOURCE_REFRESH_INTERVAL_MS,
  });
  const rootDenied = [feed, summary, sources].some(
    (query) => query.isError && isAuthoritativeActivityRootDenial(query.error)
  );
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
  return { feed, summary, detail, executionRun, evidence, sources, rootDenied, now, refresh };
}
