import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionArtifact,
  getCurrentDwaionArtifactPreflight,
  getDwaionArtifacts,
  requestDwaionArtifactExport,
} from './agent-artifact-api';

const ARTIFACT_ID = '00000000-0000-4000-8000-000000000261';
const PREFLIGHT_ID = '00000000-0000-4000-8000-000000000262';

function artifact() {
  return {
    artifactId: ARTIFACT_ID,
    artifactType: 'DOCUMENT',
    state: 'DRAFT',
    revision: 1,
    draftRevision: 1,
    currentVersionNumber: 0,
    publishedVersionNumber: null,
    content: { title: 'Customer briefing', body: '# Verified notes', format: 'MARKDOWN' },
    sources: [],
    capabilities: {
      immutableVersionsAvailable: true,
      recipientSharingAvailable: false,
      exportRequestAvailable: true,
      exportExecutionAvailable: false,
    },
    createdAt: '2026-09-04T03:00:00Z',
    updatedAt: '2026-09-04T03:00:00Z',
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

describe('Agent governed artifact API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads validated artifacts and creates an explicit draft', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: [artifact()] }))
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: artifact() }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionArtifacts()).resolves.toHaveLength(1);
    await createDwaionArtifact({ artifactType: 'DOCUMENT', content: artifact().content });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/artifacts',
      expect.objectContaining({ body: expect.stringContaining('"artifactType":"DOCUMENT"') })
    );
  });

  it('treats a missing current preflight as an unverified state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: false, detail: 'not found' }, 404))
    );
    await expect(getCurrentDwaionArtifactPreflight(ARTIFACT_ID)).resolves.toBeNull();
  });

  it('returns only a pending export receipt and never claims a file exists', async () => {
    const receipt = {
      exportJobId: '00000000-0000-4000-8000-000000000263',
      artifactId: ARTIFACT_ID,
      artifactRevision: 4,
      versionNumber: 2,
      exportFormat: 'PDF',
      state: 'PENDING',
      executionAvailable: false,
      fileAvailable: false,
      externalWritePerformed: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: receipt }, 202));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestDwaionArtifactExport(ARTIFACT_ID, 4, 2, PREFLIGHT_ID, 'PDF')
    ).resolves.toEqual(receipt);
  });
});
