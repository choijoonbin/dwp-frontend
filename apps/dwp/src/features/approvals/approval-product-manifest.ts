import { defineProductManifest } from '../../components/product-manifest';

import { APPROVAL_MANAGEMENT_NAVIGATION, APPROVAL_WORK_NAVIGATION } from './approval-navigation';

export const APPROVAL_PRODUCT_MANIFEST = defineProductManifest({
  id: 'approvals',
  appKey: 'APP.APPROVALS',
  basePath: '/approvals',
  surfaces: [
    {
      id: 'approvals.work',
      plane: 'work',
      labelKey: 'surfaces.work',
      taskKinds: ['work'],
      routeMatchers: [
        { kind: 'exact', path: '/approvals/home' },
        { kind: 'exact', path: '/approvals/inbox' },
        { kind: 'exact', path: '/approvals/completed' },
        { kind: 'prefix', path: '/approvals/requests' },
        { kind: 'exact', path: '/approvals/delegations' },
        { kind: 'prefix', path: '/approvals' },
      ],
      indexPath: '/approvals/home',
      navigation: APPROVAL_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'approvals.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'approvals.admin',
      plane: 'management',
      labelKey: 'surfaces.management',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/approvals/admin' }],
      indexPath: '/approvals/admin',
      navigation: APPROVAL_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'approvals.operations.read',
          'approvals.design.read',
          'approvals.policy.read',
          'approvals.signature.read',
          'approvals.audit.operations.read',
          'approvals.oversight.overview.read',
          'approvals.oversight.design.read',
          'approvals.oversight.policy.read',
          'approvals.oversight.operations.read',
          'approvals.oversight.signature.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'approvals.work',
    },
  ],
});
