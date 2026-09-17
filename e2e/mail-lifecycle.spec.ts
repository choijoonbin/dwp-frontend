import { expect, test } from '@playwright/test';

import { detail, fulfill, mailOrganization, mockMailMember, thread } from './support/mail-fixtures';

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
    if (request.method() === 'POST' && path.endsWith('/lifecycle/preview')) {
      const input = await request.postDataJSON();
      const permanentDelete = input.action === 'DELETE_FOREVER';
      return fulfill(route, {
        threadId: current.threadId,
        action: input.action,
        allowed: !permanentDelete,
        blockers: permanentDelete ? ['RETENTION_PERIOD_ACTIVE'] : [],
        targetFolderId: input.targetFolderId ?? null,
        targetFolderName:
          input.action === 'TRASH' ? 'Trash' : input.action === 'RESTORE' ? 'Inbox' : null,
        affectedCount: 1,
        version: current.version,
      });
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
  await page.getByRole('button', { name: 'Confirm move' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE']);

  await page.getByRole('button', { name: 'Move to folder' }).click();
  await page.getByRole('menuitem', { name: 'Move to trash' }).click();
  await page.getByRole('button', { name: 'Confirm move' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE', 'TRASH']);

  await page.goto('/mail/trash');
  if (mobile) {
    await page.getByRole('button', { name: /Reversible lifecycle review/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Reversible lifecycle review' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(
    page.getByRole('heading', { name: 'This conversation cannot be deleted permanently' })
  ).toBeVisible();
  await expect(page.getByText('The retention period has not ended.')).toBeVisible();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE', 'TRASH']);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Restore to previous location' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Move this conversation?' })
      .getByText('Inbox', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm move' }).click();
  await expect.poll(() => lifecycleActions).toEqual(['TRASH', 'RESTORE', 'TRASH', 'RESTORE']);
});

test('permanent deletion requires a fresh policy preview and explicit danger confirmation', async ({
  page,
}) => {
  await mockMailMember(page);
  const organization = mailOrganization();
  const current = {
    ...thread('40000000-0000-0000-0000-000000000019', {
      subject: 'Expired retention deletion',
    }),
    folderType: 'TRASH' as const,
    workflowState: 'TRASHED' as const,
    version: 4,
  };
  const lifecycleActions: string[] = [];
  const previewActions: string[] = [];
  await page.route('**/api/platform/v1/mail/organization', (route) => fulfill(route, organization));
  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [current], total: 1, page: 0, pageSize: 30 });
    }
    if (request.method() === 'GET' && path.endsWith(`/${current.threadId}`)) {
      return fulfill(route, detail(current, 'SENT'));
    }
    if (request.method() === 'POST' && path.endsWith('/lifecycle/preview')) {
      const input = await request.postDataJSON();
      previewActions.push(input.action);
      return fulfill(route, {
        threadId: current.threadId,
        action: input.action,
        allowed: true,
        blockers: [],
        targetFolderId: null,
        targetFolderName: null,
        affectedCount: 1,
        version: current.version,
      });
    }
    if (request.method() === 'POST' && path.endsWith('/lifecycle')) {
      const input = await request.postDataJSON();
      lifecycleActions.push(input.action);
      return fulfill(route, { thread: null, deleted: true });
    }
    return route.fallback();
  });

  await page.goto('/mail/trash');
  const mobile = (page.viewportSize()?.width ?? 1280) < 1200;
  if (mobile) {
    await page.getByRole('button', { name: /Expired retention deletion/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Expired retention deletion' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect.poll(() => previewActions).toEqual(['DELETE_FOREVER']);
  await expect(
    page.getByRole('heading', { name: 'Permanently delete this conversation?' })
  ).toBeVisible();
  expect(lifecycleActions).toEqual([]);
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).last().click();
  await expect.poll(() => lifecycleActions).toEqual(['DELETE_FOREVER']);
});
