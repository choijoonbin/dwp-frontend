import { beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  governed: vi.fn(() => ({
    contextScopeKey: 'scope:comp',
    headers: { 'X-DWP-Expected-Decision-Revision': 'decision-7' },
  })),
  highRisk: vi.fn(() => ({
    contextScopeKey: 'scope:comp',
    headers: {
      'X-DWP-Expected-Decision-Revision': 'decision-7',
      'X-DWP-Step-Up-Challenge': 'proof',
    },
  })),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: transport.get, post: transport.post },
  productSurfaceGovernedMutationConfig: transport.governed,
  productSurfaceHighRiskMutationConfig: transport.highRisk,
}));

import {
  allocateCompensationBudget,
  approveCompensationPlan,
  cancelCompensationCycle,
  createCompensationCycle,
  publishCompensationSnapshot,
  queryCompensationCycle,
  queryCompensationCycles,
  queryCompensationProposal,
  queryCompensationProposals,
  reviseCompensationCycle,
  submitCompensationProposal,
  upsertCompensationProposal,
} from '../compensation-planning-api';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  proposal: '22222222-2222-4222-8222-222222222222',
  receipt: '33333333-3333-4333-8333-333333333333',
  correlation: '44444444-4444-4444-8444-444444444444',
  snapshot: '55555555-5555-4555-8555-555555555555',
} as const;
const HASH = 'a'.repeat(64);
const NOW = '2026-10-13T08:00:00Z';
const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-7',
  contextKey: 'hcm.operations',
  contextScopeKey: 'scope:comp',
  idempotencyKey: 'idem-1',
  objectVersion: 4,
  stepUp: {
    challenge: 'proof',
    challengeId: 'challenge-1',
    decisionRevision: 'decision-7',
    expiresAt: '2099-01-01T00:00:00Z',
  },
} as const satisfies ProductSurfaceGovernedMutationAuthority;

const cycle = {
  cycleId: ID.cycle,
  aggregateVersion: 4,
  cycleCode: 'FY27',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  status: 'OPEN',
  budgetMasked: true,
};
const proposal = {
  proposalId: ID.proposal,
  aggregateVersion: 2,
  cycleId: ID.cycle,
  workerId: '66666666-6666-4666-8666-666666666666',
  assignmentId: '77777777-7777-4777-8777-777777777777',
  componentCode: 'BASE',
  currency: 'USD',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  currentRevision: 1,
  status: 'DRAFT',
  contentDigest: HASH,
  amountMasked: true,
};
const receipt = {
  receiptId: ID.receipt,
  status: 'COMPLETED',
  aggregateId: ID.cycle,
  aggregateVersion: 5,
  correlationId: ID.correlation,
  occurredAt: NOW,
  payloadDigest: HASH,
};
const rich = {
  commandReceiptId: ID.receipt,
  status: 'COMPLETED',
  correlationId: ID.correlation,
  completedAt: NOW,
  resultDigest: HASH,
  aggregatePublicId: ID.cycle,
  aggregateVersion: 5,
  childResults: [],
};

const response = (data: unknown) => Promise.resolve({ data: { data } });

