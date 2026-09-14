import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { HttpError, HttpTransportError } from '../http-error';
import {
  createApprovalRetentionClaim,
  getApprovalRetentionClaim,
  getApprovalRetentionPolicy,
  getApprovalRetentionRecord,
  initializeApprovalRetentionPolicy,
  publishApprovalRetentionPolicy,
  saveApprovalRetentionPolicy,
} from './approval-retention-api';
import {
  APPROVAL_RETENTION_BINDINGS,
  readApprovalRetentionClaim,
  readApprovalRetentionPolicy,
  readApprovalRetentionRecord,
  readApprovalRetentionRules,
} from './approval-retention-contract';
import type { ApprovalRetentionRules } from './approval-retention-contract';
import type { ApprovalMutationExecution } from './approval-governed-mutation';

const requestId = '11111111-1111-4111-8111-111111111111';
const policyId = '22222222-2222-4222-8222-222222222222';
const claimId = '33333333-3333-4333-8333-333333333333';
const executionClaimId = '44444444-4444-4444-8444-444444444444';
const digest = 'a'.repeat(64);
const revision = `psr-${'b'.repeat(64)}`;
const key = 'retention:original';
const base = '/api/approvals/v1/admin/retention';
const readiness = 'RUNTIME_DISABLED_UNTIL_OWNER_FENCES_AND_PROVIDERS';
const legacy = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const readOptions = { contextScopeKey: 'opaque-current', expectedDecisionRevision: revision };

// These fixtures mirror the public Java records, not private executor/provider DTOs.
function rules(): ApprovalRetentionRules {
  return {
    allowPurge: false,
    allowedClassifications: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
    recordRetentionDays: 365,
    deletedDraftRecoveryDays: 30,
    receiptRetentionDays: 365,
    holdEvidenceRetentionDays: 365,
    auditEvidenceRetentionDays: 365,
    maxInventoryRows: 50000,
    maxObjectsPerRecord: 1000,
  };
}
function policy() {
  return {
    policyId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    publishedRevision: 0,
    pendingRevision: null,
    pendingMakerUserId: null,
    publishedRulesSha256: digest,
    pendingRulesSha256: null,
    published: rules(),
    pending: null,
    publishEligible: false,
    publishReason: 'NO_PENDING_REVISION',
    runtimeReadiness: readiness,
  };
}
function record() {
  return {
    requestId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    policyId,
    policyVersion: 0,
    holdVersion: 0,
    state: 'LIVE',
    claimEligible: false,
    claimReason: 'POLICY_PURGE_DISABLED',
    inventorySha256: digest,
    inventoryRows: 50,
    inventoryTables: 37,
    objectCount: 0,
    eligibleAfter: null,
    claimId: null,
    runtimeReadiness: readiness,
  };
}
function claim() {
  return {
    claimId,
    requestId,
    resourceSetKey: 'RS_APPROVALS',
    version: 0,
    state: 'QUEUED',
    reason: 'DEDICATED_EXECUTOR_PENDING',
    inventorySha256: digest,
    executionClaimId: null,
    foreignRequests: 0,
    verifiedAcknowledgements: 0,
    foreignCopyState: 'VERIFIED_FOREIGN_COPY_ACKS_PENDING',
    runtimeReadiness: readiness,
  };
}
function secure(rolloutState: '110' | '111' = '110'): ApprovalMutationExecution {
  return {
    mode: 'SECURE',
    rolloutState,
    expectedDecisionRevision: revision,
    contextKey: 'context-current',
    contextScopeKey: 'opaque-current',
    objectVersion: 0,
    idempotencyKey: key,
    stepUp: {
      challenge: 'signed-server-challenge',
      challengeId: executionClaimId,
      decisionRevision: revision,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  };
}
function claimInput() {
  return {
    expectedVersion: 0,
    policyId,
    expectedPolicyVersion: 0,
    expectedHoldVersion: 0,
    inventorySha256: digest,
    idempotencyKey: key,
  };
}
function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}
function transport(data: unknown, status = 200) {
  const fetch = vi.fn(async (url: string, _init: RequestInit) =>
    response(
      url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data,
      url.includes('/csrf') ? 200 : status
    )
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const reads = [
  { name: 'policy', path: `${base}/policy`, data: policy, run: getApprovalRetentionPolicy },
  {
    name: 'record',
    path: `${base}/records/${requestId}`,
    data: record,
    run: (options: Parameters<typeof getApprovalRetentionPolicy>[0]) =>
      getApprovalRetentionRecord(requestId, options),
  },
  {
    name: 'claim',
    path: `${base}/claims/${claimId}`,
    data: claim,
    run: (options: Parameters<typeof getApprovalRetentionPolicy>[0]) =>
      getApprovalRetentionClaim(claimId, options),
  },
];
const commands = [
  {
    name: 'initialize',
    method: 'POST',
    path: `${base}/policies`,
    data: policy,
    body: () => ({ expectedAbsent: true, idempotencyKey: key }),
    run: (guard?: () => void) =>
      initializeApprovalRetentionPolicy(
        { expectedAbsent: true, idempotencyKey: key },
        legacy,
        guard
      ),
  },
  {
    name: 'save',
    method: 'PUT',
    path: `${base}/policies/${policyId}/draft`,
    data: policy,
    body: () => ({ expectedVersion: 0, idempotencyKey: key, rules: rules() }),
    run: (guard?: () => void) =>
      saveApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, rules: rules() },
        legacy,
        guard
      ),
  },
  {
    name: 'publish',
    method: 'POST',
    path: `${base}/policies/${policyId}/publish`,
    data: policy,
    body: () => ({
      expectedVersion: 0,
      idempotencyKey: key,
      reviewComment: 'Independent review completed',
    }),
    run: (guard?: () => void) =>
      publishApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, reviewComment: 'Independent review completed' },
        secure(),
        guard
      ),
  },
  {
    name: 'claim',
    method: 'POST',
    path: `${base}/records/${requestId}/claims`,
    data: claim,
    body: claimInput,
    run: (guard?: () => void) =>
      createApprovalRetentionClaim(requestId, claimInput(), secure(), guard),
  },
];

