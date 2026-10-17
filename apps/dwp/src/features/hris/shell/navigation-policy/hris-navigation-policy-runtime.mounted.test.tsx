// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  canary: {} as Record<string, unknown>,
  snapshot: {} as Record<string, unknown>,
  transport: { get: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: state.transport,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'navigation.policyStatus': 'HRIS navigation access status',
        'navigation.policyLoading': 'Verifying the effective HRIS task navigation policy',
      })[key] ?? key,
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { tenantId: 'tenant-7', userId: 'actor-9' },
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/product-surface-context-provider', () => ({
  useProductSurfaceAuthority: () => ({ status: 'ready', snapshot: state.snapshot }),
}));

vi.mock('../../../../components/product-surface-canary-runtime', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useProductSurfaceCanaryAuthority: () => state.canary,
}));

vi.mock('./hris-navigation-policy-feature', () => ({
  HRIS_NAVIGATION_POLICY_RUNTIME_STATE: 'ON',
  isHrisNavigationPolicyRuntimeEnabled: () => true,
}));

import {
  HrisNavigationPolicyDeepLinkGuard,
  HrisNavigationPolicyRuntimeProvider,
  HRIS_NAVIGATION_GENERATED_IA_SHA256,
  HRIS_NAVIGATION_IA_REGISTER_SHA256,
  HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
  HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
  HRIS_NAVIGATION_TOPOLOGY_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SHA256,
  useHrisRuntimeNavigationPolicy,
} from './hris-navigation-policy-runtime';
import { canonicalHrisWorkbench } from './seven-workbench-navigation-policy';

let host: HTMLDivElement;
let root: Root;

function RuntimeProbe() {
  const policy = useHrisRuntimeNavigationPolicy();
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="policy" data-mode={policy.mode} data-pin={policy.revisionPin} />
      <button
        type="button"
        onClick={() => navigate({ pathname: '/hr/operations', search: location.search })}
      >
        move surface
      </button>
    </>
  );
}

function mount(initialEntry: string, children: ReactNode = <RuntimeProbe />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  root.render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HrisNavigationPolicyRuntimeProvider>
          {children}
        </HrisNavigationPolicyRuntimeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return queryClient;
}

describe('root-mounted HRIS navigation policy provider', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    state.transport.get.mockReset();
    const authority = utilityAuthority();
    state.canary = authority.canary;
    state.snapshot = authority.snapshot;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('fetches once without an AllowedSurface wrapper and reuses the tenant aggregate across surfaces', async () => {
    const pin = `nav-v2-${'c'.repeat(64)}`;
    state.transport.get.mockResolvedValue({ data: { data: enforcedProjection(pin) } });
    let queryClient: QueryClient;
    await act(async () => {
      queryClient = mount('/hr/home');
    });

    await act(async () => {
      await vi.waitFor(() => expect(policyOutput().dataset.pin).toBe(pin));
    });
    expect(policyOutput().dataset.mode).toBe('ENFORCED');
    expect(state.transport.get).toHaveBeenCalledOnce();
    expect(state.transport.get.mock.calls[0]![0]).toContain('navigationScope=TENANT');

    await act(async () => {
      host.querySelector('button')!.click();
    });
    await act(async () => {
      await vi.waitFor(() => expect(policyOutput().dataset.pin).toBe(pin));
    });

    expect(state.transport.get).toHaveBeenCalledOnce();
    expect(
      queryClient!.getQueryCache().findAll({
        predicate: (query) => query.queryKey[0] === 'hris',
      })
    ).toHaveLength(1);
  });

  it('uses one trusted operations scope for a legal entity across workbench moves', async () => {
    const legalEntityPublicId = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';
    const pin = `nav-v2-${'d'.repeat(64)}`;
    const authority = operationsAuthority(legalEntityPublicId);
    state.canary = authority.canary;
    state.snapshot = authority.snapshot;
    state.transport.get.mockResolvedValue({ data: { data: enforcedProjection(pin) } });
    let queryClient: QueryClient;

    await act(async () => {
      queryClient = mount(`/hr/home?legalEntityPublicId=${legalEntityPublicId}`);
    });

    await act(async () => {
      await vi.waitFor(() => expect(policyOutput().dataset.pin).toBe(pin));
    });
    expect(state.transport.get).toHaveBeenCalledOnce();
    expect(state.transport.get.mock.calls[0]![0]).toContain(
      `navigationScope=LEGAL_ENTITY&legalEntityPublicId=${legalEntityPublicId}`
    );

    await act(async () => {
      host.querySelector('button')!.click();
    });
    await act(async () => {
      await vi.waitFor(() => expect(policyOutput().dataset.pin).toBe(pin));
    });

    expect(state.transport.get).toHaveBeenCalledOnce();
    expect(
      queryClient!.getQueryCache().findAll({
        predicate: (query) => query.queryKey[0] === 'hris',
      })
    ).toHaveLength(1);
  });

  it('fails closed without fetching when legal-entity authority is not operations-owned', async () => {
    const legalEntityPublicId = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';
    const authority = managementAuthority(legalEntityPublicId);
    state.canary = authority.canary;
    state.snapshot = authority.snapshot;

    await act(async () => {
      mount(`/hr/settings/navigation-policy?legalEntityPublicId=${legalEntityPublicId}`);
    });

    await act(async () => Promise.resolve());
    expect(state.transport.get).not.toHaveBeenCalled();
    expect(policyOutput().dataset.mode).toBe('FAIL_CLOSED');
  });

  it('renders localized pending evidence inside the existing page main landmark', async () => {
    state.transport.get.mockReturnValue(new Promise(() => undefined));
    await act(async () => {
      mount('/hr/operations', <GuardProbe />);
    });

    await act(async () => {
      await vi.waitFor(() =>
        expect(
          host.querySelector('section[aria-label="HRIS navigation access status"]')
        ).toBeTruthy()
      );
    });
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(host.textContent).toContain('Verifying the effective HRIS task navigation policy');
    expect(host.querySelector('[data-testid="guard-child"]')).toBeNull();
  });

  it('renders denied evidence without creating a nested main landmark', async () => {
    state.transport.get.mockRejectedValue(new Error('projection unavailable'));
    await act(async () => {
      mount('/hr/operations', <GuardProbe />);
    });

    await act(async () => {
      await vi.waitFor(() =>
        expect(
          host.querySelector('section[aria-label="HRIS navigation access status"]')
        ).toBeTruthy()
      );
    });
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(host.querySelector('[data-testid="guard-child"]')).toBeNull();
  });
});

