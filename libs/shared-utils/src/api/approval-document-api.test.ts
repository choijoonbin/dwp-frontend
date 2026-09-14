import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  appendApprovalDocumentComment,
  exportApprovalArchive,
  exportApprovalDocument,
  getApprovalDocumentComments,
  getApprovalDocumentTools,
  publishApprovalDocumentHold,
  publishApprovalDocumentPolicy,
  saveApprovalDocumentPolicy,
  verifyApprovalGeneratedDocument,
} from './approval-document-api';

import type {
  ApprovalDocumentRules,
  ApprovalGeneratedDocument,
} from './approval-document-contract';

const requestId = '00000000-0000-0000-0000-000000000001';
const taskId = '00000000-0000-0000-0000-000000000002';
const policyId = '00000000-0000-0000-0000-000000000003';
const owner = { type: 'REQUEST', id: requestId } as const;
const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const allowed = { allowed: true, reason: 'ALLOWED' };
function tools() {
  return {
    requestId,
    taskId: null,
    requestVersion: 0,
    taskVersion: null,
    payloadRevision: 1,
    payloadSha256: 'a'.repeat(64),
    policyVersion: 2,
    commentsVersion: 0,
    holdVersion: 0,
    legalHold: false,
    copyIdentifier: allowed,
    history: allowed,
    comment: allowed,
    print: allowed,
    jsonExport: allowed,
    attachments: allowed,
    evaluatedAt: new Date().toISOString(),
    policyId,
    resourceSetKey: 'RS_APPROVALS',
    archiveExport: allowed,
    maxBatchItems: 20,
    preservationPending: false,
  };
}
function response(data: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify({ data }) } as Response;
}
function transport(data: unknown) {
  const mock = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        response(url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data)
      )
    );
  vi.stubGlobal('fetch', mock);
  return mock;
}
async function generated(
  intent: 'PRINT' | 'DOWNLOAD' = 'DOWNLOAD'
): Promise<ApprovalGeneratedDocument> {
  const content =
    intent === 'PRINT'
      ? '<!doctype html><html><body>검토 문서</body></html>'
      : '{"title":"검토 문서","amount":"99999999999999.12345678"}';
  const bytes = new TextEncoder().encode(content);
  const digest = await webcrypto.subtle.digest('SHA-256', bytes);
  return {
    exportId: taskId,
    format: intent === 'PRINT' ? 'HTML' : 'JSON',
    mediaType: intent === 'PRINT' ? 'text/html' : 'application/json',
    fileName: `approval-${taskId}.${intent === 'PRINT' ? 'html' : 'json'}`,
    sha256: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
      ''
    ),
    sizeBytes: bytes.byteLength,
    policyVersion: 2,
    generatedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    retainUntil: new Date(Date.now() + 86400000).toISOString(),
    content,
  };
}
const rules: ApprovalDocumentRules = {
  allowComments: true,
  allowPrint: false,
  allowJsonExport: false,
  allowArchiveExport: false,
  includeComments: false,
  includeEvidence: false,
  allowedClassifications: [],
  fields: [],
  maxBatchItems: 20,
  maxBytes: 1048576,
  snapshotTtlSeconds: 300,
  evidenceRetentionDays: 365,
};

