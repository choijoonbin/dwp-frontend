import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { isSegmentOwnedPath } from '../../components/product-manifest';
import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../../routes/product-page-route-contracts';
import { hcmRoutes } from '../../routes/hcm-routes';
import { HCM_APP_ENTITLEMENT_CUTOVER, HCM_PRODUCT_MANIFEST } from './hcm-product-manifest';

import type { RouteObject } from 'react-router-dom';

type RegistryRequiredAccess = {
  type: 'CAPABILITY' | 'CAPABILITY_EXPRESSION' | 'POLICY';
  capabilityContractKey?: string;
  capabilityContractKeys?: readonly string[];
  mode?: 'ANY' | 'ALL';
  accessPolicyKey?: string;
};

type RegistryRoute = {
  routeContractKey: string;
  routeKind: 'PAGE' | 'DATA' | 'ACTION';
  bindingMode?: 'AUTHORIZATION_ONLY';
  subject: { productKey: string; surfaceKey: string };
  navigationContextId: string;
  uiRouteId: string | null;
  uiRoutePattern: string | null;
  gatewayApiBindings: readonly { bindingKey: string; method: string; path: string }[];
  servicePepBindings: readonly { bindingKey: string; method: string; path: string }[];
  accessProfiles: readonly {
    profileKey: string;
    requiredAccess: RegistryRequiredAccess;
  }[];
};

type RegistryBundle = {
  bundleKey: string;
  version: number;
  routes: readonly RegistryRoute[];
};

const authorizationSource = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'architecture/product-surface-authorization.v1.json'),
    'utf8'
  )
) as { bundles: readonly RegistryBundle[] };

const HCM_UTILITY_ROUTE_KEYS = [
  'route.hcm.shell.navigation-aggregate-v3.data',
  'route.hcm.shell.navigation-aggregate.data',
  'route.hcm.shell.navigation-deep-link-decision-v3.data',
  'route.hcm.shell.navigation-deep-link-decision.data',
  'route.hcm.utility.explorer-command-receipt.data',
  'route.hcm.utility.explorer-preferences-update.action',
  'route.hcm.utility.explorer-recent-create.action',
  'route.hcm.utility.explorer.page',
] as const;

const HCM_AUTHORIZATION_ONLY_PAGE_KEYS = new Set([
  'route.hcm.configuration.workflow.page',
  'route.hcm.team.delegation.page',
]);

const HCM_PAGE_KEYS_OUTSIDE_HCM_ROUTER = [
  'route.hcm.audit.evidence.page',
  'route.hcm.configuration.settings-integrations.page',
  'route.hcm.operations.exit-return.page',
  'route.hcm.personal.performance-feedback.page',
  'route.hcm.team.performance.page',
] as const;

function registryRoutes(): readonly RegistryRoute[] {
  const latestBundle = authorizationSource.bundles
    .filter((bundle) => bundle.bundleKey === 'product-surfaces')
    .sort((left, right) => right.version - left.version)[0];
  if (!latestBundle) throw new Error('Missing Product Surface authorization bundle.');
  return latestBundle.routes;
}

function publicRouteBindings(
  routes: readonly RouteObject[],
  parent = ''
): Array<{
  path: string;
  routeContractKey: string;
}> {
  return routes.flatMap((route) => {
    const path =
      route.index || !route.path ? parent : `${parent}/${route.path}`.replace(/\/{2,}/gu, '/');
    const routeContractKey = (route.handle as { routeContractKey?: string } | undefined)
      ?.routeContractKey;
    return [
      ...(routeContractKey ? [{ path, routeContractKey }] : []),
      ...publicRouteBindings(route.children ?? [], path),
    ];
  });
}

function normalizedAccess(
  access: (typeof HCM_PRODUCT_MANIFEST.surfaces)[number]['navigation'][number]['items'][number]['access']
): RegistryRequiredAccess {
  if (access.type === 'capability') {
    return { type: 'CAPABILITY', capabilityContractKey: access.capabilityContractKey };
  }
  if (access.type === 'capability-expression') {
    return {
      type: 'CAPABILITY_EXPRESSION',
      mode: access.mode,
      capabilityContractKeys: access.capabilityContractKeys,
    };
  }
  return { type: 'POLICY', accessPolicyKey: access.accessPolicyKey };
}

