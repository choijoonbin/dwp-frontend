// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { dwaionRoutes } from '../../routes/dwaion-routes';
import { DWAION_PRODUCT_MANIFEST } from './dwaion-navigation';

describe('DWAI-ON product manifest', () => {
  it('owns a canonical home and unique navigation within its product boundary', () => {
    const items = DWAION_PRODUCT_MANIFEST.navigation.flatMap((group) => group.items);

    expect(DWAION_PRODUCT_MANIFEST.homePath).toBe('/dwaion/home');
    expect(DWAION_PRODUCT_MANIFEST.adminMode).toBe('embedded');
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length);
    expect(items.every((item) => item.path.startsWith('/dwaion/'))).toBe(true);
  });

  it('keeps every operations surface behind its least-privilege authority', () => {
    const administration = DWAION_PRODUCT_MANIFEST.navigation.find(
      (group) => group.id === 'admin'
    )?.items;

    expect(administration).toHaveLength(7);
    expect(
      administration?.map((item) => ({
        view: item.view,
        resourceKey: 'requiredResourceKey' in item ? item.requiredResourceKey : undefined,
      }))
    ).toEqual([
      { view: 'admin-overview', resourceKey: 'ADMIN.DWAION_OPERATIONS' },
      { view: 'admin-agents', resourceKey: 'ADMIN.DWAION_AGENTS' },
      { view: 'admin-sources', resourceKey: 'ADMIN.DWAION_SOURCES' },
      { view: 'admin-actions', resourceKey: 'ADMIN.DWAION_ACTIONS' },
      { view: 'admin-safety', resourceKey: 'ADMIN.DWAION_SAFETY' },
      { view: 'admin-evaluation', resourceKey: 'ADMIN.DWAION_EVALUATION' },
      { view: 'admin-audit', resourceKey: undefined },
    ]);

    const audit = administration?.find((item) => item.view === 'admin-audit');
    expect('requiredAnyAuthorities' in (audit ?? {})).toBe(true);
    expect(audit && 'requiredAnyAuthorities' in audit ? audit.requiredAnyAuthorities : []).toEqual([
      { resourceKey: 'ADMIN.DWAION_RETENTION', permissionCode: 'VIEW' },
      { resourceKey: 'ADMIN.DWAION_AUDIT', permissionCode: 'VIEW' },
    ]);
  });

  it('keeps every manifest navigation target backed by a static product route', () => {
    const productRoute = dwaionRoutes.find((route) => route.path === 'dwaion');
    const staticPaths = new Set(
      productRoute?.children
        ?.map((route) => route.path)
        .filter(
          (path): path is string => typeof path === 'string' && !path.includes(':') && path !== '*'
        )
        .map((path) => `/dwaion/${path}`)
    );
    const navigationPaths = DWAION_PRODUCT_MANIFEST.navigation.flatMap((group) =>
      group.items.map((item) => item.path)
    );

    expect(navigationPaths.every((path) => staticPaths.has(path))).toBe(true);
  });
});
