import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDwaionUserRuns } from './agent-run-api';

function response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('Agent run API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads only privacy-minimized activity and bounds the result size', async () => {
    const run = {
      runId: '00000000-0000-4000-8000-000000000101',
      agentKey: 'DWP_ASSISTANT',
      agentRevision: 2,
      runState: 'COMPLETED',
      answerState: 'COMPLETED',
      riskTier: 'L0',
      policyOutcome: 'ALLOW',
      statusCode: 'ANSWER_GROUNDED',
      sourceCount: 3,
      latencyMs: 240,
      conversationId: null,
      createdAt: '2026-08-27T01:00:00Z',
      completedAt: '2026-08-27T01:00:01Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: [run] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionUserRuns('COMPLETED', 500)).resolves.toEqual([run]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/runs?limit=100&state=COMPLETED',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('fails closed for malformed activity responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, data: [{}] })));
    await expect(getDwaionUserRuns()).rejects.toMatchObject({ status: 502 });
  });
});
