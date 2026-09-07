import type {
  WorkAssignmentMutationResult,
  WorkAssignmentScope,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
  WorkAssignmentTransition,
  WorkAssignmentVersionCommand,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

export type FollowUpTab = WorkAssignmentScope | 'CANDIDATES';
export type FollowUpAttempt = {
  commandId: string;
  assignmentId: string;
  action: WorkAssignmentTransition;
  input: WorkAssignmentVersionCommand;
};

export const FOLLOW_UP_PAGE_SIZE = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;
const capabilityByAction = {
  accept: 'canAccept',
  decline: 'canDecline',
  start: 'canStart',
  wait: 'canWait',
  complete: 'canComplete',
  cancel: 'canCancel',
} as const;
export const FOLLOW_UP_REASON_CODES = {
  decline: ['CAPACITY_LIMIT', 'OUTSIDE_RESPONSIBILITY'],
  cancel: ['NO_LONGER_REQUIRED', 'DUPLICATE_WORK'],
} as const;

/** Only Work's current authorized task terms are consumed; sourceRoute is never trusted. */
export function checkedFollowUpTask(
  task: WorkAssignmentTask,
  actorId: number,
  assignmentId = task.assignmentId
): WorkAssignmentTask {
  if (
    !uuid.test(task.assignmentId) ||
    task.assignmentId !== assignmentId ||
    !integer(task.version) ||
    !integer(task.assignmentRevision) ||
    (task.createdByUserId !== actorId && task.assigneeUserId !== actorId) ||
    !['PENDING', 'ACCEPTED', 'DECLINED'].includes(task.assignmentState) ||
    !['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'].includes(task.workState) ||
    typeof task.title !== 'string' ||
    !task.title.trim() ||
    task.title.length > 500 ||
    (task.description !== null &&
      (typeof task.description !== 'string' || task.description.length > 4000)) ||
    !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(task.priority)
  )
    throw new Error('Invalid authorized Work task binding');
  const reference = task.source?.availability === 'AVAILABLE' ? task.source.reference : null;
  const available =
    reference?.sourceSystem === 'MEETING_FOLLOWUP' &&
    [reference.meetingId, reference.reportId, reference.candidateId].every((value) =>
      uuid.test(value)
    ) &&
    task.source.availability === 'AVAILABLE' &&
    integer(task.source.sourceVersion);
  return {
    ...task,
    source:
      available && task.source.availability === 'AVAILABLE'
        ? { ...task.source, sourceRoute: '' }
        : {
            availability:
              task.source?.availability === 'NOT_REQUESTED' ? 'NOT_REQUESTED' : 'UNAVAILABLE',
            reference: null,
            sourceVersion: null,
            sourceRoute: null,
          },
  };
}

export function checkedFollowUpPage(
  result: WorkAssignmentTaskPage,
  actorId: number,
  scope: WorkAssignmentScope,
  page: number
): WorkAssignmentTaskPage {
  if (
    result.page !== page ||
    result.size !== FOLLOW_UP_PAGE_SIZE ||
    !integer(result.totalElements) ||
    !Array.isArray(result.items) ||
    result.items.length > FOLLOW_UP_PAGE_SIZE ||
    typeof result.hasMore !== 'boolean' ||
    new Set(result.items.map((task) => task.assignmentId)).size !== result.items.length
  )
    throw new Error('Invalid Work task page binding');
  return {
    ...result,
    items: result.items.map((item) => {
      const task = checkedFollowUpTask(item, actorId);
      const scopedId = scope === 'ASSIGNED_TO_ME' ? task.assigneeUserId : task.createdByUserId;
      if (scopedId !== actorId) throw new Error('Invalid Work task scope binding');
      return {
        ...task,
        source: {
          availability: 'NOT_REQUESTED',
          reference: null,
          sourceVersion: null,
          sourceRoute: null,
        },
        capabilities: { ...task.capabilities, canReassign: false },
      };
    }),
  };
}

export function availableFollowUpActions(task: WorkAssignmentTask): WorkAssignmentTransition[] {
  if (['COMPLETED', 'CANCELLED'].includes(task.workState)) return [];
  return (Object.keys(capabilityByAction) as WorkAssignmentTransition[]).filter((action) => {
    if (task.capabilities?.[capabilityByAction[action]] !== true) return false;
    if (action === 'cancel') return true;
    if (action === 'accept' || action === 'decline')
      return task.assignmentState === 'PENDING' && task.workState === 'OPEN';
    if (task.assignmentState !== 'ACCEPTED') return false;
    if (action === 'start') return task.workState !== 'IN_PROGRESS';
    if (action === 'wait') return task.workState !== 'WAITING';
    return true;
  });
}

export function followUpSourcePath(task: WorkAssignmentTask): string | null {
  const source = task.source;
  if (
    source.availability !== 'AVAILABLE' ||
    source.reference.sourceSystem !== 'MEETING_FOLLOWUP' ||
    ![source.reference.meetingId, source.reference.reportId, source.reference.candidateId].every(
      (value) => uuid.test(value)
    )
  )
    return null;
  const query = new URLSearchParams({
    meeting: source.reference.meetingId,
    reportId: source.reference.reportId,
  });
  return `/meetings/history?${query}`;
}

export function checkedFollowUpReceipt(
  result: WorkAssignmentMutationResult,
  attempt: FollowUpAttempt,
  actorId: number
): WorkAssignmentTask {
  const task = checkedFollowUpTask(result.assignment, actorId, attempt.assignmentId);
  const receipt = result.receipt;
  if (
    receipt.commandId !== attempt.commandId ||
    receipt.assignmentId !== attempt.assignmentId ||
    receipt.operation !== attempt.action.toUpperCase() ||
    receipt.appliedVersion !== attempt.input.version + 1 ||
    receipt.appliedAssignmentRevision !== attempt.input.assignmentRevision ||
    task.version < receipt.appliedVersion ||
    task.assignmentRevision < receipt.appliedAssignmentRevision ||
    !Number.isFinite(Date.parse(receipt.appliedAt)) ||
    typeof receipt.replayed !== 'boolean'
  )
    throw new Error('Invalid Work command receipt binding');
  return task;
}

export function filterFollowUpPage(
  tasks: WorkAssignmentTask[],
  search: string,
  filter: 'ALL' | 'ACTIVE' | 'COMPLETED'
) {
  const term = search.trim().toLocaleLowerCase();
  return tasks.filter(
    (task) =>
      (!term ||
        [task.title, task.description ?? ''].some((value) =>
          value.toLocaleLowerCase().includes(term)
        )) &&
      (filter === 'ALL' ||
        (filter === 'COMPLETED'
          ? task.workState === 'COMPLETED'
          : !['COMPLETED', 'CANCELLED'].includes(task.workState)))
  );
}
