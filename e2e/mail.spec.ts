import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import type { MailOrganization } from '@dwp-frontend/shared-utils';

import { mockShellSession } from './support/shell-session';

const MEMBER_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  {
    resourceType: 'APP',
    resourceKey: 'APP.MAIL',
    permissionCode: 'UPDATE',
    effect: 'ALLOW' as const,
  },
];

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown) {
  return route.fulfill({ contentType: 'application/json', body: success(data) });
}

function thread(id: string, options: { shared?: boolean; subject?: string } = {}) {
  return {
    threadId: id,
    accountId: '10000000-0000-0000-0000-000000000001',
    accountName: options.shared ? 'People Help' : 'Mina Kim',
    folderType: 'INBOX',
    sharedInboxId: options.shared ? '20000000-0000-0000-0000-000000000001' : null,
    sharedInboxName: options.shared ? 'People Help' : null,
    subject: options.subject ?? 'Customer launch review',
    preview: 'Please confirm the launch review before the customer meeting.',
    participants: [{ name: 'Alex Park', email: 'alex.park@example.com' }],
    latestMessageAt: '2026-08-19T08:30:00Z',
    unread: true,
    starred: false,
    importance: 'HIGH',
    triageLane: options.shared ? 'ASSIGNED' : 'PRIORITY',
    workflowState: 'OPEN',
    snoozedUntil: null,
    assignedUserId: options.shared ? 42 : null,
    assignedName: options.shared ? 'Mina Kim' : null,
    attachments: false,
    externalSender: true,
    classification: 'CONFIDENTIAL',
    messageCount: 2,
    version: 3,
  };
}

function detail(item: ReturnType<typeof thread>, deliveryState = 'FAILED') {
  return {
    thread: item,
    messages: [
      {
        messageId: '30000000-0000-0000-0000-000000000001',
        senderEmail: 'alex.park@example.com',
        senderName: 'Alex Park',
        recipients: [{ name: 'Mina Kim', email: 'mina.kim@sk.com', type: 'TO' }],
        direction: 'INBOUND',
        bodyFormat: 'TEXT',
        body: 'Please confirm the launch review.',
        attachments: [],
        sentAt: '2026-08-19T08:00:00Z',
        deliveryState: 'RECEIVED',
        acceptedAt: null,
        lastDeliveryError: null,
      },
      {
        messageId: '30000000-0000-0000-0000-000000000002',
        senderEmail: 'mina.kim@sk.com',
        senderName: 'Mina Kim',
        recipients: [{ name: 'Alex Park', email: 'alex.park@example.com', type: 'TO' }],
        direction: 'OUTBOUND',
        bodyFormat: 'TEXT',
        body: 'I will confirm the final review shortly.',
        attachments: [],
        sentAt: '2026-08-19T08:15:00Z',
        deliveryState,
        acceptedAt: null,
        lastDeliveryError: deliveryState === 'FAILED' ? 'PROVIDER_UNAVAILABLE' : null,
      },
    ],
    internalComments: [],
    proposals: [],
    sharedInboxMembers: item.sharedInboxId
      ? [
          {
            userId: 42,
            displayName: 'Mina Kim',
            emailAddress: 'mina.kim@sk.com',
            memberRole: 'MANAGER',
          },
          {
            userId: 43,
            displayName: 'Jin Lee',
            emailAddress: 'jin.lee@sk.com',
            memberRole: 'MEMBER',
          },
        ]
      : [],
  };
}

function mailOrganization(): MailOrganization {
  return {
    accounts: [
      {
        accountId: '10000000-0000-0000-0000-000000000001',
        emailAddress: 'mina.kim@sk.com',
        displayName: 'Mina Kim',
        accountKind: 'PERSONAL',
        providerType: 'DWP_SANDBOX',
        connectionState: 'ACTIVE',
        synchronizationState: 'SYNCED',
        defaultAccount: true,
      },
    ],
    folders: [
      {
        folderId: '11000000-0000-0000-0000-000000000001',
        accountId: '10000000-0000-0000-0000-000000000001',
        parentFolderId: null,
        folderKey: 'inbox',
        displayName: 'Inbox',
        folderType: 'INBOX',
        color: 'BLUE',
        synchronizationState: 'SYNCED',
        sortOrder: 10,
        totalCount: 6,
        unreadCount: 2,
        version: 0,
      },
      {
        folderId: '11000000-0000-0000-0000-000000000002',
        accountId: '10000000-0000-0000-0000-000000000001',
        parentFolderId: null,
        folderKey: 'projects',
        displayName: 'Projects',
        folderType: 'CUSTOM',
        color: 'TEAL',
        synchronizationState: 'LOCAL_ONLY',
        sortOrder: 100,
        totalCount: 3,
        unreadCount: 1,
        version: 0,
      },
    ],
    rules: [],
    recentRuns: [],
    generatedAt: '2026-08-27T08:00:00Z',
  };
}

