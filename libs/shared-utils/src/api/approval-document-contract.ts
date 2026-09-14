export type ApprovalDocumentOwner = Readonly<{ type: 'REQUEST' | 'TASK'; id: string }>;
type Tool = Readonly<{ allowed: boolean; reason: string }>;

export type ApprovalDocumentTools = Readonly<{
  requestId: string;
  taskId: string | null;
  requestVersion: number;
  taskVersion: number | null;
  payloadRevision: number;
  payloadSha256: string;
  policyVersion: number;
  commentsVersion: number;
  holdVersion: number;
  legalHold: boolean;
  copyIdentifier: Tool;
  history: Tool;
  comment: Tool;
  print: Tool;
  jsonExport: Tool;
  attachments: Tool;
  evaluatedAt: string;
  policyId: string;
  resourceSetKey: string;
  archiveExport: Tool;
  maxBatchItems: number;
  preservationPending: boolean;
}>;
export type ApprovalDocumentComment = Readonly<{
  commentId: string;
  requestId: string;
  sourceTaskId: string | null;
  sequence: number;
  authorUserId: number;
  text: string;
  createdAt: string;
  retainUntil: string;
}>;
export type ApprovalDocumentComments = Readonly<{
  items: readonly ApprovalDocumentComment[];
  totalElements: number;
  page: number;
  size: number;
  commentsVersion: number;
  evaluatedAt: string;
}>;
export type ApprovalDocumentCommentInput = Readonly<{
  expectedVersion: number;
  expectedCommentsVersion: number;
  idempotencyKey: string;
  text: string;
}>;
export type ApprovalDocumentExportInput = Readonly<{
  expectedVersion: number;
  payloadRevision: number;
  expectedPolicyVersion: number;
  intent: 'PRINT' | 'DOWNLOAD';
  reason: string;
  idempotencyKey: string;
}>;
export type ApprovalArchiveExportInput = Readonly<{
  items: readonly Readonly<{
    requestId: string;
    expectedVersion: number;
    payloadRevision: number;
  }>[];
  expectedPolicyVersion: number;
  reason: string;
  idempotencyKey: string;
  expectedPolicyId: string;
  resourceSetKey: string;
}>;
export type ApprovalGeneratedDocument = Readonly<{
  exportId: string;
  format: 'JSON' | 'HTML';
  mediaType: 'application/json' | 'text/html';
  fileName: string;
  sha256: string;
  sizeBytes: number;
  policyVersion: number;
  generatedAt: string;
  expiresAt: string;
  retainUntil: string;
  content: string;
}>;
export type ApprovalDocumentFieldRule = Readonly<{
  key: string;
  type:
    'STRING' | 'NUMBER' | 'DECIMAL_STRING' | 'BOOLEAN' | 'STRING_LIST' | 'OBJECT' | 'OBJECT_LIST';
  maxLength: number;
  children: readonly ApprovalDocumentFieldRule[];
  maxRows: number | null;
}>;
export type ApprovalDocumentRules = Readonly<{
  allowComments: boolean;
  allowPrint: boolean;
  allowJsonExport: boolean;
  allowArchiveExport: boolean;
  includeComments: boolean;
  includeEvidence: boolean;
  allowedClassifications: readonly string[];
  fields: readonly ApprovalDocumentFieldRule[];
  maxBatchItems: number;
  maxBytes: number;
  snapshotTtlSeconds: number;
  evidenceRetentionDays: number;
}>;
export type ApprovalDocumentPolicyRevision = Readonly<{
  revision: number;
  rules: ApprovalDocumentRules;
  sha256: string;
  makerUserId: number | null;
  createdAt: string;
}>;
export type ApprovalDocumentPolicy = Readonly<{
  policyId: string;
  resourceSetKey: string;
  version: number;
  published: ApprovalDocumentPolicyRevision;
  pending: ApprovalDocumentPolicyRevision | null;
}>;
export type ApprovalDocumentPolicyInput = Readonly<{
  expectedVersion: number;
  idempotencyKey: string;
  rules: ApprovalDocumentRules;
}>;
export type ApprovalDocumentPublishInput = Readonly<{
  expectedVersion: number;
  idempotencyKey: string;
  reviewComment: string;
}>;
export type ApprovalDocumentHold = Readonly<{
  requestId: string;
  version: number;
  active: boolean;
  pending: Readonly<{
    proposalId: string;
    operation: 'PLACE' | 'RELEASE';
    reason: string;
    makerUserId: number;
    createdAt: string;
  }> | null;
  journal: readonly Readonly<{
    entryId: string;
    version: number;
    operation: 'PLACE' | 'RELEASE';
    makerUserId: number;
    checkerUserId: number;
    reason: string;
    reviewComment: string;
    occurredAt: string;
  }>[];
  purgeState: string;
  retainUntil: string;
  preservationPending: boolean;
  purgeEligible: boolean;
}>;
export type ApprovalDocumentHoldInput = Readonly<{
  expectedVersion: number;
  operation: 'PLACE' | 'RELEASE';
  reason: string;
  idempotencyKey: string;
}>;
export type ApprovalDocumentHoldPublishInput = ApprovalDocumentPublishInput &
  Readonly<{ proposalId: string }>;
