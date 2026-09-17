export const WORKPLACE_SERVICE_PROVIDER_LIFECYCLE_STATES = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
] as const;
export const WORKPLACE_SERVICE_PROVIDER_READINESS_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'READY',
  'DEGRADED',
  'STALE',
] as const;
export const WORKPLACE_SERVICE_CAPACITY_MODES = ['UNBOUNDED', 'BUCKETED'] as const;
export const WORKPLACE_SERVICE_INSPECTION_MODES = ['NONE', 'OPERATOR', 'REQUESTER'] as const;
export const WORKPLACE_SERVICE_INSPECTION_DECISIONS = ['PASSED', 'FAILED'] as const;
export const WORKPLACE_SERVICE_ACCESS_GRANT_STATES = [
  'ISSUED',
  'REVOKED',
  'EXPIRED',
  'RESULT_UNKNOWN',
] as const;

export type WorkplaceServiceProviderLifecycleState =
  (typeof WORKPLACE_SERVICE_PROVIDER_LIFECYCLE_STATES)[number];
export type WorkplaceServiceProviderReadiness =
  (typeof WORKPLACE_SERVICE_PROVIDER_READINESS_STATES)[number];
export type WorkplaceServiceInspectionDecision =
  (typeof WORKPLACE_SERVICE_INSPECTION_DECISIONS)[number];
export type WorkplaceServiceAccessGrantState =
  (typeof WORKPLACE_SERVICE_ACCESS_GRANT_STATES)[number];

export type WorkplaceServiceOperationsCommandReceipt = Readonly<{
  commandId: string;
  state: 'ACCEPTED' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
  statusHref: string;
  replayed: boolean;
  correlationId: string | null;
  acceptedAt: string;
}>;

export type WorkplaceServiceProviderSupport = Readonly<
  Record<string, unknown> & {
    labelKo?: string;
    labelEn?: string;
    channel?: 'EMAIL' | 'PHONE' | 'WEB' | 'IN_APP';
    contactUri?: string | null;
    hoursKo?: string | null;
    hoursEn?: string | null;
  }
>;

