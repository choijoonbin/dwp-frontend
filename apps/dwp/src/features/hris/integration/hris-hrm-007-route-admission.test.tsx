// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceEvaluationData } from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { AllowedSurfaceDecision } from '../../../components/product-surface-context';
import type { Hrm007QueryId } from '../people/hrm-007-workbench';

const state = vi.hoisted(() => ({
  pageDecision: null as unknown,
  requestScope: null as unknown,
  snapshot: undefined as unknown,
  evaluateProduct: vi.fn(),
  renderedProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedExactProductRoute: () => state.pageDecision,
}));

vi.mock('../../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ...(state.requestScope as Record<string, unknown>),
    queryMeta: {
      ...((state.requestScope as { queryMeta?: Record<string, unknown> } | null)?.queryMeta ?? {}),
    },
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: { tenantId: 'tenant-7', userId: 'actor-9' } }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/product-surface-context-provider', () => ({
  useProductSurfaceAuthority: () => ({
    status: 'ready',
    snapshot: state.snapshot,
    serverNowMs: Date.now(),
    evaluateProduct: state.evaluateProduct,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'en', language: 'en' },
    t: (key: string) => key,
  }),
}));

vi.mock('../people/hrm-007-workbench', async (importOriginal) => {
  const actual = await importOriginal<object>();
  const capture = (props: Record<string, unknown>) => {
    state.renderedProps = props;
    return null;
  };
  return {
    ...actual,
    Hrm007TeamPeopleChangesPage: capture,
    Hrm007AppointmentsPage: capture,
    Hrm007PeopleEmploymentPage: capture,
  };
});

import {
  HRM007_DATA_ROUTE_CONTRACTS,
  HRM007_PAGE_ROUTE_CONTRACTS,
  HrisHrm007AppointmentsRouteAdmission,
  HrisHrm007PeopleEmploymentRouteAdmission,
  HrisHrm007TeamPeopleChangesRouteAdmission,
  parseHrm007RouteQueryOptions,
  resolveHrm007DataAdmissionLease,
} from './hris-hrm-007-route-admission';

const REVISION = 'decision-r7-hrm007';
const SCOPE = `scope-${'7'.repeat(32)}`;
const FUTURE = '2099-01-01T00:00:00.000Z';

const CASES: ReadonlyArray<
  Readonly<{
    queryId: Hrm007QueryId;
    surfaceId: 'hcm.team' | 'hcm.operations' | 'hcm.management';
    capability: string;
    path: string;
    component: ComponentType;
  }>
> = [
  {
    queryId: 'IAQ-005',
    surfaceId: 'hcm.team',
    capability: 'hcm.team.people-change.view',
    path: '/hr/team/people-changes',
    component: HrisHrm007TeamPeopleChangesRouteAdmission,
  },
  {
    queryId: 'IAQ-007',
    surfaceId: 'hcm.operations',
    capability: 'hcm.operations.people.view',
    path: '/hr/operations/people/appointments',
    component: HrisHrm007AppointmentsRouteAdmission,
  },
  {
    queryId: 'IAQ-013',
    surfaceId: 'hcm.management',
    capability: 'hcm.configuration.workbench.view',
    path: '/hr/settings/people-employment',
    component: HrisHrm007PeopleEmploymentRouteAdmission,
  },
];

