import { Temporal } from 'temporal-polyfill';

export const WORKPLACE_PLANNER_URL_VERSION = '1' as const;

export const WORKPLACE_PLANNER_TARGETS = ['SELF', 'DELEGATE', 'TEAM'] as const;
export type WorkplacePlannerTarget = (typeof WORKPLACE_PLANNER_TARGETS)[number];

export const WORKPLACE_PLANNER_RESOURCE_TYPES = ['DESK', 'PARKING', 'LOCKER'] as const;
export type WorkplacePlannerResourceType = (typeof WORKPLACE_PLANNER_RESOURCE_TYPES)[number];

export const WORKPLACE_PLANNER_STEPS = ['PLAN', 'REVIEW', 'RESULT'] as const;
export type WorkplacePlannerStep = (typeof WORKPLACE_PLANNER_STEPS)[number];

export type WorkplacePlannerUrlState = Readonly<{
  week: string;
  dates: readonly string[];
  start: string;
  duration: number;
  timeZone: string;
  target: WorkplacePlannerTarget;
  beneficiaryRefs: readonly string[];
  groupRef: string;
  siteId: string;
  floorId: string;
  resourceTypes: readonly WorkplacePlannerResourceType[];
  adjacentSeats: boolean;
  sameNeighborhood: boolean;
  minimumDistanceMeters: number | null;
  maximumDistanceMeters: number | null;
  step: WorkplacePlannerStep;
  intentId: string | null;
  batchId: string | null;
  selectedItemId: string | null;
}>;

export type WorkplacePlannerUrlPatch = Partial<{
  week: string | null;
  dates: readonly string[] | null;
  start: string | null;
  duration: number | null;
  tz: string | null;
  target: WorkplacePlannerTarget | null;
  beneficiaries: readonly string[] | null;
  group: string | null;
  site: string | null;
  floor: string | null;
  types: readonly WorkplacePlannerResourceType[] | null;
  adjacent: boolean | null;
  neighborhood: boolean | null;
  minDistance: number | null;
  maxDistance: number | null;
  step: WorkplacePlannerStep | null;
  intent: string | null;
  batch: string | null;
  item: string | null;
}>;

const SAFE_TOKEN = /^[A-Za-z0-9._:-]{1,160}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DEFAULT_START = '09:00';
const DEFAULT_DURATION = 9 * 60;
const DEFAULT_TIME_ZONE = 'Asia/Seoul';

function dateValue(value: string | null): Temporal.PlainDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  try {
    const parsed = Temporal.PlainDate.from(value);
    return parsed.toString() === value ? parsed : null;
  } catch {
    return null;
  }
}

function monday(value: Temporal.PlainDate) {
  return value.subtract({ days: value.dayOfWeek - 1 });
}

function defaultWeek(referenceDate?: string) {
  return monday(dateValue(referenceDate ?? null) ?? Temporal.Now.plainDateISO()).toString();
}

function defaultDates(week: string) {
  const start = Temporal.PlainDate.from(week);
  return Array.from({ length: 5 }, (_, index) => start.add({ days: index }).toString());
}

function safeToken(value: string | null) {
  return value && SAFE_TOKEN.test(value) ? value : '';
}

function safeOptionalToken(value: string | null) {
  return safeToken(value) || null;
}

function safeTokens(value: string | null, maximum = 20) {
  return [...new Set((value ?? '').split(',').map((item) => safeToken(item.trim())))]
    .filter(Boolean)
    .slice(0, maximum);
}

function enumValue<const T extends readonly string[]>(
  value: string | null,
  values: T,
  fallback: T[number]
): T[number] {
  const normalized = value?.toUpperCase() ?? null;
  return normalized && values.includes(normalized) ? (normalized as T[number]) : fallback;
}

function duration(value: string | null) {
  if (!value || !/^\d+$/u.test(value)) return DEFAULT_DURATION;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 15 && parsed <= 24 * 60
    ? parsed
    : DEFAULT_DURATION;
}

