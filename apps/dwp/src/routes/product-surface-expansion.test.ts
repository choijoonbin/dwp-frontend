import { describe, expect, it } from 'vitest';

import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { buildGovernedProductEntryCatalog } from '../features/shell/product-entry-point-registry';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  type ProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { calendarRoutes } from './calendar-routes';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import { dwaionRoutes } from './dwaion-routes';
import { hcmRoutes } from './hcm-routes';
import { mailRoutes } from './mail-routes';
import { meetingsRoutes } from './meetings-routes';
import { messagingRoutes } from './messaging-routes';
import { notificationRoutes } from './notification-routes';
import { PRODUCT_MENU_ROUTES } from './product-menu-manifest';
import { PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './product-page-route-contracts';
import { resolveProductCanaryBoundaryStrategy } from './product-surface-canary-routes';
import { roomsRoutes } from './rooms-routes';
import { spacesRoutes } from './spaces-routes';

import type { ProductScopeKind } from '../components/product-manifest';
import type { RouteObject } from 'react-router-dom';

const EXPECTED_MENU_COUNTS: Readonly<Record<string, number>> = {
  approvals: 15,
  calendar: 10,
  communications: 6,
  dwaion: 15,
  hcm: 25,
  mail: 15,
  meetings: 7,
  messaging: 8,
  notifications: 9,
  services: 6,
  spaces: 11,
  workplace: 12,
};

const DRAFT_PRODUCT_IDS = [
  'calendar',
  'dwaion',
  'mail',
  'meetings',
  'messaging',
  'notifications',
  'spaces',
  'workplace',
] as const;

const ROUTE_TREES: readonly [string, RouteObject[], string][] = [
  ['calendar', calendarRoutes, 'admin'],
  ['dwaion', dwaionRoutes, 'admin'],
  ['mail', mailRoutes, 'admin'],
  ['meetings', meetingsRoutes, 'admin'],
  ['messaging', messagingRoutes, 'admin'],
  ['notifications', notificationRoutes, 'admin'],
  ['spaces', spacesRoutes, 'admin'],
  ['workplace', roomsRoutes, 'admin'],
];

function routeContractKeys(routes: readonly RouteObject[]): string[] {
  return routes.flatMap((route) => {
    const handle = route.handle as { routeContractKey?: unknown } | undefined;
    const own = typeof handle?.routeContractKey === 'string' ? [handle.routeContractKey] : [];
    return [...own, ...routeContractKeys(route.children ?? [])];
  });
}

describe('all-product surface expansion', () => {
  it('registers all 12 business apps and exactly the governed 139 menu rows', () => {
    expect(GOVERNED_PRODUCT_MANIFESTS.map((manifest) => manifest.id).sort()).toEqual(
      Object.keys(EXPECTED_MENU_COUNTS).sort()
    );
    for (const manifest of GOVERNED_PRODUCT_MANIFESTS) {
      const navigationCount = manifest.surfaces.reduce(
        (count, surface) =>
          count + surface.navigation.reduce((subtotal, group) => subtotal + group.items.length, 0),
        0
      );
      expect(navigationCount, manifest.id).toBe(EXPECTED_MENU_COUNTS[manifest.id]);
      expect(new Set(manifest.surfaces.map((surface) => surface.id)).size).toBe(
        manifest.surfaces.length
      );
    }
    expect(Object.values(EXPECTED_MENU_COUNTS).reduce((sum, count) => sum + count, 0)).toBe(139);
  });

  it('keeps the five active Mail work menus bound to APP.MAIL and DRAFT W3 authority', () => {
    const mailManifest = GOVERNED_PRODUCT_MANIFESTS.find((manifest) => manifest.id === 'mail');
    const workSurface = mailManifest?.surfaces.find((surface) => surface.id === 'mail.work');
    const expected = [
      ['archive', '/mail/archive'],
      ['spam', '/mail/spam'],
      ['trash', '/mail/trash'],
      ['folders', '/mail/folders'],
      ['organization', '/mail/organization'],
    ] as const;

    expect(mailManifest?.appKey).toBe('APP.MAIL');
    expect(workSurface?.plane).toBe('work');
    expect(workSurface?.entryAccess).toEqual({
      type: 'policy',
      accessPolicyKey: 'mail.work-access.v1',
      requiresProductEntitlement: true,
    });

    const activeItems = workSurface?.navigation.flatMap((group) => group.items) ?? [];
    for (const [view, path] of expected) {
      expect(activeItems.find((item) => item.view === view)).toMatchObject({
        view,
        path,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' },
      });
      expect(PRODUCT_MENU_ROUTES.find((route) => route.id === `mail.${view}`)).toMatchObject({
        path,
        shell: 'mail',
        plane: 'work',
        taskKind: 'work',
        navigationContextId: 'mail.work',
        productSurfaceId: 'mail.work',
        migrationWave: 'W3',
      });
      expect(
        DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
          (route) => route.routeContractKey === `route.mail.work.${view}.page`
        )
      ).toEqual([
        {
          routeId: `mail.work.${view}`,
          pattern: path,
          productId: 'mail',
          surfaceId: 'mail.work',
          routeContractKey: `route.mail.work.${view}.page`,
        },
      ]);
    }
  });

  it('keeps W2/W3 page contracts explicitly DRAFT until matching backend authority exists', () => {
    const menuContracts = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => !route.pattern.includes(':')
    );
    expect(menuContracts).toHaveLength(87);
    expect(DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(92);
    for (const route of menuContracts) {
      expect(
        PRODUCT_MENU_ROUTES.filter(
          (menu) => menu.path === route.pattern && menu.productSurfaceId === route.surfaceId
        ),
        route.routeContractKey
      ).toHaveLength(1);
    }

    const authority: ProductSurfaceCanaryAuthority = {
      flags: {
        contextShadow: false,
        capabilityEnforcement: false,
        surfaceUi: false,
        surfaceUiEvaluation: 'resolved',
      },
      productFlags: {},
    };
    for (const productId of DRAFT_PRODUCT_IDS) {
      expect(
        resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, productId))
      ).toBe('invalid');
      expect(resolveProductCanaryBoundaryStrategy(authority, productId)).toBe('fail-closed');
    }
  });

  it('keeps every governed product on its legacy runtime when exact server flags are 000', () => {
    const disabledFlags = {
      contextShadow: false,
      capabilityEnforcement: false,
      surfaceUi: false,
      surfaceUiEvaluation: 'resolved' as const,
    };
    const authority: ProductSurfaceCanaryAuthority = {
      flags: disabledFlags,
      productFlags: Object.fromEntries(
        GOVERNED_PRODUCT_MANIFESTS.map((manifest) => [manifest.id, disabledFlags])
      ),
    };

    for (const manifest of GOVERNED_PRODUCT_MANIFESTS) {
      expect(
        resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, manifest.id)),
        manifest.id
      ).toBe('baseline');
      expect(resolveProductCanaryBoundaryStrategy(authority, manifest.id), manifest.id).toBe(
        'legacy'
      );
    }
  });

  it('exposes management catalog entries only with exact contexts and enforced product flags', () => {
    for (const manifest of GOVERNED_PRODUCT_MANIFESTS) {
      const management = manifest.surfaces.find((surface) => surface.plane === 'management')!;
      const scopeKind = management.supportedScopeKinds[0] as ProductScopeKind;
      const envelope = {
        contractVersion: '1',
        decisionRevision: 'revision-1',
        sourceRevisions: {},
        activeAccessMode: 'NORMAL' as const,
        generatedAt: '2029-01-01T00:00:00Z',
        contexts: [
          {
            contextKey: `${manifest.id}-management`,
            productKey: manifest.id,
            surfaceKey: management.id,
            plane: 'management' as const,
            accessMode: 'NORMAL' as const,
            accessSource: 'MANAGEMENT' as const,
            appResourceKey: manifest.appKey,
            effectiveGrants: [],
            scopes: [
              {
                key: `${manifest.id}-scope`,
                kind: scopeKind,
                displayName: 'Assigned scope',
                isDefault: true,
                readOnly: false,
              },
            ],
            revalidateAt: '2030-01-01T00:00:00Z',
          },
        ],
      };
      const enabled = buildGovernedProductEntryCatalog(
        {
          productFlags: {
            [manifest.id]: {
              contextShadow: true,
              capabilityEnforcement: true,
              surfaceUi: true,
              surfaceUiEvaluation: 'resolved',
            },
          },
        },
        envelope,
        [manifest],
        Date.parse('2029-01-01T00:00:00Z')
      );
      expect(enabled, manifest.id).toHaveLength(1);
      expect(enabled[0]?.management?.surfaceId).toBe(management.id);
      expect(buildGovernedProductEntryCatalog({ productFlags: {} }, envelope, [manifest])).toEqual(
        []
      );
    }
  });

  it.each(ROUTE_TREES)(
    '%s has sibling work and management route shells',
    (_, routes, adminPath) => {
      const productRoot = routes[0];
      expect(productRoot?.children?.some((route) => route.index)).toBe(true);
      expect(productRoot?.children?.some((route) => route.path === adminPath)).toBe(true);
      expect(productRoot?.children?.some((route) => route.path === undefined)).toBe(true);
    }
  );

  it('binds every supported W2/W3 path-based detail route without changing menu counts', () => {
    const details = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) =>
      route.pattern.includes(':')
    );
    expect(details.map((route) => route.pattern).sort()).toEqual([
      '/dwaion/conversations/:conversationId',
      '/meetings/room/:meetingId',
      '/notifications/center/:notificationId',
      '/spaces/:spaceKey',
      '/spaces/:spaceKey/:tab',
    ]);
    expect(
      PRODUCT_MENU_ROUTES.filter((menu) => menu.productSurfaceId).map((menu) => menu.path)
    ).toHaveLength(139);

    const spacesWorkShell = spacesRoutes[0]?.children?.find(
      (route) => !route.index && route.path === undefined
    );
    expect(spacesWorkShell?.children?.map((route) => route.path).filter(Boolean)).toEqual(
      expect.arrayContaining([':spaceKey', ':spaceKey/:tab'])
    );
    expect(routeContractKeys(spacesRoutes).filter((key) => key.includes('.space-detail'))).toEqual([
      'route.spaces.work.space-detail.page',
      'route.spaces.work.space-detail-tab.page',
    ]);
  });

  it.each(ROUTE_TREES)(
    '%s binds every DRAFT PAGE contract into its Router tree',
    (productId, routes) => {
      const expected = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
        (route) => route.productId === productId
      )
        .map((route) => route.routeContractKey)
        .sort();
      expect(routeContractKeys(routes).sort()).toEqual(expected);
    }
  );

  it('binds HCM personal, team, operations, and management as sibling route surfaces', () => {
    const children = hcmRoutes[0]?.children ?? [];
    expect(children.map((route) => route.path ?? 'pathless')).toEqual([
      'pathless',
      'manage',
      'design',
      'data',
      'operations',
      'team',
      'pathless',
    ]);
    expect(routeContractKeys(hcmRoutes).sort()).toEqual(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.productId === 'hcm')
        .map((route) => route.routeContractKey)
        .sort()
    );
  });
});
