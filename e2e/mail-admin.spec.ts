import { expect, test } from '@playwright/test';

import { MEMBER_PERMISSIONS, fulfill } from './support/mail-fixtures';
import { mockShellSession } from './support/shell-session';

test('mail administrators see reported connection state separately from verified readiness', async ({
  page,
}) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MAIL_ADMIN'], {
    locale: 'en',
    displayName: 'Mail Admin',
    permissions: [
      ...MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/platform/v1/admin/mail/overview', (route) =>
    fulfill(route, {
      personalAccounts: 21,
      sharedAccounts: 2,
      activeConnections: 1,
      degradedConnections: 0,
      openSharedThreads: 4,
      pendingAiProposals: 10,
      queuedDeliveries: 0,
      failedDeliveries: 0,
      policy: {
        externalSenderBanner: true,
        blockRemoteImages: true,
        allowSharedInboxes: true,
        aiAssistanceEnabled: true,
        aiCrossAppActionsEnabled: true,
        aiAutoExecuteEnabled: false,
        retentionDays: 365,
        maximumAttachmentMb: 25,
        version: 1,
      },
      connections: [
        {
          connectionId: '50000000-0000-0000-0000-000000000001',
          connectionKey: 'microsoft-graph',
          displayName: 'Microsoft 365',
          providerType: 'MICROSOFT_GRAPH',
          authenticationMode: 'OAUTH2',
          mailDomain: null,
          state: 'CONFIGURATION_REQUIRED',
          capabilities: ['READ', 'SEND'],
          credentialConfigured: false,
          lastSynchronizedAt: null,
          lastErrorCode: null,
          version: 0,
        },
      ],
      sharedInboxes: [],
      providerCatalog: [
        {
          providerType: 'MICROSOFT_GRAPH',
          name: 'Microsoft 365',
          protocol: 'Microsoft Graph',
          authenticationMode: 'OAuth 2.0',
          capabilities: ['READ', 'SEND'],
          pushSupported: true,
          tenantWideSupported: true,
          runtimeState: 'AVAILABLE',
          adapterVersion: '1.0.0',
        },
      ],
      generatedAt: new Date().toISOString(),
    })
  );

  await page.goto('/mail/admin/connections');
  await expect(
    page.getByText(/cannot confirm that this external connection is ready to activate/i)
  ).toBeVisible();
  await page.getByRole('button', { name: 'Configure' }).click();
  await expect(page).toHaveURL(/settings=edit/u);
  await expect(page.getByText('Connection service available')).toBeVisible();
  await page.getByRole('button', { name: 'Configure' }).click();
  await expect(
    page.getByText(/Activation is blocked until current connection service/i)
  ).toBeVisible();
  await page.getByLabel('Connection state').click();
  await expect(page.getByRole('option', { name: 'Active' })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
});

test('mail activation expires while settings stay open and is rechecked before mutation', async ({
  page,
}) => {
  const baseTime = Date.parse('2026-09-16T06:00:00.000Z');
  await page.clock.install({ time: baseTime });
  await mockShellSession(page, ['WORKSPACE_MEMBER', 'MAIL_ADMIN'], {
    locale: 'en',
    displayName: 'Mail Admin',
    permissions: [
      ...MEMBER_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode: 'MANAGE',
        effect: 'ALLOW',
      },
    ],
  });
  await page.route('**/api/platform/v1/admin/mail/overview', (route) =>
    fulfill(route, {
      personalAccounts: 1,
      sharedAccounts: 0,
      activeConnections: 1,
      degradedConnections: 0,
      openSharedThreads: 0,
      pendingAiProposals: 0,
      queuedDeliveries: 0,
      failedDeliveries: 0,
      policy: {
        externalSenderBanner: true,
        blockRemoteImages: true,
        allowSharedInboxes: true,
        aiAssistanceEnabled: false,
        aiCrossAppActionsEnabled: false,
        aiAutoExecuteEnabled: false,
        retentionDays: 365,
        maximumAttachmentMb: 25,
        version: 1,
      },
      connections: [
        {
          connectionId: '50000000-0000-0000-0000-000000000002',
          connectionKey: 'sandbox',
          displayName: 'DWP Sandbox',
          providerType: 'DWP_SANDBOX',
          authenticationMode: 'LOCAL',
          mailDomain: null,
          state: 'ACTIVE',
          capabilities: ['READ', 'SEND', 'SYNC'],
          credentialConfigured: false,
          lastSynchronizedAt: '2026-09-16T06:00:00.000Z',
          lastErrorCode: null,
          version: 3,
        },
      ],
      sharedInboxes: [],
      providerCatalog: [
        {
          providerType: 'DWP_SANDBOX',
          name: 'DWP Sandbox',
          protocol: 'LOCAL',
          authenticationMode: 'LOCAL',
          capabilities: ['READ', 'SEND', 'SYNC'],
          pushSupported: true,
          tenantWideSupported: true,
          runtimeState: 'AVAILABLE',
          adapterVersion: '2.4.0',
        },
      ],
      generatedAt: '2026-09-16T06:01:00.000Z',
    })
  );
  let updateRequests = 0;
  await page.route('**/api/platform/v1/admin/mail/connections/**', (route) => {
    updateRequests += 1;
    return fulfill(route, {});
  });

  await page.goto('/mail/admin/connections?settings=edit');
  await page.getByRole('button', { name: 'Configure' }).click();
  await expect(page.getByText(/Activation evidence is current/i)).toBeVisible();
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeEnabled();

  await page.clock.setSystemTime(baseTime + 5 * 60 * 1000 + 1);
  await save.click();
  await expect(
    page.getByText(/Activation is blocked until current connection service/i)
  ).toBeVisible();
  expect(updateRequests).toBe(0);

  await page.clock.runFor(15_000);
  await expect(save).toBeDisabled();
});
