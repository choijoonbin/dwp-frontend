import { describe, expect, it } from 'vitest';

import {
  GOVERNED_PRODUCT_MANIFESTS,
  governedProductManifest,
} from '../components/product-manifest-registry';
import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { DWAION_NAVIGATION } from '../features/dwaion/dwaion-navigation';
import { HCM_NAVIGATION } from '../features/hcm/hcm-navigation';
import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { MEETINGS_NAVIGATION } from '../features/meetings/meetings-navigation';
import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { NOTIFICATION_NAVIGATION } from '../features/notifications/notification-navigation';
import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { canAccessProductAreaNavigationItem } from '../layouts/product-area-permissions';
import {
  buildLegacyProductSurfacePresentation,
  resolveLegacyPresentationSurface,
} from '../features/shell/legacy-product-surface-presentation';

import type {
  ProductNavigationGroup,
  ProductNavigationItem,
  ProductSurfaceDefinition,
  ProductSurfaceManifest,
} from '../components/product-manifest';

const NAVIGATION_BY_PRODUCT: Readonly<Record<string, readonly ProductNavigationGroup[]>> = {
  approvals: APPROVAL_NAVIGATION,
  calendar: CALENDAR_NAVIGATION,
  communications: COMMUNICATIONS_NAVIGATION,
  dwaion: DWAION_NAVIGATION,
  hcm: HCM_NAVIGATION,
  mail: MAIL_NAVIGATION,
  meetings: MEETINGS_NAVIGATION,
  messaging: MESSAGING_NAVIGATION,
  notifications: NOTIFICATION_NAVIGATION,
  services: SERVICES_NAVIGATION,
  spaces: SPACE_NAVIGATION,
  workplace: ROOMS_NAVIGATION,
};

const CONTRACTLESS_PRODUCT_CASES = [
  {
    productId: 'calendar',
    workPath: '/calendar/schedule',
    managementPath: '/calendar/admin/policies',
  },
  {
    productId: 'dwaion',
    workPath: '/dwaion/conversations',
    managementPath: '/dwaion/admin/audit',
  },
  { productId: 'mail', workPath: '/mail/inbox', managementPath: '/mail/admin/policies' },
  {
    productId: 'messaging',
    workPath: '/messages/direct',
    managementPath: '/messages/admin/policy',
  },
  {
    productId: 'notifications',
    workPath: '/notifications/center',
    managementPath: '/notifications/admin/templates',
  },
  {
    productId: 'spaces',
    workPath: '/spaces/discover',
    managementPath: '/spaces/admin/content-reviews',
  },
  {
    productId: 'workplace',
    workPath: '/workplace/rooms',
    managementPath: '/workplace/admin/meeting-policy',
  },
] as const;

const allowAll = () => true;
const allowAllSurfaces = () => true;

function navigationPaths(navigation: readonly ProductNavigationGroup[]): readonly string[] {
  return navigation.flatMap((group) => group.items.map((item) => item.path));
}

function surfacePaths(surface: ProductSurfaceDefinition): readonly string[] {
  return surface.navigation.flatMap((group) => group.items.map((item) => item.path));
}

function manifest(productId: string): ProductSurfaceManifest {
  const result = governedProductManifest(productId);
  if (!result) throw new Error(`Missing governed manifest: ${productId}`);
  return result;
}

function legacyAccess(
  hasPermission: (resourceKey: string, permissionCode?: string) => boolean
): (item: ProductNavigationItem) => boolean {
  return (item) => canAccessProductAreaNavigationItem(item, hasPermission);
}

