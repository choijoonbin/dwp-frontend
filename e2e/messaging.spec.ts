import { expect, test } from '@playwright/test';

import {
  captureMessagingWorkspaceModes,
  clickResponsiveMessageAction as clickMessageAction,
  conversationDisplayPreference,
  expectCompactComposer,
  expectInsideViewport,
  fulfillMessagingRoute as fulfill,
  messagingMessage as message,
  messagingMessageRow as messageRow,
  openMessagingConversation as openConversation,
} from './support/messaging-ui-contracts';
import {
  addIncidentConversation,
  COLLEAGUE,
  COLLEAGUE_MESSAGE_ID,
  CONVERSATION_ID,
  findMessage,
  mockMessaging,
  OLD_REPLY_MESSAGE_ID,
  OWNER_MESSAGE_ID,
  SECOND_CONVERSATION_ID,
  type SendRequest,
} from './support/messaging-workspace-fixture';

test('composer sends with Enter, preserves Shift+Enter, and ignores Enter during IME composition', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await mockMessaging(page);
  await openConversation(page);
  await expect(page.getByRole('heading', { name: 'Conversations', exact: true })).toBeVisible();
  await expect(page.getByTestId('messaging-context-rail')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick catch-up' })).toBeVisible();
  const composer = page.getByRole('textbox', { name: 'Compose message' });

  await composer.fill('Sent with Enter');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Sent with Enter');
  await expect(messageRow(page, 'Sent with Enter')).toBeVisible();

  const sentBeforeMultiline = state.sentRequests.length;
  await composer.fill('Line one');
  await composer.press('Shift+Enter');
  await composer.type('Line two');
  await expect(composer).toHaveValue('Line one\nLine two');
  expect(state.sentRequests).toHaveLength(sentBeforeMultiline);
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Line one\nLine two');

  const sentBeforeComposition = state.sentRequests.length;
  await composer.fill('Korean composition');
  await composer.dispatchEvent('compositionstart', { data: '한' });
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.length).toBe(sentBeforeComposition);
  await composer.dispatchEvent('compositionend', { data: '한' });
  await composer.fill('Korean composition complete');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.body).toBe('Korean composition complete');
  await captureMessagingWorkspaceModes(page, test.info());
});

