import type {
  ScheduleVideoMeetingInput,
  VideoMeetingPerson,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingTemplateScheduleDraft } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import type {
  VideoMeetingScheduleDraft,
  VideoMeetingScheduleDraftInput,
  VideoMeetingScheduleDraftStep,
} from '@dwp-frontend/shared-utils/api/video-meeting-schedule-api';
import { serializeVideoMeetingPreparationSource } from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';

export type MeetingScheduleAgenda = {
  key: string;
  title: string;
  objective: string;
  ownerUserId: number | null;
  plannedMinutes: number;
  roleHint?: string;
};
export type MeetingScheduleDraft = {
  title: string;
  agenda: string;
  startsAt: string | null;
  durationMinutes: number;
  timeZone: string;
  participants: VideoMeetingPerson[];
  agendaItems: MeetingScheduleAgenda[];
  accessScope: 'INVITED' | 'INTERNAL';
  waitingRoomEnabled: boolean;
  allowJoinBeforeHost: boolean;
  recurrence: {
    frequency: 'NONE' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    occurrenceCount: number;
  };
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
};

const persistedAgendaItem = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const persistedSteps: VideoMeetingScheduleDraftStep[] = [
  'DETAILS',
  'SCHEDULE',
  'RECURRENCE',
  'REVIEW',
];

export function emptyMeetingSchedule(
  timeZone: string,
  template?: VideoMeetingTemplateScheduleDraft,
  now = new Date()
): MeetingScheduleDraft {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15 + 30);
  if (template)
    serializeVideoMeetingPreparationSource({
      sourceTemplateId: template.sourceTemplateId,
      sourceTemplateVersion: template.sourceTemplateVersion,
    });
  return {
    title: template?.title ?? '',
    agenda: template?.purpose ?? '',
    startsAt: start.toISOString(),
    durationMinutes: template?.durationMinutes ?? 45,
    timeZone,
    participants: [],
    agendaItems:
      template?.agendaItems.map((item, index) => ({
        key: `template-${index}`,
        title: item.title,
        objective: item.description,
        ownerUserId: null,
        plannedMinutes: item.durationMinutes,
        roleHint: item.role,
      })) ?? [],
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    allowJoinBeforeHost: false,
    recurrence: { frequency: 'NONE', interval: 1, occurrenceCount: 4 },
    ...(template
      ? {
          sourceTemplateId: template.sourceTemplateId,
          sourceTemplateVersion: template.sourceTemplateVersion,
        }
      : {}),
  };
}

/** Hydrate only the current user's validated server draft; never browser storage or URL state. */
export function restoreMeetingScheduleDraft(
  persisted: VideoMeetingScheduleDraft,
  fallback: MeetingScheduleDraft
): MeetingScheduleDraft {
  const source =
    persisted.sourceTemplateId && persisted.sourceTemplateVersion !== null
      ? {
          sourceTemplateId: persisted.sourceTemplateId,
          sourceTemplateVersion: persisted.sourceTemplateVersion,
        }
      : {};
  return {
    title: persisted.title ?? '',
    agenda: persisted.agenda ?? '',
    startsAt: persisted.startsAt,
    durationMinutes: persisted.durationMinutes ?? fallback.durationMinutes,
    timeZone: persisted.timeZone ?? fallback.timeZone,
    participants: persisted.participants.map((person) => ({ ...person })),
    agendaItems: [...persisted.agendaItems]
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        key: item.itemId,
        title: item.title ?? '',
        objective: item.objective ?? '',
        ownerUserId: item.ownerUserId,
        plannedMinutes: item.plannedMinutes ?? 5,
      })),
    accessScope: persisted.accessScope ?? fallback.accessScope,
    waitingRoomEnabled: persisted.waitingRoomEnabled ?? fallback.waitingRoomEnabled,
    // The server intentionally rejects this until verified pre-host identity exists. Never
    // restore a stale draft value that could turn a visible safe default into a doomed command.
    allowJoinBeforeHost: false,
    recurrence: persisted.recurrence ?? fallback.recurrence,
    ...source,
  };
}

export function meetingScheduleDraftStep(index: number): VideoMeetingScheduleDraftStep {
  return persistedSteps[index] ?? 'DETAILS';
}

export function meetingScheduleDraftStepIndex(step: VideoMeetingScheduleDraftStep): number {
  const index = persistedSteps.indexOf(step);
  return index < 0 ? 0 : index;
}

export function meetingScheduleDraftInput(
  draft: MeetingScheduleDraft,
  expectedVersion: number | null,
  step: number
): VideoMeetingScheduleDraftInput {
  return {
    expectedVersion,
    title: draft.title,
    agenda: draft.agenda,
    startsAt: draft.startsAt,
    durationMinutes: draft.durationMinutes,
    timeZone: draft.timeZone,
    accessScope: draft.accessScope,
    waitingRoomEnabled: draft.waitingRoomEnabled,
    allowJoinBeforeHost: false,
    participantUserIds: draft.participants.map((person) => person.userId),
    agendaItems: draft.agendaItems.map((item) => ({
      ...(persistedAgendaItem.test(item.key) ? { itemId: item.key } : {}),
      title: item.title,
      objective: item.objective,
      ownerUserId: item.ownerUserId,
      plannedMinutes: item.plannedMinutes,
    })),
    recurrence: draft.recurrence,
    ...(draft.sourceTemplateId && draft.sourceTemplateVersion !== undefined
      ? {
          sourceTemplateId: draft.sourceTemplateId,
          sourceTemplateVersion: draft.sourceTemplateVersion,
        }
      : {}),
    lastStep: meetingScheduleDraftStep(step),
  };
}

