import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type { ScheduleVideoMeetingInput } from './video-meeting-api';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';
import { serializeVideoMeetingPreparationSource } from './video-meeting-preparation-api';

export type VideoMeetingRecurrence = {
  frequency: 'WEEKLY' | 'MONTHLY';
  interval: number;
  occurrenceCount: number;
};
export type VideoMeetingOccurrencePreview = {
  occurrenceIndex: number;
  startsAt: string;
  localStart: string;
  utcOffset: string;
  adjustment:
    'NONE' | 'DST_GAP_SHIFT_FORWARD' | 'DST_OVERLAP_EXPLICIT_OFFSET' | 'MONTH_END_CLAMPED';
};
export type VideoMeetingSeriesPreview = {
  previewFingerprint: string;
  hasCalendarAdjustments: boolean;
  occurrences: VideoMeetingOccurrencePreview[];
};
export type VideoMeetingScheduleState = {
  meetingId: string;
  lifecycleState: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  meetingVersion: number;
  seriesId: string | null;
  occurrenceIndex: number | null;
  occurrenceCount: number | null;
  frequency: 'WEEKLY' | 'MONTHLY' | null;
  recurrenceInterval: number | null;
  seriesVersion: number | null;
  exceptionState: 'NONE' | 'RESCHEDULED' | 'CANCELLED';
  invitationRevision: number;
  deliveryState: 'NONE' | 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
};
export type VideoMeetingRescheduleInput = {
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  scope: 'THIS_ONLY' | 'THIS_AND_FUTURE';
  expectedSeriesVersion: number | null;
  expectedVersion: number;
  calendarFingerprint?: string | null;
};
export type VideoMeetingCancellationPreview = {
  impactFingerprint: string;
  scope: 'THIS_ONLY' | 'THIS_AND_FUTURE';
  affectedOccurrenceCount: number;
  skippedImmutableOccurrenceCount: number;
  invitationRevision: number;
  seriesVersion: number | null;
};
export type VideoMeetingScheduleDraftStep = 'DETAILS' | 'SCHEDULE' | 'RECURRENCE' | 'REVIEW';
export type VideoMeetingScheduleDraftRecurrence = {
  frequency: 'NONE' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  occurrenceCount: number;
};
export type VideoMeetingScheduleDraftAgendaInput = {
  itemId?: string | null;
  title?: string | null;
  objective?: string | null;
  ownerUserId?: number | null;
  plannedMinutes?: number | null;
};
export type VideoMeetingScheduleDraftInput = {
  expectedVersion: number | null;
  title?: string | null;
  agenda?: string | null;
  startsAt?: string | null;
  durationMinutes?: number | null;
  timeZone?: string | null;
  accessScope?: 'INTERNAL' | 'INVITED' | null;
  waitingRoomEnabled?: boolean | null;
  allowJoinBeforeHost?: boolean | null;
  participantUserIds?: number[];
  agendaItems?: VideoMeetingScheduleDraftAgendaInput[];
  recurrence?: VideoMeetingScheduleDraftRecurrence | null;
  sourceTemplateId?: string | null;
  sourceTemplateVersion?: number | null;
  lastStep?: VideoMeetingScheduleDraftStep;
};
export type VideoMeetingScheduleDraftParticipant = {
  userId: number;
  personPublicId: string | null;
  emailAddress: string;
  displayName: string;
  jobTitle: string | null;
  organizationName: string | null;
};
export type VideoMeetingScheduleDraftAgendaItem = {
  itemId: string;
  position: number;
  title: string | null;
  objective: string | null;
  ownerUserId: number | null;
  plannedMinutes: number | null;
};
export type VideoMeetingScheduleDraft = {
  draftId: string;
  title: string | null;
  agenda: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  timeZone: string | null;
  accessScope: 'INTERNAL' | 'INVITED' | null;
  waitingRoomEnabled: boolean | null;
  allowJoinBeforeHost: boolean | null;
  participants: VideoMeetingScheduleDraftParticipant[];
  agendaItems: VideoMeetingScheduleDraftAgendaItem[];
  recurrence: VideoMeetingScheduleDraftRecurrence | null;
  sourceTemplateId: string | null;
  sourceTemplateVersion: number | null;
  lastStep: VideoMeetingScheduleDraftStep;
  version: number;
  retentionUntil: string;
  updatedAt: string;
};
export type VideoMeetingScheduleDraftSlot = {
  draft: VideoMeetingScheduleDraft | null;
  discardOnly: boolean;
  draftId: string | null;
  version: number | null;
  retentionUntil: string | null;
  observedAt: string;
};
export type VideoMeetingScheduleDraftCommit = { meetingId: string; meetingCode: string };
export type VideoMeetingScheduleDraftDiscard = {
  draftId: string;
  version: number;
  discarded: true;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const sha256 = /^[0-9a-f]{64}$/u;
const offset = /^(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/u;
const adjustments = new Set([
  'NONE',
  'DST_GAP_SHIFT_FORWARD',
  'DST_OVERLAP_EXPLICIT_OFFSET',
  'MONTH_END_CLAMPED',
]);
const lifecycleStates = new Set(['DRAFT', 'SCHEDULED', 'LOBBY', 'LIVE', 'ENDED', 'CANCELLED']);
const deliveryStates = new Set(['NONE', 'PENDING', 'DELIVERED', 'FAILED', 'CANCELLED']);
const exceptionStates = new Set(['NONE', 'RESCHEDULED', 'CANCELLED']);
const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/u;
const meetingCode = /^[A-HJ-NP-Z2-9]{10,16}$/u;
const draftSteps = new Set(['DETAILS', 'SCHEDULE', 'RECURRENCE', 'REVIEW']);

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function nullableText(value: unknown, maximum: number, message: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maximum) throw new Error(message);
  return value;
}

function optionalText(value: unknown, maximum: number, message: string) {
  if (value === undefined) return undefined;
  return nullableText(value, maximum, message);
}

function timestamp(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value)))
    throw new Error(message);
  return value;
}

