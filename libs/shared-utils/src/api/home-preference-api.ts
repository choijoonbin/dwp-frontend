import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type HomeWidgetKey = 'announcements' | 'daily-brief' | 'focus' | 'schedule' | 'activity';

export type HomeWidgetPreference = {
  widgetKey: HomeWidgetKey;
  visible: boolean;
};

export type HomePreferenceLayout = {
  appLayout: unknown | null;
  widgets: HomeWidgetPreference[];
};

export type HomePreference = {
  schemaVersion: 1;
  customized: boolean;
  layout: HomePreferenceLayout;
  version: number;
  updatedAt?: string | null;
};

export async function getHomePreference(): Promise<HomePreference> {
  const response = await axiosInstance.get<ApiResponse<HomePreference>>(
    '/api/platform/v1/home-preferences'
  );
  return response.data.data;
}

export async function updateHomePreference(
  layout: HomePreferenceLayout,
  version: number
): Promise<HomePreference> {
  const response = await axiosInstance.put<
    ApiResponse<HomePreference>,
    { layout: HomePreferenceLayout; version: number }
  >('/api/platform/v1/home-preferences', { layout, version });
  return response.data.data;
}

export async function resetHomePreference(version: number): Promise<HomePreference> {
  const response = await axiosInstance.post<ApiResponse<HomePreference>, { version: number }>(
    '/api/platform/v1/home-preferences/reset',
    { version }
  );
  return response.data.data;
}
