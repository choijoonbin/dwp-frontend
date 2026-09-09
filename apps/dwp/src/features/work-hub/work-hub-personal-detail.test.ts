import { describe, expect, it, vi } from 'vitest';

import {
  canSelectPersonalWorkStatus,
  isPersonalWorkDetailCurrent,
  loadCompletePersonalWorkTimeline,
  personalWorkStatusCommand,
  personalWorkTimelineActionLabel,
} from './work-hub-personal-detail';
import { hubItem, snapshot } from './work-hub.test-support';

import type {
  PersonalWorkPage,
  PersonalWorkTask,
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
  it.each([
    ['exact receipt', {}, true],
    ['another task', { taskId: 'task-2' }, false],
    ['another version', { version: 8 }, false],
    ['another lifecycle', { status: 'COMPLETED' as const }, false],
  ])(
    'treats %s as current only when detail and selected row match',
    (_label, changes, expected) => {
      const item = hubItem({
        reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-1' },
        version: 7,
        lifecycle: 'WAITING',
        sourceStatus: 'WAITING',
      });
      const task = {
        taskId: 'task-1',
        status: 'WAITING',
        version: 7,
        ...changes,
      } as PersonalWorkTask;

      expect(isPersonalWorkDetailCurrent(task, item)).toBe(expected);
    }
  );

  it.each(['IN_PROGRESS', 'WAITING'] as const)(
    'disables returning %s work to OPEN when the source exposes no reopen action',
    (status) => {
      const item = hubItem({ lifecycle: status, sourceStatus: status });
      const task = {
        taskId: item.reference.sourceReference,
        status,
        version: item.version,
      } as PersonalWorkTask;
      expect(canSelectPersonalWorkStatus(task, item, snapshot([item]), 'OPEN')).toBe(false);
      expect(canSelectPersonalWorkStatus(task, item, snapshot([item]), 'COMPLETED')).toBe(true);
      expect(
        canSelectPersonalWorkStatus(
          task,
          item,
          { ...snapshot([item]), completeness: 'UNAVAILABLE' },
          'COMPLETED'
        )
      ).toBe(false);
    }
  );

  it('allows reopening only when the current source exposes the target action', () => {
    const item = hubItem({
      lifecycle: 'COMPLETED',
      sourceStatus: 'COMPLETED',
      actions: [{ kind: 'PERSONAL_REOPEN', availability: 'AVAILABLE' }],
    });
    const task = {
      taskId: item.reference.sourceReference,
      status: 'COMPLETED',
      version: item.version,
    } as PersonalWorkTask;
    expect(canSelectPersonalWorkStatus(task, item, snapshot([item]), 'OPEN')).toBe(true);
    expect(
      canSelectPersonalWorkStatus(task, item, snapshot([{ ...item, actions: [] }]), 'OPEN')
    ).toBe(false);
  });

  it('builds status commands from the latest detail version shown to the user', () => {
    const task = { taskId: 'task-1', status: 'WAITING', version: 7 } as PersonalWorkTask;

    expect(personalWorkStatusCommand(task, 'COMPLETED')).toEqual({
      kind: 'STATUS',
      status: 'COMPLETED',
      version: 7,
    });
  });

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
