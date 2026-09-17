import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { executeDwaionTeamArtifactRemediation } from './agent-artifact-collaboration-api';

const ARTIFACT_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const STAGE_ID = '33333333-3333-4333-8333-333333333333';

function receipt(action: 'AUTOMATIC_MASKING' | 'REVIEW_NOTIFICATION') {
  return {
    receiptId: '44444444-4444-4444-8444-444444444444',
    commandId: COMMAND_ID,
    artifactId: ARTIFACT_ID,
    action,
    state: 'SUCCEEDED',
    artifactRevision: action === 'AUTOMATIC_MASKING' ? 5 : 4,
    workspaceRevision: action === 'REVIEW_NOTIFICATION' ? 4 : null,
    affectedCount: action === 'AUTOMATIC_MASKING' ? 2 : 1,
    providerReceiptId: action === 'REVIEW_NOTIFICATION' ? 'notify-provider-100' : null,
    sourceContentFingerprint: action === 'AUTOMATIC_MASKING' ? 'b'.repeat(64) : null,
    findingManifestSha256: action === 'AUTOMATIC_MASKING' ? 'c'.repeat(64) : null,
    resultContentSha256: action === 'AUTOMATIC_MASKING' ? 'd'.repeat(64) : null,
    remediatedCodes: action === 'AUTOMATIC_MASKING' ? ['EMAIL_ADDRESS', 'PHONE_NUMBER'] : [],
    residualFindingCount: action === 'AUTOMATIC_MASKING' ? 0 : null,
    resultSha256: 'a'.repeat(64),
    completedAt: '2026-09-17T03:00:00Z',
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

describe('DWAI.ON artifact remediation API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('executes local masking and binds the immutable remediation receipt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: receipt('AUTOMATIC_MASKING') }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_AUTOMATIC_MASKING',
        changeReason: 'Mask the reviewed personal identifiers in this artifact.',
        action: 'AUTOMATIC_MASKING',
        stageId: null,
      })
    ).resolves.toMatchObject({ affectedCount: 2, artifactRevision: 5 });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/artifact-collaboration/${ARTIFACT_ID}/remediation-actions`,
      expect.objectContaining({ body: expect.stringContaining('"action":"AUTOMATIC_MASKING"') })
    );
  });

  it('requires a stage only for notification and fails closed on a forged receipt binding', async () => {
    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_REVIEW_NOTIFICATION',
        changeReason: 'Notify the assigned reviewer for this stage.',
        action: 'REVIEW_NOTIFICATION',
        stageId: null,
      })
    ).rejects.toThrow('Only review notification requires a review stage.');
    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_AUTOMATIC_MASKING',
        changeReason: 'Mask the reviewed personal identifiers in this artifact.',
        action: 'AUTOMATIC_MASKING',
        stageId: STAGE_ID,
      })
    ).rejects.toThrow('Only review notification requires a review stage.');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { ...receipt('REVIEW_NOTIFICATION'), commandId: STAGE_ID },
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_REVIEW_NOTIFICATION',
        changeReason: 'Notify the assigned reviewer for this stage.',
        action: 'REVIEW_NOTIFICATION',
        stageId: STAGE_ID,
      })
    ).rejects.toMatchObject({ status: 502 });

    resetCsrfToken();
    const residualFindingFetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { ...receipt('AUTOMATIC_MASKING'), residualFindingCount: 1 },
        })
      );
    vi.stubGlobal('fetch', residualFindingFetch);
    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_AUTOMATIC_MASKING',
        changeReason: 'Mask the reviewed personal identifiers in this artifact.',
        action: 'AUTOMATIC_MASKING',
        stageId: null,
      })
    ).rejects.toMatchObject({ status: 502 });

    resetCsrfToken();
    const blankReceiptFetch = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(
        response({
          success: true,
          data: { ...receipt('REVIEW_NOTIFICATION'), providerReceiptId: '   ' },
        })
      );
    vi.stubGlobal('fetch', blankReceiptFetch);
    await expect(
      executeDwaionTeamArtifactRemediation(ARTIFACT_ID, {
        commandId: COMMAND_ID,
        expectedRevision: 4,
        reasonCode: 'USER_REQUESTED_REVIEW_NOTIFICATION',
        changeReason: 'Notify the assigned reviewer for this stage.',
        action: 'REVIEW_NOTIFICATION',
        stageId: STAGE_ID,
      })
    ).rejects.toMatchObject({ status: 502 });
  });
});
