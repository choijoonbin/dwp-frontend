import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  assertAutomationCatalogProjection,
  assertAutomationCommandReceipt,
  assertAutomationRunProjection,
} from './automation-control-plane-model';
import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CATALOG_FIELDS,
} from './automation-control-plane-types';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type {
  AutomationCatalogProjection,
  AutomationCatalogQuery,
  AutomationCommand,
  AutomationCommandAuthority,
  AutomationCommandReceipt,
  AutomationReadContext,
  AutomationRunProjection,
  AutomationRunQuery,
} from './automation-control-plane-types';

const AUTOMATION_BASE_PATH = '/api/platform/v1/admin/hris/automations' as const;
const AUTOMATION_RUN_BASE_PATH = '/api/platform/v1/admin/hris/automation-runs' as const;
const AUTOMATION_SCHEDULE_BASE_PATH = '/api/platform/v1/admin/hris/automation-schedules' as const;

export const AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS = Object.freeze([
  ['GET', AUTOMATION_BASE_PATH],
  ['POST', AUTOMATION_BASE_PATH],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/runs`],
  ['GET', `${AUTOMATION_RUN_BASE_PATH}/{runId}`],
  ['POST', `${AUTOMATION_RUN_BASE_PATH}/{runId}/retry`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/versions`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/versions/{version}/validate`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/versions/{version}/submit`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/versions/{version}/approve`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/versions/{version}/activate`],
  ['POST', `${AUTOMATION_BASE_PATH}/{automationId}/schedules`],
  ['POST', `${AUTOMATION_SCHEDULE_BASE_PATH}/{scheduleId}/submit`],
  ['POST', `${AUTOMATION_SCHEDULE_BASE_PATH}/{scheduleId}/approve`],
  ['POST', `${AUTOMATION_SCHEDULE_BASE_PATH}/{scheduleId}/activate`],
  ['POST', `${AUTOMATION_SCHEDULE_BASE_PATH}/{scheduleId}/suspend`],
  ['POST', `${AUTOMATION_RUN_BASE_PATH}/{runId}/cancel`],
] as const);

type ResolvedAutomationCommand = Readonly<{
  path: string;
  originatingAction: (typeof AUTOMATION_ACTION_KEYS)[keyof typeof AUTOMATION_ACTION_KEYS];
  commandType: string;
  requiresObjectRevision: boolean;
  highRisk: boolean;
}>;

type AutomationCommandKind = AutomationCommand['kind'];

export const AUTOMATION_COMMAND_AUTHORITY_POLICY = Object.freeze({
  CREATE_DEFINITION: { requiresObjectRevision: false, highRisk: false },
  QUEUE_RUN: { requiresObjectRevision: true, highRisk: true },
  RETRY_RUN: { requiresObjectRevision: true, highRisk: true },
  CREATE_VERSION: { requiresObjectRevision: true, highRisk: false },
  VALIDATE_VERSION: { requiresObjectRevision: true, highRisk: false },
  SUBMIT_VERSION: { requiresObjectRevision: true, highRisk: false },
  APPROVE_VERSION: { requiresObjectRevision: true, highRisk: true },
  ACTIVATE_VERSION: { requiresObjectRevision: true, highRisk: true },
  CREATE_SCHEDULE: { requiresObjectRevision: true, highRisk: false },
  SUBMIT_SCHEDULE: { requiresObjectRevision: true, highRisk: false },
  APPROVE_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
  ACTIVATE_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
  SUSPEND_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
  CANCEL_RUN: { requiresObjectRevision: true, highRisk: true },
} satisfies Readonly<
  Record<AutomationCommandKind, Readonly<{ requiresObjectRevision: boolean; highRisk: boolean }>>
>);

const COMMAND_TYPE_BY_ACTION: Readonly<
  Record<ResolvedAutomationCommand['originatingAction'], string>
