import type { Page } from '@playwright/test';

import { mockLegacyProductSurfaceAuthority } from './product-surface-authority';

const DEFAULT_APP_RESOURCE_KEYS = [
  'APP.WORK',
  'APP.ASK',
  'APP.ACTIVITY',
  'APP.APPS',
  'APP.MAIL',
  'APP.COLLABORATION',
  'APP.COMMUNICATIONS',
  'APP.EMPLOYEE_SERVICES',
  'APP.HCM',
  'APP.PEOPLE_DIRECTORY',
  'APP.KNOWLEDGE',
  'APP.BUSINESS_ERP',
  'APP.LEGACY_OPERATIONS',
  'APP.ADMINISTRATION',
  'APP.SPACES',
] as const;

export const DEFAULT_APP_PERMISSIONS = DEFAULT_APP_RESOURCE_KEYS.map((resourceKey) => ({
  resourceType: 'APP',
  resourceKey,
  permissionCode: 'VIEW',
  effect: 'ALLOW',
}));

export const WORKSPACE_QUEUE_FIXTURE = {
  summary: { total: 4, dueSoon: 1, inProgress: 1, waiting: 1, completed: 1 },
  items: [
    {
      workItemId: '10420000-0000-0000-0000-000000000001',
      id: 'WK-1042',
      title: 'Approve software access request',
      summary: 'A new team member requested access to the project workspace.',
      dataClassification: 'CONFIDENTIAL',
      type: 'APPROVAL',
      priority: 'HIGH',
      status: 'DUE_SOON',
      owner: 'You',
      dueAt: '2026-08-11T01:30:00Z',
      sourceSystem: 'IT Service',
      sourceReference: 'REQ-8812',
      sourceRoute: '/admin/access',
      reason: 'A new team member cannot start project work until approval.',
      recommendedNext: 'Review the role and license scope before approval.',
      latestActivity: 'The policy engine verified role eligibility.',
      version: 0,
      updatedAt: '2026-08-11T00:08:00Z',
    },
    {
      workItemId: '10450000-0000-0000-0000-000000000002',
      id: 'WK-1045',
      title: 'Review customer briefing notes',
      summary: 'Review unresolved questions before the customer meeting.',
      dataClassification: 'CONFIDENTIAL',
      type: 'TASK',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      owner: 'You',
      dueAt: '2026-08-11T01:40:00Z',
      sourceSystem: 'Microsoft 365',
      sourceReference: 'DOC-2048',
      sourceRoute: null,
      reason: 'Three discovery questions still need owners.',
      recommendedNext: 'Assign owners before the meeting.',
      latestActivity: 'Mina Kim added three customer questions.',
      version: 0,
      updatedAt: '2026-08-11T00:54:00Z',
    },
    {
      workItemId: '10430000-0000-0000-0000-000000000003',
      id: 'WK-1043',
      title: 'Confirm benefits enrollment',
      summary: 'Confirm the benefits enrollment that closes today.',
      dataClassification: 'CONFIDENTIAL',
      type: 'SERVICE',
      priority: 'MEDIUM',
      status: 'WAITING',
      owner: 'You',
      dueAt: '2026-08-11T08:00:00Z',
      sourceSystem: 'People Service',
      sourceReference: 'BEN-2026',
      sourceRoute: '/hr/home',
      reason: 'The enrollment window closes today.',
      recommendedNext: 'Confirm the selected plan.',
      latestActivity: 'The people connector confirmed the deadline.',
      version: 0,
      updatedAt: '2026-08-11T00:41:00Z',
    },
    {
      workItemId: '10270000-0000-0000-0000-000000000006',
      id: 'WK-1027',
      title: 'Travel expense follow-up',
      summary: 'Shared Services completed the expense follow-up.',
      dataClassification: 'CONFIDENTIAL',
      type: 'SERVICE',
      priority: 'LOW',
      status: 'COMPLETED',
      owner: 'Shared Services',
      dueAt: null,
      sourceSystem: 'Finance',
      sourceReference: 'EXP-602',
      sourceRoute: null,
      reason: 'The request is complete and retained for reference.',
      recommendedNext: 'No further action is required.',
      latestActivity: 'The finance service completed the request.',
      version: 0,
      updatedAt: '2026-08-07T06:00:00Z',
    },
  ],
  generatedAt: '2026-08-11T00:10:00Z',
};

