import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ACTIVITY_NAVIGATION } from '../features/activity/activity-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { COMMUNICATIONS_NAVIGATION } from '../features/communications/communications-navigation';
import { DWAION_NAVIGATION } from '../features/dwaion/dwaion-navigation';
import { HCM_NAVIGATION } from '../features/hcm/hcm-navigation';
import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { NOTIFICATION_NAVIGATION } from '../features/notifications/notification-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';
import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { SERVICES_NAVIGATION } from '../features/services/services-navigation';
import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { WORK_NAVIGATION } from '../features/work/work-navigation';

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
  | 'messaging'
  | 'notifications'
  | 'approvals'
  | 'spaces'
  | 'hcm'
  | 'admin'
  | 'provider'
  | 'account';

export type ProductMenuRoute = {
  id: string;
  path: string;
  shell: ProductShell;
};

export const PRODUCT_MENU_ROUTES: readonly ProductMenuRoute[] = [
  { id: 'home.personal', path: '/', shell: 'home' },
  { id: 'catalog.apps', path: '/apps', shell: 'catalog' },
  ...WORK_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `work.${item.view}`,
      path: item.path,
      shell: 'work' as const,
    }))
  ),
  ...ACTIVITY_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `activity.${item.view}`,
      path: item.path,
      shell: 'activity' as const,
    }))
  ),
  ...DWAION_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `dwaion.${item.view}`,
      path: item.path,
      shell: 'dwaion' as const,
    }))
  ),
  ...COMMUNICATIONS_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `communications.${item.view}`,
      path: item.path,
      shell: 'communications' as const,
    }))
  ),
  ...SERVICES_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `services.${item.view}`,
      path: item.path,
      shell: 'services' as const,
    }))
  ),
  ...NOTIFICATION_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `notifications.${item.view}`,
      path: item.path,
      shell: 'notifications' as const,
    }))
  ),
  ...CALENDAR_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `calendar.${item.view}`,
      path: item.path,
      shell: 'calendar' as const,
    }))
  ),
  ...ROOMS_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `rooms.${item.view}`,
      path: item.path,
      shell: 'rooms' as const,
    }))
  ),
  ...MAIL_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `mail.${item.view}`,
      path: item.path,
      shell: 'mail' as const,
    }))
  ),
  ...MESSAGING_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `messaging.${item.view}`,
      path: item.path,
      shell: 'messaging' as const,
    }))
  ),
  ...APPROVAL_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `approvals.${item.view}`,
      path: item.path,
      shell: 'approvals' as const,
    }))
  ),
  ...SPACE_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `spaces.${item.view}`,
      path: item.path,
      shell: 'spaces' as const,
    }))
  ),
  ...HCM_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `hcm.${item.view}`,
      path: item.path,
      shell: 'hcm' as const,
    }))
  ),
  ...ADMIN_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `admin.${item.view}`,
      path: item.path,
      shell: 'admin' as const,
    }))
  ),
  ...PROVIDER_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `provider.${item.key}`,
      path: item.path,
      shell: 'provider' as const,
    }))
  ),
  ...accountNavigationGroups.flatMap((group) =>
    group.items.map((item) => ({
      id: `account.${item.key}`,
      path: item.path,
      shell: 'account' as const,
    }))
  ),
];
