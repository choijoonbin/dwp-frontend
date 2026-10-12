import { describe, expect, it } from 'vitest';

import { createWorkCalendarEventHandoff } from './work-hub-calendar-api';
import {
  clearWorkCalendarDocumentHandoff,
  hasWorkCalendarDocumentHandoff,
  persistWorkCalendarDocumentHandoff,
  readWorkCalendarDocumentHandoff,
  WORK_CALENDAR_DOCUMENT_HANDOFF_KEY,
} from './work-calendar-document-handoff';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const now = new Date('2026-09-16T00:00:00.000Z');
const handoff = createWorkCalendarEventHandoff(
  {
    ownerFingerprint: `sha256:${'a'.repeat(64)}`,
    work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
    sourceUrl: '/work/queue?work=PERSONAL_TASK%3Atask-42%3A',
    returnTo: '/work/queue?view=mine#task-42',
    title: 'Focus: quarterly report',
    startsAt: '2026-09-16T09:00:00+09:00',
    endsAt: '2026-09-16T09:30:00+09:00',
    timeZone: 'Asia/Seoul',
  },
  now
);
const state = { workCalendarEventHandoff: handoff };

describe('Work Calendar document handoff transport', () => {
  it('keeps one fresh handoff in tab-scoped storage and supports exact consumption cleanup', () => {
    const storage = memoryStorage();

    expect(persistWorkCalendarDocumentHandoff(state, now.getTime(), storage)).toBe(true);
    expect(hasWorkCalendarDocumentHandoff(storage)).toBe(true);
    expect(readWorkCalendarDocumentHandoff(now.getTime(), storage)).toEqual(state);
    expect(storage.getItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY)).not.toContain('/calendar/schedule');

    clearWorkCalendarDocumentHandoff('e0af4270-6974-46d2-9b09-ac113db3a66a', storage);
    expect(hasWorkCalendarDocumentHandoff(storage)).toBe(true);
    clearWorkCalendarDocumentHandoff(handoff.handoffId, storage);
    expect(hasWorkCalendarDocumentHandoff(storage)).toBe(false);
  });

  it('destroys malformed or expired envelopes and never records an invalid command', () => {
    const storage = memoryStorage();
    storage.setItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY, '{"version":1,"state":{}}');
    expect(readWorkCalendarDocumentHandoff(now.getTime(), storage)).toBeNull();
    expect(storage.length).toBe(0);

    expect(persistWorkCalendarDocumentHandoff(state, Date.parse(handoff.expiresAt), storage)).toBe(
      false
    );
    expect(storage.length).toBe(0);

    expect(persistWorkCalendarDocumentHandoff(state, now.getTime(), storage)).toBe(true);
    expect(readWorkCalendarDocumentHandoff(Date.parse(handoff.expiresAt), storage)).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('removes an older command when the browser rejects its replacement', () => {
    const storage = memoryStorage();
    storage.setItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY, '{"old":true}');
    const blockedStorage: Storage = {
      get length() {
        return storage.length;
      },
      clear: () => storage.clear(),
      getItem: (key) => storage.getItem(key),
      key: (index) => storage.key(index),
      removeItem: (key) => storage.removeItem(key),
      setItem: () => {
        throw new DOMException('blocked', 'QuotaExceededError');
      },
    };

    expect(persistWorkCalendarDocumentHandoff(state, now.getTime(), blockedStorage)).toBe(false);
    expect(storage.getItem(WORK_CALENDAR_DOCUMENT_HANDOFF_KEY)).toBeNull();
  });
});
