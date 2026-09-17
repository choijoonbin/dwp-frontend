import { expect, test } from '@playwright/test';

import {
  detail,
  draftDetail,
  fulfill,
  mailOrganization,
  mockMailMember,
  thread,
} from './support/mail-fixtures';

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

test('shared inbox actions fail closed when action permissions are not projected', async ({
  page,
}) => {
  await mockMailMember(page);
  const shared = thread('40000000-0000-0000-0000-000000000013', {
    shared: true,
    subject: 'Shared permission boundary',
  });
  await page.route('**/api/platform/v1/mail/threads?*', (route) =>
    fulfill(route, { items: [shared], total: 1, page: 0, pageSize: 30 })
  );
  await page.route('**/api/platform/v1/mail/threads/*', (route) =>
    fulfill(route, detail(shared, 'SENT', { projectSharedInboxActions: false }))
  );

  await page.goto(`/mail/shared?thread=${shared.threadId}`);

  await expect(
    page.getByText(
      'Some shared inbox actions are unavailable because permission for this conversation was not provided.'
    )
  ).toBeVisible();
  await expect(page.getByLabel('Assignee')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Add a team comment')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Write a response')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send reply' })).toBeDisabled();
});

test('reply retries preserve the original command identity after a response failure', async ({
  page,
}) => {
  await mockMailMember(page);
  const item = thread('40000000-0000-0000-0000-000000000014', {
    subject: 'Stable reply command',
  });
  const other = thread('40000000-0000-0000-0000-000000000015', {
    subject: 'Separate reply command',
  });
  const replies: Array<Record<string, unknown>> = [];
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [item, other], total: 2, page: 0, pageSize: 30 });
    }
    if (request.method() === 'POST' && path.endsWith(`/${item.threadId}/replies`)) {
      replies.push((await request.postDataJSON()) as Record<string, unknown>);
      if (replies.length === 1) return route.abort('failed');
      return fulfill(route, detail(item, 'SENT'));
    }
    if (request.method() === 'GET' && path.endsWith(`/${item.threadId}`)) {
      return fulfill(route, detail(item, 'SENT'));
    }
    if (request.method() === 'GET' && path.endsWith(`/${other.threadId}`)) {
      return fulfill(route, detail(other, 'SENT'));
    }
    return route.fallback();
  });

  await page.goto(`/mail/inbox?thread=${item.threadId}`);
  await page.getByLabel('Write a response').fill('Approved response');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect.poll(() => replies.length).toBe(1);
  await expect(
    page.getByText(/reply text is locked because the previous result is unknown/i)
  ).toBeVisible();
  await expect(page.getByLabel('Write a response')).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Write a response')).toHaveValue('Approved response');
  await expect(page.getByLabel('Write a response')).toBeDisabled();
  if ((page.viewportSize()?.width ?? 1280) < 1200) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.getByRole('button', { name: /Separate reply command/ }).click();
  await expect(page.getByRole('heading', { name: 'Separate reply command' })).toBeVisible();
  await expect(page.getByLabel('Write a response')).toBeEnabled();
  await expect(page.getByLabel('Write a response')).toHaveValue('');
  if ((page.viewportSize()?.width ?? 1280) < 1200) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.getByRole('button', { name: /Stable reply command/ }).click();
  await expect(page.getByLabel('Write a response')).toHaveValue('Approved response');
  await expect(page.getByLabel('Write a response')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send reply' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect.poll(() => replies.length).toBe(2);

  expect(replies[0]).toEqual({ body: 'Approved response', idempotencyKey: expect.any(String) });
  expect(replies[1]).toEqual(replies[0]);
});

