import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  commandDwaionRoutineRun,
  getDwaionRoutineRuns,
  triggerDwaionRoutineRun,
} from './agent-routine-execution-api';
import { parseDwaionRoutineRun } from './agent-routine-execution-parser';

const ROUTINE_ID = '00000000-0000-4000-8000-000000000241';
const RUN_ID = '00000000-0000-4000-8000-000000000242';
const COMMAND_ID = '00000000-0000-4000-8000-000000000243';
const RECEIPT_ID = '00000000-0000-4000-8000-000000000244';
const RUN_COMMAND_ID = '00000000-0000-4000-8000-000000000245';

const queuedRun = {
  routineRunId: RUN_ID,
  routineId: ROUTINE_ID,
  routineRevision: 7,
  trigger: 'MANUAL',
  state: 'QUEUED',
  version: 1,
  attemptCount: 0,
  maximumAttempts: 3,
  scheduledFor: '2026-09-17T01:00:00Z',
  nextAttemptAt: null,
  startedAt: null,
  completedAt: null,
  evidenceCount: 0,
  proposalsCreated: 0,
  approvalGatedActionsCreated: 0,
  tokensUsed: 0,
  elapsedMs: 0,
  notificationState: 'NOT_REQUIRED',
  safeErrorCode: null,
  recoveryHint: null,
  compensationRequired: false,
  receipt: null,
  createdAt: '2026-09-17T01:00:00Z',
  updatedAt: '2026-09-17T01:00:00Z',
} as const;

const completedRun = {
  ...queuedRun,
  state: 'COMPLETED',
  version: 4,
  attemptCount: 1,
  startedAt: '2026-09-17T01:00:01Z',
  completedAt: '2026-09-17T01:00:08Z',
  evidenceCount: 3,
  proposalsCreated: 1,
  approvalGatedActionsCreated: 1,
  tokensUsed: 810,
  elapsedMs: 7_000,
  notificationState: 'DELIVERED',
  receipt: {
    receiptId: RECEIPT_ID,
    routineRunId: RUN_ID,
    routineId: ROUTINE_ID,
    routineRevision: 7,
    terminalState: 'COMPLETED',
    providerReceiptId: 'provider-receipt-100',
    resultSha256: 'a'.repeat(64),
    evidenceCount: 3,
    proposalsCreated: 1,
    approvalGatedActionsCreated: 1,
    externalWritesPerformed: 0,
    notificationState: 'DELIVERED',
    authorizationDecisionRevision: 14,
    authorizedSources: ['WORK_ITEM'],
    completedAt: '2026-09-17T01:00:08Z',
  },
  updatedAt: '2026-09-17T01:00:08Z',
} as const;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON routine execution API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('accepts a completed run only with a bound zero-write authorization receipt', () => {
    expect(parseDwaionRoutineRun(completedRun).receipt).toMatchObject({
      authorizationDecisionRevision: 14,
      authorizedSources: ['WORK_ITEM'],
      externalWritesPerformed: 0,
    });
    expect(() =>
      parseDwaionRoutineRun({
        ...completedRun,
        receipt: { ...completedRun.receipt, externalWritesPerformed: 1 },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionRoutineRun({
        ...completedRun,
        receipt: { ...completedRun.receipt, authorizedSources: ['UNVERIFIED_SOURCE'] },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('allows queued timestamps to remain null and rejects fabricated successful state', () => {
    expect(parseDwaionRoutineRun(queuedRun).startedAt).toBeNull();
    expect(() => parseDwaionRoutineRun({ ...completedRun, receipt: null })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
  });

  it('parses every run in a list and fails closed on a malformed item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [queuedRun, completedRun] }))
    );
    await expect(getDwaionRoutineRuns(ROUTINE_ID)).resolves.toHaveLength(2);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [queuedRun, { state: 'DONE' }] }))
    );
    await expect(getDwaionRoutineRuns(ROUTINE_ID)).rejects.toMatchObject({ status: 502 });
  });

  it('keeps caller-owned command identity for timeout-safe trigger and recovery retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: queuedRun }, 202))
      .mockResolvedValueOnce(response({ success: true, data: queuedRun }, 202))
      .mockResolvedValueOnce(response({ success: true, data: { ...queuedRun, version: 2 } }));
    vi.stubGlobal('fetch', fetchMock);

    const reason = {
      commandId: COMMAND_ID,
      expectedRevision: 7,
      reasonCode: 'USER_CONFIRMED_MANUAL_RUN',
      changeReason: 'The user reviewed the execution budget.',
    };
    await triggerDwaionRoutineRun(ROUTINE_ID, reason);
    await triggerDwaionRoutineRun(ROUTINE_ID, reason);
    await commandDwaionRoutineRun(ROUTINE_ID, RUN_ID, {
      ...reason,
      commandId: RUN_COMMAND_ID,
      expectedRevision: 1,
      action: 'CANCEL',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/routines/${ROUTINE_ID}/runs`,
      expect.objectContaining({ body: expect.stringContaining(`"commandId":"${COMMAND_ID}"`) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/routines/${ROUTINE_ID}/runs`,
      expect.objectContaining({ body: expect.stringContaining(`"commandId":"${COMMAND_ID}"`) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/api/agent/v1/routines/${ROUTINE_ID}/runs/${RUN_ID}/commands`,
      expect.objectContaining({
        body: expect.stringContaining(`"commandId":"${RUN_COMMAND_ID}"`),
      })
    );
  });
});
