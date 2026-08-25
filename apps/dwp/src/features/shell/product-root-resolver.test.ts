import { House, ShieldCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { defineProductManifest } from '../../components/product-manifest';

import { resolveProductRoot } from './product-root-resolver';

import type {
  EffectiveProductSurfaceContext,
  EffectiveProductSurfaceContextEnvelope,
} from './product-surface-context';

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

function context(
  surfaceKey: string,
  plane: 'work' | 'management',
  scopeKind: 'SELF' | 'RESOURCE_SET',
  scopes = [
    {
      key: `${surfaceKey}-scope`,
      kind: scopeKind,
      displayName: surfaceKey,
      isDefault: true,
      readOnly: false,
    },
  ]
): EffectiveProductSurfaceContext {
  return {
    contextKey: `${surfaceKey}-context`,
    productKey: 'example',
    surfaceKey,
    plane,
    accessMode: 'NORMAL',
    accessSource: plane === 'work' ? 'ENTITLEMENT' : 'MANAGEMENT',
    appResourceKey: 'APP.EXAMPLE',
    effectiveGrants: [],
    scopes,
    revalidateAt: '2030-01-01T00:00:00Z',
  };
}

function envelope(
  contexts: readonly EffectiveProductSurfaceContext[]
): Pick<
  EffectiveProductSurfaceContextEnvelope,
  'contexts' | 'activeAccessMode' | 'decisionRevision'
> {
  return { contexts, activeAccessMode: 'NORMAL', decisionRevision: 'revision-1' };
}

describe('resolveProductRoot', () => {
  it('always chooses work first even when management is also allowed', () => {
    expect(
      resolveProductRoot(
        manifest,
        envelope([
          context('example.admin', 'management', 'RESOURCE_SET'),
          context('example.work', 'work', 'SELF'),
        ]),
        { nowMs: Date.parse('2029-01-01') }
      )
    ).toEqual({
      type: 'redirect',
      productId: 'example',
      surfaceId: 'example.work',
      contextKey: 'example.work-context',
      contextScopeKey: 'example.work-scope',
      requiresScopeSelection: false,
      to: '/example/work?scope=example.work-scope',
      replace: true,
    });
  });

  it('allows a management-only user to enter the first management surface', () => {
    expect(
      resolveProductRoot(
        manifest,
        envelope([context('example.admin', 'management', 'RESOURCE_SET')]),
        { nowMs: Date.parse('2029-01-01') }
      )
    ).toMatchObject({
      type: 'redirect',
      surfaceId: 'example.admin',
      to: '/example/admin?scope=example.admin-scope',
    });
  });

  it('enters the surface without a scope when the user must make an explicit selection', () => {
    const management = context('example.admin', 'management', 'RESOURCE_SET', [
      {
        key: 'scope-a',
        kind: 'RESOURCE_SET',
        displayName: 'A',
        isDefault: false,
        readOnly: false,
      },
      {
        key: 'scope-b',
        kind: 'RESOURCE_SET',
        displayName: 'B',
        isDefault: false,
        readOnly: false,
      },
    ]);

    expect(
      resolveProductRoot(manifest, envelope([management]), { nowMs: Date.parse('2029-01-01') })
    ).toMatchObject({
      type: 'redirect',
      surfaceId: 'example.admin',
      requiresScopeSelection: true,
      to: '/example/admin',
    });
  });

  it('preserves an explicit non-default scope instead of silently selecting the default', () => {
    const work = context('example.work', 'work', 'SELF', [
      {
        key: 'scope-default',
        kind: 'SELF',
        displayName: 'Default',
        isDefault: true,
        readOnly: false,
      },
      {
        key: 'scope-explicit',
        kind: 'SELF',
        displayName: 'Explicit',
        isDefault: false,
        readOnly: false,
      },
    ]);

    expect(
      resolveProductRoot(manifest, envelope([work]), {
        nowMs: Date.parse('2029-01-01'),
        requestedScopeKey: 'scope-explicit',
      })
    ).toMatchObject({
      type: 'redirect',
      contextScopeKey: 'scope-explicit',
      to: '/example/work?scope=scope-explicit',
    });
  });

  it('fails locally instead of replacing an invalid explicit scope with a default', () => {
    expect(
      resolveProductRoot(manifest, envelope([context('example.work', 'work', 'SELF')]), {
        nowMs: Date.parse('2029-01-01'),
        requestedScopeKey: 'scope-unknown',
      })
    ).toEqual({ type: 'access-state', state: 'scope-invalid' });
  });

  it('fails closed for duplicate contexts, mixed modes, and an empty revision', () => {
    const work = context('example.work', 'work', 'SELF');
    expect(resolveProductRoot(manifest, envelope([work, work]))).toEqual({
      type: 'access-state',
      state: 'authority-unavailable',
    });
    expect(
      resolveProductRoot(manifest, envelope([{ ...work, accessMode: 'PROVIDER_SUPPORT' }]))
    ).toEqual({ type: 'access-state', state: 'authority-unavailable' });
    expect(resolveProductRoot(manifest, { ...envelope([]), decisionRevision: '' })).toEqual({
      type: 'access-state',
      state: 'authority-unavailable',
    });
  });

  it('returns an app access state when no work or management context is allowed', () => {
    expect(resolveProductRoot(manifest, envelope([]))).toEqual({
      type: 'access-state',
      state: 'app-denied',
    });
  });

  it('does not fall through to management when a returned work context has expired', () => {
    const work = {
      ...context('example.work', 'work', 'SELF'),
      revalidateAt: '2028-01-01T00:00:00Z',
    };
    expect(
      resolveProductRoot(
        manifest,
        envelope([work, context('example.admin', 'management', 'RESOURCE_SET')]),
        { nowMs: Date.parse('2029-01-01') }
      )
    ).toEqual({ type: 'access-state', state: 'expired' });
  });
});
