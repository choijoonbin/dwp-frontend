import type {
  WorkHubBatchCommandKind,
  WorkHubBatchReceipt,
  WorkHubBatchReviewedCommand,
  WorkHubBatchTarget,
} from './work-hub-batch-execution';
import type { WorkHubItem, WorkHubLifecycle } from './work-hub-contracts';

type WorkHubBatchReceiptState = WorkHubBatchReceipt['state'];
type WorkHubSessionStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type StoredWorkHubBatchReceipt = {
  commandKind: WorkHubBatchCommandKind | null;
  idempotencyKey: string;
  itemFingerprint: string;
  reason?: 'CANCELLED';
  reviewedLifecycle: WorkHubLifecycle;
  reviewedVersion: number;
  state: WorkHubBatchReceiptState;
  version?: number;
};

type StoredWorkHubBatchReport = {
  ownerFingerprint: string;
  phase: 'PREFLIGHT' | 'FINAL';
  receipts: StoredWorkHubBatchReceipt[];
  recordedAt: number;
  runId: string;
  schema: 3;
  target: WorkHubBatchTarget;
};

export type RestoredWorkHubBatchReport = {
  receipts: WorkHubBatchReceipt[];
  target: WorkHubBatchTarget;
};

const BATCH_REPORT_STORAGE_KEY = 'dwp.work.batch-report.v3';
const LEGACY_BATCH_REPORT_STORAGE_KEYS = [
  'dwp.work.batch-report.v2',
  'dwp.work.batch-report.v1',
] as const;
export const WORK_HUB_BATCH_REPORT_UPDATED_EVENT = 'dwp:work-batch-report-updated';
const BATCH_REPORT_TTL_MS = 30 * 60 * 1000;
const BATCH_REPORT_MAX_BYTES = 64 * 1024;
const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RECEIPT_STATES = new Set<WorkHubBatchReceiptState>([
  'CONFIRMED',
  'CONFLICT',
  'FORBIDDEN',
  'UNKNOWN',
  'EXCLUDED',
]);
const COMMAND_KINDS = new Set<WorkHubBatchCommandKind>([
  'PERSONAL_START',
  'PERSONAL_COMPLETE',
  'WORKSPACE_START',
  'WORKSPACE_COMPLETE',
]);
const LIFECYCLES = new Set<WorkHubLifecycle>([
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length <= allowed.length && keys.every((key) => allowed.includes(key));
}

async function fingerprint(value: string): Promise<string | null> {
  if (!value || !globalThis.crypto?.subtle) return null;
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    );
    return `sha256:${[...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  } catch {
    return null;
  }
}

function commandMatchesTarget(
  commandKind: WorkHubBatchCommandKind | null,
  target: WorkHubBatchTarget
): boolean {
  return (
    commandKind === null ||
    commandKind === (target === 'COMPLETED' ? 'PERSONAL_COMPLETE' : 'PERSONAL_START') ||
    commandKind === (target === 'COMPLETED' ? 'WORKSPACE_COMPLETE' : 'WORKSPACE_START')
  );
}

function validStoredReceipt(
  value: unknown,
  target: WorkHubBatchTarget
): value is StoredWorkHubBatchReceipt {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      'commandKind',
      'idempotencyKey',
      'itemFingerprint',
      'reason',
      'reviewedLifecycle',
      'reviewedVersion',
      'state',
      'version',
    ]) ||
    (value.commandKind !== null &&
      (typeof value.commandKind !== 'string' ||
        !COMMAND_KINDS.has(value.commandKind as WorkHubBatchCommandKind))) ||
    !commandMatchesTarget(value.commandKind as WorkHubBatchCommandKind | null, target) ||
    typeof value.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY_PATTERN.test(value.idempotencyKey) ||
    typeof value.itemFingerprint !== 'string' ||
    !FINGERPRINT_PATTERN.test(value.itemFingerprint) ||
    typeof value.reviewedLifecycle !== 'string' ||
    !LIFECYCLES.has(value.reviewedLifecycle as WorkHubLifecycle) ||
    !Number.isSafeInteger(value.reviewedVersion) ||
    (value.reviewedVersion as number) < 0 ||
    typeof value.state !== 'string' ||
    !RECEIPT_STATES.has(value.state as WorkHubBatchReceiptState)
  )
    return false;
  if (value.reason !== undefined && value.reason !== 'CANCELLED') return false;
  if (
    value.version !== undefined &&
    (!Number.isSafeInteger(value.version) || (value.version as number) < 0)
  )
    return false;
  if (value.state === 'CONFIRMED' ? value.version === undefined : value.version !== undefined)
    return false;
  if (value.state === 'CONFIRMED' && (value.version as number) <= (value.reviewedVersion as number))
    return false;
  if (value.commandKind === null && value.state !== 'EXCLUDED') return false;
  if (value.reason === 'CANCELLED' && value.state !== 'UNKNOWN' && value.state !== 'EXCLUDED')
    return false;
  return true;
}

function parseStoredReport(value: string, now: number): StoredWorkHubBatchReport | null {
  if (!Number.isSafeInteger(now) || now < 0 || value.length > BATCH_REPORT_MAX_BYTES) return null;
  try {
    const report = JSON.parse(value) as unknown;
    if (
      !isRecord(report) ||
      !hasOnlyKeys(report, [
        'ownerFingerprint',
        'phase',
        'receipts',
        'recordedAt',
        'runId',
        'schema',
        'target',
      ]) ||
      report.schema !== 3 ||
      typeof report.ownerFingerprint !== 'string' ||
      !FINGERPRINT_PATTERN.test(report.ownerFingerprint) ||
      (report.phase !== 'PREFLIGHT' && report.phase !== 'FINAL') ||
      typeof report.runId !== 'string' ||
      !IDEMPOTENCY_KEY_PATTERN.test(report.runId) ||
      (report.target !== 'IN_PROGRESS' && report.target !== 'COMPLETED') ||
      !Number.isSafeInteger(report.recordedAt) ||
      (report.recordedAt as number) > now ||
      now - (report.recordedAt as number) > BATCH_REPORT_TTL_MS ||
      !Array.isArray(report.receipts) ||
      report.receipts.length === 0 ||
      report.receipts.length > 50 ||
      !report.receipts.every((receipt) =>
        validStoredReceipt(receipt, report.target as WorkHubBatchTarget)
      )
    )
      return null;
    const fingerprints = report.receipts.map((receipt) => receipt.itemFingerprint);
    const idempotencyKeys = report.receipts.map((receipt) => receipt.idempotencyKey);
    if (
      new Set(fingerprints).size !== fingerprints.length ||
      new Set(idempotencyKeys).size !== idempotencyKeys.length
    )
      return null;
    return report as StoredWorkHubBatchReport;
  } catch {
    return null;
  }
}

function removeStoredReport(
  storage: WorkHubSessionStorage,
  expectedValue?: string,
  key = BATCH_REPORT_STORAGE_KEY
): void {
  try {
    if (expectedValue !== undefined && storage.getItem(key) !== expectedValue) return;
    storage.removeItem(key);
  } catch {
    // Storage is optional. Invalid or stale data still never reaches application state.
  }
}

export function clearWorkHubBatchReport(
  storage: WorkHubSessionStorage = window.sessionStorage
): void {
  removeStoredReport(storage);
  for (const key of LEGACY_BATCH_REPORT_STORAGE_KEYS) removeStoredReport(storage, undefined, key);
}

function storedReceipt(
  receipt: WorkHubBatchReceipt,
  itemFingerprint: string
): StoredWorkHubBatchReceipt {
  return {
    commandKind: receipt.reviewedCommand.kind,
    idempotencyKey: receipt.idempotencyKey,
    itemFingerprint,
    reviewedLifecycle: receipt.reviewedCommand.lifecycle,
    reviewedVersion: receipt.reviewedCommand.version,
    state: receipt.state,
    ...(receipt.version === undefined ? {} : { version: receipt.version }),
    ...(receipt.reason === undefined ? {} : { reason: receipt.reason }),
  };
}

function reviewedCommandMatchesStored(
  reviewedCommand: WorkHubBatchReviewedCommand,
  stored: StoredWorkHubBatchReceipt
): boolean {
  return (
    reviewedCommand.kind === stored.commandKind &&
    reviewedCommand.lifecycle === stored.reviewedLifecycle &&
    reviewedCommand.version === stored.reviewedVersion
  );
}

function commandMatchesCurrentItem(
  commandKind: WorkHubBatchCommandKind | null,
  item: WorkHubItem
): boolean {
  if (item.reference.sourceSystem === 'WORK_ASSIGNMENT') return false;
  if (commandKind === null) return true;
  if (commandKind === 'PERSONAL_START' || commandKind === 'PERSONAL_COMPLETE')
    return item.reference.sourceSystem === 'PERSONAL_TASK';
  return item.reference.sourceSystem !== 'PERSONAL_TASK' && Boolean(item.legacyItem);
}

/**
 * Stores only opaque receipt metadata. Work titles, summaries, routes, source payloads, and the
 * raw tenant/user/permission owner are deliberately excluded.
 */
export async function persistWorkHubBatchReport(
  owner: string,
  target: WorkHubBatchTarget,
  runId: string,
  receipts: readonly WorkHubBatchReceipt[],
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now(),
  canPersist: () => boolean = () => true
): Promise<boolean> {
  if (
    !owner ||
    (target !== 'IN_PROGRESS' && target !== 'COMPLETED') ||
    !IDEMPOTENCY_KEY_PATTERN.test(runId) ||
    receipts.length === 0 ||
    receipts.length > 50 ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    return false;
  const ownerFingerprint = await fingerprint(owner);
  const itemFingerprints = await Promise.all(
    receipts.map((receipt) => fingerprint(receipt.item.key))
  );
  if (!ownerFingerprint || itemFingerprints.some((value) => value === null)) return false;
  const storedReceipts = receipts.map((receipt, index) =>
    storedReceipt(receipt, itemFingerprints[index]!)
  );
  if (
    !storedReceipts.every((receipt) => validStoredReceipt(receipt, target)) ||
    new Set(itemFingerprints).size !== itemFingerprints.length ||
    new Set(storedReceipts.map((receipt) => receipt.idempotencyKey)).size !== storedReceipts.length
  )
    return false;
  const report: StoredWorkHubBatchReport = {
    ownerFingerprint,
    phase: 'PREFLIGHT',
    receipts: storedReceipts,
    recordedAt: now,
    runId,
    schema: 3,
    target,
  };
  const serialized = JSON.stringify(report);
  if (serialized.length > BATCH_REPORT_MAX_BYTES || !canPersist()) return false;
  try {
    storage.setItem(BATCH_REPORT_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replaces one preflight report with its terminal receipts only when the stored identity still
 * belongs to that exact run. This lets a route-unmounted run retain evidence without overwriting a
 * newer owner or a newer batch opened in another Work view.
 */
export async function finalizeWorkHubBatchReport(
  owner: string,
  target: WorkHubBatchTarget,
  runId: string,
  preflight: readonly WorkHubBatchReceipt[],
  receipts: readonly WorkHubBatchReceipt[],
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now()
): Promise<boolean> {
  if (preflight.length !== receipts.length || preflight.length === 0) return false;
  let expectedValue: string | null = null;
  try {
    expectedValue = storage.getItem(BATCH_REPORT_STORAGE_KEY);
  } catch {
    return false;
  }
  if (!expectedValue) return false;
  const current = parseStoredReport(expectedValue, now);
  const ownerFingerprint = await fingerprint(owner);
  const itemFingerprints = await Promise.all(
    preflight.map((receipt) => fingerprint(receipt.item.key))
  );
  if (
    !current ||
    !ownerFingerprint ||
    current.ownerFingerprint !== ownerFingerprint ||
    current.phase !== 'PREFLIGHT' ||
    current.runId !== runId ||
    current.target !== target ||
    itemFingerprints.some((value) => value === null) ||
    current.receipts.length !== preflight.length
  )
    return false;
  for (let index = 0; index < preflight.length; index += 1) {
    const expected = preflight[index]!;
    const stored = current.receipts[index]!;
    const result = receipts[index]!;
    if (
      stored.itemFingerprint !== itemFingerprints[index] ||
      stored.idempotencyKey !== expected.idempotencyKey ||
      !reviewedCommandMatchesStored(expected.reviewedCommand, stored) ||
      stored.state !== expected.state ||
      stored.version !== expected.version ||
      stored.reason !== expected.reason ||
      result.item.key !== expected.item.key ||
      result.idempotencyKey !== expected.idempotencyKey ||
      !reviewedCommandMatchesStored(result.reviewedCommand, stored)
    )
      return false;
  }
  const storedReceipts = receipts.map((receipt, index) => ({
    ...storedReceipt(receipt, itemFingerprints[index]!),
    commandKind: current.receipts[index]!.commandKind,
    reviewedLifecycle: current.receipts[index]!.reviewedLifecycle,
    reviewedVersion: current.receipts[index]!.reviewedVersion,
  }));
  if (!storedReceipts.every((receipt) => validStoredReceipt(receipt, target))) return false;
  const serialized = JSON.stringify({
    ownerFingerprint,
    phase: 'FINAL',
    receipts: storedReceipts,
    recordedAt: now,
    runId,
    schema: 3,
    target,
  } satisfies StoredWorkHubBatchReport);
  if (serialized.length > BATCH_REPORT_MAX_BYTES) return false;
  try {
    if (storage.getItem(BATCH_REPORT_STORAGE_KEY) !== expectedValue) return false;
    storage.setItem(BATCH_REPORT_STORAGE_KEY, serialized);
    globalThis.dispatchEvent?.(new Event(WORK_HUB_BATCH_REPORT_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Rehydrates receipt rows exclusively from the caller's current authorized Work snapshot. */
export async function restoreWorkHubBatchReport(
  owner: string,
  items: readonly WorkHubItem[],
  storage: WorkHubSessionStorage = window.sessionStorage,
  now = Date.now(),
  discardWhenNoAuthorizedItem = true
): Promise<RestoredWorkHubBatchReport | null> {
  let value: string | null = null;
  try {
    value = storage.getItem(BATCH_REPORT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!value) {
    for (const key of LEGACY_BATCH_REPORT_STORAGE_KEYS) removeStoredReport(storage, undefined, key);
    return null;
  }
  if (!owner) return null;
  const report = parseStoredReport(value, now);
  if (!report) {
    removeStoredReport(storage, value);
    return null;
  }
  const ownerFingerprint = await fingerprint(owner);
  if (!ownerFingerprint || ownerFingerprint !== report.ownerFingerprint) {
    removeStoredReport(storage, value);
    return null;
  }
  const current = await Promise.all(
    items.map(async (item) => ({ fingerprint: await fingerprint(item.key), item }))
  );
  if (current.some(({ fingerprint: value }) => value === null)) return null;
  const authorizedItems = new Map(
    current.map(({ fingerprint: value, item }) => [value!, item] as const)
  );
  const receipts = report.receipts.flatMap<WorkHubBatchReceipt>((receipt) => {
    const item = authorizedItems.get(receipt.itemFingerprint);
    return item && commandMatchesCurrentItem(receipt.commandKind, item)
      ? [
          {
            item,
            state: receipt.state,
            idempotencyKey: receipt.idempotencyKey,
            reviewedCommand: {
              kind: receipt.commandKind,
              lifecycle: receipt.reviewedLifecycle,
              version: receipt.reviewedVersion,
            },
            ...(receipt.version === undefined ? {} : { version: receipt.version }),
            ...(receipt.reason === undefined ? {} : { reason: receipt.reason }),
          },
        ]
      : [];
  });
  if (!discardWhenNoAuthorizedItem && receipts.length !== report.receipts.length) return null;
  if (!receipts.length) {
    if (discardWhenNoAuthorizedItem) removeStoredReport(storage, value);
    return null;
  }
  return { receipts, target: report.target };
}
