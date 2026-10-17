// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceEvaluationData } from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { AllowedSurfaceDecision } from '../../shell/product-surface-context';
import type { Hrm009QueryId } from '../employee-services/certificates';

const state = vi.hoisted(() => ({
  pageDecision: null as unknown,
  requestScope: null as unknown,
  snapshot: undefined as unknown,
  evaluateProduct: vi.fn(),
  ownerQuery: vi.fn(),
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
    serverNowMs: Date.parse('2026-10-18T00:00:00.000Z'),
    evaluateProduct: state.evaluateProduct,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'en', language: 'en' },
    t: (key: string) => key,
  }),
}));

vi.mock('../employee-services/certificates', async (importOriginal) => {
  const actual = await importOriginal<object>();
  const capture = (props: Record<string, unknown>) => {
    state.renderedProps = props;
    return null;
  };
  return {
    ...actual,
    createHrm009QueryAdapter: () => ({
      kind: 'HRIS_HRM_009_STAGE_A_ENTRY_QUERY_V1',
      query: state.ownerQuery,
    }),
    Hrm009SelfServiceRequestsSurface: capture,
    Hrm009OperationsCertificatesSurface: capture,
  };
});

import {
  HRM009_DATA_ROUTE_CONTRACTS,
  HRM009_PAGE_ROUTE_CONTRACTS,
  HrisHrm009OperationsCertificatesRouteAdmission,
  HrisHrm009SelfServiceRequestsRouteAdmission,
  parseHrm009RouteState,
  resolveHrm009DataAdmissionLease,
} from './hris-hrm-009-route-admission';

const REVISION = 'decision-r7-hrm009';
const SCOPE = `scope-${'7'.repeat(32)}`;
const FUTURE = '2099-01-01T00:00:00.000Z';

const CASES: ReadonlyArray<
  Readonly<{
    queryId: Hrm009QueryId;
    surfaceId: 'hcm.personal' | 'hcm.operations';
    plane: 'work' | 'management';
    scopeKind: 'SELF' | 'LEGAL_ENTITY';
    capability: string;
    path: string;
    component: ComponentType;
  }>
> = [
  {
    queryId: 'IAQ-003',
    surfaceId: 'hcm.personal',
    plane: 'work',
    scopeKind: 'SELF',
    capability: 'hcm.personal.requests.view',
    path: '/hr/me/requests',
    component: HrisHrm009SelfServiceRequestsRouteAdmission,
  },
  {
    queryId: 'IAQ-010',
    surfaceId: 'hcm.operations',
    plane: 'management',
    scopeKind: 'LEGAL_ENTITY',
    capability: 'hcm.operations.people.view',
    path: '/hr/operations/people/certificates-documents',
    component: HrisHrm009OperationsCertificatesRouteAdmission,
  },
];

