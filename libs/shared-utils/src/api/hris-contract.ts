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
  lastAttemptedSyncAt?: string | null;
  lastErrorCode?: string | null;
  consecutiveFailureCount: number;
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
  sourceSystemId: number;
  profileKey: string;
  adapterType: string;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
  lifecycleState: string;
  mappingSha256: string;
  activatedAt?: string | null;
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
  connectorInstanceId?: string | null;
  mappingProfileId?: string | null;
  retryOfSyncRunId?: string | null;
  pageCount: number;
  unchangedCount: number;
  failureCode?: string | null;
  redactedFailureMessage?: string | null;
  version: number;
  startedAt: string;
  completedAt?: string | null;
};

export type HrisReconciliationRun = {
  reconciliationRunId: string;
  connectorInstanceId: string;
  syncRunId?: string | null;
  lifecycleState: string;
  checkedCount: number;
  issueCount: number;
  criticalCount: number;
  startedAt: string;
  completedAt?: string | null;
};

export type HrisReconciliationIssue = {
  reconciliationIssueId: string;
  reconciliationRunId: string;
  connectorInstanceId: string;
  issueCode: string;
  severity: string;
  entityType: string;
  internalKey?: string | null;
  externalId?: string | null;
  redactedSummary: string;
  lifecycleState: string;
  firstDetectedAt: string;
  resolvedAt?: string | null;
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
