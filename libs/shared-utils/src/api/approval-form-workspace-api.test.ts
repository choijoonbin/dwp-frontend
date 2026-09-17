import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  ApprovalFormWorkspaceResponseError,
  branchApprovalFormWorkspaceVersion,
  getApprovalFormWorkspace,
  getApprovalFormWorkspaceDiff,
  getApprovalFormWorkspaceHistory,
  getApprovalFormPublishReviewQueue,
  getApprovalFormPublishReviewRequest,
  getApprovalFormWorkspacePublishReview,
  getApprovalFormWorkspaceVersion,
  publishReviewedApprovalFormWorkspace,
  rejectApprovalFormPublishReview,
  requestApprovalFormPublishReview,
  reinstateApprovalFormWorkspace,
  searchApprovalFormPublishReviewCandidates,
  retireApprovalFormWorkspace,
  updateApprovalFormWorkingDraft,
} from './approval-form-workspace-api';
import {
  readApprovalFormPublishReviewRequest,
  readApprovalFormWorkspace,
  snapshotApprovalFormWorkspace,
} from './approval-form-workspace-contract';

import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkingDraftInput,
} from './approval-form-workspace-contract';

const formId = '11111111-1111-1111-1111-111111111111';
const versionId = '22222222-2222-2222-2222-222222222222';
const draftId = '33333333-3333-3333-3333-333333333333';
const reviewRequestId = '55555555-5555-5555-5555-555555555555';
const hash = 'a'.repeat(64);
const schema = { schemaVersion: 2, fields: [] };
const published = {
  formVersionId: versionId,
  versionNumber: 1,
  lifecycleState: 'PUBLISHED' as const,
  sourceVersionId: null,
  basePublishedVersionId: null,
  schema,
  schemaSha256: hash,
  metadata: {},
  route: {},
  materialDigest: null,
  metadataProvenance: 'UNRECORDED_HISTORICAL_METADATA' as const,
  capturedAt: null,
  capturedBy: null,
  createdAt: '2026-09-01T00:00:00Z',
  createdBy: 31,
  publishedAt: '2026-09-02T00:00:00Z',
  publishedBy: 32,
};
const workspace: ApprovalFormWorkspace = {
  formId,
  formRevision: 4,
  workspaceRevision: 2,
  catalogAvailability: 'ACTIVE',
  published,
  workingDraft: {
    ...published,
    formVersionId: draftId,
    versionNumber: 2,
    lifecycleState: 'DRAFT',
    publishedAt: null,
    publishedBy: null,
  },
  lastEditorUserId: 31,
  catalogPolicyEligible: true,
  observedAt: '2026-09-14T00:00:00Z',
};
const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' } as const;
const options = { idempotencyKey: 'original-workspace-command:1' };
const revisions = { expectedFormRevision: 4, expectedWorkspaceRevision: 2 };
const review = {
  formId,
  formRevision: 4,
  workspaceRevision: 2,
  draftFormVersionId: draftId,
  basePublishedVersionId: versionId,
  schemaSha256: hash,
  reviewContentDigest: 'b'.repeat(64),
  makerUserId: 31,
  lastEditorUserId: 31,
  independentCheckerEligible: true,
  authorityValidUntil: '2026-09-14T00:00:30Z',
  reviewRequest: {
    reviewRequestId,
    formId,
    draftFormVersionId: draftId,
    basePublishedFormVersionId: versionId,
    status: 'PENDING' as const,
    version: 0,
    makerUserId: 31,
    lastEditorUserId: 31,
    reviewerUserId: 32,
    reviewerPersonPublicId: '66666666-6666-6666-6666-666666666666',
    formRevision: 4,
    workspaceRevision: 2,
    schemaSha256: hash,
    reviewContentDigest: 'b'.repeat(64),
    requestReason: 'Please independently review this exact form.',
    requestedAt: '2026-09-14T00:00:00Z',
    decidedAt: null,
    decidedBy: null,
    decisionReason: null,
  },
};
const publishInput = {
  ...revisions,
  draftFormVersionId: draftId,
  basePublishedVersionId: versionId,
  schemaSha256: hash,
  reviewContentDigest: review.reviewContentDigest,
  reviewRequestId,
  expectedReviewRequestVersion: 0,
  reviewComment: 'Independent publisher verified the exact review evidence.',
};
const secure = {
  mode: 'SECURE',
  rolloutState: '111',
  contextKey: 'ctx:admin',
  contextScopeKey: 'scope:admin',
  expectedDecisionRevision: 'psr-current',
  objectVersion: 4,
  idempotencyKey: options.idempotencyKey,
  stepUp: {
    challenge: 'signed-challenge',
    challengeId: 'challenge-id',
    decisionRevision: 'psr-current',
    expiresAt: '2026-09-14T00:00:30Z',
  },
} as const;
const draftInput: ApprovalFormWorkingDraftInput = {
  ...revisions,
  draftFormVersionId: draftId,
  schema,
  defaultWorkflowId: '44444444-4444-4444-4444-444444444444',
  metadata: {
    categoryId: formId,
    nameKo: '비용 요청',
    nameEn: 'Expense request',
    descriptionKo: '비용 검토',
    descriptionEn: 'Expense review',
    ownerGroupRef: 'group:finance',
    formKind: 'REQUEST',
  },
};
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const fetchFor = (data: unknown) =>
  vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        response(url.includes('/csrf') ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' } : data)
      )
    );

