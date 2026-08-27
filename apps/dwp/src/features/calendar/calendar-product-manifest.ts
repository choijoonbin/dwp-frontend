import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { CALENDAR_NAVIGATION } from './calendar-navigation';

export const CALENDAR_WORK_NAVIGATION = projectProductSurfaceNavigation(CALENDAR_NAVIGATION, {
  home: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  schedule: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  focus: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  invitations: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  trash: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  availability: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
  insights: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'calendar.work-access.v1' },
  },
});

export const CALENDAR_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(CALENDAR_NAVIGATION, {
  'admin-overview': {
    taskKind: 'operations',
    access: { type: 'capability', capabilityContractKey: 'calendar.operations.read' },
  },
  'admin-company-calendars': {
    taskKind: 'operations',
    access: { type: 'capability', capabilityContractKey: 'calendar.operations.read' },
  },
  'admin-policies': {
    taskKind: 'administration',
    access: { type: 'capability', capabilityContractKey: 'calendar.policy.read' },
  },
});

export const CALENDAR_PRODUCT_MANIFEST = defineProductManifest({
  id: 'calendar',
  appKey: 'APP.CALENDAR',
  basePath: '/calendar',
  surfaces: [
    {
      id: 'calendar.work',
      plane: 'work',
      labelKey: 'navigation.groups.calendar.start',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/calendar' }],
      indexPath: '/calendar/home',
      navigation: CALENDAR_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'calendar.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'calendar.management',
      plane: 'management',
      labelKey: 'navigation.groups.calendar.admin',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/calendar/admin' }],
      indexPath: '/calendar/admin/overview',
      navigation: CALENDAR_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['calendar.operations.read', 'calendar.policy.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'calendar.work',
    },
  ],
});
