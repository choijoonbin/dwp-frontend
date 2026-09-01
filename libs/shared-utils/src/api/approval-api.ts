import { axiosInstance } from '../axios-instance';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type {
  ApprovalAdminPulse,
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormDetail,
  ApprovalFormField,
  ApprovalFormSchema,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalPriority,
  ApprovalTask,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
  ApprovalWorkflowStep,
} from './approval-management-contract';
import type { ApiResponse } from '../types';

export type * from './approval-management-contract';
export * from './approval-management-api';

export type ApprovalRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';
export type ApprovalMetrics = {
  pending: number;
  dueToday: number;
  overdue: number;
  needsInformation: number;
  myRequestsInFlight: number;
  averageCycleHours: number;
  slaCompliancePercent: number;
};

export type ApprovalTimelineEvent = {
  eventId: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  stepName?: string | null;
  stepSequence?: number | null;
  delegated?: boolean;
  outcome: string;
  message?: string | null;
  occurredAt: string;
};

export type ApprovalTaskDetail = {
  task: ApprovalTask;
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
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
  formId: string;
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  timeline: ApprovalTimelineEvent[];
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

export type ApprovalRequestTemplate = {
  workflow: ApprovalWorkflow;
  routeDefinition: ApprovalWorkflowDetail['definition'];
  form: ApprovalFormDetail;
};
export type ApprovalDelegation = {
  delegationId: string;
  delegatorUserId: number;
  delegateUserId: number;
  delegatePersonPublicId?: string | null;
  delegateDisplayName: string;
  delegateEmail?: string | null;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowId?: GatewayComponents['schemas']['approval_DelegationSummary']['workflowId'] | null;
  /** @deprecated Display-only metadata. Never use this key as delegation authority identity. */
  workflowKey?: GatewayComponents['schemas']['approval_DelegationSummary']['workflowKey'] | null;
  startsAt: string;
  endsAt: string;
  lifecycleState: string;
  reason: string;
  version: number;
  direction: 'OUTGOING' | 'INCOMING';
};
export type ApprovalDelegationCandidate = {
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  email?: string | null;
  jobTitle?: string | null;
};
type ApprovalDelegationCreateBase = {
  delegateUserId: number;
  startsAt: string;
  endsAt: string;
  reason: string;
};
export type ApprovalDelegationCreateInput = ApprovalDelegationCreateBase &
  (
    | { scopeType: 'ALL'; workflowId?: never }
    | {
        scopeType: 'WORKFLOW';
        workflowId: NonNullable<
          GatewayComponents['schemas']['approval_CreateDelegationRequest']['workflowId']
        >;
      }
  );

const base = '/api/approvals/v1';

export type ApprovalGovernedMutationApiContract = Readonly<{
  apiFunction: string;
  routeContractKey: `route.approvals.${string}.action`;
  method: 'POST' | 'PUT';
  path: string;
}>;

export const APPROVAL_GOVERNED_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'claimApprovalTask',
    routeContractKey: 'route.approvals.work.task-claim.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/claim`,
  },
  {
    apiFunction: 'decideApprovalTask',
    routeContractKey: 'route.approvals.work.task-decision.action',
    method: 'POST',
    path: `${base}/tasks/{taskId}/decisions`,
  },
  {
    apiFunction: 'createApprovalRequest',
    routeContractKey: 'route.approvals.work.request-create.action',
    method: 'POST',
    path: `${base}/requests`,
  },
  {
    apiFunction: 'updateApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-update.action',
    method: 'PUT',
    path: `${base}/requests/{requestId}/draft`,
  },
  {
    apiFunction: 'submitApprovalRequest',
    routeContractKey: 'route.approvals.work.request-submit.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/submit`,
  },
  {
    apiFunction: 'respondToApprovalInformationRequest',
    routeContractKey: 'route.approvals.work.request-information-response.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/information-response`,
  },
  {
    apiFunction: 'withdrawApprovalRequest',
    routeContractKey: 'route.approvals.work.request-withdraw.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/withdraw`,
  },
  {
    apiFunction: 'createApprovalDelegation',
    routeContractKey: 'route.approvals.work.delegation-create.action',
    method: 'POST',
    path: `${base}/delegations`,
  },
  {
    apiFunction: 'revokeApprovalDelegation',
    routeContractKey: 'route.approvals.work.delegation-revoke.action',
    method: 'POST',
    path: `${base}/delegations/{delegationId}/revoke`,
  },
  {
    apiFunction: 'createApprovalWorkflowDraft',
    routeContractKey: 'route.approvals.admin.workflow-create.action',
    method: 'POST',
    path: `${base}/admin/workflows`,
  },
  {
    apiFunction: 'updateApprovalWorkflowDraft',
    routeContractKey: 'route.approvals.admin.workflow-update.action',
    method: 'PUT',
    path: `${base}/admin/workflows/{workflowId}/draft`,
  },
  {
    apiFunction: 'publishApprovalWorkflow',
    routeContractKey: 'route.approvals.admin.workflow-publish.action',
    method: 'POST',
    path: `${base}/admin/workflows/{workflowId}/publish`,
  },
  {
    apiFunction: 'createApprovalFormCategory',
    routeContractKey: 'route.approvals.admin.form-category-create.action',
    method: 'POST',
    path: `${base}/admin/form-categories`,
  },
  {
    apiFunction: 'updateApprovalFormCategory',
    routeContractKey: 'route.approvals.admin.form-category-update.action',
    method: 'PUT',
    path: `${base}/admin/form-categories/{categoryId}`,
  },
  {
    apiFunction: 'createApprovalFormDraft',
    routeContractKey: 'route.approvals.admin.form-create.action',
    method: 'POST',
    path: `${base}/admin/forms`,
  },
  {
    apiFunction: 'updateApprovalFormDraft',
    routeContractKey: 'route.approvals.admin.form-update.action',
    method: 'PUT',
    path: `${base}/admin/forms/{formId}/draft`,
  },
  {
    apiFunction: 'publishApprovalForm',
    routeContractKey: 'route.approvals.admin.form-publish.action',
    method: 'POST',
    path: `${base}/admin/forms/{formId}/publish`,
  },
  {
    apiFunction: 'updateApprovalPolicy',
    routeContractKey: 'route.approvals.admin.policy-update.action',
    method: 'PUT',
    path: `${base}/admin/policies/{policyId}`,
  },
  {
    apiFunction: 'publishApprovalPolicy',
    routeContractKey: 'route.approvals.admin.policy-publish.action',
    method: 'POST',
    path: `${base}/admin/policies/{policyId}/publish`,
  },
  {
    apiFunction: 'retryApprovalIntegrationDelivery',
    routeContractKey: 'route.approvals.admin.operations.retry.action',
    method: 'POST',
    path: `${base}/admin/operations/events/{outboxId}/retry`,
  },
] as const satisfies readonly ApprovalGovernedMutationApiContract[];

