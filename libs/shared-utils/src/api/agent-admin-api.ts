import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type DwaionRetentionPolicy = {
  retentionDays: number;
  legalHold: boolean;
  policyVersion: number;
  updatedAt: string;
};

export type DwaionOperationsOverview = {
  periodDays: number;
  runCount: number;
  completedRunCount: number;
  failedRunCount: number;
  allowedRunCount: number;
  handedOffRunCount: number;
  deniedRunCount: number;
  groundedAnswerCount: number;
  abstainedAnswerCount: number;
  configurationRequiredCount: number;
  averageLatencyMs: number;
  totalTokens: number;
  activeUserCount: number;
  conversationCount: number;
  feedbackUpCount: number;
  feedbackDownCount: number;
  retention: DwaionRetentionPolicy;
  generatedAt: string;
};

export type UpdateDwaionRetentionPolicyRequest = {
  retentionDays?: number;
  legalHold?: boolean;
  expectedVersion: number;
  changeReason: string;
};

export type DwaionSourceKey =
  | 'WORK_ITEM'
  | 'MAIL'
  | 'CALENDAR'
  | 'APPROVAL_TASK'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_FORM'
  | 'APPROVAL_OPERATION';
export type DwaionDataClassification = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type DwaionSourceAccessMode = 'SOURCE_PERMISSIONS' | 'TENANT_ALLOWLIST' | 'BLOCKED';
export type DwaionConnectionState = 'CONNECTED' | 'DEGRADED' | 'NOT_CONFIGURED' | 'BLOCKED';
export type DwaionActionExecutionPolicy = 'USER_HANDOFF' | 'APPROVAL_HANDOFF' | 'BLOCKED';
export type DwaionPolicyOutcome = 'ALLOW' | 'HANDOFF' | 'DENY';

export type DwaionDataSourcePolicy = {
  sourceKey: DwaionSourceKey;
  displayName: string;
  description: string;
  providerType: string;
  classification: DwaionDataClassification;
  accessMode: DwaionSourceAccessMode;
  enabled: boolean;
  connectionState: DwaionConnectionState;
  connectorRef?: string | null;
  policyVersion: number;
  updatedAt: string;
};

export type UpdateDwaionDataSourcePolicyRequest = Pick<
  DwaionDataSourcePolicy,
  'enabled' | 'accessMode' | 'classification' | 'connectorRef'
> & {
  expectedVersion: number;
  changeReason: string;
};

export type DwaionActionPolicy = {
  actionKey: string;
  title: string;
  description: string;
  riskTier: 'L0' | 'L1' | 'L2' | 'L3';
  requiredPermission: string;
  enabled: boolean;
  confirmationRequired: boolean;
  executionPolicy: DwaionActionExecutionPolicy;
  policyVersion: number;
  updatedAt: string;
};

export type UpdateDwaionActionPolicyRequest = Pick<
  DwaionActionPolicy,
  'enabled' | 'confirmationRequired' | 'executionPolicy'
> & {
  expectedVersion: number;
  changeReason: string;
};

export type DwaionSafetyPolicy = {
  promptInjectionOutcome: DwaionPolicyOutcome;
  privilegedDataOutcome: DwaionPolicyOutcome;
  mutationOutcome: DwaionPolicyOutcome;
  requireCitations: boolean;
  publicWebEnabled: boolean;
  maxSourceScopes: number;
  maxToolCalls: number;
  policyVersion: number;
  updatedAt: string;
};

export type UpdateDwaionSafetyPolicyRequest = Pick<
  DwaionSafetyPolicy,
  | 'privilegedDataOutcome'
  | 'mutationOutcome'
  | 'requireCitations'
  | 'maxSourceScopes'
  | 'maxToolCalls'
> & {
  expectedVersion: number;
  changeReason: string;
};

export type DwaionEvaluationLifecycle = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type DwaionEvaluationRunState =
  'RUNNING' | 'COMPLETED' | 'CONFIGURATION_REQUIRED' | 'FAILED';
