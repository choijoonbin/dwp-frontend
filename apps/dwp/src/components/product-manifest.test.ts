import { describe, expect, it } from 'vitest';
import { House, ShieldCheck } from 'lucide-react';
import { PRODUCT_SCOPE_KINDS as AUTHORITY_WIRE_SCOPE_KINDS } from '@dwp-frontend/shared-utils/auth/product-surface-scope-kind';

import {
  PRODUCT_SCOPE_KINDS,
  defineProductManifest,
  isProductScopeKind,
  productScopeIdentitiesAreKnownAndUnique,
} from './product-manifest';

const validManifest = () => ({
  id: 'example',
  appKey: 'APP.EXAMPLE',
  basePath: '/example' as const,
  homePath: '/example/home' as const,
  shellKey: 'example',
  adminMode: 'embedded' as const,
  navigation: [
    { id: 'start', items: [{ path: '/example/home', view: 'home', icon: House }] },
    {
      id: 'admin',
      items: [
        {
          path: '/example/admin',
          view: 'admin',
          icon: ShieldCheck,
          requiredResourceKey: 'ADMIN.EXAMPLE',
          requiredPermissionCode: 'VIEW',
          requiredAnySupportScopes: ['TENANT_CONFIGURATION_READ'],
        },
      ],
    },
  ],
});

