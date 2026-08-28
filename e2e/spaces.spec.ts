import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockAuthenticatedRuntime } from './support/runtime-access';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

const SPACE_SUMMARY = {
  spaceId: 'a1000000-0000-0000-0000-000000000001',
  spaceKey: 'company-square',
  nameKo: 'SKAX 타운스퀘어',
  nameEn: 'SKAX Town Square',
  summaryKo: '전사 소식과 질문, 구성원 참여가 모이는 열린 공간입니다.',
  summaryEn: 'An open company space for news, questions, and participation.',
  purposeType: 'COMMUNITY',
  visibility: 'OPEN',
  dataClassification: 'INTERNAL',
  memberRole: 'VIEWER',
  memberCount: 2,
  contentCount: 2,
  unreadCount: 1,
  iconKey: 'building-2',
  accentToken: 'cobalt',
  coverAssetUrl: null,
  lifecycleState: 'ACTIVE',
  lastActivityAt: '2026-08-18T09:30:00Z',
  version: 1,
};

const SPACE_TEMPLATE = {
  templateId: 'b1000000-0000-0000-0000-000000000001',
  templateKey: 'expert-community',
  nameKo: '전문가 커뮤니티',
  nameEn: 'Expert community',
  descriptionKo: '전문 지식과 사례를 축적합니다.',
  descriptionEn: 'Build a governed body of expert knowledge and practice.',
  purposeType: 'COMMUNITY',
  creationMode: 'APPROVAL',
  defaultVisibility: 'REQUEST',
  defaultDataClassification: 'INTERNAL',
  iconKey: 'messages-square',
  accentToken: 'cobalt',
  lifecycleState: 'PUBLISHED',
  currentVersion: 1,
  version: 1,
};

type SpaceSession = {
  roles?: string[];
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW';
  }>;
};

async function mockSpaceSession(page: Page, options: SpaceSession = {}) {
  await mockAuthenticatedRuntime(page);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 42,
        personPublicId: 'person-42',
        displayName: 'Mina Kim',
        jobTitle: 'Network Operations Lead',
        email: 'mina.kim@sk.com',
        tenantId: 1,
        tenantCode: 'SKAX',
        identityPlane: 'TENANT',
        tenantName: 'SKAX',
        roles: options.roles ?? ['WORKSPACE_MEMBER'],
        groups: [{ groupRef: 'SKAX_ALL_EMPLOYEES', displayName: 'All employees' }],
        resourceRoles: [],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope(
        options.permissions ?? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.SPACES',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
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
          appearance: { mode: 'light', density: 'standard' },
          accessibility: { highContrast: false, reduceMotion: false },
        },
        version: 0,
        updatedAt: null,
      }),
    })
  );
}

test('members receive an accessible responsive Space command center', async ({ page }) => {
  await mockSpaceSession(page);
  await page.route('**/api/spaces/v1/home', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        generatedAt: '2026-08-18T09:30:00Z',
        metrics: {
          mySpaces: 1,
          discoverableSpaces: 2,
          pendingRequests: 0,
          reviewQueue: 0,
          unreadSignals: 1,
        },
        focusSpaces: [SPACE_SUMMARY],
        recentActivity: [
          {
            activityId: 'c1000000-0000-0000-0000-000000000001',
            spaceKey: 'company-square',
            spaceNameKo: 'SKAX 타운스퀘어',
            spaceNameEn: 'SKAX Town Square',
            activityType: 'CONTENT_PUBLISHED',
            actorType: 'USER',
            actorName: 'Alex Park',
            objectType: 'POST',
            titleKo: '전사 소식이 게시되었습니다.',
            titleEn: 'A company update was published.',
            route: '/spaces/company-square/content',
            occurredAt: '2026-08-18T09:20:00Z',
          },
        ],
        recommendedTemplates: [SPACE_TEMPLATE],
        insights: [
          {
            key: 'freshness',
            tone: 'positive',
            titleKo: '활발한 참여',
            titleEn: 'Healthy participation',
            detailKo: '최근 활동과 콘텐츠가 안정적으로 이어지고 있습니다.',
            detailEn: 'Recent activity and content remain healthy.',
            route: '/spaces/my',
          },
        ],
        canCreate: true,
        canAdminister: false,
      }),
    })
  );
  await page.route('**/api/spaces/v1/templates', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([SPACE_TEMPLATE]) })
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/spaces/home');

  await expect(
    page.getByRole('heading', { name: "Where Mina Kim's work comes together" })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /SKAX Town Square/ })).toContainText(
    '2 access subjects'
  );
  await expect(page.getByRole('heading', { name: 'Collaboration insights' })).toBeVisible();

  await page.getByRole('button', { name: /Expert community/ }).click();
  await expect(page.getByRole('dialog', { name: 'Create a new space' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Expert community/ })).toBeChecked();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});

