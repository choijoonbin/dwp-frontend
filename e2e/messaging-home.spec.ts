import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { mockShellSession } from './support/shell-session';

import type {
  MessagingConversation,
  MessagingHome,
  MessagingMessage,
  MessagingSavedItemPage,
} from '@dwp-frontend/shared-utils';

const MESSAGING_PERMISSIONS = ['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
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

function message(
  messageId: string,
  conversationId: string,
  body: string,
  senderName: string
): MessagingMessage {
  return {
    messageId,
    conversationId,
    senderUserId: 43,
    senderPersonPublicId: 'person-alex',
    senderName,
    body,
    contentType: 'TEXT',
    messageKind: 'USER',
    replyToMessageId: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-27T00:35:00Z',
    sequence: 4,
    version: 1,
    reactions: [],
    attachments: [],
    mentions: [],
    replyCount: 0,
    rootPreview: null,
  };
}

function conversation(
  conversationId: string,
  overrides: Partial<MessagingConversation> = {}
): MessagingConversation {
  const lastMessage = message(
    `message-${conversationId}`,
    conversationId,
    'Please review the rollout checklist before noon.',
    'Alex Park'
  );
  return {
    conversationId,
    conversationKey: conversationId,
    conversationType: 'CHANNEL',
    name: conversationId,
    topic: 'Release coordination',
    visibility: 'PRIVATE',
    dataClassification: 'INTERNAL',
    linkedSpaceKey: null,
    linkedSpaceName: null,
    lifecycleState: 'ACTIVE',
    memberCount: 5,
    unreadCount: 1,
    favorite: false,
    pinned: false,
    lastMessage,
    lastMessageAt: lastMessage.createdAt,
    version: 1,
    ...overrides,
  };
}

function fixtures(empty: boolean) {
  const direct = conversation('direct-1', {
    conversationType: 'DIRECT',
    name: 'Alex Park',
    unreadCount: 1,
  });
  const space = conversation('space-1', {
    name: 'AI Governance Space',
    visibility: 'SPACE',
    linkedSpaceKey: 'ai-governance',
    linkedSpaceName: 'AI Governance',
    unreadCount: 3,
  });
  const restrictedMessage = message(
    'message-restricted',
    'restricted-1',
    'Confidential acquisition details must never appear on the home screen.',
    'Morgan Lee'
  );
  const restricted = conversation('restricted-1', {
    name: 'Board operations',
    dataClassification: 'RESTRICTED',
    unreadCount: 5,
    lastMessage: restrictedMessage,
    lastMessageAt: restrictedMessage.createdAt,
  });
  const readPinned = conversation('pinned-read', {
    name: 'Pinned reference',
    pinned: true,
    unreadCount: 0,
  });
  const conversations = empty ? [] : [readPinned, restricted, space, direct];
  const home: MessagingHome = {
    generatedAt: '2026-08-27T00:40:00Z',
    metrics: empty
      ? { unreadConversations: 0, mentions: 0, spaceChannels: 0, directMessages: 0, savedItems: 0 }
      : { unreadConversations: 3, mentions: 2, spaceChannels: 4, directMessages: 7, savedItems: 1 },
    priority: conversations,
    spaces: empty ? [] : [space],
    people: [],
  };
  const savedMessage = message(
    'saved-message-1',
    direct.conversationId,
    'Confirm the customer briefing owner.',
    'Alex Park'
  );
  const saved: MessagingSavedItemPage = {
    items: empty
      ? []
      : [
          {
            message: savedMessage,
            conversationName: 'Alex Park',
            conversationType: 'DIRECT',
            savedAt: '2026-08-27T00:38:00Z',
          },
        ],
    total: empty ? 0 : 1,
    page: 0,
    pageSize: 3,
  };
  return { conversations, home, saved };
}

async function mockMessagingHome(page: Page, empty = false) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    userId: 42,
    personPublicId: 'person-mina',
    locale: 'en',
    displayName: 'Mina Kim',
    jobTitle: 'Network Operations Lead',
    email: 'mina.kim@sk.com',
    permissions: MESSAGING_PERMISSIONS,
  });
  const data = fixtures(empty);

  await page.route('**/api/messaging/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') return route.fallback();
    if (url.pathname === '/api/messaging/v1/home') return fulfill(route, data.home);
    if (url.pathname === '/api/messaging/v1/conversations') {
      const conversations =
        url.searchParams.get('scope') === 'MENTIONS'
          ? data.conversations.filter((conversation) => conversation.conversationType === 'DIRECT')
          : data.conversations;
      return fulfill(route, {
        items: conversations,
        total: conversations.length,
        page: 0,
        pageSize: 50,
      });
    }
    if (url.pathname === '/api/messaging/v1/preferences/display') {
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
    if (url.pathname === '/api/messaging/v1/saved-items') return fulfill(route, data.saved);
    return route.fallback();
  });
}

