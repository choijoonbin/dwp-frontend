import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';

export type ArchivePeriod = 'all' | 'day' | 'week' | 'month' | 'hold';
export type ArchiveSort = 'recent' | 'oldest' | 'messages' | 'evidence';
const DAY = 86_400_000;
const WINDOWS: Record<Extract<ArchivePeriod, 'week' | 'month'>, number> = {
  week: 7 * DAY,
  month: 30 * DAY,
};

function isLocalCalendarDay(value: number, now: number) {
  const date = new Date(value);
  const today = new Date(now);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

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
      const searchable = [item.title, item.summaryExcerpt ?? '', ...item.sourceSystems]
        .join('\n')
        .normalize('NFC')
        .toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
      if (period === 'all') return true;
      if (period === 'hold') return item.legalHold;
      const time = Date.parse(item.lastMessageAt);
      if (!Number.isFinite(time) || time > now) return false;
      if (period === 'day') return isLocalCalendarDay(time, now);
      return time >= now - WINDOWS[period];
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.lastMessageAt) || 0;
      const timeB = Date.parse(b.lastMessageAt) || 0;
      const primary =
        sort === 'messages'
          ? b.messageCount - a.messageCount
          : sort === 'evidence'
            ? b.evidenceCount - a.evidenceCount
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
