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

import { PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS } from '../../../../routes/product-surface-authorization.generated';

import {
  createHrisPolicyShellNavigationProjection,
  HRIS_NAVIGATION_RUNTIME_OWNER_OVERLAY_RECORDS,
  projectHrisWorkbenchTaskNavigation,
  resolveHrisRuntimePolicyDeepLink,
  selectHrisRuntimeNavigationPolicy,
  selectRuntimeHrisNavigationPolicyProjection,
} from './hris-navigation-policy-runtime';

import {
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  HRIS_V52_PAGE_AUTHORITY_ROUTE_BINDINGS,
} from './seven-workbench-navigation-policy';

import {
  effectiveWorkbench,
  projectionV3,
  admittedPolicyRoute,
  effectiveV3SelfWorkbench,
  revisionPin,
} from './hris-navigation-policy-runtime.test-support';

const mutableAuthorizationPageProjections = PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS as unknown as {
  routeContractKey: string;
}[];
const sealedAuthorizationPageProjections = [...mutableAuthorizationPageProjections];

describe('server-owned HRIS seven-workbench navigation runtime', () => {
  beforeEach(() => {
    mutableAuthorizationPageProjections.splice(
      0,
      mutableAuthorizationPageProjections.length,
      ...sealedAuthorizationPageProjections
    );
    transport.get.mockReset();
    generatedAuthorizationRegistry.revision.version = 52;
    generatedAuthorizationRegistry.revision.checksum =
      'b33fbf968e71f97b09fa497fdfad7d2f6854199170b79fd1602a0ea604977346';
    vi.stubEnv('VITE_HRIS_HRM_009_ENABLED', 'false');
  });
  afterEach(() => vi.unstubAllEnvs());

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

    generatedAuthorizationRegistry.revision.version = 57;
    generatedAuthorizationRegistry.revision.checksum =
      'f7d6e2ef92f563747ed062e496638ea83498a33414fc12586c794f517e626d6e';
    const missingPersonalRequestsIndex = mutableAuthorizationPageProjections.findIndex(
      (projection) => projection.routeContractKey === 'route.hcm.personal.requests.page'
    );
    expect(missingPersonalRequestsIndex).toBeGreaterThanOrEqual(0);
    const [missingPersonalRequests] = mutableAuthorizationPageProjections.splice(
      missingPersonalRequestsIndex,
      1
    );
    expect(() => selectRuntimeHrisNavigationPolicyProjection(successorProjection)).toThrow(
      /route alias is not sealed/u
    );
    mutableAuthorizationPageProjections.splice(
      missingPersonalRequestsIndex,
      0,
      missingPersonalRequests!
    );

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
});
