import { describe, expect, it } from 'vitest';

import {
  flattenNotificationPages,
  moveNotificationSelection,
  notificationMatchesView,
  optimisticTriageItem,
  reconcileGlanceItems,
} from './notification-model';

import type { NotificationItem } from '@dwp-frontend/shared-utils/api/notification-api';

function item(id: string, overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    notificationId: id,
    threadCount: 1,
    source: { appKey: 'approval', appName: 'Approval' },
    typeKey: 'approval.requested',
    title: id,
    preview: null,
    priority: 'NORMAL',
    reason: { kind: 'DIRECT', label: 'Direct' },
    receivedAt: '2026-08-19T00:00:00Z',
    lastActivityAt: '2026-08-19T00:00:00Z',
    actionable: true,
    sensitive: false,
    actions: [],
    version: '1',
    ...overrides,
  };
}

describe('notification model', () => {
  it('deduplicates keyset pages while preserving server order', () => {
    expect(
      flattenNotificationPages([
        {
          items: [item('a'), item('b')],
          hasMore: true,
          changeVersion: '1',
          partial: false,
          unavailableSources: [],
        },
        {
          items: [item('b'), item('c')],
          hasMore: false,
          changeVersion: '1',
          partial: false,
          unavailableSources: [],
        },
      ]).map((value) => value.notificationId)
    ).toEqual(['a', 'b', 'c']);
  });

  it('buffers new glance items without reordering the open list', () => {
    const current = [item('b'), item('c')];
    const incoming = [item('a'), item('b', { readAt: '2026-08-19T00:01:00Z' }), item('c')];
    const result = reconcileGlanceItems(current, incoming, true);

    expect(result.visible.map((value) => value.notificationId)).toEqual(['b', 'c']);
    expect(result.visible[0]?.readAt).toBe('2026-08-19T00:01:00Z');
    expect(result.buffered.map((value) => value.notificationId)).toEqual(['a', 'b', 'c']);
    expect(result.bufferedCount).toBe(1);
  });

  it('supports bounded roving selection', () => {
    expect(moveNotificationSelection(0, 'ArrowUp', 3)).toBe(0);
    expect(moveNotificationSelection(0, 'ArrowDown', 3)).toBe(1);
    expect(moveNotificationSelection(1, 'End', 3)).toBe(2);
    expect(moveNotificationSelection(2, 'ArrowDown', 3)).toBe(2);
  });

  it('keeps independent triage dimensions', () => {
    const saved = optimisticTriageItem(item('a'), 'SAVE', '2026-08-19T01:00:00Z');
    const completed = optimisticTriageItem(saved, 'COMPLETE', '2026-08-19T02:00:00Z');
    expect(completed.savedAt).toBe('2026-08-19T01:00:00Z');
    expect(completed.completedAt).toBe('2026-08-19T02:00:00Z');
    expect(completed.version).toBe('3');
    expect(notificationMatchesView(completed, 'DONE')).toBe(true);
    expect(notificationMatchesView(completed, 'SAVED')).toBe(true);
  });
});
