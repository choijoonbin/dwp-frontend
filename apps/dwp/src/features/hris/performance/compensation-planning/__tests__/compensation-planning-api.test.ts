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
  COMPENSATION_PLANNING_PROJECTION_VERSION,
  COMPENSATION_PLANNING_PROJECTION_VERSION_HEADER,
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
const WORKER = '66666666-6666-4666-8666-666666666666';
const ASSIGNMENT = '77777777-7777-4777-8777-777777777777';
const ORGANIZATION = '99999999-9999-4999-8999-999999999999';
const POLICY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const guidelines = {
  components: [{
    componentCode: 'BASE', currency: 'USD', minimumAmount: '0', maximumAmount: '100',
    exceptionPolicyCode: 'NONE', roundingPolicyVersionPublicId: POLICY,
  }],
  budgetMode: 'HARD_CAP' as const, effectiveFrom: '2027-01-01', effectiveTo: null,
};
const population = {
  asOf: NOW, hrmOwnerRevision: 1,
  lines: [{
    workerPublicId: WORKER, assignmentPublicId: ASSIGNMENT,
    organizationPublicId: ORGANIZATION, gradePublicId: null, jobProfilePublicId: null,
    assignmentOwnerRevision: 1, eligibleComponentCodes: ['BASE'],
  }],
};
const sourceRef = {
  snapshotPublicId: ID.snapshot, ownerRevision: 1,
  projectionSchemaId: 'CompensationPopulationContent.v1' as const,
  asOf: NOW, sha256: HASH,
  purposeCode: 'HRIS_PER_COMPENSATION_POPULATION' as const,
};
const createBody = {
  cycleCode: 'FY27', guidelines, population, effectiveFrom: '2027-01-01',
  effectiveTo: null, populationSourceRef: sourceRef,
};
const reviseBody = {
  guidelines, population, effectiveFrom: '2027-01-01', effectiveTo: null,
  populationSourceRef: sourceRef,
};
const proposalBody = {
  content: {
    cyclePublicId: ID.cycle, workerPublicId: WORKER, assignmentPublicId: ASSIGNMENT,
    componentCode: 'BASE', currency: 'USD', amount: '10.25',
    effectiveFrom: '2027-01-01', effectiveTo: null,
    exceptionReasonCode: null, supersedesProposalPublicId: null,
  },
};
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
  workerId: WORKER,
  assignmentId: ASSIGNMENT,
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
    expect(transport.get.mock.calls[1][1].headers).toEqual({
      'X-Correlation-ID': ID.correlation,
      [COMPENSATION_PLANNING_PROJECTION_VERSION_HEADER]:
        COMPENSATION_PLANNING_PROJECTION_VERSION,
    });
    for (const [, config] of [
      transport.get.mock.calls[0],
      transport.get.mock.calls[2],
      transport.get.mock.calls[3],
    ]) {
      expect(config.headers).not.toHaveProperty(
        COMPENSATION_PLANNING_PROJECTION_VERSION_HEADER
      );
    }
  });

  it('keeps command metadata in headers and applies HIGH proof only to approve/publish', async () => {
    transport.post.mockImplementation((_path, _body) => response(receipt));
    const createEnvelope = {
      correlationId: ID.correlation,
      idempotencyKey: 'idem-1',
      body: createBody,
    };

    await createCompensationCycle(createEnvelope, authority);
    transport.post.mockImplementationOnce((_path, _body) => response(rich));
    await reviseCompensationCycle(ID.cycle, {
      ...createEnvelope, expectedVersion: 4, body: reviseBody,
    }, authority);
    await allocateCompensationBudget(ID.cycle, {
      ...createEnvelope, expectedVersion: 4,
      body: { organizationPublicId: ORGANIZATION, amount: '10.25', currency: 'USD',
        ledgerEntryType: 'ALLOCATE' as const, reversesEntryPublicId: null },
    }, authority);
    transport.post.mockImplementationOnce((_path, _body) => response({
      ...rich,
      aggregatePublicId: ID.proposal,
    }));
    await upsertCompensationProposal(ID.cycle, ID.proposal, {
      ...createEnvelope, expectedVersion: 4, body: proposalBody,
    }, authority);
    transport.post.mockImplementationOnce((_path, _body) => response({
      ...receipt,
      aggregateId: ID.proposal,
    }));
    await submitCompensationProposal(ID.cycle, ID.proposal, {
      ...createEnvelope, expectedVersion: 4,
      body: { submissionDigest: HASH, effectiveDate: '2027-01-01' },
    }, authority);
    await approveCompensationPlan(ID.cycle, {
      ...createEnvelope, expectedVersion: 4,
      body: { decision: 'APPROVE', reasonCode: 'ANNUAL_REVIEW' },
    }, authority);
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
    await publishCompensationSnapshot(ID.cycle, {
      ...createEnvelope, expectedVersion: 4,
      body: { approvalReceiptId: ID.receipt },
    }, authority);
    transport.post.mockImplementationOnce((_path, _body) => response(rich));
    await cancelCompensationCycle(ID.cycle, {
      ...createEnvelope, expectedVersion: 4, body: {},
    }, authority);

    expect(transport.governed).toHaveBeenCalledTimes(6);
    expect(transport.highRisk).toHaveBeenCalledTimes(2);
    expect(transport.post.mock.calls[0][2].headers).not.toHaveProperty('If-Match');
    for (const call of transport.post.mock.calls.slice(1)) {
      expect(call[2].headers).toMatchObject({
        'X-Correlation-ID': ID.correlation,
        'Idempotency-Key': 'idem-1',
        'If-Match': '4',
      });
      expect(Object.isFrozen(call[1])).toBe(true);
    }
    expect(transport.post.mock.calls.map(([path]) => path)).toHaveLength(8);
  });

  it('rejects noncanonical outgoing money before transport', async () => {
    await expect(allocateCompensationBudget(ID.cycle, {
      correlationId: ID.correlation,
      idempotencyKey: 'idem-1',
      expectedVersion: 4,
      body: {
        organizationPublicId: ORGANIZATION,
        amount: '1.20',
        currency: 'USD',
        ledgerEntryType: 'ALLOCATE',
        reversesEntryPublicId: null,
      },
    }, authority)).rejects.toThrow('contract payload');
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('rejects missing versions and mismatched sealed authority before transport', async () => {
    expect(() =>
      reviseCompensationCycle(
        ID.cycle,
        { correlationId: ID.correlation, idempotencyKey: 'idem-1', body: reviseBody },
        authority
      )
    ).toThrow('If-Match');
    await expect(
      reviseCompensationCycle(
        ID.cycle,
        { correlationId: ID.correlation, idempotencyKey: 'different', expectedVersion: 4,
          body: reviseBody },
        authority
      )
    ).rejects.toThrow('authority');
    expect(transport.post).not.toHaveBeenCalled();
  });
});
