import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  detail,
  draftDetail,
  fulfill,
  mailAddressBook,
  mailOrganization,
  mockMailMember,
  thread,
} from './support/mail-fixtures';

test('mail home exposes work signals without serious accessibility defects', async ({ page }) => {
  await mockMailMember(page);
  await page.route('**/api/platform/v1/mail/address-book**', (route) =>
    fulfill(
      route,
      mailAddressBook(
        [{ favorite: true }, { favorite: false }],
        [
          {
            groupId: '62000000-0000-0000-0000-000000000010',
            displayName: 'Launch group',
            description: 'Reviewed launch recipients',
            members: [],
            version: 0,
            updatedAt: '2026-09-03T03:00:00Z',
          },
        ]
      )
    )
  );
  await page.route('**/api/platform/v1/mail/organization', (route) =>
    fulfill(route, mailOrganization())
  );
  await page.route('**/api/platform/v1/mail/threads**', (route) =>
    fulfill(route, { items: [], total: 0, page: 0, pageSize: 30 })
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
  await expect(page.getByRole('heading', { name: 'Mail work tools' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Automatic organization rhythm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contacts and mail groups' })).toBeVisible();
  await expect(page.getByText('Saved contacts').locator('..')).toContainText('2');

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

  await page.getByRole('searchbox', { name: 'Search my mail' }).fill('launch review');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/\/mail\/inbox\?query=launch(?:\+|%20)review/u);
  await expect(page.getByPlaceholder('Search sender, subject, or content')).toHaveValue(
    'launch review'
  );
  await page.goBack();

  await page.getByRole('button', { name: /Later/ }).click();
  await expect(page).toHaveURL(/\/mail\/inbox\?state=SNOOZED/u);
  await page.goBack();
  await page.getByRole('button', { name: 'Mail groups', exact: true }).click();
  await expect(page).toHaveURL(/\/mail\/contacts\?view=groups$/u);
  await expect(page.getByRole('tab', { name: 'My mail groups' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.goBack();
  await page.getByRole('button', { name: 'Open shared inboxes' }).click();
  await expect(page).toHaveURL(/\/mail\/shared$/u);
});

test('connected accounts expose actual account and synchronization states', async ({ page }) => {
  await mockMailMember(page);
  const organization = mailOrganization();
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: [
        {
          ...organization.accounts[0],
          connectionState: 'REAUTHENTICATION_REQUIRED',
          synchronizationState: 'READY',
        },
        {
          ...organization.accounts[0],
          accountId: '10000000-0000-0000-0000-000000000002',
          emailAddress: 'shared@sk.com',
          displayName: 'Shared operations',
          accountKind: 'SHARED',
          connectionState: 'DISCONNECTED',
          synchronizationState: 'PAUSED',
          defaultAccount: false,
        },
      ],
      metrics: { unread: 0, urgent: 0, needsReply: 0, assigned: 0, snoozed: 0, activeProposals: 0 },
      focusQueue: [],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-08-29T03:00:00Z',
    })
  );

  await page.goto('/mail/accounts');
  await expect(page.getByText('Reauthentication required')).toBeVisible();
  await expect(page.getByText(/authenticate with the provider again/i)).toBeVisible();
  await expect(page.getByText('Disconnected')).toBeVisible();
  await expect(page.getByText(/mail cannot be retrieved or sent/i)).toBeVisible();
});

test('partial drafts autosave and promote the same draft when sent', async ({ page }) => {
  await mockMailMember(page);
  const organization = mailOrganization();
  const draftId = '40000000-0000-0000-0000-000000000020';
  const creates: Array<Record<string, unknown>> = [];
  const saves: Array<Record<string, unknown>> = [];
  const sends: Array<Record<string, unknown>> = [];
  let version = 1;
  let fields: { toEmail?: string; subject?: string; body?: string } = {};
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [], total: 0, page: 0, pageSize: 30 });
    }
    if (request.method() === 'PUT' && path.endsWith(`/${draftId}/draft`)) {
      const input = (await request.postDataJSON()) as Record<string, unknown>;
      sends.push(input);
      return fulfill(route, {
        ...draftDetail(draftId, fields, version + 1),
        thread: {
          ...draftDetail(draftId, fields, version + 1).thread,
          folderType: 'SENT',
          workflowState: 'DONE',
        },
      });
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/mail/drafts**', async (route) => {
    const request = route.request();
    const input = (await request.postDataJSON()) as Record<string, unknown>;
    if (request.method() === 'POST') {
      creates.push(input);
      fields = { subject: String(input.subject ?? '') };
      return fulfill(route, draftDetail(draftId, fields, version));
    }
    if (request.method() === 'PUT') {
      saves.push(input);
      expect(input.version).toBe(version);
      version += 1;
      fields = {
        toEmail: input.toEmail ? String(input.toEmail) : undefined,
        subject: input.subject ? String(input.subject) : undefined,
        body: input.body ? String(input.body) : undefined,
      };
      return fulfill(route, draftDetail(draftId, fields, version));
    }
    return route.fallback();
  });

  await page.goto('/mail/inbox');
  await page.getByRole('button', { name: 'New message' }).click();
  const dialog = page.getByRole('dialog', { name: 'New message' });
  await dialog.getByLabel('Subject').fill('Subject-only planning note');
  await expect(dialog.getByRole('button', { name: 'Send' })).toBeDisabled();
  await expect.poll(() => creates.length).toBe(1);
  expect(creates[0]).toMatchObject({ subject: 'Subject-only planning note' });
  expect(creates[0]).not.toHaveProperty('toEmail');
  await expect(dialog.getByRole('status')).toContainText('All changes saved');

  await dialog.getByLabel('Recipient email').fill('alex.park@example.com');
  await dialog.getByLabel('Message').fill('Please review the launch plan.');
  await expect.poll(() => saves.length).toBeGreaterThan(0);
  await expect(dialog.getByRole('status')).toContainText('All changes saved');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0]).toMatchObject({
    toEmail: 'alex.park@example.com',
    subject: 'Subject-only planning note',
    body: 'Please review the launch plan.',
    deliveryMode: 'SEND',
    version,
  });
  expect(creates).toHaveLength(1);
});

