import type {
  PersonalWorkTask,
  PersonalWorkTaskInput,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkHubActionGuard } from './work-hub-actions';
import { isPersonalTaskCreateReceipt } from './work-hub-personal-save-receipt';

export type WorkTaskCreateConfirmation = {
  confirmationId: number;
  planIntent: WorkTaskCreatePlanIntent | null;
  task: PersonalWorkTask;
};

export type WorkTaskCreatePlanIntent = {
  date: string;
  idempotencyKey: string;
};

export type WorkTaskCreateClaim = {
  confirmationId: number;
  claimToken: number;
};

export type WorkTaskSaveCoordinator = {
  owner: string | null;
  runCreate: (
    owner: string,
    input: PersonalWorkTaskInput,
    idempotencyKey: string,
    execute: (
      input: PersonalWorkTaskInput,
      idempotencyKey: string,
      guard: WorkHubActionGuard
    ) => Promise<PersonalWorkTask>,
    planIntent?: WorkTaskCreatePlanIntent | null
  ) => Promise<WorkTaskCreateConfirmation>;
  acknowledgeCreate: (owner: string, claim: WorkTaskCreateClaim) => void;
  claimCreate: (owner: string, confirmationId: number) => WorkTaskCreateClaim | null;
  releaseCreate: (owner: string, claim: WorkTaskCreateClaim) => void;
  confirmedCreates: (owner: string) => readonly WorkTaskCreateConfirmation[];
  mutationKey: (owner: string, fingerprint: string, requestedKey: string) => string;
  acknowledgeMutation: (owner: string, fingerprint: string) => void;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
};

type WorkTaskIntentStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type CreateIntent = {
  confirmationId: number;
  fingerprint: string;
  idempotencyKey: string;
  input: PersonalWorkTaskInput;
  planIntent: WorkTaskCreatePlanIntent | null;
  abort: AbortController;
  active: Promise<WorkTaskCreateConfirmation> | null;
  claimToken: number | null;
  storedIntent: StoredCreateIntent | null;
  storedSource: 'current' | 'legacy' | null;
  legacyStoredValue: string | null;
  task: PersonalWorkTask | null;
};

type StoredCreateIntent = {
  idempotencyKey: string;
  inputFingerprint: string;
  ownerFingerprint: string;
  recordedAt: number;
};

type StoredCreateIntentCollection = {
  entries: StoredCreateIntent[];
  schema: 2;
};

type LegacyStoredCreateIntent = StoredCreateIntent & { schema: 1 };

const CREATE_INTENTS_STORAGE_KEY = 'dwp.work.personal-create-intents.v2';
const LEGACY_CREATE_INTENT_STORAGE_KEY = 'dwp.work.personal-create-intent.v1';
const CREATE_INTENT_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_CREATE_INTENTS = 8;
const MAX_STORED_CREATE_INTENTS_BYTES = 8192;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function cloneReference(reference: PersonalWorkTaskInput['sourceReference']) {
  return reference ? { ...reference } : reference;
}

function cloneInput(input: PersonalWorkTaskInput): PersonalWorkTaskInput {
  return {
    ...input,
    sourceReference: cloneReference(input.sourceReference),
    sourceReferences:
      input.sourceReferences?.map((reference) => ({ ...reference })) ?? input.sourceReferences,
    checklist: input.checklist?.map((item) => ({ ...item })) ?? input.checklist,
  };
}

function inputFingerprint(input: PersonalWorkTaskInput): string {
  const reference = (value: PersonalWorkTaskInput['sourceReference']) =>
    value
      ? {
          sourceSystem: value.sourceSystem,
          sourceReference: value.sourceReference,
          obligationKey: value.obligationKey ?? null,
        }
      : value;
  return JSON.stringify({
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    dueAt: input.dueAt ?? null,
    sourceReference: reference(input.sourceReference ?? null),
    clearSourceReference: input.clearSourceReference === true,
    checklist:
      input.checklist && input.checklist.length > 0
        ? input.checklist.map((item) => ({
            itemId: item.itemId,
            title: item.title,
            completed: item.completed,
          }))
        : null,
    sourceReferences:
      input.sourceReferences && input.sourceReferences.length > 0
        ? input.sourceReferences.map(reference)
        : null,
  });
}

