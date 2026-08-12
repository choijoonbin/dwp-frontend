import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockAuthenticatedRuntime } from './support/runtime-access';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockAuditSession(page: Page) {
  await mockAuthenticatedRuntime(page);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 1,
        displayName: 'Admin User',
        jobTitle: 'Platform administrator',
        email: 'admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
        roles: ['ADMIN', 'AUDIT_ADMIN'],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope(
        [
          ['APP.ADMINISTRATION', 'VIEW'],
          ['ADMIN.AUDIT_VIEW', 'VIEW'],
          ['ADMIN.AUDIT_INVESTIGATE', 'UPDATE'],
          ['ADMIN.AUDIT_CONFIGURE', 'MANAGE'],
          ['ADMIN.AUDIT_EXPORT', 'EXPORT'],
        ].map(([resourceKey, permissionCode]) => ({
          resourceType: resourceKey.startsWith('APP.') ? 'APP' : 'ADMIN',
          resourceKey,
          permissionCode,
          effect: 'ALLOW',
        }))
      ),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ organizationName: null, logoUrl: null, version: 0 }),
    })
  );
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        schemaVersion: 1,
        customized: false,
        preferences: {
          appearance: { mode: 'system', density: 'standard' },
          accessibility: { highContrast: false, reduceMotion: false },
        },
        version: 0,
        updatedAt: null,
      }),
    })
  );
}

const auditEvent = {
  eventId: '20000000-0000-0000-0000-000000000001',
  occurredAt: '2026-08-10T12:04:00Z',
  ingestedAt: '2026-08-10T12:04:01Z',
  tenantId: 1,
  category: 'POLICY_DENIED',
  action: 'role.assignment.denied',
  outcome: 'DENIED',
  severity: 'HIGH',
  riskScore: 82,
  actorType: 'USER',
  actorId: '1',
  actorPrincipal: 'admin@dwp.local',
  actorDisplayName: 'Admin User',
  actorRoles: ['ADMIN', 'AUDIT_ADMIN'],
  sourceService: 'dwp-auth-server',
  sourceModule: 'access-control',
  sourceInstance: 'auth-local',
  environment: 'test',
  targetType: 'ROLE_ASSIGNMENT',
  targetId: 'user:128:SUPER_ADMIN',
  targetDisplayName: 'SUPER_ADMIN assignment',
  reason: 'Policy requires provider approval',
  correlationId: 'audit-control-e2e',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  authenticationMethod: 'SESSION',
  policyId: 'privileged-role-assignment',
  policyDecision: 'DENY',
  approvalId: null,
  beforeState: { roles: ['EMPLOYEE'] },
  afterState: { roles: ['EMPLOYEE'] },
  changedFields: ['roles'],
  metadata: { channel: 'control-center', classification: 'restricted' },
  retentionClass: 'EXTENDED',
  recordHash: 'a'.repeat(64),
};

const eventCorrelation = {
  correlationId: 'audit-control-e2e',
  firstOccurredAt: '2026-08-10T12:00:00Z',
  lastOccurredAt: auditEvent.occurredAt,
  eventCount: 2,
  domainCount: 2,
  serviceCount: 2,
  domains: ['IDENTITY_ACCESS', 'PLATFORM_WORKSPACE'],
  classifications: ['CONFIDENTIAL', 'RESTRICTED'],
  sourceServices: ['dwp-auth-server', 'dwp-platform-server'],
  outcomes: ['SUCCESS', 'DENIED'],
  latestEventType: auditEvent.action,
  latestSubjectType: auditEvent.targetType,
  latestSubjectId: auditEvent.targetId,
  latestSubjectDisplayName: auditEvent.targetDisplayName,
  maxSeverity: 'HIGH',
  maxRiskScore: 82,
  attentionRequired: true,
};