function nullableTimestamp(value: unknown, message: string): string | null {
  return value === null ? null : timestamp(value, message);
}

function positiveId(value: unknown, message: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(message);
  return value as number;
}

function nullablePositiveId(value: unknown, message: string): number | null {
  return value === null ? null : positiveId(value, message);
}

function nullableBoolean(value: unknown, message: string): boolean | null {
  if (value !== null && typeof value !== 'boolean') throw new Error(message);
  return value;
}

function timeZone(value: unknown, message: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value || value.length > 80) throw new Error(message);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
  } catch {
    throw new Error(message);
  }
  return value;
}

function validVersion(value: number | null, nullable = false) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0)
    throw new Error('Invalid schedule version');
  return value as number;
}

function meetingPath(meetingId: string, suffix: string) {
  if (!uuid.test(meetingId)) throw new Error('Invalid meeting reference');
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/${suffix}`;
}

function command(key: string) {
  if (!uuid.test(key)) throw new Error('A stable UUID idempotency key is required');
  return { headers: { 'Idempotency-Key': key } };
}

function zonedOffsetIso(value: string, timeZone: string) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid meeting start');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const zoneName = part('timeZoneName');
  const zoneOffset = zoneName === 'GMT' ? 'Z' : zoneName?.replace('GMT', '');
  if (!zoneOffset?.match(/^(?:Z|[+-]\d{2}:\d{2})$/u))
    throw new Error('The selected time zone offset is unavailable');
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part(
    'second'
  )}${zoneOffset}`;
}

function meetingPayload(input: ScheduleVideoMeetingInput) {
  if (!input.title.trim() || !Number.isFinite(Date.parse(input.startsAt)))
    throw new Error('Invalid recurring meeting input');
  return {
    title: input.title.trim(),
    description: null,
    agenda: input.agenda?.trim() || null,
    startsAt: zonedOffsetIso(input.startsAt, input.timeZone),
    durationMinutes: input.durationMinutes,
    timeZone: input.timeZone,
    accessScope: input.accessScope,
    waitingRoomEnabled: input.waitingRoomEnabled,
    guestAccessEnabled: input.accessScope === 'PUBLIC_CODE',
    allowJoinBeforeHost: input.allowJoinBeforeHost,
    defaultMicrophoneEnabled: input.defaultMicrophoneEnabled,
    defaultCameraEnabled: input.defaultCameraEnabled,
    participantUserIds: input.participantUserIds,
    guestInvitees: [],
    ...serializeVideoMeetingPreparationSource(input),
  };
}

function recurrencePayload(recurrence: VideoMeetingRecurrence) {
  if (
    !['WEEKLY', 'MONTHLY'].includes(recurrence.frequency) ||
    !Number.isInteger(recurrence.interval) ||
    recurrence.interval < 1 ||
    recurrence.interval > 12 ||
    !Number.isInteger(recurrence.occurrenceCount) ||
    recurrence.occurrenceCount < 2 ||
    recurrence.occurrenceCount > 52
  )
    throw new Error('Invalid meeting recurrence');
  return recurrence;
}

