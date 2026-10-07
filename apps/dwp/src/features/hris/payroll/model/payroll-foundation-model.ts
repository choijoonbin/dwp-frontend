import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { isPayrollFoundationCurrencyCode } from './payroll-foundation-currency';

export type FoundationStatus = 'DRAFT' | 'SIMULATED' | 'PUBLISHED' | 'REVERSED';
export type FoundationFreshness = 'LIVE' | 'STALE' | 'PARTIAL' | 'UNAVAILABLE';
export type FoundationReceiptState = 'PENDING' | 'SUCCEEDED' | 'RESULT_UNKNOWN' | 'REVERSAL_FAILED';
export type FoundationCommandKind = 'CREATE' | 'UPDATE' | 'SIMULATE' | 'PUBLISH' | 'REVERSE';
export type FoundationRoundingMode =
  'UP' | 'DOWN' | 'CEILING' | 'FLOOR' | 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN';

export type CountryPackReference = Readonly<{ packId: string; version: number; digest: string }>;
export type LegalEntityDefinition = Readonly<{
  id: string;
  code: string;
  displayName: string;
  countryPack: CountryPackReference;
}>;
export type PayrollGroupDefinition = Readonly<{
  id: string;
  code: string;
  legalEntityId: string;
  currencies: readonly string[];
  settlementCurrency: string;
}>;
export type PayCalendarPeriod = Readonly<{
  code: string;
  startsOn: string;
  endsOn: string;
  paymentDate: string;
}>;
export type PayCalendarDefinition = Readonly<{
  id: string;
  payrollGroupId: string;
  cadence: string;
  periods: readonly PayCalendarPeriod[];
}>;
export type RoundingPolicy = Readonly<{
  scale: number;
  mode: FoundationRoundingMode;
  increment: string;
}>;
export type FoundationDependency = Readonly<{
  owner: string;
  resourceId: string;
  version: number;
  state?: 'CURRENT' | 'STALE' | 'UNAVAILABLE';
}>;
export type PayrollFoundationDefinition = Readonly<{
  legalEntity: LegalEntityDefinition;
  payrollGroup: PayrollGroupDefinition;
  payCalendar: PayCalendarDefinition;
  effectivePeriod: Readonly<{ startsOn: string; endsOn: string | null }>;
  roundingPolicies: Readonly<Record<string, RoundingPolicy>>;
  dependencies: readonly FoundationDependency[];
}>;

export type FoundationSimulation = Readonly<{
  simulationId: string;
  configurationVersion: number;
  definitionDigest: string;
  dependencyDigest: string;
  successful: boolean;
  findings: readonly string[];
  simulatedAt: string;
  simulatedBy: number;
}>;

export type FoundationAccessProjection = Readonly<{
  canCreate: boolean;
  canEdit: boolean;
  canSimulate: boolean;
  canPublish: boolean;
  canReverse: boolean;
  canReconcile: boolean;
  publishDenialCode?: string;
}>;

export type PayrollFoundationConfiguration = Readonly<{
  id: string;
  version: number;
  status: FoundationStatus;
  definition: PayrollFoundationDefinition;
  authorId: number;
  publisherId: number | null;
  createdAt: string;
  updatedAt: string;
  simulation: FoundationSimulation | null;
  lastCommandId: string;
  access: FoundationAccessProjection;
  freshness: Readonly<{ state: FoundationFreshness; lastSuccessfulRefreshAt: string | null }>;
}>;

export type FoundationPartialFailure = Readonly<{ source: string; code: string }>;
export type PayrollFoundationWorkspace = Readonly<{
  configurations: readonly PayrollFoundationConfiguration[];
  access: FoundationAccessProjection;
  freshness: FoundationFreshness;
  lastSuccessfulRefreshAt: string | null;
  partialFailures: readonly FoundationPartialFailure[];
}>;

export type FoundationCommandReceipt = Readonly<{
  commandId: string;
  commandType: FoundationCommandKind;
  status: FoundationReceiptState;
  configurationId: string | null;
  resultVersion: number | null;
  reversalOfCommandId: string | null;
  failureCode: string | null;
  correlationId: string | null;
  createdAt: string;
  completedAt: string | null;
}>;

export type FoundationCommandResult = Readonly<{
  receipt: FoundationCommandReceipt;
  configuration: PayrollFoundationConfiguration | null;
}>;

