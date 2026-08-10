import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type NavigationLabel = {
  locale: string;
  label: string;
  description?: string | null;
};

export type NavigationNode = {
  navigationItemId: number;
  navigationKey: string;
  itemType: 'GROUP' | 'APP';
  parentNavigationItemId?: number | null;
  registryEntryKey?: string | null;
  route?: string | null;
  iconKey?: string | null;
  requiredResourceKey?: string | null;
  requiredPermissionCode: string;
  sortOrder: number;
  lifecycleState: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  version: number;
  labels: NavigationLabel[];
  children: NavigationNode[];
};

export type CreateNavigationRequest = {
  navigationKey: string;
  itemType: NavigationNode['itemType'];
  parentNavigationItemId?: number | null;
  registryEntryKey?: string;
  route?: string;
  iconKey?: string;
  requiredResourceKey?: string;
  requiredPermissionCode?: string;
  sortOrder: number;
  labels: NavigationLabel[];
};

export type UpdateNavigationRequest = Omit<
  CreateNavigationRequest,
  'navigationKey' | 'itemType'
> & {
  requiredPermissionCode: string;
  version: number;
};

const BASE = '/api/platform/v1/admin/navigation';

export async function listNavigationTree(): Promise<NavigationNode[]> {
  const response = await axiosInstance.get<ApiResponse<NavigationNode[]>>(BASE);
  return response.data.data;
}

export async function createNavigationItem(
  request: CreateNavigationRequest
): Promise<NavigationNode> {
  const response = await axiosInstance.post<ApiResponse<NavigationNode>, CreateNavigationRequest>(
    BASE,
    request
  );
  return response.data.data;
}

export async function updateNavigationItem(
  itemId: number,
  request: UpdateNavigationRequest
): Promise<NavigationNode> {
  const response = await axiosInstance.put<ApiResponse<NavigationNode>, UpdateNavigationRequest>(
    `${BASE}/${itemId}`,
    request
  );
  return response.data.data;
}

export async function changeNavigationLifecycle(
  item: NavigationNode,
  state: 'ACTIVE' | 'RETIRED'
): Promise<NavigationNode> {
  const response = await axiosInstance.post<ApiResponse<NavigationNode>, { version: number }>(
    `${BASE}/${item.navigationItemId}/${state === 'ACTIVE' ? 'activate' : 'retire'}`,
    { version: item.version }
  );
  return response.data.data;
}

export async function reorderNavigation(
  items: Array<{
    navigationItemId: number;
    parentNavigationItemId?: number | null;
    sortOrder: number;
    version: number;
  }>
): Promise<NavigationNode[]> {
  const response = await axiosInstance.put<ApiResponse<NavigationNode[]>, { items: typeof items }>(
    `${BASE}/order`,
    { items }
  );
  return response.data.data;
}
