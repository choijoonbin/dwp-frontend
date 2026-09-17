import {
  WORKPLACE_SAFETY_ATTEMPT_STATES,
  WORKPLACE_SAFETY_AVAILABILITY_STATES,
  WORKPLACE_SAFETY_COMMAND_STATES,
  WORKPLACE_SAFETY_CONNECTOR_KINDS,
  WORKPLACE_SAFETY_CONNECTOR_STATES,
  WORKPLACE_SAFETY_DELIVERY_CHANNELS,
  WORKPLACE_SAFETY_DISPATCH_STATES,
  WORKPLACE_SAFETY_FRESHNESS_STATES,
  WORKPLACE_SAFETY_INCIDENT_STATES,
  WORKPLACE_SAFETY_MESSAGE_DIRECTIONS,
  WORKPLACE_SAFETY_RESPONSE_STATES,
  WORKPLACE_SAFETY_SEVERITIES,
  WORKPLACE_SAFETY_SOURCE_KINDS,
} from './workplace-safety-contract';

import type {
  WorkplaceSafetyActivationPreview,
  WorkplaceSafetyActivationPreviewCommandResult,
  WorkplaceSafetyAssemblyCommandResult,
  WorkplaceSafetyAssemblyConfirmation,
  WorkplaceSafetyAudienceMember,
  WorkplaceSafetyAudienceSnapshot,
  WorkplaceSafetyClosureCommandResult,
  WorkplaceSafetyClosurePreview,
  WorkplaceSafetyClosurePreviewCommandResult,
  WorkplaceSafetyClosureRequest,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyConnectorTruth,
  WorkplaceSafetyConnectorCommandResult,
  WorkplaceSafetyDispatchSummary,
  WorkplaceSafetyExportCommandResult,
  WorkplaceSafetyGuardedExport,
  WorkplaceSafetyIncident,
  WorkplaceSafetyIncidentCommandResult,
  WorkplaceSafetyIncidentMessage,
  WorkplaceSafetyMessageCommandResult,
  WorkplaceSafetyPostIncidentReport,
  WorkplaceSafetyResponseCommandResult,
  WorkplaceSafetyScopeRevisionPreview,
  WorkplaceSafetyScopePreviewCommandResult,
  WorkplaceSafetySheet,
  WorkplaceSafetySourceSummary,
} from './workplace-safety-contract';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RAW_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const FORBIDDEN_PROJECTION_KEY =
  /^(?:email|phone|fullName|rawName|credential|credentialValue|secret|token|qrCode|nfcValue|badgeCode|passport|idNumber)$/iu;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertProjectionSafe(value: unknown, path = 'safety'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertProjectionSafe(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PROJECTION_KEY.test(key)) {
      throw new Error(`Sensitive field is not allowed in ${path}: ${key}.`);
    }
    assertProjectionSafe(item, `${path}.${key}`);
  }
}

function safeObject(value: unknown, label: string) {
  assertProjectionSafe(value, label);
  return object(value, label);
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a string.`);
  return value;
}

function optionalString(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : string(value, label);
}

function maskedString(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (RAW_EMAIL_PATTERN.test(parsed)) {
    throw new Error(`${label} must not expose a raw email address.`);
  }
  return parsed;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null || value === undefined ? null : number(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function uuid(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!UUID_PATTERN.test(parsed)) throw new Error(`${label} must be a UUID.`);
  return parsed;
}

function instant(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${label} must be an instant.`);
  return parsed;
}

