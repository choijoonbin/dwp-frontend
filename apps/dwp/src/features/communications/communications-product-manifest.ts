import { defineProductManifest } from '../../components/product-manifest';

import {
  COMMUNICATIONS_MANAGEMENT_NAVIGATION,
  COMMUNICATIONS_WORK_NAVIGATION,
} from './communications-navigation';

export const COMMUNICATIONS_PRODUCT_MANIFEST = defineProductManifest({
  id: 'communications',
  appKey: 'APP.COMMUNICATIONS',
  basePath: '/communications',
  surfaces: [
    {
      id: 'communications.work',
      plane: 'work',
      labelKey: 'surfaces.work',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/communications' }],
      indexPath: '/communications/home',
      navigation: COMMUNICATIONS_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'communications.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'communications.management',
      plane: 'management',
      labelKey: 'surfaces.management',
      taskKinds: ['operations'],
      routeMatchers: [{ kind: 'prefix', path: '/communications/admin' }],
      indexPath: '/communications/admin/content',
      navigation: COMMUNICATIONS_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'communications.management-entry.v1',
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'communications.work',
    },
  ],
  legacyRedirects: [
    {
      id: 'communications-management-announcements-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/experience/announcements' },
      target: { kind: 'static', path: '/communications/admin/content' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});
