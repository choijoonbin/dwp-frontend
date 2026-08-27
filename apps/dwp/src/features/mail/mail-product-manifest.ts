import { defineProductManifest } from '../../components/product-manifest';
import { projectProductSurfaceNavigation } from '../../components/product-surface-navigation-projection';
import { MAIL_NAVIGATION } from './mail-navigation';

const capability = (capabilityContractKey: string) => ({
  type: 'capability' as const,
  capabilityContractKey,
});

export const MAIL_WORK_NAVIGATION = projectProductSurfaceNavigation(MAIL_NAVIGATION, {
  home: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  inbox: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  sent: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  drafts: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  archive: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  spam: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  trash: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  folders: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  shared: { taskKind: 'work', access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' } },
  organization: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' },
  },
  accounts: {
    taskKind: 'work',
    access: { type: 'policy', accessPolicyKey: 'mail.work-access.v1' },
  },
});

export const MAIL_MANAGEMENT_NAVIGATION = projectProductSurfaceNavigation(MAIL_NAVIGATION, {
  'admin-overview': { taskKind: 'operations', access: capability('mail.operations.read') },
  'admin-connections': { taskKind: 'administration', access: capability('mail.connections.read') },
  'admin-shared-inboxes': {
    taskKind: 'administration',
    access: capability('mail.shared-inboxes.read'),
  },
  'admin-policies': { taskKind: 'administration', access: capability('mail.policy.read') },
});

export const MAIL_PRODUCT_MANIFEST = defineProductManifest({
  id: 'mail',
  appKey: 'APP.MAIL',
  basePath: '/mail',
  surfaces: [
    {
      id: 'mail.work',
      plane: 'work',
      labelKey: 'navigation.groups.mail.start',
      taskKinds: ['work'],
      routeMatchers: [{ kind: 'prefix', path: '/mail' }],
      indexPath: '/mail/home',
      navigation: MAIL_WORK_NAVIGATION,
      entryAccess: {
        type: 'policy',
        accessPolicyKey: 'mail.work-access.v1',
        requiresProductEntitlement: true,
      },
      supportedScopeKinds: ['SELF'],
      shellProfile: 'product-work',
    },
    {
      id: 'mail.management',
      plane: 'management',
      labelKey: 'navigation.groups.mail.admin',
      taskKinds: ['operations', 'administration'],
      routeMatchers: [{ kind: 'prefix', path: '/mail/admin' }],
      indexPath: '/mail/admin/overview',
      navigation: MAIL_MANAGEMENT_NAVIGATION,
      entryAccess: {
        type: 'capability',
        entryCapabilityMode: 'ANY',
        requiredCapabilityContractKeys: [
          'mail.operations.read',
          'mail.connections.read',
          'mail.shared-inboxes.read',
          'mail.policy.read',
        ],
        requiresProductEntitlement: false,
      },
      supportedScopeKinds: ['RESOURCE_SET'],
      shellProfile: 'product-management',
      returnSurfaceId: 'mail.work',
    },
  ],
});
