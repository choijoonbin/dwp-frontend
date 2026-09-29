import { axiosInstance, saveHrTimeEntry, submitHrTimeCard } from '@dwp-frontend/shared-utils';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type { TimeEntryCommandRequest } from '../model/hris-time-model';

export type HrisTimeDataSource = Readonly<{
  read: (contextScopeKey?: string, signal?: AbortSignal) => Promise<unknown>;
  saveEntry: (
    cardId: string,
    workDate: string,
    request: TimeEntryCommandRequest,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  submitCard: (
    cardId: string,
    version: number,
    authority: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
}>;

export async function readHrisTimeWorkspace(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>('/api/people/v1/hr/time', {
    ...(contextScopeKey ? { contextScopeKey } : {}),
    ...(signal ? { signal } : {}),
  });
  return response.data.data;
}

export const hrisTimeDataSource: HrisTimeDataSource = {
  read: readHrisTimeWorkspace,
  saveEntry: saveHrTimeEntry,
  submitCard: submitHrTimeCard,
};
