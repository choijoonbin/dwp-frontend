import type {
  NotificationBulkResult,
  NotificationSummary,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationGlanceSummaryState =
  | { kind: 'LOADING' }
  | { kind: 'UNKNOWN' }
  | { kind: 'CURRENT'; summary: NotificationSummary }
  | { kind: 'STALE'; summary: NotificationSummary };

export function notificationGlanceSummaryState({
  summary,
  pending,
  error,
}: {
  summary?: NotificationSummary;
  pending: boolean;
  error: boolean;
}): NotificationGlanceSummaryState {
  if (summary) return { kind: error ? 'STALE' : 'CURRENT', summary };
  if (error) return { kind: 'UNKNOWN' };
  return { kind: pending ? 'LOADING' : 'UNKNOWN' };
}

export function notificationGlanceBulkFeedback(
  result: NotificationBulkResult,
  expectedIds: readonly string[] = result.results.map((item) => item.notificationId)
):
  | { kind: 'SUCCESS'; count: number; failedIds: [] }
  | { kind: 'PARTIAL'; count: number; failedIds: string[] } {
  const resultById = new Map(result.results.map((item) => [item.notificationId, item]));
  const failedIds = [
    ...new Set(
      expectedIds.filter((notificationId) => {
        const item = resultById.get(notificationId);
        return !item || (item.outcome !== 'APPLIED' && item.outcome !== 'ALREADY_APPLIED');
      })
    ),
  ];
  return failedIds.length > 0
    ? { kind: 'PARTIAL', count: failedIds.length, failedIds }
    : { kind: 'SUCCESS', count: expectedIds.length, failedIds: [] };
}