test('Space control-center routes preserve separation of duties', async ({ page }) => {
  await mockSpaceSession(page, {
    roles: ['SPACE_TEMPLATE_ADMIN'],
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.SPACES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_TEMPLATES',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_TEMPLATES',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/spaces/v1/admin/templates', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([SPACE_TEMPLATE]) })
  );

  await page.goto('/admin/spaces');
  await expect(page).toHaveURL(/\/spaces\/admin\/templates$/);
  await expect(page.getByRole('heading', { name: 'Space templates', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New template' })).toBeVisible();
  const openSpaceNavigation = page.getByRole('button', { name: 'Open Space navigation' });
  if (await openSpaceNavigation.isVisible()) await openSpaceNavigation.click();
  await expect(page.getByRole('link', { name: 'Templates' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Content reviews' })).toHaveCount(0);

  await page.goto('/admin/spaces/content-reviews');
  await expect(page).toHaveURL(/\/403$/);
});

test('Space moderators can inspect membership without receiving owner controls', async ({
  page,
}) => {
  await mockSpaceSession(page);
  await page.route(/\/api\/spaces\/v1\/spaces\/company-square$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        space: { ...SPACE_SUMMARY, memberRole: 'MODERATOR' },
        contentPolicy: 'OWNER_REVIEW',
        appPolicy: 'OWNER_REVIEW',
        aiPolicy: 'MEMBER_SCOPED',
        canContribute: true,
        canModerate: true,
        canManage: false,
        featuredContent: [],
        apps: [
          {
            bindingId: 'd1000000-0000-0000-0000-000000000001',
            appKey: 'CALENDAR',
            displayNameKo: '캘린더',
            displayNameEn: 'Calendar',
            launchTarget: '/calendar/home',
            iconKey: 'calendar',
            dataAccessScope: 'SPACE_ONLY',
            lifecycleState: 'ACTIVE',
          },
        ],
        activity: [],
      }),
    })
  );
  await page.route(/\/api\/spaces\/v1\/spaces\/company-square\/owner\/members$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope([
        {
          membershipId: 'e1000000-0000-0000-0000-000000000001',
          principalType: 'GROUP',
          principalRef: 'SKAX_COMMUNICATIONS_EDITORS',
          memberRole: 'MODERATOR',
          membershipSource: 'GROUP',
          lifecycleState: 'ACTIVE',
          validFrom: '2026-08-18T00:00:00Z',
          validUntil: null,
          version: 1,
        },
      ]),
    })
  );
  await page.route(/\/api\/spaces\/v1\/access-requests\?status=PENDING$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([]) })
  );

  await page.goto('/spaces/company-square/people');
  await expect(page.getByText('SKAX_COMMUNICATIONS_EDITORS')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Owner Studio' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Connected apps' }).click();
  await expect(page.getByText('Data access scope: This Space only')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open app' })).toHaveAttribute(
    'href',
    '/calendar/home'
  );
});

test('governance admins recover ownerless Spaces through an evidence-bound flow', async ({
  page,
}) => {
  await mockSpaceSession(page, {
    roles: ['SPACE_GOVERNANCE_ADMIN'],
    permissions: [
      {
        resourceType: 'APP',
        resourceKey: 'APP.ADMINISTRATION',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_GOVERNANCE',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.SPACE_GOVERNANCE',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/spaces/v1/admin/operations', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        generatedAt: '2026-08-19T00:00:00Z',
        entitlementProviderConfigured: true,
        metrics: {
          queuedDeliveries: 0,
          deadLetters: 0,
          openFindings: 1,
          highRiskFindings: 1,
          ownerlessSpaces: 1,
          overdueReviews: 0,
          synchronizedLast24Hours: 8,
        },
        recentRuns: [],
        findings: [
          {
            findingId: 'f1000000-0000-0000-0000-000000000001',
            spaceId: SPACE_SUMMARY.spaceId,
            membershipId: null,
            findingType: 'OWNERLESS_SPACE',
            severity: 'CRITICAL',
            lifecycleState: 'OPEN',
            targetType: 'SPACE',
            targetRef: SPACE_SUMMARY.spaceId,
            title: 'OWNERLESS_SPACE',
            evidence: {
              spaceKey: SPACE_SUMMARY.spaceKey,
              spaceName: SPACE_SUMMARY.nameEn,
            },
            firstDetectedAt: '2026-08-18T23:30:00Z',
            lastDetectedAt: '2026-08-19T00:00:00Z',
          },
        ],
        deliveries: [],
      }),
    })
  );
  await page.route('**/api/people/v1/people**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        items: [
          {
            personId: 'e1000000-0000-0000-0000-000000000001',
            displayName: 'Mina Kim',
            lifecycleState: 'ACTIVE',
            workerStatus: 'ACTIVE',
            businessTitle: 'Network Operations Lead',
            organizationName: 'Network Operations',
            workEmail: 'mina.kim@sk.com',
            directReportCount: 4,
            dataAccess: {
              classification: 'DIRECTORY',
              workerNumberMasked: true,
              excludedFieldGroups: [],
            },
          },
        ],
        nextCursor: null,
        size: 8,
        hasMore: false,
        asOf: '2026-08-19',
      }),
    })
  );

  await page.goto('/admin/spaces/operations');
  await page.getByRole('button', { name: 'Inspect evidence' }).click();
  await page.getByRole('button', { name: 'Assign owner' }).click();

  await expect(page).toHaveURL(/\/spaces\/admin\/operations$/);
  await expect(page.getByRole('dialog', { name: 'Recover accountable ownership' })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Recover ownership' });
  await expect(submit).toBeDisabled();

  await page.getByRole('textbox', { name: 'Find an active member' }).fill('Mina');
  await page.getByRole('button', { name: /Mina Kim Network Operations Lead/ }).click();
  await page
    .getByRole('textbox', { name: 'Recovery rationale' })
    .fill('The owning team approved Mina as the accountable recovery owner.');
  await expect(submit).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.documentWidth).toBeLessThanOrEqual(mobileOverflow.viewport);
});
