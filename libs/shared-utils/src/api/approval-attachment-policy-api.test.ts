import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  getApprovalAttachmentPolicy,
  publishApprovalAttachmentPolicy,
  saveApprovalAttachmentPolicyDraft,
} from './approval-attachment-policy-api';
import {
  readApprovalAttachmentPolicy,
  readApprovalAttachmentRules,
} from './approval-attachment-policy-contract';
import type { ApprovalAttachmentRules } from './approval-attachment-policy-contract';

const policyId = '11111111-1111-1111-1111-111111111111';
const key = 'original-attachment-policy:1';
const rules = (): ApprovalAttachmentRules => ({
  allowUpload: false,
  allowDownload: false,
  maxFileBytes: 10_485_760,
  maxFiles: 5,
  maxRequestBytes: 52_428_800,
  maxConcurrentUploads: 1,
  allowedMediaTypes: ['application/pdf', 'text/plain'],
  grantTtlSeconds: 300,
  retentionDays: 365,
});
const policy = () => ({
  policyId,
  resourceSetKey: 'RS_APPROVAL_FINANCE',
  version: 4,
  published: rules(),
  pending: rules(),
  providerReadiness: 'NOT_CONFIGURED',
  publishedRevision: 1,
  pendingRevision: 2,
  pendingMakerUserId: 31,
  publishedRulesSha256: 'a'.repeat(64),
  pendingRulesSha256: 'b'.repeat(64),
  downloadReadiness: 'VERSIONING_VERIFIED',
  publishEligible: true,
  publishReason: 'ALLOWED',
});
const legacy = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;
const secure = {
  mode: 'SECURE',
  rolloutState: '111',
  contextKey: 'approval-management',
  contextScopeKey: 'opaque-original-management-scope',
  expectedDecisionRevision: 'psr-current',
  objectVersion: 4,
  idempotencyKey: key,
  stepUp: {
    challenge: 'original-signed-challenge',
    challengeId: 'original-challenge-id',
    decisionRevision: 'psr-current',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  },
} as const;
const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const fetchFor = (value: unknown = policy()) =>
  vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        json(url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : value)
      )
    );

