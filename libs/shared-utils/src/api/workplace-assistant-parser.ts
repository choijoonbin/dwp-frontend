import {
  WORKPLACE_ASSISTANT_COMMAND_STATES,
  WORKPLACE_ASSISTANT_POLICY_RESULTS,
  WORKPLACE_ASSISTANT_REDACTION_STATES,
  WORKPLACE_ASSISTANT_REQUEST_STATES,
} from './workplace-assistant-contract';

import type {
  WorkplaceAssistantAlternative,
  WorkplaceAssistantAuditEvent,
  WorkplaceAssistantAuditEvents,
  WorkplaceAssistantAuthorityValidation,
  WorkplaceAssistantCommandReceipt,
  WorkplaceAssistantCommandResult,
  WorkplaceAssistantConsent,
  WorkplaceAssistantExecution,
  WorkplaceAssistantFeedbackReceipt,
  WorkplaceAssistantGovernance,
  WorkplaceAssistantGovernanceCommandResult,
  WorkplaceAssistantProposal,
  WorkplaceAssistantRequest,
  WorkplaceAssistantRequestedBookingItem,
} from './workplace-assistant-contract';
import type {
  WorkplaceBookingBatch,
  WorkplaceBookingBatchItem,
} from './workplace-booking-orchestration-api';
import type { WorkplaceResourceType } from './workplace-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RAW_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const RAW_PHONE = /(?:\+?\d[\d .()-]{7,}\d)/u;
const RAW_GOVERNMENT_ID = /\b\d{6}-?[1-4]\d{6}\b/u;
const SENSITIVE_KEY =
  /(?:email|phone|credential|password|secret|token|raw.?text|raw.?payload|request.?text)/iu;
const RESOURCE_TYPES = [
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
] as const satisfies readonly WorkplaceResourceType[];
const BATCH_STATES = [
  'ACCEPTED',
  'PROCESSING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'COMPENSATING',
  'COMPENSATED',
  'RESULT_UNKNOWN',
] as const;
const BATCH_ITEM_STATES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
  'COMPENSATION_PENDING',
  'COMPENSATED',
  'COMPENSATION_FAILED',
] as const;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function nullableText(value: unknown, label: string, max = 4000): string | null {
  return value === null || value === undefined ? null : text(value, label, max);
}

function redacted(value: unknown, label: string, max = 4000): string {
  const result = text(value, label, max);
  if (RAW_EMAIL.test(result) || RAW_PHONE.test(result) || RAW_GOVERNMENT_ID.test(result)) {
    throw new Error(`${label} contains unredacted personal data.`);
  }
  return result;
}

function nullableRedacted(value: unknown, label: string, max = 4000): string | null {
  return value === null || value === undefined ? null : redacted(value, label, max);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return value as number;
}

function nullableInteger(value: unknown, label: string, min = 0): number | null {
  return value === null || value === undefined ? null : integer(value, label, min);
}

function uuid(value: unknown, label: string): string {
  const result = text(value, label, 36);
  if (!UUID.test(result)) throw new Error(`${label} must be a UUID.`);
  return result;
}

function nullableUuid(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : uuid(value, label);
}

