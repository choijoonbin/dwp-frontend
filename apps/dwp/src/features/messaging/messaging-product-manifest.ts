import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { MESSAGING_NAVIGATION } from './messaging-navigation';

export const MESSAGING_WORK_NAVIGATION = projectProductSurfaceNavigation(MESSAGING_NAVIGATION, {
  home: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
  inbox: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
  spaces: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
  direct: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
  people: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
  later: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'messaging.work-access.v1' },
  },
});

export const MESSAGING_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(
  MESSAGING_NAVIGATION,
  {
    'admin-overview': {
      taskKind: 'operations',
      access: { type: 'capability', capabilityContractKey: 'messaging.operations.read' },
    },
    'admin-policy': {
      taskKind: 'administration',
      access: { type: 'capability', capabilityContractKey: 'messaging.policy.read' },
    },
  }
);

export const MESSAGING_PRODUCT_MANIFEST = defineProductManifest({
  id: 'messaging',
  appKey: 'APP.MESSAGING',
  basePath: '/messages',
  surfaces: [
    {
      id: 'messaging.work',
      plane: 'work',
      labelKey: 'navigation.groups.messaging.start',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/messages' }],
      indexPath: '/messages/home',
      navigation: MESSAGING_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'messaging.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'messaging.management',
      plane: 'management',
      labelKey: 'navigation.groups.messaging.admin',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/messages/admin' }],
      indexPath: '/messages/admin/overview',
      navigation: MESSAGING_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['messaging.operations.read', 'messaging.policy.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'messaging.work',
    },
  ],
});
