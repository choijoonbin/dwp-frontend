import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { ROOMS_NAVIGATION } from './rooms-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

const workAccess = () => ({
  type: 'policy' as const,
  accessPolicyKey: 'workplace.work-access.v1',
});

export const WORKPLACE_WORK_NAVIGATION = projectProductSurfaceNavigation(ROOMS_NAVIGATION, {
  home: { taskKind: 'work', access: workAccess() },
  find: { taskKind: 'work', access: workAccess() },
  wayfinding: { taskKind: 'work', access: workAccess() },
  planner: { taskKind: 'work', access: workAccess() },
  assistant: { taskKind: 'work', access: workAccess() },
  reservations: { taskKind: 'work', access: workAccess() },
  'service-orders': { taskKind: 'work', access: workAccess() },
  safety: { taskKind: 'work', access: workAccess() },
});

export const WORKPLACE_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(ROOMS_NAVIGATION, {
  'admin-overview': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-safety': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-operations': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-exceptions': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-devices': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-space-planning': {
    taskKind: 'administration',
    access: capability('workplace.policy.read'),
  },
  'admin-assistant-governance': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-governance': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-locations': {
    taskKind: 'administration',
    access: capability('workplace.locations.read'),
  },
  'admin-policy': { taskKind: 'administration', access: capability('workplace.policy.read') },
  'admin-service-fulfillment': {
    taskKind: 'operations',
    access: capability('workplace.service-operations.read'),
  },
  'admin-service-catalog': {
    taskKind: 'administration',
    access: capability('workplace.service-operations.read'),
  },
  'admin-service-providers': {
    taskKind: 'administration',
    access: capability('workplace.service-operations.read'),
  },
  'admin-visits': { taskKind: 'operations', access: capability('workplace.operations.read') },
  'admin-visit-policies': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-access-zones': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-visit-providers': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
  'admin-kiosk-devices': {
    taskKind: 'administration',
    access: capability('workplace.governance.read'),
  },
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
          'workplace.service-operations.read',
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
