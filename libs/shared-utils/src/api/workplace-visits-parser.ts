import {
  WORKPLACE_KIOSK_STATES,
  WORKPLACE_VISIT_EXCEPTION_KINDS,
  WORKPLACE_VISIT_PROVIDER_STATES,
  WORKPLACE_VISIT_STATES,
} from './workplace-visits-contract';

import type {
  WorkplaceAdminVisit,
  WorkplaceKioskDevice,
  WorkplaceKioskSession,
  WorkplaceKioskVisit,
  WorkplaceKioskVisitCommandResult,
  WorkplaceRequesterVisit,
  WorkplaceVisitAccessZone,
  WorkplaceVisitCommandReceipt,
  WorkplaceVisitCommandResult,
  WorkplaceVisitException,
  WorkplaceVisitGuestRef,
  WorkplaceVisitManagementResult,
  WorkplaceVisitPage,
  WorkplaceVisitPolicy,
  WorkplaceVisitPolicyImpact,
  WorkplaceVisitPreview,
  WorkplaceVisitProviderBinding,
  WorkplaceVisitProviderTruth,
  WorkplaceVisitReservationReference,
  WorkplaceVisitTimelineItem,
} from './workplace-visits-contract';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FORBIDDEN_PROJECTION_KEY =
  /^(?:email|phone|fullName|rawName|credential|credentialValue|secret|token|qrCode|nfcValue|badgeCode|passport|idNumber)$/iu;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertProjectionSafe(value: unknown, path = 'visit'): void {
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

function safeObject(value: unknown, label: string): Record<string, unknown> {
  assertProjectionSafe(value, label);
  return object(value, label);
}

function rejectKeys(item: Record<string, unknown>, keys: readonly string[], label: string) {
  const leaked = keys.find((key) => key in item);
  if (leaked) throw new Error(`${label} contains a forbidden field: ${leaked}.`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a string.`);
  return value;
}

function optionalString(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : string(value, label);
}

function uuid(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!UUID_PATTERN.test(parsed)) throw new Error(`${label} must be a UUID.`);
  return parsed;
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function instant(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw new Error(`${label} must be an instant.`);
  return parsed;
}

function optionalInstant(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : instant(value, label);
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function uuids(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => uuid(item, `${label}[${index}]`));
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} has an unsupported value.`);
  }
  return value as T;
}

function reservation(value: unknown): WorkplaceVisitReservationReference {
  const item = safeObject(value, 'reservation');
  return {
    authority: enumeration(item.authority, ['WORKPLACE', 'CALENDAR'] as const, 'authority'),
    id: uuid(item.id, 'reservation.id'),
    version: number(item.version, 'reservation.version'),
  };
}

function guest(value: unknown): WorkplaceVisitGuestRef {
  const item = safeObject(value, 'guest');
  const retention = safeObject(item.fieldRetentionExpiresAt, 'fieldRetentionExpiresAt');
  return {
    opaqueRef: string(item.opaqueRef, 'guest.opaqueRef'),
    maskedLabel: string(item.maskedLabel, 'guest.maskedLabel'),
    purpose: string(item.purpose, 'guest.purpose'),
    fieldRetentionExpiresAt: Object.fromEntries(
      Object.entries(retention).map(([key, expiresAt]) => [
        key,
        instant(expiresAt, `fieldRetentionExpiresAt.${key}`),
      ])
    ),
  };
}

function providerTruth(value: unknown): WorkplaceVisitProviderTruth {
  const item = safeObject(value, 'providerTruth');
  return {
    kind: enumeration(item.kind, ['VISITOR', 'ACCESS'] as const, 'providerTruth.kind'),
    state: enumeration(item.state, WORKPLACE_VISIT_PROVIDER_STATES, 'providerTruth.state'),
    configurationVersion: number(item.configurationVersion, 'providerTruth.configurationVersion'),
    observedConfigurationVersion:
      item.observedConfigurationVersion === null || item.observedConfigurationVersion === undefined
        ? null
        : number(item.observedConfigurationVersion, 'providerTruth.observedConfigurationVersion'),
    evidenceReference: optionalString(item.evidenceReference, 'providerTruth.evidenceReference'),
    lastSuccessAt: optionalInstant(item.lastSuccessAt, 'providerTruth.lastSuccessAt'),
    sourceAt: optionalInstant(item.sourceAt, 'providerTruth.sourceAt'),
    receivedAt: optionalInstant(item.receivedAt, 'providerTruth.receivedAt'),
    limitationCode: optionalString(item.limitationCode, 'providerTruth.limitationCode'),
    manualOwner: optionalString(item.manualOwner, 'providerTruth.manualOwner'),
    manualProcedure: optionalString(item.manualProcedure, 'providerTruth.manualProcedure'),
  };
}

