import {
  canonicalNotificationIncludedTypes,
  canonicalNotificationContextFilters,
  EMPTY_NOTIFICATION_FILTERS,
  NOTIFICATION_CONTEXT_MATCH,
  notificationFiltersForView,
  type CenterFilters,
  type NotificationContextFilter,
  type NotificationCenterScope,
} from './notification-filter-model';

import type { GovernedSavedView, SavedViewConfiguration } from '@dwp-frontend/shared-utils';
import type {
  NotificationPriority,
  NotificationReasonKind,
  NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';

export const NOTIFICATION_SAVED_VIEW_SURFACE = 'notifications.work';
export const MAX_NOTIFICATION_SAVED_VIEWS = 20;
export const MAX_NOTIFICATION_PINNED_VIEWS = 8;

const CONTRACT = 'dwp.notifications.center.saved-view';
const VERSION = 5;
export type NotificationCenterDensity = 'DENSE' | 'DETAILED';
export type NotificationCenterGrouping = 'NONE' | 'SOURCE' | 'CONTEXT';
export const NOTIFICATION_SAVED_VIEW_ICONS = [
  'BELL',
  'INBOX',
  'AT_SIGN',
  'BOLT',
  'BOOKMARK',
] as const;
export const NOTIFICATION_SAVED_VIEW_COLORS = ['BLUE', 'TEAL', 'VIOLET', 'AMBER', 'RED'] as const;
export type NotificationSavedViewIcon = (typeof NOTIFICATION_SAVED_VIEW_ICONS)[number];
export type NotificationSavedViewColor = (typeof NOTIFICATION_SAVED_VIEW_COLORS)[number];
export type NotificationCenterPresentation = {
  density: NotificationCenterDensity;
  grouping: NotificationCenterGrouping;
  icon: NotificationSavedViewIcon;
  color: NotificationSavedViewColor;
  displayOrder: number;
};
export type ParsedNotificationSavedViewConfiguration = {
  scope: NotificationCenterScope;
  presentation: NotificationCenterPresentation;
};

export const DEFAULT_NOTIFICATION_CENTER_PRESENTATION: NotificationCenterPresentation = {
  density: 'DETAILED',
  grouping: 'NONE',
  icon: 'BELL',
  color: 'BLUE',
  displayOrder: 0,
};

const DENSITIES = new Set<NotificationCenterDensity>(['DENSE', 'DETAILED']);
const GROUPINGS = new Set<NotificationCenterGrouping>(['NONE', 'SOURCE', 'CONTEXT']);
const ICONS = new Set<NotificationSavedViewIcon>(NOTIFICATION_SAVED_VIEW_ICONS);
const COLORS = new Set<NotificationSavedViewColor>(NOTIFICATION_SAVED_VIEW_COLORS);
const VIEWS = new Set<NotificationView>([
  'PRIORITY',
  'ALL',
  'MENTIONS',
  'SAVED',
  'SNOOZED',
  'DONE',
]);
const READ_STATES = new Set<CenterFilters['readState']>(['ALL', 'UNREAD', 'READ']);
const PRIORITIES = new Set<NotificationPriority | 'ALL'>([
  'ALL',
  'URGENT',
  'HIGH',
  'NORMAL',
  'LOW',
]);
const REASONS = new Set<NotificationReasonKind | 'ALL'>([
  'ALL',
  'MENTION',
  'DIRECT',
  'ROLE',
  'ORGANIZATION',
  'SUBSCRIPTION',
  'MANDATORY_POLICY',
]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : null;
}

export function notificationSavedViewConfiguration(
  scope: NotificationCenterScope,
  presentation: NotificationCenterPresentation = DEFAULT_NOTIFICATION_CENTER_PRESENTATION
): SavedViewConfiguration {
  const filters = notificationFiltersForView(scope, scope.view);
  const canonicalContexts = canonicalNotificationContextFilters(filters.contextFilters);
  const canonicalTypes = canonicalNotificationIncludedTypes(filters.includedTypes);
  return {
    contract: CONTRACT,
    version: VERSION,
    scope: {
      view: scope.view,
      query: filters.query.trim(),
      appKey: filters.appKey.trim(),
      priority: filters.priority,
      readState: filters.readState,
      reason: filters.reason,
      attentionEffect: filters.attentionEffect,
    },
    presentation: {
      density: presentation.density,
      grouping: presentation.grouping,
      icon: presentation.icon,
      color: presentation.color,
      displayOrder: presentation.displayOrder,
    },
    includedTypes: canonicalTypes ?? filters.includedTypes,
    contextMatch: NOTIFICATION_CONTEXT_MATCH,
    contextFilters: (canonicalContexts ?? filters.contextFilters).map((context) => ({
      ...context,
    })),
  };
}

export function migrateNotificationSavedViewConfiguration(
  configuration: SavedViewConfiguration
): SavedViewConfiguration | null {
  if (configuration.contract !== CONTRACT) return null;
  if (configuration.version === VERSION) return { ...configuration };
  if (
    configuration.version !== 1 &&
    configuration.version !== 2 &&
    configuration.version !== 3 &&
    configuration.version !== 4
  ) {
    return null;
  }

  const priorPresentation =
    configuration.version === 1
      ? DEFAULT_NOTIFICATION_CENTER_PRESENTATION
      : configuration.presentation;
  const presentation = isRecord(priorPresentation) ? priorPresentation : {};

  return {
    ...configuration,
    version: VERSION,
    presentation: {
      ...presentation,
      icon: presentation.icon ?? DEFAULT_NOTIFICATION_CENTER_PRESENTATION.icon,
      color: presentation.color ?? DEFAULT_NOTIFICATION_CENTER_PRESENTATION.color,
      displayOrder: DEFAULT_NOTIFICATION_CENTER_PRESENTATION.displayOrder,
    },
    includedTypes: configuration.version === 4 ? configuration.includedTypes : [],
    contextMatch: NOTIFICATION_CONTEXT_MATCH,
    contextFilters: configuration.version === 1 ? [] : configuration.contextFilters,
  };
}

export function parseNotificationSavedViewConfiguration(
  configuration: SavedViewConfiguration
): ParsedNotificationSavedViewConfiguration | null {
  const migrated = migrateNotificationSavedViewConfiguration(configuration);
  if (!migrated) return null;
  const candidate = migrated.scope;
  const presentationCandidate = migrated.presentation;
  const contextCandidate = migrated.contextFilters ?? [];
  const includedTypeCandidate = migrated.includedTypes ?? [];
  const contextMatch = migrated.contextMatch;
  if (!isRecord(candidate)) return null;
  if (!isRecord(presentationCandidate)) return null;
  if (!Array.isArray(contextCandidate) || contextCandidate.length > 5) return null;

  const view = candidate.view;
  const readState = candidate.readState;
  const priority = candidate.priority;
  const reason = candidate.reason;
  const attentionEffect = candidate.attentionEffect ?? 'ALL';
  const query = boundedString(candidate.query, 200);
  const appKey = boundedString(candidate.appKey, 120);
  const density = presentationCandidate.density;
  const grouping = presentationCandidate.grouping;
  const icon = presentationCandidate.icon;
  const color = presentationCandidate.color;
  const displayOrder = presentationCandidate.displayOrder;
  const canonicalTypes = Array.isArray(includedTypeCandidate)
    ? canonicalNotificationIncludedTypes(
        includedTypeCandidate as NotificationCenterScope['includedTypes']
      )
    : null;
  const contexts = contextCandidate.map((context): NotificationContextFilter | null => {
    if (!isRecord(context)) return null;
    const kind = context.kind;
    const key = typeof context.key === 'string' && context.key.length <= 300 ? context.key : null;
    const label = boundedString(context.label, 160);
    if (typeof kind !== 'string' || !key) return null;
    return {
      kind: kind as NotificationContextFilter['kind'],
      key,
      label: label ?? '',
    };
  });
  const canonicalContexts = contexts.some((context) => context == null)
    ? null
    : canonicalNotificationContextFilters(contexts as NotificationContextFilter[]);
  if (
    !VIEWS.has(view as NotificationView) ||
    !READ_STATES.has(readState as CenterFilters['readState']) ||
    !PRIORITIES.has(priority as NotificationPriority | 'ALL') ||
    !REASONS.has(reason as NotificationReasonKind | 'ALL') ||
    !DENSITIES.has(density as NotificationCenterDensity) ||
    !GROUPINGS.has(grouping as NotificationCenterGrouping) ||
    !ICONS.has(icon as NotificationSavedViewIcon) ||
    !COLORS.has(color as NotificationSavedViewColor) ||
    !Number.isInteger(displayOrder) ||
    Number(displayOrder) < 0 ||
    Number(displayOrder) > 99 ||
    !['ALL', 'PRIORITIZE'].includes(String(attentionEffect)) ||
    contextMatch !== NOTIFICATION_CONTEXT_MATCH ||
    query == null ||
    appKey == null ||
    canonicalTypes == null ||
    canonicalContexts == null
  ) {
    return null;
  }

  const filters = notificationFiltersForView(
    {
      ...EMPTY_NOTIFICATION_FILTERS,
      query,
      appKey,
      priority: priority as NotificationPriority | 'ALL',
      readState: readState as CenterFilters['readState'],
      reason: reason as NotificationReasonKind | 'ALL',
      attentionEffect: attentionEffect as CenterFilters['attentionEffect'],
      includedTypes: canonicalTypes,
      contextFilters: canonicalContexts,
    },
    view as NotificationView
  );
  return {
    scope: { ...filters, view: view as NotificationView },
    presentation: {
      density: density as NotificationCenterDensity,
      grouping: grouping as NotificationCenterGrouping,
      icon: icon as NotificationSavedViewIcon,
      color: color as NotificationSavedViewColor,
      displayOrder: Number(displayOrder),
    },
  };
}

export function notificationSavedViewConfigurationIdentity(
  configuration: SavedViewConfiguration
): string | null {
  const parsed = parseNotificationSavedViewConfiguration(configuration);
  if (!parsed) return null;
  return JSON.stringify(
    notificationSavedViewConfiguration(
      {
        ...parsed.scope,
        contextFilters: parsed.scope.contextFilters.map((context) => ({
          ...context,
          label: '',
        })),
      },
      { ...parsed.presentation, displayOrder: 0 }
    )
  );
}

export function notificationBuiltInSavedViews(names: {
  priority: string;
  unread: string;
  mentions: string;
}) {
  return [
    {
      id: 'notification-priority',
      name: names.priority,
      configuration: notificationSavedViewConfiguration({
        ...EMPTY_NOTIFICATION_FILTERS,
        view: 'PRIORITY',
      }),
      isDefault: true,
    },
    {
      id: 'notification-unread',
      name: names.unread,
      configuration: notificationSavedViewConfiguration({
        ...EMPTY_NOTIFICATION_FILTERS,
        view: 'ALL',
        readState: 'UNREAD',
      }),
    },
    {
      id: 'notification-mentions',
      name: names.mentions,
      configuration: notificationSavedViewConfiguration({
        ...EMPTY_NOTIFICATION_FILTERS,
        view: 'MENTIONS',
      }),
    },
  ];
}

export function orderNotificationSavedViews(
  views: readonly GovernedSavedView[]
): GovernedSavedView[] {
  return [...views].sort((left, right) => {
    if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
    const leftOrder = parseNotificationSavedViewConfiguration(left.configuration)?.presentation
      .displayOrder;
    const rightOrder = parseNotificationSavedViewConfiguration(right.configuration)?.presentation
      .displayOrder;
    return (
      (leftOrder ?? 99) - (rightOrder ?? 99) ||
      left.name.localeCompare(right.name) ||
      left.savedViewId.localeCompare(right.savedViewId)
    );
  });
}

export type NotificationSavedViewOrderUpdate = {
  view: GovernedSavedView;
  configuration: SavedViewConfiguration;
};

export function reorderNotificationPersonalSavedViews(
  views: readonly GovernedSavedView[],
  savedViewId: string,
  direction: -1 | 1
): NotificationSavedViewOrderUpdate[] {
  const target = views.find((view) => view.savedViewId === savedViewId);
  if (!target || target.scope !== 'PERSONAL' || !target.editable) return [];
  const reorderable = orderNotificationSavedViews(
    views.filter(
      (view) => view.scope === 'PERSONAL' && view.editable && view.favorite === target.favorite
    )
  );
  const from = reorderable.findIndex((view) => view.savedViewId === savedViewId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= reorderable.length) return [];
  [reorderable[from], reorderable[to]] = [reorderable[to]!, reorderable[from]!];
  return reorderable.flatMap((view, displayOrder) => {
    const parsed = parseNotificationSavedViewConfiguration(view.configuration);
    if (!parsed || parsed.presentation.displayOrder === displayOrder) return [];
    return [
      {
        view,
        configuration: notificationSavedViewConfiguration(parsed.scope, {
          ...parsed.presentation,
          displayOrder,
        }),
      },
    ];
  });
}

export function selectedNotificationBuiltInViewId(
  scope: NotificationCenterScope,
  presentation: NotificationCenterPresentation = DEFAULT_NOTIFICATION_CENTER_PRESENTATION
): string | null {
  if (
    presentation.density !== DEFAULT_NOTIFICATION_CENTER_PRESENTATION.density ||
    presentation.grouping !== DEFAULT_NOTIFICATION_CENTER_PRESENTATION.grouping ||
    presentation.icon !== DEFAULT_NOTIFICATION_CENTER_PRESENTATION.icon ||
    presentation.color !== DEFAULT_NOTIFICATION_CENTER_PRESENTATION.color
  ) {
    return null;
  }
  const canonical = notificationFiltersForView(scope, scope.view);
  const filtersAreEmpty =
    !canonical.query.trim() &&
    !canonical.appKey &&
    canonical.priority === 'ALL' &&
    canonical.readState === 'ALL' &&
    canonical.reason === 'ALL' &&
    canonical.attentionEffect === 'ALL' &&
    canonical.includedTypes.length === 0;
  const contextIsEmpty = canonical.contextFilters.length === 0;
  if (filtersAreEmpty && contextIsEmpty && ['PRIORITY', 'MENTIONS'].includes(scope.view)) {
    return `notification-${scope.view.toLocaleLowerCase('en-US')}`;
  }
  if (
    scope.view === 'ALL' &&
    !canonical.query.trim() &&
    !canonical.appKey &&
    canonical.priority === 'ALL' &&
    canonical.readState === 'UNREAD' &&
    canonical.reason === 'ALL' &&
    canonical.attentionEffect === 'ALL' &&
    canonical.includedTypes.length === 0 &&
    contextIsEmpty
  ) {
    return 'notification-unread';
  }
  return null;
}
