import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { initializeApprovalAttachmentPolicy } from './approval-attachment-policy-initialize-api';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

const resourceSetKey = 'RS_APPROVAL_FINANCE';
const input = { expectedAbsent: true, idempotencyKey: 'original-initialize:1' } as const;
const execution = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: `psr-${'a'.repeat(64)}`,
  contextKey: 'current-management',
  contextScopeKey: 'opaque-current-management',
  idempotencyKey: input.idempotencyKey,
} as const;
const rules = {
  allowUpload: false,
  allowDownload: false,
  maxFileBytes: 10_485_760,
  maxFiles: 5,
  maxRequestBytes: 52_428_800,
  maxConcurrentUploads: 1,
  allowedMediaTypes: ['application/pdf'],
  grantTtlSeconds: 300,
  retentionDays: 365,
};
const policy = {
  policyId: '11111111-1111-1111-1111-111111111111',
  resourceSetKey,
  version: 1,
  published: rules,
  pending: null,
  providerReadiness: 'NOT_CONFIGURED',
  publishedRevision: 1,
  pendingRevision: null,
  pendingMakerUserId: null,
  publishedRulesSha256: 'b'.repeat(64),
  pendingRulesSha256: null,
  downloadReadiness: 'NOT_CONFIGURED',
  publishEligible: false,
  publishReason: 'PENDING_POLICY_REQUIRED',
};
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const transport = (value: unknown = policy) =>
  vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        response(url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : value)
      )
    );

describe('explicit attachment policy initialization', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it.each(['110', '111'] as const)(
    'sends only the original explicit command under fresh secure %s authority',
    async (rolloutState) => {
      const fetch = transport();
      vi.stubGlobal('fetch', fetch);
      const result = await initializeApprovalAttachmentPolicy(
        input,
        { ...execution, rolloutState },
        { resourceSetKey }
      );
      expect(result.published.allowUpload).toBe(false);
      expect(result.providerReadiness).toBe('NOT_CONFIGURED');
      expect(fetch).toHaveBeenCalledTimes(2);
      const [url, config] = fetch.mock.calls[1];
      expect(url).toBe(
        '/api/approvals/v1/admin/attachments/policies?contextScopeKey=opaque-current-management'
      );
      expect(JSON.parse(config.body)).toEqual(input);
      expect(config.headers['Idempotency-Key']).toBe(input.idempotencyKey);
      expect(config.headers['X-DWP-Expected-Decision-Revision']).toBe(
        execution.expectedDecisionRevision
      );
      expect(config.headers['X-DWP-Expected-Object-Version']).toBeUndefined();
      expect(config.headers['X-DWP-Step-Up-Challenge']).toBeUndefined();
    }
  );

  it('rejects borrowed legacy or versioned publication authority before any transport', async () => {
    const fetch = transport();
    vi.stubGlobal('fetch', fetch);
    for (const bad of [
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
      { ...execution, objectVersion: 1 },
      { ...execution, idempotencyKey: 'replacement' },
      { ...execution, expectedDecisionRevision: 'psr-guess' },
      { ...execution, stepUp: { challenge: 'publication' } },
    ])
      await expect(
        initializeApprovalAttachmentPolicy(input, bad as ApprovalMutationExecution, {
          resourceSetKey,
        })
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects absent-CAS false, invented rules and mismatched context before CSRF', async () => {
    const fetch = transport();
    vi.stubGlobal('fetch', fetch);
    for (const bad of [
      { ...input, expectedAbsent: false },
      { ...input, rules },
      { ...input, idempotencyKey: '' },
    ]) {
      await expect(
        initializeApprovalAttachmentPolicy(bad as typeof input, execution, { resourceSetKey })
      ).rejects.toThrow();
    }
    await expect(
      initializeApprovalAttachmentPolicy(input, execution, {
        resourceSetKey,
        contextScopeKey: 'other',
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechecks authority after deferred CSRF and does not initialize after revocation', async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    );
    vi.stubGlobal('fetch', fetch);
    let current = true;
    const pending = initializeApprovalAttachmentPolicy(input, execution, {
      resourceSetKey,
      beforeDispatch: () => {
        if (!current) throw new Error('revoked');
      },
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    current = false;
    resolve(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
    await expect(pending).rejects.toThrow('revoked');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not accept a committed 200 from another selected resource set', async () => {
    const fetch = transport({ ...policy, resourceSetKey: 'RS_OTHER' });
    vi.stubGlobal('fetch', fetch);
    await expect(
      initializeApprovalAttachmentPolicy(input, execution, { resourceSetKey })
    ).rejects.toThrow('unverifiable');
  });
});
