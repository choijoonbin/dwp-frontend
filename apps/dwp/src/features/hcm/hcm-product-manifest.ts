import { defineProductManifest } from '../../components/product-manifest';
import {
  HCM_MANAGEMENT_NAVIGATION,
  HCM_OPERATIONS_NAVIGATION,
  HCM_PERSONAL_NAVIGATION,
  HCM_TEAM_NAVIGATION,
} from './hcm-navigation';

/**
 * A004 migration blocker: legacy zero-APP administrators are still authorized by exact
 * DATA/ACTION contracts. APP.HCM becomes a mandatory parent only after those accounts receive an
 * explicit application grant; until then route and capability guards remain the authority.
 */
export const HCM_APP_ENTITLEMENT_CUTOVER = Object.freeze({
  blockerId: 'A004',
  state: 'DEFERRED_ZERO_APP_ADMIN_COMPATIBILITY',
  canonicalResourceKey: 'APP.HCM',
  compatibilityAlias: 'APP.HRIS',
  requiresProductEntitlement: false,
} as const);

export const HCM_PRODUCT_MANIFEST = defineProductManifest({
  id: 'hcm',
  appKey: 'APP.HCM',
  basePath: '/hr',
  surfaces: [
    {
      id: 'hcm.personal',
      plane: 'work',
      labelKey: 'navigation.groups.hcm.personal',
      taskKinds: ['work'],
      routeMatchers: [
        { kind: 'exact', path: '/hr/home' },
        { kind: 'exact', path: '/hr/me' },
        { kind: 'exact', path: '/hr/time' },
        { kind: 'exact', path: '/hr/absence' },
        { kind: 'exact', path: '/hr/benefits' },
        { kind: 'exact', path: '/hr/pay' },
        { kind: 'exact', path: '/hr/talent' },
        { kind: 'exact', path: '/hr/services' },
        { kind: 'exact', path: '/hr/directory' },
        { kind: 'exact', path: '/hr/organization' },
      ],
      indexPath: '/hr/home',
      navigation: HCM_PERSONAL_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'hcm.personal-access.v1',
        requiresProductEntitlement: HCM_APP_ENTITLEMENT_CUTOVER.requiresProductEntitlement,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'hcm.team',
      plane: 'work',
      labelKey: 'navigation.groups.hcm.team',
      taskKinds: ['team'],
      routeMatchers: [{ kind: 'prefix', path: '/hr/team' }],
      indexPath: '/hr/team',
      navigation: HCM_TEAM_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'hcm.team-access.v1',
        requiresProductEntitlement: HCM_APP_ENTITLEMENT_CUTOVER.requiresProductEntitlement,
      },
      supportedScopeKinds: ['TEAM', 'ORG_UNIT', 'TARGET_POPULATION'],
      shellProfile: 'product-work',
    },
    {
      id: 'hcm.operations',
      plane: 'management',
      labelKey: 'navigation.groups.hcm.operate',
      taskKinds: ['operations'],
      routeMatchers: [{ kind: 'prefix', path: '/hr/operations' }],
      indexPath: '/hr/operations',
      navigation: HCM_OPERATIONS_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'hcm.operations-access.v1',
        requiresProductEntitlement: HCM_APP_ENTITLEMENT_CUTOVER.requiresProductEntitlement,
      },
      supportedScopeKinds: ['ORG_UNIT', 'LEGAL_ENTITY', 'TARGET_POPULATION', 'SUPPORT_SESSION'],
      shellProfile: 'product-management',
      returnSurfaceId: 'hcm.personal',
    },
    {
      id: 'hcm.management',
      plane: 'management',
      labelKey: 'navigation.groups.hcm.foundation',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [
        { kind: 'prefix', path: '/hr/manage' },
        { kind: 'prefix', path: '/hr/design' },
        { kind: 'prefix', path: '/hr/data' },
      ],
      indexPath: '/hr/manage',
      navigation: HCM_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'hcm.management-system-access.v1',
        requiresProductEntitlement: HCM_APP_ENTITLEMENT_CUTOVER.requiresProductEntitlement,
      },
      supportedScopeKinds: ['TENANT', 'RESOURCE_SET', 'RESOURCE', 'LEGAL_ENTITY', 'POLICY_NODE'],
      shellProfile: 'product-management',
      returnSurfaceId: 'hcm.personal',
    },
  ],
});
