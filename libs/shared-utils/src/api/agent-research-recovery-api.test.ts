import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  parseDwaionResearchRecoveryReceipt,
  recoverDwaionResearchRun,
} from './agent-research-recovery-api';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';
const COMMAND_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';

const receipt = {
  receiptId: '66666666-6666-4666-8666-666666666666',
  commandId: COMMAND_ID,
  action: 'SAVE_AS_FORK',
  state: 'COMPLETED',
  runId: RUN_ID,
  sourcePlanId: PLAN_ID,
  sourcePlanRevision: 4,
  targetPlanId: TARGET_ID,
  targetPlanRevision: 1,
  cachedRunId: null,
  resultSha256: null,
  sensitivity: null,
  integrityFingerprint: 'a'.repeat(64),
  completedAt: '2026-09-17T03:00:00Z',
} as const;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON research recovery API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps caller-owned command and idempotency identity for a governed fork', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: receipt }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      recoverDwaionResearchRun(RUN_ID, 3, 'SAVE_AS_FORK', {
        commandId: COMMAND_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    ).resolves.toMatchObject({ targetPlanId: TARGET_ID, targetPlanRevision: 1 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/research/runs/${RUN_ID}/recovery-actions`,
      expect.objectContaining({ body: expect.stringContaining(IDEMPOTENCY_KEY) })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      commandId: COMMAND_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      expectedVersion: 3,
      action: 'SAVE_AS_FORK',
      localDefinition: null,
    });
  });

  it('requires local definitions exactly for merge branches and rejects inconsistent receipts', async () => {
    await expect(
      recoverDwaionResearchRun(RUN_ID, 3, 'PULL_AND_MERGE', {
        commandId: COMMAND_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    ).rejects.toThrow('Research recovery local definition binding is invalid.');
    expect(() =>
      parseDwaionResearchRecoveryReceipt({ ...receipt, targetPlanRevision: null })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionResearchRecoveryReceipt({
        ...receipt,
        action: 'RECALCULATE_SENSITIVITY',
        sensitivity: { classification: 'RESTRICTED', score: 101, matchedIndicators: [] },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });
});
