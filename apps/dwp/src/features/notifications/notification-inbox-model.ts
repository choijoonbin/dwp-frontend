import { notificationMatchesView } from './notification-model';

import type { NotificationCenterGrouping } from './notification-saved-view-model';
import type {
  NotificationInboxPage,
  NotificationIncludedType,
  NotificationItem,
  NotificationPriority,
  NotificationReasonKind,
  NotificationSummary,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export type NotificationStreamGroupKey = 'ACTION_REQUIRED' | 'CONVERSATIONS' | 'UPDATES';

export type NotificationStreamGroup = {
  key: NotificationStreamGroupKey;
  items: NotificationItem[];
};

export type NotificationPresentationGroup = {
  key: string;
  label: string | null;
  items: NotificationItem[];
};

export type NotificationPresentationGroupLabels = {
  context: string;
  sourceFallback: string;
};

export type NotificationKpiKey = 'ACTIONABLE' | 'UNREAD' | 'MENTIONS' | 'SNOOZED';

export type NotificationInboxFilterScope = {
  view?: NotificationView;
  query?: string;
  appKey?: string;
  priority?: NotificationPriority | 'ALL';
  readState?: 'ALL' | 'UNREAD' | 'READ';
  reason?: NotificationReasonKind | 'ALL';
  attentionEffect?: 'ALL' | 'PRIORITIZE';
  includedTypes?: readonly NotificationIncludedType[];
};

export type MessagingReplyTarget = {
  conversationId: string;
  replyToMessageId?: string;
};

export function mergeNotificationInboxPages(
  pages: readonly (NotificationInboxPage | undefined)[],
  limit: number
): NotificationInboxPage | undefined {
  const base = pages.find((page): page is NotificationInboxPage => Boolean(page));
  if (!base) return undefined;

  const seen = new Set<string>();
  const items = pages
    .flatMap((page) => page?.items ?? [])
    .filter((item) => {
      if (seen.has(item.notificationId)) return false;
      seen.add(item.notificationId);
      return true;
    })
    .slice(0, Math.max(0, limit));
  const unavailableSources = [...new Set(pages.flatMap((page) => page?.unavailableSources ?? []))];

  return {
    ...base,
    items,
    partial: pages.some((page) => page?.partial),
    unavailableSources,
  };
}

const SAFE_TARGET_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const SAFE_CONTEXT_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/u;
const MACHINE_REFERENCE =
  /^(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$)/iu;

const DEFAULT_PRESENTATION_GROUP_LABELS: NotificationPresentationGroupLabels = {
  context: 'context',
  sourceFallback: 'Other source',
};

function safeDisplayLabel(value?: string | null): string | null {
  const label = value?.trim();
  const hasControlCharacter = [...(label ?? '')].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
  if (!label || label.length > 120 || MACHINE_REFERENCE.test(label) || hasControlCharacter) {
    return null;
  }
  return label;
}

export function displayNotificationActorLabel(value?: string | null): string | null {
  return safeDisplayLabel(value);
}

export function groupNotificationStream(
  items: readonly NotificationItem[]
): NotificationStreamGroup[] {
  const groups: Record<NotificationStreamGroupKey, NotificationItem[]> = {
    ACTION_REQUIRED: [],
    CONVERSATIONS: [],
    UPDATES: [],
  };

  for (const item of items) {
    if (item.actionable) groups.ACTION_REQUIRED.push(item);
    else if (item.reason.kind === 'MENTION' || isConversationSource(item.source.appKey)) {
      groups.CONVERSATIONS.push(item);
    } else groups.UPDATES.push(item);
  }

  return (Object.entries(groups) as Array<[NotificationStreamGroupKey, NotificationItem[]]>)
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([key, groupItems]) => ({ key, items: groupItems }));
}

type PresentationBucket = {
  internalKey: string;
  sourceKey: string;
  sourceLabel: string;
  contextReference: string | null;
  items: NotificationItem[];
};

function stableTextCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function notificationSourceMetadata(
  item: NotificationItem,
  labels: NotificationPresentationGroupLabels
): { key: string; label: string } {
  const appKey = item.source.appKey.trim().toLocaleLowerCase('en-US');
  const label = safeDisplayLabel(item.source.appName) ?? labels.sourceFallback;
  return {
    key: appKey || `label:${label.toLocaleLowerCase('en-US')}`,
    label,
  };
}

