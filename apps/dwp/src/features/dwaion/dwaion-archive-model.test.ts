import { describe, expect, it } from 'vitest';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import { archiveConversations, archiveSummary } from './dwaion-archive-model';

const now = Date.parse('2026-09-04T09:00:00Z');
const row = (id: string, lastMessageAt: string, messageCount = 2): DwaionConversationSummary => ({
  conversationId: id,
  title: id,
  lastMessageAt,
  messageCount,
  locale: 'en',
  createdAt: lastMessageAt,
  updatedAt: lastMessageAt,
});
const rows = [
  row('older', '2026-08-01T00:00:00Z', 8),
  row('MÉETING', '2026-09-04T08:00:00Z'),
  row('week', '2026-08-30T00:00:00Z', 4),
];

describe('DWAI conversation archive loaded-window contract', () => {
  it('sorts deterministically without mutating query cache', () => {
    expect(
      archiveConversations(rows, '', 'all', 'recent', now).map((item) => item.conversationId)
    ).toEqual(['MÉETING', 'week', 'older']);
    expect(archiveConversations(rows, '', 'all', 'oldest', now)[0].conversationId).toBe('older');
    expect(rows[0].conversationId).toBe('older');
  });
  it('normalizes search but only searches the returned title', () => {
    expect(archiveConversations(rows, ' me\u0301eting ', 'all', 'recent', now)).toHaveLength(1);
    expect(archiveConversations(rows, 'en', 'all', 'recent', now)).toHaveLength(0);
  });
  it('uses explicit rolling windows instead of assuming a user timezone', () => {
    expect(archiveConversations(rows, '', 'day', 'recent', now)).toHaveLength(1);
    expect(archiveConversations(rows, '', 'week', 'recent', now)).toHaveLength(2);
    expect(archiveConversations(rows, '', 'month', 'recent', now)).toHaveLength(2);
  });
  it('excludes future and invalid timestamps from time filters', () => {
    const invalid = [
      row('future', '2026-09-05'),
      row('invalid', 'bad'),
      row('edge', new Date(now - 86400000).toISOString()),
    ];
    expect(
      archiveConversations(invalid, '', 'day', 'recent', now).map((item) => item.conversationId)
    ).toEqual(['edge']);
  });
  it('sorts by message count and computes only loaded-set statistics', () => {
    expect(archiveConversations(rows, '', 'all', 'messages', now)[0].conversationId).toBe('older');
    expect(archiveSummary(rows, now)).toEqual({
      conversations: 3,
      messages: 14,
      activeWeek: 2,
      latest: '2026-09-04T08:00:00Z',
    });
    expect(archiveSummary([], now)).toEqual({
      conversations: 0,
      messages: 0,
      activeWeek: 0,
      latest: undefined,
    });
  });
});
