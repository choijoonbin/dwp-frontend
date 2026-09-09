import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  DWAION_PERSONAL_PERMISSIONS,
  mockDwaionPersonalIntelligence,
} from './support/dwaion-personal-intelligence-fixtures';
import { ASK_RUNTIME_FIXTURE, mockWorkspaceRuntime } from './support/runtime-access';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './support/shell-session';

const CONVERSATION_ID = '60000000-0000-4000-8000-000000000101';
const USER_MESSAGE_ID = '60000000-0000-4000-8000-000000000102';
const ASSISTANT_MESSAGE_ID = '60000000-0000-4000-8000-000000000103';
const ARTIFACT_ID = '60000000-0000-4000-8000-000000000104';
const QUESTION = 'Summarize the verified rollout plan';

type ArtifactCreateBody = {
  artifactType: string;
  content: { title: string; body: string; format: string };
  sources?: unknown[];
  sourceConversation?: { conversationId: string; assistantMessageId: string };
};

async function fixture(page: Page, artifactAccess: 'full' | 'view-only' | 'create-only' = 'full') {
  await page.clock.setFixedTime(new Date('2026-09-08T09:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: 'en',
    permissions: [
      ...FULL_PRODUCT_PERMISSIONS,
      ...(artifactAccess === 'full'
        ? DWAION_PERSONAL_PERMISSIONS
        : [
            {
              resourceType: 'APP',
              resourceKey: 'APP.DWAION_ARTIFACTS',
              permissionCode: artifactAccess === 'view-only' ? 'VIEW' : 'CREATE',
              effect: 'ALLOW' as const,
            },
          ]),
    ],
  });
  await mockWorkspaceRuntime(page);
  await mockDwaionPersonalIntelligence(page);

  let artifactCreateBody: ArtifactCreateBody | null = null;
  let createdArtifact: ReturnType<typeof artifactFrom> | null = null;

  await page.route('**/api/agent/v1/actions', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );
  await page.route(`**/api/agent/v1/conversations/${CONVERSATION_ID}*`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          summary: {
            conversationId: CONVERSATION_ID,
            title: QUESTION,
            locale: 'en',
            messageCount: 2,
            agentKey: 'DWP_ASSISTANT',
            sourceSystems: ['Microsoft 365'],
            evidenceCount: ASK_RUNTIME_FIXTURE.citations.length,
            summaryExcerpt: ASK_RUNTIME_FIXTURE.answer,
            lastAnswerStatus: ASK_RUNTIME_FIXTURE.statusCode,
            retentionUntil: '2026-12-07T09:00:01Z',
            legalHold: false,
            createdAt: '2026-09-08T09:00:00Z',
            updatedAt: '2026-09-08T09:00:01Z',
            lastMessageAt: '2026-09-08T09:00:01Z',
          },
          messages: [
            {
              messageId: USER_MESSAGE_ID,
              role: 'USER',
              content: QUESTION,
              citations: [],
              runId: ASK_RUNTIME_FIXTURE.runId,
              statusCode: null,
              createdAt: '2026-09-08T09:00:00Z',
            },
            {
              messageId: ASSISTANT_MESSAGE_ID,
              role: 'ASSISTANT',
              content: ASK_RUNTIME_FIXTURE.answer,
              citations: ASK_RUNTIME_FIXTURE.citations,
              runId: ASK_RUNTIME_FIXTURE.runId,
              statusCode: ASK_RUNTIME_FIXTURE.statusCode,
              createdAt: '2026-09-08T09:00:01Z',
            },
          ],
        },
      },
    })
  );
  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId: string };
    const response = {
      ...ASK_RUNTIME_FIXTURE,
      requestId: request.requestId,
      conversationId: CONVERSATION_ID,
      userMessageId: USER_MESSAGE_ID,
      assistantMessageId: ASSISTANT_MESSAGE_ID,
    };
    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
    });
  });
  await page.route('**/api/agent/v1/artifacts**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === '/api/agent/v1/artifacts') {
      artifactCreateBody = request.postDataJSON() as ArtifactCreateBody;
      createdArtifact = artifactFrom(artifactCreateBody);
      return success(route, createdArtifact, 201);
    }
    if (!createdArtifact) return route.fallback();
    if (request.method() === 'GET' && path === '/api/agent/v1/artifacts') {
      return success(route, [createdArtifact]);
    }
    if (request.method() === 'GET' && path === `/api/agent/v1/artifacts/${ARTIFACT_ID}`) {
      return success(route, createdArtifact);
    }
    if (request.method() === 'GET' && path.endsWith('/versions')) {
      return success(route, []);
    }
    if (request.method() === 'GET' && path.endsWith('/preflights/current')) {
      return route.fulfill({ status: 404, json: { detail: 'No current preflight.' } });
    }
    return route.fallback();
  });

  return { artifactCreateBody: () => artifactCreateBody };
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test(`a grounded answer opens its server-bound artifact on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const state = await fixture(page);
    await page.goto('/dwaion/new');
    await page.getByRole('textbox', { name: 'Ask a work question' }).fill(QUESTION);
    await page.getByRole('button', { name: 'Send question', exact: true }).click();

    const save = page.getByRole('button', { name: 'Save as artifact', exact: true });
    await expect(save).toBeVisible();
    await save.click();

    await expect(page).toHaveURL(`/dwaion/artifacts?artifact=${ARTIFACT_ID}`);
    await expect(page.getByRole('heading', { name: 'Artifact studio' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(QUESTION);
    expect(state.artifactCreateBody()).toEqual(
      expect.objectContaining({
        artifactType: 'DOCUMENT',
        content: {
          title: QUESTION,
          body: ASK_RUNTIME_FIXTURE.answer,
          format: 'MARKDOWN',
        },
        sourceConversation: {
          conversationId: CONVERSATION_ID,
          assistantMessageId: ASSISTANT_MESSAGE_ID,
        },
      })
    );
    expect(state.artifactCreateBody()).not.toHaveProperty('sources');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    const violations = (await new AxeBuilder({ page }).include('#dwp-main-content').analyze())
      .violations;
    expect(
      violations.filter((entry) => ['critical', 'serious'].includes(entry.impact ?? ''))
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`answer-artifact-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

for (const artifactAccess of ['view-only', 'create-only'] as const) {
  test(`the artifact action requires both permissions with ${artifactAccess} access`, async ({
    page,
  }) => {
    await fixture(page, artifactAccess);
    await page.goto('/dwaion/new');
    await page.getByRole('textbox', { name: 'Ask a work question' }).fill(QUESTION);
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
    await expect(page.getByTestId('dwaion-workspace-answer')).toContainText(
      ASK_RUNTIME_FIXTURE.answer
    );
    await expect(page.getByRole('button', { name: 'Save as artifact' })).toHaveCount(0);
  });
}

test('an unavailable explicit artifact selection never opens another artifact', async ({
  page,
}) => {
  await fixture(page);
  const unavailableId = '60000000-0000-4000-8000-000000000199';
  await page.goto(`/dwaion/artifacts?artifact=${unavailableId}`);

  await expect(page.getByText('The requested artifact is unavailable')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveCount(0);
  await expect(page).toHaveURL(`/dwaion/artifacts?artifact=${unavailableId}`);
});

function artifactFrom(body: ArtifactCreateBody) {
  return {
    artifactId: ARTIFACT_ID,
    artifactType: body.artifactType,
    state: 'DRAFT',
    revision: 1,
    draftRevision: 1,
    currentVersionNumber: 0,
    publishedVersionNumber: null,
    content: body.content,
    sources: ASK_RUNTIME_FIXTURE.citations.map((citation) => ({
      sourceType: citation.sourceType,
      reference: `conversation:${CONVERSATION_ID}:message:${ASSISTANT_MESSAGE_ID}:citation:${citation.sourceId}`,
    })),
    capabilities: {
      immutableVersionsAvailable: true,
      versionRestoreAvailable: false,
      collaborativeEditingAvailable: false,
      deterministicPreflightAvailable: true,
      enterpriseDlpConnectorAvailable: false,
      sourceVerificationAvailable: false,
      sourceFreshnessAvailable: false,
      personalPublishStateAvailable: true,
      recipientSharingAvailable: false,
      externalSharingAvailable: false,
      exportRequestAvailable: true,
      exportExecutionAvailable: false,
    },
    createdAt: '2026-09-08T09:00:02Z',
    updatedAt: '2026-09-08T09:00:02Z',
  };
}

function success(route: Route, data: unknown, status = 200) {
  return route.fulfill({ status, json: { success: true, status: 'SUCCESS', data } });
}