test('a confirmed reply rejection requires a reviewed command instead of replaying it', async ({
  page,
}) => {
  await mockMailMember(page);
  const item = thread('40000000-0000-0000-0000-000000000016', {
    subject: 'Rejected reply command',
  });
  const other = thread('40000000-0000-0000-0000-000000000018', {
    subject: 'Review another conversation',
  });
  const replies: Array<Record<string, unknown>> = [];
  let releaseRejection!: () => void;
  const rejectionGate = new Promise<void>((resolve) => {
    releaseRejection = resolve;
  });
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [item, other], total: 2, page: 0, pageSize: 30 });
    }
    if (request.method() === 'POST' && path.endsWith(`/${item.threadId}/replies`)) {
      replies.push((await request.postDataJSON()) as Record<string, unknown>);
      if (replies.length === 1) {
        await rejectionGate;
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Conversation changed.' }),
        });
      }
      return fulfill(route, detail(item, 'SENT'));
    }
    if (request.method() === 'GET' && path.endsWith(`/${item.threadId}`)) {
      return fulfill(route, detail(item, 'SENT'));
    }
    if (request.method() === 'GET' && path.endsWith(`/${other.threadId}`)) {
      return fulfill(route, detail(other, 'SENT'));
    }
    return route.fallback();
  });

  await page.goto(`/mail/inbox?thread=${item.threadId}`);
  await page.getByLabel('Write a response').fill('Original reply');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect.poll(() => replies.length).toBe(1);
  if ((page.viewportSize()?.width ?? 1280) < 1200) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.getByRole('button', { name: /Review another conversation/ }).click();
  await expect(page.getByRole('heading', { name: 'Review another conversation' })).toBeVisible();

  const rejectionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith(`/${item.threadId}/replies`) &&
      response.status() === 409
  );
  releaseRejection();
  await rejectionResponse;
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).some(
          (key) => key?.startsWith('dwp.mail.rejected-reply.v1:')
        )
      )
    )
    .toBe(true);

  if ((page.viewportSize()?.width ?? 1280) < 1200) {
    await page.getByRole('button', { name: 'Back' }).click();
  }
  await page.getByRole('button', { name: /Rejected reply command/ }).click();
  await expect(page.getByText(/rejected command will not be replayed/i)).toBeVisible();
  await expect(page.getByLabel('Write a response')).toHaveValue('Original reply');
  await expect(page.getByRole('button', { name: 'Send reply' })).toBeDisabled();
  await page.getByLabel('Write a response').fill('Reviewed reply');
  await expect(page.getByRole('button', { name: 'Send reply' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect.poll(() => replies.length).toBe(2);

  expect(replies[0]?.idempotencyKey).not.toBe(replies[1]?.idempotencyKey);
  expect(replies[1]).toMatchObject({ body: 'Reviewed reply', idempotencyKey: expect.any(String) });
});

test('a draft send conflict preserves input and requires a three-way review', async ({ page }) => {
  await mockMailMember(page);
  const threadId = '40000000-0000-0000-0000-000000000017';
  const local = draftDetail(
    threadId,
    {
      toEmail: 'alex.park@example.com',
      subject: 'Local draft subject',
      body: 'Base draft body',
    },
    3
  );
  const latest = draftDetail(
    threadId,
    {
      toEmail: 'server.owner@example.com',
      subject: 'Server draft subject',
      body: 'Server draft body',
    },
    4
  );
  let conflictReturned = false;
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [local.thread], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${threadId}`)) {
      return fulfill(route, conflictReturned ? latest : local);
    }
    if (request.method() === 'PUT' && path.endsWith(`/${threadId}/draft`)) {
      conflictReturned = true;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'The draft changed.' }),
      });
    }
    return route.fallback();
  });

  await page.goto(`/mail/drafts?thread=${threadId}`);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Local draft body');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const conflict = page.getByRole('alert').filter({ hasText: 'This draft changed on the server' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('Base draft body', { exact: true })).toBeVisible();
  await expect(conflict.getByText('Local draft body', { exact: true }).first()).toBeVisible();
  await expect(conflict.getByText('Server draft body', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Local draft body'
  );
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeDisabled();

  await page.reload();
  const restoredConflict = page
    .getByRole('alert')
    .filter({ hasText: 'This draft changed on the server' });
  await expect(restoredConflict).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Local draft body'
  );
  await restoredConflict.getByRole('button', { name: 'Keep my version for review' }).click();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();

  await page.reload();
  const pendingReview = page
    .getByRole('alert')
    .filter({ hasText: 'This draft changed on the server' });
  await expect(pendingReview).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Local draft body'
  );
  await pendingReview.getByRole('button', { name: 'Use latest server draft' }).click();
  await expect(page.getByLabel('Recipient email')).toHaveValue('server.owner@example.com');
  await expect(page.getByLabel('Subject')).toHaveValue('Server draft subject');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Server draft body'
  );
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
});

test('a draft retry after reload preserves the true base for conflict review', async ({ page }) => {
  await mockMailMember(page);
  const threadId = '40000000-0000-0000-0000-000000000020';
  const base = draftDetail(
    threadId,
    {
      toEmail: 'alex.park@example.com',
      subject: 'Reloaded draft conflict',
      body: 'Original server base',
    },
    3
  );
  const latest = draftDetail(
    threadId,
    {
      toEmail: 'server.owner@example.com',
      subject: 'Server changed the draft',
      body: 'Latest server body',
    },
    4
  );
  const updates: Array<Record<string, unknown>> = [];
  let conflictReturned = false;
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [base.thread], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${threadId}`)) {
      return fulfill(route, conflictReturned ? latest : base);
    }
    if (request.method() === 'PUT' && path.endsWith(`/${threadId}/draft`)) {
      updates.push((await request.postDataJSON()) as Record<string, unknown>);
      if (updates.length === 1) return route.abort('failed');
      conflictReturned = true;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'The draft changed after the first send attempt.' }),
      });
    }
    return route.fallback();
  });

  await page.goto(`/mail/drafts?thread=${threadId}`);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Local retry body');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => updates.length).toBe(1);
  await expect(page.getByText(/previous result is unknown/i)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Local retry body'
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const conflict = page.getByRole('alert').filter({ hasText: 'This draft changed on the server' });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByText('Original server base', { exact: true })).toBeVisible();
  await expect(conflict.getByText('Local retry body', { exact: true }).first()).toBeVisible();
  await expect(conflict.getByText('Latest server body', { exact: true })).toBeVisible();
  expect(updates).toHaveLength(2);
  expect(updates[1]).toEqual(updates[0]);
});

