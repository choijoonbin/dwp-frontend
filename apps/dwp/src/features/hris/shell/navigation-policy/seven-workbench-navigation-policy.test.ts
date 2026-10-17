import { describe, expect, it } from 'vitest';

import {
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG,
  HRIS_TASK_NODE_IDS,
  HRIS_WORKBENCH_IDS,
} from './seven-workbench-navigation-policy';

describe('generated seven-workbench task-navigation catalog', () => {
  it('preserves the exact generated 7/46/97 topology and canonical order', () => {
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
      { groups: 8, nodes: 22 },
    ]);
    expect(HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((value) => value.groups)).toHaveLength(
      46
    );
    expect(HRIS_TASK_NODE_IDS.size).toBe(97);
  });

  it('keeps every node in one canonical group and never creates excluded navigation aliases', () => {
    const nodes = HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) =>
      workbench.groups.flatMap((group) => group.nodes)
    );
    expect(new Set(nodes.map((node) => node.nodeId)).size).toBe(97);
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
      expect.arrayContaining([
        '/hr/operations/time/command-center',
        '/hr/operations/time',
      ])
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
