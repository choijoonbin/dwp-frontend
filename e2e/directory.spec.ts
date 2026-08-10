import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROOT_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const CEO_ID = '00000000-0000-0000-0000-000000000011';
const LEAD_ID = '00000000-0000-0000-0000-000000000012';
const CEO_POSITION_ID = '00000000-0000-0000-0000-000000000021';
const LEAD_POSITION_ID = '00000000-0000-0000-0000-000000000022';

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

async function closeDetails(page: Page) {
  const closeButton = page.getByRole('button', { name: 'Close details' });
  const mobileDrawer = closeButton.locator(
    'xpath=ancestor::*[contains(@class, "MuiDrawer-paper")]'
  );
  if (await mobileDrawer.count()) {
    await expect(mobileDrawer).toHaveCSS('transform', 'none');
  }
  await closeButton.click();
  await expect(closeButton).toBeHidden();
}

test('administrators explore effective organization and reporting structures', async ({ page }) => {
  await mockAdminSession(page);
  await page.route('**/api/people/v1/org-chart**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/scenarios')
      ? []
      : path.endsWith('/intelligence')
        ? intelligenceFixture()
        : chartFixture();
    return route.fulfill({ contentType: 'application/json', body: envelope(data) });
  });
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
  await closeDetails(page);

  await page.getByRole('button', { name: 'Position hierarchy' }).click();
  await expect(page.getByText('POS-CEO', { exact: true })).toBeVisible();
  await page.getByText('POS-CEO', { exact: true }).click();
  await expect(page.getByText('Position profile')).toBeVisible();
  await expect(page.getByText('100,000,000')).toBeVisible();
  await closeDetails(page);

  await page.getByRole('button', { name: 'Organization insights' }).click();
  await expect(page.getByText('Data quality score')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText('Organization portfolio risk map')).toBeVisible();
  await expect(page.getByText('Priority action queue')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /SKAX.*Review layer consolidation/ })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Organization', exact: true }).click();

  await page.getByRole('button', { name: 'Reporting lines' }).click();
  await expect(page.getByText('Kim Jiwon', { exact: true })).toBeVisible();
  await page.getByText('Kim Jiwon', { exact: true }).click();
  await expect(page.getByText('System roles')).toBeVisible();
  await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
  await closeDetails(page);

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
      plannedFte: 2,
      workforceCostAmount: 180000000,
      costCurrency: 'KRW',
    },
    analysis: {
      healthScore: 98,
      dataQualityScore: 100,
      averageManagerSpan: 1,
      maximumLayers: 2,
      managerRatioPercent: 50,
      contingentRatioPercent: 0,
      narrowSpanManagerCount: 1,
      wideSpanManagerCount: 0,
      singleReportManagerCount: 1,
      missingManagerCount: 0,
      missingGradeCount: 0,
      orphanOrganizationCount: 0,
      policy: {
        minimumManagerSpan: 3,
        maximumManagerSpan: 9,
        maximumLayers: 7,
        maximumContingentPercent: 20,
        maximumVacancyPercent: 15,
      },
      signals: [],
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
        managerCount: 2,
        openPositionCount: 1,
        childOrganizationCount: 1,
        leaderPersonId: CEO_ID,
        directMemberIds: [CEO_ID],
        layerDepth: 1,
        averageManagerSpan: 1,
        contingentHeadcount: 0,
        healthStatus: 'ATTENTION',
        healthSignals: ['NARROW_SPAN'],
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
        layerDepth: 2,
        averageManagerSpan: 0,
        contingentHeadcount: 0,
        healthStatus: 'ATTENTION',
        healthSignals: ['HIGH_VACANCY'],
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
        managerReferenceMissing: false,
        positionId: CEO_POSITION_ID,
        positionKey: 'POS-CEO',
        workerNumber: 'SK0001',
        workerType: 'EMPLOYEE',
        workerStatus: 'ACTIVE',
        locationKey: 'SEOUL',
        locationName: 'Seoul HQ',
        directReportCount: 1,
        fullTimeEquivalent: 1,
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
        managerReferenceMissing: false,
        positionId: LEAD_POSITION_ID,
        positionKey: 'POS-AI-LEAD',
        workerNumber: 'SK0002',
        workerType: 'EMPLOYEE',
        workerStatus: 'ACTIVE',
        locationKey: 'SEOUL',
        locationName: 'Seoul HQ',
        directReportCount: 0,
        fullTimeEquivalent: 1,
      },
    ],
    positions: [
      {
        positionId: CEO_POSITION_ID,
        positionKey: 'POS-CEO',
        title: 'Chief Executive Officer',
        organizationId: ROOT_ID,
        reportsToPositionId: null,
        status: 'FILLED',
        positionType: 'REGULAR',
        criticality: 'CRITICAL',
        budgetedFte: 1,
        annualCostAmount: 100000000,
        costCurrency: 'KRW',
        jobProfileName: 'Chief Executive Officer',
        locationName: 'Seoul HQ',
        availabilityDate: null,
        incumbentPersonIds: [CEO_ID],
        subordinatePositionCount: 1,
      },
      {
        positionId: LEAD_POSITION_ID,
        positionKey: 'POS-AI-LEAD',
        title: 'AI Platform Lead',
        organizationId: TEAM_ID,
        reportsToPositionId: CEO_POSITION_ID,
        status: 'FILLED',
        positionType: 'REGULAR',
        criticality: 'HIGH',
        budgetedFte: 1,
        annualCostAmount: 80000000,
        costCurrency: 'KRW',
        jobProfileName: 'AI Lead',
        locationName: 'Seoul HQ',
        availabilityDate: null,
        incumbentPersonIds: [LEAD_ID],
        subordinatePositionCount: 0,
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
        positionId: '00000000-0000-0000-0000-000000000023',
        positionKey: 'OPEN-AI-01',
        title: 'AI Engineer',
        organizationId: TEAM_ID,
        jobProfileName: 'AI Engineer',
        locationName: 'Seoul HQ',
        availabilityDate: '2026-09-01',
        budgetedFte: 1,
        annualCostAmount: 70000000,
        costCurrency: 'KRW',
        criticality: 'STANDARD',
      },
    ],
  };
}

