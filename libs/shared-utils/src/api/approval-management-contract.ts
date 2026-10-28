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

export type ApprovalWorkflowOversightProjection = Pick<
  ApprovalWorkflow,
  | 'workflowId'
  | 'workflowKey'
  | 'nameKo'
  | 'nameEn'
  | 'category'
  | 'dataClassification'
  | 'lifecycleState'
  | 'currentVersion'
  | 'slaMinutes'
  | 'version'
  | 'updatedAt'
>;

export type ApprovalWorkflowListProjection = ApprovalWorkflow | ApprovalWorkflowOversightProjection;
export type ApprovalWorkflowReadProjection =
  ApprovalWorkflowDetail | ApprovalWorkflowOversightProjection;

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

export type ApprovalFormOversightProjection = Pick<
  ApprovalForm,
  | 'formId'
  | 'formKey'
  | 'categoryId'
  | 'categoryKey'
  | 'categoryNameKo'
  | 'categoryNameEn'
  | 'nameKo'
  | 'nameEn'
  | 'formKind'
  | 'lifecycleState'
  | 'currentVersion'
  | 'fieldCount'
  | 'routeCount'
  | 'usageCount'
  | 'version'
  | 'updatedAt'
>;

export type ApprovalFormReadProjection = ApprovalFormDetail | ApprovalFormOversightProjection;

const approvalFormProjectionStringFields = [
  'formId',
  'formKey',
  'categoryId',
  'categoryKey',
  'categoryNameKo',
  'categoryNameEn',
  'nameKo',
  'nameEn',
  'formKind',
  'lifecycleState',
  'updatedAt',
] as const;
const approvalFormProjectionNumberFields = [
  'currentVersion',
  'fieldCount',
  'routeCount',
  'usageCount',
  'version',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const approvalWorkflowProjectionStringFields = [
  'workflowId',
  'workflowKey',
  'nameKo',
  'nameEn',
  'category',
  'dataClassification',
  'lifecycleState',
  'updatedAt',
] as const;
const approvalWorkflowProjectionNumberFields = ['currentVersion', 'slaMinutes', 'version'] as const;

function hasApprovalWorkflowProjectionFields(
  value: unknown
): value is ApprovalWorkflowOversightProjection {
  if (!isRecord(value)) return false;
  return (
    approvalWorkflowProjectionStringFields.every((key) => typeof value[key] === 'string') &&
    approvalWorkflowProjectionNumberFields.every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key])
    )
  );
}

export function isApprovalWorkflowOversightProjection(
  value: unknown
): value is ApprovalWorkflowOversightProjection {
  return hasApprovalWorkflowProjectionFields(value);
}

function isApprovalWorkflow(value: unknown): value is ApprovalWorkflow {
  if (!hasApprovalWorkflowProjectionFields(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  return (
    typeof record.descriptionKo === 'string' &&
    typeof record.descriptionEn === 'string' &&
    typeof record.allowSelfApproval === 'boolean' &&
    (record.ownerGroupRef === undefined ||
      record.ownerGroupRef === null ||
      typeof record.ownerGroupRef === 'string')
  );
}

function isApprovalWorkflowStep(value: unknown): value is ApprovalWorkflowStep {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    value.mode === 'ANY' &&
    typeof value.candidateRole === 'string' &&
    typeof value.slaMinutes === 'number' &&
    Number.isFinite(value.slaMinutes)
  );
}

function isApprovalTypedWorkflowStage(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.quorum) || !Array.isArray(value.predecessors)) {
    return false;
  }
  const quorum = value.quorum;
  const quorumValid =
    quorum.mode === 'ANY' ||
    quorum.mode === 'ALL' ||
    ((quorum.mode === 'COUNT' || quorum.mode === 'PERCENT') &&
      typeof quorum.value === 'number' &&
      Number.isSafeInteger(quorum.value));
  return (
    typeof value.key === 'string' &&
    typeof value.name === 'string' &&
    typeof value.candidateRole === 'string' &&
    typeof value.slaMinutes === 'number' &&
    Number.isFinite(value.slaMinutes) &&
    value.predecessors.every((key) => typeof key === 'string') &&
    quorumValid &&
    (value.routeCondition === undefined || isRecord(value.routeCondition))
  );
}

function isApprovalWorkflowDefinition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ('schemaContract' in value) {
    return (
      value.schemaContract === 'DWP_APPROVAL_WORKFLOW_QUORUM_V2' &&
      value.schemaVersion === 2 &&
      typeof value.slaMinutes === 'number' &&
      Number.isFinite(value.slaMinutes) &&
      Array.isArray(value.stages) &&
      value.stages.length > 0 &&
      value.stages.every(isApprovalTypedWorkflowStage)
    );
  }
  return (
    typeof value.schemaVersion === 'number' &&
    Number.isFinite(value.schemaVersion) &&
    Array.isArray(value.steps) &&
    value.steps.every(isApprovalWorkflowStep) &&
    isRecord(value.guardrails)
  );
}

export function isApprovalWorkflowDetailProjection(
  value: unknown
): value is ApprovalWorkflowDetail {
  return (
    isRecord(value) &&
    isApprovalWorkflow(value.workflow) &&
    isApprovalWorkflowDefinition(value.definition) &&
    typeof value.definitionHash === 'string' &&
    /^[0-9a-f]{64}$/.test(value.definitionHash)
  );
}

function hasApprovalFormProjectionFields(value: unknown): value is ApprovalFormOversightProjection {
  if (!isRecord(value)) return false;
  return (
    approvalFormProjectionStringFields.every((key) => typeof value[key] === 'string') &&
    approvalFormProjectionNumberFields.every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key])
    ) &&
    (value.formKind === 'REQUEST' ||
      value.formKind === 'DOCUMENT' ||
      value.formKind === 'SIGNATURE')
  );
}

export function isApprovalFormOversightProjection(
  value: unknown
): value is ApprovalFormOversightProjection {
  return hasApprovalFormProjectionFields(value);
}

function isApprovalForm(value: unknown): value is ApprovalForm {
  if (!hasApprovalFormProjectionFields(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  return (
    typeof record.descriptionKo === 'string' &&
    typeof record.descriptionEn === 'string' &&
    (record.ownerGroupRef === undefined ||
      record.ownerGroupRef === null ||
      typeof record.ownerGroupRef === 'string')
  );
}

function isApprovalFormRoute(value: unknown): value is ApprovalFormRoute {
  if (!isRecord(value)) return false;
  return (
    ['bindingId', 'workflowId', 'workflowKey', 'workflowNameKo', 'workflowNameEn'].every(
      (key) => typeof value[key] === 'string'
    ) &&
    typeof value.workflowLifecycleState === 'string' &&
    typeof value.workflowVersion === 'number' &&
    typeof value.slaMinutes === 'number' &&
    (value.bindingType === 'DEFAULT' || value.bindingType === 'CONDITIONAL') &&
    typeof value.priority === 'number'
  );
}

export function isApprovalFormDetailProjection(value: unknown): value is ApprovalFormDetail {
  if (!isRecord(value) || !isApprovalForm(value.form) || !isRecord(value.schema)) return false;
  if (
    !Array.isArray(value.schema.fields) ||
    typeof value.schemaHash !== 'string' ||
    value.schemaHash.length === 0 ||
    !Array.isArray(value.routes) ||
    !value.routes.every(isApprovalFormRoute)
  ) {
    return false;
  }
  return (
    value.formVersionId === undefined ||
    value.formVersionId === null ||
    typeof value.formVersionId === 'string'
  );
}

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
