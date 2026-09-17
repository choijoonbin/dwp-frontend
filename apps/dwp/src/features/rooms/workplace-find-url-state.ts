import type { WorkplaceResourceType } from '@dwp-frontend/shared-utils';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';
import type { WorkplaceDiscoverySort } from './workplace-discovery-model';

export const WORKPLACE_FIND_URL_VERSION = '1' as const;

const RESOURCE_TYPES = new Set<WorkplaceResourceType>([
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
]);
const SAFE_TOKEN = /^[A-Za-z0-9._:-]{1,128}$/u;
const SAFE_FEATURE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const START = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export type WorkplaceFindView = 'list' | 'map';

export type WorkplaceFindUrlState = Readonly<{
  date: string | null;
  start: string | null;
  duration: number | null;
  timeZone: string | null;
  siteId: string;
  floorId: string;
  type: WorkplaceResourceType | 'ALL';
  feature: string;
  capacity: number | null;
  view: WorkplaceFindView | null;
  sort: WorkplaceDiscoverySort;
  query: string;
  neighborhood: string;
  accessibleOnly: boolean;
  resourceId: string | null;
  scope: string | null;
}>;

export type ParsedWorkplaceFindUrl = Readonly<{
  state: WorkplaceFindUrlState;
  canonicalSearchParams: URLSearchParams;
  corrected: boolean;
}>;

export type WorkplaceFindUrlPatch = Partial<{
  date: string | null;
  start: string | null;
  duration: number | null;
  tz: string | null;
  sites: string | null;
  floors: string | null;
  types: WorkplaceResourceType | 'ALL' | null;
  features: string | null;
  capacity: number | null;
  view: WorkplaceFindView | null;
  sort: WorkplaceDiscoverySort | null;
  q: string | null;
  neighborhood: string | null;
  accessible: boolean | null;
  resource: string | null;
}>;

function validDate(value: string | null) {
  if (!value || !DATE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return month >= 1 && month <= 12 && day >= 1 && day <= (daysInMonth[month - 1] ?? 0)
    ? value
    : null;
}

function validTimeZone(value: string | null) {
  if (!value || value.length > 64 || stripControlCharacters(value) !== value) return null;
  return resolveZonedClock(0, value) ? value : null;
}

function stripControlCharacters(value: string) {
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('');
}

function firstSafeToken(value: string | null) {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .find((item) => SAFE_TOKEN.test(item)) ?? ''
  );
}

function resourceType(value: string | null, forcedType?: WorkplaceResourceType | 'ALL') {
  if (forcedType) return forcedType;
  const first = value?.split(',')[0]?.trim().toUpperCase();
  if (first === 'ALL') return 'ALL';
  return first && RESOURCE_TYPES.has(first as WorkplaceResourceType)
    ? (first as WorkplaceResourceType)
    : 'ALL';
}

function feature(value: string | null) {
  return (
    value
      ?.split(',')
      .map((item) => item.trim().toUpperCase())
      .find((item) => SAFE_FEATURE.test(item)) ?? ''
  );
}

