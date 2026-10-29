import { describe, expect, it } from 'vitest';

import {
  CALENDAR_REMINDER_LIMIT,
  CALENDAR_REMINDER_OFFSET_MAX,
  calendarAddReminderDraft,
  calendarReminderDraftsEqual,
  calendarReminderInput,
  calendarReminderValidation,
} from './calendar-reminders-model';

describe('calendar reminders model', () => {
  it('caps reminders at five without replacing an existing row', () => {
    const existing = Array.from({ length: CALENDAR_REMINDER_LIMIT }, (_, index) => ({
      key: String(index),
      offsetMinutes: index * 5,
      channel: 'IN_APP' as const,
    }));
    expect(calendarAddReminderDraft(existing, 'new', false)).toBe(existing);
  });

  it('chooses an unused channel and offset when adding a row', () => {
    expect(
      calendarAddReminderDraft([{ key: 'one', offsetMinutes: 10, channel: 'IN_APP' }], 'two', true)
    ).toEqual([
      { key: 'one', offsetMinutes: 10, channel: 'IN_APP' },
      { key: 'two', offsetMinutes: 10, channel: 'EMAIL' },
    ]);
  });

  it('builds a versioned full-set update inside the backend bounds', () => {
    expect(
      calendarReminderInput(
        4,
        [
          { key: 'one', offsetMinutes: 0, channel: 'EMAIL' },
          { key: 'two', offsetMinutes: CALENDAR_REMINDER_OFFSET_MAX, channel: 'IN_APP' },
        ],
        { emailEnabled: true }
      )
    ).toEqual({
      version: 4,
      reminders: [
        { offsetMinutes: 0, channel: 'EMAIL' },
        { offsetMinutes: 40_320, channel: 'IN_APP' },
      ],
    });
  });

  it.each([-1, 40_321, 1.5])(
    'rejects an offset outside the 0..40320 integer contract: %s',
    (offset) => {
      const draft = [{ key: 'bad', offsetMinutes: offset, channel: 'EMAIL' as const }];
      expect(calendarReminderValidation(draft, { emailEnabled: true }).invalidOffsetKeys).toEqual(
        new Set(['bad'])
      );
      expect(() => calendarReminderInput(1, draft, { emailEnabled: true })).toThrow('invalid');
    }
  );

  it('flags both rows in a duplicate channel and offset pair and blocks the payload', () => {
    const drafts = [
      { key: 'one', offsetMinutes: 10, channel: 'IN_APP' as const },
      { key: 'two', offsetMinutes: 10, channel: 'IN_APP' as const },
    ];
    expect(calendarReminderValidation(drafts, { emailEnabled: true }).duplicateKeys).toEqual(
      new Set(['one', 'two'])
    );
    expect(() => calendarReminderInput(1, drafts, { emailEnabled: true })).toThrow('invalid');
  });

  it('rejects more than five rows even if callers bypass the add helper', () => {
    const drafts = Array.from({ length: CALENDAR_REMINDER_LIMIT + 1 }, (_, index) => ({
      key: String(index),
      offsetMinutes: index,
      channel: 'EMAIL' as const,
    }));
    expect(calendarReminderValidation(drafts, { emailEnabled: true }).tooMany).toBe(true);
    expect(() => calendarReminderInput(1, drafts, { emailEnabled: true })).toThrow('invalid');
  });

  it('fails closed for email when delivery capability is not explicitly enabled', () => {
    const drafts = [{ key: 'email', offsetMinutes: 10, channel: 'EMAIL' as const }];
    expect(
      calendarReminderValidation(drafts, { emailEnabled: false }).unavailableChannelKeys
    ).toEqual(new Set(['email']));
    expect(() => calendarReminderInput(1, drafts, { emailEnabled: false })).toThrow('invalid');
  });

  it('detects ordered reminder changes independently of row keys', () => {
    expect(
      calendarReminderDraftsEqual(
        [{ key: 'server', offsetMinutes: 10, channel: 'IN_APP' }],
        [{ key: 'client', offsetMinutes: 10, channel: 'IN_APP' }]
      )
    ).toBe(true);
  });
});