export type DwaionEvaluationSetSummary = {
  evaluationSetId: string;
  name: string;
  description?: string | null;
  locale: string;
  lifecycleState: DwaionEvaluationLifecycle;
  caseCount: number;
  latestRunState?: DwaionEvaluationRunState | null;
  latestPassRate?: number | null;
  version: number;
  updatedAt: string;
};
export type DwaionEvaluationCase = {
  evaluationCaseId: string;
  evaluationSetId: string;
  name: string;
  prompt: string;
  expectedTerms: string[];
  sourceScopes: DwaionSourceKey[];
  version: number;
  createdAt: string;
};
export type DwaionEvaluationSetDetail = {
  summary: DwaionEvaluationSetSummary;
  cases: DwaionEvaluationCase[];
};
export type DwaionEvaluationResult = {
  evaluationCaseId: string;
  caseName: string;
  outcome: 'PASS' | 'FAIL' | 'CONFIGURATION_REQUIRED';
  statusCode: string;
  grounded: boolean;
  expectedTermsMatched: number;
  expectedTermsTotal: number;
  latencyMs: number;
};
export type DwaionEvaluationRun = {
  evaluationRunId: string;
  evaluationSetId: string;
  runState: DwaionEvaluationRunState;
  caseCount: number;
  passedCount: number;
  failedCount: number;
  configurationRequiredCount: number;
  modelRef?: string | null;
  results: DwaionEvaluationResult[];
  createdAt: string;
  completedAt?: string | null;
};
export type DwaionEvaluationRunSummary = Omit<DwaionEvaluationRun, 'results'> & {
  passRate?: number | null;
};

export type DwaionGovernanceAuditEvent = {
  eventId: string;
  category: 'SOURCE' | 'ACTION' | 'SAFETY' | 'EVALUATION' | 'RETENTION';
  eventType: string;
  targetType: string;
  targetKey: string;
  actorUserId: string;
  correlationId: string;
  changeReason?: string | null;
  createdAt: string;
};
export type DwaionGovernanceAuditPage = {
  content: DwaionGovernanceAuditEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type DwaionGateEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type DwaionGateCategory =
  'AI_RUNTIME' | 'CONNECTIVITY' | 'ACCESS_CONTROL' | 'ASSURANCE' | 'DATA_PROTECTION' | 'OPERATIONS';
export type DwaionGateKey =
  | 'MODEL_CREDENTIALS'
  | 'MODEL_LIFECYCLE_CAPACITY'
  | 'NETWORK_ISOLATION'
  | 'DATA_PROCESSING_LOCATION'
  | 'SOURCE_CONNECTORS'
  | 'SOURCE_ACL'
  | 'DATA_CLASSIFICATION_DLP'
  | 'EVALUATION_DATASET'
  | 'RELEASE_APPROVAL'
  | 'ACTION_APPROVAL'
  | 'TENANT_KMS'
  | 'RETENTION_LEGAL_HOLD'
  | 'AUDIT_RESILIENCE';
export type DwaionGateStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURING'
  | 'VALIDATING'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'BLOCKED'
  | 'EXPIRED';
export type DwaionGateEvidenceType =
  | 'CONFIGURATION_REFERENCE'
  | 'TEST_RESULT'
  | 'SECURITY_REVIEW'
  | 'LEGAL_APPROVAL'
  | 'BUSINESS_APPROVAL'
  | 'RUNBOOK'
  | 'OTHER';
export type DwaionOperationalGate = {
  gateKey: DwaionGateKey;
  category: DwaionGateCategory;
  externalOwner: string;
  deliveryCritical: boolean;
  selectedOption?: string | null;
  options: { code: string; recommended: boolean }[];
  requiredEvidenceTypes: DwaionGateEvidenceType[];
  status: DwaionGateStatus;
  ownerUserId?: string | null;
  configurationRef?: string | null;
  notes?: string | null;
  validationSummary?: string | null;
  lastConfiguredBy?: string | null;
  lastValidatedBy?: string | null;
  approvedBy?: string | null;
  evidenceCount: number;
  policyVersion: number;
  effectiveAt?: string | null;
  expiresAt?: string | null;
  updatedAt: string;
};
export type DwaionOperationalGateEvidence = {
  evidenceId: string;
  evidenceType: DwaionGateEvidenceType;
  title: string;
  reference: string;
  checksumSha256?: string | null;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
};
export type DwaionOperationalGateDetail = {
  gate: DwaionOperationalGate;
  evidence: DwaionOperationalGateEvidence[];
};
export type DwaionOperationalGatePortfolio = {
  environment: DwaionGateEnvironment;
  totalCount: number;
  requiredCount: number;
  approvedCount: number;
  readyForApprovalCount: number;
  blockedCount: number;
  expiredCount: number;
  completionPercent: number;
  deliveryReady: boolean;
  gates: DwaionOperationalGate[];
};

export async function getDwaionOperationsOverview(
  periodDays = 30
): Promise<DwaionOperationsOverview> {
  const response = await axiosInstance.get<ApiResponse<DwaionOperationsOverview>>(
    `/api/agent/v1/admin/overview?period_days=${Math.max(1, Math.min(periodDays, 90))}`
  );
  return response.data.data;
}

export async function getDwaionRetentionPolicy(): Promise<DwaionRetentionPolicy> {
  const response = await axiosInstance.get<ApiResponse<DwaionRetentionPolicy>>(
    '/api/agent/v1/admin/retention'
  );
  return response.data.data;
}

export async function updateDwaionRetentionPolicy(
  request: UpdateDwaionRetentionPolicyRequest
): Promise<DwaionRetentionPolicy> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionRetentionPolicy>,
    UpdateDwaionRetentionPolicyRequest
  >('/api/agent/v1/admin/retention', request);
  return response.data.data;
}

