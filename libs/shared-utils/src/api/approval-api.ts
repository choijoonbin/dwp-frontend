import { axiosInstance } from '../axios-instance';
import { assertSupportedApprovalFormSchema } from './approval-management-contract';
import { readApprovalInformationRound } from './approval-information-contract';
import { approvalInformationWireBody } from './approval-information-wire-body';
import type { ApprovalInformationWireBodyCapture } from './approval-information-wire-body';
import type { ApprovalInformationRound } from './approval-information-contract';
export type { ApprovalInformationRound } from './approval-information-contract';
import { APPROVAL_DOCUMENT_ACTION_CONTRACTS } from './approval-document-action-contracts';
import { APPROVAL_EXTENSION_ACTION_CONTRACTS } from './approval-extension-action-contracts';
import { APPROVAL_RELEASE10_ACTION_CONTRACTS } from './approval-release10-action-contracts';
import { APPROVAL_RELEASE14_ACTION_CONTRACTS } from './approval-release14-action-contracts';
import {
  captureApprovalTypedWorkflowDefinition,
  readApprovalTypedWorkflowDetail,
} from './approval-workflow-typed-contract';
import type {
  ApprovalTypedWorkflowDefinition,
  ApprovalTypedWorkflowDetail,
} from './approval-workflow-typed-contract';
import {
  readApprovalQuorumTaskSnapshot,
  readApprovalQuorumVotePrecondition,
} from './approval-quorum-contract';
import type {
  ApprovalQuorumTaskSnapshot,
  ApprovalQuorumVotePrecondition,
} from './approval-quorum-contract';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';

import type { ApprovalContentAccess } from './approval-content-access';

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
  ApprovalTypedFormSchema,
} from './approval-management-contract';
import type { ApiResponse } from '../types';
import type { ApprovalRequest } from './approval-request-contract';

export type * from './approval-management-contract';
export type * from './approval-workflow-typed-contract';
export { readApprovalTypedWorkflowDetail } from './approval-workflow-typed-contract';
export {
  isApprovalTypedFormSchema,
  assertSupportedApprovalFormSchema,
} from './approval-management-contract';
export type * from './approval-request-contract';
export * from './approval-management-api';
export * from './approval-draft-api';
export * from './approval-search-api';
export { getApprovalTasks } from './approval-task-read-api';
export type * from './approval-content-access';
export { resolveApprovalContentAccess } from './approval-content-access';

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
  contentAccess: ApprovalContentAccess;
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  timeline: ApprovalTimelineEvent[];
  canClaim: boolean;
  canDecide: boolean;
  selfApprovalBlocked: boolean;
  quorum?: ApprovalQuorumTaskSnapshot | null;
};

