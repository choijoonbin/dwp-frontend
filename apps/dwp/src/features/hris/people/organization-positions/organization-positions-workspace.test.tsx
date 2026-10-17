// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const legacy = vi.hoisted(() => ({
  chart: vi.fn(),
  scenarios: vi.fn(),
  candidates: vi.fn(),
  intelligence: vi.fn(),
  organizationMove: vi.fn(),
  positionMove: vi.fn(),
}));

const managementScope = vi.hoisted(() => ({
  governed: true,
  ready: true,
  contextScopeKey: 'scope:organization',
  cacheKey: [
    'tenant-1',
    'actor-1',
    'BUSINESS_OPERATOR',
    'hcm.management',
    'scope:organization',
    '49',
  ] as const,
  queryMeta: {
    accessSensitive: true as const,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'BUSINESS_OPERATOR',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    contextScopeKey: 'scope:organization',
    decisionRevision: '49',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getOrganizationChart: legacy.chart,
  listOrganizationScenarios: legacy.scenarios,
  listWorkforceOrganizationCandidates: legacy.candidates,
  getOrganizationIntelligence: legacy.intelligence,
  addOrganizationScenarioMove: legacy.organizationMove,
  addOrganizationScenarioPositionMove: legacy.positionMove,
  useAuth: () => ({ user: { userId: 1, tenantId: 'tenant-1', roles: ['HR_ADMIN'] } }),
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useCurrentProviderSupportContext: () => ({ data: null }),
}));

vi.mock('../../../../components/product-surface-capability-access', () => ({
  useProductSurfaceCapabilityAccess: () => ({
    governed: true,
    contextScopeKey: 'scope:organization',
    hasWritableCapability: () => true,
  }),
}));

vi.mock('../../../../components/product-page-shortcut-access', () => ({
  PRODUCT_PAGE_SHORTCUT_TARGETS: { hcmControlledExport: {} },
  appendProductPageShortcutScope: (href: string) => href,
  useProductPageShortcutAccess: () => ({ disclosed: false }),
}));

vi.mock('../../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => vi.fn(),
}));

vi.mock('../../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => managementScope,
}));

import { HrisOrganizationPositionsWorkspace } from './organization-positions-workspace';
import {
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  HRIS_ORGANIZATION_POSITIONS_FEATURE,
} from './organization-positions-contract';

import type {
  HrisOrganizationPositionsQueryAdapter,
  HrisOrganizationPositionsRuntimeGate,
  OrganizationGraphWithPositionsV2,
} from './organization-positions-contract';

const ROOT = '10000000-0000-4000-8000-000000000001';
const CHILD = '10000000-0000-4000-8000-000000000002';
const POSITION = '20000000-0000-4000-8000-000000000001';
const AS_OF = '2026-10-17T00:00:00Z';
const admitted: HrisOrganizationPositionsRuntimeGate = {
  feature: HRIS_ORGANIZATION_POSITIONS_FEATURE,
  enabled: true,
  tenantEnrolled: true,
};

function projection(includePositions = true): OrganizationGraphWithPositionsV2 {
  return {
    schemaVersion: 2,
    asOf: AS_OF,
    effectiveDate: '2026-10-17',
    rootPublicId: ROOT,
    depth: 2,
    relationshipType: 'REPORTING',
    positionsIncluded: includePositions,
    nodes: [
      { organizationPublicId: ROOT, parentPublicId: null, name: 'Global Operations', depth: 0 },
      {
        organizationPublicId: CHILD,
        parentPublicId: ROOT,
        name: 'People Operations',
        depth: 1,
      },
    ],
    positions: includePositions
      ? [
          {
            positionPublicId: POSITION,
            positionKey: 'POS-001',
            title: 'People Operations Lead',
            organizationPublicId: CHILD,
            reportsToPositionPublicId: null,
            status: 'FILLED',
            positionType: 'REGULAR',
            criticality: 'HIGH',
            budgetedFte: 1,
            annualCostAmount: null,
            costCurrency: null,
            jobProfileName: 'People leader',
            locationName: 'Seoul',
            availabilityDate: null,
            incumbentPersonPublicIds: [],
            subordinatePositionCount: 0,
          },
        ]
      : [],
  };
}

