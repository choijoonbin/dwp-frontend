import { defineProductManifest } from '../../components/product-manifest';

import { SERVICES_MANAGEMENT_NAVIGATION, SERVICES_WORK_NAVIGATION } from './services-navigation';

export const SERVICES_PRODUCT_MANIFEST = defineProductManifest({
  id: 'services',
  appKey: 'APP.EMPLOYEE_SERVICES',
  basePath: '/services',
  surfaces: [
    {
      id: 'services.work',
      plane: 'work',
      labelKey: 'surfaces.work',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/services' }],
      indexPath: '/services/home',
      navigation: SERVICES_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'services.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'services.management',
      plane: 'management',
      labelKey: 'surfaces.management',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/services/admin' }],
      indexPath: '/services/admin',
      navigation: SERVICES_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: ['services.catalog.read', 'services.operations.read'],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'services.work',
    },
  ],
  legacyRedirects: [
    {
      id: 'services-management-catalog-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/services/service-catalog' },
      target: { kind: 'static', path: '/services/admin/catalog' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
    {
      id: 'services-management-operations-v1',
      sourceMatcher: { kind: 'exact', path: '/admin/services/service-operations' },
      target: { kind: 'static', path: '/services/admin/operations' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});
