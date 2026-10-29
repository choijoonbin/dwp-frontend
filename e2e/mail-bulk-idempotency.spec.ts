import { expect, test } from '@playwright/test';

import { detail, fulfill, mailOrganization, mockMailMember, thread } from './support/mail-fixtures';

test('bulk triage exactly replays a lost response and retries only failed items', async ({
  page,
}) => {
  await mockMailMember(page);
  const first = thread('40000000-0000-4000-8000-000000000031', {
    subject: 'First bulk review',
  });
  const second = thread('40000000-0000-4000-8000-000000000032', {
    subject: 'Second bulk review',
  });
  const actions: Array<{ threadId: string; body: Record<string, unknown> }> = [];
  let secondAttempts = 0;
  let serverCommittedSecond = false;

  await page.route('**/api/platform/v1/mail/home**', (route) =>
    fulfill(route, {
      accounts: mailOrganization().accounts,
      metrics: {
        unread: 2,
        urgent: 0,
        needsReply: 0,
        assigned: 0,
        snoozed: 0,
        activeProposals: 0,
      },
      focusQueue: [first, second],
      proposals: [],
      sharedInboxes: [],
      generatedAt: '2026-10-28T10:00:00.000Z',
    })
  );
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const actionMatch = pathname.match(/\/mail\/threads\/([^/]+)\/actions$/u);
    if (request.method() === 'POST' && actionMatch) {
      const threadId = decodeURIComponent(actionMatch[1]!);
      actions.push({ threadId, body: request.postDataJSON() as Record<string, unknown> });
      if (threadId === second.threadId && secondAttempts++ === 0) {
        serverCommittedSecond = true;
        await route.abort('connectionfailed');
        return;
      }
      const item = threadId === first.threadId ? first : second;
      await fulfill(route, detail({ ...item, unread: false, version: 4 }, 'RECEIVED'));
      return;
    }
    if (pathname.endsWith('/mail/threads')) {
      await fulfill(route, {
        items: [first, serverCommittedSecond ? { ...second, unread: false, version: 4 } : second],
        total: 2,
        page: 0,
        pageSize: 30,
      });
      return;
    }
    const item = pathname.includes(first.threadId) ? first : second;
    await fulfill(route, detail(item, 'RECEIVED'));
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/mail/inbox');
  await page.getByRole('button', { name: 'Select messages' }).click();
  await page.getByRole('button', { name: /Select message, .*First bulk review/u }).click();
  await page.getByRole('button', { name: /Select message, .*Second bulk review/u }).click();
  const bulkToolbar = page.getByTestId('mail-inbox-bulk-toolbar');
  await bulkToolbar.getByRole('button', { name: 'Mark as read' }).click();

  await expect.poll(() => actions.length).toBe(2);
  await expect(page.getByText(/Updated 1 messages; 1 could not be updated/u)).toBeVisible();
  await bulkToolbar.getByRole('button', { name: 'Mark as read' }).click();
  await expect.poll(() => actions.length).toBe(3);

  expect(actions.map(({ threadId }) => threadId)).toEqual([
    first.threadId,
    second.threadId,
    second.threadId,
  ]);
  expect(actions[0]?.body.bulkIntentId).toBe(actions[1]?.body.bulkIntentId);
  expect(actions[0]?.body.itemIdempotencyKey).not.toBe(actions[1]?.body.itemIdempotencyKey);
  expect(actions[2]?.body).toEqual(actions[1]?.body);
  expect(actions[1]?.body).toMatchObject({ action: 'MARK_READ', version: 3 });
  expect(String(actions[1]?.body.bulkIntentId)).toMatch(/^[0-9a-f-]{36}$/u);
  expect(String(actions[1]?.body.itemIdempotencyKey)).toMatch(/^[0-9a-f-]{36}$/u);
  await expect(page.getByRole('button', { name: 'Done selecting' })).toHaveCount(0);
});