export const WORKSPACE_ACTIVITY_FIXTURE = {
  events: [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      occurredAt: '2026-08-11T00:06:00Z',
      actor: 'AGENT',
      actorName: 'DWP Agent',
      state: 'COMPLETED',
      title: 'Reference request plan prepared',
      summary: 'A read-only plan contract and audit trace were generated.',
      objectType: 'PLAN_PREVIEW',
      objectLabel: 'Request plan',
      source: 'DWAI·ON',
      tool: 'Reference planner',
      auditId: 'AUD-WRK-901',
      progress: 100,
      sourceRoute: '/dwaion',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000002',
      occurredAt: '2026-08-10T23:52:00Z',
      actor: 'PERSON',
      actorName: 'Mina Kim',
      state: 'NEEDS_INPUT',
      title: 'Access request needs review',
      summary: 'The new team member project role needs confirmation.',
      objectType: 'WORK_ITEM',
      objectLabel: 'WK-1042 access request',
      source: 'IT Service',
      tool: null,
      auditId: 'AUD-WRK-902',
      progress: null,
      sourceRoute: '/work?item=WK-1042',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000003',
      occurredAt: '2026-08-10T23:33:00Z',
      actor: 'SYSTEM',
      actorName: 'Policy Engine',
      state: 'POLICY_BLOCKED',
      title: 'External sharing blocked',
      summary: 'External sharing was blocked by the sensitive information policy.',
      objectType: 'POLICY_DECISION',
      objectLabel: 'External sharing policy',
      source: 'Policy Service',
      tool: 'DLP policy',
      auditId: 'AUD-WRK-903',
      progress: null,
      sourceRoute: '/activity',
    },
    {
      id: 'a1000000-0000-0000-0000-000000000004',
      occurredAt: '2026-08-10T23:10:00Z',
      actor: 'SYSTEM',
      actorName: 'People Connector',
      state: 'COMPLETED',
      title: 'Organization sync completed',
      summary: 'Organization and workforce changes were applied.',
      objectType: 'INTEGRATION_RUN',
      objectLabel: 'Workforce synchronization',
      source: 'People Service',
      tool: 'HRIS connector',
      auditId: 'AUD-WRK-904',
      progress: 100,
      sourceRoute: '/hr/home',
    },
  ],
  generatedAt: '2026-08-11T00:10:00Z',
};

export const WORKSPACE_APPS_FIXTURE = [
  {
    id: 'dwp-work',
    name: 'Work',
    description: 'Manage priorities, approvals, and tasks in one place.',
    owner: 'DWP Platform',
    category: 'PRODUCTIVITY',
    launchMode: 'NATIVE',
    launchTarget: '/work',
    iconKey: 'work',
    resourceKey: 'APP.WORK',
    health: 'HEALTHY',
    pinned: true,
    lastUsedAt: '2026-08-11T00:00:00Z',
    launchCount: 3,
    version: 1,
    accessState: 'AVAILABLE',
    accessRequestId: null,
    accessRequestState: null,
    accessRequestUpdatedAt: null,
    accessRequestVersion: null,
  },
  {
    id: 'ref-app-people',
    name: 'HR',
    description: 'Personal HR, people, organization, and role-aware workforce operations.',
    owner: 'People Platform',
    category: 'PEOPLE',
    launchMode: 'NATIVE',
    launchTarget: '/hr',
    iconKey: 'hcm',
    resourceKey: 'APP.HCM',
    health: 'HEALTHY',
    pinned: false,
    lastUsedAt: '2026-08-10T00:00:00Z',
    launchCount: 1,
    version: 1,
    accessState: 'AVAILABLE',
    accessRequestId: null,
    accessRequestState: null,
    accessRequestUpdatedAt: null,
    accessRequestVersion: null,
  },
  {
    id: 'ref-app-legacy',
    name: 'Legacy operations',
    description: 'Provide governed access to existing operational systems.',
    owner: 'Enterprise Systems',
    category: 'LEGACY',
    launchMode: 'DEEP_LINK',
    launchTarget: null,
    iconKey: 'legacy',
    resourceKey: 'APP.LEGACY_OPERATIONS',
    health: 'CONFIGURATION_REQUIRED',
    pinned: false,
    lastUsedAt: null,
    launchCount: 0,
    version: 0,
    accessState: 'CONFIGURATION_REQUIRED',
    accessRequestId: null,
    accessRequestState: null,
    accessRequestUpdatedAt: null,
    accessRequestVersion: null,
  },
];

