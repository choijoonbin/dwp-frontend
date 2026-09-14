import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
  captureApprovalWorkflowPlanningInput,
  planningUuid,
  readApprovalWorkflowPlanningResult,
  readApprovalWorkflowPlanningSelection,
  validateApprovalWorkflowPlanningAuthority,
} from './approval-workflow-planning-contract';
import type {
  ApprovalWorkflowPlanningInput,
  ApprovalWorkflowPlanningReadAuthority,
} from './approval-workflow-planning-contract';

type ReadOptions = { signal?: AbortSignal; beforeDispatch: () => void; now?: () => number };
export async function getApprovalWorkflowPlanningSelection(
  workflowId: string,
  formId: string | undefined,
  authority: ApprovalWorkflowPlanningReadAuthority,
  options: ReadOptions
) {
  validateApprovalWorkflowPlanningAuthority(authority, APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE);
  if (!planningUuid.test(workflowId) || (formId !== undefined && !planningUuid.test(formId)))
    throw new Error('Invalid planning selection identity');
  options.beforeDispatch();
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/approvals/v1/admin/workflows/${workflowId}/planning-selection${formId ? `?formId=${formId}` : ''}`,
    {
      headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
      contextScopeKey: authority.contextScopeKey,
      beforeDispatch: options.beforeDispatch,
      signal: options.signal,
      timeoutMs: 10000,
    }
  );
  options.beforeDispatch();
  const result = readApprovalWorkflowPlanningSelection(response.data.data);
  if (result.workflowId !== workflowId || result.selectedFormId !== (formId ?? null))
    throw new Error('Planning selection identity changed');
  return result;
}
export async function simulateApprovalWorkflowPlanning(
  workflowId: string,
  workflowVersionId: string,
  input: ApprovalWorkflowPlanningInput,
  authority: ApprovalWorkflowPlanningReadAuthority,
  options: ReadOptions
) {
  validateApprovalWorkflowPlanningAuthority(authority, APPROVAL_WORKFLOW_PLANNING_ROUTE);
  if (!planningUuid.test(workflowId) || !planningUuid.test(workflowVersionId))
    throw new Error('Invalid planning workflow identity');
  const body = captureApprovalWorkflowPlanningInput(input);
  options.beforeDispatch();
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `/api/approvals/v1/admin/workflows/${workflowId}/versions/${workflowVersionId}/simulation`,
    body,
    {
      headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
      contextScopeKey: authority.contextScopeKey,
      beforeDispatch: options.beforeDispatch,
      signal: options.signal,
      timeoutMs: 10000,
    }
  );
  options.beforeDispatch();
  return readApprovalWorkflowPlanningResult(response.data.data, options.now?.() ?? Date.now());
}
