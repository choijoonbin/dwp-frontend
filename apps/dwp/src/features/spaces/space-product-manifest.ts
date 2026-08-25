import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { SPACE_NAVIGATION } from './space-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const SPACE_WORK_NAVIGATION = projectProductSurfaceNavigation(SPACE_NAVIGATION, {
  home: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'spaces.work-access.v1' } },
  'my-spaces': {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'spaces.work-access.v1' },
  },
  discover: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'spaces.work-access.v1' },
  },
  requests: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'spaces.work-access.v1' },
  },
});

export const SPACE_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(SPACE_NAVIGATION, {
  'admin-overview': { taskKind: 'operations', access: capability('spaces.governance.read') },
  'admin-directory': { taskKind: 'operations', access: capability('spaces.governance.read') },
  'admin-requests': { taskKind: 'operations', access: capability('spaces.governance.read') },
  'admin-templates': { taskKind: 'administration', access: capability('spaces.templates.read') },
  'admin-content-reviews': {
    taskKind: 'operations',
    access: capability('spaces.compliance.read'),
  },
  'admin-lifecycle': { taskKind: 'operations', access: capability('spaces.access-review.read') },
  'admin-operations': { taskKind: 'operations', access: capability('spaces.governance.read') },
});

export const SPACE_PRODUCT_MANIFEST = defineProductManifest({
  id: 'spaces',
  appKey: 'APP.SPACES',
  basePath: '/spaces',
  surfaces: [
    {
      id: 'spaces.work',
      plane: 'work',
      labelKey: 'navigation.groups.spaces.overview',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/spaces' }],
      indexPath: '/spaces/home',
      navigation: SPACE_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'spaces.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'spaces.management',
      plane: 'management',
      labelKey: 'navigation.groups.spaces.administration',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/spaces/admin' }],
      indexPath: '/spaces/admin/overview',
      navigation: SPACE_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'spaces.governance.read',
          'spaces.templates.read',
          'spaces.compliance.read',
          'spaces.access-review.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'spaces.work',
    },
  ],
});
