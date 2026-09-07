import { describe, expect, it } from 'vitest';

import {
  flowRequiredNoticeDestination,
  flowUpdatesLayoutMode,
  flowUpdatesResponsiveItemLimit,
  flowUpdatesVisibleStories,
  orderedFlowStories,
  shouldShowFlowUpdates,
  visibleFlowUnreadCount,
} from './flow-updates';

import type { CommunicationItem, HomeOverview } from '@dwp-frontend/shared-utils';

function story(overrides: Partial<CommunicationItem> = {}): CommunicationItem {
  return {
    communicationId: 1,
    title: 'Generic feed record',
    summary: 'Generic summary',
    severity: 'INFO',
    contentType: 'NEWS',
    categoryKey: 'COMPANY',
    publisherName: 'DWP',
    featured: false,
    pinned: false,
    acknowledgementRequired: false,
    dismissible: true,
    readingMinutes: 2,
    sourceLocale: 'ko',
    publishedAt: '2026-08-25T00:00:00Z',
    readerState: {
      unread: true,
      saved: false,
      acknowledged: false,
      dismissed: false,
    },
    reactions: { counts: {}, total: 0 },
    ...overrides,
  };
}

describe('Flow Home update ordering', () => {
  it('keeps the actionable record when the generic feed repeats the same communication', () => {
    const actionable = story({
      title: 'Action required',
      severity: 'CRITICAL',
      acknowledgementRequired: true,
    });
    const genericDuplicate = story({ title: 'Generic duplicate', severity: 'INFO' });
    const overview = {
      communications: {
        status: 'AVAILABLE',
        data: {
          actionableItems: [actionable],
          featured: genericDuplicate,
          items: [genericDuplicate],
          summary: { total: 1, unread: 1, required: 1, saved: 0 },
          generatedAt: '2026-08-25T00:00:00Z',
        },
      },
    } as unknown as HomeOverview;

    expect(orderedFlowStories(overview)).toEqual([actionable]);
  });
});

describe('Flow Home visible unread count', () => {
  it('counts only unread stories inside the rendered item budget', () => {
    const stories = [
      story({ communicationId: 1 }),
      story({
        communicationId: 2,
        readerState: {
          unread: false,
          saved: false,
          acknowledged: false,
          dismissed: false,
        },
      }),
      story({ communicationId: 3 }),
    ];

    expect(visibleFlowUnreadCount(stories, 2)).toBe(1);
    expect(visibleFlowUnreadCount(stories, 3)).toBe(2);
  });
});

describe('Flow Home responsive update budget', () => {
  it.each([
    [419, 'short', 3],
    [420, 'short', 3],
    [719, 'short', 3],
    [720, 'short', 3],
    [419, 'standard', 3],
    [420, 'standard', 3],
    [719, 'standard', 3],
    [720, 'standard', 3],
  ] as const)('uses %ipx / %s height budget of %i', (width, height, expected) => {
    expect(flowUpdatesResponsiveItemLimit(width, height, 3)).toBe(expected);
  });

  it('never expands a zero or one item request and preserves a wide explicit budget', () => {
    expect(flowUpdatesResponsiveItemLimit(419, 'short', 0)).toBe(0);
    expect(flowUpdatesResponsiveItemLimit(419, 'standard', 1)).toBe(1);
    expect(flowUpdatesResponsiveItemLimit(720, 'standard', 7)).toBe(7);
  });
});

describe('Flow Home update visibility', () => {
  const available = {
    policyVisible: true,
    communicationsForbidden: false,
    editing: false,
    loading: false,
    requiredNoticeUnavailable: false,
    hasGeneralUpdates: true,
  } as const;

  it('shows loading, editing, or available general updates', () => {
    expect(shouldShowFlowUpdates(available)).toBe(true);
    expect(shouldShowFlowUpdates({ ...available, hasGeneralUpdates: false, loading: true })).toBe(
      true
    );
    expect(shouldShowFlowUpdates({ ...available, hasGeneralUpdates: false, editing: true })).toBe(
      true
    );
  });

  it('suppresses the duplicate News error when the required channel is unavailable', () => {
    expect(shouldShowFlowUpdates({ ...available, requiredNoticeUnavailable: true })).toBe(false);
    expect(
      shouldShowFlowUpdates({ ...available, editing: true, requiredNoticeUnavailable: true })
    ).toBe(false);
  });
});

describe('Flow Home responsive editorial layout', () => {
  it.each([
    [undefined, 3, 'stack'],
    [719, 3, 'stack'],
    [720, 3, 'feature-rail'],
    [1199, 3, 'feature-rail'],
    [1200, 2, 'feature-rail'],
    [1200, 3, 'wide-6-3-3'],
    [1920, 3, 'wide-6-3-3'],
  ] as const)('uses %s px with %i visible stories as %s', (width, count, expected) => {
    expect(flowUpdatesLayoutMode(width, count)).toBe(expected);
  });
});

describe('Flow Home required notice destination', () => {
  it.each([
    [undefined, 1, false, '/communications/required'],
    [undefined, 2, true, '/communications/for-you'],
    [4101, 1, false, '/communications/required/4101'],
    [4101, 2, false, '/communications/required'],
    [4101, 1, true, '/communications/for-you/4101'],
    [4101, 2, true, '/communications/for-you'],
  ] as const)(
    'routes story %s / count %i / critical-only %s to %s',
    (storyId, count, criticalOnly, expected) => {
      expect(flowRequiredNoticeDestination(storyId, count, criticalOnly)).toBe(expected);
    }
  );
});

describe('Flow Home rendered update selection', () => {
  it('derives featured, secondary, unread, empty, and overflow truth from one limit', () => {
    const stories = Array.from({ length: 7 }, (_, index) =>
      story({
        communicationId: index + 1,
        readerState: {
          unread: index !== 1,
          saved: false,
          acknowledged: false,
          dismissed: false,
        },
      })
    );

    const empty = flowUpdatesVisibleStories([], 3);
    expect(empty).toMatchObject({
      visible: [],
      featured: undefined,
      secondary: [],
      unreadCount: 0,
      overflowCount: 0,
    });

    const one = flowUpdatesVisibleStories(stories.slice(0, 1), 3);
    expect(one.visible.map((item) => item.communicationId)).toEqual([1]);
    expect(one.featured?.communicationId).toBe(1);
    expect(one.secondary).toEqual([]);
    expect(one.unreadCount).toBe(1);
    expect(one.overflowCount).toBe(0);

    const threeWithNarrowBudget = flowUpdatesVisibleStories(stories.slice(0, 3), 2);
    expect(threeWithNarrowBudget.visible.map((item) => item.communicationId)).toEqual([1, 2]);
    expect(threeWithNarrowBudget.featured?.communicationId).toBe(1);
    expect(threeWithNarrowBudget.secondary.map((item) => item.communicationId)).toEqual([2]);
    expect(threeWithNarrowBudget.unreadCount).toBe(1);
    expect(threeWithNarrowBudget.overflowCount).toBe(1);

    const many = flowUpdatesVisibleStories(stories, 3);
    expect(many.visible.map((item) => item.communicationId)).toEqual([1, 2, 3]);
    expect(many.secondary.map((item) => item.communicationId)).toEqual([2, 3]);
    expect(many.unreadCount).toBe(2);
    expect(many.overflowCount).toBe(4);
  });
});
