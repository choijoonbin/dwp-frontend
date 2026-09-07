import { expect, test } from '@playwright/test';

import { MEMBER_PERMISSIONS, fulfill } from './support/mail-fixtures';
import { mockShellSession } from './support/shell-session';

test('mail administrators see contract readiness separately from deployed adapters', async ({
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
          runtimeState: 'DEPLOYMENT_REQUIRED',
          adapterVersion: null,
        },
      ],
      generatedAt: '2026-08-19T09:00:00Z',
    })
  );

  await page.goto('/mail/admin/connections');
  await expect(page.getByText('Runtime adapter deployment required')).toBeVisible();
  await page.getByRole('button', { name: 'Configure' }).click();
  await expect(page.getByText(/Activation is blocked/)).toBeVisible();
  await page.getByLabel('Connection state').click();
  await expect(page.getByRole('option', { name: 'Active' })).toHaveAttribute(
    'aria-disabled',
    'true'
  );
});
