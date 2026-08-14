import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ApprovalTaskStatus =
  | 'PENDING'
  | 'CLAIMED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INFO_REQUESTED'
  | 'REASSIGNED'
  | 'SKIPPED'
  | 'CANCELLED';
export type ApprovalRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';
export type ApprovalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ApprovalMetrics = {
  pending: number;
  dueToday: number;
  overdue: number;
  needsInformation: number;
  myRequestsInFlight: number;
  averageCycleHours: number;
  slaCompliancePercent: number;
};

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

export type ApprovalTimelineEvent = {
  eventId: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  outcome: string;
  message?: string | null;
  occurredAt: string;
};

export type ApprovalTaskDetail = {
  task: ApprovalTask;
  payload: Record<string, unknown>;
  timeline: ApprovalTimelineEvent[];
  canClaim: boolean;
  canDecide: boolean;
  selfApprovalBlocked: boolean;
};

export type ApprovalRequest = {
  requestId: string;
  requestNumber: string;
  title: string;
  summary: string;
  workflowNameKo: string;
  workflowNameEn: string;
  currentStepKey?: string | null;
  currentStepName?: string | null;
  currentStepSequence?: number | null;
  totalSteps: number;
  status: ApprovalRequestStatus;
  priority: ApprovalPriority;
  dataClassification: string;
  latestInformationRequest?: string | null;
  submittedAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  version: number;
};

export type ApprovalRequestDetail = {
  request: ApprovalRequest;
  workflowId: string;
  payload: Record<string, unknown>;
};

