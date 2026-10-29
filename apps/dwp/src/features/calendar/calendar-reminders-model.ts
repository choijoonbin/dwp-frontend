import type {
  CalendarReminderChannel,
  CalendarReminderSet,
  CalendarReminderSetInput,
} from '@dwp-frontend/shared-utils';

export const CALENDAR_REMINDER_LIMIT = 5;
export const CALENDAR_REMINDER_OFFSET_MIN = 0;
export const CALENDAR_REMINDER_OFFSET_MAX = 40_320;

const DEFAULT_REMINDERS = [
  { offsetMinutes: 10, channel: 'IN_APP' },
  { offsetMinutes: 10, channel: 'EMAIL' },
  { offsetMinutes: 30, channel: 'IN_APP' },
  { offsetMinutes: 30, channel: 'EMAIL' },
  { offsetMinutes: 60, channel: 'IN_APP' },
  { offsetMinutes: 60, channel: 'EMAIL' },
  { offsetMinutes: 5, channel: 'IN_APP' },
  { offsetMinutes: 15, channel: 'IN_APP' },
] as const satisfies ReadonlyArray<{
  offsetMinutes: number;
  channel: CalendarReminderChannel;
}>;

export type CalendarReminderDraft = Readonly<{
  key: string;
  offsetMinutes: number;
  channel: CalendarReminderChannel;
}>;

export function calendarReminderDrafts(set: CalendarReminderSet | undefined) {
  return (
    set?.reminders.map((reminder) => ({
      key: reminder.reminderId,
      offsetMinutes: reminder.offsetMinutes,
      channel: reminder.channel,
    })) ?? []
  );
}

export function calendarAddReminderDraft(
  drafts: readonly CalendarReminderDraft[],
  key: string,
  emailEnabled: boolean
): readonly CalendarReminderDraft[] {
  if (drafts.length >= CALENDAR_REMINDER_LIMIT) return drafts;
  const identities = new Set(drafts.map((draft) => `${draft.channel}:${draft.offsetMinutes}`));
  const next = DEFAULT_REMINDERS.find(
    (candidate) =>
      (emailEnabled || candidate.channel !== 'EMAIL') &&
      !identities.has(`${candidate.channel}:${candidate.offsetMinutes}`)
  );
  return next ? [...drafts, { key, ...next }] : drafts;
}

export type CalendarReminderValidation = Readonly<{
  valid: boolean;
  duplicateKeys: ReadonlySet<string>;
  invalidOffsetKeys: ReadonlySet<string>;
  unavailableChannelKeys: ReadonlySet<string>;
  tooMany: boolean;
}>;

export function calendarReminderValidation(
  drafts: readonly CalendarReminderDraft[],
  options: Readonly<{ emailEnabled: boolean }>
): CalendarReminderValidation {
  const duplicateKeys = new Set<string>();
  const invalidOffsetKeys = new Set<string>();
  const unavailableChannelKeys = new Set<string>();
  const identityOwners = new Map<string, string>();
  drafts.forEach((draft) => {
    if (
      !Number.isInteger(draft.offsetMinutes) ||
      draft.offsetMinutes < CALENDAR_REMINDER_OFFSET_MIN ||
      draft.offsetMinutes > CALENDAR_REMINDER_OFFSET_MAX
    ) {
      invalidOffsetKeys.add(draft.key);
    }
    if (draft.channel === 'EMAIL' && !options.emailEnabled) {
      unavailableChannelKeys.add(draft.key);
    }
    const identity = `${draft.channel}:${draft.offsetMinutes}`;
    const previous = identityOwners.get(identity);
    if (previous) {
      duplicateKeys.add(previous);
      duplicateKeys.add(draft.key);
    } else {
      identityOwners.set(identity, draft.key);
    }
  });
  const tooMany = drafts.length > CALENDAR_REMINDER_LIMIT;
  return {
    valid:
      !tooMany &&
      duplicateKeys.size === 0 &&
      invalidOffsetKeys.size === 0 &&
      unavailableChannelKeys.size === 0,
    duplicateKeys,
    invalidOffsetKeys,
    unavailableChannelKeys,
    tooMany,
  };
}

export function calendarReminderInput(
  version: number,
  drafts: readonly CalendarReminderDraft[],
  options: Readonly<{ emailEnabled: boolean }>
): CalendarReminderSetInput {
  const validation = calendarReminderValidation(drafts, options);
  if (!validation.valid) throw new Error('Calendar reminder draft is invalid.');
  return {
    version,
    reminders: drafts.map((draft) => ({
      offsetMinutes: draft.offsetMinutes,
      channel: draft.channel,
    })),
  };
}

export function calendarReminderDraftsEqual(
  left: readonly CalendarReminderDraft[],
  right: readonly CalendarReminderDraft[]
) {
  const comparable = (drafts: readonly CalendarReminderDraft[]) =>
    drafts.map(({ offsetMinutes, channel }) => ({ offsetMinutes, channel }));
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}
