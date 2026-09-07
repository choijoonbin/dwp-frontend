import { describe, expect, it } from 'vitest';

import { mergeActivitySourcePages, readActivitySourceCursors } from './activity-page-merge';
import type {
  ActivitySource,
  ActivitySourceState,
  SourceActivityEvent,
  SourceActivityPage,
} from './activity-page-merge';

const NOW = '2026-09-04T01:00:00Z';
const states: ActivitySourceState[] = [
  { sourceScope: 'WORKSPACE', status: 'AVAILABLE' },
  { sourceScope: 'DWAI_ON', status: 'AVAILABLE' },
];
function event(id: string, occurredAt: string): SourceActivityEvent {
  return {
    id,
    occurredAt,
    actor: 'person',
    actorName: 'User',
    state: 'completed',
    title: 'Changed',
    objectType: 'WORK_ITEM',
    objectLabel: 'Work',
    source: 'Work',
    auditId: null,
    resumeCursor: `after-${id}`,
  };
}
function page(events: SourceActivityEvent[], hasMore = false): SourceActivityPage {
  return {
    events,
    generatedAt: NOW,
    snapshotAt: NOW,
    startCursor: 'start',
    hasMore,
    coverage: { supportedObjectTypes: ['WORK_ITEM'] },
  };
}

describe('activity source keyset merge', () => {
  it('preserves source cursor positions rather than dropping unconsumed rows', () => {
    const first = mergeActivitySourcePages(
      {
        WORKSPACE: page([event('w3', '2026-09-04T03:00:00Z'), event('w1', '2026-09-04T01:00:00Z')]),
        DWAI_ON: page([event('a2', '2026-09-04T02:00:00Z'), event('a0', '2026-09-04T00:00:00Z')]),
      },
      states,
      {},
      2
    );
    expect(first.events.map((row) => row.id)).toEqual(['w3', 'dwaion:a2']);
    expect(readActivitySourceCursors(first.nextCursor!)).toEqual({
      WORKSPACE: 'after-w3',
      DWAI_ON: 'after-a2',
    });
    const second = mergeActivitySourcePages(
      {
        WORKSPACE: page([event('w1', '2026-09-04T01:00:00Z')]),
        DWAI_ON: page([event('a0', '2026-09-04T00:00:00Z')]),
      },
      states,
      readActivitySourceCursors(first.nextCursor!),
      2
    );
    expect(second.events.map((row) => row.id)).toEqual(['w1', 'dwaion:a0']);
    expect(second.hasMore).toBe(false);
  });

  it('retains the source watermark when that source contributed no selected rows', () => {
    const result = mergeActivitySourcePages(
      {
        WORKSPACE: page([event('w', '2026-09-04T03:00:00Z')]),
        DWAI_ON: { ...page([event('a', '2026-09-04T01:00:00Z')]), startCursor: 'agent-watermark' },
      },
      states,
      {},
      1
    );
    expect(readActivitySourceCursors(result.nextCursor!).DWAI_ON).toBe('agent-watermark');
  });

  it('orders microseconds exactly instead of collapsing to browser milliseconds', () => {
    const result = mergeActivitySourcePages(
      {
        WORKSPACE: page([event('w', '2026-09-04T01:00:00.123001Z')]),
        DWAI_ON: page([event('a', '2026-09-04T10:00:00.123002+09:00')]),
      },
      states,
      {},
      2
    );
    expect(result.events.map((row) => row.id)).toEqual(['dwaion:a', 'w']);
  });

  it('uses deterministic source and ID order for identical timestamps', () => {
    const result = mergeActivitySourcePages(
      {
        WORKSPACE: page([event('z', NOW), event('a', NOW)]),
        DWAI_ON: page([event('z', NOW)]),
      },
      states,
      {},
      3
    );
    expect(result.events.map((row) => row.id)).toEqual(['z', 'a', 'dwaion:z']);
  });

  it('uses the oldest observation instant across timezones for freshness', () => {
    const result = mergeActivitySourcePages(
      {
        WORKSPACE: { ...page([]), generatedAt: '2026-09-04T10:00:00+09:00' },
        DWAI_ON: { ...page([]), generatedAt: '2026-09-04T02:00:00Z' },
      },
      states,
      {},
      10
    );
    expect(result.generatedAt).toBe('2026-09-04T10:00:00+09:00');
  });

  it('does not advance an incomplete global page when a source failed', () => {
    const result = mergeActivitySourcePages(
      { WORKSPACE: page([event('w', NOW)], true) },
      [states[0], { sourceScope: 'DWAI_ON', status: 'UNAVAILABLE' }],
      {},
      1
    );
    expect(result.events).toHaveLength(1);
    expect(result.partial).toBe(true);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it('does not treat a legacy unbounded response as a complete page', () => {
    const legacy: SourceActivityPage = { events: [event('w', NOW)], generatedAt: NOW };
    const result = mergeActivitySourcePages({ WORKSPACE: legacy }, [states[0]], {}, 1);
    expect(result.partial).toBe(true);
    expect(result.nextCursor).toBeNull();
  });

  it('rejects invalid source cursors without fetching another scope', () => {
    for (const cursor of [
      'not-a-token',
      'activity-v1.@@',
      `activity-v1.${btoa(JSON.stringify({ version: 1, positions: { UNKNOWN: 'secret' } }))}`,
    ]) {
      expect(() => readActivitySourceCursors(cursor)).toThrow('Invalid activity cursor');
    }
  });

  it('never places cached records or source content into a composite cursor', () => {
    const result = mergeActivitySourcePages(
      { WORKSPACE: page([event('w', NOW)], true) },
      [states[0]],
      {},
      1
    );
    const decoded = readActivitySourceCursors(result.nextCursor!);
    expect(Object.keys(decoded)).toEqual(['WORKSPACE']);
    expect(JSON.stringify(decoded)).not.toContain('Changed');
  });

  it('will not paginate a truncated source without per-record resume proof', () => {
    const input = page([{ ...event('w', NOW), resumeCursor: null }], true);
    const result = mergeActivitySourcePages({ WORKSPACE: input }, [states[0]], {}, 1);
    expect(result.partial).toBe(true);
    expect(result.hasMore).toBe(false);
  });

  it.each(['WORKSPACE', 'DWAI_ON'] as ActivitySource[])(
    'keeps an authorized empty %s source empty',
    (source) => {
      const result = mergeActivitySourcePages(
        { [source]: page([]) },
        [{ sourceScope: source, status: 'AVAILABLE' }],
        {},
        50
      );
      expect(result.events).toEqual([]);
      expect(result.partial).toBe(false);
      expect(result.hasMore).toBe(false);
    }
  );
});
