import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS } from './integration-control-plane-contract';
import {
  assertConnectorCatalogResponse,
  assertConnectorExecutionResponse,
  assertIntegrationCommandReceipt,
  assertIntegrationProjectionResponse,
} from './integration-control-plane-model';
import {
  INTEGRATION_ACTION_KEYS,
  INTEGRATION_COMMAND_TYPE_BY_ACTION,
  INTEGRATION_PROJECTION_SORTS,
} from './integration-control-plane-types';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type { HrisIntegrationControlPlaneProjection } from './integration-control-plane-contract';
import type {
  ConnectorCatalogQuery,
  ConnectorCatalogResponse,
  ConnectorExecutionResponse,
  IntegrationActionKey,
  IntegrationCommand,
  IntegrationCommandAuthority,
  IntegrationCommandReceipt,
  IntegrationProjectionQuery,
  IntegrationProjectionResponse,
  IntegrationReadContext,
} from './integration-control-plane-types';

const CONNECTOR_BASE_PATH = '/api/platform/v1/admin/hris/connectors' as const;
const EXECUTION_BASE_PATH = '/api/platform/v1/admin/hris/connector-executions' as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^[a-f0-9]{64}$/;
const REFERENCE = /^ref_[A-Za-z0-9_-]{16,240}$/;
const SECRET_REFERENCE = /^secret_[A-Za-z0-9_-]{16,128}$/;
const POLICY_REFERENCE = /^policy_[A-Za-z0-9_-]{16,200}$/;
const REASON_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;
const WORKFLOW_KEY = /^[a-z][a-z0-9.-]{2,127}$/;

export const HCM_INTEGRATION_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'executeIntegrationCommand:CREATE_DEFINITION',
    routeContractKey: 'route.hcm.configuration.connector-definition-create.action',
    method: 'POST',
    path: CONNECTOR_BASE_PATH,
  },
  {
    apiFunction: 'executeIntegrationCommand:TEST_CONNECTOR',
    routeContractKey: 'route.hcm.configuration.connector-test.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/test`,
  },
  {
    apiFunction: 'executeIntegrationCommand:DRY_RUN_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-dry-run.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings/{version}/dry-runs`,
  },
  {
    apiFunction: 'executeIntegrationCommand:CREATE_EXECUTION',
    routeContractKey: 'route.hcm.configuration.connector-execution-create.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/executions`,
  },
  {
    apiFunction: 'executeIntegrationCommand:VALIDATE_DEFINITION',
    routeContractKey: 'route.hcm.configuration.connector-definition-validate.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/validate`,
  },
  {
    apiFunction: 'executeIntegrationCommand:SUBMIT_DEFINITION',
    routeContractKey: 'route.hcm.configuration.connector-definition-submit.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/submit`,
  },
  {
    apiFunction: 'executeIntegrationCommand:APPROVE_DEFINITION',
    routeContractKey: 'route.hcm.configuration.connector-definition-approve.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/approve`,
  },
  {
    apiFunction: 'executeIntegrationCommand:ACTIVATE_DEFINITION',
    routeContractKey: 'route.hcm.configuration.connector-definition-activate.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/activate`,
  },
  {
    apiFunction: 'executeIntegrationCommand:CREATE_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-create.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings`,
  },
  {
    apiFunction: 'executeIntegrationCommand:VALIDATE_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-validate.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings/{version}/validate`,
  },
  {
    apiFunction: 'executeIntegrationCommand:SUBMIT_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-submit.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings/{version}/submit`,
  },
  {
    apiFunction: 'executeIntegrationCommand:APPROVE_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-approve.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings/{version}/approve`,
  },
  {
    apiFunction: 'executeIntegrationCommand:ACTIVATE_MAPPING',
    routeContractKey: 'route.hcm.configuration.connector-mapping-version-activate.action',
    method: 'POST',
    path: `${CONNECTOR_BASE_PATH}/{connectorId}/mappings/{version}/activate`,
  },
  {
    apiFunction: 'executeIntegrationCommand:RECONCILE_EXECUTION',
    routeContractKey: 'route.hcm.configuration.connector-execution-reconcile.action',
    method: 'POST',
    path: `${EXECUTION_BASE_PATH}/{executionId}/reconcile`,
  },
  {
    apiFunction: 'executeIntegrationCommand:RETRY_EXECUTION',
    routeContractKey: 'route.hcm.configuration.connector-execution-retry.action',
    method: 'POST',
    path: `${EXECUTION_BASE_PATH}/{executionId}/retry`,
  },
  {
    apiFunction: 'executeIntegrationCommand:CANCEL_EXECUTION',
    routeContractKey: 'route.hcm.configuration.connector-execution-cancel.action',
    method: 'POST',
    path: `${EXECUTION_BASE_PATH}/{executionId}/cancel`,
  },
] as const;

