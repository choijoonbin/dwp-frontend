import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionSecureAttachment,
  createDwaionProposalHandoff,
  createDwaionResearchDelivery,
  secureAttachmentUploadUrl,
} from './agent-user-advancement-api';
import {
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

  it('accepts canonical attachment states and rejects lifecycle contradictions', () => {
    expect(parseDwaionSecureAttachment(attachment()).state).toBe('UPLOADING');
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
});
