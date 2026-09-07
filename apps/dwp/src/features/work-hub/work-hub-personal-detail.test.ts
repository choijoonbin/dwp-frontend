import { describe, expect, it, vi } from 'vitest';

import {
  loadCompletePersonalWorkTimeline,
  personalWorkTimelineActionLabel,
} from './work-hub-personal-detail';

import type {
  PersonalWorkPage,
  PersonalWorkTimelineEvent,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

function event(eventId: string, version: number): PersonalWorkTimelineEvent {
  return {
    eventId,
    action: version === 1 ? 'CREATED' : 'UPDATED',
    status: 'OPEN',
    version,
    occurredAt: `2026-09-0${version}T09:00:00Z`,
    auditRecordId: `audit-${eventId}`,
  };
}

function page(
  pageNumber: number,
  items: PersonalWorkTimelineEvent[],
  hasMore: boolean
): PersonalWorkPage<PersonalWorkTimelineEvent> {
  return {
    items,
    page: pageNumber,
    size: 100,
    totalElements: hasMore ? items.length + 1 : items.length,
    hasMore,
  };
}

describe('loadCompletePersonalWorkTimeline', () => {
  it('loads every page in server order using the maximum supported page size', async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, [event('event-2', 2)], true))
      .mockResolvedValueOnce(page(1, [event('event-1', 1)], false));

    await expect(loadCompletePersonalWorkTimeline('task-1', readPage)).resolves.toEqual([
      event('event-2', 2),
      event('event-1', 1),
    ]);
    expect(readPage).toHaveBeenNthCalledWith(1, 'task-1', 0, 100);
    expect(readPage).toHaveBeenNthCalledWith(2, 'task-1', 1, 100);
  });

  it('rejects a response whose page cursor does not match the requested page', async () => {
    const readPage = vi.fn().mockResolvedValue(page(0, [event('event-1', 1)], true));

    await expect(loadCompletePersonalWorkTimeline('task-1', readPage)).rejects.toThrow(
      'pagination did not advance'
    );
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it('rejects repeated events while the server still claims another page exists', async () => {
    const repeated = event('event-1', 1);
    const readPage = vi
      .fn()
      .mockResolvedValueOnce(page(0, [repeated], true))
      .mockResolvedValueOnce(page(1, [repeated], true));

    await expect(loadCompletePersonalWorkTimeline('task-1', readPage)).rejects.toThrow(
      'pagination did not advance'
    );
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it('uses the canonical audit action dictionary instead of exposing an unknown raw code', () => {
    const translate = vi.fn(
      (_key: string, options: { defaultValue: string }) => options.defaultValue
    );
    const display = vi.fn(() => 'Unmapped value');
    const rawAction = 'secret.internal-action';

    expect(personalWorkTimelineActionLabel(rawAction, translate, display)).toBe('Unmapped value');
    expect(display).toHaveBeenCalledWith('auditActions', rawAction);
    expect(personalWorkTimelineActionLabel(rawAction, translate, display)).not.toBe(rawAction);
  });
});