test('closing during an active draft save waits for completion instead of discarding', async ({
  page,
}) => {
  await mockMailMember(page);
  const draftId = '40000000-0000-0000-0000-000000000022';
  let requestStarted = false;
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    return request.method() === 'GET' && path.endsWith('/v1/mail/threads')
      ? fulfill(route, { items: [], total: 0, page: 0, pageSize: 30 })
      : route.fallback();
  });
  await page.route('**/api/platform/v1/mail/drafts', async (route) => {
    requestStarted = true;
    const input = (await route.request().postDataJSON()) as { subject?: string };
    await saveGate;
    return fulfill(route, draftDetail(draftId, input, 1));
  });

  await page.goto('/mail/inbox');
  await page.getByRole('button', { name: 'New message' }).click();
  const dialog = page.getByRole('dialog', { name: 'New message' });
  await dialog.getByLabel('Subject').fill('Wait for this save');
  await expect.poll(() => requestStarted).toBe(true);
  await expect(dialog.getByRole('status')).toContainText('Saving draft');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(dialog.getByText('Finishing the draft save before closing.')).toBeVisible();
  releaseSave();
  await expect(dialog).not.toBeVisible();
  await expect(page).not.toHaveURL(/compose=open/u);
});

test('existing drafts hydrate without writes and preserve local text on a version conflict', async ({
  page,
}) => {
  await mockMailMember(page);
  const draftId = '40000000-0000-0000-0000-000000000021';
  const initialFields = {
    toEmail: 'alex.park@example.com',
    subject: 'Hydrated draft',
    body: 'Original draft body',
  };
  const current = draftDetail(draftId, initialFields, 7);
  let creates = 0;
  let saves = 0;
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [current.thread], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${draftId}`)) {
      return fulfill(route, current);
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/mail/drafts**', async (route) => {
    if (route.request().method() === 'POST') {
      creates += 1;
      return fulfill(route, current);
    }
    saves += 1;
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, status: 'ERROR', message: 'Draft version conflict' }),
    });
  });

  await page.goto(`/mail/drafts?thread=${draftId}`);
  await expect(page.getByRole('heading', { name: 'Continue writing' })).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(creates).toBe(0);
  expect(saves).toBe(0);

  const body = page.getByRole('textbox', { name: 'Message' });
  await body.fill('Local text that must survive the conflict');
  await expect(page.getByText(/draft changed elsewhere/i)).toBeVisible();
  expect(saves).toBe(1);
  await expect(body).toHaveValue('Local text that must survive the conflict');
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Keep editing' }).click();
  await expect(body).toHaveValue('Local text that must survive the conflict');
});

test('mail URL lanes, keyboard commands, and custom snooze keep one truthful workflow', async ({
  page,
}) => {
  await mockMailMember(page);
  const organization = mailOrganization();
  let current = thread('40000000-0000-0000-0000-000000000010', {
    subject: 'Keyboard and snooze review',
  });
  const listRequests: Array<{ lane: string | null; state: string | null }> = [];
  const lifecycleActions: string[] = [];
  let snoozePayload: { until: string; version: number } | null = null;
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      listRequests.push({
        lane: url.searchParams.get('lane'),
        state: url.searchParams.get('state'),
      });
      return fulfill(route, { items: [current], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${current.threadId}`)) {
      return fulfill(route, detail(current, 'SENT'));
    }
    if (request.method() === 'POST' && path.endsWith('/snooze')) {
      snoozePayload = (await request.postDataJSON()) as { until: string; version: number };
      current = {
        ...current,
        workflowState: 'SNOOZED',
        snoozedUntil: snoozePayload.until,
        version: current.version + 1,
      };
      return fulfill(route, detail(current, 'SENT'));
    }
    if (request.method() === 'POST' && path.endsWith('/lifecycle')) {
      const input = await request.postDataJSON();
      lifecycleActions.push(input.action);
      return fulfill(route, { thread: current, deleted: false });
    }
    return route.fallback();
  });

  await page.goto('/mail/inbox?lane=PRIORITY');
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) {
    await page.getByRole('button', { name: /Keyboard and snooze review/ }).click();
  }
  const snooze = page.getByRole('button', { name: 'Remind me later' });
  await expect(snooze).toBeVisible();
  await snooze.focus();
  await page.keyboard.press('e');
  expect(lifecycleActions).toEqual([]);

  await page.keyboard.press('Control+K');
  const commandInput = page.getByRole('combobox', { name: 'Search mail commands' });
  await expect(commandInput).toHaveAttribute('aria-expanded', 'true');
  await expect(commandInput).toHaveAttribute('aria-controls');
  await commandInput.fill('show');
  const firstActive = await commandInput.getAttribute('aria-activedescendant');
  expect(firstActive).toBeTruthy();
  await commandInput.press('ArrowDown');
  await expect.poll(() => commandInput.getAttribute('aria-activedescendant')).not.toBe(firstActive);
  const secondActive = await commandInput.getAttribute('aria-activedescendant');
  await commandInput.press('ArrowUp');
  await expect.poll(() => commandInput.getAttribute('aria-activedescendant')).toBe(firstActive);
  await commandInput.press('ArrowDown');
  await expect.poll(() => commandInput.getAttribute('aria-activedescendant')).toBe(secondActive);
  await commandInput.press('Enter');
  await expect(page).toHaveURL(/lane=NEEDS_REPLY/u);
  await expect
    .poll(() => listRequests.some((request) => request.lane === 'NEEDS_REPLY'))
    .toBe(true);

  if (mobile) {
    await page.getByRole('button', { name: /Keyboard and snooze review/ }).click();
  }
  await page.getByRole('button', { name: 'Remind me later' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose when to return' });
  const custom = dialog.getByRole('group', { name: 'Choose a date and time' });
  await custom.getByRole('spinbutton', { name: 'Month' }).fill('08');
  await custom.getByRole('spinbutton', { name: 'Day' }).fill('01');
  await custom.getByRole('spinbutton', { name: 'Year' }).fill('2027');
  await custom.getByRole('spinbutton', { name: 'Hours' }).fill('10');
  await custom.getByRole('spinbutton', { name: 'Minutes' }).fill('30');
  await custom.getByRole('spinbutton', { name: 'Meridiem' }).fill('AM');
  await custom.getByRole('spinbutton', { name: 'Meridiem' }).press('Tab');
  await dialog.getByRole('button', { name: 'Snooze until then' }).click();
  await expect.poll(() => snoozePayload).not.toBeNull();
  expect(snoozePayload?.version).toBe(3);
  expect(new Date(snoozePayload!.until).getUTCFullYear()).toBe(2027);

  await page.goto('/mail/inbox?state=SNOOZED');
  await expect(page.getByRole('heading', { name: 'Later' })).toBeVisible();
  await expect.poll(() => listRequests.some((request) => request.state === 'SNOOZED')).toBe(true);
});

