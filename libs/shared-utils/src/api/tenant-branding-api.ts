import { API_URL } from '../env';
import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type TenantBranding = {
  organizationName?: string | null;
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

export function resolveTenantLogoUrl(branding?: TenantBranding | null): string | null {
  return branding?.logoUrl ? API_URL + branding.logoUrl : null;
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
  version: number
): Promise<TenantBranding> {
  const response = await axiosInstance.put<
    ApiResponse<TenantBranding>,
    { organizationName: string | null; version: number }
  >('/api/platform/v1/admin/tenant-branding', { organizationName, version });
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
