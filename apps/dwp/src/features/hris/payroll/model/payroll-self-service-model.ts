// Domain projection inputs deliberately exclude the employee and monetary transport payload.
// API/hook adapters may supply structurally compatible source values; UI only receives the model.
export type PayrollDataOrigin = 'SOURCE' | 'MANUAL' | 'REFERENCE' | 'MIXED' | 'NONE' | 'UNKNOWN';

export type PayrollCycleModel = {
  payCycleId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  timeValidated: boolean;
  absenceValidated: boolean;
  sourceConfirmed: boolean;
  dataOrigin: PayrollDataOrigin;
};

export type PayrollStatementSource = {
  statementId: string;
  periodLabel: string;
  availabilityState: string;
  publishedAt?: string | null;
  downloadable: boolean;
};

export type PayrollWorkspaceSource = {
  nextCycle?: PayrollCycleModel | null;
  statements: PayrollStatementSource[];
  monetaryDataRedacted: boolean;
};

export const HRIS_PAYROLL_ROUTE = '/hr/pay' as const;

export const PAYROLL_SELF_SERVICE_CONTRACT = {
  route: HRIS_PAYROLL_ROUTE,
  primaryUser: 'EMPLOYEE',
  operationalQuestion: 'Which pay statements has the secure payroll source made available to me?',
  primaryAction: 'DOWNLOAD_AVAILABLE_SOURCE_STATEMENT',
  pageArchetype: 'LIST_DETAIL',
  calculatesPayroll: false,
  confirmsPayroll: false,
  initiatesPayment: false,
  displaysMonetaryValues: false,
} as const;

export type PayrollStatementAvailability =
  'AVAILABLE' | 'PENDING' | 'WITHHELD' | 'RETIRED' | 'UNKNOWN';

export type PayrollStatementAccess = 'DOWNLOADABLE' | 'DOWNLOAD_NOT_GRANTED' | 'NOT_AVAILABLE';

export type PayrollStatementModel = {
  statementId: string;
  periodLabel: string;
  availability: PayrollStatementAvailability;
  sourceAvailability: string;
  publishedAt: string | null;
  sourceDownloadable: boolean;
  access: PayrollStatementAccess;
};

export type PayrollSelfServiceModel = {
  dataOrigin: PayrollDataOrigin;
  containsReferenceData: boolean;
  sourceConfirmed: boolean | null;
  monetaryDataRedacted: boolean;
  nextCycle: PayrollCycleModel | null | undefined;
  statements: PayrollStatementModel[];
  empty: boolean;
};

const KNOWN_AVAILABILITY = new Set<PayrollStatementAvailability>([
  'AVAILABLE',
  'PENDING',
  'WITHHELD',
  'RETIRED',
]);

const DATA_ORIGINS = new Set<PayrollDataOrigin>([
  'SOURCE', 'MANUAL', 'REFERENCE', 'MIXED', 'NONE', 'UNKNOWN',
]);

