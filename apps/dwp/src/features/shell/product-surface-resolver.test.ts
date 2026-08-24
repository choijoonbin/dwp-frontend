import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';

import { resolveLegacyProductRedirect, resolveProductSurface } from './product-surface-resolver';

import type { RegisteredProductRoute } from '../../routes/product-route-contract-source';

const manifest = defineProductManifest({
  id: 'example',
  appKey: 'APP.EXAMPLE',
  basePath: '/example',
  surfaces: [
    {
      id: 'example.work',
      plane: 'work',
      labelKey: 'example.work',
      taskKinds: ['work'],
      routeMatchers: [
        { kind: 'exact', path: '/example/home' },
        { kind: 'prefix', path: '/example/requests' },
      ],
      indexPath: '/example/home',
      navigation: [
        {
          id: 'work',
          items: [
            {
              path: '/example/home',
              view: 'home',
              icon: House,
              taskKind: 'work',
              access: { type: 'policy', accessPolicyKey: 'example.work.v1' },
            },
          ],
        },
      ],
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'example.work.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'example.admin',
      plane: 'management',
      labelKey: 'example.admin',
      taskKinds: ['administration'],
      routeMatchers: [{ kind: 'prefix', path: '/example/admin' }],
      indexPath: '/example/admin',
      navigation: [
        {
          id: 'admin',
          items: [
            {
              path: '/example/admin',
              view: 'admin',
              icon: ShieldCheck,
              taskKind: 'administration',
              access: { type: 'capability', capabilityContractKey: 'example.admin.read' },
            },
          ],
        },
      ],
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['example.admin.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
    },
  ],
  legacyRedirects: [
    {
      id: 'old-example',
      sourceMatcher: { kind: 'prefix', path: '/old-example' },
      target: {
        kind: 'registered-suffix',
        sourceBase: '/old-example',
        targetBase: '/example/requests',
        registeredRouteCatalogId: 'example-v1',
      },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});

const catalog: readonly RegisteredProductRoute[] = [
  {
    routeKind: 'PAGE',
    routeId: 'example.home',
    pattern: '/example/home',
    productId: 'example',
    surfaceId: 'example.work',
    routeContractKey: 'route.example.work.home.page',
  },
  {
    routeKind: 'PAGE',
    routeId: 'example.request-detail',
    pattern: '/example/requests/:requestId',
    productId: 'example',
    surfaceId: 'example.work',
    routeContractKey: 'route.example.work.request-detail.page',
  },
  {
    routeKind: 'PAGE',
    routeId: 'example.admin',
    pattern: '/example/admin',
    productId: 'example',
    surfaceId: 'example.admin',
    routeContractKey: 'route.example.admin.home.page',
  },
  {
    routeKind: 'DATA',
    productId: 'example',
    surfaceId: 'example.admin',
    routeContractKey: 'route.example.admin.policy-detail.data',
  },
];

describe('resolveProductSurface', () => {
  it('keeps the exact product root neutral and resolves registered page routes', () => {
    expect(resolveProductSurface('/example/', [manifest], catalog)).toEqual({
      type: 'product-entry',
      productId: 'example',
    });
    expect(
      resolveProductSurface('/example/requests/request-42?tab=audit', [manifest], catalog)
    ).toEqual({
      type: 'known-route',
      productId: 'example',
      surfaceId: 'example.work',
      routeId: 'example.request-detail',
    });
  });

  it('selects surface ownership before matching a dynamic page and ignores DATA records', () => {
    expect(resolveProductSurface('/example/admin/policy-42', [manifest], catalog)).toEqual({
      type: 'unknown-surface-path',
      productId: 'example',
      surfaceId: 'example.admin',
    });
    expect(resolveProductSurface('/example/requests', [manifest], catalog)).toEqual({
      type: 'unknown-surface-path',
      productId: 'example',
      surfaceId: 'example.work',
    });
  });

  it('distinguishes unknown product paths and segment lookalikes', () => {
    expect(resolveProductSurface('/example/other', [manifest], catalog)).toEqual({
      type: 'unknown-product-path',
      productId: 'example',
    });
    expect(resolveProductSurface('/examples/home', [manifest], catalog)).toEqual({
      type: 'outside-product',
    });
    expect(resolveProductSurface('/example/administer', [manifest], catalog)).toEqual({
      type: 'unknown-product-path',
      productId: 'example',
    });
  });
});

describe('resolveLegacyProductRedirect', () => {
  it('preserves query and hash for a registered one-hop suffix target', () => {
    expect(
      resolveLegacyProductRedirect(
        { pathname: '/old-example/request-42', search: '?mode=compact', hash: '#history' },
        manifest.legacyRedirects ?? [],
        catalog
      )
    ).toEqual({
      type: 'redirect',
      redirectId: 'old-example',
      to: '/example/requests/request-42?mode=compact#history',
      replace: true,
    });
  });

  it('ends at the declared local not-found state when the target is not registered', () => {
    expect(
      resolveLegacyProductRedirect(
        { pathname: '/old-example/missing/nested' },
        manifest.legacyRedirects ?? [],
        catalog
      )
    ).toEqual({
      type: 'surface-not-found',
      redirectId: 'old-example',
      attemptedTarget: '/example/requests/missing/nested',
    });
  });
});
