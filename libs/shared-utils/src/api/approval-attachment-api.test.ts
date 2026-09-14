import { Blob as NodeBlob } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  ApprovalAttachmentResponseError,
  cancelApprovalAttachmentUpload,
  createApprovalAttachmentDownloadGrant,
  createApprovalRequestAttachmentDownloadGrant,
  createApprovalTaskAttachmentDownloadGrant,
  getApprovalAttachments,
  loadApprovalAttachmentDownload,
  reconcileApprovalAttachmentUpload,
  reserveApprovalAttachmentUpload,
  selectApprovalAttachments,
  uploadApprovalAttachmentContent,
} from './approval-attachment-api';
import {
  readApprovalAttachments,
  readApprovalAttachmentUpload,
} from './approval-attachment-contract';

import type { ApprovalAttachments, ApprovalAttachmentUpload } from './approval-attachment-contract';

const requestId = '11111111-1111-1111-1111-111111111111';
const uploadId = '22222222-2222-2222-2222-222222222222';
const attachmentId = '33333333-3333-3333-3333-333333333333';
const bytes = new TextEncoder().encode('검증한 전자결재 증빙\n');
const hash = createHash('sha256').update(bytes).digest('hex');
const key = 'original-attachment-command:1';
const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;
const reserve = {
  expectedVersion: 4,
  expectedPayloadRevision: 2,
  expectedPolicyVersion: 3,
  fileName: '증빙.txt',
  mediaType: 'text/plain',
  sizeBytes: bytes.length,
  sha256: hash,
  idempotencyKey: key,
};
const expiry = () => new Date(Date.now() + 60_000).toISOString();
const upload = (): ApprovalAttachmentUpload => ({
  uploadId,
  attachmentId,
  state: 'RESERVED',
  version: 0,
  reason: null,
  avState: 'NOT_CHECKED',
  passiveContentState: 'NOT_CHECKED',
  sizeBytes: bytes.length,
  sha256: hash,
  expiresAt: expiry(),
});
const item = {
  attachmentId,
  fileName: '증빙.txt',
  mediaType: 'text/plain',
  sizeBytes: bytes.length,
  sha256: hash,
  avState: 'AV_CLEAR',
  passiveContentState: 'PASSIVE_ALLOWED',
};
const manifest: ApprovalAttachments = {
  manifest: {
    payloadRevision: 2,
    payloadSha256: 'a'.repeat(64),
    manifestSha256: 'b'.repeat(64),
    items: [item],
    selectionVersion: 1,
    sealed: true,
    providerReadiness: 'COMPONENTS_VERIFIED_NOT_SANITIZED',
  },
  policyId: requestId,
  policyVersion: 3,
  upload: { allowed: true, reason: 'ALLOWED' },
  download: { allowed: true, reason: 'ALLOWED' },
  maxFileBytes: 26_214_400,
  maxFiles: 10,
  maxRequestBytes: 104_857_600,
  allowedMediaTypes: ['text/plain'],
  evaluatedAt: new Date().toISOString(),
};
const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const fetchFor = (data: unknown) =>
  vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        json(url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data)
      )
    );

