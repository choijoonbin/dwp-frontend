import {
  WORKPLACE_PLANNING_FORECAST_STATES,
  WORKPLACE_PLANNING_SERIES,
} from './workplace-planning-types';

import type {
  WorkplacePlanningComparison,
  WorkplacePlanningDraft,
  WorkplacePlanningEmission,
  WorkplacePlanningEmissionEvidenceKind,
  WorkplacePlanningForecast,
  WorkplacePlanningForecastPoint,
  WorkplacePlanningForecastState,
  WorkplacePlanningFreshness,
  WorkplacePlanningScope,
  WorkplacePlanningSeries,
  WorkplacePlanningSeriesPoint,
  WorkplacePlanningSourceAvailability,
  WorkplacePlanningSourceStatus,
} from './workplace-planning-types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const series = new Set<WorkplacePlanningSeries>(WORKPLACE_PLANNING_SERIES);
const sourceAvailability = new Set<WorkplacePlanningSourceAvailability>([
  'AVAILABLE',
  'PARTIAL',
  'UNAVAILABLE',
  'COMPUTE_FAILED',
]);
const freshness = new Set<WorkplacePlanningFreshness>(['FRESH', 'STALE', 'UNKNOWN']);
const forecastStates = new Set<WorkplacePlanningForecastState>(WORKPLACE_PLANNING_FORECAST_STATES);
const resourceTypes = new Set<Exclude<WorkplacePlanningScope['resourceType'], null>>([
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
]);

export function invalid(path: string): never {
  throw new Error(`Invalid Workplace Planning response at ${path}.`);
}
export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  return value as Record<string, unknown>;
}
export function text(value: unknown, path: string, maximum = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) return invalid(path);
  return value;
}
export function nullableText(value: unknown, path: string, maximum = 2000): string | null {
  return value === null ? null : text(value, path, maximum);
}
export function number(value: unknown, path: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    return invalid(path);
  }
  return value;
}
export function integer(value: unknown, path: string, minimum = 0): number {
  const result = number(value, path);
  if (!Number.isSafeInteger(result) || result < minimum) return invalid(path);
  return result;
}
export function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}
export function bool(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalid(path);
}
export function enumeration<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string
): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : invalid(path);
}
export function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return uuidPattern.test(result) ? result : invalid(path);
}
export function nullableUuid(value: unknown, path: string): string | null {
  return value === null ? null : uuid(value, path);
}
export function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  return Number.isFinite(Date.parse(result)) ? result : invalid(path);
}
export function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}
export function list<T>(
  value: unknown,
  path: string,
  parser: (item: unknown, path: string) => T
): readonly T[] {
  if (!Array.isArray(value)) return invalid(path);
  return Object.freeze(value.map((item, index) => parser(item, `${path}[${index}]`)));
}
export function strings(value: unknown, path: string, maximum = 300): readonly string[] {
  return list(value, path, (item, itemPath) => text(item, itemPath, maximum));
}
export function nullableNumber(value: unknown, path: string): number | null {
  return value === null ? null : number(value, path);
}

export function parseScope(value: unknown, path: string): WorkplacePlanningScope {
  const data = record(value, path);
  const from = instant(data.from, `${path}.from`);
  const to = instant(data.to, `${path}.to`);
  if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 366 * 86_400_000) {
    return invalid(`${path}.to`);
  }
  return Object.freeze({
    siteId: uuid(data.siteId, `${path}.siteId`),
    floorId: nullableUuid(data.floorId, `${path}.floorId`),
    neighborhood: nullableText(data.neighborhood, `${path}.neighborhood`, 120),
    resourceType:
      data.resourceType === null
        ? null
        : enumeration(data.resourceType, resourceTypes, `${path}.resourceType`),
    from,
    to,
  });
}

function parseSeriesPoint(value: unknown, path: string): WorkplacePlanningSeriesPoint {
  const data = record(value, path);
  const point = Object.freeze({
    bucketStart: instant(data.bucketStart, `${path}.bucketStart`),
    value: number(data.value, `${path}.value`),
    lowerBound: nullableNumber(data.lowerBound, `${path}.lowerBound`),
    upperBound: nullableNumber(data.upperBound, `${path}.upperBound`),
    unit: text(data.unit, `${path}.unit`, 40),
  });
  if (
    (point.lowerBound !== null && point.lowerBound > point.value) ||
    (point.upperBound !== null && point.upperBound < point.value)
  ) {
    return invalid(path);
  }
  return point;
}

