import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';

import {
  buildManageableProductList,
  buildProductAppCardEntryPoints,
  buildProductSurfaceEntryPoints,
} from './product-entry-point-model';

import type { EffectiveProductSurfaceContext } from './product-surface-context';

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
    },
  ],
});

function context(surfaceKey: string, plane: 'work' | 'management'): EffectiveProductSurfaceContext {
  return {
    contextKey: `${surfaceKey}-context`,
    productKey: 'example',
    surfaceKey,
    plane,
    accessMode: 'NORMAL',
    accessSource: plane === 'work' ? 'ENTITLEMENT' : 'MANAGEMENT',
    appResourceKey: 'APP.EXAMPLE',
    effectiveGrants: [],
    scopes: [
      {
        key: `${surfaceKey}-scope`,
        kind: plane === 'work' ? 'SELF' : 'RESOURCE_SET',
        displayName: surfaceKey,
        isDefault: true,
        readOnly: plane === 'management',
      },
    ],
    revalidateAt: '2030-01-01T00:00:00Z',
  };
}

describe('product entry points', () => {
  it('keeps work as the primary app launch and management as a named secondary action', () => {
    const result = buildProductAppCardEntryPoints(
      manifest,
      [context('example.admin', 'management'), context('example.work', 'work')],
      Date.parse('2029-01-01')
    );

    expect(result.primary).toMatchObject({
      plane: 'work',
      path: '/example/work?scope=example.work-scope',
    });
    expect(result.managementActions).toEqual([
      expect.objectContaining({
        plane: 'management',
        surfaceId: 'example.admin',
        readOnly: true,
      }),
    ]);
  });

  it('uses management as the primary launch for a management-only user', () => {
    const result = buildProductAppCardEntryPoints(
      manifest,
      [context('example.admin', 'management')],
      Date.parse('2029-01-01')
    );

    expect(result.primary).toMatchObject({ plane: 'management', surfaceId: 'example.admin' });
    expect(result.managementActions).toEqual([]);
  });

  it('does not invent an entry for duplicate contexts and lists only manageable products', () => {
    const duplicated = context('example.admin', 'management');
    expect(buildProductSurfaceEntryPoints(manifest, [duplicated, duplicated])).toEqual([]);
    expect(
      buildManageableProductList(
        [manifest],
        [context('example.work', 'work')],
        Date.parse('2029-01-01')
      )
    ).toEqual([]);
  });
});
