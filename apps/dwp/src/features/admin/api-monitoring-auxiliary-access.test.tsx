// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiMonitoring } from './api-monitoring';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  events: vi.fn(),
  auditEvents: vi.fn(),
  permission: vi.fn((_resource: string, _permission: string) => false),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getApiHistoryOverview: mocks.overview,
  listApiHistoryEvents: mocks.events,
  listAuditEvents: mocks.auditEvents,
  usePermissions: () => ({ hasPermission: mocks.permission, isLoaded: true }),
}));
vi.mock('../../components/use-system-code-options', () => ({
  useSystemCodeOptions: <T extends string>(_key: string, fallback: readonly T[]) => fallback,
}));
vi.mock('@dwp-frontend/design-system', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    ActionButton: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
      createElement('button', { onClick }, children),
    EnterpriseDataGrid: () => null,
    LiveStatus: () => null,
    OperationalContextBar: () => null,
  };
});
vi.mock('./api-monitoring-detail', () => ({ ApiMonitoringTraceDrawer: () => null }));
vi.mock('./api-monitoring-visuals', () => ({
  ApiMonitoringMetric: () => null,
  TrafficChart: () => null,
  createApiHistoryColumns: () => [],
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  formatNumber: (value: number) => String(value),
  useDisplayDictionary: () => (_domain: string, value: string) => value,
}));

const observedAt = '2026-10-01T08:00:00Z';

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flush() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

async function renderMonitoring() {
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client }, createElement(ApiMonitoring))
      )
    );
  });
  await flush();
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.permission.mockReset().mockReturnValue(false);
  mocks.overview.mockReset().mockResolvedValue({
    window: 'H24',
    observationPoint: 'GATEWAY',
    from: observedAt,
    to: observedAt,
    generatedAt: observedAt,
    summary: {
      totalRequests: 0,
      successfulRequests: 0,
      clientErrorRequests: 0,
      serverErrorRequests: 0,
      errorRate: 0,
      p50DurationMs: 0,
      p95DurationMs: 0,
      p99DurationMs: 0,
      requestsPerMinute: 0,
      activeRoutesOrServices: 0,
    },
    trend: [],
    topRoutes: [],
    statusDistribution: [],
  });
  mocks.events.mockReset().mockResolvedValue({ content: [], nextCursor: null, size: 50 });
  mocks.auditEvents.mockReset().mockResolvedValue({ content: [], page: 0, size: 20, total: 0 });
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

describe('API monitoring auxiliary access', () => {
  it('does not request the audit ledger without exact audit-view permission', async () => {
    await renderMonitoring();

    expect(mocks.permission).toHaveBeenCalledWith('ADMIN.AUDIT_VIEW', 'VIEW');
    expect(mocks.overview).toHaveBeenCalledOnce();
    expect(mocks.events).toHaveBeenCalledOnce();
    expect(mocks.auditEvents).not.toHaveBeenCalled();
    expect(container.textContent).toContain('apiMonitoring.changes.restricted');
    expect(container.textContent).not.toContain('apiMonitoring.pulse.openEvidence');

    const refresh = container.querySelector<HTMLButtonElement>(
      'button[aria-label="apiMonitoring.filters.refresh"]'
    );
    expect(refresh).not.toBeNull();
    await act(async () => refresh?.click());
    await flush();
    expect(mocks.auditEvents).not.toHaveBeenCalled();
  });

  it('loads change correlation only when audit-view permission is present', async () => {
    mocks.permission.mockImplementation(
      (resource, permission) => resource === 'ADMIN.AUDIT_VIEW' && permission === 'VIEW'
    );

    await renderMonitoring();

    expect(mocks.auditEvents).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('apiMonitoring.changes.restricted');
    expect(container.textContent).toContain('apiMonitoring.pulse.openEvidence');
  });
});
