import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

import type { HrisIntegrationControlPlaneProjection } from './integration-control-plane-contract';

export const INTEGRATION_CONTROL_PLANE_EXPERIENCE = Object.freeze({
  primaryUsers: Object.freeze([
    'HRIS integration author',
    'HRIS integration approver',
    'HRIS integration executor',
  ]),
  operationalQuestion:
    'Which connector or execution needs intervention, and is the next governed action safe?',
  primaryAction:
    'Inspect current connector evidence and submit only an action returned by the owner policy projection.',
  pageArchetype: 'COMMAND_CENTER_LIST_DETAIL',
  customerImpactFirst: true,
  mounted: false,
} as const);

export const INTEGRATION_ACTION_KEYS = Object.freeze({
  createDefinition: 'hris.action.sys.post.platform.v1.admin.hris.connectors',
  testConnector: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.test',
  dryRunMapping:
    'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings.resource.dry-runs',
  createExecution: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.executions',
  validateDefinition: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.validate',
  submitDefinition: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.submit',
  approveDefinition: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.approve',
  activateDefinition: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.activate',
  createMapping: 'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings',
  validateMapping:
    'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings.resource.validate',
  submitMapping:
    'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings.resource.submit',
  approveMapping:
    'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings.resource.approve',
  activateMapping:
    'hris.action.sys.post.platform.v1.admin.hris.connectors.resource.mappings.resource.activate',
  reconcileExecution:
    'hris.action.sys.post.platform.v1.admin.hris.connector-executions.resource.reconcile',
  retryExecution: 'hris.action.sys.post.platform.v1.admin.hris.connector-executions.resource.retry',
  cancelExecution:
    'hris.action.sys.post.platform.v1.admin.hris.connector-executions.resource.cancel',
} as const);

export type IntegrationActionKey =
  (typeof INTEGRATION_ACTION_KEYS)[keyof typeof INTEGRATION_ACTION_KEYS];

export const INTEGRATION_COMMAND_TYPE_BY_ACTION = Object.freeze({
  [INTEGRATION_ACTION_KEYS.createDefinition]: 'CREATE_CONNECTOR',
  [INTEGRATION_ACTION_KEYS.testConnector]: 'TEST_CONNECTOR',
  [INTEGRATION_ACTION_KEYS.dryRunMapping]: 'DRY_RUN_MAPPING',
  [INTEGRATION_ACTION_KEYS.createExecution]: 'CREATE_CONNECTOR_EXECUTION',
  [INTEGRATION_ACTION_KEYS.validateDefinition]: 'VALIDATE_DEFINITION',
  [INTEGRATION_ACTION_KEYS.submitDefinition]: 'SUBMIT_DEFINITION',
  [INTEGRATION_ACTION_KEYS.approveDefinition]: 'APPROVE_DEFINITION',
  [INTEGRATION_ACTION_KEYS.activateDefinition]: 'ACTIVATE_DEFINITION',
  [INTEGRATION_ACTION_KEYS.createMapping]: 'CREATE_MAPPING',
  [INTEGRATION_ACTION_KEYS.validateMapping]: 'VALIDATE_MAPPING',
  [INTEGRATION_ACTION_KEYS.submitMapping]: 'SUBMIT_MAPPING',
  [INTEGRATION_ACTION_KEYS.approveMapping]: 'APPROVE_MAPPING',
  [INTEGRATION_ACTION_KEYS.activateMapping]: 'ACTIVATE_MAPPING',
  [INTEGRATION_ACTION_KEYS.reconcileExecution]: 'RECONCILE_CONNECTOR_EXECUTION',
  [INTEGRATION_ACTION_KEYS.retryExecution]: 'RETRY_CONNECTOR_EXECUTION',
  [INTEGRATION_ACTION_KEYS.cancelExecution]: 'CANCEL_CONNECTOR_EXECUTION',
} as const satisfies Readonly<Record<IntegrationActionKey, string>>);

export type IntegrationCommandType =
  (typeof INTEGRATION_COMMAND_TYPE_BY_ACTION)[IntegrationActionKey];

export const INTEGRATION_FIELD_GROUPS = [
  'CONNECTOR_METADATA',
  'POLICY_VERSION',
  'EXECUTION_POLICY',
  'EFFECTIVE_STATUS',
] as const;
export type IntegrationFieldGroup = (typeof INTEGRATION_FIELD_GROUPS)[number];

