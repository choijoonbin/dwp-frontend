// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCompensationPlanningRuntime } from '../use-compensation-planning-workspace';
import { verifyCompensationCommandResult } from '../compensation-planning-command';

import type { CompensationPlanningDataSource } from '../compensation-planning-api';
import type { PendingCompensationCommand } from '../compensation-planning-command';
import type { ProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  otherCycle: '22222222-2222-4222-8222-222222222222',
  receipt: '33333333-3333-4333-8333-333333333333',
  correlation: '44444444-4444-4444-8444-444444444444',
} as const;
const HASH = 'a'.repeat(64);
const NOW = '2026-10-13T08:00:00Z';
const validRevise = Object.freeze({
  guidelines: {
    components: [{
      componentCode: 'BASE', currency: 'USD', minimumAmount: '0', maximumAmount: '100',
      exceptionPolicyCode: 'NONE',
      roundingPolicyVersionPublicId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }],
    budgetMode: 'HARD_CAP' as const, effectiveFrom: '2027-01-01', effectiveTo: null,
  },
  population: {
    asOf: NOW, hrmOwnerRevision: 1,
    lines: [{
      workerPublicId: '55555555-5555-4555-8555-555555555555',
      assignmentPublicId: '66666666-6666-4666-8666-666666666666',
      organizationPublicId: '77777777-7777-4777-8777-777777777777',
      gradePublicId: null, jobProfilePublicId: null, assignmentOwnerRevision: 1,
      eligibleComponentCodes: ['BASE'],
    }],
  },
  populationSourceRef: {
    snapshotPublicId: '88888888-8888-4888-8888-888888888888', ownerRevision: 1,
    projectionSchemaId: 'CompensationPopulationContent.v1' as const,
    asOf: NOW, sha256: HASH,
    purposeCode: 'HRIS_PER_COMPENSATION_POPULATION' as const,
  },
  effectiveFrom: '2027-01-01', effectiveTo: null,
});
const authoringContext = Object.freeze({
  guidelines: validRevise.guidelines,
  population: validRevise.population,
  populationSourceRef: validRevise.populationSourceRef,
});
const cycle = {
  cycleId: ID.cycle,
  aggregateVersion: 4,
  cycleCode: 'FY27',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  status: 'OPEN' as const,
  budgetMasked: true,
};

function scope(actor = 'actor-1'): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready: true,
    contextScopeKey: 'scope:comp',
    cacheKey: ['tenant-1', actor, 'NORMAL', 'hcm.operations', 'scope:comp', 'decision-1'],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-1',
      actorId: actor,
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: 'hcm.operations',
      contextScopeKey: 'scope:comp',
      decisionRevision: 'decision-1',
    },
  };
}

function source(): CompensationPlanningDataSource {
  return {
    cycles: vi.fn().mockResolvedValue({
      items: [cycle], nextCursor: null, hasMore: false, asOf: NOW,
      scopeRevision: 1, fieldPolicyRevision: 1,
    }),
    cycle: vi.fn().mockResolvedValue({
      item: cycle, referenceEffectiveAt: NOW, freshnessWatermark: NOW,
      fieldPolicyRevision: 1,
    }),
    proposals: vi.fn().mockResolvedValue({
      items: [], nextCursor: null, hasMore: false, referenceEffectiveAt: NOW,
      freshnessWatermark: NOW, fieldPolicyRevision: 1,
    }),
    proposal: vi.fn(),
  };
}

const pending: PendingCompensationCommand = Object.freeze({
  command: 'REVISE_CYCLE',
  targetId: ID.cycle,
  envelope: Object.freeze({
    correlationId: ID.correlation,
    idempotencyKey: 'idem-1',
    expectedVersion: 4,
    body: validRevise,
  }),
});

let mount: HTMLDivElement;
let root: Root;
let client: QueryClient;
let latest: ReturnType<typeof useCompensationPlanningRuntime>;

function Harness(props: Parameters<typeof useCompensationPlanningRuntime>[0]) {
  latest = useCompensationPlanningRuntime(props);
  return null;
}

async function render(props: Parameters<typeof Harness>[0]) {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness, props))
    );
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.status).toBe('READY'));
  });
}