export type ApprovalStageMetric = { stage: string; count: number; atRisk: number };
export type ApprovalInsight = {
  key: string;
  tone: string;
  titleKo: string;
  titleEn: string;
  detailKo: string;
  detailEn: string;
  route: string;
};
export type ApprovalAdminPulse = {
  publishedWorkflows: number;
  draftWorkflows: number;
  activeRequests: number;
  overdueTasks: number;
  failedIntegrations: number;
};
export type ApprovalHome = {
  generatedAt: string;
  metrics: ApprovalMetrics;
  focusQueue: ApprovalTask[];
  recentRequests: ApprovalRequest[];
  flow: ApprovalStageMetric[];
  insights: ApprovalInsight[];
  administrator: boolean;
  adminPulse?: ApprovalAdminPulse | null;
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
  nameKo: string;
  nameEn: string;
  lifecycleState: string;
  currentVersion: number;
  fieldCount: number;
  version: number;
  updatedAt: string;
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
export type ApprovalFormDetail = {
  form: ApprovalForm;
  schema: {
    schemaVersion: number;
    fields: ApprovalFormField[];
  };
  schemaHash: string;
};
export type ApprovalRequestTemplate = {
  workflow: ApprovalWorkflow;
  form: ApprovalFormDetail;
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
export type ApprovalOperations = {
  generatedAt: string;
  signals: ApprovalOperationSignal[];
  breachedTasks: ApprovalTask[];
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
export type ApprovalDelegation = {
  delegationId: string;
  delegatorUserId: number;
  delegateUserId: number;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowKey?: string | null;
  startsAt: string;
  endsAt: string;
  lifecycleState: string;
  reason: string;
  version: number;
};

const base = '/api/approvals/v1';

export async function getApprovalHome(): Promise<ApprovalHome> {
  const response = await axiosInstance.get<ApiResponse<ApprovalHome>>(`${base}/home`);
  return response.data.data;
}
export async function getApprovalTasks(view = 'INBOX'): Promise<ApprovalTask[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalTask[]>>(
    `${base}/tasks?view=${encodeURIComponent(view)}`
  );
  return response.data.data;
}
export async function getApprovalTask(taskId: string): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalTaskDetail>>(
    `${base}/tasks/${taskId}`
  );
  return response.data.data;
}
export async function decideApprovalTask(
  taskId: string,
  input: {
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
    comment?: string;
    expectedVersion: number;
  }
): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.post<ApiResponse<ApprovalTaskDetail>, typeof input>(
    `${base}/tasks/${taskId}/decisions`,
    input
  );
  return response.data.data;
}
export async function getApprovalRequests(view = 'SUBMITTED'): Promise<ApprovalRequest[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequest[]>>(
    `${base}/requests?view=${encodeURIComponent(view)}`
  );
  return response.data.data;
}
export async function getApprovalRequest(requestId: string): Promise<ApprovalRequest> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequest>>(
    `${base}/requests/${requestId}`
  );
  return response.data.data;
}
export async function getApprovalRequestDetail(requestId: string): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestDetail>>(
    `${base}/requests/${requestId}/detail`
  );
  return response.data.data;
}
export async function createApprovalRequest(input: {
  workflowId: string;
  title: string;
  summary: string;
  priority: ApprovalPriority;
  payload: Record<string, unknown>;
}): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<ApiResponse<ApprovalRequest>, typeof input>(
    `${base}/requests`,
    input
  );
  return response.data.data;
}
export async function updateApprovalDraft(
  requestId: string,
  input: {
    workflowId: string;
    title: string;
    summary: string;
    priority: ApprovalPriority;
    payload: Record<string, unknown>;
    expectedVersion: number;
  }
): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.put<ApiResponse<ApprovalRequestDetail>, typeof input>(
    `${base}/requests/${requestId}/draft`,
    input
  );
  return response.data.data;
}
export async function submitApprovalRequest(
  requestId: string,
  expectedVersion: number
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { expectedVersion: number }
  >(`${base}/requests/${requestId}/submit`, { expectedVersion });
  return response.data.data;
}
export async function respondToApprovalInformationRequest(
  requestId: string,
  message: string,
  expectedVersion: number
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { message: string; expectedVersion: number }
  >(`${base}/requests/${requestId}/information-response`, { message, expectedVersion });
  return response.data.data;
}
export async function withdrawApprovalRequest(
  requestId: string,
  expectedVersion: number
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { expectedVersion: number }
  >(`${base}/requests/${requestId}/withdraw`, { expectedVersion });
  return response.data.data;
}
export async function getPublishedApprovalWorkflows(): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflow[]>>(
    `${base}/workflows/published`
  );
  return response.data.data;
}
export async function getPublishedApprovalWorkflowTemplate(
  workflowId: string
): Promise<ApprovalRequestTemplate> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestTemplate>>(
    `${base}/workflows/published/${workflowId}/template`
  );
  return response.data.data;
}
export async function getApprovalDelegations(): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalDelegation[]>>(
    `${base}/delegations`
  );
  return response.data.data;
}
export async function createApprovalDelegation(input: {
  delegateUserId: number;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowKey?: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.post<ApiResponse<ApprovalDelegation[]>, typeof input>(
    `${base}/delegations`,
    input
  );
  return response.data.data;
}
export async function getApprovalAdminOverview(): Promise<ApprovalAdminPulse> {
  const response = await axiosInstance.get<ApiResponse<ApprovalAdminPulse>>(
    `${base}/admin/overview`
  );
  return response.data.data;
}
export async function getApprovalWorkflows(): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflow[]>>(
    `${base}/admin/workflows`
  );
  return response.data.data;
}
export async function getApprovalWorkflow(workflowId: string): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflowDetail>>(
    `${base}/admin/workflows/${workflowId}`
  );
  return response.data.data;
}
export type ApprovalWorkflowDraftInput = {
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  category: string;
  dataClassification: string;
  slaMinutes: number;
  ownerGroupRef: string;
  steps: ApprovalWorkflowStep[];
};
export async function createApprovalWorkflowDraft(
  input: ApprovalWorkflowDraftInput & { workflowKey: string }
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalWorkflowDetail>,
    ApprovalWorkflowDraftInput & { workflowKey: string }
  >(`${base}/admin/workflows`, input);
  return response.data.data;
}
export async function updateApprovalWorkflowDraft(
  workflowId: string,
  input: ApprovalWorkflowDraftInput & { expectedVersion: number }
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalWorkflowDetail>,
    ApprovalWorkflowDraftInput & { expectedVersion: number }
  >(`${base}/admin/workflows/${workflowId}/draft`, input);
  return response.data.data;
}
export async function publishApprovalWorkflow(
  workflowId: string,
  expectedVersion: number
): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalWorkflow[]>,
    { expectedVersion: number }
  >(`${base}/admin/workflows/${workflowId}/publish`, { expectedVersion });
  return response.data.data;
}
export async function getApprovalForms(): Promise<ApprovalForm[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalForm[]>>(`${base}/admin/forms`);
  return response.data.data;
}
export async function getApprovalForm(formId: string): Promise<ApprovalFormDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalFormDetail>>(
    `${base}/admin/forms/${formId}`
  );
  return response.data.data;
}
export async function updateApprovalFormDraft(
  formId: string,
  input: {
    nameKo: string;
    nameEn: string;
    fields: ApprovalFormField[];
    expectedVersion: number;
  }
): Promise<ApprovalFormDetail> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalFormDetail>,
    {
      nameKo: string;
      nameEn: string;
      fields: ApprovalFormField[];
      expectedVersion: number;
    }
  >(`${base}/admin/forms/${formId}/draft`, input);
  return response.data.data;
}
export async function getApprovalPolicies(): Promise<ApprovalPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalPolicy[]>>(`${base}/admin/policies`);
  return response.data.data;
}
export async function updateApprovalPolicy(
  policyId: string,
  input: {
    enforcementMode: string;
    severity: string;
    lifecycleState: string;
    rule: Record<string, unknown>;
    expectedVersion: number;
  }
): Promise<ApprovalPolicy[]> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalPolicy[]>,
    {
      enforcementMode: string;
      severity: string;
      lifecycleState: string;
      rule: Record<string, unknown>;
      expectedVersion: number;
    }
  >(`${base}/admin/policies/${policyId}`, input);
  return response.data.data;
}
export async function getApprovalOperations(): Promise<ApprovalOperations> {
  const response = await axiosInstance.get<ApiResponse<ApprovalOperations>>(
    `${base}/admin/operations`
  );
  return response.data.data;
}
export async function getApprovalSignatureProviders(): Promise<ApprovalSignatureProvider[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalSignatureProvider[]>>(
    `${base}/admin/signatures`
  );
  return response.data.data;
}
