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
  await expect(initialTrigger).toBeVisible({ timeout: 15_000 });
  const initialTriggerHandle = await initialTrigger.elementHandle();
  await initialTrigger.click();

  const glance = page.getByRole('dialog', { name: '최근 알림' });
  await expect(glance).toBeVisible({ timeout: 15_000 });
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
    inboxFailureViews?: string[];
    inboxItems?: () => unknown[];
    byAppItems?: () => unknown[];
    inboxPage?: (requestUrl: string) => {
      items: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
      approximateTotal: number;
    };
    detailItem?: () => unknown;
    onTriageResult?: (item: unknown) => void;
    targetState?: 'AVAILABLE' | 'DELETED' | 'EXPIRED' | 'FORBIDDEN';
    profilePreviewMode?: 'FULL' | 'HIDDEN';
    profileResponseBarrier?: Promise<void>;
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
        apps: options.byAppItems?.() ?? [
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
    const requestedView = new URL(requestUrl).searchParams.get('view')?.toUpperCase();
    if (
      route.request().method() === 'GET' &&
      requestedView &&
      options.inboxFailureViews?.includes(requestedView)
    ) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Temporarily unavailable' }),
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
  await mockNotificationProfile(
    page,
    options.profilePreviewMode ?? 'HIDDEN',
    options.profileResponseBarrier
  );
}

export async function mockNotificationProfile(
  page: Page,
  previewMode: 'FULL' | 'HIDDEN' = 'FULL',
  responseBarrier?: Promise<void>
) {
  await page.route('**/api/notifications/v1/me/delivery-profile', async (route) => {
    await responseBarrier;
    return fulfillSuccess(route, {
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
    });
  });
}

