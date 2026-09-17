import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  detail,
  fulfill,
  mailOrganization,
  MEMBER_PERMISSIONS,
  mockMailMember,
  thread,
} from './support/mail-fixtures';
import { mockShellSession } from './support/shell-session';

const sentThread = {
  ...thread('40000000-0000-0000-0000-000000000081', {
    subject: 'Quarterly delivery receipt',
  }),
  folderType: 'SENT',
  workflowState: 'DONE',
  unread: false,
  externalSender: false,
};

const actionProposal = {
  proposalId: '50000000-0000-4000-8000-000000000081',
  threadId: sentThread.threadId,
  type: 'CREATE_TASK',
  actionContractVersion: 1,
  status: 'PROPOSED',
  title: 'Prepare the quarterly customer follow-up',
  summary: 'Review the source message before continuing in the work app.',
  evidence: [{ label: 'Quarterly delivery receipt' }],
  proposedPayload: {
    provider: 'Jira',
    projectKey: 'DWP',
    priority: 'HIGH',
    requiresConfirmation: true,
  },
  confidence: 0.99,
  riskLevel: 'MEDIUM',
  requiredResourceKey: 'APP.MAIL',
  requiredPermissionCode: 'UPDATE',
  targetRoute: '/work?action=create',
  expiresAt: '2099-12-31T23:59:59Z',
  version: 2,
};