describe('compensation-planning API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses all four exact read paths with correlation, scope, pagination, and abort', async () => {
    const signal = new AbortController().signal;
    transport.get
      .mockImplementationOnce(() =>
        response({
          items: [cycle], nextCursor: null, hasMore: false, asOf: NOW,
          scopeRevision: 2, fieldPolicyRevision: 3,
        })
      )
      .mockImplementationOnce(() =>
        response({ item: cycle, referenceEffectiveAt: NOW, freshnessWatermark: NOW,
          fieldPolicyRevision: 3 })
      )
      .mockImplementationOnce(() =>
        response({ items: [proposal], nextCursor: null, hasMore: false,
          referenceEffectiveAt: NOW, freshnessWatermark: NOW, fieldPolicyRevision: 3 })
      )
      .mockImplementationOnce(() =>
        response({ item: proposal, referenceEffectiveAt: NOW, freshnessWatermark: NOW,
          fieldPolicyRevision: 3 })
      );
    const context = {
      correlationId: ID.correlation,
      contextScopeKey: 'scope:comp',
      signal,
    };

    await queryCompensationCycles({ asOf: NOW, cursor: 'opaque', limit: 25 }, context);
    await queryCompensationCycle('cycle/../id', context);
    await queryCompensationProposals(ID.cycle, { referenceEffectiveAt: NOW, limit: 50 }, context);
    await queryCompensationProposal('proposal?#id', context);

    expect(transport.get.mock.calls.map(([url]) => url)).toEqual([
      `/api/people/v1/hris/performance/compensation-planning/cycles?asOf=${encodeURIComponent(NOW)}&cursor=opaque&limit=25`,
      '/api/people/v1/hris/performance/compensation-planning/cycles/cycle%2F..%2Fid',
      `/api/people/v1/hris/performance/compensation-planning/cycles/${ID.cycle}/proposals?referenceEffectiveAt=${encodeURIComponent(NOW)}&limit=50`,
      '/api/people/v1/hris/performance/compensation-planning/proposals/proposal%3F%23id',
    ]);
    for (const [, config] of transport.get.mock.calls) {
      expect(config).toMatchObject({
        contextScopeKey: 'scope:comp',
        signal,
        headers: { 'X-Correlation-ID': ID.correlation },
      });
    }
  });

  it('keeps command metadata in headers and applies HIGH proof only to approve/publish', async () => {
    transport.post.mockImplementation((_path, _body) => response(receipt));
    const body = {} as never;
    const createEnvelope = {
      correlationId: ID.correlation,
      idempotencyKey: 'idem-1',
      body,
    };
    const envelope = { ...createEnvelope, expectedVersion: 4 };

    await createCompensationCycle(createEnvelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response(rich));
    await reviseCompensationCycle(ID.cycle, envelope, authority);
    await allocateCompensationBudget(ID.cycle, envelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response({
      ...rich,
      aggregatePublicId: ID.proposal,
    }));
    await upsertCompensationProposal(ID.cycle, ID.proposal, envelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response({
      ...receipt,
      aggregateId: ID.proposal,
    }));
    await submitCompensationProposal(ID.cycle, ID.proposal, envelope, authority);
    await approveCompensationPlan(ID.cycle, envelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response({
      approvalReceiptId: ID.receipt,
      cycleId: ID.cycle,
      snapshotId: ID.snapshot,
      snapshotRevision: 1,
      sourceVersion: 4,
      aggregateVersion: 5,
      lineCount: 1,
      payloadDigest: HASH,
      correlationId: ID.correlation,
      publishedAt: NOW,
    }));
    await publishCompensationSnapshot(ID.cycle, envelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response(rich));
    await cancelCompensationCycle(ID.cycle, envelope, authority);

    expect(transport.governed).toHaveBeenCalledTimes(6);
    expect(transport.highRisk).toHaveBeenCalledTimes(2);
    expect(transport.post.mock.calls[0][2].headers).not.toHaveProperty('If-Match');
    for (const call of transport.post.mock.calls.slice(1)) {
      expect(call[2].headers).toMatchObject({
        'X-Correlation-ID': ID.correlation,
        'Idempotency-Key': 'idem-1',
        'If-Match': '4',
      });
      expect(call[1]).toBe(body);
    }
    expect(transport.post.mock.calls.map(([path]) => path)).toHaveLength(8);
  });

  it('rejects missing versions and mismatched sealed authority before transport', async () => {
    expect(() =>
      reviseCompensationCycle(
        ID.cycle,
        { correlationId: ID.correlation, idempotencyKey: 'idem-1', body: {} as never },
        authority
      )
    ).toThrow('If-Match');
    await expect(
      reviseCompensationCycle(
        ID.cycle,
        { correlationId: ID.correlation, idempotencyKey: 'different', expectedVersion: 4,
          body: {} as never },
        authority
      )
    ).rejects.toThrow('authority');
    expect(transport.post).not.toHaveBeenCalled();
  });
});
