import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockAuditSession(page: Page) {
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

  await page.route('**/api/platform/v1/admin/audit-control/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

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
        linkedEvents: 0,
        linkedFindings: 0,
      };
      cases = [...cases, created];
      return fulfillJson(route, created);
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

  await expect(page.getByRole('heading', { name: 'Audit posture', level: 1 })).toBeVisible();
  await expect(page.getByText('1,284', { exact: true })).toBeVisible();
  await expect(page.getByText('4/5', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Source coverage' })).toContainText(
    'dwp-agent-runtime'
  );

  let accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/admin/governance/audit-events');
  await expect(page.getByRole('heading', { name: 'Event explorer', level: 1 })).toBeVisible();
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

  await expect(page.getByRole('heading', { name: 'Findings and cases', level: 1 })).toBeVisible();
  await expect(page.getByText('Repeated privileged access denials', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New case' }).click();
  await page.getByLabel('Case title').fill('Quarterly privileged role review');
  await page
    .getByLabel('Case description')
    .fill('Investigate repeated denied role assignment attempts.');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Investigation case created.')).toBeVisible();

  await page.getByRole('button', { name: /Cases/ }).click();
  await expect(page.getByText('Quarterly privileged role review', { exact: true })).toBeVisible();

  let accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/admin/governance/audit-governance');
  await expect(
    page.getByRole('heading', { name: 'Retention and integrity', level: 1 })
  ).toBeVisible();
  await expect(page.getByText('Append-only evidence store', { exact: true })).toBeVisible();
  await page.getByLabel('Standard retention (days)').fill('730');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Audit policy saved.')).toBeVisible();
  await page.getByRole('button', { name: 'Verify now' }).click();
  await expect(page.getByText('Integrity checkpoint verified.')).toBeVisible();

  accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(accessibility.violations).toEqual([]);
});