describe('legacy product surface presentation', () => {
  it('projects the work plane and one App Management transition for all 12 governed manifests', () => {
    expect(Object.keys(NAVIGATION_BY_PRODUCT).sort()).toEqual(
      GOVERNED_PRODUCT_MANIFESTS.map((candidate) => candidate.id).sort()
    );

    for (const candidate of GOVERNED_PRODUCT_MANIFESTS) {
      const current = candidate.surfaces.find((surface) => surface.plane === 'work');
      expect(current, candidate.id).toBeDefined();
      const presentation = buildLegacyProductSurfacePresentation({
        manifest: candidate,
        pathname: current!.indexPath,
        navigation: NAVIGATION_BY_PRODUCT[candidate.id]!,
        canAccessItem: allowAll,
        canAccessSurface: allowAllSurfaces,
      });

      expect(presentation?.currentSurface.id, candidate.id).toBe(current!.id);
      expect(navigationPaths(presentation!.navigation), candidate.id).toEqual(
        surfacePaths(current!)
      );
      expect(
        presentation!.accessibleEntryPoints.map((entry) => entry.surfaceId),
        candidate.id
      ).toEqual(candidate.surfaces.map((surface) => surface.id));
      expect(
        presentation!.headerEntryPoints
          .filter((entry) => entry.plane === 'work')
          .map((entry) => entry.surfaceId),
        candidate.id
      ).toEqual(
        candidate.surfaces
          .filter((surface) => surface.plane === 'work')
          .map((surface) => surface.id)
      );
      const managementTransitions = presentation!.headerEntryPoints.filter(
        (entry) => entry.entryKind === 'management-entry'
      );
      expect(managementTransitions, candidate.id).toHaveLength(1);
      expect(
        presentation!.headerEntryPoints.filter((entry) => entry.plane === 'management'),
        candidate.id
      ).toEqual(managementTransitions);
      expect(presentation!.returnTarget, candidate.id).toEqual({
        path: '/apps',
        kind: 'catalog',
      });
    }
  });

  it('projects only the current admin sidebar plus Work Return and admin surfaces', () => {
    for (const candidate of GOVERNED_PRODUCT_MANIFESTS) {
      for (const current of candidate.surfaces.filter(
        (surface) => surface.plane === 'management'
      )) {
        const presentation = buildLegacyProductSurfacePresentation({
          manifest: candidate,
          pathname: current.indexPath,
          navigation: NAVIGATION_BY_PRODUCT[candidate.id]!,
          canAccessItem: allowAll,
          canAccessSurface: allowAllSurfaces,
        });

        expect(navigationPaths(presentation!.navigation), current.id).toEqual(
          surfacePaths(current)
        );
        const workReturns = presentation!.headerEntryPoints.filter(
          (entry) => entry.entryKind === 'work-return'
        );
        expect(workReturns, current.id).toHaveLength(1);
        expect(presentation!.headerEntryPoints[0], current.id).toEqual(workReturns[0]);
        expect(
          presentation!.headerEntryPoints
            .filter((entry) => entry.plane === 'management')
            .map((entry) => entry.surfaceId),
          current.id
        ).toEqual(
          candidate.surfaces
            .filter((surface) => surface.plane === 'management')
            .map((surface) => surface.id)
        );
        expect(presentation!.returnTarget, current.id).toEqual({
          path: workReturns[0]!.path,
          kind: 'work',
        });
      }
    }
  });

  it.each(CONTRACTLESS_PRODUCT_CASES)(
    'resolves the nested management prefix ahead of the broad work prefix for $productId',
    ({ productId, workPath, managementPath }) => {
      const candidate = manifest(productId);
      expect(resolveLegacyPresentationSurface(candidate, `${workPath}/?tab=one#item`)?.plane).toBe(
        'work'
      );
      expect(
        resolveLegacyPresentationSurface(candidate, `${managementPath}/?tab=one#item`)?.plane
      ).toBe('management');
    }
  );

  it.each(CONTRACTLESS_PRODUCT_CASES)(
    'does not expose App Management for $productId when its legacy admin items are inaccessible',
    ({ productId, workPath }) => {
      const candidate = manifest(productId);
      const presentation = buildLegacyProductSurfacePresentation({
        manifest: candidate,
        pathname: workPath,
        navigation: NAVIGATION_BY_PRODUCT[productId]!,
        canAccessItem: legacyAccess((resourceKey) => !resourceKey.startsWith('ADMIN.')),
        canAccessSurface: allowAllSurfaces,
      });

      expect(
        presentation!.accessibleEntryPoints.filter((entry) => entry.plane === 'management'),
        productId
      ).toEqual([]);
      expect(
        presentation!.headerEntryPoints.filter((entry) => entry.entryKind === 'management-entry'),
        productId
      ).toEqual([]);
      expect(
        navigationPaths(presentation!.navigation).some((path) => path.includes('/admin')),
        productId
      ).toBe(false);
    }
  );

  it('uses the first accessible legacy admin item when the manifest index is not accessible', () => {
    const candidate = manifest('dwaion');
    const canAccessItem = legacyAccess(
      (resourceKey, permissionCode) =>
        !resourceKey.startsWith('ADMIN.') ||
        (resourceKey === 'ADMIN.DWAION_AGENTS' && permissionCode === 'VIEW')
    );
    const workPresentation = buildLegacyProductSurfacePresentation({
      manifest: candidate,
      pathname: '/dwaion/home',
      navigation: DWAION_NAVIGATION,
      canAccessItem,
      canAccessSurface: allowAllSurfaces,
    });
    const managementTransition = workPresentation!.headerEntryPoints.find(
      (entry) => entry.entryKind === 'management-entry'
    );
    expect(managementTransition?.path).toBe('/dwaion/admin/agents');

    const managementPresentation = buildLegacyProductSurfacePresentation({
      manifest: candidate,
      pathname: '/dwaion/admin/agents',
      navigation: DWAION_NAVIGATION,
      canAccessItem,
      canAccessSurface: allowAllSurfaces,
    });
    expect(navigationPaths(managementPresentation!.navigation)).toEqual(['/dwaion/admin/agents']);
    expect(managementPresentation!.returnTarget).toEqual({
      path: '/dwaion/home',
      kind: 'work',
    });
  });

  it('returns a management-only actor to the catalog instead of an inaccessible Work surface', () => {
    const candidate = manifest('meetings');
    const presentation = buildLegacyProductSurfacePresentation({
      manifest: candidate,
      pathname: '/meetings/admin/operations',
      navigation: MEETINGS_NAVIGATION,
      canAccessItem: legacyAccess(
        (resourceKey, permissionCode) =>
          resourceKey === 'ADMIN.MEETINGS' && permissionCode === 'VIEW'
      ),
      canAccessSurface: (surface) => !surface.entryAccess.requiresProductEntitlement,
    });

    expect(navigationPaths(presentation!.navigation)).toEqual([
      '/meetings/admin/operations',
      '/meetings/admin/policies',
      '/meetings/admin/intelligence',
    ]);
    expect(
      presentation!.headerEntryPoints.filter((entry) => entry.entryKind === 'work-return')
    ).toEqual([]);
    expect(presentation!.accessibleEntryPoints.map((entry) => entry.surfaceId)).toEqual([
      'meetings.management',
    ]);
    expect(presentation!.returnTarget).toEqual({ path: '/apps', kind: 'catalog' });
  });

  it('fails closed for undeclared legacy menu paths before evaluating their access predicate', () => {
    const candidate = manifest('calendar');
    const injectedPath = '/calendar/undeclared-admin';
    const contaminatedNavigation: readonly ProductNavigationGroup[] = [
      ...CALENDAR_NAVIGATION,
      {
        id: 'injected',
        items: [
          {
            path: injectedPath,
            view: 'injected',
            icon: CALENDAR_NAVIGATION[0]!.items[0]!.icon,
          },
        ],
      },
    ];
    const presentation = buildLegacyProductSurfacePresentation({
      manifest: candidate,
      pathname: '/calendar/home',
      navigation: contaminatedNavigation,
      canAccessItem: (item) => {
        if (item.path === injectedPath) throw new Error('undeclared item must not be evaluated');
        return true;
      },
      canAccessSurface: allowAllSurfaces,
    });

    expect(
      [...presentation!.navigationBySurfaceId.values()].flatMap(navigationPaths)
    ).not.toContain(injectedPath);
  });

  it('fails closed when equally specific matchers claim a path', () => {
    const candidate = manifest('calendar');
    const [work, management] = candidate.surfaces;
    const ambiguousManifest = {
      ...candidate,
      surfaces: [
        {
          ...work,
          id: 'calendar.collision-work',
          routeMatchers: [{ kind: 'exact', path: '/calendar/collision' }],
        },
        {
          ...management,
          id: 'calendar.collision-management',
          routeMatchers: [{ kind: 'exact', path: '/calendar/collision' }],
        },
      ],
    } as ProductSurfaceManifest;

    expect(
      resolveLegacyPresentationSurface(ambiguousManifest, '/calendar/collision')
    ).toBeUndefined();
  });

  it('keeps an Approvals Work catch-all in its local Surface context', () => {
    const candidate = manifest('approvals');
    expect(resolveLegacyPresentationSurface(candidate, '/approvals/unknown')?.id).toBe(
      'approvals.work'
    );
    expect(
      buildLegacyProductSurfacePresentation({
        manifest: candidate,
        pathname: '/approvals/unknown',
        navigation: APPROVAL_NAVIGATION,
        canAccessItem: allowAll,
        canAccessSurface: allowAllSurfaces,
      })?.currentSurface.id
    ).toBe('approvals.work');
  });

  it('returns no presentation for a path outside the manifest', () => {
    const candidate = manifest('approvals');
    expect(resolveLegacyPresentationSurface(candidate, '/outside/approvals')).toBeUndefined();
  });
});