export function meetingScheduleDraftAttempt(
  previous: { fingerprint: string; key: string } | null,
  input:
    VideoMeetingScheduleDraftInput | { expectedVersion: number; previewFingerprint: string | null },
  newKey: () => string
) {
  const fingerprint = JSON.stringify(input);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: newKey() };
}

function scheduleErrors(draft: MeetingScheduleDraft, actorId: number, now: number): string[] {
  const errors: string[] = [];
  if (!draft.title.trim() || draft.title.trim().length > 240) errors.push('title');
  if (draft.agenda.trim().length > 8000) errors.push('purpose');
  if (
    !draft.startsAt ||
    !Number.isFinite(Date.parse(draft.startsAt)) ||
    Date.parse(draft.startsAt) <= now
  )
    errors.push('time');
  if (
    !Number.isInteger(draft.durationMinutes) ||
    draft.durationMinutes < 5 ||
    draft.durationMinutes > 1440
  )
    errors.push('duration');
  if (!resolveZonedClock(now, draft.timeZone)) errors.push('timeZone');
  if (
    draft.participants.length > 200 ||
    draft.participants.some((p) => !Number.isSafeInteger(p.userId) || p.userId <= 0) ||
    new Set(draft.participants.map((p) => p.userId)).size !== draft.participants.length
  )
    errors.push('participants');
  if (!['INVITED', 'INTERNAL'].includes(draft.accessScope)) errors.push('access');
  if (
    !['NONE', 'WEEKLY', 'MONTHLY'].includes(draft.recurrence.frequency) ||
    (draft.recurrence.frequency !== 'NONE' &&
      (!Number.isInteger(draft.recurrence.interval) ||
        draft.recurrence.interval < 1 ||
        draft.recurrence.interval > 12 ||
        !Number.isInteger(draft.recurrence.occurrenceCount) ||
        draft.recurrence.occurrenceCount < 2 ||
        draft.recurrence.occurrenceCount > 52))
  )
    errors.push('recurrence');
  if (draft.agendaItems.length > 50) errors.push('agendaLimit');
  if (
    draft.agendaItems.some(
      (item) =>
        !item.title.trim() ||
        item.title.trim().length > 240 ||
        item.objective.trim().length > 2000 ||
        !Number.isInteger(item.plannedMinutes) ||
        item.plannedMinutes < 1 ||
        item.plannedMinutes > 1440
    )
  )
    errors.push('agenda');
  const owners = new Set([actorId, ...draft.participants.map((p) => p.userId)]);
  if (draft.agendaItems.some((item) => item.ownerUserId !== null && !owners.has(item.ownerUserId)))
    errors.push('owner');
  if (draft.agendaItems.reduce((sum, item) => sum + item.plannedMinutes, 0) > draft.durationMinutes)
    errors.push('agendaTime');
  try {
    serializeVideoMeetingPreparationSource(draft);
  } catch {
    errors.push('source');
  }
  return errors;
}

export function meetingScheduleError(
  draft: MeetingScheduleDraft,
  actorId: number,
  now = Date.now()
): string | null {
  return scheduleErrors(draft, actorId, now)[0] ?? null;
}

export function scheduleMeetingInput(
  draft: MeetingScheduleDraft,
  idempotencyKey: string
): ScheduleVideoMeetingInput {
  return {
    title: draft.title.trim(),
    agenda: draft.agenda.trim() || null,
    startsAt: draft.startsAt ?? '',
    durationMinutes: draft.durationMinutes,
    timeZone: draft.timeZone,
    participantUserIds: draft.participants.map((person) => person.userId),
    accessScope: draft.accessScope,
    waitingRoomEnabled: draft.waitingRoomEnabled,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    idempotencyKey,
    ...serializeVideoMeetingPreparationSource(draft),
  };
}

export function moveMeetingScheduleAgenda(
  draft: MeetingScheduleDraft,
  key: string,
  offset: -1 | 1
): MeetingScheduleDraft {
  const from = draft.agendaItems.findIndex((item) => item.key === key);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= draft.agendaItems.length) return draft;
  const items = [...draft.agendaItems];
  [items[from], items[to]] = [items[to], items[from]];
  return { ...draft, agendaItems: items };
}

export function meetingScheduleStepError(
  draft: MeetingScheduleDraft,
  actorId: number,
  step: number
): string | null {
  const errors = scheduleErrors(draft, actorId, Date.now());
  const included =
    step === 0
      ? ['title', 'purpose', 'agenda', 'agendaLimit']
      : step === 1
        ? ['time', 'duration', 'timeZone', 'participants', 'owner', 'agendaTime']
        : step === 2
          ? ['recurrence']
          : [];
  return (step === 3 ? errors[0] : errors.find((error) => included.includes(error))) ?? null;
}

export function meetingScheduleAttempt(
  previous: { fingerprint: string; key: string } | null,
  input: ScheduleVideoMeetingInput,
  newKey: () => string
) {
  const fingerprint = JSON.stringify({ ...input, idempotencyKey: undefined });
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: newKey() };
}
