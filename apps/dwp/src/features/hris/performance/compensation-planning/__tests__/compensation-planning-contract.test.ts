import { describe, expect, it } from 'vitest';

import {
  COMPENSATION_PLANNING_PAGE_ROUTE_CONTRACT,
  COMPENSATION_PLANNING_ROUTE,
  COMPENSATION_PLANNING_VIEW_CAPABILITY,
  parseCompensationCycleCollection,
  parseCompensationCycleDetail,
  parseApproveCompensationPlanBody,
  parseCancelCompensationCycleBody,
  parseCompensationBudgetBody,
  parseCompensationCycleAuthoringContext,
  parseCompensationProposalCollection,
  parseCompensationRichCommandResult,
  parseCompensationSnapshotPublished,
  parseCreateCompensationCycleBody,
  parsePerformanceCommandReceipt,
  parsePublishCompensationSnapshotBody,
  parseReviseCompensationCycleBody,
  parseSubmitCompensationProposalBody,
  parseUpsertCompensationProposalBody,
} from '../compensation-planning-contract';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  proposal: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
  organization: '55555555-5555-4555-8555-555555555555',
  receipt: '66666666-6666-4666-8666-666666666666',
  correlation: '77777777-7777-4777-8777-777777777777',
  snapshot: '88888888-8888-4888-8888-888888888888',
  child: '99999999-9999-4999-8999-999999999999',
  policy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
} as const;
const HASH = 'a'.repeat(64);
const NOW = '2026-10-13T08:00:00Z';

const cycle = {
  cycleId: ID.cycle,
  aggregateVersion: 4,
  cycleCode: 'FY27',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  status: 'PROPOSAL_REVIEW',
  budgetMasked: true,
} as const;

const proposal = {
  proposalId: ID.proposal,
  aggregateVersion: 2,
  cycleId: ID.cycle,
  workerId: ID.worker,
  assignmentId: ID.assignment,
  componentCode: 'BASE',
  currency: 'USD',
  effectiveFrom: '2027-01-01',
  effectiveTo: null,
  currentRevision: 2,
  status: 'SUBMITTED',
  contentDigest: HASH,
  amountMasked: true,
} as const;