function notificationContextReference(item: NotificationItem): string | null {
  const reference = item.threadKey?.trim();
  return reference && SAFE_CONTEXT_REFERENCE.test(reference) ? reference : null;
}

function presentationBuckets(
  items: readonly NotificationItem[],
  grouping: Exclude<NotificationCenterGrouping, 'NONE'>,
  labels: NotificationPresentationGroupLabels
): PresentationBucket[] {
  const buckets = new Map<string, PresentationBucket>();
  for (const item of items) {
    const source = notificationSourceMetadata(item, labels);
    const contextReference = grouping === 'CONTEXT' ? notificationContextReference(item) : null;
    const internalKey = contextReference
      ? `${source.key}\u0000context\u0000${contextReference}`
      : `${source.key}\u0000source`;
    const current = buckets.get(internalKey);
    if (current) {
      current.items.push(item);
      if (stableTextCompare(source.label, current.sourceLabel) < 0) {
        current.sourceLabel = source.label;
      }
      continue;
    }
    buckets.set(internalKey, {
      internalKey,
      sourceKey: source.key,
      sourceLabel: source.label,
      contextReference,
      items: [item],
    });
  }

  return [...buckets.values()].sort(
    (left, right) =>
      stableTextCompare(left.sourceLabel, right.sourceLabel) ||
      stableTextCompare(left.sourceKey, right.sourceKey) ||
      Number(Boolean(left.contextReference)) - Number(Boolean(right.contextReference)) ||
      stableTextCompare(left.internalKey, right.internalKey)
  );
}

export function groupNotificationItemsForPresentation(
  items: readonly NotificationItem[],
  grouping: NotificationCenterGrouping,
  labelOverrides: Partial<NotificationPresentationGroupLabels> = {}
): NotificationPresentationGroup[] {
  if (items.length === 0) return [];
  if (grouping === 'NONE') return [{ key: 'all', label: null, items: [...items] }];

  const labels = { ...DEFAULT_PRESENTATION_GROUP_LABELS, ...labelOverrides };
  const buckets = presentationBuckets(items, grouping, labels);
  if (grouping === 'SOURCE') {
    return buckets.map((bucket, index) => ({
      key: `source-${index}`,
      label: bucket.sourceLabel,
      items: bucket.items,
    }));
  }

  const contextCounts = new Map<string, number>();
  for (const bucket of buckets) {
    if (!bucket.contextReference) continue;
    contextCounts.set(bucket.sourceKey, (contextCounts.get(bucket.sourceKey) ?? 0) + 1);
  }
  const contextOrdinals = new Map<string, number>();
  return buckets.map((bucket, index) => {
    if (!bucket.contextReference) {
      return { key: `context-${index}`, label: bucket.sourceLabel, items: bucket.items };
    }
    const ordinal = (contextOrdinals.get(bucket.sourceKey) ?? 0) + 1;
    contextOrdinals.set(bucket.sourceKey, ordinal);
    const suffix = (contextCounts.get(bucket.sourceKey) ?? 0) > 1 ? ` ${ordinal}` : '';
    return {
      key: `context-${index}`,
      label: `${bucket.sourceLabel} ${labels.context}${suffix}`,
      items: bucket.items,
    };
  });
}

export function orderNotificationItemsForPresentation(
  items: readonly NotificationItem[],
  grouping: NotificationCenterGrouping
): NotificationItem[] {
  return groupNotificationItemsForPresentation(items, grouping).flatMap((group) => group.items);
}

export function kpiView(key: NotificationKpiKey): {
  view: NotificationView;
  readState: 'ALL' | 'UNREAD';
} {
  if (key === 'UNREAD') return { view: 'ALL', readState: 'UNREAD' };
  if (key === 'MENTIONS') return { view: 'MENTIONS', readState: 'ALL' };
  if (key === 'SNOOZED') return { view: 'SNOOZED', readState: 'ALL' };
  return { view: 'PRIORITY', readState: 'ALL' };
}

export function notificationKpiCount(
  summary: NotificationSummary,
  key: NotificationKpiKey
): number {
  if (key === 'ACTIONABLE') return summary.viewCounts.PRIORITY;
  if (key === 'UNREAD') return summary.totalUnread;
  if (key === 'MENTIONS') return summary.viewCounts.MENTIONS;
  return summary.viewCounts.SNOOZED;
}