function timeZone(value: string | null) {
  if (!value || value.length > 64) return DEFAULT_TIME_ZONE;
  try {
    Temporal.Now.instant().toZonedDateTimeISO(value);
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function distance(value: string | null) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100_000
    ? Math.round(parsed * 10) / 10
    : null;
}

function plannerDates(value: string | null, week: string) {
  const minimum = Temporal.PlainDate.from(week).subtract({ days: 31 });
  const maximum = Temporal.PlainDate.from(week).add({ days: 62 });
  const dates = [...new Set((value ?? '').split(',').map((item) => item.trim()))]
    .flatMap((item) => {
      const parsed = dateValue(item);
      return parsed &&
        Temporal.PlainDate.compare(parsed, minimum) >= 0 &&
        Temporal.PlainDate.compare(parsed, maximum) <= 0
        ? [parsed.toString()]
        : [];
    })
    .sort()
    .slice(0, 14);
  return dates.length > 0 ? dates : defaultDates(week);
}

function resourceTypes(value: string | null) {
  const selected = new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is WorkplacePlannerResourceType =>
        WORKPLACE_PLANNER_RESOURCE_TYPES.includes(item as WorkplacePlannerResourceType)
      )
  );
  const ordered = WORKPLACE_PLANNER_RESOURCE_TYPES.filter((type) => selected.has(type));
  return ordered.length > 0 ? ordered : [...WORKPLACE_PLANNER_RESOURCE_TYPES];
}

function appendCanonical(state: WorkplacePlannerUrlState) {
  const params = new URLSearchParams();
  params.set('v', WORKPLACE_PLANNER_URL_VERSION);
  params.set('week', state.week);
  params.set('dates', state.dates.join(','));
  params.set('start', state.start);
  params.set('duration', String(state.duration));
  params.set('tz', state.timeZone);
  params.set('target', state.target);
  if (state.beneficiaryRefs.length > 0) {
    params.set('beneficiaries', state.beneficiaryRefs.join(','));
  }
  if (state.groupRef) params.set('group', state.groupRef);
  if (state.siteId) params.set('site', state.siteId);
  if (state.floorId) params.set('floor', state.floorId);
  params.set('types', state.resourceTypes.join(','));
  if (state.adjacentSeats) params.set('adjacent', '1');
  if (state.sameNeighborhood) params.set('neighborhood', '1');
  if (state.minimumDistanceMeters !== null)
    params.set('minDistance', String(state.minimumDistanceMeters));
  if (state.maximumDistanceMeters !== null)
    params.set('maxDistance', String(state.maximumDistanceMeters));
  params.set('step', state.step);
  if (state.intentId) params.set('intent', state.intentId);
  if (state.batchId) params.set('batch', state.batchId);
  if (state.selectedItemId) params.set('item', state.selectedItemId);
  return params;
}

export function parseWorkplacePlannerUrl(
  input: URLSearchParams,
  options: { referenceDate?: string } = {}
) {
  const requestedDate = dateValue(input.get('week')) ?? dateValue(input.get('date'));
  const week = monday(
    requestedDate ?? Temporal.PlainDate.from(defaultWeek(options.referenceDate))
  ).toString();
  const state: WorkplacePlannerUrlState = {
    week,
    dates: plannerDates(input.get('dates'), week),
    start: TIME.test(input.get('start') ?? '') ? input.get('start')! : DEFAULT_START,
    duration: duration(input.get('duration')),
    timeZone: timeZone(input.get('tz')),
    target: enumValue(input.get('target'), WORKPLACE_PLANNER_TARGETS, 'SELF'),
    beneficiaryRefs: safeTokens(input.get('beneficiaries') ?? input.get('beneficiary')),
    groupRef: safeToken(input.get('group')),
    siteId: safeToken(input.get('site') ?? input.get('sites')),
    floorId: safeToken(input.get('floor') ?? input.get('floors')),
    resourceTypes: resourceTypes(input.get('types')),
    adjacentSeats: input.get('adjacent') === '1',
    sameNeighborhood: input.get('neighborhood') === '1',
    minimumDistanceMeters: distance(input.get('minDistance')),
    maximumDistanceMeters: distance(input.get('maxDistance')),
    step: enumValue(input.get('step'), WORKPLACE_PLANNER_STEPS, 'PLAN'),
    intentId: safeOptionalToken(input.get('intent')),
    batchId: safeOptionalToken(input.get('batch')),
    selectedItemId: safeOptionalToken(input.get('item')),
  };
  const canonicalSearchParams = appendCanonical(state);
  return {
    state,
    canonicalSearchParams,
    corrected: canonicalSearchParams.toString() !== input.toString(),
  } as const;
}

