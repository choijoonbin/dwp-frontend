export const workplaceCanonicalScopeUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(value);

type Metadata = { countsScope?: 'SITE' | 'FLOORS'; allowedFloorIds?: string[] | null };
export type AuthorizedFloorMetadata = { kind: 'SITE' | 'FLOORS'; floorIds: string[] | null };

/** Missing legacy metadata can prove full scope only for an actual global administrator. */
export function workplaceAuthorizedFloorMetadata(
  value: Metadata | null | undefined,
  legacyGlobal = false
): AuthorizedFloorMetadata | null {
  if (!value) return null;
  if (value.countsScope === undefined && value.allowedFloorIds === undefined)
    return legacyGlobal ? { kind: 'SITE', floorIds: null } : null;
  if (value.countsScope === 'SITE')
    return value.allowedFloorIds === null ? { kind: 'SITE', floorIds: null } : null;
  if (
    value.countsScope !== 'FLOORS' ||
    !Array.isArray(value.allowedFloorIds) ||
    !value.allowedFloorIds.length ||
    value.allowedFloorIds.some((id) => !workplaceCanonicalScopeUuid(id))
  )
    return null;
  const floorIds = value.allowedFloorIds.map((id) => id.toLowerCase()).sort();
  return new Set(floorIds).size === floorIds.length ? { kind: 'FLOORS', floorIds } : null;
}

export function workplaceAuthorizedFloorSetsMatch(
  left: AuthorizedFloorMetadata | null,
  right: AuthorizedFloorMetadata | null
) {
  return Boolean(
    left &&
    right &&
    left.kind === right.kind &&
    JSON.stringify(left.floorIds) === JSON.stringify(right.floorIds)
  );
}

export function workplaceAuthorizedFloorContains(
  scope: AuthorizedFloorMetadata | null,
  floorId: string
) {
  return Boolean(
    scope &&
    workplaceCanonicalScopeUuid(floorId) &&
    (scope.floorIds === null || scope.floorIds.includes(floorId.toLowerCase()))
  );
}