export function parseSource(value: unknown, path: string): WorkplacePlanningSourceStatus {
  const data = record(value, path);
  const result = Object.freeze({
    series: enumeration(data.series, series, `${path}.series`),
    availability: enumeration(data.availability, sourceAvailability, `${path}.availability`),
    coveragePercent: number(data.coveragePercent, `${path}.coveragePercent`, 100),
    sourceAt: nullableInstant(data.sourceAt, `${path}.sourceAt`),
    receivedAt: nullableInstant(data.receivedAt, `${path}.receivedAt`),
    freshness: enumeration(data.freshness, freshness, `${path}.freshness`),
    exclusions: strings(data.exclusions, `${path}.exclusions`),
    evidenceReference: nullableText(data.evidenceReference, `${path}.evidenceReference`, 320),
    points: list(data.points, `${path}.points`, parseSeriesPoint),
    observationId: nullableUuid(data.observationId, `${path}.observationId`),
    sequence: integer(data.sequence, `${path}.sequence`),
  });
  if (
    (result.availability === 'AVAILABLE' && result.coveragePercent !== 100) ||
    (result.availability === 'PARTIAL' &&
      (result.coveragePercent <= 0 || result.coveragePercent >= 100)) ||
    (['UNAVAILABLE', 'COMPUTE_FAILED'].includes(result.availability) &&
      (result.coveragePercent !== 0 || result.points.length > 0)) ||
    ((result.sourceAt === null || result.receivedAt === null || result.observationId === null) &&
      result.sequence !== 0) ||
    (result.sourceAt !== null &&
      result.receivedAt !== null &&
      Date.parse(result.sourceAt) > Date.parse(result.receivedAt))
  ) {
    return invalid(path);
  }
  return result;
}

function parseForecastPoint(value: unknown, path: string): WorkplacePlanningForecastPoint {
  const data = record(value, path);
  const expectedDemand = number(data.expectedDemand, `${path}.expectedDemand`);
  const lowerBound = number(data.lowerBound, `${path}.lowerBound`);
  const upperBound = number(data.upperBound, `${path}.upperBound`);
  if (lowerBound > expectedDemand || upperBound < expectedDemand) return invalid(path);
  return Object.freeze({
    bucketStart: instant(data.bucketStart, `${path}.bucketStart`),
    expectedDemand,
    lowerBound,
    upperBound,
    unit: text(data.unit, `${path}.unit`, 40),
  });
}

export function parseForecast(value: unknown, path: string): WorkplacePlanningForecast {
  const data = record(value, path);
  const state = enumeration(data.state, forecastStates, `${path}.state`);
  const metricsData = data.recommendationMetrics;
  const metrics =
    metricsData === null
      ? null
      : (() => {
          const item = record(metricsData, `${path}.recommendationMetrics`);
          return Object.freeze({
            peakDemand: number(item.peakDemand, `${path}.recommendationMetrics.peakDemand`),
            lowUtilizationDemand: number(
              item.lowUtilizationDemand,
              `${path}.recommendationMetrics.lowUtilizationDemand`
            ),
            confidencePercent: number(
              item.confidencePercent,
              `${path}.recommendationMetrics.confidencePercent`,
              100
            ),
            calculationVersion: text(
              item.calculationVersion,
              `${path}.recommendationMetrics.calculationVersion`,
              120
            ),
          });
        })();
  const points = list(data.points, `${path}.points`, parseForecastPoint);
  if (state !== 'READY' && (points.length > 0 || metrics !== null)) return invalid(path);
  if (state === 'READY' && (!points.length || !metrics)) return invalid(path);
  const result = Object.freeze({
    forecastId: nullableUuid(data.forecastId, `${path}.forecastId`),
    state,
    calculationVersion: nullableText(data.calculationVersion, `${path}.calculationVersion`, 120),
    evidenceReference: nullableText(data.evidenceReference, `${path}.evidenceReference`, 320),
    sourceObservationIds: list(data.sourceObservationIds, `${path}.sourceObservationIds`, uuid),
    points,
    recommendationMetrics: metrics,
    limitations: strings(data.limitations, `${path}.limitations`),
    sourceAt: nullableInstant(data.sourceAt, `${path}.sourceAt`),
    receivedAt: nullableInstant(data.receivedAt, `${path}.receivedAt`),
    evaluatedAt: instant(data.evaluatedAt, `${path}.evaluatedAt`),
  });
  const sourceIds = new Set(result.sourceObservationIds);
  if (
    state === 'READY' &&
    (result.forecastId === null ||
      result.calculationVersion === null ||
      result.evidenceReference === null ||
      result.sourceAt === null ||
      result.receivedAt === null ||
      result.sourceObservationIds.length !== WORKPLACE_PLANNING_SERIES.length ||
      sourceIds.size !== WORKPLACE_PLANNING_SERIES.length ||
      result.recommendationMetrics?.calculationVersion !== result.calculationVersion ||
      Date.parse(result.sourceAt) > Date.parse(result.receivedAt) ||
      Date.parse(result.receivedAt) > Date.parse(result.evaluatedAt) + 60_000)
  ) {
    return invalid(path);
  }
  return result;
}

