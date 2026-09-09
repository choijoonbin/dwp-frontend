import { expect, test, type Page } from '@playwright/test';
import type { DwaionConversation, DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

const ID = '00000000-0000-4000-8000-000000000001';
const EXPERT = 'DWP_APPROVAL_EXPERT';
const ASSISTANT = 'DWP_ASSISTANT';
const summary: DwaionConversationSummary = {
  conversationId: ID,
  title: 'Saved approval review',
  locale: 'en',
  messageCount: 2,
  agentKey: EXPERT,
  sourceSystems: [],
  evidenceCount: 0,
  summaryExcerpt: 'Saved scoped answer for this conversation',
  lastAnswerStatus: null,
  retentionUntil: null,
  legalHold: false,
  createdAt: '2026-09-08T01:00:00Z',
  updatedAt: '2026-09-08T01:00:00Z',
  lastMessageAt: '2026-09-08T01:00:00Z',
};

async function fixture(page: Page, keys: string[] = [EXPERT]) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const detail: DwaionConversation = {
    summary,
    messages: keys.map((agentKey, index) => ({
      messageId: `saved-answer-${index}`,
      role: 'ASSISTANT',
      content: 'Saved scoped answer for this conversation',
      agentKey,
      citations: [],
      runId: null,
      statusCode: null,
      createdAt: '2026-09-08T01:00:00Z',
    })),
  };
  const reads: Array<string | null> = [];
  await page.route('**/api/agent/v1/conversations', (route) =>
    route.fulfill({ json: { success: true, data: [summary] } })
  );
  await page.route('**/api/agent/v1/conversations/**', (route) => {
    reads.push(new URL(route.request().url()).searchParams.get('agentKey'));
    return route.fulfill({ json: { success: true, data: detail } });
  });
  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ json: { success: true, data: WORKSPACE_QUEUE_FIXTURE } })
  );
  return { reads };
}

test('an untagged archive URL resolves the verified expert before continuing in the same conversation', async ({
  page,
}) => {
  const state = await fixture(page);
  let request: Record<string, unknown> = {};
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: { ...ASK_RUNTIME_FIXTURE, conversationId: ID, agentRegistry: { ...ASK_RUNTIME_FIXTURE.agentRegistry, entryKey: EXPERT } } })}\n\n`,
    });
  });
  await page.goto('/dwaion/conversations');
  const link = page.getByRole('link', { name: /Saved approval review/ });
  await expect(link).toHaveAttribute('href', `/dwaion/conversations/${ID}`);
  // Following this href directly covers bookmarks and new tabs as well as archive clicks.
  await page.goto((await link.getAttribute('href'))!);
  await expect(page).toHaveURL(`/dwaion/conversations/${ID}?agent=${EXPERT}`);
  await expect(page.getByText('Saved scoped answer for this conversation')).toBeVisible();
  expect(state.reads.slice(-2)).toEqual([null, EXPERT]);
  await page
    .getByRole('textbox', { name: 'Ask a work question', exact: true })
    .fill('Review the approval route again');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => request.agentKey).toBe(EXPERT);
  expect(request.conversationId).toBe(ID);
  expect(request.sourceScopes).toEqual([
    'APPROVAL_TASK',
    'APPROVAL_REQUEST',
    'APPROVAL_FORM',
    'APPROVAL_OPERATION',
  ]);
});

for (const testCase of [
  { name: 'explicit assistant mismatch', keys: [EXPERT], query: `?agent=${ASSISTANT}` },
  { name: 'explicit expert mismatch', keys: [ASSISTANT], query: `?agent=${EXPERT}` },
  { name: 'mixed saved agents', keys: [ASSISTANT, EXPERT], query: '' },
  { name: 'unknown saved agent', keys: ['PRIVATE_AGENT'], query: '' },
  { name: 'invalid requested agent', keys: [ASSISTANT], query: '?agent=PRIVATE_AGENT' },
]) {
  test(`${testCase.name} remains closed without revealing a transcript or composer`, async ({
    page,
  }) => {
    await fixture(page, testCase.keys);
    await page.goto(`/dwaion/conversations/${ID}${testCase.query}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Saved scoped answer for this conversation')).toHaveCount(0);
    await expect(
      page.getByRole('textbox', { name: 'Ask a work question', exact: true })
    ).toHaveCount(0);
  });
}

test('a newly persisted assistant answer keeps its active result tools during canonical navigation', async ({
  page,
}) => {
  await fixture(page, [ASSISTANT]);
  await page.route('**/api/agent/v1/ask/stream', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({ data: { ...ASK_RUNTIME_FIXTURE, conversationId: ID, answer: 'The current answer remains available with its result tools.' } })}\n\n`,
    })
  );
  await page.goto('/dwaion/new');
  await page
    .getByRole('textbox', { name: 'Ask a work question', exact: true })
    .fill('Review my work for today');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect(page).toHaveURL(`/dwaion/conversations/${ID}`);
  await expect(page.getByTestId('dwaion-workspace-result')).toContainText(
    'The current answer remains available with its result tools.'
  );
});
