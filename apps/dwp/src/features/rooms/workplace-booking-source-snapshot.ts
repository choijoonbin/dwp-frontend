export type WorkplaceBookingSourceSnapshot = {
  identityKey: string;
  resourceId: string;
  resourceVersion: number;
  rangeFrom: string;
  rangeTo: string;
  generatedAt: string;
  policyVersion: number;
  bookingEligibility?: {
    evaluatedAt: string;
    excludedEventId: string | null;
  };
};

type WorkplaceBookingSourceExpectation = {
  resourceId: string | null | undefined;
  resourceVersion: number | null | undefined;
  rangeFrom: string | null | undefined;
  rangeTo: string | null | undefined;
  policyVersion: number | null | undefined;
  requireBookingEligibility?: boolean;
  excludedEventId?: string | null;
};

export function workplaceBookingInstantMatches(
  left: string | null | undefined,
  right: string | null | undefined
) {
  if (!left || !right) return false;
  const leftInstant = Date.parse(left);
  const rightInstant = Date.parse(right);
  return (
    Number.isFinite(leftInstant) && Number.isFinite(rightInstant) && leftInstant === rightInstant
  );
}

export function workplaceBookingSourceVerified(
  snapshot: WorkplaceBookingSourceSnapshot | null | undefined,
  expected: WorkplaceBookingSourceExpectation
) {
  if (snapshot === undefined) return true;
  return Boolean(
    snapshot &&
    snapshot.identityKey &&
    Number.isFinite(Date.parse(snapshot.generatedAt)) &&
    snapshot.resourceId === expected.resourceId &&
    snapshot.resourceVersion === expected.resourceVersion &&
    workplaceBookingInstantMatches(snapshot.rangeFrom, expected.rangeFrom) &&
    workplaceBookingInstantMatches(snapshot.rangeTo, expected.rangeTo) &&
    snapshot.policyVersion === expected.policyVersion &&
    (!expected.requireBookingEligibility ||
      (snapshot.bookingEligibility &&
        workplaceBookingInstantMatches(
          snapshot.bookingEligibility.evaluatedAt,
          snapshot.generatedAt
        ) &&
        snapshot.bookingEligibility.excludedEventId === (expected.excludedEventId ?? null)))
  );
}
