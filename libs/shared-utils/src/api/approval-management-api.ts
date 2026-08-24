import { axiosInstance } from '../axios-instance';

import type {
  ApprovalAdminPulse,
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormDetail,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalPolicyVersion,
  ApprovalSignatureProvider,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
} from './approval-api';
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
): Promise<ApprovalWorkflow[]> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflow[]>>(
    `${base}/workflows`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getApprovalWorkflow(
  workflowId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalWorkflowDetail> {
  const response = await axiosInstance.get<ApiResponse<ApprovalWorkflowDetail>>(
    `${base}/workflows/${workflowId}`,
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
  const response = await axiosInstance.get<ApiResponse<ApprovalFormDetail>>(
    `${base}/forms/${formId}`,
    selectedScope(contextScopeKey, signal)
  );
  return response.data.data;
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