function timeline(value: unknown): readonly WorkplaceVisitTimelineItem[] {
  if (!Array.isArray(value)) throw new Error('timeline must be an array.');
  return value.map((entry) => {
    const item = safeObject(entry, 'timelineItem');
    return {
      eventId: uuid(item.eventId, 'timelineItem.eventId'),
      eventType: string(item.eventType, 'timelineItem.eventType'),
      state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'timelineItem.state'),
      detailCode: optionalString(item.detailCode, 'timelineItem.detailCode'),
      occurredAt: instant(item.occurredAt, 'timelineItem.occurredAt'),
    };
  });
}

function requesterVisit(value: unknown): WorkplaceRequesterVisit {
  const item = safeObject(value, 'requesterVisit');
  rejectKeys(
    item,
    ['requesterUserId', 'providerOperationEvidenceReference', 'limitationCode'],
    'requesterVisit'
  );
  if (!Array.isArray(item.guests)) throw new Error('requesterVisit.guests must be an array.');
  return {
    visitId: uuid(item.visitId, 'requesterVisit.visitId'),
    reservation: reservation(item.reservation),
    visitType: string(item.visitType, 'requesterVisit.visitType'),
    siteId: uuid(item.siteId, 'requesterVisit.siteId'),
    startsAt: instant(item.startsAt, 'requesterVisit.startsAt'),
    endsAt: instant(item.endsAt, 'requesterVisit.endsAt'),
    zoneIds: uuids(item.zoneIds, 'requesterVisit.zoneIds'),
    guests: item.guests.map(guest),
    state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'requesterVisit.state'),
    version: number(item.version, 'requesterVisit.version'),
    recoveryByGetOnly: boolean(item.recoveryByGetOnly, 'requesterVisit.recoveryByGetOnly'),
    recoveryHref: optionalString(item.recoveryHref, 'requesterVisit.recoveryHref'),
    timeline: timeline(item.timeline),
    updatedAt: instant(item.updatedAt, 'requesterVisit.updatedAt'),
  };
}

function adminVisit(value: unknown): WorkplaceAdminVisit {
  const item = safeObject(value, 'adminVisit');
  if (!Array.isArray(item.guests)) throw new Error('adminVisit.guests must be an array.');
  return {
    visitId: uuid(item.visitId, 'adminVisit.visitId'),
    requesterUserId: number(item.requesterUserId, 'adminVisit.requesterUserId'),
    reservation: reservation(item.reservation),
    visitType: string(item.visitType, 'adminVisit.visitType'),
    siteId: uuid(item.siteId, 'adminVisit.siteId'),
    startsAt: instant(item.startsAt, 'adminVisit.startsAt'),
    endsAt: instant(item.endsAt, 'adminVisit.endsAt'),
    zoneIds: uuids(item.zoneIds, 'adminVisit.zoneIds'),
    guests: item.guests.map(guest),
    state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'adminVisit.state'),
    version: number(item.version, 'adminVisit.version'),
    providerOperationEvidenceReference: optionalString(
      item.providerOperationEvidenceReference,
      'adminVisit.providerOperationEvidenceReference'
    ),
    limitationCode: optionalString(item.limitationCode, 'adminVisit.limitationCode'),
    timeline: timeline(item.timeline),
    updatedAt: instant(item.updatedAt, 'adminVisit.updatedAt'),
  };
}

