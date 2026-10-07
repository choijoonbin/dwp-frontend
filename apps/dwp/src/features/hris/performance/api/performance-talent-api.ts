import { axiosInstance, updateHrGoal } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { ApiResponse, HrTalentWorkspace } from '@dwp-frontend/shared-utils';

import type { PerformanceGoalUpdate } from '../model/performance-goal-model';

const PERFORMANCE_TALENT_PATH = '/api/people/v1/hr/talent';

export async function getScopedPerformanceTalent(
  contextScopeKey: string | undefined,
  signal: AbortSignal
): Promise<HrTalentWorkspace> {
  const response = await axiosInstance.get<ApiResponse<HrTalentWorkspace>>(
    PERFORMANCE_TALENT_PATH,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

// Keep the existing DWP governed mutation authority and Gateway client unchanged.
export function updateScopedPerformanceGoal(
  goalId: string,
  request: PerformanceGoalUpdate['request'],
  authority: Parameters<typeof updateHrGoal>[2]
): Promise<HrTalentWorkspace> {
  return updateHrGoal(goalId, request, authority);
}