export async function mockNotificationAttentionR2(page: Page) {
  const createdAt = '2026-09-16T01:00:00Z';
  let rules = [
    {
      ruleId: 'attention-rule-e2e-1',
      scopeKind: 'ACTOR',
      scopeKey: 'user:kim-minseo',
      displayLabel: '김민서',
      effect: 'PRIORITIZE',
      channels: { IN_APP: true },
      startsAt: null,
      expiresAt: null,
      source: 'USER',
      managed: false,
      exceptionAllowed: true,
      enabled: true,
      version: '1',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  await page.route('**/api/notifications/v1/me/attention-rules**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === 'POST' && path.endsWith('/attention-rules/preview')) {
      return fulfillSuccess(route, {
        allowed: true,
        effectiveEffect: request.postDataJSON().effect,
        mandatoryConflict: false,
        conflictReason: null,
        estimatedAffectedCount: null,
        estimateAvailable: false,
        asOf: '2026-09-16T01:05:00Z',
      });
    }
    if (method === 'GET' && path.endsWith('/attention-rules')) {
      return fulfillSuccess(route, { items: rules, maxActiveRules: 25 });
    }
    if (method === 'POST' && path.endsWith('/attention-rules')) {
      const input = request.postDataJSON() as Record<string, unknown>;
      const created = {
        ...input,
        ruleId: `attention-rule-e2e-${rules.length + 1}`,
        source: 'USER',
        managed: false,
        exceptionAllowed: true,
        enabled: input.enabled ?? true,
        version: '1',
        createdAt,
        updatedAt: '2026-09-16T01:06:00Z',
      };
      rules = [...rules, created] as typeof rules;
      return fulfillSuccess(route, created);
    }
    const ruleMatch = /\/attention-rules\/([^/]+)$/u.exec(path);
    const ruleId = ruleMatch ? decodeURIComponent(ruleMatch[1] ?? '') : '';
    const current = rules.find((rule) => rule.ruleId === ruleId);
    if (method === 'PUT' && current) {
      const input = request.postDataJSON() as Record<string, unknown>;
      const updated = {
        ...current,
        ...input,
        version: String(Number(current.version) + 1),
        updatedAt: '2026-09-16T01:07:00Z',
      };
      rules = rules.map((rule) => (rule.ruleId === ruleId ? updated : rule));
      return fulfillSuccess(route, updated);
    }
    if (method === 'DELETE' && current) {
      rules = rules.filter((rule) => rule.ruleId !== ruleId);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 404 });
  });

  const attentionPreviewFingerprint = 'a'.repeat(64);
  await page.route('**/api/notifications/v1/inbox/*/attention-controls/preview', (route) => {
    const request = route.request();
    const notificationId = new URL(request.url()).pathname.split('/').at(-3) ?? '';
    const input = request.postDataJSON() as Record<string, unknown>;
    return fulfillSuccess(route, {
      controlKey: input.controlKey,
      allowed: true,
      policyLocked: false,
      effectiveEffect: input.effect,
      policySource: null,
      policyReason: null,
      previewFingerprint: attentionPreviewFingerprint,
      currentRuleVersion: null,
      expiresAt: input.expiresAt ?? null,
      asOf: '2026-09-16T01:10:00Z',
      notificationId,
    });
  });
  await page.route('**/api/notifications/v1/inbox/*/attention-controls', (route) => {
    const request = route.request();
    const notificationId = new URL(request.url()).pathname.split('/').at(-2) ?? '';
    if (request.method() === 'GET') {
      return fulfillSuccess(route, {
        partial: false,
        unavailableSources: [],
        message: null,
        notificationId,
        whyReceived: '김민서님이 회원님을 승인 담당자로 직접 지정했습니다.',
        controls: [
          {
            controlKey: 'FOLLOW_CONTEXT',
            scopeKind: 'THREAD',
            label: '클라우드 운영 예산 승인 건',
            description: '이 승인 건의 후속 변경을 우선 표시합니다.',
            allowedEffects: ['FOLLOW'],
            currentEffect: null,
            policyLocked: false,
            policyReason: null,
            dndBypassAllowed: false,
            expiresAt: null,
            ruleId: null,
            ruleVersion: null,
          },
          {
            controlKey: 'MUTE_TYPE',
            scopeKind: 'APP_TYPE',
            label: '필수 승인 요청',
            description: '회사 정책상 필수 승인 알림은 음소거할 수 없습니다.',
            allowedEffects: ['MUTE'],
            currentEffect: null,
            policyLocked: true,
            policyReason: '업무 필수 알림 정책',
            dndBypassAllowed: true,
            expiresAt: null,
            ruleId: null,
            ruleVersion: null,
          },
        ],
        generatedAt: '2026-09-16T01:10:00Z',
      });
    }
    const input = request.postDataJSON() as Record<string, unknown>;
    if (input.previewFingerprint !== attentionPreviewFingerprint) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          code: 'ATTENTION_PREVIEW_STALE',
          message: 'The attention impact preview is no longer current.',
        }),
      });
    }
    return fulfillSuccess(route, {
      ruleId: 'attention-rule-context-e2e',
      scopeKind: 'THREAD',
      scopeKey: notification.threadKey,
      displayLabel: '클라우드 운영 예산 승인 건',
      effect: input.effect,
      channels: { IN_APP: true },
      startsAt: null,
      expiresAt: input.expiresAt ?? null,
      source: 'USER',
      managed: false,
      exceptionAllowed: true,
      enabled: true,
      version: '1',
      createdAt,
      updatedAt: '2026-09-16T01:11:00Z',
    });
  });

  await page.route('**/api/notifications/v1/me/test-deliveries**', (route) => {
    const request = route.request();
    const pending = request.method() === 'POST';
    return fulfillSuccess(route, {
      testId: 'notification-test-e2e-1',
      state: pending ? 'PENDING' : 'COMPLETED',
      requestedChannels: ['IN_APP'],
      stages: [
        {
          stage: 'REQUEST_VALIDATION',
          state: 'SUCCEEDED',
          detail: 'Request and rate limit validated.',
          occurredAt: '2026-09-16T01:12:00Z',
        },
        {
          stage: 'PRIVACY_FILTER',
          state: 'SUCCEEDED',
          detail: 'No business payload was persisted.',
          occurredAt: '2026-09-16T01:12:01Z',
        },
        {
          stage: 'IN_APP_PREVIEW',
          state: pending ? 'PENDING' : 'SUCCEEDED',
          detail: 'Safe preview path verified.',
          occurredAt: pending ? null : '2026-09-16T01:12:02Z',
        },
        {
          stage: 'ENDPOINT_DELIVERY',
          state: 'DISABLED',
          detail: 'External provider delivery is disabled in this environment.',
          occurredAt: '2026-09-16T01:12:02Z',
        },
      ],
      createdAt: '2026-09-16T01:12:00Z',
      expiresAt: '2099-09-16T02:12:00Z',
      retryAfterSeconds: null,
    });
  });
}