function sameAccess(left: RegistryRequiredAccess, right: RegistryRequiredAccess): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'CAPABILITY') {
    return left.capabilityContractKey === right.capabilityContractKey;
  }
  if (left.type === 'POLICY') return left.accessPolicyKey === right.accessPolicyKey;
  return (
    left.mode === right.mode &&
    JSON.stringify(left.capabilityContractKeys) === JSON.stringify(right.capabilityContractKeys)
  );
}

describe('HCM W1b product manifest', () => {
  it('keeps the A004 APP.HCM cutover deferred for zero-APP administrators', () => {
    expect(HCM_APP_ENTITLEMENT_CUTOVER).toMatchObject({
      blockerId: 'A004',
      state: 'DEFERRED_ZERO_APP_ADMIN_COMPATIBILITY',
      canonicalResourceKey: 'APP.HCM',
      compatibilityAlias: 'APP.HRIS',
      requiresProductEntitlement: false,
    });
    expect(
      HCM_PRODUCT_MANIFEST.surfaces
        .filter((surface) => surface.id !== 'hcm.utility')
        .every((surface) => surface.entryAccess.requiresProductEntitlement === false)
    ).toBe(true);
    expect(
      HCM_PRODUCT_MANIFEST.surfaces.find((surface) => surface.id === 'hcm.utility')?.entryAccess
    ).toEqual({
      type: 'capability',
      requiresProductEntitlement: true,
      entryCapabilityMode: 'ALL',
      requiredCapabilityContractKeys: ['hcm.app.shell.view'],
    });
  });

  it('keeps the utility out of the personal, team, operations, and management menus', () => {
    expect(
      HCM_PRODUCT_MANIFEST.surfaces.find((surface) => surface.id === 'hcm.operations')
    ).toMatchObject({ indexPath: '/hr/operations/home' });
    expect(
      Object.fromEntries(
        HCM_PRODUCT_MANIFEST.surfaces.map((surface) => [
          surface.id,
          surface.navigation.flatMap((group) => group.items).length,
        ])
      )
    ).toEqual({
      'hcm.personal': 11,
      'hcm.team': 5,
      'hcm.utility': 0,
      'hcm.operations': 20,
      'hcm.management': 11,
    });
    expect(HCM_PRODUCT_MANIFEST.surfaces.map((surface) => surface.supportedScopeKinds)).toEqual([
      ['SELF'],
      ['TEAM', 'ORG_UNIT', 'TARGET_POPULATION'],
      ['SELF'],
      ['ORG_UNIT', 'LEGAL_ENTITY', 'TARGET_POPULATION', 'SUPPORT_SESSION'],
      ['TENANT', 'RESOURCE_SET', 'RESOURCE', 'LEGAL_ENTITY', 'POLICY_NODE'],
    ]);
  });

  it('binds the 47 default-OFF menu items within the 65 official HCM PAGE records', () => {
    const routerRecords = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === 'hcm'
    );
    const registryRecords = registryRoutes().filter((route) => route.subject?.productKey === 'hcm');
    expect(routerRecords).toHaveLength(65);

    for (const surface of HCM_PRODUCT_MANIFEST.surfaces) {
      for (const item of surface.navigation.flatMap((group) => group.items)) {
        const page = routerRecords.find((route) => route.pattern === item.path);
        expect(page?.surfaceId, item.path).toBe(surface.id);
        const registry = registryRecords.find(
          (route) => route.routeContractKey === page?.routeContractKey
        );
        expect(registry?.subject.surfaceKey, item.path).toBe(surface.id);
        expect(
          registry?.accessProfiles.some((profile) =>
            sameAccess(profile.requiredAccess, normalizedAccess(item.access))
          ),
          item.path
        ).toBe(true);
      }
    }
  });

  it('closes exact PAGE, DATA, and ACTION records without exposing non-pages as browser routes', () => {
    const records = registryRoutes().filter((route) => route.subject.productKey === 'hcm');
    const bySurfaceAndKind = Object.fromEntries(
      HCM_PRODUCT_MANIFEST.surfaces.map((surface) => [
        surface.id,
        Object.fromEntries(
          (['PAGE', 'DATA', 'ACTION'] as const).map((kind) => [
            kind,
            records.filter(
              (route) => route.subject.surfaceKey === surface.id && route.routeKind === kind
            ).length,
          ])
        ),
      ])
    );
    expect(bySurfaceAndKind).toEqual({
      'hcm.personal': { PAGE: 13, DATA: 8, ACTION: 9 },
      'hcm.team': { PAGE: 7, DATA: 3, ACTION: 2 },
      'hcm.utility': { PAGE: 1, DATA: 5, ACTION: 2 },
      'hcm.operations': { PAGE: 33, DATA: 44, ACTION: 59 },
      'hcm.management': { PAGE: 15, DATA: 20, ACTION: 77 },
    });
    expect(
      records
        .filter((route) => route.subject.surfaceKey === 'hcm.utility')
        .map((route) => route.routeContractKey)
        .sort()
    ).toEqual([...HCM_UTILITY_ROUTE_KEYS].sort());

    const browserRoutes = publicRouteBindings(hcmRoutes).sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );
    const officialPages = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) =>
        route.productId === 'hcm' &&
        isSegmentOwnedPath(route.pattern, HCM_PRODUCT_MANIFEST.basePath)
    )
      .map((route) => ({ path: route.pattern, routeContractKey: route.routeContractKey }))
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    expect(browserRoutes).toEqual(officialPages);
    const officialPageKeys = new Set(officialPages.map((route) => route.routeContractKey));
    expect(
      records
        .filter(
          (route) => route.routeKind === 'PAGE' && !officialPageKeys.has(route.routeContractKey)
        )
        .map((route) => route.routeContractKey)
        .sort()
    ).toEqual([...HCM_PAGE_KEYS_OUTSIDE_HCM_ROUTER].sort());
    expect(records.filter((route) => route.routeKind === 'PAGE')).toHaveLength(
      officialPages.length + HCM_PAGE_KEYS_OUTSIDE_HCM_ROUTER.length
    );

    for (const route of records) {
      expect(route.navigationContextId, route.routeContractKey).not.toBe('');
      if (HCM_AUTHORIZATION_ONLY_PAGE_KEYS.has(route.routeContractKey)) {
        expect(route, route.routeContractKey).toMatchObject({
          routeKind: 'PAGE',
          bindingMode: 'AUTHORIZATION_ONLY',
          gatewayApiBindings: [],
          servicePepBindings: [],
        });
      } else {
        expect(route.gatewayApiBindings.length, route.routeContractKey).toBeGreaterThan(0);
      }
      expect(route.servicePepBindings.length, route.routeContractKey).toBe(
        route.gatewayApiBindings.length
      );
      expect(
        route.servicePepBindings.map((binding) => [binding.bindingKey, binding.method]),
        route.routeContractKey
      ).toEqual(route.gatewayApiBindings.map((binding) => [binding.bindingKey, binding.method]));
      if (route.routeKind === 'PAGE') {
        expect(route.uiRouteId, route.routeContractKey).not.toBeNull();
        expect(route.uiRoutePattern, route.routeContractKey).not.toBeNull();
      } else {
        expect(route.uiRouteId, route.routeContractKey).toBeNull();
        expect(route.uiRoutePattern, route.routeContractKey).toBeNull();
        expect(browserRoutes.some((page) => page.routeContractKey === route.routeContractKey)).toBe(
          false
        );
      }
    }
    expect(
      records
        .filter((route) => route.subject.surfaceKey === 'hcm.utility')
        .every((route) => route.navigationContextId === 'hcm.utility')
    ).toBe(true);
  });

  it('allows Provider Support profiles only on the operations read surface', () => {
    const supportRoutes = registryRoutes()
      .filter(
        (route) =>
          route.subject?.productKey === 'hcm' &&
          route.accessProfiles.some((profile) => profile.profileKey === 'provider-support')
      )
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    expect(supportRoutes.map((route) => route.routeContractKey)).toEqual([
      'route.hcm.operations.assignments.page',
      'route.hcm.operations.home.page',
      'route.hcm.operations.overview.page',
      'route.hcm.operations.people.page',
    ]);
    expect(supportRoutes.every((route) => route.routeKind === 'PAGE')).toBe(true);
    expect(
      supportRoutes.flatMap((route) =>
        route.accessProfiles
          .filter((profile) => profile.profileKey === 'provider-support')
          .map((profile) => profile.requiredAccess)
      )
    ).toEqual([
      { type: 'POLICY', accessPolicyKey: 'hcm.operations-workforce-read.v1' },
      { type: 'POLICY', accessPolicyKey: 'hcm.operations-overview-read.v1' },
      { type: 'POLICY', accessPolicyKey: 'hcm.operations-overview-read.v1' },
      { type: 'POLICY', accessPolicyKey: 'hcm.operations-workforce-read.v1' },
    ]);
  });
});