test('personal folders and sender rules can be created and run from one workspace', async ({
  page,
}) => {
  await mockMailMember(page);
  const state = mailOrganization();
  let createdFolderName = '';
  let createdRuleName = '';
  await page.route('**/api/platform/v1/mail/organization**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/organization')) {
      return fulfill(route, state);
    }
    if (request.method() === 'GET' && path.endsWith('/rules/backfill-preview')) {
      return fulfill(route, {
        accountId: state.accounts[0]!.accountId,
        previewFingerprint: 'a'.repeat(64),
        enabledRuleCount: state.rules.filter((rule) => rule.enabled).length,
        scannedCount: 6,
        matchedThreadCount: 0,
        plannedApplicationCount: 0,
        truncated: false,
        generatedAt: '2026-08-27T08:00:00Z',
      });
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
  await expect(page.getByRole('button', { name: 'Run now' })).toHaveCount(0);
  await expect(
    page.locator('main').locator('span:visible', { hasText: /^Not run yet$/u })
  ).toBeVisible();

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

test('existing mail rule backfill previews impact and retries one idempotent request', async ({
  page,
}) => {
  await mockMailMember(page);
  const state = mailOrganization();
  state.rules.push({
    ruleId: '12000000-0000-0000-0000-000000000001',
    accountId: state.accounts[0]!.accountId,
    displayName: 'Partner launch mail',
    priority: 100,
    matchMode: 'ALL',
    conditions: [{ field: 'SENDER', operator: 'ENDS_WITH', value: '@partner.example' }],
    actions: [{ type: 'MARK_READ' }],
    stopProcessing: true,
    enabled: true,
    synchronizationState: 'LOCAL_ONLY',
    lastRunAt: null,
    lastMatchCount: 0,
    version: 0,
  });
  const fingerprint = 'b'.repeat(64);
  const commands: Array<{ requestId: string; previewFingerprint: string }> = [];
  await page.route('**/api/platform/v1/mail/organization**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/organization')) {
      return fulfill(route, state);
    }
    if (request.method() === 'GET' && path.endsWith('/rules/backfill-preview')) {
      return fulfill(route, {
        accountId: state.accounts[0]!.accountId,
        previewFingerprint: fingerprint,
        enabledRuleCount: 1,
        scannedCount: 6,
        matchedThreadCount: 2,
        plannedApplicationCount: 2,
        truncated: false,
        generatedAt: '2026-08-28T01:00:00Z',
      });
    }
    if (request.method() === 'POST' && path.endsWith('/rules/backfill')) {
      const command = (await request.postDataJSON()) as {
        requestId: string;
        previewFingerprint: string;
      };
      commands.push(command);
      if (commands.length === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            errorCode: 'MAIL_RULE_BACKFILL_FAILED',
            message: 'Result unavailable',
          }),
        });
      }
      return fulfill(route, {
        executionId: '13000000-0000-0000-0000-000000000001',
        requestId: command.requestId,
        accountId: state.accounts[0]!.accountId,
        status: 'SUCCEEDED',
        replayed: true,
        scannedCount: 6,
        matchedThreadCount: 2,
        applicationCount: 2,
        changedCount: 2,
        startedAt: '2026-08-28T01:00:00Z',
        completedAt: '2026-08-28T01:00:01Z',
      });
    }
    return route.fallback();
  });

  await page.goto('/mail/organization');
  await page.getByRole('tab', { name: 'Organization rules' }).click();
  await expect(page.getByRole('heading', { name: 'Apply rules to existing mail' })).toBeVisible();
  await expect(page.getByText('Planned changes')).toBeVisible();
  await page.getByRole('button', { name: 'Apply to existing mail' }).click();
  await page.getByRole('button', { name: 'Confirm and apply' }).click();
  await expect(page.getByText(/command result is unknown/i)).toBeVisible();
  await expect.poll(() => commands.length).toBe(1);
  await page.getByRole('button', { name: 'Retry same request' }).click();
  await expect(page.getByText(/previous request already completed/i)).toBeVisible();

  expect(commands).toHaveLength(2);
  expect(commands[0]?.requestId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(commands[1]).toEqual(commands[0]);
  expect(commands[0]?.previewFingerprint).toBe(fingerprint);

  await page.setViewportSize({ width: 390, height: 844 });
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

test('stale mail backfill preview requires an explicit refresh and a new command', async ({
  page,
}) => {
  await mockMailMember(page);
  const state = mailOrganization();
  state.rules.push({
    ruleId: '12000000-0000-0000-0000-000000000002',
    accountId: state.accounts[0]!.accountId,
    displayName: 'Launch review mail',
    priority: 100,
    matchMode: 'ALL',
    conditions: [{ field: 'SUBJECT', operator: 'CONTAINS', value: 'launch' }],
    actions: [{ type: 'STAR' }],
    stopProcessing: false,
    enabled: true,
    synchronizationState: 'LOCAL_ONLY',
    lastRunAt: null,
    lastMatchCount: 0,
    version: 0,
  });
  let previewRequests = 0;
  const commands: Array<{ requestId: string; previewFingerprint: string }> = [];
  await page.route('**/api/platform/v1/mail/organization**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/organization')) {
      return fulfill(route, state);
    }
    if (request.method() === 'GET' && path.endsWith('/rules/backfill-preview')) {
      previewRequests++;
      return fulfill(route, {
        accountId: state.accounts[0]!.accountId,
        previewFingerprint: (previewRequests === 1 ? 'c' : 'd').repeat(64),
        enabledRuleCount: 1,
        scannedCount: 6,
        matchedThreadCount: 1,
        plannedApplicationCount: 1,
        truncated: false,
        generatedAt: '2026-08-28T01:10:00Z',
      });
    }
    if (request.method() === 'POST' && path.endsWith('/rules/backfill')) {
      const command = (await request.postDataJSON()) as {
        requestId: string;
        previewFingerprint: string;
      };
      commands.push(command);
      if (commands.length === 1) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            errorCode: 'RESOURCE_CONFLICT',
            message: 'Preview changed',
          }),
        });
      }
      return fulfill(route, {
        executionId: '13000000-0000-0000-0000-000000000002',
        requestId: command.requestId,
        accountId: state.accounts[0]!.accountId,
        status: 'SUCCEEDED',
        replayed: false,
        scannedCount: 6,
        matchedThreadCount: 1,
        applicationCount: 1,
        changedCount: 1,
        startedAt: '2026-08-28T01:10:00Z',
        completedAt: '2026-08-28T01:10:01Z',
      });
    }
    return route.fallback();
  });

  await page.goto('/mail/organization');
  await page.getByRole('tab', { name: 'Organization rules' }).click();
  const apply = page.getByRole('button', { name: 'Apply to existing mail' });
  await apply.click();
  await page.getByRole('button', { name: 'Confirm and apply' }).click();
  await expect(page.getByText(/preview is no longer current/i)).toBeVisible();
  await expect(apply).toBeDisabled();
  await page.waitForTimeout(250);
  expect(commands).toHaveLength(1);

  await page.getByRole('button', { name: 'Refresh preview' }).first().click();
  await expect.poll(() => previewRequests).toBeGreaterThanOrEqual(2);
  await expect(apply).toBeEnabled();
  await apply.click();
  await page.getByRole('button', { name: 'Confirm and apply' }).click();
  await expect(page.getByText(/rules changed 1 existing conversation/i)).toBeVisible();

  expect(commands).toHaveLength(2);
  expect(commands[0]?.previewFingerprint).toBe('c'.repeat(64));
  expect(commands[1]?.previewFingerprint).toBe('d'.repeat(64));
  expect(commands[1]?.requestId).not.toBe(commands[0]?.requestId);
});

