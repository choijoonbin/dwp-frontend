import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROOT_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const CEO_ID = '00000000-0000-0000-0000-000000000011';
const LEAD_ID = '00000000-0000-0000-0000-000000000012';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockAdminSession(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 1,
        displayName: 'Admin User',
        email: 'admin@skax.example',
        tenantId: 1,
        tenantCode: 'SKAX',
        roles: ['ADMIN'],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([]) })
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
      body: envelope({ organizationName: 'SKAX', logoUrl: null, version: 1 }),
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

test('administrators explore effective organization and reporting structures', async ({ page }) => {
  await mockAdminSession(page);
  await page.route('**/api/people/v1/org-chart**', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(chartFixture()) })
  );
  await page.route('**/api/auth/admin/identity/users**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: [
          {
            userId: 11,
            displayName: 'Kim Jiwon',
            email: 'jiwon.kim@skax.example',
            status: 'ACTIVE',
            mfaEnabled: true,
            roles: ['ADMIN'],
            accessRevision: 1,
            version: 1,
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    })
  );

  await page.goto('/admin/people/directory');
  await expect(page.getByRole('heading', { name: 'Organization chart' })).toBeVisible();
  await expect(page.getByLabel('SKAX organization chart workspace')).toBeVisible();
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('AI Platform', { exact: true })).toBeVisible();

  await page.getByText('AI Platform', { exact: true }).click();
  await expect(page.getByText('Cost center')).toBeVisible();
  await expect(page.getByText('CC-1100')).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  await page.getByRole('button', { name: 'Reporting lines' }).click();
  await expect(page.getByText('Kim Jiwon', { exact: true })).toBeVisible();
  await page.getByText('Kim Jiwon', { exact: true }).click();
  await expect(page.getByText('System roles')).toBeVisible();
  await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  await page.getByPlaceholder('Search organizations, people, or titles').fill('AI Lead');
  await page.getByPlaceholder('Search organizations, people, or titles').press('Enter');
  await expect(page.getByText('AI Lead', { exact: true }).first()).toBeVisible();

  await page.mouse.move(0, 0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).exclude('.react-flow__minimap').analyze();
  expect(accessibility.violations).toEqual([]);
});

function chartFixture() {
  return {
    asOf: '2026-08-10',
    company: {
      organizationId: ROOT_ID,
      organizationKey: 'ROOT',
      name: 'SKAX',
      description: 'Enterprise AX company',
    },
    metrics: {
      headcount: 2,
      activeHeadcount: 2,
      onLeaveHeadcount: 0,
      contingentHeadcount: 0,
      organizationCount: 2,
      managerCount: 2,
      openPositionCount: 1,
      locationCount: 1,
    },
    organizations: [
      {
        organizationId: ROOT_ID,
        organizationKey: 'ROOT',
        name: 'SKAX',
        shortName: 'SKAX',
        organizationType: 'COMPANY',
        parentOrganizationId: null,
        description: 'Enterprise AX company',
        costCenterKey: 'CC-0000',
        colorToken: 'SK_RED',
        directHeadcount: 1,
        totalHeadcount: 2,
        managerCount: 1,
        openPositionCount: 0,
        childOrganizationCount: 1,
        leaderPersonId: CEO_ID,
        directMemberIds: [CEO_ID],
      },
      {
        organizationId: TEAM_ID,
        organizationKey: 'ORG-AI',
        name: 'AI Platform Division',
        shortName: 'AI Platform',
        organizationType: 'DIVISION',
        parentOrganizationId: ROOT_ID,
        description: 'Builds trusted AI platforms',
        costCenterKey: 'CC-1100',
        colorToken: 'VIOLET',
        directHeadcount: 1,
        totalHeadcount: 1,
        managerCount: 1,
        openPositionCount: 1,
        childOrganizationCount: 0,
        leaderPersonId: LEAD_ID,
        directMemberIds: [LEAD_ID],
      },
    ],
    people: [
      {
        personId: CEO_ID,
        assignmentKey: 'ASG-CEO',
        displayName: 'Kim Jiwon',
        workEmail: 'jiwon.kim@skax.example',
        businessTitle: 'Chief Executive Officer',
        jobProfileName: 'Chief Executive Officer',
        jobGradeKey: 'G7',
        jobGradeName: 'CEO',
        jobGradeOrder: 7,
        managementLevel: 'EXECUTIVE',
        organizationId: ROOT_ID,
        managerPersonId: null,
        workerNumber: 'SK0001',
        workerType: 'EMPLOYEE',
        workerStatus: 'ACTIVE',
        locationKey: 'SEOUL',
        locationName: 'Seoul HQ',
        directReportCount: 1,
      },
      {
        personId: LEAD_ID,
        assignmentKey: 'ASG-AI-LEAD',
        displayName: 'Lee Hana',
        workEmail: 'hana.lee@skax.example',
        businessTitle: 'AI Lead',
        jobProfileName: 'AI Lead',
        jobGradeKey: 'G5',
        jobGradeName: 'Division Lead',
        jobGradeOrder: 5,
        managementLevel: 'MANAGER',
        organizationId: TEAM_ID,
        managerPersonId: CEO_ID,
        workerNumber: 'SK0002',
        workerType: 'EMPLOYEE',
        workerStatus: 'ACTIVE',
        locationKey: 'SEOUL',
        locationName: 'Seoul HQ',
        directReportCount: 0,
      },
    ],
    relationships: [
      {
        childOrganizationId: TEAM_ID,
        parentOrganizationId: ROOT_ID,
        relationshipType: 'SUPERVISORY',
        primaryRelationship: true,
      },
    ],
    openPositions: [
      {
        positionKey: 'OPEN-AI-01',
        title: 'AI Engineer',
        organizationId: TEAM_ID,
        jobProfileName: 'AI Engineer',
        locationName: 'Seoul HQ',
        availabilityDate: '2026-09-01',
      },
    ],
  };
}
