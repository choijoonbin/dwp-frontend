// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { ApprovalAdminOverview } from './approval-admin-overview';

import type { ApprovalAdminPulse } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as CanaryRuntime from '../../components/product-surface-canary-runtime';
import type { ProductSurfaceCanaryAuthority } from '../../components/product-surface-canary-runtime';
import type {
  AllowedSurfaceDecision,
  EffectiveScope,
  SurfaceDecision,
} from '../../components/product-surface-context';
import type { ApprovalManagementRequestScope } from './use-approval-experience';

// Real query/router/PAGE resolver and API/axios transport; context ports are UI fixtures,
// not an installed NativeAuth or backend interoperability proof.
const fixture = vi.hoisted(() => ({
  canary: {} as ProductSurfaceCanaryAuthority,
  scope: {} as ApprovalManagementRequestScope,
  scopeReady: true,
  routes: {} as Record<string, SurfaceDecision>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { time?: string }) => (values?.time ? `${key}:${values.time}` : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useProductSurfaceAuthority: () => ({ snapshot: null }),
}));
vi.mock('../../components/product-surface-canary-runtime', async (original) => ({
  ...(await original<typeof CanaryRuntime>()),
  useProductSurfaceCanaryAuthority: () => fixture.canary,
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalManagementRequestScope: () => fixture.scope,
}));
vi.mock('./approval-management-scope', () => ({
  useApprovalManagementScopeReady: () => fixture.scopeReady,
}));

const NOW = Date.parse('2029-01-01T00:00:00Z');
const FUTURE = '2030-01-01T00:00:00Z';
const PAGE = (page: string) => `route.approvals.admin.${page}.page`;
const pages = ['overview', 'workflows', 'policies', 'operations', 'signatures'];
const pendingReads: Array<() => void> = [];

