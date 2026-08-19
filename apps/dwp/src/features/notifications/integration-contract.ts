import {
  NOTIFICATION_API_CAPABILITIES,
  NOTIFICATION_LIVE_EVENT,
  NOTIFICATION_SYNC_RESET_EVENT,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const NOTIFICATION_I18N_NAMESPACE = 'notifications';

export const notificationQueryKeys = {
  root: ['notifications'] as const,
  summary: () => ['notifications', 'summary'] as const,
  inboxRoot: () => ['notifications', 'inbox'] as const,
  inbox: (scope: Record<string, unknown>) => ['notifications', 'inbox', scope] as const,
  detail: (notificationId: string | null) => ['notifications', 'detail', notificationId] as const,
  preferences: () => ['notifications', 'preferences'] as const,
  effectiveSettings: () => ['notifications', 'effective-settings'] as const,
  adminOverview: () => ['notifications', 'admin', 'overview'] as const,
  adminTypes: (scope: Record<string, unknown>) =>
    ['notifications', 'admin', 'types', scope] as const,
  adminOperations: () => ['notifications', 'admin', 'operations'] as const,
};

/**
 * Host applications consume this object when registering routes, navigation and the
 * approved SSE transport. Keeping those integrations declarative lets the feature stay
 * independent from the current shell implementation.
 */
export const notificationFeatureIntegration = {
  productKey: 'notification',
  productAreaKey: 'notifications',
  namespace: NOTIFICATION_I18N_NAMESPACE,
  liveEventName: NOTIFICATION_LIVE_EVENT,
  syncResetEventName: NOTIFICATION_SYNC_RESET_EVENT,
  serverCapabilities: NOTIFICATION_API_CAPABILITIES,
  routes: {
    center: '/notifications',
    detail: '/notifications/:notificationId',
    preferences: '/account/settings/notifications',
    tenantAdmin: '/admin/notifications/overview',
    tenantAdminContracts: '/admin/notifications/contracts',
    tenantAdminOperations: '/admin/notifications/operations',
  },
  routePermissions: {
    user: { resourceKey: 'APP.NOTIFICATIONS', permissionCode: 'VIEW' },
    tenantOperations: {
      resourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
      permissionCode: 'VIEW',
    },
    tenantContracts: {
      resourceKey: 'ADMIN.NOTIFICATION_CONTRACT',
      permissionCode: 'VIEW',
    },
  },
  apiScopes: {
    readSelf: 'NOTIFICATION.INBOX.READ_SELF',
    triageSelf: 'NOTIFICATION.INBOX.TRIAGE_SELF',
    managePreferences: 'NOTIFICATION.PREFERENCE.MANAGE_SELF',
    readTenantOperations: 'NOTIFICATION.OPERATIONS.READ',
    readContracts: 'NOTIFICATION.CONTRACT.READ',
  },
} as const;