function authorityFixture(testCase: (typeof CASES)[number]): {
  snapshot: TrustedProductSurfaceAuthoritySnapshot;
  page: AllowedSurfaceDecision;
  data: ProductSurfaceEvaluationData;
} {
  const scope = {
    key: SCOPE,
    kind: testCase.surfaceId === 'hcm.team' ? ('TARGET_POPULATION' as const) : ('TENANT' as const),
    displayName: 'Authorized HR scope',
    isDefault: true,
    readOnly: true,
  };
  const grant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: testCase.capability,
    resolvedCapabilityCode: 'VIEW',
    authorityMode: 'PERMISSION_AND_RELATIONSHIP' as const,
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    scopeKeys: [SCOPE],
    requiresProductEntitlement: true,
    readOnly: true,
    activationState: 'ACTIVE',
  };
  const context = {
    contextKey: `${testCase.surfaceId}-hrm007`,
    productKey: 'hcm',
    surfaceKey: testCase.surfaceId,
    plane: 'management' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'MANAGEMENT' as const,
    appResourceKey: 'APP.HCM',
    effectiveGrants: [grant],
    scopes: [scope],
    revalidateAt: FUTURE,
  };
  const snapshot = {
    envelope: {
      contractVersion: '2',
      decisionRevision: REVISION,
      sourceRevisions: {
        auth: 'auth-v260',
        policy: 'product-authorization-v51',
        productRelationship: 'relationship-v51',
        targetPopulation: 'population-v51',
        support: null,
        tenantControl: 'tenant-control-v51',
      },
      activeAccessMode: 'NORMAL' as const,
      generatedAt: '2026-10-18T00:00:00.000Z',
      contexts: [context],
      rollouts: [],
    },
    receivedAtMs: Date.now(),
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse(FUTURE),
  } as TrustedProductSurfaceAuthoritySnapshot;
  return {
    snapshot,
    page: {
      state: 'allowed',
      context,
      routeGrantRef: `${HRM007_PAGE_ROUTE_CONTRACTS[testCase.queryId]}:grant`,
      scope,
      effectiveReadOnly: true,
      revalidateAt: FUTURE,
      decisionRevision: REVISION,
    },
    data: {
      decision: 'ALLOWED',
      decisionRevision: REVISION,
      context,
      routeGrantRef: `${HRM007_DATA_ROUTE_CONTRACTS[testCase.queryId]}:grant`,
      scope,
      effectiveReadOnly: true,
      revalidateAt: FUTURE,
    },
  };
}

function requestScope(testCase: (typeof CASES)[number]) {
  return {
    governed: true,
    ready: true,
    contextScopeKey: SCOPE,
    cacheKey: ['tenant-7', 'actor-9', 'NORMAL', testCase.surfaceId, SCOPE, REVISION],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-7',
      actorId: 'actor-9',
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: testCase.surfaceId,
      contextScopeKey: SCOPE,
      decisionRevision: REVISION,
    },
  };
}

let host: HTMLDivElement;
let root: Root;

