import { describe, expect, it } from 'vitest';

import authorizationSource from '../../../../../architecture/product-surface-authorization.v1.json';
import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from '../../routes/product-page-route-contracts';
import { HCM_PRODUCT_MANIFEST } from './hcm-product-manifest';

type RegistryRequiredAccess = {
  type: 'CAPABILITY' | 'CAPABILITY_EXPRESSION' | 'POLICY';
  capabilityContractKey?: string;
  capabilityContractKeys?: readonly string[];
  mode?: 'ANY' | 'ALL';
  accessPolicyKey?: string;
};

type RegistryRoute = {
  routeContractKey: string;
  subject: { productKey: string; surfaceKey: string };
  accessProfiles: readonly {
    profileKey: string;
    requiredAccess: RegistryRequiredAccess;
  }[];
};

function registryRoutes(): readonly RegistryRoute[] {
  const source = authorizationSource as unknown as {
    bundles: readonly {
      bundleKey: string;
      version: number;
      routes: readonly RegistryRoute[];
    }[];
  };
  return source.bundles.find(
    (bundle) => bundle.bundleKey === 'product-surfaces' && bundle.version === 3
  )!.routes;
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
      ['TEAM', 'ORG_UNIT'],
      ['ORG_UNIT', 'LEGAL_ENTITY'],
      ['RESOURCE_SET', 'RESOURCE', 'LEGAL_ENTITY', 'POLICY_NODE'],
    ]);
  });

  it('binds all 25 menu items to official PAGE records and exact v3 access profiles', () => {
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

  it('allows Provider Support profiles only on the operations read surface', () => {
    const supportRoutes = registryRoutes()
      .filter(
        (route) =>
          route.subject?.productKey === 'hcm' &&
          route.accessProfiles.some((profile) => profile.profileKey === 'provider-support')
      )
      .map((route) => route.routeContractKey);
    expect(supportRoutes.length).toBeGreaterThan(0);
    expect(supportRoutes.every((route) => route.startsWith('route.hcm.operations.'))).toBe(true);
  });
});
