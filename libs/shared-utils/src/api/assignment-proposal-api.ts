import { axiosInstance } from '../axios-instance';
import {
  PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from './product-surface-governed-mutation';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

const WORKFORCE_BASE = '/api/people/v1/workforce';

export const ASSIGNMENT_CHANGE_TYPES = [
  'TRANSFER',
  'PROMOTION',
  'DEMOTION',
  'CHANGE_MANAGER',
  'CHANGE_LOCATION',
  'CORRECTION',
] as const;

export type AssignmentChangeType = (typeof ASSIGNMENT_CHANGE_TYPES)[number];
export type AssignmentProposalLifecycle = 'DRAFT' | 'VALIDATED' | 'SUBMITTED' | 'CANCELLED';

export type AssignmentValidationFinding = Readonly<{
  code: string;
  field: string;
  severity: string;
  message: string;
}>;

export type AssignmentProposal = Readonly<{
  proposalId: string;
  targetAssignmentId: string;
  targetWorkerId: string;
  targetWorkRelationshipId: string;
  assignmentKey: string | null;
  workerNumber: string | null;
  personDisplayName: string;
  changeType: AssignmentChangeType;
  effectiveDate: string;
  reasonCode: string;
  proposedChanges: Readonly<Record<string, unknown>>;
  lifecycleState: AssignmentProposalLifecycle;
  validationFindings: readonly AssignmentValidationFinding[];
  targetWorkerVersion: number;
  targetRelationshipVersion: number;
  targetAssignmentVersion: number;
  version: number;
  validatedAt: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type AssignmentProposalCommandResult = Readonly<{
  receiptId: string;
  replayed: boolean;
  proposal: AssignmentProposal;
}>;

export type AssignmentDetail = Readonly<{
  assignmentId: string;
  workerId: string;
  workRelationshipId: string;
  assignmentKey: string | null;
  workerNumber: string | null;
  personDisplayName: string;
  assignmentStatus: string;
  primaryAssignment: boolean;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  organizationId: string | null;
  organizationName: string | null;
  jobProfileKey: string | null;
  jobName: string | null;
  locationKey: string | null;
  locationName: string | null;
  managerAssignmentId: string | null;
  businessTitle: string | null;
  workerHours: number | null;
  fullTimeEquivalent: number | null;
  changeReasonCode: string | null;
  workerVersion: number;
  relationshipVersion: number;
  assignmentVersion: number;
}>;

export type AssignmentTimelineEntry = Readonly<{
  assignmentId: string;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  effectiveSequence: number;
  assignmentStatus: string;
  businessTitle: string | null;
  organizationId: string | null;
  jobProfileKey: string | null;
  locationKey: string | null;
  managerAssignmentId: string | null;
  changeReasonCode: string | null;
  version: number;
}>;

export type CreateAssignmentProposalRequest = Readonly<{
  commandId: string;
  targetAssignmentId: string;
  changeType: AssignmentChangeType;
  effectiveDate: string;
  reasonCode: string;
  proposedChanges: Readonly<Record<string, unknown>>;
  expectedAssignmentVersion: number;
}>;

export type AssignmentProposalVersionCommand = Readonly<{
  commandId: string;
  expectedVersion: number;
}>;

export type CancelAssignmentProposalCommand = AssignmentProposalVersionCommand &
  Readonly<{ reason: string }>;

function idempotentMutationConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  commandId: string
) {
  const governed = productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      [PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER]: commandId,
    },
  };
}

export async function getAssignmentDetail(
  assignmentId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<AssignmentDetail> {
  const response = await axiosInstance.get<ApiResponse<AssignmentDetail>>(
    `${WORKFORCE_BASE}/assignments/${encodeURIComponent(assignmentId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getAssignmentTimeline(
  assignmentId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<AssignmentTimelineEntry[]> {
  const response = await axiosInstance.get<ApiResponse<AssignmentTimelineEntry[]>>(
    `${WORKFORCE_BASE}/assignments/${encodeURIComponent(assignmentId)}/timeline`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getAssignmentProposal(
  proposalId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<AssignmentProposal> {
  const response = await axiosInstance.get<ApiResponse<AssignmentProposal>>(
    `${WORKFORCE_BASE}/assignment-proposals/${encodeURIComponent(proposalId)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function createAssignmentProposal(
  request: CreateAssignmentProposalRequest,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<AssignmentProposalCommandResult> {
  const response = await axiosInstance.post<
    ApiResponse<AssignmentProposalCommandResult>,
    CreateAssignmentProposalRequest
  >(
    `${WORKFORCE_BASE}/assignment-proposals`,
    request,
    idempotentMutationConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function validateAssignmentProposal(
  proposalId: string,
  request: AssignmentProposalVersionCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<AssignmentProposalCommandResult> {
  const response = await axiosInstance.post<
    ApiResponse<AssignmentProposalCommandResult>,
    AssignmentProposalVersionCommand
  >(
    `${WORKFORCE_BASE}/assignment-proposals/${encodeURIComponent(proposalId)}/validate`,
    request,
    idempotentMutationConfig(authority, request.commandId)
  );
  return response.data.data;
}

export async function submitAssignmentProposal(
  proposalId: string,
  request: AssignmentProposalVersionCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<AssignmentProposalCommandResult> {
  if (authority.mode !== 'SECURE') {
    throw new Error('Assignment proposal submission requires secure step-up authority.');
  }
  const governed = productSurfaceHighRiskMutationConfig(authority, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<
    ApiResponse<AssignmentProposalCommandResult>,
    AssignmentProposalVersionCommand
  >(`${WORKFORCE_BASE}/assignment-proposals/${encodeURIComponent(proposalId)}/submit`, request, {
    ...governed,
    headers: {
      ...governed.headers,
      [PRODUCT_SURFACE_IDEMPOTENCY_KEY_HEADER]: request.commandId,
    },
  });
  return response.data.data;
}

export async function cancelAssignmentProposal(
  proposalId: string,
  request: CancelAssignmentProposalCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<AssignmentProposalCommandResult> {
  const response = await axiosInstance.post<
    ApiResponse<AssignmentProposalCommandResult>,
    CancelAssignmentProposalCommand
  >(
    `${WORKFORCE_BASE}/assignment-proposals/${encodeURIComponent(proposalId)}/cancel`,
    request,
    idempotentMutationConfig(authority, request.commandId)
  );
  return response.data.data;
}
