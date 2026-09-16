import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export const WORK_MESSENGER_CAPTURE_TTL_MS = 15 * 60 * 1000;
// Java's UUID path binding and the persisted PostgreSQL UUID contract accept every canonical
// lowercase UUID, including migrated version-neutral identifiers. Keep this boundary aligned with
// the owner service while still rejecting aliases, uppercase variants, and non-canonical input.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export type WorkMessengerCapture = Readonly<{
  owner: string;
  conversationId: string;
  messageId: string;
  createdAt: number;
}>;

type WorkMessengerCaptureState = Readonly<{
  workMessengerCapture: Readonly<WorkMessengerCapture & { version: 1 }>;
}>;

export function hasWorkMessengerCaptureState(value: unknown): boolean {
  return record(value) && Object.prototype.hasOwnProperty.call(value, 'workMessengerCapture');
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function createWorkMessengerCaptureState(
  owner: string,
  conversationId: string,
  messageId: string,
  createdAt = Date.now()
): WorkMessengerCaptureState {
  if (
    !owner ||
    !UUID.test(conversationId) ||
    !UUID.test(messageId) ||
    !Number.isFinite(createdAt)
  ) {
    throw new Error('A current Work owner and canonical message identity are required');
  }
  return {
    workMessengerCapture: { version: 1, owner, conversationId, messageId, createdAt },
  };
}

/** Rejects unknown fields so sender names and message bodies cannot cross the route boundary. */
export function readWorkMessengerCaptureState(
  value: unknown,
  owner: string | null,
  now = Date.now()
): WorkMessengerCapture | null {
  if (!owner || !record(value) || !exactKeys(value, ['workMessengerCapture'])) return null;
  const capture = value.workMessengerCapture;
  if (
    !record(capture) ||
    !exactKeys(capture, ['conversationId', 'createdAt', 'messageId', 'owner', 'version']) ||
    capture.version !== 1 ||
    capture.owner !== owner ||
    typeof capture.conversationId !== 'string' ||
    !UUID.test(capture.conversationId) ||
    typeof capture.messageId !== 'string' ||
    !UUID.test(capture.messageId) ||
    typeof capture.createdAt !== 'number' ||
    !Number.isFinite(capture.createdAt) ||
    capture.createdAt > now + 5_000 ||
    now - capture.createdAt > WORK_MESSENGER_CAPTURE_TTL_MS
  ) {
    return null;
  }
  return {
    owner,
    conversationId: capture.conversationId,
    messageId: capture.messageId,
    createdAt: capture.createdAt,
  };
}

export function workMessengerSourceReference(
  capture: Pick<WorkMessengerCapture, 'conversationId' | 'messageId'>
): WorkSourceReference {
  return {
    sourceSystem: 'MESSAGING_MESSAGE',
    sourceReference: capture.conversationId,
    obligationKey: capture.messageId,
  };
}