function draftRecurrence(value: unknown): VideoMeetingScheduleDraftRecurrence | null {
  if (value === null) return null;
  const candidate = object(value, 'Invalid schedule draft recurrence');
  if (
    !['NONE', 'WEEKLY', 'MONTHLY'].includes(String(candidate.frequency)) ||
    !Number.isInteger(candidate.interval) ||
    (candidate.interval as number) < 1 ||
    (candidate.interval as number) > 12 ||
    !Number.isInteger(candidate.occurrenceCount) ||
    (candidate.occurrenceCount as number) < 2 ||
    (candidate.occurrenceCount as number) > 52
  )
    throw new Error('Invalid schedule draft recurrence');
  return {
    frequency: candidate.frequency as VideoMeetingScheduleDraftRecurrence['frequency'],
    interval: candidate.interval as number,
    occurrenceCount: candidate.occurrenceCount as number,
  };
}

function draftParticipant(value: unknown): VideoMeetingScheduleDraftParticipant {
  const candidate = object(value, 'Invalid schedule draft participant');
  const personPublicId = candidate.personPublicId;
  const emailAddress = candidate.emailAddress;
  const displayName = candidate.displayName;
  if (
    (personPublicId !== null &&
      (typeof personPublicId !== 'string' || !uuid.test(personPublicId))) ||
    typeof emailAddress !== 'string' ||
    !emailAddress ||
    emailAddress.length > 255 ||
    typeof displayName !== 'string' ||
    !displayName ||
    displayName.length > 160
  )
    throw new Error('Invalid schedule draft participant');
  return {
    userId: positiveId(candidate.userId, 'Invalid schedule draft participant'),
    personPublicId,
    emailAddress,
    displayName,
    jobTitle: nullableText(candidate.jobTitle, 180, 'Invalid schedule draft participant'),
    organizationName: nullableText(
      candidate.organizationName,
      180,
      'Invalid schedule draft participant'
    ),
  };
}

function draftAgendaItem(value: unknown, position: number): VideoMeetingScheduleDraftAgendaItem {
  const candidate = object(value, 'Invalid schedule draft agenda item');
  if (
    !uuid.test(String(candidate.itemId)) ||
    candidate.position !== position ||
    (candidate.plannedMinutes !== null &&
      (!Number.isInteger(candidate.plannedMinutes) ||
        (candidate.plannedMinutes as number) < 1 ||
        (candidate.plannedMinutes as number) > 1440))
  )
    throw new Error('Invalid schedule draft agenda item');
  return {
    itemId: candidate.itemId as string,
    position,
    title: nullableText(candidate.title, 240, 'Invalid schedule draft agenda item'),
    objective: nullableText(candidate.objective, 2000, 'Invalid schedule draft agenda item'),
    ownerUserId: nullablePositiveId(candidate.ownerUserId, 'Invalid schedule draft agenda item'),
    plannedMinutes: candidate.plannedMinutes as number | null,
  };
}

function parsedDraft(value: unknown): VideoMeetingScheduleDraft {
  const candidate = object(value, 'Invalid schedule draft');
  if (
    !uuid.test(String(candidate.draftId)) ||
    !Array.isArray(candidate.participants) ||
    candidate.participants.length > 200 ||
    !Array.isArray(candidate.agendaItems) ||
    candidate.agendaItems.length > 50 ||
    !draftSteps.has(String(candidate.lastStep))
  )
    throw new Error('Invalid schedule draft');
  const participants = candidate.participants.map(draftParticipant);
  if (new Set(participants.map(({ userId }) => userId)).size !== participants.length)
    throw new Error('Invalid schedule draft participant');
  const agendaItems = candidate.agendaItems.map(draftAgendaItem);
  if (new Set(agendaItems.map(({ itemId }) => itemId)).size !== agendaItems.length)
    throw new Error('Invalid schedule draft agenda item');
  const sourceTemplateId = candidate.sourceTemplateId;
  const sourceTemplateVersion = candidate.sourceTemplateVersion;
  if (
    (sourceTemplateId === null) !== (sourceTemplateVersion === null) ||
    (sourceTemplateId !== null &&
      (typeof sourceTemplateId !== 'string' || !uuid.test(sourceTemplateId)))
  )
    throw new Error('Invalid schedule draft source');
  const retentionUntil = timestamp(candidate.retentionUntil, 'Invalid schedule draft retention');
  const updatedAt = timestamp(candidate.updatedAt, 'Invalid schedule draft update time');
  if (Date.parse(retentionUntil) <= Date.parse(updatedAt))
    throw new Error('Invalid schedule draft retention');
  const startsAt = nullableTimestamp(candidate.startsAt, 'Invalid schedule draft start');
  const durationMinutes = candidate.durationMinutes;
  if (
    durationMinutes !== null &&
    (!Number.isInteger(durationMinutes) ||
      (durationMinutes as number) < 5 ||
      (durationMinutes as number) > 1440)
  )
    throw new Error('Invalid schedule draft duration');
  const accessScope = candidate.accessScope;
  if (accessScope !== null && accessScope !== 'INTERNAL' && accessScope !== 'INVITED')
    throw new Error('Invalid schedule draft access');
  return {
    draftId: candidate.draftId as string,
    title: nullableText(candidate.title, 240, 'Invalid schedule draft title'),
    agenda: nullableText(candidate.agenda, 8000, 'Invalid schedule draft agenda'),
    startsAt,
    durationMinutes: durationMinutes as number | null,
    timeZone: timeZone(candidate.timeZone, 'Invalid schedule draft time zone'),
    accessScope,
    waitingRoomEnabled: nullableBoolean(
      candidate.waitingRoomEnabled,
      'Invalid schedule draft waiting room'
    ),
    allowJoinBeforeHost: nullableBoolean(
      candidate.allowJoinBeforeHost,
      'Invalid schedule draft join policy'
    ),
    participants,
    agendaItems,
    recurrence: draftRecurrence(candidate.recurrence),
    sourceTemplateId: sourceTemplateId as string | null,
    sourceTemplateVersion:
      sourceTemplateVersion === null
        ? null
        : (validVersion(sourceTemplateVersion as number) as number),
    lastStep: candidate.lastStep as VideoMeetingScheduleDraftStep,
    version: validVersion(candidate.version as number) as number,
    retentionUntil,
    updatedAt,
  };
}