describe('approval document boundary', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses the fixed scoped owner source and accepts real version zero', async () => {
    const fetch = transport(tools());
    const data = await getApprovalDocumentTools(owner, 'opaque-current');
    expect(data.requestVersion).toBe(0);
    expect(fetch.mock.calls[0][0]).toBe(
      `/api/approvals/v1/requests/${requestId}/document-tools?contextScopeKey=opaque-current`
    );
    expect(Object.isFrozen(data)).toBe(true);
  });
  it.each([
    { requestId: taskId },
    { taskVersion: 1 },
    { payloadSha256: 'bad' },
    { maxBatchItems: 51 },
    { comment: { allowed: 'yes', reason: 'ALLOWED' } },
    { preservationPending: undefined },
  ])('rejects mismatched tool evidence %j', async (change) => {
    transport({ ...tools(), ...change });
    await expect(getApprovalDocumentTools(owner)).rejects.toThrow();
  });
  it('rejects private child rows belonging to a different request', async () => {
    transport({
      items: [
        {
          commentId: policyId,
          requestId: taskId,
          sourceTaskId: null,
          sequence: 1,
          authorUserId: 1,
          text: 'Review',
          createdAt: new Date().toISOString(),
          retainUntil: new Date().toISOString(),
        },
      ],
      totalElements: 1,
      page: 0,
      size: 25,
      commentsVersion: 1,
      evaluatedAt: new Date().toISOString(),
    });
    await expect(getApprovalDocumentComments(owner)).rejects.toThrow();
  });
  it('preserves the original comment command identity and both CAS preconditions', async () => {
    const fetch = transport({ commentId: policyId });
    const input = {
      expectedVersion: 0,
      expectedCommentsVersion: 3,
      idempotencyKey: 'comment:original',
      text: '검토 의견',
    };
    await appendApprovalDocumentComment(owner, input, execution);
    const [, init] = fetch.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(JSON.parse(init.body)).toEqual(input);
    expect(init.headers['Idempotency-Key']).toBe(input.idempotencyKey);
  });
  it.each(['PRINT', 'DOWNLOAD'] as const)(
    'verifies actual UTF-8 bytes and immutable %s format',
    async (intent) => {
      const data = await generated(intent);
      expect(data.sizeBytes).toBeGreaterThan(data.content.length);
      await expect(verifyApprovalGeneratedDocument(data, 2, intent)).resolves.toEqual(data);
      transport(data);
      await expect(
        exportApprovalDocument(
          owner,
          {
            expectedVersion: 0,
            payloadRevision: 1,
            expectedPolicyVersion: 2,
            reason: 'Current review',
            idempotencyKey: 'export:original',
            intent,
          },
          execution
        )
      ).resolves.toEqual(data);
    }
  );
  it.each([
    { content: 'tampered' },
    { sha256: 'b'.repeat(64) },
    { sizeBytes: 1 },
    { policyVersion: 3 },
    { expiresAt: '2000-01-01T00:00:00Z' },
    { fileName: '../../private.json' },
    { mediaType: 'application/pdf' },
    { generatedAt: '2999-01-01T00:00:00Z' },
  ])('rejects unsafe generated data %j', async (change) => {
    await expect(
      verifyApprovalGeneratedDocument(
        { ...(await generated()), ...change } as ApprovalGeneratedDocument,
        2,
        'DOWNLOAD'
      )
    ).rejects.toThrow();
  });
  it('rejects duplicate archive items and borrowed secure keys before even CSRF', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const item = { requestId, expectedVersion: 0, payloadRevision: 1 };
    await expect(
      exportApprovalArchive(
        {
          items: [item, item],
          expectedPolicyVersion: 2,
          expectedPolicyId: policyId,
          resourceSetKey: 'RS_APPROVALS',
          reason: 'Archive review',
          idempotencyKey: 'original',
        },
        execution
      )
    ).rejects.toThrow();
    await expect(
      appendApprovalDocumentComment(
        owner,
        {
          expectedVersion: 0,
          expectedCommentsVersion: 0,
          text: 'Review',
          idempotencyKey: 'borrowed',
        },
        {
          mode: 'SECURE',
          rolloutState: '110',
          expectedDecisionRevision: 'current',
          contextKey: 'context',
          contextScopeKey: 'scope',
          idempotencyKey: 'original',
        }
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never allows new HIGH policy/hold publication through legacy compatibility', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const input = {
      expectedVersion: 0,
      idempotencyKey: 'publish:original',
      reviewComment: 'Independent review',
    };
    await expect(publishApprovalDocumentPolicy(policyId, input, execution)).rejects.toThrow();
    await expect(
      publishApprovalDocumentHold(requestId, { ...input, proposalId: policyId }, execution)
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires exact secure object version, challenge and command key for publication', async () => {
    const fetch = transport({ policyId });
    const secure = {
      mode: 'SECURE',
      rolloutState: '110',
      expectedDecisionRevision: 'current',
      contextKey: 'context',
      contextScopeKey: 'scope',
      idempotencyKey: 'publish:original',
      objectVersion: 0,
      stepUp: {
        challenge: 'signed',
        challengeId: 'challenge',
        decisionRevision: 'current',
        expiresAt: new Date(Date.now() + 30000).toISOString(),
      },
    } as const;
    await publishApprovalDocumentPolicy(
      policyId,
      {
        expectedVersion: 0,
        idempotencyKey: 'publish:original',
        reviewComment: 'Independent review',
      },
      secure
    );
    const [, init] = fetch.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(init.headers).toMatchObject({
      'X-DWP-Step-Up-Challenge': 'signed',
      'Idempotency-Key': 'publish:original',
    });
    expect(init.headers).not.toHaveProperty('X-DWP-Expected-Object-Version');
    expect(JSON.parse(init.body).expectedVersion).toBe(secure.objectVersion);
    const calls = fetch.mock.calls.length;
    await expect(
      publishApprovalDocumentPolicy(
        policyId,
        {
          expectedVersion: 1,
          idempotencyKey: 'publish:original',
          reviewComment: 'Independent review',
        },
        secure
      )
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
  it('checks complete policy bounds and decimal/repeating typed rules before transport', async () => {
    const fetch = transport({ policyId });
    await saveApprovalDocumentPolicy(
      policyId,
      {
        expectedVersion: 0,
        idempotencyKey: 'policy:original',
        rules: {
          ...rules,
          fields: [
            {
              key: 'lines',
              type: 'OBJECT_LIST',
              maxLength: 100,
              maxRows: 50,
              children: [
                {
                  key: 'amount',
                  type: 'DECIMAL_STRING',
                  maxLength: 100,
                  maxRows: null,
                  children: [],
                },
              ],
            },
          ],
        },
      },
      execution
    );
    const calls = fetch.mock.calls.length;
    expect(() =>
      saveApprovalDocumentPolicy(
        policyId,
        {
          expectedVersion: 0,
          idempotencyKey: 'policy:new',
          rules: { ...rules, snapshotTtlSeconds: 59 },
        },
        execution
      )
    ).toThrow();
    expect(() =>
      saveApprovalDocumentPolicy(
        policyId,
        {
          expectedVersion: 0,
          idempotencyKey: 'policy:new',
          rules: { ...rules, allowJsonExport: true },
        },
        execution
      )
    ).toThrow();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
