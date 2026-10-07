import { axiosInstance } from '@dwp-frontend/shared-utils/axios-instance';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { ApiResponse, HrPayWorkspace } from '@dwp-frontend/shared-utils';

export const HRIS_PAYROLL_WORKSPACE_API_PATH = '/api/people/v1/hr/pay' as const;

export async function getHrisPayrollWorkspace(
  contextScopeKey: string | undefined,
  signal: AbortSignal
): Promise<HrPayWorkspace> {
  const response = await axiosInstance.get<ApiResponse<HrPayWorkspace>>(
    HRIS_PAYROLL_WORKSPACE_API_PATH,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}
