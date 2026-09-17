import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionSecureAttachment,
  createDwaionProposalHandoff,
  createDwaionResearchDelivery,
  deleteDwaionSecureAttachment,
  downloadDwaionResearchRun,
  executeDwaionResearchRun,
  secureAttachmentUploadUrl,
} from './agent-user-advancement-api';
import {
  parseDwaionAttachmentEvidence,
  parseDwaionResearchCapabilities,
  parseDwaionResearchDelivery,
  parseDwaionResearchPlan,
  parseDwaionResearchRun,
  parseDwaionSecureAttachment,
} from './agent-user-advancement-parser';

const ID = '00000000-0000-4000-8000-000000000901';
const ID2 = '00000000-0000-4000-8000-000000000902';
const ID3 = '00000000-0000-4000-8000-000000000903';
const SHA = 'a'.repeat(64);

function capability() {
  return { available: true, configured: true, reasonCode: null, recoveryHint: null };
}

function unavailableCapability() {
  return {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint: 'Configure the governed provider.',
  };
}

function attachment() {
  return {
    attachmentId: ID,
    conversationId: null,
    fileName: 'budget.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 1200,
    sourceSha256: SHA,
    revision: 1,
    state: 'UPLOADING',
    stages: [
      {
        key: 'UPLOAD',
        state: 'RUNNING',
        providerCode: null,
        observedAt: null,
        safeErrorCode: null,
        recoveryHint: null,
      },
    ],
    citations: [],
    retentionExpiresAt: '2099-09-18T00:00:00Z',
    capabilities: {
      upload: capability(),
      antivirus: capability(),
      dlp: capability(),
      parser: capability(),
      ocr: capability(),
      index: capability(),
      deletion: capability(),
      detachAll: capability(),
      inspectionLog: capability(),
      maskingHistory: capability(),
      ocrViewer: capability(),
      signedAuditReport: unavailableCapability(),
      maximumFileBytes: 104_857_600,
      allowedMediaTypes: ['application/pdf'],
    },
    uploadTicket: {
      method: 'PUT',
      uploadUrl: '/api/agent/v1/attachments/upload/ticket',
      uploadReference: 'opaque-upload-reference',
      expiresAt: '2099-09-17T00:10:00Z',
    },
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
    deletedAt: null,
  };
}

function plan() {
  return {
    planId: ID,
    state: 'READY',
    revision: 2,
    definition: {
      goal: 'Compare governed cloud infrastructure costs.',
      question: 'Which governed cloud option offers the best verified value?',
      successCriteria: ['Verify three source ledgers'],
      deliverableTypes: ['REPORT', 'COMPARISON'],
      sourcePolicies: [{ sourceKey: 'WORK_ITEM', allowed: true, scope: 'Current user scope' }],
      requireAllAllowedSources: true,
      budget: { maximumMinutes: 45, maximumSources: 30, maximumTokens: 50_000 },
    },
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:01:00Z',
  };
}

