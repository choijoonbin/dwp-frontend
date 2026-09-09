import { describe, expect, it, vi } from 'vitest';
import type {
  WorkAssignmentEvent,
  WorkAssignmentEventPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import {
  checkedWorkAssignmentEventPage,
  checkedWorkAssignmentHistoryTransitions,
  loadWorkAssignmentHistory,
  WORK_ASSIGNMENT_EVENT_PAGE_SIZE,
} from './work-hub-assignment-history-model';

const assignmentId = '11111111-1111-4111-8111-111111111111';

function event(version: number, overrides: Partial<WorkAssignmentEvent> = {}): WorkAssignmentEvent {
  const suffix = (version + 1).toString(16).padStart(12, '0');
  return {
    eventId: `20000000-0000-4000-8000-${suffix}`,
    assignmentId,
    action: version === 0 ? 'CREATE' : version === 1 ? 'ACCEPT' : 'START',
    actorUserId: 11,
    assigneeUserId: 11,
    assignmentState: version === 0 ? 'PENDING' : 'ACCEPTED',
    workState: version === 0 ? 'OPEN' : 'IN_PROGRESS',
    assignmentRevision: 0,
    version,
    reasonCode: null,
    occurredAt: new Date(Date.UTC(2026, 8, 8, 9, version)).toISOString(),
    auditRecordId: `30000000-0000-4000-8000-${suffix}`,
    ...overrides,
  };
}

function page(
  items: WorkAssignmentEvent[],
  overrides: Partial<WorkAssignmentEventPage> = {}
): WorkAssignmentEventPage {
  return {
    items,
    nextAfterVersion: items.at(-1)?.version ?? -1,
    hasMore: false,
    ...overrides,
  };
}

describe('Work assignment history contract', () => {
  it('accepts an exact contiguous page and the empty initial history', () => {
    expect(
      checkedWorkAssignmentEventPage(page([event(0), event(1)]), assignmentId, -1).items
    ).toHaveLength(2);
    expect(checkedWorkAssignmentEventPage(page([]), assignmentId, -1)).toEqual(page([]));
  });

  it('binds each audit action to the only state transition it can represent', () => {
    const history = [
      event(0),
      event(1, { action: 'ACCEPT', assignmentState: 'ACCEPTED', workState: 'OPEN' }),
      event(2, { action: 'START', assignmentState: 'ACCEPTED', workState: 'IN_PROGRESS' }),
      event(3, { action: 'WAIT', assignmentState: 'ACCEPTED', workState: 'WAITING' }),
      event(4, {
        action: 'REASSIGN',
        assigneeUserId: 12,
        assignmentState: 'PENDING',
        workState: 'OPEN',
        assignmentRevision: 1,
        reasonCode: 'OWNER_CHANGED',
      }),
      event(5, {
        action: 'DECLINE',
        assigneeUserId: 12,
        assignmentState: 'DECLINED',
        workState: 'OPEN',
        assignmentRevision: 1,
        reasonCode: 'CAPACITY_LIMIT',
      }),
      event(6, {
        action: 'CANCEL',
        assigneeUserId: 12,
        assignmentState: 'DECLINED',
        workState: 'CANCELLED',
        assignmentRevision: 1,
        reasonCode: 'NO_LONGER_REQUIRED',
      }),
    ];
    expect(() => checkedWorkAssignmentHistoryTransitions(history)).not.toThrow();

    expect(() =>
      checkedWorkAssignmentHistoryTransitions([
        event(0),
        event(1, { action: 'START', assignmentState: 'ACCEPTED', workState: 'IN_PROGRESS' }),
      ])
    ).toThrow('invalid transition');
    expect(() =>
      checkedWorkAssignmentHistoryTransitions([
        event(0),
        event(1, { action: 'DECLINE', assignmentState: 'DECLINED', reasonCode: null }),
      ])
    ).toThrow('invalid transition');
    expect(() =>
      checkedWorkAssignmentHistoryTransitions([
        event(0),
        event(1, {
          action: 'REASSIGN',
          assigneeUserId: 12,
          assignmentRevision: 0,
          reasonCode: 'OWNER_CHANGED',
        }),
      ])
    ).toThrow('invalid transition');
    expect(() =>
      checkedWorkAssignmentHistoryTransitions([
        event(0),
        event(1, {
          action: 'REASSIGN',
          assignmentRevision: 1,
          reasonCode: 'OWNER_CHANGED',
        }),
      ])
    ).toThrow('invalid transition');
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    'rejects reassignment after terminal work state %s',
    (terminalState) => {
      const terminal =
        terminalState === 'COMPLETED'
          ? [
              event(0),
              event(1, {
                action: 'ACCEPT',
                assignmentState: 'ACCEPTED',
                workState: 'OPEN',
              }),
              event(2, {
                action: 'COMPLETE',
                assignmentState: 'ACCEPTED',
                workState: 'COMPLETED',
              }),
            ]
          : [
              event(0),
              event(1, {
                action: 'CANCEL',
                assignmentState: 'PENDING',
                workState: 'CANCELLED',
                reasonCode: 'NO_LONGER_REQUIRED',
              }),
            ];
      const reassign = event(terminal.length, {
        action: 'REASSIGN',
        assigneeUserId: 12,
        assignmentState: 'PENDING',
        workState: 'OPEN',
        assignmentRevision: 1,
        reasonCode: 'OWNER_CHANGED',
      });

      expect(() => checkedWorkAssignmentHistoryTransitions([...terminal, reassign])).toThrow(
        'invalid transition'
      );
    }
  );

  it('rejects gaps, duplicate events, mismatched assignments, and invalid audit metadata', () => {
    const invalidPages = [
      page([event(0), event(2)]),
      page([event(0), event(1, { eventId: event(0).eventId })]),
      page([event(0, { assignmentId: '22222222-2222-4222-8222-222222222222' })]),
      page([event(0, { action: 'PRIVATE_ACTION' })]),
      page([event(0, { reasonCode: 'raw private text' })]),
      page([event(0, { auditRecordId: 'internal-audit-id' })]),
      page([event(0)], { nextAfterVersion: 9 }),
    ];
    for (const invalid of invalidPages) {
      expect(() => checkedWorkAssignmentEventPage(invalid, assignmentId, -1)).toThrow();
    }
  });

  it('requires a full server page whenever the cursor reports more history', () => {
    expect(() =>
      checkedWorkAssignmentEventPage(page([event(0)], { hasMore: true }), assignmentId, -1)
    ).toThrow('Invalid Work assignment history page');
  });

  it('loads every contiguous page with the exact cursor and signal', async () => {
    const first = Array.from({ length: WORK_ASSIGNMENT_EVENT_PAGE_SIZE }, (_, index) =>
      event(index, {
        ...(index > 1
          ? {
              action: index % 2 === 0 ? 'START' : 'WAIT',
              assignmentState: 'ACCEPTED' as const,
              workState: index % 2 === 0 ? ('IN_PROGRESS' as const) : ('WAITING' as const),
            }
          : {}),
      })
    );
    first[1] = event(1, { action: 'ACCEPT', assignmentState: 'ACCEPTED', workState: 'OPEN' });
    const read = vi
      .fn()
      .mockResolvedValueOnce(page(first, { hasMore: true }))
      .mockResolvedValueOnce(
        page(
          [event(100, { action: 'START', assignmentState: 'ACCEPTED', workState: 'IN_PROGRESS' })],
          {
            nextAfterVersion: 100,
          }
        )
      );
    const controller = new AbortController();

    const result = await loadWorkAssignmentHistory(assignmentId, controller.signal, read);

    expect(result).toHaveLength(101);
    expect(result.at(-1)?.version).toBe(100);
    expect(read).toHaveBeenNthCalledWith(
      1,
      assignmentId,
      { afterVersion: -1, size: WORK_ASSIGNMENT_EVENT_PAGE_SIZE },
      controller.signal
    );
    expect(read).toHaveBeenNthCalledWith(
      2,
      assignmentId,
      { afterVersion: 99, size: WORK_ASSIGNMENT_EVENT_PAGE_SIZE },
      controller.signal
    );
  });

  it('rejects an event identifier repeated across pages', async () => {
    const first = Array.from({ length: WORK_ASSIGNMENT_EVENT_PAGE_SIZE }, (_, index) =>
      event(index, {
        ...(index > 1
          ? {
              action: index % 2 === 0 ? 'START' : 'WAIT',
              assignmentState: 'ACCEPTED' as const,
              workState: index % 2 === 0 ? ('IN_PROGRESS' as const) : ('WAITING' as const),
            }
          : {}),
      })
    );
    first[1] = event(1, { action: 'ACCEPT', assignmentState: 'ACCEPTED', workState: 'OPEN' });
    const repeated = event(100, {
      eventId: first[0].eventId,
      action: 'WAIT',
      assignmentState: 'ACCEPTED',
      workState: 'WAITING',
    });
    const read = vi
      .fn()
      .mockResolvedValueOnce(page(first, { hasMore: true }))
      .mockResolvedValueOnce(page([repeated]));

    await expect(
      loadWorkAssignmentHistory(assignmentId, new AbortController().signal, read)
    ).rejects.toThrow('Work assignment history repeated an event');
  });

  it('does not call the server after its operation signal is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.fn();

    await expect(
      loadWorkAssignmentHistory(assignmentId, controller.signal, read)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(read).not.toHaveBeenCalled();
  });
});