test('a failed send remains isolated from the next conversation', async ({ page }) => {
  const state = await mockMessaging(page);
  addIncidentConversation(state);

  const attempts: Array<{ conversationId: string; body: string }> = [];
  let failNextSend = true;
  await page.route('**/api/messaging/v1/conversations/*/messages', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    const match = new URL(request.url()).pathname.match(
      /^\/api\/messaging\/v1\/conversations\/([^/]+)\/messages$/u
    );
    if (!match) return route.fallback();
    attempts.push({
      conversationId: decodeURIComponent(match[1]!),
      body: (request.postDataJSON() as SendRequest).body,
    });
    if (!failNextSend) return route.fallback();
    failNextSend = false;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Temporary delivery failure' }),
    });
  });

  await openConversation(page);
  const composer = page.getByRole('textbox', { name: 'Compose message' });
  await composer.fill('Launch room only');
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  const backButton = page.getByRole('button', { name: 'Back' });
  if (await backButton.isVisible()) await backButton.click();
  await page.getByRole('button', { name: /Incident response/u }).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${SECOND_CONVERSATION_ID}`, 'u'));
  await expect(page.getByRole('heading', { name: 'Incident response' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  await expect(composer).toHaveValue('');

  await composer.fill('Incident room update');
  await composer.press('Enter');
  await expect
    .poll(() => attempts.at(-1))
    .toEqual({ conversationId: SECOND_CONVERSATION_ID, body: 'Incident room update' });
  expect(attempts.filter((attempt) => attempt.body === 'Launch room only')).toHaveLength(1);
});

test('conversation navigator progressively loads beyond the first page', async ({ page }) => {
  const state = await mockMessaging(page);
  const template = state.conversations[0]!;
  for (let index = 1; index <= 34; index += 1) {
    const conversationId = `71000000-0000-0000-0000-${String(index).padStart(12, '0')}`;
    state.conversations.push({
      ...template,
      conversationId,
      conversationKey: `navigator-${index}`,
      name: `Navigator channel ${index}`,
      unreadCount: 0,
      lastMessage: null,
      lastMessageAt: null,
    });
  }

  await page.goto('/messages/inbox');
  await expect(page.getByTestId('messaging-conversation-navigator')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load more conversations' })).toBeVisible();
  await expect(page.getByText('Navigator channel 34', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Load more conversations' }).click();
  await expect(page.getByText('Navigator channel 34', { exact: true })).toBeVisible();
});

test('conversation search and loaded-list filter survive reload through URL state', async ({
  page,
}) => {
  await mockMessaging(page);
  await page.goto('/messages/inbox');

  const search = page.getByRole('textbox', { name: 'Search conversation name or topic' });
  await search.fill('launch review');
  await page.getByRole('tab', { name: 'Unread' }).click();
  await expect(page).toHaveURL(/q=launch(?:\+|%20)review/u);
  await expect(page).toHaveURL(/filter=UNREAD/u);

  await page.reload();
  await expect(search).toHaveValue('launch review');
  await expect(page.getByRole('tab', { name: 'Unread' })).toHaveAttribute('aria-selected', 'true');
});

test('conversation navigator prefers cursor continuation and preserves its deep link', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  const template = state.conversations[0]!;
  for (let index = 1; index <= 34; index += 1) {
    const conversationId = `71000000-0000-0000-0001-${String(index).padStart(12, '0')}`;
    state.conversations.push({
      ...template,
      conversationId,
      conversationKey: `cursor-navigator-${index}`,
      name: `Cursor navigator channel ${index}`,
      unreadCount: 0,
      lastMessage: null,
      lastMessageAt: null,
    });
  }
  const pageRequests: URL[] = [];
  await page.route('**/api/messaging/v1/conversations?*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const url = new URL(request.url());
    pageRequests.push(url);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 30);
    const cursor = url.searchParams.get('cursor');
    const pageNumber = Number(url.searchParams.get('page') ?? 0);
    const start = cursor === null ? pageNumber * pageSize : Number(cursor.split('.').at(-1));
    const end = Math.min(start + pageSize, state.conversations.length);
    const hasMore = end < state.conversations.length;
    return fulfill(route, {
      items: state.conversations.slice(start, end),
      total: state.conversations.length,
      page: pageNumber,
      pageSize,
      hasMore,
      nextCursor: hasMore ? `v1.opaque.${end}` : null,
      nextPage: cursor === null && hasMore ? pageNumber + 1 : null,
    });
  });

  await page.goto(`/messages/inbox?conversation=${CONVERSATION_ID}`);
  await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  if (test.info().project.name === 'mobile') {
    await expect(page.getByTestId('messaging-conversation-navigator')).toBeHidden();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).not.toHaveURL(/conversation=/u);
  }
  await page.getByRole('button', { name: 'Load more conversations' }).click();

  await expect(page.getByText('Cursor navigator channel 34', { exact: true })).toBeVisible();
  if (test.info().project.name === 'chromium') {
    await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`, 'u'));
    await expect(page.getByRole('heading', { name: 'Launch coordination' })).toBeVisible();
  }
  await expect
    .poll(() =>
      pageRequests.some((request) => request.searchParams.get('cursor') === 'v1.opaque.30')
    )
    .toBe(true);
  expect(
    pageRequests.some(
      (request) =>
        request.searchParams.get('cursor') === 'v1.opaque.30' &&
        request.searchParams.get('page') === '0'
    )
  ).toBe(true);
  expect(pageRequests.some((request) => request.searchParams.get('page') === '1')).toBe(false);
});

