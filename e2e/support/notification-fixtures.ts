import { expect, type Page, type Route } from '@playwright/test';

export const NOTIFICATION_PERMISSION = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

export const NOTIFICATION_ADMIN_PERMISSIONS = [
  ...NOTIFICATION_PERMISSION,
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

export const notification = {
  notificationId: 'notification-e2e-1',
  threadKey: 'approval:budget-42',
  threadCount: 1,
  source: {
    appKey: 'approvals',
    appName: 'Approvals',
    iconKey: 'approval',
    accent: '#2457D6',
  },
  typeKey: 'APPROVAL.ACTION_REQUIRED',
  title: '클라우드 운영 예산 승인이 필요합니다',
  preview: '김민서님이 오늘 안으로 검토를 요청했습니다.',
  actorLabel: '김민서',
  priority: 'URGENT',
  reason: { kind: 'DIRECT', label: '나에게 직접 지정됨' },
  receivedAt: '2026-08-19T06:57:00Z',
  lastActivityAt: '2026-08-19T06:57:00Z',
  dueAt: '2026-08-19T14:59:00Z',
  readAt: '2026-08-19T07:00:00Z',
  savedAt: null,
  completedAt: null,
  snoozedUntil: null,
  actionable: true,
  sensitive: false,
  actions: [
    {
      actionKey: 'review',
      label: '검토하기',
      href: '/approvals/inbox',
      enabled: true,
      disabledReason: null,
      primary: true,
    },
  ],
  version: '1',
} as const;

export function fulfillSuccess(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export async function openHeaderNotificationGlance(page: Page) {
  const control = page.getByTestId('shell-notification-control');
  const initialTrigger = control.getByRole('button');
  await expect(initialTrigger).toBeVisible();
  const initialTriggerHandle = await initialTrigger.elementHandle();
  await initialTrigger.click();

  const glance = page.getByRole('dialog', { name: '최근 알림' });
  await expect(glance).toBeVisible();
  return { control, glance, initialTriggerHandle };
}

export async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const parent = element.parentElement;
        const parentBounds = parent?.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLocaleLowerCase('en-US'),
          testId: element.dataset.testid ?? null,
          pageCanvas: element.dataset.dwpPageCanvas ?? null,
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          className: typeof element.className === 'string' ? element.className : '',
          display: style.display,
          overflowX: style.overflowX,
          flexWrap: style.flexWrap,
          left: Math.round(bounds.left * 10) / 10,
          right: Math.round(bounds.right * 10) / 10,
          width: Math.round(bounds.width * 10) / 10,
          parent: parent
            ? {
                tag: parent.tagName.toLocaleLowerCase('en-US'),
                className: typeof parent.className === 'string' ? parent.className : '',
                left: Math.round((parentBounds?.left ?? 0) * 10) / 10,
                right: Math.round((parentBounds?.right ?? 0) * 10) / 10,
                width: Math.round((parentBounds?.width ?? 0) * 10) / 10,
              }
            : null,
        };
      })
      .filter(({ left, right, width }) => width > 0 && (left < -0.5 || right > viewportWidth + 0.5))
      .slice(0, 12);
    return {
      viewportWidth,
      contentWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  expect(
    geometry.contentWidth,
    `Horizontal overflow: ${JSON.stringify(geometry.offenders)}`
  ).toBeLessThanOrEqual(geometry.viewportWidth);
}

