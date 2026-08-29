import { describe, expect, it } from 'vitest';

import authorizationSource from '../../../../../architecture/product-surface-authorization.v1.json';
import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../../routes/product-page-route-contracts';
import { hcmRoutes } from '../../routes/hcm-routes';
import { HCM_PRODUCT_MANIFEST } from './hcm-product-manifest';

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

const HCM_DATA_ROUTE_KEYS = [
  'route.hcm.management.controlled-export-preview.data',
  'route.hcm.management.integration-code-sets.data',
  'route.hcm.management.org-code-sets.data',
  'route.hcm.operations.person-detail.data',
  'route.hcm.personal.directory-person-detail.data',
  'route.hcm.personal.home-preference.data',
] as const;

const HCM_ACTION_ROUTE_KEYS = [
  'route.hcm.management.controlled-export-cancel.action',
  'route.hcm.management.controlled-export-create.action',
  'route.hcm.management.controlled-export-retry.action',
  'route.hcm.management.integration-create.action',
  'route.hcm.management.integration-execute.action',
  'route.hcm.management.integration-update.action',
  'route.hcm.management.org-approval.action',
  'route.hcm.management.org-clone.action',
  'route.hcm.management.org-create.action',
  'route.hcm.management.org-publish.action',
  'route.hcm.management.org-update.action',
  'route.hcm.management.reference-update.action',
  'route.hcm.operations.absence-approve.action',
  'route.hcm.operations.time-approve.action',
  'route.hcm.personal.absence-create.action',
  'route.hcm.personal.absence-withdraw.action',
  'route.hcm.personal.home-preference-update.action',
  'route.hcm.personal.talent-goal-update.action',
  'route.hcm.personal.time-entry-update.action',
  'route.hcm.personal.time-submit.action',
  'route.hcm.team.absence-decision.action',
  'route.hcm.team.time-decision.action',
] as const;

function registryRoutes(): readonly RegistryRoute[] {
  const source = authorizationSource as unknown as {
    bundles: readonly RegistryBundle[];
  };
  const latestBundle = source.bundles
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
  it('freezes the personal, team, operations, and management menu partition', () => {
    expect(
      Object.fromEntries(
        HCM_PRODUCT_MANIFEST.surfaces.map((surface) => [
          surface.id,
          surface.navigation.flatMap((group) => group.items).length,
        ])
      )
    ).toEqual({
      'hcm.personal': 10,
      'hcm.team': 3,
      'hcm.operations': 8,
      'hcm.management': 4,
    });
    expect(HCM_PRODUCT_MANIFEST.surfaces.map((surface) => surface.supportedScopeKinds)).toEqual([
      ['SELF'],
      ['TEAM', 'ORG_UNIT', 'TARGET_POPULATION'],
      ['ORG_UNIT', 'LEGAL_ENTITY', 'TARGET_POPULATION', 'SUPPORT_SESSION'],
      ['RESOURCE_SET', 'RESOURCE', 'LEGAL_ENTITY', 'POLICY_NODE'],
    ]);
  });

  it('binds all 25 menu items to official PAGE records and exact latest access profiles', () => {
    const routerRecords = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === 'hcm'
    );
    const registryRecords = registryRoutes().filter((route) => route.subject?.productKey === 'hcm');
    expect(routerRecords).toHaveLength(25);

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
      'hcm.personal': { PAGE: 10, DATA: 2, ACTION: 6 },
      'hcm.team': { PAGE: 3, DATA: 0, ACTION: 2 },
      'hcm.operations': { PAGE: 8, DATA: 1, ACTION: 2 },
      'hcm.management': { PAGE: 4, DATA: 3, ACTION: 12 },
    });
    expect(
      records
        .filter((route) => route.routeKind === 'DATA')
        .map((route) => route.routeContractKey)
        .sort()
    ).toEqual([...HCM_DATA_ROUTE_KEYS].sort());
    expect(
      records
        .filter((route) => route.routeKind === 'ACTION')
        .map((route) => route.routeContractKey)
        .sort()
    ).toEqual([...HCM_ACTION_ROUTE_KEYS].sort());

    const browserRoutes = publicRouteBindings(hcmRoutes).sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );
    const officialPages = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === 'hcm'
    )
      .map((route) => ({ path: route.pattern, routeContractKey: route.routeContractKey }))
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    expect(browserRoutes).toEqual(officialPages);
    expect(
      records
        .filter((route) => route.routeKind === 'PAGE')
        .map((route) => route.routeContractKey)
        .sort()
    ).toEqual(officialPages.map((route) => route.routeContractKey));

    for (const route of records) {
      expect(route.navigationContextId, route.routeContractKey).toBe(route.subject.surfaceKey);
      expect(route.gatewayApiBindings.length, route.routeContractKey).toBeGreaterThan(0);
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
      { type: 'POLICY', accessPolicyKey: 'hcm.operations-workforce-read.v1' },
    ]);
  });
});