> = Object.freeze({
  [AUTOMATION_ACTION_KEYS.createDefinition]: 'CREATE_AUTOMATION_DEFINITION',
  [AUTOMATION_ACTION_KEYS.queueRun]: 'QUEUE_AUTOMATION_RUN',
  [AUTOMATION_ACTION_KEYS.retryRun]: 'RETRY_AUTOMATION_RUN',
  [AUTOMATION_ACTION_KEYS.createVersion]: 'CREATE_AUTOMATION_VERSION',
  [AUTOMATION_ACTION_KEYS.validateVersion]: 'VALIDATE_AUTOMATION_VERSION',
  [AUTOMATION_ACTION_KEYS.submitVersion]: 'SUBMIT_AUTOMATION_VERSION',
  [AUTOMATION_ACTION_KEYS.approveVersion]: 'APPROVE_AUTOMATION_VERSION',
  [AUTOMATION_ACTION_KEYS.activateVersion]: 'ACTIVATE_AUTOMATION_VERSION',
  [AUTOMATION_ACTION_KEYS.createSchedule]: 'CREATE_AUTOMATION_SCHEDULE',
  [AUTOMATION_ACTION_KEYS.submitSchedule]: 'SUBMIT_AUTOMATION_SCHEDULE',
  [AUTOMATION_ACTION_KEYS.approveSchedule]: 'APPROVE_AUTOMATION_SCHEDULE',
  [AUTOMATION_ACTION_KEYS.activateSchedule]: 'ACTIVATE_AUTOMATION_SCHEDULE',
  [AUTOMATION_ACTION_KEYS.suspendSchedule]: 'SUSPEND_AUTOMATION_SCHEDULE',
  [AUTOMATION_ACTION_KEYS.cancelRun]: 'CANCEL_AUTOMATION_RUN',
});

export class AutomationCommandOutcomeUnknownError extends Error {
  readonly correlationId: string;

  constructor(correlationId: string, cause?: unknown) {
    super(`Automation command outcome is unknown. Correlation: ${correlationId}`, { cause });
    this.name = 'AutomationCommandOutcomeUnknownError';
    this.correlationId = correlationId;
  }
}

export async function readAutomationCatalog(
  query: AutomationCatalogQuery,
  context: AutomationReadContext
): Promise<AutomationCatalogProjection> {
  validateReadContext(context);
  const search = new URLSearchParams({
    asOf: query.asOf,
    freshness: query.freshness ?? 'FRESH_ONLY',
    limit: String(query.limit ?? 50),
  });
  for (const field of query.fields ?? AUTOMATION_CATALOG_FIELDS) search.append('fields', field);
  for (const resourceType of query.resourceTypes ?? []) {
    search.append('resourceTypes', resourceType);
  }
  addQueryValue(search, 'cursor', query.cursor);
  addQueryValue(search, 'filter', query.filter);
  const scoped = productSurfaceReadScopeConfig(context.contextScopeKey, context.signal) ?? {};
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${AUTOMATION_BASE_PATH}?${search.toString()}`,
    {
      ...scoped,
      headers: {
        'X-Correlation-ID': context.correlationId,
        'X-Purpose-Code': context.purposeCode ?? 'HRIS_SYSTEM_ADMIN',
      },
    }
  );
  return assertAutomationCatalogProjection(response.data.data);
}

export async function readAutomationRun(
  runPublicId: string,
  query: AutomationRunQuery,
  context: AutomationReadContext
): Promise<AutomationRunProjection> {
  validatePublicId(runPublicId, 'run');
  validateReadContext(context);
  const search = new URLSearchParams({
    asOf: query.asOf,
    freshness: query.freshness ?? 'FRESH_ONLY',
    limit: String(query.limit ?? 50),
  });
  addQueryValue(search, 'attemptCursor', query.attemptCursor);
  addQueryValue(search, 'itemCursor', query.itemCursor);
  addQueryValue(search, 'checkpointCursor', query.checkpointCursor);
  const scoped = productSurfaceReadScopeConfig(context.contextScopeKey, context.signal) ?? {};
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${AUTOMATION_RUN_BASE_PATH}/${encodeURIComponent(runPublicId)}?${search.toString()}`,
    {
      ...scoped,
      headers: {
        'X-Correlation-ID': context.correlationId,
        'X-Purpose-Code': context.purposeCode ?? 'HRIS_SYSTEM_ADMIN',
      },
    }
  );
  return assertAutomationRunProjection(response.data.data);
}

