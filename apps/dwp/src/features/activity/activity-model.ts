import type {
  WorkspaceActivityActor,
  WorkspaceActivityFilters,
  WorkspaceActivityState,
} from '@dwp-frontend/shared-utils';

import { activityQueryKeys as sharedActivityQueryKeys } from '../../components/activity/activity-detail-model';
export {
  availableActivitySourceRoute,
  selectedActivityEvent,
} from '../../components/activity/activity-detail-model';

export const ACTIVITY_ACTORS = ['all', 'agent', 'person', 'system'] as const;
export const ACTIVITY_STATES = [
  'all',
  'running',
  'needs-input',
  'completed',
  'policy-blocked',
  'failed',
  'cancelled',
  'unknown',
] as const;
export type ActorFilter = 'all' | WorkspaceActivityActor;
export type StateFilter = 'all' | WorkspaceActivityState;

export function isActorFilter(value: unknown): value is ActorFilter {
  return ACTIVITY_ACTORS.includes(value as ActorFilter);
}

export function isStateFilter(value: unknown): value is StateFilter {
  return ACTIVITY_STATES.includes(value as StateFilter);
}

const FILTER_KEYS = ['source', 'objectType', 'objectId', 'executionId', 'from', 'to'] as const;

// q/actor/state and workspace.activity stay stable for existing links and saved views.
export function readActivityFilters(params: URLSearchParams): WorkspaceActivityFilters {
  const actor = params.get('actor');
  const state = params.get('state');
  return {
    actor: isActorFilter(actor) && actor !== 'all' ? actor : undefined,
    state: isStateFilter(state) && state !== 'all' ? state : undefined,
    query: params.get('q') || undefined,
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || undefined])),
    cursor: params.get('cursor') || undefined,
    limit: 50,
    includeUsage: params.get('includeUsage') === 'true',
  };
}

export function activitySavedConfiguration(filters: WorkspaceActivityFilters) {
  return {
    q: filters.query ?? '',
    actor: filters.actor ?? 'all',
    state: filters.state ?? 'all',
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, filters[key] ?? ''])),
    includeUsage: filters.includeUsage === true,
  };
}

export function applyActivitySavedConfiguration(
  current: URLSearchParams,
  configuration: Record<string, unknown>
): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of ['q', ...FILTER_KEYS]) {
    const value = configuration[key];
    if (typeof value === 'string' && value) params.set(key, value);
    else params.delete(key);
  }
  if (isActorFilter(configuration.actor) && configuration.actor !== 'all') {
    params.set('actor', configuration.actor);
  } else params.delete('actor');
  if (isStateFilter(configuration.state) && configuration.state !== 'all') {
    params.set('state', configuration.state);
  } else params.delete('state');
  if (configuration.includeUsage === true) params.set('includeUsage', 'true');
  else params.delete('includeUsage');
  params.delete('cursor');
  params.delete('event');
  return params;
}

export const activityQueryKeys = {
  ...sharedActivityQueryKeys,
  feed: (identity: string, filters: WorkspaceActivityFilters) =>
    [...activityQueryKeys.root, 'feed', identity, filters] as const,
  summary: (identity: string) => [...activityQueryKeys.root, 'summary', identity] as const,
};

export function validActivityTimeRange(filters: WorkspaceActivityFilters): boolean {
  for (const value of [filters.from, filters.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
        !Number.isFinite(Date.parse(value)))
    )
      return false;
  }
  return !filters.from || !filters.to || Date.parse(filters.from) < Date.parse(filters.to);
}

export function activityRefreshState(
  query: {
    isFetching: boolean;
    isError: boolean;
    dataUpdatedAt: number;
    data?: { generatedAt?: string; partial?: boolean };
  },
  now: number
): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (query.isError || query.data?.partial) return 'degraded';
  if (query.isFetching) return 'syncing';
  const sourceAt = query.data?.generatedAt
    ? Date.parse(query.data.generatedAt)
    : query.dataUpdatedAt;
  if (
    !query.dataUpdatedAt ||
    !Number.isFinite(sourceAt) ||
    now - Math.min(sourceAt, query.dataUpdatedAt) > 90_000
  )
    return 'stale';
  return 'live';
}