async function sha256(value: string): Promise<string | null> {
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

function validStoredIntentShape(value: unknown): value is StoredCreateIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as Partial<StoredCreateIntent>;
  return (
    Object.keys(intent).length === 4 &&
    typeof intent.idempotencyKey === 'string' &&
    UUID.test(intent.idempotencyKey) &&
    typeof intent.inputFingerprint === 'string' &&
    SHA256.test(intent.inputFingerprint) &&
    typeof intent.ownerFingerprint === 'string' &&
    SHA256.test(intent.ownerFingerprint) &&
    Number.isSafeInteger(intent.recordedAt)
  );
}

function storedIntentIsFresh(intent: StoredCreateIntent, now: number) {
  return intent.recordedAt <= now && now - intent.recordedAt <= CREATE_INTENT_TTL_MS;
}

function sameStoredIntent(left: StoredCreateIntent, right: StoredCreateIntent) {
  return (
    left.idempotencyKey === right.idempotencyKey &&
    left.inputFingerprint === right.inputFingerprint &&
    left.ownerFingerprint === right.ownerFingerprint &&
    left.recordedAt === right.recordedAt
  );
}

function writeStoredIntentCollection(
  storage: WorkTaskIntentStorage,
  entries: readonly StoredCreateIntent[]
) {
  if (entries.length === 0) {
    storage.removeItem(CREATE_INTENTS_STORAGE_KEY);
    return;
  }
  const value: StoredCreateIntentCollection = { entries: [...entries], schema: 2 };
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_STORED_CREATE_INTENTS_BYTES)
    throw new Error('Create intent store full');
  storage.setItem(CREATE_INTENTS_STORAGE_KEY, serialized);
}

function readStoredIntentCollection(storage: WorkTaskIntentStorage, now: number) {
  try {
    const serialized = storage.getItem(CREATE_INTENTS_STORAGE_KEY);
    if (!serialized) return [];
    if (serialized.length > MAX_STORED_CREATE_INTENTS_BYTES) {
      if (storage.getItem(CREATE_INTENTS_STORAGE_KEY) === serialized)
        storage.removeItem(CREATE_INTENTS_STORAGE_KEY);
      return [];
    }
    const value = JSON.parse(serialized) as unknown;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 2 ||
      (value as Partial<StoredCreateIntentCollection>).schema !== 2 ||
      !Array.isArray((value as Partial<StoredCreateIntentCollection>).entries) ||
      (value as StoredCreateIntentCollection).entries.length > MAX_STORED_CREATE_INTENTS ||
      !(value as StoredCreateIntentCollection).entries.every(validStoredIntentShape)
    ) {
      if (storage.getItem(CREATE_INTENTS_STORAGE_KEY) === serialized)
        storage.removeItem(CREATE_INTENTS_STORAGE_KEY);
      return [];
    }
    const entries = (value as StoredCreateIntentCollection).entries.filter((entry) =>
      storedIntentIsFresh(entry, now)
    );
    if (entries.length !== (value as StoredCreateIntentCollection).entries.length) {
      try {
        if (storage.getItem(CREATE_INTENTS_STORAGE_KEY) === serialized) {
          writeStoredIntentCollection(storage, entries);
        }
      } catch {
        // Valid fresh identities remain usable when best-effort expiry cleanup cannot be written.
      }
    }
    return entries;
  } catch {
    return [];
  }
}

