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
  legacyRedirects: [
    {
      id: 'spaces-management-overview-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/overview' },
      target: { kind: 'static', path: '/spaces/admin/overview' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-directory-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/directory' },
      target: { kind: 'static', path: '/spaces/admin/directory' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-requests-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/requests' },
      target: { kind: 'static', path: '/spaces/admin/requests' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-templates-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/templates' },
      target: { kind: 'static', path: '/spaces/admin/templates' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-content-reviews-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/content-reviews' },
      target: { kind: 'static', path: '/spaces/admin/content-reviews' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-lifecycle-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/lifecycle' },
      target: { kind: 'static', path: '/spaces/admin/lifecycle' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'spaces-management-operations-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/spaces/operations' },
      target: { kind: 'static', path: '/spaces/admin/operations' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});