function parsedDraftSlot(value: unknown): VideoMeetingScheduleDraftSlot {
  const candidate = object(value, 'Invalid schedule draft slot');
  if (typeof candidate.discardOnly !== 'boolean') throw new Error('Invalid schedule draft slot');
  const observedAt = timestamp(candidate.observedAt, 'Invalid schedule draft observation');
  const draft = candidate.draft === null ? null : parsedDraft(candidate.draft);
  const draftId = candidate.draftId;
  const version = candidate.version;
  const retentionUntil = candidate.retentionUntil;
  if (draft) {
    if (
      candidate.discardOnly ||
      draftId !== draft.draftId ||
      version !== draft.version ||
      retentionUntil !== draft.retentionUntil
    )
      throw new Error('Invalid schedule draft slot binding');
  } else if (candidate.discardOnly) {
    if (
      typeof draftId !== 'string' ||
      !uuid.test(draftId) ||
      typeof version !== 'number' ||
      validVersion(version) !== version ||
      typeof retentionUntil !== 'string'
    )
      throw new Error('Invalid schedule draft discard slot');
  } else if (draftId !== null || version !== null || retentionUntil !== null) {
    throw new Error('Invalid empty schedule draft slot');
  }
  const parsedRetention =
    retentionUntil === null ? null : timestamp(retentionUntil, 'Invalid schedule draft retention');
  if (parsedRetention !== null && Date.parse(parsedRetention) <= Date.parse(observedAt))
    throw new Error('Invalid schedule draft retention');
  return {
    draft,
    discardOnly: candidate.discardOnly,
    draftId: draftId as string | null,
    version: version as number | null,
    retentionUntil: parsedRetention,
    observedAt,
  };
}

function draftAgendaPayload(items: VideoMeetingScheduleDraftAgendaInput[]) {
  if (!Array.isArray(items) || items.length > 50) throw new Error('Invalid schedule draft agenda');
  const seen = new Set<string>();
  return items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid schedule draft agenda');
    const result: Record<string, unknown> = {};
    if (item.itemId !== undefined) {
      if (item.itemId !== null && (!uuid.test(item.itemId) || seen.has(item.itemId)))
        throw new Error('Invalid schedule draft agenda');
      if (item.itemId) seen.add(item.itemId);
      result.itemId = item.itemId;
    }
    if (item.title !== undefined)
      result.title = optionalText(item.title, 240, 'Invalid schedule draft agenda');
    if (item.objective !== undefined)
      result.objective = optionalText(item.objective, 2000, 'Invalid schedule draft agenda');
    if (item.ownerUserId !== undefined)
      result.ownerUserId =
        item.ownerUserId === null
          ? null
          : positiveId(item.ownerUserId, 'Invalid schedule draft agenda');
    if (item.plannedMinutes !== undefined) {
      if (
        item.plannedMinutes !== null &&
        (!Number.isInteger(item.plannedMinutes) ||
          item.plannedMinutes < 1 ||
          item.plannedMinutes > 1440)
      )
        throw new Error('Invalid schedule draft agenda');
      result.plannedMinutes = item.plannedMinutes;
    }
    return result;
  });
}

