import { normalizeVideoMeetingCode } from '@dwp-frontend/shared-utils/api/video-meeting-api';

export const MIN_JOIN_CODE_LENGTH = 10;
export const MAX_JOIN_CODE_LENGTH = 16;
export const MAX_FORMATTED_JOIN_CODE_LENGTH = 19;

export type MeetingJoinStep = 0 | 1 | 2;
export type MeetingJoinRequestState = 'WAITING' | 'APPROVED' | 'DENIED';
export type MeetingJoinDenialReason = 'MEETING_UNAVAILABLE' | 'POLICY_UNAVAILABLE';

export function formatJoinCode(value: string): string {
  return (
    normalizeVideoMeetingCode(value)
      .match(/.{1,4}/gu)
      ?.join('-') ?? ''
  );
}

export function hasValidJoinCodeLength(value: string): boolean {
  const length = normalizeVideoMeetingCode(value).length;
  return length >= MIN_JOIN_CODE_LENGTH && length <= MAX_JOIN_CODE_LENGTH;
}

export function maskJoinCode(value: string): string {
  const groups = formatJoinCode(value).split('-').filter(Boolean);
  return groups
    .map((group, index) => (index === groups.length - 1 ? group : '•'.repeat(group.length)))
    .join('-');
}

export function visibleJoinCodeSuffix(value: string): string {
  return normalizeVideoMeetingCode(value).slice(-4);
}

export function safeJoinDenialReason(value?: string | null): MeetingJoinDenialReason {
  return value === 'MEETING_UNAVAILABLE' ? value : 'POLICY_UNAVAILABLE';
}

export function meetingJoinStep(
  hasResolution: boolean,
  requestState?: MeetingJoinRequestState
): MeetingJoinStep {
  if (!hasResolution) return 0;
  return requestState === 'APPROVED' ? 2 : 1;
}

export function isJoinCodeLocked(requestState?: MeetingJoinRequestState): boolean {
  return requestState === 'WAITING';
}
