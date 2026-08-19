import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { askDwp, askDwpStream } from './agent-runtime-api';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function eventStreamResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(encoder.encode(`${frame}\n\n`)));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

function groundedResponse() {
  return {
    runId: '5a83e898-507a-42bb-a671-a416eb4c47d2',
    auditId: '2e9c311e-f381-4929-a810-a6a38a906067',
    requestId: 'request-ask-1',
    correlationId: 'correlation-ask-1',
    state: 'COMPLETED',
    answer: 'A software access approval is blocking a new team member.',
    confidence: 'HIGH',
    citations: [
      {
        sourceId: 'src-01',
        sourceType: 'WORK_ITEM',
        title: 'Approve software access request',
        sourceSystem: 'IT Service',
        route: '/work?item=WK-1042',
        occurredAt: '2026-08-12T01:00:00Z',
        excerpt: 'Priority high. The request blocks a new team member.',
      },
    ],
    sourceCount: 3,
    policy: {
      outcome: 'ALLOW',
      riskTier: 'L1',
      code: 'READ_ONLY_GROUNDED_ANSWER',
      explanation: 'Read-only grounded answer.',
      modelAllowed: true,
      mutationAllowed: false,
    },
    modelRoute: {
      state: 'COMPLETED',
      provider: 'OPENAI',
      model: 'gpt-test-2026-08-01',
      inputTokens: 120,
      outputTokens: 28,
      totalTokens: 148,
      latencyMs: 240,
    },
    agentRegistry: {
      entryKey: 'DWP_ASSISTANT',
      revision: 1,
      artifactVersion: 'ask-runtime-v1',
      riskTier: 'MEDIUM',
      resolution: 'ACTIVE',
    },
    statusCode: 'ANSWER_GROUNDED',
    completedAt: '2026-08-12T01:00:01Z',
    conversationId: 'd152ce1c-49ad-43b1-a5ca-dbc7e5117658',
    userMessageId: '124899e9-c51e-4889-8336-230b92cf5e7c',
    assistantMessageId: '1466a92f-2a5b-4a5c-a941-eb36a0985e23',
  };
}

describe('Ask runtime API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses the governed Ask endpoint and accepts a grounded response', async () => {
    const response = groundedResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'SUCCESS', message: 'OK', data: response })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await askDwp({
      requestId: 'request-ask-1',
      query: 'What is blocking my work?',
      locale: 'en',
    });

    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ask',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          requestId: 'request-ask-1',
          query: 'What is blocking my work?',
          locale: 'en',
          agentKey: 'DWP_ASSISTANT',
        }),
      })
    );
  });

  it.each([
    ['answer has no citation', { citations: [] }],
    ['completed route did not invoke a model', { modelRoute: { state: 'NOT_INVOKED' } }],
    ['mutation is allowed', { policy: { mutationAllowed: true } }],
    ['citation exceeds source count', { sourceCount: 0 }],
    ['active registry has no revision', { agentRegistry: { revision: 0 } }],
    ['completed answer has no confidence', { confidence: null }],
    ['completed answer follows a handoff', { policy: { outcome: 'HANDOFF', modelAllowed: false } }],
  ])('fails closed when %s', async (_label, patch) => {
    const safe = groundedResponse();
    const unsafePatch = patch as Record<string, Record<string, unknown> | unknown>;
    const unsafe = {
      ...safe,
      ...patch,
      policy: { ...safe.policy, ...((unsafePatch.policy as Record<string, unknown>) ?? {}) },
      modelRoute: {
        ...safe.modelRoute,
        ...((unsafePatch.modelRoute as Record<string, unknown>) ?? {}),
      },
      agentRegistry: {
        ...safe.agentRegistry,
        ...((unsafePatch.agentRegistry as Record<string, unknown>) ?? {}),
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESS', message: 'OK', data: unsafe }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      askDwp({ requestId: 'request-ask-1', query: 'Question', locale: 'en' })
    ).rejects.toMatchObject({ status: 502 });
  });

  it('accepts an honest configuration-required result without an answer', async () => {
    const configured = groundedResponse();
    const response = {
      ...configured,
      state: 'CONFIGURATION_REQUIRED',
      answer: null,
      confidence: null,
      citations: [],
      statusCode: 'MODEL_ROUTE_CONFIGURATION_REQUIRED',
      modelRoute: {
        ...configured.modelRoute,
        state: 'CONFIGURATION_REQUIRED',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { status: 'SUCCESS', message: 'OK', data: response })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      askDwp({ requestId: 'request-ask-1', query: 'Question', locale: 'en' })
    ).resolves.toMatchObject({ state: 'CONFIGURATION_REQUIRED', answer: null });
  });

  it('streams governed progress before returning the validated result', async () => {
    const response = groundedResponse();
    const progress: string[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(
        eventStreamResponse([
          'event: progress\ndata: {"stage":"AUTHORIZING"}',
          'event: progress\ndata: {"stage":"RETRIEVING"}',
          `event: result\ndata: ${JSON.stringify({ data: response })}`,
        ])
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      askDwpStream(
        {
          requestId: 'request-ask-1',
          query: 'What is blocking my work?',
          locale: 'en',
          sourceScopes: ['WORK_ITEM'],
          pageContext: { route: '/work', appKey: 'APP.WORK' },
        },
        { onProgress: (stage) => progress.push(stage) }
      )
    ).resolves.toEqual(response);

    expect(progress).toEqual(['AUTHORIZING', 'RETRIEVING']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ask/stream',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.stringContaining('"sourceScopes":["WORK_ITEM"]'),
      })
    );
  });
});
