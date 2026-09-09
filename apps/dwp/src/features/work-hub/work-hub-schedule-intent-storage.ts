import {
  isExactWorkScheduleCommandIdentity,
  type WorkScheduleCommand,
  type WorkScheduleExecutionGuard,
} from './work-hub-scheduling';

type ScheduleIntentStorage = Pick<Storage, 'getItem' | 'setItem'>;
type StoredScheduleIntent = {
  inputFingerprint: string;
  itemFingerprint: string;
  linkId: string;
  ownerFingerprint: string;
  recordedAt: number;
};
type StoredScheduleIntents = { schema: 1; intents: StoredScheduleIntent[] };

const storageKey = 'dwp.work.schedule-intents.v1';
const ttlMs = 30 * 60 * 1000;
const maxBytes = 16 * 1024;
const maxIntents = 20;
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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

function validIntent(value: unknown, now: number): value is StoredScheduleIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as Partial<StoredScheduleIntent>;
  return (
    Object.keys(intent).length === 5 &&
    Object.keys(intent).every((key) =>
      ['inputFingerprint', 'itemFingerprint', 'linkId', 'ownerFingerprint', 'recordedAt'].includes(
        key
      )
    ) &&
    typeof intent.inputFingerprint === 'string' &&
    fingerprintPattern.test(intent.inputFingerprint) &&
    typeof intent.itemFingerprint === 'string' &&
    fingerprintPattern.test(intent.itemFingerprint) &&
    typeof intent.ownerFingerprint === 'string' &&
    fingerprintPattern.test(intent.ownerFingerprint) &&
    typeof intent.linkId === 'string' &&
    uuidPattern.test(intent.linkId) &&
    Number.isSafeInteger(intent.recordedAt) &&
    (intent.recordedAt as number) >= 0 &&
    (intent.recordedAt as number) <= now
  );
}

function read(storage: ScheduleIntentStorage, now: number): StoredScheduleIntent[] | null {
  try {
    const serialized = storage.getItem(storageKey);
    if (!serialized) return [];
    if (serialized.length > maxBytes) return null;
    const value = JSON.parse(serialized) as Partial<StoredScheduleIntents>;
    if (
      value.schema !== 1 ||
      !Array.isArray(value.intents) ||
      value.intents.length > maxIntents ||
      !value.intents.every((intent) => validIntent(intent, now))
    )
      return null;
    const identities = value.intents.map(
      (intent) => `${intent.ownerFingerprint}:${intent.itemFingerprint}`
    );
    if (new Set(identities).size !== identities.length) return null;
    return value.intents.filter((intent) => now - intent.recordedAt <= ttlMs);
  } catch {
    return null;
  }
}

async function scopeFingerprints(owner: string, itemKey: string) {
  const [ownerFingerprint, itemFingerprint] = await Promise.all([
    fingerprint(owner),
    fingerprint(itemKey),
  ]);
  return { ownerFingerprint, itemFingerprint };
}

function reviewedInput(command: WorkScheduleCommand) {
  const { idempotencyKey, ...input } = command.eventInput;
  void idempotencyKey;
  return JSON.stringify({
    work: {
      sourceSystem: command.work.sourceSystem,
      sourceReference: command.work.sourceReference,
      obligationKey: command.work.obligationKey ?? null,
    },
    reviewedItemSourceId: command.reviewedItemSourceId,
    reviewedItemSourceStatus: command.reviewedItemSourceStatus,
    reviewedItemVersion: command.reviewedItemVersion,
    reviewedItemLifecycle: command.reviewedItemLifecycle,
    eventInput: input,
  });
}

