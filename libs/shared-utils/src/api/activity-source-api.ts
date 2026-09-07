import { axiosInstance } from '../axios-instance';
import { HttpError, HttpTransportError } from '../http-error';
import { usePermissionsStore } from '../auth/permissions-store';
import {
  getWorkspaceActivity,
  getWorkspaceActivityEvent,
  getWorkspaceActivityExecutionSummary,
  normalizeWorkspaceActivityFeed,
} from './workspace-api';
import {
  mergeActivitySourcePages,
  oldestActivityTimestamp,
  readActivitySourceCursors,
  withActivitySourceId,
} from './activity-page-merge';

import type { ApiResponse } from '../types';
import type {
  ActivitySource,
  ActivitySourceState,
  SourceActivityPage,
  ActivityPage,
} from './activity-page-merge';
import type {
  RawWorkspaceActivityEvent,
  RawWorkspaceActivityFeed,
  WorkspaceActivityEvent,
  WorkspaceActivityExecutionSummary,
  WorkspaceActivityFilters,
} from './workspace-api';

export type ActivityExecutionSummary = WorkspaceActivityExecutionSummary & {
  partial: boolean;
  sourceStates: ActivitySourceState[];
};

function canRequestAgentActivity(): boolean {
  const permissions = usePermissionsStore.getState();
  return (
    permissions.isLoaded &&
    permissions.hasPermission('APP.ASK', 'VIEW') &&
    permissions.hasPermission('APP.ACTIVITY', 'VIEW')
  );
}

function validateSummary(
  summary: WorkspaceActivityExecutionSummary
): WorkspaceActivityExecutionSummary {
  const counts = [
    summary?.total,
    summary?.running,
    summary?.needsInput,
    summary?.policyBlocked,
    summary?.completed,
    summary?.failed,
    summary?.cancelled,
    summary?.unknown ?? 0,
  ];
  if (
    !counts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
    !Number.isFinite(Date.parse(summary?.generatedAt)) ||
    !Array.isArray(summary?.coverage?.supportedObjectTypes) ||
    counts.slice(1).reduce((sum, value) => sum + value, 0) !== counts[0]
  ) {
    throw new HttpError('Invalid current execution summary.', 502);
  }
  return summary;
}

function sourceFailure(sourceScope: ActivitySource, error: unknown): ActivitySourceState {
  if (error instanceof HttpTransportError && error.reason === 'ABORT') throw error;
  if (error instanceof HttpError && [400, 401].includes(error.status)) throw error;
  return {
    sourceScope,
    status: error instanceof HttpError && error.status === 403 ? 'FORBIDDEN' : 'UNAVAILABLE',
  };
}

function sourceQuery(filters: WorkspaceActivityFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === false) continue;
    params.set(
      key,
      key === 'actor' || key === 'state'
        ? String(value).toUpperCase().replaceAll('-', '_')
        : String(value)
    );
  }
  return params.size ? `?${params}` : '';
}

async function agentPage(
  filters: WorkspaceActivityFilters,
  signal?: AbortSignal
): Promise<SourceActivityPage> {
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceActivityFeed>>(
    `/api/agent/v1/activity/events${sourceQuery(filters)}`,
    { timeoutMs: 8000, signal }
  );
  return normalizeWorkspaceActivityFeed(response.data.data);
}

// Two owner-authorized sources, one presentation contract. No trusted identity is invented
// or forwarded by the client; the Gateway authenticates every request independently.
export async function getActivityPage(
  filters: WorkspaceActivityFilters = {},
  signal?: AbortSignal
): Promise<ActivityPage> {
  const positions = readActivitySourceCursors(filters.cursor);
  const limit = Math.max(1, Math.min(100, filters.limit ?? 50));
  const sources: ActivitySource[] = ['WORKSPACE', 'DWAI_ON'];
  const results = await Promise.all(
    sources.map(
      async (
        source
      ): Promise<{
        source: ActivitySource;
        page?: SourceActivityPage;
        state: ActivitySourceState;
      }> => {
        if (source === 'DWAI_ON' && !canRequestAgentActivity()) {
          return { source, state: { sourceScope: source, status: 'FORBIDDEN' } };
        }
        try {
          const input = { ...filters, limit, cursor: positions[source] ?? undefined };
          const page = await (source === 'WORKSPACE'
            ? getWorkspaceActivity(input, signal)
            : agentPage(input, signal));
          return {
            source,
            page,
            state: { sourceScope: source, status: 'AVAILABLE', generatedAt: page.generatedAt },
          };
        } catch (error) {
          return { source, state: sourceFailure(source, error) };
        }
      }
    )
  );
  if (signal?.aborted) throw new HttpTransportError('ABORT');
  if (!results.some((result) => result.page)) {
    throw new HttpError(
      'Activity sources are unavailable.',
      results.every((result) => result.state.status === 'FORBIDDEN') ? 403 : 503
    );
  }
  return mergeActivitySourcePages(
    Object.fromEntries(
      results.filter((result) => result.page).map((result) => [result.source, result.page])
    ),
    results.map((result) => result.state),
    positions,
    limit
  );
}

