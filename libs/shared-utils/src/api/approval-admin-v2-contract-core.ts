export type ApprovalAdminV2Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type ApprovalAdminV2Status = Readonly<{
  label: string;
  tone: ApprovalAdminV2Tone;
}>;

export type ApprovalAdminV2Metric = Readonly<{
  id: string;
  label: string;
  value: string;
  helper?: string;
  tone?: ApprovalAdminV2Tone;
}>;

export type ApprovalAdminV2Fact = Readonly<{
  id: string;
  label: string;
  value: string;
  tone?: ApprovalAdminV2Tone;
}>;

export type ApprovalAdminV2TimelineItem = Readonly<{
  id: string;
  title: string;
  detail: string;
  meta?: string;
  status: ApprovalAdminV2Status;
}>;

export type ApprovalAdminV2SnapshotMeta = Readonly<{
  generatedAt: string | null;
  sourceRevision: string | null;
  objectVersion: number;
}>;

export type ApprovalAdminV2CommandTarget = Readonly<{
  targetId: string;
  expectedVersion: number;
  commandReady: boolean;
}>;

export class ApprovalAdminV2ContractError extends Error {
  constructor(path: string) {
    super(`Invalid Approval administration response at ${path}.`);
    this.name = 'ApprovalAdminV2ContractError';
  }
}

const TONES = new Set<ApprovalAdminV2Tone>(['neutral', 'info', 'success', 'warning', 'danger']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;

function hasDisallowedControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
}

export function adminV2Record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return value as Record<string, unknown>;
}

export function adminV2Text(
  value: unknown,
  path: string,
  options?: { max?: number; optional?: false }
): string;
export function adminV2Text(
  value: unknown,
  path: string,
  options: { max?: number; optional: true }
): string | undefined;
export function adminV2Text(
  value: unknown,
  path: string,
  options: { max?: number; optional?: boolean } = {}
): string | undefined {
  if (value === undefined && options.optional) return undefined;
  if (typeof value !== 'string') throw new ApprovalAdminV2ContractError(path);
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > (options.max ?? 500) ||
    hasDisallowedControlCharacter(normalized)
  ) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return normalized;
}

export function adminV2Identifier(value: unknown, path: string): string {
  const normalized = adminV2Text(value, path, { max: 200 });
  if (!IDENTIFIER.test(normalized)) throw new ApprovalAdminV2ContractError(path);
  return normalized;
}

export function adminV2Instant(value: unknown, path: string): string {
  const normalized = adminV2Text(value, path, { max: 80 });
  if (!Number.isFinite(Date.parse(normalized))) throw new ApprovalAdminV2ContractError(path);
  return normalized;
}

export function adminV2Version(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return value;
}

export function adminV2Number(
  value: unknown,
  path: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (options.integer && !Number.isInteger(value)) ||
    value < (options.min ?? Number.NEGATIVE_INFINITY) ||
    value > (options.max ?? Number.POSITIVE_INFINITY)
  ) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return value;
}

export function adminV2Boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new ApprovalAdminV2ContractError(path);
  return value;
}

export function adminV2Enum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return value as T;
}

export function adminV2Array<T>(
  value: unknown,
  path: string,
  parse: (item: unknown, path: string) => T,
  max = 200
): readonly T[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new ApprovalAdminV2ContractError(path);
  }
  return value.map((item, index) => parse(item, `${path}[${index}]`));
}

function statusToneFromLabel(label: string): ApprovalAdminV2Tone {
  const code = label.toUpperCase();
  if (/FAILED|BLOCKED|ERROR|BREACH|DENIED|INVALID|CRITICAL|IRREVERSIBLE/u.test(code)) {
    return 'danger';
  }
  if (/DEGRADED|WARNING|ATTENTION|PENDING|STALE|UNKNOWN|CONDITIONAL|REVIEW/u.test(code)) {
    return 'warning';
  }
  if (/READY|ACTIVE|HEALTHY|VERIFIED|VALID|SUCCESS|COMPLETE|ELIGIBLE|REVERSIBLE/u.test(code)) {
    return 'success';
  }
  if (/RUNNING|DRAFT|SCHEDULED|IN_PROGRESS|OBSERVED/u.test(code)) return 'info';
  return 'neutral';
}

export function parseAdminV2Status(value: unknown, path: string): ApprovalAdminV2Status {
  if (typeof value === 'string') {
    const label = adminV2Text(value, path, { max: 80 });
    return { label, tone: statusToneFromLabel(label) };
  }
  const record = adminV2Record(value, path);
  const label = adminV2Text(record.label ?? record.code, `${path}.label`, { max: 80 });
  const tone =
    record.tone === undefined
      ? statusToneFromLabel(label)
      : adminV2Enum(record.tone, [...TONES], `${path}.tone`);
  return { label, tone };
}

export function parseAdminV2Metric(value: unknown, path: string): ApprovalAdminV2Metric {
  const record = adminV2Record(value, path);
  const helper = adminV2Text(record.helper, `${path}.helper`, { max: 500, optional: true });
  const tone =
    record.tone === undefined ? undefined : adminV2Enum(record.tone, [...TONES], `${path}.tone`);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    label: adminV2Text(record.label, `${path}.label`, { max: 120 }),
    value: adminV2Text(record.value, `${path}.value`, { max: 120 }),
    ...(helper ? { helper } : {}),
    ...(tone ? { tone } : {}),
  };
}

export function parseAdminV2Fact(value: unknown, path: string): ApprovalAdminV2Fact {
  const record = adminV2Record(value, path);
  const tone =
    record.tone === undefined ? undefined : adminV2Enum(record.tone, [...TONES], `${path}.tone`);
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    label: adminV2Text(record.label, `${path}.label`, { max: 160 }),
    value: adminV2Text(record.value, `${path}.value`, { max: 1000 }),
    ...(tone ? { tone } : {}),
  };
}

export function parseAdminV2TimelineItem(
  value: unknown,
  path: string
): ApprovalAdminV2TimelineItem {
  const record = adminV2Record(value, path);
  const meta = adminV2Text(record.meta, `${path}.meta`, { max: 300, optional: true });
  return {
    id: adminV2Identifier(record.id, `${path}.id`),
    title: adminV2Text(record.title, `${path}.title`, { max: 200 }),
    detail: adminV2Text(record.detail, `${path}.detail`, { max: 2000 }),
    ...(meta ? { meta } : {}),
    status: parseAdminV2Status(record.status, `${path}.status`),
  };
}

export function parseAdminV2SnapshotMeta(
  value: unknown,
  path = 'data.meta'
): ApprovalAdminV2SnapshotMeta {
  const record = adminV2Record(value, path);
  return {
    generatedAt:
      record.generatedAt === null
        ? null
        : adminV2Instant(record.generatedAt, `${path}.generatedAt`),
    sourceRevision:
      record.sourceRevision === null
        ? null
        : adminV2Text(record.sourceRevision, `${path}.sourceRevision`, { max: 200 }),
    objectVersion: adminV2Version(record.objectVersion, `${path}.objectVersion`),
  };
}

export function parseAdminV2CommandTarget(
  value: unknown,
  path: string
): ApprovalAdminV2CommandTarget {
  const record = adminV2Record(value, path);
  return {
    targetId: adminV2Identifier(record.targetId, `${path}.targetId`),
    expectedVersion: adminV2Version(record.expectedVersion, `${path}.expectedVersion`),
    commandReady: adminV2Boolean(record.commandReady, `${path}.commandReady`),
  };
}