test('keeping a local draft that already matches the server clears conflict custody', async ({
  page,
}) => {
  await mockMailMember(page);
  const threadId = '40000000-0000-0000-0000-000000000019';
  const base = draftDetail(
    threadId,
    {
      toEmail: 'alex.park@example.com',
      subject: 'Conflict without a content delta',
      body: 'Earlier server body',
    },
    3
  );
  const latest = draftDetail(
    threadId,
    {
      toEmail: 'alex.park@example.com',
      subject: 'Conflict without a content delta',
      body: 'Matching local and server body',
    },
    4
  );
  let conflictReturned = false;
  let updates = 0;
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [base.thread], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${threadId}`)) {
      return fulfill(route, conflictReturned ? latest : base);
    }
    if (request.method() === 'PUT' && path.endsWith(`/${threadId}/draft`)) {
      updates += 1;
      conflictReturned = true;
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'The draft version changed without a content delta.' }),
      });
    }
    return route.fallback();
  });

  await page.goto(`/mail/drafts?thread=${threadId}`);
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Matching local and server body');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const conflict = page.getByRole('alert').filter({ hasText: 'This draft changed on the server' });
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Keep my version for review' }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).some(
          (key) => key?.startsWith('dwp.mail.draft-conflict.v1:')
        )
      )
    )
    .toBe(false);
  expect(updates).toBe(1);

  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'This draft changed on the server' })
  ).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Matching local and server body'
  );
});