function GuardProbe() {
  return (
    <main id="dwp-main-content">
      <HrisNavigationPolicyDeepLinkGuard>
        <div data-testid="guard-child" />
      </HrisNavigationPolicyDeepLinkGuard>
    </main>
  );
}

function policyOutput() {
  return host.querySelector<HTMLOutputElement>('[data-testid="policy"]')!;
}

function utilityAuthority() {
  const scope = {
    key: `hcm-scope-${'1'.repeat(40)}`,
    kind: 'SELF' as const,
    displayName: 'My HR scope',
    isDefault: true,
    readOnly: true,
  };
  const grant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: 'hcm.app.shell.view',
    resolvedCapabilityCode: 'DATA.HRIS_APP_SHELL:VIEW',
    authorityMode: 'PERMISSION' as const,
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    scopeKeys: [scope.key],
    requiresProductEntitlement: true,
    readOnly: true,
    activationState: 'ACTIVE',
  };
  const context = {
    contextKey: 'hcm-utility-shell',
    productKey: 'hcm',
    surfaceKey: 'hcm.utility',
    plane: 'work' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'ENTITLEMENT' as const,
    appResourceKey: 'APP.HCM',
    effectiveGrants: [grant],
    scopes: [scope],
    revalidateAt: '2030-01-01T00:00:00.000Z',
  };
  const decision = {
    state: 'allowed' as const,
    context,
    routeGrantRef: 'route.hcm.shell.navigation-aggregate.data',
    scope,
    effectiveReadOnly: true,
    revalidateAt: context.revalidateAt,
    decisionRevision: 'direct-utility-1',
  };
  const envelope = {
    contractVersion: '3' as const,
    decisionRevision: 'authority-list-1',
    sourceRevisions: { auth: 'auth-1' },
    activeAccessMode: 'NORMAL' as const,
    generatedAt: '2029-01-01T00:00:00.000Z',
    contexts: [context],
    rollouts: [],
  };
  return {
    canary: {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: false,
        surfaceUiEvaluation: 'resolved' as const,
      },
      envelope,
      serverNowMs: Date.parse('2029-01-01T00:00:00.000Z'),
      surfaceDecisions: { 'hcm.utility': decision },
    },
    snapshot: {
      envelope,
      receivedAtMs: Date.parse('2029-01-01T00:00:00.000Z'),
      clockOffsetMs: 0,
      earliestRevalidateAtMs: Date.parse(context.revalidateAt),
    },
  };
}

