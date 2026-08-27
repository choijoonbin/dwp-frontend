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

import type {
  GovernedMenuPlane,
  ProductSurfaceManifest,
  ProductTaskKind,
} from '../components/product-manifest';

export type ProductShell =
  | 'home'
  | 'catalog'
  | 'work'
  | 'activity'
  | 'dwaion'
  | 'communications'
  | 'services'
  | 'calendar'
  | 'rooms'
  | 'mail'
  | 'meetings'
  | 'messaging'
  | 'notifications'
  | 'approvals'
  | 'spaces'
  | 'hcm'
  | 'admin'
  | 'provider'
  | 'account';

export type ProductMigrationWave = 'W0' | 'W0.5' | 'W1a' | 'W1b' | 'W2' | 'W3' | 'Keep';

export type ProductMenuRoute = {
  id: string;
  path: `/${string}`;
  shell: ProductShell;
  plane: GovernedMenuPlane;
  taskKind: ProductTaskKind;
  navigationContextId: string;
  productSurfaceId?: string;
  migrationWave: ProductMigrationWave;
};

type NavigationSource = readonly {
  items: readonly { view: string; path: string }[];
}[];

const PRODUCT_WAVES: Readonly<Record<string, ProductMigrationWave>> = {
  approvals: 'W1a',
  calendar: 'W3',
  communications: 'W0.5',
  dwaion: 'W2',
  hcm: 'W1b',
  mail: 'W3',
  meetings: 'W3',
  messaging: 'W3',
  notifications: 'W2',
  services: 'W0.5',
  spaces: 'W2',
  workplace: 'W3',
};

function productManifest(productId: string): ProductSurfaceManifest {
  const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
  if (!manifest) throw new Error(`Menu ledger references an unknown product: ${productId}`);
  return manifest;
}

function productMenuRoutes(
  shell: ProductShell,
  productId: string,
  source: NavigationSource
): ProductMenuRoute[] {
  const manifest = productManifest(productId);
  return source.flatMap((group) =>
    group.items.map((item) => {
      const matches = manifest.surfaces.flatMap((surface) =>
        surface.navigation.flatMap((surfaceGroup) =>
          surfaceGroup.items
            .filter((candidate) => candidate.path === item.path)
            .map((candidate) => ({ surface, item: candidate }))
        )
      );
      if (matches.length !== 1) {
        throw new Error(
          `Menu ledger must resolve exactly one product surface: ${productId}/${item.path}`
        );
      }
      const match = matches[0]!;
      return {
        id: `${shell}.${item.view}`,
        path: item.path as `/${string}`,
        shell,
        plane: match.surface.plane,
        taskKind: match.item.taskKind,
        navigationContextId: match.surface.id,
        productSurfaceId: match.surface.id,
        migrationWave: PRODUCT_WAVES[productId]!,
      };
    })
  );
}

function fixedRoute(
  id: string,
  path: string,
  shell: ProductShell,
  plane: GovernedMenuPlane,
  taskKind: ProductTaskKind,
  navigationContextId: string
): ProductMenuRoute {
  return {
    id,
    path: path as `/${string}`,
    shell,
    plane,
    taskKind,
    navigationContextId,
    migrationWave: 'Keep',
  };
}

const ADMIN_OPERATION_VIEWS = new Set([
  'preference-exceptions',
  'app-access-requests',
  'access-reviews',
  'saved-view-custody',
  'api-monitoring',
  'audit-overview',
  'audit-investigations',
  'audit-events',
]);

const PROVIDER_OPERATION_VIEWS = new Set([
  'overview',
  'operations',
  'health',
  'featureRollouts',
  'support',
  'audit',
]);

export const PRODUCT_MENU_ROUTES: readonly ProductMenuRoute[] = [
  fixedRoute('home.personal', '/', 'home', 'work', 'work', 'home'),
  fixedRoute('catalog.apps', '/apps', 'catalog', 'work', 'work', 'catalog'),
  ...WORK_NAVIGATION.flatMap((group) =>
    group.items.map((item) =>
      fixedRoute(`work.${item.view}`, item.path, 'work', 'work', 'work', 'work.work')
    )
  ),
  ...ACTIVITY_NAVIGATION.flatMap((group) =>
    group.items.map((item) =>
      fixedRoute(`activity.${item.view}`, item.path, 'activity', 'work', 'work', 'activity.work')
    )
  ),
  ...productMenuRoutes('dwaion', 'dwaion', DWAION_NAVIGATION),
  ...productMenuRoutes('communications', 'communications', COMMUNICATIONS_NAVIGATION),
  ...productMenuRoutes('services', 'services', SERVICES_NAVIGATION),
  ...productMenuRoutes('notifications', 'notifications', NOTIFICATION_NAVIGATION),
  ...productMenuRoutes('calendar', 'calendar', CALENDAR_NAVIGATION),
  ...productMenuRoutes('rooms', 'workplace', ROOMS_NAVIGATION),
  ...productMenuRoutes('mail', 'mail', MAIL_NAVIGATION),
  ...productMenuRoutes('meetings', 'meetings', MEETINGS_NAVIGATION),
  ...productMenuRoutes('messaging', 'messaging', MESSAGING_NAVIGATION),
  ...productMenuRoutes('approvals', 'approvals', APPROVAL_NAVIGATION),
  ...productMenuRoutes('spaces', 'spaces', SPACE_NAVIGATION),
  ...productMenuRoutes('hcm', 'hcm', HCM_NAVIGATION),
  ...ADMIN_NAVIGATION.flatMap((group) =>
    group.items.map((item) =>
      fixedRoute(
        `admin.${item.view}`,
        item.path,
        'admin',
        'tenant-governance',
        ADMIN_OPERATION_VIEWS.has(item.view) ? 'operations' : 'administration',
        'tenant.admin'
      )
    )
  ),
  ...PROVIDER_NAVIGATION.flatMap((group) =>
    group.items.map((item) =>
      fixedRoute(
        `provider.${item.key}`,
        item.path,
        'provider',
        'provider-control',
        PROVIDER_OPERATION_VIEWS.has(item.key) ? 'operations' : 'administration',
        'provider.control'
      )
    )
  ),
  ...accountNavigationGroups.flatMap((group) =>
    group.items.map((item) =>
      fixedRoute(`account.${item.key}`, item.path, 'account', 'account', 'work', 'account.settings')
    )
  ),
];