test('an old reply deep link keeps its thread error and retry action visible', async ({ page }) => {
  const state = await mockMessaging(page);
  const oldReply = findMessage(state, OLD_REPLY_MESSAGE_ID)!;

  await page.route(
    `**/api/messaging/v1/conversations/${CONVERSATION_ID}/messages/${OLD_REPLY_MESSAGE_ID}`,
    (route) => fulfill(route, oldReply)
  );
  await page.route(
    `**/api/messaging/v1/conversations/${CONVERSATION_ID}/messages/${OWNER_MESSAGE_ID}/replies?*`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ERROR', message: 'Thread temporarily unavailable' }),
      })
  );

  await page.goto(
    `/messages/inbox?conversation=${CONVERSATION_ID}&message=${OLD_REPLY_MESSAGE_ID}`
  );

  const thread = page.getByRole('region', { name: 'Thread', exact: true });
  await expect(thread).toBeVisible();
  await expect(thread.getByText('Thread replies could not be loaded.')).toBeVisible();
  await expect(thread.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('people directory preserves filters and continues with the cursor contract', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === 'mobile' ? 320 : 1440,
    height: 900,
  });
  const state = await mockMessaging(page);
  for (let index = 0; index < 35; index += 1) {
    state.directoryPeople.push({
      userId: 1_000 + index,
      personPublicId: `directory-person-${index}`,
      emailAddress: `directory.person.${index}@example.com`,
      displayName: `Directory Person ${String(index).padStart(2, '0')}`,
      jobTitle: 'Risk Analyst',
      organizationName: 'Risk Operations',
      presenceState: 'AVAILABLE',
    });
  }

  await page.goto('/messages/people?q=Directory&org=Risk&job=Analyst&presence=AVAILABLE');
  const search = page.getByRole('textbox', { name: 'Search people' });
  const organization = page.getByRole('textbox', { name: 'Organization' });
  const jobTitle = page.getByRole('textbox', { name: 'Job or title' });
  const presence = page.getByRole('combobox', { name: 'Messenger connection state' });
  await expect(search).toHaveValue('Directory');
  await expect(organization).toHaveValue('Risk');
  await expect(jobTitle).toHaveValue('Analyst');
  await expect(presence).toHaveText('Connected to Messenger');
  for (const control of [search, organization, jobTitle, presence]) {
    await expectInsideViewport(control, page);
  }
  await expect(page.getByText('30 matching loaded · 35 directory candidates')).toBeVisible();
  await expect(page.getByText('Directory Person 34', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Message Directory Person 00' })).toBeVisible();

  const loadMore = page.getByRole('button', { name: 'Load more people' });
  await expectInsideViewport(loadMore, page);
  const nextPageRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === '/api/messaging/v1/people/page' && url.searchParams.has('cursor');
  });
  await loadMore.click();
  const requestUrl = new URL((await nextPageRequest).url());
  expect(requestUrl.searchParams.get('cursor')).toBe('30');
  expect(requestUrl.searchParams.has('offset')).toBe(false);
  await expect(page.getByText('Directory Person 34', { exact: true })).toBeVisible();
  const containedRows = page.getByTestId('messaging-people-directory').getByRole('listitem');
  await expect(containedRows).toHaveCount(35);
  expect(
    await containedRows.nth(20).evaluate((row) => getComputedStyle(row).contentVisibility)
  ).toBe('auto');
  await expect(page).toHaveURL(/q=Directory.*org=Risk.*job=Analyst.*presence=AVAILABLE/u);
});

test('people directory exposes an explicit retry after a bounded load failure', async ({
  page,
}) => {
  await mockMessaging(page);
  let failures = 0;
  let allowSuccess = false;
  await page.route(/\/api\/messaging\/v1\/people\/page(?:\?|$)/u, async (route) => {
    if (allowSuccess) return route.fallback();
    failures += 1;
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ERROR', message: 'Temporary directory failure' }),
    });
  });

  await page.goto('/messages/people');
  await expect.poll(() => failures).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  allowSuccess = true;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText(COLLEAGUE.displayName, { exact: true })).toBeVisible();
  expect(failures).toBeGreaterThanOrEqual(2);
});

test('composer offers searchable expressions, structured mentions, and conversation meeting history', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);
  const composer = page.getByRole('textbox', { name: 'Compose message' });

  await page.getByRole('button', { name: 'Open emoji' }).click();
  const expressionSearch = page.getByRole('textbox', {
    name: 'Search emoji or work expression',
  });
  await expect(expressionSearch).toBeVisible();
  await expressionSearch.fill('review');
  await page.getByRole('button', { name: 'Reviewing', exact: true }).click();
  await expect(composer).toHaveValue('👀');

  await composer.fill('@');
  const mentionSuggestions = page.getByRole('listbox', { name: 'Mention suggestions' });
  await expect(mentionSuggestions).toBeVisible();
  await expect(mentionSuggestions.getByText(COLLEAGUE.jobTitle!, { exact: false })).toBeVisible();
  await mentionSuggestions.getByText(COLLEAGUE.displayName, { exact: true }).click();
  await expect(composer).toHaveValue(`@${COLLEAGUE.displayName} `);
  await composer.type('please review this.');
  await composer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.mentionedUserIds).toEqual([COLLEAGUE.userId]);

  await page.getByRole('button', { name: 'Start or join a meeting', exact: true }).click();
  const meetingDialog = page.getByRole('dialog', { name: /Conversation meeting/ });
  await expect(meetingDialog.getByText('Recent meetings', { exact: true })).toBeVisible();
  await expect(meetingDialog.getByText(COLLEAGUE.displayName, { exact: true })).toBeVisible();
  await expect(meetingDialog.getByText('24 min', { exact: false })).toBeVisible();
});

