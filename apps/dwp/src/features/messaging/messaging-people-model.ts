import type {
  MessagingPeoplePage,
  MessagingPeoplePresenceFilter,
  MessagingPerson,
} from '@dwp-frontend/shared-utils/api/messaging-api';

export type MessagingPeopleFilters = Readonly<{
  query: string;
  organization: string;
  jobTitle: string;
  presence: MessagingPeoplePresenceFilter;
}>;

const PRESENCE_FILTERS = new Set<MessagingPeoplePresenceFilter>([
  'ALL',
  'AVAILABLE',
  'OFFLINE',
  'UNKNOWN',
]);

export function readMessagingPeopleFilters(params: URLSearchParams): MessagingPeopleFilters {
  const rawPresence = params.get('presence')?.toUpperCase() ?? 'ALL';
  const presence = PRESENCE_FILTERS.has(rawPresence as MessagingPeoplePresenceFilter)
    ? (rawPresence as MessagingPeoplePresenceFilter)
    : 'ALL';
  return {
    query: params.get('q') ?? '',
    organization: params.get('org') ?? '',
    jobTitle: params.get('job') ?? '',
    presence,
  };
}

export function mergeMessagingPeopleFilters(
  params: URLSearchParams,
  patch: Partial<MessagingPeopleFilters>
): URLSearchParams {
  const next = new URLSearchParams(params);
  const values: Array<[keyof MessagingPeopleFilters, string, string]> = [
    ['query', 'q', patch.query ?? ''],
    ['organization', 'org', patch.organization ?? ''],
    ['jobTitle', 'job', patch.jobTitle ?? ''],
    ['presence', 'presence', patch.presence ?? ''],
  ];
  for (const [field, key, value] of values) {
    if (!(field in patch)) continue;
    const normalized = value.trim();
    if (!normalized || (field === 'presence' && normalized === 'ALL')) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function collectMessagingPeople(pages: MessagingPeoplePage[]): MessagingPerson[] {
  const unique = new Map<number, MessagingPerson>();
  for (const page of pages) {
    for (const person of page.items) unique.set(person.userId, person);
  }
  return [...unique.values()];
}

export function nextMessagingPeoplePageParam(lastPage: MessagingPeoplePage): string | undefined {
  return lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined;
}

export function canLoadNextMessagingPeoplePage(input: {
  hasNextPage: boolean;
  isFetching: boolean;
}): boolean {
  return input.hasNextPage && !input.isFetching;
}

export function filterMessagingPeoplePresence(
  people: MessagingPerson[],
  presence: MessagingPeoplePresenceFilter
): MessagingPerson[] {
  return presence === 'ALL' ? people : people.filter((person) => person.presenceState === presence);
}

export function hasMessagingPeopleFilters(filters: MessagingPeopleFilters): boolean {
  return Boolean(
    filters.query.trim() ||
    filters.organization.trim() ||
    filters.jobTitle.trim() ||
    filters.presence !== 'ALL'
  );
}
