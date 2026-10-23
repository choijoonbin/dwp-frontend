import { describe, expect, it, vi } from 'vitest';

import {
  createPer008Client,
  createPer008EnvelopeAdapter,
  per008TeamQueryString,
} from './per008-client';
import {
  parsePer008CreateCommand,
  parsePer008Release,
  parsePer008ResponseCommand,
  parsePer008TeamProjection,
  parsePer008TeamQuery,
} from './per008-contract';
import { PER008_CREATE_ACTION_KEY, PER008_ROUTES } from './per008-model';
import type { Per008TeamProjection, Per008TeamQuery } from './per008-model';

const ID = {
  item: '11111111-1111-4111-8111-111111111111',
  cycle: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  assignment: '44444444-4444-4444-8444-444444444444',
  template: '55555555-5555-4555-8555-555555555555',
  request: '66666666-6666-4666-8666-666666666666',
  receipt: '77777777-7777-4777-8777-777777777777',
  question: '88888888-8888-4888-8888-888888888888',
  option: '99999999-9999-4999-8999-999999999999',
  correlation: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
} as const;
const NOW = '2026-10-23T01:00:00Z';
const LATER = '2026-10-30T01:00:00Z';
const HASH = 'a'.repeat(64);

const query: Per008TeamQuery = {
  limit: 25,
  filter: {
    performanceAssignment: { codes: ['FY27_REVIEW'], publicIds: [ID.assignment] },
    dueStatus: { codes: ['DUE_SOON'], minimumRevision: 2 },
    limitedProfile: { codes: ['ACTIVE'], minimumRevision: 3 },
    effectiveOn: '2026-10-23',
  },
  sort: ['itemPublicId:ASC', 'dueStatus:DESC'],
  locale: 'ko-KR', timeZone: 'Asia/Seoul', correlationId: ID.correlation,
};