async function mockMailMember(page: Page) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    displayName: 'Mina Kim',
    email: 'mina.kim@sk.com',
    permissions: MEMBER_PERMISSIONS,
  });
}

test('mail home exposes work signals without serious accessibility defects', async ({ page }) => {
  await mockMailMember(page);
  await page.route('**/api/platform/v1/mail/organization', (route) =>
    fulfill(route, mailOrganization())
  );
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: [],
      metrics: { unread: 6, urgent: 1, needsReply: 2, assigned: 1, snoozed: 0, activeProposals: 0 },
      focusQueue: [thread('40000000-0000-0000-0000-000000000001')],
      proposals: [],
      sharedInboxes: [
        {
          sharedInboxId: '20000000-0000-0000-0000-000000000001',
          name: 'People Help',
          address: 'people@sk.com',
          openCount: 4,
          unassignedCount: 1,
          overdueCount: 0,
          serviceTargetMinutes: 240,
        },
      ],
      generatedAt: '2026-08-19T09:00:00Z',
    })
  );

  await page.goto('/mail/home');
  await expect(
    page.getByRole('heading', { name: '3 important signals are waiting for a decision' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Focus queue' })).toBeVisible();
  await expect(page.getByText('Customer launch review')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Automatic organization rhythm' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('personal folders and sender rules can be created and run from one workspace', async ({
  page,
}) => {
  await mockMailMember(page);
  const state = mailOrganization();
  let createdFolderName = '';
  let createdRuleName = '';
  let executedRule = false;
  await page.route('**/api/platform/v1/mail/organization**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/organization')) {
      return fulfill(route, state);
    }
    if (request.method() === 'POST' && path.endsWith('/v1/mail/organization/folders')) {
      const input = await request.postDataJSON();
      createdFolderName = input.displayName;
      const folder = {
        ...state.folders[1],
        folderId: '11000000-0000-0000-0000-000000000003',
        folderKey: 'customer-launch',
        displayName: input.displayName,
        color: input.color,
      };
      state.folders.push(folder);
      return fulfill(route, folder);
    }
    if (request.method() === 'POST' && path.endsWith('/v1/mail/organization/rules')) {
      const input = await request.postDataJSON();
      createdRuleName = input.displayName;
      expect(input.conditions).toEqual([
        { field: 'SENDER', operator: 'CONTAINS', value: '@partner.example' },
      ]);
      expect(input.actions[0].type).toBe('MOVE_TO_FOLDER');
      const rule = {
        ruleId: '12000000-0000-0000-0000-000000000001',
        ...input,
        synchronizationState: 'LOCAL_ONLY',
        lastRunAt: null,
        lastMatchCount: 0,
        version: 0,
      };
      state.rules.push(rule);
      return fulfill(route, rule);
    }
    if (request.method() === 'POST' && path.endsWith('/run')) {
      executedRule = true;
      state.rules[0]!.lastRunAt = '2026-08-27T08:10:00Z';
      state.rules[0]!.lastMatchCount = 2;
      return fulfill(route, {
        runId: '13000000-0000-0000-0000-000000000001',
        ruleId: state.rules[0]!.ruleId,
        triggerKind: 'MANUAL',
        status: 'SUCCEEDED',
        scannedCount: 6,
        matchedCount: 2,
        changedCount: 2,
        startedAt: '2026-08-27T08:10:00Z',
        completedAt: '2026-08-27T08:10:01Z',
      });
    }
    return route.fallback();
  });

  await page.goto('/mail/organization');
  await expect(page.getByRole('heading', { name: 'Folders and rules' })).toBeVisible();
  await page.getByRole('button', { name: 'New folder' }).click();
  const folderDialog = page.getByRole('dialog');
  await folderDialog.getByLabel('Folder name').fill('Customer launch');
  await folderDialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => createdFolderName).toBe('Customer launch');
  await expect(page.getByText('Customer launch', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New rule' }).click();
  const ruleDialog = page.getByRole('dialog');
  await ruleDialog.getByLabel('Rule name').fill('Partner launch mail');
  await ruleDialog.getByLabel('Value').fill('@partner.example');
  await ruleDialog.getByLabel('Destination folder').click();
  await page.getByRole('option', { name: 'Customer launch' }).click();
  await ruleDialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => createdRuleName).toBe('Partner launch mail');
  await expect(page.getByText('Partner launch mail')).toBeVisible();
  await page.getByRole('button', { name: 'Run now' }).click();
  await expect.poll(() => executedRule).toBe(true);
  await expect(page.locator('span:visible', { hasText: 'Last run · 2 matched' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('mailbox pagination, shared ownership, and failed delivery retry are complete', async ({
  page,
}) => {
  await mockMailMember(page);
  const first = thread('40000000-0000-0000-0000-000000000001', {
    subject: 'First page request',
  });
  const second = thread('40000000-0000-0000-0000-000000000002', {
    subject: 'Second page request',
  });
  const shared = thread('40000000-0000-0000-0000-000000000003', {
    shared: true,
    subject: 'People policy question',
  });
  let retried = false;
  let assignedToJin = false;
  await page.route('**/api/platform/v1/mail/threads?*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('sharedOnly') === 'true') {
      return fulfill(route, { items: [shared], total: 1, page: 0, pageSize: 30 });
    }
    const pageNumber = Number(url.searchParams.get('page') ?? '0');
    return fulfill(route, {
      items: pageNumber === 0 ? [first] : [second],
      total: 31,
      page: pageNumber,
      pageSize: 30,
    });
  });
  await page.route('**/api/platform/v1/mail/threads/*/messages/*/retry', (route) => {
    retried = true;
    return fulfill(route, detail(shared, 'QUEUED'));
  });
  await page.route('**/api/platform/v1/mail/threads/*/assignment', async (route) => {
    expect((await route.request().postDataJSON()).assignedUserId).toBe(43);
    assignedToJin = true;
    return fulfill(route, {
      ...detail({ ...shared, assignedUserId: 43, assignedName: 'Jin Lee', version: 4 }),
    });
  });
  await page.route('**/api/platform/v1/mail/threads/*', (route) => {
    const id = route.request().url().split('/').at(-1);
    const item =
      id === second.threadId
        ? second
        : id === shared.threadId
          ? assignedToJin
            ? { ...shared, assignedUserId: 43, assignedName: 'Jin Lee', version: 4 }
            : shared
          : first;
    return fulfill(route, detail(item, retried && id === shared.threadId ? 'QUEUED' : 'FAILED'));
  });

  await page.goto('/mail/inbox');
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) {
    await page.getByRole('button', { name: /First page request/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'First page request' })).toBeVisible();
  if (mobile) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.getByRole('button', { name: 'Next page' }).click();
  if (mobile) {
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: /Second page request/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Second page request' })).toBeVisible();
  if (!mobile) {
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  }

  await page.goto(`/mail/shared?thread=${shared.threadId}`);
  await expect(page.getByText('Delivery failed')).toBeVisible();
  await page.getByRole('button', { name: 'Retry delivery' }).click();
  await expect(page.getByText('Queued', { exact: true })).toBeVisible();

  await page.getByLabel('Assignee').click();
  await page.getByRole('option', { name: /Jin Lee/ }).click();
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(page.getByText('Assigned to Jin Lee')).toBeVisible();
});

test('trash and restore keep the mailbox lifecycle reversible', async ({ page }) => {
  await mockMailMember(page);
  const organization = mailOrganization();
  let current = thread('40000000-0000-0000-0000-000000000009', {
    subject: 'Reversible lifecycle review',
  });
  const lifecycleActions: string[] = [];
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      const requestedFolder = url.searchParams.get('folder');
      const visible =
        (requestedFolder === 'INBOX' && current.folderType === 'INBOX') ||
        (requestedFolder === 'TRASH' && current.folderType === 'TRASH');
      return fulfill(route, {
        items: visible ? [current] : [],
        total: visible ? 1 : 0,
        page: 0,
        pageSize: 30,
      });
    }
    if (request.method() === 'POST' && path.endsWith('/lifecycle')) {
      const input = await request.postDataJSON();
      lifecycleActions.push(input.action);
      current =
        input.action === 'RESTORE'
          ? { ...current, folderType: 'INBOX', workflowState: 'OPEN', version: current.version + 1 }
          : {
              ...current,
              folderType: 'TRASH',
              workflowState: 'TRASHED',
              unread: false,
              version: current.version + 1,
            };
      return fulfill(route, { thread: current, deleted: false });
    }
    if (request.method() === 'GET' && path.endsWith(`/${current.threadId}`)) {
      return fulfill(route, detail(current, 'SENT'));
    }
    return route.fallback();
  });

  await page.goto('/mail/inbox');
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) {
    await page.getByRole('button', { name: /Reversible lifecycle review/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Reversible lifecycle review' })).toBeVisible();
  await page.getByRole('button', { name: 'Move to folder' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH']);

  await page.goto('/mail/trash');
  if (mobile) {
    await page.getByRole('button', { name: /Reversible lifecycle review/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Reversible lifecycle review' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore to previous location' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE']);
});

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
