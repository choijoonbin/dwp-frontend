import type { operations } from '@dwp-frontend/api-contracts';
import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  assertReferenceConfigurationReceipt,
  isReferenceConfigurationWorkbench,
} from '../model/reference-configuration-model';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  ReferenceConfigurationCommandReceipt,
  ReferenceConfigurationDomain,
  ReferenceConfigurationVersion,
  ReferenceConfigurationWorkbench,
} from '../model/reference-configuration-model';

export const REFERENCE_CONFIGURATION_WORKBENCH_PATH =
  '/api/platform/v1/hris/workbench/settings-reference' as const;
export const REFERENCE_CONFIGURATION_BASE_PATH =
  '/api/platform/v1/admin/hris/configurations' as const;

export type ReferenceConfigurationGeneratedContracts = Readonly<{
  workbench: operations['platform_hrisReferenceConfigurationWorkbench'];
  list: operations['platform_hrisReferenceConfigurations'];
  create: operations['platform_hrisReferenceConfigurationCreateVersion'];
  detail: operations['platform_hrisReferenceConfigurationVersion'];
  validate: operations['platform_hrisReferenceConfigurationValidateVersion'];
  simulate: operations['platform_hrisReferenceConfigurationSimulateVersion'];
  submit: operations['platform_hrisReferenceConfigurationSubmitVersion'];
  approve: operations['platform_hrisReferenceConfigurationApproveVersion'];
  schedule: operations['platform_hrisReferenceConfigurationScheduleVersion'];
  publish: operations['platform_hrisReferenceConfigurationPublishVersion'];
  rollback: operations['platform_hrisReferenceConfigurationRollbackVersion'];
  retire: operations['platform_hrisReferenceConfigurationRetireVersion'];
}>;

export const REFERENCE_CONFIGURATION_OPERATION_BINDINGS = [
  ['GET', REFERENCE_CONFIGURATION_WORKBENCH_PATH],
  ['GET', REFERENCE_CONFIGURATION_BASE_PATH],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions`],
  ['GET', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/validate`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/simulate`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/submit`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/approve`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/schedule`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/publish`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/rollback`],
  ['POST', `${REFERENCE_CONFIGURATION_BASE_PATH}/{configId}/versions/{version}/retire`],
] as const;

export type ReferenceConfigurationWorkbenchQuery = Readonly<{
  limit?: number;
  cursor?: string;
  asOf?: string;
  policyVersion?: Readonly<{
    policyKeys?: readonly string[];
    minimumRevision?: number;
  }>;
  referenceData?: Readonly<{
    publicIds?: readonly string[];
    codes?: readonly string[];
  }>;
  effectiveStatus?: Readonly<{
    codes?: readonly string[];
    minimumRevision?: number;
  }>;
  effectiveOn?: string;
  sort?: readonly string[];
  fields?: readonly ('POLICY_VERSION' | 'REFERENCE_DATA' | 'EFFECTIVE_STATUS')[];
  freshness?: 'FRESH_ONLY' | 'ALLOW_STALE';
  locale?: string;
  timeZone?: string;
  correlationId: string;
}>;

export type ReferenceConfigurationCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion?: number;
}>;

export type CreateReferenceConfigurationVersion = Readonly<{
  domain: ReferenceConfigurationDomain;
  effectiveFrom: string;
  effectiveTo?: string;
  schemaKey: string;
  schemaVersion: number;
  payload: Readonly<{ reference: string; digest: string }>;
}>;

export type ValidateReferenceConfigurationVersion = Readonly<{
  inputScopeDigest: string;
  schemaRevision: number;
}>;

export type SimulateReferenceConfigurationVersion = Readonly<{
  validationReceiptId: string;
  sampleScopeRef: string;
  sampleScopeDigest: string;
}>;

export type SubmitReferenceConfigurationVersion = Readonly<{
  validationReceiptId: string;
  simulationReceiptId: string;
  impactDigest: string;
  approvalWorkflowKey: string;
}>;

