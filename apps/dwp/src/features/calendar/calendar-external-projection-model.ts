import type {
  CalendarEvent,
  CalendarEventImportance,
  CalendarExternalEvent,
  CalendarExternalProjection,
  CalendarExternalProvider,
  CalendarSummary,
  CalendarVisibility,
} from '@dwp-frontend/shared-utils';

const PROVIDER = {
  MICROSOFT_365: { name: 'Microsoft 365', color: '#0078D4' },
  GOOGLE_WORKSPACE: { name: 'Google Workspace', color: '#4285F4' },
} as const satisfies Record<CalendarExternalProvider, { name: string; color: string }>;

const MICROSOFT_SOURCE_HOSTS = [
  'outlook.office.com',
  'outlook.office365.com',
  'outlook.live.com',
  'outlook.cloud.microsoft',
] as const;

export function calendarExternalSourceUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      !MICROSOFT_SOURCE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function importance(value: string | null | undefined): CalendarEventImportance {
  const normalized = value?.toUpperCase();
  return normalized === 'LOW' || normalized === 'HIGH' ? normalized : 'NORMAL';
}

function visibility(value: string | null | undefined): CalendarVisibility {
  const normalized = value?.toUpperCase();
  return normalized === 'PUBLIC' || normalized === 'PRIVATE' || normalized === 'CONFIDENTIAL'
    ? normalized
    : 'DEFAULT';
}

function event(item: CalendarExternalEvent): CalendarEvent {
  const provider = PROVIDER[item.provider];
  return {
    eventId: item.externalEventId,
    calendarId: item.externalCalendarId,
    calendarName: provider.name,
    calendarColor: provider.color,
    organizerName: provider.name,
    title: item.title,
    type: 'MEETING',
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    timeZone: 'UTC',
    allDay: false,
    status: 'CONFIRMED',
    visibility: visibility(item.classification),
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    attendees: [],
    conflict: false,
    importance: importance(item.importance),
    detailLevel: item.capabilities.canViewDetails ? 'FULL' : 'FREE_BUSY',
    redacted: !item.capabilities.canViewDetails,
    capabilities: {
      canViewDetails: item.capabilities.canViewDetails,
      canEdit: false,
      canDelete: false,
      canRestore: false,
      canRespond: false,
      canStar: false,
    },
    restrictionReason: 'EXTERNAL_READ_ONLY',
    externalProvider: item.provider,
    externalSourceUrl:
      item.provider === 'MICROSOFT_365' ? calendarExternalSourceUrl(item.sourceUrl) : null,
    version: 0,
  };
}

export function calendarExternalEvents(
  projection: CalendarExternalProjection | null | undefined
): CalendarEvent[] {
  return projection?.events.map(event) ?? [];
}

export function calendarExternalCalendars(
  projection: CalendarExternalProjection | null | undefined
): CalendarSummary[] {
  if (!projection) return [];
  const seen = new Set<string>();
  return projection.sources.flatMap((source, index) => {
    if (!source.externalCalendarId || seen.has(source.externalCalendarId)) return [];
    seen.add(source.externalCalendarId);
    const provider = PROVIDER[source.provider];
    return [
      {
        calendarId: source.externalCalendarId,
        calendarKey: `external:${source.provider}:${source.externalCalendarId}`,
        name: provider.name,
        color: provider.color,
        type: 'PERSONAL' as const,
        visibility: 'PRIVATE',
        sourceKind: 'OWNED' as const,
        accessLevel: 'VIEW_DETAILS' as const,
        subscriptionPolicy: 'OPTIONAL' as const,
        required: false,
        selected: true,
        favorite: false,
        displayOrder: 10_000 + index,
        version: 0,
        subscriptionVersion: 0,
        capabilities: {
          canViewDetails: true,
          canCreateEvents: false,
          canEditCalendar: false,
          canManageSharing: false,
          canDeleteCalendar: false,
          canUnsubscribe: true,
        },
        externalProvider: source.provider,
      },
    ];
  });
}
