import { describe, expect, it } from 'vitest';

import {
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_TASK_NODE_IDS,
  HRIS_V46_SELF_POLICY_ROUTE_BINDINGS,
  HRIS_WORKBENCH_IDS,
  hrisV46SelfPolicyRouteBinding,
  isHrisRuntimeEffectiveRouteAlias,
  isHrisRuntimeMenuRouteAlias,
} from './seven-workbench-navigation-policy';

describe('successor seven-workbench task-navigation catalog', () => {
  it('preserves the exact 7/46/98 topology and canonical order', () => {
    expect(
      HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.map((workbench) => workbench.workbenchId)
    ).toEqual(HRIS_WORKBENCH_IDS);
    expect(
      HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.map((workbench) => workbench.displayOrder)
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.map((workbench) => ({
        groups: workbench.groups.length,
        nodes: workbench.groups.flatMap((group) => group.nodes).length,
      }))
    ).toEqual([
      { groups: 6, nodes: 14 },
      { groups: 5, nodes: 7 },
      { groups: 7, nodes: 17 },
      { groups: 6, nodes: 11 },
      { groups: 7, nodes: 14 },
      { groups: 7, nodes: 12 },
      { groups: 8, nodes: 23 },
    ]);
    expect(HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((value) => value.groups)).toHaveLength(
      46
    );
    expect(HRIS_TASK_NODE_IDS.size).toBe(98);
  });

  it('keeps every node in one canonical group and never creates excluded navigation aliases', () => {
    const nodes = HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) =>
      workbench.groups.flatMap((group) => group.nodes)
    );
    expect(new Set(nodes.map((node) => node.nodeId)).size).toBe(98);
    expect(nodes.flatMap((node) => node.routeAliases)).not.toEqual(
      expect.arrayContaining(['/hr/explore', '/hr/benefits', '/hr/operations/benefits'])
    );
    expect(nodes.every((node) => node.routeAliases.length > 0)).toBe(true);
    expect(nodes.every((node) => !node.label.ko.startsWith('MODERN:'))).toBe(true);
    expect(nodes.every((node) => !node.label.en.startsWith('MODERN:'))).toBe(true);
    expect(node('BASE:pay-command-center').routeAliases).toEqual(
      expect.arrayContaining(['/hr/operations/payroll/command-center', '/hr/operations/pay'])
    );
    expect(node('BASE:time-command-center').routeAliases).toEqual(
      expect.arrayContaining(['/hr/operations/time/command-center', '/hr/operations/time'])
    );
    expect(node('BASE:hr-employment-assignments').routeAliases).toEqual(
      expect.arrayContaining([
        '/hr/operations/assignments',
        '/hr/operations/people/employment-assignments',
      ])
    );
    expect(owners('/hr/me')).toEqual(['BASE:my-hr-profile']);
    expect(owners('/hr/team')).toEqual(['BASE:team-home']);
    expect(owners('/hr/data/integrations')).toEqual([]);
    expect(owners('/hr/data/exports')).toEqual(['MODERN:hcm.management.controlled-export']);
    expect(node('BASE:dwp-governance').routeAliases).not.toContain('/hr/data/exports');
    expect(node('MODERN:hcm.management.controlled-export')).toMatchObject({
      label: { ko: '통제형 반출', en: 'Governed exports' },
      canonicalRoute: '/hr/data/exports',
      routeAliases: ['/hr/data/exports'],
      displayOrder: 5,
    });
    const ownerByPath = new Map<string, string>();
    for (const candidate of nodes) {
      for (const route of candidate.routeAliases) {
        const previousOwner = ownerByPath.get(routePath(route));
        expect(previousOwner === undefined || previousOwner === candidate.nodeId).toBe(true);
        ownerByPath.set(routePath(route), candidate.nodeId);
      }
    }
    expect(
      HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.every(
        (workbench) =>
          workbench.label.ko !== workbench.label.en &&
          workbench.groups.every((group) => group.label.ko !== group.label.en)
      )
    ).toBe(true);
  });

  it('preserves canonical group and node display orders rather than compacting them', () => {
    for (const workbench of HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG) {
      expect(workbench.groups.map((group) => group.displayOrder)).toEqual(
        workbench.groups.map((_, index) => index)
      );
      for (const group of workbench.groups) {
        expect(group.nodes.map((node) => node.displayOrder)).toEqual(
          group.nodes.map((_, index) => index)
        );
      }
    }
  });

  it('admits the R6-C canonical routes while keeping compatibility aliases out of menus', () => {
    for (const path of [
      '/hr/operations/time/work-plans',
      '/hr/operations/performance/goal-cycles',
      '/hr/team/leave',
      '/hr/operations/time/leave-operations',
      '/hr/operations/home',
      '/hr/team/time',
      '/hr/data/exports',
    ]) {
      expect(isHrisRuntimeEffectiveRouteAlias(path), path).toBe(true);
      expect(isHrisRuntimeMenuRouteAlias(path), path).toBe(true);
    }

    for (const path of ['/hr/team/absence', '/hr/operations/absence', '/hr/operations']) {
      expect(isHrisRuntimeEffectiveRouteAlias(path), path).toBe(true);
      expect(isHrisRuntimeMenuRouteAlias(path), path).toBe(false);
    }

    for (const path of ['/hr/operations/time', '/hr/operations/pay', '/hr/operations/talent']) {
      expect(isHrisRuntimeEffectiveRouteAlias(path), path).toBe(false);
      expect(isHrisRuntimeMenuRouteAlias(path), path).toBe(false);
    }

    expect(
      HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) => workbench.groups)
        .flatMap((group) => group.nodes)
        .filter((node) =>
          [
            'BASE:team-time',
            'BASE:team-leave',
            'BASE:time-leave-operations',
            'BASE:hr-operations-home',
          ].includes(node.nodeId)
        )
        .map((node) => [node.nodeId, node.routeAliases])
    ).toEqual([
      ['BASE:team-time', ['/hr/team/time']],
      ['BASE:team-leave', ['/hr/team/leave', '/hr/team/absence']],
      ['BASE:hr-operations-home', ['/hr/operations/home', '/hr/operations']],
      [
        'BASE:time-leave-operations',
        ['/hr/operations/time/leave-operations', '/hr/operations/absence'],
      ],
    ]);
  });

  it('seals only the six exact v46 SELF POLICY aliases without reconstructing IA routes', () => {
    expect(HRIS_V46_SELF_POLICY_ROUTE_BINDINGS).toEqual([
      expect.objectContaining({ nodeId: 'BASE:my-hr-profile', path: '/hr/me' }),
      expect.objectContaining({ nodeId: 'BASE:my-time', path: '/hr/time' }),
      expect.objectContaining({ nodeId: 'BASE:my-leave', path: '/hr/absence' }),
      expect.objectContaining({ nodeId: 'BASE:my-pay-tax', path: '/hr/pay' }),
      expect.objectContaining({ nodeId: 'BASE:my-goals-performance', path: '/hr/talent' }),
      expect.objectContaining({ nodeId: 'BASE:my-hr-requests', path: '/hr/services' }),
    ]);
    expect(HRIS_V46_SELF_POLICY_ROUTE_BINDINGS).toHaveLength(6);
    expect(hrisV46SelfPolicyRouteBinding('BASE:my-hr-profile', '/hr/me')).toMatchObject({
      routeContractKey: 'route.hcm.personal.me.page',
      profileKey: 'full-work',
      targetBinding: 'SELF',
      scopeBindingKind: 'SELF',
    });
    for (const [nodeId, path] of [
      ['BASE:my-hr-profile', '/hr/me/profile'],
      ['BASE:my-leave', '/hr/me/leave'],
      ['BASE:my-hr-requests', '/hr/me/requests'],
      ['BASE:team-home', '/hr/team'],
    ] as const) {
      expect(hrisV46SelfPolicyRouteBinding(nodeId, path)).toBeUndefined();
    }
  });
});

function node(nodeId: string) {
  const match = HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) =>
    workbench.groups.flatMap((group) => group.nodes)
  ).find((candidate) => candidate.nodeId === nodeId);
  if (!match) throw new Error(`Missing test node: ${nodeId}`);
  return match;
}

function owners(path: string) {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) =>
    workbench.groups.flatMap((group) => group.nodes)
  )
    .filter((candidate) => candidate.routeAliases.some((route) => routePath(route) === path))
    .map((candidate) => candidate.nodeId);
}

function routePath(route: string) {
  return route.split(/[?#]/u, 1)[0] || '/';
}
