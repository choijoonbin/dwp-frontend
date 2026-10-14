import { expect, test, type Page, type Route } from '@playwright/test';

import { adminEnvelope, mockAdminSession } from './support/admin-session';

const EVENT_ID = '10000000-0000-4000-8000-000000000001';
const HCM_AUDIT_PATH = '/api/platform/v1/admin/audit-control';

const evidence = {
  eventId: EVENT_ID,
  occurredAt: '2026-10-14T04:20:00Z',
  category: 'POLICY_DENIED',
  action: 'WORKER.UPDATE.DENIED',
  outcome: 'DENIED',
  severity: 'CRITICAL',
  actorType: 'USER',
  sourceService: 'people',
  sourceModule: 'hris.people.worker',
  aggregateType: 'WORKER',
  aggregateRevision: 7,
  effectiveCapability: 'HCM.WORKER.UPDATE',
  purposeCode: 'HR_OPERATIONS',
  authorizationDecisionRef: 'decision:42',
  scopeRevision: 3,
  fieldPolicyRevision: 5,
  approvalReceiptId: null,
  reasonCode: 'POLICY_SCOPE_DENIED',
  beforeDigest: 'a'.repeat(64),
  afterDigest: 'b'.repeat(64),
  evidenceDigest: 'c'.repeat(64),
  classification: 'CONFIDENTIAL',
  retentionClass: 'EXTENDED',
  causationId: '20000000-0000-4000-8000-000000000002',
  correlationId: '30000000-0000-4000-8000-000000000003',
  recordHash: 'd'.repeat(64),
};

function evidencePage() {
  return {
    items: [evidence],
    size: 1,
    snapshotAt: '2026-10-14T04:21:00Z',
    nextCursor: null,
  };
}

async function fulfill(route: Route, data: unknown) {
  await route.fulfill({ contentType: 'application/json', body: adminEnvelope(data) });
}

async function mockHcmAuditEvidence(page: Page, requests: URL[], detailFailureStatus?: 403 | 503) {
  await page.route(`**${HCM_AUDIT_PATH}/**`, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);

    if (url.pathname === `${HCM_AUDIT_PATH}/events/${EVENT_ID}`) {
      if (detailFailureStatus) {
        await route.fulfill({
          status: detailFailureStatus,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Evidence unavailable' }),
        });
        return;
      }
      await fulfill(route, evidence);
      return;
    }
    if (url.pathname === `${HCM_AUDIT_PATH}/events`) {
      await fulfill(route, evidencePage());
      return;
    }

    await route.fulfill({
      status: 418,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Generic audit endpoint is forbidden' }),
    });
  });
}

function expectFixedHcmSelector(requests: URL[]) {
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.searchParams.getAll('product')).toEqual(['HCM']);
    expect([`${HCM_AUDIT_PATH}/events`, `${HCM_AUDIT_PATH}/events/${EVENT_ID}`]).toContain(
      request.pathname
    );
  }
}

test('SYS-001 renders only minimized HCM evidence and keeps the fixed HRIS return', async ({
  page,
}) => {
  const requests: URL[] = [];
  await mockAdminSession(page);
  await mockHcmAuditEvidence(page, requests);

  await page.goto('/admin/governance/audit-overview?product=HCM&tab=overview');

  await expect(page.getByRole('heading', { name: 'HRIS audit evidence' })).toBeVisible();
  await expect(page.getByText('WORKER.UPDATE.DENIED')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to HRIS' })).toHaveAttribute(
    'href',
    '/hr/home'
  );
  await expect(page.getByText('Command posture')).toHaveCount(0);

  await page.getByRole('button', { name: /WORKER\.UPDATE\.DENIED/u }).click();

  await expect(page).toHaveURL(new RegExp(`focus=${EVENT_ID}`, 'u'));
  await expect(page.getByRole('heading', { name: 'Evidence detail' })).toBeVisible();
  await expect(page.getByText('HCM.WORKER.UPDATE')).toBeVisible();
  await expect(page.getByText('Critical')).toBeVisible();
  expectFixedHcmSelector(requests);
});

for (const status of [403, 503] as const) {
  test(`SYS-001 hides all HCM evidence after a detail ${status} without generic fallback`, async ({
    page,
  }) => {
    const requests: URL[] = [];
    await mockAdminSession(page);
    await mockHcmAuditEvidence(page, requests, status);

    await page.goto(`/admin/governance/audit-overview?product=HCM&tab=overview&focus=${EVENT_ID}`);

    await expect(page.getByText('WORKER.UPDATE.DENIED')).toHaveCount(0);
    await expect(page.getByText('HCM.WORKER.UPDATE')).toHaveCount(0);
    await expect(
      page.getByText(
        status === 403
          ? 'Your current governed HRIS audit scope does not allow this evidence.'
          : 'HRIS audit evidence is temporarily unavailable. No generic audit data was substituted.'
      )
    ).toBeVisible();
    await expect(page.getByText('Command posture')).toHaveCount(0);
    expectFixedHcmSelector(requests);
  });
}