export async function executeAutomationCommand(
  command: AutomationCommand,
  authority: AutomationCommandAuthority
): Promise<AutomationCommandReceipt> {
  const resolved = resolveCommand(command);
  const body = closeAutomationCommandBody(command);
  validateCommandAuthority(authority, resolved);
  const governed = resolved.highRisk
    ? productSurfaceHighRiskMutationConfig(authority.governance, {
        objectVersionHeader: false,
      })
    : productSurfaceGovernedMutationConfig(authority.governance, {
        objectVersionHeader: false,
      });
  const response: { data: ApiResponse<unknown> } = await axiosInstance.post(resolved.path, body, {
    ...governed,
    headers: {
      ...browserSafeGovernedHeaders(governed.headers),
      'Idempotency-Key': authority.idempotencyKey,
      'X-Correlation-ID': authority.correlationId,
      'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      ...(resolved.requiresObjectRevision
        ? { 'If-Match': `"${authority.expectedObjectRevision}"` }
        : {}),
    },
  });

  try {
    const receipt = assertAutomationCommandReceipt(response.data.data);
    if (
      receipt.originatingAction !== resolved.originatingAction ||
      receipt.commandType !== resolved.commandType ||
      receipt.correlationId !== authority.correlationId
    ) {
      throw new Error('Receipt is not bound to the submitted automation command.');
    }
    return receipt;
  } catch (error) {
    throw new AutomationCommandOutcomeUnknownError(authority.correlationId, error);
  }
}

function closeAutomationCommandBody(command: AutomationCommand): Readonly<Record<string, unknown>> {
  switch (command.kind) {
    case 'CREATE_DEFINITION':
      return exactBody(command.body, [
        'automationKey',
        'displayName',
        'description',
        'ownerDomain',
      ]);
    case 'QUEUE_RUN':
      return exactBody(command.body, [
        'scopeType',
        'scopeId',
        'inputReference',
        'inputDigest',
        'expectedItemCount',
      ]);
    case 'RETRY_RUN':
      return exactBody(command.body, ['evidenceDigest']);
    case 'CREATE_VERSION':
      return exactBody(command.body, [
        'definitionPayload',
        'definitionDigest',
        'executionPolicy',
        'executionPolicyDigest',
        'manualConcurrencyKeyTemplate',
        'compensationPolicyRef',
        'compensationPolicyDigest',
        'handlerOwnerService',
        'handlerKey',
        'handlerContractVersion',
        'handlerManifestRevision',
        'handlerManifestDigest',
        'signatureKeyId',
        'signature',
        'signatureDigest',
        'inputSchemaRef',
        'inputSchemaDigest',
        'receiptSchemaRef',
        'receiptSchemaDigest',
        'allowedScopeTypes',
        'retryMode',
        'maxAttempts',
      ]);
    case 'VALIDATE_VERSION':
    case 'SUBMIT_VERSION':
    case 'APPROVE_VERSION':
    case 'ACTIVATE_VERSION':
    case 'SUBMIT_SCHEDULE':
    case 'APPROVE_SCHEDULE':
    case 'ACTIVATE_SCHEDULE':
    case 'SUSPEND_SCHEDULE':
      return exactBody(command.body, ['evidenceDigest', 'reason']);
    case 'CREATE_SCHEDULE':
      return exactBody(command.body, [
        'pinnedVersionNumber',
        'expression',
        'timezone',
        'timezoneDatabaseRevision',
        'inputTemplateRef',
        'inputTemplateDigest',
        'concurrencyKeyTemplate',
        'schedulePolicyDigest',
      ]);
    case 'CANCEL_RUN':
      return exactBody(command.body, ['reason', 'evidenceDigest']);
  }
}

