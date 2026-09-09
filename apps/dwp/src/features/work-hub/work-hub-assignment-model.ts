import type {
  WorkAssignmentCapabilities,
  WorkAssignmentMutationResult,
  WorkAssignmentScope,
  WorkAssignmentTask,
  WorkAssignmentTaskPage,
  WorkAssignmentTransition,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import {
  workAssignmentReference,
  workAssignmentSourceRoute,
} from '@dwp-frontend/shared-utils/api/work-assignment-navigation';

import { workHubReferenceKey, type WorkHubItem } from './work-hub-contracts';

export const WORK_ASSIGNMENT_PAGE_SIZE = 100;
export const WORK_ASSIGNMENT_REASON_CODES = {
  decline: ['CAPACITY_LIMIT', 'OUTSIDE_RESPONSIBILITY'],
  cancel: ['NO_LONGER_REQUIRED', 'DUPLICATE_WORK'],
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const assignmentStates = new Set(['PENDING', 'ACCEPTED', 'DECLINED']);
const workStates = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']);
const priorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const capabilityKeys = [
  'canAccept',
  'canDecline',
  'canStart',
  'canWait',
  'canComplete',
  'canReassign',
  'canCancel',
] as const satisfies readonly (keyof WorkAssignmentCapabilities)[];
const capabilityByAction = {
  accept: 'canAccept',
  decline: 'canDecline',
  start: 'canStart',
  wait: 'canWait',
  complete: 'canComplete',
  cancel: 'canCancel',
} as const;

function isInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function unavailableSource(): {
  availability: 'UNAVAILABLE';
  reference: null;
  sourceVersion: null;
  sourceRoute: null;
} {
  return { availability: 'UNAVAILABLE', reference: null, sourceVersion: null, sourceRoute: null };
}

function checkedSource(
  task: WorkAssignmentTask,
  mode: 'LIST' | 'DETAIL'
): WorkAssignmentTask['source'] {
  const source = task.source;
  if (mode === 'LIST') {
    if (
      source.availability !== 'NOT_REQUESTED' ||
      source.reference !== null ||
      source.sourceVersion !== null ||
      source.sourceRoute !== null ||
      task.capabilities.canReassign
    )
      throw new Error('Invalid Work assignment list source binding');
    return source;
  }
  if (source.availability === 'UNAVAILABLE') {
    if (source.reference !== null || source.sourceVersion !== null || source.sourceRoute !== null)
      throw new Error('Invalid unavailable Work assignment source');
    return source;
  }
  if (source.availability !== 'AVAILABLE')
    throw new Error('A Work assignment detail must inspect its source');
  const reference = source.reference;
  const validIdentity =
    reference.sourceSystem === 'MEETING_FOLLOWUP' &&
    [reference.meetingId, reference.reportId, reference.candidateId].every((value) =>
      UUID_PATTERN.test(value)
    ) &&
    isInteger(source.sourceVersion) &&
    workAssignmentSourceRoute(source) !== null;
  return validIdentity ? source : unavailableSource();
}

function boundedCapabilities(
  task: WorkAssignmentTask,
  actorId: number,
  source: WorkAssignmentTask['source']
): WorkAssignmentCapabilities {
  const active = !['COMPLETED', 'CANCELLED'].includes(task.workState);
  const assignee = active && task.assigneeUserId === actorId;
  const creator = active && task.createdByUserId === actorId;
  const pending = assignee && task.assignmentState === 'PENDING' && task.workState === 'OPEN';
  const accepted = assignee && task.assignmentState === 'ACCEPTED';
  return {
    canAccept: task.capabilities.canAccept && pending,
    canDecline: task.capabilities.canDecline && pending,
    canStart: task.capabilities.canStart && accepted && task.workState !== 'IN_PROGRESS',
    canWait: task.capabilities.canWait && accepted && task.workState !== 'WAITING',
    canComplete: task.capabilities.canComplete && accepted,
    canReassign: task.capabilities.canReassign && creator && source.availability === 'AVAILABLE',
    canCancel: task.capabilities.canCancel && creator,
  };
}

export function checkedWorkAssignmentTask(
  task: WorkAssignmentTask,
  actorId: number,
  assignmentId = task.assignmentId,
  mode: 'LIST' | 'DETAIL' = 'DETAIL'
): WorkAssignmentTask {
  if (
    !UUID_PATTERN.test(task.assignmentId) ||
    task.assignmentId !== assignmentId ||
    !isInteger(actorId, 1) ||
    ![task.createdByUserId, task.assignedByUserId, task.assigneeUserId].every((value) =>
      isInteger(value, 1)
    ) ||
    (task.createdByUserId !== actorId && task.assigneeUserId !== actorId) ||
    typeof task.title !== 'string' ||
    !task.title.trim() ||
    task.title.length > 500 ||
    (task.description !== null &&
      (typeof task.description !== 'string' || task.description.length > 4000)) ||
    !priorities.has(task.priority) ||
    (task.dueAt !== null && !isDate(task.dueAt)) ||
    !assignmentStates.has(task.assignmentState) ||
    !workStates.has(task.workState) ||
    !isInteger(task.assignmentRevision) ||
    !isInteger(task.version) ||
    !capabilityKeys.every((key) => typeof task.capabilities?.[key] === 'boolean') ||
    !isDate(task.createdAt) ||
    !isDate(task.updatedAt) ||
    (task.acceptedAt !== null && !isDate(task.acceptedAt)) ||
    (task.completedAt !== null && !isDate(task.completedAt))
  )
    throw new Error('Invalid authorized Work assignment binding');
  const source = checkedSource(task, mode);
  return {
    ...task,
    source,
    capabilities: boundedCapabilities(task, actorId, source),
  };
}

export function checkedWorkAssignmentPage(
  result: WorkAssignmentTaskPage,
  actorId: number,
  scope: WorkAssignmentScope,
  page: number
): WorkAssignmentTaskPage {
  const pageStart = page * WORK_ASSIGNMENT_PAGE_SIZE;
  const expectedHasMore = pageStart + WORK_ASSIGNMENT_PAGE_SIZE < result.totalElements;
  const expectedItems = Math.min(
    WORK_ASSIGNMENT_PAGE_SIZE,
    Math.max(0, result.totalElements - pageStart)
  );
  if (
    result.page !== page ||
    result.size !== WORK_ASSIGNMENT_PAGE_SIZE ||
    !isInteger(result.totalElements) ||
    !Array.isArray(result.items) ||
    result.items.length !== expectedItems ||
    typeof result.hasMore !== 'boolean' ||
    result.hasMore !== expectedHasMore ||
    (result.totalElements === 0 ? page !== 0 : pageStart >= result.totalElements) ||
    (result.hasMore && result.items.length === 0) ||
    new Set(result.items.map((task) => task.assignmentId)).size !== result.items.length
  )
    throw new Error('Invalid Work assignment page binding');
  return {
    ...result,
    items: result.items.map((item) => {
      const task = checkedWorkAssignmentTask(item, actorId, item.assignmentId, 'LIST');
      const scopedActor = scope === 'ASSIGNED_TO_ME' ? task.assigneeUserId : task.createdByUserId;
      if (scopedActor !== actorId) throw new Error('Invalid Work assignment scope binding');
      return task;
    }),
  };
}

/** Self assignments and scope races converge on the newest exact Work aggregate. */
export function mergeWorkAssignmentTasks(
  pages: readonly WorkAssignmentTaskPage[]
): WorkAssignmentTask[] {
  const tasks = new Map<string, WorkAssignmentTask>();
  for (const page of pages) {
    for (const candidate of page.items) {
      const previous = tasks.get(candidate.assignmentId);
      if (!previous) {
        tasks.set(candidate.assignmentId, candidate);
        continue;
      }
      if (
        (candidate.version === previous.version &&
          candidate.assignmentRevision !== previous.assignmentRevision) ||
        (candidate.version > previous.version &&
          candidate.assignmentRevision < previous.assignmentRevision) ||
        (candidate.version < previous.version &&
          candidate.assignmentRevision > previous.assignmentRevision)
      )
        throw new Error('Inconsistent Work assignment ordering');
      if (candidate.version > previous.version) tasks.set(candidate.assignmentId, candidate);
      if (
        candidate.version === previous.version &&
        candidate.assignmentRevision === previous.assignmentRevision &&
        JSON.stringify(candidate) !== JSON.stringify(previous)
      )
        throw new Error('Conflicting Work assignment projections');
    }
  }
  return [...tasks.values()];
}

export function availableWorkAssignmentActions(
  task: WorkAssignmentTask
): WorkAssignmentTransition[] {
  if (['COMPLETED', 'CANCELLED'].includes(task.workState)) return [];
  return (Object.keys(capabilityByAction) as WorkAssignmentTransition[]).filter((action) => {
    if (task.capabilities[capabilityByAction[action]] !== true) return false;
    if (action === 'cancel') return true;
    if (action === 'accept' || action === 'decline')
      return task.assignmentState === 'PENDING' && task.workState === 'OPEN';
    if (task.assignmentState !== 'ACCEPTED') return false;
    if (action === 'start') return task.workState !== 'IN_PROGRESS';
    if (action === 'wait') return task.workState !== 'WAITING';
    return true;
  });
}

export function workAssignmentToHub(task: WorkAssignmentTask, actorId: number): WorkHubItem {
  const reference = workAssignmentReference(task.assignmentId);
  const terminal = ['COMPLETED', 'CANCELLED'].includes(task.workState);
  const requesterIsMe = task.createdByUserId === actorId;
  const assigneeIsMe = task.assigneeUserId === actorId;
  const waitingFor = terminal
    ? 'NONE'
    : task.workState === 'WAITING'
      ? 'UNKNOWN'
      : task.assignmentState === 'DECLINED'
        ? requesterIsMe
          ? 'ME'
          : 'NONE'
        : assigneeIsMe
          ? 'ME'
          : 'OTHERS';
  return {
    key: workHubReferenceKey(reference),
    reference,
    sourceId: 'work-assignments',
    title: task.title,
    summary: task.description,
    lifecycle: task.workState,
    sourceStatus: task.workState,
    originSystem: 'MEETING_FOLLOWUP',
    priority: task.priority,
    dueAt: task.dueAt,
    waitingFor,
    sourceRoute: null,
    version: task.version,
    updatedAt: task.updatedAt,
    reason: null,
    dataClassification: null,
    actions: [],
    sourceContext: {
      kind: 'WORK_ASSIGNMENT',
      assignmentState: task.assignmentState,
      workState: task.workState,
      requesterIsMe,
      assigneeIsMe,
      sourceAvailability: 'NOT_REQUESTED',
    },
  };
}

export function sameReviewedWorkAssignment(
  current: WorkAssignmentTask,
  reviewed: WorkAssignmentTask
): boolean {
  return (
    current.assignmentId === reviewed.assignmentId &&
    current.createdByUserId === reviewed.createdByUserId &&
    current.assignedByUserId === reviewed.assignedByUserId &&
    current.assigneeUserId === reviewed.assigneeUserId &&
    current.title === reviewed.title &&
    current.description === reviewed.description &&
    current.priority === reviewed.priority &&
    current.dueAt === reviewed.dueAt &&
    current.assignmentState === reviewed.assignmentState &&
    current.workState === reviewed.workState &&
    current.assignmentRevision === reviewed.assignmentRevision &&
    current.version === reviewed.version &&
    current.updatedAt === reviewed.updatedAt &&
    capabilityKeys.every((key) => current.capabilities[key] === reviewed.capabilities[key])
  );
}

function appliedStateMatches(
  task: WorkAssignmentTask,
  reviewed: WorkAssignmentTask,
  action: WorkAssignmentTransition
): boolean {
  if (action === 'accept')
    return task.assignmentState === 'ACCEPTED' && task.workState === reviewed.workState;
  if (action === 'decline')
    return task.assignmentState === 'DECLINED' && task.workState === reviewed.workState;
  if (action === 'start')
    return task.assignmentState === 'ACCEPTED' && task.workState === 'IN_PROGRESS';
  if (action === 'wait') return task.assignmentState === 'ACCEPTED' && task.workState === 'WAITING';
  if (action === 'complete')
    return task.assignmentState === 'ACCEPTED' && task.workState === 'COMPLETED';
  return task.assignmentState === reviewed.assignmentState && task.workState === 'CANCELLED';
}

function validWorkAssignmentSourceRefresh(
  current: WorkAssignmentTask,
  reviewed: WorkAssignmentTask
): boolean {
  if (current.source.availability !== 'AVAILABLE' || reviewed.source.availability !== 'AVAILABLE')
    return true;
  return (
    current.source.reference.sourceSystem === reviewed.source.reference.sourceSystem &&
    current.source.reference.meetingId === reviewed.source.reference.meetingId &&
    current.source.reference.reportId === reviewed.source.reference.reportId &&
    current.source.reference.candidateId === reviewed.source.reference.candidateId &&
    current.source.sourceVersion >= reviewed.source.sourceVersion &&
    workAssignmentSourceRoute(current.source) === workAssignmentSourceRoute(reviewed.source)
  );
}

function sameWorkAssignmentCoreTerms(
  current: WorkAssignmentTask,
  reviewed: WorkAssignmentTask
): boolean {
  return (
    current.assignmentId === reviewed.assignmentId &&
    current.createdByUserId === reviewed.createdByUserId &&
    current.title === reviewed.title &&
    current.description === reviewed.description &&
    current.priority === reviewed.priority &&
    current.dueAt === reviewed.dueAt &&
    current.createdAt === reviewed.createdAt
  );
}

function sameWorkAssignmentParties(
  current: WorkAssignmentTask,
  reviewed: WorkAssignmentTask
): boolean {
  return (
    current.assignedByUserId === reviewed.assignedByUserId &&
    current.assigneeUserId === reviewed.assigneeUserId
  );
}

function advancedStateMatches(
  task: WorkAssignmentTask,
  reviewed: WorkAssignmentTask,
  action: WorkAssignmentTransition
): boolean {
  if (action === 'accept') return task.assignmentState === 'ACCEPTED';
  if (action === 'decline')
    return task.assignmentState === 'DECLINED' && ['OPEN', 'CANCELLED'].includes(task.workState);
  if (action === 'start' || action === 'wait')
    return (
      task.assignmentState === 'ACCEPTED' &&
      ['IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'].includes(task.workState)
    );
  if (action === 'complete')
    return task.assignmentState === 'ACCEPTED' && task.workState === 'COMPLETED';
  return task.assignmentState === reviewed.assignmentState && task.workState === 'CANCELLED';
}

export function checkedWorkAssignmentMutation(
  result: WorkAssignmentMutationResult,
  reviewed: WorkAssignmentTask,
  action: WorkAssignmentTransition,
  commandId: string,
  actorId: number
): WorkAssignmentTask {
  const task = checkedWorkAssignmentTask(
    result.assignment,
    actorId,
    reviewed.assignmentId,
    'DETAIL'
  );
  const receipt = result.receipt;
  const exactAppliedVersion = task.version === receipt.appliedVersion;
  const sameAssignmentRevision = task.assignmentRevision === receipt.appliedAssignmentRevision;
  if (
    receipt.commandId !== commandId ||
    receipt.assignmentId !== reviewed.assignmentId ||
    receipt.operation !== action.toUpperCase() ||
    receipt.appliedVersion !== reviewed.version + 1 ||
    receipt.appliedAssignmentRevision !== reviewed.assignmentRevision ||
    !isDate(receipt.appliedAt) ||
    typeof receipt.replayed !== 'boolean' ||
    task.version < receipt.appliedVersion ||
    task.assignmentRevision < receipt.appliedAssignmentRevision ||
    !sameWorkAssignmentCoreTerms(task, reviewed) ||
    !validWorkAssignmentSourceRefresh(task, reviewed) ||
    (exactAppliedVersion &&
      (!sameAssignmentRevision ||
        !sameWorkAssignmentParties(task, reviewed) ||
        !appliedStateMatches(task, reviewed, action))) ||
    (!exactAppliedVersion &&
      sameAssignmentRevision &&
      (!sameWorkAssignmentParties(task, reviewed) || !advancedStateMatches(task, reviewed, action)))
  )
    throw new Error('Invalid Work assignment command result');
  return task;
}
