import { assertSupportedApprovalFormSchema } from './approval-management-contract';

import type { ApprovalFormSchema } from './approval-management-contract';

export interface ApprovalFormWorkspaceMetadata {
  categoryId: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef: string;
  formKind: 'REQUEST' | 'DOCUMENT' | 'SIGNATURE';
}

export interface ApprovalFormWorkspaceVersion {
  formVersionId: string;
  versionNumber: number;
  lifecycleState: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  sourceVersionId: string | null;
  basePublishedVersionId: string | null;
  schema: ApprovalFormSchema;
  schemaSha256: string;
  metadata: Record<string, unknown>;
  route: Record<string, unknown>;
  materialDigest: string | null;
  metadataProvenance:
    | 'UNRECORDED_HISTORICAL_METADATA'
    | 'LEGACY_CAPTURE_TIME'
    | 'AUTHORING_SNAPSHOT'
    | 'PUBLISH_SNAPSHOT';
  capturedAt: string | null;
  capturedBy: number | null;
  createdAt: string;
  createdBy: number | null;
  publishedAt: string | null;
  publishedBy: number | null;
}

export interface ApprovalFormWorkspace {
  formId: string;
  formRevision: number;
  workspaceRevision: number | null;
  catalogAvailability: 'ACTIVE' | 'RETIRED';
  published: ApprovalFormWorkspaceVersion | null;
  workingDraft: ApprovalFormWorkspaceVersion | null;
  lastEditorUserId: number | null;
  catalogPolicyEligible: boolean;
  observedAt: string;
}

export interface ApprovalFormWorkspaceHistory {
  versions: ApprovalFormWorkspaceVersion[];
  mayBeTruncated: boolean;
}

export interface ApprovalFormWorkspaceDiff {
  fromVersionId: string;
  toVersionId: string;
  fromSchemaSha256: string;
  toSchemaSha256: string;
  changes: Array<{ path: string; before: unknown; after: unknown }>;
  complete: boolean;
  fromMetadataProvenance: ApprovalFormWorkspaceVersion['metadataProvenance'];
  toMetadataProvenance: ApprovalFormWorkspaceVersion['metadataProvenance'];
}

export interface ApprovalFormWorkspaceReview {
  formId: string;
  formRevision: number;
  workspaceRevision: number;
  draftFormVersionId: string;
  basePublishedVersionId: string | null;
  schemaSha256: string;
  reviewContentDigest: string;
  makerUserId: number | null;
  lastEditorUserId: number | null;
  independentCheckerEligible: boolean;
  authorityValidUntil: string;
  reviewRequest: ApprovalFormPublishReviewRequest;
}

export interface ApprovalFormPublishReviewRequest {
  reviewRequestId: string;
  formId: string;
  draftFormVersionId: string;
  basePublishedFormVersionId: string | null;
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED' | 'SUPERSEDED';
  version: number;
  makerUserId: number;
  lastEditorUserId: number;
  reviewerUserId: number;
  reviewerPersonPublicId: string;
  formRevision: number;
  workspaceRevision: number;
  schemaSha256: string;
  reviewContentDigest: string;
  requestReason: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: number | null;
  decisionReason: string | null;
}

export interface ApprovalFormPublishReviewCandidate {
  userId: number;
  personPublicId: string;
  displayName: string;
  email: string | null;
  jobTitle: string | null;
}

export interface ApprovalFormPublishReviewCandidates {
  candidates: ApprovalFormPublishReviewCandidate[];
  mayBeTruncated: boolean;
  decisionRevision: string;
  authorityValidUntil: string;
}

export interface ApprovalFormPublishReviewQueue {
  items: Array<{
    request: ApprovalFormPublishReviewRequest;
    formKey: string;
    formNameKo: string;
    formNameEn: string;
  }>;
  mayBeTruncated: boolean;
  generatedAt: string;
}

