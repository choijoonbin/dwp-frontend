import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  createHrisPolicyShellNavigationProjection,
  readRuntimeNavigationPolicyProjection,
  resolveHrisRuntimeNavigationPolicyEvidence,
  resolveHrisRuntimePolicyDeepLink,
  resolveHrisRuntimePolicyLanding,
  selectHrisRuntimeNavigationPolicy,
  selectRuntimeHrisNavigationPolicyProjection,
  shouldReadHrisRuntimeNavigationPolicyProjection,
} from './hris-navigation-policy-runtime';
import { HRIS_NAVIGATION_POLICY_RUNTIME_STATE } from './hris-navigation-policy-feature';
import { HR_OPERATIONS_NAVIGATION_CATALOG } from './hr-operations-navigation-policy';

describe('server-owned HRIS navigation-policy runtime', () => {
  beforeEach(() => transport.get.mockReset());

  it('keeps NOT_ENROLLED, OFF, and SHADOW on the existing static shell', () => {
    for (const enforcementState of ['NOT_ENROLLED', 'OFF', 'SHADOW'] as const) {
      const policy = selectHrisRuntimeNavigationPolicy(
        selectRuntimeHrisNavigationPolicyProjection(projection(enforcementState))
      );
      expect(policy.mode).toBe('STATIC');
      const shell = createHrisPolicyShellNavigationProjection(policy);
      expect(shell.project(new Set(['/hr/operations']))[0]?.items[0]?.path).toBe('/hr/operations');
    }
  });

  it('uses one server revision pin for enforced shell, landing, and deep links', () => {
    const allowedNode = HR_OPERATIONS_NAVIGATION_CATALOG[0]!.nodes[1]!;
    const server = projection('ENFORCED', {
      policyEnforced: true,
      revisionPin: 'tenant:41:legal:7',
      groups: [
        {
          groupId: 'HROPS-01',
          displayOrder: 0,
          defaultNodeId: allowedNode.nodeId,
          nodes: [{ nodeId: allowedNode.nodeId, displayOrder: 0 }],
        },
      ],
    });
    const policy = selectHrisRuntimeNavigationPolicy(
      selectRuntimeHrisNavigationPolicyProjection(server)
    );
    const landing = resolveHrisRuntimePolicyLanding(policy);
    const deepLink = resolveHrisRuntimePolicyDeepLink(policy, '/hr/operations/people?focus=p-1');
    expect(policy.mode).toBe('ENFORCED');
    expect(landing).toMatchObject({ decision: 'ALLOW', revisionPin: 'tenant:41:legal:7' });
    expect(deepLink).toMatchObject({
      decision: 'ALLOW',
      nodeId: allowedNode.nodeId,
      revisionPin: landing.revisionPin,
    });

    const shell = createHrisPolicyShellNavigationProjection(policy);
    const items = shell
      .project(new Set(['/hr/operations', '/hr/operations/people', '/hr/operations/time']))
      .flatMap((group) => group.items);
    expect(items.find((item) => item.view === 'workbench-hr-operations')?.path).toBe(
      '/hr/operations/people'
    );
    expect(items.find((item) => item.view === 'workbench-time')?.path).toBe('/hr/operations/time');
    expect(shell.resolveSelectedView?.('/hr/operations')).toBeUndefined();
  });

  it('fails closed only for HR Operations when enforced evidence is denied', () => {
    const policy = selectHrisRuntimeNavigationPolicy(
      selectRuntimeHrisNavigationPolicyProjection(
        projection('DENIED_STALE_CONTEXT', { denialReason: 'TRUSTED_CONTEXT_STALE' })
      )
    );
    expect(policy.mode).toBe('FAIL_CLOSED');
    const items = createHrisPolicyShellNavigationProjection(policy)
      .project(new Set(['/hr/operations', '/hr/operations/time', '/hr/operations/pay']))
      .flatMap((group) => group.items);
    expect(items.some((item) => item.view === 'workbench-hr-operations')).toBe(false);
    expect(items.some((item) => item.view === 'workbench-time')).toBe(true);
    expect(items.some((item) => item.view === 'workbench-payroll')).toBe(true);
  });

  it('rejects server nodes outside the sealed canonical group', () => {
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: 'tenant:41',
          groups: [
            {
              groupId: 'HROPS-01',
              displayOrder: 0,
              defaultNodeId: 'UNKNOWN',
              nodes: [{ nodeId: 'UNKNOWN', displayOrder: 0 }],
            },
          ],
        })
      )
    ).toThrow('Effective policy node is invalid');
  });

  it('fails closed while governed projection evidence is pending or unavailable', () => {
    expect(
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: true,
        governed: true,
        requestReady: true,
        selectorState: 'TENANT',
        queryPending: true,
        queryError: false,
      })
    ).toMatchObject({ mode: 'FAIL_CLOSED', denialReason: 'NAVIGATION_PROJECTION_PENDING' });

    expect(
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: true,
        governed: true,
        requestReady: true,
        selectorState: 'LEGAL_ENTITY',
        queryPending: false,
        queryError: true,
      })
    ).toMatchObject({ mode: 'FAIL_CLOSED', denialReason: 'NAVIGATION_PROJECTION_UNAVAILABLE' });

    expect(
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: true,
        governed: false,
        requestReady: true,
        selectorState: 'TENANT',
        queryPending: true,
        queryError: false,
      }).mode
    ).toBe('STATIC');
  });

  it('keeps runtime static and disables projection reads while the central flag is off', () => {
    expect(HRIS_NAVIGATION_POLICY_RUNTIME_STATE).toBe('OFF');
    expect(
      shouldReadHrisRuntimeNavigationPolicyProjection({
        runtimeEnabled: false,
        selectorState: 'LEGAL_ENTITY',
        governed: true,
        requestReady: true,
        contextScopeKey: 'opaque-context-scope',
      })
    ).toBe(false);
    expect(
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: false,
        governed: true,
        requestReady: true,
        selectorState: 'INVALID',
        queryPending: true,
        queryError: false,
      }).mode
    ).toBe('STATIC');
  });

  it('reads only when the flag and governed scope evidence are both ready', () => {
    expect(
      shouldReadHrisRuntimeNavigationPolicyProjection({
        runtimeEnabled: true,
        selectorState: 'TENANT',
        governed: true,
        requestReady: true,
        contextScopeKey: 'opaque-context-scope',
      })
    ).toBe(true);
    expect(
      shouldReadHrisRuntimeNavigationPolicyProjection({
        runtimeEnabled: true,
        selectorState: 'INVALID',
        governed: true,
        requestReady: true,
        contextScopeKey: 'opaque-context-scope',
      })
    ).toBe(false);
  });

  it('sends the untrusted legal selector only as a query and no purpose or verified-scope header', async () => {
    const legalEntityPublicId = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';
    transport.get.mockResolvedValue({ data: { data: projection('OFF') } });
    const signal = new AbortController().signal;
    await readRuntimeNavigationPolicyProjection({
      contextScopeKey: 'opaque-context-scope',
      legalEntityPublicId,
      correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6a',
      signal,
    });

    const request = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(Object.fromEntries(request.searchParams)).toEqual({
      workbenchId: 'HRIS-WB-HR-OPERATIONS',
      contextScopeKey: 'opaque-context-scope',
      legalEntityPublicId,
    });
    expect(transport.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        contextScopeKey: 'opaque-context-scope',
        signal,
        headers: { 'X-Correlation-ID': '2983c2ef-6c0e-47f5-862c-84007dc2da6a' },
      })
    );
    const headers = JSON.stringify(transport.get.mock.calls[0][1].headers);
    expect(headers).not.toContain('Purpose-Code');
    expect(headers).not.toContain('Verified');
  });
});

function projection(
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT',
  overrides: Record<string, unknown> = {}
) {
  return {
    workbenchId: 'HRIS-WB-HR-OPERATIONS',
    enforcementState,
    policyEnforced: false,
    tenantPolicyId: null,
    tenantRevisionId: null,
    legalEntityRevisionId: null,
    revisionPin: null,
    groups: [],
    denialReason: null,
    evaluatedAt: '2026-10-14T04:00:00Z',
    ...overrides,
  };
}
