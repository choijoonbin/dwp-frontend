import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type PeopleDataAccess = {
  classification: string;
  workerNumberMasked: boolean;
  excludedFieldGroups: string[];
};

export type PersonSummary = {
  personId: string;
  displayName: string;
  preferredLocale?: string | null;
  timeZone?: string | null;
  lifecycleState: string;
  workerNumber?: string | null;
  workerType?: string | null;
  workerStatus?: string | null;
  businessTitle?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
  locationName?: string | null;
  workEmail?: string | null;
  profileImageKey?: string | null;
  assignmentEffectiveFrom?: string | null;
  dataAccess: PeopleDataAccess;
};

export type PersonAssignment = {
  assignmentKey: string;
  assignmentStatus: string;
  primaryAssignment: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  businessTitle?: string | null;
  organizationName?: string | null;
  jobProfileName?: string | null;
  locationName?: string | null;
  managerAssignmentKey?: string | null;
  changeReasonCode?: string | null;
};

export type PersonDetail = {
  person: PersonSummary;
  originalHireDate?: string | null;
  legalEmployerName?: string | null;
  managerAssignmentKey?: string | null;
  assignments: PersonAssignment[];
};

export type PeopleCursorPage = {
  items: PersonSummary[];
  nextCursor?: string | null;
  size: number;
  hasMore: boolean;
  asOf: string;
};

export type HrisSourceSystem = {
  sourceSystemId: number;
  sourceKey: string;
  systemType: string;
  name: string;
  lifecycleState: string;
  version: number;
};

export type HrisConnector = {
  connectorInstanceId: string;
  sourceSystemId: number;
  sourceKey: string;
  connectorKey: string;
  connectorType: string;
  endpointUri?: string | null;
  authMode?: string | null;
  credentialReference?: string | null;
  scheduleExpression?: string | null;
  lifecycleState: string;
  healthState: string;
  lastHealthCheckedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  version: number;
};

export type CreateHrisConnectorRequest = {
  sourceKey: string;
  sourceType: 'WORKDAY' | 'ORACLE_HCM' | 'SAP_HCM' | 'SCIM' | 'CUSTOM';
  sourceName: string;
  connectorKey: string;
  connectorType:
    | 'WORKDAY_REST'
    | 'WORKDAY_SOAP'
    | 'ORACLE_HCM_REST'
    | 'SAP_SUCCESSFACTORS'
    | 'SCIM_BRIDGE'
    | 'CUSTOM_REST'
    | 'FILE_IMPORT';
  endpointUri?: string;
  authMode: 'NONE' | 'BASIC' | 'OAUTH2_CLIENT_CREDENTIALS' | 'MTLS' | 'SIGNED_REQUEST';
  credentialReference?: string;
  scheduleExpression?: string;
};

export type HrisConfigurationCheck = {
  connectorInstanceId: string;
  valid: boolean;
  healthState: string;
  externalConnectivityTested: boolean;
  issues: string[];
  checkedAt: string;
};

export type HrisMappingProfile = {
  mappingProfileId: string;
  profileKey: string;
  adapterType: string;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  lifecycleState: string;
  version: number;
};

export type HrisSyncRun = {
  syncRunId: string;
  sourceKey: string;
  syncMode: string;
  lifecycleState: string;
  requestedWatermark?: string | null;
  committedWatermark?: string | null;
  readCount: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  startedAt: string;
  completedAt?: string | null;
};

export type HrisImportResult = {
  syncRunId: string;
  sourceKey: string;
  lifecycleState: string;
  readCount: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  replayed: boolean;
  syntheticFixture: boolean;
  emittedEventTypes: string[];
};

export async function listPeople(
  params: {
    query?: string;
    status?: string;
    cursor?: string;
    size?: number;
    asOf?: string;
  } = {}
): Promise<PeopleCursorPage> {
  const search = new URLSearchParams({ size: String(params.size ?? 50) });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.status) search.set('status', params.status);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.asOf) search.set('asOf', params.asOf);
  const response = await axiosInstance.get<ApiResponse<PeopleCursorPage>>(
    `/api/people/v1/people?${search.toString()}`
  );
  return response.data.data;
}

export async function getPerson(personId: string, asOf?: string): Promise<PersonDetail> {
  const search = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  const response = await axiosInstance.get<ApiResponse<PersonDetail>>(
    `/api/people/v1/people/${encodeURIComponent(personId)}${search}`
  );
  return response.data.data;
}

const HRIS_BASE = '/api/people/v1/admin/integrations/hris';

export async function listHrisSources(): Promise<HrisSourceSystem[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSourceSystem[]>>(`${HRIS_BASE}/sources`);
  return response.data.data;
}

export async function listHrisConnectors(): Promise<HrisConnector[]> {
  const response = await axiosInstance.get<ApiResponse<HrisConnector[]>>(`${HRIS_BASE}/connectors`);
  return response.data.data;
}

export async function createHrisConnector(
  request: CreateHrisConnectorRequest
): Promise<HrisConnector> {
  const response = await axiosInstance.post<ApiResponse<HrisConnector>, CreateHrisConnectorRequest>(
    `${HRIS_BASE}/connectors`,
    request
  );
  return response.data.data;
}

export async function updateHrisConnector(
  connector: HrisConnector,
  request: {
    endpointUri?: string;
    credentialReference?: string;
    scheduleExpression?: string;
    lifecycleState: string;
  }
): Promise<HrisConnector> {
  const response = await axiosInstance.put<
    ApiResponse<HrisConnector>,
    typeof request & { version: number }
  >(`${HRIS_BASE}/connectors/${connector.connectorInstanceId}`, {
    ...request,
    version: connector.version,
  });
  return response.data.data;
}

export async function checkHrisConnectorConfiguration(
  connectorId: string
): Promise<HrisConfigurationCheck> {
  const response = await axiosInstance.post<ApiResponse<HrisConfigurationCheck>, undefined>(
    `${HRIS_BASE}/connectors/${connectorId}/configuration-check`,
    undefined
  );
  return response.data.data;
}

export async function listHrisMappingProfiles(): Promise<HrisMappingProfile[]> {
  const response = await axiosInstance.get<ApiResponse<HrisMappingProfile[]>>(
    `${HRIS_BASE}/mapping-profiles`
  );
  return response.data.data;
}

export async function listHrisSyncRuns(size = 50): Promise<HrisSyncRun[]> {
  const response = await axiosInstance.get<ApiResponse<HrisSyncRun[]>>(
    `${HRIS_BASE}/sync-runs?size=${size}`
  );
  return response.data.data;
}

export async function importSyntheticWorkdayFixture(): Promise<HrisImportResult> {
  const response = await axiosInstance.post<ApiResponse<HrisImportResult>, undefined>(
    `${HRIS_BASE}/sample-import`,
    undefined,
    { headers: { 'Idempotency-Key': crypto.randomUUID() } }
  );
  return response.data.data;
}
