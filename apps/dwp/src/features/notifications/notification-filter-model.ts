import type {
  NotificationItem,
  NotificationPriority,
  NotificationReasonKind,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const NOTIFICATION_CONTEXT_KINDS = ['ACTOR', 'THREAD', 'RESOURCE', 'TOPIC_TOKEN'] as const;
export const MAX_NOTIFICATION_CONTEXT_FILTERS = 5;
export const NOTIFICATION_INCLUDED_TYPES = [
  'DIRECT',
  'MENTION',
  'ASSIGNED',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
] as const;
export const MAX_NOTIFICATION_INCLUDED_TYPES = 5;
export const NOTIFICATION_CONTEXT_MATCH = 'ALL_KINDS_ANY_VALUE' as const;

export type NotificationContextKind = (typeof NOTIFICATION_CONTEXT_KINDS)[number];
export type NotificationIncludedType = (typeof NOTIFICATION_INCLUDED_TYPES)[number];
export type NotificationContextFilter = {
  kind: NotificationContextKind;
  key: string;
  label: string;
};
export type NotificationContextOption = NotificationContextFilter;

export type CenterFilters = {
  query: string;
  appKey: string;
  priority: NotificationPriority | 'ALL';
  readState: 'ALL' | 'UNREAD' | 'READ';
  reason: NotificationReasonKind | 'ALL';
  attentionEffect: 'ALL' | 'PRIORITIZE';
  includedTypes: NotificationIncludedType[];
  contextFilters: NotificationContextFilter[];
};

export type NotificationCenterScope = CenterFilters & { view: NotificationView };

export const EMPTY_NOTIFICATION_FILTERS: CenterFilters = {
  query: '',
  appKey: '',
  priority: 'ALL',
  readState: 'ALL',
  reason: 'ALL',
  attentionEffect: 'ALL',
  includedTypes: [],
  contextFilters: [],
};

export const NOTIFICATION_REASONS: readonly NotificationReasonKind[] = [
  'MENTION',
  'DIRECT',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
];

export function hasNotificationFilters(filters: CenterFilters): boolean {
  return Boolean(
    filters.query.trim() ||
    filters.appKey ||
    filters.priority !== 'ALL' ||
    filters.readState !== 'ALL' ||
    filters.reason !== 'ALL' ||
    filters.attentionEffect !== 'ALL' ||
    (filters.includedTypes?.length ?? 0) > 0 ||
    filters.contextFilters.length > 0
  );
}

export function notificationFiltersForView(
  filters: CenterFilters,
  view: NotificationView
): CenterFilters {
  // Mentions is a recipient-reason view; discard a contradictory reason, not unread/app scope.
  if (view === 'MENTIONS') return { ...filters, reason: 'ALL', includedTypes: [] };
  return filters.includedTypes ? filters : { ...filters, includedTypes: [] };
}

export function canonicalNotificationIncludedTypes(
  values: readonly NotificationIncludedType[]
): NotificationIncludedType[] | null {
  if (values.length > MAX_NOTIFICATION_INCLUDED_TYPES) return null;
  const unique = new Set(values);
  if (unique.size !== values.length) return null;
  if ([...unique].some((value) => !NOTIFICATION_INCLUDED_TYPES.includes(value))) return null;
  return [...unique].sort(
    (left, right) =>
      NOTIFICATION_INCLUDED_TYPES.indexOf(left) - NOTIFICATION_INCLUDED_TYPES.indexOf(right)
  );
}

export function notificationContextOptions(
  items: readonly Pick<NotificationItem, 'threadKey' | 'title'>[]
): NotificationContextOption[] {
  const options = new Map<string, NotificationContextOption>();
  for (const item of items) {
    const key = item.threadKey?.trim();
    if (!key || key.length > 300) continue;
    options.set(`THREAD\u0000${key}`, { kind: 'THREAD', key, label: item.title });
  }
  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
}

const OPAQUE_CONTEXT_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,299}$/u;
const TOPIC_CONTEXT_KEY = /^[a-z0-9][a-z0-9._-]{0,159}$/u;

export function isCanonicalNotificationContext(
  context: Pick<NotificationContextFilter, 'kind' | 'key'>
): boolean {
  if (!NOTIFICATION_CONTEXT_KINDS.includes(context.kind)) return false;
  const pattern = context.kind === 'TOPIC_TOKEN' ? TOPIC_CONTEXT_KEY : OPAQUE_CONTEXT_KEY;
  return context.key === context.key.trim() && pattern.test(context.key);
}

/**
 * Context matching is OR within one kind and AND across distinct kinds.
 * Sorting makes URLs, cache keys, and saved-view payloads deterministic.
 */
export function canonicalNotificationContextFilters(
  contexts: readonly NotificationContextFilter[]
): NotificationContextFilter[] | null {
  if (contexts.length > MAX_NOTIFICATION_CONTEXT_FILTERS) return null;
  const unique = new Set<string>();
  const normalized: NotificationContextFilter[] = [];
  for (const context of contexts) {
    if (!isCanonicalNotificationContext(context)) return null;
    const identity = `${context.kind}\u0000${context.key}`;
    if (unique.has(identity)) return null;
    unique.add(identity);
    const label = context.label.trim();
    if (label.length > 160) return null;
    normalized.push({ ...context, label });
  }
  return normalized.sort(
    (left, right) =>
      NOTIFICATION_CONTEXT_KINDS.indexOf(left.kind) -
        NOTIFICATION_CONTEXT_KINDS.indexOf(right.kind) || left.key.localeCompare(right.key)
  );
}

export function notificationQueryFacets(
  includedTypes: CenterFilters['includedTypes'],
  contextFilters: CenterFilters['contextFilters']
) {
  const contexts = canonicalNotificationContextFilters(contextFilters);
  return {
    includedTypes: canonicalNotificationIncludedTypes(includedTypes) ?? includedTypes,
    contexts: (contexts ?? contextFilters).map(({ kind, key }) => ({ kind, key })),
  };
}
