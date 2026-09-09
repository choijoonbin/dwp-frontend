// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearWorkScheduleIntent,
  matchWorkScheduleIntent,
  persistWorkScheduleIntent,
  restoreWorkScheduleIntent,
} from './work-hub-schedule-intent-storage';
import type { WorkScheduleCommand } from './work-hub-scheduling';

const owner = 'tenant-secret:user-secret:permissions-secret';
const itemKey = 'PERSONAL_TASK:private-task-reference:';
const command = {
  linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'private-task-reference' },
  reviewedItemSourceId: 'personal' as const,
  reviewedItemSourceStatus: 'OPEN',
  reviewedItemVersion: 1,
  reviewedItemLifecycle: 'OPEN',
  eventInput: {
    title: 'Confidential acquisition review',
    startsAt: '2026-09-08T09:00:00Z',
    endsAt: '2026-09-08T10:00:00Z',
    calendarId: 'private-calendar',
    idempotencyKey: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  },
} as WorkScheduleCommand;

describe('opaque Work schedule intent storage', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('restores only the same owner and item idempotency key without persisting sensitive text', async () => {
    expect(await persistWorkScheduleIntent(owner, itemKey, command)).toBe(true);
    const serialized = window.sessionStorage.getItem('dwp.work.schedule-intents.v1') ?? '';

    expect(serialized).not.toContain(owner);
    expect(serialized).not.toContain(itemKey);
    expect(serialized).not.toContain(command.eventInput.title);
    expect(serialized).not.toContain(command.eventInput.startsAt);
    await expect(restoreWorkScheduleIntent(owner, itemKey)).resolves.toEqual({
      linkId: command.linkId,
    });
    await expect(restoreWorkScheduleIntent(`${owner}:changed`, itemKey)).resolves.toBeNull();
    await expect(restoreWorkScheduleIntent(owner, `${itemKey}:changed`)).resolves.toBeNull();
    await expect(matchWorkScheduleIntent(owner, itemKey, command)).resolves.toEqual({
      linkId: command.linkId,
      inputMatches: true,
    });
    await expect(
      matchWorkScheduleIntent(owner, itemKey, {
        ...command,
        linkId: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2',
        eventInput: {
          ...command.eventInput,
          idempotencyKey: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2',
        },
      })
    ).resolves.toEqual({ linkId: command.linkId, inputMatches: true });
    await expect(
      matchWorkScheduleIntent(owner, itemKey, {
        ...command,
        eventInput: { ...command.eventInput, title: 'A different reviewed event' },
      })
    ).resolves.toEqual({ linkId: command.linkId, inputMatches: false });
  });

  it('clears only the exact completed command and expires stale markers', async () => {
    const now = Date.now();
    await persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now);
    await expect(
      clearWorkScheduleIntent(owner, itemKey, command.linkId, window.sessionStorage, now)
    ).resolves.toBe(true);
    await expect(restoreWorkScheduleIntent(owner, itemKey)).resolves.toBeNull();

    await persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now);
    await expect(
      restoreWorkScheduleIntent(owner, itemKey, window.sessionStorage, now + 30 * 60 * 1000 + 1)
    ).resolves.toBeNull();
  });

  it('binds a marker to the exact work receipt version and active lifecycle', async () => {
    await persistWorkScheduleIntent(owner, itemKey, command);

    await expect(
      matchWorkScheduleIntent(owner, itemKey, {
        ...command,
        reviewedItemVersion: command.reviewedItemVersion + 1,
      })
    ).resolves.toEqual({ linkId: command.linkId, inputMatches: false });
    await expect(
      matchWorkScheduleIntent(owner, itemKey, {
        ...command,
        reviewedItemLifecycle: 'COMPLETED',
      })
    ).resolves.toBeNull();
    await expect(
      persistWorkScheduleIntent(owner, itemKey, {
        ...command,
        work: { ...command.work, sourceReference: 'another-task' },
      })
    ).resolves.toBe(false);
  });

  it('drops only an expired entry and preserves a later valid marker', async () => {
    const now = Date.now();
    const laterItemKey = 'PERSONAL_TASK:later-task:';
    const laterCommand: WorkScheduleCommand = {
      ...command,
      linkId: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      work: { ...command.work, sourceReference: 'later-task' },
      eventInput: {
        ...command.eventInput,
        idempotencyKey: '46e6e854-ec64-456c-8bcc-46a7d5ba97f2',
      },
    };
    await persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now);
    await persistWorkScheduleIntent(
      owner,
      laterItemKey,
      laterCommand,
      window.sessionStorage,
      now + 20 * 60 * 1000
    );

    await expect(
      restoreWorkScheduleIntent(owner, itemKey, window.sessionStorage, now + 31 * 60 * 1000)
    ).resolves.toBeNull();
    await expect(
      restoreWorkScheduleIntent(owner, laterItemKey, window.sessionStorage, now + 31 * 60 * 1000)
    ).resolves.toEqual({ linkId: laterCommand.linkId });
  });

  it('fails closed when stored intent identities are malformed or duplicated', async () => {
    const now = Date.now();
    await persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now);
    const stored = JSON.parse(
      window.sessionStorage.getItem('dwp.work.schedule-intents.v1') ?? '{}'
    ) as { intents: unknown[] };
    window.sessionStorage.setItem(
      'dwp.work.schedule-intents.v1',
      JSON.stringify({ schema: 1, intents: [...stored.intents, ...stored.intents] })
    );

    await expect(
      persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now)
    ).resolves.toBe(false);
    await expect(
      clearWorkScheduleIntent(owner, itemKey, command.linkId, window.sessionStorage, now)
    ).resolves.toBe(false);

    window.sessionStorage.setItem(
      'dwp.work.schedule-intents.v1',
      JSON.stringify({ schema: 1, intents: [{ recordedAt: now }] })
    );
    await expect(
      persistWorkScheduleIntent(owner, itemKey, command, window.sessionStorage, now)
    ).resolves.toBe(false);
  });
});