function receipt(value: unknown): WorkplaceVisitCommandReceipt {
  const item = safeObject(value, 'receipt');
  return {
    commandId: uuid(item.commandId, 'receipt.commandId'),
    visitId: uuid(item.visitId, 'receipt.visitId'),
    state: enumeration(
      item.state,
      ['SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'receipt.state'
    ),
    statusHref: string(item.statusHref, 'receipt.statusHref'),
    replayed: boolean(item.replayed, 'receipt.replayed'),
    correlationId: string(item.correlationId, 'receipt.correlationId'),
    acceptedAt: instant(item.acceptedAt, 'receipt.acceptedAt'),
  };
}

function page<T>(value: unknown, parseItem: (item: unknown) => T): WorkplaceVisitPage<T> {
  const parsed = safeObject(value, 'page');
  if (!Array.isArray(parsed.items)) throw new Error('page.items must be an array.');
  return {
    items: parsed.items.map(parseItem),
    generatedAt: instant(parsed.generatedAt, 'page.generatedAt'),
  };
}

function list<T>(value: unknown, parseItem: (item: unknown) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map(parseItem);
}

export function parseWorkplaceVisitPreview(value: unknown): WorkplaceVisitPreview {
  const item = safeObject(value, 'visitPreview');
  return {
    previewId: uuid(item.previewId, 'visitPreview.previewId'),
    version: number(item.version, 'visitPreview.version'),
    reservation: reservation(item.reservation),
    visitType: string(item.visitType, 'visitPreview.visitType'),
    siteId: uuid(item.siteId, 'visitPreview.siteId'),
    startsAt: instant(item.startsAt, 'visitPreview.startsAt'),
    endsAt: instant(item.endsAt, 'visitPreview.endsAt'),
    zoneIds: uuids(item.zoneIds, 'visitPreview.zoneIds'),
    guestCount: number(item.guestCount, 'visitPreview.guestCount'),
    approvalRequired: boolean(item.approvalRequired, 'visitPreview.approvalRequired'),
    ndaRequired: boolean(item.ndaRequired, 'visitPreview.ndaRequired'),
    identityVerificationRequired: boolean(
      item.identityVerificationRequired,
      'visitPreview.identityVerificationRequired'
    ),
    minimumCollectionFields: strings(
      item.minimumCollectionFields,
      'visitPreview.minimumCollectionFields'
    ),
    visitorProvider: providerTruth(item.visitorProvider),
    accessProvider: providerTruth(item.accessProvider),
    eligible: boolean(item.eligible, 'visitPreview.eligible'),
    limitations: strings(item.limitations, 'visitPreview.limitations'),
    expiresAt: instant(item.expiresAt, 'visitPreview.expiresAt'),
    generatedAt: instant(item.generatedAt, 'visitPreview.generatedAt'),
  };
}

export function parseWorkplaceRequesterVisit(value: unknown): WorkplaceRequesterVisit {
  return requesterVisit(value);
}

export function parseWorkplaceRequesterVisitPage(
  value: unknown
): WorkplaceVisitPage<WorkplaceRequesterVisit> {
  return page(value, requesterVisit);
}

export function parseWorkplaceAdminVisit(value: unknown): WorkplaceAdminVisit {
  return adminVisit(value);
}

export function parseWorkplaceVisitCommandResult(
  value: unknown
): WorkplaceVisitCommandResult<WorkplaceRequesterVisit> {
  const item = safeObject(value, 'visitCommandResult');
  return { visit: requesterVisit(item.visit), receipt: receipt(item.receipt) };
}

export function parseWorkplaceAdminVisitCommandResult(
  value: unknown
): WorkplaceVisitCommandResult<WorkplaceAdminVisit> {
  const item = safeObject(value, 'adminVisitCommandResult');
  return { visit: adminVisit(item.visit), receipt: receipt(item.receipt) };
}

export function parseWorkplaceVisitExceptionPage(
  value: unknown
): WorkplaceVisitPage<WorkplaceVisitException> {
  return page(value, (entry) => {
    const item = safeObject(entry, 'visitException');
    return {
      visitId: uuid(item.visitId, 'visitException.visitId'),
      kind: enumeration(item.kind, WORKPLACE_VISIT_EXCEPTION_KINDS, 'visitException.kind'),
      state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'visitException.state'),
      maskedGuestLabel: string(item.maskedGuestLabel, 'visitException.maskedGuestLabel'),
      siteId: uuid(item.siteId, 'visitException.siteId'),
      startsAt: instant(item.startsAt, 'visitException.startsAt'),
      version: number(item.version, 'visitException.version'),
      limitationCode: optionalString(item.limitationCode, 'visitException.limitationCode'),
      updatedAt: instant(item.updatedAt, 'visitException.updatedAt'),
    };
  });
}

