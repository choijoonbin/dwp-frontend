import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  commandDwaionRoutineRun,
  getDwaionRoutineHealth,
  getDwaionRoutineRuns,
  getDwaionRoutineVersions,
  rollbackDwaionRoutineVersion,
  triggerDwaionRoutineRun,
  triggerDwaionRoutineWebhook,
} from './agent-routine-execution-api';
import {
  parseDwaionRoutineCapabilities,
  parseDwaionRoutineHealth,
  parseDwaionRoutineRollback,
  parseDwaionRoutineRun,
  parseDwaionRoutineVersions,
} from './agent-routine-execution-parser';

const ROUTINE_ID = '00000000-0000-4000-8000-000000000241';
const RUN_ID = '00000000-0000-4000-8000-000000000242';
const COMMAND_ID = '00000000-0000-4000-8000-000000000243';
const RECEIPT_ID = '00000000-0000-4000-8000-000000000244';
const RUN_COMMAND_ID = '00000000-0000-4000-8000-000000000245';
const EVENT_ID = '00000000-0000-4000-8000-000000000246';

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
  recoveryAction: null,
  recoveryCommandId: null,
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
    recoveryAction: null,
    recoveryCommandId: null,
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

  it('requires explicit capability evidence and accepts configured advanced actions', () => {
    const unavailable = {
      available: false,
      configured: false,
      reasonCode: 'PROVIDER_NOT_CONFIGURED',
      recoveryHint: 'Ask an administrator to configure the runtime provider.',
    };
    const capabilities = {
      lifecycleMode: 'ACTIVE_RUNTIME',
      activationAvailable: true,
      schedulingAvailable: true,
      backgroundExecutionAvailable: true,
      dryRunAvailable: true,
      pauseResumeAvailable: true,
      oneTimeScheduleAvailable: true,
      activeWindowPreviewAvailable: true,
      quietHoursPreviewAvailable: true,
      quietHoursDeliveryEnforcementAvailable: true,
      holidayPolicyAvailable: true,
      costBudgetAvailable: true,
      runtimeBudgetAvailable: true,
      notificationDeliveryAvailable: true,
      proposalDeliveryAvailable: true,
      externalWriteAvailable: false,
      webhookTriggerAvailable: true,
      agentKernelBinding: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      whitelistedSourceBinding: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      blockedSourcePolicy: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      zeroWritePolicy: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      semanticVersionDiff: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      runtimeBudgetRetry: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      automaticQuarantine: {
        ...unavailable,
        available: true,
        configured: true,
        reasonCode: null,
        recoveryHint: null,
      },
      changeApproval: unavailable,
      agentSwitching: unavailable,
      wormDelivery: unavailable,
      oauthReauthorization: unavailable,
      temporaryBudgetIncrease: unavailable,
      operatorEscalation: unavailable,
      providerRollback: unavailable,
      executionProviderState: 'AVAILABLE',
      recoveryHint: null,
      supportedCadences: ['DAILY', 'WEEKDAYS', 'WEEKLY'],
      consentScopes: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
    } as const;
    expect(parseDwaionRoutineCapabilities(capabilities).operatorEscalation.available).toBe(false);
    expect(() =>
      parseDwaionRoutineCapabilities({ ...capabilities, providerRollback: undefined })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(
      parseDwaionRoutineCapabilities({
        ...capabilities,
        oauthReauthorization: {
          ...unavailable,
          available: true,
          configured: true,
          reasonCode: null,
          recoveryHint: null,
        },
      }).oauthReauthorization.available
    ).toBe(true);
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
    expect(() =>
      parseDwaionRoutineRun({
        ...completedRun,
        receipt: { ...completedRun.receipt, evidenceCount: 2 },
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

  it('binds a quarantine recovery command to the queued run and terminal receipt', async () => {
    const queuedRecoveryRun = {
      ...queuedRun,
      version: 6,
      recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
      recoveryCommandId: RUN_COMMAND_ID,
    } as const;
    const completedRecoveryRun = {
      ...completedRun,
      version: 7,
      recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
      recoveryCommandId: RUN_COMMAND_ID,
      receipt: {
        ...completedRun.receipt,
        recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
        recoveryCommandId: RUN_COMMAND_ID,
      },
    } as const;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: queuedRecoveryRun }))
      .mockResolvedValueOnce(response({ success: true, data: [completedRecoveryRun] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      commandDwaionRoutineRun(ROUTINE_ID, RUN_ID, {
        commandId: RUN_COMMAND_ID,
        expectedRevision: 5,
        reasonCode: 'USER_CONFIRMED_SKIP_QUARANTINED',
        changeReason: 'Continue only with provider-verified non-quarantined items.',
        action: 'SKIP_QUARANTINED_AND_CONTINUE',
      })
    ).resolves.toMatchObject({
      state: 'QUEUED',
      recoveryAction: 'SKIP_QUARANTINED_AND_CONTINUE',
      recoveryCommandId: RUN_COMMAND_ID,
    });
    await expect(getDwaionRoutineRuns(ROUTINE_ID)).resolves.toEqual([completedRecoveryRun]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/routines/${ROUTINE_ID}/runs/${RUN_ID}/commands`,
      expect.objectContaining({
        body: expect.stringContaining('"action":"SKIP_QUARANTINED_AND_CONTINUE"'),
      })
    );
  });

  it('binds webhook event identity and payload to the governed execution request', async () => {
    const webhookRun = { ...queuedRun, trigger: 'WEBHOOK' as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: webhookRun }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      triggerDwaionRoutineWebhook(ROUTINE_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 7,
        reasonCode: 'GOVERNED_WEBHOOK_EVENT',
        changeReason: 'The registered webhook event was accepted for this routine.',
        eventId: EVENT_ID,
        eventType: 'ERP.LEDGER_CLOSE',
        occurredAt: '2026-09-17T01:00:00Z',
        payload: { ledgerId: 'ledger-1', amount: 1250 },
      })
    ).resolves.toMatchObject({ trigger: 'WEBHOOK' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/routines/${ROUTINE_ID}/webhook-events`,
      expect.objectContaining({
        body: expect.stringContaining(`"eventId":"${EVENT_ID}"`),
      })
    );
  });

  it('fails closed on contradictory health and version evidence', () => {
    const health = routineHealth();
    expect(parseDwaionRoutineHealth(health).state).toBe('HEALTHY');
    expect(() => parseDwaionRoutineHealth({ ...health, workerAvailable: false })).toThrowError(
      expect.objectContaining({ status: 502 })
    );

    const versions = routineVersions();
    expect(parseDwaionRoutineVersions(versions)).toHaveLength(2);
    expect(() => parseDwaionRoutineVersions([...versions].reverse())).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionRoutineVersions([
        { ...versions[0], integrityFingerprint: 'not-a-digest' },
        versions[1],
      ])
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('loads bound server evidence and validates rollback receipts', async () => {
    const versions = routineVersions();
    const health = routineHealth();
    const rollback = routineRollback();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: versions }))
      .mockResolvedValueOnce(response({ success: true, data: health }))
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: rollback }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionRoutineVersions(ROUTINE_ID)).resolves.toHaveLength(2);
    await expect(getDwaionRoutineHealth(ROUTINE_ID)).resolves.toMatchObject({ state: 'HEALTHY' });
    await expect(
      rollbackDwaionRoutineVersion(ROUTINE_ID, 1, {
        commandId: COMMAND_ID,
        expectedRevision: 7,
        reasonCode: 'USER_CONFIRMED_VERSION_ROLLBACK',
        changeReason: 'The user reviewed the snapshot before rollback.',
      })
    ).resolves.toMatchObject({ targetRevision: 1, createdRevision: 8 });
    expect(parseDwaionRoutineRollback(rollback).routine.revision).toBe(8);
  });
});

