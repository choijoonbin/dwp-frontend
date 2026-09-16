import {
  createHomeModeLayouts,
  parseAppNotificationSummary,
  type AppNotificationSummary,
  type HomeExperience,
  type HomeOverview,
  type HomeOverviewSection,
  type HomeRecommendation,
  type HomeV2ReadModel,
  type HomeV2Widget,
} from '@dwp-frontend/shared-utils';

import {
  HOME_APPS,
  HOME_APP_GROUPS,
} from '../../../components/workspace-composer/app-launchpad-model';
import {
  normalizeWorkspaceActivityFeed,
  normalizeWorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils/api/workspace-api';

import type { CalendarHome } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { CommunicationFeed } from '@dwp-frontend/shared-utils/api/communication-api';
import type {
  RawWorkspaceActivityFeed,
  RawWorkspaceWorkQueue,
  WorkspaceActivityFeed,
  WorkspaceWorkQueue,
} from '@dwp-frontend/shared-utils/api/workspace-api';

const NATIVE_WIDGET_KEYS = {
  activity: 'core.activity.activity',
  calendar: ['core.calendar.schedule', 'core.calendar.meeting-load'],
  recommendations: 'core.workspace.daily-brief',
  work: ['core.workspace.command-rail', 'core.work.focus', 'core.work.focus-balance'],
} as const;

const HOME_V2_GROUP_IDS = {
  WORK_START: 'work',
  COLLABORATION: 'connect',
  PEOPLE_SERVICES: 'services',
  SYSTEM_CONTROL: 'systems',
} as const;

function localGroupId(value: string) {
  return HOME_V2_GROUP_IDS[value as keyof typeof HOME_V2_GROUP_IDS];
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2_048;
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function instant(value: unknown): value is string {
  return (
    text(value) &&
    /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function stringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function rawWorkItem(value: unknown): boolean {
  const item = object(value);
  const capabilities = object(item?.capabilities);
  return Boolean(
    item &&
    text(item.workItemId) &&
    text(item.id) &&
    text(item.title) &&
    ['APPROVAL', 'TASK', 'SERVICE', 'REQUIRED', 'REVIEW'].includes(String(item.type)) &&
    ['HIGH', 'MEDIUM', 'LOW'].includes(String(item.priority)) &&
    ['DUE_SOON', 'IN_PROGRESS', 'WAITING', 'COMPLETED'].includes(String(item.status)) &&
    text(item.owner) &&
    text(item.sourceSystem) &&
    integer(item.version) &&
    instant(item.updatedAt) &&
    stringOrNull(item.summary) &&
    (item.dueAt === undefined || item.dueAt === null || instant(item.dueAt)) &&
    (item.sourceRoute === undefined ||
      item.sourceRoute === null ||
      safeInternalRoute(item.sourceRoute)) &&
    (!item.capabilities ||
      (capabilities &&
        typeof capabilities.canStart === 'boolean' &&
        typeof capabilities.canComplete === 'boolean' &&
        (capabilities.canWait === undefined || typeof capabilities.canWait === 'boolean')))
  );
}

function normalizeWorkQueue(value: unknown): WorkspaceWorkQueue | null {
  const data = object(value);
  const summary = object(data?.summary);
  if (
    !data ||
    !summary ||
    !['total', 'dueSoon', 'inProgress', 'waiting', 'completed'].every((key) =>
      integer(summary[key])
    ) ||
    !Array.isArray(data.items) ||
    !data.items.every(rawWorkItem) ||
    !instant(data.generatedAt)
  ) {
    return null;
  }
  return normalizeWorkspaceWorkQueue(data as RawWorkspaceWorkQueue);
}

function calendarEvent(value: unknown): boolean {
  const event = object(value);
  const capabilities = object(event?.capabilities);
  return Boolean(
    event &&
    text(event.eventId) &&
    text(event.calendarId) &&
    text(event.calendarName) &&
    text(event.calendarColor) &&
    text(event.organizerName) &&
    text(event.title) &&
    ['MEETING', 'FOCUS', 'TASK', 'OUT_OF_OFFICE', 'REMINDER'].includes(String(event.type)) &&
    instant(event.startsAt) &&
    instant(event.endsAt) &&
    text(event.timeZone) &&
    typeof event.allDay === 'boolean' &&
    ['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(String(event.status)) &&
    ['DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL'].includes(String(event.visibility)) &&
    ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'].includes(String(event.recurrence)) &&
    integer(event.recurrenceInterval) &&
    typeof event.responseRequired === 'boolean' &&
    Array.isArray(event.attendees) &&
    event.attendees.every((item) => {
      const attendee = object(item);
      return Boolean(
        attendee &&
        text(attendee.email) &&
        text(attendee.name) &&
        ['REQUIRED', 'OPTIONAL', 'RESOURCE'].includes(String(attendee.type)) &&
        ['NEEDS_ACTION', 'ACCEPTED', 'TENTATIVE', 'DECLINED'].includes(String(attendee.response))
      );
    }) &&
    typeof event.conflict === 'boolean' &&
    integer(event.version) &&
    (!event.capabilities ||
      (capabilities &&
        ['canViewDetails', 'canEdit', 'canDelete', 'canRestore', 'canRespond', 'canStar'].every(
          (key) => typeof capabilities[key] === 'boolean'
        )))
  );
}

function normalizeCalendar(value: unknown): CalendarHome | null {
  const data = object(value);
  const metrics = object(data?.metrics);
  const metricKeys = [
    'eventCount',
    'meetingMinutes',
    'focusMinutes',
    'focusTargetMinutes',
    'conflictCount',
    'awaitingResponseCount',
    'availableRoomCount',
  ];
  if (
    !data ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(String(data.date)) ||
    !text(data.timeZone) ||
    !metrics ||
    !metricKeys.every((key) => integer(metrics[key])) ||
    (data.nextEvent !== undefined && data.nextEvent !== null && !calendarEvent(data.nextEvent)) ||
    !Array.isArray(data.today) ||
    !data.today.every(calendarEvent) ||
    !Array.isArray(data.weekLoad) ||
    !data.weekLoad.every((item) => {
      const day = object(item);
      return Boolean(
        day &&
        /^\d{4}-\d{2}-\d{2}$/u.test(String(day.date)) &&
        ['meetingMinutes', 'focusMinutes', 'eventCount', 'conflictCount', 'loadPercent'].every(
          (key) => integer(day[key])
        )
      );
    }) ||
    !Array.isArray(data.attention) ||
    !data.attention.every((item) => {
      const attention = object(item);
      return Boolean(
        attention &&
        text(attention.key) &&
        ['LOW', 'MEDIUM', 'HIGH'].includes(String(attention.severity)) &&
        text(attention.title) &&
        text(attention.description) &&
        safeInternalRoute(attention.actionPath)
      );
    }) ||
    !instant(data.generatedAt)
  ) {
    return null;
  }
  return data as CalendarHome;
}

function normalizeActivity(value: unknown): WorkspaceActivityFeed | null {
  try {
    return normalizeWorkspaceActivityFeed(value as RawWorkspaceActivityFeed);
  } catch {
    return null;
  }
}

function availableWidget(
  widgets: readonly HomeV2Widget[],
  definitionKeys: string | readonly string[]
): HomeV2Widget | undefined {
  const keys = typeof definitionKeys === 'string' ? [definitionKeys] : definitionKeys;
  return widgets.find(
    (widget) =>
      keys.includes(widget.definitionKey) &&
      (widget.state === 'AVAILABLE' || widget.state === 'PARTIAL' || widget.state === 'STALE')
  );
}

function section<T>(
  model: HomeV2ReadModel,
  definitionKeys: string | readonly string[],
  normalize: (value: unknown) => T | null
): HomeOverviewSection<T> {
  const keys = typeof definitionKeys === 'string' ? [definitionKeys] : definitionKeys;
  const widget = availableWidget(model.widgets, keys);
  const data = normalize(widget?.payload.data);
  if (widget && data) {
    return {
      status: 'AVAILABLE',
      source: widget.source.sourceKey,
      generatedAt: widget.source.generatedAt,
      data,
      reason: widget.source.reasonCode,
    };
  }
  const state = model.widgets.find((candidate) => keys.includes(candidate.definitionKey));
  if (state?.state === 'EMPTY') {
    return {
      status: 'AVAILABLE',
      source: state.source.sourceKey,
      generatedAt: state.source.generatedAt,
      data: null,
      reason: state.source.reasonCode,
    };
  }
  return {
    status: state?.state === 'FORBIDDEN' ? 'FORBIDDEN' : 'UNAVAILABLE',
    source: state?.source.sourceKey ?? 'HOME_RUNTIME_V2',
    generatedAt: state?.source.generatedAt ?? model.generatedAt,
    data: null,
    reason: state?.source.reasonCode ?? 'HOME_RUNTIME_SOURCE_UNAVAILABLE',
  };
}

function safeInternalRoute(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    ![...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return character === '\\' || code <= 31 || code === 127;
    })
  );
}

function normalizeRecommendations(value: unknown): HomeRecommendation[] | null {
  return Array.isArray(value) &&
    value.every((item) => {
      const recommendation = object(item);
      return (
        recommendation &&
        text(recommendation.key) &&
        ['ACTION', 'SCHEDULE', 'COMMUNICATION', 'FOCUS'].includes(String(recommendation.kind)) &&
        ['HIGH', 'MEDIUM', 'LOW'].includes(String(recommendation.priority)) &&
        text(recommendation.title) &&
        text(recommendation.description) &&
        safeInternalRoute(recommendation.actionPath) &&
        text(recommendation.source) &&
        integer(recommendation.evidenceCount) &&
        ['HIGH', 'MEDIUM', 'LOW'].includes(String(recommendation.confidence))
      );
    })
    ? (value as HomeRecommendation[])
    : null;
}

export function homeV2ToOverview(model: HomeV2ReadModel): HomeOverview {
  return {
    audience: { profile: 'MEMBER', ruleVersion: model.changeVersion, reasons: [] },
    work: section(model, NATIVE_WIDGET_KEYS.work, normalizeWorkQueue),
    calendar: section(model, NATIVE_WIDGET_KEYS.calendar, normalizeCalendar),
    communications: {
      status: 'UNAVAILABLE',
      source: 'HOME_RUNTIME_V2',
      generatedAt: model.generatedAt,
      data: null as CommunicationFeed | null,
      reason: 'SOURCE_NOT_IN_HOME_READ_MODEL',
    },
    activity: section(model, NATIVE_WIDGET_KEYS.activity, normalizeActivity),
    recommendations: section(model, NATIVE_WIDGET_KEYS.recommendations, normalizeRecommendations),
    generatedAt: model.generatedAt,
  };
}

export function homeV2ToExperience(model: HomeV2ReadModel, locale: string): HomeExperience {
  const appById = new Map(HOME_APPS.map((app) => [app.id, app]));
  const groupById = new Map(HOME_APP_GROUPS.map((group) => [group.id, group]));
  const groups = model.appDock.flatMap((group, groupIndex) => {
    const groupKey = localGroupId(group.groupKey);
    return groupKey && groupById.has(groupKey)
      ? [
          {
            groupKey,
            labels: { [locale]: group.label },
            descriptions: {},
            sortOrder: (groupIndex + 1) * 10,
            enabled: true,
          },
        ]
      : [];
  });
  const placements = model.appDock.flatMap((group) =>
    group.apps.flatMap((entry, appIndex) => {
      const app = appById.get(entry.appKey);
      const groupKey = localGroupId(group.groupKey);
      return app &&
        groupKey &&
        app.groupId === groupKey &&
        app.route === entry.sourceRoute &&
        app.iconKey === entry.iconKey
        ? [
            {
              resourceKey: app.resourceKey,
              groupKey,
              sortOrder: (appIndex + 1) * 10,
            },
          ]
        : [];
    })
  );
  return {
    headline: model.shell.headline,
    subheadline: model.shell.subheadline,
    localizedContent: {
      [locale]: { headline: model.shell.headline, subheadline: model.shell.subheadline },
    },
    defaultLocale: locale,
    backgroundPosition: 'RIGHT',
    contentAlignment:
      model.shell.contentAlignment === 'CENTER' || model.shell.contentAlignment === 'RIGHT'
        ? model.shell.contentAlignment
        : 'LEFT',
    overlayOpacity: 18,
    backgroundUrl:
      model.shell.backgroundAssetRoute?.startsWith('/api/') === true
        ? model.shell.backgroundAssetRoute
        : null,
    launchpadConfiguration: { schemaVersion: 1, groups, placements },
    compositionPolicy: {
      schemaVersion: 4,
      experienceVariant: model.mode,
      personalCustomizationEnabled: false,
      governedZones: [],
      modeLayouts: createHomeModeLayouts(),
    },
    effectiveExperienceVariant: model.mode,
    advancedPersonalizationEnabled: false,
    composerEnabled: false,
    homePreferenceStore: 'LEGACY',
    homeContractCapabilities: [],
    version: model.view.revision,
    updatedAt: model.generatedAt,
  };
}

export function homeV2ToNotificationSummary(model: HomeV2ReadModel): AppNotificationSummary {
  const canonicalById = new Map(HOME_APPS.map((app) => [app.id, app]));
  const apps = model.appDock.flatMap((group) =>
    group.apps.flatMap((entry) => {
      const canonical = canonicalById.get(entry.appKey);
      const groupKey = localGroupId(group.groupKey);
      if (
        !canonical?.notificationSourceKey ||
        !groupKey ||
        canonical.groupId !== groupKey ||
        canonical.route !== entry.sourceRoute ||
        entry.badgeState !== 'AVAILABLE' ||
        !entry.badge
      ) {
        return [];
      }
      return [
        {
          appKey: canonical.notificationSourceKey,
          totalUnread: entry.badge.total,
          actionableUnread: entry.badge.urgent,
          urgentUnread: entry.badge.urgent,
          lastActivityAt: model.generatedAt,
        },
      ];
    })
  );
  const unavailable = model.appDock
    .flatMap((group) => group.apps)
    .filter((entry) => entry.badgeState === 'UNAVAILABLE')
    .map((entry) => `APP_DOCK_BADGE:${entry.appKey}`);
  const versions = model.appDock
    .flatMap((group) => group.apps)
    .flatMap((entry) => (entry.badge?.version ? [entry.badge.version] : []));
  return parseAppNotificationSummary({
    partial: unavailable.length > 0,
    unavailableSources: unavailable,
    apps,
    changeVersion: versions.sort().at(-1) ?? '0',
    counterVersion: versions.sort().at(-1) ?? '0',
    generatedAt: model.generatedAt,
  });
}
