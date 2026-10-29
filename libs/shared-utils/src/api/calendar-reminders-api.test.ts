import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  getCalendarEventReminders,
  updateCalendarEventReminders,
  type CalendarReminderSet,
  type CalendarReminderSetInput,
} from './calendar-reminders-api';

const reminderSet: CalendarReminderSet = {
  eventId: '00ba0853-02a8-7499-b6d8-009251e6a464',
  eventVersion: 7,
  version: 3,
  state: 'ACTIVE',
  reminders: [
    {
      reminderId: 'reminder-1',
      offsetMinutes: 15,
      channel: 'IN_APP',
      nextOccurrenceStartsAt: '2026-11-02T05:00:00Z',
      nextDueAt: '2026-11-02T04:45:00Z',
    },
  ],
  updatedAt: '2026-11-01T05:00:00Z',
};

describe('calendar reminder API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads an event reminder set from its canonical UUID owner path', async () => {
    const signal = new AbortController().signal;
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: reminderSet } });

    await expect(getCalendarEventReminders(reminderSet.eventId, signal)).resolves.toEqual(
      reminderSet
    );
    expect(get).toHaveBeenCalledWith(
      `/api/platform/v1/calendar/events/${reminderSet.eventId}/reminders`,
      { signal }
    );
  });

  it('updates the complete set with its optimistic version', async () => {
    const input: CalendarReminderSetInput = {
      version: 3,
      reminders: [
        { offsetMinutes: 10, channel: 'EMAIL' },
        { offsetMinutes: 60, channel: 'IN_APP' },
      ],
    };
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({
      data: { data: { ...reminderSet, version: 4 } },
    });

    await expect(updateCalendarEventReminders(reminderSet.eventId, input)).resolves.toMatchObject({
      version: 4,
    });
    expect(put).toHaveBeenCalledWith(
      `/api/platform/v1/calendar/events/${reminderSet.eventId}/reminders`,
      input,
      undefined
    );
  });

  it.each(['event/1', '00BA0853-02A8-7499-B6D8-009251E6A464'])(
    'rejects malformed or non-lowercase event ids before transport: %s',
    async (eventId) => {
      const get = vi.spyOn(axiosInstance, 'get');
      const put = vi.spyOn(axiosInstance, 'put');

      await expect(getCalendarEventReminders(eventId)).rejects.toThrow('canonical UUID');
      await expect(
        updateCalendarEventReminders(eventId, { version: 0, reminders: [] })
      ).rejects.toThrow('canonical UUID');
      expect(get).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );
});
