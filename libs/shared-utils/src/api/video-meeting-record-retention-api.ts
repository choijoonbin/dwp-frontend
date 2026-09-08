import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

const states = [
  'UNCONFIGURED',
  'HELD',
  'AWAITING_AUTHORIZATION',
  'BLOCKED',
  'ELIGIBLE',
  'PURGED',
] as const;
export type MeetingRecordRetention = {
  meetingId: string;
  meetingVersion: number;
  policyVersion: number;
  controlVersion: number;
  retentionUntil: string;
  hold: boolean;
  purgeAuthorized: boolean;
  state: (typeof states)[number];
  reasons: string[];
  authorizationAuditPublished: boolean;
  workerEnabled: boolean;
  purgedAt: string | null;
};
export type MeetingRecordRetentionCommand = {
  expectedMeetingVersion: number;
  expectedPolicyVersion: number;
  expectedControlVersion: number;
  hold: boolean;
  purgeAuthorized: boolean;
};
export function meetingRecordReference(value: string): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value)
    ? value.toLowerCase()
    : null;
}
const version = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
      value
    );
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  // Date.parse normalizes impossible dates such as February 30; a deadline must not.
  const year = Number(parts[1]),
    month = Number(parts[2]),
    day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = monthDays[month - 1];
  return days !== undefined && day >= 1 && day <= days;
}
function consistent(value: MeetingRecordRetention) {
  if (
    value.controlVersion === 0 &&
    (value.hold || value.purgeAuthorized || value.authorizationAuditPublished)
  )
    return false;
  if (value.state === 'PURGED')
    return (
      !value.hold &&
      value.purgeAuthorized &&
      value.authorizationAuditPublished &&
      value.reasons.length === 0 &&
      value.purgedAt !== null &&
      Date.parse(value.purgedAt) >= Date.parse(value.retentionUntil)
    );
  // Match the owner's projection order, including approved but disabled workers.
  const expected = value.hold
    ? 'HELD'
    : !value.workerEnabled
      ? 'UNCONFIGURED'
      : !value.purgeAuthorized
        ? 'AWAITING_AUTHORIZATION'
        : value.reasons.length === 0
          ? 'ELIGIBLE'
          : 'BLOCKED';
  return value.state === expected && (expected !== 'ELIGIBLE' || value.authorizationAuditPublished);
}
function reference(value: string) {
  const id = meetingRecordReference(value);
  if (!id) throw new Error('Invalid meeting retention reference');
  return id;
}
function project(value: MeetingRecordRetention, meetingId: string): MeetingRecordRetention {
  if (
    !value ||
    value.meetingId !== meetingId ||
    !version(value.meetingVersion) ||
    !version(value.policyVersion) ||
    !version(value.controlVersion) ||
    !instant(value.retentionUntil) ||
    !states.includes(value.state) ||
    ![
      value.hold,
      value.purgeAuthorized,
      value.authorizationAuditPublished,
      value.workerEnabled,
    ].every((v) => typeof v === 'boolean') ||
    (value.hold && value.purgeAuthorized) ||
    !Array.isArray(value.reasons) ||
    value.reasons.length > 64 ||
    !value.reasons.every(
      (reason) => typeof reason === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/u.test(reason)
    ) ||
    (value.purgedAt !== null && !instant(value.purgedAt)) ||
    (value.state === 'PURGED') !== (value.purgedAt !== null) ||
    !consistent(value)
  )
    throw new Error('Invalid meeting retention projection');
  // Administrative metadata only: never retain an unexpected title, actor, or locator.
  return {
    meetingId,
    meetingVersion: value.meetingVersion,
    policyVersion: value.policyVersion,
    controlVersion: value.controlVersion,
    retentionUntil: value.retentionUntil,
    hold: value.hold,
    purgeAuthorized: value.purgeAuthorized,
    state: value.state,
    reasons: [...value.reasons],
    authorizationAuditPublished: value.authorizationAuditPublished,
    workerEnabled: value.workerEnabled,
    purgedAt: value.purgedAt,
  };
}
export async function getMeetingRecordRetention(meetingId: string, signal?: AbortSignal) {
  const id = reference(meetingId);
  const response = await axiosInstance.get<ApiResponse<MeetingRecordRetention>>(
    `${VIDEO_MEETING_API_BASE}/admin/record-retention/meetings/${id}`,
    { signal, timeoutMs: 8_000 }
  );
  return project(response.data.data, id);
}
export async function updateMeetingRecordRetention(
  meetingId: string,
  input: MeetingRecordRetentionCommand,
  commandId: string,
  signal?: AbortSignal
) {
  const id = reference(meetingId);
  reference(commandId);
  if (
    !input ||
    !version(input.expectedMeetingVersion) ||
    !version(input.expectedPolicyVersion) ||
    !version(input.expectedControlVersion) ||
    typeof input.hold !== 'boolean' ||
    typeof input.purgeAuthorized !== 'boolean' ||
    (input.hold && input.purgeAuthorized)
  )
    throw new Error('Invalid meeting retention command');
  const body = {
    expectedMeetingVersion: input.expectedMeetingVersion,
    expectedPolicyVersion: input.expectedPolicyVersion,
    expectedControlVersion: input.expectedControlVersion,
    hold: input.hold,
    purgeAuthorized: input.purgeAuthorized,
  };
  const response = await axiosInstance.put<
    ApiResponse<MeetingRecordRetention>,
    MeetingRecordRetentionCommand
  >(`${VIDEO_MEETING_API_BASE}/admin/record-retention/meetings/${id}`, body, {
    signal,
    timeoutMs: 8_000,
    headers: { 'Idempotency-Key': commandId },
  });
  const result = project(response.data.data, id);
  // Exact replays return the current state, not an earlier approval over a later hold.
  if (result.controlVersion <= input.expectedControlVersion)
    throw new Error('Meeting retention command did not advance');
  return result;
}