type CommandKind = IntegrationCommand['kind'];

type ResolvedIntegrationCommand = Readonly<{
  path: string;
  actionKey: IntegrationActionKey;
  commandType: IntegrationCommandReceipt['commandType'];
  requiresObjectRevision: boolean;
  highRisk: boolean;
}>;

export const INTEGRATION_COMMAND_AUTHORITY_POLICY = Object.freeze({
  CREATE_DEFINITION: { requiresObjectRevision: false, highRisk: false },
  TEST_CONNECTOR: { requiresObjectRevision: false, highRisk: false },
  DRY_RUN_MAPPING: { requiresObjectRevision: true, highRisk: false },
  CREATE_EXECUTION: { requiresObjectRevision: false, highRisk: false },
  VALIDATE_DEFINITION: { requiresObjectRevision: true, highRisk: false },
  SUBMIT_DEFINITION: { requiresObjectRevision: true, highRisk: false },
  APPROVE_DEFINITION: { requiresObjectRevision: true, highRisk: true },
  ACTIVATE_DEFINITION: { requiresObjectRevision: true, highRisk: true },
  CREATE_MAPPING: { requiresObjectRevision: false, highRisk: false },
  VALIDATE_MAPPING: { requiresObjectRevision: true, highRisk: false },
  SUBMIT_MAPPING: { requiresObjectRevision: true, highRisk: false },
  APPROVE_MAPPING: { requiresObjectRevision: true, highRisk: true },
  ACTIVATE_MAPPING: { requiresObjectRevision: true, highRisk: true },
  RECONCILE_EXECUTION: { requiresObjectRevision: true, highRisk: true },
  RETRY_EXECUTION: { requiresObjectRevision: true, highRisk: true },
  CANCEL_EXECUTION: { requiresObjectRevision: true, highRisk: true },
} satisfies Readonly<
  Record<CommandKind, Readonly<{ requiresObjectRevision: boolean; highRisk: boolean }>>
>);

export class IntegrationCommandOutcomeUnknownError extends Error {
  readonly correlationId: string;

  constructor(correlationId: string, cause?: unknown) {
    super(`Integration command outcome is unknown. Correlation: ${correlationId}`, { cause });
    this.name = 'IntegrationCommandOutcomeUnknownError';
    this.correlationId = correlationId;
  }
}

export async function readIntegrationProjection(
  projection: HrisIntegrationControlPlaneProjection,
  query: IntegrationProjectionQuery,
  context: IntegrationReadContext
): Promise<IntegrationProjectionResponse> {
  validateReadContext(context);
  const spec = HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS[projection];
  const search = integrationProjectionSearch(projection, query);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${spec.browserApi}?${search.toString()}`,
    readConfig(context)
  );
  return assertIntegrationProjectionResponse(response.data.data, projection);
}

export async function readConnectorCatalog(
  query: ConnectorCatalogQuery,
  context: IntegrationReadContext
): Promise<ConnectorCatalogResponse> {
  validateReadContext(context);
  validateCatalogQuery(query);
  const search = new URLSearchParams({
    asOf: query.asOf,
    freshness: query.freshness,
    limit: String(query.limit ?? 50),
  });
  query.fields.forEach((field) => search.append('fields', field));
  addQueryValue(search, 'cursor', query.cursor);
  addQueryValue(search, 'filter', query.filter);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${CONNECTOR_BASE_PATH}?${search.toString()}`,
    readConfig(context)
  );
  return assertConnectorCatalogResponse(response.data.data);
}

