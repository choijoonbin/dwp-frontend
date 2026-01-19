import { axiosInstance } from '../axios-instance';

import type { Code } from '../admin/types';
import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------

/**
 * Code usage response structure
 * Maps groupKey to array of codes
 */
export type CodeUsageResponse = {
  [groupKey: string]: Code[];
};

/**
 * Get codes by resource key (usage-based)
 * GET /api/admin/codes/usage?resourceKey=...
 */
export const getCodesByResourceKey = async (resourceKey: string): Promise<ApiResponse<CodeUsageResponse>> => {
  const queryParams = new URLSearchParams();
  queryParams.append('resourceKey', resourceKey);

  const url = `/api/admin/codes/usage?${queryParams.toString()}`;
  const res = await axiosInstance.get<ApiResponse<CodeUsageResponse>>(url);
  return res.data;
};