function optionalInstant(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : instant(value, label);
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} has an unsupported value.`);
  }
  return value as T;
}

function array<T>(
  value: unknown,
  label: string,
  parser: (item: unknown, itemLabel: string) => T
): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => parser(item, `${label}[${index}]`));
}

function strings(value: unknown, label: string) {
  return array(value, label, string);
}

function uuids(value: unknown, label: string) {
  return array(value, label, uuid);
}

function sourceSummary(value: unknown, label: string): WorkplaceSafetySourceSummary {
  const item = safeObject(value, label);
  return {
    source: enumeration(item.source, WORKPLACE_SAFETY_SOURCE_KINDS, `${label}.source`),
    candidateCount: number(item.candidateCount, `${label}.candidateCount`),
    includedCount: number(item.includedCount, `${label}.includedCount`),
    excludedCount: number(item.excludedCount, `${label}.excludedCount`),
    unknownCount: number(item.unknownCount, `${label}.unknownCount`),
    coveragePercent: nullableNumber(item.coveragePercent, `${label}.coveragePercent`),
    freshness: enumeration(item.freshness, WORKPLACE_SAFETY_FRESHNESS_STATES, `${label}.freshness`),
    availability: enumeration(
      item.availability,
      WORKPLACE_SAFETY_AVAILABILITY_STATES,
      `${label}.availability`
    ),
    sourceAt: optionalInstant(item.sourceAt, `${label}.sourceAt`),
    receivedAt: optionalInstant(item.receivedAt, `${label}.receivedAt`),
  };
}

function audienceMember(value: unknown, label: string): WorkplaceSafetyAudienceMember {
  const item = safeObject(value, label);
  const subjectKeySha256 = string(item.subjectKeySha256, `${label}.subjectKeySha256`);
  if (!SHA256_PATTERN.test(subjectKeySha256)) {
    throw new Error(`${label}.subjectKeySha256 must be a SHA-256 digest.`);
  }
  return {
    audienceMemberId: uuid(item.audienceMemberId, `${label}.audienceMemberId`),
    subjectKeySha256,
    subjectUserId: nullableNumber(item.subjectUserId, `${label}.subjectUserId`),
    maskedLabel: maskedString(item.maskedLabel, `${label}.maskedLabel`),
    sources: array(item.sources, `${label}.sources`, (entry, entryLabel) =>
      enumeration(entry, WORKPLACE_SAFETY_SOURCE_KINDS, entryLabel)
    ),
    included: boolean(item.included, `${label}.included`),
    exclusionCode: optionalString(item.exclusionCode, `${label}.exclusionCode`),
    unknownIdentity: boolean(item.unknownIdentity, `${label}.unknownIdentity`),
  };
}

export function parseWorkplaceSafetyAudienceSnapshot(
  value: unknown,
  label = 'audience'
): WorkplaceSafetyAudienceSnapshot {
  const item = safeObject(value, label);
  return {
    audienceSnapshotId: uuid(item.audienceSnapshotId, `${label}.audienceSnapshotId`),
    totalCandidates: number(item.totalCandidates, `${label}.totalCandidates`),
    deduplicatedCount: number(item.deduplicatedCount, `${label}.deduplicatedCount`),
    excludedCount: number(item.excludedCount, `${label}.excludedCount`),
    unknownCount: number(item.unknownCount, `${label}.unknownCount`),
    finalTargetCount: number(item.finalTargetCount, `${label}.finalTargetCount`),
    sources: array(item.sources, `${label}.sources`, sourceSummary),
    members: array(item.members, `${label}.members`, audienceMember),
    asOf: instant(item.asOf, `${label}.asOf`),
  };
}

export function parseWorkplaceSafetyConnectorTruth(
  value: unknown,
  label = 'connector'
): WorkplaceSafetyConnectorTruth {
  const item = safeObject(value, label);
  return {
    kind: enumeration(item.kind, WORKPLACE_SAFETY_CONNECTOR_KINDS, `${label}.kind`),
    providerCode: optionalString(item.providerCode, `${label}.providerCode`),
    state: enumeration(item.state, WORKPLACE_SAFETY_CONNECTOR_STATES, `${label}.state`),
    configurationVersion: number(item.configurationVersion, `${label}.configurationVersion`),
    observedConfigurationVersion: nullableNumber(
      item.observedConfigurationVersion,
      `${label}.observedConfigurationVersion`
    ),
    evidenceReference: optionalString(item.evidenceReference, `${label}.evidenceReference`),
    sourceAt: optionalInstant(item.sourceAt, `${label}.sourceAt`),
    receivedAt: optionalInstant(item.receivedAt, `${label}.receivedAt`),
    lastSuccessAt: optionalInstant(item.lastSuccessAt, `${label}.lastSuccessAt`),
    errorCode: optionalString(item.errorCode, `${label}.errorCode`),
    version: number(item.version, `${label}.version`),
    evaluatedAt: instant(item.evaluatedAt, `${label}.evaluatedAt`),
  };
}

function dispatch(value: unknown, label: string): WorkplaceSafetyDispatchSummary {
  const item = safeObject(value, label);
  return {
    dispatchBatchId: uuid(item.dispatchBatchId, `${label}.dispatchBatchId`),
    state: enumeration(item.state, WORKPLACE_SAFETY_DISPATCH_STATES, `${label}.state`),
    attemptCount: number(item.attemptCount, `${label}.attemptCount`),
    deliveredCount: number(item.deliveredCount, `${label}.deliveredCount`),
    failedCount: number(item.failedCount, `${label}.failedCount`),
    unknownCount: number(item.unknownCount, `${label}.unknownCount`),
    channels: array(item.channels, `${label}.channels`, (entry, entryLabel) =>
      enumeration(entry, WORKPLACE_SAFETY_DELIVERY_CHANNELS, entryLabel)
    ),
    updatedAt: instant(item.updatedAt, `${label}.updatedAt`),
  };
}

export function parseWorkplaceSafetyIncident(value: unknown): WorkplaceSafetyIncident {
  const item = safeObject(value, 'incident');
  const responses = safeObject(item.responses, 'incident.responses');
  const assembly = safeObject(item.assembly, 'incident.assembly');
  return {
    incidentId: uuid(item.incidentId, 'incident.incidentId'),
    incidentNumber: string(item.incidentNumber, 'incident.incidentNumber'),
    incidentType: string(item.incidentType, 'incident.incidentType'),
    severity: enumeration(item.severity, WORKPLACE_SAFETY_SEVERITIES, 'incident.severity'),
    state: enumeration(item.state, WORKPLACE_SAFETY_INCIDENT_STATES, 'incident.state'),
    siteId: uuid(item.siteId, 'incident.siteId'),
    floorIds: uuids(item.floorIds, 'incident.floorIds'),
    zoneIds: uuids(item.zoneIds, 'incident.zoneIds'),
    message: string(item.message, 'incident.message'),
    safetyAction: string(item.safetyAction, 'incident.safetyAction'),
    assemblyPoint: optionalString(item.assemblyPoint, 'incident.assemblyPoint'),
    channels: array(item.channels, 'incident.channels', (entry, label) =>
      enumeration(entry, WORKPLACE_SAFETY_DELIVERY_CHANNELS, label)
    ),
    audience: parseWorkplaceSafetyAudienceSnapshot(item.audience),
    responses: {
      safe: number(responses.safe, 'incident.responses.safe'),
      needsHelp: number(responses.needsHelp, 'incident.responses.needsHelp'),
      noResponse: number(responses.noResponse, 'incident.responses.noResponse'),
    },
    assembly: {
      confirmed: number(assembly.confirmed, 'incident.assembly.confirmed'),
      pending: number(assembly.pending, 'incident.assembly.pending'),
    },
    dispatches: array(item.dispatches, 'incident.dispatches', dispatch),
    connectorTruth: array(
      item.connectorTruth,
      'incident.connectorTruth',
      parseWorkplaceSafetyConnectorTruth
    ),
    version: number(item.version, 'incident.version'),
    activatedAt: instant(item.activatedAt, 'incident.activatedAt'),
    closedAt: optionalInstant(item.closedAt, 'incident.closedAt'),
    updatedAt: instant(item.updatedAt, 'incident.updatedAt'),
  };
}

export function parseWorkplaceSafetySheet(value: unknown): WorkplaceSafetySheet {
  const item = safeObject(value, 'safetySheet');
  return {
    incidentId: uuid(item.incidentId, 'safetySheet.incidentId'),
    incidentNumber: string(item.incidentNumber, 'safetySheet.incidentNumber'),
    severity: enumeration(item.severity, WORKPLACE_SAFETY_SEVERITIES, 'safetySheet.severity'),
    message: string(item.message, 'safetySheet.message'),
    safetyAction: string(item.safetyAction, 'safetySheet.safetyAction'),
    assemblyPoint: optionalString(item.assemblyPoint, 'safetySheet.assemblyPoint'),
    scopeLabels: strings(item.scopeLabels, 'safetySheet.scopeLabels'),
    currentResponse:
      item.currentResponse === null || item.currentResponse === undefined
        ? null
        : enumeration(
            item.currentResponse,
            WORKPLACE_SAFETY_RESPONSE_STATES,
            'safetySheet.currentResponse'
          ),
    accessibleAlternativeContact: string(
      item.accessibleAlternativeContact,
      'safetySheet.accessibleAlternativeContact'
    ),
    version: number(item.version, 'safetySheet.version'),
    asOf: instant(item.asOf, 'safetySheet.asOf'),
  };
}

export function parseWorkplaceSafetyCommandReceipt(value: unknown): WorkplaceSafetyCommandReceipt {
  const item = safeObject(value, 'receipt');
  return {
    commandId: uuid(item.commandId, 'receipt.commandId'),
    state: enumeration(item.state, WORKPLACE_SAFETY_COMMAND_STATES, 'receipt.state'),
    statusHref: string(item.statusHref, 'receipt.statusHref'),
    idempotentReplay: boolean(item.idempotentReplay, 'receipt.idempotentReplay'),
    correlationId: string(item.correlationId, 'receipt.correlationId'),
    acceptedAt: instant(item.acceptedAt, 'receipt.acceptedAt'),
  };
}

export function parseWorkplaceSafetyIncidentMessage(
  value: unknown
): WorkplaceSafetyIncidentMessage {
  const item = safeObject(value, 'message');
  return {
    messageId: uuid(item.messageId, 'message.messageId'),
    incidentId: uuid(item.incidentId, 'message.incidentId'),
    targetUserId: nullableNumber(item.targetUserId, 'message.targetUserId'),
    direction: enumeration(
      item.direction,
      WORKPLACE_SAFETY_MESSAGE_DIRECTIONS,
      'message.direction'
    ),
    maskedBody: maskedString(item.maskedBody, 'message.maskedBody'),
    createdAt: instant(item.createdAt, 'message.createdAt'),
  };
}

export function parseWorkplaceSafetyActivationPreview(
  value: unknown
): WorkplaceSafetyActivationPreview {
  const item = safeObject(value, 'activationPreview');
  return {
    activationPreviewId: uuid(item.activationPreviewId, 'activationPreview.activationPreviewId'),
    incidentType: string(item.incidentType, 'activationPreview.incidentType'),
    severity: enumeration(item.severity, WORKPLACE_SAFETY_SEVERITIES, 'activationPreview.severity'),
    siteId: uuid(item.siteId, 'activationPreview.siteId'),
    floorIds: uuids(item.floorIds, 'activationPreview.floorIds'),
    zoneIds: uuids(item.zoneIds, 'activationPreview.zoneIds'),
    message: string(item.message, 'activationPreview.message'),
    safetyAction: string(item.safetyAction, 'activationPreview.safetyAction'),
    assemblyPoint: optionalString(item.assemblyPoint, 'activationPreview.assemblyPoint'),
    channels: array(item.channels, 'activationPreview.channels', (entry, label) =>
      enumeration(entry, WORKPLACE_SAFETY_DELIVERY_CHANNELS, label)
    ),
    audience: parseWorkplaceSafetyAudienceSnapshot(item.audience),
    connectorTruth: array(
      item.connectorTruth,
      'activationPreview.connectorTruth',
      parseWorkplaceSafetyConnectorTruth
    ),
    eligible: boolean(item.eligible, 'activationPreview.eligible'),
    limitations: strings(item.limitations, 'activationPreview.limitations'),
    expiresAt: instant(item.expiresAt, 'activationPreview.expiresAt'),
    createdAt: instant(item.createdAt, 'activationPreview.createdAt'),
  };
}

export function parseWorkplaceSafetyScopeRevisionPreview(
  value: unknown
): WorkplaceSafetyScopeRevisionPreview {
  const item = safeObject(value, 'scopeRevision');
  return {
    scopeRevisionId: uuid(item.scopeRevisionId, 'scopeRevision.scopeRevisionId'),
    incidentId: uuid(item.incidentId, 'scopeRevision.incidentId'),
    incidentVersion: number(item.incidentVersion, 'scopeRevision.incidentVersion'),
    previousFloorIds: uuids(item.previousFloorIds, 'scopeRevision.previousFloorIds'),
    previousZoneIds: uuids(item.previousZoneIds, 'scopeRevision.previousZoneIds'),
    proposedFloorIds: uuids(item.proposedFloorIds, 'scopeRevision.proposedFloorIds'),
    proposedZoneIds: uuids(item.proposedZoneIds, 'scopeRevision.proposedZoneIds'),
    proposedMessage: string(item.proposedMessage, 'scopeRevision.proposedMessage'),
    audience: parseWorkplaceSafetyAudienceSnapshot(item.audience),
    newlyIncluded: number(item.newlyIncluded, 'scopeRevision.newlyIncluded'),
    noLongerIncluded: number(item.noLongerIncluded, 'scopeRevision.noLongerIncluded'),
    expiresAt: instant(item.expiresAt, 'scopeRevision.expiresAt'),
    createdAt: instant(item.createdAt, 'scopeRevision.createdAt'),
  };
}

export function parseWorkplaceSafetyClosurePreview(value: unknown): WorkplaceSafetyClosurePreview {
  const item = safeObject(value, 'closurePreview');
  return {
    closurePreviewId: uuid(item.closurePreviewId, 'closurePreview.closurePreviewId'),
    incidentId: uuid(item.incidentId, 'closurePreview.incidentId'),
    incidentVersion: number(item.incidentVersion, 'closurePreview.incidentVersion'),
    needsHelpCount: number(item.needsHelpCount, 'closurePreview.needsHelpCount'),
    noResponseCount: number(item.noResponseCount, 'closurePreview.noResponseCount'),
    deliveredCount: number(item.deliveredCount, 'closurePreview.deliveredCount'),
    failedOrUnknownCount: number(item.failedOrUnknownCount, 'closurePreview.failedOrUnknownCount'),
    eligible: boolean(item.eligible, 'closurePreview.eligible'),
    warnings: strings(item.warnings, 'closurePreview.warnings'),
    expiresAt: instant(item.expiresAt, 'closurePreview.expiresAt'),
    createdAt: instant(item.createdAt, 'closurePreview.createdAt'),
  };
}

function closure(value: unknown): WorkplaceSafetyClosureRequest {
  const item = safeObject(value, 'closure');
  return {
    closureRequestId: uuid(item.closureRequestId, 'closure.closureRequestId'),
    incidentId: uuid(item.incidentId, 'closure.incidentId'),
    requestedBy: number(item.requestedBy, 'closure.requestedBy'),
    designatedApproverId: number(item.designatedApproverId, 'closure.designatedApproverId'),
    closureReason: string(item.closureReason, 'closure.closureReason'),
    followUpActions: string(item.followUpActions, 'closure.followUpActions'),
    state: string(item.state, 'closure.state'),
    version: number(item.version, 'closure.version'),
    requestedAt: instant(item.requestedAt, 'closure.requestedAt'),
  };
}

function guardedExport(value: unknown): WorkplaceSafetyGuardedExport {
  const item = safeObject(value, 'export');
  const sha256 = string(item.sha256, 'export.sha256');
  if (!SHA256_PATTERN.test(sha256)) throw new Error('export.sha256 must be a SHA-256 digest.');
  return {
    exportId: uuid(item.exportId, 'export.exportId'),
    incidentId: uuid(item.incidentId, 'export.incidentId'),
    format: enumeration(item.format, ['PDF', 'CSV'] as const, 'export.format'),
    purpose: string(item.purpose, 'export.purpose'),
    reason: string(item.reason, 'export.reason'),
    requestedBy: number(item.requestedBy, 'export.requestedBy'),
    correlationId: string(item.correlationId, 'export.correlationId'),
    stepUpEvidence: string(item.stepUpEvidence, 'export.stepUpEvidence'),
    contentType: string(item.contentType, 'export.contentType'),
    sha256,
    sizeBytes: number(item.sizeBytes, 'export.sizeBytes'),
    downloadHref: string(item.downloadHref, 'export.downloadHref'),
    createdAt: instant(item.createdAt, 'export.createdAt'),
    expiresAt: instant(item.expiresAt, 'export.expiresAt'),
  };
}

export function parseWorkplaceSafetyPostIncidentReport(
  value: unknown
): WorkplaceSafetyPostIncidentReport {
  const item = safeObject(value, 'report');
  return {
    reportId: uuid(item.reportId, 'report.reportId'),
    incidentId: uuid(item.incidentId, 'report.incidentId'),
    summary: safeObject(item.summary, 'report.summary'),
    version: number(item.version, 'report.version'),
    generatedAt: instant(item.generatedAt, 'report.generatedAt'),
  };
}

export const parseWorkplaceSafetyIncidents = (value: unknown) =>
  array(value, 'incidents', parseWorkplaceSafetyIncident);
export const parseWorkplaceSafetySheets = (value: unknown) =>
  array(value, 'safetySheets', (item) => parseWorkplaceSafetySheet(item));
export const parseWorkplaceSafetyMessages = (value: unknown) =>
  array(value, 'messages', (item) => parseWorkplaceSafetyIncidentMessage(item));
export const parseWorkplaceSafetyConnectors = (value: unknown) =>
  array(value, 'connectors', parseWorkplaceSafetyConnectorTruth);

export function parseWorkplaceSafetyIncidentCommandResult(
  value: unknown
): WorkplaceSafetyIncidentCommandResult {
  const item = safeObject(value, 'commandResult');
  return {
    incident: parseWorkplaceSafetyIncident(item.incident),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyActivationPreviewCommandResult(
  value: unknown
): WorkplaceSafetyActivationPreviewCommandResult {
  const item = safeObject(value, 'activationPreviewResult');
  return {
    preview: parseWorkplaceSafetyActivationPreview(item.preview),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyScopePreviewCommandResult(
  value: unknown
): WorkplaceSafetyScopePreviewCommandResult {
  const item = safeObject(value, 'scopePreviewResult');
  return {
    preview: parseWorkplaceSafetyScopeRevisionPreview(item.preview),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyClosurePreviewCommandResult(
  value: unknown
): WorkplaceSafetyClosurePreviewCommandResult {
  const item = safeObject(value, 'closurePreviewResult');
  return {
    preview: parseWorkplaceSafetyClosurePreview(item.preview),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyResponseCommandResult(
  value: unknown
): WorkplaceSafetyResponseCommandResult {
  const item = safeObject(value, 'responseResult');
  return {
    sheet: parseWorkplaceSafetySheet(item.sheet),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyMessageCommandResult(
  value: unknown
): WorkplaceSafetyMessageCommandResult {
  const item = safeObject(value, 'messageResult');
  return {
    message: parseWorkplaceSafetyIncidentMessage(item.message),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyClosureCommandResult(
  value: unknown
): WorkplaceSafetyClosureCommandResult {
  const item = safeObject(value, 'closureResult');
  return {
    closure: closure(item.closure),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyExportCommandResult(
  value: unknown
): WorkplaceSafetyExportCommandResult {
  const item = safeObject(value, 'exportResult');
  return {
    export: guardedExport(item.export),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

function assemblyConfirmation(value: unknown): WorkplaceSafetyAssemblyConfirmation {
  const item = safeObject(value, 'assemblyConfirmation');
  const subjectKeySha256 = string(item.subjectKeySha256, 'assemblyConfirmation.subjectKeySha256');
  if (!SHA256_PATTERN.test(subjectKeySha256)) {
    throw new Error('assemblyConfirmation.subjectKeySha256 must be a SHA-256 digest.');
  }
  return {
    assemblyConfirmationId: uuid(
      item.assemblyConfirmationId,
      'assemblyConfirmation.assemblyConfirmationId'
    ),
    incidentId: uuid(item.incidentId, 'assemblyConfirmation.incidentId'),
    subjectKeySha256,
    subjectUserId: nullableNumber(item.subjectUserId, 'assemblyConfirmation.subjectUserId'),
    confirmed: boolean(item.confirmed, 'assemblyConfirmation.confirmed'),
    observedAt: instant(item.observedAt, 'assemblyConfirmation.observedAt'),
    confirmedBy: number(item.confirmedBy, 'assemblyConfirmation.confirmedBy'),
    evidenceReference: string(item.evidenceReference, 'assemblyConfirmation.evidenceReference'),
    version: number(item.version, 'assemblyConfirmation.version'),
    updatedAt: instant(item.updatedAt, 'assemblyConfirmation.updatedAt'),
  };
}

export function parseWorkplaceSafetyAssemblyCommandResult(
  value: unknown
): WorkplaceSafetyAssemblyCommandResult {
  const item = safeObject(value, 'assemblyResult');
  return {
    confirmation: assemblyConfirmation(item.confirmation),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function parseWorkplaceSafetyConnectorCommandResult(
  value: unknown
): WorkplaceSafetyConnectorCommandResult {
  const item = safeObject(value, 'connectorResult');
  return {
    connector: parseWorkplaceSafetyConnectorTruth(item.connector),
    receipt: parseWorkplaceSafetyCommandReceipt(item.receipt),
  };
}

export function assertWorkplaceSafetyResendInputStates(value: readonly string[]): void {
  value.forEach((state, index) =>
    enumeration(state, WORKPLACE_SAFETY_ATTEMPT_STATES, `retryStates[${index}]`)
  );
}
