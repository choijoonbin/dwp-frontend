import { describe, expect, it } from 'vitest';
import type {
  WorkAssignmentMutationResult,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import {
  availableWorkAssignmentActions,
  checkedWorkAssignmentMutation,
  checkedWorkAssignmentPage,
  checkedWorkAssignmentTask,
  mergeWorkAssignmentTasks,
  sameReviewedWorkAssignment,
  workAssignmentToHub,
  WORK_ASSIGNMENT_PAGE_SIZE,
} from './work-hub-assignment-model';

const ids = {
  assignment: '11111111-1111-4111-8111-111111111111',
  meeting: '22222222-2222-4222-8222-222222222222',
  report: '33333333-3333-4333-8333-333333333333',
  candidate: '44444444-4444-4444-8444-444444444444',
  command: '55555555-5555-4555-8555-555555555555',
};

type SourceAvailability = WorkAssignmentTask['source']['availability'];
type AvailableSource = Extract<WorkAssignmentTask['source'], { availability: 'AVAILABLE' }>;
type HiddenSource = Exclude<WorkAssignmentTask['source'], AvailableSource>;

function source(availability: 'AVAILABLE'): AvailableSource;
function source(availability: 'UNAVAILABLE' | 'NOT_REQUESTED'): HiddenSource;
function source(availability: SourceAvailability): WorkAssignmentTask['source'];
function source(availability: SourceAvailability): WorkAssignmentTask['source'] {
  if (availability !== 'AVAILABLE') {
    return { availability, reference: null, sourceVersion: null, sourceRoute: null } as const;
  }
  return {
    availability,
    reference: {
      sourceSystem: 'MEETING_FOLLOWUP' as const,
      meetingId: ids.meeting,
      reportId: ids.report,
      candidateId: ids.candidate,
    },
    sourceVersion: 3,
    sourceRoute: `/meetings/follow-ups?meetingId=${ids.meeting}&reportId=${ids.report}&candidateId=${ids.candidate}`,
  } as const;
}

function task(
  overrides: Partial<WorkAssignmentTask> = {},
  sourceAvailability: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_REQUESTED' = 'AVAILABLE'
): WorkAssignmentTask {
  return {
    assignmentId: ids.assignment,
    createdByUserId: 7,
    assignedByUserId: 7,
    assigneeUserId: 11,
    title: 'Publish the reviewed meeting follow-up',
    description: 'Use only the confirmed Work terms.',
    priority: 'HIGH',
    dueAt: '2026-09-10T09:00:00Z',
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 2,
    version: 4,
    source: source(sourceAvailability),
    capabilities: {
      canAccept: true,
      canDecline: true,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: sourceAvailability === 'AVAILABLE',
      canCancel: false,
    },
    createdAt: '2026-09-04T09:00:00Z',
    updatedAt: '2026-09-08T09:00:00Z',
    acceptedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function page(items: WorkAssignmentTask[], overrides: Partial<WorkAssignmentTaskPage> = {}) {
  return {
    items,
    page: 0,
    size: WORK_ASSIGNMENT_PAGE_SIZE,
    totalElements: items.length,
    hasMore: false,
    ...overrides,
  };
}

describe('Work assignment contract boundary', () => {
  it('accepts only the exact authorized list projection and strips reassignment capability', () => {
    const listed = task(
      { capabilities: { ...task().capabilities, canReassign: false } },
      'NOT_REQUESTED'
    );
    const checked = checkedWorkAssignmentPage(page([listed]), 11, 'ASSIGNED_TO_ME', 0);

    expect(checked.items).toEqual([listed]);
    expect(() =>
      checkedWorkAssignmentPage(page([task({}, 'AVAILABLE')]), 11, 'ASSIGNED_TO_ME', 0)
    ).toThrow('Invalid Work assignment list source binding');
    expect(() => checkedWorkAssignmentPage(page([listed]), 7, 'ASSIGNED_TO_ME', 0)).toThrow(
      'Invalid Work assignment scope binding'
    );
    expect(() => checkedWorkAssignmentPage(page([listed]), 11, 'ASSIGNED_BY_ME', 0)).toThrow(
      'Invalid Work assignment scope binding'
    );
  });

  it('rejects malformed page metadata, short intermediate pages, and duplicates', () => {
    const listed = task(
      { capabilities: { ...task().capabilities, canReassign: false } },
      'NOT_REQUESTED'
    );
    const malformed = [
      page([listed], { page: 1 }),
      page([listed], { size: 50 }),
      page([listed], { totalElements: 2 }),
      page([listed], { totalElements: 101, hasMore: true }),
      page([listed], { hasMore: true }),
      page([listed, listed]),
    ];
    for (const candidate of malformed) {
      expect(() => checkedWorkAssignmentPage(candidate, 11, 'ASSIGNED_TO_ME', 0)).toThrow();
    }
  });

  it('fails closed on an unauthorized actor or malformed aggregate identity', () => {
    expect(() => checkedWorkAssignmentTask(task(), 99)).toThrow(
      'Invalid authorized Work assignment binding'
    );
    expect(() => checkedWorkAssignmentTask(task({ assignmentId: 'not-a-uuid' }), 11)).toThrow(
      'Invalid authorized Work assignment binding'
    );
    expect(() => checkedWorkAssignmentTask(task({ title: '   ' }), 11)).toThrow(
      'Invalid authorized Work assignment binding'
    );
    expect(() => checkedWorkAssignmentTask(task({ version: -1 }), 11)).toThrow(
      'Invalid authorized Work assignment binding'
    );
  });

  it('sanitizes invalid inspected owner metadata without removing Work-owned actions', () => {
    const invalidSource = task({
      source: {
        ...source('AVAILABLE'),
        sourceRoute: 'https://untrusted.example/private',
      } as WorkAssignmentTask['source'],
    });
    const checked = checkedWorkAssignmentTask(invalidSource, 11);

    expect(checked.source).toEqual(source('UNAVAILABLE'));
    expect(checked.capabilities.canAccept).toBe(true);
    expect(checked.capabilities.canDecline).toBe(true);
    expect(checked.capabilities.canReassign).toBe(false);
    expect(availableWorkAssignmentActions(checked)).toEqual(['accept', 'decline']);
  });

  it('bounds every advertised capability by the current actor role and task state', () => {
    const advertised = task({
      capabilities: {
        canAccept: true,
        canDecline: true,
        canStart: true,
        canWait: true,
        canComplete: true,
        canReassign: true,
        canCancel: true,
      },
    });

    const creatorView = checkedWorkAssignmentTask(advertised, 7);
    expect(creatorView.capabilities).toEqual({
      canAccept: false,
      canDecline: false,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: true,
      canCancel: true,
    });
    const assigneeView = checkedWorkAssignmentTask(advertised, 11);
    expect(assigneeView.capabilities).toEqual({
      canAccept: true,
      canDecline: true,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: false,
    });
    expect(
      checkedWorkAssignmentTask({ ...advertised, workState: 'COMPLETED' }, 11).capabilities
    ).toEqual({
      canAccept: false,
      canDecline: false,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: false,
    });
  });

  it('keeps assignment acceptance and execution as independent state axes', () => {
    const accepted = task({
      assignmentState: 'ACCEPTED',
      capabilities: {
        canAccept: false,
        canDecline: false,
        canStart: true,
        canWait: true,
        canComplete: true,
        canReassign: false,
        canCancel: true,
      },
    });
    expect(availableWorkAssignmentActions(accepted)).toEqual([
      'start',
      'wait',
      'complete',
      'cancel',
    ]);
    expect(availableWorkAssignmentActions({ ...accepted, workState: 'IN_PROGRESS' })).toEqual([
      'wait',
      'complete',
      'cancel',
    ]);
    expect(availableWorkAssignmentActions({ ...accepted, workState: 'WAITING' })).toEqual([
      'start',
      'complete',
      'cancel',
    ]);
    expect(availableWorkAssignmentActions({ ...accepted, workState: 'COMPLETED' })).toEqual([]);
  });

  it('maps a list projection without exposing a source route or generic action', () => {
    const listed = task(
      { capabilities: { ...task().capabilities, canReassign: false } },
      'NOT_REQUESTED'
    );
    const item = workAssignmentToHub(listed, 11);

    expect(item.reference).toEqual({
      sourceSystem: 'WORK_ASSIGNMENT',
      sourceReference: ids.assignment,
    });
    expect(item.key).toBe(`WORK_ASSIGNMENT:${ids.assignment}:`);
    expect(item.sourceRoute).toBeNull();
    expect(item.actions).toEqual([]);
    expect(item.waitingFor).toBe('ME');
    expect(item.sourceContext).toEqual({
      kind: 'WORK_ASSIGNMENT',
      assignmentState: 'PENDING',
      workState: 'OPEN',
      requesterIsMe: false,
      assigneeIsMe: true,
      sourceAvailability: 'NOT_REQUESTED',
    });

    expect(workAssignmentToHub({ ...listed, workState: 'WAITING' }, 11).waitingFor).toBe('UNKNOWN');
    expect(workAssignmentToHub({ ...listed, assignmentState: 'DECLINED' }, 7).waitingFor).toBe(
      'ME'
    );
    expect(workAssignmentToHub({ ...listed, workState: 'CANCELLED' }, 11).waitingFor).toBe('NONE');
  });

  it('deduplicates self assignments only when the version ordering is internally consistent', () => {
    const older = task({
      createdByUserId: 11,
      assignedByUserId: 11,
      version: 4,
      assignmentRevision: 2,
    });
    const newer = task({
      createdByUserId: 11,
      assignedByUserId: 11,
      version: 5,
      assignmentRevision: 2,
      assignmentState: 'ACCEPTED',
      updatedAt: '2026-09-08T10:00:00Z',
    });
    expect(mergeWorkAssignmentTasks([page([older]), page([newer])])).toEqual([newer]);
    expect(() =>
      mergeWorkAssignmentTasks([page([older]), page([{ ...older, assignmentRevision: 3 }])])
    ).toThrow('Inconsistent Work assignment ordering');
    expect(() =>
      mergeWorkAssignmentTasks([page([older]), page([{ ...older, title: 'Conflicting title' }])])
    ).toThrow('Conflicting Work assignment projections');
    expect(() =>
      mergeWorkAssignmentTasks([page([older]), page([{ ...newer, assignmentRevision: 1 }])])
    ).toThrow('Inconsistent Work assignment ordering');
  });

  it('binds a command receipt to the reviewed task, command, operation, and applied state', () => {
    const reviewed = task(
      { capabilities: { ...task().capabilities, canReassign: false } },
      'UNAVAILABLE'
    );
    const accepted = task(
      {
        assignmentState: 'ACCEPTED',
        version: 5,
        updatedAt: '2026-09-08T10:00:00Z',
        capabilities: {
          canAccept: false,
          canDecline: false,
          canStart: true,
          canWait: true,
          canComplete: true,
          canReassign: false,
          canCancel: false,
        },
      },
      'UNAVAILABLE'
    );
    const result: WorkAssignmentMutationResult = {
      assignment: accepted,
      receipt: {
        commandId: ids.command,
        assignmentId: ids.assignment,
        operation: 'ACCEPT',
        appliedVersion: 5,
        appliedAssignmentRevision: 2,
        appliedAt: '2026-09-08T10:00:00Z',
        replayed: false,
      },
    };

    expect(checkedWorkAssignmentMutation(result, reviewed, 'accept', ids.command, 11)).toEqual(
      accepted
    );
    for (const invalid of [
      { ...result, receipt: { ...result.receipt, commandId: ids.meeting } },
      { ...result, receipt: { ...result.receipt, operation: 'START' } },
      { ...result, receipt: { ...result.receipt, appliedVersion: 6 } },
      { ...result, receipt: { ...result.receipt, appliedAssignmentRevision: 3 } },
      { ...result, assignment: { ...accepted, assignmentState: 'PENDING' as const } },
    ]) {
      expect(() =>
        checkedWorkAssignmentMutation(invalid, reviewed, 'accept', ids.command, 11)
      ).toThrow('Invalid Work assignment command result');
    }
  });

  it.each([
    ['accept', {}, { assignmentState: 'ACCEPTED', workState: 'OPEN' }],
    ['decline', {}, { assignmentState: 'DECLINED', workState: 'OPEN' }],
    [
      'start',
      { assignmentState: 'ACCEPTED', workState: 'OPEN' },
      { assignmentState: 'ACCEPTED', workState: 'IN_PROGRESS' },
    ],
    [
      'wait',
      { assignmentState: 'ACCEPTED', workState: 'IN_PROGRESS' },
      { assignmentState: 'ACCEPTED', workState: 'WAITING' },
    ],
    [
      'complete',
      { assignmentState: 'ACCEPTED', workState: 'WAITING' },
      { assignmentState: 'ACCEPTED', workState: 'COMPLETED' },
    ],
    [
      'cancel',
      { assignmentState: 'ACCEPTED', workState: 'WAITING' },
      { assignmentState: 'ACCEPTED', workState: 'CANCELLED' },
    ],
  ] as const)(
    'accepts the exact immutable aggregate and state for %s',
    (action, reviewedState, appliedState) => {
      const reviewed = task(reviewedState);
      const applied = task({
        ...reviewedState,
        ...appliedState,
        version: reviewed.version + 1,
        updatedAt: '2026-09-08T10:00:00Z',
      });
      const result: WorkAssignmentMutationResult = {
        assignment: applied,
        receipt: {
          commandId: ids.command,
          assignmentId: ids.assignment,
          operation: action.toUpperCase(),
          appliedVersion: reviewed.version + 1,
          appliedAssignmentRevision: reviewed.assignmentRevision,
          appliedAt: '2026-09-08T10:00:00Z',
          replayed: false,
        },
      };

      expect(() =>
        checkedWorkAssignmentMutation(result, reviewed, action, ids.command, 11)
      ).not.toThrow();
    }
  );

  it('rejects an exact receipt when immutable assignment terms or revision are altered', () => {
    const reviewed = task();
    const accepted = task({
      assignmentState: 'ACCEPTED',
      version: reviewed.version + 1,
      updatedAt: '2026-09-08T10:00:00Z',
    });
    const result: WorkAssignmentMutationResult = {
      assignment: accepted,
      receipt: {
        commandId: ids.command,
        assignmentId: ids.assignment,
        operation: 'ACCEPT',
        appliedVersion: reviewed.version + 1,
        appliedAssignmentRevision: reviewed.assignmentRevision,
        appliedAt: '2026-09-08T10:00:00Z',
        replayed: false,
      },
    };
    const otherCandidate = '66666666-6666-4666-8666-666666666666';
    const changedSource = {
      ...source('AVAILABLE'),
      reference: { ...source('AVAILABLE').reference, candidateId: otherCandidate },
      sourceRoute: `/meetings/follow-ups?meetingId=${ids.meeting}&reportId=${ids.report}&candidateId=${otherCandidate}`,
    } as WorkAssignmentTask['source'];
    const tampered: WorkAssignmentTask[] = [
      { ...accepted, assignmentId: '77777777-7777-4777-8777-777777777777' },
      { ...accepted, createdByUserId: 8 },
      { ...accepted, assignedByUserId: 8 },
      { ...accepted, assigneeUserId: 12 },
      { ...accepted, title: 'Changed title' },
      { ...accepted, description: 'Changed description' },
      { ...accepted, priority: 'LOW' },
      { ...accepted, dueAt: '2026-09-11T09:00:00Z' },
      { ...accepted, createdAt: '2026-09-04T10:00:00Z' },
      { ...accepted, source: changedSource },
      {
        ...accepted,
        source: { ...source('AVAILABLE'), sourceVersion: 2 },
      },
      { ...accepted, assignmentRevision: reviewed.assignmentRevision + 1 },
    ];

    for (const assignment of tampered) {
      expect(() =>
        checkedWorkAssignmentMutation(
          { ...result, assignment },
          reviewed,
          'accept',
          ids.command,
          11
        )
      ).toThrow();
    }
  });

  it('accepts a live source view that advances, is revoked, or becomes newly available', () => {
    const availableReviewed = task();
    const hiddenReviewed = task({}, 'UNAVAILABLE');
    const cases: Array<[WorkAssignmentTask, WorkAssignmentTask]> = [
      [
        availableReviewed,
        task({
          assignmentState: 'ACCEPTED',
          version: availableReviewed.version + 1,
          updatedAt: '2026-09-08T10:00:00Z',
          source: { ...source('AVAILABLE'), sourceVersion: 4 },
        }),
      ],
      [
        availableReviewed,
        task(
          {
            assignmentState: 'ACCEPTED',
            version: availableReviewed.version + 1,
            updatedAt: '2026-09-08T10:00:00Z',
          },
          'UNAVAILABLE'
        ),
      ],
      [
        hiddenReviewed,
        task({
          assignmentState: 'ACCEPTED',
          version: hiddenReviewed.version + 1,
          updatedAt: '2026-09-08T10:00:00Z',
        }),
      ],
    ];

    for (const [reviewed, assignment] of cases) {
      const result: WorkAssignmentMutationResult = {
        assignment,
        receipt: {
          commandId: ids.command,
          assignmentId: ids.assignment,
          operation: 'ACCEPT',
          appliedVersion: reviewed.version + 1,
          appliedAssignmentRevision: reviewed.assignmentRevision,
          appliedAt: '2026-09-08T10:00:00Z',
          replayed: false,
        },
      };
      expect(() =>
        checkedWorkAssignmentMutation(result, reviewed, 'accept', ids.command, 11)
      ).not.toThrow();
    }
  });

  it('compares normalized source routes for an exact receipt', () => {
    const reviewed = task();
    const accepted = task({
      assignmentState: 'ACCEPTED',
      version: reviewed.version + 1,
      updatedAt: '2026-09-08T10:00:00Z',
      source: {
        ...source('AVAILABLE'),
        sourceRoute: `/meetings/history?meeting=${ids.meeting}&reportId=${ids.report}&candidateId=${ids.candidate}`,
      },
    });
    const result: WorkAssignmentMutationResult = {
      assignment: accepted,
      receipt: {
        commandId: ids.command,
        assignmentId: ids.assignment,
        operation: 'ACCEPT',
        appliedVersion: reviewed.version + 1,
        appliedAssignmentRevision: reviewed.assignmentRevision,
        appliedAt: '2026-09-08T10:00:00Z',
        replayed: false,
      },
    };

    expect(() =>
      checkedWorkAssignmentMutation(result, reviewed, 'accept', ids.command, 11)
    ).not.toThrow();
  });

  it('requires cancel to preserve the reviewed assignment state', () => {
    const reviewed = task({ assignmentState: 'ACCEPTED', workState: 'WAITING' });
    const result: WorkAssignmentMutationResult = {
      assignment: task({
        assignmentState: 'DECLINED',
        workState: 'CANCELLED',
        version: reviewed.version + 1,
        updatedAt: '2026-09-08T10:00:00Z',
      }),
      receipt: {
        commandId: ids.command,
        assignmentId: ids.assignment,
        operation: 'CANCEL',
        appliedVersion: reviewed.version + 1,
        appliedAssignmentRevision: reviewed.assignmentRevision,
        appliedAt: '2026-09-08T10:00:00Z',
        replayed: false,
      },
    };

    expect(() =>
      checkedWorkAssignmentMutation(result, reviewed, 'cancel', ids.command, 11)
    ).toThrow('Invalid Work assignment command result');
  });

  it('accepts a newer recovery view while rejecting an unreachable state at the receipt revision', () => {
    const reviewed = task();
    const receipt = {
      commandId: ids.command,
      assignmentId: ids.assignment,
      operation: 'ACCEPT',
      appliedVersion: reviewed.version + 1,
      appliedAssignmentRevision: reviewed.assignmentRevision,
      appliedAt: '2026-09-08T10:00:00Z',
      replayed: true,
    };
    const advanced = task({
      assignmentState: 'ACCEPTED',
      workState: 'IN_PROGRESS',
      version: reviewed.version + 2,
      updatedAt: '2026-09-08T11:00:00Z',
    });

    expect(
      checkedWorkAssignmentMutation(
        { assignment: advanced, receipt },
        reviewed,
        'accept',
        ids.command,
        11
      )
    ).toEqual(expect.objectContaining({ version: 6, workState: 'IN_PROGRESS' }));
    expect(() =>
      checkedWorkAssignmentMutation(
        {
          assignment: { ...advanced, assignmentState: 'PENDING', workState: 'OPEN' },
          receipt,
        },
        reviewed,
        'accept',
        ids.command,
        11
      )
    ).toThrow('Invalid Work assignment command result');
  });

  it('accepts an advanced recovery view after a later reassignment revision', () => {
    const reviewed = task({ createdByUserId: 11, assignedByUserId: 11 });
    const reassigned = task({
      createdByUserId: 11,
      assignedByUserId: 11,
      assigneeUserId: 12,
      assignmentState: 'PENDING',
      workState: 'OPEN',
      assignmentRevision: reviewed.assignmentRevision + 1,
      version: reviewed.version + 2,
      updatedAt: '2026-09-08T11:00:00Z',
    });
    const result: WorkAssignmentMutationResult = {
      assignment: reassigned,
      receipt: {
        commandId: ids.command,
        assignmentId: ids.assignment,
        operation: 'ACCEPT',
        appliedVersion: reviewed.version + 1,
        appliedAssignmentRevision: reviewed.assignmentRevision,
        appliedAt: '2026-09-08T10:00:00Z',
        replayed: true,
      },
    };

    expect(() =>
      checkedWorkAssignmentMutation(result, reviewed, 'accept', ids.command, 11)
    ).not.toThrow();

    for (const assignment of [
      { ...reassigned, createdByUserId: 9, assigneeUserId: 11 },
      { ...reassigned, title: 'Changed after reassignment' },
      { ...reassigned, description: 'Changed after reassignment' },
      { ...reassigned, priority: 'LOW' as const },
      { ...reassigned, dueAt: '2026-09-12T09:00:00Z' },
      { ...reassigned, createdAt: '2026-09-04T10:00:00Z' },
    ]) {
      expect(() =>
        checkedWorkAssignmentMutation(
          { ...result, assignment },
          reviewed,
          'accept',
          ids.command,
          11
        )
      ).toThrow('Invalid Work assignment command result');
    }
  });

  it('compares every reviewed term and authority flag before a mutation', () => {
    const reviewed = task();
    expect(sameReviewedWorkAssignment({ ...reviewed }, reviewed)).toBe(true);
    expect(sameReviewedWorkAssignment({ ...reviewed, title: 'Changed' }, reviewed)).toBe(false);
    expect(
      sameReviewedWorkAssignment(
        { ...reviewed, capabilities: { ...reviewed.capabilities, canAccept: false } },
        reviewed
      )
    ).toBe(false);
  });
});
