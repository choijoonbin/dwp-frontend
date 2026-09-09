import { describe, expect, it } from 'vitest';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import { archiveConversations, archiveSummary } from './dwaion-archive-model';

const now = Date.parse('2026-09-04T09:00:00Z');
const row = (
  id: string,
  lastMessageAt: string,
  messageCount = 2,
  overrides: Partial<DwaionConversationSummary> = {}
): DwaionConversationSummary => ({
  conversationId: id,
  title: id,
  lastMessageAt,
  messageCount,
  agentKey: 'DWP_ASSISTANT',
  sourceSystems: [],
  evidenceCount: 0,
  summaryExcerpt: null,
  lastAnswerStatus: null,
  retentionUntil: '2026-12-03T09:00:00Z',
  legalHold: false,
  locale: 'en',
  createdAt: lastMessageAt,
  updatedAt: lastMessageAt,
  ...overrides,
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
  it('normalizes search across the returned title, summary and source labels', () => {
    expect(archiveConversations(rows, ' me\u0301eting ', 'all', 'recent', now)).toHaveLength(1);
    const described = row('source', '2026-09-04T07:00:00Z', 1, {
      summaryExcerpt: 'Delivery risk review',
      sourceSystems: ['Microsoft Outlook'],
    });
    expect(archiveConversations([described], 'delivery', 'all', 'recent', now)).toHaveLength(1);
    expect(archiveConversations([described], 'outlook', 'all', 'recent', now)).toHaveLength(1);
  });
  it('uses the local calendar for today and explicit rolling week and month windows', () => {
    expect(archiveConversations(rows, '', 'day', 'recent', now)).toHaveLength(1);
    expect(archiveConversations(rows, '', 'week', 'recent', now)).toHaveLength(2);
    expect(archiveConversations(rows, '', 'month', 'recent', now)).toHaveLength(2);
  });
  it('excludes future and invalid timestamps from time filters', () => {
    const edge = new Date(now);
    edge.setDate(edge.getDate() - 1);
    const invalid = [
      row('future', '2026-09-05'),
      row('invalid', 'bad'),
      row('edge', edge.toISOString()),
    ];
    expect(archiveConversations(invalid, '', 'day', 'recent', now)).toHaveLength(0);
  });
  it('filters legal holds, sorts by evidence, and computes only loaded-set statistics', () => {
    const held = row('held', '2026-09-03T08:00:00Z', 1, {
      legalHold: true,
      evidenceCount: 5,
    });
    expect(archiveConversations([...rows, held], '', 'hold', 'recent', now)).toEqual([held]);
    expect(archiveConversations([...rows, held], '', 'all', 'evidence', now)[0]).toEqual(held);
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
