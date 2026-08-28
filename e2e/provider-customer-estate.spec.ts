import { expect, test } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';

import type { ProviderEntitlement, ProviderTenant } from '@dwp-frontend/shared-utils';
import type { Route } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 320, height: 720 } : { width: 1280, height: 800 }
  );
  await mockShellSession(page, ['PROVIDER_ADMIN'], {
    locale: 'en',
    appearance: {
      mode: 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
});

test('customer estate connects global posture, placement, and tenant 360', async ({ page }) => {
  await page.goto('/provider/tenants');

  await expect(page.getByRole('heading', { name: 'Tenant estate', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Customer estate scope' })).toContainText(
    '12 companies · 18 tenants'
  );
  await expect(
    page.getByRole('heading', { name: 'Tenant lifecycle review is required' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Customer estate key signals' })).toContainText(
    '17'
  );
  await expect(page.getByText('Estate placement profile')).toBeVisible();

  await page.getByRole('row', { name: /SKAX Production/ }).click();
  await expect(page).toHaveURL(/\/provider\/tenants\/tenant-skax$/);
  await expect(page.getByRole('heading', { name: 'SKAX Production', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant 360 scope' })).toContainText(
    'ap-northeast-2 / Bridge'
  );
  await expect(
    page.getByRole('heading', { name: 'The tenant meets operational readiness criteria' })
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tenant readiness signals' })).toContainText('1/1');

  await page.getByRole('tab', { name: 'Domains and administrators' }).click();
  await expect(
    page.getByText(
      'Administrator activation is unavailable until a customer-owned out-of-band delivery channel is connected. Provider operators cannot issue or view activation links.'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Issue activation link' })).toHaveCount(0);
  await expect(page.getByText('Configured administrators').locator('../..')).toContainText('1');
  await expect(page.getByText('Active administrators').locator('../..')).toContainText('1');
  await expect(page.getByText('Customer Administrator')).toHaveCount(0);
  await expect(page.getByText('customer.admin@tenant.example')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Product access' }).click();
  await expect(page).toHaveURL(/tab=entitlements/);
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
});

test('customer estate preserves URL-governed filters without crossing into tenant saved views', async ({
  page,
}) => {
  await page.goto('/provider/tenants');

  await expect(page.getByRole('button', { name: 'Saved views' })).toHaveCount(0);
  await page.getByRole('combobox', { name: /Data region/ }).click();
  await page.getByRole('option', { name: 'Seoul' }).click();
  await expect(page).toHaveURL(/region=ap-northeast-2/);

  await page.getByRole('combobox', { name: /Data region/ }).click();
  await page.getByRole('option', { name: 'All regions' }).click();
  const skaxRow = page.getByRole('row', { name: /SKAX Production/ });
  const acmeRow = page.getByRole('row', { name: /Acme Production/ });
  await skaxRow.getByRole('checkbox').click();
  await acmeRow.getByRole('checkbox').click();

  const comparison = page.getByRole('region', { name: 'Tenant operations comparison' });
  await expect(comparison).toContainText('SKAX Production');
  await expect(comparison).toContainText('Acme Production');
  await expect(page).toHaveURL(
    /compare=.*tenant-skax.*tenant-acme|compare=.*tenant-acme.*tenant-skax/
  );
});

test('customer estate reaches tenant 101 through server pagination', async ({ page }) => {
  await page.goto('/provider/tenants?page=5');

  await expect(page.getByRole('row', { name: /Tenant 101 Production/ })).toBeVisible();
  await expect(page).toHaveURL(/page=5/);
  await expect(page.getByText('25 shown / 150 total')).toBeVisible();
});

test('onboarding review exposes the complete immutable plan before preview', async ({ page }) => {
  await page.goto('/provider/tenants');
  await page.getByRole('button', { name: 'Onboard company' }).click();

  const dialog = page.getByRole('dialog', { name: 'Company and tenant onboarding' });
  await dialog.getByLabel('Company key').fill('acme');
  await dialog.getByLabel('Company name').fill('Acme Corporation');
  await dialog.getByRole('button', { name: 'Next' }).click();

  await dialog.getByLabel('Tenant key').fill('acme-production');
  await dialog.getByLabel('Display name').fill('Acme Production');
  await dialog.getByRole('button', { name: 'Next' }).click();

  await dialog.getByLabel('Administrator name').fill('Casey Admin');
  await dialog.getByLabel('Administrator work email').fill('casey@acme.example');
  await expect(dialog.getByText('Administrator identity will remain staged')).toBeVisible();
  await expect(dialog.getByText(/without a browser activation token or link/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();

  await expect(dialog.getByText('Onboarding plan summary')).toBeVisible();
  await expect(dialog.getByText('Acme Production')).toBeVisible();
  await expect(dialog.getByText('casey@acme.example')).toBeVisible();
  await expect(dialog.getByText('Administrator identity will remain staged')).toBeVisible();
  await dialog.getByLabel('Workforce management').check();
  await dialog.getByLabel('Business justification').fill('New contracted production tenant.');
  await expect(dialog.getByRole('button', { name: 'Preview' })).toBeEnabled();
});

test('customer estate and tenant 360 stay within the viewport', async ({ page }) => {
  await page.goto('/provider/tenants');
  await expect(page.getByRole('region', { name: 'Customer estate key signals' })).toBeVisible();

  let geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);

  await page.getByRole('row', { name: /SKAX Production/ }).click();
  await expect(page.getByRole('region', { name: 'Tenant readiness signals' })).toBeVisible();
  geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
});

test('tenant entitlement draft survives refresh and fails closed on server drift', async ({
  page,
}) => {
  const premiumAudit: ProviderEntitlement = {
    entitlementId: 2,
    entitlementKey: 'premium-audit',
    name: 'Premium audit',
    entitlementType: 'APPLICATION',
    lifecycleState: 'ACTIVE',
    configuration: '{}',
    version: 1,
  };
  const dataGovernance: ProviderEntitlement = {
    entitlementId: 3,
    entitlementKey: 'data-governance',
    name: 'Data governance',
    entitlementType: 'APPLICATION',
    lifecycleState: 'ACTIVE',
    configuration: '{}',
    version: 1,
  };
  const entitlementCatalog: ProviderEntitlement[] = [
    {
      entitlementId: 1,
      entitlementKey: 'workforce-management',
      name: 'Workforce management',
      entitlementType: 'APPLICATION',
      lifecycleState: 'ACTIVE',
      configuration: '{}',
      version: 1,
    },
    premiumAudit,
    dataGovernance,
  ];
  let initialTenant: ProviderTenant | undefined;
  let servedTenant: ProviderTenant | undefined;
  let serveTenantOverride = false;
  let overrideResponses = 0;

  await page.clock.setFixedTime(new Date('2026-08-28T00:00:00Z'));
  await page.route('**/api/provider/v1/admin/me', (route) =>
    fulfillSuccess(route, {
      operatorId: 1,
      authUserId: 1,
      displayName: 'Provider Admin',
      roles: ['PROVIDER_ADMIN'],
      permissions: ['ESTATE_READ', 'TENANT_WRITE', 'ENTITLEMENT_WRITE'],
    })
  );
  await page.route('**/api/provider/v1/admin/entitlements', (route) =>
    fulfillSuccess(route, entitlementCatalog)
  );
  await page.route('**/api/provider/v1/admin/tenants/tenant-skax', async (route) => {
    if (!serveTenantOverride || !servedTenant) return route.fallback();
    await fulfillSuccess(route, servedTenant);
    overrideResponses += 1;
  });
  page.on('response', (response) => {
    if (
      initialTenant ||
      new URL(response.url()).pathname !== '/api/provider/v1/admin/tenants/tenant-skax' ||
      !response.ok()
    ) {
      return;
    }
    void response
      .json()
      .then((payload: { data?: ProviderTenant }) => {
        initialTenant = payload.data;
      })
      .catch(() => undefined);
  });

  await page.goto('/provider/tenants/tenant-skax?tab=entitlements');
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
  await expect.poll(() => Boolean(initialTenant)).toBe(true);

  const premiumAuditCheckbox = page.getByRole('checkbox', { name: /Premium audit/ });
  const dataGovernanceCheckbox = page.getByRole('checkbox', { name: /Data governance/ });
  const save = page.getByRole('button', { name: 'Save' });
  const justification = page.getByLabel('Justification');
  await expect(premiumAuditCheckbox).not.toBeChecked();
  await premiumAuditCheckbox.check();
  await justification.fill('Add premium audit after the customer contract review.');
  await expect(save).toBeEnabled();

  const baseline = initialTenant;
  if (!baseline) throw new Error('Expected the initial tenant fixture.');
  servedTenant = {
    ...baseline,
    updatedAt: '2026-08-28T00:01:00Z',
    entitlements: baseline.entitlements.map((entitlement) => ({ ...entitlement })),
    services: baseline.services.map((service) => ({
      ...service,
      lastReconciledAt: '2026-08-28T00:01:00Z',
    })),
  };
  serveTenantOverride = true;
  await page.clock.fastForward(60_500);
  await expect.poll(() => overrideResponses).toBeGreaterThanOrEqual(1);
  await expect(premiumAuditCheckbox).toBeChecked();
  await expect(save).toBeEnabled();

  const workforceManagement = baseline.entitlements[0];
  if (!workforceManagement) throw new Error('Expected the workforce entitlement fixture.');
  servedTenant = {
    ...baseline,
    version: baseline.version + 1,
    updatedAt: '2026-08-28T00:02:00Z',
    entitlements: [{ ...workforceManagement }, dataGovernance],
    services: baseline.services.map((service) => ({
      ...service,
      lastReconciledAt: '2026-08-28T00:02:00Z',
    })),
  };
  const sameEntitlementResponseCount = overrideResponses;
  await page.clock.fastForward(60_500);
  await expect.poll(() => overrideResponses).toBeGreaterThan(sameEntitlementResponseCount);

  const conflict = page.getByRole('alert').filter({ hasText: 'Tenant state snapshot is stale' });
  await expect(conflict).toBeVisible();
  await expect(premiumAuditCheckbox).toBeChecked();
  await expect(dataGovernanceCheckbox).not.toBeChecked();
  await expect(save).toBeDisabled();

  await conflict.getByRole('button', { name: 'Refresh' }).click();
  await expect(conflict).toHaveCount(0);
  await expect(premiumAuditCheckbox).not.toBeChecked();
  await expect(dataGovernanceCheckbox).toBeChecked();
  await expect(justification).toHaveValue('');
  await expect(save).toBeDisabled();
});

test('tenant entitlement save rejects mismatched and late responses without rebasing', async ({
  page,
}) => {
  const workforceManagement: ProviderEntitlement = {
    entitlementId: 1,
    entitlementKey: 'workforce-management',
    name: 'Workforce management',
    entitlementType: 'APPLICATION',
    lifecycleState: 'ACTIVE',
    configuration: '{}',
    version: 1,
  };
  const premiumAudit: ProviderEntitlement = {
    entitlementId: 2,
    entitlementKey: 'premium-audit',
    name: 'Premium audit',
    entitlementType: 'APPLICATION',
    lifecycleState: 'ACTIVE',
    configuration: '{}',
    version: 1,
  };
  let pendingSaveRoute: Route | undefined;

  await page.route('**/api/provider/v1/admin/me', (route) =>
    fulfillSuccess(route, {
      operatorId: 1,
      authUserId: 1,
      displayName: 'Provider Admin',
      roles: ['PROVIDER_ADMIN'],
      permissions: ['ESTATE_READ', 'TENANT_WRITE', 'ENTITLEMENT_WRITE'],
    })
  );
  await page.route('**/api/provider/v1/admin/entitlements', (route) =>
    fulfillSuccess(route, [workforceManagement, premiumAudit])
  );
  await page.route('**/api/provider/v1/admin/tenants/tenant-skax/entitlements', (route) => {
    pendingSaveRoute = route;
  });

  await page.goto('/provider/tenants/tenant-skax?tab=entitlements');
  await expect(page.getByText('Product access for SKAX Production')).toBeVisible();
  const premiumAuditCheckbox = page.getByRole('checkbox', { name: /Premium audit/ });
  const justification = page.getByLabel('Justification');
  const save = page.getByRole('button', { name: 'Save' });
  await premiumAuditCheckbox.check();
  await justification.fill('Apply the reviewed premium audit entitlement.');

  try {
    await save.click();
    await expect.poll(() => Boolean(pendingSaveRoute)).toBe(true);
    await expect(premiumAuditCheckbox).toBeDisabled();
    await expect(justification).toBeDisabled();
    await expect(save).toBeDisabled();

    const mismatchedSaveRoute = pendingSaveRoute;
    if (!mismatchedSaveRoute) throw new Error('Expected the delayed entitlement save.');
    await fulfillSuccess(mismatchedSaveRoute, {
      tenantId: 'tenant-skax',
      version: 5,
      entitlements: [workforceManagement],
    });
    pendingSaveRoute = undefined;
    await expect(premiumAuditCheckbox).toBeEnabled();
    await expect(premiumAuditCheckbox).toBeChecked();
    await expect(justification).toHaveValue('Apply the reviewed premium audit entitlement.');
    await expect(save).toBeEnabled();
    await expect(page.getByText('Tenant product access synchronized.')).toHaveCount(0);

    await save.click();
    await expect.poll(() => Boolean(pendingSaveRoute)).toBe(true);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/provider/tenants/tenant-acme?tab=entitlements');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByText('Product access for Acme Production')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Premium audit/ })).not.toBeChecked();
    await expect(page.getByLabel('Justification')).toHaveValue('');

    const saveRoute = pendingSaveRoute;
    if (!saveRoute) throw new Error('Expected the delayed tenant A entitlement save.');
    await fulfillSuccess(saveRoute, {
      tenantId: 'tenant-skax',
      version: 5,
      entitlements: [workforceManagement, premiumAudit],
    });
    pendingSaveRoute = undefined;

    await expect(page.getByRole('checkbox', { name: /Premium audit/ })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: /Premium audit/ })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Workforce management/ })).toBeChecked();
    await expect(page.getByLabel('Justification')).toHaveValue('');
    await expect(page.getByText('Tenant product access synchronized.')).toHaveCount(0);
  } finally {
    if (pendingSaveRoute) await pendingSaveRoute.abort('aborted').catch(() => undefined);
  }
});
