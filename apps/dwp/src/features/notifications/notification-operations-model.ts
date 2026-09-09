import type { NotificationOperationalFinding } from '@dwp-frontend/shared-utils/api/notification-api';

const GOVERNED_ROUTE_BY_CATEGORY: Partial<
  Record<NotificationOperationalFinding['category'], string>
> = {
  CONTRACT: '/notifications/admin/contracts',
  POLICY: '/notifications/admin/policies',
  TEMPLATE: '/notifications/admin/templates',
  NOISE: '/notifications/admin/suppressions',
};

export function selectNotificationOperationalFinding(
  findings: NotificationOperationalFinding[],
  requestedId: string | null
): NotificationOperationalFinding | null {
  return findings.find((finding) => finding.findingId === requestedId) ?? findings[0] ?? null;
}

export function notificationOperationalFindingRoute(
  finding: NotificationOperationalFinding
): string | null {
  if (finding.href?.startsWith('/')) return finding.href;
  return GOVERNED_ROUTE_BY_CATEGORY[finding.category] ?? null;
}
