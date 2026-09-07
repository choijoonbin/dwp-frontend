import { describe, expect, it } from 'vitest';
import type {
  WorkAssignmentMutationResult,
  WorkAssignmentTask,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import {
  availableFollowUpActions,
  checkedFollowUpPage,
  checkedFollowUpReceipt,
  checkedFollowUpTask,
  filterFollowUpPage,
  followUpSourcePath,
  type FollowUpAttempt,
} from './meeting-follow-ups-model';

const id = '99000000-0000-4000-8000-000000000001';
const report = '99000000-0000-4000-8000-000000000002';
const candidate = '99000000-0000-4000-8000-000000000003';
const command = '99000000-0000-4000-8000-000000000004';
const task: WorkAssignmentTask = {
  assignmentId: id,
  createdByUserId: 2,
  assignedByUserId: 2,
  assigneeUserId: 1,
  title: 'Publish rollout checklist',
  description: 'Confirm the owner-approved task terms.',
  priority: 'HIGH',
  dueAt: null,
  assignmentState: 'PENDING',
  workState: 'OPEN',
  assignmentRevision: 1,
  version: 3,
  source: {
    availability: 'AVAILABLE',
    reference: {
      sourceSystem: 'MEETING_FOLLOWUP',
      meetingId: id,
      reportId: report,
      candidateId: candidate,
    },
    sourceVersion: 8,
    sourceRoute: 'https://evil.example/secret',
  },
  capabilities: {
    canAccept: true,
    canDecline: true,
    canStart: false,
    canWait: false,
    canComplete: false,
    canReassign: true,
    canCancel: false,
  },
  createdAt: '2026-09-04T01:00:00Z',
  updatedAt: '2026-09-04T01:00:00Z',
  acceptedAt: null,
  completedAt: null,
};
const attempt: FollowUpAttempt = {
  assignmentId: id,
  commandId: command,
  action: 'accept',
  input: { version: 3, assignmentRevision: 1 },
};
const result: WorkAssignmentMutationResult = {
  assignment: { ...task, assignmentState: 'ACCEPTED', version: 4 },
  receipt: {
    assignmentId: id,
    commandId: command,
    operation: 'ACCEPT',
    appliedVersion: 4,
    appliedAssignmentRevision: 1,
    appliedAt: '2026-09-04T01:01:00Z',
    replayed: false,
  },
};

describe('meeting follow-up canonical consumer model', () => {
  it('constructs the exact meeting/report local route and never uses owner-provided href', () => {
    expect(followUpSourcePath(task)).toBe(`/meetings/history?meeting=${id}&reportId=${report}`);
    expect(checkedFollowUpTask(task, 1).source.sourceRoute).toBe('');
  });
  it.each(['UNAVAILABLE', 'NOT_REQUESTED'] as const)(
    'clears all source fields for %s despite stale cached metadata',
    (availability) => {
      const stale = { ...task, source: { ...task.source, availability } } as WorkAssignmentTask;
      expect(checkedFollowUpTask(stale, 1).source).toEqual({
        availability,
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      });
      expect(followUpSourcePath(checkedFollowUpTask(stale, 1))).toBeNull();
    }
  );
  it('rejects malformed identity before constructing navigation', () => {
    const malformed = {
      ...task,
      source: {
        ...task.source,
        reference: {
          sourceSystem: 'MEETING_FOLLOWUP',
          meetingId: '../escape',
          reportId: report,
          candidateId: candidate,
        },
      },
    } as WorkAssignmentTask;
    expect(checkedFollowUpTask(malformed, 1).source.availability).toBe('UNAVAILABLE');
    expect(followUpSourcePath(malformed)).toBeNull();
  });
  it('rejects a cross-user or cross-assignment detail', () => {
    expect(() => checkedFollowUpTask(task, 9)).toThrow();
    expect(() => checkedFollowUpTask(task, 1, report)).toThrow();
  });
  it('keeps list source unrequested and does not merge prior inspected source data', () => {
    const page = checkedFollowUpPage(
      { items: [task], page: 0, size: 20, totalElements: 1, hasMore: false },
      1,
      'ASSIGNED_TO_ME',
      0
    );
    expect(page.items[0].source.availability).toBe('NOT_REQUESTED');
    expect(page.items[0].source.reference).toBeNull();
    expect(page.items[0].capabilities.canReassign).toBe(false);
  });
  it('binds requested scope to original creator rather than last assigning user', () => {
    const page = {
      items: [{ ...task, assignedByUserId: 1 }],
      page: 0,
      size: 20,
      totalElements: 1,
      hasMore: false,
    };
    expect(() => checkedFollowUpPage(page, 1, 'ASSIGNED_BY_ME', 0)).toThrow();
    expect(checkedFollowUpPage(page, 2, 'ASSIGNED_BY_ME', 0).items).toHaveLength(1);
  });
  it('rejects wrong pagination, oversized pages and duplicate canonical identities', () => {
    const page = { items: [task], page: 0, size: 20, totalElements: 1, hasMore: false };
    expect(() => checkedFollowUpPage(page, 1, 'ASSIGNED_TO_ME', 1)).toThrow();
    expect(() => checkedFollowUpPage({ ...page, size: 50 }, 1, 'ASSIGNED_TO_ME', 0)).toThrow();
    expect(() =>
      checkedFollowUpPage({ ...page, items: [task, task] }, 1, 'ASSIGNED_TO_ME', 0)
    ).toThrow();
  });
  it('does not conflate acceptance and start or offer reassign/create', () => {
    expect(availableFollowUpActions(task)).toEqual(['accept', 'decline']);
    expect(
      availableFollowUpActions({
        ...task,
        assignmentState: 'ACCEPTED',
        capabilities: { ...task.capabilities, canStart: true },
      })
    ).toEqual(['start']);
  });
  it('keeps independent Work actions when source is unavailable', () => {
    expect(
      availableFollowUpActions({
        ...task,
        source: {
          availability: 'UNAVAILABLE',
          reference: null,
          sourceVersion: null,
          sourceRoute: null,
        },
      })
    ).toEqual(['accept', 'decline']);
  });
  it('uses literal server capabilities and closes terminal tasks', () => {
    expect(
      availableFollowUpActions({
        ...task,
        capabilities: { ...task.capabilities, canAccept: false, canDecline: false },
      })
    ).toEqual([]);
    expect(availableFollowUpActions({ ...task, workState: 'COMPLETED' })).toEqual([]);
    expect(availableFollowUpActions({ ...task, workState: 'CANCELLED' })).toEqual([]);
  });
  it('filters only supplied current-page rows without changing canonical task states', () => {
    const rows = [
      task,
      { ...task, assignmentId: report, title: 'Archive notes', workState: 'COMPLETED' as const },
    ];
    expect(filterFollowUpPage(rows, 'rollout', 'ACTIVE')).toEqual([task]);
    expect(filterFollowUpPage(rows, '', 'COMPLETED').map((item) => item.assignmentId)).toEqual([
      report,
    ]);
    expect(task.workState).toBe('OPEN');
  });
  it('accepts a matching receipt and retains the authorized current task view', () => {
    expect(checkedFollowUpReceipt(result, attempt, 1).assignmentState).toBe('ACCEPTED');
    expect(
      checkedFollowUpReceipt(
        {
          ...result,
          assignment: { ...result.assignment, version: 9, workState: 'COMPLETED' },
          receipt: { ...result.receipt, replayed: true },
        },
        attempt,
        1
      ).workState
    ).toBe('COMPLETED');
  });
  it.each([
    { commandId: report },
    { assignmentId: report },
    { operation: 'START' },
    { appliedVersion: 9 },
    { appliedAssignmentRevision: 2 },
    { appliedAt: 'invalid' },
  ])('rejects a mismatched receipt %j', (patch) => {
    expect(() =>
      checkedFollowUpReceipt({ ...result, receipt: { ...result.receipt, ...patch } }, attempt, 1)
    ).toThrow();
  });
  it('rejects a current projection older than the applied proof', () => {
    expect(() => checkedFollowUpReceipt({ ...result, assignment: task }, attempt, 1)).toThrow();
  });
});