function visitPolicy(value: unknown): WorkplaceVisitPolicy {
  const item = safeObject(value, 'visitPolicy');
  return {
    policyId: uuid(item.policyId, 'visitPolicy.policyId'),
    visitType: string(item.visitType, 'visitPolicy.visitType'),
    approvalRequired: boolean(item.approvalRequired, 'visitPolicy.approvalRequired'),
    ndaRequired: boolean(item.ndaRequired, 'visitPolicy.ndaRequired'),
    identityVerificationRequired: boolean(
      item.identityVerificationRequired,
      'visitPolicy.identityVerificationRequired'
    ),
    allowedFrom: string(item.allowedFrom, 'visitPolicy.allowedFrom'),
    allowedUntil: string(item.allowedUntil, 'visitPolicy.allowedUntil'),
    minimumCollectionFields: strings(
      item.minimumCollectionFields,
      'visitPolicy.minimumCollectionFields'
    ),
    retentionDays: number(item.retentionDays, 'visitPolicy.retentionDays'),
    active: boolean(item.active, 'visitPolicy.active'),
    version: number(item.version, 'visitPolicy.version'),
    updatedAt: instant(item.updatedAt, 'visitPolicy.updatedAt'),
  };
}

export function parseWorkplaceVisitPolicies(value: unknown): readonly WorkplaceVisitPolicy[] {
  return list(value, visitPolicy, 'visitPolicies');
}

export function parseWorkplaceVisitPolicyImpact(value: unknown): WorkplaceVisitPolicyImpact {
  const item = safeObject(value, 'visitPolicyImpact');
  return {
    policyId: uuid(item.policyId, 'visitPolicyImpact.policyId'),
    currentVersion: number(item.currentVersion, 'visitPolicyImpact.currentVersion'),
    affectedFutureVisits: number(
      item.affectedFutureVisits,
      'visitPolicyImpact.affectedFutureVisits'
    ),
    warnings: strings(item.warnings, 'visitPolicyImpact.warnings'),
    generatedAt: instant(item.generatedAt, 'visitPolicyImpact.generatedAt'),
  };
}

function accessZone(value: unknown): WorkplaceVisitAccessZone {
  const item = safeObject(value, 'accessZone');
  return {
    zoneId: uuid(item.zoneId, 'accessZone.zoneId'),
    siteId: uuid(item.siteId, 'accessZone.siteId'),
    zoneCode: string(item.zoneCode, 'accessZone.zoneCode'),
    name: string(item.name, 'accessZone.name'),
    accessLevel: string(item.accessLevel, 'accessZone.accessLevel'),
    providerMappingReference: string(
      item.providerMappingReference,
      'accessZone.providerMappingReference'
    ),
    allowedVisitTypes: strings(item.allowedVisitTypes, 'accessZone.allowedVisitTypes'),
    active: boolean(item.active, 'accessZone.active'),
    version: number(item.version, 'accessZone.version'),
    updatedAt: instant(item.updatedAt, 'accessZone.updatedAt'),
  };
}

export function parseWorkplaceVisitAccessZones(
  value: unknown
): readonly WorkplaceVisitAccessZone[] {
  return list(value, accessZone, 'accessZones');
}