const validSurfaceManifest = () => ({
  id: 'example',
  appKey: 'APP.EXAMPLE',
  basePath: '/example' as const,
  surfaces: [
    {
      id: 'example.work',
      plane: 'work' as const,
      labelKey: 'example.surface.work',
      taskKinds: ['work'] as const,
      routeMatchers: [
        { kind: 'exact' as const, path: '/example/home' as const },
        { kind: 'prefix' as const, path: '/example/requests' as const },
      ],
      indexPath: '/example/home' as const,
      navigation: [
        {
          id: 'work',
          items: [
            {
              path: '/example/home',
              view: 'home',
              icon: House,
              taskKind: 'work' as const,
              access: { type: 'policy' as const, accessPolicyKey: 'example.work-access.v1' },
            },
          ],
        },
      ],
      entryAccess: {
        type: 'policy' as const,
        accessPolicyKey: 'example.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'] as const,
      shellProfile: 'product-work' as const,
    },
    {
      id: 'example.management',
      plane: 'management' as const,
      labelKey: 'example.surface.management',
      taskKinds: ['operations', 'administration'] as const,
      routeMatchers: [{ kind: 'prefix' as const, path: '/example/admin' as const }],
      indexPath: '/example/admin' as const,
      navigation: [
        {
          id: 'management',
          items: [
            {
              path: '/example/admin',
              view: 'admin',
              icon: ShieldCheck,
              taskKind: 'administration' as const,
              access: {
                type: 'capability' as const,
                capabilityContractKey: 'example.configuration.read',
              },
            },
          ],
        },
      ],
      entryAccess: {
        type: 'capability' as const,
        entryCapabilityMode: 'ANY' as const,
        requiredCapabilityContractKeys: ['example.configuration.read'] as const,
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'] as const,
      shellProfile: 'product-management' as const,
      returnSurfaceId: 'example.work',
    },
  ] as const,
});

describe('defineProductManifest', () => {
  it('shares every declared and server-issued Product scope kind from one runtime guard', () => {
    expect(PRODUCT_SCOPE_KINDS).toBe(AUTHORITY_WIRE_SCOPE_KINDS);
    expect(PRODUCT_SCOPE_KINDS).toEqual([
      'TENANT',
      'SELF',
      'TEAM',
      'ORG_UNIT',
      'LEGAL_ENTITY',
      'DOMAIN',
      'RESOURCE_SET',
      'RESOURCE',
      'POLICY_NODE',
      'TARGET_POPULATION',
      'SUPPORT_SESSION',
    ]);
    expect(['TENANT', 'TEAM', 'POLICY_NODE', 'TARGET_POPULATION'].every(isProductScopeKind)).toBe(
      true
    );
    expect(isProductScopeKind('UNKNOWN_SCOPE')).toBe(false);
    expect(
      productScopeIdentitiesAreKnownAndUnique([
        { key: 'scope-team', kind: 'TEAM' },
        { key: 'scope-policy', kind: 'POLICY_NODE' },
      ])
    ).toBe(true);
    expect(
      productScopeIdentitiesAreKnownAndUnique([
        { key: 'scope-team', kind: 'TEAM' },
        { key: 'scope-team', kind: 'TARGET_POPULATION' },
      ])
    ).toBe(false);
    expect(
      productScopeIdentitiesAreKnownAndUnique([{ key: 'scope-unknown', kind: 'UNKNOWN_SCOPE' }])
    ).toBe(false);
  });

  it('accepts a product whose home and navigation are owned by its route boundary', () => {
    expect(defineProductManifest(validManifest())).toEqual(validManifest());
  });

  it('rejects a home route outside the product boundary', () => {
    expect(() => defineProductManifest({ ...validManifest(), homePath: '/outside/home' })).toThrow(
      /home path/u
    );
  });

  it('rejects duplicate and cross-product navigation paths', () => {
    const manifest = validManifest();
    expect(() =>
      defineProductManifest({
        ...manifest,
        navigation: [
          ...manifest.navigation,
          { id: 'duplicate', items: [{ path: '/example/home', view: 'again', icon: House }] },
        ],
      })
    ).toThrow(/duplicated/u);
    expect(() =>
      defineProductManifest({
        ...manifest,
        navigation: [
          { id: 'outside', items: [{ path: '/outside/home', view: 'outside', icon: House }] },
        ],
      })
    ).toThrow(/outside its product boundary/u);
  });

  it('rejects incomplete permission and provider-support contracts', () => {
    const manifest = validManifest();
    expect(() =>
      defineProductManifest({
        ...manifest,
        navigation: [
          {
            id: 'broken-permission',
            items: [
              {
                path: '/example/broken',
                view: 'broken',
                icon: ShieldCheck,
                requiredPermissionCode: 'VIEW',
              },
            ],
          },
        ],
      })
    ).toThrow(/requires a resource/u);
    expect(() =>
      defineProductManifest({
        ...manifest,
        navigation: [
          {
            id: 'broken-support',
            items: [
              {
                path: '/example/broken-support',
                view: 'broken-support',
                icon: ShieldCheck,
                requiredAnySupportScopes: [''],
              },
            ],
          },
        ],
      })
    ).toThrow(/support scope is incomplete/u);
  });

  it('accepts a v2 manifest with sibling work and management surfaces', () => {
    const manifest = validSurfaceManifest();

    expect(defineProductManifest(manifest)).toEqual(manifest);
  });

  it('rejects ambiguous cross-surface ownership and segment lookalikes remain separate', () => {
    const manifest = validSurfaceManifest();
    expect(() =>
      defineProductManifest({
        ...manifest,
        surfaces: [
          manifest.surfaces[0],
          {
            ...manifest.surfaces[1],
            routeMatchers: [{ kind: 'prefix', path: '/example/requests' }],
            indexPath: '/example/requests/admin',
            navigation: [],
          },
        ],
      })
    ).toThrow(/ambiguous route ownership/u);

    expect(() =>
      defineProductManifest({
        ...manifest,
        surfaces: [
          manifest.surfaces[0],
          {
            ...manifest.surfaces[1],
            routeMatchers: [{ kind: 'prefix', path: '/example/administer' }],
            indexPath: '/example/administer',
            navigation: [],
          },
        ],
      })
    ).not.toThrow();
  });

  it('rejects missing exact access contracts and mismatched shell profiles', () => {
    const manifest = validSurfaceManifest();
    expect(() =>
      defineProductManifest({
        ...manifest,
        surfaces: [
          manifest.surfaces[0],
          {
            ...manifest.surfaces[1],
            entryAccess: {
              type: 'capability',
              entryCapabilityMode: 'ANY',
              requiredCapabilityContractKeys: [] as unknown as readonly [string, ...string[]],
              requiresProductEntitlement: false,
            },
          },
        ],
      })
    ).toThrow(/entry capabilities are empty/u);
    expect(() =>
      defineProductManifest({
        ...manifest,
        surfaces: [manifest.surfaces[0], { ...manifest.surfaces[1], shellProfile: 'product-work' }],
      })
    ).toThrow(/shell profile/u);

    expect(() =>
      defineProductManifest({
        ...manifest,
        surfaces: [
          manifest.surfaces[0],
          {
            ...manifest.surfaces[1],
            entryAccess: {
              ...manifest.surfaces[1].entryAccess,
              accessPolicyKey: 'example.mixed-access.v1',
            } as unknown as (typeof manifest.surfaces)[1]['entryAccess'],
          },
        ],
      })
    ).toThrow(/mixes union members/u);
  });

  it('rejects redirect chains and paths outside the owning surface', () => {
    const manifest = validSurfaceManifest();
    expect(() =>
      defineProductManifest({
        ...manifest,
        legacyRedirects: [
          {
            id: 'old-example',
            sourceMatcher: { kind: 'prefix', path: '/old-example' },
            target: { kind: 'static', path: '/legacy-example' },
            preserveQuery: true,
            preserveHash: true,
            maxHops: 1,
            unknownTarget: 'product-not-found',
          },
          {
            id: 'legacy-example',
            sourceMatcher: { kind: 'prefix', path: '/legacy-example' },
            target: { kind: 'static', path: '/example/home' },
            preserveQuery: true,
            preserveHash: true,
            maxHops: 1,
            unknownTarget: 'product-not-found',
          },
        ],
      })
    ).toThrow(/redirect chain/u);
  });
});