test('turns Messenger home into a truthful, actionable attention workspace', async ({ page }) => {
  await mockMessagingHome(page);
  await page.goto('/messages/home');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mina Kim');
  await expect(page.getByRole('heading', { name: '2 mentions are waiting for you' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review 2 mentions in the inbox' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open 1 saved items' })).toBeVisible();

  const focusRows = page.getByTestId('messaging-focus-conversation');
  await expect(focusRows).toHaveCount(3);
  await expect(focusRows.first()).toHaveAttribute('href', /conversation=direct-1/u);
  await expect(page.getByText('Pinned reference')).toHaveCount(0);
  await expect(
    page.getByText('Protected conversation content is hidden from the home view.')
  ).toBeVisible();
  await expect(page.getByText('Confidential acquisition details', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My Space flow' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continue where you left off' })).toBeVisible();
  await expect(page.getByText('Confirm the customer briefing owner.')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: test.info().outputPath('messaging-home.png'), fullPage: true });

  await focusRows.first().focus();
  await expect(focusRows.first()).toBeFocused();

  const accessibility = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(accessibility.violations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 800 });
  const narrowOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(narrowOverflow).toBe(false);
});

test('shows a calm completion state without fabricated recommendations', async ({ page }) => {
  await mockMessagingHome(page, true);
  await page.goto('/messages/home');

  await expect(
    page.getByRole('heading', { name: "You're caught up on important conversations" })
  ).toBeVisible();
  await expect(page.getByText('No new conversations need action')).toBeVisible();
  await expect(page.getByText('No saved messages')).toBeVisible();
  await expect(page.getByText('People to connect with')).toHaveCount(0);
});

test('opens a truthful unread mention scope and returns to the complete inbox', async ({
  page,
}) => {
  await mockMessagingHome(page);
  await page.goto('/messages/home');

  const mentionRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === '/api/messaging/v1/conversations' &&
      url.searchParams.get('scope') === 'MENTIONS'
    );
  });
  await page.getByRole('button', { name: 'Review mentions', exact: true }).click();
  await mentionRequest;

  await expect(page).toHaveURL(/\/messages\/inbox\?attention=mentions$/u);
  await expect(page.getByRole('heading', { name: 'Mentions' })).toBeVisible();
  await expect(page.getByText('Alex Park', { exact: true })).toBeVisible();
  await expect(page.getByText('AI Governance Space', { exact: true })).toHaveCount(0);

  const inboxRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === '/api/messaging/v1/conversations' && url.searchParams.get('scope') === 'ALL'
    );
  });
  await page.getByRole('button', { name: 'Show all inbox' }).click();
  await inboxRequest;

  await expect(page).toHaveURL(/\/messages\/inbox(?:\?.*)?$/u);
  expect(new URL(page.url()).searchParams.has('attention')).toBe(false);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await expect(page.getByText('AI Governance Space', { exact: true })).toBeVisible();
});
