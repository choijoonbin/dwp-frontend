import { describe, expect, it } from 'vitest';
import { House, ShieldCheck } from 'lucide-react';

import { defineProductManifest } from './product-manifest';

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

describe('defineProductManifest', () => {
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
});
