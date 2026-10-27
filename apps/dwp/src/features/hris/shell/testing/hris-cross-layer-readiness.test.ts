import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { HRIS_PRODUCT_MAP_CATALOG } from '../model/hris-product-map-catalog';
import { HRIS_RUNTIME_NAVIGATION_MANIFEST } from '../model/hris-runtime-navigation-manifest';
import {
  buildHrisCrossLayerReadinessReport,
  validateHrisRuntimeTaskGroupClosure,
} from '../../../../test-utils/hris-cross-layer-readiness';

import type {
  HcmView,
  AdminView,
  HrisTenantActivationEvidence,
} from '../../../../test-utils/hris-cross-layer-readiness';

type Roadmap = Readonly<{
  tenantFeatureActivationLane: Omit<HrisTenantActivationEvidence, 'evidenceSource'>;
}>;

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function mountedHcmViews(): ReadonlySet<HcmView> {
  const path = new URL('../../../../pages/hcm.tsx', import.meta.url);
  const source = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(
    path.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const mounted = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'contentByView' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property.name);
        if (name) mounted.add(name);
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === 'page' &&
      node.left.name.text === 'view' &&
      ts.isStringLiteral(node.right)
    ) {
      mounted.add(node.right.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return mounted as ReadonlySet<HcmView>;
}

function mountedAdminViews(): ReadonlySet<AdminView> {
  const path = new URL('../../../admin/admin-content.tsx', import.meta.url);
  const source = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(
    path.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const mounted = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'ADMIN_CONTENT' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = propertyName(property.name);
        if (name) mounted.add(name);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return mounted as ReadonlySet<AdminView>;
}

function declaredTenantActivationFromRoadmap(): HrisTenantActivationEvidence {
  const path = resolve(
    process.cwd(),
    'docs/06-delivery/hris/wave7-2026-10-17/execution-roadmap-successor.v20.json'
  );
  return {
    ...(JSON.parse(readFileSync(path, 'utf8')) as Roadmap).tenantFeatureActivationLane,
    evidenceSource: 'execution-roadmap-successor.v20.json#tenantFeatureActivationLane',
  };
}

describe('HRIS IA-to-runtime and declared-activation cross-layer readiness', () => {
  it('classifies every IA node without confusing default-OFF or catalog-only with drift', () => {
    const report = buildHrisCrossLayerReadinessReport({
      mountedViews: mountedHcmViews(),
      mountedAdminViews: mountedAdminViews(),
      tenantActivation: declaredTenantActivationFromRoadmap(),
    });

    expect(report.drifts).toEqual([]);
    expect(report.summary).toMatchObject({
      baseIaNodes: 98,
      runtimeNodes: 99,
      baseCatalogNodes: 76,
      modernNodes: 22,
      hcmNavigationRoutes: 49,
      compatibilityRoutes: 3,
      authorizedPageRoutes: 158,
      governedAdmissionMountedRoutes: 10,
      governedCatalogOnlyRoutes: 3,
      productionAuthorizedNodes: 0,
      declaredActivationEvidenceSource:
        'execution-roadmap-successor.v20.json#tenantFeatureActivationLane',
      declaredActivationState:
        'INTEGRATED_DEFAULT_OFF_ZERO_TENANT_ENROLLMENT_ZERO_PRODUCTION_BINDING',
      states: {
        MOUNTED_DEFAULT_OFF: 32,
        MOUNTED_PRODUCTION_AUTHORIZED: 0,
        COMPATIBILITY_ROUTE_ONLY: 9,
        AUTHORIZED_METADATA_ONLY: 9,
        EXTERNAL_CONTROL_PLANE: 5,
        EXTERNAL_TARGET_PLANNED: 1,
        DESIGN_ONLY: 43,
      },
    });
    expect(Object.values(report.summary.states).reduce((total, count) => total + count, 0)).toBe(
      report.summary.runtimeNodes
    );
    expect(
      report.nodes
        .filter((node) => node.state === 'COMPATIBILITY_ROUTE_ONLY')
        .map((node) => [node.sourceNodeKey, node.mountedCompatibilityPaths])
    ).toEqual([
      ['my-hr-profile', ['/hr/me']],
      ['my-leave', ['/hr/absence']],
      ['team-home', ['/hr/team']],
      ['team-members', ['/hr/team']],
      ['hr-data-quality', ['/hr/data/integrations']],
      ['time-command-center', ['/hr/operations/time']],
      ['pay-command-center', ['/hr/operations/pay']],
      ['performance-command-center', ['/hr/operations/talent']],
      ['settings-integrations', ['/hr/data/integrations']],
    ]);
    expect(
      report.nodes
        .filter((node) => node.mountedCurrentPartialPaths.length > 0)
        .map((node) => [node.sourceNodeKey, node.mountedCurrentPartialPaths])
    ).toHaveLength(15);
    expect(
      report.nodes.find((node) => node.sourceNodeKey === 'hcm.management.controlled-export')
    ).toMatchObject({
      module: 'HRM',
      canonicalRoute: '/hr/data/exports',
      state: 'MOUNTED_DEFAULT_OFF',
      hasCurrentCatalog: true,
      hasPageAuthorization: true,
      hasExactMountedRoute: true,
      productionState: 'NOT_AUTHORIZED_G6',
    });
    expect(report.nodes.find((node) => node.sourceNodeKey === 'dwp-governance')).toMatchObject({
      hasCompatibilityRoute: false,
      mountedCompatibilityPaths: [],
      retiredAliasPaths: ['/hr/data/exports'],
    });
    expect(
      report.nodes
        .filter((node) => node.sourceNodeKey.startsWith('dwp-'))
        .map((node) => [
          node.sourceNodeKey,
          node.state,
          node.hasPageAuthorization,
          node.authorizationKind,
        ])
    ).toEqual([
      ['dwp-experience', 'EXTERNAL_CONTROL_PLANE', false, 'ADMIN_RESOURCE_GUARD'],
      ['dwp-identity', 'EXTERNAL_CONTROL_PLANE', false, 'ADMIN_RESOURCE_GUARD'],
      ['dwp-platform', 'EXTERNAL_CONTROL_PLANE', false, 'ADMIN_RESOURCE_GUARD'],
      ['dwp-integrations', 'EXTERNAL_CONTROL_PLANE', false, 'ADMIN_RESOURCE_GUARD'],
      ['dwp-governance', 'EXTERNAL_CONTROL_PLANE', true, 'PRODUCT_PAGE'],
      ['dwp-extensibility', 'EXTERNAL_TARGET_PLANNED', false, 'NONE'],
    ]);
  });

  it('closes every non-home runtime node through exactly one task group', () => {
    expect(
      validateHrisRuntimeTaskGroupClosure({
        nodes: HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes,
        taskGroups: HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups,
      })
    ).toEqual([]);

    const duplicate = HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups.map((group, index) =>
      index === 0
        ? {
            ...group,
            memberIaNodeIds: [...group.memberIaNodeIds, group.memberIaNodeIds[0]!],
          }
        : group
    );
    expect(
      validateHrisRuntimeTaskGroupClosure({
        nodes: HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes,
        taskGroups: duplicate,
      })
    ).toContain(
      `runtime task-group membership differs: ${duplicate[0]!.memberIaNodeIds[0]!} expected=1 actual=2`
    );
  });

  it('fails closed when a current partial route is assigned to the wrong canonical owner', () => {
    const first = HRIS_PRODUCT_MAP_CATALOG.find((node) => node.id === 'my-hr-requests')!;
    const second = HRIS_PRODUCT_MAP_CATALOG.find((node) => node.id === 'team-leave')!;
    const swapped = HRIS_PRODUCT_MAP_CATALOG.map((node) => {
      if (node.id === first.id) return { ...node, currentPartialPaths: second.currentPartialPaths };
      if (node.id === second.id) return { ...node, currentPartialPaths: first.currentPartialPaths };
      return node;
    });
    const report = buildHrisCrossLayerReadinessReport({
      mountedViews: mountedHcmViews(),
      mountedAdminViews: mountedAdminViews(),
      tenantActivation: declaredTenantActivationFromRoadmap(),
      catalogNodes: swapped,
    });

    expect(report.drifts).toContain(
      'current partial path does not match its canonical owner: my-hr-requests -> /hr/team/leave'
    );
    expect(report.drifts).toContain(
      'current partial path does not match its canonical owner: team-leave -> /hr/me/requests'
    );
  });

  it('fails closed when an actual HCM route loses its component mount', () => {
    const mounted = new Set(mountedHcmViews());
    mounted.delete('payroll-population');

    const report = buildHrisCrossLayerReadinessReport({
      mountedViews: mounted,
      mountedAdminViews: mountedAdminViews(),
      tenantActivation: declaredTenantActivationFromRoadmap(),
    });

    expect(report.drifts).toContain(
      'HCM route has no page component mount: /hr/operations/payroll/population -> payroll-population'
    );
    expect(report.drifts).toContain(
      'ADMISSION_MOUNTED route is not mounted: /hr/operations/payroll/population'
    );
  });

  it('fails closed when an external DWP control-plane target loses its component mount', () => {
    const adminViews = new Set(mountedAdminViews());
    adminViews.delete('branding');

    const report = buildHrisCrossLayerReadinessReport({
      mountedViews: mountedHcmViews(),
      mountedAdminViews: adminViews,
      tenantActivation: declaredTenantActivationFromRoadmap(),
    });

    expect(report.drifts).toContain(
      'external control-plane target has no admin page mount: dwp-experience -> branding'
    );
  });

  it('fails closed when default-OFF evidence contradicts an active seed', () => {
    const activation = declaredTenantActivationFromRoadmap();
    const report = buildHrisCrossLayerReadinessReport({
      mountedViews: mountedHcmViews(),
      mountedAdminViews: mountedAdminViews(),
      tenantActivation: { ...activation, globalActiveSeeds: 1 },
    });

    expect(report.drifts).toContain(
      'default-OFF activation evidence contradicts active seeds or authorized IA nodes'
    );
  });
});