function providerBinding(value: unknown): WorkplaceVisitProviderBinding {
  const item = safeObject(value, 'providerBinding');
  return {
    bindingId: uuid(item.bindingId, 'providerBinding.bindingId'),
    kind: enumeration(item.kind, ['VISITOR', 'ACCESS'] as const, 'providerBinding.kind'),
    providerCode: string(item.providerCode, 'providerBinding.providerCode'),
    configurationVersion: number(item.configurationVersion, 'providerBinding.configurationVersion'),
    observedConfigurationVersion:
      item.observedConfigurationVersion === null || item.observedConfigurationVersion === undefined
        ? null
        : number(item.observedConfigurationVersion, 'providerBinding.observedConfigurationVersion'),
    state: enumeration(item.state, WORKPLACE_VISIT_PROVIDER_STATES, 'providerBinding.state'),
    evidenceReference: optionalString(item.evidenceReference, 'providerBinding.evidenceReference'),
    lastSuccessAt: optionalInstant(item.lastSuccessAt, 'providerBinding.lastSuccessAt'),
    sourceAt: optionalInstant(item.sourceAt, 'providerBinding.sourceAt'),
    receivedAt: optionalInstant(item.receivedAt, 'providerBinding.receivedAt'),
    manualOwner: string(item.manualOwner, 'providerBinding.manualOwner'),
    manualProcedure: string(item.manualProcedure, 'providerBinding.manualProcedure'),
    active: boolean(item.active, 'providerBinding.active'),
    version: number(item.version, 'providerBinding.version'),
    updatedAt: instant(item.updatedAt, 'providerBinding.updatedAt'),
  };
}

export function parseWorkplaceVisitProviderBindings(
  value: unknown
): readonly WorkplaceVisitProviderBinding[] {
  return list(value, providerBinding, 'providerBindings');
}

function kioskDevice(value: unknown): WorkplaceKioskDevice {
  const item = safeObject(value, 'kioskDevice');
  rejectKeys(item, ['deviceIdentitySha256', 'credential', 'secret'], 'kioskDevice');
  return {
    deviceId: uuid(item.deviceId, 'kioskDevice.deviceId'),
    siteId: uuid(item.siteId, 'kioskDevice.siteId'),
    policyId:
      item.policyId === null || item.policyId === undefined
        ? null
        : uuid(item.policyId, 'kioskDevice.policyId'),
    privacyNoticeVersion: string(item.privacyNoticeVersion, 'kioskDevice.privacyNoticeVersion'),
    privacyNoticeAccepted: boolean(item.privacyNoticeAccepted, 'kioskDevice.privacyNoticeAccepted'),
    lastHeartbeatAt: optionalInstant(item.lastHeartbeatAt, 'kioskDevice.lastHeartbeatAt'),
    helpRequested: boolean(item.helpRequested, 'kioskDevice.helpRequested'),
    state: enumeration(item.state, WORKPLACE_KIOSK_STATES, 'kioskDevice.state'),
    active: boolean(item.active, 'kioskDevice.active'),
    version: number(item.version, 'kioskDevice.version'),
    updatedAt: instant(item.updatedAt, 'kioskDevice.updatedAt'),
  };
}

export function parseWorkplaceKioskDevice(value: unknown): WorkplaceKioskDevice {
  return kioskDevice(value);
}

export function parseWorkplaceKioskDevices(value: unknown): readonly WorkplaceKioskDevice[] {
  return list(value, kioskDevice, 'kioskDevices');
}

export function parseWorkplaceKioskSession(value: unknown): WorkplaceKioskSession {
  const item = safeObject(value, 'kioskSession');
  rejectKeys(item, ['deviceIdentitySha256', 'credential', 'secret'], 'kioskSession');
  const state = enumeration(item.state, WORKPLACE_KIOSK_STATES, 'kioskSession.state');
  const nullableUuid = (entry: unknown, label: string) =>
    entry === null || entry === undefined ? null : uuid(entry, label);
  const nullableValue = (entry: unknown, label: string) =>
    entry === null || entry === undefined ? null : string(entry, label);
  const session = {
    deviceId: nullableUuid(item.deviceId, 'kioskSession.deviceId'),
    siteId: nullableUuid(item.siteId, 'kioskSession.siteId'),
    state,
    privacyNoticeVersion: nullableValue(
      item.privacyNoticeVersion,
      'kioskSession.privacyNoticeVersion'
    ),
    privacyNoticeAccepted: boolean(
      item.privacyNoticeAccepted,
      'kioskSession.privacyNoticeAccepted'
    ),
    helpRequested: boolean(item.helpRequested, 'kioskSession.helpRequested'),
    lastHeartbeatAt: optionalInstant(item.lastHeartbeatAt, 'kioskSession.lastHeartbeatAt'),
    active: boolean(item.active, 'kioskSession.active'),
    version: number(item.version, 'kioskSession.version'),
    updatedAt: instant(item.updatedAt, 'kioskSession.updatedAt'),
  };
  if (state !== 'UNREGISTERED' && (!session.deviceId || !session.siteId)) {
    throw new Error('Registered kiosk session identifiers are required.');
  }
  return session;
}