function draftPayload(input: VideoMeetingScheduleDraftInput) {
  if (!input || typeof input !== 'object') throw new Error('Invalid schedule draft input');
  const payload: Record<string, unknown> = {
    expectedVersion:
      input.expectedVersion === null ? null : (validVersion(input.expectedVersion) as number),
  };
  if (input.title !== undefined)
    payload.title = optionalText(input.title, 240, 'Invalid schedule draft title');
  if (input.agenda !== undefined)
    payload.agenda = optionalText(input.agenda, 8000, 'Invalid schedule draft agenda');
  if (input.startsAt !== undefined)
    payload.startsAt =
      input.startsAt === null ? null : timestamp(input.startsAt, 'Invalid schedule draft start');
  if (input.durationMinutes !== undefined) {
    if (
      input.durationMinutes !== null &&
      (!Number.isInteger(input.durationMinutes) ||
        input.durationMinutes < 5 ||
        input.durationMinutes > 1440)
    )
      throw new Error('Invalid schedule draft duration');
    payload.durationMinutes = input.durationMinutes;
  }
  if (input.timeZone !== undefined)
    payload.timeZone = timeZone(input.timeZone, 'Invalid schedule draft time zone');
  if (input.accessScope !== undefined) {
    if (
      input.accessScope !== null &&
      input.accessScope !== 'INTERNAL' &&
      input.accessScope !== 'INVITED'
    )
      throw new Error('Invalid schedule draft access');
    payload.accessScope = input.accessScope;
  }
  if (input.waitingRoomEnabled !== undefined)
    payload.waitingRoomEnabled = nullableBoolean(
      input.waitingRoomEnabled,
      'Invalid schedule draft waiting room'
    );
  if (input.allowJoinBeforeHost !== undefined)
    payload.allowJoinBeforeHost = nullableBoolean(
      input.allowJoinBeforeHost,
      'Invalid schedule draft join policy'
    );
  if (input.participantUserIds !== undefined) {
    if (!Array.isArray(input.participantUserIds) || input.participantUserIds.length > 200)
      throw new Error('Invalid schedule draft participants');
    const ids = input.participantUserIds.map((id) =>
      positiveId(id, 'Invalid schedule draft participants')
    );
    if (new Set(ids).size !== ids.length) throw new Error('Invalid schedule draft participants');
    payload.participantUserIds = ids;
  }
  if (input.agendaItems !== undefined) payload.agendaItems = draftAgendaPayload(input.agendaItems);
  if (input.recurrence !== undefined)
    payload.recurrence = input.recurrence === null ? null : draftRecurrence(input.recurrence);
  const sourceIdPresent = input.sourceTemplateId !== undefined;
  const sourceVersionPresent = input.sourceTemplateVersion !== undefined;
  if (sourceIdPresent !== sourceVersionPresent)
    throw new Error('Invalid schedule draft source binding');
  if (sourceIdPresent) {
    if (
      (input.sourceTemplateId === null) !== (input.sourceTemplateVersion === null) ||
      (input.sourceTemplateId !== null && !uuid.test(input.sourceTemplateId!))
    )
      throw new Error('Invalid schedule draft source binding');
    payload.sourceTemplateId = input.sourceTemplateId;
    payload.sourceTemplateVersion =
      input.sourceTemplateVersion === null
        ? null
        : (validVersion(input.sourceTemplateVersion!) as number);
  }
  if (input.lastStep !== undefined) {
    if (!draftSteps.has(input.lastStep)) throw new Error('Invalid schedule draft step');
    payload.lastStep = input.lastStep;
  }
  return payload;
}

function preview(value: unknown, expectedOccurrenceCount?: number): VideoMeetingSeriesPreview {
  const candidate = object(value, 'Invalid schedule preview');
  const rawOccurrences = candidate.occurrences;
  if (
    typeof candidate.previewFingerprint !== 'string' ||
    !sha256.test(candidate.previewFingerprint) ||
    typeof candidate.hasCalendarAdjustments !== 'boolean' ||
    !Array.isArray(rawOccurrences) ||
    rawOccurrences.length < 1 ||
    rawOccurrences.length > 52 ||
    (expectedOccurrenceCount !== undefined && rawOccurrences.length !== expectedOccurrenceCount)
  )
    throw new Error('Invalid schedule preview');
  let previousOccurrenceIndex = 0;
  const occurrences = rawOccurrences.map((value, index): VideoMeetingOccurrencePreview => {
    const item = object(value, 'Invalid schedule occurrence preview');
    const occurrenceIndex = item.occurrenceIndex;
    const startsAt = item.startsAt;
    const localStart = item.localStart;
    const utcOffset = item.utcOffset;
    const adjustment = item.adjustment;
    const localInstant =
      typeof localStart === 'string' && typeof utcOffset === 'string'
        ? Date.parse(localStart + (utcOffset === 'Z' ? 'Z' : utcOffset))
        : Number.NaN;
    if (
      typeof occurrenceIndex !== 'number' ||
      !Number.isSafeInteger(occurrenceIndex) ||
      occurrenceIndex < 1 ||
      occurrenceIndex > 52 ||
      occurrenceIndex <= previousOccurrenceIndex ||
      (expectedOccurrenceCount !== undefined && occurrenceIndex !== index + 1) ||
      typeof startsAt !== 'string' ||
      startsAt.length > 40 ||
      !Number.isFinite(Date.parse(startsAt)) ||
      typeof localStart !== 'string' ||
      !localDateTime.test(localStart) ||
      typeof utcOffset !== 'string' ||
      !offset.test(utcOffset) ||
      !Number.isFinite(localInstant) ||
      localInstant !== Date.parse(startsAt) ||
      typeof adjustment !== 'string' ||
      !adjustments.has(adjustment)
    )
      throw new Error('Invalid schedule occurrence preview');
    previousOccurrenceIndex = occurrenceIndex;
    return {
      occurrenceIndex,
      startsAt,
      localStart,
      utcOffset,
      adjustment: adjustment as VideoMeetingOccurrencePreview['adjustment'],
    };
  });
  if (candidate.hasCalendarAdjustments !== occurrences.some((item) => item.adjustment !== 'NONE'))
    throw new Error('Invalid schedule adjustment projection');
  return {
    previewFingerprint: candidate.previewFingerprint,
    hasCalendarAdjustments: candidate.hasCalendarAdjustments,
    occurrences,
  };
}

