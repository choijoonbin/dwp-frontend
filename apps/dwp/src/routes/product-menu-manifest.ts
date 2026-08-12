import { accountNavigationGroups } from '../features/account/settings-navigation';
import { ADMIN_NAVIGATION } from '../features/admin/admin-navigation';
import { PEOPLE_NAVIGATION } from '../features/people/people-navigation';
import { PROVIDER_NAVIGATION } from '../features/provider/provider-navigation';
import { WORKFORCE_NAVIGATION } from '../features/workforce/workforce-navigation';

export type ProductShell = 'workspace' | 'people' | 'workforce' | 'admin' | 'provider' | 'account';

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
  ...PEOPLE_NAVIGATION.map((item) => ({
    id: `people.${item.view}`,
    path: item.path,
    shell: 'people' as const,
  })),
  ...WORKFORCE_NAVIGATION.flatMap((group) =>
    group.items.map((item) => ({
      id: `workforce.${item.view}`,
      path: item.path,
      shell: 'workforce' as const,
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