function mount(element: ReactElement, path: string) {
  act(() => {
    root.render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

describe('R7 HRM-007 central production admission', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_HRIS_HRM_007_ENABLED', 'false');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    state.evaluateProduct.mockReset();
    state.renderedProps = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps the production wrapper default-off with zero DATA evaluation or preview scope injection', () => {
    const testCase = CASES[0]!;
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    state.evaluateProduct.mockResolvedValue(fixture.data);

    mount(createElement(testCase.component), `${testCase.path}?scope=${SCOPE}`);

    expect(state.evaluateProduct).not.toHaveBeenCalled();
    expect(state.renderedProps?.gate).toEqual({
      feature: 'HRIS_HRM_APPOINTMENT_WORKBENCH',
      enabled: false,
      tenantEnrolled: false,
    });
    expect(state.renderedProps?.admission).toBeUndefined();
    expect(state.renderedProps).not.toHaveProperty('scope');
  });

  it.each(CASES)(
    'admits $queryId only after its exact PAGE and DATA decisions share the current scope/revision',
    async (testCase) => {
      vi.stubEnv('VITE_HRIS_HRM_007_ENABLED', 'true');
      const fixture = authorityFixture(testCase);
      state.snapshot = fixture.snapshot;
      state.pageDecision = fixture.page;
      state.requestScope = requestScope(testCase);
      state.evaluateProduct.mockResolvedValue(fixture.data);

      mount(createElement(testCase.component), `${testCase.path}?scope=${SCOPE}&tab=overview`);
      expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.waitFor(() => expect(state.renderedProps?.admission).toBeDefined());
      });

      expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
      expect(state.evaluateProduct).toHaveBeenCalledWith(
        {
          subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: testCase.surfaceId },
          routeContractKey: HRM007_DATA_ROUTE_CONTRACTS[testCase.queryId],
          contextScopeKey: SCOPE,
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(state.renderedProps?.admission).toMatchObject({
        kind: 'TRUSTED_PRODUCT_SURFACE_PAGE',
        queryId: testCase.queryId,
        tenantId: 'tenant-7',
        actorId: 'actor-9',
        contextScopeKey: SCOPE,
        decisionRevision: REVISION,
      });
      expect(state.renderedProps?.adapter).toMatchObject({ kind: 'HRIS_HRM_007_ENTRY_QUERY_V1' });
      expect(state.renderedProps).not.toHaveProperty('scope');
      expect(state.renderedProps).not.toHaveProperty('onDelegateAction');
    }
  );

  it('shows a non-denial pending state while the exact DATA decision is unresolved', async () => {
    vi.stubEnv('VITE_HRIS_HRM_007_ENABLED', 'true');
    const testCase = CASES[0]!;
    const fixture = authorityFixture(testCase);
    const evaluation = deferred<ProductSurfaceEvaluationData>();
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    state.evaluateProduct.mockReturnValue(evaluation.promise);

    mount(createElement(testCase.component), `${testCase.path}?scope=${SCOPE}`);

    expect(host.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
    expect(state.renderedProps).toBeUndefined();
    await act(async () => {
      evaluation.resolve(fixture.data);
      await evaluation.promise;
    });
  });

  it('fails closed when DATA authority does not carry the exact query capability and revision', () => {
    const testCase = CASES[1]!;
    const fixture = authorityFixture(testCase);
    expect(
      resolveHrm007DataAdmissionLease(
        testCase.queryId,
        fixture.data,
        { contextScopeKey: SCOPE, decisionRevision: REVISION },
        fixture.snapshot,
        Date.now()
      )
    ).toEqual({ serverDeadlineMs: Date.parse(FUTURE) });
    expect(
      resolveHrm007DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, decisionRevision: 'foreign-revision' },
        { contextScopeKey: SCOPE, decisionRevision: REVISION },
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
    const context = fixture.data.context!;
    expect(
      resolveHrm007DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, context: { ...context, effectiveGrants: [] } },
        { contextScopeKey: SCOPE, decisionRevision: REVISION },
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
  });

  it('parses only canonical URL state and rejects mismatched scope or loose dates', () => {
    const valid = parseHrm007RouteQueryOptions(
      'IAQ-007',
      new URLSearchParams(
        `scope=${SCOPE}&tab=overview&focus=appointment-7&sort=appointment:DESC&asOf=2026-10-18T00:00:00Z&filter[assignment][codes]=ACTIVE&filter[employment][activeOn]=2026-10-18`
      ),
      { key: SCOPE }
    );
    expect(valid).toEqual({
      state: 'valid',
      options: {
        filter: {
          assignment: { codes: ['ACTIVE'] },
          employment: { activeOn: '2026-10-18' },
        },
        sort: ['appointment:DESC', 'itemPublicId:ASC'],
        asOf: '2026-10-18T00:00:00Z',
      },
    });
    expect(
      parseHrm007RouteQueryOptions(
        'IAQ-007',
        new URLSearchParams(`scope=foreign&asOf=2026-10-18`),
        { key: SCOPE }
      )
    ).toEqual({ state: 'invalid' });
    expect(
      parseHrm007RouteQueryOptions(
        'IAQ-013',
        new URLSearchParams(`scope=${SCOPE}&navigationScope=TENANT&legalEntityPublicId=bad`),
        { key: SCOPE }
      )
    ).toEqual({ state: 'invalid' });
    expect(
      parseHrm007RouteQueryOptions(
        'IAQ-007',
        new URLSearchParams(`scope=${SCOPE}&filter[unmapped][codes]=ACTIVE`),
        { key: SCOPE }
      )
    ).toEqual({ state: 'invalid' });
  });
});
