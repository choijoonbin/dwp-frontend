import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkAssignmentScope,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { loadWorkHub, workHubSourceReaders } from './work-hub-loader';
import { WORK_ASSIGNMENT_PAGE_SIZE } from './work-hub-assignment-model';

const assignmentApi = vi.hoisted(() => ({ getWorkAssignments: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils/api/work-assignment-api', () => assignmentApi);

const ACTOR_ID = 11;
const SELF_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function assignmentUuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function listedTask(
  assignmentId: string,
  scope: WorkAssignmentScope,
  overrides: Partial<WorkAssignmentTask> = {}
): WorkAssignmentTask {
  const assignedToMe = scope === 'ASSIGNED_TO_ME';
  return {
    assignmentId,
    createdByUserId: assignedToMe ? 7 : ACTOR_ID,
    assignedByUserId: assignedToMe ? 7 : ACTOR_ID,
    assigneeUserId: assignedToMe ? ACTOR_ID : 7,
    title: `Assignment ${assignmentId.slice(-4)}`,
    description: null,
    priority: 'NORMAL',
    dueAt: null,
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 0,
    version: 0,
    source: {
      availability: 'NOT_REQUESTED',
      reference: null,
      sourceVersion: null,
      sourceRoute: null,
    },
    capabilities: {
      canAccept: assignedToMe,
      canDecline: assignedToMe,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: !assignedToMe,
    },
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z',
    acceptedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function page(
  items: WorkAssignmentTask[],
  pageNumber: number,
  totalElements: number
): WorkAssignmentTaskPage {
  return {
    items,
    page: pageNumber,
    size: WORK_ASSIGNMENT_PAGE_SIZE,
    totalElements,
    hasMore: (pageNumber + 1) * WORK_ASSIGNMENT_PAGE_SIZE < totalElements,
  };
}

describe('Work assignment source loading', () => {
  beforeEach(() => {
    assignmentApi.getWorkAssignments.mockReset();
  });

  it('reads every page from both actor scopes and keeps the newest self-assignment once', async () => {
    const assignedPage = Array.from({ length: WORK_ASSIGNMENT_PAGE_SIZE }, (_, index) =>
      listedTask(assignmentUuid(index + 1), 'ASSIGNED_TO_ME')
    );
    const oldSelf = listedTask(SELF_ID, 'ASSIGNED_TO_ME', {
      createdByUserId: ACTOR_ID,
      assignedByUserId: ACTOR_ID,
      version: 3,
      updatedAt: '2026-09-03T09:00:00Z',
      capabilities: {
        canAccept: true,
        canDecline: true,
        canStart: false,
        canWait: false,
        canComplete: false,
        canReassign: false,
        canCancel: true,
      },
    });
    const newSelf = listedTask(SELF_ID, 'ASSIGNED_BY_ME', {
      assigneeUserId: ACTOR_ID,
      version: 4,
      updatedAt: '2026-09-04T09:00:00Z',
      capabilities: {
        canAccept: true,
        canDecline: true,
        canStart: false,
        canWait: false,
        canComplete: false,
        canReassign: false,
        canCancel: true,
      },
    });
    const requested = listedTask(assignmentUuid(500), 'ASSIGNED_BY_ME');

    assignmentApi.getWorkAssignments.mockImplementation(
      async ({ scope, page: pageNumber }: { scope: WorkAssignmentScope; page: number }) => {
        if (scope === 'ASSIGNED_TO_ME')
          return pageNumber === 0 ? page(assignedPage, 0, 101) : page([oldSelf], 1, 101);
        return page([newSelf, requested], 0, 2);
      }
    );

    const result = await workHubSourceReaders['work-assignments']({
      canUpdatePersonal: false,
      actorId: ACTOR_ID,
    });

    expect(assignmentApi.getWorkAssignments.mock.calls.map(([options]) => options)).toEqual(
      expect.arrayContaining([
        { scope: 'ASSIGNED_TO_ME', page: 0, size: WORK_ASSIGNMENT_PAGE_SIZE },
        { scope: 'ASSIGNED_TO_ME', page: 1, size: WORK_ASSIGNMENT_PAGE_SIZE },
        { scope: 'ASSIGNED_BY_ME', page: 0, size: WORK_ASSIGNMENT_PAGE_SIZE },
      ])
    );
    expect(assignmentApi.getWorkAssignments).toHaveBeenCalledTimes(3);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(102);
    expect(result.items.filter((item) => item.reference.sourceReference === SELF_ID)).toEqual([
      expect.objectContaining({
        version: 4,
        title: newSelf.title,
        sourceContext: expect.objectContaining({ requesterIsMe: true, assigneeIsMe: true }),
      }),
    ]);
  });

  it('fails closed when the total changes between pages', async () => {
    const first = Array.from({ length: WORK_ASSIGNMENT_PAGE_SIZE }, (_, index) =>
      listedTask(assignmentUuid(index + 1), 'ASSIGNED_TO_ME')
    );
    assignmentApi.getWorkAssignments.mockImplementation(
      async ({ scope, page: pageNumber }: { scope: WorkAssignmentScope; page: number }) => {
        if (scope === 'ASSIGNED_BY_ME') return page([], 0, 0);
        return pageNumber === 0
          ? page(first, 0, 101)
          : page(
              [listedTask(assignmentUuid(201), scope), listedTask(assignmentUuid(202), scope)],
              1,
              102
            );
      }
    );

    await expect(
      workHubSourceReaders['work-assignments']({ canUpdatePersonal: false, actorId: ACTOR_ID })
    ).rejects.toThrow('pagination total changed');
  });

  it('fails closed when a later page repeats an assignment', async () => {
    const first = Array.from({ length: WORK_ASSIGNMENT_PAGE_SIZE }, (_, index) =>
      listedTask(assignmentUuid(index + 1), 'ASSIGNED_TO_ME')
    );
    assignmentApi.getWorkAssignments.mockImplementation(
      async ({ scope, page: pageNumber }: { scope: WorkAssignmentScope; page: number }) => {
        if (scope === 'ASSIGNED_BY_ME') return page([], 0, 0);
        return pageNumber === 0 ? page(first, 0, 101) : page([first[0]!], 1, 101);
      }
    );

    await expect(
      workHubSourceReaders['work-assignments']({ canUpdatePersonal: false, actorId: ACTOR_ID })
    ).rejects.toThrow('pagination repeated an item');
  });

  it('publishes no assignments when either required scope fails', async () => {
    assignmentApi.getWorkAssignments.mockImplementation(
      async ({ scope }: { scope: WorkAssignmentScope }) => {
        if (scope === 'ASSIGNED_BY_ME') throw new Error('scope unavailable');
        return page([listedTask(assignmentUuid(1), scope)], 0, 1);
      }
    );

    const result = await loadWorkHub({
      enabledSources: ['work-assignments'],
      actorId: ACTOR_ID,
    });

    expect(result.items).toEqual([]);
    expect(result.completeness).toBe('UNAVAILABLE');
    expect(result.sources.find((source) => source.sourceId === 'work-assignments')).toMatchObject({
      state: 'UNAVAILABLE',
      items: [],
      hasMore: false,
    });
  });

  it.each([null, 0, -1, 1.5, Number.NaN])(
    'rejects invalid actor %s before reading either scope',
    async (actorId) => {
      await expect(
        workHubSourceReaders['work-assignments']({ canUpdatePersonal: false, actorId })
      ).rejects.toThrow('verified Work actor');
      expect(assignmentApi.getWorkAssignments).not.toHaveBeenCalled();
    }
  );
});