function run(state = 'RUNNING') {
  return {
    runId: ID,
    planId: ID2,
    planRevision: 2,
    state,
    version: 3,
    progress: {
      completedSteps: state === 'QUEUED' ? 0 : 1,
      totalSteps: 4,
      discoveredSources: 2,
      verifiedCitations: 1,
      failedSources: [],
      recoveryHint: null,
    },
    result: null,
    receiptId: null,
    safeErrorCode: null,
    startedAt: state === 'QUEUED' ? null : '2026-09-17T00:01:00Z',
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:02:00Z',
    completedAt: null,
  };
}

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify({ success: true, data }),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON user advancement contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('requires every material research output and recovery capability', () => {
    const capabilities = Object.fromEntries(
      [
        'rawExport',
        'pdfExport',
        'receiptDownload',
        'auditDownload',
        'fork',
        'merge',
        'keepLocal',
        'sensitivityRecalculation',
        'cacheFallback',
      ].map((key) => [key, unavailableCapability()])
    );
    const delivery = {
      artifact: capability(),
      proposal: unavailableCapability(),
      export: capability(),
      handoff: unavailableCapability(),
      share: unavailableCapability(),
      routine: unavailableCapability(),
    };
    Object.assign(capabilities, { delivery });
    expect(parseDwaionResearchCapabilities(capabilities).pdfExport.available).toBe(false);
    expect(parseDwaionResearchCapabilities(capabilities).delivery.artifact.available).toBe(true);
    expect(() =>
      parseDwaionResearchCapabilities({ ...capabilities, cacheFallback: undefined })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(
      parseDwaionResearchCapabilities({ ...capabilities, rawExport: capability() }).rawExport
        .available
    ).toBe(true);
    expect(
      parseDwaionResearchCapabilities({
        ...capabilities,
        fork: capability(),
        pdfExport: capability(),
      })
    ).toMatchObject({ fork: { available: true }, pdfExport: { available: true } });
    expect(() =>
      parseDwaionResearchCapabilities({
        ...capabilities,
        delivery: { ...delivery, routine: undefined },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('rejects completed downstream delivery without a target-system receipt', () => {
    const completed = {
      deliveryId: ID3,
      runId: ID,
      deliveryType: 'HANDOFF',
      state: 'COMPLETED',
      receiptId: ID2,
      receipt: null,
      safeErrorCode: null,
      recoveryHint: null,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:01:00Z',
      completedAt: '2026-09-17T00:01:00Z',
    };

    expect(() => parseDwaionResearchDelivery(completed)).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(
      parseDwaionResearchDelivery({
        ...completed,
        receipt: {
          targetPath: `/approvals/requests/${ID}`,
          resultSha256: SHA,
          providerReceiptId: 'approval-receipt-1',
        },
      })
    ).toMatchObject({ state: 'COMPLETED', receiptId: ID2 });
  });

  it('downloads only non-empty server-produced research artifacts', async () => {
    const blob = new Blob(['{"receipt":"sealed"}'], { type: 'application/json' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => blob,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadDwaionResearchRun(ID, 'receipt')).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/agent/v1/research/runs/${ID}/downloads/receipt`,
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
  });

  it('binds ordered attachment inspection, masking, and OCR evidence', () => {
    const citation = {
      citationId: 'ocr-page-1',
      locator: 'page:1',
      label: 'OCR page 1',
      contentSha256: SHA,
    };
    const first = {
      eventId: '00000000-0000-4000-8000-000000000904',
      eventType: 'ATTACHMENT_SCANNING_STARTED',
      previousState: 'UPLOADING',
      currentState: 'SCANNING',
      revision: 2,
      safeErrorCode: null,
      occurredAt: '2026-09-17T00:01:00Z',
    };
    const masked = {
      ...first,
      eventId: '00000000-0000-4000-8000-000000000905',
      eventType: 'DLP_MASK_APPLIED',
      revision: 3,
      occurredAt: '2026-09-17T00:02:00Z',
    };
    const evidence = {
      attachmentId: ID,
      sourceSha256: SHA,
      stages: [
        {
          key: 'OCR',
          state: 'PASSED',
          providerCode: 'OCR_OK',
          observedAt: '2026-09-17T00:03:00Z',
          safeErrorCode: null,
          recoveryHint: null,
        },
      ],
      citations: [citation],
      inspectionLog: [first, masked],
      maskingHistory: [masked],
      ocrEvidence: [citation],
    } as const;
    expect(parseDwaionAttachmentEvidence(evidence).maskingHistory).toHaveLength(1);
    expect(() =>
      parseDwaionAttachmentEvidence({
        ...evidence,
        maskingHistory: [{ ...masked, eventType: 'DLP_SCAN_COMPLETED' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionAttachmentEvidence({
        ...evidence,
        stages: [{ ...evidence.stages[0], state: 'NOT_REQUIRED' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('accepts canonical attachment states and rejects lifecycle contradictions', () => {
    expect(parseDwaionSecureAttachment(attachment()).state).toBe('UPLOADING');
    expect(
      parseDwaionSecureAttachment({
        ...attachment(),
        capabilities: {
          ...attachment().capabilities,
          signedAuditReport: capability(),
          detachAll: capability(),
        },
      }).capabilities
    ).toMatchObject({ signedAuditReport: { available: true }, detachAll: { available: true } });
    expect(
      parseDwaionSecureAttachment({
        ...attachment(),
        revision: 2,
        state: 'DELETION_PENDING',
        uploadTicket: null,
        deletionAttemptCount: 2,
        deletionLastErrorCode: 'ATTACHMENT_PROVIDER_UNAVAILABLE',
        deletionReceiptId: null,
      })
    ).toMatchObject({
      state: 'DELETION_PENDING',
      deletionAttemptCount: 2,
      deletionLastErrorCode: 'ATTACHMENT_PROVIDER_UNAVAILABLE',
    });
    expect(() => parseDwaionSecureAttachment({ ...attachment(), state: 'READY' })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionSecureAttachment({
        ...attachment(),
        state: 'DELETED',
        uploadTicket: null,
        deletedAt: null,
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionSecureAttachment({
        ...attachment(),
        revision: 2,
        state: 'DELETED',
        uploadTicket: null,
        deletedAt: '2026-09-17T00:02:00Z',
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionSecureAttachment({
        ...attachment(),
        revision: 2,
        state: 'DELETED',
        uploadTicket: null,
        deletedAt: '2026-09-17T00:02:00Z',
        deletionReceiptId: '   ',
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionSecureAttachment({
        ...attachment(),
        stages: [{ ...attachment().stages[0], key: 'MALWARE' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('validates every material research-plan field', () => {
    expect(parseDwaionResearchPlan(plan()).state).toBe('READY');
    for (const candidate of [
      { ...plan(), state: 'RUNNING' },
      { ...plan(), definition: { ...plan().definition, successCriteria: ['same', 'same'] } },
      { ...plan(), definition: { ...plan().definition, question: 'short' } },
      { ...plan(), definition: { ...plan().definition, deliverableTypes: ['REPORT', 'BAD'] } },
      { ...plan(), definition: { ...plan().definition, requireAllAllowedSources: 'yes' } },
      {
        ...plan(),
        definition: {
          ...plan().definition,
          sourcePolicies: [{ sourceKey: 'bad', allowed: true, scope: 'x' }],
        },
      },
      {
        ...plan(),
        definition: {
          ...plan().definition,
          budget: { maximumMinutes: 0, maximumSources: 1, maximumTokens: 128 },
        },
      },
    ]) {
      expect(() => parseDwaionResearchPlan(candidate)).toThrowError(
        expect.objectContaining({ status: 502 })
      );
    }
  });

  it('allows nullable queued start time and fails closed on invalid run invariants', () => {
    expect(parseDwaionResearchRun(run('QUEUED')).startedAt).toBeNull();
    expect(() => parseDwaionResearchRun({ ...run(), startedAt: null })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionResearchRun({ ...run('COMPLETED'), completedAt: '2026-09-17T00:10:00Z' })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionResearchRun({
        ...run(),
        progress: { ...run().progress, completedSteps: 5, totalSteps: 4 },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('reuses the caller execution command when a queued run is reauthorized', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(run('QUEUED')))
      .mockResolvedValueOnce(response(run('QUEUED')));
    vi.stubGlobal('fetch', fetchMock);

    await executeDwaionResearchRun(ID, 3, ID2);
    await executeDwaionResearchRun(ID, 3, ID2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/research/runs/${ID}/execute`,
      expect.objectContaining({ body: expect.stringContaining(`"commandId":"${ID2}"`) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/research/runs/${ID}/execute`,
      expect.objectContaining({ body: expect.stringContaining(`"commandId":"${ID2}"`) })
    );
  });

  it('rejects untrusted upload origins before any bytes are sent', () => {
    expect(secureAttachmentUploadUrl('/api/agent/v1/attachments/upload/ticket').pathname).toContain(
      '/attachments/upload/ticket'
    );
    expect(() => secureAttachmentUploadUrl('https://attacker.example/upload')).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() => secureAttachmentUploadUrl('https://user:secret@example.test/upload')).toThrowError(
      expect.objectContaining({ status: 502 })
    );
  });

  it('uses the Agent DELETE attachment contract with its governed command body', async () => {
    const deleted = {
      ...attachment(),
      revision: 2,
      state: 'DELETED',
      uploadTicket: null,
      updatedAt: '2026-09-17T00:02:00Z',
      deletedAt: '2026-09-17T00:02:00Z',
      deletionAttemptCount: 1,
      deletionLastErrorCode: null,
      deletionReceiptId: 'provider-deletion-receipt-1',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(deleted));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteDwaionSecureAttachment(ID, 1, ID2)).resolves.toMatchObject({
      attachmentId: ID,
      state: 'DELETED',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/attachments/${ID}`,
      expect.objectContaining({
        method: 'DELETE',
        body: expect.stringContaining(`"commandId":"${ID2}"`),
      })
    );
  });

  it('keeps an integrity mismatch blocked after the provider upload is observed', async () => {
    const reserved = attachment();
    const blocked = {
      ...reserved,
      state: 'BLOCKED',
      revision: 2,
      uploadTicket: null,
      stages: [
        {
          ...reserved.stages[0],
          state: 'BLOCKED',
          safeErrorCode: 'ATTACHMENT_INTEGRITY_MISMATCH',
        },
      ],
    };
    const uploadResponse = {
      ok: true,
      status: 200,
      headers: new Headers({
        'X-DWP-Observed-Size': '4',
        'X-DWP-Observed-SHA256': 'b'.repeat(64),
      }),
    } as Response;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(reserved))
      .mockResolvedValueOnce(uploadResponse)
      .mockResolvedValueOnce(response(blocked));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'budget.pdf', {
      type: 'application/pdf',
    });

    const result = await createDwaionSecureAttachment(file, {
      createCommandId: ID2,
      completeCommandId: ID3,
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    const completionBody = JSON.parse(String(fetchMock.mock.calls[3]![1]?.body));
    expect(completionBody.observedSha256).toBe('b'.repeat(64));
    expect(completionBody.observedSha256).not.toBe(createBody.sourceSha256);
    expect(result.state).toBe('BLOCKED');
    expect(result.stages[0]?.safeErrorCode).toBe('ATTACHMENT_INTEGRITY_MISMATCH');
  });

  it('reuses caller-owned command and idempotency identities on retry', async () => {
    const delivery = {
      deliveryId: ID3,
      runId: ID,
      deliveryType: 'ARTIFACT',
      state: 'QUEUED',
      receiptId: null,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      completedAt: null,
    };
    const handoff = {
      handoffId: ID3,
      proposalId: ID,
      actionKey: 'APPROVAL.REQUEST.CREATE',
      state: 'REVIEW_REQUIRED',
      version: 1,
      targetRoute: '/approvals/requests/new',
      approvalRequired: true,
      receiptId: null,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(delivery))
      .mockResolvedValueOnce(response(delivery))
      .mockResolvedValueOnce(response(handoff));
    vi.stubGlobal('fetch', fetchMock);
    const attempt = { commandId: ID2, idempotencyKey: ID3 };

    await createDwaionResearchDelivery(ID, 3, 'ARTIFACT', attempt);
    await createDwaionResearchDelivery(ID, 3, 'ARTIFACT', attempt);
    await createDwaionProposalHandoff(ID, 2, {}, attempt);

    const bodies = [2, 3, 4].map((call) =>
      JSON.parse(String(fetchMock.mock.calls[call - 1]![1]?.body))
    );
    expect(bodies.every((body) => body.commandId === ID2 && body.idempotencyKey === ID3)).toBe(
      true
    );
  });

  it('sends reviewed handoff and share targets to the governed provider request', async () => {
    const delivery = {
      deliveryId: ID3,
      runId: ID,
      deliveryType: 'HANDOFF',
      state: 'QUEUED',
      receiptId: null,
      createdAt: '2026-09-17T00:00:00Z',
      updatedAt: '2026-09-17T00:00:00Z',
      completedAt: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(delivery))
      .mockResolvedValueOnce(response({ ...delivery, deliveryType: 'SHARE' }));
    vi.stubGlobal('fetch', fetchMock);
    const attempt = { commandId: ID2, idempotencyKey: ID3 };

    await createDwaionResearchDelivery(ID, 3, 'HANDOFF', attempt, {
      locale: 'ko-KR',
      approvalTarget: 'finance-approvers',
      requestTitle: '시장 조사 결과 검토',
      requestReason: '검증된 결과를 결재 요청으로 인계합니다.',
      requestMetadata: { source: 'DEEP_RESEARCH', researchRunId: ID },
    });
    await createDwaionResearchDelivery(ID, 3, 'SHARE', attempt, {
      locale: 'ko-KR',
      recipientIds: ['member-2'],
      teamId: 'strategy-team',
      permission: 'COMMENT',
      expiresAt: '2099-09-24T00:00:00Z',
    });

    const handoffBody = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    const shareBody = JSON.parse(String(fetchMock.mock.calls[2]![1]?.body));
    expect(handoffBody.parameters).toMatchObject({
      approvalTarget: 'finance-approvers',
      requestMetadata: { source: 'DEEP_RESEARCH', researchRunId: ID },
    });
    expect(shareBody.parameters).toEqual({
      locale: 'ko-KR',
      recipientIds: ['member-2'],
      teamId: 'strategy-team',
      permission: 'COMMENT',
      expiresAt: '2099-09-24T00:00:00Z',
    });
  });
});
