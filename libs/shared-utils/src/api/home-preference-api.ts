import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type HomeWidgetKey = 'command-rail' | 'daily-brief' | 'focus' | 'schedule' | 'activity';
export type HomeSurfaceKey = 'workspace-home' | 'hcm-home' | 'approval-home' | 'hris-home'; // Compatibility alias accepted by the server during the HCM transition.
export type HomePresentation = 'balanced' | 'expressive' | 'focused';
export type HomeWidgetSize = 'fifth' | 'quarter' | 'compact' | 'medium' | 'large' | 'full';
export type HomeWidgetHeight = 'short' | 'standard' | 'tall' | 'expanded';

export type PersonalHomeWidgetPreference<WidgetKey extends string = string> = {
  widgetKey: WidgetKey;
  visible: boolean;
  size?: HomeWidgetSize | null;
  height?: HomeWidgetHeight | null;
};

export type HomeWidgetPreference = PersonalHomeWidgetPreference<HomeWidgetKey>;

export const WORKSPACE_HOME_WIDGET_SIZE_CONTRACT = {
  'command-rail': ['large', 'full'],
  activity: ['fifth', 'quarter', 'compact', 'medium'],
  focus: ['quarter', 'compact', 'medium', 'large', 'full'],
  schedule: ['fifth', 'quarter', 'compact', 'medium'],
  'daily-brief': ['compact', 'large', 'full'],
} as const satisfies Record<HomeWidgetKey, readonly HomeWidgetSize[]>;

export function isWorkspaceHomeWidgetSizeAllowed(
  widgetKey: HomeWidgetKey,
  size: string | null | undefined
): size is HomeWidgetSize {
  return Boolean(
    size && (WORKSPACE_HOME_WIDGET_SIZE_CONTRACT[widgetKey] as readonly string[]).includes(size)
  );
}

export type HomePreferenceLayout<WidgetKey extends string = HomeWidgetKey> = {
  appLayout: unknown | null;
  presentation?: HomePresentation | null;
  widgets: PersonalHomeWidgetPreference<WidgetKey>[];
};

export type HomePreference<WidgetKey extends string = HomeWidgetKey> = {
  schemaVersion: 5;
  surfaceKey: HomeSurfaceKey;
  customized: boolean;
  layout: HomePreferenceLayout<WidgetKey>;
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

export async function getHomeSurfacePreference<WidgetKey extends string>(
  surfaceKey: HomeSurfaceKey
): Promise<HomePreference<WidgetKey>> {
  const response = await axiosInstance.get<ApiResponse<HomePreference<WidgetKey>>>(
    `/api/platform/v1/home-preferences/surfaces/${surfaceKey}`
  );
  return response.data.data;
}

export async function updateHomeSurfacePreference<WidgetKey extends string>(
  surfaceKey: HomeSurfaceKey,
  layout: HomePreferenceLayout<WidgetKey>,
  version: number
): Promise<HomePreference<WidgetKey>> {
  const response = await axiosInstance.put<
    ApiResponse<HomePreference<WidgetKey>>,
    { layout: HomePreferenceLayout<WidgetKey>; version: number }
  >(`/api/platform/v1/home-preferences/surfaces/${surfaceKey}`, { layout, version });
  return response.data.data;
}

export async function resetHomeSurfacePreference<WidgetKey extends string>(
  surfaceKey: HomeSurfaceKey,
  version: number
): Promise<HomePreference<WidgetKey>> {
  const response = await axiosInstance.post<
    ApiResponse<HomePreference<WidgetKey>>,
    { version: number }
  >(`/api/platform/v1/home-preferences/surfaces/${surfaceKey}/reset`, { version });
  return response.data.data;
}
