import { describe, expect, it } from 'vitest';

import applicationArchitecture from '../../../../architecture/frontend-apps.json';
import routerSource from '../../../../architecture/product-page-routes.v1.json';

import { createProductApplicationRuntime } from './create-product-application-runtime';
import {
  buildProductApplicationDescriptor,
  type GovernedProductBoundarySource,
  type ProductApplicationDescriptor,
  type ProductGlobalRuntimeHost,
} from './product-application-descriptor';
import { governedProductManifest } from './product-manifest-registry';
import { GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES } from './product-sensitive-query-prefixes';
import type {
  ProductLegacyRouteSource,
  ProductPageRouteContractSource,
} from '../routes/product-route-contract-source';

type GovernedApplicationBoundary = GovernedProductBoundarySource &
  Readonly<{ applicationId?: string; platformFeature?: string }>;

const governedProducts =
  applicationArchitecture.governedProductSurfaces as readonly GovernedApplicationBoundary[];
const routes = routerSource as {
  pageRoutes: readonly ProductPageRouteContractSource[];
  legacyRedirects: readonly ProductLegacyRouteSource[];
};

function mountedProductIds(applicationId: string): string[] {
  return governedProducts
    .filter(
      (product) =>
        product.applicationId === applicationId ||
        (applicationId === 'workspace' && product.platformFeature === 'notifications')
    )
    .map((product) => product.productId);
}

function descriptorFor(
  applicationId: string,
  options: Readonly<{
    globalGovernance?: boolean;
    administration?: boolean;
    globalRuntimeHosts?: readonly ProductGlobalRuntimeHost[];
    includeGovernedContextAuthorization?: boolean;
  }> = {}
): ProductApplicationDescriptor {
  return buildProductApplicationDescriptor({
    applicationId,
    governedProducts,
    mountedProductIds: mountedProductIds(applicationId),
    officialPageRoutes: routes.pageRoutes,
    legacyRoutes: routes.legacyRedirects,
    sensitiveQueryPrefixRegistry: GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES,
    i18nNamespaces: ['common', applicationId],
    ...options,
  });
}

function requiredManifest(productId: string) {
  const manifest = governedProductManifest(productId);
  if (!manifest) throw new Error(`Missing governed product manifest: ${productId}`);
  return manifest;
}