function intelligenceFixture() {
  return {
    asOf: '2026-08-10',
    compareTo: '2026-07-10',
    health: {
      maximumLayers: 2,
      averageManagerSpan: 1,
      medianManagerSpan: 1,
      overloadedManagers: 0,
      singleReportManagers: 1,
      managerReferenceIssues: 0,
      disconnectedOrganizations: 0,
      openPositions: 1,
      contingentRatioPct: 0,
      organizationHealthScore: 75,
      dataQualityScore: 100,
      organizationsAtRisk: 2,
      criticalOrganizations: 0,
      attentionOrganizations: 1,
    },
    comparison: {
      headcountDelta: 0,
      organizationDelta: 0,
      managerDelta: 0,
      openPositionDelta: 0,
      peopleMoved: 0,
      managerChanges: 0,
      organizationMoves: 0,
      totalChanges: 0,
      plannedFteDelta: 0,
      workforceCostDelta: 0,
      costCurrency: 'KRW',
      averageManagerSpanDelta: 0,
      maximumLayersDelta: 0,
      organizationHealthScoreDelta: 0,
      dataQualityScoreDelta: 0,
    },
    organizations: [
      {
        organizationId: ROOT_ID,
        organizationName: 'SKAX',
        organizationType: 'COMPANY',
        layer: 1,
        directHeadcount: 1,
        totalHeadcount: 2,
        managerCount: 1,
        averageManagerSpan: 1,
        overloadedManagerCount: 0,
        openPositionCount: 0,
        contingentRatioPct: 0,
        healthScore: 75,
        riskState: 'ATTENTION',
        signals: ['NARROW_SPAN'],
      },
    ],
    changes: [],
    dataQualityIssues: [],
  };
}
