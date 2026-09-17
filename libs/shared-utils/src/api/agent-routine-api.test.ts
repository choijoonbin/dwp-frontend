import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  changeDwaionRoutineConsent,
  createDwaionRoutine,
  dryRunDwaionRoutine,
  getDwaionRoutines,
} from './agent-routine-api';

const ROUTINE_ID = '00000000-0000-4000-8000-000000000241';
const SECURE_AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-current',
  contextKey: 'psc-dwaion',
  contextScopeKey: 'scope-dwaion-self',
} as const;

const definition = {
  name: 'Morning review',
  objective: 'Review authorized work signals',
  cadence: 'WEEKDAYS' as const,
  localTime: '09:00',
  timeZone: 'Asia/Seoul',
  locale: 'ko',
  sources: ['WORK_ITEM'] as const,
  weekDays: [],
  activeFrom: null,
  activeUntil: null,
  quietHoursStart: null,
  quietHoursEnd: null,
  budget: {
    maximumRunsPerMonth: 31,
    maximumTokensPerRun: 32_000,
    maximumMinutesPerRun: 15,
  },
  retryPolicy: {
    maximumAttempts: 3,
    initialBackoffSeconds: 30,
    backoffMultiplier: 2,
  },
  notificationPolicy: {
    notifyOnPartial: true,
    notifyOnFailure: true,
    notifyOnRecovery: true,
  },
  compensationPolicy: {
    enabled: true,
    strategy: 'REVOKE_PENDING_HANDOFFS' as const,
  },
};

function routine() {
  return {
    routineId: ROUTINE_ID,
    lifecycleState: 'DRAFT',
    consentState: 'UNSET',
    consents: { sourceAccess: 'UNSET', analysis: 'UNSET', proposalDelivery: 'UNSET' },
    executionMode: 'DRY_RUN_ONLY',
    revision: 1,
    definition,
    schedulingAvailable: false,
    nextRunAt: null,
    capabilities: {
      activationAvailable: false,
      backgroundExecutionAvailable: false,
      dryRunAvailable: true,
      notificationDeliveryAvailable: false,
      proposalDeliveryAvailable: false,
    },
    createdAt: '2026-09-04T01:00:00Z',
    updatedAt: '2026-09-04T01:00:00Z',
  };
}

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('Agent personal routine API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads real routine records and rejects malformed payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: true, data: [routine()] }))
    );
    await expect(getDwaionRoutines()).resolves.toHaveLength(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, data: [{}] })));
    await expect(getDwaionRoutines()).rejects.toMatchObject({ status: 502 });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          success: true,
          data: [{ ...routine(), capabilities: { dryRunAvailable: true } }],
        })
      )
    );
    await expect(getDwaionRoutines()).rejects.toMatchObject({ status: 502 });
  });

  it('creates routines and records explicit scoped consent commands', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: routine() }, 201))
      .mockResolvedValueOnce(response({ success: true, data: routine() }));
    vi.stubGlobal('fetch', fetchMock);

    await createDwaionRoutine(
      { ...definition, sources: [...definition.sources] },
      SECURE_AUTHORITY
    );
    await changeDwaionRoutineConsent(ROUTINE_ID, 1, 'SOURCE_ACCESS', 'ENABLED', SECURE_AUTHORITY);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/routines?contextScopeKey=scope-dwaion-self',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"expectedRevision":0'),
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-current',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/routines/${ROUTINE_ID}/consent?contextScopeKey=scope-dwaion-self`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"scope":"SOURCE_ACCESS"'),
      })
    );
  });

  it('accepts only truthful validation-only dry-run receipts', async () => {
    const receipt = {
      routineRunId: '00000000-0000-4000-8000-000000000242',
      routineId: ROUTINE_ID,
      routineRevision: 3,
      state: 'VALIDATED',
      outcome: 'VALIDATED',
      trigger: 'DRY_RUN',
      proposalOnly: true,
      externalWritesPerformed: 0,
      proposalsCreated: 0,
      evaluatedAt: '2026-09-04T01:10:00Z',
      evidenceCount: 1,
      evidenceScope: 'AUTHORIZED_SOURCE_BINDING',
      businessEvidenceCount: 0,
      validatedSources: ['WORK_ITEM'],
      previewNextRunAt: '2026-09-05T00:00:00Z',
      schedulingAvailable: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: receipt }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(dryRunDwaionRoutine(ROUTINE_ID, 3)).resolves.toEqual(receipt);
  });
});
