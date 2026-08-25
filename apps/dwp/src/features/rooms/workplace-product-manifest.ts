import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { ROOMS_NAVIGATION } from './rooms-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const WORKPLACE_WORK_NAVIGATION = projectProductSurfaceNavigation(ROOMS_NAVIGATION, {
  home: { taskKind: 'work', access: capability('workplace.space.read') },
  explore: { taskKind: 'work', access: capability('workplace.space.read') },
  'find-rooms': { taskKind: 'work', access: capability('workplace.room.read') },
  'my-bookings': { taskKind: 'work', access: capability('workplace.space.read') },
  'my-meetings': { taskKind: 'work', access: capability('workplace.room.read') },
});

export const WORKPLACE_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(ROOMS_NAVIGATION, {
  'admin-overview': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-operations': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-governance': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-locations': {
    taskKind: 'administration',
    access: capability('workplace.locations.read'),
  },
  'admin-policy': { taskKind: 'administration', access: capability('workplace.policy.read') },
  'admin-room-operations': {
    taskKind: 'operations',
    access: capability('workplace.room-operations.read'),
  },
  'admin-room-policy': {
    taskKind: 'administration',
    access: capability('workplace.room-policy.read'),
  },
});

export const WORKPLACE_PRODUCT_MANIFEST = defineProductManifest({
  id: 'workplace',
  appKey: 'APP.WORKPLACE',
  basePath: '/workplace',
  surfaces: [
    {
      id: 'workplace.work',
      plane: 'work',
      labelKey: 'navigation.groups.rooms.booking',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/workplace' }],
      indexPath: '/workplace/home',
      navigation: WORKPLACE_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'workplace.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'workplace.management',
      plane: 'management',
      labelKey: 'navigation.groups.rooms.workplaceAdministration',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/workplace/admin' }],
      indexPath: '/workplace/admin/overview',
      navigation: WORKPLACE_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'workplace.operations.read',
          'workplace.governance.read',
          'workplace.locations.read',
          'workplace.policy.read',
          'workplace.room-operations.read',
          'workplace.room-policy.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET', 'RESOURCE'],
      shellProfile: 'product-management',
      returnSurfaceId: 'workplace.work',
    },
  ],
  legacyRedirects: [
    {
      id: 'workplace-rooms-v1',
      sourceMatcher: { kind: 'prefix', path: '/rooms' },
      target: {
        kind: 'registered-suffix',
        sourceBase: '/rooms',
        targetBase: '/workplace',
        registeredRouteCatalogId: 'workplace-pages.v1',
      },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});
