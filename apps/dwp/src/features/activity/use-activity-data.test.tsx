// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type { WorkspaceActivityFilters } from '@dwp-frontend/shared-utils';

import {
  ACTIVITY_RUNNING_REFRESH_INTERVAL_MS,
  activityDetailRefetchOnWindowFocus,
  activityDetailRefreshInterval,
  activityDetailStaleTime,
} from '../../components/activity/activity-query-contract';

const runtime = vi.hoisted(() => ({
  auth: { tenantId: 1, userId: 7, isAuthenticated: true },
  permissions: { loaded: true, activity: true, ask: true },
  feed: vi.fn(),
  summary: vi.fn(),
  detail: vi.fn(),
  run: vi.fn(),
  eventEvidence: vi.fn(),
  auditEvidence: vi.fn(),
  sources: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useAuth: () => ({ user: { ...runtime.auth }, isAuthenticated: runtime.auth.isAuthenticated }),
  usePermissions: () => ({
    isLoaded: runtime.permissions.loaded,
    hasPermission: (resource: string) =>
      resource === 'APP.ACTIVITY' ? runtime.permissions.activity : runtime.permissions.ask,
  }),
  getActivityPage: runtime.feed,
  getActivityExecutionSummary: runtime.summary,
  getActivityEvent: runtime.detail,
  getDwaionUserRun: runtime.run,
  getWorkspaceActivityEventEvidence: runtime.eventEvidence,
  getWorkspaceActivityAuditEvidence: runtime.auditEvidence,
  getWorkspaceActivitySourceStatuses: runtime.sources,
}));

import {
  ACTIVITY_FEED_REFRESH_INTERVAL_MS,
  ACTIVITY_SOURCE_REFRESH_INTERVAL_MS,
  activityEvidenceObserverPolicy,
  activityEvidenceRefreshInterval,
  activityRunRefetchOnWindowFocus,
  activityRunRefreshInterval,
  activityRunStaleTime,
  useActivityData,
} from './use-activity-data';

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let result: ReturnType<typeof useActivityData>;
let filters: WorkspaceActivityFilters;
let eventId: string;

function Probe() {
  result = useActivityData(filters, eventId);
  return null;
}

async function render() {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
}

async function waitForSuccess() {
  await act(async () => {
    await vi.waitFor(() => {
      expect(result.feed.isSuccess).toBe(true);
      expect(result.summary.isSuccess).toBe(true);
      expect(result.detail.isSuccess).toBe(true);
    });
  });
}

