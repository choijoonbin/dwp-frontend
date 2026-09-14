import type { NotificationOperationalFinding } from '@dwp-frontend/shared-utils/api/notification-api';

const GOVERNED_ROUTE_BY_CATEGORY: Partial<
  Record<NotificationOperationalFinding['category'], string>
> = {
  CONTRACT: '/notifications/admin/contracts',
  POLICY: '/notifications/admin/policies',
  TEMPLATE: '/notifications/admin/templates',
  NOISE: '/notifications/admin/suppressions',
};

const LOCALIZED_FINDING_IDS = new Set([
  'external-delivery-disabled',
  'dead-letter-queue',
  'contracts-without-active-template',
  'failed-delivery-jobs',
]);

export function localizeNotificationOperationalFindings(
  findings: NotificationOperationalFinding[],
  translate: (key: string, options: { defaultValue: string }) => string
): NotificationOperationalFinding[] {
  return findings.map((finding) => {
    if (!LOCALIZED_FINDING_IDS.has(finding.findingId)) return finding;
    const key = `admin.operations.findingCopy.${finding.findingId}`;
    return {
      ...finding,
      title: translate(`${key}.title`, { defaultValue: finding.title }),
      detail: translate(`${key}.detail`, { defaultValue: finding.detail }),
      ownerLabel: translate(`${key}.owner`, { defaultValue: finding.ownerLabel ?? '' }),
    };
  });
}

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