export async function mockNotificationNoiseQuality(page: Page) {
  await page.route('**/api/notifications/v1/admin/noise-quality', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      message: null,
      sufficientCohort: true,
      minimumCohortSize: 20,
      observedCohortSize: 84,
      muteRate: 0.18,
      deduplicationRate: 0.31,
      actionConversionRate: 0.64,
      fatigueExposedUsers: 9,
      noisyTypes: [
        {
          appKey: 'messaging',
          typeKey: 'MESSAGE.MENTION',
          cohortSize: 42,
          volume: 186,
          muteRate: 0.08,
          deduplicationRate: 0.22,
          actionConversionRate: 0.71,
          findingCode: null,
        },
        {
          appKey: 'messaging',
          typeKey: 'MESSAGE.PRIVATE_THREAD',
          cohortSize: 7,
          volume: 14,
          muteRate: 0.57,
          deduplicationRate: 0.04,
          actionConversionRate: 0.12,
          findingCode: 'LOW_COHORT_REVIEW',
        },
      ],
      generatedAt: '2026-09-16T01:15:00Z',
    })
  );
}

export async function mockNotificationPreferences(page: Page) {
  const endpointRevokeRequests: Array<Record<string, unknown>> = [];
  let endpoints = [
    {
      endpointId: '24000000-0000-0000-0000-000000000001',
      channel: 'WEB_PUSH',
      displayName: '업무용 Chrome · MacBook Pro',
      platform: 'WEB',
      endpointHint: 'Chrome 141 · Seoul',
      state: 'ACTIVE',
      lastSeenAt: '2026-09-03T03:48:00Z',
      createdAt: '2026-08-21T00:00:00Z',
      revokedAt: null,
      version: '1',
    },
    {
      endpointId: '24000000-0000-0000-0000-000000000002',
      channel: 'MOBILE_PUSH',
      displayName: 'iPhone 17 Pro',
      platform: 'IOS',
      endpointHint: 'DWP Mobile · iOS',
      state: 'ACTIVE',
      lastSeenAt: '2026-09-03T02:00:00Z',
      createdAt: '2026-08-24T00:00:00Z',
      revokedAt: null,
      version: '2',
    },
  ];
  await page.route('**/api/notifications/v1/me/delivery-endpoints**', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return fulfillSuccess(route, endpoints);
    endpointRevokeRequests.push(request.postDataJSON() as Record<string, unknown>);
    const endpointId = new URL(request.url()).pathname.split('/').at(-2);
    const current = endpoints.find((endpoint) => endpoint.endpointId === endpointId);
    if (!current) return route.abort();
    const revoked = {
      ...current,
      state: 'REVOKED',
      revokedAt: '2026-09-03T04:02:00Z',
      version: String(Number(current.version) + 1),
    };
    endpoints = endpoints.map((endpoint) =>
      endpoint.endpointId === endpointId ? revoked : endpoint
    );
    return fulfillSuccess(route, revoked);
  });
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
  await mockNotificationAttentionR2(page);
  return { endpointRevokeRequests };
}

export async function mockNotificationAdminOverview(page: Page) {
  await page.route('**/api/notifications/v1/admin/overview', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      generatedAt: '2026-09-03T05:12:00Z',
      metrics: [
        {
          key: 'active-contracts',
          label: 'Active contracts',
          value: 10,
          unit: 'contracts',
          state: 'HEALTHY',
        },
        {
          key: 'notifications-24h',
          label: 'Notifications',
          value: 7,
          unit: 'notifications',
          state: 'HEALTHY',
        },
        { key: 'queued-deliveries', label: 'Queued', value: 1, unit: 'jobs', state: 'ATTENTION' },
        { key: 'failed-deliveries', label: 'Failed', value: 0, unit: 'jobs', state: 'HEALTHY' },
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
  await mockNotificationNoiseQuality(page);
}
