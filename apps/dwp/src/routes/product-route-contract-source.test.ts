import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../components/product-manifest';

import {
  defineProductRouteContractSource,
  defineProductLegacyRouteSource,
  generateProductLegacyRedirectRegistry,
  generateProductRouteKeyProjection,
  generateRegisteredProductRouteCatalog,
  resolveProductLegacyRoute,
} from './product-route-contract-source';

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
      routeMatchers: [{ kind: 'prefix', path: '/example/work' }],
      indexPath: '/example/work',
      navigation: [
        {
          id: 'work',
          items: [
            {
              path: '/example/work',
              view: 'work',
              icon: House,
              taskKind: 'work',
              access: { type: 'policy', accessPolicyKey: 'example.work-access.v1' },
            },
          ],
        },
      ],
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'example.work-access.v1',
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
      id: 'legacy-work',
      sourceMatcher: { kind: 'prefix', path: '/old-example' },
      target: { kind: 'static', path: '/example/work' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'product-not-found',
    },
  ],
});

const source = [
  {
    routeId: 'example.work.home',
    pattern: '/example/work' as const,
    productId: 'example',
    surfaceId: 'example.work',
    routeContractKey: 'route.example.work.home.page',
    legacyRedirectIds: ['legacy-work'],
  },
  {
    routeId: 'example.admin.detail',
    pattern: '/example/admin/:policyId' as const,
    productId: 'example',
    surfaceId: 'example.admin',
    routeContractKey: 'route.example.admin.policy-detail.page',
  },
] as const;

describe('product route contract source', () => {
  it('generates the UI-owned catalog, route projection, and legacy projection only', () => {
    const validated = defineProductRouteContractSource(source, [manifest]);

    expect(generateRegisteredProductRouteCatalog(validated)).toEqual([
      {
        routeKind: 'PAGE',
        routeId: 'example.work.home',
        pattern: '/example/work',
        productId: 'example',
        surfaceId: 'example.work',
        routeContractKey: 'route.example.work.home.page',
      },
      {
        routeKind: 'PAGE',
        routeId: 'example.admin.detail',
        pattern: '/example/admin/:policyId',
        productId: 'example',
        surfaceId: 'example.admin',
        routeContractKey: 'route.example.admin.policy-detail.page',
      },
    ]);
    expect(generateProductRouteKeyProjection(validated)).toHaveLength(2);
    expect(generateProductLegacyRedirectRegistry(validated)).toEqual([
      { redirectId: 'legacy-work', productId: 'example', routeId: 'example.work.home' },
    ]);
  });

  it('rejects cross-surface patterns, unknown redirects, and duplicate route contracts', () => {
    expect(() =>
      defineProductRouteContractSource(
        [{ ...source[0], pattern: '/example/admin', surfaceId: 'example.work' }],
        [manifest]
      )
    ).toThrow(/outside its surface/u);
    expect(() =>
      defineProductRouteContractSource(
        [{ ...source[0], legacyRedirectIds: ['unknown'] }],
        [manifest]
      )
    ).toThrow(/unknown legacy redirect/u);
    expect(() => defineProductRouteContractSource([source[0], source[0]], [manifest])).toThrow(
      /duplicated/u
    );
  });

  it('fails closed for unknown, stale, cyclic, or multi-hop legacy routes', () => {
    const valid = {
      redirectId: 'legacy-example-v1',
      sourcePath: '/old-example' as const,
      targetRouteContractKey: source[0].routeContractKey,
      preserveQuery: true as const,
      preserveHash: true as const,
      maxHops: 1 as const,
    };
    expect(defineProductLegacyRouteSource([valid], source)).toEqual([valid]);
    expect(
      resolveProductLegacyRoute('/old-example', '?scope=alpha', '#item', [valid], source)
    ).toEqual({
      redirectId: 'legacy-example-v1',
      target: '/example/work?scope=alpha#item',
      maxHops: 1,
    });
    expect(() =>
      defineProductLegacyRouteSource(
        [{ ...valid, targetRouteContractKey: 'route.example.work.stale.page' }],
        source
      )
    ).toThrow(/unknown target/u);
    expect(() =>
      defineProductLegacyRouteSource([{ ...valid, sourcePath: '/example/work' }], source)
    ).toThrow(/cycle/u);
    expect(() =>
      defineProductLegacyRouteSource([{ ...valid, maxHops: 2 as never }], source)
    ).toThrow(/one hop/u);
  });
});
