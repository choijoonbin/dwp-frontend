import { Temporal } from 'temporal-polyfill';

import type {
  WorkplacePlanningDraft,
  WorkplacePlanningForecast,
  WorkplacePlanningScenario,
  WorkplacePlanningScenarioState,
  WorkplacePlanningScope,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

export const WORKPLACE_PLANNING_RESOURCE_TYPES = [
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
] as const;

export type WorkplacePlanningScopeForm = Readonly<{
  siteId: string;
  floorId: string;
  neighborhood: string;
  resourceType: (typeof WORKPLACE_PLANNING_RESOURCE_TYPES)[number] | '';
  from: string;
  to: string;
}>;

export type WorkplacePlanningDraftForm = Readonly<{
  name: string;
  description: string;
  proposedCapacity: string;
  proposedRoomCapacity: string;
  proposedAccessibleResourceCount: string;
  operatingStart: string;
  operatingEnd: string;
  policyReference: string;
  affectedResourceIds: readonly string[];
  neighborhoodAllocations: readonly Readonly<{ neighborhood: string; capacity: string }>[];
  emissionEvidenceId: string | null;
  reason: string;
  explicitConfirmation: boolean;
  approvalAuthorityReference: string;
}>;

export type WorkplacePlanningUrlState = Readonly<{
  form: WorkplacePlanningScopeForm;
  scenarioId: string | null;
  corrected: boolean;
  canonicalSearchParams: URLSearchParams;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function validDate(value: string | null) {
  if (!value) return null;
  try {
    return Temporal.PlainDate.from(value).toString() === value ? value : null;
  } catch {
    return null;
  }
}

export function parseWorkplacePlanningUrl(
  input: URLSearchParams,
  fallback = defaultWorkplacePlanningScopeForm()
): WorkplacePlanningUrlState {
  const resourceType = WORKPLACE_PLANNING_RESOURCE_TYPES.find(
    (candidate) => candidate === input.get('type')?.toUpperCase()
  );
  const form: WorkplacePlanningScopeForm = {
    siteId: uuidPattern.test(input.get('site') ?? '') ? input.get('site')! : '',
    floorId: uuidPattern.test(input.get('floor') ?? '') ? input.get('floor')! : '',
    neighborhood: (input.get('neighborhood') ?? '').trim().slice(0, 120),
    resourceType: resourceType ?? '',
    from: validDate(input.get('from')) ?? fallback.from,
    to: validDate(input.get('to')) ?? fallback.to,
  };
  const scenarioId = uuidPattern.test(input.get('scenario') ?? '') ? input.get('scenario')! : null;
  const canonicalSearchParams = workplacePlanningSearchParams(form, scenarioId);
  return {
    form,
    scenarioId,
    corrected: canonicalSearchParams.toString() !== input.toString(),
    canonicalSearchParams,
  };
}

export function workplacePlanningSearchParams(
  form: WorkplacePlanningScopeForm,
  scenarioId: string | null
) {
  const params = new URLSearchParams();
  if (form.siteId) params.set('site', form.siteId);
  if (form.floorId) params.set('floor', form.floorId);
  if (form.neighborhood.trim()) params.set('neighborhood', form.neighborhood.trim());
  if (form.resourceType) params.set('type', form.resourceType);
  params.set('from', form.from);
  params.set('to', form.to);
  if (scenarioId) params.set('scenario', scenarioId);
  return params;
}

export function defaultWorkplacePlanningScopeForm(
  now = new Date(),
  timeZone = 'UTC'
): WorkplacePlanningScopeForm {
  const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone).toPlainDate();
  return {
    siteId: '',
    floorId: '',
    neighborhood: '',
    resourceType: '',
    from: today.toString(),
    to: today.add({ days: 13 }).toString(),
  };
}

export function buildWorkplacePlanningScope(
  form: WorkplacePlanningScopeForm,
  timeZone = 'UTC'
): WorkplacePlanningScope | null {
  const siteId = form.siteId.trim();
  if (!siteId || !form.from || !form.to) return null;
  try {
    const fromDate = Temporal.PlainDate.from(form.from);
    const toDate = Temporal.PlainDate.from(form.to);
    if (Temporal.PlainDate.compare(toDate, fromDate) < 0 || fromDate.until(toDate).days > 365) {
      return null;
    }
    const from = Temporal.ZonedDateTime.from(`${form.from}T00:00:00[${timeZone}]`, {
      disambiguation: 'reject',
    }).toInstant();
    const to = Temporal.ZonedDateTime.from(`${form.to}T23:59:59.999999999[${timeZone}]`, {
      disambiguation: 'reject',
    }).toInstant();
    return {
      siteId,
      floorId: form.floorId.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      resourceType: form.resourceType || null,
      from: from.toString(),
      to: to.toString(),
    };
  } catch {
    return null;
  }
}

export function draftFormFromScenario(
  scenario: WorkplacePlanningScenario | null
): WorkplacePlanningDraftForm {
  const draft = scenario?.draft;
  return {
    name: scenario?.name ?? '',
    description: scenario?.description ?? '',
    proposedCapacity: String(draft?.proposedCapacity ?? 0),
    proposedRoomCapacity: String(draft?.proposedRoomCapacity ?? 0),
    proposedAccessibleResourceCount: String(draft?.proposedAccessibleResourceCount ?? 0),
    operatingStart: draft?.operatingStart ?? '08:00:00',
    operatingEnd: draft?.operatingEnd ?? '20:00:00',
    policyReference: draft?.policyReference ?? '',
    affectedResourceIds: draft?.affectedResourceIds ?? [],
    neighborhoodAllocations:
      draft?.neighborhoodAllocations.map((allocation) => ({
        neighborhood: allocation.neighborhood,
        capacity: String(allocation.capacity),
      })) ?? [],
    emissionEvidenceId: draft?.emissionEvidenceId ?? null,
    reason: '',
    explicitConfirmation: false,
    approvalAuthorityReference: scenario?.approvalAuthorityReference ?? '',
  };
}

function integer(value: string) {
  if (!/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeClock(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/u.exec(value);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? '00'}` : null;
}

export function buildWorkplacePlanningDraft(form: WorkplacePlanningDraftForm) {
  const proposedCapacity = integer(form.proposedCapacity);
  const proposedRoomCapacity = integer(form.proposedRoomCapacity);
  const proposedAccessibleResourceCount = integer(form.proposedAccessibleResourceCount);
  const operatingStart = normalizeClock(form.operatingStart);
  const operatingEnd = normalizeClock(form.operatingEnd);
  const allocations = form.neighborhoodAllocations.map((allocation) => {
    const neighborhood = allocation.neighborhood.trim();
    const capacity = integer(allocation.capacity);
    return neighborhood && capacity !== null ? { neighborhood, capacity } : null;
  });
  if (
    proposedCapacity === null ||
    proposedRoomCapacity === null ||
    proposedAccessibleResourceCount === null ||
    proposedRoomCapacity > proposedCapacity ||
    proposedAccessibleResourceCount > proposedCapacity ||
    operatingStart === null ||
    operatingEnd === null ||
    operatingEnd <= operatingStart ||
    allocations.some((allocation) => allocation === null)
  ) {
    return null;
  }
  const normalizedAllocations = allocations.filter(
    (allocation): allocation is NonNullable<typeof allocation> => Boolean(allocation)
  );
  if (
    normalizedAllocations.length > 0 &&
    normalizedAllocations.reduce((total, allocation) => total + allocation.capacity, 0) !==
      proposedCapacity
  ) {
    return null;
  }
  const normalizedNames = normalizedAllocations.map((allocation) =>
    allocation.neighborhood.toLowerCase()
  );
  if (
    new Set(normalizedNames).size !== normalizedNames.length ||
    new Set(form.affectedResourceIds).size !== form.affectedResourceIds.length
  ) {
    return null;
  }
  return {
    proposedCapacity,
    proposedRoomCapacity,
    proposedAccessibleResourceCount,
    operatingStart,
    operatingEnd,
    policyReference: form.policyReference.trim() || null,
    affectedResourceIds: [...new Set(form.affectedResourceIds)],
    neighborhoodAllocations: normalizedAllocations,
    emissionEvidenceId: form.emissionEvidenceId,
  } satisfies WorkplacePlanningDraft;
}

export function workplacePlanningScopesEqual(
  left: WorkplacePlanningScope | null,
  right: WorkplacePlanningScope | null
) {
  return Boolean(
    left &&
    right &&
    left.siteId === right.siteId &&
    left.floorId === right.floorId &&
    left.neighborhood === right.neighborhood &&
    left.resourceType === right.resourceType &&
    left.from === right.from &&
    left.to === right.to
  );
}

export function filterWorkplacePlanningResources(
  resources: readonly WorkplaceResource[],
  scope: WorkplacePlanningScope
) {
  return resources.filter(
    (resource) =>
      resource.siteId === scope.siteId &&
      (scope.floorId === null || resource.floorId === scope.floorId) &&
      (scope.neighborhood === null || resource.neighborhood?.trim() === scope.neighborhood) &&
      (scope.resourceType === null || resource.type === scope.resourceType) &&
      resource.state !== 'RETIRED'
  );
}

export function isWorkplacePlanningPreviewSubmittable(
  scenario: WorkplacePlanningScenario,
  now = Date.now()
) {
  const preview = scenario.activePreview;
  return Boolean(
    scenario.state === 'PREVIEWED' &&
    preview &&
    preview.scenarioId === scenario.scenarioId &&
    preview.scenarioVersion === scenario.version - 1 &&
    preview.eligible &&
    Date.parse(preview.expiresAt) > now
  );
}

export function workplacePlanningScenarioSnapshotsEqual(
  left: WorkplacePlanningScenario,
  right: WorkplacePlanningScenario
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isWorkplacePlanningForecastRenderable(forecast: WorkplacePlanningForecast) {
  return (
    forecast.state === 'READY' &&
    forecast.points.length > 0 &&
    forecast.recommendationMetrics !== null
  );
}

export function availableWorkplacePlanningActions(state: WorkplacePlanningScenarioState | null) {
  if (state === null) return ['CREATE'] as const;
  if (state === 'DRAFT') return ['UPDATE', 'PREVIEW'] as const;
  if (state === 'PREVIEWED') return ['UPDATE', 'PREVIEW', 'BOOKING_IMPACT', 'SUBMIT'] as const;
  if (state === 'SUBMITTED') return ['APPROVE', 'REJECT'] as const;
  if (state === 'APPROVED') return ['PUBLISH'] as const;
  return [] as const;
}
