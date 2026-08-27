import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { DWAION_NAVIGATION } from './dwaion-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const DWAION_WORK_NAVIGATION = projectProductSurfaceNavigation(DWAION_NAVIGATION, {
  home: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' } },
  new: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' } },
  activity: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' },
  },
  proposals: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' },
  },
  conversations: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' },
  },
  agents: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'dwaion.work-access.v1' },
  },
  actions: {
    taskKind: 'work',
    access: {
      type: 'capability-expression',
      mode: 'ANY',
      capabilityContractKeys: [
        'dwaion.action.calendar.create',
        'dwaion.action.mail.create',
        'dwaion.action.service.read',
        'dwaion.action.approval.create',
      ],
    },
  },
});

export const DWAION_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(DWAION_NAVIGATION, {
  'admin-overview': { taskKind: 'operations', access: capability('dwaion.operations.read') },
  'admin-agents': { taskKind: 'administration', access: capability('dwaion.agents.read') },
  'admin-sources': { taskKind: 'administration', access: capability('dwaion.sources.read') },
  'admin-actions': { taskKind: 'administration', access: capability('dwaion.actions.read') },
  'admin-safety': { taskKind: 'administration', access: capability('dwaion.safety.read') },
  'admin-evaluation': { taskKind: 'operations', access: capability('dwaion.evaluation.read') },
  'admin-gates': { taskKind: 'administration', access: capability('dwaion.gates.read') },
  'admin-audit': {
    taskKind: 'administration',
    access: {
      type: 'capability-expression',
      mode: 'ANY',
      capabilityContractKeys: ['dwaion.retention.read', 'dwaion.audit.read'],
    },
  },
});

export const DWAION_SURFACE_MANIFEST = defineProductManifest({
  id: 'dwaion',
  appKey: 'APP.ASK',
  basePath: '/dwaion',
  surfaces: [
    {
      id: 'dwaion.work',
      plane: 'work',
      labelKey: 'navigation.groups.dwaion.start',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/dwaion' }],
      indexPath: '/dwaion/home',
      navigation: DWAION_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'dwaion.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'dwaion.management',
      plane: 'management',
      labelKey: 'navigation.groups.dwaion.admin',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/dwaion/admin' }],
      indexPath: '/dwaion/admin/overview',
      navigation: DWAION_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'dwaion.operations.read',
          'dwaion.agents.read',
          'dwaion.sources.read',
          'dwaion.actions.read',
          'dwaion.safety.read',
          'dwaion.evaluation.read',
          'dwaion.gates.read',
          'dwaion.retention.read',
          'dwaion.audit.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'dwaion.work',
    },
  ],
  legacyRedirects: [
    {
      id: 'dwaion-ask-v1',
      sourceMatcher: { kind: 'prefix', path: '/ask' },
      target: { kind: 'static', path: '/dwaion/home' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'product-not-found',
    },
    {
      id: 'dwaion-retention-v1',
      sourceMatcher: { kind: 'exact', path: '/dwaion/admin/retention' },
      target: { kind: 'static', path: '/dwaion/admin/audit' },
      preserveQuery: true,
      preserveHash: true,
      maxHops: 1,
      unknownTarget: 'surface-not-found',
    },
  ],
});
