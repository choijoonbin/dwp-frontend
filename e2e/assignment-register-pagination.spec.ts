import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  FULL_PRODUCT_PERMISSIONS,
  fulfillSuccess,
  mockShellSession,
} from './support/shell-session';

import type { PersonDetail, PersonSummary } from '@dwp-frontend/shared-utils';

const MINA = {
  personId: 'person-mina',
  displayName: 'Mina Kim',
  lifecycleState: 'ACTIVE',
  workerNumber: 'W-1001',
  workerType: 'EMPLOYEE',
  workerStatus: 'ACTIVE',
  assignmentKey: 'ASG-MINA-PRIMARY',
  businessTitle: 'People operations lead',
  organizationId: 'org-people',
  organizationKey: 'PEOPLE',
  organizationName: 'People Operations',
  jobProfileName: 'People operations lead',
  managementLevel: 'MANAGER',
  jobGradeKey: 'G7',
  jobGradeName: 'Grade 7',
  locationKey: 'SEOUL-HQ',
  locationName: 'Seoul HQ',
  workEmail: 'mina.kim@example.invalid',
  profileImageKey: null,
  assignmentEffectiveFrom: '2026-01-01',
  managerPersonId: 'person-manager',
  managerDisplayName: 'Jordan Lee',
  directReportCount: 4,
  dataAccess: {
    classification: 'WORKFORCE',
    workerNumberMasked: false,
    excludedFieldGroups: [],
  },
} satisfies PersonSummary;

const ALEX = {
  ...MINA,
  personId: 'person-alex',
  displayName: 'Alex Park',
  workerNumber: 'W-1002',
  assignmentKey: 'ASG-ALEX-PRIMARY',
  businessTitle: 'HR data analyst',
  jobProfileName: 'HR data analyst',
  workEmail: 'alex.park@example.invalid',
  directReportCount: 0,
} satisfies PersonSummary;

const MINA_DETAIL = {
  person: MINA,
  originalHireDate: '2020-01-15',
  legalEmployerName: 'SKAX',
  managerAssignmentKey: 'ASG-JORDAN-PRIMARY',
  assignments: [
    {
      assignmentKey: 'ASG-MINA-PRIMARY',
      assignmentStatus: 'ACTIVE',
      primaryAssignment: true,
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: null,
      businessTitle: 'People operations lead',
      organizationName: 'People Operations',
      jobProfileName: 'People operations lead',
      jobGradeName: 'Grade 7',
      locationName: 'Seoul HQ',
      managerAssignmentKey: 'ASG-JORDAN-PRIMARY',
      changeReasonCode: 'PROMOTION',
    },
    {
      assignmentKey: 'ASG-MINA-FUTURE',
      assignmentStatus: 'PENDING',
      primaryAssignment: false,
      effectiveStartDate: '2027-01-01',
      effectiveEndDate: null,
      businessTitle: 'Future people operations director',
      organizationName: 'People Operations',
      jobProfileName: 'People operations director',
      jobGradeName: 'Grade 8',
      locationName: 'Seoul HQ',
      managerAssignmentKey: 'ASG-CHRO-PRIMARY',
      changeReasonCode: 'PROMOTION',
    },
  ],
  workers: [],
} satisfies PersonDetail;

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
}

test('assignment register sends filters to the server, paginates, and opens effective-dated detail', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  const listRequests: URL[] = [];
  await page.route('**/api/people/v1/workforce/people**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/people/v1/workforce/people/person-mina') {
      return fulfillSuccess(route, MINA_DETAIL);
    }
    if (url.pathname !== '/api/people/v1/workforce/people') return route.fallback();

    listRequests.push(url);
    const cursor = url.searchParams.get('cursor');
    return fulfillSuccess(route, {
      items: cursor === 'next-page' ? [ALEX] : [MINA],
      nextCursor: cursor === 'next-page' ? null : 'next-page',
      size: 50,
      hasMore: cursor !== 'next-page',
      asOf: url.searchParams.get('asOf') ?? '2026-09-02',
    });
  });

  await page.goto('/hr/operations/assignments');

  await expect(page.getByText('Mina Kim', { exact: true })).toBeVisible();
  await expect(page.getByText('More assignments available')).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Search person, assignment, organization, or manager' })
    .fill('Mina');
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Active', exact: true }).click();

  await expect
    .poll(() =>
      listRequests.some(
        (url) =>
          url.searchParams.get('query') === 'Mina' &&
          url.searchParams.get('status') === 'ACTIVE' &&
          url.searchParams.get('size') === '50' &&
          url.searchParams.get('view') === 'assignments'
      )
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Load more assignments' }).click();
  await expect(page.getByText('Alex Park', { exact: true })).toBeVisible();

  const detailAction = page.getByRole('button', {
    name: 'Open assignment detail for Mina Kim',
  });
  await expect(detailAction).toBeVisible();
  const actionGeometry = await detailAction.evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const cellRect = button.closest('[role="gridcell"]')?.getBoundingClientRect();
    return {
      buttonLeft: buttonRect.left,
      buttonRight: buttonRect.right,
      cellLeft: cellRect?.left ?? Number.NaN,
      cellRight: cellRect?.right ?? Number.NaN,
      viewportRight: document.documentElement.clientWidth,
    };
  });
  expect(actionGeometry.buttonLeft).toBeGreaterThanOrEqual(actionGeometry.cellLeft);
  expect(actionGeometry.buttonRight).toBeLessThanOrEqual(actionGeometry.cellRight);
  expect(actionGeometry.buttonRight).toBeLessThanOrEqual(actionGeometry.viewportRight);
  await detailAction.click();
  const inspector = page.getByRole('complementary', { name: 'Mina Kim' });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText('Assignment history and schedule')).toBeVisible();
  await expect(inspector.getByText('SKAX', { exact: true })).toBeVisible();
  await expect(inspector.getByText('People operations lead', { exact: true })).toBeVisible();
  await expect(
    inspector.getByText('Future people operations director', { exact: true })
  ).toBeVisible();
  await expect(inspector.getByText('Primary', { exact: true })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('assignment register preserves loaded rows when the next cursor temporarily fails', async ({
  page,
}) => {
  await mockShellSession(page, ['HR_ADMIN'], { permissions: FULL_PRODUCT_PERMISSIONS });
  let recoverNextPage = false;
  await page.route('**/api/people/v1/workforce/people**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/people/v1/workforce/people') return route.fallback();
    if (url.searchParams.get('cursor') !== 'next-page') {
      return fulfillSuccess(route, {
        items: [MINA],
        nextCursor: 'next-page',
        size: 50,
        hasMore: true,
        asOf: url.searchParams.get('asOf') ?? '2026-09-02',
      });
    }

    if (!recoverNextPage) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: 'Temporary workforce read failure',
          correlationId: 'assignment-next-page-503',
        }),
      });
    }
    return fulfillSuccess(route, {
      items: [ALEX],
      nextCursor: null,
      size: 50,
      hasMore: false,
      asOf: url.searchParams.get('asOf') ?? '2026-09-02',
    });
  });

  await page.goto('/hr/operations/assignments');
  await page.getByRole('button', { name: 'Load more assignments' }).click();

  await expect(page.getByText('Mina Kim', { exact: true })).toBeVisible();
  await expect(page.getByTestId('hcm-query-state')).toHaveAttribute(
    'data-query-state',
    'unavailable',
    { timeout: 15_000 }
  );
  await expect(page.getByText('assignment-next-page-503')).toBeVisible();

  recoverNextPage = true;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Alex Park', { exact: true })).toBeVisible();
  await expect(page.getByTestId('hcm-query-state')).toHaveCount(0);
});
