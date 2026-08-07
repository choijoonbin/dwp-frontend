import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { AuthPolicyResponse, IdentityProviderResponse } from '../auth/auth-policy-types';

export async function getAuthPolicy(): Promise<ApiResponse<AuthPolicyResponse>> {
  return (await axiosInstance.get<ApiResponse<AuthPolicyResponse>>('/api/auth/policy')).data;
}

export async function getIdentityProviders(): Promise<ApiResponse<IdentityProviderResponse[]>> {
  return (await axiosInstance.get<ApiResponse<IdentityProviderResponse[]>>('/api/auth/idp')).data;
}