export function parseEmission(value: unknown, path: string): WorkplacePlanningEmission {
  const data = record(value, path);
  const result = Object.freeze({
    emissionEvidenceId: uuid(data.emissionEvidenceId, `${path}.emissionEvidenceId`),
    evidenceKind: enumeration(
      data.evidenceKind,
      new Set<WorkplacePlanningEmissionEvidenceKind>(['METER', 'APPROVED_MODEL']),
      `${path}.evidenceKind`
    ),
    energyValue: number(data.energyValue, `${path}.energyValue`),
    energyUnit: text(data.energyUnit, `${path}.energyUnit`, 24),
    co2eValue: number(data.co2eValue, `${path}.co2eValue`),
    co2eUnit: text(data.co2eUnit, `${path}.co2eUnit`, 24),
    factorVersion: text(data.factorVersion, `${path}.factorVersion`, 120),
    regionCode: text(data.regionCode, `${path}.regionCode`, 80),
    evidenceReference: text(data.evidenceReference, `${path}.evidenceReference`, 320),
    sourceAt: instant(data.sourceAt, `${path}.sourceAt`),
    receivedAt: instant(data.receivedAt, `${path}.receivedAt`),
  });
  return Date.parse(result.sourceAt) <= Date.parse(result.receivedAt) ? result : invalid(path);
}

function clock(value: unknown, path: string) {
  const parsed = text(value, path, 8);
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/u.exec(parsed);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? '00'}` : invalid(path);
}

export function parseDraft(value: unknown, path: string): WorkplacePlanningDraft {
  const data = record(value, path);
  const result = Object.freeze({
    proposedCapacity: integer(data.proposedCapacity, `${path}.proposedCapacity`),
    proposedRoomCapacity: integer(data.proposedRoomCapacity, `${path}.proposedRoomCapacity`),
    proposedAccessibleResourceCount: integer(
      data.proposedAccessibleResourceCount,
      `${path}.proposedAccessibleResourceCount`
    ),
    operatingStart: clock(data.operatingStart, `${path}.operatingStart`),
    operatingEnd: clock(data.operatingEnd, `${path}.operatingEnd`),
    policyReference: nullableText(data.policyReference, `${path}.policyReference`, 320),
    affectedResourceIds: list(data.affectedResourceIds, `${path}.affectedResourceIds`, uuid),
    neighborhoodAllocations: list(
      data.neighborhoodAllocations,
      `${path}.neighborhoodAllocations`,
      (item, itemPath) => {
        const allocation = record(item, itemPath);
        return Object.freeze({
          neighborhood: text(allocation.neighborhood, `${itemPath}.neighborhood`, 120),
          capacity: integer(allocation.capacity, `${itemPath}.capacity`),
        });
      }
    ),
    emissionEvidenceId: nullableUuid(data.emissionEvidenceId, `${path}.emissionEvidenceId`),
  });
  const allocationNames = result.neighborhoodAllocations.map((item) =>
    item.neighborhood.trim().toLowerCase()
  );
  const affectedIds = new Set(result.affectedResourceIds);
  if (
    result.proposedRoomCapacity > result.proposedCapacity ||
    result.proposedAccessibleResourceCount > result.proposedCapacity ||
    result.operatingEnd <= result.operatingStart ||
    new Set(allocationNames).size !== allocationNames.length ||
    affectedIds.size !== result.affectedResourceIds.length ||
    (result.neighborhoodAllocations.length > 0 &&
      result.neighborhoodAllocations.reduce((sum, item) => sum + item.capacity, 0) !==
        result.proposedCapacity)
  ) {
    return invalid(path);
  }
  return result;
}

export function parseComparison(value: unknown, path: string): WorkplacePlanningComparison {
  const data = record(value, path);
  return Object.freeze({
    currentCapacity: integer(data.currentCapacity, `${path}.currentCapacity`),
    proposedCapacity: integer(data.proposedCapacity, `${path}.proposedCapacity`),
    currentRoomCapacity: integer(data.currentRoomCapacity, `${path}.currentRoomCapacity`),
    proposedRoomCapacity: integer(data.proposedRoomCapacity, `${path}.proposedRoomCapacity`),
    currentAccessibleResourceCount: integer(
      data.currentAccessibleResourceCount,
      `${path}.currentAccessibleResourceCount`
    ),
    proposedAccessibleResourceCount: integer(
      data.proposedAccessibleResourceCount,
      `${path}.proposedAccessibleResourceCount`
    ),
    currentUtilizationPercent: nullableNumber(
      data.currentUtilizationPercent,
      `${path}.currentUtilizationPercent`
    ),
    proposedUtilizationPercent: nullableNumber(
      data.proposedUtilizationPercent,
      `${path}.proposedUtilizationPercent`
    ),
    peakDemand: nullableNumber(data.peakDemand, `${path}.peakDemand`),
    currentExcessDemand: nullableNumber(data.currentExcessDemand, `${path}.currentExcessDemand`),
    proposedExcessDemand: nullableNumber(data.proposedExcessDemand, `${path}.proposedExcessDemand`),
    impactedBookingCount: nullableInteger(
      data.impactedBookingCount,
      `${path}.impactedBookingCount`
    ),
  });
}
