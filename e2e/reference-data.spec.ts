import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

async function mockTenantAdminSession(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('dwp.locale', 'en'));

  await page.route(/^https?:\/\/[^/]+\/api\//, (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope([]) })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 2,
        displayName: 'Hyunwoo Park',
        jobTitle: 'Digital Platform Lead',
        email: 'hyunwoo.park@sk.com',
        tenantId: 1,
        tenantCode: 'default',
        tenantName: 'SKAX',
        preferredLocale: 'en',
        tenantDefaultLocale: 'en',
        roles: ['TENANT_ADMIN'],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope([
        {
          resourceType: 'APP',
          resourceKey: 'APP.ADMINISTRATION',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ]),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ organizationName: 'SKAX', logoUrl: null, version: 0 }),
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

test('tenant administrators operate a governed reference data catalog', async ({
  page,
}, testInfo) => {
  await mockTenantAdminSession(page);

  const sets = [
    {
      setKey: 'DELIVERY_CHANNEL',
      name: 'Delivery channels',
      description: 'Channels used to deliver notifications and work results.',
      lifecycleState: 'ACTIVE',
      itemCount: 6,
      revision: 1,
      version: 0,
      updatedAt: '2026-08-11T01:00:00Z',
    },
    {
      setKey: 'SERVICE_REGION',
      name: 'Service regions',
      description: 'Hierarchical service delivery regions.',
      lifecycleState: 'ACTIVE',
      itemCount: 9,
      revision: 1,
      version: 0,
    },
    {
      setKey: 'WORK_CATEGORY',
      name: 'Work categories',
      description: 'Standard work request classification.',
      lifecycleState: 'ACTIVE',
      itemCount: 6,
      revision: 1,
      version: 0,
    },
    {
      setKey: 'WORK_PRIORITY',
      name: 'Work priorities',
      description: 'Priority used across tenant workflows.',
      lifecycleState: 'ACTIVE',
      itemCount: 4,
      revision: 1,
      version: 0,
    },
  ];
  const label = (locale: string, value: string) => ({ locale, label: value });
  const detail = {
    ...sets[0],
    items: [
      {
        code: 'PORTAL',
        lifecycleState: 'ACTIVE',
        sortOrder: 10,
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: [label('ko', '업무 포털'), label('en', 'Work portal')],
        version: 0,
        updatedAt: '2026-08-11T01:00:00Z',
      },
      {
        code: 'EMAIL',
        lifecycleState: 'ACTIVE',
        sortOrder: 20,
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: [label('ko', '이메일'), label('en', 'Email')],
        version: 0,
      },
      {
        code: 'CHAT',
        lifecycleState: 'ACTIVE',
        sortOrder: 30,
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: [label('ko', '협업 메시지'), label('en', 'Collaboration message')],
        version: 0,
      },
      {
        code: 'MOBILE',
        lifecycleState: 'ACTIVE',
        sortOrder: 40,
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: [label('ko', '모바일 알림'), label('en', 'Mobile notification')],
        version: 0,
      },
      {
        code: 'VOICE',
        lifecycleState: 'DRAFT',
        sortOrder: 50,
        parentCode: null,
        validFrom: '2026-08-25T00:00:00Z',
        validTo: null,
        labels: [label('ko', '음성 알림'), label('en', 'Voice notification')],
        version: 0,
      },
      {
        code: 'FAX',
        lifecycleState: 'RETIRED',
        sortOrder: 60,
        parentCode: null,
        validFrom: null,
        validTo: '2026-08-10T00:00:00Z',
        labels: [label('ko', '팩스'), label('en', 'Fax')],
        version: 0,
      },
    ],
  };

  await page.route('**/api/platform/v1/admin/reference-sets**', async (route) => {
    const url = new URL(route.request().url());
    const suffix = url.pathname.replace('/api/platform/v1/admin/reference-sets', '');
    if (suffix === '') {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content: sets,
          page: 0,
          size: 100,
          totalElements: sets.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (suffix === '/DELIVERY_CHANNEL/audit-events') {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content: [
            {
              auditEventId: 'reference-seed-event',
              actorType: 'SERVICE',
              actorId: null,
              action: 'reference-set.seeded',
              targetType: 'REFERENCE_SET',
              targetId: 'DELIVERY_CHANNEL',
              outcome: 'SUCCESS',
              correlationId: 'seed-reference-data-v22',
              occurredAt: '2026-08-11T01:00:00Z',
            },
          ],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        }),
      });
      return;
    }
    if (suffix === '/DELIVERY_CHANNEL') {
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/admin/platform/reference-data');

  await expect(page.getByRole('heading', { name: 'Reference data', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operational catalog' })).toContainText('25');
  await expect(page.getByRole('complementary', { name: 'Reference sets' })).toContainText(
    'Delivery channels'
  );
  await expect(page.getByRole('region', { name: 'Reference set detail' })).toContainText(
    'Published to runtime'
  );
  await expect(page.getByText('100%')).toBeVisible();

  const values =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Reference items' })
      : page.getByRole('grid', { name: 'Reference items' });
  await expect(values).toContainText('Work portal');
  await expect(values).toContainText('VOICE');

  await page.getByRole('button', { name: 'Draft' }).click();
  await expect(values).toContainText('VOICE');
  await expect(values).not.toContainText('PORTAL');

  await page.getByRole('tab', { name: 'Change activity' }).click();
  await expect(page.getByText('Initial operational catalog provisioned')).toBeVisible();
  await expect(page.getByText('Platform service')).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
