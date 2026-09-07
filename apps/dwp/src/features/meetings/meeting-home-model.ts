import {
  normalizeVideoMeetingCode,
  type VideoMeetingSummary,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

export function formatHomeJoinCode(value: string): string {
  return (
    normalizeVideoMeetingCode(value)
      .slice(0, 16)
      .match(/.{1,4}/gu)
      ?.join('-') ?? ''
  );
}
export function homeMeetingPath(meeting: VideoMeetingSummary): string {
  const id = encodeURIComponent(meeting.meetingId);
  return meeting.lifecycleState === 'ENDED' || meeting.lifecycleState === 'CANCELLED'
    ? '/meetings/history?meeting=' + id
    : '/meetings/room/' + id;
}

/**
 * Keep the command surface focused on an actionable live or timed meeting.
 * An instant meeting can remain in LOBBY after its creator leaves before the
 * media room starts; that untimed shell must not permanently outrank today's
 * scheduled work.
 */
export function homeFocusMeeting(
  activeMeeting: VideoMeetingSummary | null | undefined,
  nextMeeting: VideoMeetingSummary | null | undefined,
  today: readonly VideoMeetingSummary[]
): VideoMeetingSummary | null {
  const active =
    activeMeeting?.lifecycleState === 'LIVE'
      ? activeMeeting
      : today.find((candidate) => candidate.lifecycleState === 'LIVE');
  if (active) return active;
  if (nextMeeting?.startsAt && Number.isFinite(Date.parse(nextMeeting.startsAt))) {
    return nextMeeting;
  }
  return (
    today.find(
      (candidate) =>
        candidate.startsAt &&
        Number.isFinite(Date.parse(candidate.startsAt)) &&
        ['SCHEDULED', 'LOBBY'].includes(candidate.lifecycleState)
    ) ??
    nextMeeting ??
    null
  );
}
export function homeMeetingMinutesUntil(meeting: VideoMeetingSummary, now: number): number | null {
  if (meeting.lifecycleState !== 'SCHEDULED') return null;
  const delta = Date.parse(meeting.startsAt) - now;
  return Number.isFinite(delta) && delta > 0 ? Math.ceil(delta / 60_000) : null;
}

/**
 * Project only explicit agenda lines into the home command surface. Commas and
 * sentences are intentionally not inferred as separate agenda items because
 * the meeting contract does not guarantee that they are structured slots.
 */
export function homeAgendaItems(agenda: string | null | undefined): string[] {
  if (!agenda) return [];
  return agenda
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/u, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}
export function homeMeetingDate(
  value: string | number,
  language: string,
  timeZone: string,
  timeOnly = false
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = timeOnly
    ? { hour: '2-digit', minute: '2-digit', timeZone }
    : { month: 'short', day: 'numeric', weekday: 'short', timeZone };
  try {
    return formatDate(date, options, resolveSupportedLocale(language));
  } catch {
    return formatDate(date, { ...options, timeZone: 'UTC' }, 'en');
  }
}
export function homeUnavailableReason(
  reason: string | null | undefined
): 'policy' | 'temporary' | 'configuration' {
  if (reason === 'MEETINGS_DISABLED' || reason === 'MEETINGS_DISABLED_BY_POLICY') return 'policy';
  if (
    [
      'CAPABILITY_NOT_READY',
      'MEETING_PROVIDER_UNAVAILABLE',
      'REALTIME_PROVIDER_LIVENESS_NOT_READY',
      'REALTIME_PROVIDER_UNAVAILABLE',
    ].includes(reason ?? '')
  )
    return 'temporary';
  return 'configuration';
}