describe('approval attachment real bytes and original command boundary', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('crypto', webcrypto);
  });
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads server manifest and original payload pins without exposing object keys or bearer URLs', async () => {
    const fetch = fetchFor(manifest);
    vi.stubGlobal('fetch', fetch);
    const value = await getApprovalAttachments(
      { type: 'REQUEST', id: requestId },
      'original-scope',
      undefined,
      { payloadRevision: 2, payloadSha256: 'a'.repeat(64) }
    );
    expect(value.manifest.items).toEqual([item]);
    expect(Object.isFrozen(value.manifest.items[0])).toBe(true);
    expect(fetch.mock.calls[0][0]).toContain('contextScopeKey=original-scope');
    expect(value).not.toHaveProperty('objectKey');
    expect(value).not.toHaveProperty('downloadUrl');
  });
  it('keeps missing policy unavailable and unsealed manifests without a fabricated digest', () => {
    const value = {
      ...manifest,
      policyId: null,
      policyVersion: 0,
      upload: { allowed: false, reason: 'POLICY_NOT_CONFIGURED' },
      download: { allowed: false, reason: 'POLICY_NOT_CONFIGURED' },
      maxFileBytes: 0,
      maxFiles: 0,
      maxRequestBytes: 0,
      allowedMediaTypes: [],
      manifest: { ...manifest.manifest, sealed: false, manifestSha256: null },
    };
    expect(readApprovalAttachments(value).manifest.manifestSha256).toBeNull();
    expect(() =>
      readApprovalAttachments({ ...value, upload: { allowed: true, reason: 'ALLOWED' } })
    ).toThrow();
  });
  it.each(['scan', 'hash', 'payload', 'duplicate'] as const)(
    'rejects invalid %s source without upgrading availability',
    (invalid) => {
      const value = structuredClone(manifest);
      if (invalid === 'scan') value.manifest.items[0].avState = 'NOT_CHECKED';
      if (invalid === 'hash') value.manifest.manifestSha256 = null;
      if (invalid === 'duplicate') value.manifest.items = [item, item];
      expect(() =>
        readApprovalAttachments(value, {
          payloadRevision: invalid === 'payload' ? 3 : 2,
          payloadSha256: 'a'.repeat(64),
        })
      ).toThrow();
    }
  );
  it('does not label an unscanned upload AVAILABLE', () => {
    expect(readApprovalAttachmentUpload(upload()).state).toBe('RESERVED');
    expect(() => readApprovalAttachmentUpload({ ...upload(), state: 'AVAILABLE' })).toThrow();
  });
  it('reserves immutable original metadata and uploads the exact hashed binary content', async () => {
    const initial = upload();
    const fetch = fetchFor(initial);
    vi.stubGlobal('fetch', fetch);
    expect((await reserveApprovalAttachmentUpload(requestId, reserve, execution)).uploadId).toBe(
      uploadId
    );
    fetch.mockImplementation(() =>
      Promise.resolve(
        json({ ...initial, state: 'QUARANTINED', version: 1, reason: 'AWAITING_SCAN' })
      )
    );
    await uploadApprovalAttachmentContent(
      initial,
      new Blob([bytes]),
      { expectedVersion: 0, idempotencyKey: key },
      execution
    );
    const [, init] = fetch.mock.calls.find(([, settings]) => settings.method === 'PUT')!;
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
    expect(init.headers['X-DWP-Expected-Object-Version']).toBe('0');
    expect(init.headers['Idempotency-Key']).toBe(key);
    expect(Array.from(new Uint8Array(await init.body.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it('accepts the owner PPTX vocabulary and rejects unsupported CSV before any transport', async () => {
    const fetch = fetchFor(upload());
    vi.stubGlobal('fetch', fetch);
    await reserveApprovalAttachmentUpload(
      requestId,
      {
        ...reserve,
        fileName: 'review.pptx',
        mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
      execution
    );
    expect(fetch.mock.calls.some(([url]) => !String(url).includes('/csrf'))).toBe(true);
    fetch.mockClear();
    await expect(
      reserveApprovalAttachmentUpload(
        requestId,
        {
          ...reserve,
          fileName: 'review.csv',
          mediaType: 'text/csv',
        },
        execution
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects changed binary content before CSRF or any storage command', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const changed = new Uint8Array(bytes);
    changed[0] ^= 1;
    await expect(
      uploadApprovalAttachmentContent(
        upload(),
        new Blob([changed]),
        { expectedVersion: 0, idempotencyKey: key },
        execution
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('blocks content transport when the source is revoked during actual CSRF', async () => {
    let finish!: (response: Response) => void;
    let ready = true;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', fetch);
    const originalError = new Error('Original owner source denied');
    const result = uploadApprovalAttachmentContent(
      upload(),
      new Blob([bytes]),
      { expectedVersion: 0, idempotencyKey: key },
      execution,
      {
        beforeDispatch: () => {
          if (!ready) throw originalError;
        },
      }
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    ready = false;
    finish(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
    await expect(result).rejects.toBe(originalError);
    expect(fetch.mock.calls.filter(([, settings]) => settings.method === 'PUT')).toHaveLength(0);
  });
  it('retains the same original key and version for status reconciliation and cancellation', async () => {
    const fetch = fetchFor(upload());
    vi.stubGlobal('fetch', fetch);
    const command = { expectedVersion: 0, idempotencyKey: key };
    await reconcileApprovalAttachmentUpload(uploadId, command, execution);
    await cancelApprovalAttachmentUpload(uploadId, command, execution);
    for (const [, init] of fetch.mock.calls.filter(([, settings]) => settings.method === 'POST'))
      expect(JSON.parse(init.body)).toEqual(command);
  });
  it('does not accept a selection result from another payload revision', async () => {
    const fetch = fetchFor({ ...manifest, manifest: { ...manifest.manifest, payloadRevision: 3 } });
    vi.stubGlobal('fetch', fetch);
    await expect(
      selectApprovalAttachments(
        requestId,
        {
          expectedVersion: 4,
          expectedPayloadRevision: 2,
          expectedSelectionVersion: 0,
          expectedPolicyVersion: 3,
          attachmentIds: [attachmentId],
          idempotencyKey: key,
        },
        execution
      )
    ).rejects.toBeInstanceOf(ApprovalAttachmentResponseError);
  });
  it('keeps request and task download actions on distinct owner paths with the original execution', async () => {
    const fetch = fetchFor({
      grantId: uploadId,
      expiresAt: expiry(),
      sha256: hash,
      sizeBytes: bytes.length,
    });
    vi.stubGlobal('fetch', fetch);
    const command = {
      expectedVersion: 4,
      expectedPayloadRevision: 2,
      expectedPolicyVersion: 3,
      reason: 'Verified evidence review',
      idempotencyKey: key,
    };
    const secure = {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'original-revision',
      contextKey: 'original-context',
      contextScopeKey: 'original-scope',
      idempotencyKey: key,
      objectVersion: 4,
    } as const;
    await createApprovalRequestAttachmentDownloadGrant(requestId, item, command, secure);
    await createApprovalTaskAttachmentDownloadGrant(uploadId, item, command, secure);
    const calls = fetch.mock.calls.filter(([, settings]) => settings.method === 'POST');
    expect(calls.map(([url]) => new URL(url, 'http://localhost').pathname)).toEqual([
      `/api/approvals/v1/requests/${requestId}/attachments/${attachmentId}/downloads`,
      `/api/approvals/v1/tasks/${uploadId}/attachments/${attachmentId}/downloads`,
    ]);
    for (const [, init] of calls) {
      expect(JSON.parse(init.body)).toEqual(command);
      expect(init.headers['X-DWP-Expected-Decision-Revision']).toBe('original-revision');
      expect(init.headers['Idempotency-Key']).toBe(key);
    }
  });

  it('binds grants to original content and verifies real downloaded byte size, SHA and nosniff', async () => {
    const grant = { grantId: uploadId, expiresAt: expiry(), sha256: hash, sizeBytes: bytes.length };
    const fetch = fetchFor(grant);
    vi.stubGlobal('fetch', fetch);
    const result = await createApprovalAttachmentDownloadGrant(
      { type: 'TASK', id: requestId },
      item,
      {
        expectedVersion: 4,
        expectedPayloadRevision: 2,
        expectedPolicyVersion: 3,
        reason: 'Verified evidence review',
        idempotencyKey: key,
      },
      execution
    );
    fetch.mockImplementation(() =>
      Promise.resolve(
        new Response(bytes, {
          headers: {
            'X-Content-SHA256': hash,
            'Content-Length': String(bytes.length),
            'X-Content-Type-Options': 'nosniff',
          },
        })
      )
    );
    const artifact = await loadApprovalAttachmentDownload(result, item);
    expect(Array.from(new Uint8Array(await artifact.blob.arrayBuffer()))).toEqual(
      Array.from(bytes)
    );
    expect(artifact.fileName).toBe('증빙.txt');
    expect(artifact.sha256).toBe(hash);
  });
  it.each(['bytes', 'header', 'expiry'] as const)(
    'refuses %s download evidence and never issues another grant',
    async (invalid) => {
      const changed = new Uint8Array(bytes);
      if (invalid === 'bytes') changed[0] ^= 1;
      const fetch = vi.fn().mockResolvedValue(
        new Response(changed, {
          headers: {
            'X-Content-SHA256': invalid === 'header' ? 'c'.repeat(64) : hash,
            'Content-Length': String(bytes.length),
            'X-Content-Type-Options': 'nosniff',
          },
        })
      );
      vi.stubGlobal('fetch', fetch);
      await expect(
        loadApprovalAttachmentDownload(
          {
            grantId: uploadId,
            expiresAt: invalid === 'expiry' ? '2000-01-01T00:00:00Z' : expiry(),
            sha256: hash,
            sizeBytes: bytes.length,
          },
          item
        )
      ).rejects.toThrow();
      expect(fetch.mock.calls.filter(([, settings]) => settings.method === 'POST')).toHaveLength(0);
    }
  );
});
