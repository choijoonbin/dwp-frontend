import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type WorkforceAccessPolicy = {
  policyId: string;
  subjectType: 'ROLE' | 'USER';
  subjectRef: string;
  populationType: 'TENANT' | 'ORG_UNIT' | 'ORG_TREE';
  organizationId?: string | null;
  organizationName?: string | null;
  fieldGroups: Array<'DIRECTORY' | 'WORKER_IDENTIFIERS' | 'EMPLOYMENT' | 'JOB_GRADE'>;
  actionCodes: Array<'READ' | 'EXPORT'>;
  validFrom?: string | null;
  validTo?: string | null;
  lifecycleState: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  justification: string;
  version: number;
};

export type WorkforceOrganizationOption = {
  organizationId: string;
  organizationKey: string;
  name: string;
  parentOrganizationId?: string | null;
};

export type CreateWorkforceAccessPolicyRequest = {
  subjectType: 'ROLE' | 'USER';
  subjectRef: string;
  populationType: 'TENANT' | 'ORG_UNIT' | 'ORG_TREE';
  organizationId?: string;
  fieldGroups: WorkforceAccessPolicy['fieldGroups'];
  actionCodes: WorkforceAccessPolicy['actionCodes'];
  validFrom?: string;
  validTo?: string;
  justification: string;
};

const BASE = '/api/people/v1/admin/workforce/access-policies';

export async function listWorkforceAccessPolicies(): Promise<WorkforceAccessPolicy[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceAccessPolicy[]>>(BASE);
  return response.data.data;
}

export async function listWorkforcePolicyOrganizations(): Promise<WorkforceOrganizationOption[]> {
  const response = await axiosInstance.get<ApiResponse<WorkforceOrganizationOption[]>>(
    `${BASE}/organizations`
  );
  return response.data.data;
}

export async function createWorkforceAccessPolicy(
  request: CreateWorkforceAccessPolicyRequest
): Promise<WorkforceAccessPolicy> {
  const response = await axiosInstance.post<
    ApiResponse<WorkforceAccessPolicy>,
    CreateWorkforceAccessPolicyRequest
  >(BASE, request);
  return response.data.data;
}

export async function revokeWorkforceAccessPolicy(
  policy: WorkforceAccessPolicy,
  reason: string
): Promise<WorkforceAccessPolicy> {
  const response = await axiosInstance.patch<
    ApiResponse<WorkforceAccessPolicy>,
    { version: number; reason: string }
  >(`${BASE}/${policy.policyId}/revoke`, { version: policy.version, reason });
  return response.data.data;
}
