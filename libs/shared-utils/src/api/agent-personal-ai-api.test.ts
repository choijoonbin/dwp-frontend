import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getDwaionPersonalAiControls,
  requestDwaionPersonalDataDeletion,
  updateDwaionSourcePreference,
} from './agent-personal-ai-api';

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

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

  it('validates capability-backed controls instead of assuming availability', async () => {
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
    await expect(getDwaionPersonalAiControls()).resolves.toEqual(controls);
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
});
