import { expect, test } from '@playwright/test';

import { draftDetail, fulfill, MEMBER_PERMISSIONS } from './support/mail-fixtures';
import { mockShellSession } from './support/shell-session';

type SessionUser = {
  userId: number;
  personPublicId: string;
  displayName: string;
  jobTitle: string;
  email: string;
  tenantId: number;
  tenantCode: string;
  tenantName: string;
  identityPlane: 'TENANT';
  preferredLocale: 'en';
  tenantDefaultLocale: 'en';
  roles: string[];
  groups: never[];
  resourceRoles: never[];
};

function sessionUser(userId: number, displayName: string, email: string): SessionUser {
  return {
    userId,
    personPublicId: `person-${userId}`,
    displayName,
    jobTitle: 'Workspace member',
    email,
    tenantId: 1,
    tenantCode: 'default',
    tenantName: 'SKAX',
    identityPlane: 'TENANT',
    preferredLocale: 'en',
    tenantDefaultLocale: 'en',
    roles: ['WORKSPACE_MEMBER'],
    groups: [],
    resourceRoles: [],
  };
}

test('an in-place identity transition isolates an open composer from a late send result', async ({
  page,
}) => {
  const userA = sessionUser(101, 'Member A', 'member.a@example.com');
  const userB = sessionUser(202, 'Member B', 'member.b@example.com');
  let currentUser = userA;
  let meRequests = 0;

  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    userId: userA.userId,
    personPublicId: userA.personPublicId,
    displayName: userA.displayName,
    email: userA.email,
    permissions: MEMBER_PERMISSIONS,
  });
  await page.route('**/api/auth/me', (route) => {
    meRequests += 1;
    return fulfill(route, currentUser);
  });

  const threadId = '40000000-0000-0000-0000-000000000101';
  const fields = {
    toEmail: 'recipient@example.com',
    subject: 'Identity-bound message',
    body: 'This content belongs to member A.',
  };
  const savedDraft = draftDetail(threadId, fields, 1);
  let sendRequests = 0;
  let releaseSend!: () => void;
  const sendGate = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });

  await page.route('**/api/platform/v1/mail/threads**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/v1/mail/threads')) {
      return fulfill(route, { items: [], total: 0, page: 0, pageSize: 30 });
    }
    if (request.method() === 'PUT' && path.endsWith(`/${threadId}/draft`)) {
      sendRequests += 1;
      await sendGate;
      return fulfill(route, {
        ...savedDraft,
        thread: { ...savedDraft.thread, folderType: 'SENT', workflowState: 'OPEN', version: 2 },
      });
    }
    return route.fallback();
  });
  await page.route('**/api/platform/v1/mail/drafts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return fulfill(route, savedDraft);
  });

  await page.goto('/mail/inbox?compose=open');
  await page.getByLabel('Recipient email').fill(fields.toEmail);
  await page.getByLabel('Subject').fill(fields.subject);
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill(fields.body);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => sendRequests).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).some(
          (key) => key?.includes('dwp.mail.unresolved-send.v1:') && key.includes('101')
        )
      )
    )
    .toBe(true);

  currentUser = userB;
  const requestsBeforeTransition = meRequests;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => meRequests).toBeGreaterThan(requestsBeforeTransition);

  await expect(page.getByLabel('Recipient email')).toHaveValue('');
  await expect(page.getByLabel('Subject')).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
  await expect(page.getByLabel('Recipient email')).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).some(
          (key) => key?.includes('dwp.mail.unresolved-send.v1:') && key.includes('202')
        )
      )
    )
    .toBe(false);

  releaseSend();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)).some(
          (key) => key?.includes('dwp.mail.unresolved-send.v1:') && key.includes('101')
        )
      )
    )
    .toBe(false);
  await expect(page.getByLabel('Recipient email')).toHaveValue('');
  await expect(page.getByLabel('Subject')).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
  await expect(page.getByText('The message was added to the governed delivery queue.')).toHaveCount(
    0
  );
});