export type WorkplaceServiceProvider = Readonly<{
  providerProfileId: string;
  providerCode: string;
  displayNameKo: string;
  displayNameEn: string;
  adapterType: string;
  lifecycleState: WorkplaceServiceProviderLifecycleState;
  siteScope: readonly string[];
  capabilities: readonly string[];
  support: WorkplaceServiceProviderSupport;
  credentialBindingConfigured: boolean;
  configurationVersion: number;
  readiness: WorkplaceServiceProviderReadiness;
  evidenceConfigurationVersion: number | null;
  evidenceReference: string | null;
  evidenceObservedAt: string | null;
  evidenceReceivedAt: string | null;
  evidenceErrorCode: string | null;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceServiceProviders = Readonly<{
  items: readonly WorkplaceServiceProvider[];
  generatedAt: string;
}>;

export type WorkplaceServiceProviderCommandResult = Readonly<{
  provider: WorkplaceServiceProvider;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceAssignee = Readonly<{
  directorySubjectId: string;
  displayName: string;
  contactAvailable: boolean;
  capabilities: readonly string[];
  directoryVersion: string;
  verifiedAt: string;
  freshUntil: string;
}>;

export type WorkplaceServiceAssignees = Readonly<{
  items: readonly WorkplaceServiceAssignee[];
  generatedAt: string;
}>;

export type WorkplaceServiceAssignmentResult = Readonly<{
  serviceOrderId: string;
  fulfillmentTaskId: string;
  assignee: WorkplaceServiceAssignee;
  taskVersion: number;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceCapacityBucket = Readonly<{
  capacityBucketId: string;
  catalogItemId: string;
  siteReference: string;
  startsAt: string;
  endsAt: string;
  capacityLimit: number;
  committedQuantity: number;
  heldQuantity: number;
  availableQuantity: number;
  sourceVersion: string;
  sourceObservedAt: string;
  receivedAt: string;
  freshUntil: string;
  fresh: boolean;
  version: number;
}>;

export type WorkplaceServiceCapacityRange = Readonly<{
  catalogItemId: string;
  siteReference: string;
  from: string;
  to: string;
  mode: WorkplaceServiceCapacityMode;
  buckets: readonly WorkplaceServiceCapacityBucket[];
  complete: boolean;
  limitations: readonly (
    'CAPACITY_BUCKET_MISSING' | 'CAPACITY_BUCKET_GAP' | 'CAPACITY_STALE' | 'CAPACITY_EXHAUSTED'
  )[];
  generatedAt: string;
}>;

export type WorkplaceServiceCapacityUpsertResult = Readonly<{
  capacity: WorkplaceServiceCapacityRange;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceInspectionAttempt = Readonly<{
  inspectionAttemptId: string;
  serviceOrderId: string;
  serviceOrderLineId: string;
  fulfillmentTaskId: string;
  mode: WorkplaceServiceInspectionMode;
  actorRole: 'OPERATOR' | 'REQUESTER';
  decision: WorkplaceServiceInspectionDecision;
  checklistSchema: readonly Readonly<Record<string, unknown>>[];
  checklistResponses: Readonly<Record<string, unknown>>;
  evidenceAttachmentIds: readonly string[];
  reason: string;
  remediationRequired: boolean;
  createdAt: string;
}>;

export type WorkplaceServiceInspection = Readonly<{
  serviceOrderId: string;
  serviceOrderLineId: string;
  mode: WorkplaceServiceInspectionMode;
  required: boolean;
  fulfilledQuantityReady: boolean;
  accepted: boolean;
  remediationRequired: boolean;
  latestAttempt: WorkplaceServiceInspectionAttempt | null;
  generatedAt: string;
}>;

export type WorkplaceServiceInspectionCommandResult = Readonly<{
  inspection: WorkplaceServiceInspection;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceAccessCredentialGrant = Readonly<{
  grantId: string;
  oneTimeCredential: string | null;
  expiresAt: string;
  revealOnce: true;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceAccessCredentialStatus = Readonly<{
  grantId: string;
  state: WorkplaceServiceAccessGrantState;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

export type WorkplaceServiceContactResult = Readonly<{
  contactRequestId: string;
  target: 'ASSIGNEE' | 'SERVICE_DESK';
  resolvedTargetDisplayName: string;
  state: 'QUEUED';
  receipt: WorkplaceServiceOperationsCommandReceipt;
}>;

type JsonRecord = Record<string, unknown>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function invalid(path: string): never {
  throw new Error(`Invalid Workplace Services operations response at ${path}.`);
}

function record(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  return value as JsonRecord;
}

function object(value: unknown, path: string): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...record(value, path) });
}

function text(value: unknown, path: string, maximum = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) return invalid(path);
  return value;
}

function nullableText(value: unknown, path: string, maximum = 2000): string | null {
  return value === null ? null : text(value, path, maximum);
}

function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return uuidPattern.test(result) ? result : invalid(path);
}

function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) return invalid(path);
  return value as number;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return invalid(path);
  return value;
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 80);
  if (!Number.isFinite(Date.parse(result))) return invalid(path);
  return result;
}

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

function enumeration<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid(path);
  return value as T;
}

function list<T>(
  value: unknown,
  path: string,
  parser: (item: unknown, itemPath: string) => T,
  maximum = 1000
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid(path);
  return Object.freeze(value.map((item, index) => parser(item, `${path}[${index}]`)));
}

function stringList(value: unknown, path: string, maximum = 100): readonly string[] {
  return list(value, path, (item, itemPath) => text(item, itemPath, 320), maximum);
}

function capabilityList(value: unknown, path: string): readonly string[] {
  const capabilities = list(value, path, (item, itemPath) => text(item, itemPath, 80), 100);
  if (
    new Set(capabilities).size !== capabilities.length ||
    capabilities.some((capability) => !/^[A-Z][A-Z0-9_]{1,79}$/u.test(capability))
  ) {
    return invalid(path);
  }
  return capabilities;
}

function uuidList(value: unknown, path: string, maximum = 100): readonly string[] {
  return list(value, path, uuid, maximum);
}

