/**
 * SynapseX Admin - Tenant Scope & Catalog API
 * 분리 목적: synapse-admin-api.ts 400줄 이하 유지
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type TenantScopeCompanyCode = {
  bukrs: string;
  enabled: boolean;
  source?: 'MANUAL' | 'SEED' | 'SAP';
  bukrsName?: string;
  defaultCurrency?: string;
  isActive?: boolean;
};

export type TenantScopeCurrency = {
  waers: string;
  enabled: boolean;
  fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED';
};

export type TenantScopeSodRule = {
  ruleKey: string;
  title: string;
  description?: string;
  enabled: boolean;
  severity?: 'INFO' | 'WARN' | 'BLOCK';
  appliesTo?: string[];
};

export type TenantScopeMeta = {
  tenantId?: string | number;
  lastUpdatedAt?: string;
  seeded?: boolean;
  sodMode?: 'PLANNED' | 'BASELINE' | 'ENFORCED';
};

export type ProfileScopedCompanyCodeItem = {
  bukrs: string;
  bukrsName?: string;
  defaultCurrency?: string;
  isActive?: boolean;
  included: boolean;
  lastSyncTs?: string | null;
};

export type ProfileScopedCompanyCodesResponse = {
  lastUpdatedAt?: string | null;
  profileId?: number;
  items: ProfileScopedCompanyCodeItem[];
};

export type ProfileScopedCurrencyItem = {
  currencyCode: string;
  fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED';
  included: boolean;
  [key: string]: unknown;
};

export type ProfileScopedCurrenciesResponse = {
  lastUpdatedAt?: string | null;
  profileId?: number;
  items: ProfileScopedCurrencyItem[];
};

export type ProfileScopedSodRuleItem = {
  description?: string;
  isEnabled: boolean;
  ruleKey: string;
  severity?: 'INFO' | 'WARN' | 'BLOCK';
  title: string;
};

export type ProfileScopedSodRulesResponse = {
  lastUpdatedAt?: string | null;
  mode?: 'PLANNED' | 'BASELINE' | 'ENFORCED';
  profileId?: number;
  rules: ProfileScopedSodRuleItem[];
};

export type TenantScopeCompanyCodeCatalogItem = {
  bukrs: string;
  docCount?: number;
  lastSeenAt?: string;
};

export type TenantScopeCurrencyCatalogItem = {
  waers: string;
  docCount?: number;
  lastSeenAt?: string;
};

export type CatalogDto = {
  companyCodes: TenantScopeCompanyCodeCatalogItem[];
  currencies: TenantScopeCurrencyCatalogItem[];
};

export type TenantScopeResponseDto = {
  companyCodes: TenantScopeCompanyCode[];
  currencies: TenantScopeCurrency[];
  sodRules: TenantScopeSodRule[];
  meta?: TenantScopeMeta;
};

// ----------------------------------------------------------------------
// Profile-Scoped API
// ----------------------------------------------------------------------

export const getProfileScopedCompanyCodes = async (
  profileId?: string | null
): Promise<ApiResponse<ProfileScopedCompanyCodesResponse>> => {
  const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const res = await axiosInstance.get<
    ApiResponse<ProfileScopedCompanyCodesResponse>
  >(`/api/synapse/admin/tenant-scope/company-codes${params}`);
  return res.data;
};

export const putProfileScopedCompanyCodesBulk = async (
  profileId: string,
  updates: { bukrs: string; included: boolean }[]
): Promise<ApiResponse<ProfileScopedCompanyCodesResponse>> => {
  const res = await axiosInstance.put<
    ApiResponse<ProfileScopedCompanyCodesResponse>
  >('/api/synapse/admin/tenant-scope/company-codes/bulk', { profileId, updates });
  return res.data;
};

export const getProfileScopedCurrencies = async (
  profileId?: string | null
): Promise<ApiResponse<ProfileScopedCurrenciesResponse>> => {
  const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const res = await axiosInstance.get<
    ApiResponse<ProfileScopedCurrenciesResponse>
  >(`/api/synapse/admin/tenant-scope/currencies${params}`);
  return res.data;
};

export const putProfileScopedCurrenciesBulk = async (
  profileId: string,
  updates: { currencyCode: string; fxControlMode?: 'ALLOW' | 'FX_REQUIRED' | 'FX_LOCKED'; included: boolean }[]
): Promise<ApiResponse<ProfileScopedCurrenciesResponse>> => {
  const res = await axiosInstance.put<
    ApiResponse<ProfileScopedCurrenciesResponse>
  >('/api/synapse/admin/tenant-scope/currencies/bulk', { profileId, updates });
  return res.data;
};

export const getProfileScopedSodRules = async (
  profileId?: string | null
): Promise<ApiResponse<ProfileScopedSodRulesResponse>> => {
  const params = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
  const res = await axiosInstance.get<
    ApiResponse<ProfileScopedSodRulesResponse>
  >(`/api/synapse/admin/tenant-scope/sod-rules${params}`);
  return res.data;
};

export const putProfileScopedSodRulesBulk = async (
  profileId: string,
  updates: { ruleKey: string; isEnabled: boolean; severity?: 'INFO' | 'WARN' | 'BLOCK' }[]
): Promise<ApiResponse<ProfileScopedSodRulesResponse>> => {
  const res = await axiosInstance.put<
    ApiResponse<ProfileScopedSodRulesResponse>
  >('/api/synapse/admin/tenant-scope/sod-rules/bulk', { profileId, updates });
  return res.data;
};

export const getCompanyCodeCatalog = async (): Promise<
  ApiResponse<CatalogDto>
> => {
  const res = await axiosInstance.get<ApiResponse<CatalogDto>>(
    '/api/synapse/admin/catalog/company-codes'
  );
  return res.data;
};

export const getCurrencyCatalog = async (): Promise<
  ApiResponse<CatalogDto>
> => {
  const res = await axiosInstance.get<ApiResponse<CatalogDto>>(
    '/api/synapse/admin/catalog/currencies'
  );
  return res.data;
};
