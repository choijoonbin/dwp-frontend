import { axiosInstance } from '../axios-instance';
import { decodeTenantExperiencePreview } from './tenant-experience-preview-contract';

import type { ApiResponse } from '../types';
import type { TenantExperiencePreview } from './tenant-experience-preview-model';

export type { TenantExperiencePreview } from './tenant-experience-preview-model';

export async function getTenantExperiencePreview(
  signal?: AbortSignal
): Promise<TenantExperiencePreview> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    '/api/platform/v1/admin/tenant-experience-preview',
    { signal }
  );
  return decodeTenantExperiencePreview(response.data.data);
}
