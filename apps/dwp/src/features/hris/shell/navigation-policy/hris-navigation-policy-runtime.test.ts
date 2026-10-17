import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  createHrisPolicyShellNavigationProjection,
  HRIS_NAVIGATION_GENERATED_IA_SHA256,
  HRIS_NAVIGATION_IA_REGISTER_SHA256,
  HRIS_NAVIGATION_SCOPE_PARAM,
  HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
  HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
  HRIS_NAVIGATION_TOPOLOGY_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SHA256,
  projectHrisWorkbenchTaskNavigation,
  readRuntimeNavigationPolicyProjection,
  resolveHrisNavigationProjectionScopeSurface,
  resolveHrisRuntimeNavigationPolicyEvidence,
  resolveHrisRuntimePolicyDeepLink,
  resolveHrisRuntimePolicyLanding,
  selectHrisRuntimeNavigationPolicy,
  selectRuntimeHrisNavigationPolicyProjection,
  shouldReadHrisRuntimeNavigationPolicyProjection,
} from './hris-navigation-policy-runtime';
import { HRIS_NAVIGATION_POLICY_RUNTIME_STATE } from './hris-navigation-policy-feature';
import {
  canonicalHrisWorkbench,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_WORKBENCH_IDS,
  HRIS_WORKBENCH_VIEW_BY_ID,
} from './seven-workbench-navigation-policy';

import type { HrisWorkbenchId } from './seven-workbench-navigation-policy';

