import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';

import {
  selectPerformanceCommandReceipt,
  selectPerformanceCycleCollection,
  selectPerformanceCycleCommandResult,
  selectPerformanceCycleDetail,
  selectPerformancePopulationPreview,
  selectPerformancePreviewCommandResult,
} from './performance-cycle-contract';
import {
  buildPublishPerformanceCycleRequest,
  performancePreviewState,
  performanceReceiptDisposition,
} from './performance-cycle-command';

const IDS = Object.freeze({
  cycle: '11111111-1111-4111-8111-111111111111',
  version: '22222222-2222-4222-8222-222222222222',
  retention: '33333333-3333-4333-8333-333333333333',
  policy: '44444444-4444-4444-8444-444444444444',
  populationRule: '55555555-5555-4555-8555-555555555555',
  stage: '66666666-6666-4666-8666-666666666666',
  participantOne: '77777777-7777-4777-8777-777777777777',
  assignmentOne: '88888888-8888-4888-8888-888888888888',
  organizationOne: '99999999-9999-4999-8999-999999999999',
  reviewer: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  job: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  grade: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  preview: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  snapshot: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  receipt: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  participantTwo: '12345678-1234-4234-8234-123456789abc',
  assignmentTwo: '23456789-2345-4345-8345-23456789abcd',
  organizationTwo: '3456789a-3456-4456-8456-3456789abcde',
  command: '456789ab-4567-4567-8567-456789abcdef',
  approval: '56789abc-5678-4678-8678-56789abcdef0',
});

const HASH = 'a'.repeat(64);

function detailSource(overrides: Record<string, unknown> = {}) {
  const effectiveTo = Object.hasOwn(overrides, 'effectiveTo')
    ? overrides.effectiveTo
    : '2026-12-31T23:59:59Z';
  return {
    cycleId: IDS.cycle,
    cycleKey: 'FY27',
    displayName: 'FY27 performance cycle',
    lifecycleState: 'VALIDATED',
    activeVersionNo: 2,
    aggregateVersion: 7,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo,
    allowedActions: ['VIEW', 'CREATE_DRAFT', 'UPDATE_DRAFT', 'PREVIEW_PARTICIPANTS', 'PUBLISH'],
    retentionPolicyId: IDS.retention,
    createdAt: '2025-11-01T00:00:00Z',
    createdBy: 41,
    updatedAt: '2026-05-30T00:00:00Z',
    updatedBy: 42,
    version: {
      cycleVersionId: IDS.version,
      versionNo: 2,
      versionState: 'VALIDATED',
      aggregateVersion: 3,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo,
      timezoneId: 'Asia/Seoul',
      policyVersionId: IDS.policy,
      populationRuleVersionId: IDS.populationRule,
      contentHash: HASH,
      authoredBy: 41,
      publishedAt: null,
      publishedBy: null,
      stages: [
        {
          stageId: IDS.stage,
          stageKey: 'SELF_REVIEW',
          stageType: 'SELF_REVIEW',
          sequenceNo: 1,
          opensAt: '2026-01-01T00:00:00Z',
          closesAt: '2026-03-01T00:00:00Z',
          required: true,
          stageConfig: { instructions: ['reflect', { required: true }] },
          ignoredStageSecret: 'must not survive',
        },
      ],
      ignoredVersionSecret: 'must not survive',
    },
    ignoredCycleSecret: 'must not survive',
    ...overrides,
  };
}

