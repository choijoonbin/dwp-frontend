import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';
import type { ProductSurfaceDefinition } from '../../components/product-manifest';

import {
  buildManageableProductList,
  buildProductAppCardEntryPoints,
  buildProductHeaderEntryPoints,
  buildProductSurfaceEntryPoints,
} from './product-entry-point-model';

import type { ProductSurfaceEntryPoint } from './product-entry-point-model';

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

  it('exposes exactly one app-management transition from a multi-surface work header', () => {
    const hcmLikeManifest = defineProductManifest({
      id: 'hcm',
      appKey: 'APP.HCM',
      basePath: '/hr',
      surfaces: [
        surfaceDefinition('hcm.personal', 'work', '/hr/home', ['work']),
        surfaceDefinition('hcm.team', 'work', '/hr/team', ['team']),
        surfaceDefinition('hcm.operations', 'management', '/hr/operations', ['operations']),
        surfaceDefinition('hcm.management', 'management', '/hr/manage', [
          'operations',
          'administration',
        ]),
      ],
    });
    const entries: ProductSurfaceEntryPoint[] = [
      entry('hcm.personal', 'work', '/hr/home'),
      entry('hcm.team', 'work', '/hr/team'),
      entry('hcm.operations', 'management', '/hr/operations'),
      entry('hcm.management', 'management', '/hr/manage'),
    ];

    expect(buildProductHeaderEntryPoints(hcmLikeManifest, 'hcm.personal', entries)).toEqual([
      entries[0],
      entries[1],
      { ...entries[3], entryKind: 'management-entry' },
    ]);
    expect(buildProductHeaderEntryPoints(hcmLikeManifest, 'hcm.operations', entries)).toEqual([
      { ...entries[0], entryKind: 'work-return' },
      entries[2],
      entries[3],
    ]);
  });
});

function surfaceDefinition(
  id: string,
  plane: 'work' | 'management',
  indexPath: `/${string}`,
  taskKinds: [
    'work' | 'team' | 'operations' | 'administration',
    ...Array<'work' | 'team' | 'operations' | 'administration'>,
  ]
): ProductSurfaceDefinition {
  return {
    id,
    plane,
    labelKey: id,
    taskKinds,
    routeMatchers: [{ kind: 'prefix' as const, path: indexPath }],
    indexPath,
    navigation: [],
    entryAccess:
      plane === 'work'
        ? {
            type: 'policy' as const,
            accessPolicyKey: `${id}.v1`,
            requiresProductEntitlement: false,
          }
        : {
            type: 'capability' as const,
            entryCapabilityMode: 'ANY' as const,
            requiredCapabilityContractKeys: [`${id}.read`],
            requiresProductEntitlement: false,
          },
    supportedScopeKinds: plane === 'work' ? (['SELF'] as const) : (['RESOURCE_SET'] as const),
    shellProfile: plane === 'work' ? ('product-work' as const) : ('product-management' as const),
    returnSurfaceId: plane === 'management' ? 'hcm.personal' : undefined,
  };
}

function entry(
  surfaceId: string,
  plane: 'work' | 'management',
  path: string
): ProductSurfaceEntryPoint {
  return {
    productId: 'hcm',
    surfaceId,
    plane,
    labelKey: surfaceId,
    path,
    contextKey: `${surfaceId}-context`,
    requiresScopeSelection: false,
    readOnly: false,
  };
}
