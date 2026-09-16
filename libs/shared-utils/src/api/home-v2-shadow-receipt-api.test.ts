import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionNeutralHttp } from '../axios-instance';
import {
  assertHomeV2ShadowReceiptRequest,
  sendHomeV2ShadowReceipt,
} from './home-v2-shadow-receipt-api';

const request = {
  schemaVersion: 1,
  outcome: 'MISMATCH',
  reasons: ['LAYOUT'],
  mismatchCount: 1,
  homeMode: 'CLASSIC',
  deviceClass: 'DESKTOP_STANDARD',
  runtimeState: 'SHADOW_COMPARE',
  rolloutRing: 'CONTROL',
  rolloutRevision: 'wave6-shadow-r1',
} as const;

describe('Home v2 privacy-safe shadow receipt client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends only the bounded aggregate contract on the session-neutral transport', async () => {
    const post = vi.spyOn(sessionNeutralHttp, 'post').mockResolvedValue({
      data: {
        status: 'SUCCESS',
        data: { accepted: true, receiptVersion: 'home-shadow-v1' },
      },
    });

    await expect(sendHomeV2ShadowReceipt(request, 'product-surface-revision-17')).resolves.toEqual({
      accepted: true,
      receiptVersion: 'home-shadow-v1',
    });
    expect(post).toHaveBeenCalledWith(
      '/api/platform/v2/home/shadow-receipts',
      request,
      expect.objectContaining({
        headers: {
          'X-DWP-Expected-Decision-Revision': 'product-surface-revision-17',
        },
        keepalive: true,
        timeoutMs: 2_000,
      })
    );
  });

  it.each([
    ['raw widget key', { ...request, widgetKey: 'private.widget' }],
    ['raw route', { ...request, route: '/work/private-object' }],
    ['tenant identity', { ...request, tenantId: 42 }],
    ['duplicate reason', { ...request, reasons: ['LAYOUT', 'LAYOUT'] }],
    ['unbounded count', { ...request, mismatchCount: 101 }],
    ['non-shadow state', { ...request, runtimeState: 'READ_ONLY_ACTIVE' }],
  ])('rejects %s before transport', (_label, unsafe) => {
    expect(() =>
      assertHomeV2ShadowReceiptRequest(
        unsafe as unknown as Parameters<typeof assertHomeV2ShadowReceiptRequest>[0]
      )
    ).toThrow('Home shadow receipt is invalid');
  });

  it('rejects a response that expands the privacy-safe receipt', async () => {
    vi.spyOn(sessionNeutralHttp, 'post').mockResolvedValue({
      data: {
        data: {
          accepted: true,
          receiptVersion: 'home-shadow-v1',
          correlationId: 'private-correlation',
        },
      },
    });
    await expect(sendHomeV2ShadowReceipt(request, 'product-surface-revision-17')).rejects.toThrow(
      'response.data'
    );
  });

  it('rejects a missing or multiline authority revision before transport', async () => {
    const post = vi.spyOn(sessionNeutralHttp, 'post');
    await expect(sendHomeV2ShadowReceipt(request, '  ')).rejects.toThrow(
      'request.expectedDecisionRevision'
    );
    await expect(sendHomeV2ShadowReceipt(request, 'revision\nforged')).rejects.toThrow(
      'request.expectedDecisionRevision'
    );
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    [
      'transient without freshness',
      { ...request, outcome: 'EXPECTED_TRANSIENT', reasons: ['EXPECTED_TRANSIENT'] },
    ],
    ['mismatch with unavailable', { ...request, reasons: ['UNAVAILABLE'] }],
    [
      'unavailable with extra reason',
      { ...request, outcome: 'UNAVAILABLE', reasons: ['UNAVAILABLE', 'FRESHNESS'] },
    ],
  ])('rejects %s semantic drift', (_label, unsafe) => {
    expect(() =>
      assertHomeV2ShadowReceiptRequest(
        unsafe as unknown as Parameters<typeof assertHomeV2ShadowReceiptRequest>[0]
      )
    ).toThrow('request.outcome');
  });
});
