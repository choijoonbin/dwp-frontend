import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type WorkforceReferenceOwnership = 'TENANT' | 'PRODUCT';

export type WorkforceReferenceValue = {
  code: string;
  displayName: string;
  description?: string | null;
  labels: Record<string, string>;
  localizedLabel: string;
  sortOrder: number;
  lifecycleState: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  predefined: boolean;
  detail?: string | null;
  version: number;
};

export type WorkforceReferenceCatalog = {
  catalogKey:
    | 'ORGANIZATION_TYPE'
    | 'JOB_GRADE'
    | 'ASSIGNMENT_REASON'
    | 'ORGANIZATION_ROLE'
    | 'POSITION_TYPE'
    | 'POSITION_CRITICALITY'
    | 'APPROVAL_ROLE';
  ownership: WorkforceReferenceOwnership;
  editable: boolean;
  values: WorkforceReferenceValue[];
};

export type UpdateWorkforceReferenceValue = {
  displayName: string;
  description?: string;
  labels: Record<string, string>;
  lifecycleState: 'ACTIVE' | 'INACTIVE';
  version: number;
};

const WORKFORCE_REFERENCE_BASE = '/api/people/v1/workforce/reference-data';

export async function listWorkforceReferenceCatalogs(
  locale: string
): Promise<WorkforceReferenceCatalog[]> {
  const search = new URLSearchParams({ locale });
  const response = await axiosInstance.get<ApiResponse<WorkforceReferenceCatalog[]>>(
    `${WORKFORCE_REFERENCE_BASE}?${search.toString()}`
  );
  return response.data.data;
}

export async function updateWorkforceReferenceValue(
  catalogKey: WorkforceReferenceCatalog['catalogKey'],
  code: string,
  locale: string,
  request: UpdateWorkforceReferenceValue
): Promise<WorkforceReferenceValue> {
  const search = new URLSearchParams({ locale });
  const response = await axiosInstance.put<
    ApiResponse<WorkforceReferenceValue>,
    UpdateWorkforceReferenceValue
  >(
    `${WORKFORCE_REFERENCE_BASE}/${encodeURIComponent(catalogKey)}/${encodeURIComponent(code)}?${search.toString()}`,
    request
  );
  return response.data.data;
}
