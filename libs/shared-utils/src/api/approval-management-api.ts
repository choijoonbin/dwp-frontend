import { axiosInstance } from '../axios-instance';
import {
  assertSupportedApprovalFormSchema,
  isApprovalFormDetailProjection,
  isApprovalFormOversightProjection,
  isApprovalWorkflowDetailProjection,
  isApprovalWorkflowOversightProjection,
} from './approval-management-contract';

import type {
  ApprovalAdminPulse,
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormDetail,
  ApprovalFormReadProjection,
  ApprovalFormSchema,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalPolicyVersion,
  ApprovalSignatureProvider,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
  ApprovalWorkflowListProjection,
  ApprovalWorkflowReadProjection,
} from './approval-management-contract';
import type { ApiResponse } from '../types';

const base = '/api/approvals/v1/admin';

function selectedScope(contextScopeKey?: string, signal?: AbortSignal) {
  if (contextScopeKey === undefined && signal === undefined) return undefined;
  return {
    ...(contextScopeKey === undefined ? {} : { contextScopeKey }),
    ...(signal === undefined ? {} : { signal }),
  };
}

export async function getApprovalAdminOverview(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalAdminPulse> {
  const response = await axiosInstance.get<ApiResponse<ApprovalAdminPulse>>(
    `${base}/overview`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalWorkflows(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowListProjection[]> {
  return getApprovalStudioWorkflows(contextScopeKey, signal);
}

/** Workflow Studio reads must keep the `view` discriminator absent. */
export async function getApprovalStudioWorkflows(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowListProjection[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/workflows`,
    selectedScope(contextScopeKey, signal)
  );
  const projections = response.data.data;
  if (!Array.isArray(projections) || !projections.every(isApprovalWorkflowOversightProjection)) {
    throw new Error('Invalid approval workflow list projection');
  }
  return projections;
}

export async function getApprovalWorkflow(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowDetail> {
  return getApprovalStudioWorkflow(workflowId, contextScopeKey, signal);
}

/** Workflow Studio detail reads must keep the `view` discriminator absent. */
export async function getApprovalStudioWorkflow(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowDetail> {
  const projection = await getApprovalStudioWorkflowReadProjection(
    workflowId,
    contextScopeKey,
    signal
  );
  if (!isApprovalWorkflowDetailProjection(projection)) {
    throw new Error('Approval workflow detail is unavailable for the current authority projection');
  }
  return projection;
}

/** Workflow Studio accepts only the registered full-management or oversight detail projection. */
export async function getApprovalStudioWorkflowReadProjection(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowReadProjection> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/workflows/${workflowId}`,
    selectedScope(contextScopeKey, signal)
  );
  const projection = response.data.data;
  if (isApprovalWorkflowDetailProjection(projection)) return projection;
  if (!isApprovalWorkflowOversightProjection(projection)) {
    throw new Error('Invalid approval workflow read projection');
  }
  return projection;
}

/** Form Studio may only consume the registry's workflow-reference projection. */
export async function getApprovalFormReferenceWorkflows(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflow[]>>(
    `${base}/workflows?view=reference`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

/** Form Studio may only consume the registry's workflow-reference projection. */
export async function getApprovalFormReferenceWorkflow(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflowDetail>>(
    `${base}/workflows/${workflowId}?view=reference`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalForms(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalForm[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalForm[]>>(
    `${base}/forms`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalFormCategories(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalFormCategory[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalFormCategory[]>>(
    `${base}/form-categories`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalForm(
  formId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalFormDetail> {
  const projection = await getApprovalFormReadProjection(formId, contextScopeKey, signal);
  if (!isApprovalFormDetailProjection(projection)) {
    throw new Error('Approval form detail is unavailable for the current authority projection');
  }
  return projection;
}

export async function getApprovalFormReadProjection(
  formId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalFormReadProjection> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${base}/forms/${formId}`,
    selectedScope(contextScopeKey, signal)
  );
  const projection = response.data.data;
  if (
    typeof projection === 'object' &&
    projection !== null &&
    !Array.isArray(projection) &&
    'schema' in projection
  ) {
    assertSupportedApprovalFormSchema(projection.schema as ApprovalFormSchema);
  }
  if (isApprovalFormDetailProjection(projection)) {
    return projection;
  } else if (!isApprovalFormOversightProjection(projection)) {
    throw new Error('Invalid approval form read projection');
  }
  return projection;
}

export async function getApprovalPolicies(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalPolicy[]>>(
    `${base}/policies`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalPolicyVersions(
  policyId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalPolicyVersion[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalPolicyVersion[]>>(
    `${base}/policies/${policyId}/versions`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalOperations(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalOperations> {
  const response = await axiosInstance.get<ApiResponse<ApprovalOperations>>(
    `${base}/operations`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalSignatureProviders(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalSignatureProvider[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalSignatureProvider[]>>(
    `${base}/signatures`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}
