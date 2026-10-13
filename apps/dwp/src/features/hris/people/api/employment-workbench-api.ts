import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { EmploymentOwnerRef } from '../../employment/assignment-proposal-model';

export const EMPLOYMENT_DOCUMENTS_PATH =
  '/api/people/v1/hris/workbench/self-service/employment-documents' as const;
export const EMPLOYMENT_ASSIGNMENTS_PATH =
  '/api/people/v1/hris/workbench/operations/employment/assignments' as const;

export type EmploymentDocument = Readonly<{
  workerPublicId: string;
  relationshipPublicId: string;
  assignmentPublicId: string;
  relationshipType: string;
  validFrom: string;
  validToExclusive: string | null;
  status: string;
  revision: number;
}>;

export type EmploymentDocumentsWorkbench = Readonly<{
  asOf: string;
  documents: readonly EmploymentDocument[];
}>;

export type EmploymentWorkbenchOwnerRef = EmploymentOwnerRef &
  Readonly<{ validFrom: string | null; validToExclusive: string | null }>;

export type EmploymentAssignment = Readonly<{
  personPublicId: string;
  workerPublicId: string;
  workerStatus: string;
  workerVersion: number;
  relationshipPublicId: string;
  relationshipType: string;
  relationshipStart: string;
  relationshipEnd: string | null;
  relationshipVersion: number;
  assignmentPublicId: string;
  assignmentStatus: string;
  validFrom: string;
  validToExclusive: string | null;
  primary: boolean;
  fte: string;
  assignmentVersion: number;
  legalEmployerRef: EmploymentWorkbenchOwnerRef;
  organizationRef: EmploymentWorkbenchOwnerRef;
  positionRef: EmploymentWorkbenchOwnerRef;
  jobRef: EmploymentWorkbenchOwnerRef;
  workLocationRef: EmploymentWorkbenchOwnerRef;
}>;

export type EmploymentAssignmentsWorkbench = Readonly<{
  asOf: string;
  assignments: readonly EmploymentAssignment[];
}>;

function workbenchPath(path: string, asOf?: string): string {
  return asOf ? `${path}?asOf=${encodeURIComponent(asOf)}` : path;
}

export async function getEmploymentDocumentsWorkbench(
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
): Promise<EmploymentDocumentsWorkbench> {
  const response = await axiosInstance.get<EmploymentDocumentsWorkbench>(
    workbenchPath(EMPLOYMENT_DOCUMENTS_PATH, asOf),
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data;
}

export async function getEmploymentAssignmentsWorkbench(
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
): Promise<EmploymentAssignmentsWorkbench> {
  const response = await axiosInstance.get<EmploymentAssignmentsWorkbench>(
    workbenchPath(EMPLOYMENT_ASSIGNMENTS_PATH, asOf),
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data;
}