describe('attachment policy current owner and high-risk publication API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the real owner policy and does not invent configured providers or published rules', async () => {
    const fetch = fetchFor();
    vi.stubGlobal('fetch', fetch);
    const value = await getApprovalAttachmentPolicy(
      'opaque-scope',
      undefined,
      'RS_APPROVAL_FINANCE'
    );
    expect(value.providerReadiness).toBe('NOT_CONFIGURED');
    expect(value.published.allowUpload).toBe(false);
    expect(Object.isFrozen(value.published.allowedMediaTypes)).toBe(true);
    expect(fetch.mock.calls[0][0]).toContain(
      '/api/approvals/v1/admin/attachments/policy?contextScopeKey=opaque-scope'
    );
    await expect(getApprovalAttachmentPolicy(undefined, undefined, 'RS_OTHER')).rejects.toThrow();
  });

  it('validates every server rule bound, integer, media vocabulary and exact request fields', () => {
    for (const invalid of [
      { ...rules(), maxFileBytes: 26_214_401 },
      { ...rules(), maxFileBytes: 12.5 },
      { ...rules(), maxFiles: 11 },
      { ...rules(), maxConcurrentUploads: 3 },
      { ...rules(), maxRequestBytes: 104_857_601 },
      { ...rules(), maxRequestBytes: 1 },
      { ...rules(), grantTtlSeconds: 59 },
      { ...rules(), grantTtlSeconds: 901 },
      { ...rules(), retentionDays: 0 },
      { ...rules(), retentionDays: 3651 },
      { ...rules(), allowedMediaTypes: [] },
      { ...rules(), allowedMediaTypes: ['text/csv'] },
      { ...rules(), allowedMediaTypes: ['text/plain', 'text/plain'] },
      { ...rules(), allowUpload: 'true' },
      { ...rules(), arbitraryExtra: true },
    ])
      expect(() => readApprovalAttachmentRules(invalid)).toThrow();
    expect(() =>
      readApprovalAttachmentRules({
        ...rules(),
        allowedMediaTypes: [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
      })
    ).not.toThrow();
  });

  it('rejects retargeted IDs, resource sets and malformed policy projections', () => {
    for (const invalid of [
      { ...policy(), policyId: 'other' },
      { ...policy(), version: -1 },
      { ...policy(), resourceSetKey: 'scope:other' },
      { ...policy(), published: null },
      { ...policy(), pending: {} },
      { ...policy(), providerReadiness: '' },
      { ...policy(), pendingMakerUserId: null },
      { ...policy(), pendingRulesSha256: null },
      { ...policy(), pendingRulesSha256: 'corrupt' },
      { ...policy(), pendingRevision: 1 },
      { ...policy(), publishEligible: true, publishReason: 'MAKER_CANNOT_PUBLISH' },
      { ...policy(), pending: null },
    ])
      expect(() => readApprovalAttachmentPolicy(invalid)).toThrow();
  });

  it('sends a private draft to the exact UUID endpoint without changing the published snapshot', async () => {
    const input = { expectedVersion: 4, idempotencyKey: key, rules: rules() };
    const fetch = fetchFor();
    vi.stubGlobal('fetch', fetch);
    const pending = saveApprovalAttachmentPolicyDraft(policyId, input, legacy);
    input.rules.retentionDays = 1;
    input.rules.allowedMediaTypes = ['text/plain'];
    await pending;
    const [url, init] = fetch.mock.calls.find(([value]) => !String(value).includes('/csrf'))!;
    expect(url).toBe(`/api/approvals/v1/admin/attachments/policies/${policyId}/draft`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).rules.retentionDays).toBe(365);
    expect(JSON.parse(init.body).rules.allowedMediaTypes).toEqual([
      'application/pdf',
      'text/plain',
    ]);
    expect(init.headers['Idempotency-Key']).toBe(key);
  });

  it('binds publication to the original command body, key, current revision and high-risk object version', async () => {
    const fetch = fetchFor();
    vi.stubGlobal('fetch', fetch);
    const input = {
      expectedVersion: 4,
      idempotencyKey: key,
      reviewComment: 'Independent policy review',
    };
    await publishApprovalAttachmentPolicy(policyId, input, secure);
    const [url, init] = fetch.mock.calls.find(([value]) => !String(value).includes('/csrf'))!;
    expect(String(url)).toContain(`/attachments/policies/${policyId}/publish`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(input);
    expect(init.headers).toMatchObject({
      'Idempotency-Key': key,
      'X-DWP-Expected-Object-Version': '4',
      'X-DWP-Expected-Decision-Revision': 'psr-current',
      'X-DWP-Step-Up-Challenge': 'original-signed-challenge',
    });
  });

  it('rejects legacy publication, changed signed version/key and unknown fields before CSRF', async () => {
    const fetch = fetchFor();
    vi.stubGlobal('fetch', fetch);
    const input = { expectedVersion: 4, idempotencyKey: key, reviewComment: 'Independent review' };
    await expect(publishApprovalAttachmentPolicy(policyId, input, legacy)).rejects.toThrow();
    await expect(
      publishApprovalAttachmentPolicy(policyId, input, { ...secure, objectVersion: 5 })
    ).rejects.toThrow();
    await expect(
      publishApprovalAttachmentPolicy(policyId, input, { ...secure, idempotencyKey: 'other' })
    ).rejects.toThrow();
    await expect(
      publishApprovalAttachmentPolicy(
        policyId,
        { ...input, invented: true } as typeof input,
        secure
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves the actual command scope and rejects a different scope than its signed execution', async () => {
    const fetch = fetchFor();
    vi.stubGlobal('fetch', fetch);
    const input = { expectedVersion: 4, idempotencyKey: key, reviewComment: 'Independent review' };
    await expect(
      publishApprovalAttachmentPolicy(policyId, input, secure, {
        contextScopeKey: 'different-management-scope',
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await publishApprovalAttachmentPolicy(policyId, input, secure, {
      contextScopeKey: secure.contextScopeKey,
    });
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes('contextScopeKey=opaque-original-management-scope')
      )
    ).toBe(true);
  });

  it('executes the current-source guard after actual CSRF and sends no policy command on revocation', async () => {
    let current = true;
    const fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/csrf')) current = false;
      return Promise.resolve(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      saveApprovalAttachmentPolicyDraft(
        policyId,
        {
          expectedVersion: 4,
          idempotencyKey: key,
          rules: rules(),
        },
        legacy,
        {
          beforeDispatch: () => {
            if (!current) throw new Error('source revoked');
          },
        }
      )
    ).rejects.toThrow('source revoked');
    expect(fetch.mock.calls.every(([url]) => String(url).includes('/csrf'))).toBe(true);
  });

  it('retains original key/body for an explicit replay and reports malformed success as uncertain', async () => {
    const fetch = fetchFor({ ...policy(), policyId: '22222222-2222-2222-2222-222222222222' });
    vi.stubGlobal('fetch', fetch);
    const input = { expectedVersion: 4, idempotencyKey: key, reviewComment: 'Original review' };
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(publishApprovalAttachmentPolicy(policyId, input, secure)).rejects.toMatchObject({
        name: 'ApprovalAttachmentPolicyResponseError',
      });
    const calls = fetch.mock.calls.filter(([url]) => !String(url).includes('/csrf'));
    expect(calls).toHaveLength(2);
    expect(calls[0][1].body).toBe(calls[1][1].body);
    expect(calls[1][1].headers['Idempotency-Key']).toBe(key);
  });
});
