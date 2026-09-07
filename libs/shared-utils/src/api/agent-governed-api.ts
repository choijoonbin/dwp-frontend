import { HttpError } from '../http-error';

export const AGENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isAgentRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAgentDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function expectAgentData<T>(
  payload: unknown,
  predicate: (value: unknown) => value is T,
  message: string
): T {
  if (!predicate(payload)) throw new HttpError(message, 502, payload);
  return payload;
}

export function assertAgentUuid(value: string, label: string): void {
  if (!AGENT_UUID_PATTERN.test(value)) throw new TypeError(`${label} is invalid.`);
}

export function assertAgentRevision(value: number, label: string, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum) throw new TypeError(`${label} is invalid.`);
}

export function newAgentCommand(
  expectedRevision: number,
  reasonCode: string
): { commandId: string; expectedRevision: number; reasonCode: string } {
  assertAgentRevision(expectedRevision, 'Agent command revision');
  return {
    commandId: globalThis.crypto.randomUUID(),
    expectedRevision,
    reasonCode,
  };
}