describe('Activity query access, refresh and cache isolation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.auth = { tenantId: 1, userId: 7, isAuthenticated: true };
    runtime.permissions = { loaded: true, activity: true, ask: true };
    runtime.feed.mockReset().mockResolvedValue({ events: [{ id: 'private-event' }] });
    runtime.summary.mockReset().mockResolvedValue({ total: 1 });
    runtime.detail.mockReset().mockResolvedValue({ id: 'private-event', title: 'Private event' });
    runtime.run.mockReset().mockResolvedValue({ runId: 'private-event' });
    runtime.eventEvidence.mockReset().mockResolvedValue({ eventId: 'private-event' });
    runtime.auditEvidence.mockReset().mockResolvedValue({ eventId: 'private-event' });
    runtime.sources.mockReset().mockResolvedValue({
      observedAt: '2026-09-07T09:00:00Z',
      sources: [],
    });
    filters = {};
    eventId = 'private-event';
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });

  it('loads independently authorized feed, summary and exact detail with cancellation signals', async () => {
    await render();
    await waitForSuccess();
    expect(runtime.feed).toHaveBeenCalledWith(filters, expect.any(AbortSignal));
    expect(runtime.summary).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(runtime.detail).toHaveBeenCalledWith(eventId, expect.any(AbortSignal));
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.meta?.accessSensitive)
    ).toBe(true);
  });

  it('treats integrity evidence as immutable until an explicit refetch', async () => {
    await render();
    await waitForSuccess();
    await vi.waitFor(() => expect(result.evidence.isSuccess).toBe(true));
    expect(activityEvidenceObserverPolicy).toEqual({
      staleTime: Infinity,
      retry: false,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    });
    expect(runtime.eventEvidence).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.evidence.refetch();
    });
    expect(runtime.eventEvidence).toHaveBeenCalledTimes(2);
  });

  it('uses bounded polling intervals for feeds, sources, active runs and terminal evidence', () => {
    expect(ACTIVITY_FEED_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(ACTIVITY_SOURCE_REFRESH_INTERVAL_MS).toBe(300_000);
    expect(activityDetailRefreshInterval({ state: 'running' })).toBe(
      ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );
    expect(activityDetailRefreshInterval({ state: 'completed' })).toBe(false);
    expect(activityRunRefreshInterval({ runState: 'RUNNING' })).toBe(
      ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );
    expect(activityRunRefreshInterval({ runState: 'COMPLETED' })).toBe(false);
    expect(activityEvidenceRefreshInterval({ integrityStatus: 'PENDING' })).toBe(false);
    expect(activityEvidenceRefreshInterval({ integrityStatus: 'UNAVAILABLE' })).toBe(false);
    expect(activityEvidenceRefreshInterval({ integrityStatus: 'VERIFIED' })).toBe(false);
    expect(activityDetailStaleTime({ state: 'running' })).toBe(15_000);
    expect(activityDetailRefetchOnWindowFocus({ state: 'running' })).toBe(true);
    expect(activityDetailStaleTime({ state: 'completed' })).toBe(Infinity);
    expect(activityDetailRefetchOnWindowFocus({ state: 'completed' })).toBe(false);
    expect(activityRunStaleTime({ runState: 'RUNNING' })).toBe(15_000);
    expect(activityRunRefetchOnWindowFocus({ runState: 'RUNNING' })).toBe(true);
    expect(activityRunStaleTime({ runState: 'COMPLETED' })).toBe(Infinity);
    expect(activityRunRefetchOnWindowFocus({ runState: 'COMPLETED' })).toBe(false);
  });

  it.each(['feed', 'summary', 'sources'] as const)(
    'gates every root cache when only %s returns an authoritative denial',
    async (deniedQuery) => {
      await render();
      await waitForSuccess();
      runtime[deniedQuery].mockRejectedValueOnce(new HttpError('access revoked', 403));

      await act(async () => {
        await result[deniedQuery].refetch();
      });
      await vi.waitFor(() => expect(result.rootDenied).toBe(true));

      expect(result.feed.data).toBeDefined();
      expect(result.summary.data).toBeDefined();
      expect(result.sources.data).toBeDefined();
    }
  );

  it('does not escalate a route-local detail 404 into a root denial', async () => {
    await render();
    await waitForSuccess();
    runtime.detail.mockRejectedValueOnce(new HttpError('event removed', 404));

    await act(async () => {
      await result.detail.refetch();
    });
    await vi.waitFor(() => expect(result.detail.isError).toBe(true));
    expect(result.rootDenied).toBe(false);
  });

  it.each(['session', 'permissions-loading', 'activity-denied'])(
    'does not let manual refresh or retry bypass %s',
    async (state) => {
      if (state === 'session') runtime.auth.isAuthenticated = false;
      if (state === 'permissions-loading') runtime.permissions.loaded = false;
      if (state === 'activity-denied') runtime.permissions.activity = false;
      await render();
      await act(async () => {
        await result.refresh();
        await Promise.all([
          result.feed.refetch(),
          result.summary.refetch(),
          result.detail.refetch(),
        ]);
      });
      expect(runtime.feed).not.toHaveBeenCalled();
      expect(runtime.summary).not.toHaveBeenCalled();
      expect(runtime.detail).not.toHaveBeenCalled();
      expect(result.feed.data).toBeUndefined();
      expect(result.summary.data).toBeUndefined();
      expect(result.detail.data).toBeUndefined();
    }
  );

  it('does not send an invalid time range on manual refresh or feed retry', async () => {
    filters = { from: 'not-a-time' };
    await render();
    await act(async () => {
      await result.refresh();
      await result.feed.refetch();
    });
    expect(runtime.feed).not.toHaveBeenCalled();
    expect(runtime.summary).toHaveBeenCalled();
    expect(runtime.detail).toHaveBeenCalled();
  });

  it.each(['session', 'activity-denied'])(
    'hides all cached private data immediately after %s loss',
    async (state) => {
      await render();
      await waitForSuccess();
      if (state === 'session') runtime.auth.isAuthenticated = false;
      else runtime.permissions.activity = false;
      await render();
      expect(result.feed.data).toBeUndefined();
      expect(result.summary.data).toBeUndefined();
      expect(result.detail.data).toBeUndefined();
      await act(async () => result.refresh());
      expect(runtime.feed).toHaveBeenCalledTimes(1);
      expect(runtime.summary).toHaveBeenCalledTimes(1);
      expect(runtime.detail).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['tenantId', 'userId'] as const)(
    'does not reuse private data after %s changes',
    async (key) => {
      await render();
      await waitForSuccess();
      runtime.auth[key] += 1;
      runtime.feed.mockImplementation(() => new Promise(() => undefined));
      runtime.summary.mockImplementation(() => new Promise(() => undefined));
      runtime.detail.mockImplementation(() => new Promise(() => undefined));
      await render();
      expect(result.feed.data).toBeUndefined();
      expect(result.summary.data).toBeUndefined();
      expect(result.detail.data).toBeUndefined();
    }
  );

  it('does not manually load an empty detail selection', async () => {
    eventId = '';
    await render();
    await act(async () => {
      await result.refresh();
      await result.detail.refetch();
    });
    expect(runtime.detail).not.toHaveBeenCalled();
  });

  it('does not let refresh or direct refetch bypass APP.ASK for Agent evidence', async () => {
    const runId = 'aaaaaaaa-0000-4000-8000-000000000101';
    runtime.permissions.ask = false;
    runtime.detail.mockResolvedValue({
      id: `dwaion:${runId}`,
      source: 'DWAI_ON',
      executionId: runId,
      auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000102',
    });
    eventId = `dwaion:${runId}`;
    await render();
    await act(async () => {
      await vi.waitFor(() => expect(result.detail.isSuccess).toBe(true));
      await result.refresh();
      await Promise.all([result.executionRun.refetch(), result.evidence.refetch()]);
    });
    expect(runtime.run).not.toHaveBeenCalled();
    expect(runtime.auditEvidence).not.toHaveBeenCalled();
  });

  it('loads a PostgreSQL-valid non-RFC-version Agent UUID and binds evidence to that run', async () => {
    const runId = 'aaaaaaaa-0000-f000-0000-000000000101';
    const auditRecordId = 'bbbbbbbb-0000-0000-0000-000000000102';
    runtime.detail.mockResolvedValue({
      id: `dwaion:${runId}`,
      source: 'DWAI_ON',
      executionId: runId,
      auditRecordId,
    });
    eventId = `dwaion:${runId}`;

    await render();
    await act(async () => {
      await vi.waitFor(() => {
        expect(runtime.run).toHaveBeenCalledWith(runId, expect.any(AbortSignal));
        expect(runtime.auditEvidence).toHaveBeenCalledWith(
          auditRecordId,
          runId,
          expect.any(AbortSignal)
        );
      });
    });
  });
});
