import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkspaceReview,
  ApprovalFormWorkspaceDiff,
} from '@dwp-frontend/shared-utils';

export const formId = '11111111-1111-4111-8111-111111111111';
export const publishedId = '22222222-2222-4222-8222-222222222222';
export const draftId = '33333333-3333-4333-8333-333333333333';
export function workspaceFixture(): ApprovalFormWorkspace {
  const published = {
    formVersionId: publishedId,
    versionNumber: 1,
    lifecycleState: 'PUBLISHED' as const,
    sourceVersionId: null,
    basePublishedVersionId: null,
    schema: {
      schemaVersion: 2,
      fields: [{ key: 'summary', type: 'TEXTAREA' as const, required: true }],
    },
    schemaSha256: 'a'.repeat(64),
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
  return {
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
      sourceVersionId: publishedId,
      basePublishedVersionId: publishedId,
      schemaSha256: 'b'.repeat(64),
      metadata: {
        categoryId: formId,
        nameKo: 'Working request',
        nameEn: 'Working request',
        descriptionKo: 'Actual draft',
        descriptionEn: 'Actual draft',
        ownerGroupRef: 'group:finance',
        formKind: 'REQUEST',
      },
      route: { workflowId: '44444444-4444-4444-8444-444444444444' },
      materialDigest: 'c'.repeat(64),
      metadataProvenance: 'AUTHORING_SNAPSHOT',
      capturedAt: '2026-09-14T00:00:00Z',
      capturedBy: 31,
      publishedAt: null,
      publishedBy: null,
    },
    lastEditorUserId: 31,
    catalogPolicyEligible: true,
    observedAt: '2026-09-14T00:00:00Z',
  };
}
export function reviewFixture(): ApprovalFormWorkspaceReview {
  return {
    formId,
    formRevision: 4,
    workspaceRevision: 2,
    draftFormVersionId: draftId,
    basePublishedVersionId: publishedId,
    schemaSha256: 'b'.repeat(64),
    reviewContentDigest: 'd'.repeat(64),
    makerUserId: 31,
    lastEditorUserId: 31,
    independentCheckerEligible: true,
    authorityValidUntil: '2099-09-14T00:00:30Z',
  };
}
export function diffFixture(): ApprovalFormWorkspaceDiff {
  return {
    fromVersionId: publishedId,
    toVersionId: draftId,
    fromSchemaSha256: 'a'.repeat(64),
    toSchemaSha256: 'b'.repeat(64),
    changes: [{ path: '/metadata/nameEn', before: null, after: 'Working request' }],
    complete: true,
    fromMetadataProvenance: 'UNRECORDED_HISTORICAL_METADATA',
    toMetadataProvenance: 'AUTHORING_SNAPSHOT',
  };
}
