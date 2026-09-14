export const SIGNATURE_PROVIDER_KINDS = ['INTERNAL', 'DOCUSIGN', 'ADOBE_SIGN', 'CUSTOM'] as const;
export const SIGNATURE_PROVIDER_ENVIRONMENTS = [
  'UNCONFIGURED',
  'INTERNAL',
  'SANDBOX',
  'PRODUCTION',
] as const;
export const SIGNATURE_OBSERVATION_STATES = [
  'PASS',
  'FAIL',
  'NOT_CONFIGURED',
  'NOT_OBSERVED',
  'NOT_APPLICABLE',
] as const;
export const SIGNATURE_POLICY_SOURCE_STATES = [
  'AVAILABLE',
  'MISSING_INTERNAL',
  'NOT_CONFIGURED',
  'UNRECORDED',
] as const;
export const SIGNATURE_PROVIDER_READINESS = [
  'MISSING_INTERNAL',
  'DISABLED',
  'CONFIGURATION_REQUIRED',
  'NOT_VERIFIED',
  'DEGRADED',
  'VERIFIED_INTERNAL_KEY',
  'VERIFIED_SANDBOX',
  'VERIFIED_PRODUCTION',
] as const;
export const SIGNATURE_GATE_STATES = ['NOT_EVALUATED', 'BLOCKED', 'ELIGIBLE'] as const;
export const SIGNATURE_PHASE_KINDS = [
  'INTERNAL_DECISION',
  'EXTERNAL_HANDOVER',
  'VERIFIED_COMPLETION',
] as const;
export const SIGNATURE_KMS_BACKENDS = ['NONE', 'INTERNAL_JCA', 'AWS_KMS', 'PKCS11'] as const;
export const SIGNATURE_KEY_VERIFICATION_KINDS = [
  'NONE',
  'INTERNAL_KEY',
  'CONFIGURED_KMS',
  'HARDWARE_TOKEN',
] as const;
export const SIGNATURE_OBJECT_LOCK_MODES = ['NONE', 'GOVERNANCE', 'COMPLIANCE'] as const;
export const SIGNATURE_PROBE_STATES = [
  'PENDING',
  'RUNNING',
  'COMPLETE',
  'PARTIAL',
  'UNKNOWN_REMOTE_OUTCOME',
] as const;
export const SIGNATURE_PROBE_OUTCOMES = [
  'PASS',
  'FAIL',
  'INELIGIBLE',
  'COOLDOWN',
  'UNKNOWN_REMOTE_OUTCOME',
] as const;

export function invalidSignatureDiagnostics(): never {
  throw new Error('Invalid approval signature provider contract');
}

export function diagnosticFields(
  value: unknown,
  fields: readonly string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    fields.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  )
    invalidSignatureDiagnostics();
  return value as Record<string, unknown>;
}
export function diagnosticText(value: unknown, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0'))
    invalidSignatureDiagnostics();
  return value;
}
export function diagnosticInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    invalidSignatureDiagnostics();
  return value;
}
export function diagnosticBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalidSignatureDiagnostics();
  return value;
}
export function diagnosticEnum<const T extends readonly string[]>(
  value: unknown,
  values: T
): T[number] {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) invalidSignatureDiagnostics();
  return found;
}
export function diagnosticNullable<T>(value: unknown, read: (value: unknown) => T): T | null {
  return value === null ? null : read(value);
}
export function diagnosticList<T>(
  value: unknown,
  read: (value: unknown) => T,
  max: number
): readonly T[] {
  if (!Array.isArray(value) || value.length > max) invalidSignatureDiagnostics();
  return Object.freeze(value.map(read));
}
export function diagnosticUnique<T>(
  values: readonly T[],
  identity: (value: T) => unknown = (value) => value
): readonly T[] {
  if (new Set(values.map(identity)).size !== values.length) invalidSignatureDiagnostics();
  return values;
}
export function diagnosticId(value: unknown): string {
  const id = diagnosticText(value, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
    invalidSignatureDiagnostics();
  return id;
}
export function diagnosticSha(value: unknown): string {
  const sha = diagnosticText(value, 64);
  if (!/^[a-f0-9]{64}$/.test(sha)) invalidSignatureDiagnostics();
  return sha;
}
export function diagnosticKey(value: unknown): string {
  const key = diagnosticText(value, 120);
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(key)) invalidSignatureDiagnostics();
  return key;
}
export function diagnosticReasons(value: unknown): readonly string[] {
  return diagnosticUnique(
    diagnosticList(
      value,
      (item) => {
        const code = diagnosticText(item, 80);
        if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(code)) invalidSignatureDiagnostics();
        return code;
      },
      32
    )
  );
}
export function diagnosticInstant(value: unknown): string {
  const instant = diagnosticText(value, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(instant);
  if (!match || !Number.isFinite(Date.parse(instant))) invalidSignatureDiagnostics();
  const date = new Date(instant);
  const actual = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  if (actual.some((part, index) => part !== Number(match[index + 1])))
    invalidSignatureDiagnostics();
  return instant;
}
export function diagnosticInterval(observed: string | null, until: string | null): void {
  if (
    (observed === null) !== (until === null) ||
    (observed !== null && until !== null && Date.parse(until) <= Date.parse(observed))
  )
    invalidSignatureDiagnostics();
}
export function diagnosticEvidence(id: string | null, sha: string | null): void {
  if ((id === null) !== (sha === null)) invalidSignatureDiagnostics();
}
export function diagnosticSource(revision: unknown, sha: string): string {
  if (revision !== `sigp-${sha}`) invalidSignatureDiagnostics();
  return revision;
}
export function diagnosticSeconds(value: unknown): number {
  return diagnosticInteger(value, 1, 3_153_600_000);
}
export function diagnosticOfficialLink(value: unknown): string {
  const link = diagnosticText(value, 2048);
  if (!/^https:\/\/[^/:?#]+(?:\/[^?#]*)?$/.test(link) || link.includes('%') || link.includes('..'))
    invalidSignatureDiagnostics();
  const url = new URL(link);
  if (
    ![
      'developers.docusign.com',
      'www.docusign.com',
      'developer.adobe.com',
      'docs.aws.amazon.com',
      'docs.oracle.com',
    ].includes(url.hostname) ||
    url.username ||
    url.password
  )
    invalidSignatureDiagnostics();
  return link;
}
