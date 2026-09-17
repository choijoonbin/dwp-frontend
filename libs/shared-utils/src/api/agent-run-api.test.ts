import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDwaionUserRun, getDwaionUserRunPage, getDwaionUserRuns } from './agent-run-api';

const run = {
  runId: 'aaaaaaaa-0000-4000-8000-000000000101',
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

const observableRun = {
  ...run,
  activityTitle: 'Policy-grounded answer execution',
  attempt: 2,
  lease: { status: 'RELEASED', expiresAt: null },
  currentStage: 'COMPLETED',
  progressPercent: 100,
  measurementStatus: 'MEASURED',
  stages: [
    {
      key: 'AUTHORIZING',
      state: 'COMPLETED',
      sequence: 10,
      startedAt: '2026-08-27T01:00:00Z',
      completedAt: '2026-08-27T01:00:00.040Z',
      durationMs: 40,
    },
    {
      key: 'COMPLETED',
      state: 'COMPLETED',
      sequence: 60,
      startedAt: '2026-08-27T01:00:00.240Z',
      completedAt: '2026-08-27T01:00:00.240Z',
      durationMs: 0,
    },
  ],
  auditEvidence: {
    auditId: 'agent-audit:tenant-1:run-101',
    auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000202',
    status: 'LINKED',
  },
  sourceHealth: [
    {
      sourceType: 'WORK_ITEM',
      status: 'SUCCESS',
      latencyMs: 65,
      lastAttemptAt: '2026-08-27T01:00:00.100Z',
      lastSuccessAt: '2026-08-27T01:00:00.100Z',
    },
  ],
};

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

  it('requests a bounded time page and validates its continuation cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        success: true,
        data: [run],
        snapshotAt: '2026-09-01T00:00:00Z',
        nextCursor: 'signed-cursor',
        hasMore: true,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getDwaionUserRunPage({
        limit: 50,
        from: '2026-08-02T00:00:00Z',
        to: '2026-09-01T00:00:00Z',
        cursor: 'current-cursor',
      })
    ).resolves.toEqual({
      runs: [run],
      snapshotAt: '2026-09-01T00:00:00Z',
      nextCursor: 'signed-cursor',
      hasMore: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/runs?limit=50&from=2026-08-02T00%3A00%3A00Z&to=2026-09-01T00%3A00%3A00Z&cursor=current-cursor',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it.each([
    { nextCursor: null, hasMore: true },
    { nextCursor: 'unexpected', hasMore: false },
    { nextCursor: null, hasMore: 'yes' },
    { nextCursor: null, hasMore: false, snapshotAt: 'not-a-date' },
  ])('fails closed for malformed activity page metadata %#', async (metadata) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [run], ...metadata }))
    );

    await expect(getDwaionUserRunPage()).rejects.toMatchObject({ status: 502 });
  });

  it('rejects unscoped time values and invalid cursors before dispatch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionUserRunPage({ from: '2026-08-01T00:00:00' })).rejects.toBeInstanceOf(
      TypeError
    );
    await expect(getDwaionUserRunPage({ cursor: '' })).rejects.toBeInstanceOf(TypeError);
    await expect(
      getDwaionUserRunPage({
        from: '2026-09-01T00:00:00Z',
        to: '2026-08-01T00:00:00Z',
      })
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts measured run evidence without deriving or inventing telemetry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [observableRun] }))
    );

    await expect(getDwaionUserRuns()).resolves.toEqual([observableRun]);
  });

  it('accepts the canonical 160-character title and opaque bounded audit ID', async () => {
    const boundaryRun = {
      ...observableRun,
      activityTitle: 'a'.repeat(160),
      auditEvidence: { ...observableRun.auditEvidence, auditId: 'opaque-audit-id' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [boundaryRun] }))
    );

    await expect(getDwaionUserRuns()).resolves.toEqual([boundaryRun]);
  });

  it.each([
    { progressPercent: 101 },
    { activityTitle: 'a'.repeat(161) },
    { statusCode: 's'.repeat(129) },
    { stages: [{ ...observableRun.stages[0], sequence: 9 }] },
    { stages: [{ ...observableRun.stages[0], sequence: 20 }] },
    { stages: [{ ...observableRun.stages[0], durationMs: -1 }] },
    { stages: [{ ...observableRun.stages[0], state: 'ACTIVE' }] },
    {
      stages: [
        {
          ...observableRun.stages[0],
          completedAt: '2026-08-26T01:00:00Z',
        },
      ],
    },
    { lease: { status: 'ACTIVE', expiresAt: 'not-a-date' } },
    { auditEvidence: { ...observableRun.auditEvidence, status: 'VERIFIED' } },
    { auditEvidence: { ...observableRun.auditEvidence, auditId: 'a'.repeat(129) } },
    { auditEvidence: { ...observableRun.auditEvidence, auditId: null } },
    {
      auditEvidence: {
        auditId: 'orphan-audit-id',
        auditRecordId: null,
        status: 'NOT_AVAILABLE',
      },
    },
    { sourceHealth: [{ ...observableRun.sourceHealth[0], sourceType: 'UNMODELED_SOURCE' }] },
    { sourceHealth: [{ ...observableRun.sourceHealth[0], latencyMs: -1 }] },
    {
      sourceHealth: [
        {
          ...observableRun.sourceHealth[0],
          lastSuccessAt: '2026-08-27T01:00:00.165Z',
        },
      ],
    },
    {
      sourceHealth: [{ ...observableRun.sourceHealth[0], status: 'UNAVAILABLE' }],
    },
    { prompt: 'must never enter the Activity cache' },
  ])('fails closed for malformed measured evidence %#', async (override) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(response({ success: true, data: [{ ...observableRun, ...override }] }))
    );

    await expect(getDwaionUserRuns()).rejects.toMatchObject({ status: 502 });
  });

  it('resolves an exact run outside the recent response window', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: run }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionUserRun(run.runId.toUpperCase())).resolves.toEqual(run);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/agent/v1/runs/${run.runId}`,
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('accepts canonical PostgreSQL UUID text without assuming RFC version or variant bits', async () => {
    const postgresRun = {
      ...run,
      runId: 'aaaaaaaa-0000-0000-0000-000000000101',
      conversationId: 'aaaaaaaa-0000-f000-0000-000000000102',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: [postgresRun] }))
      .mockResolvedValueOnce(response({ success: true, data: postgresRun }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionUserRuns()).resolves.toEqual([postgresRun]);
    await expect(getDwaionUserRun(postgresRun.runId.toUpperCase())).resolves.toEqual(postgresRun);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/agent/v1/runs/${postgresRun.runId}`);
  });

  it('rejects invalid IDs and mismatched run detail without substituting a response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response({ success: true, data: { ...run, runId: 'aaaaaaaa-0000-4000-8000-000000000102' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionUserRun('not-a-run-id')).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(getDwaionUserRun(run.runId)).rejects.toMatchObject({ status: 502 });
  });
});