function pulse(overrides: Partial<ApprovalAdminPulse> = {}): ApprovalAdminPulse {
  return {
    publishedWorkflows: 7,
    draftWorkflows: 2,
    activeRequests: 97,
    overdueTasks: 0,
    failedIntegrations: 0,
    assurance: (['identity', 'segregation', 'evidence', 'delivery'] as const).map((key) => ({
      key,
      state: 'ENFORCED',
      exceptions: 0,
    })),
    ...overrides,
  };
}
function authorityFrame() {
  const scopes = pages.map<EffectiveScope>((page) => ({
    key: `scope:${page}`,
    kind: 'RESOURCE_SET',
    displayName: page,
    isDefault: page === 'overview',
    readOnly: false,
    validUntil: FUTURE,
  }));
  const context: AllowedSurfaceDecision['context'] = {
    contextKey: 'context:approvals-admin',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.APPROVALS',
    scopes,
    effectiveGrants: [],
    revalidateAt: FUTURE,
  };
  const routeDecisions: Record<string, SurfaceDecision> = {};
  fixture.routes = routeDecisions;
  pages.forEach((page, index) => {
    routeDecisions[PAGE(page)] = {
      state: 'allowed',
      routeGrantRef: `route-grant:${page}`,
      decisionRevision: 'psr-direct-route',
      effectiveReadOnly: false,
      revalidateAt: FUTURE,
      scope: scopes[index]!,
      context,
    };
  });
  fixture.canary = {
    flags: {
      contextShadow: true,
      capabilityEnforcement: true,
      surfaceUi: true,
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: NOW,
    envelope: {
      contractVersion: '3',
      decisionRevision: 'psr-envelope',
      sourceRevisions: { auth: 'auth-1' },
      activeAccessMode: 'NORMAL',
      generatedAt: new Date(NOW).toISOString(),
      contexts: [context],
    },
    routeDecisions,
  };
  fixture.scope = {
    contextScopeKey: 'scope:overview',
    cacheKey: ['1', '13', 'NORMAL', 'approvals.admin', 'scope:overview', 'psr-direct-route'],
  };
}
function response(value: unknown, status = 200) {
  return new Response(
    JSON.stringify(status === 200 ? { data: value } : { message: 'Read failed', errorCode: value }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
function network() {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    response(pulse())
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function hold(fetch: ReturnType<typeof network>, value = pulse()) {
  fetch.mockImplementationOnce(
    () => new Promise<Response>((resolve) => pendingReads.push(() => resolve(response(value))))
  );
}
function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
const mounted: Array<{
  root: ReturnType<typeof createRoot>;
  node: HTMLElement;
  client: QueryClient;
}> = [];
async function flush(ms = 30) {
  await act(async () => {
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms);
    else await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
async function mount(prefill = true) {
  // Deliberately retry-enabled default: the actual Overview must override it.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
  const key = ['approvals', 'admin', 'overview', ...fixture.scope.cacheKey];
  if (prefill) client.setQueryData(key, pulse());
  const node = document.createElement('div');
  document.body.append(node);
  const root = createRoot(node);
  mounted.push({ root, node, client });
  const render = () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/approvals/admin/overview']}>
          <ApprovalAdminOverview />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    );
  await act(async () => render());
  await flush();
  return { client, key, node, root, render };
}
function button(node: HTMLElement, text: string) {
  const found = Array.from(node.querySelectorAll('button')).find(
    (item) => item.textContent?.includes(text) || item.getAttribute('aria-label') === text
  );
  expect(found, `button ${text}`).toBeDefined();
  return found!;
}
async function click(node: HTMLElement, label: string) {
  await act(async () => button(node, label).click());
  await flush();
}
function expectHistorical(node: HTMLElement) {
  expect(node.textContent).toContain('admin.overview.historical');
  expect(node.textContent).toContain('97');
  expect(node.textContent).toContain('status.UNKNOWN');
  expect(node.textContent).not.toContain('admin.assurance.states.enforced');
  expect(node.textContent).not.toContain('admin.overview.aggregateEnforced');
  expect(node.textContent).not.toContain('admin.overview.quickAccess');
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  fixture.scopeReady = true;
  onlineManager.setOnline(true);
  authorityFrame();
});
afterEach(async () => {
  pendingReads.splice(0).forEach((release) => release());
  for (const item of mounted.splice(0)) {
    await act(async () => item.root.unmount());
    item.client.clear();
    item.node.remove();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('actual APR11 Overview source and control journey', () => {
  it('labels client receipt time and separates static roles from four native PAGE shortcuts', async () => {
    const fetch = network();
    const { node } = await mount();
    expect(fetch).not.toHaveBeenCalled();
    expect(node.textContent).toContain('admin.overview.lastReceived:');
    expect(node.textContent).not.toContain('admin.overview.updatedAt');
    expect(node.textContent).toContain('admin.overview.aggregateEnforced');
    expect(node.textContent).toContain('admin.overview.roleReference');
    expect(node.textContent).toContain('admin.controlModel.publisher.title');
    expect(
      Array.from(node.querySelectorAll('button')).some((item) =>
        item.textContent?.includes('admin.controlModel')
      )
    ).toBe(false);
    for (const page of pages.slice(1)) expect(button(node, `pages.${page}.title`)).toBeDefined();
  });
  it.each([401, 403, 404])(
    'first native HTTP %s masks cached data immediately and has no automatic retry',
    async (status) => {
      const fetch = network();
      const { node } = await mount();
      fetch.mockResolvedValue(response('FORBIDDEN', status));
      await click(node, 'actions.refresh');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(node.textContent).not.toContain('97');
      expect(node.textContent).not.toContain('admin.overview.quickAccess');
      expect(node.querySelector('[role="alert"]')).not.toBeNull();
      await flush(60);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it('generic503 retains explicitly historical values/UNKNOWN, then scoped explicit success recovers', async () => {
    const fetch = network();
    const { node } = await mount();
    fetch.mockResolvedValueOnce(response('UNAVAILABLE', 503));
    await click(node, 'actions.refresh');
    expectHistorical(node);
    expect(fetch).toHaveBeenCalledTimes(1);
    await click(node, 'actions.refresh');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]?.[0])).toContain('contextScopeKey=scope%3Aoverview');
    expect(node.textContent).toContain('admin.overview.aggregateEnforced');
  });
  it('after native403 neither failed retry nor cache-only success unmasks body; actual fresh200 is required', async () => {
    const fetch = network();
    const { node, client, key } = await mount();
    fetch.mockResolvedValueOnce(response('FORBIDDEN', 403));
    await click(node, 'actions.refresh');
    fetch.mockResolvedValueOnce(response('UNAVAILABLE', 503));
    await click(node, 'actions.retry');
    expect(node.textContent).not.toContain('97');
    await act(async () => {
      client.setQueryData(key, pulse());
    });
    await flush();
    expect(node.textContent).not.toContain('97');
    await click(node, 'actions.retry');
    expect(node.textContent).toContain('admin.overview.aggregateEnforced');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(['fetching', 'paused'] as const)(
    'imperative %s cache blocks a previously rendered shortcut before observer notification',
    async (fetchStatus) => {
      const fetch = network();
      const { node, client, key } = await mount();
      const target = button(node, 'pages.policies.title');
      client.getQueryCache().find({ queryKey: key, exact: true })!.setState({ fetchStatus });
      await act(async () => target.click());
      await flush();
      expect(node.querySelector('output')?.textContent).toBe('/approvals/admin/overview');
      expectHistorical(node);
      await click(node, 'actions.refresh');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it.each([403, 503])(
    'first cached native %s before observer blocks navigation and updates mask/history',
    async (status) => {
      network();
      const { node, client, key } = await mount();
      const target = button(node, 'pages.policies.title');
      client
        .getQueryCache()
        .find({ queryKey: key, exact: true })!
        .setState({ status: 'error', fetchStatus: 'idle', error: new HttpError('Failed', status) });
      await act(async () => target.click());
      await flush();
      expect(node.querySelector('output')?.textContent).toBe('/approvals/admin/overview');
      if (status === 403) expect(node.textContent).not.toContain('97');
      else expectHistorical(node);
    }
  );
  it.each(['route', 'scope', 'expiry', 'pending'] as const)(
    'target PAGE %s revocation blocks an already-rendered policy control',
    async (change) => {
      network();
      const { node, render } = await mount();
      const target = button(node, 'pages.policies.title');
      const decisions = fixture.routes;
      const decision = decisions[PAGE('policies')];
      if (decision?.state !== 'allowed') throw new Error('Missing allowed PAGE fixture');
      if (change === 'route') decisions[PAGE('policies')] = { state: 'route-denied' };
      if (change === 'scope')
        decisions[PAGE('policies')] = {
          ...decision,
          scope: { ...decision.scope, key: 'scope:operations' },
        };
      if (change === 'expiry')
        decisions[PAGE('policies')] = { ...decision, revalidateAt: new Date(NOW).toISOString() };
      if (change === 'pending') fixture.canary.pendingRoutes = { [PAGE('policies')]: true };
      await act(async () => target.click());
      await flush();
      expect(node.querySelector('output')?.textContent).toBe('/approvals/admin/overview');
      await act(async () => render());
      if (change !== 'scope') expect(node.textContent).not.toContain('pages.policies.title');
    }
  );
  it('overview PAGE revocation blocks even the previously-rendered scoped refresh', async () => {
    const fetch = network();
    const { node } = await mount();
    const refresh = button(node, 'actions.refresh');
    fixture.routes[PAGE('overview')] = { state: 'route-denied' };
    await act(async () => refresh.click());
    await flush();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['admin.overdueTasks', '/approvals/admin/operations?queue=sla&scope=scope%3Aoperations'],
    [
      'admin.failedIntegrations',
      '/approvals/admin/operations?queue=delivery&scope=scope%3Aoperations',
    ],
    ['admin.assurance.segregation.title', '/approvals/admin/policies?scope=scope%3Apolicies'],
  ])(
    'actual exception %s opens its typed destination with target PAGE scope',
    async (label, destination) => {
      network();
      const { node, client, key } = await mount();
      await act(async () =>
        client.setQueryData(
          key,
          pulse({
            overdueTasks: 3,
            failedIntegrations: 1,
            assurance: [{ key: 'segregation', state: 'ATTENTION', exceptions: 2 }],
          })
        )
      );
      await flush();
      await click(node, label);
      expect(node.querySelector('output')?.textContent).toBe(destination);
    }
  );
  it('policy exception and signature PAGE remain independently reachable when operations/workflows are denied', async () => {
    network();
    fixture.routes[PAGE('operations')] = { state: 'route-denied' };
    fixture.routes[PAGE('workflows')] = { state: 'route-denied' };
    const { node, client, key } = await mount();
    await act(async () =>
      client.setQueryData(
        key,
        pulse({
          overdueTasks: 3,
          assurance: [{ key: 'segregation', state: 'ATTENTION', exceptions: 2 }],
        })
      )
    );
    await flush();
    expect(node.textContent).not.toContain('pages.operations.title');
    expect(node.textContent).not.toContain('pages.workflows.title');
    expect(button(node, 'pages.signatures.title')).toBeDefined();
    await click(node, 'admin.assurance.segregation.title');
    expect(node.querySelector('output')?.textContent).toBe(
      '/approvals/admin/policies?scope=scope%3Apolicies'
    );
  });
  it('actual 20s timer revalidates locally, marks held response historical, then uses new client receipt time', async () => {
    vi.mocked(Date.now).mockRestore();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetch = network();
    const { node } = await mount();
    hold(fetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expectHistorical(node);
    await act(async () => {
      pendingReads.shift()!();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(node.textContent).toContain('admin.overview.aggregateEnforced');
    expect(node.textContent).not.toContain('admin.overview.historical');
  });
  it('clock expiry without observer rerender blocks a shortcut synchronously', async () => {
    network();
    const { node } = await mount();
    const target = button(node, 'pages.signatures.title');
    vi.spyOn(Date, 'now').mockReturnValue(NOW + 20_000);
    await act(async () => target.click());
    expect(node.querySelector('output')?.textContent).toBe('/approvals/admin/overview');
  });
  it.each([
    [409, 'SCOPE_CONTEXT_EXPIRED'],
    [503, 'AUTHORITY_RESOLUTION_UNAVAILABLE'],
  ])('native HTTP %s/%s masks history instead of generic503 fallback', async (status, code) => {
    const fetch = network();
    const { node } = await mount();
    fetch.mockResolvedValueOnce(response(code, Number(status)));
    await click(node, 'actions.refresh');
    expect(node.textContent).not.toContain('97');
    expect(node.textContent).not.toContain('admin.overview.historical');
    expect(node.textContent).not.toContain('admin.assurance.states.enforced');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never automatically retries denied source at the 20s interval', async () => {
    vi.mocked(Date.now).mockRestore();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetch = network();
    const { node } = await mount();
    fetch.mockResolvedValue(response('FORBIDDEN', 403));
    await click(node, 'actions.refresh');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(node.textContent).not.toContain('97');
  });
  it('network reconnect cannot automatically re-read the denied source', async () => {
    const fetch = network();
    const { node } = await mount();
    fetch.mockResolvedValueOnce(response('FORBIDDEN', 403));
    await click(node, 'actions.refresh');
    vi.mocked(Date.now).mockReturnValue(NOW + 20_000);
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(node.textContent).not.toContain('97');
  });
  it('child remount cannot automatically re-read cached native denial', async () => {
    const fetch = network();
    const { node, root, render, client } = await mount();
    fetch.mockResolvedValueOnce(response('FORBIDDEN', 403));
    await click(node, 'actions.refresh');
    vi.mocked(Date.now).mockReturnValue(NOW + 20_000);
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <div />
        </QueryClientProvider>
      )
    );
    await act(async () => render());
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(node.textContent).not.toContain('97');
  });
  it('late old-actor response cannot populate the new actor cache or clear its native denial', async () => {
    const fetch = network();
    const { node, render, client, key } = await mount();
    hold(fetch, pulse({ activeRequests: 111 }));
    await click(node, 'actions.refresh');
    const original = fixture.scope;
    fixture.scope = {
      ...original,
      cacheKey: ['1', '14', 'NORMAL', 'approvals.admin', 'scope:overview', 'psr-direct-route'],
    };
    fetch.mockResolvedValueOnce(response('FORBIDDEN', 403));
    await act(async () => render());
    await flush();
    expect(node.textContent).not.toContain('97');
    const newKey = ['approvals', 'admin', 'overview', ...fixture.scope.cacheKey];
    await act(async () => pendingReads.shift()!());
    await flush();
    expect(client.getQueryData(newKey)).toBeUndefined();
    expect(client.getQueryData<ApprovalAdminPulse>(key)?.activeRequests).toBe(97);
    expect(node.textContent).not.toContain('111');
    expect(node.textContent).not.toContain('admin.overview.quickAccess');
  });
  it('returning to the same actor cache still fences the earlier epoch response', async () => {
    const fetch = network();
    const { node, render } = await mount();
    hold(fetch, pulse({ activeRequests: 111 }));
    await click(node, 'actions.refresh');
    const original = fixture.scope;
    fixture.scope = {
      ...original,
      cacheKey: ['1', '14', 'NORMAL', 'approvals.admin', 'scope:overview', 'psr-direct-route'],
    };
    await act(async () => render());
    await flush();
    fixture.scope = original;
    await act(async () => render());
    await flush();
    fetch.mockResolvedValueOnce(response('FORBIDDEN', 403));
    await click(node, 'actions.refresh');
    await act(async () => pendingReads.shift()!());
    await flush();
    expect(node.textContent).not.toContain('111');
    expect(node.textContent).not.toContain('97');
    expect(node.textContent).not.toContain('admin.overview.quickAccess');
  });
});