/** Stores only hashes and the server idempotency UUID; no title, time, route, or owner text. */
export async function persistWorkScheduleIntent(
  owner: string,
  itemKey: string,
  command: WorkScheduleCommand,
  storage: ScheduleIntentStorage = window.sessionStorage,
  now = Date.now(),
  guard: WorkScheduleExecutionGuard = {}
): Promise<boolean> {
  const canContinue = () => guard.signal?.aborted !== true && (guard.canContinue?.() ?? true);
  if (!isExactWorkScheduleCommandIdentity(command, itemKey) || !canContinue()) return false;
  const [{ ownerFingerprint, itemFingerprint }, inputFingerprint] = await Promise.all([
    scopeFingerprints(owner, itemKey),
    fingerprint(reviewedInput(command)),
  ]);
  if (!ownerFingerprint || !itemFingerprint || !inputFingerprint || !canContinue()) return false;
  const current = read(storage, now);
  if (!current) return false;
  const retained = current.filter(
    (intent) =>
      intent.ownerFingerprint !== ownerFingerprint || intent.itemFingerprint !== itemFingerprint
  );
  retained.push({
    ownerFingerprint,
    itemFingerprint,
    inputFingerprint,
    linkId: command.linkId,
    recordedAt: now,
  });
  try {
    if (!canContinue()) return false;
    storage.setItem(
      storageKey,
      JSON.stringify({
        schema: 1,
        intents: retained.slice(-maxIntents),
      } satisfies StoredScheduleIntents)
    );
    return true;
  } catch {
    return false;
  }
}

export async function restoreWorkScheduleIntent(
  owner: string,
  itemKey: string,
  storage: ScheduleIntentStorage = window.sessionStorage,
  now = Date.now()
): Promise<{ linkId: string } | null> {
  const { ownerFingerprint, itemFingerprint } = await scopeFingerprints(owner, itemKey);
  if (!ownerFingerprint || !itemFingerprint) return null;
  const current = read(storage, now);
  if (!current) return null;
  const intent = current.find(
    (candidate) =>
      candidate.ownerFingerprint === ownerFingerprint &&
      candidate.itemFingerprint === itemFingerprint
  );
  return intent ? { linkId: intent.linkId } : null;
}

export async function matchWorkScheduleIntent(
  owner: string,
  itemKey: string,
  command: WorkScheduleCommand,
  storage: ScheduleIntentStorage = window.sessionStorage,
  now = Date.now()
): Promise<{ inputMatches: boolean; linkId: string } | null> {
  if (!isExactWorkScheduleCommandIdentity(command, itemKey)) return null;
  const [{ ownerFingerprint, itemFingerprint }, inputFingerprint] = await Promise.all([
    scopeFingerprints(owner, itemKey),
    fingerprint(reviewedInput(command)),
  ]);
  if (!ownerFingerprint || !itemFingerprint || !inputFingerprint) return null;
  const current = read(storage, now);
  if (!current) return null;
  const intent = current.find(
    (candidate) =>
      candidate.ownerFingerprint === ownerFingerprint &&
      candidate.itemFingerprint === itemFingerprint
  );
  return intent
    ? { linkId: intent.linkId, inputMatches: intent.inputFingerprint === inputFingerprint }
    : null;
}

export async function clearWorkScheduleIntent(
  owner: string,
  itemKey: string,
  linkId: string,
  storage: ScheduleIntentStorage = window.sessionStorage,
  now = Date.now()
): Promise<boolean> {
  const { ownerFingerprint, itemFingerprint } = await scopeFingerprints(owner, itemKey);
  if (!ownerFingerprint || !itemFingerprint) return false;
  const current = read(storage, now);
  if (!current) return false;
  const retained = current.filter(
    (intent) =>
      intent.ownerFingerprint !== ownerFingerprint ||
      intent.itemFingerprint !== itemFingerprint ||
      intent.linkId !== linkId
  );
  if (retained.length === current.length) return true;
  try {
    storage.setItem(storageKey, JSON.stringify({ schema: 1, intents: retained }));
    return true;
  } catch {
    // A stale opaque marker can only force idempotent reuse until its short TTL expires.
    return false;
  }
}
