import { PRODUCT_NOTIFICATION_RUNTIME_ENABLED } from '@dwp-frontend/shared-utils';

export function homeNotificationRuntimeAuthorized(
  hasNotificationPermission: boolean,
  notificationRuntimeEnabled = PRODUCT_NOTIFICATION_RUNTIME_ENABLED
): boolean {
  return notificationRuntimeEnabled && hasNotificationPermission;
}