describe('approval version-owned form workspace API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads distinct published and working UUIDs without inventing historical metadata', async () => {
    const fetch = fetchFor(workspace);
    vi.stubGlobal('fetch', fetch);
    const data = await getApprovalFormWorkspace(formId, 'opaque-original-scope');
    expect(data.published?.formVersionId).toBe(versionId);
    expect(data.workingDraft?.formVersionId).toBe(draftId);
    expect(data.published?.metadata).toEqual({});
    expect(data.published?.metadataProvenance).toBe('UNRECORDED_HISTORICAL_METADATA');
    expect(Object.isFrozen(data.workingDraft?.schema)).toBe(true);
    expect(fetch.mock.calls[0][0]).toContain('contextScopeKey=opaque-original-scope');
  });
  it('accepts the exact terminal rejection projection returned after a review decision', () => {
    const rejected = {
      ...review.reviewRequest,
      status: 'REJECTED' as const,
      version: 1,
      decidedAt: '2026-09-14T00:10:00Z',
      decidedBy: 32,
      decisionReason: 'The form requires additional compliance controls.',
    };
    expect(readApprovalFormPublishReviewRequest(rejected, formId)).toEqual(rejected);
  });
  it.each([
    { ...workspace, formId: draftId },
    { ...workspace, formRevision: 1.5 },
    { ...workspace, workspaceRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...workspace, workingDraft: published },
    { ...workspace, catalogAvailability: 'RETIRED', catalogPolicyEligible: true },
    { ...workspace, published: { ...published, metadata: { nameKo: 'Invented old name' } } },
  ])('rejects inconsistent source projections', (data) => {
    expect(() => readApprovalFormWorkspace(data as ApprovalFormWorkspace, formId)).toThrow();
  });
  it('preserves truncated history and exact immutable version lookup', async () => {
    const fetch = fetchFor({ versions: [workspace.workingDraft, published], mayBeTruncated: true });
    vi.stubGlobal('fetch', fetch);
    expect((await getApprovalFormWorkspaceHistory(formId, 2)).mayBeTruncated).toBe(true);
    fetch.mockImplementation(() => Promise.resolve(response(published)));
    expect((await getApprovalFormWorkspaceVersion(formId, versionId)).formVersionId).toBe(
      versionId
    );
    await expect(getApprovalFormWorkspaceVersion(formId, draftId)).rejects.toThrow();
  });
  it('keeps incomplete semantic diffs incomplete and rejects retargeted UUIDs', async () => {
    const data = {
      fromVersionId: versionId,
      toVersionId: draftId,
      fromSchemaSha256: hash,
      toSchemaSha256: hash,
      changes: [{ path: '/route/workflowId', before: formId, after: draftId }],
      complete: false,
      fromMetadataProvenance: 'LEGACY_CAPTURE_TIME',
      toMetadataProvenance: 'AUTHORING_SNAPSHOT',
    };
    const fetch = fetchFor(data);
    vi.stubGlobal('fetch', fetch);
    expect((await getApprovalFormWorkspaceDiff(formId, versionId, draftId)).complete).toBe(false);
    fetch.mockImplementation(() => Promise.resolve(response({ ...data, toVersionId: formId })));
    await expect(getApprovalFormWorkspaceDiff(formId, versionId, draftId)).rejects.toThrow();
  });
  it('combines the immutable review projection with its governed review request', async () => {
    const { reviewRequest, ...projection } = review;
    const fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        response(
          url.endsWith('/publish-review-request') ? { request: reviewRequest } : projection
        )
      )
    );
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalFormWorkspacePublishReview(formId)).resolves.toEqual(review);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('/publish-review'),
      expect.stringContaining('/publish-review-request'),
    ]);
  });
  it('does not elevate an incomplete checker source', async () => {
    vi.stubGlobal('fetch', fetchFor({ ...review, makerUserId: null }));
    await expect(getApprovalFormWorkspacePublishReview(formId)).rejects.toThrow();
  });
  it('reads exact publisher candidates, assigned queue and nullable current request envelopes', async () => {
    const candidate = {
      userId: 32,
      personPublicId: review.reviewRequest.reviewerPersonPublicId,
      displayName: 'Independent Publisher',
      email: 'publisher@example.test',
      jobTitle: 'Compliance Publisher',
    };
    const candidates = {
      candidates: [candidate],
      mayBeTruncated: false,
      decisionRevision: `psr-${'c'.repeat(64)}`,
      authorityValidUntil: '2099-09-14T00:00:30Z',
    };
    const fetch = fetchFor(candidates);
    vi.stubGlobal('fetch', fetch);
    expect(
      await searchApprovalFormPublishReviewCandidates('publisher', 20, 'opaque-original-scope')
    ).toEqual(candidates);
    expect(fetch.mock.calls[0][0]).toContain('query=publisher&size=20');

    const queue = {
      items: [
        {
          request: review.reviewRequest,
          formKey: 'ACCESS_EXCEPTION_FORM',
          formNameKo: '접근 예외 신청',
          formNameEn: 'Access exception request',
        },
      ],
      mayBeTruncated: false,
      generatedAt: '2026-09-14T00:00:30Z',
    };
    fetch.mockImplementation(() => Promise.resolve(response(queue)));
    expect(await getApprovalFormPublishReviewQueue(50, 'opaque-original-scope')).toEqual(queue);
    fetch.mockImplementation(() => Promise.resolve(response({ request: review.reviewRequest })));
    expect(await getApprovalFormPublishReviewRequest(formId, 'opaque-original-scope')).toEqual(
      review.reviewRequest
    );
    fetch.mockImplementation(() => Promise.resolve(response({ request: null })));
    expect(await getApprovalFormPublishReviewRequest(formId, 'opaque-original-scope')).toBeNull();
  });
  it('sends assignment and rejection with exact CAS and rejects borrowed secure bindings', async () => {
    const requestInput = {
      ...revisions,
      draftFormVersionId: draftId,
      basePublishedVersionId: versionId,
      schemaSha256: hash,
      reviewerUserId: 32,
      reviewerPersonPublicId: review.reviewRequest.reviewerPersonPublicId,
      expectedReviewRequestId: null,
      expectedReviewRequestVersion: null,
      reason: 'Please independently review this exact form.',
    };
    const rejectInput = {
      ...revisions,
      expectedWorkspaceRevision: 2,
      expectedReviewRequestVersion: 0,
      reason: 'The form requires additional compliance controls.',
    };
    const fetch = fetchFor(review.reviewRequest);
    vi.stubGlobal('fetch', fetch);
    await requestApprovalFormPublishReview(formId, requestInput, secure, options);
    await rejectApprovalFormPublishReview(formId, reviewRequestId, rejectInput, secure, options);
    const commands = fetch.mock.calls.filter(([, init]) => init.method === 'POST');
    expect(commands).toHaveLength(2);
    expect(commands[0][0]).toContain('/publish-review-request');
    expect(JSON.parse(commands[0][1].body)).toEqual(requestInput);
    expect(commands[1][0]).toContain(`/publish-review-requests/${reviewRequestId}/reject`);
    expect(JSON.parse(commands[1][1].body)).toEqual(rejectInput);

    const before = fetch.mock.calls.length;
    await expect(
      requestApprovalFormPublishReview(
        formId,
        requestInput,
        { ...secure, idempotencyKey: 'borrowed-key' },
        options
      )
    ).rejects.toThrow();
    await expect(
      rejectApprovalFormPublishReview(
        formId,
        reviewRequestId,
        rejectInput,
        { ...secure, objectVersion: 5 },
        options
      )
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(before);
  });
  it('rejects malformed publisher source and command values before transport', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(searchApprovalFormPublishReviewCandidates(' x', 20)).rejects.toThrow();
    await expect(getApprovalFormPublishReviewQueue(101)).rejects.toThrow();
    await expect(
      requestApprovalFormPublishReview(
        formId,
        {
          ...revisions,
          draftFormVersionId: draftId,
          basePublishedVersionId: versionId,
          schemaSha256: hash,
          reviewerUserId: 32,
          reviewerPersonPublicId: review.reviewRequest.reviewerPersonPublicId,
          expectedReviewRequestId: reviewRequestId,
          expectedReviewRequestVersion: null,
          reason: 'Please independently review this exact form.',
        },
        secure,
        options
      )
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the exact body CAS and original key for branch, update and catalog availability', async () => {
    const fetch = fetchFor(workspace);
    vi.stubGlobal('fetch', fetch);
    await branchApprovalFormWorkspaceVersion(formId, versionId, revisions, execution, options);
    await updateApprovalFormWorkingDraft(formId, draftInput, execution, options);
    await retireApprovalFormWorkspace(formId, revisions, execution, options);
    await reinstateApprovalFormWorkspace(formId, revisions, execution, options);
    const commands = fetch.mock.calls.filter(([, init]) => ['POST', 'PUT'].includes(init.method));
    expect(commands).toHaveLength(4);
    for (const [, init] of commands) {
      expect(init.headers['Idempotency-Key']).toBe(options.idempotencyKey);
      expect(JSON.parse(init.body)).toMatchObject(revisions);
    }
    expect(commands[1][1].method).toBe('PUT');
    expect(JSON.parse(commands[1][1].body).draftFormVersionId).toBe(draftId);
  });
  it('requires the new reviewed publish body and exact HIGH header CAS, not a legacy form challenge', async () => {
    const fetch = fetchFor(workspace);
    vi.stubGlobal('fetch', fetch);
    await publishReviewedApprovalFormWorkspace(formId, publishInput, secure, options);
    const [, init] = fetch.mock.calls.find(([, settings]) => settings.method === 'POST')!;
    expect(JSON.parse(init.body)).toEqual(publishInput);
    expect(init.headers['X-DWP-Expected-Object-Version']).toBe('4');
    expect(init.headers['X-DWP-Step-Up-Challenge']).toBe('signed-challenge');
  });
  it.each(['legacy', 'key', 'CAS', 'workspace'] as const)(
    'rejects invalid %s publish before any transport',
    async (invalid) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const input =
        invalid === 'workspace'
          ? { ...publishInput, expectedWorkspaceRevision: null }
          : publishInput;
      const authority =
        invalid === 'legacy'
          ? execution
          : invalid === 'key'
            ? { ...secure, idempotencyKey: 'borrowed-key' }
            : invalid === 'CAS'
              ? { ...secure, objectVersion: 5 }
              : secure;
      await expect(
        publishReviewedApprovalFormWorkspace(
          formId,
          input as typeof publishInput,
          authority,
          options
        )
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it('clones draft values before asynchronous CSRF and rechecks the source before command transport', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation((url: string) =>
      url.includes('/csrf')
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(response(workspace))
    );
    vi.stubGlobal('fetch', fetch);
    const input = structuredClone(draftInput);
    let ready = true;
    const originalError = new Error('Original source revoked');
    const beforeDispatch = vi.fn(() => {
      if (!ready) throw originalError;
    });
    const result = updateApprovalFormWorkingDraft(formId, input, execution, {
      ...options,
      beforeDispatch,
    });
    input.metadata.nameEn = 'Changed after dispatch preparation';
    ready = false;
    finish(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
    await expect(result).rejects.toBe(originalError);
    expect(beforeDispatch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PUT')).toHaveLength(0);
  });
  it('does not classify an unverifiable successful mutation as definitely uncommitted', async () => {
    const fetch = fetchFor({ ...workspace, formId: draftId });
    vi.stubGlobal('fetch', fetch);
    await expect(
      retireApprovalFormWorkspace(formId, revisions, execution, options)
    ).rejects.toBeInstanceOf(ApprovalFormWorkspaceResponseError);
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
  });
  it('rejects nonfinite and non-JSON source values rather than silently rewriting them', () => {
    for (const value of [
      { value: NaN },
      { value: Infinity },
      { value: undefined },
      { value: new Date() },
    ])
      expect(() => snapshotApprovalFormWorkspace(value)).toThrow();
    expect(() => snapshotApprovalFormWorkspace({ value: '9'.repeat(524_289) })).toThrow();
  });
});