function exactBody(
  body: Readonly<Record<string, unknown>>,
  orderedKeys: readonly string[]
): Readonly<Record<string, unknown>> {
  const actualKeys = Object.keys(body);
  const expectedKeys = new Set(orderedKeys);
  if (
    actualKeys.length !== orderedKeys.length ||
    actualKeys.some((key) => !expectedKeys.has(key) || body[key] === undefined)
  ) {
    throw new Error('Automation command body does not match the closed owner contract.');
  }
  return Object.freeze(Object.fromEntries(orderedKeys.map((key) => [key, body[key]])));
}

function resolveCommand(command: AutomationCommand): ResolvedAutomationCommand {
  switch (command.kind) {
    case 'CREATE_DEFINITION':
      return resolved(
        AUTOMATION_BASE_PATH,
        AUTOMATION_ACTION_KEYS.createDefinition,
        'CREATE_DEFINITION'
      );
    case 'QUEUE_RUN':
      validatePublicId(command.definitionPublicId, 'definition');
      return resolved(
        `${definitionPath(command.definitionPublicId)}/runs`,
        AUTOMATION_ACTION_KEYS.queueRun,
        'QUEUE_RUN'
      );
    case 'RETRY_RUN':
      validatePublicId(command.runPublicId, 'run');
      return resolved(
        `${runPath(command.runPublicId)}/retry`,
        AUTOMATION_ACTION_KEYS.retryRun,
        'RETRY_RUN'
      );
    case 'CREATE_VERSION':
      validatePublicId(command.definitionPublicId, 'definition');
      return resolved(
        `${definitionPath(command.definitionPublicId)}/versions`,
        AUTOMATION_ACTION_KEYS.createVersion,
        'CREATE_VERSION'
      );
    case 'VALIDATE_VERSION':
      return versionCommand(command, 'validate', AUTOMATION_ACTION_KEYS.validateVersion);
    case 'SUBMIT_VERSION':
      return versionCommand(command, 'submit', AUTOMATION_ACTION_KEYS.submitVersion);
    case 'APPROVE_VERSION':
      return versionCommand(command, 'approve', AUTOMATION_ACTION_KEYS.approveVersion);
    case 'ACTIVATE_VERSION':
      return versionCommand(command, 'activate', AUTOMATION_ACTION_KEYS.activateVersion);
    case 'CREATE_SCHEDULE':
      validatePublicId(command.definitionPublicId, 'definition');
      return resolved(
        `${definitionPath(command.definitionPublicId)}/schedules`,
        AUTOMATION_ACTION_KEYS.createSchedule,
        'CREATE_SCHEDULE'
      );
    case 'SUBMIT_SCHEDULE':
      return scheduleCommand(
        command.kind,
        command.schedulePublicId,
        'submit',
        AUTOMATION_ACTION_KEYS.submitSchedule
      );
    case 'APPROVE_SCHEDULE':
      return scheduleCommand(
        command.kind,
        command.schedulePublicId,
        'approve',
        AUTOMATION_ACTION_KEYS.approveSchedule
      );
    case 'ACTIVATE_SCHEDULE':
      return scheduleCommand(
        command.kind,
        command.schedulePublicId,
        'activate',
        AUTOMATION_ACTION_KEYS.activateSchedule
      );
    case 'SUSPEND_SCHEDULE':
      return scheduleCommand(
        command.kind,
        command.schedulePublicId,
        'suspend',
        AUTOMATION_ACTION_KEYS.suspendSchedule
      );
    case 'CANCEL_RUN':
      validatePublicId(command.runPublicId, 'run');
      return resolved(
        `${runPath(command.runPublicId)}/cancel`,
        AUTOMATION_ACTION_KEYS.cancelRun,
        'CANCEL_RUN'
      );
  }
}

