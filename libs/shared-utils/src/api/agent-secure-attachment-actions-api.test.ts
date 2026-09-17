import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionAttachmentAuditReport,
  detachDwaionConversationAttachments,
  downloadDwaionAttachmentAuditReport,
  parseDwaionAttachmentAuditReportReceipt,
} from './agent-secure-attachment-actions-api';

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const ATTACHMENT_ID = '22222222-2222-4222-8222-222222222222';
const COMMAND_ID = '33333333-3333-4333-8333-333333333333';
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444';
const REPORT_ID = '55555555-5555-4555-8555-555555555555';

const selection = [{ attachmentId: ATTACHMENT_ID, expectedRevision: 3 }] as const;
const attempt = { commandId: COMMAND_ID, idempotencyKey: IDEMPOTENCY_KEY } as const;
const detachReceipt = {
  receiptId: '66666666-6666-4666-8666-666666666666',
  commandId: COMMAND_ID,
  conversationId: CONVERSATION_ID,
  detachedAttachments: [{ attachmentId: ATTACHMENT_ID, revision: 4 }],
  integrityFingerprint: 'a'.repeat(64),
  detachedAt: '2026-09-17T03:00:00Z',
} as const;
const reportReceipt = {
  reportId: REPORT_ID,
  commandId: COMMAND_ID,
  conversationId: CONVERSATION_ID,
  attachmentIds: [ATTACHMENT_ID],
  contentSha256: 'b'.repeat(64),
  signatureAlgorithm: 'Ed25519',
  signature: 'sealed-signature',
  signingKeyFingerprint: 'c'.repeat(64),
  downloadPath: `/v1/attachments/audit-reports/${REPORT_ID}/download`,
  createdAt: '2026-09-17T03:01:00Z',
} as const;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON secure attachment actions API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('binds detach-all and signed report issuance to selected attachment revisions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: detachReceipt }))
      .mockResolvedValueOnce(response({ success: true, data: reportReceipt }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      detachDwaionConversationAttachments(CONVERSATION_ID, selection, attempt)
    ).resolves.toMatchObject({ detachedAttachments: [{ revision: 4 }] });
    await expect(
      createDwaionAttachmentAuditReport(CONVERSATION_ID, selection, attempt)
    ).resolves.toMatchObject({ reportId: REPORT_ID, signatureAlgorithm: 'Ed25519' });
    expect(fetchMock.mock.calls.slice(1).map((call) => String(call[0]))).toEqual([
      `/api/agent/v1/attachments/conversations/${CONVERSATION_ID}/detach-all`,
      `/api/agent/v1/attachments/conversations/${CONVERSATION_ID}/audit-reports`,
    ]);
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect(JSON.parse(String(call[1]?.body))).toMatchObject({
        commandId: COMMAND_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        attachments: selection,
      });
    }
  });

  it('rejects duplicate selections, forged download bindings, and empty downloads', async () => {
    await expect(
      detachDwaionConversationAttachments(CONVERSATION_ID, [...selection, ...selection], attempt)
    ).rejects.toThrow('Attachment selection is duplicated.');
    expect(() =>
      parseDwaionAttachmentAuditReportReceipt({
        ...reportReceipt,
        downloadPath: `/v1/attachments/audit-reports/${COMMAND_ID}/download`,
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob([]),
        headers: new Headers({ 'Content-Type': 'application/pdf' }),
      } as Response)
    );
    await expect(downloadDwaionAttachmentAuditReport(REPORT_ID)).rejects.toMatchObject({
      status: 502,
    });
  });
});