function state(value: VideoMeetingScheduleState, meetingId: string) {
  const start = value && Date.parse(value.startsAt);
  const end = value && Date.parse(value.endsAt);
  const standalone = value?.seriesId === null;
  const seriesConsistent = standalone
    ? value.seriesVersion === null &&
      value.occurrenceIndex === null &&
      value.occurrenceCount === null &&
      value.frequency === null &&
      value.recurrenceInterval === null
    : Boolean(
        value &&
        uuid.test(value.seriesId ?? '') &&
        Number.isSafeInteger(value.occurrenceIndex) &&
        (value.occurrenceIndex ?? 0) >= 1 &&
        Number.isSafeInteger(value.occurrenceCount) &&
        (value.occurrenceCount ?? 0) >= 2 &&
        (value.occurrenceCount ?? 0) <= 52 &&
        (value.occurrenceIndex ?? 0) <= (value.occurrenceCount ?? 0) &&
        (value.frequency === 'WEEKLY' || value.frequency === 'MONTHLY') &&
        Number.isSafeInteger(value.recurrenceInterval) &&
        (value.recurrenceInterval ?? 0) >= 1 &&
        (value.recurrenceInterval ?? 0) <= 12 &&
        value.seriesVersion !== null
      );
  if (
    !value ||
    value.meetingId !== meetingId ||
    !lifecycleStates.has(value.lifecycleState) ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end - start > 86_400_000 ||
    typeof value.timeZone !== 'string' ||
    !value.timeZone ||
    value.timeZone.length > 64 ||
    !exceptionStates.has(value.exceptionState) ||
    !deliveryStates.has(value.deliveryState) ||
    !Number.isSafeInteger(value.invitationRevision) ||
    value.invitationRevision < 1 ||
    !seriesConsistent
  )
    throw new Error('Invalid meeting schedule binding');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone }).format(0);
  } catch {
    throw new Error('Invalid meeting schedule time zone');
  }
  validVersion(value.meetingVersion);
  validVersion(value.seriesVersion, true);
  return value;
}

function reschedulePayload(input: VideoMeetingRescheduleInput) {
  if (
    !Number.isFinite(Date.parse(input.startsAt)) ||
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 1440 ||
    !input.timeZone ||
    !['THIS_ONLY', 'THIS_AND_FUTURE'].includes(input.scope) ||
    (input.scope === 'THIS_ONLY' && input.expectedSeriesVersion !== null) ||
    (input.scope === 'THIS_AND_FUTURE' && input.expectedSeriesVersion === null) ||
    (input.calendarFingerprint != null && !sha256.test(input.calendarFingerprint))
  )
    throw new Error('Invalid meeting schedule change');
  return {
    ...input,
    startsAt: zonedOffsetIso(input.startsAt, input.timeZone),
    expectedVersion: validVersion(input.expectedVersion),
    expectedSeriesVersion: validVersion(input.expectedSeriesVersion, true),
    calendarFingerprint: input.calendarFingerprint ?? null,
  };
}

