import { describe, expect, it } from 'vitest';

import {
  clearWorkplaceConnectorReplayCommand,
  createFrozenWorkplaceConnectorReplayCommand,
  isWorkplaceConnectorReplayPreviewExpired,
  persistWorkplaceConnectorReplayCommand,
  restoreWorkplaceConnectorReplayCommand,
} from './workplace-connector-replay-command';

import type { FrozenWorkplaceConnectorReplayCommand } from './workplace-connector-replay-command';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

function command(): FrozenWorkplaceConnectorReplayCommand {
  return {
    kind: 'CALENDAR',
    preview: {
      previewId: '81000000-0000-4000-8000-000000000021',
      kind: 'CALENDAR',
      provider: 'calendar-adapter',
      from: '2026-09-16T03:00:00Z',
      to: '2026-09-16T04:00:00Z',
      failedOnly: true,
      maximumRecords: 500,
      configurationVersion: 7,
      runtimeVersion: 11,
      estimatedRecords: 21,
      eligible: true,
      limitations: [],
      expiresAt: '2026-09-16T04:10:00Z',
      createdAt: '2026-09-16T04:00:00Z',
    },
    input: {
      previewId: '81000000-0000-4000-8000-000000000021',
      configurationVersion: 7,
      runtimeVersion: 11,
      reason: 'Recover failed calendar events',
      explicitConfirmation: true,
    },
    idempotencyKey: 'workplace:connector-replay:stable-key',
    correlationId: 'connector-replay-correlation',
  };
}

describe('workplace connector replay command recovery', () => {
  it('captures an immutable normalized command before the first dispatch', () => {
    const draft = command();
    const frozen = createFrozenWorkplaceConnectorReplayCommand({
      ...draft,
      input: { ...draft.input, reason: `  ${draft.input.reason}  ` },
    });

    expect(frozen.input.reason).toBe(draft.input.reason);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.input)).toBe(true);
    expect(Object.isFrozen(frozen.preview)).toBe(true);
    expect(Object.isFrozen(frozen.preview.limitations)).toBe(true);
  });

  it('treats the exact expiry instant as expired', () => {
    const preview = command().preview;
    const expiresAt = Date.parse(preview.expiresAt);
    expect(isWorkplaceConnectorReplayPreviewExpired(preview, expiresAt - 1)).toBe(false);
    expect(isWorkplaceConnectorReplayPreviewExpired(preview, expiresAt)).toBe(true);
  });

  it('round-trips only within the exact actor scope and clears after reconciliation', () => {
    const storage = memoryStorage();
    persistWorkplaceConnectorReplayCommand('42:99', command(), storage);

    expect(restoreWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', storage)).toEqual(command());
    expect(restoreWorkplaceConnectorReplayCommand('42:100', 'CALENDAR', storage)).toBeNull();
    clearWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', storage);
    expect(restoreWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', storage)).toBeNull();
  });

  it('removes a tampered payload instead of retrying a different command with the key', () => {
    const storage = memoryStorage();
    persistWorkplaceConnectorReplayCommand('42:99', command(), storage);
    const [key, serialized] = [...storage.values.entries()][0]!;
    const tampered = JSON.parse(serialized) as { input: { reason: string } };
    tampered.input.reason = '';
    storage.setItem(key, JSON.stringify(tampered));

    expect(restoreWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', storage)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it('rejects a persisted reason containing control characters', () => {
    const storage = memoryStorage();
    persistWorkplaceConnectorReplayCommand('42:99', command(), storage);
    const [key, serialized] = [...storage.values.entries()][0]!;
    const tampered = JSON.parse(serialized) as { input: { reason: string } };
    tampered.input.reason = 'recover\nall records';
    storage.setItem(key, JSON.stringify(tampered));

    expect(restoreWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', storage)).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it('fails soft when browser storage is unavailable', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => persistWorkplaceConnectorReplayCommand('42:99', command(), blocked)).not.toThrow();
    expect(restoreWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', blocked)).toBeNull();
    expect(() => clearWorkplaceConnectorReplayCommand('42:99', 'CALENDAR', blocked)).not.toThrow();
  });
});
