import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';

import { resolveProductSurfaceReturnTarget } from './product-surface-layout-model';

import type { EffectiveProductSurfaceContext } from './product-surface-context';
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
      returnSurfaceId: 'example.work',
    },
  ],
});

const catalog: readonly RegisteredProductRoute[] = [
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
    routeId: 'example.work.detail',
    pattern: '/example/work/:itemId',
    productId: 'example',
    surfaceId: 'example.work',
    routeContractKey: 'route.example.work.detail.page',
  },
];

const approvalManifest = defineProductManifest({
  id: 'approvals',
  appKey: 'APP.APPROVALS',
  basePath: '/approvals',
  surfaces: [
    {
      id: 'approvals.work',
      plane: 'work',
      labelKey: 'approvals.work',
      taskKinds: ['work'],
      routeMatchers: [
        { kind: 'exact', path: '/approvals/home' },
        { kind: 'exact', path: '/approvals/inbox' },
      ],
      indexPath: '/approvals/home',
      navigation: [],
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'approvals.work.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'approvals.admin',
      plane: 'management',
      labelKey: 'approvals.admin',
      taskKinds: ['administration'],
      routeMatchers: [{ kind: 'prefix', path: '/approvals/admin' }],
      indexPath: '/approvals/admin',
      navigation: [],
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['approvals.admin.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'approvals.work',
    },
  ],
});

const approvalCatalog: readonly RegisteredProductRoute[] = [
  {
    routeKind: 'PAGE',
    routeId: 'approvals.work.home',
    pattern: '/approvals/home',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeContractKey: 'route.approvals.work.home.page',
  },
  {
    routeKind: 'PAGE',
    routeId: 'approvals.work.inbox',
    pattern: '/approvals/inbox',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeContractKey: 'route.approvals.work.inbox.page',
  },
];

const workContext: EffectiveProductSurfaceContext = {
  contextKey: 'work-context',
  productKey: 'example',
  surfaceKey: 'example.work',
  plane: 'work',
  accessMode: 'NORMAL',
  accessSource: 'ENTITLEMENT',
  appResourceKey: 'APP.EXAMPLE',
  effectiveGrants: [],
  scopes: [
    {
      key: 'self-scope',
      kind: 'SELF',
      displayName: 'Me',
      isDefault: true,
      readOnly: false,
    },
  ],
  revalidateAt: '2030-01-01T00:00:00Z',
};

describe('product surface return target', () => {
  it('returns to a registered last work route with the current canonical scope', () => {
    expect(
      resolveProductSurfaceReturnTarget(
        manifest,
        'example.admin',
        [workContext],
        catalog,
        { 'example.work': 'example.work.home' },
        new Set(['example.work.home']),
        Date.parse('2029-01-01')
      )
    ).toEqual({
      path: '/example/work?scope=self-scope',
      kind: 'work',
    });
  });

  it('rejects dynamic or unknown route ids and uses the work index', () => {
    expect(
      resolveProductSurfaceReturnTarget(
        manifest,
        'example.admin',
        [workContext],
        catalog,
        { 'example.work': 'example.work.detail' },
        new Set(['example.work.detail']),
        Date.parse('2029-01-01')
      )
    ).toEqual({ path: '/example/work?scope=self-scope', kind: 'work' });
    expect(
      resolveProductSurfaceReturnTarget(
        manifest,
        'example.admin',
        [workContext],
        catalog,
        { 'example.work': 'example.work.unknown' },
        new Set(['example.work.unknown']),
        Date.parse('2029-01-01')
      )
    ).toEqual({ path: '/example/work?scope=self-scope', kind: 'work' });
  });

  it('returns to the catalog for management-only users', () => {
    expect(resolveProductSurfaceReturnTarget(manifest, 'example.admin', [], catalog)).toEqual({
      path: '/apps',
      kind: 'catalog',
    });
  });

  it('uses the Approvals inbox then home fallback according to exact route allowance', () => {
    const approvalsWorkContext: EffectiveProductSurfaceContext = {
      ...workContext,
      contextKey: 'approvals-work-context',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      appResourceKey: 'APP.APPROVALS',
    };
    expect(
      resolveProductSurfaceReturnTarget(
        approvalManifest,
        'approvals.admin',
        [approvalsWorkContext],
        approvalCatalog,
        {},
        new Set(['approvals.work.inbox', 'approvals.work.home']),
        Date.parse('2029-01-01')
      )
    ).toEqual({ path: '/approvals/inbox?scope=self-scope', kind: 'work' });
    expect(
      resolveProductSurfaceReturnTarget(
        approvalManifest,
        'approvals.admin',
        [approvalsWorkContext],
        approvalCatalog,
        {},
        new Set(['approvals.work.home']),
        Date.parse('2029-01-01')
      )
    ).toEqual({ path: '/approvals/home?scope=self-scope', kind: 'work' });
  });
});