function adapter(result: OrganizationGraphWithPositionsV2 = projection()) {
  return {
    kind: HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
    query: vi.fn<HrisOrganizationPositionsQueryAdapter['query']>().mockResolvedValue(result),
  } satisfies HrisOrganizationPositionsQueryAdapter;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

async function renderWorkspace({
  source,
  gate,
  entry = `/hr/operations/people/organization-positions?tab=overview&focus=${ROOT}&root=${ROOT}&asOf=${encodeURIComponent(AS_OF)}&depth=2`,
}: {
  source?: HrisOrganizationPositionsQueryAdapter;
  gate?: HrisOrganizationPositionsRuntimeGate;
  entry?: string;
}) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <HrisOrganizationPositionsWorkspace gate={gate} adapter={source} now={AS_OF} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    );
  });
}

async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(document.body.textContent).toContain(text));
  });
}

describe('HRIS organization positions runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion') || query.includes('forced-colors'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.values(legacy).forEach((call) => call.mockReset());
    legacy.chart.mockReturnValue(new Promise(() => undefined));
    legacy.scenarios.mockReturnValue(new Promise(() => undefined));
    legacy.candidates.mockReturnValue(new Promise(() => undefined));
    legacy.intelligence.mockReturnValue(new Promise(() => undefined));
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each([
    ['default absent', undefined],
    [
      'explicit off',
      { feature: HRIS_ORGANIZATION_POSITIONS_FEATURE, enabled: false, tenantEnrolled: true },
    ],
    [
      'tenant unenrolled',
      { feature: HRIS_ORGANIZATION_POSITIONS_FEATURE, enabled: true, tenantEnrolled: false },
    ],
  ])('keeps %s opaque and makes zero owner or management calls', async (_label, gate) => {
    const source = adapter();
    await renderWorkspace({ source, gate });
    expect(document.querySelector('[data-runtime-state="unavailable"]')).not.toBeNull();
    expect(source.query).not.toHaveBeenCalled();
    Object.values(legacy).forEach((call) => expect(call).not.toHaveBeenCalled());
  });

  it('runs only the canonical query after admission and supports keyboard-focusable inspection', async () => {
    const source = adapter();
    await renderWorkspace({ source, gate: admitted });
    await shown('Global Operations');

    expect(source.query).toHaveBeenCalledTimes(1);
    expect(source.query).toHaveBeenCalledWith(
      {
        asOf: AS_OF,
        rootPublicId: ROOT,
        depth: 2,
        relationshipType: 'REPORTING',
        includePositions: true,
      },
      expect.any(AbortSignal)
    );
    Object.values(legacy).forEach((call) => expect(call).not.toHaveBeenCalled());
    expect(document.querySelector('[data-graph-state="complete"]')).not.toBeNull();
    expect(document.querySelector('aside')?.textContent).toContain('Global Operations');
    expect(document.querySelector('[data-testid="location-search"]')?.textContent).toContain(
      `focus=${ROOT}`
    );

    const inspect = [...document.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Inspect organization People Operations'
    );
    expect(inspect).not.toBeNull();
    await act(async () => inspect?.focus());
    expect(document.activeElement).toBe(inspect);
    await act(async () => inspect?.click());
    expect(document.querySelector('aside')?.textContent).toContain('People Operations');
    await act(async () => {
      await vi.waitFor(() =>
        expect(document.querySelector('[data-testid="location-search"]')?.textContent).toContain(
          `focus=${CHILD}`
        )
      );
    });
    const returnButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Return to graph'
    );
    await act(async () => returnButton?.click());
    const location = document.querySelector('[data-testid="location-search"]')?.textContent ?? '';
    expect(location).toContain('tab=overview');
    expect(location).toContain(`root=${ROOT}`);
    expect(location).toContain('asOf=2026-10-17T00%3A00%3A00Z');
    expect(location).not.toContain('focus=');
  });

  it.each([
    ['unknown focus', `tab=overview&focus=90000000-0000-4000-8000-000000000099`],
    ['ambiguous selectors', `tab=overview&focus=${ROOT}&organization=${CHILD}`],
  ])('ignores %s without an inspector or a second owner query', async (_label, selectors) => {
    const source = adapter();
    await renderWorkspace({
      source,
      gate: admitted,
      entry: `/hr/operations/people/organization-positions?${selectors}&root=${ROOT}&asOf=${encodeURIComponent(AS_OF)}&depth=2`,
    });
    await shown('Global Operations');
    expect(source.query).toHaveBeenCalledTimes(1);
    expect(document.querySelector('aside')).toBeNull();
    expect(
      document.querySelector('button[aria-label^="Inspect "][aria-pressed="true"]')
    ).toBeNull();
    expect(document.querySelector('[data-testid="location-search"]')?.textContent).toContain(
      'tab=overview'
    );
  });

  it('re-keys the canonical query when a closed adapter instance changes', async () => {
    const first = adapter();
    const initialSecondGraph = projection();
    const secondGraph = {
      ...initialSecondGraph,
      nodes: initialSecondGraph.nodes.map((node, index) =>
        index === 0 ? { ...node, name: 'Replacement Operations' } : node
      ),
    };
    const nextGraph = deferred<OrganizationGraphWithPositionsV2>();
    const second = adapter();
    second.query.mockReturnValue(nextGraph.promise);
    await renderWorkspace({ source: first, gate: admitted });
    await shown('Global Operations');

    await renderWorkspace({ source: second, gate: admitted });
    expect(second.query).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Loading authorized organization structure');
    expect(document.body.textContent).not.toContain('Global Operations');
    await act(async () => nextGraph.resolve(secondGraph));
    await shown('Replacement Operations');
    expect(first.query).toHaveBeenCalledTimes(1);
    expect(second.query).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain('Global Operations');
  });

  it('renders loading while the admitted owner query is unresolved', async () => {
    const source = adapter();
    source.query.mockReturnValue(new Promise(() => undefined));
    await renderWorkspace({ source, gate: admitted });
    expect(document.body.textContent).toContain('Loading authorized organization structure');
  });

  it('renders an empty response as a distinct nonblank state', async () => {
    const source = adapter({ ...projection(), nodes: [], positions: [] });
    await renderWorkspace({ source, gate: admitted });
    await shown('No organization structure at this effective time');
    expect(document.body.textContent).not.toContain('Global Operations');
  });

  it('renders transport unavailability without cached or inferred graph data', async () => {
    const source = adapter();
    source.query.mockRejectedValue(new HttpError('Offline', 503));
    await renderWorkspace({ source, gate: admitted });
    await shown('Organization graph is temporarily unavailable');
    expect(document.body.textContent).not.toContain('Global Operations');
  });

  it('keeps the last authorized graph visible as a materially stale state after refresh failure', async () => {
    const source = adapter();
    source.query
      .mockResolvedValueOnce(projection())
      .mockRejectedValueOnce(new HttpError('Policy changed', 409));
    await renderWorkspace({ source, gate: admitted });
    await shown('Global Operations');
    const refresh = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Refresh'
    );
    await act(async () => refresh?.click());
    await shown('Showing the last authorized snapshot');
    expect(document.body.textContent).toContain('Global Operations');
  });

  it('renders an organization-only response as a distinct partial state', async () => {
    const source = adapter(projection(false));
    await renderWorkspace({
      source,
      gate: admitted,
      entry: `/hr/operations/people/organization-positions?root=${ROOT}&asOf=${encodeURIComponent(AS_OF)}&depth=2&includePositions=false`,
    });
    await shown('Organization-only projection');
    expect(document.querySelector('[data-graph-state="partial"]')).not.toBeNull();
    expect(source.query).toHaveBeenCalledWith(
      expect.objectContaining({ includePositions: false }),
      expect.any(AbortSignal)
    );
  });

  it('renders permission denial without disclosing a node identity', async () => {
    const source = adapter();
    source.query.mockRejectedValue(
      new HttpError('Denied', 403, { code: 'OPAQUE_AUTHORIZATION_DENIED' })
    );
    await renderWorkspace({ source, gate: admitted });
    await shown('Organization access is unavailable');
    expect(document.body.textContent).not.toContain('Global Operations');
    expect(document.querySelector('button[aria-label^="Inspect organization"]')).toBeNull();
  });

  it.each([
    [
      'permission withdrawal',
      new HttpError('Denied', 403, { code: 'OPAQUE_AUTHORIZATION_DENIED' }),
      'Organization access is unavailable',
    ],
    [
      'non-disclosed root',
      new HttpError('Not found', 404, { code: 'ORGANIZATION_GRAPH_NOT_FOUND' }),
      'No organization graph is available',
    ],
  ])('conceals cached graph data after %s', async (_label, failure, title) => {
    const source = adapter();
    source.query.mockResolvedValueOnce(projection()).mockRejectedValueOnce(failure);
    await renderWorkspace({ source, gate: admitted });
    await shown('Global Operations');
    const refresh = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Refresh'
    );
    await act(async () => refresh?.click());
    await shown(title);
    expect(document.body.textContent).not.toContain('Global Operations');
    expect(document.querySelector('button[aria-label^="Inspect organization"]')).toBeNull();
  });

  it('does not query until the required root is present and never shows a blank canvas', async () => {
    const source = adapter();
    await renderWorkspace({
      source,
      gate: admitted,
      entry: `/hr/operations/people/organization-positions?asOf=${encodeURIComponent(AS_OF)}`,
    });
    expect(source.query).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Choose a root organization');
  });
});
