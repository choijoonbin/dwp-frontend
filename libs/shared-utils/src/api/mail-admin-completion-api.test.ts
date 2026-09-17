import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  approveMailLegalHoldRelease,
  downloadMailDeliveryAuditExport,
  executeMailLegalHoldRelease,
  getMailLegalHoldReleasePreview,
  previewMailLegalHoldRelease,
} from './mail-admin-completion-api';

const elevated = { headers: { 'X-DWP-Active-Access-Mode': 'ELEVATED' } };

describe('mail administration completion API boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps legal-hold release preview, approval, and execution as separate commands', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: {} } });
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: {} } });

    await previewMailLegalHoldRelease('hold/1', {
      idempotencyKey: 'preview-request',
      holdVersion: 4,
      policyVersion: 9,
    });
    await getMailLegalHoldReleasePreview('preview/1');
    await approveMailLegalHoldRelease('preview/1', {
      decision: 'APPROVE',
      idempotencyKey: 'approval-request',
      fingerprint: 'sha256:reviewed',
      holdVersion: 4,
      policyVersion: 9,
    });
    await executeMailLegalHoldRelease('preview/1', {
      idempotencyKey: 'execute-request',
      fingerprint: 'sha256:reviewed',
      holdVersion: 4,
      policyVersion: 9,
    });

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/admin/mail/retention/holds/hold%2F1/release-previews',
      { idempotencyKey: 'preview-request', holdVersion: 4, policyVersion: 9 },
      elevated
    );
    expect(get).toHaveBeenCalledWith(
      '/api/platform/v1/admin/mail/retention/hold-release-previews/preview%2F1'
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/admin/mail/retention/hold-release-previews/preview%2F1/approvals',
      {
        decision: 'APPROVE',
        idempotencyKey: 'approval-request',
        fingerprint: 'sha256:reviewed',
        holdVersion: 4,
        policyVersion: 9,
      },
      elevated
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      '/api/platform/v1/admin/mail/retention/hold-release-previews/preview%2F1/execute',
      {
        idempotencyKey: 'execute-request',
        fingerprint: 'sha256:reviewed',
        holdVersion: 4,
        policyVersion: 9,
      },
      elevated
    );
  });

  it('downloads audit exports as authenticated blobs and propagates stale conflicts', async () => {
    const blob = new Blob(['evidence']);
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValueOnce({ data: blob });

    await expect(downloadMailDeliveryAuditExport('export/1')).resolves.toBe(blob);
    expect(get).toHaveBeenCalledWith(
      '/api/platform/v1/admin/mail/delivery-audit/exports/export%2F1/download',
      {
        responseType: 'blob',
        headers: {
          'X-DWP-Active-Access-Mode': 'ELEVATED',
          Accept: 'application/json',
        },
      }
    );

    const stale = Object.assign(new Error('stale preview'), { response: { status: 409 } });
    vi.spyOn(axiosInstance, 'post').mockRejectedValueOnce(stale);
    await expect(
      executeMailLegalHoldRelease('preview-1', {
        idempotencyKey: 'execute-request',
        fingerprint: 'old-fingerprint',
        holdVersion: 3,
        policyVersion: 8,
      })
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});