export async function mockNotificationCenter(
  page: Page,
  options: {
    actionableUnread?: number;
    totalUnread?: number;
    viewCounts?: Record<string, number>;
    partial?: boolean;
    unavailableSources?: string[];
    bulkActions?: string[];
    triageActions?: string[];
    triageFailureActions?: string[];
    summaryQueries?: string[];
    inboxQueries?: string[];
    inboxItems?: () => unknown[];
    inboxPage?: (requestUrl: string) => {
      items: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
      approximateTotal: number;
    };
    detailItem?: () => unknown;
    onTriageResult?: (item: unknown) => void;
    targetState?: 'AVAILABLE' | 'DELETED' | 'EXPIRED' | 'FORBIDDEN';
  } = {}
) {
  await page.route('**/api/notifications/v1/stream**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: ': connected\n\n',
    })
  );
  await page.route('**/api/notifications/v1/summary**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/summary/by-app')) {
      return fulfillSuccess(route, {
        partial: options.partial ?? false,
        unavailableSources: options.unavailableSources ?? [],
        apps: [
          {
            appKey: 'approvals',
            totalUnread: options.totalUnread ?? 1,
            actionableUnread: options.actionableUnread ?? 1,
            urgentUnread: 1,
            lastActivityAt: '2026-08-19T07:00:00Z',
          },
        ],
        changeVersion: '1',
        counterVersion: '1',
        generatedAt: '2026-08-19T07:00:00Z',
      });
    }
    options.summaryQueries?.push(route.request().url());
    return fulfillSuccess(route, {
      partial: options.partial ?? false,
      unavailableSources: options.unavailableSources ?? [],
      message: options.partial ? '일부 알림 소스가 지연되고 있습니다.' : null,
      actionableUnread: options.actionableUnread ?? 1,
      totalUnread: options.totalUnread ?? 1,
      viewCounts: options.viewCounts ?? {
        PRIORITY: 1,
        ALL: 1,
        MENTIONS: 0,
        SAVED: 0,
        SNOOZED: 0,
        DONE: 0,
      },
      changeVersion: '1',
      counterVersion: '1',
      generatedAt: '2026-08-19T07:00:00Z',
    });
  });
  await page.route('**/api/notifications/v1/inbox**', (route) => {
    const requestUrl = route.request().url();
    const path = new URL(requestUrl).pathname;
    if (route.request().method() === 'POST' && path.endsWith('/bulk-actions')) {
      const body = route.request().postDataJSON() as {
        notificationIds: string[];
        action: string;
      };
      options.bulkActions?.push(body.action);
      return fulfillSuccess(route, {
        results: body.notificationIds.map((notificationId) => ({
          notificationId,
          outcome: 'APPLIED',
          item: notification,
          message: null,
        })),
        changeVersion: '2',
        summary: {
          partial: false,
          unavailableSources: [],
          message: null,
          actionableUnread: 0,
          totalUnread: 0,
          viewCounts: { PRIORITY: 1, ALL: 1, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
          changeVersion: '2',
          counterVersion: '2',
          generatedAt: '2026-08-19T07:01:00Z',
        },
        undoToken: null,
        undoExpiresAt: null,
      });
    }
    const triageMatch =
      /\/inbox\/([^/]+)\/(read|unread|save|unsave|complete|restore|snooze)$/u.exec(path);
    if (route.request().method() === 'POST' && triageMatch) {
      const notificationId = decodeURIComponent(triageMatch[1] ?? '');
      const action = triageMatch[2]?.toUpperCase() ?? '';
      options.triageActions?.push(action);
      if (options.triageFailureActions?.includes(action)) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Temporarily unavailable' }),
        });
      }
      const sourceItem =
        options
          .inboxItems?.()
          .find(
            (candidate) =>
              typeof candidate === 'object' &&
              candidate !== null &&
              'notificationId' in candidate &&
              candidate.notificationId === notificationId
          ) ?? notification;
      const resultItem = {
        ...sourceItem,
        readAt: action === 'UNREAD' ? null : notification.readAt,
        savedAt: action === 'SAVE' ? '2026-08-19T07:01:00Z' : null,
        completedAt: action === 'COMPLETE' ? '2026-08-19T07:01:00Z' : null,
        snoozedUntil: action === 'SNOOZE' ? '2026-08-19T11:01:00Z' : null,
        version: '2',
      };
      options.onTriageResult?.(resultItem);
      return fulfillSuccess(route, {
        item: resultItem,
        summary: {
          partial: false,
          unavailableSources: [],
          actionableUnread: resultItem.completedAt || resultItem.snoozedUntil ? 0 : 1,
          totalUnread: resultItem.completedAt || resultItem.snoozedUntil ? 0 : 1,
          viewCounts: {
            PRIORITY: resultItem.completedAt || resultItem.snoozedUntil ? 0 : 1,
            ALL: resultItem.completedAt || resultItem.snoozedUntil ? 0 : 1,
            MENTIONS: 0,
            SAVED: resultItem.savedAt ? 1 : 0,
            SNOOZED: resultItem.snoozedUntil ? 1 : 0,
            DONE: resultItem.completedAt ? 1 : 0,
          },
          changeVersion: '2',
          counterVersion: '2',
          generatedAt: '2026-08-19T07:01:00Z',
        },
      });
    }
    const detailMatch = /\/inbox\/([^/]+)$/u.exec(path);
    if (route.request().method() === 'GET' && detailMatch) {
      const detailId = decodeURIComponent(detailMatch[1]!);
      const detailItem =
        detailId === notification.notificationId
          ? (options.detailItem?.() ?? notification)
          : options
              .inboxItems?.()
              .find(
                (candidate) =>
                  candidate !== null &&
                  typeof candidate === 'object' &&
                  'notificationId' in candidate &&
                  candidate.notificationId === detailId
              );
      if (!detailItem)
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Notification not found' }),
        });
      const targetState = options.targetState ?? 'AVAILABLE';
      return fulfillSuccess(route, {
        item: detailItem,
        reasonExplanation: '원천 앱이 회원님의 계정을 직접 수신 대상으로 지정했습니다.',
        absoluteOccurredAt: notification.receivedAt,
        targetState,
        targetStateReason: targetState === 'DELETED' ? 'SOURCE_DELETED' : null,
        timeline: [
          {
            entryId: 'timeline-e2e-1',
            title: 'Notification received',
            detail: '클라우드 운영 예산 요청의 검토 차례가 도착했습니다.',
            occurredAt: notification.receivedAt,
            actorLabel: null,
          },
        ],
      });
    }
    if (route.request().method() === 'GET') options.inboxQueries?.push(requestUrl);
    const pageData = options.inboxPage?.(requestUrl);
    return fulfillSuccess(route, {
      partial: options.partial ?? false,
      unavailableSources: options.unavailableSources ?? [],
      message: options.partial ? '일부 알림 소스가 지연되고 있습니다.' : null,
      items: pageData?.items ?? options.inboxItems?.() ?? [notification],
      nextCursor: pageData?.nextCursor ?? null,
      hasMore: pageData?.hasMore ?? false,
      approximateTotal: pageData?.approximateTotal ?? 1,
      changeVersion: '1',
    });
  });
  await mockNotificationProfile(page, 'HIDDEN');
}