function previewSource(overrides: Record<string, unknown> = {}) {
  return {
    populationPreviewId: IDS.preview,
    cycleVersionId: IDS.version,
    workforceSnapshotId: IDS.snapshot,
    workforceSnapshotRevision: 31,
    populationRuleVersionId: IDS.populationRule,
    state: 'READY',
    participantCount: 1,
    reviewerAssignmentCount: 1,
    contentHash: HASH,
    aggregateVersion: 7,
    sourceCycleAggregateVersion: 7,
    createdAt: '2026-06-01T00:00:00Z',
    expiresAt: '2026-06-01T01:00:00Z',
    members: [
      {
        participantRef: IDS.participantOne,
        primaryAssignmentRef: IDS.assignmentOne,
        workforceStatus: 'ACTIVE',
        organizationRef: IDS.organizationOne,
        reviewerAssignmentRef: IDS.reviewer,
        jobProfileRef: IDS.job,
        gradeRef: IDS.grade,
        eligibilityCode: 'INCLUDED',
        displayName: 'Injected person name',
        email: 'injected@example.test',
      },
      {
        participantRef: IDS.participantTwo,
        primaryAssignmentRef: IDS.assignmentTwo,
        workforceStatus: 'INACTIVE',
        organizationRef: IDS.organizationTwo,
        reviewerAssignmentRef: IDS.reviewer,
        jobProfileRef: null,
        gradeRef: null,
        eligibilityCode: 'EXCLUDED',
        name: 'Another injected name',
      },
    ],
    candidateNames: ['must not survive'],
    ...overrides,
  };
}

function receiptSource(
  state: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN' | 'QUARANTINED',
  overrides: Record<string, unknown> = {}
) {
  const terminal = state === 'SUCCEEDED' || state === 'FAILED' || state === 'QUARANTINED';
  const failed = state === 'FAILED' || state === 'QUARANTINED';
  return {
    receiptId: IDS.receipt,
    commandType: 'PUBLISH',
    originatingAction: 'performance.cycle.publish',
    aggregateId: IDS.cycle,
    expectedAggregateVersion: 6,
    appliedAggregateVersion: state === 'SUCCEEDED' ? 7 : null,
    state,
    resultRef: state === 'SUCCEEDED' ? IDS.cycle : null,
    errorCode: failed ? 'PUBLISH_REJECTED' : null,
    acceptedAt: '2026-06-01T00:00:00Z',
    completedAt: terminal ? '2026-06-01T00:00:01Z' : null,
    internalActorId: 991,
    ...overrides,
  };
}

