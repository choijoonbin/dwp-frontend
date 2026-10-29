import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type { MessagingLaterItem } from '@dwp-frontend/shared-utils';

const CONVERSATION_ID = '71000000-0000-0000-0000-000000000091';
const ROOT_ID = '72000000-0000-0000-0000-000000000091';
const REPLY_ID = '72000000-0000-0000-0000-000000000092';
const MESSAGE_ID = '72000000-0000-0000-0000-000000000093';

function success(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

function fulfill(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: success(data) });
}

async function mockMessagingWorkSurfaces(page: Page) {
  await mockShellSession(page, [], {
    locale: 'en',
    permissions: ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
      resourceType: 'APP',
      resourceKey: 'APP.MESSAGING',
      permissionCode,
      effect: 'ALLOW' as const,
    })),
  });

  let laterItem: MessagingLaterItem = {
    messageId: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    conversationName: 'Operations',
    conversationType: 'CHANNEL',
    senderName: 'Mina Kim',
    preview: 'Confirm the incident owner',
    protectedContent: false,
    messageDeleted: false,
    savedAt: '2026-10-27T08:00:00Z',
    state: 'SAVED',
    reminderAt: null,
    snoozedUntil: null,
    completedAt: null,
    version: 0,
  };
  const laterUpdates: unknown[] = [];

  await page.route('**/api/messaging/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/privacy-preferences') {
      return fulfill(route, {
        readReceiptsEnabled: true,
        presenceSharingEnabled: true,
        version: 0,
      });
    }
    if (request.method() === 'PUT' && url.pathname === '/api/messaging/v1/presence/heartbeat') {
      return route.fulfill({ status: 204 });
    }
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/display-preferences') {
      return fulfill(route, {
        layoutMode: 'AUTO',
        density: 'COMFORTABLE',
        theme: 'DEFAULT',
        showAvatars: true,
        timestampMode: 'SMART',
        messagePreview: true,
        version: 1,
        policy: {
          allowedThemes: ['DEFAULT', 'MIST', 'SAGE', 'ROSE'],
          allowPersonalBackgrounds: false,
          allowThemeSharing: false,
          version: 1,
        },
      });
    }
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/activity') {
      return fulfill(route, {
        generatedAt: '2026-10-28T08:00:00Z',
        items: [
          {
            id: `MENTION:${MESSAGE_ID}`,
            kind: 'MENTION',
            conversationId: CONVERSATION_ID,
            conversationName: 'Operations',
            conversationType: 'CHANNEL',
            messageId: MESSAGE_ID,
            rootMessageId: null,
            actorName: 'Mina Kim',
            preview: null,
            protectedContent: true,
            occurredAt: '2026-10-28T07:59:00Z',
          },
          {
            id: `REACTION:${ROOT_ID}`,
            kind: 'REACTION',
            conversationId: CONVERSATION_ID,
            conversationName: 'Operations',
            conversationType: 'CHANNEL',
            messageId: ROOT_ID,
            rootMessageId: null,
            actorName: 'Jun Lee',
            preview: '👍',
            protectedContent: false,
            occurredAt: '2026-10-28T07:58:00Z',
          },
        ],
      });
    }
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/threads') {
      return fulfill(route, {
        generatedAt: '2026-10-28T08:00:00Z',
        items: [
          {
            rootMessageId: ROOT_ID,
            conversationId: CONVERSATION_ID,
            conversationName: 'Operations',
            conversationType: 'CHANNEL',
            rootSenderName: 'Mina Kim',
            rootPreview: 'Decide the response owner',
            rootDeleted: false,
            protectedContent: false,
            replyCount: 3,
            latestReplyMessageId: REPLY_ID,
            latestReplySenderName: 'Jun Lee',
            latestReplyAt: '2026-10-28T07:57:00Z',
          },
        ],
      });
    }
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/home/shared-assets') {
      return fulfill(route, {
        generatedAt: '2026-10-28T08:00:00Z',
        items: [
          {
            id: 'file:73000000-0000-0000-0000-000000000091',
            kind: 'FILE',
            conversationId: CONVERSATION_ID,
            conversationName: 'Operations',
            messageId: MESSAGE_ID,
            sharedAt: '2026-10-28T07:56:00Z',
            senderName: 'Mina Kim',
            title: 'Incident plan.pdf',
            protectedContent: false,
            attachmentId: '73000000-0000-0000-0000-000000000091',
            url: null,
            contentType: 'application/pdf',
            sizeBytes: 2048,
          },
          {
            id: `link-protected:${ROOT_ID}`,
            kind: 'LINK',
            conversationId: CONVERSATION_ID,
            conversationName: 'Operations',
            messageId: ROOT_ID,
            sharedAt: '2026-10-28T07:55:00Z',
            senderName: 'Security Team',
            title: null,
            protectedContent: true,
            attachmentId: null,
            url: null,
            contentType: null,
            sizeBytes: null,
          },
        ],
      });
    }
    if (request.method() === 'GET' && url.pathname === '/api/messaging/v1/later') {
      const filter = url.searchParams.get('state') ?? 'ALL';
      const visible = filter === 'ALL' || filter === laterItem.state;
      return fulfill(route, {
        items: visible ? [laterItem] : [],
        total: visible ? 1 : 0,
        page: 0,
        pageSize: 30,
        generatedAt: '2026-10-28T08:00:00Z',
      });
    }
    if (request.method() === 'PUT' && url.pathname === `/api/messaging/v1/later/${MESSAGE_ID}`) {
      const body = request.postDataJSON() as {
        state: MessagingLaterItem['state'];
        reminderAt: string | null;
        snoozedUntil: string | null;
        version: number;
      };
      laterUpdates.push(body);
      laterItem = {
        ...laterItem,
        state: body.state,
        reminderAt: body.reminderAt,
        snoozedUntil: body.snoozedUntil,
        completedAt: body.state === 'COMPLETED' ? '2026-10-28T08:01:00Z' : null,
        version: laterItem.version + 1,
      };
      return fulfill(route, laterItem);
    }
    return route.fallback();
  });

  return { laterUpdates };
}