export const ASK_RUNTIME_FIXTURE = {
  runId: 'run-ref-1042',
  auditId: 'AUD-REF-1042',
  requestId: 'request-ref-1042',
  correlationId: 'correlation-ref-1042',
  conversationId: null,
  userMessageId: null,
  assistantMessageId: null,
  state: 'COMPLETED',
  answer:
    'Your verified flexible work guidance allows remote work next Friday after manager acknowledgement.',
  confidence: 'HIGH',
  citations: [
    {
      sourceId: 'src-01',
      sourceType: 'MAIL',
      title: 'Flexible work guidance',
      sourceSystem: 'Microsoft 365',
      route: null,
      occurredAt: '2026-08-10T08:00:00Z',
      excerpt: null,
    },
    {
      sourceId: 'src-02',
      sourceType: 'CALENDAR',
      title: 'Manager acknowledgement window',
      sourceSystem: 'Microsoft 365',
      route: null,
      occurredAt: '2026-08-11T01:00:00Z',
      excerpt: null,
    },
  ],
  sourceCount: 2,
  policy: {
    outcome: 'ALLOW',
    riskTier: 'L1',
    code: 'READ_ONLY_GROUNDED_ANSWER',
    explanation: 'Read-only evidence is available within the verified session scope.',
    modelAllowed: true,
    mutationAllowed: false,
  },
  modelRoute: {
    state: 'COMPLETED',
    provider: 'OPENAI',
    model: 'gpt-test-2026-08-01',
    inputTokens: 142,
    outputTokens: 31,
    totalTokens: 173,
    latencyMs: 286,
  },
  agentRegistry: {
    entryKey: 'DWP_ASSISTANT',
    revision: 2,
    artifactVersion: 'ask-runtime-v1',
    riskTier: 'MEDIUM',
    resolution: 'ACTIVE',
  },
  statusCode: 'ANSWER_GROUNDED',
  completedAt: '2026-08-11T01:00:01Z',
} as const;

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', data });
}

export async function mockWorkspaceRuntime(page: Page): Promise<void> {
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ contentType: 'application/json', body: success(WORKSPACE_QUEUE_FIXTURE) })
  );
  await page.route('**/api/platform/v1/workspace/activity', (route) =>
    route.fulfill({ contentType: 'application/json', body: success(WORKSPACE_ACTIVITY_FIXTURE) })
  );
  await page.route('**/api/platform/v1/workspace/apps', (route) =>
    route.fulfill({ contentType: 'application/json', body: success(WORKSPACE_APPS_FIXTURE) })
  );
  await page.route('**/api/platform/v1/workspace/apps/*/launch', (route) => {
    const appId = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    );
    const app = WORKSPACE_APPS_FIXTURE.find((candidate) => candidate.id === appId);
    return route.fulfill({
      status: app ? 200 : 404,
      contentType: 'application/json',
      body: success(
        app
          ? {
              appId,
              launchMode: app.launchMode,
              launchTarget: app.launchTarget,
              launchedAt: '2026-08-11T00:10:00Z',
            }
          : null
      ),
    });
  });
  await page.route('**/api/platform/v1/workspace/saved-views**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success(route.request().method() === 'GET' ? [] : null),
    })
  );
}

export async function mockAskRuntime(page: Page): Promise<void> {
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId?: unknown };
    const response = {
      ...ASK_RUNTIME_FIXTURE,
      requestId:
        typeof request.requestId === 'string' ? request.requestId : ASK_RUNTIME_FIXTURE.requestId,
    };
    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
    });
  });
  await page.route('**/api/agent/v1/ask', (route) => {
    const request = route.request().postDataJSON() as { requestId?: unknown };
    const response = {
      ...ASK_RUNTIME_FIXTURE,
      requestId:
        typeof request.requestId === 'string' ? request.requestId : ASK_RUNTIME_FIXTURE.requestId,
    };
    return route.fulfill({
      contentType: 'application/json',
      body: success(response),
    });
  });
}

export async function mockRuntimeCodeCatalog(page: Page): Promise<void> {
  await page.route('**/api/platform/v1/catalog/code-sets/**', (route) => {
    const codeSetKey = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop() ?? ''
    );
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: { codeSetKey, schemaVersion: 1, values: [] },
      }),
    });
  });
}