describe('server-owned HRIS seven-workbench navigation runtime', () => {
  beforeEach(() => transport.get.mockReset());

  it('keeps NOT_ENROLLED, OFF, and SHADOW on the finite compatibility shell', () => {
    for (const enforcementState of ['NOT_ENROLLED', 'OFF', 'SHADOW'] as const) {
      const policy = selectHrisRuntimeNavigationPolicy(
        selectRuntimeHrisNavigationPolicyProjection(projection(enforcementState))
      );
      expect(policy.mode).toBe('STATIC');
      const items = createHrisPolicyShellNavigationProjection(policy)
        .project(new Set(['/hr/operations', '/hr/unimplemented']))
        .flatMap((group) => group.items);
      expect(items.map((item) => item.path)).toEqual(['/hr/operations']);
      expect(items).toHaveLength(1);
    }
  });

  it('uses one aggregate revision pin for sidebar, selected task groups, landing, and deep links', () => {
    const myHr = effectiveWorkbench('HRIS-WB-MY-HR', ['BASE:my-employment-documents']);
    const operations = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', ['BASE:hr-people']);
    const policy = selectHrisRuntimeNavigationPolicy(
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('a'),
          workbenches: [myHr, operations],
        })
      )
    );
    const authorized = new Set([
      '/hr/home',
      '/hr/me/employment-documents',
      '/hr/operations/people',
    ]);
    const shell = createHrisPolicyShellNavigationProjection(policy);
    const items = shell.project(authorized).flatMap((group) => group.items);
    const operationsItem = items.find((item) => item.view === 'workbench-hr-operations')!;
    const taskGroups = projectHrisWorkbenchTaskNavigation(
      policy,
      operationsItem.view,
      new Set(operationsItem.activePathPrefixes ?? [])
    );
    const landing = resolveHrisRuntimePolicyLanding(policy, 'HRIS-WB-HR-OPERATIONS', authorized);
    const deepLink = resolveHrisRuntimePolicyDeepLink(
      policy,
      '/hr/operations/people?focus=p-1',
      authorized
    );

    expect(items.map((item) => item.view)).toEqual([
      'shell-home',
      'workbench-my-hr',
      'workbench-hr-operations',
    ]);
    expect(taskGroups.flatMap((group) => group.nodes.map((node) => node.nodeId))).toEqual([
      'BASE:hr-people',
    ]);
    expect(landing).toMatchObject({
      decision: 'ALLOW',
      revisionPin: policy.revisionPin,
      nodeId: 'BASE:hr-people',
    });
    expect(deepLink).toMatchObject({
      decision: 'ALLOW',
      revisionPin: policy.revisionPin,
      nodeId: 'BASE:hr-people',
    });
  });

  it('can project exactly seven global workbenches while revealing only one selected child tree', () => {
    const workbenches = HRIS_WORKBENCH_IDS.map((workbenchId) =>
      effectiveWorkbench(workbenchId, [
        canonicalHrisWorkbench(workbenchId)!.groups[0]!.nodes[0]!.nodeId,
      ])
    );
    const policy = enforcedPolicy(workbenches);
    const authorized = new Set(
      workbenches.flatMap((workbench) =>
        workbench.groups.flatMap((group) =>
          group.nodes.flatMap((node) => canonicalNode(node.nodeId).routeAliases)
        )
      )
    );
    const items = createHrisPolicyShellNavigationProjection(policy)
      .project(authorized)
      .flatMap((group) => group.items);

    expect(items.map((item) => item.view)).toEqual(
      HRIS_WORKBENCH_IDS.map((workbenchId) => HRIS_WORKBENCH_VIEW_BY_ID[workbenchId])
    );
    const selected = items[3]!;
    expect(
      projectHrisWorkbenchTaskNavigation(
        policy,
        selected.view,
        new Set(selected.activePathPrefixes ?? [])
      ).flatMap((group) => group.nodes)
    ).toHaveLength(1);
    for (const workbench of workbenches) {
      const landing = resolveHrisRuntimePolicyLanding(
        policy,
        workbench.workbenchId as HrisWorkbenchId,
        authorized
      );
      const shellEntry = items.find(
        (item) => item.view === HRIS_WORKBENCH_VIEW_BY_ID[workbench.workbenchId as HrisWorkbenchId]
      );
      expect(landing).toMatchObject({
        decision: 'ALLOW',
        revisionPin: policy.revisionPin,
      });
      expect(shellEntry?.path).toBe(landing.route);
    }
  });

  it('omits empty groups/workbenches and falls back to the first frontend-authorized descendant', () => {
    const source = canonicalHrisWorkbench('HRIS-WB-HR-OPERATIONS')!;
    const group = source.groups.find((candidate) => candidate.nodes.length > 1)!;
    const first = group.nodes[0]!;
    const second = group.nodes[1]!;
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [first.nodeId, second.nodeId], first.nodeId),
    ]);
    const shell = createHrisPolicyShellNavigationProjection(policy);
    const projected = shell
      .project(new Set([second.routeAliases[0]!]))
      .flatMap((value) => value.items);
    const item = projected[0]!;
    const tasks = projectHrisWorkbenchTaskNavigation(
      policy,
      item.view,
      new Set(item.activePathPrefixes ?? [])
    );

    expect(item.path).toBe(second.routeAliases[0]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ defaultNodeId: second.nodeId });
    expect(tasks[0]!.nodes.map((node) => node.nodeId)).toEqual([second.nodeId]);
    expect(
      resolveHrisRuntimePolicyLanding(
        policy,
        'HRIS-WB-HR-OPERATIONS',
        new Set([second.routeAliases[0]!])
      )
    ).toMatchObject({
      decision: 'ALLOW',
      revisionPin: policy.revisionPin,
      nodeId: second.nodeId,
      route: second.routeAliases[0],
    });
  });

  it('fails all seven workbenches closed for pending, unavailable, and stale enforced evidence', () => {
    const authorized = new Set([
      '/hr/home',
      '/hr/me/employment-documents',
      '/hr/operations/people',
      '/hr/operations/time/clock-ingestion',
    ]);
    const policies = [
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: true,
        governed: true,
        requestReady: true,
        selectorState: 'TENANT',
        queryPending: true,
        queryError: false,
      }),
      resolveHrisRuntimeNavigationPolicyEvidence({
        runtimeEnabled: true,
        governed: true,
        requestReady: true,
        selectorState: 'TENANT',
        queryPending: false,
        queryError: true,
      }),
      selectHrisRuntimeNavigationPolicy(
        selectRuntimeHrisNavigationPolicyProjection(
          projection('DENIED_STALE_CONTEXT', {
            policyEnforced: true,
            denialReason: 'TRUSTED_CONTEXT_STALE',
          })
        )
      ),
    ];
    for (const policy of policies) {
      const items = createHrisPolicyShellNavigationProjection(policy)
        .project(authorized)
        .flatMap((group) => group.items);
      expect(items.map((item) => item.view)).toEqual(['shell-home']);
      expect(policy.mode).toBe('FAIL_CLOSED');
    }
  });

  it('fails closed when the runtime flag is on but the request scope is not governed', () => {
    const policy = resolveHrisRuntimeNavigationPolicyEvidence({
      runtimeEnabled: true,
      governed: false,
      requestReady: true,
      selectorState: 'TENANT',
      queryPending: false,
      queryError: false,
    });

    expect(policy).toMatchObject({
      mode: 'FAIL_CLOSED',
      denialReason: 'NAVIGATION_SCOPE_UNGOVERNED',
    });
    expect(
      createHrisPolicyShellNavigationProjection(policy)
        .project(new Set(['/hr/operations/people']))
        .flatMap((group) => group.items)
    ).toEqual([]);
  });

  it('rejects wrong schema, cross-workbench membership, and canonical-order injection', () => {
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(projection('OFF', { schemaVersion: '1' }))
    ).toThrow('schema');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('OFF', { topologyRevision: 'HRIS-IA-98-V1' })
      )
    ).toThrow('topology');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: 'nav-v2-truncated',
        })
      )
    ).toThrow('revision pin');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('OFF', { tenantPolicyId: '00000000-0000-0000-0000-not-a-uuid' })
      )
    ).toThrow('UUID');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(projection('OFF', { policyEnforced: true }))
    ).toThrow('state');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('d'),
          workbenches: [],
        })
      )
    ).toThrow('state');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('DENIED_MISSING_POLICY', {
          policyEnforced: true,
          denialReason: null,
        })
      )
    ).toThrow('state');

    const operations = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', ['BASE:hr-people']);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('b'),
          workbenches: [
            {
              ...operations,
              groups: [
                {
                  ...operations.groups[0],
                  nodes: [{ nodeId: 'BASE:my-time', displayOrder: 0 }],
                  defaultNodeId: 'BASE:my-time',
                },
              ],
              landingNodeId: 'BASE:my-time',
            },
          ],
        })
      )
    ).toThrow('node');

    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('b'),
          workbenches: [{ ...operations, displayOrder: 6 }],
        })
      )
    ).toThrow('workbench order');
  });

  it('uses exact canonical or sealed compatibility routes and rejects prefixes and exclusions', () => {
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
        'BASE:hr-people',
        'BASE:hr-employment-assignments',
      ]),
    ]);
    const authorized = new Set(['/hr/operations/people', '/hr/operations/assignments']);
    expect(
      resolveHrisRuntimePolicyDeepLink(policy, '/hr/operations/people', authorized).decision
    ).toBe('ALLOW');
    expect(
      resolveHrisRuntimePolicyDeepLink(policy, '/hr/operations/assignments', authorized).decision
    ).toBe('ALLOW');
    expect(resolveHrisRuntimePolicyDeepLink(policy, '/hr/directory', authorized).decision).toBe(
      'DENY'
    );
    expect(
      resolveHrisRuntimePolicyDeepLink(
        policy,
        '/hr/operations/people/detail',
        new Set(['/hr/operations/people/detail'])
      ).decision
    ).toBe('DENY');
    for (const excluded of ['/hr/explore', '/hr/benefits', '/hr/operations/benefits']) {
      expect(resolveHrisRuntimePolicyDeepLink(policy, excluded, new Set([excluded])).decision).toBe(
        'DENY'
      );
      expect(
        HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.some((workbench) =>
          workbench.groups.some((group) =>
            group.nodes.some((node) => node.routeAliases.includes(excluded))
          )
        )
      ).toBe(false);
    }
  });

  it('recognizes POLICY compatibility aliases but never treats them as runtime PAGE grants', () => {
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-MY-HR', [
        'BASE:my-hr-profile',
        'BASE:my-time',
        'BASE:my-leave',
        'BASE:my-pay-tax',
        'BASE:my-goals-performance',
        'BASE:my-hr-requests',
      ]),
      effectiveWorkbench('HRIS-WB-TEAM', ['BASE:team-home']),
      effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
        'BASE:hr-people',
        'BASE:hr-organization-positions',
      ]),
      effectiveWorkbench('HRIS-WB-SETTINGS', ['BASE:settings-operations']),
    ]);
    const policyAliases = [
      '/hr/me',
      '/hr/time',
      '/hr/pay',
      '/hr/talent',
      '/hr/team',
      '/hr/absence',
      '/hr/services',
      '/hr/directory',
      '/hr/organization',
      '/hr/manage/system',
    ];

    for (const alias of policyAliases) {
      expect(resolveHrisRuntimePolicyDeepLink(policy, alias, new Set([alias])).decision).toBe(
        'DENY'
      );
    }
    expect(
      createHrisPolicyShellNavigationProjection(policy)
        .project(new Set(policyAliases))
        .flatMap((group) => group.items)
    ).toEqual([]);
  });

  it('keeps runtime default-off and reads only governed, ready scope evidence', () => {
    expect(HRIS_NAVIGATION_POLICY_RUNTIME_STATE).toBe('OFF');
    expect(
      shouldReadHrisRuntimeNavigationPolicyProjection({
        runtimeEnabled: false,
        selectorState: 'TENANT',
        governed: true,
        requestReady: true,
        contextScopeKey: 'opaque-context-scope',
      })
    ).toBe(false);
    expect(
      shouldReadHrisRuntimeNavigationPolicyProjection({
        runtimeEnabled: true,
        selectorState: 'LEGAL_ENTITY',
        governed: true,
        requestReady: true,
        contextScopeKey: 'opaque-context-scope',
      })
    ).toBe(true);
  });

  it('uses one utility tenant scope and one operations-owned legal-entity scope', () => {
    expect(resolveHrisNavigationProjectionScopeSurface('/hr/home', 'TENANT')).toBe('hcm.utility');
    expect(resolveHrisNavigationProjectionScopeSurface('/hr/operations/pay', 'TENANT')).toBe(
      'hcm.utility'
    );
    expect(resolveHrisNavigationProjectionScopeSurface('/hr/operations/pay', 'LEGAL_ENTITY')).toBe(
      'hcm.operations'
    );
    expect(
      resolveHrisNavigationProjectionScopeSurface('/hr/settings/navigation-policy', 'LEGAL_ENTITY')
    ).toBe('hcm.operations');
    expect(resolveHrisNavigationProjectionScopeSurface('/hr/home', 'LEGAL_ENTITY')).toBe(
      'hcm.operations'
    );
    expect(resolveHrisNavigationProjectionScopeSurface('/hr/operations', 'INVALID')).toBeNull();
  });

  it('calls the governed v2 aggregate with the fixed legal scope and selector only', async () => {
    const legalEntityPublicId = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';
    transport.get.mockResolvedValue({ data: { data: projection('OFF') } });
    const signal = new AbortController().signal;
    await readRuntimeNavigationPolicyProjection({
      contextScopeKey: 'opaque-context-scope',
      navigationScope: 'LEGAL_ENTITY',
      legalEntityPublicId,
      correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6a',
      signal,
    });

    const request = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(request.pathname).toBe('/api/platform/v2/hris/navigation/projection');
    expect(Object.fromEntries(request.searchParams)).toEqual({
      [HRIS_NAVIGATION_SCOPE_PARAM]: 'LEGAL_ENTITY',
      legalEntityPublicId,
    });
    expect(transport.get.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        contextScopeKey: 'opaque-context-scope',
        signal,
        headers: { 'X-Correlation-ID': '2983c2ef-6c0e-47f5-862c-84007dc2da6a' },
      })
    );
  });

  it('always sends the fixed tenant discriminator and rejects mixed selector shapes', async () => {
    transport.get.mockResolvedValue({ data: { data: projection('OFF') } });
    await readRuntimeNavigationPolicyProjection({
      contextScopeKey: 'opaque-context-scope',
      navigationScope: 'TENANT',
      correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6b',
    });

    const request = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(Object.fromEntries(request.searchParams)).toEqual({
      [HRIS_NAVIGATION_SCOPE_PARAM]: 'TENANT',
    });
    await expect(
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: 'opaque-context-scope',
        navigationScope: 'TENANT',
        legalEntityPublicId: '6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
        correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6c',
      })
    ).rejects.toThrow('scope selector');
  });
});