function positiveInteger(value: string | null, maximum: number) {
  if (!value || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

function nonNegativeInteger(value: string | null, maximum: number) {
  if (!value || !/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function normalizedQuery(value: string | null) {
  return stripControlCharacters(value ?? '')
    .trim()
    .slice(0, 120);
}

function normalizedNeighborhood(value: string | null) {
  return stripControlCharacters(value ?? '')
    .trim()
    .slice(0, 128);
}

function sort(value: string | null): WorkplaceDiscoverySort {
  switch (value?.toUpperCase()) {
    case 'NAME':
      return 'name';
    case 'CAPACITY':
      return 'capacity';
    default:
      return 'availability';
  }
}

function sortParameter(value: WorkplaceDiscoverySort) {
  if (value === 'name') return 'NAME';
  if (value === 'capacity') return 'CAPACITY';
  return 'BEST_MATCH';
}

function buildCanonicalSearchParams(state: WorkplaceFindUrlState) {
  const params = new URLSearchParams();
  params.set('v', WORKPLACE_FIND_URL_VERSION);
  if (state.date) params.set('date', state.date);
  if (state.start) params.set('start', state.start);
  if (state.duration !== null) params.set('duration', String(state.duration));
  if (state.timeZone) params.set('tz', state.timeZone);
  if (state.siteId) params.set('sites', state.siteId);
  if (state.floorId) params.set('floors', state.floorId);
  params.set('types', state.type);
  if (state.feature) params.set('features', state.feature);
  if (state.capacity !== null) params.set('capacity', String(state.capacity));
  if (state.view) params.set('view', state.view);
  if (state.sort !== 'availability') params.set('sort', sortParameter(state.sort));
  if (state.query) params.set('q', state.query);
  if (state.neighborhood) params.set('neighborhood', state.neighborhood);
  if (state.accessibleOnly) params.set('accessible', 'true');
  if (state.resourceId) params.set('resource', state.resourceId);
  if (state.scope) params.set('scope', state.scope);
  return params;
}

export function parseWorkplaceFindUrl(
  input: URLSearchParams,
  options: { forcedType?: WorkplaceResourceType | 'ALL' } = {}
): ParsedWorkplaceFindUrl {
  const rawView = input.get('view')?.toLowerCase();
  const state: WorkplaceFindUrlState = {
    date: validDate(input.get('date')),
    start: START.test(input.get('start') ?? '') ? input.get('start') : null,
    duration: positiveInteger(input.get('duration'), 24 * 60),
    timeZone: validTimeZone(input.get('tz')),
    siteId: firstSafeToken(input.get('sites')),
    floorId: firstSafeToken(input.get('floors')),
    type: resourceType(input.get('types'), options.forcedType),
    feature: feature(input.get('features')),
    capacity: nonNegativeInteger(input.get('capacity'), 100_000),
    view: rawView === 'list' || rawView === 'map' ? rawView : null,
    sort: sort(input.get('sort')),
    query: normalizedQuery(input.get('q')),
    neighborhood: normalizedNeighborhood(input.get('neighborhood')),
    accessibleOnly: input.get('accessible') === 'true',
    resourceId: SAFE_TOKEN.test(input.get('resource') ?? '') ? input.get('resource') : null,
    scope: SAFE_TOKEN.test(input.get('scope') ?? '') ? input.get('scope') : null,
  };
  const canonicalSearchParams = buildCanonicalSearchParams(state);
  return {
    state,
    canonicalSearchParams,
    corrected: canonicalSearchParams.toString() !== input.toString(),
  };
}

export function updateWorkplaceFindUrl(current: URLSearchParams, patch: WorkplaceFindUrlPatch) {
  const next = new URLSearchParams(parseWorkplaceFindUrl(current).canonicalSearchParams);
  for (const [key, rawValue] of Object.entries(patch)) {
    if (rawValue === null || rawValue === undefined || rawValue === '' || rawValue === false) {
      next.delete(key);
      continue;
    }
    const value = key === 'sort' ? sortParameter(rawValue as WorkplaceDiscoverySort) : rawValue;
    next.set(key, String(value));
  }
  return parseWorkplaceFindUrl(next).canonicalSearchParams;
}

export function migrateLegacyWorkplaceFindUrl(input: URLSearchParams, source: 'explore' | 'rooms') {
  const migrated = new URLSearchParams(input);
  const aliases = [
    ['time', 'start'],
    ['timeZone', 'tz'],
    ['site', 'sites'],
    ['floor', 'floors'],
    ['type', 'types'],
    ['feature', 'features'],
  ] as const;
  for (const [legacy, canonical] of aliases) {
    if (!migrated.has(canonical) && migrated.has(legacy)) {
      migrated.set(canonical, migrated.get(legacy) ?? '');
    }
    migrated.delete(legacy);
  }
  return parseWorkplaceFindUrl(migrated, {
    forcedType: source === 'rooms' ? 'ROOM' : undefined,
  }).canonicalSearchParams;
}