export type ApprovalRequestDetail = {
  informationGeneration?: number | null;
  informationRound?: ApprovalInformationRound | null;
  request: ApprovalRequest;
  workflowId: string;
  formId: string;
  formVersionId?: string | null;
  formSchemaSha256?: string | null;
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
type ApprovalDelegationUpdateBase = ApprovalDelegationCreateBase & { expectedVersion: number };
export type ApprovalDelegationUpdateInput = ApprovalDelegationUpdateBase &
  ({ scopeType: 'ALL'; workflowId?: never } | { scopeType: 'WORKFLOW'; workflowId: string });

const base = '/api/approvals/v1';

export type ApprovalGovernedMutationApiContract = Readonly<{
  apiFunction: string;
  routeContractKey: `route.approvals.${string}.action`;
  method: 'POST' | 'PUT';
  path: string;
}>;

export const APPROVAL_GOVERNED_MUTATION_API_CONTRACTS = [
  ...APPROVAL_DOCUMENT_ACTION_CONTRACTS,
  ...APPROVAL_EXTENSION_ACTION_CONTRACTS,
  ...APPROVAL_RELEASE10_ACTION_CONTRACTS,
  ...APPROVAL_RELEASE14_ACTION_CONTRACTS,
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
    apiFunction: 'migrateApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-migrate.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/migrate`,
  },
  {
    apiFunction: 'submitApprovalRequest',
    routeContractKey: 'route.approvals.work.request-submit.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/submit`,
  },
  {
    apiFunction: 'recoverApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-recover.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/recover`,
  },
  {
    apiFunction: 'deleteApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-delete.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/delete`,
  },
  {
    apiFunction: 'restoreApprovalDraft',
    routeContractKey: 'route.approvals.work.request-draft-restore.action',
    method: 'POST',
    path: `${base}/requests/{requestId}/draft/restore`,
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
    apiFunction: 'createApprovalPolicyDraft',
    routeContractKey: 'route.approvals.admin.policy-create.action',
    method: 'POST',
    path: `${base}/admin/policies`,
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
export function getApprovalHome(
  contextScopeKey: string,
  signal?: AbortSignal
): Promise<ApprovalHome>;
export async function getApprovalHome(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalHome> {
  const response = await axiosInstance.get<ApiResponse<ApprovalHome>>(`${base}/home`, {
    contextScopeKey,
    signal,
  });
  return response.data.data;
}
export async function getApprovalTask(
  taskId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalTaskDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalTaskDetail>>(
    `${base}/tasks/${taskId}`,
    { contextScopeKey, signal }
  );
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  if (response.data.data.quorum != null)
    return {
      ...response.data.data,
      quorum: readApprovalQuorumTaskSnapshot(response.data.data.quorum),
    };
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
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  if (response.data.data.quorum != null)
    return {
      ...response.data.data,
      quorum: readApprovalQuorumTaskSnapshot(response.data.data.quorum),
    };
  return response.data.data;
}
export async function decideApprovalTask(
  taskId: string,
  input: {
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
    comment?: string;
    expectedVersion: number;
    quorum?: ApprovalQuorumVotePrecondition;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalTaskDetail> {
  if (input.quorum != null) readApprovalQuorumVotePrecondition(input.quorum);
  const response = await axiosInstance.post<ApiResponse<ApprovalTaskDetail>, typeof input>(
    `${base}/tasks/${taskId}/decisions`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  if (response.data.data.quorum != null)
    return {
      ...response.data.data,
      quorum: readApprovalQuorumTaskSnapshot(response.data.data.quorum),
    };
  return response.data.data;
}
export async function getApprovalRequests(
  view = 'SUBMITTED',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequest[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequest[]>>(
    `${base}/requests?view=${encodeURIComponent(view)}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
export async function getApprovalRequest(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequest> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequest>>(
    `${base}/requests/${requestId}`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
export async function getApprovalRequestDetail(
  requestId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestDetail>>(
    `${base}/requests/${requestId}/detail`,
    { contextScopeKey, signal }
  );
  const data = response.data.data;
  const round = readApprovalInformationRound(data.informationRound);
  if (
    (data.informationGeneration != null &&
      (!Number.isSafeInteger(data.informationGeneration) || data.informationGeneration < 1)) ||
    (round &&
      (data.informationGeneration !== round.sourceGeneration ||
        data.request.status !== 'NEEDS_INFO' ||
        (data.formSchemaSha256 != null &&
          data.formSchemaSha256 !== round.pins.formSchemaSha256))) ||
    (data.informationGeneration != null && data.request.status === 'NEEDS_INFO' && !round)
  )
    throw new Error('Invalid approval information source');
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  return round ? { ...data, informationRound: round } : data;
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
  execution: ApprovalMutationExecution,
  options?: { idempotencyKey: string }
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<ApiResponse<ApprovalRequest>, typeof input>(
    `${base}/requests`,
    input,
    approvalRequestExecutionConfig(execution, options)
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
  execution: ApprovalMutationExecution,
  options?: { idempotencyKey: string }
): Promise<ApprovalRequestDetail> {
  const response = await axiosInstance.put<ApiResponse<ApprovalRequestDetail>, typeof input>(
    `${base}/requests/${requestId}/draft`,
    input,
    approvalRequestExecutionConfig(execution, options)
  );
  if (response.data.data.formSchema)
    assertSupportedApprovalFormSchema(response.data.data.formSchema);
  return response.data.data;
}

function approvalRequestExecutionConfig(
  execution: ApprovalMutationExecution,
  options?: { idempotencyKey: string; beforeDispatch?: () => void }
) {
  const config = approvalMutationExecutionConfig(execution);
  if (!options) return config;
  const key = options.idempotencyKey;
  const governedKey = config.headers['Idempotency-Key'];
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(key) || (governedKey && governedKey !== key)) {
    throw new Error('Invalid approval request command identity');
  }
  return {
    ...config,
    headers: { ...config.headers, 'Idempotency-Key': key },
    beforeDispatch: options.beforeDispatch,
  };
}
export async function submitApprovalRequest(
  requestId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution,
  options?: { idempotencyKey: string }
): Promise<ApprovalRequest> {
  const response = await axiosInstance.post<
    ApiResponse<ApprovalRequest>,
    { expectedVersion: number }
  >(
    `${base}/requests/${requestId}/submit`,
    { expectedVersion },
    approvalRequestExecutionConfig(execution, options)
  );
  return response.data.data;
}
export async function respondToApprovalInformationRequest(
  requestId: string,
  message: string,
  payload: Record<string, unknown>,
  expectedVersion: number,
  execution: ApprovalMutationExecution,
  options?: {
    idempotencyKey: string;
    sourceGeneration?: number;
    beforeDispatch?: () => void;
    onOriginalWireBody?: ApprovalInformationWireBodyCapture;
  }
): Promise<ApprovalRequest> {
  if (
    options?.sourceGeneration !== undefined &&
    (!Number.isSafeInteger(options.sourceGeneration) || options.sourceGeneration < 1)
  )
    throw new Error('Invalid approval information generation');
  const input = Object.freeze({
    message,
    payload: structuredClone(payload),
    expectedVersion,
    ...(options?.sourceGeneration === undefined
      ? {}
      : { sourceGeneration: options.sourceGeneration }),
  });
  const config = approvalRequestExecutionConfig(execution, options);
  const body = options?.onOriginalWireBody
    ? approvalInformationWireBody(input, options.onOriginalWireBody)
    : input;
  const response = await axiosInstance.post<ApiResponse<ApprovalRequest>, typeof body>(
    `${base}/requests/${requestId}/information-response`,
    body,
    config
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
export async function getPublishedApprovalWorkflows(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflow[]>>(
    `${base}/workflows/published`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
export async function getPublishedApprovalWorkflowTemplate(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequestTemplate> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestTemplate>>(
    `${base}/workflows/published/${workflowId}/template`,
    { contextScopeKey, signal }
  );
  assertSupportedApprovalFormSchema(response.data.data.form.schema);
  return response.data.data;
}
export async function getPublishedApprovalForms(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalForm[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalForm[]>>(`${base}/catalog/forms`, {
    contextScopeKey,
    signal,
  });
  return response.data.data;
}
export async function getPublishedApprovalFormTemplate(
  formId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalRequestTemplate> {
  const response = await axiosInstance.get<ApiResponse<ApprovalRequestTemplate>>(
    `${base}/catalog/forms/${formId}/template`,
    { contextScopeKey, signal }
  );
  assertSupportedApprovalFormSchema(response.data.data.form.schema);
  return response.data.data;
}
export async function getApprovalDelegations(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalDelegation[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalDelegation[]>>(
    `${base}/delegations`,
    { contextScopeKey, signal }
  );
  return response.data.data;
}
export async function searchApprovalDelegationCandidates(
  query: string,
  limit = 10,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalDelegationCandidate[]> {
  const search = new URLSearchParams({ query: query.trim(), limit: String(limit) });
  const response = await axiosInstance.get<ApiResponse<ApprovalDelegationCandidate[]>>(
    `${base}/delegations/candidates?${search.toString()}`,
    { contextScopeKey, signal }
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
  typedDefinition?: never;
};
export type ApprovalTypedWorkflowDraftInput = Omit<
  ApprovalWorkflowDraftInput,
  'steps' | 'typedDefinition'
> & {
  steps?: never;
  typedDefinition: ApprovalTypedWorkflowDefinition;
};
function captureWorkflowInput<
  T extends ApprovalWorkflowDraftInput | ApprovalTypedWorkflowDraftInput,
>(input: T) {
  if ((input.steps != null) === (input.typedDefinition != null))
    throw new Error('Exactly one workflow definition is required');
  if (input.typedDefinition != null) {
    const typedDefinition = captureApprovalTypedWorkflowDefinition(input.typedDefinition);
    if (typedDefinition.slaMinutes !== input.slaMinutes)
      throw new Error('Workflow SLA differs from the definition');
    return Object.freeze({ ...input, typedDefinition });
  }
  if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 20)
    throw new Error('Invalid legacy workflow steps');
  return input;
}
export function createApprovalWorkflowDraft(
  input: ApprovalTypedWorkflowDraftInput & { workflowKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalTypedWorkflowDetail>;
export function createApprovalWorkflowDraft(
  input: ApprovalWorkflowDraftInput & { workflowKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail>;
export async function createApprovalWorkflowDraft(
  input: (ApprovalWorkflowDraftInput | ApprovalTypedWorkflowDraftInput) & { workflowKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail | ApprovalTypedWorkflowDetail> {
  const captured = captureWorkflowInput(input);
  const response = await axiosInstance.post<ApiResponse<ApprovalWorkflowDetail>, typeof captured>(
    `${base}/admin/workflows`,
    captured,
    approvalMutationExecutionConfig(execution)
  );
  if (captured.typedDefinition != null) {
    const typed = readApprovalTypedWorkflowDetail(response.data.data);
    if (!typed) throw new Error('Typed workflow response was downgraded');
    return typed;
  }
  return response.data.data;
}
export function updateApprovalWorkflowDraft(
  workflowId: string,
  input: ApprovalTypedWorkflowDraftInput & { expectedVersion: number },
  execution: ApprovalMutationExecution
): Promise<ApprovalTypedWorkflowDetail>;
export function updateApprovalWorkflowDraft(
  workflowId: string,
  input: ApprovalWorkflowDraftInput & { expectedVersion: number },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail>;
export async function updateApprovalWorkflowDraft(
  workflowId: string,
  input: (ApprovalWorkflowDraftInput | ApprovalTypedWorkflowDraftInput) & {
    expectedVersion: number;
  },
  execution: ApprovalMutationExecution
): Promise<ApprovalWorkflowDetail | ApprovalTypedWorkflowDetail> {
  const captured = captureWorkflowInput(input);
  const response = await axiosInstance.put<ApiResponse<ApprovalWorkflowDetail>, typeof captured>(
    `${base}/admin/workflows/${workflowId}/draft`,
    captured,
    approvalMutationExecutionConfig(execution)
  );
  if (captured.typedDefinition != null) {
    const typed = readApprovalTypedWorkflowDetail(response.data.data);
    if (!typed) throw new Error('Typed workflow response was downgraded');
    return typed;
  }
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
  input: ApprovalFormDraftInput & { expectedVersion: number },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormDetail> {
  validateApprovalFormDraftInput(input);
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)
    throw new Error('Invalid approval form version');
  const response = await axiosInstance.put<ApiResponse<ApprovalFormDetail>, typeof input>(
    `${base}/admin/forms/${formId}/draft`,
    input,
    approvalMutationExecutionConfig(execution)
  );
  assertSupportedApprovalFormSchema(response.data.data.schema);
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
} & (
  | { fields: ApprovalFormField[]; typedSchema?: never }
  | { typedSchema: ApprovalTypedFormSchema; fields?: never }
);

function validateApprovalFormDraftInput(input: ApprovalFormDraftInput) {
  if (input.typedSchema !== undefined) {
    if (input.fields !== undefined) throw new Error('Ambiguous approval form definition');
    assertSupportedApprovalFormSchema(input.typedSchema);
    if (input.typedSchema.fields.length < 1 || input.typedSchema.fields.length > 50)
      throw new Error('Invalid approval form field count');
  } else if (!Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 50) {
    throw new Error('Invalid approval form field count');
  }
}
export async function createApprovalFormDraft(
  input: ApprovalFormDraftInput & { formKey: string },
  execution: ApprovalMutationExecution
): Promise<ApprovalFormDetail> {
  validateApprovalFormDraftInput(input);
  const response = await axiosInstance.post<
    ApiResponse<ApprovalFormDetail>,
    ApprovalFormDraftInput & { formKey: string }
  >(`${base}/admin/forms`, input, approvalMutationExecutionConfig(execution));
  assertSupportedApprovalFormSchema(response.data.data.schema);
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
  assertSupportedApprovalFormSchema(response.data.data.schema);
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
  execution: ApprovalMutationExecution,
  options?: { beforeDispatch?: () => void }
): Promise<ApprovalPolicy[]> {
  const body = structuredClone(input);
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
  >(`${base}/admin/policies/${policyId}`, body, {
    ...approvalMutationExecutionConfig(execution),
    beforeDispatch: options?.beforeDispatch,
  });
  return response.data.data;
}
export async function publishApprovalPolicy(
  policyId: string,
  input: { expectedVersion: number; reviewComment: string },
  execution: ApprovalMutationExecution,
  options?: { beforeDispatch?: () => void }
): Promise<ApprovalPolicy[]> {
  if (execution.mode === 'SECURE' && execution.objectVersion !== input.expectedVersion) {
    throw new Error('Approval policy version does not match governed authority.');
  }
  const body = structuredClone(input);
  const response = await axiosInstance.post<
    ApiResponse<ApprovalPolicy[]>,
    { expectedVersion: number; reviewComment: string }
  >(`${base}/admin/policies/${policyId}/publish`, body, {
    ...approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: false }),
    beforeDispatch: options?.beforeDispatch,
  });
  return response.data.data;
}
export async function retryApprovalIntegrationDelivery(
  outboxId: string,
  expectedVersion: number,
  execution: ApprovalMutationExecution,
  options?: { beforeDispatch?: () => void }
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
    {
      ...approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: true }),
      beforeDispatch: options?.beforeDispatch,
      csrfReplay: 'NEVER',
    }
  );
  options?.beforeDispatch?.();
  return response.data.data;
}
