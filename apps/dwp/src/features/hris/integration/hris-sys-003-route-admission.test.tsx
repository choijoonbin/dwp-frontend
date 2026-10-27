// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceEvaluationData } from '@dwp-frontend/shared-utils/api/auth-api';
import type { TrustedProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { AllowedSurfaceDecision } from '../../../components/product-surface-context';

const state = vi.hoisted(() => ({
  pageDecision: null as unknown,
  requestScope: null as unknown,
  snapshot: undefined as unknown,
  evaluateProduct: vi.fn(),
  workflowProps: undefined as Record<string, unknown> | undefined,
  delegationProps: undefined as Record<string, unknown> | undefined,
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

vi.mock('../administration/workflow', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    HrisWorkflowPolicyWorkspace: (props: Record<string, unknown>) => {
      state.workflowProps = props;
      return null;
    },
  };
});

vi.mock('../team/delegation', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    HrisTeamDelegationWorkspace: (props: Record<string, unknown>) => {
      state.delegationProps = props;
      return null;
    },
  };
});

import {
  HRIS_SYS_003_PAGE_ROUTE_CONTRACTS,
  HrisTeamDelegationRouteAdmission,
  HrisWorkflowPolicyRouteAdmission,
} from './hris-sys-003-route-admission';

const REVISION = 'decision-r7-sys003';
const FUTURE = '2099-01-01T00:00:00.000Z';

const CASES = [
  {
    workspace: 'SETTINGS_WORKFLOW' as const,
    component: HrisWorkflowPolicyRouteAdmission as ComponentType,
    hcmSurfaceId: 'hcm.management',
    hcmCapability: 'hcm.configuration.workflow.view',
    hcmScopeKey: `hcm-config-${'7'.repeat(24)}`,
    hcmScopeKind: 'TENANT' as const,
    approvalSurfaceId: 'approvals.admin',
    approvalCapability: 'approvals.policy.read',
    approvalRouteContractKey: 'route.approvals.admin.policies.page',
    ownerScopeKey: `approval-admin-${'7'.repeat(20)}`,
    ownerScopeKind: 'TENANT' as const,
    props: () => state.workflowProps,
  },
  {
    workspace: 'TEAM_DELEGATION' as const,
    component: HrisTeamDelegationRouteAdmission as ComponentType,
    hcmSurfaceId: 'hcm.team',
    hcmCapability: 'hcm.team.members.view',
    hcmScopeKey: `hcm-population-${'7'.repeat(20)}`,
    hcmScopeKind: 'TARGET_POPULATION' as const,
    approvalSurfaceId: 'approvals.work',
    approvalCapability: 'approvals.work.delegation.read',
    approvalRouteContractKey: 'route.approvals.work.delegations.page',
    ownerScopeKey: `approval-self-${'7'.repeat(21)}`,
    ownerScopeKind: 'SELF' as const,
    props: () => state.delegationProps,
  },
] as const;

function authorityFixture(testCase: (typeof CASES)[number]): {
  snapshot: TrustedProductSurfaceAuthoritySnapshot;
  page: AllowedSurfaceDecision;
  ownerPage: ProductSurfaceEvaluationData;
} {
  const hcmScope = {
    key: testCase.hcmScopeKey,
    kind: testCase.hcmScopeKind,
    displayName: 'HR route scope',
    isDefault: true,
    readOnly: true,
  };
  const hcmGrant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: testCase.hcmCapability,
    resolvedCapabilityCode: 'VIEW',
    authorityMode: 'PERMISSION_AND_RELATIONSHIP' as const,
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    scopeKeys: [testCase.hcmScopeKey],
    requiresProductEntitlement: true,
    readOnly: true,
    activationState: 'ACTIVE',
  };
  const hcmContext = {
    contextKey: `${testCase.hcmSurfaceId}-sys003`,
    productKey: 'hcm',
    surfaceKey: testCase.hcmSurfaceId,
    plane: 'management' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'MANAGEMENT' as const,
    appResourceKey: 'APP.HCM',
    effectiveGrants: [hcmGrant],
    scopes: [hcmScope],
    revalidateAt: FUTURE,
  };
  const ownerScope = {
    key: testCase.ownerScopeKey,
    kind: testCase.ownerScopeKind,
    displayName: 'Approval owner scope',
    isDefault: true,
    readOnly: false,
  };
  const ownerGrant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: testCase.approvalCapability,
    resolvedCapabilityCode: 'VIEW',
    authorityMode: 'PERMISSION' as const,
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    scopeKeys: [testCase.ownerScopeKey],
    requiresProductEntitlement: true,
    readOnly: false,
    activationState: 'ACTIVE',
  };
  const ownerContext = {
    contextKey: `${testCase.approvalSurfaceId}-sys003`,
    productKey: 'approvals',
    surfaceKey: testCase.approvalSurfaceId,
    plane: (testCase.approvalSurfaceId === 'approvals.admin' ? 'management' : 'work') as
      'management' | 'work',
    accessMode: 'NORMAL' as const,
    accessSource: (testCase.approvalSurfaceId === 'approvals.admin'
      ? 'MANAGEMENT'
      : 'ENTITLEMENT') as 'MANAGEMENT' | 'ENTITLEMENT',
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [ownerGrant],
    scopes: [ownerScope],
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
      contexts: [hcmContext, ownerContext],
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
      context: hcmContext,
      routeGrantRef: `${HRIS_SYS_003_PAGE_ROUTE_CONTRACTS[testCase.workspace]}:grant`,
      scope: hcmScope,
      effectiveReadOnly: true,
      revalidateAt: FUTURE,
      decisionRevision: REVISION,
    },
    ownerPage: {
      decision: 'ALLOWED',
      decisionRevision: REVISION,
      context: ownerContext,
      routeGrantRef: `${testCase.approvalRouteContractKey}:grant`,
      scope: ownerScope,
      effectiveReadOnly: false,
      revalidateAt: FUTURE,
    },
  };
}

