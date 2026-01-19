import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { AuthPolicyResponse, IdentityProviderResponse } from '../auth/auth-policy-types';

// ----------------------------------------------------------------------

/**
 * Get auth policy for tenant
 * GET /api/auth/policy
 */
export const getAuthPolicy = async (): Promise<ApiResponse<AuthPolicyResponse>> => {
  const res = await axiosInstance.get<ApiResponse<AuthPolicyResponse>>('/api/auth/policy');
  return res.data;
};

/**
 * Get identity provider configuration
 * GET /api/auth/idp
 */
export const getIdentityProvider = async (): Promise<ApiResponse<IdentityProviderResponse>> => {
  const res = await axiosInstance.get<ApiResponse<IdentityProviderResponse>>('/api/auth/idp');
  return res.data;
};
