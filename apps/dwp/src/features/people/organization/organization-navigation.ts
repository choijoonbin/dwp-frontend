import type {
  OrganizationChartOrganization,
  OrganizationChartPerson,
  OrganizationChartPosition,
} from '@dwp-frontend/shared-utils';

export const CHART_MODES = ['organizations', 'people', 'positions', 'insights'] as const;

export type ChartMode = (typeof CHART_MODES)[number];
export type OrganizationSelectionKind = 'organization' | 'person' | 'position';
export type OrganizationNavigationSelection = {
  kind: OrganizationSelectionKind;
  id: string;
};

export function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

export function parseChartMode(value: string | null, fallback: ChartMode): ChartMode {
  return CHART_MODES.includes(value as ChartMode) ? (value as ChartMode) : fallback;
}

export function parseOrganizationSelection(
  searchParams: URLSearchParams
): OrganizationNavigationSelection | undefined {
  const personId = searchParams.get('person');
  if (personId) return { kind: 'person', id: personId };
  const positionId = searchParams.get('position');
  if (positionId) return { kind: 'position', id: positionId };
  const organizationId = searchParams.get('organization');
  if (organizationId) return { kind: 'organization', id: organizationId };
  return undefined;
}

export function modeForSelection(
  selection: OrganizationNavigationSelection | undefined,
  requestedMode: ChartMode
): ChartMode {
  if (!selection) return requestedMode;
  if (selection.kind === 'person') return 'people';
  if (selection.kind === 'position') return 'positions';
  return 'organizations';
}

export function organizationSelectionSearchParams(
  selection: OrganizationNavigationSelection | undefined
): Record<'organization' | 'person' | 'position', string | null> {
  return {
    organization: selection?.kind === 'organization' ? selection.id : null,
    person: selection?.kind === 'person' ? selection.id : null,
    position: selection?.kind === 'position' ? selection.id : null,
  };
}

function ancestorIds<T>(
  items: readonly T[],
  targetId: string,
  getId: (item: T) => string,
  getParentId: (item: T) => string | null | undefined
): Set<string> {
  const parentById = new Map(items.map((item) => [getId(item), getParentId(item)]));
  const ancestors = new Set<string>();
  const visited = new Set<string>([targetId]);
  let parentId = parentById.get(targetId);

  while (parentId && !visited.has(parentId)) {
    ancestors.add(parentId);
    visited.add(parentId);
    parentId = parentById.get(parentId);
  }
  return ancestors;
}

export function organizationAncestorIds(
  organizations: readonly OrganizationChartOrganization[],
  organizationId: string
): Set<string> {
  return ancestorIds(
    organizations,
    organizationId,
    (organization) => organization.organizationId,
    (organization) => organization.parentOrganizationId
  );
}

export function personAncestorIds(
  people: readonly OrganizationChartPerson[],
  personId: string
): Set<string> {
  return ancestorIds(
    people,
    personId,
    (person) => person.personId,
    (person) => person.managerPersonId
  );
}

export function positionAncestorIds(
  positions: readonly OrganizationChartPosition[],
  positionId: string
): Set<string> {
  return ancestorIds(
    positions,
    positionId,
    (position) => position.positionId,
    (position) => position.reportsToPositionId
  );
}

export function removeValues<T>(current: ReadonlySet<T>, values: ReadonlySet<T>): Set<T> {
  const next = new Set(current);
  values.forEach((value) => next.delete(value));
  return next;
}
