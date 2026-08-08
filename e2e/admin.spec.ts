import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Item = {
  code: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  sortOrder: number;
  parentCode: string | null;
  validFrom: string | null;
  validTo: string | null;
  labels: Array<{ locale: string; label: string; description?: string | null }>;
  version: number;
};

type Detail = {
  setKey: string;
  name: string;
  description: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  revision: number;
  version: number;
  items: Item[];
};

type RegistryEntry = {
  registryType: 'APP' | 'CONNECTOR' | 'AGENT' | 'TOOL' | 'POLICY';
  entryKey: string;
  revision: number;
  name: string;
  description: string;
  ownerRef: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  artifactVersion: string;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  version: number;
};

type IdentityUser = {
  userId: number;
  displayName: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  mfaEnabled: boolean;
  roles: string[];
  accessRevision: number;
  version: number;
};

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
        email: 'admin@dwp.local',
        tenantId: 1,
        tenantCode: 'default',
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
}

test('tenant administrators manage standards, registry, and audit', async ({ page }, testInfo) => {
  await mockAdminSession(page);
  let detail: Detail | null = null;
  let registryEntry: RegistryEntry | null = null;
  const auditEvents: unknown[] = [];
  const identityAuditEvents: unknown[] = [];
  const identityRoles = [
    {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'Tenant administration',
      status: 'ACTIVE',
    },
    {
      code: 'EMPLOYEE',
      name: 'Employee',
      description: 'Workspace member',
      status: 'ACTIVE',
    },
  ];
  const identityUsers: IdentityUser[] = [
    {
      userId: 1,
      displayName: 'Admin User',
      email: 'admin@dwp.local',
      status: 'ACTIVE',
      mfaEnabled: true,
      roles: ['ADMIN'],
      accessRevision: 0,
      version: 0,
    },
    {
      userId: 2,
      displayName: 'Operations Lead',
      email: 'operations@dwp.local',
      status: 'ACTIVE',
      mfaEnabled: false,
      roles: ['EMPLOYEE'],
      accessRevision: 0,
      version: 0,
    },
  ];

  await page.route('**/api/auth/admin/identity/users**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/auth/admin/identity/users', '');
    if (request.method() === 'GET' && suffix === '') {
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content: identityUsers,
          page: 0,
          size: 100,
          totalElements: identityUsers.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'PUT' && suffix === '/2/roles') {
      const body = request.postDataJSON() as { roleCodes: string[] };
      identityUsers[1] = {
        ...identityUsers[1],
        roles: [...body.roleCodes].sort(),
        accessRevision: identityUsers[1].accessRevision + 1,
        version: identityUsers[1].version + 1,
      };
      identityAuditEvents.unshift({
        auditEventId: 'audit-identity-role',
        actorType: 'USER',
        actorId: 1,
        action: 'identity.user-roles.replaced',
        targetType: 'USER_ACCESS',
        targetId: '2',
        outcome: 'SUCCESS',
        correlationId: 'corr-identity-role',
        occurredAt: '2026-08-08T09:05:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(identityUsers[1]) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/auth/admin/identity/roles', (route) =>
    route.fulfill({ contentType: 'application/json', body: envelope(identityRoles) })
  );

  await page.route('**/api/auth/admin/identity/audit-events**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: identityAuditEvents,
        page: 0,
        size: 100,
        totalElements: identityAuditEvents.length,
        totalPages: 1,
      }),
    })
  );

  await page.route('**/api/platform/v1/admin/reference-sets**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/platform/v1/admin/reference-sets', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      const content = detail
        ? [{ ...detail, itemCount: detail.items.length, items: undefined }]
        : [];
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      detail = {
        setKey: String(body?.setKey),
        name: String(body?.name),
        description: String(body?.description || ''),
        lifecycleState: 'DRAFT',
        revision: 1,
        version: 0,
        items: [],
      };
      auditEvents.unshift({
        auditEventId: 'audit-create-set',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-set.created',
        targetType: 'REFERENCE_SET',
        targetId: detail.setKey,
        outcome: 'SUCCESS',
        correlationId: 'corr-create-set',
        occurredAt: '2026-08-08T09:00:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'GET' && suffix === '/WORK_PRIORITY') {
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'POST' && suffix === '/WORK_PRIORITY/items' && detail) {
      const item: Item = {
        code: String(body?.code),
        lifecycleState: 'DRAFT',
        sortOrder: Number(body?.sortOrder),
        parentCode: null,
        validFrom: null,
        validTo: null,
        labels: (body?.labels as Item['labels']) || [],
        version: 0,
      };
      detail = { ...detail, revision: 2, version: 1, items: [item] };
      auditEvents.unshift({
        auditEventId: 'audit-create-item',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-item.created',
        targetType: 'REFERENCE_ITEM',
        targetId: 'WORK_PRIORITY/HIGH',
        outcome: 'SUCCESS',
        correlationId: 'corr-create-item',
        occurredAt: '2026-08-08T09:01:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    if (request.method() === 'POST' && suffix === '/WORK_PRIORITY/activate' && detail) {
      detail = {
        ...detail,
        lifecycleState: 'ACTIVE',
        revision: 3,
        version: 2,
        items: detail.items.map((item) => ({
          ...item,
          lifecycleState: 'ACTIVE',
          version: item.version + 1,
        })),
      };
      auditEvents.unshift({
        auditEventId: 'audit-activate-set',
        actorType: 'USER',
        actorId: 1,
        action: 'reference-set.activated',
        targetType: 'REFERENCE_SET',
        targetId: 'WORK_PRIORITY',
        outcome: 'SUCCESS',
        correlationId: 'corr-activate-set',
        occurredAt: '2026-08-08T09:02:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(detail) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/platform/v1/admin/registry-entries**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const suffix = url.pathname.replace('/api/platform/v1/admin/registry-entries', '');
    const body = request.postDataJSON() as Record<string, unknown> | null;

    if (request.method() === 'GET' && suffix === '') {
      const content = registryEntry ? [registryEntry] : [];
      await route.fulfill({
        contentType: 'application/json',
        body: envelope({
          content,
          page: 0,
          size: 100,
          totalElements: content.length,
          totalPages: 1,
        }),
      });
      return;
    }
    if (request.method() === 'POST' && suffix === '') {
      registryEntry = {
        registryType: body?.registryType as RegistryEntry['registryType'],
        entryKey: String(body?.entryKey),
        revision: 1,
        name: String(body?.name),
        description: String(body?.description || ''),
        ownerRef: String(body?.ownerRef),
        riskTier: body?.riskTier as RegistryEntry['riskTier'],
        artifactVersion: String(body?.artifactVersion),
        lifecycleState: 'DRAFT',
        version: 0,
      };
      auditEvents.unshift({
        auditEventId: 'audit-create-registry',
        actorType: 'USER',
        actorId: 1,
        action: 'registry-entry.created',
        targetType: 'REGISTRY_ENTRY',
        targetId: 'AGENT/DAILY_BRIEF@1',
        outcome: 'SUCCESS',
        correlationId: 'corr-create-registry',
        occurredAt: '2026-08-08T09:03:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(registryEntry) });
      return;
    }
    if (
      request.method() === 'POST' &&
      suffix === '/AGENT/DAILY_BRIEF/revisions/1/activate' &&
      registryEntry
    ) {
      registryEntry = { ...registryEntry, lifecycleState: 'ACTIVE', version: 1 };
      auditEvents.unshift({
        auditEventId: 'audit-activate-registry',
        actorType: 'USER',
        actorId: 1,
        action: 'registry-entry.activated',
        targetType: 'REGISTRY_ENTRY',
        targetId: 'AGENT/DAILY_BRIEF@1',
        outcome: 'SUCCESS',
        correlationId: 'corr-activate-registry',
        occurredAt: '2026-08-08T09:04:00Z',
      });
      await route.fulfill({ contentType: 'application/json', body: envelope(registryEntry) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/platform/v1/admin/audit-events**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        content: auditEvents,
        page: 0,
        size: 100,
        totalElements: auditEvents.length,
        totalPages: 1,
      }),
    })
  );

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  const tenantUsers =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Tenant users' })
      : page.getByRole('grid', { name: 'Tenant users' });
  await expect(tenantUsers).toContainText('Operations Lead');
  await expect(page.getByRole('button', { name: 'Edit roles for Admin User' })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit roles for Operations Lead' }).click();
  const accessDialog = page.getByRole('dialog', { name: 'Edit access' });
  await accessDialog.getByRole('checkbox', { name: /Administrator/ }).check();
  await accessDialog.getByRole('button', { name: 'Save access' }).click();
  await expect(tenantUsers).toContainText('ADMIN');

  await page.getByRole('tab', { name: 'Reference data' }).click();
  await expect(page.getByText('No reference sets')).toBeVisible();

  await page.getByRole('button', { name: 'New reference set' }).click();
  await page.getByLabel('Set key').fill('WORK_PRIORITY');
  await page.getByLabel('Name').fill('Work priority');
  await page.getByRole('button', { name: 'Create set' }).click();
  await expect(
    page.getByLabel('Reference set detail').getByRole('heading', { name: 'Work priority' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'New reference item' }).click();
  const itemDialog = page.getByRole('dialog', { name: 'New reference item' });
  await itemDialog.getByRole('textbox', { name: 'Code', exact: true }).fill('HIGH');
  await itemDialog.getByLabel('Sort order').fill('10');
  await itemDialog.getByRole('textbox', { name: 'Label', exact: true }).first().fill('높음');
  await itemDialog.getByRole('button', { name: 'Create item' }).click();
  const referenceItems =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Reference items' })
      : page.getByRole('grid', { name: 'Reference items' });
  await expect(referenceItems).toContainText('HIGH');

  await page.getByRole('button', { name: 'Activate reference set' }).click();
  await page
    .getByRole('dialog', { name: 'Activate reference set?' })
    .getByRole('button', {
      name: 'Activate',
    })
    .click();
  await expect(page.getByText('Active').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Registry' }).click();
  const registryEntries =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Product registry entries' })
      : page.getByRole('grid', { name: 'Product registry entries' });
  await expect(registryEntries).toContainText('No registry entries');
  await page.getByRole('button', { name: 'New registry entry' }).click();
  const registryDialog = page.getByRole('dialog', { name: 'New registry entry' });
  await registryDialog.getByLabel('Registry type').click();
  await page.getByRole('option', { name: 'Agent' }).click();
  await registryDialog.getByLabel('Registry key').fill('DAILY_BRIEF');
  await registryDialog.getByLabel('Name').fill('Daily brief');
  await registryDialog.getByLabel('Owner reference').fill('team:ai-platform');
  await registryDialog.getByRole('button', { name: 'Create draft' }).click();
  await expect(registryEntries).toContainText('DAILY_BRIEF');
  await page.getByRole('button', { name: 'Activate DAILY_BRIEF' }).click();
  await page
    .getByRole('dialog', { name: 'Activate DAILY_BRIEF?' })
    .getByRole('button', { name: 'Activate' })
    .click();
  await expect(registryEntries).toContainText('Active');

  await page.getByRole('tab', { name: 'Audit' }).click();
  const auditList =
    testInfo.project.name === 'mobile'
      ? page.getByRole('list', { name: 'Administration audit events' })
      : page.getByRole('grid', { name: 'Administration audit events' });
  await expect(auditList).toContainText('Identity User Roles Replaced');
  await expect(auditList).toContainText('Reference Set Activated');
  await expect(auditList).toContainText('Registry Entry Activated');

  await expect(page.getByRole('alert')).toBeHidden({ timeout: 10_000 });
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
