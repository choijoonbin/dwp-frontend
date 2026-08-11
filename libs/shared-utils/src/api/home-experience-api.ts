import { API_URL } from '../env';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type HomeBackgroundPosition = 'LEFT' | 'CENTER' | 'RIGHT';

export type HomeExperience = {
  headline?: string | null;
  subheadline?: string | null;
  backgroundPosition: HomeBackgroundPosition;
  overlayOpacity: number;
  backgroundUrl?: string | null;
  backgroundOriginalName?: string | null;
  backgroundContentType?: string | null;
  backgroundSizeBytes?: number | null;
  backgroundWidth?: number | null;
  backgroundHeight?: number | null;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type UpdateHomeExperienceRequest = Pick<
  HomeExperience,
  'headline' | 'subheadline' | 'backgroundPosition' | 'overlayOpacity' | 'version'
>;

export const DEFAULT_HOME_BACKGROUND_URL = '/assets/home/default/agentic-workspace-hero.png';

export function resolveHomeBackgroundUrl(experience?: HomeExperience | null): string {
  return experience?.backgroundUrl
    ? API_URL + experience.backgroundUrl
    : DEFAULT_HOME_BACKGROUND_URL;
}

export function resolveAdminHomeBackgroundUrl(experience?: HomeExperience | null): string {
  return experience?.backgroundUrl
    ? API_URL +
        experience.backgroundUrl.replace('/v1/home-experience/', '/v1/admin/home-experience/')
    : DEFAULT_HOME_BACKGROUND_URL;
}

export async function getHomeExperience(): Promise<HomeExperience> {
  const response = await axiosInstance.get<ApiResponse<HomeExperience>>(
    '/api/platform/v1/home-experience'
  );
  return response.data.data;
}

export async function getAdminHomeExperience(): Promise<HomeExperience> {
  const response = await axiosInstance.get<ApiResponse<HomeExperience>>(
    '/api/platform/v1/admin/home-experience'
  );
  return response.data.data;
}

export async function updateHomeExperience(
  request: UpdateHomeExperienceRequest
): Promise<HomeExperience> {
  const response = await axiosInstance.put<
    ApiResponse<HomeExperience>,
    UpdateHomeExperienceRequest
  >('/api/platform/v1/admin/home-experience', request);
  return response.data.data;
}

export async function uploadHomeBackground(file: File, version: number): Promise<HomeExperience> {
  const form = new FormData();
  form.set('file', file);
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, FormData>(
    `/api/platform/v1/admin/home-experience/background?version=${version}`,
    form
  );
  return response.data.data;
}

export async function resetHomeBackground(version: number): Promise<HomeExperience> {
  const response = await axiosInstance.post<ApiResponse<HomeExperience>, { version: number }>(
    '/api/platform/v1/admin/home-experience/background/reset',
    { version }
  );
  return response.data.data;
}
