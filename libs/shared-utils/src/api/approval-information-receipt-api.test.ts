import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  APPROVAL_INFORMATION_RECEIPT_ROUTE,
  getApprovalInformationCommandReceipt,
  readApprovalInformationReceipt,
} from './approval-information-receipt-api';
import type { ApprovalInformationReceiptReadAuthority } from './approval-information-receipt-api';

const requestId = '11111111-1111-4111-8111-111111111111';
const receipt = {
  status: 'COMPLETED',
  roundId: '22222222-2222-4222-8222-222222222222',
  generation: 2,
  requestVersion: 8,
  payloadRevision: 3,
  payloadSha256: 'a'.repeat(64),
  materialChange: true,
} as const;
const authority: ApprovalInformationReceiptReadAuthority = {
  mode: 'SECURE',
  rolloutState: '110',
  routeContractKey: APPROVAL_INFORMATION_RECEIPT_ROUTE,
  expectedDecisionRevision: `psr-${'b'.repeat(64)}`,
  contextKey: 'context-current',
  contextScopeKey: 'opaque-current',
};
const original = JSON.stringify({ message: 'Original', payload: {}, expectedVersion: 7 });
const input = { operation: 'REPLY', originalBodyBase64: btoa(original) } as const;
const response = (data: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify({ data }) }) as Response;
function transport(data: unknown = receipt) {
  const mock = vi
    .fn()
    .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
    .mockResolvedValue(response(data));
  vi.stubGlobal('fetch', mock);
  return mock;
}
describe('approval information command read-only receipt boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it.each(['110', '111'] as const)(
    'uses fresh DATA context in %s without ACTION proof',
    async (rolloutState) => {
      const fetch = transport();
      const beforeDispatch = vi.fn();
      await expect(
        getApprovalInformationCommandReceipt(
          requestId,
          'reply:original',
          input,
          { ...authority, rolloutState },
          { beforeDispatch }
        )
      ).resolves.toEqual(receipt);
      const [url, init] = fetch.mock.calls[1];
      expect(url).toBe(
        `/api/approvals/v1/requests/${requestId}/information-commands/reply:original/receipt?contextScopeKey=opaque-current`
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(input);
      expect(init.headers['X-DWP-Expected-Decision-Revision']).toBe(
        authority.expectedDecisionRevision
      );
      expect(init.headers['X-XSRF-TOKEN']).toBe('csrf');
      for (const key of [
        'Idempotency-Key',
        'X-DWP-Step-Up-Challenge',
        'X-DWP-Expected-Object-Version',
      ])
        expect(init.headers[key]).toBeUndefined();
      expect(beforeDispatch).toHaveBeenCalledTimes(2);
    }
  );
  it.each(['.', '..'])('rejects the dot-segment original key %s before CSRF', async (key) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      getApprovalInformationCommandReceipt(requestId, key, input, authority)
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves exact UTF-8 bytes rather than serializing the original draft again', async () => {
    const bytes = new TextEncoder().encode(
      '{ "message": "원본", "payload":{}, "expectedVersion":7 }'
    );
    const base64 = btoa(String.fromCharCode(...bytes));
    const fetch = transport();
    await getApprovalInformationCommandReceipt(
      requestId,
      'original',
      { ...input, originalBodyBase64: base64 },
      authority
    );
    expect(JSON.parse(fetch.mock.calls[1][1].body).originalBodyBase64).toBe(base64);
  });
  it.each(['000', '100', '112'])(
    'rejects unsupported or old rollout %s before CSRF',
    async (rolloutState) => {
      const fetch = transport();
      await expect(
        getApprovalInformationCommandReceipt(requestId, 'original', input, {
          ...authority,
          rolloutState,
        } as ApprovalInformationReceiptReadAuthority)
      ).rejects.toThrow('receipt contract');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it.each(['idempotencyKey', 'stepUp', 'objectVersion'])(
    'does not borrow %s from a prior ACTION',
    async (key) => {
      const fetch = transport();
      await expect(
        getApprovalInformationCommandReceipt(requestId, 'original', input, {
          ...authority,
          [key]: 'borrowed',
        })
      ).rejects.toThrow('receipt contract');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('rejects wrong route, malformed original identity and invalid or noncanonical original bodies before CSRF', async () => {
    const fetch = transport();
    for (const body of [
      '',
      '====',
      btoa('[]'),
      btoa('null'),
      btoa('{'),
      'e30',
      btoa('{}') + '\n',
      btoa('"not an object"'),
      btoa(String.fromCharCode(255)),
      btoa(JSON.stringify({ large: 'a'.repeat(262144) })),
    ]) {
      await expect(
        getApprovalInformationCommandReceipt(
          requestId,
          'original',
          { ...input, originalBodyBase64: body },
          authority
        )
      ).rejects.toThrow('receipt contract');
    }
    await expect(
      getApprovalInformationCommandReceipt(requestId, 'bad/key', input, authority)
    ).rejects.toThrow();
    await expect(
      getApprovalInformationCommandReceipt(requestId, 'original', input, {
        ...authority,
        routeContractKey: 'route.approvals.work.request-info.action',
      } as unknown as ApprovalInformationReceiptReadAuthority)
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechecks current source after CSRF and dispatches zero receipt requests after revocation', async () => {
    const fetch = transport();
    const beforeDispatch = vi
      .fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('source revoked');
      });
    await expect(
      getApprovalInformationCommandReceipt(requestId, 'original', input, authority, {
        beforeDispatch,
      })
    ).rejects.toThrow('source revoked');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never treats an absent, pending, partial or extra-field 200 result as a completed receipt', async () => {
    const fetch = transport(null);
    await expect(
      getApprovalInformationCommandReceipt(requestId, 'original', input, authority)
    ).rejects.toThrow('receipt contract');
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const malformed of [
      null,
      {},
      { ...receipt, status: 'PENDING' },
      { ...receipt, generation: 0 },
      { ...receipt, requestVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...receipt, materialChange: 'true' },
      { ...receipt, originalActorId: 100 },
    ])
      expect(() => readApprovalInformationReceipt(malformed)).toThrow('receipt contract');
    expect(Object.isFrozen(readApprovalInformationReceipt(receipt))).toBe(true);
  });
});
