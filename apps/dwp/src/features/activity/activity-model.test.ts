import { describe, expect, it } from 'vitest';
import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';
import {
  activityQueryKeys,
  activityRefreshState,
  activitySavedConfiguration,
  applyActivitySavedConfiguration,
  availableActivitySourceRoute,
  readActivityFilters,
  selectedActivityEvent,
  validActivityTimeRange,
} from './activity-model';

const event: WorkspaceActivityEvent = {
  id: 'specific-event',
  actor: 'person',
  actorName: 'Member',
  state: 'completed',
  occurredAt: '',
  title: 'Changed',
  objectType: 'WORK_ITEM',
  objectLabel: 'Item',
  source: 'DWP',
  auditId: null,
  sourceAccess: 'AVAILABLE',
  sourceRoute: '/work/item/work-1',
};

describe('activity navigation and server-query model', () => {
  it('preserves legacy URL filters while adding source/object/time and cursor scope', () => {
    const filters = readActivityFilters(
      new URLSearchParams(
        'q=review&actor=person&state=needs-input&source=DWP&objectType=WORK_ITEM&objectId=w1&executionId=e1&from=2026-09-01T00%3A00%3A00Z&cursor=opaque&includeUsage=true'
      )
    );
    expect(filters).toMatchObject({
      query: 'review',
      actor: 'person',
      state: 'needs-input',
      source: 'DWP',
      objectType: 'WORK_ITEM',
      objectId: 'w1',
      executionId: 'e1',
      from: '2026-09-01T00:00:00Z',
      cursor: 'opaque',
      includeUsage: true,
      limit: 50,
    });
  });

  it('restores legacy saved views and clears incompatible cursor/detail/new filters', () => {
    const params = applyActivitySavedConfiguration(
      new URLSearchParams(
        'event=old&cursor=old&source=wrong&from=bad&includeUsage=true&other=keep'
      ),
      { q: 'hello', actor: 'agent', state: 'all' }
    );
    expect(Object.fromEntries(params)).toEqual({ q: 'hello', actor: 'agent', other: 'keep' });
  });

  it('round-trips new saved-view filters without persisting an old page cursor', () => {
    const first = readActivityFilters(
      new URLSearchParams('objectId=w1&to=2026-09-04T00%3A00%3A00Z&includeUsage=true&cursor=old')
    );
    const restored = readActivityFilters(
      applyActivitySavedConfiguration(new URLSearchParams(), activitySavedConfiguration(first))
    );
    expect(restored).toEqual({ ...first, cursor: undefined });
  });

  it('does not substitute a different event for a missing explicit ID', () => {
    expect(selectedActivityEvent('old-event', event)).toBeUndefined();
    expect(selectedActivityEvent('specific-event', undefined)).toBeUndefined();
    expect(selectedActivityEvent('', event)).toBeUndefined();
    expect(selectedActivityEvent('specific-event', event)).toBe(event);
  });

  it('separates tenant/user, page, filter, detail, and summary caches', () => {
    const base = activityQueryKeys.feed('tenant:user', { actor: 'person' });
    expect(base).not.toEqual(activityQueryKeys.feed('tenant:other', { actor: 'person' }));
    expect(base).not.toEqual(activityQueryKeys.feed('other:user', { actor: 'person' }));
    expect(base).not.toEqual(activityQueryKeys.feed('tenant:user', { actor: 'agent' }));
    expect(base).not.toEqual(
      activityQueryKeys.feed('tenant:user', { actor: 'person', cursor: 'older' })
    );
    expect(base).not.toEqual(activityQueryKeys.detail('tenant:user', 'specific-event'));
    expect(base).not.toEqual(activityQueryKeys.summary('tenant:user'));
  });

  it.each([
    ['/activity', false],
    ['/activity/home', false],
    ['/activity/timeline?event=other', false],
    ['//other.example', false],
    ['https://other.example', false],
    ['/\\other.example', false],
    ['/%2Factivity', false],
    ['/activity%2Ftimeline', false],
    ['/work/item/work-1', true],
  ])('rejects unsafe/self-loop source %s', (sourceRoute, available) => {
    expect(Boolean(availableActivitySourceRoute({ ...event, sourceRoute }))).toBe(available);
  });

  it.each(['FORBIDDEN', 'UNAVAILABLE', 'DELETED', undefined] as const)(
    'requires explicit AVAILABLE, not %s',
    (sourceAccess) => {
      expect(availableActivitySourceRoute({ ...event, sourceAccess })).toBeNull();
    }
  );

  it('does not label stale/error/no-success data live', () => {
    expect(activityRefreshState({ isError: true, isFetching: false, dataUpdatedAt: 50 }, 60)).toBe(
      'degraded'
    );
    expect(activityRefreshState({ isError: false, isFetching: false, dataUpdatedAt: 0 }, 60)).toBe(
      'stale'
    );
    expect(
      activityRefreshState({ isError: false, isFetching: false, dataUpdatedAt: 1 }, 100_000)
    ).toBe('stale');
    expect(
      activityRefreshState({ isError: false, isFetching: true, dataUpdatedAt: 1 }, 100_000)
    ).toBe('syncing');
    expect(activityRefreshState({ isError: false, isFetching: false, dataUpdatedAt: 50 }, 60)).toBe(
      'live'
    );
  });

  it('does not treat a recent HTTP success as fresh when the source snapshot is old', () => {
    const now = Date.parse('2026-09-04T10:00:00Z');
    expect(
      activityRefreshState(
        {
          isError: false,
          isFetching: false,
          dataUpdatedAt: now,
          data: { generatedAt: '2026-09-04T09:00:00Z' },
        },
        now
      )
    ).toBe('stale');
  });

  it('reports a partially available source feed as degraded even after an HTTP success', () => {
    expect(
      activityRefreshState(
        { isError: false, isFetching: false, dataUpdatedAt: 50, data: { partial: true } },
        60
      )
    ).toBe('degraded');
  });

  it('requires explicit timezones and an ordered half-open interval', () => {
    expect(validActivityTimeRange({})).toBe(true);
    expect(
      validActivityTimeRange({ from: '2026-09-01T00:00:00Z', to: '2026-09-04T00:00:00+09:00' })
    ).toBe(true);
    expect(validActivityTimeRange({ from: '2026-09-01T00:00:00' })).toBe(false);
    expect(validActivityTimeRange({ from: 'not a time' })).toBe(false);
    expect(
      validActivityTimeRange({ from: '2026-09-04T00:00:00Z', to: '2026-09-04T00:00:00Z' })
    ).toBe(false);
  });
});