function instant(value: unknown, label: string): string {
  const result = text(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} must be an instant.`);
  return result;
}

function nullableInstant(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : instant(value, label);
}

function nullableResultCode(value: unknown, label: string): string | null {
  const result = nullableText(value, label, 120);
  if (result !== null && !/^[A-Z][A-Z0-9._:-]{0,119}$/u.test(result)) {
    throw new Error(`${label} must be a safe result code.`);
  }
  return result;
}

function enumeration<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`${label} is not an allowed value.`);
  }
  return value as T[number];
}

function array<T>(
  value: unknown,
  label: string,
  parser: (item: unknown, itemLabel: string) => T,
  max = 1000
): readonly T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => parser(item, `${label}[${index}]`));
}

function stringArray(value: unknown, label: string, max = 100): readonly string[] {
  return array(value, label, (item, itemLabel) => redacted(item, itemLabel, 1000), max);
}

function safeHref(value: unknown, label: string): string {
  const result = text(value, label, 1000);
  if (!result.startsWith('/v1/')) throw new Error(`${label} must be an internal API path.`);
  return result;
}

function nullableHref(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : safeHref(value, label);
}

function jsonObject(value: unknown, label: string, depth = 0): Readonly<Record<string, unknown>> {
  const item = object(value, label);
  if (depth > 8 || Object.keys(item).length > 100) throw new Error(`${label} is too complex.`);
  return Object.fromEntries(
    Object.entries(item).map(([key, child]) => {
      if (SENSITIVE_KEY.test(key)) throw new Error(`${label}.${key} is a sensitive field.`);
      return [key, jsonValue(child, `${label}.${key}`, depth + 1)];
    })
  );
}

function jsonValue(value: unknown, label: string, depth: number): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return redacted(value, label, 4000);
  if (Array.isArray(value)) {
    if (value.length > 200) throw new Error(`${label} is too large.`);
    return value.map((item, index) => jsonValue(item, `${label}[${index}]`, depth + 1));
  }
  return jsonObject(value, label, depth);
}

function requestedItem(value: unknown, label: string): WorkplaceAssistantRequestedBookingItem {
  const item = object(value, label);
  const startsAt = instant(item.startsAt, `${label}.startsAt`);
  const endsAt = instant(item.endsAt, `${label}.endsAt`);
  if (Date.parse(endsAt) <= Date.parse(startsAt))
    throw new Error(`${label} has an invalid time range.`);
  return {
    clientItemKey: text(item.clientItemKey, `${label}.clientItemKey`, 120),
    beneficiaryUserId: integer(item.beneficiaryUserId, `${label}.beneficiaryUserId`, 1),
    beneficiaryPersonPublicId: nullableUuid(
      item.beneficiaryPersonPublicId,
      `${label}.beneficiaryPersonPublicId`
    ),
    beneficiaryDisplayName: text(
      item.beneficiaryDisplayName,
      `${label}.beneficiaryDisplayName`,
      160
    ),
    delegationGrantId: nullableUuid(item.delegationGrantId, `${label}.delegationGrantId`),
    resourceType: enumeration(item.resourceType, RESOURCE_TYPES, `${label}.resourceType`),
    preferredResourceId: nullableUuid(item.preferredResourceId, `${label}.preferredResourceId`),
    siteId: nullableUuid(item.siteId, `${label}.siteId`),
    floorId: nullableUuid(item.floorId, `${label}.floorId`),
    startsAt,
    endsAt,
    purpose: nullableRedacted(item.purpose, `${label}.purpose`, 500),
    visibleToColleagues: bool(item.visibleToColleagues, `${label}.visibleToColleagues`),
    accessibleOnly: bool(item.accessibleOnly, `${label}.accessibleOnly`),
    requiredFeatures: stringArray(item.requiredFeatures, `${label}.requiredFeatures`, 20),
  };
}

function alternative(value: unknown, label: string): WorkplaceAssistantAlternative {
  const item = object(value, label);
  return {
    resourceId: uuid(item.resourceId, `${label}.resourceId`),
    displayName: text(item.displayName, `${label}.displayName`, 240),
    resourceType: enumeration(item.resourceType, RESOURCE_TYPES, `${label}.resourceType`),
    siteId: uuid(item.siteId, `${label}.siteId`),
    floorId: uuid(item.floorId, `${label}.floorId`),
    startsAt: instant(item.startsAt, `${label}.startsAt`),
    endsAt: instant(item.endsAt, `${label}.endsAt`),
    waitlistEligible: bool(item.waitlistEligible, `${label}.waitlistEligible`),
    rationale: redacted(item.rationale, `${label}.rationale`, 1000),
  };
}

function proposal(value: unknown, label: string): WorkplaceAssistantProposal {
  const item = object(value, label);
  return {
    proposalItemId: uuid(item.proposalItemId, `${label}.proposalItemId`),
    requestedItem: requestedItem(item.requestedItem, `${label}.requestedItem`),
    rationale: redacted(item.rationale, `${label}.rationale`, 2000),
    constraintsUsed: stringArray(item.constraintsUsed, `${label}.constraintsUsed`),
    exclusions: stringArray(item.exclusions, `${label}.exclusions`),
    policyResult: enumeration(
      item.policyResult,
      WORKPLACE_ASSISTANT_POLICY_RESULTS,
      `${label}.policyResult`
    ),
    conflicts: stringArray(item.conflicts, `${label}.conflicts`),
    alternatives: array(item.alternatives, `${label}.alternatives`, alternative, 100),
    authoritativeIntentItemId: nullableUuid(
      item.authoritativeIntentItemId,
      `${label}.authoritativeIntentItemId`
    ),
    authoritativeIntentItemVersion: nullableInteger(
      item.authoritativeIntentItemVersion,
      `${label}.authoritativeIntentItemVersion`,
      1
    ),
    selectedResourceId: nullableUuid(item.selectedResourceId, `${label}.selectedResourceId`),
    selectedResourceVersion: nullableInteger(
      item.selectedResourceVersion,
      `${label}.selectedResourceVersion`,
      0
    ),
    selectedResourceName: nullableText(
      item.selectedResourceName,
      `${label}.selectedResourceName`,
      240
    ),
    version: integer(item.version, `${label}.version`, 1),
  };
}

function validation(value: unknown, label: string): WorkplaceAssistantAuthorityValidation {
  const item = object(value, label);
  return {
    bookingIntentId: uuid(item.bookingIntentId, `${label}.bookingIntentId`),
    bookingIntentVersion: integer(item.bookingIntentVersion, `${label}.bookingIntentVersion`, 1),
    bookingIntentState: text(item.bookingIntentState, `${label}.bookingIntentState`, 80),
    allSelectedItemsValid: bool(item.allSelectedItemsValid, `${label}.allSelectedItemsValid`),
    validatedAt: instant(item.validatedAt, `${label}.validatedAt`),
    limitations: stringArray(item.limitations, `${label}.limitations`),
  };
}

function consent(value: unknown, label: string): WorkplaceAssistantConsent {
  const item = object(value, label);
  return {
    requestProcessingConsent: bool(
      item.requestProcessingConsent,
      `${label}.requestProcessingConsent`
    ),
    feedbackUseConsent: bool(item.feedbackUseConsent, `${label}.feedbackUseConsent`),
    tenantOptIn: bool(item.tenantOptIn, `${label}.tenantOptIn`),
    feedbackUseEnabled: bool(item.feedbackUseEnabled, `${label}.feedbackUseEnabled`),
  };
}

export function parseWorkplaceAssistantRequest(
  value: unknown,
  label = 'assistantRequest'
): WorkplaceAssistantRequest {
  const item = object(value, label);
  return {
    requestId: uuid(item.requestId, `${label}.requestId`),
    state: enumeration(item.state, WORKPLACE_ASSISTANT_REQUEST_STATES, `${label}.state`),
    redactedRequestText: nullableRedacted(item.redactedRequestText, `${label}.redactedRequestText`),
    redactionState: enumeration(
      item.redactionState,
      WORKPLACE_ASSISTANT_REDACTION_STATES,
      `${label}.redactionState`
    ),
    consent: consent(item.consent, `${label}.consent`),
    modelProviderReference: nullableText(
      item.modelProviderReference,
      `${label}.modelProviderReference`,
      160
    ),
    modelVersion: nullableText(item.modelVersion, `${label}.modelVersion`, 120),
    promptVersion: nullableText(item.promptVersion, `${label}.promptVersion`, 120),
    toolVersion: nullableText(item.toolVersion, `${label}.toolVersion`, 120),
    proposals: array(item.proposals, `${label}.proposals`, proposal, 50),
    validation:
      item.validation === null || item.validation === undefined
        ? null
        : validation(item.validation, `${label}.validation`),
    bookingBatchId: nullableUuid(item.bookingBatchId, `${label}.bookingBatchId`),
    batchStatusHref: nullableHref(item.batchStatusHref, `${label}.batchStatusHref`),
    requeryRequired: bool(item.requeryRequired, `${label}.requeryRequired`),
    lastResultCode: nullableText(item.lastResultCode, `${label}.lastResultCode`, 160),
    limitations: stringArray(item.limitations, `${label}.limitations`),
    version: integer(item.version, `${label}.version`, 1),
    retentionExpiresAt: instant(item.retentionExpiresAt, `${label}.retentionExpiresAt`),
    createdAt: instant(item.createdAt, `${label}.createdAt`),
    updatedAt: instant(item.updatedAt, `${label}.updatedAt`),
  };
}

function commandReceipt(value: unknown, label: string): WorkplaceAssistantCommandReceipt {
  const item = object(value, label);
  const acceptedAt = instant(item.acceptedAt, `${label}.acceptedAt`);
  const completedAt = nullableInstant(item.completedAt, `${label}.completedAt`);
  if (completedAt !== null && Date.parse(completedAt) < Date.parse(acceptedAt)) {
    throw new Error(`${label}.completedAt must not precede acceptedAt.`);
  }
  return {
    commandId: uuid(item.commandId, `${label}.commandId`),
    state: enumeration(item.state, WORKPLACE_ASSISTANT_COMMAND_STATES, `${label}.state`),
    statusHref: safeHref(item.statusHref, `${label}.statusHref`),
    replayed: bool(item.replayed, `${label}.replayed`),
    correlationId: nullableText(item.correlationId, `${label}.correlationId`, 160),
    resultCode: nullableResultCode(item.resultCode, `${label}.resultCode`),
    acceptedAt,
    completedAt,
  };
}

export function parseWorkplaceAssistantCommandResult(
  value: unknown,
  label = 'assistantCommandResult'
): WorkplaceAssistantCommandResult {
  const item = object(value, label);
  return {
    request: parseWorkplaceAssistantRequest(item.request, `${label}.request`),
    receipt: commandReceipt(item.receipt, `${label}.receipt`),
  };
}

function batchItem(value: unknown, label: string): WorkplaceBookingBatchItem {
  const item = object(value, label);
  return {
    batchItemId: uuid(item.batchItemId, `${label}.batchItemId`),
    intentItemId: uuid(item.intentItemId, `${label}.intentItemId`),
    holdId: uuid(item.holdId, `${label}.holdId`),
    clientItemKey: text(item.clientItemKey, `${label}.clientItemKey`, 120),
    beneficiaryUserId: integer(item.beneficiaryUserId, `${label}.beneficiaryUserId`, 1),
    beneficiaryPersonPublicId: nullableUuid(
      item.beneficiaryPersonPublicId,
      `${label}.beneficiaryPersonPublicId`
    ),
    beneficiaryDisplayName: text(
      item.beneficiaryDisplayName,
      `${label}.beneficiaryDisplayName`,
      160
    ),
    delegationGrantId: nullableUuid(item.delegationGrantId, `${label}.delegationGrantId`),
    resourceType: enumeration(item.resourceType, RESOURCE_TYPES, `${label}.resourceType`),
    resourceId: uuid(item.resourceId, `${label}.resourceId`),
    resourceDisplayName: text(item.resourceDisplayName, `${label}.resourceDisplayName`, 240),
    siteId: uuid(item.siteId, `${label}.siteId`),
    floorId: uuid(item.floorId, `${label}.floorId`),
    timeZone: text(item.timeZone, `${label}.timeZone`, 100),
    startsAt: instant(item.startsAt, `${label}.startsAt`),
    endsAt: instant(item.endsAt, `${label}.endsAt`),
    authority: enumeration(
      item.authority,
      ['WORKPLACE', 'CALENDAR'] as const,
      `${label}.authority`
    ),
    state: enumeration(item.state, BATCH_ITEM_STATES, `${label}.state`),
    ownerReferenceId: nullableText(item.ownerReferenceId, `${label}.ownerReferenceId`, 320),
    ownerVersion: nullableInteger(item.ownerVersion, `${label}.ownerVersion`, 0),
    errorCode: nullableText(item.errorCode, `${label}.errorCode`, 160),
    errorMessage: nullableRedacted(item.errorMessage, `${label}.errorMessage`, 1000),
    compensationAvailable: bool(item.compensationAvailable, `${label}.compensationAvailable`),
    requeryRequired: bool(item.requeryRequired, `${label}.requeryRequired`),
    version: integer(item.version, `${label}.version`, 1),
    updatedAt: instant(item.updatedAt, `${label}.updatedAt`),
  };
}

function bookingBatch(value: unknown, label: string): WorkplaceBookingBatch {
  const item = object(value, label);
  return {
    batchId: uuid(item.batchId, `${label}.batchId`),
    intentId: uuid(item.intentId, `${label}.intentId`),
    actorUserId: integer(item.actorUserId, `${label}.actorUserId`, 1),
    state: enumeration(item.state, BATCH_STATES, `${label}.state`),
    failurePolicy: enumeration(
      item.failurePolicy,
      ['KEEP_SUCCEEDED', 'COMPENSATE_ALL'] as const,
      `${label}.failurePolicy`
    ),
    reason: redacted(item.reason, `${label}.reason`, 500),
    items: array(item.items, `${label}.items`, batchItem, 50),
    terminal: bool(item.terminal, `${label}.terminal`),
    requeryRequired: bool(item.requeryRequired, `${label}.requeryRequired`),
    version: integer(item.version, `${label}.version`, 1),
    createdAt: instant(item.createdAt, `${label}.createdAt`),
    startedAt: nullableInstant(item.startedAt, `${label}.startedAt`),
    completedAt: nullableInstant(item.completedAt, `${label}.completedAt`),
    updatedAt: instant(item.updatedAt, `${label}.updatedAt`),
  };
}

export function parseWorkplaceAssistantExecution(
  value: unknown,
  label = 'assistantExecution'
): WorkplaceAssistantExecution {
  const item = object(value, label);
  return {
    requestId: uuid(item.requestId, `${label}.requestId`),
    state: enumeration(item.state, WORKPLACE_ASSISTANT_REQUEST_STATES, `${label}.state`),
    bookingIntentId: uuid(item.bookingIntentId, `${label}.bookingIntentId`),
    bookingBatchId: uuid(item.bookingBatchId, `${label}.bookingBatchId`),
    authoritativeBatch: bookingBatch(item.authoritativeBatch, `${label}.authoritativeBatch`),
    requeryRequired: bool(item.requeryRequired, `${label}.requeryRequired`),
    recoveryGuidance: nullableRedacted(item.recoveryGuidance, `${label}.recoveryGuidance`, 1000),
    refreshedAt: instant(item.refreshedAt, `${label}.refreshedAt`),
    requestVersion: integer(item.requestVersion, `${label}.requestVersion`, 1),
  };
}

export function parseWorkplaceAssistantFeedbackReceipt(
  value: unknown,
  label = 'feedbackReceipt'
): WorkplaceAssistantFeedbackReceipt {
  const item = object(value, label);
  return {
    feedbackId: uuid(item.feedbackId, `${label}.feedbackId`),
    requestId: uuid(item.requestId, `${label}.requestId`),
    rating: enumeration(item.rating, ['HELPFUL', 'NOT_HELPFUL'] as const, `${label}.rating`),
    redactedComment: nullableRedacted(item.redactedComment, `${label}.redactedComment`, 2000),
    eligibleForModelImprovementUse: bool(
      item.eligibleForModelImprovementUse,
      `${label}.eligibleForModelImprovementUse`
    ),
    auditEventId: uuid(item.auditEventId, `${label}.auditEventId`),
    createdAt: instant(item.createdAt, `${label}.createdAt`),
  };
}

export function parseWorkplaceAssistantGovernance(
  value: unknown,
  label = 'assistantGovernance'
): WorkplaceAssistantGovernance {
  const item = object(value, label);
  return {
    tenantOptIn: bool(item.tenantOptIn, `${label}.tenantOptIn`),
    killSwitch: bool(item.killSwitch, `${label}.killSwitch`),
    modelProviderReference: nullableText(
      item.modelProviderReference,
      `${label}.modelProviderReference`,
      160
    ),
    modelVersion: nullableText(item.modelVersion, `${label}.modelVersion`, 120),
    promptVersion: nullableText(item.promptVersion, `${label}.promptVersion`, 120),
    toolVersion: nullableText(item.toolVersion, `${label}.toolVersion`, 120),
    retentionDays: integer(item.retentionDays, `${label}.retentionDays`, 1, 365),
    feedbackUseEnabled: bool(item.feedbackUseEnabled, `${label}.feedbackUseEnabled`),
    redactionState: enumeration(
      item.redactionState,
      ['READY', 'BLOCKED'] as const,
      `${label}.redactionState`
    ),
    version: integer(item.version, `${label}.version`, 0),
    updatedAt: nullableInstant(item.updatedAt, `${label}.updatedAt`),
    updatedBy: nullableInteger(item.updatedBy, `${label}.updatedBy`, 1),
  };
}

export function parseWorkplaceAssistantGovernanceCommandResult(
  value: unknown,
  label = 'governanceCommandResult'
): WorkplaceAssistantGovernanceCommandResult {
  const item = object(value, label);
  return {
    governance: parseWorkplaceAssistantGovernance(item.governance, `${label}.governance`),
    receipt: commandReceipt(item.receipt, `${label}.receipt`),
  };
}

function auditEvent(value: unknown, label: string): WorkplaceAssistantAuditEvent {
  const item = object(value, label);
  return {
    auditEventId: uuid(item.auditEventId, `${label}.auditEventId`),
    requestId: nullableUuid(item.requestId, `${label}.requestId`),
    eventType: text(item.eventType, `${label}.eventType`, 160),
    actorUserId: integer(item.actorUserId, `${label}.actorUserId`, 1),
    metadata: jsonObject(item.metadata, `${label}.metadata`),
    correlationId: nullableText(item.correlationId, `${label}.correlationId`, 160),
    createdAt: instant(item.createdAt, `${label}.createdAt`),
  };
}

export function parseWorkplaceAssistantAuditEvents(
  value: unknown,
  label = 'assistantAuditEvents'
): WorkplaceAssistantAuditEvents {
  const item = object(value, label);
  return {
    items: array(item.items, `${label}.items`, auditEvent, 500),
    generatedAt: instant(item.generatedAt, `${label}.generatedAt`),
  };
}