test('secondary mail workspaces expose honest capabilities and reflow without overflow', async ({
  page,
}, testInfo) => {
  await setScenarioViewport(page, testInfo);
  await mockMailMember(page);
  await mockSecondaryMailApis(page);

  await page.goto('/mail/search');
  await expect(page.getByRole('heading', { name: 'Search mail' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save current view' })).toBeDisabled();
  await page.getByRole('searchbox', { name: 'Search my mail' }).fill('renewal evidence');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/mail\/search\?query=renewal(?:\+|%20)evidence$/u);
  await expect(page.getByRole('heading', { name: 'No messages matched' })).toBeVisible();
  await page.getByRole('button', { name: 'Create rule from search' }).click();
  await expect(page).toHaveURL(
    /\/mail\/organization\?section=rules&create=from-search&ruleSubject=renewal(?:\+|%20)evidence/u
  );
  const seededRule = page.getByRole('dialog', { name: 'Create a mail organization rule' });
  await expect(seededRule).toBeVisible();
  await expect(seededRule.getByLabel('Rule name')).toHaveValue('Rule from mail search');
  await expect(seededRule.getByLabel('Value').first()).toHaveValue('renewal evidence');
  await seededRule.getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/mail/search?query=renewal%20evidence');
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'search');

  await page.goto('/mail/follow-up');
  await expect(page.getByRole('heading', { name: 'Follow-up', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Needs reply (0)' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('tab', { name: 'Later (0)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Waiting for reply (0)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing needs follow-up' })).toBeVisible();
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'follow-up');

  await page.goto('/mail/delivery?bucket=attention');
  await expect(page.getByRole('heading', { name: 'Delivery status' })).toBeVisible();
  await page.getByText('Quarterly delivery receipt', { exact: true }).first().click();
  await expect(page.getByText('Outcome needs verification')).toBeVisible();
  await expect(page.getByText(/Reconcile the provider outcome/u)).toBeVisible();
  await expect(page.getByText('PROVIDER_UNAVAILABLE')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reconcile outcome' })).toBeEnabled();
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'delivery');

  await page.goto('/mail/actions');
  await expect(page.getByRole('heading', { name: 'Action proposals' })).toBeVisible();
  await expect(
    page.getByText(
      'Accepting a proposal opens the responsible app for final review. It does not complete the action here.'
    )
  ).toBeVisible();
  const proposal = page.getByTestId('mail-proposal-CREATE_TASK');
  await expect(proposal.getByRole('heading', { name: actionProposal.title })).toBeVisible();
  await expect(proposal).not.toContainText(/\b\d+(?:\.\d+)?\s*%/u);
  await expect(proposal).not.toContainText(/confidence|match/iu);
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'actions');

  await page.goto('/mail/templates');
  await expect(page.getByRole('heading', { name: 'Templates and signatures' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No saved templates' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New template' }).first()).toBeVisible();
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'templates');

  await page.goto('/mail/accounts');
  await expect(page.getByRole('heading', { name: 'My accounts and preferences' })).toBeVisible();
  await expect(page.getByText('Provider authorization evidence')).toBeVisible();
  await expect(page.getByText('Provider consent')).toBeVisible();
  await expect(page.getByText('Access token')).toBeVisible();
  await expect(page.getByText('Feature readiness evidence')).toBeVisible();
  await expect(
    page.getByText('Last successful operation: 2026-09-17T04:55:00Z · scope SEND')
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reading and writing' })).toBeVisible();
  await page.getByRole('tab', { name: 'Shortcuts' }).click();
  await expect(page.getByText('Enable mail keyboard shortcuts')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  await expectHonestResponsiveSurface(page);
  await attachScreenshot(page, testInfo, 'accounts-preferences');
});

test('search, follow-up, and delivery pagination preserve the server page in the URL', async ({
  page,
}) => {
  await mockMailMember(page);
  await mockSecondaryMailApis(page, { pagedThreads: true, pagedDeliveries: true });

  await page.goto('/mail/search?query=pageable');
  await expect(page.getByText('Search result page 1', { exact: true })).toBeVisible();
  await expect(page.getByText('1–50 of 101 messages')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/mail\/search\?query=pageable&page=1$/u);
  await expect(page.getByText('Search result page 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page).toHaveURL(/\/mail\/search\?query=pageable$/u);

  await page.goto('/mail/follow-up');
  await expect(page.getByText('Reply page 1', { exact: true })).toBeVisible();
  await expect(page.getByText('1–50 of 101 messages')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/mail\/follow-up\?bucket=reply&page=1$/u);
  await expect(page.getByText('Reply page 2', { exact: true })).toBeVisible();

  await page.goto('/mail/delivery?bucket=attention');
  await expect(page.getByText('Delivery page 1', { exact: true })).toBeVisible();
  await expect(page.getByText('1–30 of 61 deliveries')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/mail\/delivery\?bucket=attention&page=1$/u);
  await expect(page.getByText('Delivery page 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page).toHaveURL(/\/mail\/delivery\?bucket=attention$/u);
});

test('action center restores the returned proposal and reports the owner result', async ({
  page,
}) => {
  await mockMailMember(page);
  await mockSecondaryMailApis(page, {
    proposalStatus: 'EXECUTED',
    handoff: {
      proposalId: actionProposal.proposalId,
      commandId: '60000000-0000-4000-8000-000000000081',
      ownerRoute: '/work?action=create',
      returnTo: `/mail/actions?proposalId=${actionProposal.proposalId}`,
      focus: `mail-proposal-${actionProposal.proposalId}`,
      status: 'EXECUTED',
      resultRef: 'work-item/DWP-81',
      updatedAt: '2026-09-17T09:30:00Z',
      version: 4,
    },
  });

  await page.goto(
    `/mail/actions?proposalId=${actionProposal.proposalId}&focus=mail-proposal-${actionProposal.proposalId}`
  );

  await expect(page.getByText('The responsible app completed the action.')).toBeVisible();
  await expect(page.getByText('Result: work-item/DWP-81')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe(`mail-proposal-${actionProposal.proposalId}`);
});

test('retention and delivery recovery remain blocked without required evidence', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockMailAdministrator(page);
  for (const scenario of responsiveAuditScenarios(testInfo)) {
    await applyResponsiveAuditScenario(page, scenario);
    await page.goto('/mail/admin/retention');
    if (scenario.zoom) await applyTwoHundredPercentTextZoom(page);
    await expect(
      page.getByRole('heading', { name: 'Retention, legal hold, and purge' })
    ).toBeVisible();
    await expect(page.getByText(/Destructive actions remain blocked\./u)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview purge impact' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Execute purge' })).toBeDisabled();
    await expect(
      page.getByText('Effective legal holds', { exact: true }).locator('..')
    ).toContainText('Unavailable');
    await expect(page.getByText('Purge candidates', { exact: true }).locator('..')).toContainText(
      'Unavailable'
    );
    await expectHonestResponsiveSurface(page);
    await attachScreenshot(page, testInfo, `admin-retention-${scenario.name}`);

    await page.goto('/mail/admin/delivery-audit');
    if (scenario.zoom) await applyTwoHundredPercentTextZoom(page);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Delivery audit and recovery' })
    ).toBeVisible();
    await expect(
      page.getByText(/Message-level outcome and duplicate-safety evidence are required/u)
    ).toBeVisible();
    await expect(page.getByText('No message-level recovery evidence is available.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconcile outcome' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Retry delivery' })).toBeDisabled();
    await expectHonestResponsiveSurface(page);
    await attachScreenshot(page, testInfo, `admin-delivery-audit-${scenario.name}`);
  }
});

test('shared inbox People picker keeps verified member actions visible across reflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await mockMailAdministrator(page, { sharedInbox: true });
  for (const scenario of responsiveAuditScenarios(testInfo)) {
    await applyResponsiveAuditScenario(page, scenario);
    await page.goto('/mail/admin/shared-inboxes');
    if (scenario.zoom) await applyTwoHundredPercentTextZoom(page);
    await expect(page.getByRole('heading', { name: 'Shared inbox access' })).toBeVisible();
    await page.getByRole('button', { name: 'Add member' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add member' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Search people in this tenant').fill('Mina');
    const candidate = dialog.getByRole('option', { name: /Mina Verified/u });
    await expect(candidate).toBeVisible();
    await candidate.click();
    await dialog
      .getByRole('checkbox', {
        name: /I reviewed assignment, draft, pending command, and provider revocation impact/u,
      })
      .check();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
    await expectHonestResponsiveSurface(page);
    await attachScreenshot(page, testInfo, `admin-shared-access-${scenario.name}`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  }
});

async function mockSecondaryMailApis(
  page: Page,
  options?: {
    proposalStatus?: string;
    handoff?: Record<string, unknown>;
    pagedThreads?: boolean;
    pagedDeliveries?: boolean;
  }
) {
  await page.route('**/api/platform/v1/mail/proposals**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/proposals/${actionProposal.proposalId}/handoff`)) {
      return fulfill(route, options?.handoff ?? {});
    }
    return fulfill(route, {
      items: [{ ...actionProposal, status: options?.proposalStatus ?? actionProposal.status }],
      total: 1,
      page: Number(url.searchParams.get('page') ?? 0),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    });
  });
  await page.route('**/api/platform/v1/mail/saved-views', (route) => fulfill(route, []));
  await page.route('**/api/platform/v1/mail/organization', (route) =>
    fulfill(route, mailOrganization())
  );
  await page.route('**/api/platform/v1/mail/follow-ups**', (route) => fulfill(route, []));
  await page.route('**/api/platform/v1/mail/writing-assets', (route) =>
    fulfill(route, { templates: [], signatures: [] })
  );
  await page.route('**/api/platform/v1/mail/preferences', (route) =>
    fulfill(route, {
      density: 'COMFORTABLE',
      remoteImages: 'BLOCK',
      sendDelaySeconds: 0,
      keyboardShortcuts: false,
      notifyNewMail: true,
      notifySharedAssignment: true,
      notifyFollowUpDue: true,
      defaultAccountId: null,
      defaultSignatureId: null,
      version: 1,
      orgLocks: {},
    })
  );
  await page.route('**/api/platform/v1/mail/deliveries**', (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page') ?? 0);
    const deliveryId = 'delivery-81';
    const summary = {
      deliveryId,
      receiptId: 'receipt-81',
      threadId: sentThread.threadId,
      subject: options?.pagedDeliveries ? `Delivery page ${pageNumber + 1}` : sentThread.subject,
      recipientSummary: 'customer@example.com',
      accountName: 'DWP Mail',
      kind: 'PERSONAL',
      requestedAt: '2026-09-17T01:00:00Z',
      state: 'UNKNOWN',
      canReschedule: false,
      canCancel: false,
      canReconcile: true,
      version: 1,
    };
    if (url.pathname.endsWith(`/deliveries/${deliveryId}`)) {
      return fulfill(route, {
        ...summary,
        recipients: [{ type: 'TO', name: 'Customer', email: 'customer@example.com' }],
        timeline: [
          { state: 'QUEUED', occurredAt: '2026-09-17T01:00:00Z' },
          { state: 'UNKNOWN', occurredAt: '2026-09-17T01:01:00Z' },
        ],
        lastCheckedAt: '2026-09-17T01:01:00Z',
        retryEligibility: 'RECONCILE_REQUIRED',
      });
    }
    return fulfill(route, {
      items: url.searchParams.get('bucket') === 'ATTENTION' ? [summary] : [],
      total:
        url.searchParams.get('bucket') === 'ATTENTION' ? (options?.pagedDeliveries ? 61 : 1) : 0,
      page: pageNumber,
      pageSize: Number(url.searchParams.get('pageSize') ?? 30),
      generatedAt: '2026-09-17T01:01:00Z',
    });
  });
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/threads/${sentThread.threadId}`)) {
      return fulfill(route, detail(sentThread, 'FAILED'));
    }
    if (options?.pagedThreads) {
      const pageNumber = Number(url.searchParams.get('page') ?? 0);
      const pageThread = thread(
        pageNumber === 0
          ? '40000000-0000-0000-0000-000000000091'
          : '40000000-0000-0000-0000-000000000092',
        {
          subject:
            url.searchParams.get('lane') === 'NEEDS_REPLY'
              ? `Reply page ${pageNumber + 1}`
              : `Search result page ${pageNumber + 1}`,
        }
      );
      if (
        url.searchParams.get('query') === 'pageable' ||
        url.searchParams.get('lane') === 'NEEDS_REPLY'
      ) {
        return fulfill(route, {
          items: [pageThread],
          total: 101,
          page: pageNumber,
          pageSize: Number(url.searchParams.get('pageSize') ?? 50),
        });
      }
    }
    const items = url.searchParams.get('folder') === 'SENT' ? [sentThread] : [];
    return fulfill(route, { items, total: items.length, page: 0, pageSize: 50 });
  });
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: mailOrganization().accounts,
      metrics: {
        unread: 0,
        urgent: 0,
        needsReply: 0,
        assigned: 0,
        snoozed: 0,
        activeProposals: 1,
      },
      focusQueue: [],
      proposals: [actionProposal],
      sharedInboxes: [],
      generatedAt: new Date().toISOString(),
    })
  );
}

async function mockMailAdministrator(page: Page, options: { sharedInbox?: boolean } = {}) {
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
      ...[
        'CONNECTION_MANAGE',
        'SHARED_INBOX_MANAGE',
        'POLICY_MANAGE',
        'HOLD_MANAGE',
        'PURGE_PREVIEW',
        'PURGE_AUTHORIZE',
        'PURGE_EXECUTE',
        'AUDIT_READ',
        'DELIVERY_RECONCILE',
        'DELIVERY_RETRY',
        'DELIVERY_CANCEL',
        'EVIDENCE_EXPORT',
      ].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.MAIL',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
  });
  await page.route('**/api/platform/v1/admin/mail/overview', (route) =>
    fulfill(route, {
      personalAccounts: 21,
      sharedAccounts: 2,
      activeConnections: 1,
      degradedConnections: 0,
      openSharedThreads: 4,
      pendingAiProposals: 0,
      queuedDeliveries: 2,
      failedDeliveries: 1,
      policy: {
        externalSenderBanner: true,
        blockRemoteImages: true,
        allowSharedInboxes: true,
        aiAssistanceEnabled: true,
        aiCrossAppActionsEnabled: false,
        aiAutoExecuteEnabled: false,
        retentionDays: 365,
        maximumAttachmentMb: 25,
        version: 3,
      },
      connections: [],
      sharedInboxes: options.sharedInbox
        ? [
            {
              sharedInboxId: '20000000-0000-0000-0000-000000000001',
              inboxKey: 'people-help',
              displayName: 'People Help',
              address: 'people-help@example.com',
              purpose: 'Employee support',
              serviceTargetMinutes: 240,
              lifecycleState: 'ACTIVE',
              openCount: 4,
              overdueCount: 0,
              version: 2,
            },
          ]
        : [],
      providerCatalog: [],
      generatedAt: new Date().toISOString(),
    })
  );
  if (options.sharedInbox) {
    await page.route('**/api/platform/v1/admin/mail/shared-inboxes/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/member-candidates')) {
        return fulfill(route, [
          {
            userId: 42,
            displayName: 'Mina Verified',
            department: 'Digital Workplace',
            email: 'mina.verified@example.com',
          },
        ]);
      }
      if (path.endsWith('/members') && route.request().method() === 'GET') {
        return fulfill(route, {
          sharedInboxId: '20000000-0000-0000-0000-000000000001',
          version: 2,
          providerState: 'APPLIED',
          members: [],
        });
      }
      return route.fallback();
    });
  }
}

type ResponsiveAuditScenario = Readonly<{
  name: string;
  width: number;
  height: number;
  zoom?: boolean;
}>;

function responsiveAuditScenarios(testInfo: TestInfo): ResponsiveAuditScenario[] {
  return testInfo.project.name === 'mobile'
    ? [
        { name: '390', width: 390, height: 844 },
        { name: '320', width: 320, height: 844 },
      ]
    : [
        { name: '1440', width: 1440, height: 900 },
        { name: '1280', width: 1280, height: 900 },
        { name: '1280-200-percent', width: 1280, height: 1024, zoom: true },
      ];
}

async function applyResponsiveAuditScenario(page: Page, scenario: ResponsiveAuditScenario) {
  await page.setViewportSize({ width: scenario.width, height: scenario.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function applyTwoHundredPercentTextZoom(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
}

async function setScenarioViewport(page: Page, testInfo: TestInfo) {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize({ width: mobile ? 320 : 1280, height: mobile ? 844 : 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function expectHonestResponsiveSurface(page: Page) {
  await expect(page.locator('#dwp-main-content')).not.toContainText(/\b\d+(?:\.\d+)?\s*%/u);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(`${name}-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png',
  });
}
