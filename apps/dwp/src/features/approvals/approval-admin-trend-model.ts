import type { ApprovalAdminPulse } from '@dwp-frontend/shared-utils';

const METRICS = [
  'submittedRequests',
  'completedRequests',
  'slaBreaches',
  'unresolvedDeliveryUpdates',
  'inFlightRequests',
  'slaEligibleTasks',
] as const;

export function approvalAdminTrendView(trend: ApprovalAdminPulse['trend']) {
  if (!trend || trend.windowHours !== 72 || trend.bucketHours !== 6 || trend.buckets.length !== 12)
    return undefined;
  const generatedAt = Date.parse(trend.generatedAt);
  if (!Number.isFinite(generatedAt)) return undefined;
  let previousEnd: number | undefined;
  const totals = Object.fromEntries(METRICS.map((metric) => [metric, 0])) as Record<
    (typeof METRICS)[number],
    number
  >;
  let maximumInFlight = 0;
  for (const bucket of trend.buckets) {
    const startsAt = Date.parse(bucket.startsAt);
    const endsAt = Date.parse(bucket.endsAt);
    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt) ||
      endsAt - startsAt !== trend.bucketHours * 60 * 60 * 1000 ||
      (previousEnd !== undefined && startsAt !== previousEnd)
    )
      return undefined;
    previousEnd = endsAt;
    for (const metric of METRICS) {
      const value = bucket[metric];
      if (!Number.isSafeInteger(value) || value < 0) return undefined;
      totals[metric] += value;
    }
    if (bucket.slaBreaches > bucket.slaEligibleTasks) return undefined;
    maximumInFlight = Math.max(maximumInFlight, bucket.inFlightRequests);
  }
  const first = Date.parse(trend.buckets[0]!.startsAt);
  const last = Date.parse(trend.buckets.at(-1)!.endsAt);
  if (
    last - first !== trend.windowHours * 60 * 60 * 1000 ||
    generatedAt < Date.parse(trend.buckets.at(-1)!.startsAt) ||
    generatedAt >= last
  )
    return undefined;
  const slaCompliancePercent =
    totals.slaEligibleTasks === 0
      ? undefined
      : ((totals.slaEligibleTasks - totals.slaBreaches) / totals.slaEligibleTasks) * 100;
  return {
    trend,
    totals,
    maximumInFlight: Math.max(1, maximumInFlight),
    slaCompliancePercent,
  };
}