function projection(overrides: Record<string, unknown> = {}): Per008TeamProjection {
  return {
    projectionVersion: '2', asOf: NOW, variantKey: 'PERFORMANCE',
    queryState: {
      state: 'COMPLETE', scopeDecisionRevision: 'scope-7', freshness: 'CURRENT', nextCursor: null,
      fieldDecisionSummary: { viewCount: 4, maskedCount: 0, omittedCount: 0 }, partialFailures: [],
      correlationId: ID.correlation,
      cachePolicy: { authorizationDecisionRevision: 'auth-9',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1', maxAgeSeconds: 0 },
    },
    items: [{
      itemPublicId: ID.item, title: 'FY27 performance review', statusCode: 'OPEN',
      fieldGroups: {
        PERFORMANCE_ASSIGNMENT: { decision: 'VIEW', value: {
          publicId: ID.assignment, code: 'FY27_REVIEW', label: 'FY27 Review', revision: 4,
        } },
        DUE_STATUS: { decision: 'VIEW', value: { code: 'DUE_SOON', revision: 2 } },
        LIMITED_PROFILE: { decision: 'VIEW', value: { code: 'ACTIVE', revision: 3 } },
        PERFORMANCE_FEEDBACK_ACTION_TARGET: { decision: 'VIEW', value: {
          cycleVersionId: ID.cycle, subjectWorkerPublicId: ID.worker,
          subjectAssignmentPublicId: ID.assignment, scopeDecisionRevision: 'scope-7',
          authorizationDecisionRevision: 'auth-9',
        } },
      },
      deepLink: { route: '/hr/team/performance', resourcePublicId: ID.item },
      availableActions: [
        { actionKey: 'hris.action.per.create-goal', method: 'POST',
          hrefTemplate: '/api/people/v1/hris/performance/goals',
          idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
          stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' },
        { actionKey: PER008_CREATE_ACTION_KEY, method: 'POST', hrefTemplate: PER008_ROUTES.createRequest,
          idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
          stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED' },
      ],
    }],
    ...overrides,
  } as Per008TeamProjection;
}

const options = {
  schemaKey: 'Per008FeedbackRequestOptionsV1', cycleVersionId: ID.cycle,
  subjectWorkerPublicId: ID.worker, subjectAssignmentPublicId: ID.assignment,
  templates: [{ templateVersionId: ID.template, label: 'Peer feedback',
    schemaKey: 'dwp.hris.performance.review-form.v1', schemaVersion: 1, templateContentHash: HASH }],
  anonymityModes: ['MASKED'], thresholdLimits: { minimum: 2, maximum: 10 },
  windowLimits: { earliestOpensAt: NOW, latestClosesAt: LATER, maximumDurationDays: 7 },
  correlationId: ID.correlation,
};
const createCommand = {
  cycleVersionId: ID.cycle, subjectWorkerPublicId: ID.worker,
  subjectAssignmentPublicId: ID.assignment, templateVersionId: ID.template,
  anonymityMode: 'MASKED', minimumReleaseCount: 3, opensAt: NOW, closesAt: LATER,
} as const;
const assignedList = {
  schemaVersion: '1', asOf: NOW, queryState: 'COMPLETE', nextCursor: null, problemCorrelationId: null,
  items: [{ feedbackAssignmentId: ID.assignment, feedbackRequestId: ID.request,
    requestTitle: 'Peer feedback', requestState: 'OPEN', assignmentState: 'ASSIGNED',
    opensAt: NOW, closesAt: LATER }],
};
const detail = {
  schemaKey: 'Per008AssignedFeedbackDetailV1', feedbackAssignmentId: ID.assignment,
  feedbackRequestId: ID.request, requestTitle: 'Peer feedback', requestState: 'OPEN',
  assignmentState: 'ASSIGNED', expectedRequestVersion: 2, templateVersionId: ID.template,
  templateContentHash: HASH, opensAt: NOW, closesAt: LATER,
  questions: [{ questionPublicId: ID.question, prompt: 'What helped?', answerType: 'TEXT',
    required: true, choiceOptions: [] }], correlationId: ID.correlation,
};
const responseCommand = { expectedRequestVersion: 2, templateContentHash: HASH,
  response: { schemaKey: 'PerformanceFeedbackResponse.v1', answers: [{ questionPublicId: ID.question,
    answerType: 'TEXT', textValue: 'Clear priorities', numberValue: null, choiceOptionPublicIds: [] }] } } as const;
const release = {
  schemaKey: 'Per008FeedbackReleaseV1', aggregateSchemaKey: 'PerformanceFeedbackAggregate.v1',
  feedbackRequestId: ID.request, requestState: 'RELEASED', anonymityMode: 'ANONYMOUS_AGGREGATE',
  policyRevision: 'policy-3', aggregatedAt: NOW, releasedAt: LATER, title: 'Released feedback',
  correlationId: ID.correlation,
};

describe('PER-008 closed contract and seven typed clients', () => {
  it('preserves exact IAQ-038 V2 query nesting, all sort choices and the prior action union', () => {
    expect(parsePer008TeamQuery(query)).toEqual(query);
    const encoded = per008TeamQueryString(query);
    expect(encoded).toContain('filter%5BperformanceAssignment%5D%5BpublicIds%5D');
    expect(encoded).toContain('filter%5BdueStatus%5D%5BminimumRevision%5D=2');
    expect(encoded.match(/sort=/g)).toHaveLength(2);
    const parsed = parsePer008TeamProjection(projection());
    expect(parsed.projectionVersion).toBe('2');
    expect(parsed.items[0]?.availableActions.map((action) => action.actionKey))
      .toEqual(['hris.action.per.create-goal', PER008_CREATE_ACTION_KEY]);
  });

  it('fails closed when feedback action target authority is absent, masked, stale or ambiguous', () => {
    const missing = structuredClone(projection()) as unknown as Record<string, unknown>;
    delete ((missing.items as Record<string, unknown>[])[0]!.fieldGroups as Record<string, unknown>)
      .PERFORMANCE_FEEDBACK_ACTION_TARGET;
    ((missing.queryState as Record<string, unknown>).fieldDecisionSummary as Record<string, unknown>).viewCount = 3;
    ((missing.queryState as Record<string, unknown>).fieldDecisionSummary as Record<string, unknown>).omittedCount = 1;
    expect(() => parsePer008TeamProjection(missing)).toThrow('PER008_CONTRACT_INVALID');

    const stale = structuredClone(projection()) as unknown as Record<string, unknown>;
    (stale.queryState as Record<string, unknown>).freshness = 'STALE';
    expect(() => parsePer008TeamProjection(stale)).toThrow('PER008_CONTRACT_INVALID');

    const ambiguous = structuredClone(projection()) as unknown as Record<string, unknown>;
    (ambiguous.items as unknown[]).push(structuredClone((ambiguous.items as unknown[])[0]));
    ((ambiguous.queryState as Record<string, unknown>).fieldDecisionSummary as Record<string, unknown>).viewCount = 8;
    expect(() => parsePer008TeamProjection(ambiguous)).toThrow('PER008_CONTRACT_INVALID');
  });

  it('keeps create/submit bodies closed and structurally excludes release privacy metadata', () => {
    expect(Object.keys(parsePer008CreateCommand(createCommand))).toHaveLength(8);
    expect(Object.keys(parsePer008ResponseCommand(responseCommand))).toEqual([
      'expectedRequestVersion', 'templateContentHash', 'response',
    ]);
    expect(() => parsePer008CreateCommand({ ...createCommand, digest: HASH })).toThrow();
    for (const forbidden of ['contributorIdentity', 'responseItems', 'narrative', 'answer', 'score',
      'rawCount', 'digest', 'encryptionMetadata']) {
      expect(() => parsePer008Release({ ...release, [forbidden]: 'protected' })).toThrow();
    }
    expect(JSON.stringify(parsePer008Release(release))).not.toMatch(/Strong collaboration|protected/);
  });

  it('unwraps ApiResponse once and calls the exact seven owner endpoints', async () => {
    const receipt = { receiptId: ID.receipt, requestId: ID.request, state: 'DRAFT', version: 1,
      occurredAt: NOW, replayed: false };
    const submission = { receiptId: ID.receipt, requestId: ID.request, assignmentId: ID.assignment,
      assignmentState: 'SUBMITTED', version: 3, submittedAt: NOW, replayed: false };
    const replies = [projection(), options, receipt, assignedList, detail, submission, release];
    const envelope = vi.fn(async (_path: string) => ({ status: 200,
      data: { status: 'SUCCESS', data: replies.shift() } }));
    const client = createPer008Client(createPer008EnvelopeAdapter(envelope));
    await client.loadTeamPerformance(query);
    await client.loadRequestOptions(createCommand);
    await client.createFeedbackRequest(createCommand, { idempotencyKey: 'per008-command-key-0001',
      expectedDecisionRevision: 'auth-9' });
    await client.loadMyAssignments();
    await client.loadAssignment(ID.assignment);
    await client.submitResponse(ID.assignment, responseCommand, {
      idempotencyKey: 'per008-command-key-0002', expectedDecisionRevision: 'auth-9',
    });
    await client.loadRelease(ID.request);
    expect(envelope.mock.calls.map(([path]) => String(path).split('?')[0])).toEqual([
      PER008_ROUTES.teamPerformance, PER008_ROUTES.requestOptions, PER008_ROUTES.createRequest,
      PER008_ROUTES.mine, PER008_ROUTES.assignment(ID.assignment),
      PER008_ROUTES.submitResponse(ID.assignment), PER008_ROUTES.release(ID.request),
    ]);
  });

  it('distinguishes threshold suppression and retains same-key replay after unknown POST outcome', async () => {
    const thresholdClient = createPer008Client(vi.fn().mockResolvedValue({ status: 422,
      data: { code: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET', correlationId: ID.correlation, retryable: false } }));
    await expect(thresholdClient.loadRelease(ID.request)).rejects.toMatchObject({
      code: 'SUPPRESSED', problem: { code: 'FEEDBACK_RELEASE_THRESHOLD_NOT_MET',
        correlationId: ID.correlation, retryable: false },
    });
    const unknownClient = createPer008Client(vi.fn().mockRejectedValue(new TypeError('timeout')));
    await expect(unknownClient.createFeedbackRequest(createCommand, {
      idempotencyKey: 'per008-command-key-0003', expectedDecisionRevision: 'auth-9',
    })).rejects.toMatchObject({
      idempotencyKey: 'per008-command-key-0003',
    });
  });

  it('preserves same-key replay when a 2xx create receipt cannot be verified', async () => {
    const key = 'per008-command-key-0004';
    const client = createPer008Client(vi.fn().mockResolvedValue({
      status: 201,
      data: { receiptId: ID.receipt, requestId: ID.request, state: 'DRAFT' },
    }));

    await expect(client.createFeedbackRequest(createCommand, {
      idempotencyKey: key, expectedDecisionRevision: 'auth-9',
    })).rejects.toMatchObject({
      name: 'Per008CommandOutcomeUnknownError', idempotencyKey: key,
    });
  });

  it('preserves same-key replay when a 2xx submission receipt cannot be verified', async () => {
    const key = 'per008-command-key-0005';
    const client = createPer008Client(vi.fn().mockResolvedValue({
      status: 200,
      data: { receiptId: ID.receipt, requestId: ID.request, assignmentId: ID.worker,
        assignmentState: 'SUBMITTED', version: 3, submittedAt: NOW, replayed: false },
    }));

    await expect(client.submitResponse(ID.assignment, responseCommand, {
      idempotencyKey: key, expectedDecisionRevision: 'auth-9',
    })).rejects.toMatchObject({
      name: 'Per008CommandOutcomeUnknownError', idempotencyKey: key,
    });
  });
});