describe('approval retention public boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('has exactly seven native routes, 13/16/12 public fields and nine rules', () => {
    expect(APPROVAL_RETENTION_BINDINGS).toEqual([
      ['retention-policy.data', 'GET', '/v1/admin/retention/policy'],
      ['retention-policy-initialize.action', 'POST', '/v1/admin/retention/policies'],
      ['retention-policy-draft.action', 'PUT', '/v1/admin/retention/policies/{policyId}/draft'],
      [
        'retention-policy-publish.action',
        'POST',
        '/v1/admin/retention/policies/{policyId}/publish',
      ],
      ['retention-record.data', 'GET', '/v1/admin/retention/records/{requestId}'],
      ['retention-record-claim.action', 'POST', '/v1/admin/retention/records/{requestId}/claims'],
      ['retention-claim.data', 'GET', '/v1/admin/retention/claims/{claimId}'],
    ]);
    expect(Object.keys(policy())).toHaveLength(13);
    expect(Object.keys(record())).toHaveLength(16);
    expect(Object.keys(claim())).toHaveLength(12);
    expect(Object.keys(rules())).toHaveLength(9);
  });

  it.each(reads)(
    'GET $name uses only current DATA context and immutable parsing',
    async ({ path, data, run }) => {
      const fetch = transport(data());
      const guard = vi.fn();
      const result = await run({ ...readOptions, beforeDispatch: guard });
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe(`${path}?contextScopeKey=opaque-current`);
      expect(init.method).toBe('GET');
      expect(init.credentials).toBe('include');
      expect(init.body).toBeUndefined();
      const headers = new Headers(init.headers);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
      for (const header of [
        'Idempotency-Key',
        'X-DWP-Step-Up-Challenge',
        'X-DWP-Expected-Object-Version',
        'X-XSRF-TOKEN',
      ])
        expect(headers.has(header)).toBe(false);
      expect(Object.isFrozen(result)).toBe(true);
      expect(guard).toHaveBeenCalledTimes(3);
    }
  );

  it('preserves default legacy GET compatibility without manufacturing secure evidence', async () => {
    const fetch = transport(policy());
    await expect(getApprovalRetentionPolicy()).resolves.toEqual(policy());
    expect(fetch.mock.calls[0][0]).toBe(`${base}/policy`);
    expect(
      new Headers(fetch.mock.calls[0][1].headers).has('X-DWP-Expected-Decision-Revision')
    ).toBe(false);
  });

  it.each([
    { contextScopeKey: 'opaque-current' },
    { expectedDecisionRevision: revision },
    { ...readOptions, expectedDecisionRevision: '' },
    { ...readOptions, expectedDecisionRevision: 'psr-old' },
    { ...readOptions, expectedDecisionRevision: 'b'.repeat(64) },
  ])('rejects partial or malformed secure DATA read options before HTTP: %j', async (options) => {
    const fetch = transport(policy());
    await expect(getApprovalRetentionPolicy(options)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(commands)(
    '$name emits the exact native command body and original replay key',
    async ({ name, method, path, body, data, run }) => {
      const fetch = transport(data());
      const guard = vi.fn();
      await run(guard);
      expect(fetch).toHaveBeenCalledTimes(2);
      const [url, init] = fetch.mock.calls[1];
      expect(url).toBe(
        path + (name === 'publish' || name === 'claim' ? '?contextScopeKey=opaque-current' : '')
      );
      expect(init.method).toBe(method);
      expect(JSON.parse(String(init.body))).toEqual(body());
      const headers = new Headers(init.headers);
      expect(headers.get('Idempotency-Key')).toBe(key);
      expect(headers.get('X-XSRF-TOKEN')).toBe('csrf');
      if (path.endsWith('/publish') || path.endsWith('/claims')) {
        expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
        expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-server-challenge');
        expect(headers.get('X-DWP-Expected-Object-Version')).toBe('0');
      } else expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
      expect(guard).toHaveBeenCalledTimes(3);
    }
  );

  it.each(['110', '111'] as const)(
    'Retention HIGH in %s requires the native object-version header',
    async (rolloutState) => {
      const fetch = transport(claim());
      await createApprovalRetentionClaim(requestId, claimInput(), secure(rolloutState));
      expect(new Headers(fetch.mock.calls[1][1].headers).get('X-DWP-Expected-Object-Version')).toBe(
        '0'
      );
    }
  );

  it.each([
    { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
    { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
    { ...secure(), stepUp: undefined },
    { ...secure(), objectVersion: undefined },
    { ...secure(), objectVersion: 1 },
    { ...secure(), idempotencyKey: 'borrowed' },
    {
      ...secure(),
      stepUp: {
        challenge: 'signed',
        challengeId: executionClaimId,
        decisionRevision: 'different',
        expiresAt: new Date().toISOString(),
      },
    },
  ])('rejects incomplete or rebound HIGH authority before CSRF: %j', async (authority) => {
    const fetch = transport(claim());
    await expect(
      createApprovalRetentionClaim(requestId, claimInput(), authority as ApprovalMutationExecution)
    ).rejects.toThrow();
    await expect(
      publishApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, reviewComment: 'Independent review completed' },
        authority as ApprovalMutationExecution
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(commands)(
    '$name preflight failure performs no HTTP including CSRF',
    async ({ data, run }) => {
      const fetch = transport(data());
      const conflict = new HttpError('Source changed', 409, null);
      await expect(
        run(() => {
          throw conflict;
        })
      ).rejects.toBe(conflict);
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each(commands)(
    '$name rejects authority drift while actual CSRF is pending without command POST/PUT',
    async ({ data, run }) => {
      const csrf = deferred<Response>();
      const fetch = vi.fn((url: string, _init: RequestInit) =>
        url.includes('/csrf') ? csrf.promise : Promise.resolve(response(data()))
      );
      vi.stubGlobal('fetch', fetch);
      let current = true;
      const conflict = new HttpError('Source changed', 409, null);
      const pending = run(() => {
        if (!current) throw conflict;
      });
      const assertion = expect(pending).rejects.toBe(conflict);
      expect(fetch).toHaveBeenCalledTimes(1);
      current = false;
      csrf.resolve(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
      await assertion;
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ...reads.map((read) => ({
      ...read,
      runGuard: (guard: () => void) => read.run({ ...readOptions, beforeDispatch: guard }),
    })),
    ...commands.map((command) => ({ ...command, runGuard: command.run })),
  ])(
    '$name post-response authority failure never exposes parsed success',
    async ({ data, runGuard }) => {
      let current = true;
      const fetch = vi.fn(async (url: string, _init: RequestInit) => {
        if (url.includes('/csrf')) return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
        current = false;
        return response(data());
      });
      vi.stubGlobal('fetch', fetch);
      const conflict = new HttpError('Source changed', 409, null);
      const guard = () => {
        if (!current) throw conflict;
      };
      await expect(runGuard(guard)).rejects.toBe(conflict);
      expect(fetch.mock.calls.filter(([url]) => !url.includes('/csrf'))).toHaveLength(1);
    }
  );

  it.each(commands.flatMap((command) => [403, 409, 503].map((status) => ({ ...command, status }))))(
    '$name HTTP $status preserves failure with one command attempt',
    async ({ data, status, run }) => {
      const fetch = transport(data(), status);
      await expect(run()).rejects.toMatchObject({ name: 'HttpError', status });
      expect(fetch.mock.calls.filter(([url]) => !url.includes('/csrf'))).toHaveLength(1);
    }
  );

  it.each(commands)(
    '$name empty HTTP 403 must not automatically replay an ambiguous command',
    async ({ data, run }) => {
      const fetch = vi.fn(async (url: string, _init: RequestInit) =>
        url.includes('/csrf')
          ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
          : ({ ...response(data(), 403), text: async () => '' } as Response)
      );
      vi.stubGlobal('fetch', fetch);
      await expect(run()).rejects.toMatchObject({ name: 'HttpError', status: 403 });
      expect(fetch.mock.calls.filter(([url]) => !url.includes('/csrf'))).toHaveLength(1);
    }
  );

  it('keeps a network result unknown with no automatic new command or key', async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => {
      if (url.includes('/csrf')) return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      throw new TypeError('Connection closed after write');
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      createApprovalRetentionClaim(requestId, claimInput(), secure())
    ).rejects.toBeInstanceOf(HttpTransportError);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(fetch.mock.calls[1][1].headers).get('Idempotency-Key')).toBe(key);
  });

  it('passes abort to the real transport and retains ABORT instead of parsed success', async () => {
    const controller = new AbortController();
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init.signal?.aborted) abort();
          else init.signal?.addEventListener('abort', abort, { once: true });
        })
    );
    vi.stubGlobal('fetch', fetch);
    const pending = getApprovalRetentionRecord(requestId, {
      ...readOptions,
      signal: controller.signal,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'HttpTransportError',
      reason: 'ABORT',
    });
    controller.abort();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it('clones draft rules before CSRF and freezes parsed nested data independently of input', async () => {
    const inputRules = rules();
    const csrf = deferred<Response>();
    const original = policy();
    const fetch = vi.fn((url: string, _init: RequestInit) =>
      url.includes('/csrf') ? csrf.promise : Promise.resolve(response(original))
    );
    vi.stubGlobal('fetch', fetch);
    const pending = saveApprovalRetentionPolicy(
      policyId,
      { expectedVersion: 0, idempotencyKey: key, rules: inputRules },
      legacy
    );
    expect(Reflect.set(inputRules, 'allowedClassifications', ['RESTRICTED'])).toBe(true);
    expect(Reflect.set(inputRules, 'recordRetentionDays', 1)).toBe(true);
    csrf.resolve(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
    const saved = await pending;
    expect(JSON.parse(String(fetch.mock.calls[1][1].body)).rules).toEqual(rules());
    expect(Object.isFrozen(saved.published)).toBe(true);
    expect(Object.isFrozen(saved.published.allowedClassifications)).toBe(true);
    expect(Reflect.set(original.published, 'recordRetentionDays', 1)).toBe(true);
    expect(saved.published.recordRetentionDays).toBe(365);
  });

  it('accepts native nullable no-pending/init0 policy but never an absent global policy or init purge', async () => {
    transport(policy());
    const initialized = await initializeApprovalRetentionPolicy(
      { expectedAbsent: true, idempotencyKey: key },
      legacy
    );
    expect(initialized.publishedRevision).toBe(0);
    expect(initialized.published.allowPurge).toBe(false);
    expect(initialized.pending).toBeNull();
    expect(initialized.publishEligible).toBe(false);
    transport(null);
    await expect(getApprovalRetentionPolicy()).rejects.toThrow();
    expect(() =>
      readApprovalRetentionPolicy({ ...policy(), published: { ...rules(), allowPurge: true } })
    ).toThrow();
  });

  it('parses native pending checker eligibility and rejected self-publish without ready claims', () => {
    const pending = {
      ...policy(),
      version: 1,
      pendingRevision: 1,
      pendingMakerUserId: 7,
      pendingRulesSha256: 'c'.repeat(64),
      pending: { ...rules(), allowPurge: true },
      publishReason: 'INDEPENDENT_CHECKER_REQUIRED',
    };
    expect(readApprovalRetentionPolicy(pending).publishEligible).toBe(false);
    expect(
      readApprovalRetentionPolicy({
        ...pending,
        publishEligible: true,
        publishReason: 'ELIGIBLE_REQUIRES_SIGNED_HIGH',
      }).runtimeReadiness
    ).toBe(readiness);
    expect(Object.isFrozen(readApprovalRetentionPolicy(pending).pending)).toBe(true);
  });

  it('accepts truthful over-limit inventory as blocked instead of concealing native counts', async () => {
    const native = {
      ...record(),
      inventoryRows: 50001,
      objectCount: 1001,
      claimReason: 'INVENTORY_CAP_EXCEEDED',
    };
    transport(native);
    const parsed = await getApprovalRetentionRecord(requestId);
    expect(parsed.inventoryRows).toBe(50001);
    expect(parsed.objectCount).toBe(1001);
    expect(parsed.claimEligible).toBe(false);
    expect(parsed.claimReason).toBe('INVENTORY_CAP_EXCEEDED');
  });

  it('separates durable intent from execution and accepts nullable and confirmed foreign-copy evidence', () => {
    expect(readApprovalRetentionClaim(claim(), { claimId }).executionClaimId).toBeNull();
    const confirmed = {
      ...claim(),
      executionClaimId,
      foreignRequests: 2,
      verifiedAcknowledgements: 2,
      foreignCopyState: 'ALL_DECLARED_COPIES_CONFIRMED',
    };
    expect(readApprovalRetentionClaim(confirmed, { requestId })).toEqual(confirmed);
    expect(
      readApprovalRetentionRecord(
        {
          ...record(),
          claimEligible: true,
          claimReason: 'ELIGIBLE_FOR_DURABLE_INTENT',
          eligibleAfter: '2026-09-01T00:00:00+09:00',
        },
        requestId
      ).eligibleAfter
    ).toBe('2026-09-01T00:00:00+09:00');
  });

  it.each([
    { allowedClassifications: [] },
    { allowedClassifications: ['INTERNAL', 'INTERNAL'] },
    { allowedClassifications: ['PUBLIC'] },
    { allowPurge: 'true' },
    { recordRetentionDays: 0 },
    { deletedDraftRecoveryDays: 3651 },
    { receiptRetentionDays: 1.1 },
    { holdEvidenceRetentionDays: '365' },
    { auditEvidenceRetentionDays: -1 },
    { maxInventoryRows: 50001 },
    { maxObjectsPerRecord: 1001 },
    { rawObjectKey: 'private' },
  ])('rejects invalid nine-field rules before save HTTP: %j', async (change) => {
    const fetch = transport(policy());
    const invalid = { ...rules(), ...change };
    expect(() => readApprovalRetentionRules(invalid)).toThrow();
    await expect(
      saveApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, rules: invalid as ApprovalRetentionRules },
        legacy
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { version: -1 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { publishedRulesSha256: 'A'.repeat(64) },
    { resourceSetKey: 'tenant-private' },
    { pendingRevision: 1 },
    { pendingMakerUserId: 1 },
    { publishEligible: true },
    { pending: rules() },
    { publishReason: 'ELIGIBLE_REQUIRES_SIGNED_HIGH' },
    { published: null },
    { objectKey: 'private' },
  ])('rejects partial/drifted policy schema: %j', (change) => {
    expect(() => readApprovalRetentionPolicy({ ...policy(), ...change })).toThrow();
  });

  it.each([
    { inventoryRows: -1 },
    { inventoryTables: 0 },
    { objectCount: 1.1 },
    { inventorySha256: 'bad' },
    { eligibleAfter: 'not-an-instant' },
    { claimEligible: true },
    { claimReason: 'ELIGIBLE_FOR_DURABLE_INTENT' },
    { state: 'live' },
    { providerHandle: 'private' },
  ])('rejects invalid record schema: %j', (change) => {
    expect(() => readApprovalRetentionRecord({ ...record(), ...change }, requestId)).toThrow();
  });

  it.each([
    { verifiedAcknowledgements: 1 },
    { foreignRequests: 2001 },
    { foreignCopyState: 'ALL_DECLARED_COPIES_CONFIRMED' },
    {
      foreignRequests: 2,
      verifiedAcknowledgements: 1,
      foreignCopyState: 'ALL_DECLARED_COPIES_CONFIRMED',
    },
    { executionClaimId: 'bad' },
    { inventorySha256: 'bad' },
    { state: null },
    { foreignCopyState: 'UNVERIFIED_SUCCESS' },
    { providerKey: 'private' },
  ])('rejects invalid claim evidence: %j', (change) => {
    expect(() => readApprovalRetentionClaim({ ...claim(), ...change }, { claimId })).toThrow();
  });

  it('rejects rebound response identities at each actual public adapter', async () => {
    transport({ ...policy(), policyId: requestId });
    await expect(
      saveApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, rules: rules() },
        legacy
      )
    ).rejects.toThrow();
    transport({ ...record(), requestId: policyId });
    await expect(getApprovalRetentionRecord(requestId)).rejects.toThrow();
    transport({ ...claim(), claimId: policyId });
    await expect(getApprovalRetentionClaim(claimId)).rejects.toThrow();
    transport({ ...claim(), requestId: policyId });
    await expect(createApprovalRetentionClaim(requestId, claimInput(), secure())).rejects.toThrow();
  });

  it('rejects inherited/prototype/unknown schemas and clones null-prototype native records', () => {
    for (const value of [
      null,
      [],
      Object.create(policy()),
      Object.assign(Object.create({ elevated: true }), policy()),
      JSON.parse('{"__proto__":{},"policyId":"bad"}'),
    ])
      expect(() => readApprovalRetentionPolicy(value)).toThrow();
    const native = Object.assign(Object.create(null), policy());
    expect(readApprovalRetentionPolicy(native)).toEqual(policy());
    const missing = { ...policy() };
    Reflect.deleteProperty(missing, 'published');
    expect(() => readApprovalRetentionPolicy(missing)).toThrow();
  });

  it('rejects invalid original input identities, key, version, absence and review before HTTP', async () => {
    const fetch = transport(policy());
    await expect(getApprovalRetentionRecord('../request')).rejects.toThrow();
    await expect(getApprovalRetentionClaim('bad')).rejects.toThrow();
    await expect(
      initializeApprovalRetentionPolicy(
        { expectedAbsent: false, idempotencyKey: key } as unknown as Parameters<
          typeof initializeApprovalRetentionPolicy
        >[0],
        legacy
      )
    ).rejects.toThrow();
    await expect(
      saveApprovalRetentionPolicy(
        policyId,
        { expectedVersion: -1, idempotencyKey: key, rules: rules() },
        legacy
      )
    ).rejects.toThrow();
    await expect(
      saveApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: 'x'.repeat(129), rules: rules() },
        legacy
      )
    ).rejects.toThrow();
    await expect(
      publishApprovalRetentionPolicy(
        policyId,
        { expectedVersion: 0, idempotencyKey: key, reviewComment: 'short' },
        secure()
      )
    ).rejects.toThrow();
    await expect(
      createApprovalRetentionClaim(requestId, { ...claimInput(), inventorySha256: 'bad' }, secure())
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
