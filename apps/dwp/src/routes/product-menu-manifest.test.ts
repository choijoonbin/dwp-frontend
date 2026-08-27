import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ACTIVITY_NAVIGATION } from '../features/activity/activity-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { DWAION_NAVIGATION } from '../features/dwaion/dwaion-navigation';
import { HCM_NAVIGATION } from '../features/hcm/hcm-navigation';
import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { MEETINGS_NAVIGATION } from '../features/meetings/meetings-navigation';
import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { NOTIFICATION_NAVIGATION } from '../features/notifications/notification-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';
import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { WORK_NAVIGATION } from '../features/work/work-navigation';

import { PRODUCT_MENU_ROUTES } from './product-menu-manifest';

import adminEn from '../../../../libs/shared-i18n/src/locales/en/admin.json';
import adminKo from '../../../../libs/shared-i18n/src/locales/ko/admin.json';

function navigationItemCount(groups: readonly { items: readonly unknown[] }[]) {
  return groups.reduce((count, group) => count + group.items.length, 0);
}

const EXPECTED_SHELL_COUNTS = {
  home: 1,
  catalog: 1,
  work: navigationItemCount(WORK_NAVIGATION),
  activity: navigationItemCount(ACTIVITY_NAVIGATION),
  dwaion: navigationItemCount(DWAION_NAVIGATION),
  communications: navigationItemCount(COMMUNICATIONS_NAVIGATION),
  services: navigationItemCount(SERVICES_NAVIGATION),
  calendar: navigationItemCount(CALENDAR_NAVIGATION),
  rooms: navigationItemCount(ROOMS_NAVIGATION),
  mail: navigationItemCount(MAIL_NAVIGATION),
  meetings: navigationItemCount(MEETINGS_NAVIGATION),
  messaging: navigationItemCount(MESSAGING_NAVIGATION),
  notifications: navigationItemCount(NOTIFICATION_NAVIGATION),
  approvals: navigationItemCount(APPROVAL_NAVIGATION),
  spaces: navigationItemCount(SPACE_NAVIGATION),
  hcm: navigationItemCount(HCM_NAVIGATION),
  admin: navigationItemCount(ADMIN_NAVIGATION),
  provider: navigationItemCount(PROVIDER_NAVIGATION),
  account: navigationItemCount(accountNavigationGroups),
};

const expectedRouteCount = Object.values(EXPECTED_SHELL_COUNTS).reduce(
  (total, count) => total + count,
  0
);

