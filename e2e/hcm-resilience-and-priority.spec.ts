import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  HR_PAY_FIXTURE,
  HR_SERVICE_REQUESTS_FIXTURE,
  hrDomainOperationsFixture,
} from './support/product-area-fixtures';
import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
}

test('HR help puts requests needing employee input ahead of the service catalog', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  const base = HR_SERVICE_REQUESTS_FIXTURE[0];
  const activeRequests = Array.from({ length: 7 }, (_, index) => ({
    ...base,
    requestId: `active-request-${index}`,
    requestNumber: `HR-ACTIVE-${index}`,
    summary: `Active request ${index}`,
    status: 'IN_PROGRESS' as const,
    updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
  }));
  await page.route('**/api/platform/v1/services/requests?surface=hcm', (route) =>
    fulfillSuccess(route, [
      ...activeRequests,
      {
        ...base,
        requestId: 'request-needing-response',
        requestNumber: 'HR-NEEDS-RESPONSE',
        summary: 'Confirm dependent enrollment evidence',
        status: 'AWAITING_REQUESTER',
      },
    ])
  );

  await page.goto('/hr/services');

  await expect(page.getByText('1 HR request needs your response')).toBeVisible();
  const requestSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'My HR requests' }),
  });
  await expect(requestSection.getByRole('button', { name: /^Confirm dependent/u })).toContainText(
    'Confirm dependent enrollment evidence'
  );
  const sectionHeadings = await page.locator('section > div h2').allTextContents();
  expect(sectionHeadings.indexOf('My HR requests')).toBeLessThan(
    sectionHeadings.indexOf('How can we help?')
  );
});

test('HR help remains readable at the minimum width with 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await page.goto('/hr/services');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  await expect(page.getByRole('heading', { name: 'My HR requests' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('pay statements never expose a dead enabled action before secure document integration', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await page.route('**/api/people/v1/hr/pay', (route) =>
    fulfillSuccess(route, {
      ...HR_PAY_FIXTURE,
      statements: HR_PAY_FIXTURE.statements.map((statement) => ({
        ...statement,
        downloadable: true,
      })),
    })
  );

  await page.goto('/hr/pay');

  await expect(page.getByRole('button', { name: 'Open statement' })).toBeDisabled();
  await expect(page.getByText(/Secure statement access is being connected/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask payroll' })).toBeEnabled();
});

test('my HR profile preserves permission guidance and the support reference', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await page.route('**/api/people/v1/people/person-session-user**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        message: 'Directory access denied',
        correlationId: 'corr-profile-permission-403',
      }),
    })
  );

  await page.goto('/hr/me');

  await expect(page.getByTestId('hcm-query-state')).toHaveAttribute(
    'data-query-state',
    'permission'
  );
  await expect(
    page.getByRole('heading', { name: 'This HR information cannot be accessed safely' })
  ).toBeVisible();
  await expect(page.getByText('corr-profile-permission-403')).toBeVisible();
});

test('HR operations exposes the evaluated boundary and puts its decision queue first', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  await page.route('**/api/people/v1/hr/operations/TIME', (route) =>
    fulfillSuccess(route, {
      ...hrDomainOperationsFixture('TIME'),
      dataBoundary: 'ORGANIZATION_SET',
    })
  );

  await page.goto('/hr/operations/time');

  await expect(page.getByText('Allowed organization scope', { exact: true })).toBeVisible();
  const queue = page.getByRole('heading', { name: 'Time work queue' });
  const metrics = page.getByLabel('Operational metrics');
  await expect(queue).toBeVisible();
  await expect(metrics).toBeVisible();
  const metricsElement = await metrics.elementHandle();
  if (!metricsElement) throw new Error('Operational metrics element was not mounted.');
  const queuePrecedesMetrics = await queue.evaluate(
    (queueElement, target) =>
      Boolean(queueElement.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING),
    metricsElement
  );
  expect(queuePrecedesMetrics).toBe(true);

  await expect(page.getByText(/Submitted .*Request version 1/u)).toBeVisible();
  await expect(page.getByText('Period Aug 10, 2026 – Aug 16, 2026')).toBeVisible();
  await expect(page.getByText('40h recorded / 40h scheduled')).toBeVisible();
  await expect(page.getByText('0 open exceptions')).toBeVisible();
  await page
    .getByRole('button', {
      name: "Approve Minseo Kim's request: Weekly time card · 40h",
    })
    .click();
  const evidence = page.getByRole('region', { name: 'Decision evidence' });
  await expect(evidence).toContainText('Weekly time card · 40h');
  await expect(evidence).toContainText('40h recorded / 40h scheduled');
  await expect(evidence).toContainText('Request version 1');
});

test('HR approval queue remains usable at 320px with 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  await page.goto('/hr/operations/time');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  const summary = page.getByText('Product design lead · Weekly time card · 40h');
  const approve = page.getByRole('button', {
    name: "Approve Minseo Kim's request: Weekly time card · 40h",
  });
  await expect(summary).toBeVisible();
  await expect(approve).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const approveBounds = await approve.boundingBox();
  expect(approveBounds).not.toBeNull();
  expect((approveBounds?.x ?? 0) + (approveBounds?.width ?? 0)).toBeLessThanOrEqual(320);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('completed HR approval rows fail closed without decision actions', async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  const fixture = hrDomainOperationsFixture('TIME');
  await page.route('**/api/people/v1/hr/operations/TIME', (route) =>
    fulfillSuccess(route, {
      ...fixture,
      workQueue: fixture.workQueue.map((item) => ({ ...item, status: 'APPROVED' })),
    })
  );

  await page.goto('/hr/operations/time');

  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Minseo Kim's request/u })).toHaveCount(0);
});

test('approval conflicts close stale evidence and refresh the queue', async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  let queueReads = 0;
  await page.route('**/api/people/v1/hr/operations/TIME', (route) => {
    queueReads += 1;
    return fulfillSuccess(route, hrDomainOperationsFixture('TIME'));
  });
  await page.route('**/api/people/v1/hr/time/time-card-minseo-w33/decision', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        message: 'Request version changed',
        correlationId: 'hcm-approval-conflict-409',
      }),
    })
  );

  await page.goto('/hr/operations/time');
  await page
    .getByRole('button', {
      name: "Approve Minseo Kim's request: Weekly time card · 40h",
    })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Approve request' });
  await dialog.getByRole('textbox', { name: 'Decision reason' }).fill('Evidence reviewed');
  await dialog.getByRole('button', { name: 'Approve request' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(/The request changed.*review the latest evidence/u)).toBeVisible();
  await expect.poll(() => queueReads).toBeGreaterThan(1);
});

test('approval authority loss closes the dialog and removes decision actions', async ({ page }) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  await page.route('**/api/people/v1/hr/time/time-card-minseo-w33/decision', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ERROR',
        message: 'Approval authority changed',
        correlationId: 'hcm-approval-authority-403',
      }),
    })
  );

  await page.goto('/hr/operations/time');
  const actionName = "Approve Minseo Kim's request: Weekly time card · 40h";
  await page.getByRole('button', { name: actionName }).click();
  const dialog = page.getByRole('dialog', { name: 'Approve request' });
  await dialog.getByRole('textbox', { name: 'Decision reason' }).fill('Evidence reviewed');
  await dialog.getByRole('button', { name: 'Approve request' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Your approval authority changed/u)).toBeVisible();
  await expect(page.getByRole('button', { name: actionName })).toHaveCount(0);
});
