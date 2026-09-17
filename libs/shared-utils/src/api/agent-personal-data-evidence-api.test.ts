import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  buildDwaionBackupLedgerSnapshot,
  downloadDwaionPersonalDataCertificate,
  downloadDwaionPersonalDataLegalHoldEvidence,
  downloadDwaionPersonalDataReceiptIndex,
  executeDwaionPersonalDataEvidenceAction,
  getDwaionPersonalDataEvidenceAction,
  parseDwaionPersonalDataEvidenceCommand,
} from './agent-personal-data-evidence-api';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const COMMAND_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_ID = '33333333-3333-4333-8333-333333333333';

const completed = {
  commandId: COMMAND_ID,
  deletionJobId: JOB_ID,
  action: 'SIGNED_CERTIFICATE',
  state: 'COMPLETED',
  expectedRevision: 2,
  receiptId: RECEIPT_ID,
  providerReceiptId: 'certificate-provider-2',
  resultFingerprint: 'a'.repeat(64),
  result: {
    signature: 'signed-provider-payload',
    signingKeyId: 'tenant-signing-key-1',
    signingAlgorithm: 'ED25519',
    evidenceDigest: '1'.repeat(64),
    signedPayloadSha256: '2'.repeat(64),
    signedPayloadBase64Url: 'signed-payload-base64url',
    signingKeyFingerprint: '3'.repeat(64),
    documentSha256: '4'.repeat(64),
  },
  safeErrorCode: null,
  recoveryHint: null,
  downloadAvailable: true,
  createdAt: '2026-09-17T02:59:00Z',
  completedAt: '2026-09-17T03:00:00Z',
} as const;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI.ON personal-data evidence API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('executes and reads a signed certificate command with terminal receipt evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { token: 'csrf', headerName: 'X-XSRF-TOKEN' } }))
      .mockResolvedValueOnce(response({ success: true, data: completed }, 201))
      .mockResolvedValueOnce(response({ success: true, data: completed }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      executeDwaionPersonalDataEvidenceAction(JOB_ID, 2, 'SIGNED_CERTIFICATE', COMMAND_ID)
    ).resolves.toMatchObject({ receiptId: RECEIPT_ID, downloadAvailable: true });
    await expect(getDwaionPersonalDataEvidenceAction(JOB_ID, COMMAND_ID)).resolves.toMatchObject({
      providerReceiptId: 'certificate-provider-2',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/personal-data/deletions/${JOB_ID}/evidence-actions/SIGNED_CERTIFICATE`,
      expect.objectContaining({ body: expect.stringContaining(COMMAND_ID) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/agent/v1/personal-data/deletions/${JOB_ID}/evidence-actions/${COMMAND_ID}`,
      expect.any(Object)
    );
  });

  it('enforces terminal/download invariants and downloads all three server artifacts', async () => {
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({ ...completed, downloadAvailable: false })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({
        ...completed,
        state: 'PENDING',
        receiptId: null,
        resultFingerprint: null,
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({ ...completed, providerReceiptId: '   ' })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({ ...completed, providerReceiptId: null })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({ ...completed, result: null })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({
        ...completed,
        safeErrorCode: 'PROVIDER_FAILED',
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionPersonalDataEvidenceCommand({
        ...completed,
        recoveryHint: 'Retry after repairing the provider.',
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));

    const failed = {
      ...completed,
      action: 'SIEM_SYNC',
      state: 'FAILED',
      providerReceiptId: null,
      result: { providerAccepted: false },
      safeErrorCode: 'PROVIDER_FAILED',
      recoveryHint: 'Repair the provider and retry with the same command ID.',
      downloadAvailable: false,
    } as const;
    expect(parseDwaionPersonalDataEvidenceCommand(failed)).toMatchObject({ state: 'FAILED' });
    for (const invalid of [
      { ...failed, result: null },
      { ...failed, safeErrorCode: null },
      { ...failed, recoveryHint: null },
    ]) {
      expect(() => parseDwaionPersonalDataEvidenceCommand(invalid)).toThrowError(
        expect.objectContaining({ status: 502 })
      );
    }

    const pending = {
      ...completed,
      state: 'PENDING',
      receiptId: null,
      providerReceiptId: null,
      resultFingerprint: null,
      result: null,
      safeErrorCode: null,
      recoveryHint: null,
      downloadAvailable: false,
      completedAt: null,
    } as const;
    expect(parseDwaionPersonalDataEvidenceCommand(pending)).toMatchObject({ state: 'PENDING' });
    for (const invalid of [
      { ...pending, receiptId: RECEIPT_ID },
      { ...pending, providerReceiptId: 'pending-provider-receipt' },
      { ...pending, resultFingerprint: 'b'.repeat(64) },
      { ...pending, result: { accepted: true } },
      { ...pending, safeErrorCode: 'PENDING_ERROR' },
      { ...pending, recoveryHint: 'Pending recovery hint.' },
      { ...pending, completedAt: '2026-09-17T03:00:00Z' },
      { ...pending, downloadAvailable: true },
    ]) {
      expect(() => parseDwaionPersonalDataEvidenceCommand(invalid)).toThrowError(
        expect.objectContaining({ status: 502 })
      );
    }

    const jsonBlob = new Blob(['{"sealed":true}'], { type: 'application/json' });
    const pdfBlob = new Blob(['signed-certificate'], { type: 'application/pdf' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(blobResponse(jsonBlob))
      .mockResolvedValueOnce(blobResponse(jsonBlob))
      .mockResolvedValueOnce(blobResponse(pdfBlob));
    vi.stubGlobal('fetch', fetchMock);
    await expect(downloadDwaionPersonalDataReceiptIndex()).resolves.toBe(jsonBlob);
    await expect(downloadDwaionPersonalDataLegalHoldEvidence(JOB_ID)).resolves.toBe(jsonBlob);
    await expect(downloadDwaionPersonalDataCertificate(JOB_ID, COMMAND_ID)).resolves.toBe(pdfBlob);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      '/api/agent/v1/personal-data/deletions/evidence/receipt-index.json',
      `/api/agent/v1/personal-data/deletions/${JOB_ID}/evidence/legal-hold.json`,
      `/api/agent/v1/personal-data/deletions/${JOB_ID}/evidence-actions/${COMMAND_ID}/download`,
    ]);
  });

  it('requires typed action effects and builds a job-bound backup-ledger JSON snapshot', async () => {
    const backup = parseDwaionPersonalDataEvidenceCommand({
      ...completed,
      action: 'BACKUP_LEDGER',
      result: {
        schemaVersion: 1,
        ledgerScope: 'latest',
        destroyedPartitionIds: ['backup-partition-1'],
        retainedPartitionIds: [],
        ledgerEntryIds: ['ledger-entry-1'],
        observedAt: '2026-09-17T03:00:00Z',
      },
      downloadAvailable: false,
    });
    const snapshot = JSON.parse(await buildDwaionBackupLedgerSnapshot(backup).text()) as Record<
      string,
      unknown
    >;
    expect(snapshot).toMatchObject({
      schema: 'dwp.personal-data.backup-ledger-snapshot.v1',
      deletionJobId: JOB_ID,
      commandId: COMMAND_ID,
      receiptId: RECEIPT_ID,
      providerReceiptId: 'certificate-provider-2',
      resultFingerprint: 'a'.repeat(64),
    });
    expect(snapshot.result).toMatchObject({ ledgerEntryIds: ['ledger-entry-1'] });

    for (const invalid of [
      { ...backup, result: {} },
      { ...backup, result: { ...backup.result, ledgerEntryIds: [] } },
      {
        ...backup,
        result: {
          ...backup.result,
          retainedPartitionIds: ['backup-partition-1'],
        },
      },
    ]) {
      expect(() => parseDwaionPersonalDataEvidenceCommand(invalid)).toThrowError(
        expect.objectContaining({ status: 502 })
      );
    }
  });
});

function blobResponse(blob: Blob): Response {
  return {
    ok: true,
    status: 200,
    blob: async () => blob,
    headers: new Headers({ 'Content-Type': blob.type }),
  } as Response;
}