export function updateWorkplacePlannerUrl(
  current: URLSearchParams,
  patch: WorkplacePlannerUrlPatch,
  options: { referenceDate?: string } = {}
) {
  const parsed = parseWorkplacePlannerUrl(current, options).state;
  const requestedWeek = patch.week === null ? parsed.week : (patch.week ?? parsed.week);
  const week = monday(dateValue(requestedWeek) ?? Temporal.PlainDate.from(parsed.week)).toString();
  const next: WorkplacePlannerUrlState = {
    week,
    dates:
      patch.dates === null
        ? defaultDates(week)
        : plannerDates((patch.dates ?? parsed.dates).join(','), week),
    start: patch.start === null ? DEFAULT_START : (patch.start ?? parsed.start),
    duration: patch.duration === null ? DEFAULT_DURATION : (patch.duration ?? parsed.duration),
    timeZone: patch.tz === null ? DEFAULT_TIME_ZONE : (patch.tz ?? parsed.timeZone),
    target: patch.target === null ? 'SELF' : (patch.target ?? parsed.target),
    beneficiaryRefs:
      patch.beneficiaries === null
        ? []
        : safeTokens((patch.beneficiaries ?? parsed.beneficiaryRefs).join(',')),
    groupRef: patch.group === null ? '' : (patch.group ?? parsed.groupRef),
    siteId: patch.site === null ? '' : (patch.site ?? parsed.siteId),
    floorId: patch.floor === null ? '' : (patch.floor ?? parsed.floorId),
    resourceTypes:
      patch.types === null
        ? [...WORKPLACE_PLANNER_RESOURCE_TYPES]
        : (patch.types ?? parsed.resourceTypes),
    adjacentSeats: patch.adjacent === null ? false : (patch.adjacent ?? parsed.adjacentSeats),
    sameNeighborhood:
      patch.neighborhood === null ? false : (patch.neighborhood ?? parsed.sameNeighborhood),
    minimumDistanceMeters:
      patch.minDistance === null ? null : (patch.minDistance ?? parsed.minimumDistanceMeters),
    maximumDistanceMeters:
      patch.maxDistance === null ? null : (patch.maxDistance ?? parsed.maximumDistanceMeters),
    step: patch.step === null ? 'PLAN' : (patch.step ?? parsed.step),
    intentId: patch.intent === null ? null : (patch.intent ?? parsed.intentId),
    batchId: patch.batch === null ? null : (patch.batch ?? parsed.batchId),
    selectedItemId: patch.item === null ? null : (patch.item ?? parsed.selectedItemId),
  };
  return parseWorkplacePlannerUrl(appendCanonical(next), options).canonicalSearchParams;
}

export function migrateLegacyWorkplacePlannerUrl(
  input: URLSearchParams,
  options: { referenceDate?: string } = {}
) {
  const migrated = new URLSearchParams(input);
  migrated.delete('mode');
  if (!migrated.has('week') && migrated.has('date')) migrated.set('week', migrated.get('date')!);
  if (!migrated.has('site') && migrated.has('sites')) migrated.set('site', migrated.get('sites')!);
  if (!migrated.has('floor') && migrated.has('floors'))
    migrated.set('floor', migrated.get('floors')!);
  migrated.delete('date');
  migrated.delete('sites');
  migrated.delete('floors');
  migrated.delete('view');
  migrated.delete('sort');
  migrated.delete('q');
  migrated.delete('features');
  migrated.delete('capacity');
  migrated.delete('neighborhood');
  migrated.delete('accessible');
  migrated.delete('resource');
  migrated.delete('scope');
  return parseWorkplacePlannerUrl(migrated, options).canonicalSearchParams;
}

export function resolveLegacyWorkplacePlannerLocation(
  search: string,
  hash: string,
  options: { referenceDate?: string } = {}
) {
  const searchParams = migrateLegacyWorkplacePlannerUrl(new URLSearchParams(search), options);
  return { pathname: '/workplace/planner', search: `?${searchParams.toString()}`, hash } as const;
}