describe('product menu manifest', () => {
  it('keeps every supported menu route unique and under visual governance', () => {
    expect(PRODUCT_MENU_ROUTES).toHaveLength(186);
    expect(PRODUCT_MENU_ROUTES).toHaveLength(expectedRouteCount);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.id)).size).toBe(expectedRouteCount);
    expect(new Set(PRODUCT_MENU_ROUTES.map((route) => route.path)).size).toBe(expectedRouteCount);
  });

  it('derives the governed route count from each product navigation source', () => {
    const counts = PRODUCT_MENU_ROUTES.reduce<Record<string, number>>((result, route) => {
      result[route.shell] = (result[route.shell] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual(EXPECTED_SHELL_COUNTS);
  });

  it('freezes the ADR plane, task, product-surface, and migration-wave totals', () => {
    const countBy = (key: 'plane' | 'taskKind' | 'migrationWave') =>
      PRODUCT_MENU_ROUTES.reduce<Record<string, number>>((result, route) => {
        result[route[key]] = (result[route[key]] ?? 0) + 1;
        return result;
      }, {});

    expect(countBy('plane')).toEqual({
      work: 84,
      management: 60,
      'tenant-governance': 24,
      'provider-control': 10,
      account: 8,
    });
    expect(countBy('taskKind')).toEqual({
      work: 89,
      team: 3,
      operations: 47,
      administration: 47,
    });
    expect(countBy('migrationWave')).toEqual({
      Keep: 48,
      'W0.5': 12,
      W1a: 15,
      W1b: 25,
      W2: 35,
      W3: 51,
    });
  });

  it('binds each of the 138 business-app menus to exactly one matching surface item', () => {
    const productRoutes = PRODUCT_MENU_ROUTES.filter((route) => route.productSurfaceId);
    expect(productRoutes).toHaveLength(138);
    expect(
      productRoutes.every((route) => route.navigationContextId === route.productSurfaceId)
    ).toBe(true);

    for (const route of productRoutes) {
      const matches = GOVERNED_PRODUCT_MANIFESTS.flatMap((manifest) =>
        manifest.surfaces.flatMap((surface) =>
          surface.navigation.flatMap((group) =>
            group.items
              .filter((item) => item.path === route.path)
              .map((item) => ({ surface, item }))
          )
        )
      );
      expect(matches, route.id).toHaveLength(1);
      expect(matches[0]!.surface.id).toBe(route.productSurfaceId);
      expect(matches[0]!.surface.plane).toBe(route.plane);
      expect(matches[0]!.item.taskKind).toBe(route.taskKind);
    }
  });

  it('has zero Work-to-Management sidebar mixing in all 12 governed manifests', () => {
    expect(GOVERNED_PRODUCT_MANIFESTS).toHaveLength(12);
    for (const manifest of GOVERNED_PRODUCT_MANIFESTS) {
      const workPaths = new Set(
        manifest.surfaces
          .filter((surface) => surface.plane === 'work')
          .flatMap((surface) =>
            surface.navigation.flatMap((group) => group.items.map((item) => item.path))
          )
      );
      const managementPaths = manifest.surfaces
        .filter((surface) => surface.plane === 'management')
        .flatMap((surface) =>
          surface.navigation.flatMap((group) => group.items.map((item) => item.path))
        );
      expect(
        managementPaths.some((path) => workPaths.has(path)),
        manifest.id
      ).toBe(false);
    }
  });

  it('keeps the executable golden ledger synchronized with the frozen ADR document totals', () => {
    const document = fs.readFileSync(
      new URL(
        '../../../../docs/03-architecture/R1 제품 Surface 전체 메뉴 분류표.md',
        import.meta.url
      ),
      'utf8'
    );
    expect(document).toContain('정적 Menu Route **186개 전부**');
    expect(document).toContain('12개 업무 앱 138개');
    expect(document).toContain('| `W2`     |             35 | DWAI·ON, Notifications, Spaces');
    expect(document).toContain(
      '| `W3`     |             51 | Calendar, Workplace/Rooms, Mail, Messaging, Meetings'
    );
    expect(document).toContain('| **합계** |        **186** |');
  });

  it('locks every governed menu identity, path, plane, task, surface, and wave to the ADR checksum', () => {
    const canonicalLedger = PRODUCT_MENU_ROUTES.map(
      ({
        id,
        path,
        shell,
        plane,
        taskKind,
        productSurfaceId,
        navigationContextId,
        migrationWave,
      }) => ({
        id,
        path,
        shell,
        plane,
        taskKind,
        productSurfaceId,
        navigationContextId,
        migrationWave,
      })
    ).sort((left, right) => left.id.localeCompare(right.id));
    const checksum = createHash('sha256').update(JSON.stringify(canonicalLedger)).digest('hex');
    expect(checksum).toBe('0d9c3ae9e412c4358a5a513cf68663f361cbf3d75381d4d896045af8bed8b257');
    const document = fs.readFileSync(
      new URL(
        '../../../../docs/03-architecture/R1 제품 Surface 전체 메뉴 분류표.md',
        import.meta.url
      ),
      'utf8'
    );
    expect(document).toContain(`Ledger SHA-256: \`${checksum}\``);
  });

  it('requires symmetric label, purpose, and description copy for every admin menu', () => {
    const englishItems = adminEn.navigation.items;
    const koreanItems = adminKo.navigation.items;

    for (const item of ADMIN_NAVIGATION.flatMap((group) => group.items)) {
      const english = englishItems[item.view];
      const korean = koreanItems[item.view];
      expect(english, `missing English copy for ${item.view}`).toBeDefined();
      expect(korean, `missing Korean copy for ${item.view}`).toBeDefined();
      expect(english.label.trim()).not.toBe('');
      expect(english.title.trim()).not.toBe('');
      expect(english.description.trim()).not.toBe('');
      expect(korean.label.trim()).not.toBe('');
      expect(korean.title.trim()).not.toBe('');
      expect(korean.description.trim()).not.toBe('');
    }
  });
});