export interface ApprovalFormWorkspaceRevisionInput {
  expectedFormRevision: number;
  expectedWorkspaceRevision: number | null;
}
export interface ApprovalFormWorkingDraftInput extends ApprovalFormWorkspaceRevisionInput {
  draftFormVersionId: string;
  schema: ApprovalFormSchema;
  metadata: ApprovalFormWorkspaceMetadata;
  defaultWorkflowId: string;
}
export interface ApprovalFormReviewedPublishInput extends ApprovalFormWorkspaceRevisionInput {
  expectedWorkspaceRevision: number;
  draftFormVersionId: string;
  basePublishedVersionId: string | null;
  schemaSha256: string;
  reviewContentDigest: string;
  reviewRequestId: string;
  expectedReviewRequestVersion: number;
  reviewComment: string;
}
export interface ApprovalFormPublishReviewRequestInput extends ApprovalFormWorkspaceRevisionInput {
  expectedWorkspaceRevision: number;
  draftFormVersionId: string;
  basePublishedVersionId: string | null;
  schemaSha256: string;
  reviewerUserId: number;
  reviewerPersonPublicId: string;
  expectedReviewRequestId: string | null;
  expectedReviewRequestVersion: number | null;
  reason: string;
}
export interface ApprovalFormPublishReviewRejectInput extends ApprovalFormWorkspaceRevisionInput {
  expectedWorkspaceRevision: number;
  expectedReviewRequestVersion: number;
  reason: string;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const sha = /^[a-f0-9]{64}$/u;
const provenances = [
  'UNRECORDED_HISTORICAL_METADATA',
  'LEGACY_CAPTURE_TIME',
  'AUTHORING_SNAPSHOT',
  'PUBLISH_SNAPSHOT',
];
export function invalidApprovalFormWorkspace(): never {
  throw new Error('Invalid approval form workspace contract');
}
export function approvalFormWorkspaceId(value: string): string {
  if (typeof value !== 'string' || !uuid.test(value)) invalidApprovalFormWorkspace();
  return value;
}
export function approvalFormWorkspaceRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) invalidApprovalFormWorkspace();
}
function nullableId(value: string | null) {
  if (value !== null) approvalFormWorkspaceId(value);
}
function date(value: string | null, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    invalidApprovalFormWorkspace();
}
function user(value: number | null) {
  if (value !== null && (!Number.isSafeInteger(value) || value <= 0))
    invalidApprovalFormWorkspace();
}
function digest(value: string) {
  if (typeof value !== 'string' || !sha.test(value)) invalidApprovalFormWorkspace();
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index]))
    invalidApprovalFormWorkspace();
}
function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}
function boundedText(
  value: unknown,
  maximum: number,
  nullable = false
): asserts value is string | null {
  if (nullable && value === null) return;
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    hasControlCharacter(value)
  )
    invalidApprovalFormWorkspace();
}

// Validate before JSON cloning so nonfinite numbers cannot silently become null.
export function snapshotApprovalFormWorkspace<T>(value: T): T {
  let nodes = 0;
  const inspect = (item: unknown, depth: number) => {
    if (++nodes > 50_000 || depth > 64) invalidApprovalFormWorkspace();
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!object(item) && !Array.isArray(item)) invalidApprovalFormWorkspace();
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype)
      invalidApprovalFormWorkspace();
    for (const child of Object.values(item)) inspect(child, depth + 1);
  };
  inspect(value, 0);
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > 524_288) invalidApprovalFormWorkspace();
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object') {
      for (const child of Object.values(item)) freeze(child);
      Object.freeze(item);
    }
  };
  const copy: T = JSON.parse(raw);
  freeze(copy);
  return copy;
}

export function readApprovalFormWorkspaceVersion(value: ApprovalFormWorkspaceVersion) {
  if (!value) invalidApprovalFormWorkspace();
  approvalFormWorkspaceId(value.formVersionId);
  if (!Number.isSafeInteger(value.versionNumber) || value.versionNumber < 1)
    invalidApprovalFormWorkspace();
  if (!['DRAFT', 'PUBLISHED', 'RETIRED'].includes(value.lifecycleState))
    invalidApprovalFormWorkspace();
  nullableId(value.sourceVersionId);
  nullableId(value.basePublishedVersionId);
  assertSupportedApprovalFormSchema(value.schema);
  digest(value.schemaSha256);
  if (
    !object(value.metadata) ||
    !object(value.route) ||
    !provenances.includes(value.metadataProvenance)
  )
    invalidApprovalFormWorkspace();
  if (value.metadataProvenance === 'UNRECORDED_HISTORICAL_METADATA') {
    if (
      value.materialDigest !== null ||
      Object.keys(value.metadata).length ||
      Object.keys(value.route).length
    )
      invalidApprovalFormWorkspace();
  } else {
    digest(value.materialDigest!);
    if (!Object.keys(value.metadata).length || !Object.keys(value.route).length)
      invalidApprovalFormWorkspace();
  }
  date(value.createdAt);
  date(value.capturedAt, true);
  date(value.publishedAt, true);
  user(value.createdBy);
  user(value.capturedBy);
  user(value.publishedBy);
  return snapshotApprovalFormWorkspace(value);
}