test('security-scanned attachment-only messages are delivered and downloaded through a grant', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Attach file' }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'launch-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('security-reviewed attachment'),
    });

  await expect(page.getByText(/Ready to attach$/u)).toBeVisible();
  await expect.poll(() => state.uploadedAttachmentIds).toHaveLength(1);

  await page.getByRole('textbox', { name: 'Compose message' }).press('Enter');

  await expect
    .poll(() => state.sentRequests.at(-1)?.attachmentIds)
    .toEqual([state.uploadedAttachmentIds[0]]);
  expect(state.sentRequests.at(-1)?.body).toBe('');
  const downloadButton = page.getByRole('button', { name: 'Download launch-notes.txt' });
  await expect(downloadButton).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('launch-notes.txt');
});

test('switching conversations discards an attachment session that finishes late', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  addIncidentConversation(state);
  let releaseUploadSession: (() => void) | undefined;
  await page.route('**/api/messaging/v1/conversations/*/attachments/uploads', async (route) => {
    await new Promise<void>((resolve) => {
      releaseUploadSession = resolve;
    });
    await route.fallback();
  });
  await openConversation(page);

  await page.getByRole('button', { name: 'Attach file' }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'staged-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('discard after conversation switch'),
    });
  await expect(page.getByText('staged-notes.txt', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(releaseUploadSession)).toBe(true);

  const backButton = page.getByRole('button', { name: 'Back' });
  if (await backButton.isVisible()) await backButton.click();
  await page.getByRole('button', { name: /Incident response/u }).click();
  await expect(page.getByRole('heading', { name: 'Incident response' })).toBeVisible();
  releaseUploadSession?.();

  await expect.poll(() => state.discardedAttachmentIds).toHaveLength(1);
  expect(state.attachments.has(state.discardedAttachmentIds[0]!)).toBe(false);
  await expect(page.getByText('staged-notes.txt', { exact: true })).toHaveCount(0);
});

test('cancelling an upload discards the attachment session even when it finishes late', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  let releaseUploadSession: (() => void) | undefined;
  await page.route('**/api/messaging/v1/conversations/*/attachments/uploads', async (route) => {
    await new Promise<void>((resolve) => {
      releaseUploadSession = resolve;
    });
    await route.fallback();
  });
  await openConversation(page);

  await page.getByRole('button', { name: 'Attach file' }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'cancelled-notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('cancel before the upload session is ready'),
    });
  await expect(page.getByText('cancelled-notes.txt', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(releaseUploadSession)).toBe(true);

  await page.getByRole('button', { name: 'Remove attachment: cancelled-notes.txt' }).click();
  await expect(page.getByText('cancelled-notes.txt', { exact: true })).toHaveCount(0);
  releaseUploadSession?.();

  await expect.poll(() => state.discardedAttachmentIds).toHaveLength(1);
  expect(state.uploadedAttachmentIds).toHaveLength(0);
  expect(state.attachments.has(state.discardedAttachmentIds[0]!)).toBe(false);
});

