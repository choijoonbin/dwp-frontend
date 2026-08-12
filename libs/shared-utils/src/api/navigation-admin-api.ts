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

export type NavigationValidationIssue = {
  severity: 'ERROR' | 'WARNING';
  code: string;
  navigationItemId?: number | null;
  navigationKey?: string | null;
  message: string;
};

export type NavigationValidationReport = {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: NavigationValidationIssue[];
  checkedAt: string;
};

export type NavigationDiffSummary = {
  added: number;
  removed: number;
  changed: number;
  reordered: number;
  lifecycleChanged: number;
};

export type NavigationRevision = {
  navigationRevisionId: string;
  revisionNumber: number;
  lifecycleState: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'CANCELLED';
  baselineRevisionId?: string | null;
  baselineTreeHash: string;
  tree: NavigationNode[];
  validation: NavigationValidationReport;
  diff: NavigationDiffSummary;
  changeSummary?: string | null;
  version: number;
  createdAt: string;
  createdBy?: number | null;
  updatedAt: string;
  publishedAt?: string | null;
  publishedBy?: number | null;
};

export type NavigationStudioWorkspace = {
  published: NavigationRevision;
  draft?: NavigationRevision | null;
  history: NavigationRevision[];
  currentTree: NavigationNode[];
  currentValidation: NavigationValidationReport;
};

const BASE = '/api/platform/v1/admin/navigation';
const STUDIO_BASE = `${BASE}/studio`;

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

export async function getNavigationStudio(): Promise<NavigationStudioWorkspace> {
  const response = await axiosInstance.get<ApiResponse<NavigationStudioWorkspace>>(STUDIO_BASE);
  return response.data.data;
}

export async function createNavigationDraft(changeSummary?: string): Promise<NavigationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<NavigationRevision>,
    { changeSummary?: string }
  >(`${STUDIO_BASE}/drafts`, { changeSummary });
  return response.data.data;
}

export async function saveNavigationDraft(
  revisionId: string,
  request: { tree: NavigationNode[]; changeSummary?: string; version: number }
): Promise<NavigationRevision> {
  const response = await axiosInstance.put<ApiResponse<NavigationRevision>, typeof request>(
    `${STUDIO_BASE}/drafts/${revisionId}`,
    request
  );
  return response.data.data;
}

export async function publishNavigationDraft(
  revisionId: string,
  version: number
): Promise<NavigationRevision> {
  const response = await axiosInstance.post<ApiResponse<NavigationRevision>, { version: number }>(
    `${STUDIO_BASE}/drafts/${revisionId}/publish`,
    { version }
  );
  return response.data.data;
}

export async function cancelNavigationDraft(
  revisionId: string,
  version: number
): Promise<NavigationRevision> {
  const response = await axiosInstance.post<ApiResponse<NavigationRevision>, { version: number }>(
    `${STUDIO_BASE}/drafts/${revisionId}/cancel`,
    { version }
  );
  return response.data.data;
}

export async function restoreNavigationRevision(
  revisionId: string,
  changeSummary?: string
): Promise<NavigationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<NavigationRevision>,
    { changeSummary?: string }
  >(`${STUDIO_BASE}/revisions/${revisionId}/restore`, { changeSummary });
  return response.data.data;
}