function routineHealth() {
  return {
    routineId: ROUTINE_ID,
    routineRevision: 7,
    state: 'HEALTHY',
    workerAvailable: true,
    scheduleCurrent: true,
    allConsentsEnabled: true,
    latestRunId: RUN_ID,
    latestRunState: 'COMPLETED',
    latestRunAt: '2026-09-17T01:00:08Z',
    recoveryHints: [],
    checkedAt: '2026-09-17T01:01:00Z',
  } as const;
}

function routineVersions() {
  return [versionSnapshot(7, 'a'), versionSnapshot(1, 'b')] as const;
}

function versionSnapshot(revision: number, fingerprint: string) {
  return {
    commandId:
      revision === 7
        ? '00000000-0000-4000-8000-000000000247'
        : '00000000-0000-4000-8000-000000000248',
    commandType: revision === 1 ? 'CREATE' : 'UPDATE',
    revision,
    snapshot: personalRoutine(revision),
    createdAt: `2026-09-${revision === 1 ? '01' : '17'}T01:00:00Z`,
    integrityFingerprint: fingerprint.repeat(64),
    rollbackTargetRevision: null,
    rollbackTargetFingerprint: null,
  };
}

function routineRollback() {
  return {
    commandId: COMMAND_ID,
    routineId: ROUTINE_ID,
    targetRevision: 1,
    targetFingerprint: 'b'.repeat(64),
    createdRevision: 8,
    routine: personalRoutine(8),
    rolledBackAt: '2026-09-17T01:02:00Z',
    integrityFingerprint: 'c'.repeat(64),
  };
}

function personalRoutine(revision: number) {
  const available = {
    available: true,
    configured: true,
    reasonCode: null,
    recoveryHint: null,
  };
  const unavailable = {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint: 'Ask an administrator to configure this governed operation.',
  };
  return {
    routineId: ROUTINE_ID,
    lifecycleState: 'DRAFT',
    consentState: 'ENABLED',
    executionMode: 'DRY_RUN_ONLY',
    revision,
    definition: {
      name: 'Morning review',
      objective: 'Review authorized work signals',
      triggerType: 'SCHEDULED',
      cadence: 'WEEKDAYS',
      localTime: '09:00',
      timeZone: 'Asia/Seoul',
      webhookEventType: null,
      webhookEndpointReference: null,
      locale: 'en',
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
    },
    consents: { sourceAccess: 'ENABLED', analysis: 'ENABLED', proposalDelivery: 'ENABLED' },
    schedulingAvailable: true,
    nextRunAt: '2026-09-18T00:00:00Z',
    capabilities: {
      backgroundExecutionAvailable: true,
      dryRunAvailable: true,
      notificationDeliveryAvailable: true,
      proposalDeliveryAvailable: true,
      webhookTriggerAvailable: true,
      agentKernelBinding: available,
      whitelistedSourceBinding: available,
      blockedSourcePolicy: available,
      zeroWritePolicy: available,
      semanticVersionDiff: available,
      runtimeBudgetRetry: available,
      automaticQuarantine: available,
      changeApproval: unavailable,
      agentSwitching: unavailable,
      wormDelivery: unavailable,
      oauthReauthorization: unavailable,
      temporaryBudgetIncrease: unavailable,
      operatorEscalation: unavailable,
      providerRollback: unavailable,
    },
    createdAt: '2026-09-01T01:00:00Z',
    updatedAt: '2026-09-17T01:00:00Z',
  };
}