export async function mockShellNotificationRuntime(page: Page): Promise<void> {
  await page.route('**/api/notifications/v1/stream**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: ': connected\n\n',
    })
  );
  await page.route('**/api/notifications/v1/summary**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        partial: false,
        unavailableSources: [],
        message: null,
        actionableUnread: 0,
        totalUnread: 0,
        viewCounts: { PRIORITY: 0, ALL: 0, MENTIONS: 0, SAVED: 0, SNOOZED: 0, DONE: 0 },
        changeVersion: '0',
        counterVersion: '0',
        generatedAt: '2026-08-24T00:00:00Z',
      }),
    })
  );
  await page.route('**/api/notifications/v1/me/delivery-profile', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        channels: {
          IN_APP: true,
          EMAIL: false,
          WEB_PUSH: false,
          MOBILE_PUSH: false,
          TEAMS: false,
          SLACK: false,
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '07:00',
          timeZone: 'Asia/Seoul',
          days: [1, 2, 3, 4, 5, 6, 7],
          allowUrgentBypass: true,
        },
        digest: { mode: 'OFF', deliveryTime: '09:00', dayOfWeek: null },
        presentation: { bannerMode: 'SMART', previewMode: 'FULL' },
        version: '0',
        updatedAt: '2026-08-24T00:00:00Z',
      }),
    })
  );
  await page.route('**/api/notifications/v1/me/effective-settings', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        partial: false,
        unavailableSources: [],
        globalChannels: {},
        apps: [],
        generatedAt: '2026-08-24T00:00:00Z',
      }),
    })
  );
}

export async function mockAuthenticatedRuntime(page: Page): Promise<void> {
  await mockLegacyProductSurfaceAuthority(page);
  await mockShellNotificationRuntime(page);
  await mockRuntimeCodeCatalog(page);
  await mockWorkspaceRuntime(page);
  await page.route('**/api/platform/v1/observability/web-vitals', (route) =>
    route.fulfill({ status: 202, body: '' })
  );
  await page.route('**/api/platform/v1/search/audit', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({ eventId: 'search-audit-event', queryDigest: '0'.repeat(64) }),
    })
  );
  await page.route('**/api/auth/policy', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        localLoginAvailable: true,
        ssoLoginAvailable: false,
        preferredLoginType: 'LOCAL',
      }),
    })
  );
  await page.route(/\/api\/platform\/v1\/admin\/catalog(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        entityCount: 0,
        relationCount: 0,
        declaredRelationCount: 0,
        orphanCount: 0,
        criticalRelationCount: 0,
        entitiesByKind: {},
        entitiesByLifecycle: {},
        entities: [],
        generatedAt: '2026-08-11T00:10:00Z',
      }),
    })
  );
  await page.route('**/api/people/v1/people**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        items: [],
        nextCursor: null,
        size: 20,
        hasMore: false,
        asOf: '2026-08-11',
      }),
    })
  );
  await page.route('**/api/people/v1/org-chart**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: success({
        asOf: '2026-08-11',
        company: {
          organizationId: 'org-default',
          organizationKey: 'DEFAULT',
          name: 'SKAX',
        },
        scenario: null,
        organizations: [],
        people: [],
        positions: [],
        relationships: [],
        openPositions: [],
      }),
    })
  );
  await page.route('**/api/auth/session/refresh', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: {
          rotated: true,
          idleExpiresAt: '2026-08-11T01:00:00Z',
          expiresAt: '2026-08-11T08:00:00Z',
        },
      }),
    })
  );
}

export async function mockRuntimeNavigation(page: Page): Promise<void> {
  await mockAuthenticatedRuntime(page);
  await page.route('**/api/platform/v1/navigation?*', (route) => {
    const locale = new URL(route.request().url()).searchParams.get('locale') ?? 'en';
    const korean = locale.toLowerCase().startsWith('ko');
    const apps = [
      ['work', korean ? '업무' : 'Work', '/work', 'APP.WORK'],
      ['ask', 'DWAI·ON', '/dwaion', 'APP.ASK'],
      ['activity', korean ? '활동' : 'Activity', '/activity', 'APP.ACTIVITY'],
      ['apps', korean ? '앱' : 'Apps', '/apps', 'APP.APPS'],
    ].map(([navigationKey, label, routePath, resourceKey]) => ({
      navigationKey,
      itemType: 'APP',
      label,
      registryEntryKey: `DWP_${navigationKey.toUpperCase()}`,
      route: routePath,
      iconKey: navigationKey,
      requiredResourceKey: resourceKey,
      requiredPermissionCode: 'VIEW',
      children: [],
    }));

    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'SUCCESS',
        message: 'OK',
        data: [
          {
            navigationKey: 'workspace',
            itemType: 'GROUP',
            label: korean ? '업무' : 'Workspace',
            requiredPermissionCode: 'VIEW',
            children: apps,
          },
        ],
      }),
    });
  });
}