function enforcedPolicy(workbenches: readonly Record<string, unknown>[]) {
  return selectHrisRuntimeNavigationPolicy(
    selectRuntimeHrisNavigationPolicyProjection(
      projection('ENFORCED', {
        policyEnforced: true,
        revisionPin: revisionPin('c'),
        workbenches,
      })
    )
  );
}

function effectiveWorkbench(
  workbenchId: HrisWorkbenchId,
  nodeIds: readonly string[],
  landingNodeId = nodeIds[0]!
) {
  const canonical = canonicalHrisWorkbench(workbenchId)!;
  const selected = new Set(nodeIds);
  const groups = canonical.groups.flatMap((group) => {
    const nodes = group.nodes
      .filter((node) => selected.has(node.nodeId))
      .map((node) => ({ nodeId: node.nodeId, displayOrder: node.displayOrder }));
    return nodes.length
      ? [
          {
            groupId: group.groupId,
            displayOrder: group.displayOrder,
            defaultNodeId: nodes[0]!.nodeId,
            nodes,
          },
        ]
      : [];
  });
  return {
    workbenchId,
    displayOrder: canonical.displayOrder,
    landingNodeId,
    groups,
  };
}

function canonicalNode(nodeId: string) {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) => workbench.groups)
    .flatMap((group) => group.nodes)
    .find((node) => node.nodeId === nodeId)!;
}

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
    schemaVersion: '2',
    topologyRevision: HRIS_NAVIGATION_TOPOLOGY_REVISION,
    topologySha256: HRIS_NAVIGATION_TOPOLOGY_SHA256,
    iaRegisterSha256: HRIS_NAVIGATION_IA_REGISTER_SHA256,
    shellRegisterSha256: HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
    taskGroupRegisterSha256: HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
    generatedIaSha256: HRIS_NAVIGATION_GENERATED_IA_SHA256,
    enforcementState,
    policyEnforced: false,
    tenantPolicyId: null,
    tenantRevisionId: null,
    tenantRevisionNumber: null,
    legalEntityRevisionId: null,
    legalEntityRevisionNumber: null,
    revisionPin: null,
    workbenches: [],
    denialReason: null,
    evaluatedAt: '2026-10-17T04:00:00Z',
    ...overrides,
  };
}

function revisionPin(seed: string) {
  return `nav-v2-${seed.repeat(64)}`;
}
