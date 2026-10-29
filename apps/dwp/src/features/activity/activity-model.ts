import type {
  WorkspaceActivityActor,
  WorkspaceActivityFilters,
  WorkspaceActivityState,
} from '@dwp-frontend/shared-utils';

import { activityQueryKeys as sharedActivityQueryKeys } from '../../components/activity/activity-detail-model';

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
export const ACTIVITY_SOURCES = [
  'WORKSPACE',
  'DWP_WORKSPACE',
  'PERSONAL_TASK',
  'DWP Apps',
  'DWAI_ON',
] as const;
export const ACTIVITY_OBJECT_TYPES = ['WORK_ITEM', 'WORKSPACE_APP', 'AGENT_RUN'] as const;
export type ActorFilter = 'all' | WorkspaceActivityActor;
export type StateFilter = 'all' | WorkspaceActivityState;

export const ACTIVITY_SEARCH_MIN_LENGTH = 3;
const ACTIVITY_EXACT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function normalizeActivitySearchQuery(value: string): string {
  return value.trim();
}

export function validActivitySearchQuery(value: string): boolean {
  const normalized = normalizeActivitySearchQuery(value);
  const codePointLength = Array.from(normalized).length;
  return (
    codePointLength === 0 ||
    codePointLength >= ACTIVITY_SEARCH_MIN_LENGTH ||
    ACTIVITY_EXACT_UUID.test(normalized)
  );
}

function isActorFilter(value: unknown): value is ActorFilter {
  return ACTIVITY_ACTORS.includes(value as ActorFilter);
}

function isStateFilter(value: unknown): value is StateFilter {
  return ACTIVITY_STATES.includes(value as StateFilter);
}

const FILTER_KEYS = ['source', 'objectType', 'objectId', 'executionId', 'from', 'to'] as const;

// q/actor/state and workspace.activity stay stable for existing links and saved views.
export function readActivityFilters(params: URLSearchParams): WorkspaceActivityFilters {
  const actor = params.get('actor');
  const state = params.get('state');
  const query = normalizeActivitySearchQuery(params.get('q') ?? '');
  return {
    actor: isActorFilter(actor) && actor !== 'all' ? actor : undefined,
    state: isStateFilter(state) && state !== 'all' ? state : undefined,
    query: query && validActivitySearchQuery(query) ? query : undefined,
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
  sources: (identity: string) => [...activityQueryKeys.root, 'sources', identity] as const,
};

function validActivityTimestamp(value: string): boolean {
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u.exec(
      value
    );
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map((part) => Number(part ?? 0));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  // Date.parse rolls values such as February 30 and 24:00 into another day. The filter
  // must represent exactly what the user entered, not a silently normalized interval.
  return Boolean(
    daysInMonth && day >= 1 && day <= daysInMonth && hour < 24 && minute < 60 && second < 60
  );
}

export function validActivityTimeRange(filters: WorkspaceActivityFilters): boolean {
  if ([filters.from, filters.to].some((value) => value && !validActivityTimestamp(value)))
    return false;
  return !filters.from || !filters.to || Date.parse(filters.from) < Date.parse(filters.to);
}

export function activityRefreshState(
  query: {
    isFetching: boolean;
    isError: boolean;
    dataUpdatedAt: number;
    data?: { generatedAt?: string; partial?: boolean };
  },
  now: number,
  staleAfterMs = 90_000
): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (query.isError || query.data?.partial) return 'degraded';
  if (query.isFetching) return 'syncing';
  const sourceAt = query.data?.generatedAt
    ? Date.parse(query.data.generatedAt)
    : query.dataUpdatedAt;
  if (
    !query.dataUpdatedAt ||
    !Number.isFinite(sourceAt) ||
    now - Math.min(sourceAt, query.dataUpdatedAt) > staleAfterMs
  )
    return 'stale';
  return 'live';
}

export function activityCompositeRefreshState(
  states: readonly ('live' | 'syncing' | 'stale' | 'degraded')[]
): 'live' | 'syncing' | 'stale' | 'degraded' {
  if (states.includes('degraded')) return 'degraded';
  if (states.includes('stale')) return 'stale';
  if (states.includes('syncing')) return 'syncing';
  return 'live';
}

export function activityEmptyStateKind(activeFilterCount: number): 'empty' | 'filtered' {
  return activeFilterCount > 0 ? 'filtered' : 'empty';
}
