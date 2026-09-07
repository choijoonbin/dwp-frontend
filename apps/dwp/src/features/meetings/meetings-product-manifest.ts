import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { MEETINGS_NAVIGATION } from './meetings-navigation';

export const MEETINGS_WORK_NAVIGATION = projectProductSurfaceNavigation(MEETINGS_NAVIGATION, {
  home: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  mine: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  history: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  join: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  templates: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  'follow-ups': {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
  preferences: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'meetings.work-access.v1' },
  },
});

export const MEETINGS_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(MEETINGS_NAVIGATION, {
  'admin-operations': {
    taskKind: 'operations',
    access: { type: 'capability', capabilityContractKey: 'meetings.operations.read' },
  },
  'admin-policies': {
    taskKind: 'administration',
    access: { type: 'capability', capabilityContractKey: 'meetings.policy.read' },
  },
  'admin-intelligence': {
    taskKind: 'administration',
    access: { type: 'capability', capabilityContractKey: 'meetings.policy.read' },
  },
});

export const MEETINGS_PRODUCT_MANIFEST = defineProductManifest({
  id: 'meetings',
  appKey: 'APP.MEETINGS',
  basePath: '/meetings',
  surfaces: [
    {
      id: 'meetings.work',
      plane: 'work',
      labelKey: 'navigation.groups.meetings.start',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/meetings' }],
      indexPath: '/meetings/home',
      navigation: MEETINGS_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'meetings.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'meetings.management',
      plane: 'management',
      labelKey: 'navigation.groups.meetings.admin',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/meetings/admin' }],
      indexPath: '/meetings/admin/operations',
      navigation: MEETINGS_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['meetings.operations.read', 'meetings.policy.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'meetings.work',
    },
  ],
});
