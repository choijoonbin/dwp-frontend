import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermissionsStore } from '../auth/permissions-store';

import {
  getActivityEvent,
  getActivityExecutionSummary,
  getActivityPage,
} from './activity-source-api';

const NOW = '2026-09-04T01:00:00Z';
const RUN = 'aaaaaaaa-0000-4000-8000-000000000001';
function response(data: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify({ data }) } as Response;
}
function page() {
  return {
    events: [],
    generatedAt: NOW,
    snapshotAt: NOW,
    startCursor: 'start',
    hasMore: false,
    coverage: { supportedObjectTypes: ['WORK_ITEM'] },
  };
}
function summary(running: number) {
  return {
    total: running,
    running,
    needsInput: 0,
    policyBlocked: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    unknown: 0,
    generatedAt: NOW,
    coverage: { supportedObjectTypes: [] },
  };
}

describe('activity federated API boundary', () => {
  beforeEach(() =>
    usePermissionsStore.getState().setPermissions(
      ['APP.ACTIVITY', 'APP.ASK'].map((resourceKey) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      }))
    )
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    usePermissionsStore.getState().clearPermissions();
  });

  it('does not request the Agent source without its app permission', async () => {
    usePermissionsStore.getState().setPermissions([
      {
        resourceType: 'APP',
        resourceKey: 'APP.ACTIVITY',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ]);
    const fetch = vi.fn((input) =>
      Promise.resolve(response(String(input).includes('/summary') ? summary(0) : page()))
    );
    vi.stubGlobal('fetch', fetch);
    expect((await getActivityPage()).sourceStates).toContainEqual({
      sourceScope: 'DWAI_ON',
      status: 'FORBIDDEN',
    });
    expect((await getActivityExecutionSummary()).total).toBe(0);
    await expect(getActivityEvent(`dwaion:${RUN}`)).rejects.toMatchObject({ status: 403 });
    expect(fetch.mock.calls.every((call) => !String(call[0]).includes('/api/agent/'))).toBe(true);
  });

  it('rejects malformed totals instead of rendering NaN or undercounting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...summary(1), total: 0 })));
    await expect(getActivityExecutionSummary()).rejects.toMatchObject({ status: 503 });
  });

  it('queries both owner services with the same filters but independent cursors', async () => {
    const fetch = vi.fn().mockResolvedValue(response(page()));
    vi.stubGlobal('fetch', fetch);
    const result = await getActivityPage({ query: 'review', state: 'needs-input', limit: 10 });
    expect(fetch).toHaveBeenCalledTimes(2);
    const urls = fetch.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/api/platform/v1/workspace/activity?'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/agent/v1/activity/events?'))).toBe(true);
    expect(
      urls.every((url) => url.includes('state=NEEDS_INPUT') && url.includes('query=review'))
    ).toBe(true);
    expect(result.partial).toBe(false);
  });

  it('retains successful source data while explicitly marking failure and disabling global paging', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input) =>
        Promise.resolve(
          String(input).includes('/api/agent/') ? response(null, 503) : response(page())
        )
      )
    );
    const result = await getActivityPage();
    expect(result.partial).toBe(true);
    expect(result.sourceStates).toContainEqual({ sourceScope: 'DWAI_ON', status: 'UNAVAILABLE' });
    expect(result.hasMore).toBe(false);
  });

  it('does not show a healthy zero total when the Agent summary is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input) =>
        Promise.resolve(
          String(input).includes('/api/agent/') ? response(null, 503) : response(summary(0))
        )
      )
    );
    await expect(getActivityExecutionSummary()).rejects.toMatchObject({ status: 503 });
  });

  it('combines only currently authorized source totals and reports their scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input) =>
        Promise.resolve(
          String(input).includes('/api/agent/') ? response(null, 403) : response(summary(2))
        )
      )
    );
    const result = await getActivityExecutionSummary();
    expect(result.running).toBe(2);
    expect(result.sourceStates).toContainEqual({ sourceScope: 'DWAI_ON', status: 'FORBIDDEN' });
  });

  it('preserves source cursor rejection instead of silently restarting that source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input) =>
        Promise.resolve(
          String(input).includes('/api/agent/') ? response(null, 400) : response(page())
        )
      )
    );
    await expect(getActivityPage()).rejects.toMatchObject({ status: 400 });
  });

  it('dispatches namespaced run detail through the protected source endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      response({
        id: RUN.toUpperCase(),
        occurredAt: NOW,
        actor: 'AGENT',
        actorName: 'DWAI·ON',
        state: 'UNKNOWN',
        title: 'Run',
        objectType: 'AGENT_RUN',
        objectLabel: 'Run',
        source: 'DWAI_ON',
        auditId: null,
        eventKind: 'EXECUTION_SNAPSHOT',
        dataProvenance: 'LIVE',
        sourceAccess: 'AVAILABLE',
      })
    );
    vi.stubGlobal('fetch', fetch);
    const event = await getActivityEvent(`dwaion:${RUN}`);
    expect(event.id).toBe(`dwaion:${RUN}`);
    expect(event.state).toBe('unknown');
    expect(String(fetch.mock.calls[0][0])).toContain(`/api/agent/v1/activity/events/${RUN}`);
  });

  it('rejects malformed source IDs without making requests', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(getActivityEvent('dwaion:../../admin')).rejects.toMatchObject({ status: 404 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not return data after cancellation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(page())));
    const abort = new AbortController();
    abort.abort();
    await expect(getActivityPage({}, abort.signal)).rejects.toMatchObject({ reason: 'ABORT' });
  });
});