function invalidSource(path: string): never {
  // Field paths only: rejected payroll/employee values must not reach error feedback.
  throw new Error(`Invalid payroll source: ${path}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalidSource(path);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    (!allowEmpty && !value.trim()) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  ) {
    invalidSource(path);
  }
  return value;
}

function identifier(value: unknown, path: string): string {
  const result = text(value, path);
  // Existing owner IDs are opaque strings, not newly invented UUIDs or coerced business keys.
  if (/\s/.test(result)) invalidSource(path);
  return result;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalidSource(path);
  return value;
}

function civilDate(value: unknown, path: string): string {
  const result = text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalidSource(path);
  const [year, month, day] = result.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    invalidSource(path);
  }
  return result;
}

function publicationInstant(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  const result = text(value, path);
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(result);
  if (!match) invalidSource(path);
  civilDate(match[1], path);
  if (
    Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59 ||
    (match[6] !== undefined && (Number(match[6]) > 23 || Number(match[7]) > 59)) ||
    !Number.isFinite(Date.parse(result))
  ) {
    invalidSource(path);
  }
  return result;
}

function projectCycle(value: unknown): PayrollCycleModel | null | undefined {
  if (value === null || value === undefined) return value;
  const source = record(value, 'nextCycle');
  const periodStart = civilDate(source.periodStart, 'nextCycle.periodStart');
  const periodEnd = civilDate(source.periodEnd, 'nextCycle.periodEnd');
  if (periodEnd < periodStart) invalidSource('nextCycle.periodEnd');
  const dataOrigin = text(source.dataOrigin, 'nextCycle.dataOrigin');
  if (!DATA_ORIGINS.has(dataOrigin as PayrollDataOrigin)) invalidSource('nextCycle.dataOrigin');
  return {
    payCycleId: identifier(source.payCycleId, 'nextCycle.payCycleId'),
    name: text(source.name, 'nextCycle.name'),
    periodStart,
    periodEnd,
    // A source may pay before or after a period ends; no company-specific timing rule is invented.
    payDate: civilDate(source.payDate, 'nextCycle.payDate'),
    status: text(source.status, 'nextCycle.status'),
    timeValidated: boolean(source.timeValidated, 'nextCycle.timeValidated'),
    absenceValidated: boolean(source.absenceValidated, 'nextCycle.absenceValidated'),
    sourceConfirmed: boolean(source.sourceConfirmed, 'nextCycle.sourceConfirmed'),
    dataOrigin: dataOrigin as PayrollDataOrigin,
  };
}

export function normalizePayrollStatementAvailability(
  availabilityState: string
): PayrollStatementAvailability {
  const normalized = text(availabilityState, 'availabilityState', true).trim().toUpperCase();
  return KNOWN_AVAILABILITY.has(normalized as PayrollStatementAvailability)
    ? (normalized as PayrollStatementAvailability)
    : 'UNKNOWN';
}

export function toPayrollStatementModel(statement: PayrollStatementSource): PayrollStatementModel {
  return projectStatement(statement, 'statement');
}

function projectStatement(value: unknown, path: string): PayrollStatementModel {
  const source = record(value, path);
  const statementId = identifier(source.statementId, `${path}.statementId`);
  const periodLabel = text(source.periodLabel, `${path}.periodLabel`);
  const availabilityState = text(source.availabilityState, `${path}.availabilityState`, true);
  const downloadable = boolean(source.downloadable, `${path}.downloadable`);
  const publishedAt = publicationInstant(source.publishedAt, `${path}.publishedAt`);
  const availability = normalizePayrollStatementAvailability(availabilityState);
  const sourceDownloadable = availability === 'AVAILABLE' && downloadable;
  const access: PayrollStatementAccess =
    availability !== 'AVAILABLE'
      ? 'NOT_AVAILABLE'
      : sourceDownloadable
        ? 'DOWNLOADABLE'
        : 'DOWNLOAD_NOT_GRANTED';

  return {
    statementId,
    periodLabel,
    availability,
    sourceAvailability: availabilityState || 'UNKNOWN',
    publishedAt,
    sourceDownloadable,
    access,
  };
}

export function buildPayrollSelfServiceModel(
  workspace: PayrollWorkspaceSource
): PayrollSelfServiceModel {
  const source = record(workspace, 'workspace');
  const monetaryDataRedacted = boolean(source.monetaryDataRedacted, 'monetaryDataRedacted');
  const nextCycle = projectCycle(source.nextCycle);
  if (!Array.isArray(source.statements)) invalidSource('statements');
  const statementIds = new Set<string>();
  const statements = Array.from(source.statements, (item, index) => {
    const projected = projectStatement(item, `statements[${index}]`);
    if (statementIds.has(projected.statementId)) invalidSource(`statements[${index}].statementId`);
    statementIds.add(projected.statementId);
    return projected;
  });
  const dataOrigin = nextCycle?.dataOrigin ?? 'NONE';

  return {
    dataOrigin,
    containsReferenceData: dataOrigin === 'REFERENCE' || dataOrigin === 'MIXED',
    sourceConfirmed: nextCycle?.sourceConfirmed ?? null,
    monetaryDataRedacted,
    nextCycle,
    statements,
    empty: !nextCycle && statements.length === 0,
  };
}