export async function getDwaionDataSourcePolicies(): Promise<DwaionDataSourcePolicy[]> {
  const response = await axiosInstance.get<ApiResponse<DwaionDataSourcePolicy[]>>(
    '/api/agent/v1/admin/sources'
  );
  return response.data.data;
}

export async function updateDwaionDataSourcePolicy(
  sourceKey: DwaionSourceKey,
  request: UpdateDwaionDataSourcePolicyRequest
): Promise<DwaionDataSourcePolicy> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionDataSourcePolicy>,
    UpdateDwaionDataSourcePolicyRequest
  >(`/api/agent/v1/admin/sources/${encodeURIComponent(sourceKey)}`, request);
  return response.data.data;
}

export async function getDwaionActionPolicies(): Promise<DwaionActionPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<DwaionActionPolicy[]>>(
    '/api/agent/v1/admin/actions'
  );
  return response.data.data;
}

export async function updateDwaionActionPolicy(
  actionKey: string,
  request: UpdateDwaionActionPolicyRequest
): Promise<DwaionActionPolicy> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionActionPolicy>,
    UpdateDwaionActionPolicyRequest
  >(`/api/agent/v1/admin/actions/${encodeURIComponent(actionKey)}`, request);
  return response.data.data;
}

export async function getDwaionSafetyPolicy(): Promise<DwaionSafetyPolicy> {
  const response = await axiosInstance.get<ApiResponse<DwaionSafetyPolicy>>(
    '/api/agent/v1/admin/safety'
  );
  return response.data.data;
}

export async function updateDwaionSafetyPolicy(
  request: UpdateDwaionSafetyPolicyRequest
): Promise<DwaionSafetyPolicy> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionSafetyPolicy>,
    UpdateDwaionSafetyPolicyRequest
  >('/api/agent/v1/admin/safety', request);
  return response.data.data;
}

export async function listDwaionEvaluationSets(): Promise<DwaionEvaluationSetSummary[]> {
  const response = await axiosInstance.get<ApiResponse<DwaionEvaluationSetSummary[]>>(
    '/api/agent/v1/admin/evaluations'
  );
  return response.data.data;
}

export async function getDwaionEvaluationSet(
  evaluationSetId: string
): Promise<DwaionEvaluationSetDetail> {
  const response = await axiosInstance.get<ApiResponse<DwaionEvaluationSetDetail>>(
    `/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}`
  );
  return response.data.data;
}

export async function createDwaionEvaluationSet(request: {
  name: string;
  description?: string;
  locale: string;
}): Promise<DwaionEvaluationSetDetail> {
  const response = await axiosInstance.post<ApiResponse<DwaionEvaluationSetDetail>, typeof request>(
    '/api/agent/v1/admin/evaluations',
    request
  );
  return response.data.data;
}