const eventEnvelopes = [
  {
    eventId: '10000000-0000-0000-0000-000000000001',
    eventType: 'user.authenticated',
    schemaVersion: '1.0',
    occurredAt: '2026-08-10T12:00:00Z',
    ingestedAt: '2026-08-10T12:00:01Z',
    tenantId: 1,
    domain: 'IDENTITY_ACCESS',
    classification: 'CONFIDENTIAL',
    sourceService: 'dwp-auth-server',
    sourceModule: 'session',
    subjectType: 'USER',
    subjectId: '1',
    subjectDisplayName: 'Admin User',
    actorType: 'USER',
    actorId: '1',
    actorDisplayName: 'Admin User',
    outcome: 'SUCCESS',
    severity: 'INFO',
    riskScore: 8,
    correlationId: 'audit-control-e2e',
    causationId: null,
    traceId: auditEvent.traceId,
    beforeState: {},
    afterState: { sessionState: 'AUTHENTICATED' },
    metadata: { authenticationMethod: 'SESSION' },
    recordHash: 'b'.repeat(64),
  },
  {
    eventId: auditEvent.eventId,
    eventType: auditEvent.action,
    schemaVersion: '1.0',
    occurredAt: auditEvent.occurredAt,
    ingestedAt: auditEvent.ingestedAt,
    tenantId: auditEvent.tenantId,
    domain: 'PLATFORM_WORKSPACE',
    classification: 'RESTRICTED',
    sourceService: 'dwp-platform-server',
    sourceModule: 'authorization',
    subjectType: auditEvent.targetType,
    subjectId: auditEvent.targetId,
    subjectDisplayName: auditEvent.targetDisplayName,
    actorType: auditEvent.actorType,
    actorId: auditEvent.actorId,
    actorDisplayName: auditEvent.actorDisplayName,
    outcome: auditEvent.outcome,
    severity: auditEvent.severity,
    riskScore: auditEvent.riskScore,
    correlationId: 'audit-control-e2e',
    causationId: '10000000-0000-0000-0000-000000000001',
    traceId: auditEvent.traceId,
    beforeState: auditEvent.beforeState,
    afterState: auditEvent.afterState,
    metadata: auditEvent.metadata,
    recordHash: auditEvent.recordHash,
  },
];

const finding = {
  findingId: '30000000-0000-0000-0000-000000000001',
  eventId: auditEvent.eventId,
  findingType: 'PRIVILEGED_ACCESS',
  ruleKey: 'privileged-denial-burst',
  severity: 'HIGH',
  riskScore: 82,
  status: 'OPEN',
  title: 'Repeated privileged access denials',
  description: 'A privileged role assignment was denied and requires accountable review.',
  sourceService: 'dwp-auth-server',
  actorId: '1',
  targetType: 'ROLE_ASSIGNMENT',
  targetId: 'user:128:SUPER_ADMIN',
  occurrenceCount: 3,
  firstSeenAt: '2026-08-10T11:58:00Z',
  lastSeenAt: '2026-08-10T12:04:00Z',
  assignedTo: null,
  caseId: null,
  resolution: null,
  updatedAt: '2026-08-10T12:04:01Z',
};

const initialCase = {
  caseId: '40000000-0000-0000-0000-000000000001',
  caseNumber: 1042,
  title: 'Privileged access review',
  description: 'Validate denied role assignment activity.',
  severity: 'HIGH',
  status: 'INVESTIGATING',
  ownerActorId: '1',
  resolution: null,
  openedAt: '2026-08-10T12:10:00Z',
  dueAt: '2026-08-11T12:10:00Z',
  slaState: 'ON_TRACK',
  closedAt: null,
  createdBy: '1',
  updatedBy: '1',
  updatedAt: '2026-08-10T12:10:00Z',
  linkedEvents: 1,
  linkedFindings: 1,
};

const policy = {
  standardRetentionDays: 365,
  extendedRetentionDays: 2555,
  exportLimitRows: 10000,
  requireExportReason: true,
  integrityEnabled: true,
  highRiskThreshold: 70,
  updatedBy: 'audit-admin',
  updatedAt: '2026-08-10T12:00:00Z',
};

const checkpoint = {
  checkpointId: '50000000-0000-0000-0000-000000000001',
  checkpointDate: '2026-08-10',
  recordCount: 1284,
  firstEventAt: '2026-08-10T00:00:01Z',
  lastEventAt: '2026-08-10T12:04:01Z',
  rootHash: 'b'.repeat(64),
  checkpointHash: 'c'.repeat(64),
  signatureAlgorithm: 'SHA-256',
  verificationStatus: 'VERIFIED',
  createdAt: '2026-08-10T12:12:00Z',
  verifiedAt: '2026-08-10T12:12:00Z',
};

async function fulfillJson(route: Route, data: unknown) {
  await route.fulfill({ contentType: 'application/json', body: envelope(data) });
}

