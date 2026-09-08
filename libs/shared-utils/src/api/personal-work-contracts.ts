export type PersonalWorkStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'ARCHIVED';
export type PersonalWorkPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type WorkSourceReference = {
  sourceSystem: string;
  sourceReference: string;
  obligationKey?: string | null;
};

/** A denied or deleted source returns no cached title, status or navigation target. */
export type PersonalWorkSource =
  | {
      availability: 'AVAILABLE';
      reference: WorkSourceReference;
      title: string;
      sourceRoute: string;
      status: string;
      dueAt?: string | null;
    }
  | {
      availability: 'REFERENCE_ONLY';
      reference: WorkSourceReference;
      title: null;
      sourceRoute: null;
      status: null;
      dueAt: null;
    }
  | {
      availability: 'UNAVAILABLE';
      reference: null;
      title: null;
      sourceRoute: null;
      status: null;
      dueAt: null;
    };

export type PersonalWorkChecklistItem = {
  itemId: string;
  title: string;
  completed: boolean;
};
export type PersonalWorkDeleteResult = { taskId: string; version: number; deletedAt: string };

export type PersonalWorkTask = {
  taskId: string;
  title: string;
  description: string | null;
  status: PersonalWorkStatus;
  priority: PersonalWorkPriority;
  dueAt: string | null;
  source: PersonalWorkSource | null;
  /** Optional while older task receipts/servers are read during rollout. */
  sources?: PersonalWorkSource[];
  checklist?: PersonalWorkChecklistItem[];
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type PersonalWorkPage<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  hasMore: boolean;
};
export type PersonalWorkTaskInput = {
  title: string;
  description?: string | null;
  priority: PersonalWorkPriority;
  dueAt?: string | null;
  sourceReference?: WorkSourceReference | null;
  /** Update only: explicit unlink. A null reference otherwise retains the saved relationship. */
  clearSourceReference?: boolean;
  /** Ordered full replacement; omission preserves current checklist on update. */
  checklist?: PersonalWorkChecklistItem[] | null;
  /** Ordered full replacement; [] clears all sources. Do not combine with singular/clear input. */
  sourceReferences?: WorkSourceReference[] | null;
};
export type PersonalWorkTimelineEvent = {
  eventId: string;
  action: string;
  status: PersonalWorkStatus;
  version: number;
  occurredAt: string;
  auditRecordId: string;
};
export type PersonalDayPlan = {
  date: string;
  version: number;
  items: Array<{
    position: number;
    selectionReference: WorkSourceReference;
    source: PersonalWorkSource;
  }>;
  updatedAt: string | null;
};