export type ApproveReferenceConfigurationVersion = Readonly<{
  approvalReceiptId: string;
  approvalDecisionDigest: string;
}>;

export type PublishReferenceConfigurationVersion = Readonly<{
  approvalReceiptId: string;
  impactDigest: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

export type ScheduleReferenceConfigurationVersion = PublishReferenceConfigurationVersion &
  Readonly<{ publishAt: string }>;

export type RollbackReferenceConfigurationVersion = Readonly<{
  targetPublishedVersion: number;
  approvalReceiptId: string;
  impactDigest: string;
  effectiveFrom: string;
  reasonCode: string;
}>;

export type RetireReferenceConfigurationVersion = Readonly<{
  approvalReceiptId: string;
  effectiveTo: string;
  replacementVersion: number | null;
  reasonCode: string;
}>;

export async function readReferenceConfigurationWorkbench(
  query: ReferenceConfigurationWorkbenchQuery,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ReferenceConfigurationWorkbench> {
  const search = new URLSearchParams({
    limit: String(query.limit ?? 50),
    locale: query.locale ?? 'en',
    timeZone: query.timeZone ?? 'UTC',
  });
  addQueryValue(search, 'cursor', query.cursor);
  addQueryValue(search, 'asOf', query.asOf);
  addQueryValues(search, 'policyVersion.policyKeys', query.policyVersion?.policyKeys);
  addQueryNumber(search, 'policyVersion.minimumRevision', query.policyVersion?.minimumRevision);
  addQueryValues(search, 'referenceData.publicIds', query.referenceData?.publicIds);
  addQueryValues(search, 'referenceData.codes', query.referenceData?.codes);
  addQueryValues(search, 'effectiveStatus.codes', query.effectiveStatus?.codes);
  addQueryNumber(search, 'effectiveStatus.minimumRevision', query.effectiveStatus?.minimumRevision);
  addQueryValue(search, 'effectiveOn', query.effectiveOn);
  addQueryValues(
    search,
    'fields',
    query.fields ?? ['POLICY_VERSION', 'REFERENCE_DATA', 'EFFECTIVE_STATUS']
  );
  addQueryValue(search, 'freshness', query.freshness ?? 'FRESH_ONLY');
  for (const sort of query.sort ?? ['itemPublicId:ASC']) search.append('sort', sort);
  const scoped = productSurfaceReadScopeConfig(contextScopeKey, signal);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${REFERENCE_CONFIGURATION_WORKBENCH_PATH}?${search.toString()}`,
    {
      ...scoped,
      headers: {
        'X-Correlation-ID': query.correlationId,
        'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      },
    }
  );
  if (!isReferenceConfigurationWorkbench(response.data.data)) {
    throw new Error('Reference-configuration workbench response is invalid.');
  }
  return response.data.data;
}

export async function readReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ReferenceConfigurationVersion> {
  const scoped = productSurfaceReadScopeConfig(contextScopeKey, signal);
  const response = await axiosInstance.get<ApiResponse<ReferenceConfigurationVersion>>(
    versionPath(configurationId, version),
    {
      ...scoped,
      headers: { 'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN' },
    }
  );
  return response.data.data;
}

export async function createReferenceConfigurationVersion(
  configurationId: string,
  body: CreateReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return mutate(
    `${REFERENCE_CONFIGURATION_BASE_PATH}/${encodeURIComponent(configurationId)}/versions`,
    body,
    authority,
    'CREATE_VERSION',
    'configuration.version.create',
    `${configurationId}/`,
    false,
    false
  );
}

export async function validateReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: ValidateReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(configurationId, version, 'validate', body, authority, 'VALIDATE_VERSION');
}

export async function simulateReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: SimulateReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(configurationId, version, 'simulate', body, authority, 'SIMULATE_VERSION');
}

export async function submitReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: SubmitReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(configurationId, version, 'submit', body, authority, 'SUBMIT_VERSION');
}

export async function approveReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: ApproveReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(
    configurationId,
    version,
    'approve',
    body,
    authority,
    'APPROVE_VERSION',
    true
  );
}

export async function scheduleReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: ScheduleReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(
    configurationId,
    version,
    'schedule',
    body,
    authority,
    'SCHEDULE_VERSION',
    true
  );
}

export async function publishReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: PublishReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(
    configurationId,
    version,
    'publish',
    body,
    authority,
    'PUBLISH_VERSION',
    true
  );
}

export async function rollbackReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: RollbackReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(
    configurationId,
    version,
    'rollback',
    body,
    authority,
    'ROLLBACK_VERSION',
    true
  );
}

export async function retireReferenceConfigurationVersion(
  configurationId: string,
  version: number,
  body: RetireReferenceConfigurationVersion,
  authority: ReferenceConfigurationCommandAuthority
) {
  return versionMutation(
    configurationId,
    version,
    'retire',
    body,
    authority,
    'RETIRE_VERSION',
    true
  );
}

async function versionMutation<T extends object>(
  configurationId: string,
  version: number,
  action: string,
  body: T,
  authority: ReferenceConfigurationCommandAuthority,
  commandType: string,
  highRisk = false
): Promise<ReferenceConfigurationCommandReceipt> {
  return mutate(
    `${versionPath(configurationId, version)}/${action}`,
    body,
    authority,
    commandType,
    `configuration.version.${action}`,
    action === 'rollback' ? `${configurationId}/` : `${configurationId}/${version}`,
    true,
    highRisk
  );
}

async function mutate<T extends object>(
  path: string,
  body: T,
  authority: ReferenceConfigurationCommandAuthority,
  commandType: string,
  originatingAction: string,
  resultRefPrefix: string,
  requireObjectVersion: boolean,
  highRisk: boolean
): Promise<ReferenceConfigurationCommandReceipt> {
  validateAuthority(authority, requireObjectVersion);
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority.governance, { objectVersionHeader: true })
    : productSurfaceGovernedMutationConfig(authority.governance, {
        objectVersionHeader: requireObjectVersion,
      });
  const response = await axiosInstance.post<ApiResponse<unknown>, T>(path, body, {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': authority.idempotencyKey,
      'X-Correlation-ID': authority.correlationId,
      'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      ...(requireObjectVersion
        ? { 'X-DWP-Expected-Object-Version': String(authority.expectedObjectVersion) }
        : {}),
    },
  });
  return assertReferenceConfigurationReceipt(response.data.data, {
    commandType,
    originatingAction,
    resultRefPrefix,
  });
}

function validateAuthority(
  authority: ReferenceConfigurationCommandAuthority,
  requireObjectVersion: boolean
) {
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !isUuid(authority.correlationId) ||
    (requireObjectVersion &&
      (!Number.isSafeInteger(authority.expectedObjectVersion) ||
        authority.expectedObjectVersion! < 0))
  ) {
    throw new Error('Reference-configuration command authority is invalid.');
  }
  if (
    authority.governance.mode === 'SECURE' &&
    (authority.governance.idempotencyKey !== authority.idempotencyKey ||
      (requireObjectVersion &&
        authority.governance.objectVersion !== authority.expectedObjectVersion))
  ) {
    throw new Error('Reference-configuration command authority does not match the command.');
  }
}

function versionPath(configurationId: string, version: number) {
  return `${REFERENCE_CONFIGURATION_BASE_PATH}/${encodeURIComponent(configurationId)}/versions/${version}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function addQueryValue(search: URLSearchParams, key: string, value?: string) {
  if (value !== undefined) search.set(key, value);
}

function addQueryValues(search: URLSearchParams, key: string, values?: readonly string[]) {
  if (values?.length) search.set(key, values.join(','));
}

function addQueryNumber(search: URLSearchParams, key: string, value?: number) {
  if (value !== undefined) search.set(key, String(value));
}
