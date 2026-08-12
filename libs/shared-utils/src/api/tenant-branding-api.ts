import { API_URL } from '../env';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type TenantBranding = {
  organizationName?: string | null;
  accentColor: string;
  logoUrl?: string | null;
  logoOriginalName?: string | null;
  logoContentType?: string | null;
  logoSizeBytes?: number | null;
  logoWidth?: number | null;
  logoHeight?: number | null;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type TenantBrandingRevision = {
  revisionId: number;
  sourceVersion: number;
  changeType: 'BASELINE' | 'SETTINGS_PUBLISHED' | 'ASSET_PUBLISHED' | 'ASSET_RESET' | 'ROLLBACK';
  organizationName?: string | null;
  accentColor: string;
  logoOriginalName?: string | null;
  logoWidth?: number | null;
  logoHeight?: number | null;
  current: boolean;
  createdAt: string;
  createdBy?: number | null;
};

export function resolveTenantLogoUrl(branding?: TenantBranding | null): string | null {
  return branding?.logoUrl ? API_URL + branding.logoUrl : null;
}

export function resolveAdminTenantLogoUrl(branding?: TenantBranding | null): string | null {
  return branding?.logoUrl
    ? API_URL + branding.logoUrl.replace('/v1/tenant-branding/', '/v1/admin/tenant-branding/')
    : null;
}

export async function getTenantBranding(): Promise<TenantBranding> {
  const response = await axiosInstance.get<ApiResponse<TenantBranding>>(
    '/api/platform/v1/tenant-branding'
  );
  return response.data.data;
}

export async function getAdminTenantBranding(): Promise<TenantBranding> {
  const response = await axiosInstance.get<ApiResponse<TenantBranding>>(
    '/api/platform/v1/admin/tenant-branding'
  );
  return response.data.data;
}

export async function updateTenantBranding(
  organizationName: string | null,
  accentColor: string,
  version: number
): Promise<TenantBranding> {
  const response = await axiosInstance.put<
    ApiResponse<TenantBranding>,
    { organizationName: string | null; accentColor: string; version: number }
  >('/api/platform/v1/admin/tenant-branding', { organizationName, accentColor, version });
  return response.data.data;
}

export async function uploadTenantLogo(file: File, version: number): Promise<TenantBranding> {
  const form = new FormData();
  form.set('file', file);
  const response = await axiosInstance.post<ApiResponse<TenantBranding>, FormData>(
    `/api/platform/v1/admin/tenant-branding/logo?version=${version}`,
    form
  );
  return response.data.data;
}

export async function resetTenantLogo(version: number): Promise<TenantBranding> {
  const response = await axiosInstance.post<ApiResponse<TenantBranding>, { version: number }>(
    '/api/platform/v1/admin/tenant-branding/logo/reset',
    { version }
  );
  return response.data.data;
}

export async function getTenantBrandingRevisions(limit = 20): Promise<TenantBrandingRevision[]> {
  const response = await axiosInstance.get<ApiResponse<TenantBrandingRevision[]>>(
    `/api/platform/v1/admin/tenant-branding/revisions?limit=${limit}`
  );
  return response.data.data;
}

export async function rollbackTenantBranding(
  revisionId: number,
  version: number
): Promise<TenantBranding> {
  const response = await axiosInstance.post<ApiResponse<TenantBranding>, { version: number }>(
    `/api/platform/v1/admin/tenant-branding/revisions/${revisionId}/rollback`,
    { version }
  );
  return response.data.data;
}