export function getApprovalHome(): Promise<ApprovalHome>;
export function getApprovalHome(contextScopeKey: string): Promise<ApprovalHome>;
export async function getApprovalHome(contextScopeKey?: string): Promise<ApprovalHome> {
  const response = await axiosInstance.get<ApiResponse<ApprovalHome>>(`${base}/home`, {
    contextScopeKey,
  });
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
export async function claimApprovalTask(
  taskId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalTaskDetail>,
    { expectedVersion: number }
  >(
    `${base}/tasks/${taskId}/claim`,
    { expectedVersion },
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function decideApprovalTask(
  taskId: string,
  input: {
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
    comment?: string;
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.post<ApiResponse<ApprovalTaskDetail>, typeof input>(
    `${base}/tasks/${taskId}/decisions`,
    input,
    approvalMutationExecutionConfig(execution)
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
export async function createApprovalRequest(
  input: {
    workflowId: string;
    formId: string;
    title: string;
    summary: string;
    priority: ApprovalPriority;
    payload: Record<string, unknown>;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<ApiResponse<ApprovalRequest>, typeof input>(
    `${base}/requests`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function updateApprovalDraft(
  requestId: string,
  input: {
    workflowId: string;
    formId: string;
    title: string;
    summary: string;
    priority: ApprovalPriority;
    payload: Record<string, unknown>;
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.put<ApiResponse<ApprovalRequestDetail>, typeof input>(
    `${base}/requests/${requestId}/draft`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function submitApprovalRequest(
  requestId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { expectedVersion: number }
  >(
    `${base}/requests/${requestId}/submit`,
    { expectedVersion },
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function respondToApprovalInformationRequest(
  requestId: string,
  message: string,
  payload: Record<string, unknown>,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { message: string; payload: Record<string, unknown>; expectedVersion: number }
  >(
    `${base}/requests/${requestId}/information-response`,
    { message, payload, expectedVersion },
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function withdrawApprovalRequest(
  requestId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { expectedVersion: number }
  >(
    `${base}/requests/${requestId}/withdraw`,
    { expectedVersion },
    approvalMutationExecutionConfig(execution)
  );
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
export async function getPublishedApprovalForms(): Promise<ApprovalForm[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalForm[]>>(`${base}/catalog/forms`);
  return response.data.data;
}
export async function getPublishedApprovalFormTemplate(
  formId: string
): Promise<ApprovalRequestTemplate> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestTemplate>>(
    `${base}/catalog/forms/${formId}/template`
  );
  return response.data.data;
}
export async function getApprovalDelegations(): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalDelegation[]>>(
    `${base}/delegations`
  );
  return response.data.data;
}
export async function searchApprovalDelegationCandidates(
  query: string,
  limit = 10
): Promise<ApprovalDelegationCandidate[]> {
  const search = new URLSearchParams({ query: query.trim(), limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<ApprovalDelegationCandidate[]>>(
    `${base}/delegations/candidates?${search.toString()}`
  );
  return response.data.data;
}
export async function createApprovalDelegation(
  input: ApprovalDelegationCreateInput,
  execution: ApprovalMutationExecution
): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.post<ApiResponse<ApprovalDelegation[]>, typeof input>(
    `${base}/delegations`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function revokeApprovalDelegation(
  delegationId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalDelegation[]>,
    { expectedVersion: number }
  >(
    `${base}/delegations/${delegationId}/revoke`,
    { expectedVersion },
    approvalMutationExecutionConfig(execution)
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
  input: ApprovalWorkflowDraftInput & { workflowKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalWorkflowDetail>,
    ApprovalWorkflowDraftInput & { workflowKey: string }
  >(`${base}/admin/workflows`, input, approvalMutationExecutionConfig(execution));
  return response.data.data;
}
export async function updateApprovalWorkflowDraft(
  workflowId: string,
  input: ApprovalWorkflowDraftInput & { expectedVersion: number },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalWorkflowDetail>,
    ApprovalWorkflowDraftInput & { expectedVersion: number }
  >(
    `${base}/admin/workflows/${workflowId}/draft`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function publishApprovalWorkflow(
  workflowId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalWorkflow[]>,
    { expectedVersion: number }
  >(
    `${base}/admin/workflows/${workflowId}/publish`,
    { expectedVersion },
    approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: false })
  );
  return response.data.data;
}
export type ApprovalFormCategoryInput = {
  parentCategoryId?: string | null;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  iconKey: string;
  sortOrder: number;
};
export async function createApprovalFormCategory(
  input: ApprovalFormCategoryInput & { categoryKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormCategory[]> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalFormCategory[]>,
    ApprovalFormCategoryInput & { categoryKey: string }
  >(`${base}/admin/form-categories`, input, approvalMutationExecutionConfig(execution));
  return response.data.data;
}
export async function updateApprovalFormCategory(
  categoryId: string,
  input: ApprovalFormCategoryInput & {
    lifecycleState: 'ACTIVE' | 'INACTIVE';
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormCategory[]> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalFormCategory[]>,
    ApprovalFormCategoryInput & {
      lifecycleState: 'ACTIVE' | 'INACTIVE';
      expectedVersion: number;
    }
  >(
    `${base}/admin/form-categories/${categoryId}`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  return response.data.data;
}
export async function updateApprovalFormDraft(
  formId: string,
  input: {
    categoryId: string;
    nameKo: string;
    nameEn: string;
    descriptionKo: string;
    descriptionEn: string;
    ownerGroupRef: string;
    defaultWorkflowId: string;
    fields: ApprovalFormField[];
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormDetail> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalFormDetail>,
    {
      categoryId: string;
      nameKo: string;
      nameEn: string;
      descriptionKo: string;
      descriptionEn: string;
      ownerGroupRef: string;
      defaultWorkflowId: string;
      fields: ApprovalFormField[];
      expectedVersion: number;
    }
  >(`${base}/admin/forms/${formId}/draft`, input, approvalMutationExecutionConfig(execution));
  return response.data.data;
}
export type ApprovalFormDraftInput = {
  categoryId: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  ownerGroupRef: string;
  defaultWorkflowId: string;
  fields: ApprovalFormField[];
};
export async function createApprovalFormDraft(
  input: ApprovalFormDraftInput & { formKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalFormDetail>,
    ApprovalFormDraftInput & { formKey: string }
  >(`${base}/admin/forms`, input, approvalMutationExecutionConfig(execution));
  return response.data.data;
}
export async function publishApprovalForm(
  formId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalFormDetail> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalFormDetail>,
    { expectedVersion: number }
  >(
    `${base}/admin/forms/${formId}/publish`,
    { expectedVersion },
    approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: false })
  );
  return response.data.data;
}
export async function updateApprovalPolicy(
  policyId: string,
  input: {
    enforcementMode: string;
    severity: string;
    lifecycleState: string;
    rule: Record<string, unknown>;
    changeReason: string;
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalPolicy[]> {
  const response = await axiosInstance.put<
    ApiResponse<ApprovalPolicy[]>,
    {
      enforcementMode: string;
      severity: string;
      lifecycleState: string;
      rule: Record<string, unknown>;
      changeReason: string;
      expectedVersion: number;
    }
  >(`${base}/admin/policies/${policyId}`, input, approvalMutationExecutionConfig(execution));
  return response.data.data;
}
export async function publishApprovalPolicy(
  policyId: string,
  input: { expectedVersion: number; reviewComment: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalPolicy[]> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalPolicy[]>,
    { expectedVersion: number; reviewComment: string }
  >(
    `${base}/admin/policies/${policyId}/publish`,
    input,
    approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: false })
  );
  return response.data.data;
}
export async function retryApprovalIntegrationDelivery(
  outboxId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution
): Promise<ApprovalOperations> {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('Approval delivery retry version is invalid.');
  }
  if (execution.mode === 'SECURE' && execution.objectVersion !== expectedVersion) {
    throw new Error('Approval delivery retry version does not match governed authority.');
  }
  const response = await axiosInstance.post<ApiResponse<ApprovalOperations>, undefined>(
    `${base}/admin/operations/events/${outboxId}/retry`,
    undefined,
    approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: true })
  );
  return response.data.data;
}
