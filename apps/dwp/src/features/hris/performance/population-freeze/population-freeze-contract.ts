import { Temporal } from 'temporal-polyfill';

export const PERFORMANCE_POPULATION_FREEZE_ROUTE_CONTRACT =
  'route.hcm.operations.performance-population-freeze.action' as const;
export const PERFORMANCE_POPULATION_FREEZE_CAPABILITY =
  'hcm.operations.performance.freeze' as const;

export type FreezePerformancePopulationCommand = Readonly<{
  commandId: string;
  expectedCycleRevision: number;
  populationPreviewId: string;
  populationRuleId: string;
  workforceSnapshotId: string;
  workforceSnapshotRevision: number;
  previewContentHash: string;
  reason: string;
}>;

export type PerformancePopulationFreeze = Readonly<{
  populationFreezeId: string;
  cycleId: string;
  cycleVersionId: string;
  populationPreviewId: string;
  populationRuleVersionId: string;
  workforceSnapshotId: string;
  workforceSnapshotRevision: number;
  sourceCycleAggregateVersion: number;
  state: 'FROZEN';
  participantCount: number;
  reviewerAssignmentCount: number;
  contentHash: string;
  aggregateVersion: 1;
  frozenAt: string;
}>;

export type PerformancePopulationFreezeReceipt = Readonly<{
  receiptId: string;
  commandType: 'FREEZE_POPULATION';
  originatingAction: 'performance.population.freeze';
  aggregateId: string;
  expectedAggregateVersion: number;
  appliedAggregateVersion: number | null;
  state: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN' | 'QUARANTINED';
  resultRef: string | null;
  errorCode: string | null;
  acceptedAt: string;
  completedAt: string | null;
}>;

export type PerformancePopulationFreezeResult = Readonly<{
  freeze: PerformancePopulationFreeze | null;
  receipt: PerformancePopulationFreezeReceipt;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256 = /^[0-9a-f]{64}$/;
const RECEIPT_STATES = new Set<PerformancePopulationFreezeReceipt['state']>([
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
  'QUARANTINED',
]);

function invalid(): never {
  throw new Error('Performance population-freeze source payload is invalid.');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    [...value].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point <= 0x1f || point === 0x7f);
    })
  ) {
    return invalid();
  }
  return value;
}

function uuid(value: unknown): string {
  const candidate = text(value, 36);
  return UUID.test(candidate) ? candidate : invalid();
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuid(value);
}

function integer(value: unknown, minimum = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
    ? value
    : invalid();
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}

function sha256(value: unknown): string {
  const candidate = text(value, 64);
  return SHA_256.test(candidate) ? candidate : invalid();
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalid();
  }
}

function nullableInstant(value: unknown): string | null {
  return value === null ? null : instant(value);
}

function nullableText(value: unknown, maximum: number): string | null {
  return value === null ? null : text(value, maximum);
}

function freeze(value: unknown): PerformancePopulationFreeze {
  const source = record(value);
  if (source.state !== 'FROZEN' || source.aggregateVersion !== 1) return invalid();
  return Object.freeze({
    populationFreezeId: uuid(source.populationFreezeId),
    cycleId: uuid(source.cycleId),
    cycleVersionId: uuid(source.cycleVersionId),
    populationPreviewId: uuid(source.populationPreviewId),
    populationRuleVersionId: uuid(source.populationRuleVersionId),
    workforceSnapshotId: uuid(source.workforceSnapshotId),
    workforceSnapshotRevision: integer(source.workforceSnapshotRevision, 1),
    sourceCycleAggregateVersion: integer(source.sourceCycleAggregateVersion),
    state: 'FROZEN',
    participantCount: integer(source.participantCount),
    reviewerAssignmentCount: integer(source.reviewerAssignmentCount),
    contentHash: sha256(source.contentHash),
    aggregateVersion: 1,
    frozenAt: instant(source.frozenAt),
  });
}

export function parsePerformancePopulationFreezeReceipt(
  value: unknown
): PerformancePopulationFreezeReceipt {
  const source = record(value);
  const state = text(source.state, 24) as PerformancePopulationFreezeReceipt['state'];
  if (
    source.commandType !== 'FREEZE_POPULATION' ||
    source.originatingAction !== 'performance.population.freeze' ||
    !RECEIPT_STATES.has(state)
  ) {
    return invalid();
  }
  const receipt: PerformancePopulationFreezeReceipt = Object.freeze({
    receiptId: uuid(source.receiptId),
    commandType: 'FREEZE_POPULATION',
    originatingAction: 'performance.population.freeze',
    aggregateId: uuid(source.aggregateId),
    expectedAggregateVersion: integer(source.expectedAggregateVersion),
    appliedAggregateVersion: nullableInteger(source.appliedAggregateVersion),
    state,
    resultRef: nullableUuid(source.resultRef),
    errorCode: nullableText(source.errorCode, 100),
    acceptedAt: instant(source.acceptedAt),
    completedAt: nullableInstant(source.completedAt),
  });
  const terminal = ['SUCCEEDED', 'FAILED', 'QUARANTINED'].includes(receipt.state);
  if (
    terminal !== (receipt.completedAt !== null) ||
    (receipt.completedAt !== null &&
      Temporal.Instant.compare(receipt.acceptedAt, receipt.completedAt) > 0) ||
    (receipt.state === 'SUCCEEDED' &&
      (receipt.resultRef === null ||
        receipt.appliedAggregateVersion !== 1 ||
        receipt.errorCode !== null)) ||
    ((receipt.state === 'FAILED' || receipt.state === 'QUARANTINED') && receipt.errorCode === null)
  ) {
    return invalid();
  }
  return receipt;
}

export function parsePerformancePopulationFreezeResult(
  value: unknown
): PerformancePopulationFreezeResult {
  const source = record(value);
  const parsedFreeze = source.freeze === null ? null : freeze(source.freeze);
  const receipt = parsePerformancePopulationFreezeReceipt(source.receipt);
  if (
    receipt.state === 'SUCCEEDED' &&
    (!parsedFreeze ||
      receipt.resultRef !== parsedFreeze.populationFreezeId ||
      receipt.aggregateId !== parsedFreeze.cycleId ||
      receipt.expectedAggregateVersion !== parsedFreeze.sourceCycleAggregateVersion)
  ) {
    return invalid();
  }
  if (parsedFreeze && receipt.state !== 'SUCCEEDED') return invalid();
  return Object.freeze({ freeze: parsedFreeze, receipt });
}
