/**
 * SynapseX Admin - PII, Governance, Audit API
 * 분리 목적: synapse-admin-api.ts 400줄 이하 유지
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// Governance Config
// ----------------------------------------------------------------------

export type GovernanceConfigOption = {
  code: string;
  name: string;
};

export type GovernanceConfigItem = {
  configKey: string;
  groupName: string;
  currentValue: string;
  options: GovernanceConfigOption[];
};

export type GovernanceConfigPatchPayload = {
  value: string;
};

export const getGovernanceConfigList = async (): Promise<
  ApiResponse<GovernanceConfigItem[]>
> => {
  const res = await axiosInstance.get<ApiResponse<GovernanceConfigItem[]>>(
    '/api/synapse/admin/governance-config'
  );
  return res.data;
};

export const patchGovernanceConfig = async (
  configKey: string,
  payload: GovernanceConfigPatchPayload
): Promise<ApiResponse<{ success?: boolean }>> => {
  const res = await axiosInstance.patch<
    ApiResponse<{ success?: boolean }>
  >(`/api/synapse/admin/governance-config/${encodeURIComponent(configKey)}`, payload);
  return res.data;
};

// ----------------------------------------------------------------------
// PII & Encryption
// ----------------------------------------------------------------------

export type AdminProfile = {
  id: string;
  name: string;
  isDefault?: boolean;
};

export type PiiFieldCatalogItem = {
  fieldKey: string;
  label: string;
  description?: string;
  sampleMaskedFormat?: string;
};

export type PiiPolicyItem = {
  fieldKey: string;
  handling: 'ALLOW' | 'MASK' | 'HASH_ONLY' | 'ENCRYPT' | 'FORBID';
  maskConfig?: { showLastN?: number; pattern?: string };
  hashAlgorithm?: string;
};

export type DataProtectionDto = {
  atRestEncryptionEnabled?: boolean;
  auditRetentionYears?: number;
  exportRequiresApproval?: boolean;
  exportMode?: 'ZIP' | 'CSV';
  keyProvider?: string;
  kmsMode?: 'KMS_MANAGED_KEYS' | 'KMS_MOCK' | string;
};

export type AdminProfileRaw = {
  profileId: number;
  profileName: string;
  isDefault?: boolean;
  [key: string]: unknown;
};

type PiiCatalogRawResponse = { fields?: PiiFieldCatalogItem[] };

type PiiPolicyRawItem = {
  fieldKey: string;
  handling: PiiPolicyItem['handling'];
  maskRule?: string | null;
  hashRule?: string | null;
  encryptRule?: string | null;
  [key: string]: unknown;
};

type PiiPolicyBulkItemDto = {
  fieldKey: string;
  handling: string;
  maskRule?: string | null;
  hashRule?: string | null;
  encryptRule?: string | null;
  note?: string | null;
};

function fromPiiPolicyRaw(raw: PiiPolicyRawItem): PiiPolicyItem {
  const item: PiiPolicyItem = {
    fieldKey: raw.fieldKey,
    handling: raw.handling,
  };
  if (raw.maskRule) {
    const m = raw.maskRule.match(/PARTIAL_(\d+)_\d+/);
    item.maskConfig = m
      ? { showLastN: parseInt(m[1], 10) }
      : { pattern: raw.maskRule };
  }
  if (raw.hashRule) item.hashAlgorithm = raw.hashRule;
  return item;
}

function toPiiPolicyBulkItems(policies: PiiPolicyItem[]): PiiPolicyBulkItemDto[] {
  return policies.map((p) => {
    const item: PiiPolicyBulkItemDto = {
      fieldKey: p.fieldKey,
      handling: p.handling,
      maskRule: null,
      hashRule: null,
      encryptRule: null,
      note: null,
    };
    if (p.handling === 'MASK') {
      item.maskRule =
        p.maskConfig?.showLastN != null
          ? `PARTIAL_${p.maskConfig.showLastN}_4`
          : p.maskConfig?.pattern ?? 'PARTIAL_4_4';
    }
    if (p.handling === 'HASH_ONLY' && p.hashAlgorithm) {
      item.hashRule = p.hashAlgorithm;
    }
    return item;
  });
}

export const getAdminProfiles = async (): Promise<ApiResponse<AdminProfile[]>> => {
  const res = await axiosInstance.get<ApiResponse<AdminProfileRaw[]>>(
    '/api/synapse/admin/profiles'
  );
  const apiRes = res.data;
  if (!apiRes?.data) return apiRes as unknown as ApiResponse<AdminProfile[]>;
  const mapped: AdminProfile[] = apiRes.data.map((p) => ({
    id: String(p.profileId),
    name: p.profileName,
    isDefault: p.isDefault,
  }));
  return { ...apiRes, data: mapped };
};

export const getPiiFieldsCatalog = async (): Promise<
  ApiResponse<PiiFieldCatalogItem[]>
> => {
  const res = await axiosInstance.get<ApiResponse<PiiCatalogRawResponse>>(
    '/api/synapse/admin/pii-fields/catalog'
  );
  const apiRes = res.data;
  if (!apiRes?.data) return apiRes as unknown as ApiResponse<PiiFieldCatalogItem[]>;
  const fields = apiRes.data.fields ?? [];
  return { ...apiRes, data: fields };
};

export const getPiiPolicies = async (
  profileId: string
): Promise<ApiResponse<PiiPolicyItem[]>> => {
  const res = await axiosInstance.get<ApiResponse<PiiPolicyRawItem[]>>(
    `/api/synapse/admin/pii-policies?profileId=${encodeURIComponent(profileId)}`
  );
  const apiRes = res.data;
  if (!apiRes?.data) return apiRes as unknown as ApiResponse<PiiPolicyItem[]>;
  const mapped = apiRes.data.map(fromPiiPolicyRaw);
  return { ...apiRes, data: mapped };
};

export type PiiPoliciesBulkPayload = {
  profileId: string;
  policies: PiiPolicyItem[];
};

export const putPiiPoliciesBulk = async (
  payload: PiiPoliciesBulkPayload
): Promise<ApiResponse<{ success?: boolean }>> => {
  const body = {
    profileId: payload.profileId,
    items: toPiiPolicyBulkItems(payload.policies),
  };
  const res = await axiosInstance.put<
    ApiResponse<{ success?: boolean }>
  >('/api/synapse/admin/pii-policies/bulk', body);
  return res.data;
};

export const getDataProtection = async (
  profileId: string
): Promise<ApiResponse<DataProtectionDto>> => {
  const res = await axiosInstance.get<ApiResponse<DataProtectionDto>>(
    `/api/synapse/admin/data-protection?profileId=${encodeURIComponent(profileId)}`
  );
  return res.data;
};

export const putDataProtection = async (
  profileId: string,
  payload: DataProtectionDto
): Promise<ApiResponse<{ success?: boolean }>> => {
  const res = await axiosInstance.put<
    ApiResponse<{ success?: boolean }>
  >('/api/synapse/admin/data-protection', { ...payload, profileId });
  return res.data;
};

// ----------------------------------------------------------------------
// Synapse Audit API
// ----------------------------------------------------------------------

export type SynapseAuditEventDto = {
  auditId: string;
  createdAt: string;
  eventCategory?: string;
  eventType?: string;
  resourceType?: string;
  resourceId?: string;
  actorType?: string;
  actorUserId?: number;
  actorDisplayName?: string;
  outcome?: string;
  severity?: string;
  evidenceJson?: unknown;
};

export type SynapseAuditEventsParams = {
  category?: string;
  type?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export type SynapseAuditEventsResponse = {
  items: SynapseAuditEventDto[];
  total: number;
  pageInfo?: { page: number; size: number; totalPages: number; total: number };
};

export const getSynapseAuditEvents = async (
  params?: SynapseAuditEventsParams
): Promise<ApiResponse<SynapseAuditEventsResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append('category', params.category);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.resourceType) queryParams.append('resourceType', params.resourceType);
  if (params?.resourceId) queryParams.append('resourceId', params.resourceId);
  if (params?.from) queryParams.append('from', params.from);
  if (params?.to) queryParams.append('to', params.to);
  if (params?.page !== undefined) queryParams.append('page', params.page.toString());
  if (params?.size !== undefined) queryParams.append('size', params.size.toString());
  if (params?.sort) queryParams.append('sort', params.sort);

  const url = `/api/synapse/audit/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<SynapseAuditEventsResponse>>(url);
  return res.data;
};
