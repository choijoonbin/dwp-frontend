import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';

export type MessagingTimelineItem =
  | { kind: 'date'; key: string; date: string }
  | { kind: 'unread'; key: string }
  | {
      kind: 'message';
      key: string;
      message: MessagingMessage;
      groupedWithPrevious: boolean;
      groupedWithNext: boolean;
    };

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function canGroup(left: MessagingMessage | undefined, right: MessagingMessage | undefined) {
  if (!left || !right) return false;
  if (left.senderUserId !== right.senderUserId) return false;
  if (left.deletedAt || right.deletedAt) return false;
  if (left.messageKind !== right.messageKind) return false;
  if (localDateKey(left.createdAt) !== localDateKey(right.createdAt)) return false;
  const elapsed = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  return elapsed >= 0 && elapsed <= GROUP_WINDOW_MS;
}

export function buildMessagingTimelineItems(
  messages: MessagingMessage[],
  currentUserId?: number,
  lastReadSequence?: number | null
): MessagingTimelineItem[] {
  const items: MessagingTimelineItem[] = [];
  let previousDate: string | null = null;
  let unreadInserted = false;

  messages.forEach((message, index) => {
    const date = localDateKey(message.createdAt);
    const dateBoundary = date !== previousDate;
    if (dateBoundary) {
      items.push({ kind: 'date', key: `date:${date}`, date });
      previousDate = date;
    }

    const unreadBoundary =
      !unreadInserted &&
      lastReadSequence != null &&
      message.sequence != null &&
      message.sequence > lastReadSequence &&
      message.senderUserId !== currentUserId;
    if (unreadBoundary) {
      items.push({ kind: 'unread', key: `unread:${message.messageId}` });
      unreadInserted = true;
    }

    const previous = messages[index - 1];
    const next = messages[index + 1];
    const nextStartsUnread =
      !unreadInserted &&
      lastReadSequence != null &&
      next?.sequence != null &&
      next.sequence > lastReadSequence &&
      next.senderUserId !== currentUserId;
    items.push({
      kind: 'message',
      key: message.messageId,
      message,
      groupedWithPrevious: !dateBoundary && !unreadBoundary && canGroup(previous, message),
      groupedWithNext: !nextStartsUnread && canGroup(message, next),
    });
  });

  return items;
}

export function formatMessagingTimelineDate(value: string, language: string) {
  const date = new Date(`${value}T00:00:00`);
  return formatDate(
    date,
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
    resolveSupportedLocale(language)
  );
}
