import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  ApprovalFormWorkspaceResponseError,
  branchApprovalFormWorkspaceVersion,
  getApprovalFormWorkspace,
  getApprovalFormWorkspaceDiff,
  getApprovalFormWorkspaceHistory,
  getApprovalFormWorkspacePublishReview,
  getApprovalFormWorkspaceVersion,
  publishReviewedApprovalFormWorkspace,
  reinstateApprovalFormWorkspace,
  retireApprovalFormWorkspace,
  updateApprovalFormWorkingDraft,
} from './approval-form-workspace-api';
import {
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
};
const publishInput = {
  ...revisions,
  draftFormVersionId: draftId,
  basePublishedVersionId: versionId,
  schemaSha256: hash,
  reviewContentDigest: review.reviewContentDigest,
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
  it('does not elevate an incomplete checker source', async () => {
    vi.stubGlobal('fetch', fetchFor({ ...review, makerUserId: null }));
    await expect(getApprovalFormWorkspacePublishReview(formId)).rejects.toThrow();
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
