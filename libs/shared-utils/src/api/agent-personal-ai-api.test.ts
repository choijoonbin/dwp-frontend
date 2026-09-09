import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getDwaionPersonalAiControls,
  requestDwaionPersonalDataDeletion,
  updateDwaionMemoryRuntimePreference,
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

describe('Agent personal AI controls API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
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
    ).resolves.toEqual({ ...controls, ...governanceUnknown });
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