export const INTEGRATION_PROJECTION_SORTS = Object.freeze({
  PRIMARY_HRIS_SETTINGS: Object.freeze([
    'connectorMetadata:ASC',
    'policyVersion:ASC',
    'effectiveStatus:ASC',
    'connectorMetadata:DESC',
    'policyVersion:DESC',
    'effectiveStatus:DESC',
    'itemPublicId:ASC',
    'itemPublicId:DESC',
  ]),
  PRIMARY_DWP_CONTROL: Object.freeze([
    'connectorMetadata:ASC',
    'executionPolicy:ASC',
    'effectiveStatus:ASC',
    'connectorMetadata:DESC',
    'executionPolicy:DESC',
    'effectiveStatus:DESC',
    'itemPublicId:ASC',
    'itemPublicId:DESC',
  ]),
} satisfies Readonly<Record<HrisIntegrationControlPlaneProjection, readonly string[]>>);

export type JsonPrimitive = string | number | boolean | null;
export type SafeProjectedValue =
  JsonPrimitive | readonly SafeProjectedValue[] | Readonly<{ [key: string]: SafeProjectedValue }>;

export type IntegrationProjectedField =
  | Readonly<{ decision: 'VIEW'; value: SafeProjectedValue }>
  | Readonly<{ decision: 'MASK'; value: null }>;

export type IntegrationProjectionItem = Readonly<{
  itemPublicId: string;
  effectiveStatusRevision: number;
  fields: Readonly<Partial<Record<IntegrationFieldGroup, IntegrationProjectedField>>>;
  availableActions: readonly IntegrationActionKey[];
}>;

export type IntegrationQueryState = 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE';

export type IntegrationProjectionResponse = Readonly<{
  projection: HrisIntegrationControlPlaneProjection;
  state: IntegrationQueryState;
  items: readonly IntegrationProjectionItem[];
}>;

export type IntegrationProjectionQuery = Readonly<{
  asOf: string;
  filters?: Readonly<Record<string, string>>;
  sort?: string;
  limit?: number;
  cursor?: string;
}>;

export type IntegrationReadContext = Readonly<{
  correlationId: string;
  contextScopeKey?: string;
  purposeCode?: string;
  signal?: AbortSignal;
}>;

export type ConnectorCatalogItem = Readonly<{
  publicId: string;
  key: string;
  type: string;
  state: string;
  version: number;
  updatedAt: string;
}>;

export type ConnectorCatalogResponse = Readonly<{
  asOf: string;
  nextCursor?: string;
  items: readonly ConnectorCatalogItem[];
  freshUntil: string;
  staleAfter: string;
}>;

export type ConnectorCatalogQuery = Readonly<{
  asOf: string;
  fields: readonly string[];
  freshness: 'FRESH_ONLY' | 'ALLOW_STALE';
  limit?: number;
  cursor?: string;
  filter?: string;
}>;

export const INTEGRATION_EXECUTION_STATES = [
  'ACCEPTED',
  'TRANSFORMING',
  'DISPATCHED',
  'RESULT_UNKNOWN',
  'ACKNOWLEDGED',
  'RECONCILING',
  'RECONCILED',
  'PARTIAL',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
] as const;
export type IntegrationExecutionState = (typeof INTEGRATION_EXECUTION_STATES)[number];

export type ConnectorExecutionResponse = Readonly<{
  executionId: string;
  mappingVersion: number;
  state: IntegrationExecutionState;
  sourceCount: number;
  acceptedCount: number;
  rejectedCount: number;
  selectedItemCount: number;
  selectedItemDigest: string;
  reconciliationDigest: string | null;
  aggregateVersion: number;
}>;

export type IntegrationCommandReceipt = Readonly<{
  receiptId: string;
  commandType: IntegrationCommandType;
  originatingAction: IntegrationActionKey;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: string;
  authorizationRevision: number;
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN';
  correlationId: string;
  requestDigest: string;
  createdAt: string;
  aggregateVersion?: number;
  resultRef?: string;
}>;

export type IntegrationCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectRevision?: number;
}>;

export type CreateConnectorDefinitionBody = Readonly<{
  connectorKey: string;
  type: 'HTTPS' | 'SFTP' | 'OBJECT_STORE' | 'ERP' | 'BANK' | 'STATUTORY_PROVIDER';
  endpoint: string;
  secretRef: string;
  egressPolicyKey: string;
}>;

