import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionArtifact,
  getCurrentDwaionArtifactPreflight,
  getDwaionArtifacts,
  getDwaionArtifactExport,
  downloadDwaionArtifactExport,
  requestDwaionArtifactExport,
} from './agent-artifact-api';

const ARTIFACT_ID = '00000000-0000-4000-8000-000000000261';
const PREFLIGHT_ID = '00000000-0000-4000-8000-000000000262';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000264';
const ASSISTANT_MESSAGE_ID = '00000000-0000-4000-8000-000000000265';
const SECURE_AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-current',
  contextKey: 'psc-dwaion',
  contextScopeKey: 'scope-dwaion-self',
} as const;

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
      collaborativeEditingAvailable: false,
      deterministicPreflightAvailable: true,
      enterpriseDlpConnectorAvailable: false,
      externalSharingAvailable: false,
      immutableVersionsAvailable: true,
      personalPublishStateAvailable: true,
      recipientSharingAvailable: false,
      exportRequestAvailable: true,
      exportExecutionAvailable: false,
      sourceFreshnessAvailable: false,
      sourceVerificationAvailable: false,
      versionRestoreAvailable: false,
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

  it('rejects artifact records that omit authoritative capability evidence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          success: true,
          data: [{ ...artifact(), capabilities: { immutableVersionsAvailable: true } }],
        })
      )
    );

    await expect(getDwaionArtifacts()).rejects.toMatchObject({ status: 502 });
  });

  it('treats a missing current preflight as an unverified state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ success: false, detail: 'not found' }, 404))
    );
    await expect(getCurrentDwaionArtifactPreflight(ARTIFACT_ID)).resolves.toBeNull();
  });

  it('binds a conversation answer without accepting client-authored source references', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: artifact() }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await createDwaionArtifact({
      artifactType: 'DOCUMENT',
      content: artifact().content,
      sourceConversation: {
        conversationId: CONVERSATION_ID,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
      },
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      artifactType: 'DOCUMENT',
      content: artifact().content,
      sourceConversation: {
        conversationId: CONVERSATION_ID,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
      },
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty('sources');
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
      requestDwaionArtifactExport(ARTIFACT_ID, 4, 2, PREFLIGHT_ID, 'PDF', SECURE_AUTHORITY)
    ).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/artifacts/${ARTIFACT_ID}/exports?contextScopeKey=scope-dwaion-self`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-current',
        }),
      })
    );
  });
  it('accepts a live worker receipt while preserving the pending state', async () => {
    const receipt = exportReceipt({ executionAvailable: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: receipt })));
    await expect(getDwaionArtifactExport(ARTIFACT_ID, receipt.exportJobId)).resolves.toEqual(
      receipt
    );
  });

  it.each([
    { state: 'SUCCEEDED', fileAvailable: true },
    { state: 'PENDING', fileAvailable: true },
    { state: 'FAILED' },
    { artifactId: CONVERSATION_ID },
    { state: 'UNKNOWN' },
    { externalWritePerformed: true },
  ])('rejects contradictory or unbound export evidence %j', async (change) => {
    const receipt = exportReceipt(change);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ data: receipt })));
    await expect(getDwaionArtifactExport(ARTIFACT_ID, receipt.exportJobId)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('downloads only a succeeded file with matching size and fingerprint', async () => {
    const receipt = exportReceipt({
      state: 'SUCCEEDED',
      fileAvailable: true,
      fileName: 'artifact.md',
      mediaType: 'text/markdown',
      byteSize: 4,
      contentFingerprint: 'a'.repeat(64),
      completedAt: '2026-09-09T00:00:00Z',
    });
    const fetchMock = vi.fn().mockResolvedValue(response({ data: receipt }));
    vi.stubGlobal('fetch', fetchMock);
    const verified = await getDwaionArtifactExport(ARTIFACT_ID, receipt.exportJobId);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['test']),
      headers: new Headers({ 'X-DWP-Content-Fingerprint': 'a'.repeat(64) }),
    });
    await expect(downloadDwaionArtifactExport(verified)).resolves.toHaveProperty('size', 4);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['other']),
      headers: new Headers({ 'X-DWP-Content-Fingerprint': 'a'.repeat(64) }),
    });
    await expect(downloadDwaionArtifactExport(verified)).rejects.toMatchObject({ status: 502 });
  });
});

function exportReceipt(change: Record<string, unknown> = {}) {
  return {
    exportJobId: '00000000-0000-4000-8000-000000000263',
    artifactId: ARTIFACT_ID,
    artifactRevision: 4,
    versionNumber: 2,
    exportFormat: 'MARKDOWN',
    state: 'PENDING',
    executionAvailable: false,
    fileAvailable: false,
    externalWritePerformed: false,
    ...change,
  };
}
