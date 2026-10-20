// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pageDecision: null as unknown,
  authorityStatus: 'ready' as 'ready' | 'authority-unavailable',
  authoritySnapshot: undefined as unknown,
  serverNowMs: 0,
  evaluateProduct: vi.fn(),
  prepare: vi.fn(),
  organizationProps: undefined as Record<string, unknown> | undefined,
  payrollProps: undefined as Record<string, unknown> | undefined,
  operationsProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedExactProductRoute: () => state.pageDecision,
}));

vi.mock('../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => state.prepare,
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: { tenantId: 'tenant-7', userId: 'actor-9' } }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/product-surface-context-provider', () => ({
  useProductSurfaceAuthority: () => ({
    status: state.authorityStatus,
    snapshot: state.authoritySnapshot,
    serverNowMs: state.serverNowMs,
    evaluateProduct: state.evaluateProduct,
  }),
}));

vi.mock('../people/organization-positions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  HrisOrganizationPositionsWorkspace: (props: Record<string, unknown>) => {
    state.organizationProps = props;
    return null;
  },
}));

vi.mock('../payroll/population', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  HrisPayrollPopulationWorkspace: (props: Record<string, unknown>) => {
    state.payrollProps = props;
    return null;
  },
}));

vi.mock('../administration/operations', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  HrisOperationsWorkspace: (props: Record<string, unknown>) => {
    state.operationsProps = props;
    if (props.admission) {
      const dataSource = props.dataSource as { entry?: () => unknown } | undefined;
      void dataSource?.entry?.();
    }
    return null;
  },
}));

import {
  HRIS_OPERATIONS_TARGET_SCOPE_PARAM,
  HrisOperationsRouteAdmission,
  HrisOrganizationPositionsRouteAdmission,
  HrisPayrollPopulationRouteAdmission,
  resolveHrisFeaturePageAdmission,
} from './hris-feature-route-admission';

import type { AllowedSurfaceDecision } from '../../shell/product-surface-context';
import type { HrisOperationsDataSource } from '../administration/operations';
import type { PayrollPopulationDataSource } from '../payroll/population';

const PAGE_SCOPE = `scope-${'1'.repeat(32)}`;
const TARGET_SCOPE = `scope-${'2'.repeat(32)}`;
const REVISION = 'decision-r7-1';
const FUTURE = '2099-01-01T00:00:00.000Z';

