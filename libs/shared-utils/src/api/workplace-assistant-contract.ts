import type {
  WorkplaceBookingBatch,
  WorkplaceBookingFailurePolicy,
} from './workplace-booking-orchestration-api';
import type { WorkplaceResourceType } from './workplace-api';

export const WORKPLACE_ASSISTANT_REQUEST_STATES = [
  'SUGGESTED',
  'VALIDATED',
  'AWAITING_CONFIRMATION',
  'PROCESSING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export type WorkplaceAssistantRequestState = (typeof WORKPLACE_ASSISTANT_REQUEST_STATES)[number];

export const WORKPLACE_ASSISTANT_POLICY_RESULTS = [
  'UNVALIDATED',
  'ALLOWED',
  'DENIED',
  'CONFLICT',
  'UNAVAILABLE',
] as const;
export type WorkplaceAssistantPolicyResult = (typeof WORKPLACE_ASSISTANT_POLICY_RESULTS)[number];

export const WORKPLACE_ASSISTANT_REDACTION_STATES = [
  'APPLIED',
  'NOT_REQUIRED',
  'RETAINED_CONTENT_DELETED',
] as const;
export type WorkplaceAssistantRedactionState =
  (typeof WORKPLACE_ASSISTANT_REDACTION_STATES)[number];

export const WORKPLACE_ASSISTANT_COMMAND_STATES = [
  'ACCEPTED',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export type WorkplaceAssistantCommandState = (typeof WORKPLACE_ASSISTANT_COMMAND_STATES)[number];

export type WorkplaceAssistantSelectionMode = 'SELECTED' | 'ALL';
export type WorkplaceAssistantGovernanceRedactionState = 'READY' | 'BLOCKED';
export type WorkplaceAssistantFeedbackRating = 'HELPFUL' | 'NOT_HELPFUL';

export type WorkplaceAssistantRequestedBookingItem = Readonly<{
  clientItemKey: string;
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  beneficiaryDisplayName: string;
  delegationGrantId: string | null;
  resourceType: WorkplaceResourceType;
  preferredResourceId: string | null;
  siteId: string | null;
  floorId: string | null;
  startsAt: string;
  endsAt: string;
  purpose: string | null;
  visibleToColleagues: boolean;
  accessibleOnly: boolean;
  requiredFeatures: readonly string[];
}>;

export type WorkplaceAssistantCreateInput = Readonly<{
  requestText: string;
  requestedItems: readonly WorkplaceAssistantRequestedBookingItem[];
  requestProcessingConsent: boolean;
  feedbackUseConsent: boolean;
  reason: string;
}>;

export type WorkplaceAssistantAlternative = Readonly<{
  resourceId: string;
  displayName: string;
  resourceType: WorkplaceResourceType;
  siteId: string;
  floorId: string;
  startsAt: string;
  endsAt: string;
  waitlistEligible: boolean;
  rationale: string;
}>;

export type WorkplaceAssistantProposal = Readonly<{
  proposalItemId: string;
  requestedItem: WorkplaceAssistantRequestedBookingItem;
  rationale: string;
  constraintsUsed: readonly string[];
  exclusions: readonly string[];
  policyResult: WorkplaceAssistantPolicyResult;
  conflicts: readonly string[];
  alternatives: readonly WorkplaceAssistantAlternative[];
  authoritativeIntentItemId: string | null;
  authoritativeIntentItemVersion: number | null;
  selectedResourceId: string | null;
  selectedResourceVersion: number | null;
  selectedResourceName: string | null;
  version: number;
}>;

export type WorkplaceAssistantAuthorityValidation = Readonly<{
  bookingIntentId: string;
  bookingIntentVersion: number;
  bookingIntentState: string;
  allSelectedItemsValid: boolean;
  validatedAt: string;
  limitations: readonly string[];
}>;

export type WorkplaceAssistantConsent = Readonly<{
  requestProcessingConsent: boolean;
  feedbackUseConsent: boolean;
  tenantOptIn: boolean;
  feedbackUseEnabled: boolean;
}>;

export type WorkplaceAssistantRequest = Readonly<{
  requestId: string;
  state: WorkplaceAssistantRequestState;
  redactedRequestText: string | null;
  redactionState: WorkplaceAssistantRedactionState;
  consent: WorkplaceAssistantConsent;
  modelProviderReference: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
  toolVersion: string | null;
  proposals: readonly WorkplaceAssistantProposal[];
  validation: WorkplaceAssistantAuthorityValidation | null;
  bookingBatchId: string | null;
  batchStatusHref: string | null;
  requeryRequired: boolean;
  lastResultCode: string | null;
  limitations: readonly string[];
  version: number;
  retentionExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkplaceAssistantValidateInput = Readonly<{
  expectedVersion: number;
  selectionMode: WorkplaceAssistantSelectionMode;
  selectedProposalItemIds: readonly string[];
  requestedHoldTtlSeconds: number | null;
  allowAlternatives: boolean;
  reason: string;
}>;

export type WorkplaceAssistantConfirmInput = Readonly<{
  expectedVersion: number;
  selectionMode: WorkplaceAssistantSelectionMode;
  selectedProposalItemIds: readonly string[];
  failurePolicy: WorkplaceBookingFailurePolicy;
  explicitConfirmation: boolean;
  reason: string;
}>;

export type WorkplaceAssistantExecution = Readonly<{
  requestId: string;
  state: WorkplaceAssistantRequestState;
  bookingIntentId: string;
  bookingBatchId: string;
  authoritativeBatch: WorkplaceBookingBatch;
  requeryRequired: boolean;
  recoveryGuidance: string | null;
  refreshedAt: string;
  requestVersion: number;
}>;

export type WorkplaceAssistantFeedbackInput = Readonly<{
  expectedVersion: number;
  rating: WorkplaceAssistantFeedbackRating;
  comment: string | null;
  allowModelImprovementUse: boolean;
  explicitConfirmation: boolean;
  reason: string;
}>;

export type WorkplaceAssistantFeedbackReceipt = Readonly<{
  feedbackId: string;
  requestId: string;
  rating: WorkplaceAssistantFeedbackRating;
  redactedComment: string | null;
  eligibleForModelImprovementUse: boolean;
  auditEventId: string;
  createdAt: string;
}>;

export type WorkplaceAssistantGovernance = Readonly<{
  tenantOptIn: boolean;
  killSwitch: boolean;
  modelProviderReference: string | null;
  modelVersion: string | null;
  promptVersion: string | null;
  toolVersion: string | null;
  retentionDays: number;
  feedbackUseEnabled: boolean;
  redactionState: WorkplaceAssistantGovernanceRedactionState;
  version: number;
  updatedAt: string | null;
  updatedBy: number | null;
}>;

export type WorkplaceAssistantGovernanceInput = Readonly<{
  expectedVersion: number;
  tenantOptIn: boolean;
  killSwitch: boolean;
  modelProviderReference: string;
  modelVersion: string;
  promptVersion: string;
  toolVersion: string;
  retentionDays: number;
  feedbackUseEnabled: boolean;
  redactionState: WorkplaceAssistantGovernanceRedactionState;
  explicitConfirmation: boolean;
  reason: string;
}>;

export type WorkplaceAssistantCommandReceipt = Readonly<{
  commandId: string;
  state: WorkplaceAssistantCommandState;
  statusHref: string;
  replayed: boolean;
  correlationId: string | null;
  resultCode: string | null;
  acceptedAt: string;
  completedAt: string | null;
}>;

export type WorkplaceAssistantCommandResult = Readonly<{
  request: WorkplaceAssistantRequest;
  receipt: WorkplaceAssistantCommandReceipt;
}>;

export type WorkplaceAssistantGovernanceCommandResult = Readonly<{
  governance: WorkplaceAssistantGovernance;
  receipt: WorkplaceAssistantCommandReceipt;
}>;

export type WorkplaceAssistantAuditEvent = Readonly<{
  auditEventId: string;
  requestId: string | null;
  eventType: string;
  actorUserId: number;
  metadata: Readonly<Record<string, unknown>>;
  correlationId: string | null;
  createdAt: string;
}>;

export type WorkplaceAssistantAuditEvents = Readonly<{
  items: readonly WorkplaceAssistantAuditEvent[];
  generatedAt: string;
}>;
