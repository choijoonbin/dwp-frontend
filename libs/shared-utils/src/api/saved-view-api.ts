import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type SavedViewScope = 'PERSONAL' | 'TENANT';
export type SavedViewConfiguration = Record<string, unknown>;

export type GovernedSavedView = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: SavedViewScope;
  ownerUserId: number;
  editable: boolean;
  favorite: boolean;
  defaultView: boolean;
  configuration: SavedViewConfiguration;
  version: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSavedViewRequest = {
  name: string;
  scope: SavedViewScope;
  configuration: SavedViewConfiguration;
  favorite: boolean;
  defaultView: boolean;
};

export type UpdateSavedViewRequest = Pick<
  CreateSavedViewRequest,
  'name' | 'scope' | 'configuration'
> & { version: number };

export async function getSavedViews(surfaceKey: string): Promise<GovernedSavedView[]> {
  const response = await axiosInstance.get<ApiResponse<GovernedSavedView[]>>(
    `/api/platform/v1/workspace/saved-views?surfaceKey=${encodeURIComponent(surfaceKey)}`
  );
  return response.data.data;
}

export async function createSavedView(
  surfaceKey: string,
  request: CreateSavedViewRequest
): Promise<GovernedSavedView> {
  const response = await axiosInstance.post<ApiResponse<GovernedSavedView>, CreateSavedViewRequest>(
    `/api/platform/v1/workspace/saved-views?surfaceKey=${encodeURIComponent(surfaceKey)}`,
    request,
    undefined
  );
  return response.data.data;
}

export async function updateSavedView(
  savedViewId: string,
  request: UpdateSavedViewRequest
): Promise<GovernedSavedView> {
  const response = await axiosInstance.put<ApiResponse<GovernedSavedView>, UpdateSavedViewRequest>(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}`,
    request
  );
  return response.data.data;
}

export async function deleteSavedView(savedViewId: string): Promise<void> {
  await axiosInstance.delete(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}`
  );
}

export async function updateSavedViewPreference(
  savedViewId: string,
  preference: { favorite: boolean; defaultView: boolean }
): Promise<GovernedSavedView> {
  const response = await axiosInstance.put<
    ApiResponse<GovernedSavedView>,
    { favorite: boolean; defaultView: boolean }
  >(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}/preference`,
    preference
  );
  return response.data.data;
}

export async function markSavedViewUsed(savedViewId: string): Promise<void> {
  await axiosInstance.post(
    `/api/platform/v1/workspace/saved-views/${encodeURIComponent(savedViewId)}/use`,
    undefined
  );
}