export function readApprovalFormWorkspace(value: ApprovalFormWorkspace, formId: string) {
  if (!value || value.formId !== approvalFormWorkspaceId(formId)) invalidApprovalFormWorkspace();
  approvalFormWorkspaceRevision(value.formRevision);
  if (value.workspaceRevision !== null) approvalFormWorkspaceRevision(value.workspaceRevision);
  if (!['ACTIVE', 'RETIRED'].includes(value.catalogAvailability)) invalidApprovalFormWorkspace();
  if (
    value.published !== null &&
    readApprovalFormWorkspaceVersion(value.published).lifecycleState !== 'PUBLISHED'
  )
    invalidApprovalFormWorkspace();
  if (
    value.workingDraft !== null &&
    readApprovalFormWorkspaceVersion(value.workingDraft).lifecycleState !== 'DRAFT'
  )
    invalidApprovalFormWorkspace();
  if (
    (!value.published && !value.workingDraft) ||
    value.published?.formVersionId === value.workingDraft?.formVersionId
  )
    invalidApprovalFormWorkspace();
  if (
    typeof value.catalogPolicyEligible !== 'boolean' ||
    (value.catalogPolicyEligible && (!value.published || value.catalogAvailability !== 'ACTIVE'))
  )
    invalidApprovalFormWorkspace();
  user(value.lastEditorUserId);
  date(value.observedAt);
  return snapshotApprovalFormWorkspace(value);
}

export function readApprovalFormWorkspaceReview(
  value: ApprovalFormWorkspaceReview,
  formId: string
) {
  if (!value || value.formId !== approvalFormWorkspaceId(formId)) invalidApprovalFormWorkspace();
  approvalFormWorkspaceRevision(value.formRevision);
  approvalFormWorkspaceRevision(value.workspaceRevision);
  approvalFormWorkspaceId(value.draftFormVersionId);
  nullableId(value.basePublishedVersionId);
  digest(value.schemaSha256);
  digest(value.reviewContentDigest);
  user(value.makerUserId);
  user(value.lastEditorUserId);
  if (
    typeof value.independentCheckerEligible !== 'boolean' ||
    (value.independentCheckerEligible &&
      (value.makerUserId === null || value.lastEditorUserId === null))
  )
    invalidApprovalFormWorkspace();
  date(value.authorityValidUntil);
  readApprovalFormPublishReviewRequest(value.reviewRequest, formId);
  if (
    value.reviewRequest.draftFormVersionId !== value.draftFormVersionId ||
    value.reviewRequest.reviewContentDigest !== value.reviewContentDigest ||
    value.reviewRequest.reviewerUserId === value.makerUserId ||
    value.reviewRequest.reviewerUserId === value.lastEditorUserId
  )
    invalidApprovalFormWorkspace();
  return snapshotApprovalFormWorkspace(value);
}