describe('compensation command runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState({}, '', '/');
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('fails closed when Central has not injected command registrations or authoring context', async () => {
    const executor = vi.fn();
    await render({
      requestScope: scope(),
      dataSource: source(),
      commandExecutors: { REVISE_CYCLE: executor },
      commandIntents: { revise: () => pending },
    });
    expect(latest.actions.canCreate).toBe(false);
    expect(latest.actions.canRevise).toBe(false);
    expect(latest.actions.canApprove).toBe(false);
    expect(latest.actions.canPublish).toBe(false);
    await act(async () => {
      await latest.actions.onRevise?.(validRevise);
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('replays the exact immutable envelope after an ambiguous result', async () => {
    const executor = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce({
        commandReceiptId: ID.receipt,
        status: 'COMPLETED',
        correlationId: ID.correlation,
        completedAt: NOW,
        resultDigest: HASH,
        aggregatePublicId: ID.cycle,
        aggregateVersion: 5,
        childResults: [],
      });
    await render({
      requestScope: scope(),
      dataSource: source(),
      commandExecutors: { REVISE_CYCLE: executor },
      commandIntents: { revise: () => pending },
      cycleAuthoringContext: authoringContext,
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.actions.canRevise).toBe(true));
    });

    await act(async () => {
      await Promise.resolve(latest.actions.onRevise?.(validRevise)).catch(() => undefined);
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.status).toBe('RESULT_UNKNOWN'));
    });
    expect(executor.mock.calls[0][0]).toBe(pending);

    await act(async () => latest.retryPending?.());
    await act(async () => {
      await vi.waitFor(() => expect(latest.pendingCommand).toBeNull());
    });
    expect(executor.mock.calls[1][0]).toBe(pending);
  });

  it('purges governed data on a command denial and does not accept cross-cycle publish results', async () => {
    const deniedExecutor = vi.fn().mockRejectedValue(
      new HttpError('denied', 403, { errorCode: 'POPULATION_SCOPE_DENIED' })
    );
    await render({
      requestScope: scope(),
      dataSource: source(),
      commandExecutors: { REVISE_CYCLE: deniedExecutor },
      commandIntents: { revise: () => pending },
      cycleAuthoringContext: authoringContext,
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.actions.canRevise).toBe(true));
    });
    await act(async () => {
      await Promise.resolve(latest.actions.onRevise?.(validRevise)).catch(() => undefined);
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.status).toBe('DENIED'));
    });
    expect(latest.cycles).toEqual([]);

    expect(() =>
      verifyCompensationCommandResult(
        { ...pending, command: 'PUBLISH_SNAPSHOT' },
        {
          approvalReceiptId: ID.receipt,
          cycleId: ID.otherCycle,
          snapshotId: ID.receipt,
          snapshotRevision: 1,
          sourceVersion: 4,
          aggregateVersion: 5,
          lineCount: 1,
          payloadDigest: HASH,
          correlationId: ID.correlation,
          publishedAt: NOW,
        }
      )
    ).toThrow('governed target');
  });

  it('denies cycle ID or version mismatches before commands can unlock', async () => {
    window.history.replaceState({}, '', `/?cycle=${ID.cycle}`);
    const mismatched: CompensationPlanningDataSource = {
      ...source(),
      cycle: vi.fn().mockResolvedValue({
        item: { ...cycle, cycleId: ID.otherCycle, aggregateVersion: 99 },
        referenceEffectiveAt: NOW, freshnessWatermark: NOW, fieldPolicyRevision: 1,
      }),
    };
    await act(async () => {
      root.render(createElement(
        QueryClientProvider,
        { client },
        createElement(Harness, { requestScope: scope(), dataSource: mismatched })
      ));
    });
    await act(async () => {
      await vi.waitFor(() => expect(mismatched.cycle).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(latest.errorMessage).toContain('not bound'));
    });
    expect(latest.status).toBe('ERROR');
    expect(latest.cycleDetail).toBeNull();
    expect(latest.actions.canRevise).toBe(false);
    expect(latest.errorMessage).toContain('not bound');
  });

  it('keeps the cycle visible and localizes proposal failures with retry', async () => {
    const partial: CompensationPlanningDataSource = {
      ...source(),
      proposals: vi.fn().mockRejectedValue(new Error('proposal service unavailable')),
    };
    await render({ requestScope: scope(), dataSource: partial });
    await act(async () => {
      await vi.waitFor(() => expect(latest.proposalsError).toContain('unavailable'));
    });
    expect(latest.status).toBe('READY');
    expect(latest.cycleDetail?.item.cycleId).toBe(ID.cycle);
    expect(latest.cycles).toHaveLength(1);
    expect(latest.actions.canRevise).toBe(false);
    expect(latest.retryProposals).toEqual(expect.any(Function));
  });

  it('refreshes with a new correlation without discarding the last successful projection', async () => {
    const data = source();
    const cycles = vi.mocked(data.cycles);
    await render({ requestScope: scope(), dataSource: data });
    const firstCorrelationId = cycles.mock.calls[0]?.[1].correlationId;
    expect(latest.cycles).toHaveLength(1);

    await act(async () => {
      latest.refresh();
      await vi.waitFor(() => expect(cycles).toHaveBeenCalledTimes(2));
    });

    expect(cycles.mock.calls[1]?.[1].correlationId).not.toBe(firstCorrelationId);
    expect(latest.cycles).toHaveLength(1);
  });

  it('uses the existing proposal aggregate version for an upsert instead of the cycle version', async () => {
    const proposalId = '99999999-9999-4999-8999-999999999999';
    const proposalBody = {
      content: {
        cyclePublicId: ID.cycle,
        workerPublicId: '55555555-5555-4555-8555-555555555555',
        assignmentPublicId: '66666666-6666-4666-8666-666666666666',
        componentCode: 'BASE',
        currency: 'USD',
        amount: '99',
        effectiveFrom: '2027-01-01',
        effectiveTo: null,
        exceptionReasonCode: null,
        supersedesProposalPublicId: null,
      },
    };
    const proposalSummary = {
      proposalId,
      aggregateVersion: 6,
      cycleId: ID.cycle,
      workerId: proposalBody.content.workerPublicId,
      assignmentId: proposalBody.content.assignmentPublicId,
      componentCode: 'BASE',
      currency: 'USD',
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
      currentRevision: 1,
      status: 'DRAFT' as const,
      contentDigest: HASH,
      amountMasked: true,
    };
    const data: CompensationPlanningDataSource = {
      ...source(),
      proposals: vi.fn().mockResolvedValue({
        items: [proposalSummary],
        nextCursor: null,
        hasMore: false,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 1,
      }),
    };
    const upsertPending: PendingCompensationCommand = Object.freeze({
      command: 'UPSERT_PROPOSAL',
      targetId: proposalId,
      cycleId: ID.cycle,
      envelope: Object.freeze({
        correlationId: ID.correlation,
        idempotencyKey: 'proposal-upsert-1',
        expectedVersion: proposalSummary.aggregateVersion,
        body: proposalBody,
      }),
    });
    const draftProposal = vi.fn(() => upsertPending);
    const executor = vi.fn(async (candidate: PendingCompensationCommand) => ({
      commandReceiptId: ID.receipt,
      status: 'COMPLETED' as const,
      correlationId: candidate.envelope.correlationId,
      completedAt: NOW,
      resultDigest: HASH,
      aggregatePublicId: proposalId,
      aggregateVersion: proposalSummary.aggregateVersion + 1,
      childResults: [],
    }));
    window.history.replaceState({}, '', `/?cycle=${ID.cycle}`);
    await render({
      requestScope: scope(),
      dataSource: data,
      commandExecutors: { UPSERT_PROPOSAL: executor },
      commandIntents: { draftProposal },
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.proposals?.items).toHaveLength(1));
      await vi.waitFor(() => expect(latest.actions.canDraftProposal).toBe(true));
    });

    await act(async () => {
      await latest.actions.onDraftProposal?.(proposalId, proposalBody);
    });

    expect(draftProposal).toHaveBeenCalledWith(
      ID.cycle,
      proposalSummary.aggregateVersion,
      proposalId,
      proposalBody
    );
    expect(draftProposal.mock.calls[0]?.[1]).not.toBe(cycle.aggregateVersion);
    expect(executor).toHaveBeenCalledWith(upsertPending);
  });

  it('rejects a proposal freshness advance that is not anchored to the selected cycle', async () => {
    const proposalId = '99999999-9999-4999-8999-999999999999';
    const later = '2026-10-13T08:00:01Z';
    const summary = {
      proposalId, aggregateVersion: 2, cycleId: ID.cycle,
      workerId: '55555555-5555-4555-8555-555555555555',
      assignmentId: '66666666-6666-4666-8666-666666666666',
      componentCode: 'BASE', currency: 'USD', effectiveFrom: '2027-01-01',
      effectiveTo: null, currentRevision: 1, status: 'DRAFT' as const,
      contentDigest: HASH, amountMasked: true,
    };
    const revised = {
      ...summary,
      aggregateVersion: 3,
      currentRevision: 2,
      contentDigest: 'b'.repeat(64),
    };
    const data: CompensationPlanningDataSource = {
      ...source(),
      proposals: vi.fn()
        .mockResolvedValueOnce({
          items: [summary], nextCursor: null, hasMore: false,
          referenceEffectiveAt: NOW, freshnessWatermark: NOW, fieldPolicyRevision: 1,
        })
        .mockResolvedValueOnce({
          items: [revised], nextCursor: null, hasMore: false,
          referenceEffectiveAt: NOW, freshnessWatermark: later, fieldPolicyRevision: 1,
        }),
      proposal: vi.fn().mockResolvedValue({
        item: { ...summary, amountMasked: false, amount: '99' },
        referenceEffectiveAt: NOW, freshnessWatermark: NOW, fieldPolicyRevision: 1,
      }),
    };
    const proposals = vi.mocked(data.proposals);
    const proposal = vi.mocked(data.proposal);
    window.history.replaceState({}, '', `/?cycle=${ID.cycle}&proposal=${proposalId}`);
    await render({ requestScope: scope(), dataSource: data });
    await act(async () => {
      await vi.waitFor(() => expect(latest.proposalDetail?.item.amount).toBe('99'));
    });

    await act(async () => {
      latest.retryProposals();
      await vi.waitFor(() => expect(proposals).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(latest.proposalsError).toContain('not bound'));
    });
    expect(proposal).toHaveBeenCalledTimes(1);
    expect(latest.actions.canSubmitProposal).toBe(false);
  });

  it('denies proposal cycle, policy, or freshness mismatches without rendering detail', async () => {
    const proposalId = '99999999-9999-4999-8999-999999999999';
    const summary = {
      proposalId, aggregateVersion: 2, cycleId: ID.cycle,
      workerId: '55555555-5555-4555-8555-555555555555',
      assignmentId: '66666666-6666-4666-8666-666666666666',
      componentCode: 'BASE', currency: 'USD', effectiveFrom: '2027-01-01',
      effectiveTo: null, currentRevision: 1, status: 'DRAFT' as const,
      contentDigest: HASH, amountMasked: true,
    };
    const mismatched: CompensationPlanningDataSource = {
      ...source(),
      proposals: vi.fn().mockResolvedValue({
        items: [summary], nextCursor: null, hasMore: false,
        referenceEffectiveAt: NOW, freshnessWatermark: NOW, fieldPolicyRevision: 1,
      }),
      proposal: vi.fn().mockResolvedValue({
        item: { ...summary, cycleId: ID.otherCycle, amountMasked: false, amount: '99' },
        referenceEffectiveAt: NOW,
        freshnessWatermark: '2026-10-13T08:00:01Z',
        fieldPolicyRevision: 2,
      }),
    };
    await render({ requestScope: scope(), dataSource: mismatched });
    await act(async () => latest.selectProposal(proposalId));
    await act(async () => {
      await vi.waitFor(() => expect(latest.proposalDetailError).toContain('not bound'));
    });
    expect(latest.proposalDetail).toBeNull();
    expect(latest.actions.canSubmitProposal).toBe(false);
  });
});