export function parseWorkplaceKioskVisit(value: unknown): WorkplaceKioskVisit {
  const item = safeObject(value, 'kioskVisit');
  rejectKeys(
    item,
    ['opaqueRef', 'guests', 'reservation', 'zoneIds', 'timeline', 'requesterUserId'],
    'kioskVisit'
  );
  return {
    visitId: uuid(item.visitId, 'kioskVisit.visitId'),
    maskedLabel: string(item.maskedLabel, 'kioskVisit.maskedLabel'),
    purpose: string(item.purpose, 'kioskVisit.purpose'),
    siteId: uuid(item.siteId, 'kioskVisit.siteId'),
    startsAt: instant(item.startsAt, 'kioskVisit.startsAt'),
    endsAt: instant(item.endsAt, 'kioskVisit.endsAt'),
    state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'kioskVisit.state'),
    version: number(item.version, 'kioskVisit.version'),
  };
}

export function parseWorkplaceKioskVisitCommandResult(
  value: unknown
): WorkplaceKioskVisitCommandResult {
  const result = safeObject(value, 'kioskVisitCommandResult');
  const item = safeObject(result.visit, 'kioskCommandVisit');
  if (!Array.isArray(item.guests)) throw new Error('kioskCommandVisit.guests must be an array.');
  item.guests.forEach((entry) => {
    const projected = safeObject(entry, 'kioskCommandVisit.guest');
    if (projected.opaqueRef !== null && projected.opaqueRef !== undefined) {
      throw new Error('Kiosk command guest opaqueRef must be redacted.');
    }
  });
  return {
    visit: {
      visitId: uuid(item.visitId, 'kioskCommandVisit.visitId'),
      state: enumeration(item.state, WORKPLACE_VISIT_STATES, 'kioskCommandVisit.state'),
      version: number(item.version, 'kioskCommandVisit.version'),
      recoveryByGetOnly: boolean(item.recoveryByGetOnly, 'kioskCommandVisit.recoveryByGetOnly'),
      recoveryHref: optionalString(item.recoveryHref, 'kioskCommandVisit.recoveryHref'),
      updatedAt: instant(item.updatedAt, 'kioskCommandVisit.updatedAt'),
    },
    receipt: receipt(result.receipt),
  };
}

export function parseWorkplaceVisitManagementResult<T>(
  value: unknown,
  parseItem: (item: unknown) => T
): WorkplaceVisitManagementResult<T> {
  const result = safeObject(value, 'managementResult');
  const item = safeObject(result.receipt, 'managementReceipt');
  return {
    item: parseItem(result.item),
    receipt: {
      commandId: uuid(item.commandId, 'managementReceipt.commandId'),
      resourceType: string(item.resourceType, 'managementReceipt.resourceType'),
      resourceId: uuid(item.resourceId, 'managementReceipt.resourceId'),
      resourceVersion: number(item.resourceVersion, 'managementReceipt.resourceVersion'),
      replayed: boolean(item.replayed, 'managementReceipt.replayed'),
      correlationId: string(item.correlationId, 'managementReceipt.correlationId'),
      acceptedAt: instant(item.acceptedAt, 'managementReceipt.acceptedAt'),
    },
  };
}

export const workplaceVisitManagementParsers = {
  policy: visitPolicy,
  zone: accessZone,
  provider: providerBinding,
  kiosk: kioskDevice,
} as const;