function parseReceipt(value: unknown, path: string): WorkplaceServiceOperationsCommandReceipt {
  const source = record(value, path);
  return Object.freeze({
    commandId: uuid(source.commandId, `${path}.commandId`),
    state: enumeration(
      source.state,
      ['ACCEPTED', 'SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      `${path}.state`
    ),
    statusHref: text(source.statusHref, `${path}.statusHref`, 500),
    replayed: bool(source.replayed, `${path}.replayed`),
    correlationId: nullableText(source.correlationId, `${path}.correlationId`, 160),
    acceptedAt: instant(source.acceptedAt, `${path}.acceptedAt`),
  });
}

export function parseWorkplaceServiceProvider(
  value: unknown,
  path = '$'
): WorkplaceServiceProvider {
  const source = record(value, path);
  const support = object(source.support, `${path}.support`) as WorkplaceServiceProviderSupport;
  return Object.freeze({
    providerProfileId: uuid(source.providerProfileId, `${path}.providerProfileId`),
    providerCode: text(source.providerCode, `${path}.providerCode`, 80),
    displayNameKo: text(source.displayNameKo, `${path}.displayNameKo`, 160),
    displayNameEn: text(source.displayNameEn, `${path}.displayNameEn`, 160),
    adapterType: text(source.adapterType, `${path}.adapterType`, 80),
    lifecycleState: enumeration(
      source.lifecycleState,
      WORKPLACE_SERVICE_PROVIDER_LIFECYCLE_STATES,
      `${path}.lifecycleState`
    ),
    siteScope: uuidList(source.siteScope, `${path}.siteScope`),
    capabilities: capabilityList(source.capabilities, `${path}.capabilities`),
    support,
    credentialBindingConfigured: bool(
      source.credentialBindingConfigured,
      `${path}.credentialBindingConfigured`
    ),
    configurationVersion: integer(source.configurationVersion, `${path}.configurationVersion`, 1),
    readiness: enumeration(
      source.readiness,
      WORKPLACE_SERVICE_PROVIDER_READINESS_STATES,
      `${path}.readiness`
    ),
    evidenceConfigurationVersion:
      source.evidenceConfigurationVersion === null
        ? null
        : integer(source.evidenceConfigurationVersion, `${path}.evidenceConfigurationVersion`, 1),
    evidenceReference: nullableText(source.evidenceReference, `${path}.evidenceReference`, 320),
    evidenceObservedAt: nullableInstant(source.evidenceObservedAt, `${path}.evidenceObservedAt`),
    evidenceReceivedAt: nullableInstant(source.evidenceReceivedAt, `${path}.evidenceReceivedAt`),
    evidenceErrorCode: nullableText(source.evidenceErrorCode, `${path}.evidenceErrorCode`, 120),
    version: integer(source.version, `${path}.version`, 1),
    updatedAt: instant(source.updatedAt, `${path}.updatedAt`),
  });
}

export function parseWorkplaceServiceProviders(value: unknown): WorkplaceServiceProviders {
  const source = record(value, '$');
  return Object.freeze({
    items: list(source.items, '$.items', parseWorkplaceServiceProvider, 1000),
    generatedAt: instant(source.generatedAt, '$.generatedAt'),
  });
}

export function parseWorkplaceServiceProviderCommandResult(
  value: unknown
): WorkplaceServiceProviderCommandResult {
  const source = record(value, '$');
  return Object.freeze({
    provider: parseWorkplaceServiceProvider(source.provider, '$.provider'),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

export function parseWorkplaceServiceAssignee(
  value: unknown,
  path = '$'
): WorkplaceServiceAssignee {
  const source = record(value, path);
  return Object.freeze({
    directorySubjectId: text(source.directorySubjectId, `${path}.directorySubjectId`, 160),
    displayName: text(source.displayName, `${path}.displayName`, 300),
    contactAvailable: bool(source.contactAvailable, `${path}.contactAvailable`),
    capabilities: stringList(source.capabilities, `${path}.capabilities`),
    directoryVersion: text(source.directoryVersion, `${path}.directoryVersion`, 160),
    verifiedAt: instant(source.verifiedAt, `${path}.verifiedAt`),
    freshUntil: instant(source.freshUntil, `${path}.freshUntil`),
  });
}

export function parseWorkplaceServiceAssignees(value: unknown): WorkplaceServiceAssignees {
  const source = record(value, '$');
  return Object.freeze({
    items: list(source.items, '$.items', parseWorkplaceServiceAssignee, 50),
    generatedAt: instant(source.generatedAt, '$.generatedAt'),
  });
}

export function parseWorkplaceServiceAssignmentResult(
  value: unknown
): WorkplaceServiceAssignmentResult {
  const source = record(value, '$');
  return Object.freeze({
    serviceOrderId: uuid(source.serviceOrderId, '$.serviceOrderId'),
    fulfillmentTaskId: uuid(source.fulfillmentTaskId, '$.fulfillmentTaskId'),
    assignee: parseWorkplaceServiceAssignee(source.assignee, '$.assignee'),
    taskVersion: integer(source.taskVersion, '$.taskVersion', 1),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

function parseCapacityBucket(value: unknown, path: string): WorkplaceServiceCapacityBucket {
  const source = record(value, path);
  const capacityLimit = integer(source.capacityLimit, `${path}.capacityLimit`);
  const committedQuantity = integer(source.committedQuantity, `${path}.committedQuantity`);
  const heldQuantity = integer(source.heldQuantity, `${path}.heldQuantity`);
  const availableQuantity = integer(source.availableQuantity, `${path}.availableQuantity`);
  if (availableQuantity !== Math.max(0, capacityLimit - committedQuantity - heldQuantity)) {
    return invalid(`${path}.availableQuantity`);
  }
  return Object.freeze({
    capacityBucketId: uuid(source.capacityBucketId, `${path}.capacityBucketId`),
    catalogItemId: uuid(source.catalogItemId, `${path}.catalogItemId`),
    siteReference: text(source.siteReference, `${path}.siteReference`, 160),
    startsAt: instant(source.startsAt, `${path}.startsAt`),
    endsAt: instant(source.endsAt, `${path}.endsAt`),
    capacityLimit,
    committedQuantity,
    heldQuantity,
    availableQuantity,
    sourceVersion: text(source.sourceVersion, `${path}.sourceVersion`, 160),
    sourceObservedAt: instant(source.sourceObservedAt, `${path}.sourceObservedAt`),
    receivedAt: instant(source.receivedAt, `${path}.receivedAt`),
    freshUntil: instant(source.freshUntil, `${path}.freshUntil`),
    fresh: bool(source.fresh, `${path}.fresh`),
    version: integer(source.version, `${path}.version`, 1),
  });
}

export function parseWorkplaceServiceCapacityRange(value: unknown): WorkplaceServiceCapacityRange {
  const source = record(value, '$');
  const catalogItemId = uuid(source.catalogItemId, '$.catalogItemId');
  const siteReference = text(source.siteReference, '$.siteReference', 160);
  const from = instant(source.from, '$.from');
  const to = instant(source.to, '$.to');
  if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 31 * 86_400_000) {
    return invalid('$.to');
  }
  const buckets = list(source.buckets, '$.buckets', parseCapacityBucket, 1000);
  buckets.forEach((bucket, index) => {
    if (
      bucket.catalogItemId !== catalogItemId ||
      bucket.siteReference !== siteReference ||
      Date.parse(bucket.endsAt) <= Date.parse(bucket.startsAt) ||
      Date.parse(bucket.startsAt) < Date.parse(from) ||
      Date.parse(bucket.endsAt) > Date.parse(to) ||
      (index > 0 && Date.parse(bucket.startsAt) < Date.parse(buckets[index - 1]!.endsAt))
    ) {
      invalid(`$.buckets[${index}]`);
    }
  });
  return Object.freeze({
    catalogItemId,
    siteReference,
    from,
    to,
    mode: enumeration(source.mode, WORKPLACE_SERVICE_CAPACITY_MODES, '$.mode'),
    buckets,
    complete: bool(source.complete, '$.complete'),
    limitations: list(
      source.limitations,
      '$.limitations',
      (item, itemPath) =>
        enumeration(
          item,
          [
            'CAPACITY_BUCKET_MISSING',
            'CAPACITY_BUCKET_GAP',
            'CAPACITY_STALE',
            'CAPACITY_EXHAUSTED',
          ] as const,
          itemPath
        ),
      20
    ),
    generatedAt: instant(source.generatedAt, '$.generatedAt'),
  });
}

export function parseWorkplaceServiceCapacityUpsertResult(
  value: unknown
): WorkplaceServiceCapacityUpsertResult {
  const source = record(value, '$');
  return Object.freeze({
    capacity: parseWorkplaceServiceCapacityRange(source.capacity),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

function parseInspectionAttempt(value: unknown, path: string): WorkplaceServiceInspectionAttempt {
  const source = record(value, path);
  return Object.freeze({
    inspectionAttemptId: uuid(source.inspectionAttemptId, `${path}.inspectionAttemptId`),
    serviceOrderId: uuid(source.serviceOrderId, `${path}.serviceOrderId`),
    serviceOrderLineId: uuid(source.serviceOrderLineId, `${path}.serviceOrderLineId`),
    fulfillmentTaskId: uuid(source.fulfillmentTaskId, `${path}.fulfillmentTaskId`),
    mode: enumeration(source.mode, WORKPLACE_SERVICE_INSPECTION_MODES, `${path}.mode`),
    actorRole: enumeration(
      source.actorRole,
      ['OPERATOR', 'REQUESTER'] as const,
      `${path}.actorRole`
    ),
    decision: enumeration(
      source.decision,
      WORKPLACE_SERVICE_INSPECTION_DECISIONS,
      `${path}.decision`
    ),
    checklistSchema: list(source.checklistSchema, `${path}.checklistSchema`, object, 30),
    checklistResponses: object(source.checklistResponses, `${path}.checklistResponses`),
    evidenceAttachmentIds: uuidList(
      source.evidenceAttachmentIds,
      `${path}.evidenceAttachmentIds`,
      20
    ),
    reason: text(source.reason, `${path}.reason`, 500),
    remediationRequired: bool(source.remediationRequired, `${path}.remediationRequired`),
    createdAt: instant(source.createdAt, `${path}.createdAt`),
  });
}

export function parseWorkplaceServiceInspection(value: unknown): WorkplaceServiceInspection {
  const source = record(value, '$');
  return Object.freeze({
    serviceOrderId: uuid(source.serviceOrderId, '$.serviceOrderId'),
    serviceOrderLineId: uuid(source.serviceOrderLineId, '$.serviceOrderLineId'),
    mode: enumeration(source.mode, WORKPLACE_SERVICE_INSPECTION_MODES, '$.mode'),
    required: bool(source.required, '$.required'),
    fulfilledQuantityReady: bool(source.fulfilledQuantityReady, '$.fulfilledQuantityReady'),
    accepted: bool(source.accepted, '$.accepted'),
    remediationRequired: bool(source.remediationRequired, '$.remediationRequired'),
    latestAttempt:
      source.latestAttempt === null
        ? null
        : parseInspectionAttempt(source.latestAttempt, '$.latestAttempt'),
    generatedAt: instant(source.generatedAt, '$.generatedAt'),
  });
}

export function parseWorkplaceServiceInspectionCommandResult(
  value: unknown
): WorkplaceServiceInspectionCommandResult {
  const source = record(value, '$');
  return Object.freeze({
    inspection: parseWorkplaceServiceInspection(source.inspection),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

export function parseWorkplaceServiceAccessCredentialGrant(
  value: unknown
): WorkplaceServiceAccessCredentialGrant {
  const source = record(value, '$');
  if (source.revealOnce !== true) return invalid('$.revealOnce');
  return Object.freeze({
    grantId: uuid(source.grantId, '$.grantId'),
    oneTimeCredential:
      source.oneTimeCredential === null
        ? null
        : text(source.oneTimeCredential, '$.oneTimeCredential', 512),
    expiresAt: instant(source.expiresAt, '$.expiresAt'),
    revealOnce: true,
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

export function parseWorkplaceServiceAccessCredentialStatus(
  value: unknown
): WorkplaceServiceAccessCredentialStatus {
  const source = record(value, '$');
  return Object.freeze({
    grantId: uuid(source.grantId, '$.grantId'),
    state: enumeration(source.state, WORKPLACE_SERVICE_ACCESS_GRANT_STATES, '$.state'),
    issuedAt: instant(source.issuedAt, '$.issuedAt'),
    expiresAt: instant(source.expiresAt, '$.expiresAt'),
    revokedAt: nullableInstant(source.revokedAt, '$.revokedAt'),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}

export function parseWorkplaceServiceContactResult(value: unknown): WorkplaceServiceContactResult {
  const source = record(value, '$');
  return Object.freeze({
    contactRequestId: uuid(source.contactRequestId, '$.contactRequestId'),
    target: enumeration(source.target, ['ASSIGNEE', 'SERVICE_DESK'] as const, '$.target'),
    resolvedTargetDisplayName: text(
      source.resolvedTargetDisplayName,
      '$.resolvedTargetDisplayName',
      300
    ),
    state: enumeration(source.state, ['QUEUED'] as const, '$.state'),
    receipt: parseReceipt(source.receipt, '$.receipt'),
  });
}
import type {
  WorkplaceServiceCapacityMode,
  WorkplaceServiceInspectionMode,
} from './workplace-services-contract';