export async function previewVideoMeetingSeries(
  input: ScheduleVideoMeetingInput,
  recurrence: VideoMeetingRecurrence,
  signal?: AbortSignal
) {
  const result = (
    await axiosInstance.post<
      ApiResponse<VideoMeetingSeriesPreview>,
      { meeting: ReturnType<typeof meetingPayload>; recurrence: VideoMeetingRecurrence }
    >(
      `${VIDEO_MEETING_API_BASE}/meeting-series/preview`,
      { meeting: meetingPayload(input), recurrence: recurrencePayload(recurrence) },
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  return preview(result, recurrence.occurrenceCount);
}

export async function createVideoMeetingSeries(
  input: ScheduleVideoMeetingInput,
  recurrence: VideoMeetingRecurrence,
  previewFingerprint: string,
  key: string
) {
  if (!sha256.test(previewFingerprint)) throw new Error('Invalid schedule preview fingerprint');
  const result = (
    await axiosInstance.post<
      ApiResponse<{ meeting: { meetingId: string } }>,
      {
        meeting: ReturnType<typeof meetingPayload>;
        recurrence: VideoMeetingRecurrence;
        previewFingerprint: string;
      }
    >(
      `${VIDEO_MEETING_API_BASE}/meeting-series`,
      {
        meeting: meetingPayload(input),
        recurrence: recurrencePayload(recurrence),
        previewFingerprint,
      },
      command(key)
    )
  ).data.data;
  if (!result?.meeting || !uuid.test(result.meeting.meetingId))
    throw new Error('Invalid created meeting binding');
  return result.meeting.meetingId;
}

export async function getVideoMeetingSchedule(meetingId: string, signal?: AbortSignal) {
  const result = (
    await axiosInstance.get<ApiResponse<VideoMeetingScheduleState>>(
      meetingPath(meetingId, 'schedule'),
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  return state(result, meetingId);
}

export async function previewVideoMeetingReschedule(
  meetingId: string,
  input: VideoMeetingRescheduleInput,
  signal?: AbortSignal
) {
  const result = (
    await axiosInstance.post<
      ApiResponse<VideoMeetingSeriesPreview>,
      ReturnType<typeof reschedulePayload>
    >(meetingPath(meetingId, 'schedule/preview'), reschedulePayload(input), {
      signal,
      timeoutMs: 8_000,
    })
  ).data.data;
  return preview(result);
}

export async function rescheduleVideoMeeting(
  meetingId: string,
  input: VideoMeetingRescheduleInput,
  key: string
) {
  const result = (
    await axiosInstance.put<
      ApiResponse<VideoMeetingScheduleState>,
      ReturnType<typeof reschedulePayload>
    >(meetingPath(meetingId, 'schedule'), reschedulePayload(input), command(key))
  ).data.data;
  return state(result, meetingId);
}

export async function cancelScheduledVideoMeeting(
  meetingId: string,
  input: Pick<
    VideoMeetingRescheduleInput,
    'scope' | 'expectedSeriesVersion' | 'expectedVersion'
  > & { impactFingerprint: string },
  key: string
) {
  if (
    (input.scope === 'THIS_ONLY' && input.expectedSeriesVersion !== null) ||
    (input.scope === 'THIS_AND_FUTURE' && input.expectedSeriesVersion === null) ||
    !sha256.test(input.impactFingerprint)
  )
    throw new Error('Invalid meeting cancellation scope');
  const payload = {
    scope: input.scope,
    expectedSeriesVersion: validVersion(input.expectedSeriesVersion, true),
    expectedVersion: validVersion(input.expectedVersion),
    impactFingerprint: input.impactFingerprint,
  };
  const result = (
    await axiosInstance.post<ApiResponse<VideoMeetingScheduleState>, typeof payload>(
      meetingPath(meetingId, 'cancel'),
      payload,
      command(key)
    )
  ).data.data;
  return state(result, meetingId);
}

export async function previewVideoMeetingCancellation(
  meetingId: string,
  input: Pick<VideoMeetingRescheduleInput, 'scope' | 'expectedSeriesVersion' | 'expectedVersion'>,
  signal?: AbortSignal
) {
  if (
    !['THIS_ONLY', 'THIS_AND_FUTURE'].includes(input.scope) ||
    (input.scope === 'THIS_ONLY' && input.expectedSeriesVersion !== null) ||
    (input.scope === 'THIS_AND_FUTURE' && input.expectedSeriesVersion === null)
  )
    throw new Error('Invalid meeting cancellation preview');
  const payload = {
    scope: input.scope,
    expectedSeriesVersion: validVersion(input.expectedSeriesVersion, true),
    expectedVersion: validVersion(input.expectedVersion),
  };
  const result = (
    await axiosInstance.post<ApiResponse<VideoMeetingCancellationPreview>, typeof payload>(
      meetingPath(meetingId, 'cancel/preview'),
      payload,
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  if (
    !result ||
    !sha256.test(result.impactFingerprint) ||
    result.scope !== input.scope ||
    !Number.isSafeInteger(result.affectedOccurrenceCount) ||
    result.affectedOccurrenceCount < 1 ||
    !Number.isSafeInteger(result.skippedImmutableOccurrenceCount) ||
    result.skippedImmutableOccurrenceCount < 0 ||
    result.affectedOccurrenceCount + result.skippedImmutableOccurrenceCount > 52 ||
    !Number.isSafeInteger(result.invitationRevision) ||
    result.invitationRevision < 1 ||
    (input.scope === 'THIS_ONLY' &&
      (result.affectedOccurrenceCount !== 1 ||
        result.skippedImmutableOccurrenceCount !== 0 ||
        result.seriesVersion !== null)) ||
    (input.scope === 'THIS_AND_FUTURE' && result.seriesVersion !== input.expectedSeriesVersion)
  )
    throw new Error('Invalid meeting cancellation impact');
  validVersion(result.seriesVersion, true);
  return result;
}

const VIDEO_MEETING_SCHEDULE_DRAFT_PATH = `${VIDEO_MEETING_API_BASE}/schedule-draft`;

/** Reads only the current authenticated user's singleton draft slot. */
export async function getVideoMeetingScheduleDraft(
  signal?: AbortSignal
): Promise<VideoMeetingScheduleDraftSlot> {
  const result = (
    await axiosInstance.get<ApiResponse<unknown>>(VIDEO_MEETING_SCHEDULE_DRAFT_PATH, {
      signal,
      timeoutMs: 8_000,
    })
  ).data.data;
  return parsedDraftSlot(result);
}

/**
 * Replaces the singleton draft with an allowlisted, optimistic payload. Identity, tenant,
 * device, consent, media-provider and token fields are deliberately never serialized.
 */
export async function saveVideoMeetingScheduleDraft(
  input: VideoMeetingScheduleDraftInput,
  idempotencyKey: string
): Promise<VideoMeetingScheduleDraft> {
  const payload = draftPayload(input);
  const result = (
    await axiosInstance.put<ApiResponse<unknown>, typeof payload>(
      VIDEO_MEETING_SCHEDULE_DRAFT_PATH,
      payload,
      command(idempotencyKey)
    )
  ).data.data;
  return parsedDraft(result);
}

export async function previewVideoMeetingScheduleDraftRecurrence(
  expectedVersion: number,
  signal?: AbortSignal
): Promise<VideoMeetingSeriesPreview> {
  const payload = { expectedVersion: validVersion(expectedVersion) as number };
  const result = (
    await axiosInstance.post<ApiResponse<unknown>, typeof payload>(
      `${VIDEO_MEETING_SCHEDULE_DRAFT_PATH}/recurrence-preview`,
      payload,
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  return preview(result);
}

export async function commitVideoMeetingScheduleDraft(
  expectedVersion: number,
  previewFingerprint: string | null,
  idempotencyKey: string
): Promise<VideoMeetingScheduleDraftCommit> {
  if (previewFingerprint !== null && !sha256.test(previewFingerprint))
    throw new Error('Invalid schedule draft preview fingerprint');
  const payload = {
    expectedVersion: validVersion(expectedVersion) as number,
    previewFingerprint,
  };
  const result = (
    await axiosInstance.post<ApiResponse<unknown>, typeof payload>(
      `${VIDEO_MEETING_SCHEDULE_DRAFT_PATH}/commit`,
      payload,
      command(idempotencyKey)
    )
  ).data.data;
  const created = object(result, 'Invalid committed meeting binding');
  const meeting = object(created.meeting, 'Invalid committed meeting binding');
  if (
    typeof meeting.meetingId !== 'string' ||
    !uuid.test(meeting.meetingId) ||
    typeof created.meetingCode !== 'string' ||
    !meetingCode.test(created.meetingCode) ||
    (meeting.meetingCode !== undefined && meeting.meetingCode !== created.meetingCode)
  )
    throw new Error('Invalid committed meeting binding');
  return { meetingId: meeting.meetingId, meetingCode: created.meetingCode };
}

export async function discardVideoMeetingScheduleDraft(
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingScheduleDraftDiscard> {
  const payload = { expectedVersion: validVersion(expectedVersion) as number };
  const result = (
    await axiosInstance.post<ApiResponse<unknown>, typeof payload>(
      `${VIDEO_MEETING_SCHEDULE_DRAFT_PATH}/discard`,
      payload,
      command(idempotencyKey)
    )
  ).data.data;
  const discarded = object(result, 'Invalid discarded schedule draft binding');
  if (
    typeof discarded.draftId !== 'string' ||
    !uuid.test(discarded.draftId) ||
    discarded.discarded !== true
  )
    throw new Error('Invalid discarded schedule draft binding');
  return {
    draftId: discarded.draftId,
    version: validVersion(discarded.version as number) as number,
    discarded: true,
  };
}
