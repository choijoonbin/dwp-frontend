import { axiosInstance } from '../axios-instance';

import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApiResponse } from '../types';

type AuthSchemas = GatewayComponents['schemas'];

const ADMIN = '/api/auth/admin/tenant-setting-registry';
const READER = '/api/auth/tenant-settings/managed-effective/me';

export type TenantSettingOwnerDescriptor = {
  ownerKey: string;
  ownerVersion: number;
  settingKey: string;
  ownerService: string;
  valueType: 'STRING' | 'BOOLEAN' | 'INTEGER' | 'OBJECT';
  editorKind: 'LOCALE' | 'BOOLEAN' | 'LOGIN_TYPE' | 'DURATION_SECONDS' | 'OWNER_ONLY';
  resolutionStrategy: 'TENANT_OVERRIDE_OR_OWNER_DEFAULT';
  overridePolicy: 'TENANT_ALLOWED' | 'OWNER_LOCKED';
  activationMode: 'PUBLISH';
  defaultValue: unknown;
  localizedLabelKey: string;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  adapterState: 'CONNECTED' | 'UNAVAILABLE';
  observedAt: string;
  sourceUpdatedAt?: string | null;
  freshnessState: 'FRESH' | 'STALE' | 'NO_DATA' | 'DRIFTED';
  allowedActions: Array<'VIEW_EFFECTIVE' | 'CREATE_CHANGE' | 'RESTORE_INHERITANCE'>;
};

export type TenantSettingChangePreview = {
  settingKey: string;
  beforeValue: unknown;
  effectiveAfter: unknown;
  sourceAfter: 'TENANT_OVERRIDE' | 'OWNER_DEFAULT';
  impactedPrincipalCount: number;
  coverage: string;
  observedAt: string;
  warnings: string[];
};

export type TenantSettingRegistryChange = {
  changeId: string;
  settingKey: string;
  ownerKey: string;
  ownerVersion: number;
  desiredState: 'VALUE' | 'INHERIT';
  beforeValue: unknown;
  proposedValue?: unknown;
  lifecycleState: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUPERSEDED';
  impactCount: number;
  impactCoverage: string;
  impactObservedAt: string;
  justification: string;
  requestedBy: number;
  submittedAt?: string;
  approvedBy?: number;
  approvedAt?: string;
  decisionReason?: string;
  publishedBy?: number;
  publishedAt?: string;
  publishReceiptId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  preview: TenantSettingChangePreview;
  allowedActions: Array<'SUBMIT' | 'APPROVE' | 'REJECT' | 'PUBLISH'>;
};

export type TenantSettingRegistryChangePage = Omit<
  Required<AuthSchemas['auth_ChangePage']>,
  'items'
> & { items: TenantSettingRegistryChange[] };

export type ManagedTenantEffectiveSetting = {
  settingKey: string;
  localizedLabelKey: string;
  effectiveValue: unknown;
  effectiveSource: 'TENANT_OVERRIDE' | 'OWNER_DEFAULT' | 'OWNER_CURRENT' | 'OWNER_PUBLICATION';
  overrideState: 'OVERRIDDEN' | 'INHERITED' | 'UNMANAGED_BASELINE' | 'OWNER_LOCKED' | 'DRIFTED';
  provenance: Array<{
    level: 'TENANT';
    localizedOwnerLabelKey: string;
    ownerVersion: number;
    evaluation: 'WINNER';
    reason: string;
  }>;
  freshnessState: 'FRESH' | 'DRIFTED';
  sourceUpdatedAt?: string | null;
  evaluatedAt: string;
};

export async function listTenantSettingOwners(): Promise<TenantSettingOwnerDescriptor[]> {
  const response = await axiosInstance.get<ApiResponse<TenantSettingOwnerDescriptor[]>>(
    `${ADMIN}/owners`
  );
  return response.data.data;
}

export async function listTenantSettingRegistryChanges(): Promise<TenantSettingRegistryChangePage> {
  const response = await axiosInstance.get<ApiResponse<TenantSettingRegistryChangePage>>(
    `${ADMIN}/changes`
  );
  return response.data.data;
}

export async function createTenantSettingRegistryChange(input: {
  settingKey: string;
  desiredState: 'VALUE' | 'INHERIT';
  proposedValue?: unknown;
  justification: string;
}): Promise<TenantSettingRegistryChange> {
  const response = await axiosInstance.post<ApiResponse<TenantSettingRegistryChange>, typeof input>(
    `${ADMIN}/changes`,
    input
  );
  return response.data.data;
}

async function versionedCommand(
  change: TenantSettingRegistryChange,
  command: 'submit' | 'publish'
): Promise<TenantSettingRegistryChange> {
  const body = { version: change.version };
  const response = await axiosInstance.post<ApiResponse<TenantSettingRegistryChange>, typeof body>(
    `${ADMIN}/changes/${change.changeId}/${command}`,
    body
  );
  return response.data.data;
}

export async function submitTenantSettingRegistryChange(
  change: TenantSettingRegistryChange
): Promise<TenantSettingRegistryChange> {
  return versionedCommand(change, 'submit');
}

export async function publishTenantSettingRegistryChange(
  change: TenantSettingRegistryChange
): Promise<TenantSettingRegistryChange> {
  return versionedCommand(change, 'publish');
}

export async function decideTenantSettingRegistryChange(
  change: TenantSettingRegistryChange,
  decision: 'APPROVE' | 'REJECT',
  reason: string
): Promise<TenantSettingRegistryChange> {
  const body = { version: change.version, decision, reason };
  const response = await axiosInstance.post<ApiResponse<TenantSettingRegistryChange>, typeof body>(
    `${ADMIN}/changes/${change.changeId}/decision`,
    body
  );
  return response.data.data;
}

export async function getManagedTenantEffectiveSettings(): Promise<
  ManagedTenantEffectiveSetting[]
> {
  const response = await axiosInstance.get<ApiResponse<ManagedTenantEffectiveSetting[]>>(READER);
  return response.data.data;
}
