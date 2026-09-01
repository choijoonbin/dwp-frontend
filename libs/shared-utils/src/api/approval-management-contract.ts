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

export type ApprovalFormSchema = {
  schemaVersion: number;
  fields: ApprovalFormField[];
};

export type ApprovalFormDetail = {
  form: ApprovalForm;
  schema: ApprovalFormSchema;
  schemaHash: string;
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
  capabilities: Record<string, unknown>;
  credentialConfigured: boolean;
  lastHealthCheckedAt?: string | null;
  version: number;
};
