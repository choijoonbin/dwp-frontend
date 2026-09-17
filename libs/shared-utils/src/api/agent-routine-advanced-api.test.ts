import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionRoutineAdvancedCommand,
  decideDwaionRoutineAdvancedCommand,
  getDwaionRoutineAdvancedCommands,
  getDwaionRoutinePendingApprovals,
  parseDwaionRoutineAdvancedCommand,
} from './agent-routine-advanced-api';

import type { DwaionRoutineAdvancedCommand } from './agent-routine-advanced-api';
import type { DwaionRoutineDefinition } from './agent-routine-api';

const ROUTINE_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_ID = '33333333-3333-4333-8333-333333333333';
const PROPOSED_DEFINITION: DwaionRoutineDefinition = {
  name: 'Reviewed morning priorities',
  objective: 'Review authorized work signals before creating a proposal.',
  triggerType: 'SCHEDULED',
  cadence: 'WEEKDAYS',
  localTime: '09:00',
  timeZone: 'Asia/Seoul',
  webhookEventType: null,
  webhookEndpointReference: null,
  locale: 'ko-KR',
  sources: ['WORK_ITEM'],
  weekDays: [],
  activeFrom: null,
  activeUntil: null,
  quietHoursStart: null,
  quietHoursEnd: null,
  budget: { maximumRunsPerMonth: 31, maximumTokensPerRun: 32_000, maximumMinutesPerRun: 15 },
  retryPolicy: { maximumAttempts: 3, initialBackoffSeconds: 30, backoffMultiplier: 2 },
  notificationPolicy: { notifyOnPartial: true, notifyOnFailure: true, notifyOnRecovery: true },
  compensationPolicy: { enabled: true, strategy: 'REVOKE_PENDING_HANDOFFS' },
};

function command(state: 'AWAITING_APPROVAL' | 'SUCCEEDED' = 'SUCCEEDED') {
  return {
    commandId: COMMAND_ID,
    routineId: ROUTINE_ID,
    ownerUserId: 'owner@company.com',
    kind: 'WORM_EVIDENCE_DELIVERY',
    state,
    expectedRevision: 7,
    version: state === 'SUCCEEDED' ? 2 : 1,
    makerUserId: 'owner@company.com',
    checkerUserId: state === 'SUCCEEDED' ? 'checker@company.com' : null,
    canApprove: state === 'AWAITING_APPROVAL',
    proposedDefinition: null,
    problem: null,
    receipt:
      state === 'SUCCEEDED'
        ? {
            receiptId: RECEIPT_ID,
            commandId: COMMAND_ID,
            routineId: ROUTINE_ID,
            kind: 'WORM_EVIDENCE_DELIVERY',
            state: 'SUCCEEDED',
            providerReceiptId: 'worm-provider-receipt-7',
            resultSha256: 'a'.repeat(64),
            providerOutcome: {
              routineId: ROUTINE_ID,
              expectedRevision: 7,
              kind: 'WORM_EVIDENCE_DELIVERY',
              outcome: 'APPLIED',
              appliedPayload: {
                kind: 'WORM_EVIDENCE_DELIVERY',
                evidenceScope: 'FULL_AUDIT',
                retentionDays: 365,
                legalHold: true,
              },
              evidenceRef: 'worm-evidence:archive-7',
            },
            appliedRevision: null,
            completedAt: '2026-09-17T03:00:00Z',
          }
        : null,
    createdAt: '2026-09-17T02:59:00Z',
    updatedAt: '2026-09-17T03:00:00Z',
  } as const;
}

