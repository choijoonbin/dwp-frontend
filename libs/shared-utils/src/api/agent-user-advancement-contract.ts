export type DwaionWorkflowCapability = {
  available: boolean;
  configured: boolean;
  reasonCode: string | null;
  recoveryHint: string | null;
};

export type DwaionAttachmentState =
  | 'UPLOADING'
  | 'SCANNING'
  | 'READY'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DELETION_PENDING'
  | 'DELETED';
export type DwaionAttachmentStageKey = 'UPLOAD' | 'AV' | 'DLP' | 'PARSER' | 'OCR' | 'INDEX';
export type DwaionAttachmentStageState =
  'PENDING' | 'RUNNING' | 'PASSED' | 'BLOCKED' | 'FAILED' | 'NOT_REQUIRED' | 'NOT_CONFIGURED';

export type DwaionAttachmentStage = {
  key: DwaionAttachmentStageKey;
  state: DwaionAttachmentStageState;
  providerCode: string | null;
  observedAt: string | null;
  safeErrorCode: string | null;
  recoveryHint: string | null;
};

export type DwaionAttachmentCitation = {
  citationId: string;
  locator: string;
  label: string;
  contentSha256: string;
};

export type DwaionAttachmentCapabilities = {
  upload: DwaionWorkflowCapability;
  antivirus: DwaionWorkflowCapability;
  dlp: DwaionWorkflowCapability;
  parser: DwaionWorkflowCapability;
  ocr: DwaionWorkflowCapability;
  index: DwaionWorkflowCapability;
  deletion: DwaionWorkflowCapability;
  maximumFileBytes: number;
  allowedMediaTypes: string[];
};

export type DwaionAttachmentUploadTicket = {
  method: 'PUT';
  uploadUrl: string;
  uploadReference: string;
  expiresAt: string;
};

export type DwaionSecureAttachment = {
  attachmentId: string;
  conversationId: string | null;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sourceSha256: string;
  revision: number;
  state: DwaionAttachmentState;
  stages: DwaionAttachmentStage[];
  citations: DwaionAttachmentCitation[];
  retentionExpiresAt: string;
  capabilities: DwaionAttachmentCapabilities;
  uploadTicket: DwaionAttachmentUploadTicket | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DwaionResearchPlanState = 'DRAFT' | 'READY' | 'ARCHIVED';
export type DwaionResearchRunState =
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'PARTIAL'
  | 'CONFLICT'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FAILED'
  | 'COMPLETED';

export type DwaionResearchSourcePolicy = {
  sourceKey: string;
  allowed: boolean;
  scope: string;
};

export type DwaionResearchBudget = {
  maximumMinutes: number;
  maximumSources: number;
  maximumTokens: number;
};

export type DwaionResearchDeliverableType =
  'REPORT' | 'EXECUTIVE_SUMMARY' | 'COMPARISON' | 'SOURCE_MAP';

export type DwaionResearchPlanDefinition = {
  goal: string;
  question: string;
  successCriteria: string[];
  deliverableTypes: DwaionResearchDeliverableType[];
  sourcePolicies: DwaionResearchSourcePolicy[];
  requireAllAllowedSources: boolean;
  budget: DwaionResearchBudget;
};

export type DwaionResearchPlan = {
  planId: string;
  state: DwaionResearchPlanState;
  revision: number;
  definition: DwaionResearchPlanDefinition;
  createdAt: string;
  updatedAt: string;
};

export type DwaionResearchProgress = {
  completedSteps: number;
  totalSteps: number;
  discoveredSources: number;
  verifiedCitations: number;
  failedSources: string[];
  recoveryHint: string | null;
};

export type DwaionResearchResult = {
  reportMarkdown: string;
  citations: DwaionAttachmentCitation[];
  resultSha256: string;
};

export type DwaionResearchRun = {
  runId: string;
  planId: string;
  planRevision: number;
  state: DwaionResearchRunState;
  version: number;
  progress: DwaionResearchProgress;
  result: DwaionResearchResult | null;
  receiptId: string | null;
  safeErrorCode: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DwaionResearchCommand =
  'PAUSE' | 'RESUME' | 'EXCLUDE_SOURCE_AND_CONTINUE' | 'REPROBE_SOURCE' | 'SAFE_CANCEL' | 'EXTEND';

export type DwaionResearchDeliveryType =
  'ARTIFACT' | 'PROPOSAL' | 'EXPORT' | 'HANDOFF' | 'SHARE' | 'ROUTINE';
export type DwaionResearchDeliveryState =
  'QUEUED' | 'AWAITING_APPROVAL' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type DwaionResearchDelivery = {
  deliveryId: string;
  runId: string;
  deliveryType: DwaionResearchDeliveryType;
  state: DwaionResearchDeliveryState;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DwaionProposalHandoffState =
  | 'REVIEW_REQUIRED'
  | 'AWAITING_APPROVAL'
  | 'HANDED_OFF'
  | 'RUNNING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export type DwaionProposalHandoff = {
  handoffId: string;
  proposalId: string;
  actionKey: string;
  state: DwaionProposalHandoffState;
  version: number;
  targetRoute: string;
  approvalRequired: boolean;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDwaionAttachmentOptions = {
  createCommandId: string;
  completeCommandId: string;
  conversationId?: string | null;
  retentionHours?: number;
  signal?: AbortSignal;
  authority?: ProductSurfaceGovernedMutationAuthority;
  onUploadProgress?: (loaded: number, total: number) => void;
};

export type DwaionResearchCommandOptions = {
  commandId: string;
  sourceKey?: string;
  extensionMinutes?: number;
  reason: string;
};

export type DwaionCommandAttempt = {
  commandId: string;
  idempotencyKey: string;
};
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';
