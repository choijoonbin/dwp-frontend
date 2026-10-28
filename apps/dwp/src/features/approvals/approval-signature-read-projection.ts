import type {
  ApprovalSignatureCapabilities,
  ApprovalSignatureProvider,
  ApprovalSignatureReadiness,
} from '@dwp-frontend/shared-utils';

const METADATA_FIELDS = [
  'providerId',
  'providerKey',
  'displayName',
  'providerType',
  'lifecycleState',
  'credentialConfigured',
  'lastHealthCheckedAt',
  'version',
] as const;
const FULL_FIELDS = [...METADATA_FIELDS, 'capabilities'] as const;
const CAPABILITY_FIELDS = [
  'internalAttestation',
  'auditEvidence',
  'verifiedIdentity',
  'remoteSigningSupported',
  'readiness',
] as const;
const READINESS = new Set<ApprovalSignatureReadiness>([
  'READY',
  'DISABLED',
  'DEGRADED',
  'CONFIGURATION_REQUIRED',
  'NOT_VERIFIED',
  'EXTERNAL_VERIFICATION_REQUIRED',
]);
// PostgreSQL accepts all 128-bit UUID values, and the approval seed derives
// provider IDs from md5(...)::uuid rather than an RFC versioned generator.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApprovalSignatureMetadataProjection = Readonly<
  Omit<ApprovalSignatureProvider, 'capabilities'>
>;

export type ApprovalSignatureReadProjection =
  | Readonly<{
      mode: 'FULL_MANAGEMENT';
      providers: readonly Readonly<ApprovalSignatureProvider>[];
    }>
  | Readonly<{
      mode: 'OVERSIGHT';
      providers: readonly ApprovalSignatureMetadataProjection[];
    }>;

function invalidProjection(): never {
  throw new Error('Invalid approval signature read projection');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  optional: readonly string[] = []
): void {
  const keys = Object.keys(value);
  if (
    keys.some((key) => !fields.includes(key)) ||
    fields.some((key) => !optional.includes(key) && !Object.hasOwn(value, key))
  ) {
    invalidProjection();
  }
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    invalidProjection();
  }
  return value;
}

function instant(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalidProjection();
  }
  return value;
}

function metadata(value: Record<string, unknown>): ApprovalSignatureMetadataProjection {
  const providerId = text(value.providerId, 36);
  if (!UUID.test(providerId)) invalidProjection();
  if (typeof value.credentialConfigured !== 'boolean') invalidProjection();
  if (
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0
  ) {
    invalidProjection();
  }
  return Object.freeze({
    providerId,
    providerKey: text(value.providerKey, 120),
    displayName: text(value.displayName, 240),
    providerType: text(value.providerType, 120),
    lifecycleState: text(value.lifecycleState, 120),
    credentialConfigured: value.credentialConfigured,
    lastHealthCheckedAt: instant(value.lastHealthCheckedAt),
    version: value.version,
  });
}

function capabilities(value: unknown): Readonly<ApprovalSignatureCapabilities> {
  if (!isRecord(value)) invalidProjection();
  exactFields(value, CAPABILITY_FIELDS);
  for (const field of CAPABILITY_FIELDS.slice(0, 4)) {
    if (typeof value[field] !== 'boolean') invalidProjection();
  }
  if (
    typeof value.readiness !== 'string' ||
    !READINESS.has(value.readiness as ApprovalSignatureReadiness)
  ) {
    invalidProjection();
  }
  return Object.freeze({
    internalAttestation: value.internalAttestation as boolean,
    auditEvidence: value.auditEvidence as boolean,
    verifiedIdentity: value.verifiedIdentity as boolean,
    remoteSigningSupported: value.remoteSigningSupported as boolean,
    readiness: value.readiness as ApprovalSignatureReadiness,
  });
}

export function parseApprovalSignatureReadProjection(
  value: unknown
): ApprovalSignatureReadProjection {
  if (!Array.isArray(value)) invalidProjection();

  // The two server projections are arrays. An empty array cannot prove that the
  // caller received full-management authority, so it deliberately stays read-only.
  if (value.length === 0) {
    return Object.freeze({ mode: 'OVERSIGHT', providers: Object.freeze([]) });
  }

  const records = value.map((item) => {
    if (!isRecord(item)) invalidProjection();
    return item;
  });
  const full = Object.hasOwn(records[0]!, 'capabilities');
  if (records.some((item) => Object.hasOwn(item, 'capabilities') !== full)) invalidProjection();

  if (!full) {
    const providers = records.map((item) => {
      exactFields(item, METADATA_FIELDS, ['lastHealthCheckedAt']);
      return metadata(item);
    });
    return Object.freeze({ mode: 'OVERSIGHT', providers: Object.freeze(providers) });
  }

  const providers = records.map((item) => {
    exactFields(item, FULL_FIELDS, ['lastHealthCheckedAt']);
    return Object.freeze({ ...metadata(item), capabilities: capabilities(item.capabilities) });
  });
  return Object.freeze({ mode: 'FULL_MANAGEMENT', providers: Object.freeze(providers) });
}