test('activity, threads, files, and Later preserve governed context and accessible states', async ({
  page,
}) => {
  const state = await mockMessagingWorkSurfaces(page);

  await page.goto('/messages/activity');
  await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
  await expect(
    page.getByText('Protected conversation content is hidden in Activity.')
  ).toBeVisible();
  await expect(page.getByLabel('Open Mentions in Operations')).toHaveAttribute(
    'href',
    new RegExp(`conversation=${CONVERSATION_ID}.*message=${MESSAGE_ID}`, 'u')
  );
  await page.getByRole('button', { name: 'Reactions' }).click();
  await expect(page).toHaveURL(/kind=REACTION/u);
  await expect(page.getByText('Jun Lee reacted to your message')).toBeVisible();

  let accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto('/messages/threads');
  await expect(page.getByRole('heading', { name: 'Threads', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Open thread with 3 replies in Operations')).toHaveAttribute(
    'href',
    new RegExp(`conversation=${CONVERSATION_ID}.*message=${REPLY_ID}`, 'u')
  );

  await page.goto('/messages/files');
  await expect(page.getByRole('heading', { name: 'Files and links', level: 1 })).toBeVisible();
  await expect(page.getByText('Incident plan.pdf')).toBeVisible();
  await expect(page.getByText('Protected shared item')).toBeVisible();
  await expect(page.getByText('2 KB', { exact: false })).toBeVisible();
  await page.getByLabel('Search shared items').fill('Mina');
  await expect(page).toHaveURL(/q=Mina/u);
  await expect(page.getByLabel('Open Incident plan.pdf in Operations')).toHaveAttribute(
    'href',
    new RegExp(`conversation=${CONVERSATION_ID}.*message=${MESSAGE_ID}`, 'u')
  );
  await page.setViewportSize({ width: 320, height: 800 });
  const filesOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(filesOverflow).toBe(false);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/messages/settings');
  await expect(page.getByRole('heading', { name: 'Messenger settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'High contrast' })).toBeVisible();
  await expect(
    page.getByRole('switch', { name: 'Share my Messenger connection presence' })
  ).toBeChecked();
  await expect(page.getByRole('button', { name: 'Open notification settings' })).toBeVisible();
  accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 800 });
  const settingsOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(settingsOverflow).toBe(false);

  await page.goto('/messages/later');
  await expect(page.getByRole('heading', { name: 'Later', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Remind me later' }).click();
  await page.getByLabel('Remind me at').fill('2027-01-15T09:30');
  await page.getByRole('button', { name: 'Set reminder' }).click();
  await expect(page.getByRole('button', { name: 'Change reminder' })).toBeVisible();
  expect(state.laterUpdates).toHaveLength(1);
  expect(state.laterUpdates[0]).toMatchObject({ state: 'SNOOZED', version: 0 });

  await page.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  expect(state.laterUpdates).toHaveLength(2);
  expect(state.laterUpdates[1]).toMatchObject({ state: 'COMPLETED', version: 1 });

  accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);
  const laterOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(laterOverflow).toBe(false);
});

test('work surfaces reflow at 200 percent text zoom without losing actions', async ({
  page,
}, testInfo) => {
  await mockMessagingWorkSurfaces(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/messages/activity');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  await expect(page.getByRole('heading', { name: 'Activity', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mentions' })).toBeVisible();
  await expect(page.getByLabel('Open Mentions in Operations')).toBeVisible();
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('messaging-activity-200-percent-text-zoom.png'),
    fullPage: true,
  });
});