test('message actions expose labelled reactions, thread replies, save, edit, delete, and meeting entry', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  let ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await clickMessageAction(page, ownerRow, 'Add reaction');
  await expect(
    page.getByRole('textbox', { name: 'Search emoji or work expression' })
  ).toBeVisible();
  await page.getByRole('tab', { name: 'People' }).click();
  await expect(page.getByRole('button', { name: 'Like', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thanks', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Work' }).click();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reviewing', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'People' }).click();
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await expect
    .poll(() => state.reactionRequests.at(-1))
    .toEqual({
      messageId: OWNER_MESSAGE_ID,
      emoji: '👍',
    });

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await clickMessageAction(page, ownerRow, 'Save for later');
  await expect.poll(() => state.savedMessageIds).toContain(OWNER_MESSAGE_ID);
  await expect(page.getByText('Message saved for later.')).toBeVisible();

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await clickMessageAction(page, ownerRow, 'Reply in thread');
  const thread = page.getByRole('region', { name: 'Thread', exact: true });
  await expect(thread).toBeVisible();
  await expect(thread.getByText('I checked the rollout and security sections.')).toBeVisible();
  const threadComposer = thread.getByRole('textbox', { name: 'Compose thread reply' });
  await threadComposer.fill('Reply sent from the thread');
  await threadComposer.press('Enter');
  await expect.poll(() => state.sentRequests.at(-1)?.replyToMessageId).toBe(OWNER_MESSAGE_ID);
  await expect(thread.getByText('Reply sent from the thread', { exact: true })).toBeVisible();
  await thread.getByRole('button', { name: 'Close thread' }).click();
  await expect(thread).toBeHidden();

  ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await ownerRow.hover();
  await clickMessageAction(page, ownerRow, 'Edit message');
  const editDialog = page.getByRole('dialog', { name: 'Edit message' });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('textbox', { name: 'Message' }).fill('Launch checklist confirmed.');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => state.editedBodies.at(-1)).toBe('Launch checklist confirmed.');
  await expect(messageRow(page, 'Launch checklist confirmed.')).toBeVisible();

  ownerRow = messageRow(page, 'Launch checklist confirmed.');
  await ownerRow.hover();
  await clickMessageAction(page, ownerRow, 'Delete message');
  const deleteDialog = page.getByRole('alertdialog', { name: 'Delete this message?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete message' }).click();
  await expect.poll(() => state.deletedMessageIds).toContain(OWNER_MESSAGE_ID);
  await expect(page.getByText('This message was deleted', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Start or join a meeting', exact: true }).click();
  const meetingDialog = page.getByRole('dialog', { name: /Conversation meeting/ });
  await expect(meetingDialog).toBeVisible();
  await expect(meetingDialog.getByText('Ready to start a meeting')).toBeVisible();
  await expect(meetingDialog.getByRole('button', { name: 'Start meeting' })).toBeEnabled();
  await meetingDialog.getByRole('button', { name: 'Close' }).dispatchEvent('click');
  await expect(meetingDialog).toBeHidden();
});

test('new conversation dialog supports group and channel modes and command search opens with Ctrl or Cmd K', async ({
  page,
}, testInfo) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const searchDialog = page.getByRole('dialog', { name: 'Messenger search' });
  await expect(searchDialog).toBeVisible();
  await searchDialog
    .getByRole('textbox', { name: 'Search conversations, messages, or people' })
    .fill('launch');
  await expect(searchDialog.getByText('Conversations', { exact: true })).toBeVisible();
  await expect(searchDialog.getByText('Messages', { exact: true })).toBeVisible();
  await expect(searchDialog.getByText('People', { exact: true })).toBeVisible();
  await searchDialog.getByText('Launch coordination', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`, 'u'));

  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Back' }).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  const messageSearchDialog = page.getByRole('dialog', { name: 'Messenger search' });
  await messageSearchDialog
    .getByRole('textbox', { name: 'Search conversations, messages, or people' })
    .fill('launch');
  await messageSearchDialog.getByText('The customer briefing deck is ready.').click();
  await expect(page).toHaveURL(
    new RegExp(`conversation=${CONVERSATION_ID}.*message=${COLLEAGUE_MESSAGE_ID}`, 'u')
  );

  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'New conversation' }).click();
  const createDialog = page.getByRole('dialog', { name: 'New group or channel' });
  await expect(createDialog).toBeVisible();
  const groupMode = createDialog.getByRole('button', { name: 'Group conversation' });
  const channelMode = createDialog.getByRole('button', { name: 'Channel' });
  await expect(groupMode).toHaveAttribute('aria-pressed', 'true');
  await expect(createDialog.getByRole('textbox', { name: 'Group name' })).toBeVisible();
  await channelMode.click();
  await expect(channelMode).toHaveAttribute('aria-pressed', 'true');
  await createDialog.getByRole('textbox', { name: 'Channel name' }).fill('Release room');
  await createDialog
    .getByRole('textbox', { name: 'Topic (optional)' })
    .fill('Daily launch decisions');
  await createDialog.getByRole('button', { name: 'Create conversation' }).click();
  await expect.poll(() => state.createdRequests.at(-1)?.type).toBe('CHANNEL');
  expect(state.createdRequests.at(-1)).toMatchObject({
    name: 'Release room',
    topic: 'Daily launch decisions',
    memberUserIds: [],
  });
  await expect(page.getByRole('heading', { name: 'Release room' })).toBeVisible();
});

test('conversation owners can govern member roles from the conversation context', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Manage members' }).click();
  const dialog = page.getByRole('dialog', { name: /Conversation members/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Alex Park')).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Role for Alex Park' }).click();
  await page.getByRole('option', { name: 'Moderator' }).click();

  await expect
    .poll(() => state.memberRoleRequests.at(-1))
    .toEqual({ userId: COLLEAGUE.userId, role: 'MODERATOR', version: 2 });
  await expect(dialog.getByRole('button', { name: 'Remove Alex Park' })).toBeVisible();
});

test('personal display settings persist per conversation and globally without affecting peers', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 720 });
  }
  const overlayLayoutErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('popover component is too tall')) {
      overlayLayoutErrors.push(message.text());
    }
  });
  const state = await mockMessaging(page);
  await openConversation(page);

  await page.getByRole('button', { name: 'Conversation settings' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Conversation settings' });
  await expect(settingsDialog).toBeVisible();
  expect(overlayLayoutErrors).toEqual([]);
  await settingsDialog.getByRole('tab', { name: 'Display' }).click();
  await expect(
    settingsDialog.getByText(
      'Only tenant-approved, low-saturation presets are applied to your view.'
    )
  ).toBeVisible();
  expect(overlayLayoutErrors).toEqual([]);

  await settingsDialog.getByRole('button', { name: 'Mist' }).click();
  await expect
    .poll(() => state.conversationDisplayPreferences.get(CONVERSATION_ID)?.theme)
    .toBe('MIST');
  expect(overlayLayoutErrors).toEqual([]);

  await settingsDialog.getByRole('button', { name: 'All conversations' }).click();
  expect(overlayLayoutErrors).toEqual([]);
  await settingsDialog.getByRole('button', { name: 'Compact' }).click();
  await expect.poll(() => state.displayPreference.density).toBe('COMPACT');
  await page.screenshot({
    path: testInfo.outputPath('messaging-display-preferences.png'),
    fullPage: true,
  });
  await settingsDialog.getByRole('button', { name: 'Close conversation settings' }).click();
  await expect(settingsDialog).toBeHidden();
  expect(overlayLayoutErrors).toEqual([]);
});

test('conversation display policy disables only the setting governed by the tenant', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  state.conversationDisplayPreferences.set(CONVERSATION_ID, {
    ...conversationDisplayPreference(state, CONVERSATION_ID),
    effectiveLayoutMode: 'COLLABORATIVE',
    policyLocked: true,
    policyReason: 'STRUCTURED_CONVERSATION',
  });
  await openConversation(page);

  await page.getByRole('button', { name: 'Conversation settings' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Conversation settings' });
  await settingsDialog.getByRole('tab', { name: 'Display' }).click();
  await expect(
    settingsDialog.getByText(
      'Announcements, incidents, and meeting conversations use a collaborative structure to preserve their work meaning.'
    )
  ).toBeVisible();

  const layout = settingsDialog.getByRole('group', { name: 'Message layout' });
  await expect(layout.getByRole('button', { name: 'Collaborative' })).toBeDisabled();
  const density = settingsDialog.getByRole('group', { name: 'Information density' });
  await expect(density.getByRole('button', { name: 'Compact' })).toBeEnabled();
  const theme = settingsDialog.getByRole('group', { name: 'Conversation background' });
  await expect(theme.getByRole('button', { name: 'Mist' })).toBeEnabled();

  await settingsDialog.getByRole('button', { name: 'Close conversation settings' }).click();
  state.conversationDisplayPreferences.set(CONVERSATION_ID, {
    ...conversationDisplayPreference(state, CONVERSATION_ID),
    effectiveTheme: 'DEFAULT',
    policyLocked: true,
    policyReason: 'RESTRICTED_CONVERSATION',
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Compose message' })).toBeVisible();
  await page.getByRole('button', { name: 'Conversation settings' }).click();
  const restrictedDialog = page.getByRole('dialog', { name: 'Conversation settings' });
  await restrictedDialog.getByRole('tab', { name: 'Display' }).click();
  await expect(
    restrictedDialog.getByText(
      'Restricted conversations use the approved default background to protect security indicators and contrast.'
    )
  ).toBeVisible();
  const restrictedTheme = restrictedDialog.getByRole('group', {
    name: 'Conversation background',
  });
  await expect(restrictedTheme.locator('button[value="DEFAULT"]')).toBeDisabled();
  const restrictedLayout = restrictedDialog.getByRole('group', { name: 'Message layout' });
  await expect(restrictedLayout.getByRole('button', { name: 'Default' })).toBeEnabled();
  const restrictedDensity = restrictedDialog.getByRole('group', {
    name: 'Information density',
  });
  await expect(restrictedDensity.getByRole('button', { name: 'Compact' })).toBeEnabled();
});

test('long conversations load earlier history without replacing the current timeline', async ({
  page,
}) => {
  const state = await mockMessaging(page);
  state.messages.set(
    CONVERSATION_ID,
    Array.from({ length: 105 }, (_, index) =>
      message({
        messageId: `73000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        body: `History ${String(index + 1).padStart(3, '0')}`,
        sequence: index + 1,
        createdAt: `2026-08-18T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00Z`,
      })
    )
  );

  await openConversation(page);
  const timeline = page.getByRole('feed', { name: 'Messages' });
  await expect(timeline.getByText('History 105', { exact: true })).toBeAttached();
  await expect(timeline.getByText('History 006', { exact: true })).toHaveCount(0);
  await timeline.evaluate((element) => {
    element.scrollTop = 0;
  });
  const retainedMessage = timeline.getByText('History 026', { exact: true });
  const retainedTopBefore = (await retainedMessage.boundingBox())?.y;
  expect(retainedTopBefore).toBeDefined();
  await page.getByRole('button', { name: 'Load earlier messages' }).click();
  await expect(timeline.getByText('History 006', { exact: true })).toBeAttached();
  await expect(timeline.getByText('History 105', { exact: true })).toBeAttached();
  const retainedTopAfter = (await retainedMessage.boundingBox())?.y;
  expect(retainedTopAfter).toBeDefined();
  expect(Math.abs(retainedTopAfter! - retainedTopBefore!)).toBeLessThanOrEqual(2);
});

