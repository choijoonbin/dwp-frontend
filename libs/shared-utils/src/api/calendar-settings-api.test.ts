import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  createCalendarDelegation,
  getCalendarDelegations,
  getCalendarSettings,
  resetCalendarSettings,
  revokeCalendarDelegation,
  updateCalendarSettings,
  type CreateCalendarDelegationInput,
  type UpdateCalendarSettingsInput,
} from './calendar-settings-api';

describe('Calendar settings API boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads settings and delegations with caller cancellation', async () => {
    const signal = new AbortController().signal;
    const get = vi
      .spyOn(axiosInstance, 'get')
      .mockResolvedValueOnce({ data: { data: { version: 3 } } })
      .mockResolvedValueOnce({ data: { data: [] } });

    await expect(getCalendarSettings(signal)).resolves.toEqual({ version: 3 });
    await expect(getCalendarDelegations(signal)).resolves.toEqual([]);

    expect(get).toHaveBeenNthCalledWith(1, '/api/platform/v1/calendar/settings', { signal });
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/calendar/settings/delegations',
      { signal }
    );
  });

  it('keeps the optimistic settings version on update and reset', async () => {
    const settings = { version: 8 };
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: settings } });
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: settings } });
    const input: UpdateCalendarSettingsInput = {
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      workingDayStart: '09:00',
      workingDayEnd: '18:00',
      timeZone: 'Asia/Seoul',
      weekStart: 'MONDAY',
      defaultEventMinutes: 30,
      speedyMeetingMode: 'FIVE_TEN',
      defaultBufferMinutes: 5,
      defaultVisibility: 'FREE_BUSY',
      defaultReminderMinutes: 10,
      version: 7,
    };

    await expect(updateCalendarSettings(input)).resolves.toEqual(settings);
    await expect(resetCalendarSettings(7)).resolves.toEqual(settings);

    expect(put).toHaveBeenCalledWith('/api/platform/v1/calendar/settings', input);
    expect(post).toHaveBeenCalledWith('/api/platform/v1/calendar/settings/reset', { version: 7 });
  });

  it('creates and revokes a bounded delegation without conflating calendar sharing', async () => {
    const delegation = { delegationId: 'delegation/id', version: 4 };
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValue({ data: { data: delegation } });
    const input: CreateCalendarDelegationInput = {
      delegatePersonPublicId: '00000000-0000-4000-8000-000000000001',
      scopes: ['RESPOND', 'EDIT_SCHEDULE'],
      validFrom: '2026-09-17T09:00:00+09:00',
      validUntil: '2026-10-17T18:00:00+09:00',
    };

    await expect(createCalendarDelegation(input)).resolves.toEqual(delegation);
    await expect(revokeCalendarDelegation('delegation/id', 4)).resolves.toEqual(delegation);

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/platform/v1/calendar/settings/delegations',
      input
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/api/platform/v1/calendar/settings/delegations/delegation%2Fid/revoke',
      { version: 4 }
    );
  });
});
