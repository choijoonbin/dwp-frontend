import { axiosInstance } from '../axios-instance';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';

export type SystemCodeConfigurationLevel = 'SYSTEM' | 'EXTENSIBLE' | 'USER';
export type SystemCodeRuntimeVisibility = 'ADMIN_ONLY' | 'RUNTIME';

export type SystemCodeContractKind =
  | 'REFERENCE'
  | 'STATE_MACHINE'
  | 'SECURITY'
  | 'PROTOCOL'
  | 'OBSERVABILITY'
  | 'REGISTRY_META';

export type SystemCodeValue = {
  code: string;
  label: string;
  displayName: string;
  sortOrder: number;
  predefined: boolean;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  behaviorMetadata: Record<string, unknown>;
};

export type SystemCodeBinding = {
  consumerService: string;
  usageType: 'DATABASE_COLUMN' | 'API_CONTRACT' | 'UI_SELECTION' | 'BEHAVIOR';
  sourceReference: string;
  enforcementType: 'CHECK' | 'FOREIGN_KEY' | 'CATALOG_LOOKUP' | 'TYPED_CONTRACT';
};

export type SystemCodeSet = {
  codeSetKey: string;
  ownerService: string;
  contractKind: SystemCodeContractKind;
  displayName: string;
  description: string;
  configurationLevel: SystemCodeConfigurationLevel;
  validationSource: string;
  sourceReference: string;
  schemaVersion: number;
  runtimeVisibility: SystemCodeRuntimeVisibility;
  values: SystemCodeValue[];
  bindings: SystemCodeBinding[];
};

export type RuntimeSystemCodeValue = Pick<SystemCodeValue, 'code' | 'label'>;

export type RuntimeSystemCodeSet = Pick<SystemCodeSet, 'codeSetKey' | 'schemaVersion'> & {
  values: RuntimeSystemCodeValue[];
};

export type SystemCodeSetHealth = Pick<
  SystemCodeSet,
  | 'codeSetKey'
  | 'ownerService'
  | 'contractKind'
  | 'configurationLevel'
  | 'validationSource'
  | 'runtimeVisibility'
> & {
  displayName: string;
  schemaVersion: number;
  valueCount: number;
  bindingCount: number;
  enforcedBindingCount: number;
  registrationState: 'REGISTERED' | 'INCOMPLETE';
};

export type SystemCodeCatalogSnapshot = {
  catalogScope: 'GLOBAL_PRODUCT';
  changePolicy: 'RELEASE_MANAGED';
  codeSets: SystemCodeSetHealth[];
};

export async function getSystemCodeSet(
  setKey: string,
  locale: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<RuntimeSystemCodeSet> {
  const search = new URLSearchParams({ locale });
  const response = await axiosInstance.get<ApiResponse<RuntimeSystemCodeSet>>(
    `/api/platform/v1/catalog/code-sets/${encodeURIComponent(setKey)}?${search.toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getProviderSystemCodeSet(
  setKey: string,
  locale: string
): Promise<SystemCodeSet> {
  const search = new URLSearchParams({ locale });
  const response = await axiosInstance.get<ApiResponse<SystemCodeSet>>(
    `/api/provider/v1/admin/code-catalog/code-sets/${encodeURIComponent(setKey)}?${search.toString()}`
  );
  return response.data.data;
}

export async function getProviderSystemCodeCatalog(): Promise<SystemCodeCatalogSnapshot> {
  const response = await axiosInstance.get<ApiResponse<SystemCodeCatalogSnapshot>>(
    '/api/provider/v1/admin/code-catalog/code-sets'
  );
  return response.data.data;
}
