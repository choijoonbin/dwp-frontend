import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionPersonalMemory,
  getDwaionPersonalAiControls,
  getDwaionPersonalDataCapabilities,
  getDwaionPersonalDataDeletions,
  getDwaionPersonalMemories,
  requestDwaionPersonalDataDeletion,
  retryDwaionPersonalDataDeletion,
  updateDwaionMemoryRuntimePreference,
  updateDwaionPersonalMemory,
  updateDwaionSourcePreference,
} from './agent-personal-ai-api';

const SECURE_AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-current',
  contextKey: 'psc-dwaion',
  contextScopeKey: 'scope-dwaion-self',
} as const;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

const governanceUnknown = {
  automaticMemoryInference: null,
  sensitiveMemoryAllowed: null,
  backgroundCredentialStorage: null,
  teamMemoryAvailable: null,
  externalActionWithoutApproval: null,
};

const source = {
  sourceKey: 'CALENDAR',
  available: true,
  enabled: false,
  effective: false,
  effectScope: 'PERSONAL_ROUTINE_DRY_RUN_ONLY',
  proactiveAnalysisIntegrationAvailable: false,
  revision: 0,
  retention: 'REFERENCE_ONLY_NO_RAW_COPY',
  updatedAt: null,
};

const requestedDeletionStages = [
  {
    key: 'REQUEST_ACCEPTED',
    state: 'COMPLETED',
    detailCode: 'DELETION_REQUEST_ACCEPTED',
    observedAt: '2026-09-17T01:00:00Z',
    evidenceReference: '00000000-0000-4000-8000-000000000261',
    evidenceFingerprint: null,
  },
  {
    key: 'TARGETS_SCHEDULED',
    state: 'COMPLETED',
    detailCode: 'DELETION_TARGETS_RECORDED',
    observedAt: '2026-09-17T01:00:00Z',
    evidenceReference: 'targets:1',
    evidenceFingerprint: null,
  },
  {
    key: 'ACTIVE_STORE_DISPOSITION',
    state: 'PENDING',
    detailCode: 'ACTIVE_STORE_DISPOSITION_PENDING',
    observedAt: null,
    evidenceReference: 'dispositions:0/targets:1',
    evidenceFingerprint: null,
  },
  {
    key: 'BACKUP_BOUNDARY',
    state: 'UNAVAILABLE',
    detailCode: 'BACKUP_DESTRUCTION_LOG_NOT_CONFIGURED',
    observedAt: null,
    evidenceReference: 'EXTERNAL_RETENTION_BOUNDARY',
    evidenceFingerprint: null,
  },
  {
    key: 'RECEIPT_FINALIZATION',
    state: 'PENDING',
    detailCode: 'SERVER_DISPOSITION_RECEIPT_PENDING',
    observedAt: null,
    evidenceReference: 'server-disposition-receipts:0',
    evidenceFingerprint: null,
  },
] as const;

const completedDeletion = {
  deletionJobId: '00000000-0000-4000-8000-000000000261',
  state: 'COMPLETED',
  domains: ['MEMORY'],
  requestedAt: '2026-09-17T01:00:00Z',
  completedAt: '2026-09-17T01:01:00Z',
  deletionPerformed: true,
  deletionExecutionAvailable: true,
  blockedDomains: [],
  attemptCount: 1,
  targets: [
    {
      domain: 'MEMORY',
      state: 'COMPLETED',
      affectedCount: 3,
      safeErrorCode: null,
      disposition: {
        dispositionId: '00000000-0000-4000-8000-000000000262',
        domain: 'MEMORY',
        generation: 1,
        purgedRowCount: 3,
        purgedTableCounts: { ai_memories: 3 },
        dispositionScope: 'AGENT_ACTIVE_POSTGRES_DOMAIN_ONLY',
        dispositionMethod: 'PHYSICAL_ROW_PURGE_OF_ENCRYPTED_RECORDS',
        activeStoreEnvelopesDestroyed: true,
        sourceSystemDataAffected: false,
        backupDispositionState: 'EXTERNAL_RETENTION_BOUNDARY',
        receiptFingerprint: 'a'.repeat(64),
        completedAt: '2026-09-17T01:01:00Z',
      },
      legalHoldEvidence: null,
    },
  ],
  stages: requestedDeletionStages.map((stage) =>
    stage.key === 'ACTIVE_STORE_DISPOSITION'
      ? {
          ...stage,
          state: 'COMPLETED' as const,
          detailCode: 'ACTIVE_STORE_DISPOSITION_COMPLETED',
          observedAt: '2026-09-17T01:01:00Z',
          evidenceReference: 'dispositions:1/targets:1',
          evidenceFingerprint: 'a'.repeat(64),
        }
      : stage.key === 'RECEIPT_FINALIZATION'
        ? {
            ...stage,
            state: 'COMPLETED' as const,
            detailCode: 'SERVER_DISPOSITION_RECEIPTS_FINALIZED',
            observedAt: '2026-09-17T01:01:00Z',
            evidenceReference: 'server-disposition-receipts:1',
            evidenceFingerprint: 'a'.repeat(64),
          }
        : stage
  ),
  legalHolds: [],
} as const;

