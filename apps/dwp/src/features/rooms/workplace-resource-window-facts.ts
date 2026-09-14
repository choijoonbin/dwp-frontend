import type {
  WorkplaceExploreResponse,
  WorkplaceOccupancy,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

export type WorkplaceResourceWindowContext = {
  siteId: string;
  floorId: string;
  startsAt: string;
  endsAt: string;
  sourceReady: boolean;
  policy: WorkplacePolicy;
  occupancy: readonly WorkplaceOccupancy[];
  closures: WorkplaceExploreResponse['closures'];
};
export type WorkplaceWindowSegment = {
  startsAt: string;
  endsAt: string;
  kind: 'RESERVED' | 'UNRESERVED' | 'CLOSED';
};

/** Only queried reservation intervals are projected; person and booking identifiers never leave this boundary. */
export function workplaceResourceWindowFacts(
  resource: WorkplaceResource,
  context?: WorkplaceResourceWindowContext
) {
  if (
    !context?.sourceReady ||
    resource.siteId !== context.siteId ||
    resource.floorId !== context.floorId
  )
    return null;
  const start = Date.parse(context.startsAt),
    end = Date.parse(context.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const policy = resource.type === 'ROOM' ? null : context.policy;
  if (
    policy &&
    (typeof policy.requireCheckIn !== 'boolean' ||
      !Number.isInteger(policy.version) ||
      !Number.isInteger(policy.checkInLeadMinutes) ||
      policy.checkInLeadMinutes < 0 ||
      !Number.isInteger(policy.autoReleaseMinutes) ||
      policy.autoReleaseMinutes < 0)
  )
    return null;
  const intervals: { start: number; end: number; kind: 'RESERVED' | 'CLOSED' }[] = [];
  const append = (startsAt: string, endsAt: string, kind: 'RESERVED' | 'CLOSED') => {
    const actualStart = Date.parse(startsAt),
      actualEnd = Date.parse(endsAt);
    if (!Number.isFinite(actualStart) || !Number.isFinite(actualEnd) || actualEnd <= actualStart)
      return false;
    if (actualStart < end && actualEnd > start)
      intervals.push({ start: Math.max(start, actualStart), end: Math.min(end, actualEnd), kind });
    return true;
  };
  for (const booking of context.occupancy.filter((row) => row.resourceId === resource.resourceId)) {
    if (
      !['RESERVED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'RELEASED', 'NO_SHOW'].includes(
        booking.status
      )
    )
      return null;
    if (
      ['RESERVED', 'CHECKED_IN', 'COMPLETED'].includes(booking.status) &&
      !append(booking.startsAt, booking.endsAt, 'RESERVED')
    )
      return null;
  }
  for (const closure of context.closures ?? []) {
    if (
      closure.resourceId === resource.resourceId &&
      (closure.availability !== 'UNAVAILABLE' ||
        !append(closure.startsAt, closure.endsAt, 'CLOSED'))
    )
      return null;
  }
  const boundaries = [
    ...new Set([start, end, ...intervals.flatMap((interval) => [interval.start, interval.end])]),
  ].sort((a, b) => a - b);
  const segments: WorkplaceWindowSegment[] = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const from = boundaries[index - 1],
      to = boundaries[index];
    const overlapping = intervals.filter((interval) => interval.start < to && interval.end > from);
    const kind = overlapping.some((interval) => interval.kind === 'CLOSED')
      ? 'CLOSED'
      : overlapping.length
        ? 'RESERVED'
        : 'UNRESERVED';
    const previous = segments.at(-1);
    if (previous?.kind === kind) previous.endsAt = new Date(to).toISOString();
    else
      segments.push({
        startsAt: new Date(from).toISOString(),
        endsAt: new Date(to).toISOString(),
        kind,
      });
  }
  return { policy, segments, startsAt: context.startsAt, endsAt: context.endsAt };
}