function operationsAuthority(legalEntityPublicId: string) {
  return surfaceAuthority({
    surfaceKey: 'hcm.operations',
    contextKey: 'hcm-operations-legal',
    scope: {
      key: `hcm-scope-${'2'.repeat(40)}`,
      kind: 'LEGAL_ENTITY' as const,
      displayName: 'Selected legal entity',
      isDefault: true,
      readOnly: true,
      legalEntityPublicId,
      operationMode: 'OPERATION' as const,
    },
  });
}

function managementAuthority(legalEntityPublicId: string) {
  return surfaceAuthority({
    surfaceKey: 'hcm.management',
    contextKey: 'hcm-management-legal',
    scope: {
      key: `hcm-scope-${'3'.repeat(40)}`,
      kind: 'LEGAL_ENTITY' as const,
      displayName: 'Management legal entity',
      isDefault: true,
      readOnly: true,
      legalEntityPublicId,
      operationMode: 'MANAGEMENT' as const,
    },
  });
}

function surfaceAuthority(input: {
  surfaceKey: 'hcm.operations' | 'hcm.management';
  contextKey: string;
  scope: Record<string, unknown>;
}) {
  const grant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: 'hcm.app.shell.view',
    resolvedCapabilityCode: 'DATA.HRIS_APP_SHELL:VIEW',
    authorityMode: 'PERMISSION' as const,
    responsibilityRequirement: 'NOT_REQUIRED' as const,
    scopeKeys: [input.scope.key],
    requiresProductEntitlement: true,
    readOnly: true,
    activationState: 'ACTIVE',
  };
  const context = {
    contextKey: input.contextKey,
    productKey: 'hcm',
    surfaceKey: input.surfaceKey,
    plane: 'work' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'ENTITLEMENT' as const,
    appResourceKey: 'APP.HCM',
    effectiveGrants: [grant],
    scopes: [input.scope],
    revalidateAt: '2030-01-01T00:00:00.000Z',
  };
  const decision = {
    state: 'allowed' as const,
    context,
    routeGrantRef: 'route.hcm.shell.navigation-aggregate.data',
    scope: input.scope,
    effectiveReadOnly: true,
    revalidateAt: context.revalidateAt,
    decisionRevision: `direct-${input.surfaceKey}-1`,
  };
  const envelope = {
    contractVersion: '3' as const,
    decisionRevision: `authority-${input.surfaceKey}-1`,
    sourceRevisions: { auth: 'auth-1' },
    activeAccessMode: 'NORMAL' as const,
    generatedAt: '2029-01-01T00:00:00.000Z',
    contexts: [context],
    rollouts: [],
  };
  return {
    canary: {
      flags: {
        contextShadow: true,
        capabilityEnforcement: true,
        surfaceUi: false,
        surfaceUiEvaluation: 'resolved' as const,
      },
      envelope,
      serverNowMs: Date.parse('2029-01-01T00:00:00.000Z'),
      surfaceDecisions: { [input.surfaceKey]: decision },
    },
    snapshot: {
      envelope,
      receivedAtMs: Date.parse('2029-01-01T00:00:00.000Z'),
      clockOffsetMs: 0,
      earliestRevalidateAtMs: Date.parse(context.revalidateAt),
    },
  };
}

function enforcedProjection(revisionPin: string) {
  const canonical = canonicalHrisWorkbench('HRIS-WB-HR-OPERATIONS')!;
  const group = canonical.groups[0]!;
  const node = group.nodes[0]!;
  return {
    schemaVersion: '2',
    topologyRevision: HRIS_NAVIGATION_TOPOLOGY_REVISION,
    topologySha256: HRIS_NAVIGATION_TOPOLOGY_SHA256,
    iaRegisterSha256: HRIS_NAVIGATION_IA_REGISTER_SHA256,
    shellRegisterSha256: HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
    taskGroupRegisterSha256: HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
    generatedIaSha256: HRIS_NAVIGATION_GENERATED_IA_SHA256,
    enforcementState: 'ENFORCED',
    policyEnforced: true,
    tenantPolicyId: null,
    tenantRevisionId: null,
    tenantRevisionNumber: null,
    legalEntityRevisionId: null,
    legalEntityRevisionNumber: null,
    revisionPin,
    workbenches: [
      {
        workbenchId: canonical.workbenchId,
        displayOrder: canonical.displayOrder,
        landingNodeId: node.nodeId,
        groups: [
          {
            groupId: group.groupId,
            displayOrder: group.displayOrder,
            defaultNodeId: node.nodeId,
            nodes: [{ nodeId: node.nodeId, displayOrder: node.displayOrder }],
          },
        ],
      },
    ],
    denialReason: null,
    evaluatedAt: '2029-01-01T00:00:00.000Z',
  };
}