test('truncated rule preview blocks backfill until the bounded scope is resolved', async ({
  page,
}) => {
  await mockMailMember(page);
  const state = mailOrganization();
  state.rules.push({
    ruleId: '12000000-0000-0000-0000-000000000003',
    accountId: state.accounts[0]!.accountId,
    displayName: 'Large historical rule',
    priority: 100,
    matchMode: 'ALL',
    conditions: [{ field: 'SENDER', operator: 'CONTAINS', value: '@example.com' }],
    actions: [{ type: 'MARK_READ' }],
    stopProcessing: false,
    enabled: true,
    synchronizationState: 'LOCAL_ONLY',
    lastRunAt: null,
    lastMatchCount: 0,
    version: 0,
  });
  let commands = 0;
  await page.route('**/api/platform/v1/mail/organization**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/organization')) {
      return fulfill(route, state);
    }
    if (request.method() === 'GET' && path.endsWith('/rules/backfill-preview')) {
      return fulfill(route, {
        accountId: state.accounts[0]!.accountId,
        previewFingerprint: 'e'.repeat(64),
        enabledRuleCount: 1,
        scannedCount: 500,
        matchedThreadCount: 500,
        plannedApplicationCount: 500,
        truncated: true,
        generatedAt: '2026-08-29T03:10:00Z',
      });
    }
    if (request.method() === 'POST' && path.endsWith('/rules/backfill')) {
      commands++;
    }
    return route.fallback();
  });

  await page.goto('/mail/organization');
  await page.getByRole('tab', { name: 'Organization rules' }).click();
  await expect(page.getByText(/execution is blocked/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to existing mail' })).toBeDisabled();
  expect(commands).toBe(0);
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
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  if (mobile) {
    await page.getByRole('button', { name: /Second page request/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Second page request' })).toBeVisible();

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
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE']);

  await page.getByRole('button', { name: 'Move to folder' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE', 'TRASH']);

  await page.goto('/mail/trash');
  if (mobile) {
    await page.getByRole('button', { name: /Reversible lifecycle review/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Reversible lifecycle review' })).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Permanent deletion is unavailable until retention and legal-hold policy is ready',
    })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Restore to previous location' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE', 'TRASH', 'RESTORE']);
});

test('mail workspace reflows at 320px and 200% text zoom without critical accessibility defects', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The dedicated 320px audit runs once in Chromium.');
  await mockMailMember(page);
  const organization = mailOrganization();
  const item = thread('40000000-0000-0000-0000-000000000011', {
    subject: 'Narrow viewport review',
  });
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/home', (route) =>
    fulfill(route, {
      accounts: organization.accounts,
      metrics: {
        unread: 6,
        urgent: 1,
        needsReply: 2,
        assigned: 1,
        snoozed: 1,
        activeProposals: 0,
      },
      focusQueue: [item],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-09-03T03:00:00Z',
    })
  );
  await page.route('**/api/platform/v1/mail/address-book**', (route) =>
    fulfill(
      route,
      mailAddressBook(
        [
          {
            contactId: '61000000-0000-0000-0000-000000000003',
            displayName: 'Long Contact Name For Reflow',
            emailAddress: 'long.contact@example.com',
            sourceKind: 'MANUAL',
            favorite: true,
            version: 0,
            updatedAt: '2026-09-03T03:00:00Z',
          },
        ],
        [
          {
            groupId: '62000000-0000-0000-0000-000000000003',
            displayName: 'Enterprise launch steering group',
            description: 'A long description that must reflow without hiding group actions.',
            members: [],
            version: 0,
            updatedAt: '2026-09-03T03:00:00Z',
          },
        ]
      )
    )
  );
  await page.route('**/api/platform/v1/mail/threads**', (route) => {
    const url = new URL(route.request().url());
    return url.pathname.endsWith('/v1/mail/threads')
      ? fulfill(route, { items: [item], total: 1, page: 0, pageSize: 30 })
      : fulfill(route, detail(item, 'SENT'));
  });

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/mail/organization');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'New folder' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/mail/inbox');
  await page.getByRole('button', { name: /Narrow viewport review/ }).click();
  await expect(page.getByRole('heading', { name: 'Narrow viewport review' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    accessibility.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    )
  ).toEqual([]);

  await page.goto('/mail/contacts');
  await expect(page.getByRole('heading', { name: 'Contacts and mail groups' })).toBeVisible();
  await page.getByRole('tab', { name: 'My mail groups' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);

  await page.goto('/mail/home');
  await expect(page.getByRole('heading', { name: 'Focus queue' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
});
