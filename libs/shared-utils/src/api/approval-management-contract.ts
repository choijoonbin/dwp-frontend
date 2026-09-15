export type ApprovalTaskStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INFO_REQUESTED'
  | 'REASSIGNED'
  | 'SKIPPED'
  | 'CANCELLED';

export type ApprovalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ApprovalTask = {
  taskId: string;
  requestId: string;
  requestNumber: string;
  title: string;
  summary: string;
  workflowNameKo: string;
  workflowNameEn: string;
  stepKey: string;
  stepName: string;
  stepSequence: number;
  requesterName?: string | null;
  requesterOrgName?: string | null;
  status: ApprovalTaskStatus;
  priority: ApprovalPriority;
  dataClassification: string;
  riskScore: number;
  submittedAt?: string | null;
  dueAt?: string | null;
  version: number;
};

export type ApprovalAdminPulse = {
  publishedWorkflows: number;
  draftWorkflows: number;
  activeRequests: number;
  overdueTasks: number;
  failedIntegrations: number;
  assurance: Array<{
    key: 'identity' | 'segregation' | 'evidence' | 'delivery';
    state: 'ENFORCED' | 'ATTENTION';
    exceptions: number;
  }>;
  trend?: {
    generatedAt: string;
    windowHours: number;
    bucketHours: number;
    buckets: Array<{
      startsAt: string;
      endsAt: string;
      submittedRequests: number;
      completedRequests: number;
      slaBreaches: number;
      unresolvedDeliveryUpdates: number;
      inFlightRequests: number;
      slaEligibleTasks: number;
    }>;
  };
};

export type ApprovalWorkflow = {
  workflowId: string;
  workflowKey: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  category: string;
  dataClassification: string;
  lifecycleState: string;
  currentVersion: number;
  slaMinutes: number;
  allowSelfApproval: boolean;
  ownerGroupRef?: string | null;
  version: number;
  updatedAt: string;
};

export type ApprovalWorkflowStep = {
  key: string;
  name: string;
  mode: 'ANY';
  candidateRole: string;
  slaMinutes: number;
};

export type ApprovalWorkflowDetail = {
  workflow: ApprovalWorkflow;
  definition: {
    schemaVersion: number;
    steps: ApprovalWorkflowStep[];
    guardrails: Record<string, unknown>;
  };
  definitionHash: string;
};

export type ApprovalForm = {
  formId: string;
  formKey: string;
  categoryId: string;
  categoryKey: string;
  categoryNameKo: string;
  categoryNameEn: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef?: string | null;
  formKind: 'REQUEST' | 'DOCUMENT' | 'SIGNATURE';
  lifecycleState: string;
  currentVersion: number;
  fieldCount: number;
  routeCount: number;
  usageCount: number;
  version: number;
  updatedAt: string;
};

export type ApprovalFormCategory = {
  categoryId: string;
  categoryKey: string;
  parentCategoryId?: string | null;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  iconKey: string;
  sortOrder: number;
  lifecycleState: 'ACTIVE' | 'INACTIVE';
  formCount: number;
  version: number;
};

export type ApprovalFormRoute = {
  bindingId: string;
  workflowId: string;
  workflowKey: string;
  workflowNameKo: string;
  workflowNameEn: string;
  workflowLifecycleState: string;
  workflowVersion: number;
  slaMinutes: number;
  bindingType: 'DEFAULT' | 'CONDITIONAL';
  priority: number;
};

export type ApprovalFormField = {
  key: string;
  labelKo?: string;
  labelEn?: string;
  helpKo?: string;
  helpEn?: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'USER';
  required: boolean;
  options?: string[];
};

export type ApprovalLegacyFormSchema = {
  schemaContract?: never;
  schemaVersion: number;
  fields: ApprovalFormField[];
};

export type ApprovalFormSchema = ApprovalLegacyFormSchema | ApprovalTypedFormSchema;

export function isApprovalTypedFormSchema(
  schema: ApprovalFormSchema
): schema is ApprovalTypedFormSchema {
  return schema.schemaContract === APPROVAL_TYPED_FORM_CONTRACT && schema.schemaVersion === 2;
}

