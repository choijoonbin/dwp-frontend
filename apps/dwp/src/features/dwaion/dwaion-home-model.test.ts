import { describe, expect, it } from 'vitest';
import type { DwaionConversationSummary, WorkspaceWorkItem } from '@dwp-frontend/shared-utils';
import {
  homeIsOverdue,
  homeLoadState,
  homePriorityWork,
  homeRecentConversations,
  homeVerifiedAt,
  homeWorkRoute,
} from './dwaion-home-model';

const item = (id: string, overrides: Partial<WorkspaceWorkItem> = {}): WorkspaceWorkItem => ({
  id,
  workItemId: id,
  title: id,
  type: 'Task',
  priority: 'high',
  status: 'in-progress',
  owner: 'self',
  sourceSystem: 'Work',
  version: 1,
  updatedAt: '2026-09-04T01:00:00Z',
  ...overrides,
});

describe('DWAI home truthful work snapshot', () => {
  it('does not conflate errors or loading with a successful empty result', () => {
    expect(homeLoadState({ isPending: true, isError: false })).toBe('loading');
    expect(homeLoadState({ isPending: false, isError: true })).toBe('error');
    expect(homeLoadState({ isPending: false, isError: false })).toBe('ready');
  });
  it('omits completed work, prioritizes then orders deadlines without mutating the source', () => {
    const items = [
      item('done', { status: 'completed' }),
      item('no-date'),
      item('later', { dueAt: '2026-09-06' }),
      item('earlier', { dueAt: '2026-09-05' }),
      item('medium', { priority: 'medium', dueAt: '2026-09-01' }),
    ];
    expect(homePriorityWork(items).map((work) => work.id)).toEqual([
      'earlier',
      'later',
      'no-date',
      'medium',
    ]);
    expect(items[0].id).toBe('done');
  });
  it('limits the queue to four items and uses activity as a date tie-breaker', () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      item(String(index), { updatedAt: `2026-09-0${index + 1}` })
    );
    expect(homePriorityWork(items).map((work) => work.id)).toEqual(['5', '4', '3', '2']);
  });
  it('only labels a finite, elapsed deadline as overdue', () => {
    const now = Date.parse('2026-09-04T01:00:00Z');
    expect(homeIsOverdue(item('a', { dueAt: '2026-09-03' }), now)).toBe(true);
    expect(homeIsOverdue(item('a', { dueAt: '2026-09-05' }), now)).toBe(false);
    expect(homeIsOverdue(item('a', { dueAt: 'invalid' }), now)).toBe(false);
    expect(homeIsOverdue(item('a'), now)).toBe(false);
    expect(homeIsOverdue(item('a', { dueAt: '2026-09-03', status: 'completed' }), now)).toBe(false);
  });
  it('opens the governed work queue instead of blindly following a source route', () => {
    expect(homeWorkRoute(item('x', { sourceRoute: '/hr/home' }))).toBe('/work/queue?item=x');
    for (const sourceRoute of [
      'https://external.test',
      '//external.test',
      '/\\external.test',
      'javascript:alert(1)',
      null,
    ]) {
      expect(homeWorkRoute(item('x&other=y', { sourceRoute }))).toBe(
        '/work/queue?item=x%26other%3Dy'
      );
    }
  });
  it('preserves the opaque owner reference for identity reviews and fails closed without it', () => {
    const review = item('display-id', {
      type: 'Review',
      sourceSystem: 'IDENTITY_GOVERNANCE',
      sourceReference: '00000000-0000-4000-8000-000000000123',
    });
    expect(homeWorkRoute(review)).toBe('/work/queue?item=00000000-0000-4000-8000-000000000123');
    expect(homeWorkRoute({ ...review, sourceReference: 'display-id' })).toBe('/work/queue');
  });
  it('uses the oldest successful receipt and excludes cached failed sources', () => {
    expect(
      homeVerifiedAt([
        { isError: false, dataUpdatedAt: 300 },
        { isError: false, dataUpdatedAt: 200 },
        { isError: true, dataUpdatedAt: 100 },
      ])
    ).toBe(200);
    expect(
      homeVerifiedAt([
        { isError: true, dataUpdatedAt: 100 },
        { isError: false, dataUpdatedAt: 0 },
      ])
    ).toBeNull();
  });
  it('sorts recent conversations by actual last message time and keeps only three', () => {
    const items = Array.from(
      { length: 5 },
      (_, index) =>
        ({
          conversationId: String(index),
          lastMessageAt: `2026-09-0${index + 1}`,
        }) as DwaionConversationSummary
    );
    expect(
      homeRecentConversations(items).map((conversation) => conversation.conversationId)
    ).toEqual(['4', '3', '2']);
    expect(items[0].conversationId).toBe('0');
  });
});