function authoritySnapshot(revalidateAt = FUTURE) {
  const scope = {
    key: TARGET_SCOPE,
    kind: 'TARGET_POPULATION',
    displayName: 'Exception package',
    isDefault: true,
    readOnly: true,
  };
  return {
    envelope: {
      contractVersion: '2',
      decisionRevision: REVISION,
      sourceRevisions: {
        auth: 'auth-r7',
        policy: 'policy-r7',
        productRelationship: 'relationship-r7',
        targetPopulation: 'population-r7',
        support: null,
        tenantControl: 'tenant-control-r7',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-10-17T00:00:00.000Z',
      contexts: [
        {
          contextKey: 'hcm-operations-authority',
          productKey: 'hcm',
          surfaceKey: 'hcm.operations',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.HCM',
          effectiveGrants: [],
          scopes: [scope],
          revalidateAt,
        },
      ],
      rollouts: [],
    },
    receivedAtMs: Date.now(),
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse(revalidateAt),
  };
}

let host: HTMLDivElement;
let root: Root;

function decision(
  surfaceKey: 'hcm.operations' | 'hcm.management',
  scopeKey = PAGE_SCOPE,
  revalidateAt = FUTURE
): AllowedSurfaceDecision {
  const scope = {
    key: scopeKey,
    kind: surfaceKey === 'hcm.operations' ? ('TARGET_POPULATION' as const) : ('TENANT' as const),
    displayName: 'Selected scope',
    isDefault: true,
    readOnly: false,
  };
  return {
    state: 'allowed',
    context: {
      contextKey: `${surfaceKey}-context`,
      productKey: 'hcm',
      surfaceKey,
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [],
      scopes: [scope],
      revalidateAt,
    },
    routeGrantRef: 'grant-r7-page',
    scope,
    effectiveReadOnly: false,
    revalidateAt,
    decisionRevision: REVISION,
  };
}

function allowedDataDecision(scopeKey = TARGET_SCOPE, revalidateAt = FUTURE) {
  const scope = {
    key: scopeKey,
    kind: 'TARGET_POPULATION',
    displayName: 'Exception package',
    isDefault: true,
    readOnly: true,
  };
  return {
    decision: 'ALLOWED' as const,
    decisionRevision: REVISION,
    context: {
      contextKey: 'hcm-operations-data',
      productKey: 'hcm',
      surfaceKey: 'hcm.operations',
      plane: 'management',
      accessMode: 'NORMAL' as const,
      accessSource: 'MANAGEMENT' as const,
      appResourceKey: 'APP.HCM',
      effectiveGrants: [],
      scopes: [scope],
      revalidateAt,
    },
    routeGrantRef: 'grant-r7-data',
    scope,
    effectiveReadOnly: true,
    revalidateAt,
  };
}

function dataDecision(allowed: boolean, scopeKey = TARGET_SCOPE, revalidateAt = FUTURE) {
  return allowed
    ? allowedDataDecision(scopeKey, revalidateAt)
    : { decision: 'ROUTE_DENIED' as const, decisionRevision: REVISION };
}

function mount(element: ReactElement, search = '') {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/hr/settings/operations${search}`]}>{element}</MemoryRouter>
    );
  });
}

function operationsDataSource(): HrisOperationsDataSource {
  return {
    entry: vi.fn().mockResolvedValue(undefined),
    exceptions: vi.fn().mockResolvedValue(undefined),
    detail: vi.fn().mockResolvedValue(undefined),
    receipt: vi.fn().mockResolvedValue(undefined),
  } as unknown as HrisOperationsDataSource;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('R7 exact feature route admission', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    state.pageDecision = null;
    state.authorityStatus = 'ready';
    state.authoritySnapshot = authoritySnapshot();
    state.serverNowMs = Date.now();
    state.evaluateProduct.mockReset();
    state.prepare.mockReset();
    state.organizationProps = undefined;
    state.payrollProps = undefined;
    state.operationsProps = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('admits HRM and PAY only from their exact PAGE surface and typed owner binding', () => {
    state.pageDecision = decision('hcm.operations');

    mount(createElement(HrisOrganizationPositionsRouteAdmission));
    expect(state.organizationProps?.admission).toMatchObject({
      feature: 'HRIS_ORGANIZATION_POSITIONS',
      pageRouteContractKey: 'route.hcm.operations.organization-positions.page',
      contextScopeKey: PAGE_SCOPE,
    });
    expect(state.organizationProps?.adapter).toMatchObject({
      kind: 'HRIS_ORGANIZATION_POSITIONS_V2',
    });

    const payrollDataSource = {
      population: vi.fn(),
      prepare: vi.fn(),
    } as unknown as PayrollPopulationDataSource;
    mount(createElement(HrisPayrollPopulationRouteAdmission, { dataSource: payrollDataSource }));
    expect(state.payrollProps?.admission).toMatchObject({
      feature: 'HRIS_PAYROLL_RUN_PREPARE',
      pageRouteContractKey: 'route.hcm.operations.payroll-population.page',
      tenantId: 'tenant-7',
    });
    expect(state.payrollProps?.ownerBinding).toMatchObject({
      page: { routeContractKey: 'route.hcm.operations.payroll-population.page' },
      data: {
        contractId: 'IAQ-014',
        routeContractKey: 'route.hcm.operations.payroll-support.data',
      },
      prepare: {
        contractId: 'PEP-PAY-011',
        routeContractKey: 'route.hcm.operations.payroll-run.action',
      },
    });
  });

  it('rejects a surface-level or mismatched PAGE boundary', () => {
    expect(resolveHrisFeaturePageAdmission('HRIS_ORGANIZATION_POSITIONS', null)).toBeNull();
    expect(
      resolveHrisFeaturePageAdmission('HRIS_ORGANIZATION_POSITIONS', decision('hcm.management'))
    ).toBeNull();
  });

  it.each([
    {
      name: 'PAGE-only',
      search: `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`,
      mode: 'none',
    },
    {
      name: 'one missing DATA decision',
      search: `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`,
      mode: 'one',
    },
    { name: 'missing TARGET_POPULATION', search: '', mode: 'both' },
    {
      name: 'PAGE CONFIG_SCOPE substitution',
      search: `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${PAGE_SCOPE}`,
      mode: 'both',
    },
  ])('keeps SYS closed with zero workspace calls for $name', async ({ search, mode }) => {
    const dataSource = operationsDataSource();
    state.pageDecision = decision('hcm.management');
    state.evaluateProduct.mockImplementation(async (request: { routeContractKey: string }) =>
      dataDecision(
        mode === 'both' ||
          (mode === 'one' && request.routeContractKey === 'route.hcm.operations.exception.data')
      )
    );

    mount(createElement(HrisOperationsRouteAdmission, { dataSource }), search);
    await act(async () => Promise.resolve());

    expect(state.operationsProps?.admission).toBeUndefined();
    expect(dataSource.entry).not.toHaveBeenCalled();
    expect(dataSource.exceptions).not.toHaveBeenCalled();
    expect(dataSource.detail).not.toHaveBeenCalled();
    expect(dataSource.receipt).not.toHaveBeenCalled();
    if (!search || search.includes(PAGE_SCOPE)) {
      expect(state.evaluateProduct).not.toHaveBeenCalled();
    }
  });

  it('mounts SYS only after both exact DATA decisions bind the independent target population', async () => {
    const dataSource = operationsDataSource();
    state.pageDecision = decision('hcm.management');
    state.evaluateProduct.mockResolvedValue(dataDecision(true));

    mount(
      createElement(HrisOperationsRouteAdmission, { dataSource }),
      `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`
    );
    await act(async () => Promise.resolve());
    expect(state.evaluateProduct).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.waitFor(() => expect(state.operationsProps?.admission).toBeDefined());
    });

    expect(
      state.evaluateProduct.mock.calls.map(
        ([request]) => (request as { routeContractKey: string }).routeContractKey
      )
    ).toEqual([
      'route.hcm.operations.exception.data',
      'route.hcm.operations.exception-detail.data',
    ]);
    expect(state.operationsProps?.admission).toMatchObject({
      kind: 'TRUSTED_PRODUCT_SURFACE_PAGE_AND_DATA',
      pageContextScopeKind: 'CONFIG_SCOPE',
      targetPopulationScopeKey: TARGET_SCOPE,
    });
    expect(dataSource.entry).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'unknown access mode',
      () => {
        const value = allowedDataDecision();
        return { ...value, context: { ...value.context, accessMode: 'FUTURE_MODE' } };
      },
    ],
    [
      'support source in a normal session',
      () => {
        const value = allowedDataDecision();
        return { ...value, context: { ...value.context, accessSource: 'SUPPORT' } };
      },
    ],
    [
      'foreign app resource',
      () => {
        const value = allowedDataDecision();
        return { ...value, context: { ...value.context, appResourceKey: 'APP.OTHER' } };
      },
    ],
    [
      'expired selected scope',
      () => {
        const value = allowedDataDecision();
        const scope = { ...value.scope, validUntil: '2020-01-01T00:00:00.000Z' };
        return { ...value, scope, context: { ...value.context, scopes: [scope] } };
      },
    ],
    [
      'malformed grant',
      () => {
        const value = allowedDataDecision();
        return {
          ...value,
          context: {
            ...value.context,
            effectiveGrants: [{ grantKind: 'CAPABILITY' }],
          },
        };
      },
    ],
  ])('rejects malformed DATA authority for %s with zero workspace calls', async (_name, value) => {
    const dataSource = operationsDataSource();
    state.pageDecision = decision('hcm.management');
    state.evaluateProduct.mockResolvedValue(value());

    mount(
      createElement(HrisOperationsRouteAdmission, { dataSource }),
      `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.operationsProps?.admission).toBeUndefined();
    expect(dataSource.entry).not.toHaveBeenCalled();
    expect(dataSource.exceptions).not.toHaveBeenCalled();
    expect(dataSource.detail).not.toHaveBeenCalled();
    expect(dataSource.receipt).not.toHaveBeenCalled();
  });

  it('rejects a DATA pair that resolves after the PAGE lease expires', async () => {
    vi.useFakeTimers();
    const nowMs = Date.parse('2026-10-17T01:00:00.000Z');
    vi.setSystemTime(nowMs);
    const pageDeadline = new Date(nowMs + 100).toISOString();
    const dataDeadline = new Date(nowMs + 2_000).toISOString();
    state.authoritySnapshot = authoritySnapshot(dataDeadline);
    state.pageDecision = decision('hcm.management', PAGE_SCOPE, pageDeadline);
    const list = deferred<ReturnType<typeof allowedDataDecision>>();
    const detail = deferred<ReturnType<typeof allowedDataDecision>>();
    state.evaluateProduct.mockReturnValueOnce(list.promise).mockReturnValueOnce(detail.promise);
    const dataSource = operationsDataSource();

    mount(
      createElement(HrisOperationsRouteAdmission, { dataSource }),
      `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`
    );
    await act(async () => {
      vi.advanceTimersByTime(101);
      list.resolve(allowedDataDecision(TARGET_SCOPE, dataDeadline));
      detail.resolve(allowedDataDecision(TARGET_SCOPE, dataDeadline));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.operationsProps?.admission).toBeUndefined();
    expect(dataSource.entry).not.toHaveBeenCalled();
  });

  it('clears active SYS admission at the earliest PAGE or DATA lease', async () => {
    vi.useFakeTimers();
    const nowMs = Date.parse('2026-10-17T02:00:00.000Z');
    vi.setSystemTime(nowMs);
    const listDeadline = new Date(nowMs + 1_000).toISOString();
    const detailDeadline = new Date(nowMs + 2_000).toISOString();
    const authorityDeadline = new Date(nowMs + 4_000).toISOString();
    const pageDeadline = new Date(nowMs + 5_000).toISOString();
    state.authoritySnapshot = authoritySnapshot(authorityDeadline);
    state.pageDecision = decision('hcm.management', PAGE_SCOPE, pageDeadline);
    state.evaluateProduct.mockImplementation(async (request: { routeContractKey: string }) =>
      allowedDataDecision(
        TARGET_SCOPE,
        request.routeContractKey === 'route.hcm.operations.exception.data'
          ? listDeadline
          : detailDeadline
      )
    );
    const dataSource = operationsDataSource();

    mount(
      createElement(HrisOperationsRouteAdmission, { dataSource }),
      `?${HRIS_OPERATIONS_TARGET_SCOPE_PARAM}=${TARGET_SCOPE}`
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.operationsProps?.admission).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(1_001);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.operationsProps?.admission).toBeUndefined();
  });
});