describe('sealed compensation-planning contracts', () => {
  it('pins the canonical governed PAGE route and view capability', () => {
    expect(COMPENSATION_PLANNING_ROUTE).toBe('/hr/operations/performance/compensation-planning');
    expect(COMPENSATION_PLANNING_PAGE_ROUTE_CONTRACT).toBe(
      'route.hcm.operations.compensation-planning.page'
    );
    expect(COMPENSATION_PLANNING_VIEW_CAPABILITY).toBe('hcm.compensation.plan.view');
  });

  it('accepts only the exact list/detail projections and cursor invariant', () => {
    const collection = parseCompensationCycleCollection({
      items: [cycle],
      nextCursor: null,
      hasMore: false,
      asOf: NOW,
      scopeRevision: 7,
      fieldPolicyRevision: 8,
    });
    expect(collection.items).toEqual([cycle]);
    expect(Object.isFrozen(collection)).toBe(true);

    const detail = parseCompensationCycleDetail({
      item: {
        ...cycle,
        budgetMasked: false,
        guidelines: {
          components: [
            {
              componentCode: 'BASE',
              currency: 'USD',
              minimumAmount: '1',
              maximumAmount: '999999.9999',
              exceptionPolicyCode: 'NONE',
              roundingPolicyVersionPublicId: ID.policy,
            },
          ],
          budgetMode: 'HARD_CAP',
          effectiveFrom: '2027-01-01',
          effectiveTo: null,
        },
        population: {
          asOf: NOW,
          hrmOwnerRevision: 12,
          lines: [
            {
              workerPublicId: ID.worker,
              assignmentPublicId: ID.assignment,
              organizationPublicId: ID.organization,
              gradePublicId: null,
              jobProfilePublicId: null,
              assignmentOwnerRevision: 3,
              eligibleComponentCodes: ['BASE'],
            },
          ],
        },
        budgetEntries: [],
      },
      referenceEffectiveAt: NOW,
      freshnessWatermark: NOW,
      fieldPolicyRevision: 8,
    });
    expect(detail.item.guidelines?.budgetMode).toBe('HARD_CAP');

    expect(() =>
      parseCompensationCycleCollection({
        items: [cycle],
        nextCursor: 'cursor-without-more',
        hasMore: false,
        asOf: NOW,
        scopeRevision: 7,
        fieldPolicyRevision: 8,
      })
    ).toThrow();
    expect(() =>
      parseCompensationCycleCollection({
        items: [{ ...cycle, forbiddenBudgetTotal: '10' }],
        nextCursor: null,
        hasMore: false,
        asOf: NOW,
        scopeRevision: 7,
        fieldPolicyRevision: 8,
      })
    ).toThrow();
  });

  it('never admits masked proposal amounts or exception approval content', () => {
    expect(
      parseCompensationProposalCollection({
        items: [proposal],
        nextCursor: null,
        hasMore: false,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 8,
      }).items[0].amountMasked
    ).toBe(true);

    expect(() =>
      parseCompensationProposalCollection({
        items: [{ ...proposal, amount: '100' }],
        nextCursor: null,
        hasMore: false,
        referenceEffectiveAt: NOW,
        freshnessWatermark: NOW,
        fieldPolicyRevision: 8,
      })
    ).toThrow();
  });

  it('parses the three exact command result families and rejects extra fields', () => {
    const receipt = parsePerformanceCommandReceipt({
      receiptId: ID.receipt,
      status: 'COMPLETED',
      aggregateId: ID.cycle,
      aggregateVersion: 5,
      correlationId: ID.correlation,
      occurredAt: NOW,
      payloadDigest: HASH,
    });
    expect(receipt.aggregateId).toBe(ID.cycle);

    const rich = parseCompensationRichCommandResult({
      commandReceiptId: ID.receipt,
      status: 'COMPLETED',
      correlationId: ID.correlation,
      completedAt: NOW,
      resultDigest: HASH,
      aggregatePublicId: ID.cycle,
      aggregateVersion: 5,
      childResults: [
        {
          entityType: 'COMPENSATION_PROPOSAL',
          publicId: ID.child,
          aggregateVersion: 2,
          ordinal: 1,
          resultDigest: HASH,
        },
      ],
    });
    expect(rich.childResults[0].ordinal).toBe(1);

    const published = parseCompensationSnapshotPublished({
      approvalReceiptId: ID.receipt,
      cycleId: ID.cycle,
      snapshotId: ID.snapshot,
      snapshotRevision: 1,
      sourceVersion: 5,
      aggregateVersion: 6,
      lineCount: 1,
      payloadDigest: HASH,
      correlationId: ID.correlation,
      publishedAt: NOW,
    });
    expect(published.sourceVersion).toBe(5);
    expect(() =>
      parseCompensationSnapshotPublished({ ...published, lines: [] })
    ).toThrow();
  });

  it('rejects noncanonical money, timestamps, ordering, and zero-line snapshots', () => {
    for (const noncanonical of ['1.0', '1.20', '0.0', '01', '1e2']) {
      expect(() =>
        parseCompensationCycleDetail({
          item: {
            ...cycle,
            budgetMasked: false,
            guidelines: {
              components: [
                {
                  componentCode: 'BASE',
                  currency: 'USD',
                  minimumAmount: noncanonical,
                  maximumAmount: '100',
                  exceptionPolicyCode: 'NONE',
                  roundingPolicyVersionPublicId: ID.policy,
                },
              ],
              budgetMode: 'HARD_CAP',
              effectiveFrom: '2027-01-01',
              effectiveTo: null,
            },
            population: {
              asOf: NOW,
              hrmOwnerRevision: 12,
              lines: [{
                workerPublicId: ID.worker,
                assignmentPublicId: ID.assignment,
                organizationPublicId: ID.organization,
                gradePublicId: null,
                jobProfilePublicId: null,
                assignmentOwnerRevision: 3,
                eligibleComponentCodes: ['BASE'],
              }],
            },
            budgetEntries: [],
          },
          referenceEffectiveAt: NOW,
          freshnessWatermark: NOW,
          fieldPolicyRevision: 8,
        })
      ).toThrow();
    }

    expect(() =>
      parseCompensationRichCommandResult({
        commandReceiptId: ID.receipt,
        status: 'COMPLETED',
        correlationId: ID.correlation,
        completedAt: NOW,
        resultDigest: HASH,
        aggregatePublicId: ID.cycle,
        aggregateVersion: 5,
        childResults: [
          {
            entityType: 'COMPENSATION_PROPOSAL',
            publicId: ID.child,
            aggregateVersion: 2,
            ordinal: 2,
            resultDigest: HASH,
          },
        ],
      })
    ).toThrow();
    expect(() =>
      parseCompensationSnapshotPublished({
        approvalReceiptId: ID.receipt,
        cycleId: ID.cycle,
        snapshotId: ID.snapshot,
        snapshotRevision: 1,
        sourceVersion: 5,
        aggregateVersion: 6,
        lineCount: 0,
        payloadDigest: HASH,
        correlationId: ID.correlation,
        publishedAt: NOW,
      })
    ).toThrow();
  });

  it('validates every outgoing closed command body and rejects money at its exact field', () => {
    const guidelines = {
      components: [{
        componentCode: 'BASE', currency: 'USD', minimumAmount: '0', maximumAmount: '100',
        exceptionPolicyCode: 'NONE', roundingPolicyVersionPublicId: ID.policy,
      }],
      budgetMode: 'HARD_CAP', effectiveFrom: '2027-01-01', effectiveTo: null,
    } as const;
    const population = {
      asOf: NOW, hrmOwnerRevision: 12,
      lines: [{
        workerPublicId: ID.worker, assignmentPublicId: ID.assignment,
        organizationPublicId: ID.organization, gradePublicId: null, jobProfilePublicId: null,
        assignmentOwnerRevision: 3, eligibleComponentCodes: ['BASE'],
      }],
    } as const;
    const sourceRef = {
      snapshotPublicId: ID.child,
      ownerRevision: 12,
      projectionSchemaId: 'CompensationPopulationContent.v1',
      asOf: NOW,
      sha256: HASH,
      purposeCode: 'HRIS_PER_COMPENSATION_POPULATION',
    } as const;
    const common = {
      guidelines, population, populationSourceRef: sourceRef,
      effectiveFrom: '2027-01-01', effectiveTo: null,
    };
    const authoringContext = parseCompensationCycleAuthoringContext({
      guidelines,
      population,
      populationSourceRef: sourceRef,
    });
    expect(Object.isFrozen(authoringContext)).toBe(true);
    expect(authoringContext.populationSourceRef).toEqual(sourceRef);
    expect(() => parseCompensationCycleAuthoringContext({
      guidelines,
      population,
      populationSourceRef: sourceRef,
      fabricatedFallback: true,
    })).toThrow();
    expect(() => parseCompensationCycleAuthoringContext({
      guidelines,
      population,
      populationSourceRef: { ...sourceRef, ownerRevision: 13 },
    })).toThrow();
    expect(parseCreateCompensationCycleBody({ ...common, cycleCode: 'FY27' }).cycleCode)
      .toBe('FY27');
    expect(parseReviseCompensationCycleBody(common).guidelines.budgetMode).toBe('HARD_CAP');
    expect(parseCompensationBudgetBody({
      organizationPublicId: ID.organization, amount: '10.25', currency: 'USD',
      ledgerEntryType: 'ALLOCATE', reversesEntryPublicId: null,
    }).amount).toBe('10.25');
    const content = {
      cyclePublicId: ID.cycle, workerPublicId: ID.worker, assignmentPublicId: ID.assignment,
      componentCode: 'BASE', currency: 'USD', amount: '10.25',
      effectiveFrom: '2027-01-01', effectiveTo: null,
      exceptionReasonCode: null, supersedesProposalPublicId: null,
    } as const;
    expect(parseUpsertCompensationProposalBody({ content }).content.amount).toBe('10.25');
    expect(parseSubmitCompensationProposalBody({ submissionDigest: HASH, effectiveDate: null }))
      .toEqual({ submissionDigest: HASH, effectiveDate: null });
    expect(parseApproveCompensationPlanBody({ decision: 'APPROVE', reasonCode: 'ANNUAL_REVIEW' }))
      .toEqual({ decision: 'APPROVE', reasonCode: 'ANNUAL_REVIEW' });
    expect(parsePublishCompensationSnapshotBody({ approvalReceiptId: ID.receipt }))
      .toEqual({ approvalReceiptId: ID.receipt });
    expect(parseCancelCompensationCycleBody({})).toEqual({});

    expect(() => parseCompensationBudgetBody({
      organizationPublicId: ID.organization, amount: '1.20', currency: 'USD',
      ledgerEntryType: 'ALLOCATE', reversesEntryPublicId: null,
    })).toThrow();
    expect(() => parseUpsertCompensationProposalBody({
      content: { ...content, amount: '1.20' },
    })).toThrow();
    expect(() => parseApproveCompensationPlanBody({
      decision: 'APPROVE', reasonCode: 'ANNUAL_REVIEW', unexpected: true,
    })).toThrow();
  });
});