function requestScope(testCase: (typeof CASES)[number]) {
  return {
    governed: true,
    ready: true,
    contextScopeKey: testCase.hcmScopeKey,
    cacheKey: [
      'tenant-7',
      'actor-9',
      'NORMAL',
      testCase.hcmSurfaceId,
      testCase.hcmScopeKey,
      REVISION,
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-7',
      actorId: 'actor-9',
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: testCase.hcmSurfaceId,
      contextScopeKey: testCase.hcmScopeKey,
      decisionRevision: REVISION,
    },
  };
}

let host: HTMLDivElement;
let root: Root;

function mount(element: ReactElement) {
  act(() => root.render(element));
}

describe('R7 SYS-003 central dual-evidence admission', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_HRIS_SYS_003_ENABLED', 'false');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    state.evaluateProduct.mockReset();
    state.workflowProps = undefined;
    state.delegationProps = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(CASES)('keeps $workspace default-off with zero Approval owner evaluation', (testCase) => {
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    state.evaluateProduct.mockResolvedValue(fixture.ownerPage);

    mount(createElement(testCase.component));

    expect(state.evaluateProduct).not.toHaveBeenCalled();
    expect(testCase.props()?.admission).toBeUndefined();
    expect(testCase.props()?.commandRunner).toBeUndefined();
  });

  it.each(CASES)(
    'mounts $workspace only after exact HCM PAGE and native Approval PAGE/read evidence',
    async (testCase) => {
      vi.stubEnv('VITE_HRIS_SYS_003_ENABLED', 'true');
      const fixture = authorityFixture(testCase);
      state.snapshot = fixture.snapshot;
      state.pageDecision = fixture.page;
      state.requestScope = requestScope(testCase);
      state.evaluateProduct.mockResolvedValue(fixture.ownerPage);

      mount(createElement(testCase.component));
      expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-runtime-state="loading"]')).not.toBeNull();
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.waitFor(() => expect(testCase.props()?.admission).toBeDefined());
      });

      expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
      expect(state.evaluateProduct).toHaveBeenCalledWith(
        {
          subject: {
            type: 'PRODUCT',
            productKey: 'approvals',
            surfaceKey: testCase.approvalSurfaceId,
          },
          routeContractKey: testCase.approvalRouteContractKey,
          contextScopeKey: testCase.ownerScopeKey,
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(testCase.props()?.admission).toMatchObject({
        kind: 'TRUSTED_HRIS_APPROVAL_CROSS_PRODUCT',
        workspace: testCase.workspace,
        tenantId: 'tenant-7',
        actorId: 'actor-9',
        hcmPageRouteContractKey: HRIS_SYS_003_PAGE_ROUTE_CONTRACTS[testCase.workspace],
        hcmContextScopeKey: testCase.hcmScopeKey,
        ownerContextScopeKey: testCase.ownerScopeKey,
        pageDecisionRevision: REVISION,
        read: {
          allowed: true,
          capability: testCase.approvalCapability,
          routeContractKey: testCase.approvalRouteContractKey,
          contextScopeKey: testCase.ownerScopeKey,
          decisionRevision: REVISION,
        },
      });
      expect(testCase.props()?.admission).not.toHaveProperty('command');
      expect(testCase.props()?.commandRunner).toBeUndefined();
    }
  );

  it('fails closed when native Approval evidence is from another snapshot revision', async () => {
    vi.stubEnv('VITE_HRIS_SYS_003_ENABLED', 'true');
    const testCase = CASES[0]!;
    const fixture = authorityFixture(testCase);
    state.snapshot = fixture.snapshot;
    state.pageDecision = fixture.page;
    state.requestScope = requestScope(testCase);
    state.evaluateProduct.mockResolvedValue({
      ...fixture.ownerPage,
      decisionRevision: 'foreign-revision',
    });

    mount(createElement(testCase.component));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(host.querySelector('[data-runtime-state="denied"]')).not.toBeNull()
      );
    });

    expect(state.evaluateProduct).toHaveBeenCalledTimes(1);
    expect(state.workflowProps?.admission).toBeUndefined();
  });
});