const personalMemory = {
  memoryId: '00000000-0000-4000-8000-000000000271',
  kind: 'TONE',
  state: 'ACTIVE',
  revision: 2,
  memory: { value: 'Use concise answers.' },
  origin: 'MANUAL',
  sourceType: 'USER_EXPLICIT_ENTRY',
  confidence: null,
  factVector: [],
  useCount: 4,
  lastUsedAt: '2026-09-17T01:30:00Z',
  encryptionProvider: 'AWS_KMS',
  encryptionKeyVersion: 'v7',
  encryptionKeyReferenceFingerprint: 'abc123def456',
  scope: ['ASK', 'RESEARCH'],
  expiresAt: '2026-10-17T03:00:00Z',
  createdAt: '2026-09-17T01:00:00Z',
  updatedAt: '2026-09-17T02:00:00Z',
} as const;

describe('Agent personal AI controls API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('requires every governed personal-data evidence capability', async () => {
    const providerCapability = {
      available: false,
      configured: false,
      reasonCode: 'PROVIDER_NOT_CONFIGURED',
      recoveryHint: 'Ask an administrator to configure the provider.',
    };
    const capabilities = {
      supportedDeletionDomains: ['MEMORY'],
      deletionRequestAvailable: true,
      deletionExecutionAvailable: true,
      deletionCompletionClaimAvailable: true,
      backupDestructionLog: providerCapability,
      sreSupport: providerCapability,
      legalHoldEvidence: providerCapability,
      legalHoldAppeal: providerCapability,
      signedCertificate: providerCapability,
      siemSync: providerCapability,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(response({ success: true, data: capabilities }));
    await expect(getDwaionPersonalDataCapabilities()).resolves.toEqual(capabilities);
    fetchMock.mockResolvedValueOnce(
      response({ success: true, data: { ...capabilities, siemSync: undefined } })
    );
    await expect(getDwaionPersonalDataCapabilities()).rejects.toMatchObject({ status: 502 });
    fetchMock.mockResolvedValueOnce(
      response({
        success: true,
        data: {
          ...capabilities,
          sreSupport: {
            available: true,
            configured: true,
            reasonCode: null,
            recoveryHint: null,
          },
          signedCertificate: {
            available: true,
            configured: true,
            reasonCode: null,
            recoveryHint: null,
          },
        },
      })
    );
    await expect(getDwaionPersonalDataCapabilities()).resolves.toMatchObject({
      sreSupport: { available: true },
      signedCertificate: { available: true },
    });
  });

  it('validates memory scope, expiry, and derived expiry state fail closed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(
      response({ success: true, data: [{ ...personalMemory, state: 'EXPIRED' }] })
    );
    await expect(getDwaionPersonalMemories()).resolves.toEqual([
      { ...personalMemory, state: 'EXPIRED' },
    ]);

    fetchMock.mockResolvedValueOnce(
      response({ success: true, data: [{ ...personalMemory, scope: [] }] })
    );
    await expect(getDwaionPersonalMemories()).rejects.toMatchObject({ status: 502 });
    fetchMock.mockResolvedValueOnce(
      response({ success: true, data: [{ ...personalMemory, expiresAt: 'not-a-date' }] })
    );
    await expect(getDwaionPersonalMemories()).rejects.toMatchObject({ status: 502 });
  });

  it('sends governed scope and expiry mutations through the memory update contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: personalMemory }))
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { ...personalMemory, revision: 3, scope: ['ASK'], expiresAt: null },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createDwaionPersonalMemory(
        'TONE',
        personalMemory.memory.value,
        { scope: ['ASK', 'RESEARCH'], expiresAt: personalMemory.expiresAt },
        SECURE_AUTHORITY
      )
    ).resolves.toEqual(personalMemory);
    await expect(
      updateDwaionPersonalMemory(
        personalMemory.memoryId,
        personalMemory.revision,
        {
          scope: ['ASK'],
          expiresAt: null,
          changeReason: 'The user narrowed scope and removed the explicit expiry.',
        },
        SECURE_AUTHORITY
      )
    ).resolves.toMatchObject({ revision: 3, scope: ['ASK'], expiresAt: null });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ai-controls/memories?contextScopeKey=scope-dwaion-self',
      expect.objectContaining({
        body: expect.stringContaining('"scope":["ASK","RESEARCH"]'),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${'/api/agent/v1/ai-controls/memories/'}${personalMemory.memoryId}?contextScopeKey=scope-dwaion-self`,
      expect.objectContaining({
        body: expect.stringContaining('"expiresAt":null'),
      })
    );
    await expect(
      updateDwaionPersonalMemory(
        personalMemory.memoryId,
        personalMemory.revision,
        { scope: [], changeReason: 'Narrow scope.' },
        SECURE_AUTHORITY
      )
    ).rejects.toThrow('unique supported values');
  });

  it('fails runtime application closed while an older runtime contract is rolling out', async () => {
    const controls = {
      memoryState: 'UNSET',
      revision: 0,
      memoryEnabled: false,
      memoryEffective: false,
      explicitMemoryStorageAvailable: true,
      runtimeApplicationAvailable: false,
      sourcePreferences: [source],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, data: controls })));
    await expect(getDwaionPersonalAiControls()).resolves.toEqual({
      ...controls,
      ...governanceUnknown,
      runtimeApplicationState: 'UNSET',
      runtimeApplicationEnabled: false,
      runtimeApplicationAvailable: false,
      evidenceCapabilities: null,
    });
  });

  it('uses memory evidence only when every capability is explicitly returned', async () => {
    const available = {
      available: true,
      configured: true,
      reasonCode: null,
      recoveryHint: null,
    };
    const unavailable = {
      available: false,
      configured: false,
      reasonCode: 'MEMORY_EVIDENCE_NOT_SUPPORTED',
      recoveryHint: 'This evidence is not provided by the current memory contract.',
    };
    const evidenceCapabilities = {
      manualProvenance: available,
      aiDerivedMemory: unavailable,
      confidenceScoring: unavailable,
      factVector: unavailable,
      usageMetrics: available,
      usageTrail: unavailable,
      kmsBinding: available,
    };
    const controls = {
      memoryState: 'ENABLED',
      revision: 3,
      memoryEnabled: true,
      memoryEffective: true,
      explicitMemoryStorageAvailable: true,
      sourcePreferences: [source],
      evidenceCapabilities,
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(response({ success: true, data: controls }));
    await expect(getDwaionPersonalAiControls()).resolves.toMatchObject({
      evidenceCapabilities,
    });
    fetchMock.mockResolvedValueOnce(
      response({
        success: true,
        data: {
          ...controls,
          evidenceCapabilities: { ...evidenceCapabilities, kmsBinding: undefined },
        },
      })
    );
    await expect(getDwaionPersonalAiControls()).resolves.toMatchObject({
      evidenceCapabilities: null,
    });
  });

  it('updates answer personalization independently with revision-bound consent', async () => {
    const controls = {
      memoryState: 'ENABLED',
      revision: 3,
      memoryEnabled: true,
      memoryEffective: true,
      explicitMemoryStorageAvailable: true,
      runtimeApplicationState: 'ENABLED',
      runtimeApplicationEnabled: true,
      runtimeApplicationAvailable: true,
      sourcePreferences: [source],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: controls }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateDwaionMemoryRuntimePreference(2, 'ENABLED', SECURE_AUTHORITY)
    ).resolves.toEqual({ ...controls, ...governanceUnknown, evidenceCapabilities: null });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ai-controls/runtime?contextScopeKey=scope-dwaion-self',
      expect.objectContaining({
        body: expect.stringContaining('"runtimeApplicationState":"ENABLED"'),
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-current',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ai-controls/runtime?contextScopeKey=scope-dwaion-self',
      expect.objectContaining({ body: expect.stringContaining('"expectedRevision":2') })
    );
  });

  it('sends revision-bound source updates and deletion requests', async () => {
    const deletion = {
      deletionJobId: '00000000-0000-4000-8000-000000000251',
      state: 'REQUESTED',
      domains: ['MEMORY'],
      requestedAt: '2026-09-04T02:00:00Z',
      completedAt: null,
      deletionPerformed: false,
      deletionExecutionAvailable: false,
      blockedDomains: [],
      attemptCount: 0,
      targets: [],
      stages: requestedDeletionStages,
      legalHolds: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(
        response({ success: true, data: { ...source, enabled: true, revision: 1 } })
      )
      .mockResolvedValueOnce(response({ success: true, data: deletion }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await updateDwaionSourcePreference('CALENDAR', 0, true);
    await expect(requestDwaionPersonalDataDeletion(['MEMORY'])).resolves.toEqual(deletion);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/ai-controls/sources/CALENDAR',
      expect.objectContaining({ body: expect.stringContaining('"expectedRevision":0') })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/personal-data/deletions',
      expect.objectContaining({ body: expect.stringContaining('"domains":["MEMORY"]') })
    );
  });

  it('loads deletion history only when every sealed disposition is internally consistent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValueOnce(response({ success: true, data: [completedDeletion] }));
    await expect(getDwaionPersonalDataDeletions()).resolves.toEqual([completedDeletion]);

    fetchMock.mockResolvedValueOnce(
      response({
        success: true,
        data: [
          {
            ...completedDeletion,
            targets: [
              {
                ...completedDeletion.targets[0],
                disposition: {
                  ...completedDeletion.targets[0].disposition,
                  purgedRowCount: 4,
                },
              },
            ],
          },
        ],
      })
    );
    await expect(getDwaionPersonalDataDeletions()).rejects.toMatchObject({ status: 502 });
  });

  it('retries failed deletion targets with the caller-owned command identity', async () => {
    const failed = {
      ...completedDeletion,
      state: 'FAILED',
      completedAt: '2026-09-17T01:02:00Z',
      deletionPerformed: false,
      attemptCount: 2,
      targets: [
        {
          domain: 'MEMORY',
          state: 'FAILED',
          affectedCount: null,
          safeErrorCode: 'PROVIDER_TIMEOUT',
          disposition: null,
          legalHoldEvidence: null,
        },
      ],
    } as const;
    const retried = {
      ...failed,
      state: 'RUNNING',
      completedAt: null,
      attemptCount: 3,
      targets: [{ ...failed.targets[0], state: 'RUNNING', safeErrorCode: null }],
    } as const;
    const commandId = '00000000-0000-4000-8000-000000000263';
    const authority = {
      ...SECURE_AUTHORITY,
      objectVersion: 2,
      idempotencyKey: commandId,
      stepUp: {
        challenge: 'signed-user-presence-proof',
        challengeId: 'deletion-retry-challenge',
        decisionRevision: SECURE_AUTHORITY.expectedDecisionRevision,
        expiresAt: '2099-09-17T02:00:00Z',
      },
    } as const;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValue(response({ success: true, data: retried }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await retryDwaionPersonalDataDeletion(failed.deletionJobId, 2, commandId, authority);
    await retryDwaionPersonalDataDeletion(failed.deletionJobId, 2, commandId, authority);
    for (const call of [fetchMock.mock.calls[1], fetchMock.mock.calls[2]]) {
      expect(call?.[0]).toBe(
        `/api/agent/v1/personal-data/deletions/${failed.deletionJobId}/retry?contextScopeKey=scope-dwaion-self`
      );
      expect(JSON.parse(call?.[1]?.body as string)).toMatchObject({
        commandId,
        expectedRevision: 2,
        reasonCode: 'USER_DATA_DELETION_RETRY',
      });
    }
  });
  it.each(Object.keys(governanceUnknown))(
    'preserves unknown and rejects invalid %s security evidence',
    async (key) => {
      const controls = {
        memoryState: 'UNSET',
        revision: 0,
        memoryEnabled: false,
        memoryEffective: false,
        sourcePreferences: [],
      };
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      for (const value of [undefined, null, false, true]) {
        fetchMock.mockResolvedValue(response({ data: { ...controls, [key]: value } }));
        const result = await getDwaionPersonalAiControls();
        expect(result[key as keyof typeof governanceUnknown]).toBe(value ?? null);
      }
      for (const value of ['false', 0, {}, []]) {
        fetchMock.mockResolvedValue(response({ data: { ...controls, [key]: value } }));
        await expect(getDwaionPersonalAiControls()).rejects.toMatchObject({ status: 502 });
      }
    }
  );
});