export async function addDwaionEvaluationCase(
  evaluationSetId: string,
  request: {
    name: string;
    prompt: string;
    expectedTerms: string[];
    sourceScopes: DwaionSourceKey[];
  }
): Promise<DwaionEvaluationSetDetail> {
  const response = await axiosInstance.post<ApiResponse<DwaionEvaluationSetDetail>, typeof request>(
    `/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/cases`,
    request
  );
  return response.data.data;
}

export async function transitionDwaionEvaluationSet(
  evaluationSetId: string,
  request: {
    lifecycleState: Exclude<DwaionEvaluationLifecycle, 'DRAFT'>;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionEvaluationSetDetail> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionEvaluationSetDetail>,
    typeof request
  >(`/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/lifecycle`, request);
  return response.data.data;
}

export async function runDwaionEvaluation(evaluationSetId: string): Promise<DwaionEvaluationRun> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionEvaluationRun>,
    Record<string, never>
  >(`/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/runs`, {});
  return response.data.data;
}

export async function listDwaionEvaluationRuns(
  evaluationSetId: string,
  limit = 20
): Promise<DwaionEvaluationRunSummary[]> {
  const response = await axiosInstance.get<ApiResponse<DwaionEvaluationRunSummary[]>>(
    `/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/runs?limit=${Math.max(1, Math.min(limit, 50))}`
  );
  return response.data.data;
}

export async function getDwaionEvaluationRun(
  evaluationSetId: string,
  evaluationRunId: string
): Promise<DwaionEvaluationRun> {
  const response = await axiosInstance.get<ApiResponse<DwaionEvaluationRun>>(
    `/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/runs/${encodeURIComponent(evaluationRunId)}`
  );
  return response.data.data;
}

export async function exportDwaionEvaluationRun(
  evaluationSetId: string,
  evaluationRunId: string
): Promise<Blob> {
  const response = await axiosInstance.get<Blob>(
    `/api/agent/v1/admin/evaluations/${encodeURIComponent(evaluationSetId)}/runs/${encodeURIComponent(evaluationRunId)}/export`,
    { responseType: 'blob' }
  );
  return response.data;
}

export async function listDwaionGovernanceAudit(options?: {
  category?: string;
  query?: string;
  page?: number;
  size?: number;
}): Promise<DwaionGovernanceAuditPage> {
  const search = new URLSearchParams({
    page: String(options?.page ?? 0),
    size: String(options?.size ?? 50),
  });
  if (options?.category) search.set('category', options.category);
  if (options?.query?.trim()) search.set('query', options.query.trim());
  const response = await axiosInstance.get<ApiResponse<DwaionGovernanceAuditPage>>(
    `/api/agent/v1/admin/audit?${search.toString()}`
  );
  return response.data.data;
}

export async function exportDwaionGovernanceAudit(options?: {
  category?: string;
  query?: string;
}): Promise<Blob> {
  const search = new URLSearchParams();
  if (options?.category) search.set('category', options.category);
  if (options?.query?.trim()) search.set('query', options.query.trim());
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<Blob>(`/api/agent/v1/admin/audit/export${suffix}`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function getDwaionOperationalGatePortfolio(
  environment: DwaionGateEnvironment
): Promise<DwaionOperationalGatePortfolio> {
  const response = await axiosInstance.get<ApiResponse<DwaionOperationalGatePortfolio>>(
    `/api/agent/v1/admin/gates?environment=${environment}`
  );
  return response.data.data;
}

export async function getDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.get<ApiResponse<DwaionOperationalGateDetail>>(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}?environment=${environment}`
  );
  return response.data.data;
}

export async function configureDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    selectedOption: string;
    ownerUserId: string;
    configurationRef?: string;
    notes?: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(`/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}?environment=${environment}`, request);
  return response.data.data;
}

export async function addDwaionOperationalGateEvidence(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    evidenceType: DwaionGateEvidenceType;
    title: string;
    reference: string;
    checksumSha256?: string;
    notes?: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/evidence?environment=${environment}`,
    request
  );
  return response.data.data;
}

export async function validateDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    outcome: 'PASS' | 'FAIL';
    validationSummary: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/validation?environment=${environment}`,
    request
  );
  return response.data.data;
}

export async function decideDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    decision: 'APPROVE' | 'REJECT';
    validDays: number;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/decision?environment=${environment}`,
    request
  );
  return response.data.data;
}
