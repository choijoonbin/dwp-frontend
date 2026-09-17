import { parseWorkplaceConnectorReplayPreview } from '@dwp-frontend/shared-utils';

import type {
  WorkplaceConnectorKind,
  WorkplaceConnectorReplayPreview,
  WorkplaceConnectorReplayStartInput,
} from '@dwp-frontend/shared-utils';

const STORAGE_PREFIX = 'dwp.workplace.connector-replay-command.v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,160}$/u;

type ReplayCommandStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type FrozenWorkplaceConnectorReplayCommand = Readonly<{
  kind: WorkplaceConnectorKind;
  preview: WorkplaceConnectorReplayPreview;
  input: WorkplaceConnectorReplayStartInput;
  idempotencyKey: string;
  correlationId: string;
}>;

type WorkplaceConnectorReplayCommandDraft = Readonly<{
  kind: WorkplaceConnectorKind;
  preview: WorkplaceConnectorReplayPreview;
  input: WorkplaceConnectorReplayStartInput;
  idempotencyKey: string;
  correlationId: string;
}>;

function storageKey(scope: string, kind: WorkplaceConnectorKind) {
  return `${STORAGE_PREFIX}:${scope}:${kind}`;
}

function browserStorage(): ReplayCommandStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function parseCommand(value: unknown, kind: WorkplaceConnectorKind) {
  if (!isRecord(value) || value.schema !== 1 || value.kind !== kind || !isRecord(value.input))
    return null;
  const input = value.input;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (
    typeof input.previewId !== 'string' ||
    !UUID.test(input.previewId) ||
    !Number.isSafeInteger(input.configurationVersion) ||
    Number(input.configurationVersion) < 0 ||
    !Number.isSafeInteger(input.runtimeVersion) ||
    Number(input.runtimeVersion) < 0 ||
    !reason ||
    reason.length > 500 ||
    hasControlCharacter(reason) ||
    input.explicitConfirmation !== true ||
    typeof value.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY.test(value.idempotencyKey) ||
    typeof value.correlationId !== 'string' ||
    !IDEMPOTENCY_KEY.test(value.correlationId)
  )
    return null;
  try {
    const parsedPreview = parseWorkplaceConnectorReplayPreview(value.preview);
    if (
      parsedPreview.kind !== kind ||
      parsedPreview.previewId !== input.previewId ||
      parsedPreview.configurationVersion !== input.configurationVersion ||
      parsedPreview.runtimeVersion !== input.runtimeVersion
    )
      return null;
    const preview = Object.freeze({
      ...parsedPreview,
      limitations: Object.freeze([...parsedPreview.limitations]),
    });
    return Object.freeze({
      kind,
      preview,
      input: Object.freeze({
        previewId: input.previewId,
        configurationVersion: Number(input.configurationVersion),
        runtimeVersion: Number(input.runtimeVersion),
        reason,
        explicitConfirmation: true,
      }),
      idempotencyKey: value.idempotencyKey,
      correlationId: value.correlationId,
    }) satisfies FrozenWorkplaceConnectorReplayCommand;
  } catch {
    return null;
  }
}

export function restoreWorkplaceConnectorReplayCommand(
  scope: string | null,
  kind: WorkplaceConnectorKind,
  storage: ReplayCommandStorage | null = browserStorage()
) {
  if (!scope || !storage) return null;
  const key = storageKey(scope, kind);
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return null;
    const command = parseCommand(JSON.parse(serialized) as unknown, kind);
    if (command) return command;
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Browser storage is optional recovery evidence; the in-memory command remains authoritative.
    }
  }
  return null;
}

export function createFrozenWorkplaceConnectorReplayCommand(
  draft: WorkplaceConnectorReplayCommandDraft
) {
  const command = parseCommand({ schema: 1, ...draft }, draft.kind);
  if (!command) throw new Error('Workplace connector replay command recovery input is invalid.');
  return command;
}

export function isWorkplaceConnectorReplayPreviewExpired(
  preview: WorkplaceConnectorReplayPreview,
  now = Date.now()
) {
  return now >= Date.parse(preview.expiresAt);
}

export function persistWorkplaceConnectorReplayCommand(
  scope: string | null,
  command: FrozenWorkplaceConnectorReplayCommand,
  storage: ReplayCommandStorage | null = browserStorage()
) {
  if (!scope || !storage) return;
  try {
    storage.setItem(storageKey(scope, command.kind), JSON.stringify({ schema: 1, ...command }));
  } catch {
    // The same immutable command remains available in memory when storage is blocked.
  }
}

export function clearWorkplaceConnectorReplayCommand(
  scope: string | null,
  kind: WorkplaceConnectorKind,
  storage: ReplayCommandStorage | null = browserStorage()
) {
  if (!scope || !storage) return;
  try {
    storage.removeItem(storageKey(scope, kind));
  } catch {
    // Clearing optional recovery evidence must not break the authoritative server flow.
  }
}
