import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type SystemCodeConfigurationLevel = 'SYSTEM' | 'EXTENSIBLE' | 'USER';

export type SystemCodeContractKind =
  'REFERENCE' | 'STATE_MACHINE' | 'SECURITY' | 'PROTOCOL' | 'OBSERVABILITY' | 'REGISTRY_META';

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
  values: SystemCodeValue[];
  bindings: SystemCodeBinding[];
};

export type SystemCodeSetHealth = Pick<
  SystemCodeSet,
  'codeSetKey' | 'ownerService' | 'contractKind' | 'configurationLevel' | 'validationSource'
> & {
  valueCount: number;
  bindingCount: number;
  enforcedBindingCount: number;
  registrationState: 'REGISTERED' | 'INCOMPLETE';
};

export async function getSystemCodeSet(setKey: string, locale: string): Promise<SystemCodeSet> {
  const search = new URLSearchParams({ locale });
  const response = await axiosInstance.get<ApiResponse<SystemCodeSet>>(
    `/api/platform/v1/catalog/code-sets/${encodeURIComponent(setKey)}?${search.toString()}`
  );
  return response.data.data;
}

export async function listSystemCodeSetHealth(): Promise<SystemCodeSetHealth[]> {
  const response = await axiosInstance.get<ApiResponse<SystemCodeSetHealth[]>>(
    '/api/platform/v1/catalog/code-sets'
  );
  return response.data.data;
}
