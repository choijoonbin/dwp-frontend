import { getWorkAssignmentEvents } from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type {
  WorkAssignmentEvent,
  WorkAssignmentEventPage,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

export const WORK_ASSIGNMENT_EVENT_PAGE_SIZE = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const actions = new Set([
  'CREATE',
  'ACCEPT',
  'DECLINE',
  'START',
  'WAIT',
  'COMPLETE',
  'CANCEL',
  'REASSIGN',
]);
const assignmentStates = new Set(['PENDING', 'ACCEPTED', 'DECLINED']);
const workStates = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']);
const reasonCode = /^[A-Z][A-Z0-9_]{2,47}$/u;

function isInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function checkedEvent(event: WorkAssignmentEvent, assignmentId: string): WorkAssignmentEvent {
  if (
    !UUID_PATTERN.test(event.eventId) ||
    event.assignmentId !== assignmentId ||
    !UUID_PATTERN.test(event.assignmentId) ||
    !actions.has(event.action) ||
    !isInteger(event.actorUserId, 1) ||
    !isInteger(event.assigneeUserId, 1) ||
    !assignmentStates.has(event.assignmentState) ||
    !workStates.has(event.workState) ||
    !isInteger(event.assignmentRevision) ||
    !isInteger(event.version) ||
    (event.reasonCode !== null && !reasonCode.test(event.reasonCode)) ||
    typeof event.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    !UUID_PATTERN.test(event.auditRecordId)
  )
    throw new Error('Invalid Work assignment history event');
  return event;
}

export function checkedWorkAssignmentEventPage(
  page: WorkAssignmentEventPage,
  assignmentId: string,
  afterVersion: number
): WorkAssignmentEventPage {
  if (
    !Array.isArray(page.items) ||
    page.items.length > WORK_ASSIGNMENT_EVENT_PAGE_SIZE ||
    !isInteger(page.nextAfterVersion, -1) ||
    typeof page.hasMore !== 'boolean' ||
    (page.hasMore && page.items.length !== WORK_ASSIGNMENT_EVENT_PAGE_SIZE)
  )
    throw new Error('Invalid Work assignment history page');
  const items = page.items.map((event) => checkedEvent(event, assignmentId));
  if (new Set(items.map((event) => event.eventId)).size !== items.length)
    throw new Error('Work assignment history repeated an event');
  let previous = afterVersion;
  for (const event of items) {
    if (event.version !== previous + 1)
      throw new Error('Work assignment history is not contiguous');
    previous = event.version;
  }
  const expectedCursor = items.length ? items.at(-1)!.version : afterVersion;
  if (page.nextAfterVersion !== expectedCursor)
    throw new Error('Work assignment history cursor does not match its page');
  return { ...page, items };
}

export class WorkAssignmentHistoryChangedError extends Error {
  constructor(readonly direction: 'AHEAD' | 'BEHIND') {
    super('Work assignment detail and history do not match');
    this.name = 'WorkAssignmentHistoryChangedError';
  }
}

function validTransition(previous: WorkAssignmentEvent, current: WorkAssignmentEvent): boolean {
  if (
    current.assignmentRevision !==
      previous.assignmentRevision + (current.action === 'REASSIGN' ? 1 : 0) ||
    (current.action !== 'REASSIGN' && current.assigneeUserId !== previous.assigneeUserId) ||
    Date.parse(current.occurredAt) < Date.parse(previous.occurredAt)
  )
    return false;
  if (current.action === 'REASSIGN')
    return (
      !['COMPLETED', 'CANCELLED'].includes(previous.workState) &&
      current.assigneeUserId !== previous.assigneeUserId &&
      current.assignmentState === 'PENDING' &&
      current.workState === 'OPEN' &&
      current.reasonCode !== null
    );
  if (current.assignmentRevision !== previous.assignmentRevision) return false;
  if (current.action === 'ACCEPT')
    return (
      previous.assignmentState === 'PENDING' &&
      previous.workState === 'OPEN' &&
      current.assignmentState === 'ACCEPTED' &&
      current.workState === previous.workState
    );
  if (current.action === 'DECLINE')
    return (
      previous.assignmentState === 'PENDING' &&
      previous.workState === 'OPEN' &&
      current.assignmentState === 'DECLINED' &&
      current.workState === previous.workState &&
      current.reasonCode !== null
    );
  if (current.action === 'CANCEL')
    return (
      !['COMPLETED', 'CANCELLED'].includes(previous.workState) &&
      current.assignmentState === previous.assignmentState &&
      current.workState === 'CANCELLED' &&
      current.reasonCode !== null
    );
  if (
    previous.assignmentState !== 'ACCEPTED' ||
    current.assignmentState !== 'ACCEPTED' ||
    ['COMPLETED', 'CANCELLED'].includes(previous.workState)
  )
    return false;
  if (current.action === 'START') return current.workState === 'IN_PROGRESS';
  if (current.action === 'WAIT') return current.workState === 'WAITING';
  return current.action === 'COMPLETE' && current.workState === 'COMPLETED';
}

export function checkedWorkAssignmentHistoryTransitions(
  events: readonly WorkAssignmentEvent[]
): void {
  const first = events[0];
  if (!first) return;
  if (
    first.version !== 0 ||
    first.action !== 'CREATE' ||
    first.assignmentState !== 'PENDING' ||
    first.workState !== 'OPEN' ||
    first.assignmentRevision !== 0 ||
    first.reasonCode !== null
  )
    throw new Error('Work assignment history has an invalid origin');
  for (let index = 1; index < events.length; index += 1) {
    if (!validTransition(events[index - 1]!, events[index]!))
      throw new Error('Work assignment history has an invalid transition');
  }
}

export async function loadWorkAssignmentHistory(
  assignmentId: string,
  signal: AbortSignal,
  read = getWorkAssignmentEvents
): Promise<WorkAssignmentEvent[]> {
  const events: WorkAssignmentEvent[] = [];
  const ids = new Set<string>();
  let afterVersion = -1;
  for (let pageNumber = 0; pageNumber <= 10_000; pageNumber += 1) {
    signal.throwIfAborted();
    const page = checkedWorkAssignmentEventPage(
      await read(assignmentId, { afterVersion, size: WORK_ASSIGNMENT_EVENT_PAGE_SIZE }, signal),
      assignmentId,
      afterVersion
    );
    if (page.items.some((event) => ids.has(event.eventId)))
      throw new Error('Work assignment history repeated an event');
    page.items.forEach((event) => {
      ids.add(event.eventId);
      events.push(event);
    });
    if (!page.hasMore) {
      checkedWorkAssignmentHistoryTransitions(events);
      return events;
    }
    if (page.nextAfterVersion <= afterVersion)
      throw new Error('Work assignment history did not advance');
    afterVersion = page.nextAfterVersion;
  }
  throw new Error('Work assignment history exceeded its contract');
}
