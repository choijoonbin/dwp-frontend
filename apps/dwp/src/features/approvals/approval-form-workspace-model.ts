import {
  HttpError,
  isApprovalTypedFormSchema,
  readApprovalFormWorkspace,
  readApprovalFormWorkspaceReview,
  snapshotApprovalFormWorkspace,
} from '@dwp-frontend/shared-utils';

import type {
  ApprovalFormWorkspace,
  ApprovalFormWorkspaceReview,
  ApprovalFormWorkingDraftInput,
  ApprovalFormWorkspaceHistory,
  ApprovalFormWorkspaceDiff,
} from '@dwp-frontend/shared-utils';
import type { FormDraft } from './approval-form-catalog-drafts';

export type {
  ApprovalFormWorkspace,
  ApprovalFormWorkspaceVersion,
} from '@dwp-frontend/shared-utils';
export type ApprovalFormWorkspaceReadState =
  'READY' | 'LOADING' | 'DENIED' | 'STALE' | 'UNAVAILABLE';
export type ApprovalFormWorkspacePins = Readonly<{
  workspace: ApprovalFormWorkspace;
  scopeIdentity: string;
  scopeEpoch: number;
  actorId: number;
  selectionEpoch: number;
}>;
type ReadSource = {
  data: unknown;
  error?: unknown;
  failureReason?: unknown;
  failureCount?: number;
  isPending?: boolean;
  isFetching?: boolean;
};
export function approvalFormWorkspaceReadState(source: ReadSource): ApprovalFormWorkspaceReadState {
  const failure = source.failureReason ?? source.error;
  if (failure instanceof HttpError && [401, 403, 404].includes(failure.status)) return 'DENIED';
  if (source.data === undefined && source.isPending && failure == null) return 'LOADING';
  if (failure != null || (source.failureCount ?? 0) > 0 || source.isFetching) {
    return source.data === undefined ? 'UNAVAILABLE' : 'STALE';
  }
  if (source.data !== undefined) return 'READY';
  return source.isPending ? 'LOADING' : 'UNAVAILABLE';
}
export function approvalFormWorkspaceFingerprint(workspace: ApprovalFormWorkspace) {
  const { observedAt: _observedAt, ...material } = workspace;
  return JSON.stringify(material);
}
export function captureApprovalFormWorkspace(
  workspace: ApprovalFormWorkspace,
  scope: { scopeIdentity: string; scopeEpoch: number },
  actorId: number,
  selectionEpoch = 0
): ApprovalFormWorkspacePins {
  if (!Number.isSafeInteger(actorId) || actorId <= 0)
    throw new Error('Invalid form workspace actor');
  return Object.freeze({
    workspace: readApprovalFormWorkspace(workspace, workspace.formId),
    ...scope,
    actorId,
    selectionEpoch,
  });
}
export function approvalFormWorkspacePinsMatch(
  original: ApprovalFormWorkspacePins | null,
  current: ApprovalFormWorkspace | undefined,
  scope: { scopeIdentity: string; scopeEpoch: number },
  actorId: number
) {
  return Boolean(
    original &&
    current &&
    original.actorId === actorId &&
    original.scopeIdentity === scope.scopeIdentity &&
    original.scopeEpoch === scope.scopeEpoch &&
    approvalFormWorkspaceFingerprint(original.workspace) ===
      approvalFormWorkspaceFingerprint(current)
  );
}
export function approvalFormWorkspaceReviewMatches(
  review: ApprovalFormWorkspaceReview,
  original: ApprovalFormWorkspacePins,
  now: number
) {
  const workspace = original.workspace;
  const draft = workspace.workingDraft;
  return Boolean(
    draft &&
    workspace.formId === review.formId &&
    workspace.formRevision === review.formRevision &&
    workspace.workspaceRevision === review.workspaceRevision &&
    draft.formVersionId === review.draftFormVersionId &&
    (workspace.published?.formVersionId ?? null) === review.basePublishedVersionId &&
    draft.schemaSha256 === review.schemaSha256 &&
    draft.createdBy === review.makerUserId &&
    workspace.lastEditorUserId === review.lastEditorUserId &&
    review.reviewRequest.status === 'PENDING' &&
    review.reviewRequest.formId === review.formId &&
    review.reviewRequest.draftFormVersionId === review.draftFormVersionId &&
    review.reviewRequest.basePublishedFormVersionId === review.basePublishedVersionId &&
    review.reviewRequest.formRevision === review.formRevision &&
    review.reviewRequest.workspaceRevision === review.workspaceRevision &&
    review.reviewRequest.schemaSha256 === review.schemaSha256 &&
    review.reviewRequest.reviewContentDigest === review.reviewContentDigest &&
    review.reviewRequest.reviewerUserId === original.actorId &&
    review.independentCheckerEligible &&
    review.makerUserId !== original.actorId &&
    review.lastEditorUserId !== original.actorId &&
    Number.isFinite(now) &&
    Date.parse(review.authorityValidUntil) > now
  );
}
export function captureApprovalFormWorkspaceReview(review: ApprovalFormWorkspaceReview) {
  return readApprovalFormWorkspaceReview(review, review.formId);
}
export function approvalFormWorkspaceReviewSourcesMatch(
  original: ApprovalFormWorkspacePins,
  review: ApprovalFormWorkspaceReview,
  history: ApprovalFormWorkspaceHistory | undefined,
  requiredDiff: ApprovalFormWorkspaceDiff | undefined,
  visibleDiff: ApprovalFormWorkspaceDiff | undefined,
  selectedVersionId: string | null
) {
  const draft = original.workspace.workingDraft;
  const fromId =
    original.workspace.published?.formVersionId ?? draft?.sourceVersionId ?? draft?.formVersionId;
  const expectedFrom =
    original.workspace.published ?? history?.versions.find((item) => item.formVersionId === fromId);
  const visibleFrom = history?.versions.find(
    (item) => item.formVersionId === (selectedVersionId ?? fromId)
  );
  return Boolean(
    draft &&
    history &&
    !history.mayBeTruncated &&
    requiredDiff?.complete &&
    visibleDiff?.complete &&
    expectedFrom &&
    visibleFrom &&
    history.versions.some(
      (item) =>
        item.formVersionId === review.draftFormVersionId &&
        item.schemaSha256 === review.schemaSha256
    ) &&
    requiredDiff.fromVersionId === expectedFrom.formVersionId &&
    requiredDiff.fromSchemaSha256 === expectedFrom.schemaSha256 &&
    visibleDiff.fromVersionId === visibleFrom.formVersionId &&
    visibleDiff.fromSchemaSha256 === visibleFrom.schemaSha256 &&
    requiredDiff.toVersionId === draft.formVersionId &&
    visibleDiff.toVersionId === draft.formVersionId &&
    requiredDiff.toSchemaSha256 === draft.schemaSha256 &&
    visibleDiff.toSchemaSha256 === draft.schemaSha256
  );
}
export function approvalFormWorkingDraftEditor(
  workspace: ApprovalFormWorkspace,
  formKey: string
): FormDraft | null {
  const version = workspace.workingDraft;
  if (!version || version.metadataProvenance === 'UNRECORDED_HISTORICAL_METADATA') return null;
  const metadata = version.metadata;
  const fields = [
    'categoryId',
    'nameKo',
    'nameEn',
    'descriptionKo',
    'descriptionEn',
    'ownerGroupRef',
  ] as const;
  if (
    fields.some((key) => typeof metadata[key] !== 'string') ||
    typeof version.route.workflowId !== 'string'
  )
    return null;
  const base = {
    formKey,
    categoryId: String(metadata.categoryId),
    nameKo: String(metadata.nameKo),
    nameEn: String(metadata.nameEn),
    descriptionKo: String(metadata.descriptionKo),
    descriptionEn: String(metadata.descriptionEn),
    ownerGroupRef: String(metadata.ownerGroupRef),
    defaultWorkflowId: version.route.workflowId,
  };
  return isApprovalTypedFormSchema(version.schema)
    ? snapshotApprovalFormWorkspace({ ...base, typedSchema: version.schema })
    : snapshotApprovalFormWorkspace({
        ...base,
        fields: version.schema.fields.map((field) => ({
          ...field,
          labelKo: field.labelKo ?? field.key,
          labelEn: field.labelEn ?? field.key,
          helpKo: field.helpKo ?? '',
          helpEn: field.helpEn ?? '',
          options: field.options ?? [],
        })),
      });
}
export function approvalFormWorkingDraftInput(
  original: ApprovalFormWorkspacePins,
  draft: FormDraft,
  compiledSha?: string
): ApprovalFormWorkingDraftInput {
  const version = original.workspace.workingDraft;
  const kind = version?.metadata.formKind;
  if (!version || (kind !== 'REQUEST' && kind !== 'DOCUMENT' && kind !== 'SIGNATURE'))
    throw new Error('Invalid form workspace kind');
  if (isApprovalTypedFormSchema(version.schema) && !draft.typedSchema)
    throw new Error('Typed form downgrade is not supported');
  if (draft.typedSchema && !compiledSha) throw new Error('Unverified typed form schema');
  return snapshotApprovalFormWorkspace({
    expectedFormRevision: original.workspace.formRevision,
    expectedWorkspaceRevision: original.workspace.workspaceRevision,
    draftFormVersionId: version.formVersionId,
    schema: draft.typedSchema ?? {
      schemaVersion: version.schema.schemaVersion,
      fields: draft.fields ?? [],
    },
    metadata: {
      categoryId: draft.categoryId,
      nameKo: draft.nameKo,
      nameEn: draft.nameEn,
      descriptionKo: draft.descriptionKo,
      descriptionEn: draft.descriptionEn,
      ownerGroupRef: draft.ownerGroupRef,
      formKind: kind,
    },
    defaultWorkflowId: draft.defaultWorkflowId,
  });
}