function approval(
  state: 'AWAITING_APPROVAL' | 'SUCCEEDED' | 'FAILED' | 'REJECTED' = 'AWAITING_APPROVAL'
): DwaionRoutineAdvancedCommand {
  const base = command(state === 'SUCCEEDED' ? 'SUCCEEDED' : 'AWAITING_APPROVAL');
  return {
    ...base,
    kind: 'CHANGE_APPROVAL',
    state,
    version: state === 'AWAITING_APPROVAL' ? 1 : 2,
    checkerUserId: state === 'AWAITING_APPROVAL' ? null : 'checker@company.com',
    canApprove: state === 'AWAITING_APPROVAL',
    proposedDefinition: PROPOSED_DEFINITION,
    receipt:
      state === 'SUCCEEDED' && base.receipt
        ? {
            ...base.receipt,
            kind: 'CHANGE_APPROVAL',
            state: 'SUCCEEDED',
            providerOutcome: {
              routineId: ROUTINE_ID,
              expectedRevision: 7,
              kind: 'CHANGE_APPROVAL',
              outcome: 'APPLIED',
              appliedPayload: { kind: 'CHANGE_APPROVAL', definition: PROPOSED_DEFINITION },
              evidenceRef: 'checker-decision:33333333-3333-4333-8333-333333333333',
            },
          }
        : null,
  };
}

