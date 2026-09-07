import type {
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { checkedFollowUpPage, FOLLOW_UP_PAGE_SIZE } from './meeting-follow-ups-model';

export const MEETING_HOME_WORK_LIMIT = 6;

export type MeetingHomeWorkItem = {
  assignmentId: string;
  title: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  workState: 'OPEN' | 'IN_PROGRESS' | 'WAITING';
  dueAt: string | null;
  overdue: boolean;
};

function isActiveTask(
  task: WorkAssignmentTask
): task is WorkAssignmentTask & { workState: MeetingHomeWorkItem['workState'] } {
  return (
    task.assignmentState !== 'DECLINED' &&
    task.workState !== 'COMPLETED' &&
    task.workState !== 'CANCELLED'
  );
}

/**
 * Work currently accepts only MEETING_FOLLOWUP sources. Its list endpoint intentionally omits
 * source details, so the home projection consumes only authorized task terms and never opens a
 * report, candidate payload, or transcript.
 */
export function projectMeetingHomeWorkQueue(
  page: WorkAssignmentTaskPage,
  actorId: number,
  now: number
): MeetingHomeWorkItem[] {
  const checked = checkedFollowUpPage(page, actorId, 'ASSIGNED_TO_ME', 0);
  return checked.items
    .filter(isActiveTask)
    .map((task) => ({
      assignmentId: task.assignmentId,
      title: task.title,
      priority: task.priority,
      workState: task.workState,
      dueAt: task.dueAt,
      overdue:
        task.dueAt != null && Number.isFinite(Date.parse(task.dueAt))
          ? Date.parse(task.dueAt) < now
          : false,
    }))
    .sort((left, right) => {
      if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
      if (left.dueAt && right.dueAt) return Date.parse(left.dueAt) - Date.parse(right.dueAt);
      if (left.dueAt) return -1;
      if (right.dueAt) return 1;
      return left.assignmentId.localeCompare(right.assignmentId);
    })
    .slice(0, MEETING_HOME_WORK_LIMIT);
}

export { FOLLOW_UP_PAGE_SIZE as MEETING_HOME_WORK_PAGE_SIZE };