function versionCommand(
  command: Extract<
    AutomationCommand,
    { kind: 'VALIDATE_VERSION' | 'SUBMIT_VERSION' | 'APPROVE_VERSION' | 'ACTIVATE_VERSION' }
  >,
  suffix: string,
  action: ResolvedAutomationCommand['originatingAction']
): ResolvedAutomationCommand {
  validatePublicId(command.definitionPublicId, 'definition');
  if (!Number.isSafeInteger(command.versionNumber) || command.versionNumber < 1) {
    throw new Error('Automation version number is invalid.');
  }
  return resolved(
    `${definitionPath(command.definitionPublicId)}/versions/${command.versionNumber}/${suffix}`,
    action,
    command.kind
  );
}

function scheduleCommand(
  kind: Extract<
    AutomationCommandKind,
    'SUBMIT_SCHEDULE' | 'APPROVE_SCHEDULE' | 'ACTIVATE_SCHEDULE' | 'SUSPEND_SCHEDULE'
  >,
  schedulePublicId: string,
  suffix: string,
  action: ResolvedAutomationCommand['originatingAction']
): ResolvedAutomationCommand {
  validatePublicId(schedulePublicId, 'schedule');
  return resolved(`${schedulePath(schedulePublicId)}/${suffix}`, action, kind);
}

function resolved(
  path: string,
  originatingAction: ResolvedAutomationCommand['originatingAction'],
  kind: AutomationCommandKind
): ResolvedAutomationCommand {
  const policy = AUTOMATION_COMMAND_AUTHORITY_POLICY[kind];
  return Object.freeze({
    path,
    originatingAction,
    commandType: COMMAND_TYPE_BY_ACTION[originatingAction],
    ...policy,
  });
}

function browserSafeGovernedHeaders(headers: Readonly<Record<string, string>>) {
  const safeHeaders = { ...headers };
  delete safeHeaders['X-DWP-Step-Up-Challenge'];
  delete safeHeaders['X-DWP-Expected-Object-Version'];
  return safeHeaders;
}

function validateCommandAuthority(
  authority: AutomationCommandAuthority,
  command: ResolvedAutomationCommand
) {
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !isUuid(authority.correlationId) ||
    (command.requiresObjectRevision &&
      (!Number.isSafeInteger(authority.expectedObjectRevision) ||
        authority.expectedObjectRevision! < 1))
  ) {
    throw new Error('Automation command authority is invalid.');
  }
  if (
    authority.governance.mode === 'SECURE' &&
    (authority.governance.idempotencyKey !== authority.idempotencyKey ||
      (command.requiresObjectRevision &&
        authority.governance.objectVersion !== authority.expectedObjectRevision))
  ) {
    throw new Error('Automation command authority does not match the command.');
  }
  if (
    command.highRisk &&
    (authority.governance.mode !== 'SECURE' || !authority.governance.stepUp)
  ) {
    throw new Error('High-risk automation command requires trusted step-up evidence.');
  }
}

function validateReadContext(context: AutomationReadContext) {
  if (
    !isUuid(context.correlationId) ||
    (context.purposeCode !== undefined &&
      (context.purposeCode.length < 3 || context.purposeCode.length > 64))
  ) {
    throw new Error('Automation read context is invalid.');
  }
}

function validatePublicId(value: string, kind: string) {
  if (!isUuid(value)) throw new Error(`Automation ${kind} public ID is invalid.`);
}

function definitionPath(definitionPublicId: string) {
  return `${AUTOMATION_BASE_PATH}/${encodeURIComponent(definitionPublicId)}`;
}

function runPath(runPublicId: string) {
  return `${AUTOMATION_RUN_BASE_PATH}/${encodeURIComponent(runPublicId)}`;
}

function schedulePath(schedulePublicId: string) {
  return `${AUTOMATION_SCHEDULE_BASE_PATH}/${encodeURIComponent(schedulePublicId)}`;
}

function addQueryValue(search: URLSearchParams, key: string, value?: string) {
  if (value !== undefined) search.set(key, value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
