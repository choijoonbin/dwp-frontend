import { describe, expect, it } from 'vitest';
import type { WorkAssignmentTask } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import {
  MEETING_HOME_WORK_PAGE_SIZE,
  projectMeetingHomeWorkQueue,
} from './meeting-home-work-queue-model';

const assignment = (overrides: Partial<WorkAssignmentTask> = {}): WorkAssignmentTask => ({
  assignmentId: '99000000-0000-4000-8000-000000000001',
  createdByUserId: 2,
  assignedByUserId: 2,
  assigneeUserId: 7,
  title: 'Ship the confirmed decision',
  description: null,
  priority: 'NORMAL',
  dueAt: '2026-09-04T03:00:00Z',
  assignmentState: 'ACCEPTED',
  workState: 'IN_PROGRESS',
  assignmentRevision: 1,
  version: 2,
  source: {
    availability: 'NOT_REQUESTED',
    reference: null,
    sourceVersion: null,
    sourceRoute: null,
  },
  capabilities: {
    canAccept: false,
    canDecline: false,
    canStart: false,
    canWait: true,
    canComplete: true,
    canReassign: false,
    canCancel: false,
  },
  createdAt: '2026-09-04T01:00:00Z',
  updatedAt: '2026-09-04T02:00:00Z',
  acceptedAt: '2026-09-04T01:30:00Z',
  completedAt: null,
  ...overrides,
});

describe('meeting home Work queue projection', () => {
  it('keeps bounded unfinished and overdue authorized assignments without source payloads', () => {
    const result = projectMeetingHomeWorkQueue(
      {
        items: [
          assignment(),
          assignment({
            assignmentId: '99000000-0000-4000-8000-000000000002',
            workState: 'COMPLETED',
          }),
        ],
        page: 0,
        size: MEETING_HOME_WORK_PAGE_SIZE,
        totalElements: 2,
        hasMore: false,
      },
      7,
      Date.parse('2026-09-04T04:00:00Z')
    );
    expect(result).toEqual([
      expect.objectContaining({ assignmentId: assignment().assignmentId, overdue: true }),
    ]);
    expect(JSON.stringify(result)).not.toContain('source');
  });

  it('fails closed when Work returns a cross-user item', () => {
    expect(() =>
      projectMeetingHomeWorkQueue(
        {
          items: [assignment({ assigneeUserId: 99 })],
          page: 0,
          size: MEETING_HOME_WORK_PAGE_SIZE,
          totalElements: 1,
          hasMore: false,
        },
        7,
        Date.now()
      )
    ).toThrow('Invalid authorized Work task binding');
  });
});
