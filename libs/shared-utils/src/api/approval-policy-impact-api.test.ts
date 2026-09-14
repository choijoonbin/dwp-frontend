import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApprovalPolicyImpact } from './approval-policy-impact-api';
import { readApprovalPolicyImpact } from './approval-policy-impact-contract';
import {
  policyImpactAuthority,
  policyImpactFixture,
  policyImpactId,
} from '../test-utils/approval-policy-impact-fixtures';
import type { ApprovalPolicyImpactReadAuthority } from './approval-policy-impact-contract';

const expected = { policyId: policyImpactId, expectedVersion: 2, authority: policyImpactAuthority };
const response = (value: unknown, status = 200) =>
  ({ ok: status === 200, status, text: async () => JSON.stringify({ data: value }) }) as Response;
describe('policy impact read-only source boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('performs the canonical versioned GET with selected opaque context and no mutation proof', async () => {
    const fetch = vi.fn().mockResolvedValue(response(policyImpactFixture()));
    vi.stubGlobal('fetch', fetch);
    const guard = vi.fn();
    await getApprovalPolicyImpact(policyImpactId, 2, policyImpactAuthority, {
      beforeDispatch: guard,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      `/api/approvals/v1/admin/policies/${policyImpactId}/impact?expectedVersion=2&contextScopeKey=opaque-owner-scope`
    );
    expect(init.method).toBe('GET');
    expect(init.headers['X-DWP-Expected-Decision-Revision']).toBe(
      policyImpactAuthority.expectedDecisionRevision
    );
    for (const key of [
      'Idempotency-Key',
      'X-DWP-Step-Up-Challenge',
      'X-DWP-Expected-Object-Version',
      'X-XSRF-TOKEN',
    ])
      expect(init.headers[key]).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(guard).toHaveBeenCalledTimes(3);
  });
  it.each(['000', '100', '112'])(
    'rejects unsupported rollout %s before network dispatch',
    async (rolloutState) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        getApprovalPolicyImpact(policyImpactId, 2, {
          ...policyImpactAuthority,
          rolloutState,
        } as ApprovalPolicyImpactReadAuthority)
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it.each(['idempotencyKey', 'stepUp', 'objectVersion'])(
    'rejects borrowed ACTION field %s',
    async (key) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        getApprovalPolicyImpact(policyImpactId, 2, { ...policyImpactAuthority, [key]: 'borrowed' })
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('rejects malformed target/version and stale revisions before network dispatch', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const version of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])
      await expect(
        getApprovalPolicyImpact(policyImpactId, version, policyImpactAuthority)
      ).rejects.toThrow();
    await expect(getApprovalPolicyImpact('../other', 2, policyImpactAuthority)).rejects.toThrow();
    await expect(
      getApprovalPolicyImpact(policyImpactId, 2, {
        ...policyImpactAuthority,
        expectedDecisionRevision: 'old',
      })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rechecks the current source after a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(policyImpactFixture())));
    let calls = 0;
    await expect(
      getApprovalPolicyImpact(policyImpactId, 2, policyImpactAuthority, {
        beforeDispatch: () => {
          if (++calls === 3) throw new Error('source revoked during read');
        },
      })
    ).rejects.toThrow('source revoked during read');
  });
  it.each([403, 409, 503])('does not retry an authority/source failure %s', async (status) => {
    const fetch = vi.fn().mockResolvedValue(response(null, status));
    vi.stubGlobal('fetch', fetch);
    await expect(
      getApprovalPolicyImpact(policyImpactId, 2, policyImpactAuthority)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('accepts genuine omitted/null optional historical metadata without inventing a published version', () => {
    const fixture = policyImpactFixture();
    const parsed = readApprovalPolicyImpact(fixture, expected);
    expect(parsed.policy.publishedVersion).toBeUndefined();
    expect(Object.isFrozen(parsed.authority.grants)).toBe(true);
    expect(Object.isFrozen(fixture)).toBe(false);
    expect(
      readApprovalPolicyImpact(
        {
          ...fixture,
          policy: {
            ...fixture.policy,
            capturedAt: null,
            publishedVersionId: null,
            publishedVersion: null,
          },
        },
        expected
      ).policy.capturedAt
    ).toBeNull();
  });
  it('distinguishes a current policy observation with no saved proposal', () => {
    const fixture = policyImpactFixture();
    expect(
      readApprovalPolicyImpact(
        {
          ...fixture,
          status: 'NO_PROPOSAL',
          policy: { ...fixture.policy, pending: null },
          semanticDiff: [],
        },
        expected
      ).status
    ).toBe('NO_PROPOSAL');
    expect(() =>
      readApprovalPolicyImpact({ ...fixture, status: 'NO_PROPOSAL' }, expected)
    ).toThrow();
  });
  it('allows the real 100-item sample of a complete 1000-item scan, with overlapping effect counts', () => {
    const fixture = policyImpactFixture();
    fixture.workflows.counts = {
      examined: 1000,
      constraintChanged: 1000,
      pinConflict: 1000,
      configurationOnly: 0,
      unknown: 0,
      complete: true,
      countKind: 'EXACT_OBSERVED_AT',
    };
    fixture.workflows.items = Array.from({ length: 100 }, (_, index) => ({
      id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
      version: 0,
      effect: {
        reasons: ['POLICY_CONSTRAINT_CHANGED'],
        constraintChanged: true,
        pinConflict: true,
        configurationOnly: false,
        unknown: false,
      },
    }));
    expect(readApprovalPolicyImpact(fixture, expected).workflows.counts.examined).toBe(1000);
  });
  it('requires partial evaluation to use lower-bound counts rather than a false COMPLETE result', () => {
    const fixture = policyImpactFixture();
    fixture.tasks.counts = {
      examined: 1,
      constraintChanged: 0,
      pinConflict: 0,
      configurationOnly: 0,
      unknown: 1,
      complete: false,
      countKind: 'OBSERVED_LOWER_BOUND',
    };
    fixture.tasks.items = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        version: 0,
        effect: {
          reasons: ['RUNTIME_SOURCE_OR_EVALUATION_BUDGET_UNAVAILABLE'],
          constraintChanged: false,
          pinConflict: false,
          configurationOnly: false,
          unknown: true,
        },
      },
    ];
    expect(() => readApprovalPolicyImpact(fixture, expected)).toThrow();
    expect(
      readApprovalPolicyImpact({ ...fixture, status: 'PARTIAL' }, expected).tasks.counts.unknown
    ).toBe(1);
  });
  it('rejects authority drift, missing combined grants and expired windows', () => {
    const fixture = policyImpactFixture();
    for (const patch of [
      { tenantId: 2 },
      { actorId: 14 },
      { resourceSetKey: 'RS_OTHER' },
      { contextKey: 'other' },
      { contextScopeKey: 'other' },
      { decisionRevision: `psr-${'c'.repeat(64)}` },
      { routeKey: 'route.other' },
      { providerIdentity: true },
      { supportSession: true },
      { entitlementSatisfied: false },
      { validUntil: new Date(Date.now() - 1).toISOString() },
      { grants: { 'approvals.policy.read': fixture.authority.grants['approvals.policy.read'] } },
    ]) {
      expect(() =>
        readApprovalPolicyImpact(
          { ...fixture, authority: { ...fixture.authority, ...patch } },
          expected
        )
      ).toThrow();
    }
  });
  it('rejects source drift, unknown fields, incoherent counts and unsafe bounded JSON', () => {
    const fixture = policyImpactFixture();
    const deep: Record<string, unknown> = {};
    let node = deep;
    for (let index = 0; index < 18; index++) {
      const next = {};
      node.child = next;
      node = next;
    }
    for (const value of [
      { ...fixture, extra: true },
      { ...fixture, sourceDigest: 'old' },
      { ...fixture, policy: { ...fixture.policy, rowVersion: 3 } },
      {
        ...fixture,
        policy: {
          ...fixture.policy,
          current: {
            ...fixture.policy.current,
            rule: { requesterCannotDecide: true, extra: true },
          },
        },
      },
      {
        ...fixture,
        semanticDiff: [{ path: '$.rule', kind: 'CHANGE', current: deep, proposed: {} }],
      },
      {
        ...fixture,
        semanticDiff: [
          { path: '$.rule', kind: 'CHANGE', current: JSON.parse('{"__proto__":{}}'), proposed: {} },
        ],
      },
      {
        ...fixture,
        workflows: { ...fixture.workflows, counts: { ...fixture.workflows.counts, unknown: 1 } },
      },
    ])
      expect(() => readApprovalPolicyImpact(value, expected)).toThrow();
  });
});
