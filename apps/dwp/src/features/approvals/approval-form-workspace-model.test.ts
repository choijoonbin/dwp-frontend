import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import {
  approvalFormWorkspacePinsMatch,
  approvalFormWorkspaceReadState,
  approvalFormWorkspaceReviewMatches,
  approvalFormWorkspaceReviewSourcesMatch,
  approvalFormWorkingDraftEditor,
  approvalFormWorkingDraftInput,
  captureApprovalFormWorkspace,
} from './approval-form-workspace-model';
import {
  workspaceFixture,
  reviewFixture,
  diffFixture,
  publishedId,
} from './approval-form-workspace.test-support';

const scope = { scopeIdentity: 'actual-scope', scopeEpoch: 0 };
const reviewerUserId = 32;
const original = () => captureApprovalFormWorkspace(workspaceFixture(), scope, reviewerUserId, 7);
describe('form workspace immutable source semantics', () => {
  it('freezes both pointers, legacy unmarked v2 and actual draft metadata', () => {
    const source = workspaceFixture();
    const pins = captureApprovalFormWorkspace(source, scope, 13, 7);
    source.workingDraft!.metadata.nameEn = 'Changed outside editor';
    expect(pins.workspace.workingDraft!.metadata.nameEn).toBe('Working request');
    expect(Object.isFrozen(pins.workspace.workingDraft!.schema)).toBe(true);
    expect(pins.workspace.published!.metadata).toEqual({});
    expect(pins.selectionEpoch).toBe(7);
    expect(
      approvalFormWorkspacePinsMatch(
        pins,
        { ...pins.workspace, observedAt: '2026-09-15T00:00:00Z' },
        scope,
        13
      )
    ).toBe(true);
  });
  it.each(['formRevision', 'workspaceRevision', 'lastEditorUserId'] as const)(
    'does not heal %s from fresh sources',
    (key) => {
      const pins = original();
      expect(
        approvalFormWorkspacePinsMatch(pins, { ...workspaceFixture(), [key]: 8 }, scope, 13)
      ).toBe(false);
    }
  );
  it('rejects actor/scope ABA and changed material with unchanged counts', () => {
    const pins = original();
    expect(approvalFormWorkspacePinsMatch(pins, workspaceFixture(), scope, 31)).toBe(false);
    expect(
      approvalFormWorkspacePinsMatch(pins, workspaceFixture(), { ...scope, scopeEpoch: 2 }, 13)
    ).toBe(false);
    const changed = workspaceFixture();
    changed.workingDraft!.materialDigest = 'e'.repeat(64);
    expect(approvalFormWorkspacePinsMatch(pins, changed, scope, 13)).toBe(false);
  });
  it.each([401, 403, 404])('masks retained data on first %s', (status) => {
    expect(
      approvalFormWorkspaceReadState({
        data: workspaceFixture(),
        failureReason: new HttpError('Denied', status),
        failureCount: 1,
        isFetching: true,
      })
    ).toBe('DENIED');
  });
  it('makes the first 503/refetch immediately stale without losing drafts', () => {
    expect(
      approvalFormWorkspaceReadState({
        data: workspaceFixture(),
        failureReason: new HttpError('Unavailable', 503),
        isFetching: true,
      })
    ).toBe('STALE');
    expect(approvalFormWorkspaceReadState({ data: workspaceFixture(), isFetching: true })).toBe(
      'STALE'
    );
    expect(approvalFormWorkspaceReadState({ data: undefined, error: new Error('Offline') })).toBe(
      'UNAVAILABLE'
    );
  });
  it('requires independent maker/editor and unexpired exact review pins', () => {
    expect(approvalFormWorkspaceReviewMatches(reviewFixture(), original(), Date.now())).toBe(true);
    expect(
      approvalFormWorkspaceReviewMatches(
        { ...reviewFixture(), makerUserId: reviewerUserId },
        original(),
        Date.now()
      )
    ).toBe(false);
    expect(
      approvalFormWorkspaceReviewMatches(
        { ...reviewFixture(), lastEditorUserId: reviewerUserId },
        original(),
        Date.now()
      )
    ).toBe(false);
    expect(
      approvalFormWorkspaceReviewMatches(
        {
          ...reviewFixture(),
          reviewRequest: { ...reviewFixture().reviewRequest, reviewerUserId: 99 },
        },
        original(),
        Date.now()
      )
    ).toBe(false);
    expect(
      approvalFormWorkspaceReviewMatches(
        { ...reviewFixture(), schemaSha256: 'e'.repeat(64) },
        original(),
        Date.now()
      )
    ).toBe(false);
    expect(
      approvalFormWorkspaceReviewMatches(
        { ...reviewFixture(), authorityValidUntil: '2020-01-01T00:00:00Z' },
        original(),
        Date.now()
      )
    ).toBe(false);
  });
  it('does not approve truncated or retargeted/rehash semantic comparison', () => {
    const pins = original();
    const history = {
      versions: [pins.workspace.workingDraft!, pins.workspace.published!],
      mayBeTruncated: false,
    };
    const matches = (diff = diffFixture(), partial = false) =>
      approvalFormWorkspaceReviewSourcesMatch(
        pins,
        reviewFixture(),
        { ...history, mayBeTruncated: partial },
        diff,
        diff,
        publishedId
      );
    expect(matches()).toBe(true);
    expect(matches(diffFixture(), true)).toBe(false);
    expect(matches({ ...diffFixture(), complete: false })).toBe(false);
    expect(matches({ ...diffFixture(), fromSchemaSha256: 'e'.repeat(64) })).toBe(false);
    expect(matches({ ...diffFixture(), toVersionId: publishedId })).toBe(false);
  });
  it('edits authoring metadata only and preserves the legacy schema version', () => {
    const pins = original();
    const draft = approvalFormWorkingDraftEditor(pins.workspace, 'EXPENSE')!;
    expect(draft.nameEn).toBe('Working request');
    const input = approvalFormWorkingDraftInput(pins, {
      ...draft,
      nameEn: 'Edited working request',
    });
    expect(input.expectedFormRevision).toBe(4);
    expect(input.draftFormVersionId).toBe(pins.workspace.workingDraft!.formVersionId);
    expect(input.schema.schemaVersion).toBe(2);
    expect(Object.isFrozen(input.schema)).toBe(true);
    expect(pins.workspace.workingDraft!.metadata.nameEn).toBe('Working request');
  });
  it('never invents old metadata from the catalog to make a legacy draft editable', () => {
    const source = workspaceFixture();
    source.workingDraft = {
      ...source.workingDraft!,
      metadata: {},
      route: {},
      materialDigest: null,
      capturedAt: null,
      capturedBy: null,
      metadataProvenance: 'UNRECORDED_HISTORICAL_METADATA',
    };
    expect(approvalFormWorkingDraftEditor(source, 'EXPENSE')).toBeNull();
  });
});
