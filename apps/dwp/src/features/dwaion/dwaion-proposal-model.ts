import { Temporal } from 'temporal-polyfill';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { readRegionalPreference, type DwaionProposal } from '@dwp-frontend/shared-utils';

type ProposalSnoozeOption = 'TWO_HOURS' | 'TOMORROW' | 'NEXT_WEEK';

export function proposalTimeZone(): string {
  const preference = readRegionalPreference().timeZone;
  return preference === 'system' ? resolveSystemTimeZone('UTC') : preference;
}

export function proposalSnoozeTime(
  option: ProposalSnoozeOption,
  now = new Date(),
  timeZone = proposalTimeZone()
): string {
  const zoned = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timeZone);
  const target =
    option === 'TWO_HOURS'
      ? zoned.add({ hours: 2 })
      : zoned
          .add({ days: option === 'TOMORROW' ? 1 : (8 - zoned.dayOfWeek) % 7 || 7 })
          .with({ hour: 9, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return new Date(Number(target.epochMilliseconds)).toISOString();
}

export function proposalCanDecide(proposal: DwaionProposal, now = new Date()): boolean {
  return (
    (proposal.state === 'PENDING' || proposal.state === 'SNOOZED') &&
    Date.parse(proposal.expiresAt) > now.getTime()
  );
}

export function proposalCanSnoozeUntil(
  proposal: DwaionProposal,
  until: string,
  now = new Date()
): boolean {
  const target = Date.parse(until);
  return (
    proposalCanDecide(proposal, now) &&
    target > now.getTime() &&
    target < Date.parse(proposal.expiresAt)
  );
}

export function proposalEvidenceRoute(route: string | null | undefined): string | null {
  if (!route || !/^\/(?!\/)/u.test(route) || /[\\\s]/u.test(route)) return null;
  try {
    const url = new URL(route, 'https://dwp.invalid');
    const path = decodeURIComponent(url.pathname);
    const decoded = decodeURIComponent(route);
    if (
      url.origin !== 'https://dwp.invalid' ||
      path.startsWith('//') ||
      /[\\\s]/u.test(path) ||
      decoded.includes('\\') ||
      [...decoded].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      )
    )
      return null;
    return route;
  } catch {
    return null;
  }
}

export function proposalIsHighPriority(proposal: DwaionProposal): boolean {
  return proposal.priority === 'HIGH' || proposal.priority === 'URGENT';
}