export async function getActivityEvent(
  eventId: string,
  signal?: AbortSignal
): Promise<WorkspaceActivityEvent> {
  if (!eventId.startsWith('dwaion:')) return getWorkspaceActivityEvent(eventId, signal);
  if (!canRequestAgentActivity()) throw new HttpError('Activity event is unavailable.', 403);
  const id = eventId.slice('dwaion:'.length);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) {
    throw new HttpError('Activity event is unavailable.', 404);
  }
  const response = await axiosInstance.get<ApiResponse<RawWorkspaceActivityEvent>>(
    `/api/agent/v1/activity/events/${encodeURIComponent(id)}`,
    { timeoutMs: 8000, signal }
  );
  const event = normalizeWorkspaceActivityFeed({ events: [response.data.data], generatedAt: '' })
    .events[0];
  if (!event || event.id.toLowerCase() !== id.toLowerCase()) {
    throw new HttpError('Activity event is unavailable.', 404);
  }
  return withActivitySourceId('DWAI_ON', { ...event, id: id.toLowerCase() });
}

export async function getActivityExecutionSummary(
  signal?: AbortSignal
): Promise<ActivityExecutionSummary> {
  const results = await Promise.all(
    (['WORKSPACE', 'DWAI_ON'] as const).map(async (source) => {
      if (source === 'DWAI_ON' && !canRequestAgentActivity()) {
        return {
          summary: undefined,
          state: { sourceScope: source, status: 'FORBIDDEN' } as ActivitySourceState,
        };
      }
      try {
        const summary = validateSummary(
          source === 'WORKSPACE'
            ? await getWorkspaceActivityExecutionSummary(signal)
            : (
                await axiosInstance.get<ApiResponse<WorkspaceActivityExecutionSummary>>(
                  '/api/agent/v1/activity/executions/summary',
                  { timeoutMs: 8000, signal }
                )
              ).data.data
        );
        return {
          summary,
          state: {
            sourceScope: source,
            status: 'AVAILABLE',
            generatedAt: summary.generatedAt,
          } as ActivitySourceState,
        };
      } catch (error) {
        return { summary: undefined, state: sourceFailure(source, error) };
      }
    })
  );
  if (signal?.aborted) throw new HttpTransportError('ABORT');
  const available = results.flatMap((result) => (result.summary ? [result.summary] : []));
  if (!available.length || results.some((result) => result.state.status === 'UNAVAILABLE')) {
    // Never display successful-source subtotal as an authoritative total when a source failed.
    throw new HttpError('Current execution summary is unavailable.', 503);
  }
  const sum = (
    key:
      | 'total'
      | 'running'
      | 'needsInput'
      | 'policyBlocked'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'unknown'
  ) => available.reduce((count, summary) => count + (summary[key] ?? 0), 0);
  return {
    total: sum('total'),
    running: sum('running'),
    needsInput: sum('needsInput'),
    policyBlocked: sum('policyBlocked'),
    completed: sum('completed'),
    failed: sum('failed'),
    cancelled: sum('cancelled'),
    unknown: sum('unknown'),
    generatedAt: oldestActivityTimestamp(available.map((summary) => summary.generatedAt)),
    partial: false,
    sourceStates: results.map((result) => result.state),
    coverage: {
      supportedObjectTypes: [
        ...new Set(available.flatMap((summary) => summary.coverage.supportedObjectTypes)),
      ],
    },
  };
}