function authorityFixture(testCase: (typeof CASES)[number]): {
  snapshot: TrustedProductSurfaceAuthoritySnapshot;
  page: AllowedSurfaceDecision;
  data: ProductSurfaceEvaluationData;
} {
  const scope = {
    key: SCOPE,
    kind: testCase.scopeKind,
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
    contextKey: `${testCase.surfaceId}-hrm009`,
    productKey: 'hcm',
    surfaceKey: testCase.surfaceId,
    plane: testCase.plane,
    accessMode: 'NORMAL' as const,
    accessSource: testCase.plane === 'work' ? ('RELATIONSHIP' as const) : ('MANAGEMENT' as const),
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
        auth: 'auth-v261',
        policy: 'product-authorization-v52',
        productRelationship: 'relationship-v52',
        targetPopulation: 'population-v52',
        support: 'support-v52',
        tenantControl: 'tenant-control-v52',
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
      routeGrantRef: `${HRM009_PAGE_ROUTE_CONTRACTS[testCase.queryId]}:grant`,
      scope,
      effectiveReadOnly: true,
      revalidateAt: FUTURE,
      decisionRevision: REVISION,
    },
    data: {
      decision: 'ALLOWED',
      decisionRevision: REVISION,
      context,
      routeGrantRef: `${HRM009_DATA_ROUTE_CONTRACTS[testCase.queryId]}:grant`,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;

function mount(element: ReactElement, path: string) {
  act(() => {
    root.render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
  });
}

describe('R7 HRM-009 central read-only admission', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'false');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-1111-4111-8111-111111111111',
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    state.evaluateProduct.mockReset();
    state.ownerQuery.mockReset();
    state.renderedProps = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps checked-in feature OFF at zero DATA, owner GET, and POST delegates', () => {
    const testCase = CASES[0]!;
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    state.evaluateProduct.mockResolvedValue(fixture.data);

    mount(createElement(testCase.component), testCase.path);

    expect(state.evaluateProduct).not.toHaveBeenCalled();
    expect(state.ownerQuery).not.toHaveBeenCalled();
    expect(state.renderedProps?.gate).toEqual({
      feature: 'HRIS_HRM_CERTIFICATE_WORKBENCH',
      enabled: false,
      tenantEnrolled: false,
    });
    expect(state.renderedProps).not.toHaveProperty('adapter');
    expect(state.renderedProps).not.toHaveProperty('onRequestCertificate');
  });

  it.each(CASES)(
    'evaluates $queryId DATA once only after exact PAGE evidence and mounts no ACTION delegate',
    async (testCase) => {
      vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'true');
      const fixture = authorityFixture(testCase);
      state.snapshot = fixture.snapshot;
      state.pageDecision = fixture.page;
      state.requestScope = requestScope(testCase);
      const dataResponse = deferred<ProductSurfaceEvaluationData>();
      state.evaluateProduct.mockReturnValue(dataResponse.promise);

      mount(createElement(testCase.component), `${testCase.path}?tab=overview&focus=item-7`);
      expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
      await act(async () => {
        dataResponse.resolve(fixture.data);
        await dataResponse.promise;
      });
      await vi.waitFor(() => expect(state.renderedProps?.scope).toBeDefined());

      expect(state.evaluateProduct).toHaveBeenCalledWith(
        {
          subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: testCase.surfaceId },
          routeContractKey: HRM009_DATA_ROUTE_CONTRACTS[testCase.queryId],
          contextScopeKey: SCOPE,
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(state.renderedProps?.gate).toEqual({
        feature: 'HRIS_HRM_CERTIFICATE_WORKBENCH',
        enabled: true,
        tenantEnrolled: true,
      });
      expect(state.renderedProps?.adapter).toMatchObject({
        kind: 'HRIS_HRM_009_STAGE_A_ENTRY_QUERY_V1',
      });
      expect(state.renderedProps?.initialFocusPublicId).toBe('item-7');
      expect(state.renderedProps).not.toHaveProperty('onRequestCertificate');
      expect(state.ownerQuery).not.toHaveBeenCalled();
    }
  );

  it('keeps PAGE allow plus DATA deny opaque with zero owner GET and no POST delegate', async () => {
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'true');
    const testCase = CASES[1]!;
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    const dataResponse = deferred<ProductSurfaceEvaluationData>();
    state.evaluateProduct.mockReturnValue(dataResponse.promise);

    mount(createElement(testCase.component), testCase.path);
    await act(async () => {
      dataResponse.resolve({ ...fixture.data, decisionRevision: 'foreign' });
      await dataResponse.promise;
    });
    await vi.waitFor(() => expect(state.renderedProps?.gate).toBeDefined());

    expect(state.evaluateProduct).toHaveBeenCalledOnce();
    expect(state.renderedProps?.gate).toMatchObject({ enabled: true, tenantEnrolled: false });
    expect(state.renderedProps).not.toHaveProperty('adapter');
    expect(state.renderedProps).not.toHaveProperty('onRequestCertificate');
    expect(state.ownerQuery).not.toHaveBeenCalled();
  });

  it('does not evaluate DATA for denied, stale, wrong-surface, wrong-scope, or invalid PAGE state', () => {
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'true');
    const testCase = CASES[0]!;
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.requestScope = requestScope(testCase);
    const remount = (pageDecision: unknown, path = testCase.path) => {
      act(() => root.unmount());
      root = createRoot(host);
      state.pageDecision = pageDecision;
      mount(createElement(testCase.component), path);
    };

    remount(null);
    remount({ ...fixture.page, revalidateAt: '2020-01-01T00:00:00.000Z' });
    remount({
      ...fixture.page,
      context: { ...fixture.page.context, surfaceKey: 'hcm.team' },
    });
    remount({ ...fixture.page, scope: { ...fixture.page.scope, kind: 'LEGAL_ENTITY' } });
    state.requestScope = { ...requestScope(testCase), contextScopeKey: 'scope-foreign' };
    remount(fixture.page);
    state.requestScope = requestScope(testCase);
    remount(fixture.page, `${testCase.path}/foreign?download=true`);

    expect(state.evaluateProduct).not.toHaveBeenCalled();
    expect(state.ownerQuery).not.toHaveBeenCalled();
  });

  it('fails closed on stale, wrong-revision, wrong-scope, and missing-capability DATA evidence', () => {
    const testCase = CASES[1]!;
    const fixture = authorityFixture(testCase);
    const expected = { contextScopeKey: SCOPE, decisionRevision: REVISION };
    expect(
      resolveHrm009DataAdmissionLease(
        testCase.queryId,
        fixture.data,
        expected,
        fixture.snapshot,
        Date.now()
      )
    ).toEqual({ serverDeadlineMs: Date.parse(FUTURE) });
    expect(
      resolveHrm009DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, revalidateAt: '2020-01-01T00:00:00.000Z' },
        expected,
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
    expect(
      resolveHrm009DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, decisionRevision: 'foreign' },
        expected,
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
    expect(
      resolveHrm009DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, scope: { ...fixture.data.scope!, key: 'scope-foreign' } },
        expected,
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
    expect(
      resolveHrm009DataAdmissionLease(
        testCase.queryId,
        { ...fixture.data, context: { ...fixture.data.context!, effectiveGrants: [] } },
        expected,
        fixture.snapshot,
        Date.now()
      )
    ).toBeNull();
  });

  it('accepts only the two canonical PAGE paths and bounded deep-link state', () => {
    expect(
      parseHrm009RouteState(
        'IAQ-003',
        '/hr/me/requests',
        new URLSearchParams('tab=overview&focus=request-7&navigationScope=TENANT')
      )
    ).toEqual({ state: 'valid', initialFocusPublicId: 'request-7' });
    expect(
      parseHrm009RouteState(
        'IAQ-010',
        '/hr/operations/people/certificates-documents',
        new URLSearchParams(
          'navigationScope=LEGAL_ENTITY&legalEntityPublicId=6d07e952-2f5f-4dc1-8be7-6d7e210d23af'
        )
      )
    ).toEqual({ state: 'valid' });
    expect(
      parseHrm009RouteState('IAQ-003', '/hr/services', new URLSearchParams('tab=overview'))
    ).toEqual({ state: 'invalid' });
    expect(
      parseHrm009RouteState(
        'IAQ-010',
        '/hr/operations/people/certificates-documents',
        new URLSearchParams('download=true')
      )
    ).toEqual({ state: 'invalid' });
  });
});