export type TestConnectorBody = Readonly<{
  testMode: 'AUTHENTICATION' | 'CONNECTIVITY' | 'SCHEMA';
  sampleRef: string;
  sampleDigest: string;
}>;

export type DryRunMappingBody = Readonly<{
  sampleRef: string;
  sampleDigest: string;
  maxRows: number;
  asOf: string;
}>;

export type CreateExecutionBody = Readonly<{
  operation: 'IMPORT' | 'EXPORT' | 'DISPATCH' | 'RECONCILE';
  payloadRef: string;
  payloadDigest: string;
  asOf: string;
}>;

export type ValidateDefinitionBody = Readonly<{
  definitionDigest: string;
  endpointPolicyRevision: number;
  secretRevision: number;
}>;

export type ApprovalRequestBody = Readonly<{
  approvalWorkflowKey: string;
  subjectRevision: number;
  payloadDigest: string;
}>;

export type ApprovalDecisionBody = Readonly<{
  approvalReceiptId: string;
  decisionDigest: string;
}>;

export type ActivationBody = Readonly<{
  approvalReceiptId: string;
  effectiveAt: string;
}>;

export type CreateMappingBody = Readonly<{
  sourceSchemaVersion: number;
  targetSchemaVersion: number;
  mappingRef: string;
  mappingDigest: string;
  compatibilityMode: 'BACKWARD' | 'FORWARD' | 'FULL' | 'EXACT';
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

export type ValidateMappingBody = Readonly<{
  mappingDigest: string;
  sourceSchemaDigest: string;
  targetSchemaDigest: string;
}>;

export type ReconcileExecutionBody = Readonly<{
  providerReceiptRef: string;
  providerReceiptDigest: string;
  expectedSourceCount: number;
  asOf: string;
}>;

export type RetryExecutionBody = Readonly<{
  failedItemIds: readonly string[];
  failedItemSetDigest: string;
  expectedRejectedCount: number;
  reasonCode: string;
}>;

export type CancelExecutionBody = Readonly<{
  reasonCode: string;
  compensationPolicyRef: string | null;
}>;

type ConnectorCommand<K extends string, B> = Readonly<{
  kind: K;
  connectorPublicId: string;
  body: B;
}>;

type MappingCommand<K extends string, B> = ConnectorCommand<K, B> &
  Readonly<{ mappingVersion: number }>;

type ExecutionCommand<K extends string, B> = Readonly<{
  kind: K;
  executionPublicId: string;
  body: B;
}>;

export type IntegrationCommand =
  | Readonly<{ kind: 'CREATE_DEFINITION'; body: CreateConnectorDefinitionBody }>
  | ConnectorCommand<'TEST_CONNECTOR', TestConnectorBody>
  | MappingCommand<'DRY_RUN_MAPPING', DryRunMappingBody>
  | ConnectorCommand<'CREATE_EXECUTION', CreateExecutionBody>
  | ConnectorCommand<'VALIDATE_DEFINITION', ValidateDefinitionBody>
  | ConnectorCommand<'SUBMIT_DEFINITION', ApprovalRequestBody>
  | ConnectorCommand<'APPROVE_DEFINITION', ApprovalDecisionBody>
  | ConnectorCommand<'ACTIVATE_DEFINITION', ActivationBody>
  | ConnectorCommand<'CREATE_MAPPING', CreateMappingBody>
  | MappingCommand<'VALIDATE_MAPPING', ValidateMappingBody>
  | MappingCommand<'SUBMIT_MAPPING', ApprovalRequestBody>
  | MappingCommand<'APPROVE_MAPPING', ApprovalDecisionBody>
  | MappingCommand<'ACTIVATE_MAPPING', ActivationBody>
  | ExecutionCommand<'RECONCILE_EXECUTION', ReconcileExecutionBody>
  | ExecutionCommand<'RETRY_EXECUTION', RetryExecutionBody>
  | ExecutionCommand<'CANCEL_EXECUTION', CancelExecutionBody>;

export type IntegrationWorkbenchAction =
  | Readonly<{
      scope: 'COLLECTION';
      actionKey: typeof INTEGRATION_ACTION_KEYS.createDefinition;
    }>
  | Readonly<{
      scope: 'ITEM';
      actionKey: IntegrationActionKey;
      itemPublicId: string;
      expectedObjectRevision: number;
    }>;