describe('performance cycle response contract', () => {
  it('strictly projects and recursively freezes cycle data while accepting an open-ended period', () => {
    const selected = selectPerformanceCycleDetail(detailSource({ effectiveTo: null }));

    expect(selected.effectiveTo).toBeNull();
    expect(selected.version.effectiveTo).toBeNull();
    expect(selected).not.toHaveProperty('ignoredCycleSecret');
    expect(selected.version).not.toHaveProperty('ignoredVersionSecret');
    expect(selected.version.stages[0]).not.toHaveProperty('ignoredStageSecret');
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.isFrozen(selected.allowedActions)).toBe(true);
    expect(Object.isFrozen(selected.version)).toBe(true);
    expect(Object.isFrozen(selected.version.stages)).toBe(true);
    expect(Object.isFrozen(selected.version.stages[0])).toBe(true);
    expect(Object.isFrozen(selected.version.stages[0].stageConfig)).toBe(true);
    expect(Object.isFrozen(selected.version.stages[0].stageConfig.instructions)).toBe(true);
  });

  it('accepts only canonical lowercase SHA-256 digests and closed lifecycle/action enums', () => {
    const valid = detailSource();
    expect(() => selectPerformanceCycleDetail(valid)).not.toThrow();
    expect(() =>
      selectPerformanceCycleDetail({
        ...valid,
        version: { ...valid.version, contentHash: 'A'.repeat(64) },
      })
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() => selectPerformanceCycleDetail({ ...valid, lifecycleState: 'ARCHIVED' })).toThrow(
      'Performance cycle source payload is invalid.'
    );

    const summary = {
      cycleId: IDS.cycle,
      cycleKey: 'FY27',
      displayName: 'FY27 performance cycle',
      lifecycleState: 'DRAFT',
      activeVersionNo: 1,
      aggregateVersion: 1,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: null,
      allowedActions: ['VIEW', 'CREATE_DRAFT'],
    };
    expect(() =>
      selectPerformanceCycleCollection({ cycles: [summary], allowedActions: ['VIEW'] })
    ).not.toThrow();
    expect(() =>
      selectPerformanceCycleCollection({
        cycles: [summary],
        allowedActions: ['VIEW', 'VIEW'],
      })
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformanceCycleCollection({ cycles: [summary], allowedActions: ['DELETE'] })
    ).toThrow('Performance cycle source payload is invalid.');
  });

  it('retains only the eight approved opaque participant fields and freezes the preview', () => {
    const selected = selectPerformancePopulationPreview(previewSource());
    const member = selected.members[0];

    expect(Object.keys(member)).toEqual([
      'participantRef',
      'primaryAssignmentRef',
      'workforceStatus',
      'organizationRef',
      'reviewerAssignmentRef',
      'jobProfileRef',
      'gradeRef',
      'eligibilityCode',
    ]);
    expect(JSON.stringify(selected)).not.toContain('Injected person name');
    expect(JSON.stringify(selected)).not.toContain('injected@example.test');
    expect(JSON.stringify(selected)).not.toContain('candidateNames');
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.isFrozen(selected.members)).toBe(true);
    expect(Object.isFrozen(member)).toBe(true);
  });

  it('rejects mismatched participant and distinct eligible reviewer counts', () => {
    expect(() =>
      selectPerformancePopulationPreview(previewSource({ participantCount: 2 }))
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformancePopulationPreview(previewSource({ reviewerAssignmentCount: 2 }))
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformancePopulationPreview(
        previewSource({ members: [previewSource().members[0], previewSource().members[0]] })
      )
    ).toThrow('Performance cycle source payload is invalid.');
  });

  it('uses participant and primary assignment together as preview member identity', () => {
    const source = previewSource();
    const selected = selectPerformancePopulationPreview({
      ...source,
      members: [source.members[0], { ...source.members[1], participantRef: IDS.participantOne }],
    });

    expect(selected.members).toHaveLength(2);
    expect(selected.members[0]?.participantRef).toBe(selected.members[1]?.participantRef);
    expect(selected.members[0]?.primaryAssignmentRef).not.toBe(
      selected.members[1]?.primaryAssignmentRef
    );
  });

  it('validates every receipt state and maps only terminal success to refresh-required', () => {
    const expected = {
      ACCEPTED: 'PENDING',
      RUNNING: 'PENDING',
      SUCCEEDED: 'REFRESH_REQUIRED',
      FAILED: 'FAILED',
      RESULT_UNKNOWN: 'RESULT_UNKNOWN',
      QUARANTINED: 'FAILED',
    } as const;

    for (const [state, disposition] of Object.entries(expected)) {
      const receipt = selectPerformanceCommandReceipt(
        receiptSource(state as keyof typeof expected)
      );
      expect(receipt.state).toBe(state);
      expect(performanceReceiptDisposition(receipt)).toBe(disposition);
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(receipt).not.toHaveProperty('internalActorId');
    }

    expect(() =>
      selectPerformanceCommandReceipt(receiptSource('SUCCEEDED', { completedAt: null }))
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformanceCommandReceipt(receiptSource('FAILED', { errorCode: null }))
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformanceCommandReceipt(receiptSource('RUNNING', { state: 'PARTIAL' }))
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformanceCommandReceipt(receiptSource('RUNNING', { commandType: 'DELETE' }))
    ).toThrow('Performance cycle source payload is invalid.');
  });

  it('accepts null projections only while command results are not successful', () => {
    const unknownCycle = selectPerformanceCycleCommandResult({
      cycle: null,
      receipt: receiptSource('RESULT_UNKNOWN'),
    });
    const unknownPreview = selectPerformancePreviewCommandResult({
      preview: null,
      receipt: receiptSource('RESULT_UNKNOWN', {
        commandType: 'PREVIEW_PARTICIPANTS',
        originatingAction: 'performance.cycle.preview',
      }),
    });

    expect(unknownCycle.cycle).toBeNull();
    expect(unknownPreview.preview).toBeNull();
    expect(() =>
      selectPerformanceCycleCommandResult({
        cycle: null,
        receipt: receiptSource('SUCCEEDED'),
      })
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformancePreviewCommandResult({
        preview: null,
        receipt: receiptSource('SUCCEEDED', {
          commandType: 'PREVIEW_PARTICIPANTS',
          originatingAction: 'performance.cycle.preview',
          resultRef: IDS.preview,
        }),
      })
    ).toThrow('Performance cycle source payload is invalid.');
  });

  it('accepts successful command replays whose current projections have advanced', () => {
    const cycleResult = selectPerformanceCycleCommandResult({
      cycle: detailSource({ aggregateVersion: 9 }),
      receipt: receiptSource('SUCCEEDED'),
    });
    const previewResult = selectPerformancePreviewCommandResult({
      preview: previewSource({ aggregateVersion: 3 }),
      receipt: receiptSource('SUCCEEDED', {
        commandType: 'PREVIEW_PARTICIPANTS',
        originatingAction: 'performance.cycle.preview',
        resultRef: IDS.preview,
        appliedAggregateVersion: 1,
      }),
    });

    expect(cycleResult.cycle?.aggregateVersion).toBe(9);
    expect(cycleResult.receipt.appliedAggregateVersion).toBe(7);
    expect(previewResult.preview?.aggregateVersion).toBe(3);
    expect(previewResult.receipt.appliedAggregateVersion).toBe(1);
  });

  it('rejects command projections that do not match their receipt identity', () => {
    expect(() =>
      selectPerformanceCycleCommandResult({
        cycle: detailSource(),
        receipt: receiptSource('SUCCEEDED', { resultRef: IDS.preview }),
      })
    ).toThrow('Performance cycle source payload is invalid.');
    expect(() =>
      selectPerformancePreviewCommandResult({
        preview: previewSource(),
        receipt: receiptSource('RESULT_UNKNOWN', {
          commandType: 'PREVIEW_PARTICIPANTS',
          originatingAction: 'performance.cycle.preview',
          resultRef: IDS.cycle,
          appliedAggregateVersion: 1,
        }),
      })
    ).toThrow('Performance cycle source payload is invalid.');
  });

  it('builds publish only from a matching unexpired preview and reviewed approval', () => {
    const detail = selectPerformanceCycleDetail(detailSource());
    const preview = selectPerformancePopulationPreview(previewSource());
    const now = Temporal.Instant.from('2026-06-01T00:30:00Z');

    expect(performancePreviewState(detail, preview, now)).toBe('READY');
    expect(
      buildPublishPerformanceCycleRequest(
        detail,
        preview,
        IDS.command,
        IDS.approval,
        '  Approved after reviewing participant impact.  ',
        now
      )
    ).toEqual({
      commandId: IDS.command,
      expectedRevision: 7,
      populationPreviewId: IDS.preview,
      expectedWorkforceOwnerRevision: 31,
      publicationApprovalRef: IDS.approval,
      reason: 'Approved after reviewing participant impact.',
    });

    expect(
      buildPublishPerformanceCycleRequest(
        detail,
        preview,
        IDS.command,
        'not-an-approval-reference',
        'Approved after reviewing participant impact.',
        now
      )
    ).toBeNull();
    expect(
      buildPublishPerformanceCycleRequest(
        detail,
        preview,
        IDS.command,
        IDS.approval,
        'too short',
        now
      )
    ).toBeNull();

    const atExpiry = Temporal.Instant.from('2026-06-01T01:00:00Z');
    expect(performancePreviewState(detail, preview, atExpiry)).toBe('STALE');
    expect(
      buildPublishPerformanceCycleRequest(
        detail,
        preview,
        IDS.command,
        IDS.approval,
        'Approved after reviewing participant impact.',
        atExpiry
      )
    ).toBeNull();
  });
});
