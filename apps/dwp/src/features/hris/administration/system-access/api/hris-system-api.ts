import {
  HttpTransportError,
  axiosInstance,
  createAppAdminPresetSelfServiceRequest,
  getAppAdminPresetAssignments,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { reconcileOwnerCommandReceipt } from '../model/hris-system-model';

import type { ApiResponse, AppAdminPresetAssignment } from '@dwp-frontend/shared-utils';
import type {
  HrisAccessSnapshot,
  HrisConfigurationProjection,
  OwnerAssignmentEvidence,
  OwnerCommandReceipt,
  OwnerRequestIdentity,
} from '../model/hris-system-model';

export const HRIS_ACCESS_SNAPSHOT_PATH = '/api/auth/hris/product-access/snapshot' as const;
export const HRIS_CONFIGURATION_PROJECTION_PATH =
  '/api/platform/v1/hris/configuration/projection' as const;

export type HrisSystemSnapshot = {
  access: HrisAccessSnapshot;
  projection: HrisConfigurationProjection;
};

export type HrisSystemDataSource = {
  load(contextScopeKey: string, signal: AbortSignal): Promise<HrisSystemSnapshot>;
};

export async function getHrisSystemSnapshot(
  contextScopeKey: string,
  signal: AbortSignal
): Promise<HrisSystemSnapshot> {
  const scopedRequest = productSurfaceReadScopeConfig(contextScopeKey, signal);
  const [access, projection] = await Promise.all([
    axiosInstance.get<ApiResponse<HrisAccessSnapshot>>(
      `${HRIS_ACCESS_SNAPSHOT_PATH}?view=system`,
      scopedRequest
    ),
    axiosInstance.get<ApiResponse<HrisConfigurationProjection>>(
      `${HRIS_CONFIGURATION_PROJECTION_PATH}?view=system`,
      scopedRequest
    ),
  ]);
  return { access: access.data.data, projection: projection.data.data };
}

export const hrisSystemDataSource: HrisSystemDataSource = {
  load: getHrisSystemSnapshot,
};

export type OwnerSelfServiceRequest = OwnerRequestIdentity & {
  justification: string;
};

export type OwnerCommandDependencies = {
  submit(
    payload: OwnerSelfServiceRequest,
    idempotencyKey: string,
    correlationId?: string
  ): Promise<AppAdminPresetAssignment>;
  list(): Promise<AppAdminPresetAssignment[]>;
};

const ownerDependencies: OwnerCommandDependencies = {
  submit: createAppAdminPresetSelfServiceRequest,
  list: getAppAdminPresetAssignments,
};

export async function submitOwnerSelfServiceRequest(
  payload: OwnerSelfServiceRequest,
  idempotencyKey: string,
  correlationId?: string,
  dependencies: OwnerCommandDependencies = ownerDependencies
): Promise<OwnerCommandReceipt> {
  const request: OwnerRequestIdentity = {
    presetCode: payload.presetCode,
    resourceSetId: payload.resourceSetId,
    validTo: payload.validTo,
    reviewDueAt: payload.reviewDueAt,
  };
  try {
    const assignment = await dependencies.submit(payload, idempotencyKey, correlationId);
    return {
      idempotencyKey,
      request,
      status: 'CONFIRMED',
      presetAssignmentId: assignment.presetAssignmentId,
    };
  } catch (error) {
    if (error instanceof HttpTransportError && error.reason !== 'ABORT') {
      // Do not resubmit automatically: the server may have committed the first request.
      return { idempotencyKey, request, status: 'RESULT_UNKNOWN' };
    }
    throw error;
  }
}

export async function reconcileOwnerSelfServiceRequest(
  receipt: OwnerCommandReceipt,
  dependencies: OwnerCommandDependencies = ownerDependencies
): Promise<OwnerCommandReceipt> {
  const assignments: OwnerAssignmentEvidence[] = (await dependencies.list()).map((assignment) => ({
    presetAssignmentId: assignment.presetAssignmentId,
    presetCode: assignment.presetCode,
    resourceSetId: assignment.resourceSetId,
    validTo: assignment.validTo,
    reviewDueAt: assignment.reviewDueAt,
    requestChannel: assignment.requestChannel,
    lifecycleState: assignment.lifecycleState,
  }));
  return reconcileOwnerCommandReceipt(receipt, assignments);
}
