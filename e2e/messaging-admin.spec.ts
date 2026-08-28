import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type {
  MessagingAdminOverview,
  MessagingConversation,
  MessagingPolicy,
} from '@dwp-frontend/shared-utils';

const APP_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
  resourceType: 'APP',
  resourceKey: 'APP.MESSAGING',
  permissionCode,
  effect: 'ALLOW' as const,
}));

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: success(data) });
}

function governedConversation(): MessagingConversation {
  return {
    conversationId: '71000000-0000-0000-0000-000000000090',
    conversationKey: 'operations-governance',
    conversationType: 'CHANNEL',
    name: 'Operations governance',
    topic: 'Retention and classification oversight',
    visibility: 'PRIVATE',
    dataClassification: 'RESTRICTED',
    linkedSpaceKey: null,
    linkedSpaceName: null,
    lifecycleState: 'ACTIVE',
    memberCount: 12,
    unreadCount: 0,
    favorite: false,
    pinned: false,
    lastMessage: null,
    lastMessageAt: '2026-08-27T08:00:00Z',
    version: 3,
  };
}

function policy(version = 4): MessagingPolicy {
  return {
    directMessagesEnabled: true,
    spaceMessagingEnabled: true,
    allowMessageEdit: true,
    allowMessageDelete: true,
    aiAssistanceEnabled: true,
    aiAutoExecuteEnabled: false,
    retentionDays: 1095,
    maximumAttachmentMb: 100,
    version,
  };
}

async function mockMessagingAdmin(page: Page, canManage: boolean) {
  await mockShellSession(page, ['MESSAGING_ADMIN'], {
    locale: 'en',
    permissions: [
      ...APP_PERMISSIONS,
      {
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MESSAGING',
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      },
      ...(canManage
        ? [
            {
              resourceType: 'ADMIN',
              resourceKey: 'ADMIN.MESSAGING',
              permissionCode: 'MANAGE',
              effect: 'ALLOW' as const,
            },
          ]
        : []),
    ],
  });

  let serverPolicy = policy();
  let updateAttempts = 0;
  const updates: Array<Omit<MessagingPolicy, 'aiAutoExecuteEnabled'>> = [];
  await page.route('**/api/messaging/v1/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/admin/overview') {
      const overview: MessagingAdminOverview = {
        generatedAt: '2026-08-27T08:05:00Z',
        metrics: {
          activeConversations: 14,
          spaceLinkedConversations: 5,
          activeMembers: 82,
          retainedMessages: 1630,
          restrictedConversations: 1,
        },
        policy: serverPolicy,
        governedConversations: [governedConversation()],
      };
      return fulfill(route, overview);
    }
    if (request.method() === 'PUT' && url.pathname === '/api/messaging/v1/admin/policy') {
      const update = request.postDataJSON() as Omit<MessagingPolicy, 'aiAutoExecuteEnabled'>;
      updates.push(update);
      updateAttempts += 1;
      if (updateAttempts === 1) {
        serverPolicy = { ...serverPolicy, retentionDays: 180, version: 5 };
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            success: false,
            code: 'RESOURCE_CONFLICT',
            message: 'Version conflict',
          }),
        });
      }
      serverPolicy = { ...serverPolicy, ...update, aiAutoExecuteEnabled: false, version: 6 };
      return fulfill(route, serverPolicy);
    }
    return route.fallback();
  });
  return { updates };
}

test('validates, reconciles, and persists tenant messaging policy without stale overwrite', async ({
  page,
}) => {
  const state = await mockMessagingAdmin(page, true);
  await page.goto('/messages/admin/policy');

  const save = page.getByRole('button', { name: 'Save' });
  const retention = page.getByLabel('Retention days');
  await expect(save).toBeDisabled();
  await retention.fill('20');
  await expect(page.getByText('Enter a whole number from 30 to 3650.')).toBeVisible();
  await expect(save).toBeDisabled();

  await retention.fill('120');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByText(
      'Another administrator changed this policy. The latest settings were loaded; review and save again.'
    )
  ).toBeVisible();
  await expect(retention).toHaveValue('180');
  await expect(save).toBeDisabled();

  await retention.fill('365');
  await save.click();
  await expect(page.getByText('Messaging policy saved.')).toBeVisible();
  await expect.poll(() => state.updates.length).toBe(2);
  expect(state.updates[0]).toMatchObject({ retentionDays: 120, version: 4 });
  expect(state.updates[1]).toMatchObject({ retentionDays: 365, version: 5 });
});

test('keeps policy viewers read-only and governance rows non-interactive', async ({ page }) => {
  await mockMessagingAdmin(page, false);
  await page.goto('/messages/admin/policy');

  await expect(
    page.getByText(
      'You can review this policy, but changing it requires Messaging management permission.'
    )
  ).toBeVisible();
  await expect(page.getByLabel('Allow DMs')).toBeDisabled();
  await expect(page.getByLabel('Retention days')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  await page.goto('/messages/admin/overview');
  await expect(page.getByText('Operations governance')).toBeVisible();
  await expect(page.locator('button').filter({ hasText: 'Operations governance' })).toHaveCount(0);
});