async function mockAuditControl(page: Page) {
  let findings = [{ ...finding }];
  let cases = [{ ...initialCase }];
  let currentPolicy = { ...policy };
  let checkpoints = [{ ...checkpoint }];
  let savedSearches: Array<Record<string, unknown>> = [];
  let caseTasks = [
    {
      taskId: '80000000-0000-0000-0000-000000000001',
      title: 'Validate actor privileges',
      description: 'Confirm the effective role path with the identity owner.',
      status: 'OPEN',
      priority: 'HIGH',
      ownerActorId: '1',
      dueAt: '2026-08-11T08:00:00Z',
      completedAt: null,
      createdBy: '1',
      updatedBy: '1',
      createdAt: '2026-08-10T12:12:00Z',
      updatedAt: '2026-08-10T12:12:00Z',
    },
  ];
  let caseActivities = [
    {
      activityId: '81000000-0000-0000-0000-000000000001',
      activityType: 'CASE_CREATED',
      actorId: '1',
      message: 'Investigation case created',
      payload: {},
      occurredAt: '2026-08-10T12:10:00Z',
    },
    {
      activityId: '81000000-0000-0000-0000-000000000002',
      activityType: 'EVIDENCE_LINKED',
      actorId: '1',
      message: 'Primary evidence preserved',
      payload: { eventId: auditEvent.eventId },
      occurredAt: '2026-08-10T12:11:00Z',
    },
  ];

  const workspaceFor = (caseId: string) => {
    const auditCase = cases.find((item) => item.caseId === caseId) ?? cases[0];
    return {
      auditCase,
      summary: {
        maxRiskScore: 82,
        openTasks: caseTasks.filter((task) => task.status !== 'DONE').length,
        overdueTasks: 0,
        evidenceCount: 1,
        findingCount: 1,
        entityCount: 3,
      },
      findings: [findings[0]],
      evidence: [auditEvent],
      entities: [
        {
          entityType: 'USER',
          entityId: '1',
          displayName: 'Admin User',
          relationship: 'ACTOR',
          riskScore: 82,
          firstSeenAt: auditEvent.occurredAt,
          lastSeenAt: auditEvent.occurredAt,
          attributes: {},
        },
        {
          entityType: 'RESOURCE',
          entityId: auditEvent.targetId,
          displayName: auditEvent.targetDisplayName,
          relationship: 'TARGET',
          riskScore: 82,
          firstSeenAt: auditEvent.occurredAt,
          lastSeenAt: auditEvent.occurredAt,
          attributes: {},
        },
        {
          entityType: 'SERVICE',
          entityId: auditEvent.sourceService,
          displayName: auditEvent.sourceService,
          relationship: 'SOURCE',
          riskScore: 82,
          firstSeenAt: auditEvent.occurredAt,
          lastSeenAt: auditEvent.occurredAt,
          attributes: {},
        },
      ],
      activities: caseActivities,
      tasks: caseTasks,
    };
  };

  await page.route('**/api/platform/v1/admin/audit-control/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/event-correlations/detail') && method === 'GET') {
      return fulfillJson(route, { summary: eventCorrelation, events: eventEnvelopes });
    }
    if (path.endsWith('/event-correlations') && method === 'GET') {
      return fulfillJson(route, {
        content: [eventCorrelation],
        page: Number(url.searchParams.get('page') || 0),
        size: Number(url.searchParams.get('size') || 25),
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path.endsWith('/saved-searches') && method === 'GET') {
      return fulfillJson(route, savedSearches);
    }
    if (path.endsWith('/saved-searches') && method === 'POST') {
      const payload = request.postDataJSON();
      const saved = {
        savedSearchId: '70000000-0000-0000-0000-000000000001',
        name: payload.name,
        criteria: {
          window: payload.window,
          category: payload.category,
          severity: payload.severity,
          outcome: payload.outcome,
          sourceService: payload.sourceService,
          actor: payload.actor,
          query: payload.query,
        },
        shared: payload.shared,
        editable: true,
        ownerActorId: '1',
        createdAt: '2026-08-10T12:00:00Z',
        updatedAt: '2026-08-10T12:00:00Z',
      };
      savedSearches = [saved];
      return fulfillJson(route, saved);
    }
    if (path.includes('/saved-searches/') && method === 'DELETE') {
      savedSearches = [];
      return fulfillJson(route, null);
    }

    if (path.endsWith('/overview')) {
      return fulfillJson(route, {
        window: url.searchParams.get('window') || 'D7',
        from: '2026-08-03T12:00:00Z',
        to: '2026-08-10T12:00:00Z',
        generatedAt: '2026-08-10T12:05:00Z',
        summary: {
          totalEvents: 1284,
          highRiskEvents: 14,
          deniedEvents: 23,
          failedEvents: 7,
          openFindings: findings.filter((item) => item.status !== 'RESOLVED').length,
          activeCases: cases.filter((item) => item.status !== 'CLOSED').length,
          healthySources: 4,
          registeredSources: 5,
        },
        trend: [
          { bucket: '2026-08-08T00:00:00Z', total: 342, highRisk: 3, denied: 5 },
          { bucket: '2026-08-09T00:00:00Z', total: 416, highRisk: 5, denied: 8 },
          { bucket: '2026-08-10T00:00:00Z', total: 526, highRisk: 6, denied: 10 },
        ],
        categories: [
          { key: 'AUTHENTICATION', count: 482 },
          { key: 'ADMIN_CHANGE', count: 328 },
          { key: 'DATA_ACCESS', count: 274 },
          { key: 'AI_ACTION', count: 200 },
        ],
        outcomes: [
          { key: 'SUCCESS', count: 1254 },
          { key: 'DENIED', count: 23 },
          { key: 'FAILED', count: 7 },
        ],
        topActors: [{ key: 'admin@dwp.local', count: 64 }],
        attention: findings,
        sources: [
          {
            sourceService: 'dwp-auth-server',
            lastEventAt: '2026-08-10T12:04:00Z',
            lastIngestedAt: '2026-08-10T12:04:01Z',
            eventCount24h: 486,
            rejectedCount24h: 0,
            deliveryStatus: 'HEALTHY',
            lastError: null,
          },
          {
            sourceService: 'dwp-agent-runtime',
            lastEventAt: '2026-08-10T11:58:00Z',
            lastIngestedAt: '2026-08-10T11:58:01Z',
            eventCount24h: 122,
            rejectedCount24h: 0,
            deliveryStatus: 'HEALTHY',
            lastError: null,
          },
        ],
      });
    }
    if (path.endsWith(`/events/${auditEvent.eventId}`)) return fulfillJson(route, auditEvent);
    if (path.endsWith('/events')) {
      return fulfillJson(route, {
        content: [auditEvent],
        page: Number(url.searchParams.get('page') || 0),
        size: Number(url.searchParams.get('size') || 50),
        totalElements: 1,
        totalPages: 1,
      });
    }
    if (path.endsWith('/findings') && method === 'GET') return fulfillJson(route, findings);
    if (path.endsWith(`/findings/${finding.findingId}/context`) && method === 'GET') {
      return fulfillJson(route, {
        finding: findings[0],
        primaryEvent: auditEvent,
        relatedEvents: [],
      });
    }
    if (path.includes('/findings/') && method === 'PATCH') {
      const update = request.postDataJSON();
      findings = findings.map((item) =>
        path.endsWith(item.findingId)
          ? { ...item, ...update, updatedAt: '2026-08-10T12:20:00Z' }
          : item
      );
      return fulfillJson(route, findings[0]);
    }
    if (path.endsWith('/cases') && method === 'GET') return fulfillJson(route, cases);
    if (path.endsWith('/cases') && method === 'POST') {
      const requestCase = request.postDataJSON();
      const created = {
        ...initialCase,
        ...requestCase,
        caseId: '40000000-0000-0000-0000-000000000002',
        caseNumber: 1043,
        status: 'OPEN',
        dueAt: '2026-08-11T12:20:00Z',
        slaState: 'ON_TRACK',
        linkedEvents: 0,
        linkedFindings: 0,
      };
      cases = [...cases, created];
      return fulfillJson(route, created);
    }
    const workspaceMatch = path.match(/\/cases\/([^/]+)\/workspace$/u);
    if (workspaceMatch && method === 'GET') {
      return fulfillJson(route, workspaceFor(workspaceMatch[1]));
    }
    const noteMatch = path.match(/\/cases\/([^/]+)\/notes$/u);
    if (noteMatch && method === 'POST') {
      const payload = request.postDataJSON();
      caseActivities = [
        {
          activityId: `81000000-0000-0000-0000-${String(caseActivities.length + 1).padStart(12, '0')}`,
          activityType: 'NOTE_ADDED',
          actorId: '1',
          message: payload.message,
          payload: {},
          occurredAt: '2026-08-10T12:26:00Z',
        },
        ...caseActivities,
      ];
      return fulfillJson(route, workspaceFor(noteMatch[1]));
    }
    const taskCollectionMatch = path.match(/\/cases\/([^/]+)\/tasks$/u);
    if (taskCollectionMatch && method === 'POST') {
      const payload = request.postDataJSON();
      const created = {
        taskId: `80000000-0000-0000-0000-${String(caseTasks.length + 1).padStart(12, '0')}`,
        title: payload.title,
        description: payload.description ?? null,
        status: 'OPEN',
        priority: payload.priority,
        ownerActorId: payload.ownerActorId ?? null,
        dueAt: payload.dueAt ?? null,
        completedAt: null,
        createdBy: '1',
        updatedBy: '1',
        createdAt: '2026-08-10T12:25:00Z',
        updatedAt: '2026-08-10T12:25:00Z',
      };
      caseTasks = [...caseTasks, created];
      return fulfillJson(route, created);
    }
    const taskMatch = path.match(/\/cases\/([^/]+)\/tasks\/([^/]+)$/u);
    if (taskMatch && method === 'PATCH') {
      const payload = request.postDataJSON();
      caseTasks = caseTasks.map((task) =>
        task.taskId === taskMatch[2]
          ? {
              ...task,
              ...payload,
              completedAt: payload.status === 'DONE' ? '2026-08-10T12:27:00Z' : null,
              updatedAt: '2026-08-10T12:27:00Z',
            }
          : task
      );
      return fulfillJson(
        route,
        caseTasks.find((task) => task.taskId === taskMatch[2])
      );
    }
    const eventLinkMatch = path.match(/\/cases\/([^/]+)\/events$/u);
    if (eventLinkMatch && method === 'POST') {
      caseActivities = [
        {
          activityId: `81000000-0000-0000-0000-${String(caseActivities.length + 1).padStart(12, '0')}`,
          activityType: 'EVIDENCE_LINKED',
          actorId: '1',
          message: request.postDataJSON().note || 'Evidence preserved',
          payload: request.postDataJSON(),
          occurredAt: '2026-08-10T12:28:00Z',
        },
        ...caseActivities,
      ];
      return fulfillJson(
        route,
        cases.find((item) => item.caseId === eventLinkMatch[1])
      );
    }
    if (path.includes('/cases/') && method === 'PATCH') {
      const update = request.postDataJSON();
      cases = cases.map((item) =>
        path.endsWith(item.caseId)
          ? { ...item, ...update, updatedAt: '2026-08-10T12:25:00Z' }
          : item
      );
      return fulfillJson(
        route,
        cases.find((item) => path.endsWith(item.caseId))
      );
    }
    if (path.endsWith('/policy') && method === 'GET') return fulfillJson(route, currentPolicy);
    if (path.endsWith('/policy') && method === 'PUT') {
      currentPolicy = {
        ...currentPolicy,
        ...request.postDataJSON(),
        updatedBy: '1',
        updatedAt: '2026-08-10T12:30:00Z',
      };
      return fulfillJson(route, currentPolicy);
    }
    if (path.endsWith('/integrity') && method === 'GET') return fulfillJson(route, checkpoints);
    if (path.endsWith('/integrity/checkpoint') && method === 'POST') {
      checkpoints = [
        { ...checkpoint, checkpointId: '50000000-0000-0000-0000-000000000002' },
        ...checkpoints,
      ];
      return fulfillJson(route, checkpoints);
    }
    if (path.endsWith('/exports') && method === 'POST') {
      return fulfillJson(route, {
        exportJobId: '60000000-0000-0000-0000-000000000001',
        format: request.postDataJSON().format,
        status: 'COMPLETED',
        rowCount: 1,
      });
    }
    if (path.includes('/exports/') && path.endsWith('/content')) {
      return route.fulfill({
        contentType: 'text/csv',
        body: 'occurred_at,action,outcome\n2026-08-10T12:04:00Z,role.assignment.denied,DENIED\n',
      });
    }
    return route.abort('failed');
  });
}