export function assertSupportedApprovalFormSchema(schema: ApprovalFormSchema): void {
  if (!schema || !Array.isArray(schema.fields)) throw new Error('Invalid approval form schema');
  if (schema.schemaContract !== undefined) {
    if (!isApprovalTypedFormSchema(schema)) throw new Error('Unsupported approval form schema');
  } else if (schema.schemaVersion !== 1 && schema.schemaVersion !== 2) {
    throw new Error('Unsupported approval form schema');
  }
}

export type ApprovalFormDetail = {
  form: ApprovalForm;
  schema: ApprovalFormSchema;
  schemaHash: string;
  formVersionId?: string | null;
  routes: ApprovalFormRoute[];
};

export type ApprovalPolicy = {
  policyId: string;
  policyKey: string;
  nameKo: string;
  nameEn: string;
  policyType: string;
  enforcementMode: string;
  severity: string;
  lifecycleState: string;
  rule: Record<string, unknown>;
  version: number;
  pendingReview: boolean;
  pendingEnforcementMode?: string | null;
  pendingSeverity?: string | null;
  pendingLifecycleState?: string | null;
  pendingRule: Record<string, unknown>;
  pendingChangeReason?: string | null;
  pendingBy?: number | null;
  pendingAt?: string | null;
};

export type ApprovalPolicyVersion = {
  policyVersionId: string;
  versionNumber: number;
  enforcementMode: string;
  severity: string;
  lifecycleState: string;
  rule: Record<string, unknown>;
  changeReason: string;
  submittedBy?: number | null;
  submittedAt?: string | null;
  publishedBy?: number | null;
  publishedAt: string;
  reviewComment: string;
};

export type ApprovalOperationSignal = {
  key: string;
  state: string;
  titleKo: string;
  titleEn: string;
  detailKo: string;
  detailEn: string;
  count: number;
};

export type ApprovalIntegrationDelivery = {
  outboxId: string;
  eventId: string;
  requestId?: string | null;
  eventType: string;
  status: string;
  attemptCount: number;
  manualRetryCount: number;
  version: number;
  availableAt: string;
  publishedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  lastRetriedAt?: string | null;
  retryEligibility?: ApprovalIntegrationRetryEligibility;
};

export type ApprovalIntegrationRetryEligibilityReason =
  | 'ELIGIBLE'
  | 'STATUS_NOT_RETRYABLE'
  | 'AUDITOR_ASSIGNMENT_NOT_READY'
  | 'SCOPE_EVIDENCE_MISMATCH'
  | 'RECOVERY_EVIDENCE_INCOMPLETE'
  | 'SEPARATION_OF_DUTIES';

export type ApprovalIntegrationRetryEligibility = {
  eligible: boolean;
  reason: ApprovalIntegrationRetryEligibilityReason;
  expectedVersion: number;
  evaluatedAt: string;
};

export type ApprovalOperations = {
  generatedAt: string;
  signals: ApprovalOperationSignal[];
  breachedTasks: ApprovalTask[];
  integrationDeliveries: ApprovalIntegrationDelivery[];
};

export type ApprovalSignatureProvider = {
  providerId: string;
  providerKey: string;
  displayName: string;
  providerType: string;
  lifecycleState: string;
  capabilities: ApprovalSignatureCapabilities;
  credentialConfigured: boolean;
  lastHealthCheckedAt?: string | null;
  version: number;
};

export type ApprovalSignatureReadiness =
  | 'READY'
  | 'DISABLED'
  | 'DEGRADED'
  | 'CONFIGURATION_REQUIRED'
  | 'NOT_VERIFIED'
  | 'EXTERNAL_VERIFICATION_REQUIRED';

export type ApprovalSignatureCapabilities = {
  internalAttestation?: boolean;
  auditEvidence?: boolean;
  verifiedIdentity?: boolean;
  remoteSigningSupported?: boolean;
  readiness?: ApprovalSignatureReadiness;
};
import { APPROVAL_TYPED_FORM_CONTRACT } from './approval-form-typed-contract';

import type { ApprovalTypedFormSchema } from './approval-form-typed-contract';

export type * from './approval-form-typed-contract';