test('narrow viewport keeps the main composer and thread composer reachable without clipping', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile geometry contract');
  await page.setViewportSize({ width: 320, height: 800 });
  await mockMessaging(page);
  await openConversation(page);

  await expect(page.getByRole('status', { name: 'Auto sync' })).toBeVisible();
  const mainComposer = page.getByRole('textbox', { name: 'Compose message' });
  await expectInsideViewport(mainComposer, page);
  await expectCompactComposer(page.getByTestId('messaging-composer'));
  await page.screenshot({
    path: testInfo.outputPath('messaging-mobile-conversation.png'),
  });
  const ownerRow = messageRow(page, 'Confirm the launch checklist before noon.');
  await clickMessageAction(page, ownerRow, 'Reply in thread');

  const thread = page.getByRole('region', { name: 'Thread', exact: true });
  const threadComposer = thread.getByRole('textbox', { name: 'Compose thread reply' });
  await expectInsideViewport(thread, page);
  await expectInsideViewport(thread.getByRole('button', { name: 'Close thread' }), page);
  await expectInsideViewport(threadComposer, page);
  await page.screenshot({
    path: testInfo.outputPath('messaging-mobile-thread.png'),
  });

  const geometry = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflowers = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute('role'),
          label: element.getAttribute('aria-label'),
          text: (element.innerText ?? element.textContent ?? '').slice(0, 80),
          className: element.className,
          parentClassName: element.parentElement?.className ?? null,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > viewportWidth + 1 || item.left < -1)
      .slice(0, 12);
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflowers,
    };
  });
  expect(
    geometry.documentWidth - geometry.viewportWidth,
    `Horizontal overflowers: ${JSON.stringify(geometry.overflowers)}`
  ).toBeLessThanOrEqual(1);

  const composerBox = await threadComposer.boundingBox();
  expect(composerBox).not.toBeNull();
  const composerIsTopmost = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return Boolean(target?.closest('[aria-label="Compose thread reply"]'));
    },
    {
      x: composerBox!.x + composerBox!.width / 2,
      y: composerBox!.y + composerBox!.height / 2,
    }
  );
  expect(composerIsTopmost).toBe(true);
});
