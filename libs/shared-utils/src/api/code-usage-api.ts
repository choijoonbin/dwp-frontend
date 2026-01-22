import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  Code,
  PageResponse,
  CodeUsageDetail,
  CodeUsageSummary,
  CodeUsageListParams,
  CodeUsageCreatePayload,
  CodeUsageUpdatePayload,
} from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Code usage response structure
 * Maps groupKey to array of codes
 */
export type CodeUsageResponse = {
  [groupKey: string]: Code[];
};

/**
 * Backend code response structure
 * Backend returns: { codes: { [groupKey]: [{ sysCodeId, code, name, ... }] } }
 */
type BackendCodeResponse = {
  codes: {
    [groupKey: string]: Array<{
      sysCodeId: number;
      code: string;
      name: string;
      description?: string | null;
      sortOrder?: number | null;
      enabled: boolean;
      ext1?: string | null;
      ext2?: string | null;
      ext3?: string | null;
    }>;
  };
};

/**
 * Get codes by resource key (usage-based)
 * GET /api/admin/codes/usage?resourceKey=...
 * 
 * Backend response format:
 * {
 *   "data": {
 *     "codes": {
 *       "USER_STATUS": [{ sysCodeId, code, name, ... }],
 *       "LOGIN_TYPE": [{ sysCodeId, code, name, ... }]
 *     }
 *   }
 * }
 * 
 * Converts to frontend format:
 * {
 *   "data": {
 *     "USER_STATUS": [{ id, codeKey, codeName, ... }],
 *     "LOGIN_TYPE": [{ id, codeKey, codeName, ... }]
 *   }
 * }
 */
export const getCodesByResourceKey = async (resourceKey: string): Promise<ApiResponse<CodeUsageResponse>> => {
  const queryParams = new URLSearchParams();
  queryParams.append('resourceKey', resourceKey);

  const url = `/api/admin/codes/usage?${queryParams.toString()}`;
  const res = await axiosInstance.get<ApiResponse<BackendCodeResponse>>(url);
  
  // Transform backend response to frontend format
  if (res.data.data && res.data.data.codes) {
    const backendCodes = res.data.data.codes;
    const frontendCodes: CodeUsageResponse = {};
    
    // Convert each code group
    Object.keys(backendCodes).forEach((groupKey) => {
      frontendCodes[groupKey] = backendCodes[groupKey].map((backendCode) => ({
        id: backendCode.sysCodeId.toString(),
        groupKey,
        codeKey: backendCode.code,
        codeName: backendCode.name,
        codeValue: null,
        description: backendCode.description || null,
        sortOrder: backendCode.sortOrder || null,
        enabled: backendCode.enabled,
        createdAt: '', // Not provided by backend
      }));
    });
    
    return {
      ...res.data,
      data: frontendCodes,
    };
  }
  
  // Fallback: return empty object if structure doesn't match
  return {
    ...res.data,
    data: {},
  } as ApiResponse<CodeUsageResponse>;
};

// ============================================================================
// Code Usages CRUD API
// ============================================================================

/**
 * Get code usages list
 * GET /api/admin/code-usages
 */
export const getCodeUsages = async (
  params?: CodeUsageListParams
): Promise<ApiResponse<PageResponse<CodeUsageSummary>>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.keyword) queryParams.append('keyword', params.keyword);
  if (params?.resourceKey) queryParams.append('resourceKey', params.resourceKey);
  if (params?.codeGroupKey) queryParams.append('codeGroupKey', params.codeGroupKey);
  if (params?.enabled !== undefined) queryParams.append('enabled', params.enabled.toString());

  const url = `/api/admin/code-usages${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<PageResponse<CodeUsageSummary>>>(url);
  return res.data;
};

/**
 * Get code usage detail
 * GET /api/admin/code-usages/:id
 */
export const getCodeUsageDetail = async (id: string): Promise<ApiResponse<CodeUsageDetail>> => {
  const res = await axiosInstance.get<ApiResponse<CodeUsageDetail>>(`/api/admin/code-usages/${id}`);
  return res.data;
};

/**
 * Create code usage
 * POST /api/admin/code-usages
 */
export const createCodeUsage = async (payload: CodeUsageCreatePayload): Promise<ApiResponse<CodeUsageDetail>> => {
  const res = await axiosInstance.post<ApiResponse<CodeUsageDetail>>('/api/admin/code-usages', payload);
  return res.data;
};

/**
 * Update code usage
 * PUT /api/admin/code-usages/:id
 */
export const updateCodeUsage = async (
  id: string,
  payload: CodeUsageUpdatePayload
): Promise<ApiResponse<CodeUsageDetail>> => {
  const res = await axiosInstance.post<ApiResponse<CodeUsageDetail>>(`/api/admin/code-usages/${id}`, payload);
  return res.data;
};

/**
 * Delete code usage
 * DELETE /api/admin/code-usages/:id
 */
export const deleteCodeUsage = async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
  const res = await axiosInstance.post<ApiResponse<{ success: boolean }>>(`/api/admin/code-usages/${id}/delete`, {});
  return res.data;
};
