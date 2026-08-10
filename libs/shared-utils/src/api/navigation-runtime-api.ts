import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type RuntimeNavigationNode = {
  navigationKey: string;
  itemType: 'GROUP' | 'APP';
  label: string;
  description?: string | null;
  registryEntryKey?: string | null;
  route?: string | null;
  iconKey?: string | null;
  requiredResourceKey?: string | null;
  requiredPermissionCode: string;
  children: RuntimeNavigationNode[];
};

export async function listRuntimeNavigation(locale: string): Promise<RuntimeNavigationNode[]> {
  const response = await axiosInstance.get<ApiResponse<RuntimeNavigationNode[]>>(
    `/api/platform/v1/navigation?locale=${encodeURIComponent(locale)}`
  );
  return response.data.data;
}