export type FoundationDraftPeriod = {
  key: string;
  code: string;
  startsOn: string;
  endsOn: string;
  paymentDate: string;
};
export type FoundationDraftRounding = {
  key: string;
  currency: string;
  scale: string;
  mode: FoundationRoundingMode;
  increment: string;
};
export type PayrollFoundationDraft = {
  configurationId: string | null;
  baseVersion: number | null;
  legalEntityId: string;
  legalEntityCode: string;
  legalEntityName: string;
  countryPackId: string;
  countryPackVersion: string;
  countryPackDigest: string;
  payrollGroupId: string;
  payrollGroupCode: string;
  currencies: string;
  settlementCurrency: string;
  calendarId: string;
  cadence: string;
  effectiveStartsOn: string;
  effectiveEndsOn: string;
  periods: FoundationDraftPeriod[];
  rounding: FoundationDraftRounding[];
  dependencies: readonly FoundationDependency[];
};

export type FoundationDraftValidation = Readonly<{
  valid: boolean;
  errors: readonly string[];
}>;

export type FoundationCommandFailure = Readonly<{
  kind: 'CONFLICT' | 'PERMISSION' | 'RESULT_UNKNOWN' | 'REJECTED';
  preserveDraft: true;
}>;

const STATUS = new Set<FoundationStatus>(['DRAFT', 'SIMULATED', 'PUBLISHED', 'REVERSED']);
const RECEIPT_STATES = new Set<FoundationReceiptState>([
  'PENDING',
  'SUCCEEDED',
  'RESULT_UNKNOWN',
  'REVERSAL_FAILED',
]);
const COMMAND_KINDS = new Set<FoundationCommandKind>([
  'CREATE',
  'UPDATE',
  'SIMULATE',
  'PUBLISH',
  'REVERSE',
]);
export const FOUNDATION_ROUNDING_MODES = [
  'UP',
  'DOWN',
  'CEILING',
  'FLOOR',
  'HALF_UP',
  'HALF_DOWN',
  'HALF_EVEN',
] as const;
const ROUNDING_MODES = new Set<FoundationRoundingMode>(FOUNDATION_ROUNDING_MODES);
const CADENCES = new Set(['WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'CUSTOM']);
const DEPENDENCY_STATES = new Set<NonNullable<FoundationDependency['state']>>([
  'CURRENT',
  'STALE',
  'UNAVAILABLE',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9._:-]{0,79}$/u;
const DENY_ALL: FoundationAccessProjection = Object.freeze({
  canCreate: false,
  canEdit: false,
  canSimulate: false,
  canPublish: false,
  canReverse: false,
  canReconcile: false,
});

function invalidSource(path: string): never {
  throw new Error(`Invalid payroll foundation source: ${path}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidSource(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalidSource(path);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) invalidSource(path);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) invalidSource(`${path}[${index}]`);
  }
  return value;
}

function text(value: unknown, path: string, maximum = 500): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    [...value].some((character) => {
      const code = character.codePointAt(0);
      return code !== undefined && (code <= 31 || code === 127);
    })
  )
    invalidSource(path);
  return value;
}

function nullableText(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : text(value, path);
}

function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  if (!UUID_PATTERN.test(result)) invalidSource(path);
  return result;
}

function nullableUuid(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : uuid(value, path);
}

function code(value: unknown, path: string): string {
  const result = text(value, path, 80);
  if (!CODE_PATTERN.test(result)) invalidSource(path);
  return result;
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalidSource(path);
  }
  return value as number;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalidSource(path);
  return value;
}

function civilDate(value: unknown, path: string): string {
  const result = text(value, path, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result)) invalidSource(path);
  const [year, month, day] = result.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) invalidSource(path);
  return result;
}

function nullableCivilDate(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : civilDate(value, path);
}

function nullableInstant(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  const result = text(value, path, 80);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(result)) {
    invalidSource(path);
  }
  if (!Number.isFinite(Date.parse(result))) invalidSource(path);
  return result;
}

function enumValue<T extends string>(value: unknown, path: string, values: ReadonlySet<T>): T {
  const result = text(value, path, 80);
  if (!values.has(result as T)) invalidSource(path);
  return result as T;
}

function currency(value: unknown, path: string): string {
  const result = text(value, path, 3);
  if (!isPayrollFoundationCurrencyCode(result)) invalidSource(path);
  return result;
}

function decimal(value: unknown, path: string): string {
  const result = text(value, path, 80);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(result) || !/[1-9]/u.test(result)) {
    invalidSource(path);
  }
  return result;
}

function accessProjection(value: unknown, path: string): FoundationAccessProjection {
  if (value === undefined || value === null) return DENY_ALL;
  const source = record(value, path);
  const publishDenialCode = nullableText(source.publishDenialCode, `${path}.publishDenialCode`);
  return Object.freeze({
    canCreate: bool(source.canCreate, `${path}.canCreate`),
    canEdit: bool(source.canEdit, `${path}.canEdit`),
    canSimulate: bool(source.canSimulate, `${path}.canSimulate`),
    canPublish: bool(source.canPublish, `${path}.canPublish`),
    canReverse: bool(source.canReverse, `${path}.canReverse`),
    canReconcile: bool(source.canReconcile, `${path}.canReconcile`),
    ...(publishDenialCode ? { publishDenialCode } : {}),
  });
}

function selectDefinition(value: unknown, path: string): PayrollFoundationDefinition {
  const source = record(value, path);
  const entity = record(source.legalEntity, `${path}.legalEntity`);
  const pack = record(entity.countryPack, `${path}.legalEntity.countryPack`);
  const group = record(source.payrollGroup, `${path}.payrollGroup`);
  const calendar = record(source.payCalendar, `${path}.payCalendar`);
  const effective = record(source.effectivePeriod, `${path}.effectivePeriod`);
  const effectiveStartsOn = civilDate(effective.startsOn, `${path}.effectivePeriod.startsOn`);
  const effectiveEndsOn = nullableCivilDate(effective.endsOn, `${path}.effectivePeriod.endsOn`);
  if (effectiveEndsOn !== null && effectiveEndsOn < effectiveStartsOn) {
    invalidSource(`${path}.effectivePeriod`);
  }

  const currencies = array(group.currencies, `${path}.payrollGroup.currencies`).map((item, index) =>
    currency(item, `${path}.payrollGroup.currencies[${index}]`)
  );
  if (!currencies.length || new Set(currencies).size !== currencies.length) {
    invalidSource(`${path}.payrollGroup.currencies`);
  }
  const settlementCurrency = currency(
    group.settlementCurrency,
    `${path}.payrollGroup.settlementCurrency`
  );
  if (!currencies.includes(settlementCurrency))
    invalidSource(`${path}.payrollGroup.settlementCurrency`);

  const periods = array(calendar.periods, `${path}.payCalendar.periods`).map((item, index) => {
    const period = record(item, `${path}.payCalendar.periods[${index}]`);
    const startsOn = civilDate(period.startsOn, `${path}.payCalendar.periods[${index}].startsOn`);
    const endsOn = civilDate(period.endsOn, `${path}.payCalendar.periods[${index}].endsOn`);
    if (endsOn < startsOn) invalidSource(`${path}.payCalendar.periods[${index}]`);
    return Object.freeze({
      code: code(period.code, `${path}.payCalendar.periods[${index}].code`),
      startsOn,
      endsOn,
      paymentDate: civilDate(
        period.paymentDate,
        `${path}.payCalendar.periods[${index}].paymentDate`
      ),
    });
  });
  if (!periods.length || new Set(periods.map((period) => period.code)).size !== periods.length) {
    invalidSource(`${path}.payCalendar.periods`);
  }
  const orderedPeriods = [...periods].sort((left, right) =>
    left.startsOn.localeCompare(right.startsOn)
  );
  if (
    orderedPeriods.some(
      (period, index) => index > 0 && period.startsOn <= orderedPeriods[index - 1].endsOn
    )
  ) {
    invalidSource(`${path}.payCalendar.periods`);
  }

  const roundingSource = record(source.roundingPolicies, `${path}.roundingPolicies`);
  const roundingPolicies: Record<string, RoundingPolicy> = {};
  for (const [currencyCode, value] of Object.entries(roundingSource)) {
    currency(currencyCode, `${path}.roundingPolicies.key`);
    const policy = record(value, `${path}.roundingPolicies.${currencyCode}`);
    const scale = integer(policy.scale, `${path}.roundingPolicies.${currencyCode}.scale`, 0, 12);
    const increment = decimal(
      policy.increment,
      `${path}.roundingPolicies.${currencyCode}.increment`
    );
    if ((increment.split('.')[1]?.length ?? 0) > scale) {
      invalidSource(`${path}.roundingPolicies.${currencyCode}.increment`);
    }
    roundingPolicies[currencyCode] = Object.freeze({
      scale,
      mode: enumValue(policy.mode, `${path}.roundingPolicies.${currencyCode}.mode`, ROUNDING_MODES),
      increment,
    });
  }
  if (
    Object.keys(roundingPolicies).length !== currencies.length ||
    currencies.some((code) => !roundingPolicies[code])
  ) {
    invalidSource(`${path}.roundingPolicies`);
  }

  const legalEntityId = uuid(entity.id, `${path}.legalEntity.id`);
  const payrollGroupId = uuid(group.id, `${path}.payrollGroup.id`);
  if (uuid(group.legalEntityId, `${path}.payrollGroup.legalEntityId`) !== legalEntityId) {
    invalidSource(`${path}.payrollGroup.legalEntityId`);
  }
  if (uuid(calendar.payrollGroupId, `${path}.payCalendar.payrollGroupId`) !== payrollGroupId) {
    invalidSource(`${path}.payCalendar.payrollGroupId`);
  }

  const dependencies = array(source.dependencies, `${path}.dependencies`).map((item, index) => {
    const dependency = record(item, `${path}.dependencies[${index}]`);
    const state =
      dependency.state === undefined
        ? undefined
        : enumValue(dependency.state, `${path}.dependencies[${index}].state`, DEPENDENCY_STATES);
    return Object.freeze({
      owner: code(dependency.owner, `${path}.dependencies[${index}].owner`),
      resourceId: uuid(dependency.resourceId, `${path}.dependencies[${index}].resourceId`),
      version: integer(dependency.version, `${path}.dependencies[${index}].version`, 1),
      ...(state ? { state } : {}),
    });
  });
  if (
    new Set(dependencies.map((dependency) => `${dependency.owner}:${dependency.resourceId}`))
      .size !== dependencies.length
  ) {
    invalidSource(`${path}.dependencies`);
  }

  return Object.freeze({
    legalEntity: Object.freeze({
      id: legalEntityId,
      code: code(entity.code, `${path}.legalEntity.code`),
      displayName: text(entity.displayName, `${path}.legalEntity.displayName`, 200),
      countryPack: Object.freeze({
        packId: code(pack.packId, `${path}.legalEntity.countryPack.packId`),
        version: integer(pack.version, `${path}.legalEntity.countryPack.version`, 1),
        digest: (() => {
          const digest = text(pack.digest, `${path}.legalEntity.countryPack.digest`, 64);
          if (!/^[0-9a-f]{64}$/u.test(digest)) {
            invalidSource(`${path}.legalEntity.countryPack.digest`);
          }
          return digest;
        })(),
      }),
    }),
    payrollGroup: Object.freeze({
      id: payrollGroupId,
      code: code(group.code, `${path}.payrollGroup.code`),
      legalEntityId,
      currencies: Object.freeze(currencies),
      settlementCurrency,
    }),
    payCalendar: Object.freeze({
      id: uuid(calendar.id, `${path}.payCalendar.id`),
      payrollGroupId,
      cadence: enumValue(calendar.cadence, `${path}.payCalendar.cadence`, CADENCES),
      periods: Object.freeze(periods),
    }),
    effectivePeriod: Object.freeze({ startsOn: effectiveStartsOn, endsOn: effectiveEndsOn }),
    roundingPolicies: Object.freeze(roundingPolicies),
    dependencies: Object.freeze(dependencies),
  });
}

export function selectFoundationConfiguration(value: unknown, path = 'configuration') {
  const source = record(value, path);
  const simulationSource =
    source.simulation === undefined || source.simulation === null
      ? null
      : record(source.simulation, `${path}.simulation`);
  const simulation: FoundationSimulation | null = simulationSource
    ? Object.freeze({
        simulationId: uuid(simulationSource.simulationId, `${path}.simulation.simulationId`),
        configurationVersion: integer(
          simulationSource.configurationVersion,
          `${path}.simulation.configurationVersion`,
          1
        ),
        definitionDigest: (() => {
          const digest = text(
            simulationSource.definitionDigest,
            `${path}.simulation.definitionDigest`,
            64
          );
          if (!/^[0-9a-f]{64}$/u.test(digest)) invalidSource(`${path}.simulation.definitionDigest`);
          return digest;
        })(),
        dependencyDigest: (() => {
          const digest = text(
            simulationSource.dependencyDigest,
            `${path}.simulation.dependencyDigest`,
            64
          );
          if (!/^[0-9a-f]{64}$/u.test(digest)) invalidSource(`${path}.simulation.dependencyDigest`);
          return digest;
        })(),
        successful: bool(simulationSource.successful, `${path}.simulation.successful`),
        findings: Object.freeze(
          array(simulationSource.findings, `${path}.simulation.findings`).map((item, index) =>
            text(item, `${path}.simulation.findings[${index}]`, 200)
          )
        ),
        simulatedAt:
          nullableInstant(simulationSource.simulatedAt, `${path}.simulation.simulatedAt`) ??
          invalidSource(`${path}.simulation.simulatedAt`),
        simulatedBy: integer(simulationSource.simulatedBy, `${path}.simulation.simulatedBy`, 1),
      })
    : null;
  const publisherId =
    source.publisherId === null || source.publisherId === undefined
      ? null
      : integer(source.publisherId, `${path}.publisherId`, 1);
  const freshnessSource = record(source.freshness, `${path}.freshness`);
  return Object.freeze({
    id: uuid(source.configurationId, `${path}.configurationId`),
    version: integer(source.version, `${path}.version`, 1),
    status: enumValue(source.status, `${path}.status`, STATUS),
    definition: selectDefinition(source.definition, `${path}.definition`),
    authorId: integer(source.authorId, `${path}.authorId`, 1),
    publisherId,
    createdAt:
      nullableInstant(source.createdAt, `${path}.createdAt`) ?? invalidSource(`${path}.createdAt`),
    updatedAt:
      nullableInstant(source.updatedAt, `${path}.updatedAt`) ?? invalidSource(`${path}.updatedAt`),
    simulation,
    lastCommandId: uuid(source.lastCommandId, `${path}.lastCommandId`),
    access: accessProjection(source.access, `${path}.access`),
    freshness: Object.freeze({
      state: enumValue(
        freshnessSource.state,
        `${path}.freshness.state`,
        new Set<FoundationFreshness>(['LIVE', 'STALE', 'PARTIAL', 'UNAVAILABLE'])
      ),
      lastSuccessfulRefreshAt: nullableInstant(
        freshnessSource.lastSuccessfulRefreshAt,
        `${path}.freshness.lastSuccessfulRefreshAt`
      ),
    }),
  }) satisfies PayrollFoundationConfiguration;
}

export function selectFoundationWorkspace(value: unknown): PayrollFoundationWorkspace {
  const source = Array.isArray(value) ? null : record(value, 'workspace');
  const values = source
    ? array(source.configurations ?? source.items, 'workspace.configurations')
    : array(value, 'workspace');
  const configurations = values.map((item, index) =>
    selectFoundationConfiguration(item, `workspace.configurations[${index}]`)
  );
  if (new Set(configurations.map((item) => item.id)).size !== configurations.length) {
    invalidSource('workspace.configurations');
  }
  const freshnessRank: Record<FoundationFreshness, number> = {
    LIVE: 0,
    STALE: 1,
    PARTIAL: 2,
    UNAVAILABLE: 3,
  };
  let freshness = configurations.reduce<FoundationFreshness>(
    (current, configuration) =>
      freshnessRank[configuration.freshness.state] > freshnessRank[current]
        ? configuration.freshness.state
        : current,
    'LIVE'
  );
  const partialFailures =
    source?.partialFailures === undefined
      ? []
      : array(source.partialFailures, 'workspace.partialFailures').map((item, index) => {
          const failure = record(item, `workspace.partialFailures[${index}]`);
          return Object.freeze({
            source: text(failure.source, `workspace.partialFailures[${index}].source`, 100),
            code: text(failure.code, `workspace.partialFailures[${index}].code`, 200),
          });
        });
  if (partialFailures.length > 0 && freshness !== 'UNAVAILABLE') freshness = 'PARTIAL';
  return Object.freeze({
    configurations: Object.freeze(configurations),
    access:
      source?.access === undefined
        ? (configurations[0]?.access ?? DENY_ALL)
        : accessProjection(source.access, 'workspace.access'),
    freshness,
    lastSuccessfulRefreshAt:
      configurations
        .map((configuration) => configuration.freshness.lastSuccessfulRefreshAt)
        .filter((instant): instant is string => Boolean(instant))
        .sort()
        .at(-1) ?? null,
    partialFailures: Object.freeze(partialFailures),
  });
}

export function selectFoundationVersions(
  value: unknown
): readonly PayrollFoundationConfiguration[] {
  const source = Array.isArray(value) ? value : record(value, 'versions').items;
  const versions = array(source, 'versions').map((item, index) =>
    selectFoundationConfiguration(item, `versions[${index}]`)
  );
  return Object.freeze(versions);
}

export function selectFoundationCommandResult(value: unknown): FoundationCommandResult {
  const source = record(value, 'commandResult');
  const receiptSource = record(source.receipt, 'commandResult.receipt');
  const configurationId = nullableUuid(
    receiptSource.configurationId,
    'commandResult.receipt.configurationId'
  );
  const failureCode = nullableText(receiptSource.failureCode, 'commandResult.receipt.failureCode');
  const correlationId = nullableText(
    receiptSource.correlationId,
    'commandResult.receipt.correlationId'
  );
  const reversalOfCommandId = nullableUuid(
    receiptSource.reversalOfCommandId,
    'commandResult.receipt.reversalOfCommandId'
  );
  const receipt = Object.freeze({
    commandId: uuid(receiptSource.commandId, 'commandResult.receipt.commandId'),
    commandType: enumValue(
      receiptSource.commandType,
      'commandResult.receipt.commandType',
      COMMAND_KINDS
    ),
    status: enumValue(receiptSource.status, 'commandResult.receipt.status', RECEIPT_STATES),
    configurationId,
    resultVersion:
      receiptSource.resultVersion === null || receiptSource.resultVersion === undefined
        ? null
        : integer(receiptSource.resultVersion, 'commandResult.receipt.resultVersion', 1),
    reversalOfCommandId,
    failureCode,
    correlationId,
    createdAt:
      nullableInstant(receiptSource.createdAt, 'commandResult.receipt.createdAt') ??
      invalidSource('commandResult.receipt.createdAt'),
    completedAt: nullableInstant(receiptSource.completedAt, 'commandResult.receipt.completedAt'),
  });
  const configuration =
    source.configuration === null || source.configuration === undefined
      ? null
      : selectFoundationConfiguration(source.configuration);
  if (
    configuration &&
    (receipt.configurationId !== configuration.id ||
      receipt.resultVersion !== configuration.version)
  ) {
    invalidSource('commandResult.configuration');
  }
  if (
    (receipt.status === 'PENDING' && receipt.completedAt !== null) ||
    (receipt.status !== 'PENDING' && receipt.completedAt === null)
  ) {
    invalidSource('commandResult.receipt.completedAt');
  }
  return Object.freeze({ receipt, configuration });
}
let localDraftKey = 0;
function draftKey(prefix: string) {
  localDraftKey += 1;
  return `${prefix}-${localDraftKey}`;
}

export function emptyFoundationDraft(): PayrollFoundationDraft {
  return {
    configurationId: null,
    baseVersion: null,
    legalEntityId: '',
    legalEntityCode: '',
    legalEntityName: '',
    countryPackId: '',
    countryPackVersion: '',
    countryPackDigest: '',
    payrollGroupId: '',
    payrollGroupCode: '',
    currencies: '',
    settlementCurrency: '',
    calendarId: '',
    cadence: '',
    effectiveStartsOn: '',
    effectiveEndsOn: '',
    periods: [{ key: draftKey('period'), code: '', startsOn: '', endsOn: '', paymentDate: '' }],
    rounding: [
      { key: draftKey('rounding'), currency: '', scale: '', mode: 'HALF_EVEN', increment: '' },
    ],
    dependencies: [],
  };
}

export function foundationDraftFromConfiguration(
  configuration: PayrollFoundationConfiguration
): PayrollFoundationDraft {
  const { definition } = configuration;
  return {
    configurationId: configuration.id,
    baseVersion: configuration.version,
    legalEntityId: definition.legalEntity.id,
    legalEntityCode: definition.legalEntity.code,
    legalEntityName: definition.legalEntity.displayName,
    countryPackId: definition.legalEntity.countryPack.packId,
    countryPackVersion: String(definition.legalEntity.countryPack.version),
    countryPackDigest: definition.legalEntity.countryPack.digest,
    payrollGroupId: definition.payrollGroup.id,
    payrollGroupCode: definition.payrollGroup.code,
    currencies: definition.payrollGroup.currencies.join(', '),
    settlementCurrency: definition.payrollGroup.settlementCurrency,
    calendarId: definition.payCalendar.id,
    cadence: definition.payCalendar.cadence,
    effectiveStartsOn: definition.effectivePeriod.startsOn,
    effectiveEndsOn: definition.effectivePeriod.endsOn ?? '',
    periods: definition.payCalendar.periods.map((period) => ({
      ...period,
      key: draftKey('period'),
    })),
    rounding: Object.entries(definition.roundingPolicies).map(([currencyCode, policy]) => ({
      key: draftKey('rounding'),
      currency: currencyCode,
      scale: String(policy.scale),
      mode: policy.mode,
      increment: policy.increment,
    })),
    dependencies: definition.dependencies,
  };
}

function draftCurrencies(value: string) {
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function isDraftUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function isDraftCode(value: string) {
  return CODE_PATTERN.test(value.trim().toUpperCase());
}

function isDraftText(value: string, maximum = 200) {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= maximum &&
    ![...normalized].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point <= 31 || point === 127);
    })
  );
}

function isDraftCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export function validateFoundationDraft(draft: PayrollFoundationDraft): FoundationDraftValidation {
  const errors: string[] = [];
  const required = [
    draft.legalEntityId,
    draft.legalEntityCode,
    draft.legalEntityName,
    draft.countryPackId,
    draft.countryPackVersion,
    draft.countryPackDigest,
    draft.payrollGroupId,
    draft.payrollGroupCode,
    draft.settlementCurrency,
    draft.calendarId,
    draft.cadence,
    draft.effectiveStartsOn,
  ];
  if (required.some((value) => !value.trim())) errors.push('REQUIRED_FIELDS');
  if (
    !isDraftUuid(draft.legalEntityId) ||
    !isDraftUuid(draft.payrollGroupId) ||
    !isDraftUuid(draft.calendarId)
  ) {
    errors.push('IDENTIFIERS');
  }
  if (
    !isDraftCode(draft.legalEntityCode) ||
    !isDraftCode(draft.countryPackId) ||
    !isDraftCode(draft.payrollGroupCode) ||
    !isDraftText(draft.legalEntityName)
  ) {
    errors.push('IDENTITY_FIELDS');
  }
  const currencies = draftCurrencies(draft.currencies);
  if (
    !currencies.length ||
    currencies.some((value) => !isPayrollFoundationCurrencyCode(value)) ||
    new Set(currencies).size !== currencies.length
  )
    errors.push('CURRENCIES');
  if (!currencies.includes(draft.settlementCurrency.trim().toUpperCase()))
    errors.push('SETTLEMENT_CURRENCY');
  if (
    !isDraftCivilDate(draft.effectiveStartsOn) ||
    (draft.effectiveEndsOn !== '' &&
      (!isDraftCivilDate(draft.effectiveEndsOn) || draft.effectiveEndsOn < draft.effectiveStartsOn))
  )
    errors.push('EFFECTIVE_PERIOD');
  const countryPackVersion = Number(draft.countryPackVersion);
  if (
    !/^\d+$/u.test(draft.countryPackVersion) ||
    !Number.isSafeInteger(countryPackVersion) ||
    countryPackVersion < 1
  ) {
    errors.push('COUNTRY_PACK_VERSION');
  }
  if (!/^[0-9a-f]{64}$/u.test(draft.countryPackDigest)) {
    errors.push('COUNTRY_PACK_DIGEST');
  }
  if (
    !draft.periods.length ||
    draft.periods.some(
      (period) =>
        !isDraftCode(period.code) ||
        !isDraftCivilDate(period.startsOn) ||
        !isDraftCivilDate(period.endsOn) ||
        !isDraftCivilDate(period.paymentDate) ||
        period.endsOn < period.startsOn
    )
  )
    errors.push('CALENDAR_PERIODS');
  const orderedPeriods = [...draft.periods].sort((left, right) =>
    left.startsOn.localeCompare(right.startsOn)
  );
  if (
    orderedPeriods.some(
      (period, index) => index > 0 && period.startsOn <= orderedPeriods[index - 1].endsOn
    )
  ) {
    errors.push('CALENDAR_PERIODS');
  }
  if (!CADENCES.has(draft.cadence.trim())) errors.push('CADENCE');
  if (
    draft.dependencies.some(
      (dependency) =>
        !isDraftCode(dependency.owner) ||
        !isDraftUuid(dependency.resourceId) ||
        !Number.isSafeInteger(dependency.version) ||
        dependency.version < 1
    )
  ) {
    errors.push('DEPENDENCIES');
  }
  const roundingCurrencies = draft.rounding.map((policy) => policy.currency.trim().toUpperCase());
  if (
    draft.rounding.length !== currencies.length ||
    new Set(roundingCurrencies).size !== roundingCurrencies.length ||
    currencies.some((code) => !roundingCurrencies.includes(code)) ||
    draft.rounding.some(
      (policy) =>
        !isPayrollFoundationCurrencyCode(policy.currency.trim().toUpperCase()) ||
        !/^\d+$/u.test(policy.scale) ||
        Number(policy.scale) > 12 ||
        policy.increment.length > 80 ||
        !/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(policy.increment) ||
        !/[1-9]/u.test(policy.increment) ||
        (policy.increment.split('.')[1]?.length ?? 0) > Number(policy.scale)
    )
  )
    errors.push('ROUNDING_POLICIES');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function foundationDefinitionFromDraft(
  draft: PayrollFoundationDraft
): PayrollFoundationDefinition {
  const validation = validateFoundationDraft(draft);
  if (!validation.valid) throw new Error('Payroll foundation draft is invalid.');
  const currencies = draftCurrencies(draft.currencies);
  const roundingPolicies = Object.fromEntries(
    draft.rounding.map((policy) => [
      policy.currency.trim().toUpperCase(),
      { scale: Number(policy.scale), mode: policy.mode, increment: policy.increment },
    ])
  );
  return {
    legalEntity: {
      id: draft.legalEntityId.trim(),
      code: draft.legalEntityCode.trim().toUpperCase(),
      displayName: draft.legalEntityName.trim(),
      countryPack: {
        packId: draft.countryPackId.trim().toUpperCase(),
        version: Number(draft.countryPackVersion),
        digest: draft.countryPackDigest.trim(),
      },
    },
    payrollGroup: {
      id: draft.payrollGroupId.trim(),
      code: draft.payrollGroupCode.trim().toUpperCase(),
      legalEntityId: draft.legalEntityId.trim(),
      currencies,
      settlementCurrency: draft.settlementCurrency.trim().toUpperCase(),
    },
    payCalendar: {
      id: draft.calendarId.trim(),
      payrollGroupId: draft.payrollGroupId.trim(),
      cadence: draft.cadence.trim().toUpperCase(),
      periods: draft.periods.map(({ code, startsOn, endsOn, paymentDate }) => ({
        code: code.trim().toUpperCase(),
        startsOn,
        endsOn,
        paymentDate,
      })),
    },
    effectivePeriod: {
      startsOn: draft.effectiveStartsOn,
      endsOn: draft.effectiveEndsOn || null,
    },
    roundingPolicies,
    dependencies: draft.dependencies.map((dependency) => ({
      ...dependency,
      owner: dependency.owner.trim().toUpperCase(),
      resourceId: dependency.resourceId.trim(),
    })),
  };
}

export function effectiveFoundationAccess(
  workspace: PayrollFoundationWorkspace,
  configuration: PayrollFoundationConfiguration | null
): FoundationAccessProjection {
  return configuration?.access ?? workspace.access;
}

export function foundationPublishBlockers(
  configuration: PayrollFoundationConfiguration,
  access: FoundationAccessProjection
): readonly string[] {
  const blockers: string[] = [];
  if (!access.canPublish) blockers.push(access.publishDenialCode ?? 'SERVER_PERMISSION_REQUIRED');
  if (configuration.status !== 'SIMULATED') blockers.push('SIMULATION_REQUIRED');
  if (!configuration.simulation?.successful) blockers.push('SIMULATION_NOT_PASSED');
  if (configuration.simulation?.configurationVersion !== configuration.version) {
    blockers.push('SIMULATION_STALE');
  }
  if (configuration.freshness.state === 'STALE') blockers.push('DEPENDENCY_STALE');
  if (configuration.freshness.state === 'PARTIAL') blockers.push('DEPENDENCY_PARTIAL');
  if (configuration.freshness.state === 'UNAVAILABLE') blockers.push('DEPENDENCY_UNAVAILABLE');
  if (configuration.definition.dependencies.some((dependency) => dependency.state === 'STALE')) {
    blockers.push('DEPENDENCY_STALE');
  }
  if (
    configuration.definition.dependencies.some((dependency) => dependency.state === 'UNAVAILABLE')
  ) {
    blockers.push('DEPENDENCY_UNAVAILABLE');
  }
  return Object.freeze([...new Set(blockers)]);
}

export function classifyFoundationCommandFailure(error: unknown): FoundationCommandFailure {
  if (error instanceof HttpError && error.status === 409) {
    return { kind: 'CONFLICT', preserveDraft: true };
  }
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    return { kind: 'PERMISSION', preserveDraft: true };
  }
  if (error instanceof HttpError && error.status >= 500) {
    return { kind: 'RESULT_UNKNOWN', preserveDraft: true };
  }
  if (error instanceof HttpTransportError) {
    return { kind: 'RESULT_UNKNOWN', preserveDraft: true };
  }
  return { kind: 'REJECTED', preserveDraft: true };
}

export const PAYROLL_FOUNDATION_CONTRACT = Object.freeze({
  sliceId: 'BASE-TFR-PAY-007',
  pageArchetype: 'STUDIO',
  calculatesPayroll: false,
  initiatesPayment: false,
  storesBankDetails: false,
  usesTypedDecimalRounding: true,
  publishRequiresSimulation: true,
  authorPublisherSeparation: 'SERVER_PROJECTED_FAIL_CLOSED',
});