export async function mockNotificationProfile(page: Page, previewMode: 'FULL' | 'HIDDEN' = 'FULL') {
  await page.route('**/api/notifications/v1/me/delivery-profile', (route) =>
    fulfillSuccess(route, {
      channels: { IN_APP: true },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Seoul',
        days: [1, 2, 3, 4, 5, 6, 7],
        allowUrgentBypass: true,
      },
      digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
      presentation: { bannerMode: 'SMART', previewMode },
      version: '1',
      updatedAt: '2026-08-19T07:00:00Z',
    })
  );
}

export async function mockNotificationPreferences(page: Page) {
  await page.route('**/api/notifications/v1/capabilities', (route) =>
    fulfillSuccess(route, {
      enabledChannels: ['IN_APP'],
      unavailableChannels: ['EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'TEAMS', 'SLACK'],
      canonicalStore: 'POSTGRESQL',
      realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
      externalDeliveryState: 'DISABLED',
      generatedAt: '2026-09-03T04:00:00Z',
    })
  );
  await page.route('**/api/notifications/v1/me/effective-settings', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      globalChannels: {
        IN_APP: {
          effectiveValue: true,
          source: 'SYSTEM_DEFAULT',
          managed: false,
          exceptionAllowed: true,
        },
      },
      apps: [
        {
          appKey: 'approvals',
          appName: 'Approvals',
          iconKey: 'approval',
          types: [
            {
              typeKey: 'APPROVAL_ACTION_REQUIRED',
              typeName: 'Approval action required',
              description: 'A decision needs your attention.',
              mode: {
                effectiveValue: 'IMMEDIATE',
                source: 'SYSTEM_DEFAULT',
                managed: false,
                exceptionAllowed: true,
              },
              channels: {
                IN_APP: {
                  effectiveValue: true,
                  source: 'SYSTEM_DEFAULT',
                  managed: false,
                  exceptionAllowed: true,
                },
              },
              mandatory: false,
              quietHoursBypass: false,
              ruleId: null,
              ruleVersion: null,
            },
          ],
        },
      ],
      generatedAt: '2026-09-03T04:00:00Z',
    })
  );
}

export async function mockNotificationAdminOverview(page: Page) {
  await page.route('**/api/notifications/v1/admin/overview', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      generatedAt: '2026-09-03T05:12:00Z',
      metrics: [
        { key: 'active-contracts', label: 'Active contracts', value: 10, state: 'HEALTHY' },
        { key: 'notifications-24h', label: 'Notifications', value: 7, state: 'HEALTHY' },
        { key: 'queued-deliveries', label: 'Queued', value: 1, state: 'ATTENTION' },
        { key: 'failed-deliveries', label: 'Failed', value: 0, state: 'HEALTHY' },
      ],
      trend: [
        { bucket: '2026-08-28T00:00:00Z', created: 2, actionable: 1, failed: 0, muted: 0 },
        { bucket: '2026-08-29T00:00:00Z', created: 7, actionable: 2, failed: 1, muted: 1 },
        { bucket: '2026-08-30T00:00:00Z', created: 4, actionable: 1, failed: 0, muted: 1 },
        { bucket: '2026-08-31T00:00:00Z', created: 5, actionable: 3, failed: 0, muted: 0 },
        { bucket: '2026-09-01T00:00:00Z', created: 3, actionable: 1, failed: 0, muted: 0 },
        { bucket: '2026-09-02T00:00:00Z', created: 6, actionable: 2, failed: 0, muted: 1 },
        { bucket: '2026-09-03T00:00:00Z', created: 7, actionable: 2, failed: 0, muted: 0 },
      ],
      findings: [],
    })
  );
}