export async function readConnectorExecution(
  executionPublicId: string,
  context: IntegrationReadContext
): Promise<ConnectorExecutionResponse> {
  validatePublicId(executionPublicId, 'execution');
  validateReadContext(context);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${EXECUTION_BASE_PATH}/${encodeURIComponent(executionPublicId)}`,
    readConfig(context)
  );
  return assertConnectorExecutionResponse(response.data.data);
}

export async function executeIntegrationCommand(
  command: IntegrationCommand,
  authority: IntegrationCommandAuthority
): Promise<IntegrationCommandReceipt> {
  const resolved = resolveIntegrationCommand(command);
  const body = closeIntegrationCommandBody(command);
  validateCommandAuthority(authority, resolved);
  const governed = resolved.highRisk
    ? productSurfaceHighRiskMutationConfig(authority.governance, {
        objectVersionHeader: true,
      })
    : productSurfaceGovernedMutationConfig(authority.governance, {
        objectVersionHeader: false,
      });

  let response: { data: ApiResponse<unknown> };
  try {
    response = await axiosInstance.post(resolved.path, body, {
      ...governed,
      headers: {
        ...browserSafeGovernedHeaders(governed.headers),
        'Idempotency-Key': authority.idempotencyKey,
        'X-Correlation-Id': authority.correlationId,
        'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
        ...(resolved.requiresObjectRevision
          ? { 'If-Match': `"${authority.expectedObjectRevision}"` }
          : {}),
      },
    });
  } catch (error) {
    if (hasHttpResponse(error)) throw error;
    throw new IntegrationCommandOutcomeUnknownError(authority.correlationId, error);
  }

  try {
    const receipt = assertIntegrationCommandReceipt(response.data.data);
    if (
      receipt.originatingAction !== resolved.actionKey ||
      receipt.commandType !== resolved.commandType ||
      receipt.correlationId !== authority.correlationId
    ) {
      throw new Error('Receipt is not bound to the submitted integration command.');
    }
    return receipt;
  } catch (error) {
    throw new IntegrationCommandOutcomeUnknownError(authority.correlationId, error);
  }
}

export function integrationProjectionSearch(
  projection: HrisIntegrationControlPlaneProjection,
  query: IntegrationProjectionQuery
): URLSearchParams {
  if (!isInstant(query.asOf)) throw new Error('Integration projection asOf is invalid.');
  const spec = HRIS_INTEGRATION_CONTROL_PLANE_PROJECTIONS[projection];
  const sort = query.sort ?? 'itemPublicId:ASC';
  const limit = query.limit ?? 50;
  if (
    !INTEGRATION_PROJECTION_SORTS[projection].includes(sort) ||
    !isBoundedInteger(limit, 1, 100)
  ) {
    throw new Error('Integration projection sort or limit is invalid.');
  }
  if (query.cursor !== undefined && !isCursor(query.cursor)) {
    throw new Error('Integration projection cursor is invalid.');
  }
  const filters = query.filters ?? {};
  if (
    Object.keys(filters).some((key) => !spec.filters.includes(key as never)) ||
    Object.values(filters).some((value) => value.length < 1 || value.length > 1000)
  ) {
    throw new Error('Integration projection filter is invalid.');
  }
  const search = new URLSearchParams({ asOf: query.asOf, sort, limit: String(limit) });
  Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => search.append(key, value));
  addQueryValue(search, 'cursor', query.cursor);
  return search;
}

function resolveIntegrationCommand(command: IntegrationCommand): ResolvedIntegrationCommand {
  switch (command.kind) {
    case 'CREATE_DEFINITION':
      return resolved(CONNECTOR_BASE_PATH, INTEGRATION_ACTION_KEYS.createDefinition, command.kind);
    case 'TEST_CONNECTOR':
      return connectorResolved(command, 'test', INTEGRATION_ACTION_KEYS.testConnector);
    case 'DRY_RUN_MAPPING':
      return mappingResolved(command, 'dry-runs', INTEGRATION_ACTION_KEYS.dryRunMapping);
    case 'CREATE_EXECUTION':
      return connectorResolved(command, 'executions', INTEGRATION_ACTION_KEYS.createExecution);
    case 'VALIDATE_DEFINITION':
      return connectorResolved(command, 'validate', INTEGRATION_ACTION_KEYS.validateDefinition);
    case 'SUBMIT_DEFINITION':
      return connectorResolved(command, 'submit', INTEGRATION_ACTION_KEYS.submitDefinition);
    case 'APPROVE_DEFINITION':
      return connectorResolved(command, 'approve', INTEGRATION_ACTION_KEYS.approveDefinition);
    case 'ACTIVATE_DEFINITION':
      return connectorResolved(command, 'activate', INTEGRATION_ACTION_KEYS.activateDefinition);
    case 'CREATE_MAPPING':
      return connectorResolved(command, 'mappings', INTEGRATION_ACTION_KEYS.createMapping);
    case 'VALIDATE_MAPPING':
      return mappingResolved(command, 'validate', INTEGRATION_ACTION_KEYS.validateMapping);
    case 'SUBMIT_MAPPING':
      return mappingResolved(command, 'submit', INTEGRATION_ACTION_KEYS.submitMapping);
    case 'APPROVE_MAPPING':
      return mappingResolved(command, 'approve', INTEGRATION_ACTION_KEYS.approveMapping);
    case 'ACTIVATE_MAPPING':
      return mappingResolved(command, 'activate', INTEGRATION_ACTION_KEYS.activateMapping);
    case 'RECONCILE_EXECUTION':
      return executionResolved(command, 'reconcile', INTEGRATION_ACTION_KEYS.reconcileExecution);
    case 'RETRY_EXECUTION':
      return executionResolved(command, 'retry', INTEGRATION_ACTION_KEYS.retryExecution);
    case 'CANCEL_EXECUTION':
      return executionResolved(command, 'cancel', INTEGRATION_ACTION_KEYS.cancelExecution);
  }
}

function closeIntegrationCommandBody(
  command: IntegrationCommand
): Readonly<Record<string, unknown>> {
  switch (command.kind) {
    case 'CREATE_DEFINITION': {
      const body = exactBody(command.body, [
        'connectorKey',
        'type',
        'endpoint',
        'secretRef',
        'egressPolicyKey',
      ]);
      if (
        !isPattern(body.connectorKey, /^[a-z][a-z0-9.-]{2,63}$/) ||
        !isOneOf(body.type, [
          'HTTPS',
          'SFTP',
          'OBJECT_STORE',
          'ERP',
          'BANK',
          'STATUTORY_PROVIDER',
        ]) ||
        !isAbsoluteUri(body.endpoint) ||
        !isPattern(body.secretRef, SECRET_REFERENCE) ||
        !isBoundedString(body.egressPolicyKey, 1, 128)
      ) {
        throw new Error('Connector definition body is invalid.');
      }
      return body;
    }
    case 'TEST_CONNECTOR': {
      const body = exactBody(command.body, ['testMode', 'sampleRef', 'sampleDigest']);
      if (
        !isOneOf(body.testMode, ['AUTHENTICATION', 'CONNECTIVITY', 'SCHEMA']) ||
        !isBoundedString(body.sampleRef, 1, 256) ||
        !isDigest(body.sampleDigest)
      ) {
        throw new Error('Connector test body is invalid.');
      }
      return body;
    }
    case 'DRY_RUN_MAPPING': {
      const body = exactBody(command.body, ['sampleRef', 'sampleDigest', 'maxRows', 'asOf']);
      if (
        !isBoundedString(body.sampleRef, 1, 256) ||
        !isDigest(body.sampleDigest) ||
        !isBoundedInteger(body.maxRows, 1, 1000) ||
        !isInstant(body.asOf)
      ) {
        throw new Error('Mapping dry-run body is invalid.');
      }
      return body;
    }
    case 'CREATE_EXECUTION': {
      const body = exactBody(command.body, ['operation', 'payloadRef', 'payloadDigest', 'asOf']);
      if (
        !isOneOf(body.operation, ['IMPORT', 'EXPORT', 'DISPATCH', 'RECONCILE']) ||
        !isBoundedString(body.payloadRef, 1, 256) ||
        !isDigest(body.payloadDigest) ||
        !isInstant(body.asOf)
      ) {
        throw new Error('Connector execution body is invalid.');
      }
      return body;
    }
    case 'VALIDATE_DEFINITION': {
      const body = exactBody(command.body, [
        'definitionDigest',
        'endpointPolicyRevision',
        'secretRevision',
      ]);
      if (
        !isDigest(body.definitionDigest) ||
        !isPositiveInteger(body.endpointPolicyRevision) ||
        !isPositiveInteger(body.secretRevision)
      ) {
        throw new Error('Definition validation body is invalid.');
      }
      return body;
    }
    case 'SUBMIT_DEFINITION':
    case 'SUBMIT_MAPPING':
      return approvalRequestBody(command.body);
    case 'APPROVE_DEFINITION':
    case 'APPROVE_MAPPING':
      return approvalDecisionBody(command.body);
    case 'ACTIVATE_DEFINITION':
    case 'ACTIVATE_MAPPING':
      return activationBody(command.body);
    case 'CREATE_MAPPING': {
      const body = exactBody(command.body, [
        'sourceSchemaVersion',
        'targetSchemaVersion',
        'mappingRef',
        'mappingDigest',
        'compatibilityMode',
        'effectiveFrom',
        'effectiveTo',
      ]);
      if (
        !isPositiveInteger(body.sourceSchemaVersion) ||
        !isPositiveInteger(body.targetSchemaVersion) ||
        !isPattern(body.mappingRef, REFERENCE) ||
        !isDigest(body.mappingDigest) ||
        !isOneOf(body.compatibilityMode, ['BACKWARD', 'FORWARD', 'FULL', 'EXACT']) ||
        !isInstant(body.effectiveFrom) ||
        !(body.effectiveTo === null || isInstant(body.effectiveTo))
      ) {
        throw new Error('Connector mapping body is invalid.');
      }
      return body;
    }
    case 'VALIDATE_MAPPING': {
      const body = exactBody(command.body, [
        'mappingDigest',
        'sourceSchemaDigest',
        'targetSchemaDigest',
      ]);
      if (
        !isDigest(body.mappingDigest) ||
        !isDigest(body.sourceSchemaDigest) ||
        !isDigest(body.targetSchemaDigest)
      ) {
        throw new Error('Mapping validation body is invalid.');
      }
      return body;
    }
    case 'RECONCILE_EXECUTION': {
      const body = exactBody(command.body, [
        'providerReceiptRef',
        'providerReceiptDigest',
        'expectedSourceCount',
        'asOf',
      ]);
      if (
        !isPattern(body.providerReceiptRef, REFERENCE) ||
        !isDigest(body.providerReceiptDigest) ||
        !isCount(body.expectedSourceCount) ||
        !isInstant(body.asOf)
      ) {
        throw new Error('Execution reconciliation body is invalid.');
      }
      return body;
    }
    case 'RETRY_EXECUTION': {
      const body = exactBody(command.body, [
        'failedItemIds',
        'failedItemSetDigest',
        'expectedRejectedCount',
        'reasonCode',
      ]);
      if (
        !Array.isArray(body.failedItemIds) ||
        body.failedItemIds.length < 1 ||
        body.failedItemIds.length > 10000 ||
        body.failedItemIds.some((item) => !isUuid(item)) ||
        new Set(body.failedItemIds).size !== body.failedItemIds.length ||
        !isDigest(body.failedItemSetDigest) ||
        !isBoundedInteger(body.expectedRejectedCount, 1, 10000) ||
        !isPattern(body.reasonCode, REASON_CODE)
      ) {
        throw new Error('Execution retry body is invalid.');
      }
      return body;
    }
    case 'CANCEL_EXECUTION': {
      const body = exactBody(command.body, ['reasonCode', 'compensationPolicyRef']);
      if (
        !isPattern(body.reasonCode, REASON_CODE) ||
        !(
          body.compensationPolicyRef === null ||
          isPattern(body.compensationPolicyRef, POLICY_REFERENCE)
        )
      ) {
        throw new Error('Execution cancellation body is invalid.');
      }
      return body;
    }
  }
}

function approvalRequestBody(bodyValue: object): Readonly<Record<string, unknown>> {
  const body = exactBody(bodyValue, ['approvalWorkflowKey', 'subjectRevision', 'payloadDigest']);
  if (
    !isPattern(body.approvalWorkflowKey, WORKFLOW_KEY) ||
    !isPositiveInteger(body.subjectRevision) ||
    !isDigest(body.payloadDigest)
  ) {
    throw new Error('Integration approval request body is invalid.');
  }
  return body;
}

function approvalDecisionBody(bodyValue: object): Readonly<Record<string, unknown>> {
  const body = exactBody(bodyValue, ['approvalReceiptId', 'decisionDigest']);
  if (!isUuid(body.approvalReceiptId) || !isDigest(body.decisionDigest)) {
    throw new Error('Integration approval decision body is invalid.');
  }
  return body;
}

function activationBody(bodyValue: object): Readonly<Record<string, unknown>> {
  const body = exactBody(bodyValue, ['approvalReceiptId', 'effectiveAt']);
  if (!isUuid(body.approvalReceiptId) || !isInstant(body.effectiveAt)) {
    throw new Error('Integration activation body is invalid.');
  }
  return body;
}

function connectorResolved(
  command: Extract<IntegrationCommand, { connectorPublicId: string }>,
  suffix: string,
  actionKey: IntegrationActionKey
): ResolvedIntegrationCommand {
  validatePublicId(command.connectorPublicId, 'connector');
  return resolved(
    `${CONNECTOR_BASE_PATH}/${encodeURIComponent(command.connectorPublicId)}/${suffix}`,
    actionKey,
    command.kind
  );
}

function mappingResolved(
  command: Extract<IntegrationCommand, { mappingVersion: number }>,
  suffix: string,
  actionKey: IntegrationActionKey
): ResolvedIntegrationCommand {
  validatePublicId(command.connectorPublicId, 'connector');
  if (!isPositiveInteger(command.mappingVersion)) {
    throw new Error('Integration mapping version is invalid.');
  }
  return resolved(
    `${CONNECTOR_BASE_PATH}/${encodeURIComponent(command.connectorPublicId)}/mappings/${command.mappingVersion}/${suffix}`,
    actionKey,
    command.kind
  );
}

function executionResolved(
  command: Extract<IntegrationCommand, { executionPublicId: string }>,
  suffix: string,
  actionKey: IntegrationActionKey
): ResolvedIntegrationCommand {
  validatePublicId(command.executionPublicId, 'execution');
  return resolved(
    `${EXECUTION_BASE_PATH}/${encodeURIComponent(command.executionPublicId)}/${suffix}`,
    actionKey,
    command.kind
  );
}

function resolved(
  path: string,
  actionKey: IntegrationActionKey,
  kind: CommandKind
): ResolvedIntegrationCommand {
  return Object.freeze({
    path,
    actionKey,
    commandType: INTEGRATION_COMMAND_TYPE_BY_ACTION[actionKey],
    ...INTEGRATION_COMMAND_AUTHORITY_POLICY[kind],
  });
}

function exactBody(
  bodyValue: object,
  orderedKeys: readonly string[]
): Readonly<Record<string, unknown>> {
  const body = bodyValue as Readonly<Record<string, unknown>>;
  const actualKeys = Object.keys(body);
  const expected = new Set(orderedKeys);
  if (
    actualKeys.length !== orderedKeys.length ||
    actualKeys.some((key) => !expected.has(key) || body[key] === undefined)
  ) {
    throw new Error('Integration command body does not match the closed transport contract.');
  }
  return Object.freeze(Object.fromEntries(orderedKeys.map((key) => [key, body[key]])));
}

function validateCommandAuthority(
  authority: IntegrationCommandAuthority,
  command: ResolvedIntegrationCommand
) {
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !isUuid(authority.correlationId) ||
    (command.requiresObjectRevision && !isPositiveInteger(authority.expectedObjectRevision))
  ) {
    throw new Error('Integration command authority is invalid.');
  }
  if (
    authority.governance.mode === 'SECURE' &&
    (authority.governance.idempotencyKey !== authority.idempotencyKey ||
      (command.requiresObjectRevision &&
        authority.governance.objectVersion !== authority.expectedObjectRevision))
  ) {
    throw new Error('Integration command authority does not match the command.');
  }
  if (
    command.highRisk &&
    (authority.governance.mode !== 'SECURE' || !authority.governance.stepUp)
  ) {
    throw new Error('High-risk integration command requires trusted step-up evidence.');
  }
}

function validateCatalogQuery(query: ConnectorCatalogQuery) {
  if (
    !isInstant(query.asOf) ||
    query.fields.length < 1 ||
    query.fields.length > 64 ||
    new Set(query.fields).size !== query.fields.length ||
    query.fields.some((field) => !/^[A-Za-z][A-Za-z0-9.]{0,63}$/.test(field)) ||
    !isBoundedInteger(query.limit ?? 50, 1, 100) ||
    (query.cursor !== undefined && !isCursor(query.cursor)) ||
    (query.filter !== undefined && !isBoundedString(query.filter, 1, 1000))
  ) {
    throw new Error('Connector catalog query is invalid.');
  }
}

function validateReadContext(context: IntegrationReadContext) {
  if (
    !isUuid(context.correlationId) ||
    (context.purposeCode !== undefined && !isBoundedString(context.purposeCode, 3, 64))
  ) {
    throw new Error('Integration read context is invalid.');
  }
}

function readConfig(context: IntegrationReadContext) {
  const scoped = productSurfaceReadScopeConfig(context.contextScopeKey, context.signal) ?? {};
  return {
    ...scoped,
    headers: {
      'X-Correlation-Id': context.correlationId,
      'X-Purpose-Code': context.purposeCode ?? 'HRIS_SYSTEM_ADMIN',
    },
  };
}

function browserSafeGovernedHeaders(headers: Readonly<Record<string, string>>) {
  const safeHeaders = { ...headers };
  delete safeHeaders['X-DWP-Step-Up-Challenge'];
  return safeHeaders;
}

function validatePublicId(value: string, kind: string) {
  if (!isUuid(value)) throw new Error(`Integration ${kind} public ID is invalid.`);
}

function addQueryValue(search: URLSearchParams, key: string, value?: string) {
  if (value !== undefined) search.set(key, value);
}

function hasHttpResponse(error: unknown): boolean {
  return isRecord(error) && isRecord(error.response) && typeof error.response.status === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 2048;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isPattern(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function isAbsoluteUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const uri = new URL(value);
    return uri.protocol.length > 1;
  } catch {
    return false;
  }
}