test.beforeEach(async ({ page }) => {
  await mockAuditSession(page);
  await mockAuditControl(page);
});

test('auditors assess posture, inspect immutable evidence, and export a governed extract', async ({
  page,
}) => {
  await page.goto('/admin/governance/audit-overview');

  await expect(page.getByRole('heading', { name: 'Audit command center', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operational audit posture' })).toBeVisible();
  await expect(page.getByText('1,284', { exact: true })).toBeVisible();
  await expect(page.getByText('4/5', { exact: true })).toBeVisible();
  await expect(page.getByText('Priority action queue')).toBeVisible();
  await expect(page.getByText('dwp-agent-runtime', { exact: true })).toBeVisible();

  let accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/admin/governance/audit-events');
  await expect(page.getByRole('heading', { name: 'Evidence explorer', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Cross-domain incident flows', level: 2 })
  ).toBeVisible();
  const desktop = (page.viewportSize()?.width ?? 0) >= 1200;
  if (desktop) {
    await expect(page.getByRole('grid', { name: 'Cross-domain incident flows' })).toBeVisible();
  } else {
    await page.getByText('Role Assignment Denied', { exact: true }).first().click();
  }
  await expect(page.getByText('Role Assignment Denied', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Causal timeline', { exact: true })).toBeVisible();
  await expect(page.getByText('audit-control-e2e', { exact: true })).toBeVisible();

  accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  if (!desktop) await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Raw evidence' }).click();
  await expect(page.getByText('Evidence search session')).toBeVisible();
  await expect(page.getByText('Role Assignment Denied', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save current view' }).click();
  await page.getByLabel('View name').fill('Privileged access review');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Investigation view saved.')).toBeVisible();
  await expect(page.getByLabel('Saved views')).toHaveText(/Privileged access review/);
  await page.getByText('Role Assignment Denied', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Role Assignment Denied', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('audit-control-e2e', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Export evidence' }).click();
  await page.getByLabel('Business reason').fill('Quarterly privileged access review');
  await page.getByRole('button', { name: 'Create and download' }).click();
  await expect(page.getByText('Exported 1 evidence rows.')).toBeVisible();

  accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});

test('audit administrators investigate findings and govern retention integrity', async ({
  page,
}) => {
  await page.goto('/admin/governance/audit-investigations');

  await expect(
    page.getByRole('heading', { name: 'Investigation workbench', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Prioritized signals')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Repeated privileged access denials', level: 2 })
  ).toBeVisible();
  await expect(page.getByText('Why this matters')).toBeVisible();
  await expect(page.getByText('Observed entity path')).toBeVisible();
  await page.getByRole('button', { name: 'New case' }).click();
  await page.getByLabel('Case title').fill('Quarterly privileged role review');
  await page
    .getByLabel('Case description')
    .fill('Investigate repeated denied role assignment attempts.');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Investigation case created.')).toBeVisible();

  await page.getByRole('button', { name: /Case workspace/ }).click();
  await expect(page.getByText('Quarterly privileged role review', { exact: true })).toBeVisible();
  await expect(page.getByText('Investigation scope')).toBeVisible();
  await expect(page.getByText('Investigation journal')).toBeVisible();

  await page.getByLabel('New investigation task').fill('Confirm business approver');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Investigation task added.')).toBeVisible();
  await expect(page.getByText('Confirm business approver', { exact: true })).toBeVisible();

  await page
    .getByPlaceholder('Record an observation, decision, or handoff context')
    .fill('Identity owner confirmed that no approved change existed.');
  await page.getByRole('button', { name: 'Add to journal' }).click();
  await expect(page.getByText('Investigator note added.')).toBeVisible();
  await expect(
    page.getByText('Identity owner confirmed that no approved change existed.', { exact: true })
  ).toBeVisible();

  let accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/admin/governance/audit-governance');
  await expect(page.getByRole('heading', { name: 'Evidence governance', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence lifecycle' })).toBeVisible();
  await expect(page.getByText('Append-only evidence store', { exact: true })).toBeVisible();
  await page.getByLabel('Standard retention (days)').fill('730');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Audit policy saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Verify now' }).click();
  await expect(page.getByText('Integrity checkpoint verified.')).toBeVisible();

  accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});
