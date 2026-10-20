import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ get: vi.fn() }));
const generatedAuthorizationRegistry = vi.hoisted(() => ({
  revision: {
    bundleKey: 'product-surfaces',
    version: 52 as number,
    checksum: 'b33fbf968e71f97b09fa497fdfad7d2f6854199170b79fd1602a0ea604977346' as string,
    indexChecksum: '5e444564797eb56fd3055eb00c6e3250111b3045fdbff81f0485a3164bf8b010' as string,
  },
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

vi.mock('../../../../routes/product-surface-authorization.generated', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION: generatedAuthorizationRegistry.revision,
}));

import {
  createHrisPolicyShellNavigationProjection,
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
  HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
  HRIS_NAVIGATION_GENERATED_IA_SHA256,
  HRIS_NAVIGATION_IA_REGISTER_SHA256,
  HRIS_NAVIGATION_SCOPE_PARAM,
  HRIS_NAVIGATION_SHELL_REGISTER_SHA256,
  HRIS_NAVIGATION_TASK_GROUP_REGISTER_SHA256,
  HRIS_NAVIGATION_TOPOLOGY_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_SHA256,
  HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
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
import {
  HRIS_NAVIGATION_POLICY_RUNTIME_STATE,
  HRIS_NAVIGATION_POLICY_V3_RUNTIME_STATE,
} from './hris-navigation-policy-feature';
import {
  HRIS_CONTROLLED_EXPORT_NODE_ID,
  HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION,
  HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256,
} from '../model/hris-navigation-topology-successor';
import {
  canonicalHrisWorkbench,
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS,
  HRIS_WORKBENCH_IDS,
  HRIS_WORKBENCH_VIEW_BY_ID,
  isHrisRuntimeEffectiveRouteAlias,
} from './seven-workbench-navigation-policy';
import { HRIS_R7_GOVERNED_PAGE_CATALOG } from '../../../hcm/hcm-navigation';

import type { HrisWorkbenchId } from './seven-workbench-navigation-policy';

describe('server-owned HRIS seven-workbench navigation runtime', () => {
  beforeEach(() => {
    transport.get.mockReset();
    generatedAuthorizationRegistry.revision.version = 52;
    generatedAuthorizationRegistry.revision.checksum =
      'b33fbf968e71f97b09fa497fdfad7d2f6854199170b79fd1602a0ea604977346';
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'false');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('keeps NOT_ENROLLED, OFF, and SHADOW on the finite compatibility shell', () => {
    for (const enforcementState of ['NOT_ENROLLED', 'OFF', 'SHADOW'] as const) {
      const policy = selectHrisRuntimeNavigationPolicy(
        selectRuntimeHrisNavigationPolicyProjection(projection(enforcementState))
      );
      expect(policy.mode).toBe('STATIC');
      const items = createHrisPolicyShellNavigationProjection(policy)
        .project(new Set(['/hr/operations/home', '/hr/unimplemented']))
        .flatMap((group) => group.items);
      expect(items.map((item) => item.path)).toEqual(['/hr/operations/home']);
      expect(items).toHaveLength(1);
    }
  });

  it('omits static workbenches without tasks while retaining home and task-backed workbenches', () => {
    for (const enforcementState of ['NOT_ENROLLED', 'OFF', 'SHADOW'] as const) {
      const policy = selectHrisRuntimeNavigationPolicy(
        selectRuntimeHrisNavigationPolicyProjection(projection(enforcementState))
      );
      const shell = createHrisPolicyShellNavigationProjection(policy);
      const shellOnlyItems = shell
        .project(new Set(['/hr/home', '/hr/manage/system']))
        .flatMap((group) => group.items);

      expect(shellOnlyItems.map((item) => item.view)).toEqual(['shell-home']);
      expect(
        projectHrisWorkbenchTaskNavigation(
          policy,
          'workbench-settings',
          new Set(['/hr/manage/system'])
        )
      ).toEqual([]);

      const taskBackedPaths = new Set(['/hr/home', '/hr/settings/operations']);
      const taskBackedItems = shell.project(taskBackedPaths).flatMap((group) => group.items);

      expect(taskBackedItems.map((item) => item.view)).toEqual([
        'shell-home',
        'workbench-settings',
      ]);
      expect(taskBackedItems[1]).toMatchObject({ path: '/hr/settings/operations' });
      expect(
        projectHrisWorkbenchTaskNavigation(policy, 'workbench-settings', taskBackedPaths).flatMap(
          (group) => group.nodes.map((node) => node.nodeId)
        )
      ).toEqual(['BASE:settings-operations']);

      const combinedPaths = new Set(['/hr/home', '/hr/manage/system', '/hr/settings/operations']);
      const combinedSettings = shell
        .project(combinedPaths)
        .flatMap((group) => group.items)
        .find((item) => item.view === 'workbench-settings');

      expect(combinedSettings).toMatchObject({ path: '/hr/manage/system' });
      expect(
        projectHrisWorkbenchTaskNavigation(policy, 'workbench-settings', combinedPaths).flatMap(
          (group) => group.nodes.map((node) => node.nodeId)
        )
      ).toEqual(['BASE:settings-operations']);
      expect(shell.resolveSelectedView?.('/hr/manage/system')).toBe('workbench-settings');
    }
  });

  it('projects only already-authorized compatibility descendants in static mode', () => {
    const policy = resolveHrisRuntimeNavigationPolicyEvidence({
      runtimeEnabled: false,
      governed: false,
      requestReady: false,
      selectorState: 'TENANT',
      queryPending: false,
      queryError: false,
    });
    const groups = projectHrisWorkbenchTaskNavigation(
      policy,
      'workbench-my-hr',
      new Set(['/hr/me', '/hr/time', '/hr/pay'])
    );

    expect(groups.map((group) => group.groupId)).toEqual(['MY-01', 'MY-03', 'MY-04']);
    expect(
      groups.flatMap((group) => group.nodes.map((node) => [node.nodeId, node.routeAliases[0]]))
    ).toEqual([
      ['BASE:my-hr-profile', '/hr/me'],
      ['BASE:my-time', '/hr/time'],
      ['BASE:my-pay-tax', '/hr/pay'],
    ]);
  });

  it('projects every authorized mounted R7 PAGE from the static shell into its task group', () => {
    const mountedR7Pages = [
      ['BASE:my-hr-requests', '/hr/me/requests'],
      ['BASE:team-people-changes', '/hr/team/people-changes'],
      ['BASE:team-delegation', '/hr/team/delegation'],
      ['BASE:hr-appointments', '/hr/operations/people/appointments'],
      ['BASE:hr-organization-positions', '/hr/operations/people/organization-positions'],
      ['BASE:hr-certificates-documents', '/hr/operations/people/certificates-documents'],
      ['BASE:pay-population', '/hr/operations/payroll/population'],
      ['BASE:settings-people-employment', '/hr/settings/people-employment'],
      ['BASE:settings-workflow', '/hr/settings/workflow'],
      ['BASE:settings-operations', '/hr/settings/operations'],
    ] as const;
    expect(mountedR7Pages.map(([, path]) => path).sort()).toEqual(
      HRIS_R7_GOVERNED_PAGE_CATALOG.filter((page) => page.state === 'ADMISSION_MOUNTED')
        .map((page) => page.path)
        .sort()
    );
    const authorized = new Set<string>(mountedR7Pages.map(([, path]) => path));
    const policy = resolveHrisRuntimeNavigationPolicyEvidence({
      runtimeEnabled: false,
      governed: false,
      requestReady: false,
      selectorState: 'TENANT',
      queryPending: false,
      queryError: false,
    });
    const shellItems = createHrisPolicyShellNavigationProjection(policy)
      .project(authorized)
      .flatMap((group) => group.items);
    const taskNodes = shellItems.flatMap((item) =>
      projectHrisWorkbenchTaskNavigation(policy, item.view, authorized).flatMap((group) =>
        group.nodes.map((node) => [node.nodeId, node.routeAliases[0]] as const)
      )
    );

    expect(shellItems.map((item) => item.view)).toEqual([
      'workbench-my-hr',
      'workbench-team',
      'workbench-hr-operations',
      'workbench-payroll',
      'workbench-settings',
    ]);
    expect(taskNodes).toEqual(mountedR7Pages);
    expect(taskNodes.every(([, path]) => authorized.has(path))).toBe(true);
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
    const shellGroups = createHrisPolicyShellNavigationProjection(policy).project(authorized);
    const items = shellGroups.flatMap((group) => group.items);

    expect(shellGroups.map((group) => group.id)).toEqual([
      'people-work',
      'operations-work',
      'administration',
    ]);
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
        projection('OFF', {
          topologyRevision: HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION,
          topologySha256: HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_SHA256,
        })
      )
    ).toThrow('topology');
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('OFF', {
          topologyRevision: HRIS_NAVIGATION_TOPOLOGY_PREDECESSOR_REVISION,
          topologySha256: HRIS_NAVIGATION_TOPOLOGY_SHA256,
        })
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

  it('uses only server-admitted aliases and keeps assignment compatibility deep-link only', () => {
    const canonicalPath = '/hr/operations/people/employment-assignments';
    const compatibilityPath = '/hr/operations/assignments';
    const assignment = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
      'BASE:hr-employment-assignments',
    ]);
    const policy = enforcedPolicy([
      withNodeRouteAliases(assignment, 'BASE:hr-employment-assignments', [
        canonicalPath,
        compatibilityPath,
      ]),
    ]);
    const authorized = new Set([canonicalPath, compatibilityPath]);
    const projected = projectHrisWorkbenchTaskNavigation(
      policy,
      'workbench-hr-operations',
      authorized
    );

    expect(projected.flatMap((group) => group.nodes)).toEqual([
      expect.objectContaining({
        nodeId: 'BASE:hr-employment-assignments',
        routeAliases: [canonicalPath, compatibilityPath],
      }),
    ]);
    expect(
      createHrisPolicyShellNavigationProjection(policy)
        .project(authorized)
        .flatMap((group) => group.items)
    ).toEqual([
      expect.objectContaining({
        path: canonicalPath,
        activePathPrefixes: [canonicalPath, compatibilityPath],
      }),
    ]);
    expect(resolveHrisRuntimePolicyDeepLink(policy, compatibilityPath, authorized)).toMatchObject({
      decision: 'ALLOW',
      nodeId: 'BASE:hr-employment-assignments',
      revisionPin: policy.revisionPin,
    });

    const canonicalOnlyPolicy = enforcedPolicy([
      withNodeRouteAliases(assignment, 'BASE:hr-employment-assignments', [canonicalPath]),
    ]);
    expect(
      projectHrisWorkbenchTaskNavigation(
        canonicalOnlyPolicy,
        'workbench-hr-operations',
        new Set([compatibilityPath])
      )
    ).toEqual([]);
    expect(
      resolveHrisRuntimePolicyDeepLink(
        canonicalOnlyPolicy,
        compatibilityPath,
        new Set([compatibilityPath])
      ).decision
    ).toBe('DENY');

    const compatibilityOnlyPolicy = enforcedPolicy([
      withNodeRouteAliases(assignment, 'BASE:hr-employment-assignments', [compatibilityPath]),
    ]);
    expect(
      projectHrisWorkbenchTaskNavigation(
        compatibilityOnlyPolicy,
        'workbench-hr-operations',
        new Set([compatibilityPath])
      )
    ).toEqual([]);
    expect(
      resolveHrisRuntimePolicyDeepLink(
        compatibilityOnlyPolicy,
        compatibilityPath,
        new Set([compatibilityPath])
      ).decision
    ).toBe('ALLOW');
  });

  it('selects the R6-C operations home as the menu target while preserving the old deep link', () => {
    const compatibilityPath = '/hr/operations';
    const canonicalPath = '/hr/operations/home';
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-HR-OPERATIONS', ['BASE:hr-operations-home']),
    ]);
    const authorized = new Set([compatibilityPath, canonicalPath]);

    expect(
      projectHrisWorkbenchTaskNavigation(policy, 'workbench-hr-operations', authorized).flatMap(
        (group) => group.nodes
      )
    ).toEqual([
      expect.objectContaining({
        nodeId: 'BASE:hr-operations-home',
        routeAliases: [canonicalPath, compatibilityPath],
      }),
    ]);
    expect(
      createHrisPolicyShellNavigationProjection(policy)
        .project(authorized)
        .flatMap((group) => group.items)
    ).toEqual([
      expect.objectContaining({
        path: canonicalPath,
        activePathPrefixes: [canonicalPath, compatibilityPath],
      }),
    ]);
    expect(resolveHrisRuntimePolicyDeepLink(policy, compatibilityPath, authorized)).toMatchObject({
      decision: 'ALLOW',
      nodeId: 'BASE:hr-operations-home',
    });
  });

  it('projects the controlled export only from its dedicated SET-08 successor node', () => {
    const route = '/hr/data/exports';
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-SETTINGS', [HRIS_CONTROLLED_EXPORT_NODE_ID]),
    ]);
    const authorized = new Set([route]);
    const tasks = projectHrisWorkbenchTaskNavigation(policy, 'workbench-settings', authorized);
    const shellItems = createHrisPolicyShellNavigationProjection(policy)
      .project(authorized)
      .flatMap((group) => group.items);

    expect(tasks).toEqual([
      expect.objectContaining({
        groupId: 'SET-08',
        nodes: [
          expect.objectContaining({
            nodeId: HRIS_CONTROLLED_EXPORT_NODE_ID,
            routeAliases: [route],
            displayOrder: 5,
          }),
        ],
      }),
    ]);
    expect(shellItems).toEqual([
      expect.objectContaining({
        path: route,
        view: 'workbench-settings',
        activePathPrefixes: [route],
      }),
    ]);
    expect(
      resolveHrisRuntimePolicyDeepLink(policy, `${route}?dataset=workers#requests`, authorized)
    ).toMatchObject({
      decision: 'ALLOW',
      nodeId: HRIS_CONTROLLED_EXPORT_NODE_ID,
      route,
    });
    expect(resolveHrisRuntimePolicyDeepLink(policy, route, new Set())).toMatchObject({
      decision: 'DENY',
    });
  });

  it('rejects missing, duplicate, unsafe, excluded, POLICY-only, and unsealed server aliases', () => {
    const people = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', ['BASE:hr-people']);
    const peoplePath = '/hr/operations/people';
    const hostileAliases: readonly unknown[] = [
      undefined,
      [],
      [peoplePath, peoplePath],
      ['https://attacker.invalid/hr/operations/people'],
      ['/hr/operations/people/not-sealed'],
      ['/hr/directory'],
    ];
    for (const routeAliases of hostileAliases) {
      expect(() =>
        selectRuntimeHrisNavigationPolicyProjection(
          projection('ENFORCED', {
            policyEnforced: true,
            revisionPin: revisionPin('e'),
            workbenches: [withNodeRouteAliases(people, 'BASE:hr-people', routeAliases)],
          })
        )
      ).toThrow('route alias');
    }

    const assignments = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
      'BASE:hr-employment-assignments',
    ]);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('f'),
          workbenches: [
            withNodeRouteAliases(assignments, 'BASE:hr-employment-assignments', [
              '/hr/operations/assignments',
              '/hr/operations/people/employment-assignments',
            ]),
          ],
        })
      )
    ).toThrow('not sealed');

    const timeOperations = effectiveWorkbench('HRIS-WB-TIME', ['BASE:time-command-center']);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projection('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('1'),
          workbenches: [
            withNodeRouteAliases(timeOperations, 'BASE:time-command-center', [
              '/hr/operations/time',
            ]),
          ],
        })
      )
    ).toThrow('not sealed');
  });

  it('recognizes POLICY compatibility aliases but never treats them as runtime PAGE grants', () => {
    const policy = enforcedPolicy([
      effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
        'BASE:hr-people',
        'BASE:hr-organization-positions',
      ]),
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

  it('admits only the exact six V3 SELF POLICY aliases through one pinned projection', () => {
    const admittedPolicyRoutes = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map(admittedPolicyRoute);
    const myHr = effectiveV3SelfWorkbench();
    const selectedProjection = selectRuntimeHrisNavigationPolicyProjection(
      projectionV3('ENFORCED', {
        policyEnforced: true,
        revisionPin: revisionPin('3', 'a'),
        admittedPolicyRoutes,
        workbenches: [myHr],
      })
    );
    const policy = selectHrisRuntimeNavigationPolicy(selectedProjection);
    const authorized = new Set([
      ...HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => binding.path),
      '/hr/me/profile',
      '/hr/me/leave',
      '/hr/me/requests',
      '/hr/team',
    ]);
    const shellItems = createHrisPolicyShellNavigationProjection(policy)
      .project(authorized)
      .flatMap((group) => group.items);
    const taskGroups = projectHrisWorkbenchTaskNavigation(policy, 'workbench-my-hr', authorized);

    expect(policy).toMatchObject({
      mode: 'ENFORCED',
      schemaVersion: '3',
      revisionPin: revisionPin('3', 'a'),
    });
    expect(selectedProjection.schemaVersion).toBe('3');
    if (selectedProjection.schemaVersion !== '3') throw new Error('Expected a V3 projection.');
    expect(selectedProjection.admittedPolicyRoutes[0]?.routeGrantRef).toBe(
      `grant-${'8'.repeat(32)}`
    );
    expect(selectedProjection.runtimeOwnerOverlayRecords).toEqual(
      HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS
    );
    expect(shellItems).toEqual([
      expect.objectContaining({
        path: '/hr/me',
        view: 'workbench-my-hr',
        activePathPrefixes: HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => binding.path),
      }),
    ]);
    expect(
      taskGroups.flatMap((group) =>
        group.nodes.map((node) => ({ nodeId: node.nodeId, routeAliases: node.routeAliases }))
      )
    ).toEqual(
      HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => ({
        nodeId: binding.nodeId,
        routeAliases: [binding.path],
      }))
    );
    for (const binding of HRIS_V46_SELF_POLICY_ROUTE_BINDINGS) {
      expect(resolveHrisRuntimePolicyDeepLink(policy, binding.path, authorized)).toMatchObject({
        decision: 'ALLOW',
        revisionPin: policy.revisionPin,
        nodeId: binding.nodeId,
        route: binding.path,
      });
    }
    for (const withheld of ['/hr/me/profile', '/hr/me/leave', '/hr/me/requests', '/hr/team']) {
      expect(resolveHrisRuntimePolicyDeepLink(policy, withheld, authorized).decision).toBe('DENY');
    }
  });

  it('admits the append-only v52 SELF alias only when its exact PAGE path is authorized', () => {
    const admittedPolicyRoutes = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map(admittedPolicyRoute);
    const myHr = effectiveV3SelfWorkbench();
    const withV52Alias = {
      ...myHr,
      groups: myHr.groups.map((group) => ({
        ...group,
        nodes: group.nodes.map((node) =>
          node.nodeId === 'BASE:my-hr-requests'
            ? { ...node, routeAliases: [...node.routeAliases, '/hr/me/requests'] }
            : node
        ),
      })),
    };
    const operations = effectiveWorkbench('HRIS-WB-HR-OPERATIONS', [
      'BASE:hr-certificates-documents',
    ]);
    const successorProjection = projectionV3('ENFORCED', {
      policyEnforced: true,
      revisionPin: revisionPin('3', 'e'),
      admittedPolicyRoutes,
      workbenches: [withV52Alias, operations],
    });
    expect(() => selectRuntimeHrisNavigationPolicyProjection(successorProjection)).toThrow(
      /route alias is not sealed/u
    );
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'true');

    generatedAuthorizationRegistry.revision.version = 51;
    expect(() => selectRuntimeHrisNavigationPolicyProjection(successorProjection)).toThrow(
      /route alias is not sealed/u
    );

    generatedAuthorizationRegistry.revision.version = 52;
    generatedAuthorizationRegistry.revision.checksum = '0'.repeat(64);
    expect(() => selectRuntimeHrisNavigationPolicyProjection(successorProjection)).toThrow(
      /route alias is not sealed/u
    );

    generatedAuthorizationRegistry.revision.checksum =
      'b33fbf968e71f97b09fa497fdfad7d2f6854199170b79fd1602a0ea604977346';
    const policy = selectHrisRuntimeNavigationPolicy(
      selectRuntimeHrisNavigationPolicyProjection(successorProjection)
    );
    const withoutV52Page = new Set(
      HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => binding.path)
    );
    expect(
      resolveHrisRuntimePolicyDeepLink(policy, '/hr/me/requests', withoutV52Page).decision
    ).toBe('DENY');
    const withV52Page = new Set([...withoutV52Page, '/hr/me/requests']);
    expect(resolveHrisRuntimePolicyDeepLink(policy, '/hr/me/requests', withV52Page)).toMatchObject({
      decision: 'ALLOW',
      nodeId: 'BASE:my-hr-requests',
      route: '/hr/me/requests',
    });
    expect(
      projectHrisWorkbenchTaskNavigation(policy, 'workbench-my-hr', withV52Page)
        .flatMap((group) => group.nodes)
        .find((node) => node.nodeId === 'BASE:my-hr-requests')?.routeAliases
    ).toEqual(['/hr/me/requests', '/hr/services']);
    expect(HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS[0]?.minimumBundleVersion).toBe(52);
    expect(
      resolveHrisRuntimePolicyDeepLink(
        policy,
        '/hr/operations/people/certificates-documents',
        withV52Page
      ).decision
    ).toBe('DENY');
    const withBothV52Pages = new Set([
      ...withV52Page,
      '/hr/operations/people/certificates-documents',
    ]);
    expect(
      resolveHrisRuntimePolicyDeepLink(
        policy,
        '/hr/operations/people/certificates-documents',
        withBothV52Pages
      )
    ).toMatchObject({
      decision: 'ALLOW',
      nodeId: 'BASE:hr-certificates-documents',
      route: '/hr/operations/people/certificates-documents',
    });
  });

  it('accepts the sealed R6-C owner overlay aliases only in canonical-first order', () => {
    const selected = selectRuntimeHrisNavigationPolicyProjection(
      projectionV3('ENFORCED', {
        policyEnforced: true,
        revisionPin: revisionPin('3', 'd'),
        admittedPolicyRoutes: HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map(admittedPolicyRoute),
        workbenches: [
          effectiveV3SelfWorkbench(),
          effectiveWorkbench('HRIS-WB-TEAM', ['BASE:team-leave']),
          effectiveWorkbench('HRIS-WB-HR-OPERATIONS', ['BASE:hr-operations-home']),
          effectiveWorkbench('HRIS-WB-TIME', ['BASE:time-leave-operations']),
        ],
      })
    );

    expect(
      selected.workbenches.flatMap((workbench) =>
        workbench.groups.flatMap((group) =>
          group.nodes
            .filter((node) =>
              ['BASE:team-leave', 'BASE:hr-operations-home', 'BASE:time-leave-operations'].includes(
                node.nodeId
              )
            )
            .map((node) => [node.nodeId, node.routeAliases])
        )
      )
    ).toEqual([
      ['BASE:team-leave', ['/hr/team/leave', '/hr/team/absence']],
      ['BASE:hr-operations-home', ['/hr/operations/home', '/hr/operations']],
      [
        'BASE:time-leave-operations',
        ['/hr/operations/time/leave-operations', '/hr/operations/absence'],
      ],
    ]);
  });

  it('rejects hostile, mismatched, stale, duplicate, and unused V3 POLICY decisions', () => {
    const binding = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS[0]!;
    const validRoute = admittedPolicyRoute(binding);
    const workbenches = [effectiveV3SelfWorkbench([binding.nodeId])];
    const hostileRoutes = [
      [{ ...validRoute, path: '/hr/me/profile' }],
      [{ ...validRoute, routeContractKey: 'route.hcm.personal.time.page' }],
      [{ ...validRoute, profileKey: 'full-management' }],
      [{ ...validRoute, targetBinding: 'TARGET_POPULATION' }],
      [{ ...validRoute, routeGrantRef: validRoute.routeContractKey }],
      [{ ...validRoute, scopeBinding: { ...validRoute.scopeBinding, kind: 'LEGAL_ENTITY' } }],
      [{ ...validRoute, decisionRevision: 'decision-other' }],
      [{ ...validRoute, authRevision: 'auth-other' }],
      [{ ...validRoute, freshUntil: '2098-01-01T00:00:00.000Z' }],
      [validRoute, validRoute],
    ];
    for (const admittedPolicyRoutes of hostileRoutes) {
      expect(() =>
        selectRuntimeHrisNavigationPolicyProjection(
          projectionV3('ENFORCED', {
            policyEnforced: true,
            revisionPin: revisionPin('3', 'b'),
            admittedPolicyRoutes,
            workbenches,
          })
        )
      ).toThrow(/POLICY|authority|freshness/u);
    }
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projectionV3('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('3', 'b'),
          admittedPolicyRoutes: [validRoute],
          workbenches: [],
        })
      )
    ).toThrow(/inconsistent/u);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projectionV3('ENFORCED', {
          authorizationRegistryChecksum: '0'.repeat(64),
          policyEnforced: true,
          revisionPin: revisionPin('3', 'b'),
          admittedPolicyRoutes: [validRoute],
          workbenches,
        })
      )
    ).toThrow(/registry/u);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projectionV3('ENFORCED', {
          policyEnforced: true,
          revisionPin: revisionPin('3', 'b'),
          authorityFreshUntil: '2026-10-17T03:59:59.000Z',
          admittedPolicyRoutes: [{ ...validRoute, freshUntil: '2026-10-17T03:59:59.000Z' }],
          workbenches,
        })
      )
    ).toThrow(/freshness/u);
    for (const overlayDrift of [
      { runtimeOwnerOverlayChecksum: '0'.repeat(64) },
      { runtimeOwnerOverlayRecords: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS.slice(1) },
      {
        runtimeOwnerOverlayRecords: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS.map(
          (record, index) =>
            index === 0 ? { ...record, effectiveRuntimeOwner: 'dwp-time-server' } : record
        ),
      },
    ]) {
      expect(() =>
        selectRuntimeHrisNavigationPolicyProjection(
          projectionV3('ENFORCED', {
            policyEnforced: true,
            revisionPin: revisionPin('3', 'b'),
            admittedPolicyRoutes: [validRoute],
            workbenches,
            ...overlayDrift,
          })
        )
      ).toThrow(/owner overlay/u);
    }
  });

  it('accepts only an empty V3 authority carrier outside ENFORCED mode', () => {
    for (const enforcementState of ['NOT_ENROLLED', 'OFF', 'SHADOW'] as const) {
      const selected = selectRuntimeHrisNavigationPolicyProjection(projectionV3(enforcementState));
      expect(selected).toMatchObject({
        schemaVersion: '3',
        enforcementState,
        admittedPolicyRoutes: [],
        authorityDecisionRevision: null,
      });
      expect(selectHrisRuntimeNavigationPolicy(selected).mode).toBe('STATIC');
    }
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projectionV3('OFF', {
          authorityDecisionRevision: 'decision-1',
        })
      )
    ).toThrow(/Non-enforced/u);
    expect(() =>
      selectRuntimeHrisNavigationPolicyProjection(
        projectionV3('SHADOW', {
          admittedPolicyRoutes: [admittedPolicyRoute(HRIS_V46_SELF_POLICY_ROUTE_BINDINGS[0]!)],
        })
      )
    ).toThrow(/Non-enforced/u);
  });

  it('keeps runtime default-off and reads only governed, ready scope evidence', () => {
    expect(HRIS_NAVIGATION_POLICY_RUNTIME_STATE).toBe('OFF');
    expect(HRIS_NAVIGATION_POLICY_V3_RUNTIME_STATE).toBe('OFF');
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

  it('uses V3 only for an explicitly selected tenant carrier and never accepts a V2 downgrade', async () => {
    transport.get.mockResolvedValue({ data: { data: projectionV3('OFF') } });
    await readRuntimeNavigationPolicyProjection({
      contextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
      navigationScope: 'TENANT',
      carrierVersion: '3',
      correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6d',
    });
    expect(new URL(transport.get.mock.calls[0][0], 'http://test.invalid').pathname).toBe(
      HRIS_NAVIGATION_POLICY_V3_RUNTIME_PATH
    );

    transport.get.mockResolvedValue({ data: { data: projection('OFF') } });
    await expect(
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
        navigationScope: 'TENANT',
        carrierVersion: '3',
        correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6e',
      })
    ).rejects.toThrow(/carrier version/u);
    await expect(
      readRuntimeNavigationPolicyProjection({
        contextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
        navigationScope: 'LEGAL_ENTITY',
        carrierVersion: '3',
        legalEntityPublicId: '6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
        correlationId: '2983c2ef-6c0e-47f5-862c-84007dc2da6f',
      })
    ).rejects.toThrow(/tenant SELF/u);
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
      .map((node) => ({
        nodeId: node.nodeId,
        displayOrder: node.displayOrder,
        routeAliases: node.routeAliases.filter(isHrisRuntimeEffectiveRouteAlias),
      }));
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

function withNodeRouteAliases(
  workbench: ReturnType<typeof effectiveWorkbench>,
  nodeId: string,
  routeAliases: unknown
) {
  return {
    ...workbench,
    groups: workbench.groups.map((group) => ({
      ...group,
      nodes: group.nodes.map((node) => (node.nodeId === nodeId ? { ...node, routeAliases } : node)),
    })),
  };
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

function projectionV3(
  enforcementState:
    | 'NOT_ENROLLED'
    | 'OFF'
    | 'SHADOW'
    | 'ENFORCED'
    | 'DENIED_MISSING_POLICY'
    | 'DENIED_STALE_CONTEXT',
  overrides: Record<string, unknown> = {}
) {
  const enforced = enforcementState === 'ENFORCED';
  return {
    ...projection(enforcementState),
    schemaVersion: '3',
    authorizationRegistryVersion: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_VERSION,
    authorizationRegistryChecksum: HRIS_NAVIGATION_AUTHORIZATION_REGISTRY_SHA256,
    runtimeOwnerOverlayRevision: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_REVISION,
    runtimeOwnerOverlayChecksum: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_SHA256,
    runtimeOwnerOverlayRecords: HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS.map((record) => ({
      ...record,
      firstReadBinding: { ...record.firstReadBinding },
    })),
    authorityDecisionCount: enforced ? 6 : 0,
    navigationContextScopeKey: `hcm-scope-${'1'.repeat(40)}`,
    authoritySelfScopeKey: enforced ? `scope-${'7'.repeat(32)}` : null,
    authoritySnapshotRevision: enforced ? 'snapshot-1' : null,
    authorityDecisionRevision: enforced ? 'decision-1' : null,
    authorityAuthRevision: enforced ? 'auth-1' : null,
    authorityPolicyRevision: enforced ? 'policy-1' : null,
    authorityRelationshipRevision: enforced ? 'relationship-1' : null,
    authorityFreshUntil: enforced ? '2099-01-01T00:00:00.000Z' : null,
    admittedPolicyRoutes: [],
    ...overrides,
  };
}

function admittedPolicyRoute(binding: (typeof HRIS_V46_SELF_POLICY_ROUTE_BINDINGS)[number]) {
  return {
    nodeId: binding.nodeId,
    path: binding.path,
    routeContractKey: binding.routeContractKey,
    profileKey: binding.profileKey,
    targetBinding: binding.targetBinding,
    scopeBinding: {
      kind: binding.scopeBindingKind,
      key: `scope-${'7'.repeat(32)}`,
      personPublicId: '6d07e952-2f5f-4dc1-8be7-6d7e210d23af',
    },
    decision: 'ALLOWED',
    routeGrantRef: `grant-${'8'.repeat(32)}`,
    decisionRevision: 'decision-1',
    authRevision: 'auth-1',
    policyRevision: 'policy-1',
    relationshipRevision: 'relationship-1',
    freshUntil: '2099-01-01T00:00:00.000Z',
  };
}

function effectiveV3SelfWorkbench(
  nodeIds = HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => binding.nodeId)
) {
  const routeByNode = new Map(
    HRIS_V46_SELF_POLICY_ROUTE_BINDINGS.map((binding) => [binding.nodeId, binding.path])
  );
  const source = effectiveWorkbench('HRIS-WB-MY-HR', nodeIds);
  return {
    ...source,
    groups: source.groups.map((group) => ({
      ...group,
      nodes: group.nodes.map((node) => ({
        ...node,
        routeAliases: [routeByNode.get(node.nodeId)!],
      })),
    })),
  };
}

function revisionPin(versionOrSeed: '2' | '3' | string, maybeSeed?: string) {
  const version = maybeSeed ? versionOrSeed : '2';
  const seed = maybeSeed ?? versionOrSeed;
  return `nav-v${version}-${seed.repeat(64)}`;
}