export function readApprovalFormPublishReviewRequest(
  value: ApprovalFormPublishReviewRequest,
  formId = value?.formId
) {
  if (!object(value)) invalidApprovalFormWorkspace();
  exactKeys(value, [
    'reviewRequestId',
    'formId',
    'draftFormVersionId',
    'basePublishedFormVersionId',
    'status',
    'version',
    'makerUserId',
    'lastEditorUserId',
    'reviewerUserId',
    'reviewerPersonPublicId',
    'formRevision',
    'workspaceRevision',
    'schemaSha256',
    'reviewContentDigest',
    'requestReason',
    'requestedAt',
    'decidedAt',
    'decidedBy',
    'decisionReason',
  ]);
  if (value.formId !== approvalFormWorkspaceId(formId)) invalidApprovalFormWorkspace();
  approvalFormWorkspaceId(value.reviewRequestId);
  approvalFormWorkspaceId(value.draftFormVersionId);
  nullableId(value.basePublishedFormVersionId);
  approvalFormWorkspaceId(value.reviewerPersonPublicId);
  if (!['PENDING', 'PUBLISHED', 'REJECTED', 'SUPERSEDED'].includes(value.status))
    invalidApprovalFormWorkspace();
  for (const revision of [value.version, value.formRevision, value.workspaceRevision])
    approvalFormWorkspaceRevision(revision);
  for (const id of [value.makerUserId, value.lastEditorUserId, value.reviewerUserId])
    if (!Number.isSafeInteger(id) || id <= 0) invalidApprovalFormWorkspace();
  if (value.reviewerUserId === value.makerUserId || value.reviewerUserId === value.lastEditorUserId)
    invalidApprovalFormWorkspace();
  digest(value.schemaSha256);
  digest(value.reviewContentDigest);
  boundedText(value.requestReason, 1000);
  if (value.requestReason.length < 10) invalidApprovalFormWorkspace();
  date(value.requestedAt);
  date(value.decidedAt, true);
  user(value.decidedBy);
  boundedText(value.decisionReason, 1000, true);
  if (
    (value.status === 'PENDING' &&
      (value.decidedAt !== null || value.decidedBy !== null || value.decisionReason !== null)) ||
    (value.status !== 'PENDING' && (value.decidedAt === null || value.decidedBy === null)) ||
    (value.decisionReason !== null && value.decisionReason.length < 10)
  )
    invalidApprovalFormWorkspace();
  return snapshotApprovalFormWorkspace(value);
}

export function readApprovalFormPublishReviewCandidates(
  value: ApprovalFormPublishReviewCandidates,
  maximum: number
) {
  if (!object(value)) invalidApprovalFormWorkspace();
  exactKeys(value, ['candidates', 'mayBeTruncated', 'decisionRevision', 'authorityValidUntil']);
  if (
    !Array.isArray(value.candidates) ||
    value.candidates.length > maximum ||
    typeof value.mayBeTruncated !== 'boolean' ||
    typeof value.decisionRevision !== 'string' ||
    !/^psr-[a-f0-9]{64}$/u.test(value.decisionRevision)
  )
    invalidApprovalFormWorkspace();
  date(value.authorityValidUntil);
  const users = new Set<number>();
  const people = new Set<string>();
  for (const candidate of value.candidates) {
    if (!object(candidate)) invalidApprovalFormWorkspace();
    exactKeys(candidate, ['userId', 'personPublicId', 'displayName', 'email', 'jobTitle']);
    if (
      !Number.isSafeInteger(candidate.userId) ||
      candidate.userId <= 0 ||
      users.has(candidate.userId)
    )
      invalidApprovalFormWorkspace();
    users.add(candidate.userId);
    approvalFormWorkspaceId(candidate.personPublicId);
    if (people.has(candidate.personPublicId)) invalidApprovalFormWorkspace();
    people.add(candidate.personPublicId);
    boundedText(candidate.displayName, 200);
    boundedText(candidate.email, 320, true);
    boundedText(candidate.jobTitle, 200, true);
  }
  return snapshotApprovalFormWorkspace(value);
}

export function readApprovalFormPublishReviewQueue(
  value: ApprovalFormPublishReviewQueue,
  maximum: number
) {
  if (!object(value)) invalidApprovalFormWorkspace();
  exactKeys(value, ['items', 'mayBeTruncated', 'generatedAt']);
  if (
    !Array.isArray(value.items) ||
    value.items.length > maximum ||
    typeof value.mayBeTruncated !== 'boolean'
  )
    invalidApprovalFormWorkspace();
  date(value.generatedAt);
  const ids = new Set<string>();
  for (const item of value.items) {
    if (!object(item)) invalidApprovalFormWorkspace();
    exactKeys(item, ['request', 'formKey', 'formNameKo', 'formNameEn']);
    const request = readApprovalFormPublishReviewRequest(item.request);
    if (request.status !== 'PENDING' || ids.has(request.reviewRequestId))
      invalidApprovalFormWorkspace();
    ids.add(request.reviewRequestId);
    boundedText(item.formKey, 160);
    boundedText(item.formNameKo, 200);
    boundedText(item.formNameEn, 200);
  }
  return snapshotApprovalFormWorkspace(value);
}

export function assertApprovalFormWorkspaceRevisionInput(
  value: ApprovalFormWorkspaceRevisionInput
) {
  if (!value) invalidApprovalFormWorkspace();
  approvalFormWorkspaceRevision(value.expectedFormRevision);
  if (value.expectedWorkspaceRevision !== null)
    approvalFormWorkspaceRevision(value.expectedWorkspaceRevision);
}
