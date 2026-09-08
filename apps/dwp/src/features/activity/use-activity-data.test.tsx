// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type { WorkspaceActivityFilters } from '@dwp-frontend/shared-utils';

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

import { useActivityData } from './use-activity-data';

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
