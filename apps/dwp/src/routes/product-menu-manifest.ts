import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { APPROVAL_NAVIGATION } from '../features/approvals/approval-navigation';
import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { HCM_NAVIGATION } from '../features/hcm/hcm-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';

export type ProductShell =
  | 'workspace'
  | 'calendar'
  | 'approvals'
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
  { id: 'workspace.home', path: '/', shell: 'workspace' },
  { id: 'workspace.work', path: '/work', shell: 'workspace' },
  { id: 'workspace.ask', path: '/ask', shell: 'workspace' },
  { id: 'workspace.activity', path: '/activity', shell: 'workspace' },
  { id: 'workspace.apps', path: '/apps', shell: 'workspace' },
  ...CALENDAR_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `calendar.${item.view}`,
      path: item.path,
      shell: 'calendar' as const,
    }))
  ),
  ...APPROVAL_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `approvals.${item.view}`,
      path: item.path,
      shell: 'approvals' as const,
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
