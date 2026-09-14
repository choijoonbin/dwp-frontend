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
