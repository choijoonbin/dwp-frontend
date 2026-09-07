import type { PersonalWorkPriority } from './personal-work-contracts';

export type WorkAssignmentState = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type WorkAssignmentWorkState =
  'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
export type WorkAssignmentScope = 'ASSIGNED_TO_ME' | 'ASSIGNED_BY_ME';
export type WorkAssignmentAction =
  'ACCEPT' | 'DECLINE' | 'START' | 'WAIT' | 'COMPLETE' | 'CANCEL' | 'REASSIGN';
export type WorkAssignmentTransition =
  'accept' | 'decline' | 'start' | 'wait' | 'complete' | 'cancel';

/** A Meeting-owned, server-issued candidate binds the human-confirmed task terms. */
export type WorkAssignmentSourceIdentity = {
  sourceSystem: 'MEETING_FOLLOWUP';
  meetingId: string;
  reportId: string;
  candidateId: string;
};

export type WorkAssignmentSourceView =
  | {
      availability: 'AVAILABLE';
      reference: WorkAssignmentSourceIdentity;
      sourceVersion: number;
      sourceRoute: string;
    }
  | {
      availability: 'UNAVAILABLE' | 'NOT_REQUESTED';
      reference: null;
      sourceVersion: null;
      sourceRoute: null;
    };

export type WorkAssignmentCapabilities = {
  canAccept: boolean;
  canDecline: boolean;
  canStart: boolean;
  canWait: boolean;
  canComplete: boolean;
  canReassign: boolean;
  canCancel: boolean;
};

/** Acceptance and execution are independent. Source access does not define Work task access. */
export type WorkAssignmentTask = {
  assignmentId: string;
  createdByUserId: number;
  assignedByUserId: number;
  assigneeUserId: number;
  title: string;
  description: string | null;
  priority: PersonalWorkPriority;
  dueAt: string | null;
  assignmentState: WorkAssignmentState;
  workState: WorkAssignmentWorkState;
  assignmentRevision: number;
  version: number;
  source: WorkAssignmentSourceView;
  capabilities: WorkAssignmentCapabilities;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
};

export type WorkAssignmentTaskPage = {
  items: WorkAssignmentTask[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
};

/** No title or assignee is accepted here; the server reads confirmed terms from the owner. */
export type CreateWorkAssignmentInput = {
  source: WorkAssignmentSourceIdentity;
  expectedSourceVersion: number;
};

export type WorkAssignmentVersionCommand = {
  version: number;
  assignmentRevision: number;
  reasonCode?: string | null;
};

export type ReassignWorkAssignmentInput = {
  assigneeUserId: number;
  version: number;
  assignmentRevision: number;
  reasonCode: string;
};

export type WorkAssignmentCommandReceipt = {
  commandId: string;
  assignmentId: string;
  operation: string;
  appliedVersion: number;
  appliedAssignmentRevision: number;
  appliedAt: string;
  replayed: boolean;
};

/** Receipt versions describe the applied command; assignment is the currently authorized view. */
export type WorkAssignmentMutationResult = {
  assignment: WorkAssignmentTask;
  receipt: WorkAssignmentCommandReceipt;
};

export type WorkAssignmentEvent = {
  eventId: string;
  assignmentId: string;
  action: string;
  actorUserId: number;
  assigneeUserId: number;
  assignmentState: WorkAssignmentState;
  workState: WorkAssignmentWorkState;
  assignmentRevision: number;
  version: number;
  reasonCode: string | null;
  occurredAt: string;
  auditRecordId: string;
};

export type WorkAssignmentEventPage = {
  items: WorkAssignmentEvent[];
  nextAfterVersion: number;
  hasMore: boolean;
};
