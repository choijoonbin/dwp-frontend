import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { NOTIFICATION_NAVIGATION } from './notification-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const NOTIFICATION_WORK_NAVIGATION = projectProductSurfaceNavigation(
  NOTIFICATION_NAVIGATION,
  {
    home: {
      taskKind: 'work',
      access: { type: 'policy', accessPolicyKey: 'notifications.work-access.v1' },
    },
    center: {
      taskKind: 'work',
      access: { type: 'policy', accessPolicyKey: 'notifications.work-access.v1' },
    },
    settings: {
      taskKind: 'work',
      access: { type: 'policy', accessPolicyKey: 'notifications.work-access.v1' },
    },
  }
);

export const NOTIFICATION_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(
  NOTIFICATION_NAVIGATION,
  {
    'admin-overview': {
      taskKind: 'operations',
      access: capability('notifications.operations.read'),
    },
    'admin-contracts': {
      taskKind: 'administration',
      access: capability('notifications.contract.read'),
    },
    'admin-policies': {
      taskKind: 'administration',
      access: capability('notifications.policy.read'),
    },
    'admin-templates': {
      taskKind: 'administration',
      access: capability('notifications.template.read'),
    },
    'admin-operations': {
      taskKind: 'operations',
      access: capability('notifications.operations.read'),
    },
    'admin-suppressions': {
      taskKind: 'operations',
      access: capability('notifications.operations.read'),
    },
  }
);

export const NOTIFICATION_PRODUCT_MANIFEST = defineProductManifest({
  id: 'notifications',
  appKey: 'APP.NOTIFICATIONS',
  basePath: '/notifications',
  surfaces: [
    {
      id: 'notifications.work',
      plane: 'work',
      labelKey: 'navigation.groups.notifications.overview',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/notifications' }],
      indexPath: '/notifications/home',
      navigation: NOTIFICATION_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'notifications.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'notifications.management',
      plane: 'management',
      labelKey: 'navigation.groups.notifications.administration',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/notifications/admin' }],
      indexPath: '/notifications/admin/overview',
      navigation: NOTIFICATION_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'notifications.operations.read',
          'notifications.contract.read',
          'notifications.policy.read',
          'notifications.template.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'notifications.work',
    },
  ],
});
