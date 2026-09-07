import type {
  PersonalWorkPriority,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import type { WorkspaceWorkItem } from '@dwp-frontend/shared-utils/api/workspace-api';

export type WorkHubSourceId =
  | 'workspace'
  | 'approval-inbox'
  | 'approval-completed'
  | 'approval-needs-info'
  | 'services'
  | 'personal';
export type WorkHubLifecycle =
  'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type WorkHubUrgency = 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NO_DUE_DATE';
export type WorkHubActionKind =
  | 'OPEN_SOURCE'
  | 'WORKSPACE_START'
  | 'WORKSPACE_COMPLETE'
  | 'APPROVAL_CLAIM'
  | 'APPROVAL_DECIDE'
  | 'ACCESS_REVIEW_DECIDE'
  | 'PERSONAL_START'
  | 'PERSONAL_WAIT'
  | 'PERSONAL_COMPLETE'
  | 'PERSONAL_REOPEN'
  | 'PERSONAL_ARCHIVE';

export type WorkHubItem = {
  key: string;
  reference: WorkSourceReference;
  sourceId: WorkHubSourceId;
  title: string;
  summary: string | null;
  lifecycle: WorkHubLifecycle;
  sourceStatus: string;
  originSystem: string;
  priority: PersonalWorkPriority;
  dueAt: string | null;
  waitingFor: 'ME' | 'OTHERS' | 'UNKNOWN' | 'NONE';
  sourceRoute: string | null;
  version: number;
  updatedAt: string | null;
  reason: string | null;
  dataClassification: string | null;
  actions: Array<{ kind: WorkHubActionKind; availability: 'AVAILABLE' | 'DETAIL_REQUIRED' }>;
  /** Compatibility identity for existing links during the staged queue migration. */
  legacyItem?: WorkspaceWorkItem;
};

export type WorkHubSourceSnapshot = {
  sourceId: WorkHubSourceId;
  state: 'READY' | 'FORBIDDEN' | 'UNAVAILABLE' | 'NOT_REQUESTED';
  items: WorkHubItem[];
  receivedAt: string | null;
  generatedAt: string | null;
  hasMore: boolean;
};

export type WorkHubSnapshot = {
  items: WorkHubItem[];
  sources: WorkHubSourceSnapshot[];
  /** PARTIAL never means an empty source or a globally complete count. */
  completeness: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
  receivedAt: string;
};

export function workHubReferenceKey(reference: WorkSourceReference): string {
  return [reference.sourceSystem, reference.sourceReference, reference.obligationKey ?? '']
    .map(encodeURIComponent)
    .join(':');
}

export function workHubUrgency(
  item: Pick<WorkHubItem, 'lifecycle' | 'dueAt'>,
  now: number
): WorkHubUrgency {
  const due = item.dueAt ? Date.parse(item.dueAt) : NaN;
  if (!Number.isFinite(due)) return 'NO_DUE_DATE';
  if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(item.lifecycle)) return 'SCHEDULED';
  if (due < now) return 'OVERDUE';
  return due - now <= 86_400_000 ? 'DUE_SOON' : 'SCHEDULED';
}

export function workHubItemRoute(reference: WorkSourceReference): string {
  return `/work/queue?work=${encodeURIComponent(workHubReferenceKey(reference))}`;
}