function engineCommand() {
  const base = command();
  return {
    ...base,
    kind: 'AGENT_ENGINE_SWITCH',
    receipt: base.receipt
      ? {
          ...base.receipt,
          kind: 'AGENT_ENGINE_SWITCH',
          providerOutcome: {
            routineId: ROUTINE_ID,
            expectedRevision: 7,
            kind: 'AGENT_ENGINE_SWITCH',
            outcome: 'APPLIED',
            appliedPayload: {
              kind: 'AGENT_ENGINE_SWITCH',
              action: 'APPLY',
              agentId: 'dwaion-personal-routine-agent',
              engineId: 'dwp-agent-kernel-v2',
              expiresAt: '2026-10-01T00:00:00Z',
            },
            evidenceRef: 'engine-policy:version-12',
          },
        }
      : null,
  } as const;
}

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON advanced routine command API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends a reviewed WORM delivery command and binds the terminal provider receipt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: command() }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'WORM_EVIDENCE_DELIVERY',
        evidenceScope: 'FULL_AUDIT',
        retentionDays: 365,
        legalHold: true,
      })
    ).resolves.toMatchObject({
      commandId: COMMAND_ID,
      state: 'SUCCEEDED',
      receipt: { providerReceiptId: 'worm-provider-receipt-7' },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/routines/${ROUTINE_ID}/advanced-commands`,
      expect.objectContaining({ body: expect.stringContaining('"kind":"WORM_EVIDENCE_DELIVERY"') })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body).toMatchObject({
      commandId: COMMAND_ID,
      expectedRevision: 7,
      reasonCode: 'USER_WORM_EVIDENCE_DELIVERY',
      payload: { evidenceScope: 'FULL_AUDIT', retentionDays: 365, legalHold: true },
    });
  });

  it('parses list items fail closed and rejects expired budget or unbound rollback input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [command('AWAITING_APPROVAL')] }))
    );
    await expect(getDwaionRoutineAdvancedCommands(ROUTINE_ID)).resolves.toMatchObject([
      { state: 'AWAITING_APPROVAL', canApprove: true },
    ]);

    expect(() =>
      parseDwaionRoutineAdvancedCommand({
        ...command(),
        receipt: { ...command().receipt, routineId: RECEIPT_ID },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'TEMPORARY_BUDGET_INCREASE',
        additionalRuns: 5,
        additionalTokensPerRun: 1_000,
        additionalMinutesPerRun: 5,
        expiresAt: '2020-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Temporary routine budget expiry is invalid.');
    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'PROVIDER_ROLLBACK',
        routineRunId: ROUTINE_ID,
        providerReceiptId: '   ',
      })
    ).rejects.toThrow('Provider receipt is required.');
  });

  it('submits a bounded engine override and rejects forged provider outcome bindings', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: engineCommand() }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'AGENT_ENGINE_SWITCH',
        action: 'APPLY',
        agentId: 'dwaion-personal-routine-agent',
        engineId: 'dwp-agent-kernel-v2',
        expiresAt,
      })
    ).resolves.toMatchObject({
      kind: 'AGENT_ENGINE_SWITCH',
      receipt: {
        providerOutcome: {
          expectedRevision: 7,
          appliedPayload: { engineId: 'dwp-agent-kernel-v2' },
        },
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      expectedRevision: 7,
      payload: { kind: 'AGENT_ENGINE_SWITCH', action: 'APPLY', expiresAt },
    });

    const forgedRevision = engineCommand();
    expect(() =>
      parseDwaionRoutineAdvancedCommand({
        ...forgedRevision,
        receipt: {
          ...forgedRevision.receipt,
          providerOutcome: { ...forgedRevision.receipt?.providerOutcome, expectedRevision: 6 },
        },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));

    const forgedPayload = engineCommand();
    expect(() =>
      parseDwaionRoutineAdvancedCommand({
        ...forgedPayload,
        receipt: {
          ...forgedPayload.receipt,
          providerOutcome: {
            ...forgedPayload.receipt?.providerOutcome,
            appliedPayload: { kind: 'AGENT_ENGINE_SWITCH', action: 'APPLY', agentId: '   ' },
          },
        },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('rejects unbounded engine and temporary budget exceptions before transport', async () => {
    const afterThirtyDays = new Date(Date.now() + 31 * 24 * 60 * 60 * 1_000).toISOString();
    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'AGENT_ENGINE_SWITCH',
        action: 'APPLY',
        agentId: 'dwaion-personal-routine-agent',
        engineId: 'dwp-agent-kernel-v2',
        expiresAt: afterThirtyDays,
      })
    ).rejects.toThrow('Routine engine override is invalid.');
    await expect(
      createDwaionRoutineAdvancedCommand(ROUTINE_ID, 7, COMMAND_ID, {
        kind: 'TEMPORARY_BUDGET_INCREASE',
        additionalRuns: 0,
        additionalTokensPerRun: 0,
        additionalMinutesPerRun: 0,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    ).rejects.toThrow('Temporary routine budget expiry is invalid.');
  });

  it('loads only eligible pending approvals and submits a version-bound checker decision', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: [approval()] }))
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: approval('SUCCEEDED') }));
    vi.stubGlobal('fetch', fetchMock);

    const [pending] = await getDwaionRoutinePendingApprovals();
    expect(pending).toMatchObject({ commandId: COMMAND_ID, canApprove: true });
    await expect(
      decideDwaionRoutineAdvancedCommand(pending!, RECEIPT_ID, {
        decision: 'APPROVE',
        changeReason: 'Reviewed the proposed source and delivery boundaries.',
        evidenceRefs: ['ticket:DWAI-71', 'review:definition-v2'],
      })
    ).resolves.toMatchObject({ state: 'SUCCEEDED', checkerUserId: 'checker@company.com' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/agent/v1/routines/advanced-commands/pending-approvals?limit=50',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/routines/advanced-commands/${COMMAND_ID}/decision`,
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(body).toEqual({
      commandId: RECEIPT_ID,
      expectedRevision: 1,
      reasonCode: 'ROUTINE_CHANGE_CHECKER_APPROVED',
      changeReason: 'Reviewed the proposed source and delivery boundaries.',
      decision: 'APPROVE',
      evidenceRefs: ['ticket:DWAI-71', 'review:definition-v2'],
    });
  });

  it('rejects malformed queue items and decisions without unique evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ success: true, data: [{ ...approval(), canApprove: false }] })
        )
    );
    await expect(getDwaionRoutinePendingApprovals()).rejects.toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionRoutineAdvancedCommand({ ...approval(), proposedDefinition: null })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    await expect(
      decideDwaionRoutineAdvancedCommand(approval(), RECEIPT_ID, {
        decision: 'REJECT',
        changeReason: 'The reviewed source boundary is too broad.',
        evidenceRefs: ['review:scope', 'review:scope'],
      })
    ).rejects.toThrow('Routine approval evidence is invalid.');
  });

  it('surfaces a stale approved definition as a conflict that refetches the queue', async () => {
    const failed = {
      ...approval('FAILED'),
      checkerUserId: 'checker@company.com',
      canApprove: false,
      problem: {
        code: 'ROUTINE_APPROVAL_REVISION_CONFLICT',
        detail: 'The routine changed before the approved definition could be applied.',
        recoveryHint: 'Create a new approval request from the latest routine revision.',
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: failed }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      decideDwaionRoutineAdvancedCommand(approval(), RECEIPT_ID, {
        decision: 'APPROVE',
        changeReason: 'Approve the reviewed definition after independent evidence review.',
        evidenceRefs: ['review:stale-definition'],
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'The routine changed before the approved definition could be applied.',
    });
  });
});
