import { describe, expect, it } from 'vitest';

import { HRIS_PRODUCT_MAP_CATALOG, HRIS_RUNTIME_NAVIGATION_MANIFEST } from '../index';

function routePath(route: string) {
  return route.split(/[?#]/u, 1)[0]!.replace(/\/+$/u, '');
}

describe('HRIS 98-node runtime navigation manifest', () => {
  it('pins the reviewed IA, shell, and task-group sources', () => {
    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.revision.counts).toEqual({
      nodes: 98,
      shellEntries: 9,
      taskGroups: 46,
    });
    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.revision.sources).toEqual([
      expect.objectContaining({
        key: 'nodes',
        sha256: 'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686',
      }),
      expect.objectContaining({
        key: 'shellEntries',
        sha256: 'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000',
      }),
      expect.objectContaining({
        key: 'taskGroups',
        sha256: 'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b',
      }),
    ]);
    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.revision.topologySha256).toBe(
      '362376003858ae3dab752a7a6f0c88feda39f64de9739ed8e45bb38a563a9515'
    );
  });

  it('joins exactly the current 76-node catalog without inventing MODERN22 delivery', () => {
    const baseNodes = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.filter(
      (node) => node.sourceSet === 'BASE76'
    );
    const modernNodes = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.filter(
      (node) => node.sourceSet === 'MODERN22'
    );

    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes).toHaveLength(98);
    expect(baseNodes).toHaveLength(76);
    expect(modernNodes).toHaveLength(22);
    expect(new Set(baseNodes.map((node) => node.sourceNodeKey))).toEqual(
      new Set(HRIS_PRODUCT_MAP_CATALOG.map((node) => node.id))
    );
    expect(baseNodes.every((node) => node.currentCatalog !== null)).toBe(true);
    expect(modernNodes.every((node) => node.currentCatalog === null)).toBe(true);
  });

  it('keeps historical contract state separate from the current 12 delivered catalog nodes', () => {
    const historicalPilots = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes
      .filter((node) => node.contractSourceLifecycle === 'PILOT')
      .map((node) => node.sourceNodeKey);
    const currentPilots = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes
      .filter((node) => node.currentCatalog?.lifecycle === 'PILOT')
      .map((node) => node.sourceNodeKey);

    expect(historicalPilots).toEqual([
      'my-hr-home',
      'my-time',
      'my-pay-tax',
      'my-goals-performance',
      'hr-people',
    ]);
    expect(currentPilots).toEqual([
      'my-hr-home',
      'my-employment-documents',
      'my-time',
      'my-pay-tax',
      'my-goals-performance',
      'hr-people',
      'hr-employment-assignments',
      'time-clock-ingestion',
      'time-interpretation',
      'time-exceptions',
      'performance-review-operations',
      'settings-payroll',
    ]);

    const compensationPlanning = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.find(
      (node) => node.iaNodeId === 'MODERN:hcm.operations.compensation-planning'
    );
    expect(compensationPlanning).toMatchObject({
      canonicalRoute: '/hr/operations/performance/compensation-planning',
      contractImplementationState: 'NOT_STARTED_G3',
      contractProductionState: 'NOT_AUTHORIZED_G6',
      currentCatalog: null,
    });
  });

  it('preserves canonical personas without casting them to the legacy UI persona vocabulary', () => {
    const home = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.find(
      (node) => node.iaNodeId === 'BASE:my-hr-home'
    );
    expect(home?.contractPersonas).toEqual([
      'EMPLOYEE',
      'MANAGER',
      'BUSINESS_OPERATOR',
      'SETTINGS_ADMIN',
      'ENTERPRISE_AUDITOR',
    ]);
    expect(home?.contractPersonas).not.toContain('OPERATOR');
    expect(home?.contractPersonas).not.toContain('AUDITOR');
  });

  it('covers every non-home node exactly once across 46 ordered task groups', () => {
    const nonHomeIds = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes
      .filter((node) => node.navigationSurface !== 'HOME')
      .map((node) => node.iaNodeId);
    const groupedIds = HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups.flatMap(
      (group) => group.memberIaNodeIds
    );

    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.shellEntries).toHaveLength(9);
    expect(HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups).toHaveLength(46);
    expect(groupedIds).toHaveLength(97);
    expect(new Set(groupedIds)).toEqual(new Set(nonHomeIds));
    expect(new Set(groupedIds).size).toBe(97);
    for (const group of HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups) {
      expect(group.memberIaNodeIds).toContain(group.defaultIaNodeId);
    }

    const workbenchIds = new Set(
      HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups.map((group) => group.workbenchEntryId)
    );
    for (const workbenchId of workbenchIds) {
      const orders = HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups
        .filter((group) => group.workbenchEntryId === workbenchId)
        .map((group) => group.displayOrder);
      expect(orders).toEqual(orders.map((_, index) => index));
    }
  });

  it('keeps canonical routes unique and excludes the existing BENSK product paths', () => {
    const routes = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.map((node) =>
      routePath(node.canonicalRoute)
    );
    expect(new Set(routes).size).toBe(98);
    expect(routes).not.toContain('/hr/benefits');
    expect(routes).not.toContain('/hr/operations/benefits');
    expect(routes).toEqual(
      expect.arrayContaining(['/hr/me/benefits', '/hr/operations/employee-services/benefits'])
    );
  });

  it('deep-freezes the exported runtime boundary', () => {
    const firstBase = HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.find(
      (node) => node.sourceSet === 'BASE76'
    );
    expect(Object.isFrozen(HRIS_RUNTIME_NAVIGATION_MANIFEST)).toBe(true);
    expect(Object.isFrozen(HRIS_RUNTIME_NAVIGATION_MANIFEST.revision.sources)).toBe(true);
    expect(Object.isFrozen(HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes)).toBe(true);
    expect(Object.isFrozen(firstBase)).toBe(true);
    expect(Object.isFrozen(firstBase?.contractPersonas)).toBe(true);
    expect(Object.isFrozen(firstBase?.currentCatalog)).toBe(true);
    expect(Object.isFrozen(firstBase?.currentCatalog?.label)).toBe(true);
    expect(Object.isFrozen(HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups[0]?.memberIaNodeIds)).toBe(
      true
    );
  });
});
