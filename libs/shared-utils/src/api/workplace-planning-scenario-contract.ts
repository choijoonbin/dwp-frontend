import {
  WORKPLACE_PLANNING_SCENARIO_STATES,
  WORKPLACE_PLANNING_SERIES,
} from './workplace-planning-types';
import {
  bool,
  enumeration,
  instant,
  integer,
  invalid,
  list,
  nullableInstant,
  nullableInteger,
  nullableText,
  parseComparison,
  parseDraft,
  parseEmission,
  parseForecast,
  parseScope,
  parseSource,
  record,
  strings,
  text,
  uuid,
} from './workplace-planning-contract-helpers';

import type {
  WorkplacePlanningBookingImpact,
  WorkplacePlanningBookingImpactCommandResult,
  WorkplacePlanningBookingImpactState,
  WorkplacePlanningCommandResult,
  WorkplacePlanningOverview,
  WorkplacePlanningScenario,
  WorkplacePlanningScenarioPreview,
  WorkplacePlanningScenarioState,
} from './workplace-planning-types';

const scenarioStates = new Set<WorkplacePlanningScenarioState>(WORKPLACE_PLANNING_SCENARIO_STATES);
const impactStates = new Set<WorkplacePlanningBookingImpactState>([
  'READY',
  'SCOPE_INCOMPLETE',
  'COMPUTE_FAILED',
]);
const commandStates = new Set<WorkplacePlanningCommandResult['receipt']['state']>([
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const outboxStates = new Set<WorkplacePlanningCommandResult['receipt']['outboxState']>([
  'PENDING',
  'PUBLISHED',
  'FAILED',
  'RESULT_UNKNOWN',
]);

function parsePreview(value: unknown, path: string): WorkplacePlanningScenarioPreview {
  const data = record(value, path);
  const scenarioId = uuid(data.scenarioId, `${path}.scenarioId`);
  const scenarioVersion = integer(data.scenarioVersion, `${path}.scenarioVersion`, 1);
  const forecast = parseForecast(data.forecast, `${path}.forecast`);
  const forecastState = enumeration(
    data.forecastState,
    new Set([forecast.state]),
    `${path}.forecastState`
  );
  const result = Object.freeze({
    previewId: uuid(data.previewId, `${path}.previewId`),
    scenarioId,
    scenarioVersion,
    forecastState,
    forecast,
    comparison: parseComparison(data.comparison, `${path}.comparison`),
    emission: data.emission === null ? null : parseEmission(data.emission, `${path}.emission`),
    eligible: bool(data.eligible, `${path}.eligible`),
    limitations: strings(data.limitations, `${path}.limitations`),
    expiresAt: instant(data.expiresAt, `${path}.expiresAt`),
    createdAt: instant(data.createdAt, `${path}.createdAt`),
  });
  return Date.parse(result.expiresAt) > Date.parse(result.createdAt) ? result : invalid(path);
}

function lifecycleIsConsistent(value: WorkplacePlanningScenario) {
  if (value.state === 'PREVIEWED' && !value.activePreview) return false;
  if (['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes(value.state)) {
    if (!value.submittedAt || value.submittedBy === null) return false;
  }
  if (['APPROVED', 'PUBLISHED'].includes(value.state)) {
    if (!value.approvedAt || value.approvedBy === null || !value.approvalAuthorityReference) {
      return false;
    }
  }
  if (value.state === 'PUBLISHED' && (!value.publishedAt || value.publishedBy === null))
    return false;
  const rejectionValues = [value.lastRejectedAt, value.lastRejectedBy, value.lastRejectionReason];
  return (
    rejectionValues.every((item) => item === null) || rejectionValues.every((item) => item !== null)
  );
}

export function parseWorkplacePlanningScenario(
  value: unknown,
  path = 'scenario'
): WorkplacePlanningScenario {
  const data = record(value, path);
  const scenarioId = uuid(data.scenarioId, `${path}.scenarioId`);
  const version = integer(data.version, `${path}.version`, 1);
  const activePreview =
    data.activePreview === null ? null : parsePreview(data.activePreview, `${path}.activePreview`);
  if (
    activePreview &&
    (activePreview.scenarioId !== scenarioId || activePreview.scenarioVersion !== version - 1)
  ) {
    return invalid(`${path}.activePreview`);
  }
  const result = Object.freeze({
    scenarioId,
    name: text(data.name, `${path}.name`, 160),
    description: nullableText(data.description, `${path}.description`, 1000),
    state: enumeration(data.state, scenarioStates, `${path}.state`),
    scope: parseScope(data.scope, `${path}.scope`),
    draft: parseDraft(data.draft, `${path}.draft`),
    activePreview,
    version,
    submittedAt: nullableInstant(data.submittedAt, `${path}.submittedAt`),
    submittedBy: nullableInteger(data.submittedBy, `${path}.submittedBy`),
    approvedAt: nullableInstant(data.approvedAt, `${path}.approvedAt`),
    approvedBy: nullableInteger(data.approvedBy, `${path}.approvedBy`),
    approvalAuthorityReference: nullableText(
      data.approvalAuthorityReference,
      `${path}.approvalAuthorityReference`,
      160
    ),
    publishedAt: nullableInstant(data.publishedAt, `${path}.publishedAt`),
    publishedBy: nullableInteger(data.publishedBy, `${path}.publishedBy`),
    lastRejectedAt: nullableInstant(data.lastRejectedAt, `${path}.lastRejectedAt`),
    lastRejectedBy: nullableInteger(data.lastRejectedBy, `${path}.lastRejectedBy`),
    lastRejectionReason: nullableText(data.lastRejectionReason, `${path}.lastRejectionReason`, 500),
    createdAt: instant(data.createdAt, `${path}.createdAt`),
    updatedAt: instant(data.updatedAt, `${path}.updatedAt`),
  });
  return lifecycleIsConsistent(result) ? result : invalid(path);
}

function parseReceipt(value: unknown, path: string): WorkplacePlanningCommandResult['receipt'] {
  const data = record(value, path);
  return Object.freeze({
    commandId: uuid(data.commandId, `${path}.commandId`),
    commandType: text(data.commandType, `${path}.commandType`, 80),
    state: enumeration(data.state, commandStates, `${path}.state`),
    scenarioId: uuid(data.scenarioId, `${path}.scenarioId`),
    scenarioState: enumeration(data.scenarioState, scenarioStates, `${path}.scenarioState`),
    scenarioVersion: integer(data.scenarioVersion, `${path}.scenarioVersion`, 1),
    outboxId: uuid(data.outboxId, `${path}.outboxId`),
    outboxState: enumeration(data.outboxState, outboxStates, `${path}.outboxState`),
    idempotentReplay: bool(data.idempotentReplay, `${path}.idempotentReplay`),
    correlationId: nullableText(data.correlationId, `${path}.correlationId`, 160),
    acceptedAt: instant(data.acceptedAt, `${path}.acceptedAt`),
  });
}

export function parseWorkplacePlanningCommandResult(
  value: unknown
): WorkplacePlanningCommandResult {
  const data = record(value, 'planningCommand');
  const scenario = parseWorkplacePlanningScenario(data.scenario, 'planningCommand.scenario');
  const receipt = parseReceipt(data.receipt, 'planningCommand.receipt');
  if (
    receipt.scenarioId !== scenario.scenarioId ||
    receipt.scenarioState !== scenario.state ||
    receipt.scenarioVersion !== scenario.version
  ) {
    return invalid('planningCommand.receipt');
  }
  return Object.freeze({ scenario, receipt });
}

export function parseWorkplacePlanningBookingImpact(
  value: unknown,
  path = 'bookingImpact'
): WorkplacePlanningBookingImpact {
  const data = record(value, path);
  const state = enumeration(data.state, impactStates, `${path}.state`);
  const bookings = list(data.bookings, `${path}.bookings`, (item, itemPath) => {
    const booking = record(item, itemPath);
    const automaticallyMoved = bool(booking.automaticallyMoved, `${itemPath}.automaticallyMoved`);
    if (automaticallyMoved) return invalid(`${itemPath}.automaticallyMoved`);
    const result = Object.freeze({
      bookingId: uuid(booking.bookingId, `${itemPath}.bookingId`),
      resourceId: uuid(booking.resourceId, `${itemPath}.resourceId`),
      startsAt: instant(booking.startsAt, `${itemPath}.startsAt`),
      endsAt: instant(booking.endsAt, `${itemPath}.endsAt`),
      bookingStatus: text(booking.bookingStatus, `${itemPath}.bookingStatus`, 80),
      impactReason: text(booking.impactReason, `${itemPath}.impactReason`, 500),
      automaticallyMoved: false as const,
    });
    return Date.parse(result.endsAt) > Date.parse(result.startsAt) ? result : invalid(itemPath);
  });
  const impactedBookingCount = nullableInteger(
    data.impactedBookingCount,
    `${path}.impactedBookingCount`
  );
  if (
    (state === 'READY' && impactedBookingCount !== bookings.length) ||
    (state !== 'READY' && (impactedBookingCount !== null || bookings.length > 0))
  ) {
    return invalid(path);
  }
  const result = Object.freeze({
    impactPreviewId: uuid(data.impactPreviewId, `${path}.impactPreviewId`),
    scenarioId: uuid(data.scenarioId, `${path}.scenarioId`),
    scenarioVersion: integer(data.scenarioVersion, `${path}.scenarioVersion`, 1),
    state,
    impactedBookingCount,
    bookings,
    limitations: strings(data.limitations, `${path}.limitations`),
    expiresAt: instant(data.expiresAt, `${path}.expiresAt`),
    createdAt: instant(data.createdAt, `${path}.createdAt`),
  });
  return Date.parse(result.expiresAt) > Date.parse(result.createdAt) ? result : invalid(path);
}

export function parseWorkplacePlanningBookingImpactCommandResult(
  value: unknown
): WorkplacePlanningBookingImpactCommandResult {
  const data = record(value, 'bookingImpactCommand');
  const preview = parseWorkplacePlanningBookingImpact(data.preview, 'bookingImpactCommand.preview');
  const receipt = parseReceipt(data.receipt, 'bookingImpactCommand.receipt');
  if (
    receipt.scenarioId !== preview.scenarioId ||
    receipt.scenarioVersion !== preview.scenarioVersion
  ) {
    return invalid('bookingImpactCommand.receipt');
  }
  return Object.freeze({ preview, receipt });
}

export function parseWorkplacePlanningSources(value: unknown) {
  const sources = list(value, 'planningSources', parseSource);
  const names = new Set(sources.map((source) => source.series));
  if (sources.length !== WORKPLACE_PLANNING_SERIES.length || names.size !== sources.length) {
    return invalid('planningSources');
  }
  return sources;
}

export function parseWorkplacePlanningScenarios(value: unknown) {
  return list(value, 'planningScenarios', (item, path) =>
    parseWorkplacePlanningScenario(item, path)
  );
}

export function parseWorkplacePlanningOverview(value: unknown): WorkplacePlanningOverview {
  const data = record(value, 'planningOverview');
  const scope = parseScope(data.scope, 'planningOverview.scope');
  const currentData = record(data.current, 'planningOverview.current');
  const sources = parseWorkplacePlanningSources(data.sources);
  const forecast = parseForecast(data.forecast, 'planningOverview.forecast');
  const scenarios = list(data.scenarios, 'planningOverview.scenarios', (item, path) =>
    parseWorkplacePlanningScenario(item, path)
  );
  const sourceObservationIds = sources.flatMap((source) =>
    source.observationId ? [source.observationId] : []
  );
  const displayedSourceIds = new Set(sourceObservationIds);
  const forecastSourceIds = new Set(forecast.sourceObservationIds);
  if (
    scenarios.some((scenario) => scenario.scope.siteId !== scope.siteId) ||
    (forecast.state === 'READY' &&
      (sources.some(
        (source) =>
          source.availability !== 'AVAILABLE' ||
          source.freshness !== 'FRESH' ||
          source.coveragePercent !== 100 ||
          source.observationId === null ||
          source.sourceAt === null ||
          source.receivedAt === null ||
          source.evidenceReference === null
      ) ||
        sourceObservationIds.length !== WORKPLACE_PLANNING_SERIES.length ||
        displayedSourceIds.size !== WORKPLACE_PLANNING_SERIES.length ||
        forecastSourceIds.size !== WORKPLACE_PLANNING_SERIES.length ||
        sourceObservationIds.some((id) => !forecastSourceIds.has(id)) ||
        forecast.sourceObservationIds.some((id) => !displayedSourceIds.has(id))))
  ) {
    return invalid('planningOverview.scenarios');
  }
  return Object.freeze({
    scope,
    current: Object.freeze({
      capacity: integer(currentData.capacity, 'planningOverview.current.capacity'),
      roomCapacity: integer(currentData.roomCapacity, 'planningOverview.current.roomCapacity'),
      accessibleResourceCount: integer(
        currentData.accessibleResourceCount,
        'planningOverview.current.accessibleResourceCount'
      ),
      resourceCount: integer(currentData.resourceCount, 'planningOverview.current.resourceCount'),
      catalogAsOf: instant(currentData.catalogAsOf, 'planningOverview.current.catalogAsOf'),
    }),
    sources,
    forecast,
    emission:
      data.emission === null ? null : parseEmission(data.emission, 'planningOverview.emission'),
    scenarios,
    generatedAt: instant(data.generatedAt, 'planningOverview.generatedAt'),
  });
}
