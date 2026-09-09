import { expect, test, type Page } from '@playwright/test';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';
import { ASK_RUNTIME_FIXTURE, WORKSPACE_QUEUE_FIXTURE } from './support/runtime-access';

const id = '10000000-0000-4000-8000-000000000001';
const expert = 'DWP_APPROVAL_EXPERT';
const selectedWork = {
  sourceSystem: 'APPROVAL_TASK',
  sourceReference: '20000000-0000-4000-8000-000000000001',
  expectedVersion: 3,
  obligationKey: 'review',
};

type StreamRequest = {
  requestId: string;
  conversationId?: string;
  agentKey?: string;
  pageContext?: { selectedWork?: typeof selectedWork };
};

type ResponseMutation = (
  response: Record<string, unknown>,
  request: StreamRequest
) => Record<string, unknown>;

async function fixture(
  page: Page,
  agentKey = expert,
  status = 200,
  mutateResponse?: ResponseMutation
) {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: FULL_PRODUCT_PERMISSIONS,
  });
  let requestedAgent: string | null = null;
  const sends: Record<string, unknown>[] = [];
  await page.route('**/api/platform/v1/workspace/work-items', (route) =>
    route.fulfill({ json: { data: WORKSPACE_QUEUE_FIXTURE } })
  );
  await page.route('**/api/agent/v1/actions', (route) => route.fulfill({ json: { data: [] } }));
  await page.route(`**/api/agent/v1/conversations/${id}*`, (route) => {
    requestedAgent = new URL(route.request().url()).searchParams.get('agentKey');
    return route.fulfill({
      status,
      json:
        status !== 200
          ? { success: false }
          : {
              data: {
                summary: {
                  conversationId: id,
                  title: 'Selected approval review',
                  locale: 'en',
                  messageCount: 2,
                  agentKey,
                  sourceSystems: [],
                  evidenceCount: 0,
                  summaryExcerpt: 'Only the selected source metadata was verified.',
                  lastAnswerStatus: null,
                  retentionUntil: '2026-12-06T01:00:00Z',
                  legalHold: false,
                  createdAt: '2026-09-07T01:00:00Z',
                  updatedAt: '2026-09-07T01:00:00Z',
                  lastMessageAt: '2026-09-07T01:00:00Z',
                },
                messages: [
                  {
                    messageId: 'previous-assistant',
                    role: 'ASSISTANT',
                    content: 'Only the selected source metadata was verified.',
                    citations: [],
                    createdAt: '2026-09-07T01:00:00Z',
                    agentKey,
                    selectedWork: agentKey === expert ? selectedWork : null,
                  },
                ],
              },
            },
    });
  });
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as StreamRequest;
    sends.push(request);
    const baseResponse = {
      ...ASK_RUNTIME_FIXTURE,
      requestId: request.requestId,
      conversationId: id,
      agentRegistry: { ...ASK_RUNTIME_FIXTURE.agentRegistry, entryKey: agentKey },
      selectedWork: request.pageContext?.selectedWork ?? null,
    };
    return route.fulfill({
      contentType: 'text/event-stream',
      body: `event: result\ndata: ${JSON.stringify({
        data: mutateResponse ? mutateResponse(baseResponse, request) : baseResponse,
      })}\n\n`,
    });
  });
  return { requestedAgent: () => requestedAgent, sends };
}