describe('product application descriptor and runtime scope', () => {
  it('maps the rooms application to the workplace product without sibling registry data', () => {
    const descriptor = descriptorFor('rooms');
    const runtime = createProductApplicationRuntime(descriptor, [requiredManifest('workplace')]);

    expect(descriptor.productIds).toEqual(['workplace']);
    expect(descriptor.productBoundaries).toEqual([{ id: 'workplace', basePath: '/workplace' }]);
    expect(descriptor.manifestProductIds).toEqual(['workplace']);
    expect(descriptor.authorizationProductIds).toEqual(['workplace']);
    expect(descriptor.routeProjectionMode).toBe('mounted-products');
    expect(descriptor.sensitiveQueryPrefixes).toEqual(
      GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES.workplace
    );
    expect(runtime.productManifests.map((manifest) => manifest.id)).toEqual(['workplace']);
    expect(new Set(runtime.pageRoutes.map((route) => route.productId))).toEqual(
      new Set(['workplace'])
    );
    expect(runtime.registeredRoutes.map((route) => route.routeContractKey).sort()).toEqual(
      runtime.pageRoutes.map((route) => route.routeContractKey).sort()
    );
  });

  it('mounts notifications in workspace while keeping its global shell capabilities explicit', () => {
    const descriptor = descriptorFor('workspace', {
      globalGovernance: true,
      globalRuntimeHosts: ['notifications', 'dwaion'],
      includeGovernedContextAuthorization: true,
    });
    const runtime = createProductApplicationRuntime(descriptor, [
      requiredManifest('notifications'),
    ]);

    expect(new Set(descriptor.productIds)).toEqual(
      new Set(governedProducts.map((product) => product.productId))
    );
    expect(descriptor.productBoundaries).toContainEqual({
      id: 'notifications',
      basePath: '/notifications',
    });
    expect(descriptor.pageRoutes.every((route) => route.productId === 'notifications')).toBe(true);
    expect(descriptor.manifestProductIds).toEqual(['notifications']);
    expect(descriptor.authorizationProductIds).toEqual(['notifications']);
    expect(descriptor.includeGovernedContextAuthorization).toBe(true);
    expect(runtime.productManifests.map((manifest) => manifest.id)).toEqual(['notifications']);
    expect(new Set(runtime.pageRoutes.map((route) => route.productId))).toEqual(
      new Set(['notifications'])
    );
    expect(runtime.globalRuntimeHosts).toEqual(['notifications', 'dwaion']);
    expect(runtime.i18nNamespaces).toEqual(['common', 'workspace']);
  });

  it('projects every legacy target only for the administration control plane', () => {
    const descriptor = descriptorFor('administration', {
      globalGovernance: true,
      administration: true,
    });
    const runtime = createProductApplicationRuntime(descriptor);
    const legacyTargetKeys = new Set(
      routes.legacyRedirects.map((redirect) => redirect.targetRouteContractKey)
    );

    expect(new Set(descriptor.productIds)).toEqual(
      new Set(governedProducts.map((product) => product.productId))
    );
    expect(new Set(descriptor.legacyRoutes.map((route) => route.redirectId))).toEqual(
      new Set(routes.legacyRedirects.map((route) => route.redirectId))
    );
    expect(new Set(descriptor.pageRoutes.map((route) => route.routeContractKey))).toEqual(
      legacyTargetKeys
    );
    expect(new Set(runtime.legacyRoutes.map((route) => route.targetRouteContractKey))).toEqual(
      legacyTargetKeys
    );
    expect(runtime.pageRoutes).toHaveLength(legacyTargetKeys.size);
    expect(runtime.legacyRoutes).toHaveLength(routes.legacyRedirects.length);
    for (const redirect of routes.legacyRedirects) {
      expect(
        runtime.legacyRoutes.filter((candidate) => candidate.sourcePath === redirect.sourcePath)
      ).toHaveLength(1);
    }
    expect(descriptor.manifestProductIds).toEqual([]);
    expect(descriptor.authorizationProductIds).toEqual([]);
    expect(descriptor.routeProjectionMode).toBe('administration-legacy-targets');
  });

  it('rejects missing, duplicate, and foreign manifests before route projection', () => {
    const descriptor = descriptorFor('rooms');
    const workplace = requiredManifest('workplace');

    expect(() => createProductApplicationRuntime(descriptor)).toThrow(/closure mismatch/u);
    expect(() => createProductApplicationRuntime(descriptor, [workplace, workplace])).toThrow(
      /closure mismatch/u
    );
    expect(() =>
      createProductApplicationRuntime(descriptor, [requiredManifest('calendar')])
    ).toThrow(/closure mismatch/u);
  });

  it('keeps the Administration manifest exception empty and fail closed', () => {
    const descriptor = descriptorFor('administration', {
      globalGovernance: true,
      administration: true,
    });

    expect(() =>
      createProductApplicationRuntime(descriptor, [requiredManifest('approvals')])
    ).toThrow(/closure mismatch/u);
  });

  it.each(['provider', 'account', 'platform-shell'])(
    'keeps the %s control scope free of governed product runtime data',
    (applicationId) => {
      const descriptor = descriptorFor(applicationId);
      const runtime = createProductApplicationRuntime(descriptor);

      expect(descriptor.productIds).toEqual([]);
      expect(descriptor.productBoundaries).toEqual([]);
      expect(descriptor.pageRoutes).toEqual([]);
      expect(descriptor.legacyRoutes).toEqual([]);
      expect(descriptor.sensitiveQueryPrefixes).toEqual([]);
      expect(descriptor.globalRuntimeHosts).toEqual([]);
      expect(runtime.productManifests).toEqual([]);
      expect(runtime.registeredRoutes).toEqual([]);
    }
  );
});
