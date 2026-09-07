import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';

export type ArchivePeriod = 'all' | 'day' | 'week' | 'month';
export type ArchiveSort = 'recent' | 'oldest' | 'messages';
const DAY = 86_400_000;
const WINDOWS: Record<Exclude<ArchivePeriod, 'all'>, number> = {
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
};

export function archiveConversations(
  items: DwaionConversationSummary[],
  search: string,
  period: ArchivePeriod,
  sort: ArchiveSort,
  now: number
) {
  const query = search.normalize('NFC').trim().toLocaleLowerCase();
  return items
    .filter((item) => {
      if (!item.title.normalize('NFC').toLocaleLowerCase().includes(query)) return false;
      if (period === 'all') return true;
      const time = Date.parse(item.lastMessageAt);
      return Number.isFinite(time) && time <= now && time >= now - WINDOWS[period];
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.lastMessageAt) || 0;
      const timeB = Date.parse(b.lastMessageAt) || 0;
      const primary =
        sort === 'messages'
          ? b.messageCount - a.messageCount
          : sort === 'oldest'
            ? timeA - timeB
            : timeB - timeA;
      return primary || timeB - timeA || a.conversationId.localeCompare(b.conversationId);
    });
}

export function archiveSummary(items: DwaionConversationSummary[], now: number) {
  return {
    conversations: items.length,
    messages: items.reduce((sum, item) => sum + item.messageCount, 0),
    activeWeek: archiveConversations(items, '', 'week', 'recent', now).length,
    latest: archiveConversations(items, '', 'all', 'recent', now)[0]?.lastMessageAt,
  };
}