test('approval deep link loads and continues the same verified conversation and source', async ({
  page,
}, info) => {
  const state = await fixture(page);
  await page.goto(`/dwaion/conversations/${id}?agent=${expert}`);
  await expect(page.getByText('Only the selected source metadata was verified.')).toBeVisible();
  expect(state.requestedAgent()).toBe(expert);
  await page.screenshot({ path: info.outputPath('approval-conversation.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('textbox', { name: 'Ask a work question' })
    .fill('Which evidence is missing?');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.sends[0]).toMatchObject({
    conversationId: id,
    agentKey: expert,
    sourceScopes: ['APPROVAL_TASK'],
    pageContext: { selectedWork, surface: 'selected-work-assist' },
  });
  await expect(
    page.getByTestId('dwaion-workspace-answer').getByText(ASK_RUNTIME_FIXTURE.answer)
  ).toBeVisible();
  expect(page.url()).not.toContain('evidence');
});

const responseMismatches: Array<[string, ResponseMutation]> = [
  ['request', (response) => ({ ...response, requestId: 'forged-request' })],
  [
    'agent',
    (response) => ({
      ...response,
      agentRegistry: { ...ASK_RUNTIME_FIXTURE.agentRegistry, entryKey: 'DWP_ASSISTANT' },
    }),
  ],
  [
    'source system',
    (response) => ({
      ...response,
      selectedWork: { ...selectedWork, sourceSystem: 'APPROVAL_REQUEST' },
    }),
  ],
  [
    'source reference',
    (response) => ({
      ...response,
      selectedWork: {
        ...selectedWork,
        sourceReference: '30000000-0000-4000-8000-000000000003',
      },
    }),
  ],
  [
    'source version',
    (response) => ({
      ...response,
      selectedWork: { ...selectedWork, expectedVersion: 4 },
    }),
  ],
  [
    'source obligation',
    (response) => ({
      ...response,
      selectedWork: { ...selectedWork, obligationKey: 'approve' },
    }),
  ],
  [
    'conversation session',
    (response) => ({
      ...response,
      conversationId: '30000000-0000-4000-8000-000000000003',
    }),
  ],
];

for (const [mismatch, mutateResponse] of responseMismatches) {
  test(`selected-work follow-up rejects a mismatched ${mismatch} response`, async ({ page }) => {
    const state = await fixture(page, expert, 200, mutateResponse);
    await page.goto(`/dwaion/conversations/${id}?agent=${expert}`);
    await expect(page.getByText('Only the selected source metadata was verified.')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Ask a work question' })
      .fill('Which evidence is missing?');
    await page.getByRole('button', { name: 'Send question', exact: true }).click();

    await expect.poll(() => state.sends.length).toBe(1);
    await expect(page.getByTestId('dwaion-workspace-result').getByRole('alert')).toContainText(
      'DWAI·ON could not evaluate this request'
    );
    await expect(page.getByText(ASK_RUNTIME_FIXTURE.answer)).toHaveCount(0);
    await expect(page).toHaveURL(`/dwaion/conversations/${id}?agent=${expert}`);
  });
}

test('ordinary assistant keeps its canonical conversation route and follow-up', async ({
  page,
}) => {
  const state = await fixture(page, 'DWP_ASSISTANT');
  await page.goto(`/dwaion/conversations/${id}`);
  await expect(page.getByText('Only the selected source metadata was verified.')).toBeVisible();
  expect(state.requestedAgent()).toBe('DWP_ASSISTANT');
  await page.getByRole('textbox', { name: 'Ask a work question' }).fill('Continue the review');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.sends[0]).toMatchObject({ conversationId: id, agentKey: 'DWP_ASSISTANT' });
  await expect(page).toHaveURL(new RegExp(`/dwaion/conversations/${id}$`));
});

for (const failure of ['forbidden', 'missing', 'agent-mismatch'] as const) {
  test(`conversation ${failure} hides transcript and prevents follow-up`, async ({ page }) => {
    const state = await fixture(
      page,
      failure === 'agent-mismatch' ? 'DWP_ASSISTANT' : expert,
      failure === 'forbidden' ? 403 : failure === 'missing' ? 404 : 200
    );
    await page.goto(`/dwaion/conversations/${id}?agent=${expert}`);
    await expect(page.getByTestId('dwaion-studio').getByRole('alert')).toContainText(
      'could not be verified'
    );
    await expect(page.getByText('Only the selected source metadata was verified.')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Ask a work question' })).toHaveCount(0);
    expect(state.sends).toEqual([]);
  });
}
