import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';
import {
  buildGovernedProductEntryCatalog,
  usesLegacyProductLaunchDiscovery,
} from './product-entry-point-registry';

import type { ProductSurfaceRolloutFlags } from './product-surface-canary-runtime';

const manifest = defineProductManifest({
  id: 'sample',
  appKey: 'APP.SAMPLE',
  basePath: '/sample',
  surfaces: [
    {
      id: 'sample.work',
      plane: 'work',
      labelKey: 'sample.work',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/sample/work' }],
      indexPath: '/sample/work',
      navigation: [],
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'sample.work.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'sample.management',
      plane: 'management',
      labelKey: 'sample.management',
      taskKinds: ['administration'],
      routeMatchers: [{ kind: 'prefix', path: '/sample/admin' }],
      indexPath: '/sample/admin',
      navigation: [],
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['sample.manage'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
    },
  ],
  legacyRedirects: [],
});

describe('governed product entry registry', () => {
  it('keeps a management-only user discoverable without inventing a Work entitlement', () => {
    const contexts = [
      {
        contextKey: 'sample-management',
        productKey: 'sample',
        surfaceKey: 'sample.management',
        plane: 'management' as const,
        accessMode: 'NORMAL' as const,
        accessSource: 'MANAGEMENT' as const,
        appResourceKey: 'APP.SAMPLE',
        effectiveGrants: [],
        scopes: [
          {
            key: 'opaque-scope',
            kind: 'RESOURCE_SET' as const,
            displayName: 'Assigned area',
            isDefault: true,
            readOnly: false,
          },
        ],
        revalidateAt: '2030-01-01T00:00:00Z',
      },
    ];
    const result = buildGovernedProductEntryCatalog(
      {
        productFlags: {
          sample: {
            contextShadow: true,
            capabilityEnforcement: true,
            surfaceUi: false,
            surfaceUiEvaluation: 'resolved',
          },
        },
      },
      {
        contractVersion: '1',
        decisionRevision: 'revision-1',
        sourceRevisions: {},
        activeAccessMode: 'NORMAL',
        generatedAt: '2029-01-01T00:00:00Z',
        contexts,
      },
      [manifest],
      Date.parse('2029-01-01T00:00:00Z')
    );

    expect(result).toMatchObject([
      {
        appResourceKey: 'APP.SAMPLE',
        work: undefined,
        management: {
          path: '/sample/admin?scope=opaque-scope',
          plane: 'management',
        },
      },
    ]);
  });

  it.each([
    {
      state: '000',
      mode: 'baseline',
      flags: [false, false, false],
      governedDiscovery: false,
      legacyDiscovery: true,
    },
    {
      state: '100',
      mode: 'shadow',
      flags: [true, false, false],
      governedDiscovery: false,
      legacyDiscovery: true,
    },
    {
      state: '110',
      mode: 'enforced-compatibility',
      flags: [true, true, false],
      governedDiscovery: true,
      legacyDiscovery: true,
    },
    {
      state: '111',
      mode: 'surface-ui',
      flags: [true, true, true],
      governedDiscovery: true,
      legacyDiscovery: false,
    },
  ] as const)(
    'uses the correct governed and legacy discovery sources in rollout $state',
    ({ mode, flags, governedDiscovery, legacyDiscovery }) => {
      const contexts = [
        {
          contextKey: 'sample-management',
          productKey: 'sample',
          surfaceKey: 'sample.management',
          plane: 'management' as const,
          accessMode: 'NORMAL' as const,
          accessSource: 'MANAGEMENT' as const,
          appResourceKey: 'APP.SAMPLE',
          effectiveGrants: [],
          scopes: [
            {
              key: 'opaque-scope',
              kind: 'RESOURCE_SET' as const,
              displayName: 'Assigned area',
              isDefault: true,
              readOnly: false,
            },
          ],
          revalidateAt: '2030-01-01T00:00:00Z',
        },
      ];

      const productFlags: ProductSurfaceRolloutFlags = {
        contextShadow: flags[0],
        capabilityEnforcement: flags[1],
        surfaceUi: flags[2],
        surfaceUiEvaluation: 'resolved',
      };
      const catalog = buildGovernedProductEntryCatalog(
        {
          productFlags: { sample: productFlags },
        },
        {
          contractVersion: '1',
          decisionRevision: 'revision-1',
          sourceRevisions: {},
          activeAccessMode: 'NORMAL',
          generatedAt: '2029-01-01T00:00:00Z',
          contexts,
        },
        [manifest],
        Date.parse('2029-01-01T00:00:00Z')
      );

      expect(catalog).toHaveLength(governedDiscovery ? 1 : 0);
      expect(usesLegacyProductLaunchDiscovery(mode)).toBe(legacyDiscovery);
    }
  );

  it('does not infer a 110 catalog entry from a tenant-admin role without product duty context', () => {
    const result = buildGovernedProductEntryCatalog(
      {
        productFlags: {
          sample: {
            contextShadow: true,
            capabilityEnforcement: true,
            surfaceUi: false,
            surfaceUiEvaluation: 'resolved',
          },
        },
      },
      {
        contractVersion: '1',
        decisionRevision: 'tenant-admin-revision',
        sourceRevisions: {},
        activeAccessMode: 'NORMAL',
        generatedAt: '2029-01-01T00:00:00Z',
        contexts: [],
      },
      [manifest],
      Date.parse('2029-01-01T00:00:00Z')
    );

    expect(result).toEqual([]);
  });
});