export function notificationMatchesInboxScope(
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): boolean {
  if (!notificationMatchesView(item, scope.view ?? 'PRIORITY')) return false;
  if (scope.readState === 'UNREAD' && item.readAt) return false;
  if (scope.readState === 'READ' && !item.readAt) return false;
  if (scope.priority && scope.priority !== 'ALL' && item.priority !== scope.priority) return false;
  if (scope.reason && scope.reason !== 'ALL' && item.reason.kind !== scope.reason) return false;
  if (scope.attentionEffect === 'PRIORITIZE' && item.attentionEffect !== 'PRIORITIZE') {
    return false;
  }
  if (scope.includedTypes?.length) {
    const includedType = item.reason.kind === 'ROLE' ? 'ASSIGNED' : item.reason.kind;
    if (!scope.includedTypes.includes(includedType as NotificationIncludedType)) return false;
  }
  if (
    scope.appKey &&
    item.source.appKey.toLocaleLowerCase('en-US') !== scope.appKey.toLocaleLowerCase('en-US')
  ) {
    return false;
  }
  const query = scope.query?.trim().toLocaleLowerCase('en-US');
  if (!query) return true;
  return [
    item.title,
    item.preview,
    item.actorLabel,
    item.source.appKey,
    item.source.appName,
    item.typeKey,
  ].some((value) => value?.toLocaleLowerCase('en-US').includes(query));
}

export function isNotificationShortcutTarget(target: EventTarget | null): boolean {
  const element = target as (EventTarget & { closest?: (selectors: string) => unknown }) | null;
  if (!element || typeof element.closest !== 'function') return false;
  if (element.closest('button, a[href]') && !element.closest('[data-notification-focus-id]')) {
    return true;
  }
  return Boolean(
    element.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], [role="menu"]'
    )
  );
}

export function resolveMessagingReplyTarget(item: NotificationItem): MessagingReplyTarget | null {
  if (
    !isConversationSource(item.source.appKey) ||
    !item.typeKey.toUpperCase().startsWith('MESSAGING.')
  ) {
    return null;
  }
  const href = item.actions.find((action) => action.enabled && action.href)?.href;
  if (!href) return null;

  try {
    const target = new URL(href, 'https://dwp.invalid');
    if (target.origin !== 'https://dwp.invalid') return null;
    if (target.pathname !== '/messages/inbox' && target.pathname !== '/messages/direct')
      return null;
    const conversationId = target.searchParams.get('conversation') ?? '';
    const messageId = target.searchParams.get('message') ?? undefined;
    if (!SAFE_TARGET_ID.test(conversationId)) return null;
    if (messageId && !SAFE_TARGET_ID.test(messageId)) return null;
    return {
      conversationId,
      ...(messageId ? { replyToMessageId: messageId } : {}),
    };
  } catch {
    return null;
  }
}

export function optimisticNotificationSummary(
  summary: NotificationSummary,
  before: NotificationItem,
  after: NotificationItem
): NotificationSummary {
  const viewCounts = { ...summary.viewCounts };
  for (const view of ['PRIORITY', 'ALL', 'MENTIONS', 'SAVED', 'SNOOZED', 'DONE'] as const) {
    const delta =
      Number(notificationMatchesView(after, view)) - Number(notificationMatchesView(before, view));
    viewCounts[view] = Math.max(0, viewCounts[view] + delta);
  }

  const beforeUnread = countsAsUnread(before);
  const afterUnread = countsAsUnread(after);
  const beforeActionableUnread = beforeUnread && before.actionable;
  const afterActionableUnread = afterUnread && after.actionable;
  return {
    ...summary,
    totalUnread: Math.max(0, summary.totalUnread + Number(afterUnread) - Number(beforeUnread)),
    actionableUnread: Math.max(
      0,
      summary.actionableUnread + Number(afterActionableUnread) - Number(beforeActionableUnread)
    ),
    viewCounts,
  };
}

function isConversationSource(appKey: string): boolean {
  return ['messaging', 'spaces', 'space'].includes(appKey.toLocaleLowerCase('en-US'));
}

function countsAsUnread(item: NotificationItem): boolean {
  return !item.readAt && !item.completedAt && !item.snoozedUntil;
}
