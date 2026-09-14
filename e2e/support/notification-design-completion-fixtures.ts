import type { Page } from '@playwright/test';

import { fulfillSuccess } from './shell-session';

export const NOTIFICATION_OPERATIONS_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.NOTIFICATION_OPERATIONS',
    permissionCode: 'MANAGE',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'ADMIN',
    resourceKey: 'ADMIN.AUDIT_VIEW',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
];

const findings = [
  {
    findingId: 'dead-letter-queue',
    category: 'DELIVERY',
    severity: 'CRITICAL',
    title: '재시도 한도를 초과한 전달이 있습니다',
    detail: '전자결재 알림 4건이 전달 재시도 한도를 초과했습니다.',
    count: 4,
    ownerLabel: 'Notification Operations',
    detectedAt: '2026-09-08T09:18:00Z',
    href: null,
  },
  {
    findingId: 'contract-health',
    category: 'CONTRACT',
    severity: 'WARNING',
    title: '게시 템플릿이 없는 계약이 있습니다',
    detail: '활성 계약 1개에 앱 내 게시 템플릿이 없습니다.',
    count: 1,
    ownerLabel: 'Notification Governance',
    detectedAt: '2026-09-08T09:20:00Z',
    href: null,
  },
] as const;

const operations = {
  partial: false,
  unavailableSources: [],
  generatedAt: '2026-09-08T09:24:00Z',
  retryQueue: 12,
  deadLetterQueue: 4,
  unknownOutcomes: 2,
  lanes: [
    {
      lane: 'CRITICAL',
      queued: 3,
      oldestAgeSeconds: 420,
      throughputPerMinute: 18,
      failureRatePercent: 1.4,
      state: 'DEGRADED',
    },
    {
      lane: 'INTERACTIVE',
      queued: 9,
      oldestAgeSeconds: 84,
      throughputPerMinute: 42,
      failureRatePercent: 0.3,
      state: 'HEALTHY',
    },
  ],
  providers: [
    {
      providerKey: 'email',
      displayName: 'Email provider',
      channel: 'EMAIL',
      state: 'DISABLED',
      successRatePercent: 0,
      p95LatencyMs: 0,
      circuitState: 'CLOSED',
      lastCheckedAt: '2026-09-08T09:24:00Z',
    },
  ],
  findings,
};

const suppression = {
  suppressionId: 'suppression-space-1',
  scopeType: 'APP',
  scopeKey: 'space',
  channel: 'IN_APP',
  startsAt: '2026-09-08T09:00:00Z',
  expiresAt: '2099-09-08T11:00:00Z',
  criticalBypass: true,
  reason: 'Space 메시지 중복 이벤트 조사 동안 앱 내 전달을 일시 중지합니다.',
  createdBy: 100,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  version: '2',
  createdAt: '2026-09-08T08:55:00Z',
  updatedAt: '2026-09-08T08:55:00Z',
} as const;

export async function mockNotificationOperationsAndSuppressions(page: Page) {
  const revokeRequests: Array<Record<string, unknown>> = [];
  let operationsRequests = 0;
  await page.route('**/api/notifications/v1/admin/overview', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      generatedAt: operations.generatedAt,
      metrics: [
        { key: 'active-contracts', label: 'Active contracts', value: 12, state: 'HEALTHY' },
        { key: 'notifications-24h', label: 'Notifications', value: 842, state: 'HEALTHY' },
        { key: 'queued-deliveries', label: 'Queued', value: 12, state: 'ATTENTION' },
        { key: 'failed-deliveries', label: 'Failed', value: 4, state: 'CRITICAL' },
      ],
      trend: [],
      findings,
    })
  );
  await page.route('**/api/notifications/v1/admin/operations', (route) => {
    operationsRequests += 1;
    return fulfillSuccess(route, operations);
  });
  await page.route('**/api/notifications/v1/admin/types**', (route) =>
    fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      items: [
        {
          contractId: 'contract-space',
          typeKey: 'MESSAGING.DIRECT_MESSAGE',
          displayName: 'Space 메시지',
          description: '대화방 참여자에게 전달되는 새 메시지 알림입니다.',
          appKey: 'space',
          appName: 'Space',
          ownerLabel: 'Space Team',
          sourceEventType: 'messaging.message.sent.v1',
          priority: 'NORMAL',
          channels: ['IN_APP'],
          mandatory: false,
          state: 'ACTIVE',
          contractHealth: 'HEALTHY',
          volume24Hours: 20,
          schemaVersion: 1,
          minSchemaVersion: 1,
          maxSchemaVersion: 1,
          dataClassification: 'INTERNAL',
          audienceMode: 'DIRECT',
          interruptionLevel: 'PASSIVE',
          userConfigurable: true,
          previewPolicy: 'TITLE_ONLY',
          requiredVariables: ['conversationId', 'messageId'],
          deepLinkTemplate: '/messages/inbox?conversation={{conversationId}}&message={{messageId}}',
          dedupeStrategy: 'SOURCE_EVENT_RECIPIENT',
          endEventType: null,
          retentionPolicy: 'TENANT_DEFAULT_LEGAL_HOLD_AWARE',
          runbookUrl: '/notifications/admin/operations?typeKey=MESSAGING.DIRECT_MESSAGE',
          version: '1',
          updatedAt: operations.generatedAt,
        },
      ],
      nextCursor: null,
      hasMore: false,
    })
  );
  await page.route('**/api/notifications/v1/admin/suppressions', (route) =>
    fulfillSuccess(route, { items: [suppression], generatedAt: operations.generatedAt })
  );
  await page.route('**/api/notifications/v1/admin/suppressions/*/revoke', async (route) => {
    revokeRequests.push((await route.request().postDataJSON()) as Record<string, unknown>);
    return fulfillSuccess(route, {
      ...suppression,
      revokedAt: operations.generatedAt,
      revokedBy: 100,
      revokeReason: revokeRequests.at(-1)?.reason,
      version: '3',
      updatedAt: operations.generatedAt,
    });
  });
  return {
    revokeRequests,
    get operationsRequests() {
      return operationsRequests;
    },
  };
}