function readLegacyStoredIntent(storage: WorkTaskIntentStorage, now: number) {
  let serialized: string | null = null;
  try {
    serialized = storage.getItem(LEGACY_CREATE_INTENT_STORAGE_KEY);
    if (!serialized) return null;
    const removeInvalid = () => {
      if (storage.getItem(LEGACY_CREATE_INTENT_STORAGE_KEY) === serialized) {
        storage.removeItem(LEGACY_CREATE_INTENT_STORAGE_KEY);
      }
    };
    if (serialized.length > 1024) {
      removeInvalid();
      return null;
    }
    const value = JSON.parse(serialized) as unknown;
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 5 ||
      (value as Partial<LegacyStoredCreateIntent>).schema !== 1
    ) {
      removeInvalid();
      return null;
    }
    const { schema: _schema, ...intent } = value as LegacyStoredCreateIntent;
    if (!validStoredIntentShape(intent) || !storedIntentIsFresh(intent, now)) {
      removeInvalid();
      return null;
    }
    return { intent, serialized };
  } catch {
    try {
      if (serialized !== null && storage.getItem(LEGACY_CREATE_INTENT_STORAGE_KEY) === serialized) {
        storage.removeItem(LEGACY_CREATE_INTENT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage implementations that stop responding while validating legacy state.
    }
    return null;
  }
}

function storeCreateIntent(storage: WorkTaskIntentStorage, intent: StoredCreateIntent) {
  const entries = readStoredIntentCollection(storage, intent.recordedAt).filter(
    (candidate) =>
      candidate.ownerFingerprint !== intent.ownerFingerprint ||
      candidate.inputFingerprint !== intent.inputFingerprint
  );
  writeStoredIntentCollection(
    storage,
    [intent, ...entries]
      .sort((left, right) => right.recordedAt - left.recordedAt)
      .slice(0, MAX_STORED_CREATE_INTENTS)
  );
}

function removeStoredCreateIntent(storage: WorkTaskIntentStorage, intent: StoredCreateIntent) {
  const entries = readStoredIntentCollection(storage, Date.now());
  writeStoredIntentCollection(
    storage,
    entries.filter((candidate) => !sameStoredIntent(candidate, intent))
  );
}

function defaultStorage(): WorkTaskIntentStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Keeps exact input in WorkLayout memory and only opaque retry identity in session storage. */
export function createWorkTaskSaveCoordinator(
  owner: string | null,
  storage: WorkTaskIntentStorage | undefined = defaultStorage()
): WorkTaskSaveCoordinator {
  let disposed = false;
  let sequence = 0;
  let claimSequence = 0;
  const intents = new Map<string, CreateIntent>();
  const mutationKeys = new Map<string, string>();
  const listeners = new Set<() => void>();
  const noConfirmations = [] as const;
  let confirmations: readonly WorkTaskCreateConfirmation[] = [];
  const publishConfirmations = (deferListeners = false) => {
    confirmations = [...intents.values()].flatMap((intent) =>
      intent.task && intent.claimToken === null
        ? [
            {
              confirmationId: intent.confirmationId,
              planIntent: intent.planIntent,
              task: intent.task,
            },
          ]
        : []
    );
    const publish = () => {
      if (!disposed) listeners.forEach((listener) => listener());
    };
    if (deferListeners) globalThis.setTimeout(publish, 0);
    else publish();
  };

  return {
    owner,
    async runCreate(requestOwner, submitted, requestedKey, execute, requestedPlanIntent = null) {
      if (disposed || !owner || owner !== requestOwner)
        throw new DOMException('Work owner changed', 'AbortError');
      const fingerprint = inputFingerprint(submitted);
      let intent = intents.get(fingerprint);
      if (!intent) {
        intent = {
          confirmationId: ++sequence,
          fingerprint,
          idempotencyKey: requestedKey,
          input: cloneInput(submitted),
          planIntent: requestedPlanIntent ? { ...requestedPlanIntent } : null,
          abort: new AbortController(),
          active: null,
          claimToken: null,
          storedIntent: null,
          storedSource: null,
          legacyStoredValue: null,
          task: null,
        };
        intents.set(fingerprint, intent);
      }
      if (intent.task) {
        return {
          confirmationId: intent.confirmationId,
          planIntent: intent.planIntent,
          task: intent.task,
        };
      }
      if (intent.active) return intent.active;
      const current = intent;
      current.abort = new AbortController();
      const canContinue = () =>
        !disposed &&
        owner === requestOwner &&
        intents.get(current.fingerprint) === current &&
        !current.abort.signal.aborted;
      current.active = (async () => {
        const [ownerFingerprint, submittedFingerprint] = await Promise.all([
          sha256(requestOwner),
          sha256(current.fingerprint),
        ]);
        if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
        if (storage && ownerFingerprint && submittedFingerprint) {
          const now = Date.now();
          const stored = readStoredIntentCollection(storage, now).find(
            (candidate) =>
              candidate.ownerFingerprint === ownerFingerprint &&
              candidate.inputFingerprint === submittedFingerprint
          );
          const legacy = stored ? null : readLegacyStoredIntent(storage, now);
          if (stored) {
            current.idempotencyKey = stored.idempotencyKey;
            current.storedIntent = stored;
            current.storedSource = 'current';
          } else if (
            legacy?.intent.ownerFingerprint === ownerFingerprint &&
            legacy.intent.inputFingerprint === submittedFingerprint
          ) {
            current.idempotencyKey = legacy.intent.idempotencyKey;
            current.storedIntent = legacy.intent;
            current.storedSource = 'legacy';
            current.legacyStoredValue = legacy.serialized;
          } else if (UUID.test(current.idempotencyKey)) {
            const value: StoredCreateIntent = {
              idempotencyKey: current.idempotencyKey,
              inputFingerprint: submittedFingerprint,
              ownerFingerprint,
              recordedAt: now,
            };
            try {
              storeCreateIntent(storage, value);
              current.storedIntent = value;
              current.storedSource = 'current';
            } catch {
              // In-memory coordination remains available when session storage is unavailable.
            }
          }
        }
        return execute(current.input, current.idempotencyKey, {
          signal: current.abort.signal,
          canContinue,
        });
      })()
        .then((task) => {
          if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
          if (!isPersonalTaskCreateReceipt(task, current.input)) {
            throw new Error('Unverified personal task creation receipt');
          }
          current.task = task;
          // Promise consumers get the first claim opportunity. A prior route's consumer releases
          // synchronously when stale, allowing the remounted page or its subscriber to take over.
          publishConfirmations(true);
          return {
            confirmationId: current.confirmationId,
            planIntent: current.planIntent,
            task,
          };
        })
        .finally(() => {
          if (intents.get(current.fingerprint) === current) current.active = null;
        });
      return current.active;
    },
    acknowledgeCreate(requestOwner, claim) {
      if (disposed || owner !== requestOwner) return;
      for (const [fingerprint, intent] of intents) {
        if (
          intent.confirmationId === claim.confirmationId &&
          intent.claimToken === claim.claimToken &&
          intent.task
        ) {
          intents.delete(fingerprint);
          if (storage && intent.storedIntent) {
            try {
              if (intent.storedSource === 'current') {
                removeStoredCreateIntent(storage, intent.storedIntent);
              } else if (
                intent.storedSource === 'legacy' &&
                intent.legacyStoredValue &&
                storage.getItem(LEGACY_CREATE_INTENT_STORAGE_KEY) === intent.legacyStoredValue
              ) {
                storage.removeItem(LEGACY_CREATE_INTENT_STORAGE_KEY);
              }
            } catch {
              // The confirmed in-memory receipt has still been consumed safely.
            }
          }
          publishConfirmations();
          return;
        }
      }
    },
    claimCreate(requestOwner, confirmationId) {
      if (disposed || owner !== requestOwner) return null;
      const intent = [...intents.values()].find(
        (candidate) => candidate.confirmationId === confirmationId && candidate.task
      );
      if (!intent || intent.claimToken !== null) return null;
      const claim = { confirmationId, claimToken: ++claimSequence };
      intent.claimToken = claim.claimToken;
      publishConfirmations();
      return claim;
    },
    releaseCreate(requestOwner, claim) {
      if (disposed || owner !== requestOwner) return;
      const intent = [...intents.values()].find(
        (candidate) =>
          candidate.confirmationId === claim.confirmationId &&
          candidate.claimToken === claim.claimToken &&
          candidate.task
      );
      if (!intent) return;
      intent.claimToken = null;
      publishConfirmations();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const intent of intents.values()) intent.abort.abort();
      intents.clear();
      mutationKeys.clear();
      confirmations = [];
      listeners.clear();
    },
    confirmedCreates(requestOwner) {
      return !disposed && owner === requestOwner ? confirmations : noConfirmations;
    },
    mutationKey(requestOwner, fingerprint, requestedKey) {
      if (disposed || !owner || owner !== requestOwner || !fingerprint) {
        throw new DOMException('Work owner changed', 'AbortError');
      }
      const existing = mutationKeys.get(fingerprint);
      if (existing) return existing;
      mutationKeys.set(fingerprint, requestedKey);
      return requestedKey;
    },
    acknowledgeMutation(requestOwner, fingerprint) {
      if (disposed || owner !== requestOwner) return;
      mutationKeys.delete(fingerprint);
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
