import type { ApprovalPriority } from './approval-management-contract';

export type ApprovalRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';

export type ApprovalRequest = {
  requestId: string;
  requestNumber: string;
  title: string;
  summary: string;
  workflowNameKo: string;
  workflowNameEn: string;
  currentStepKey?: string | null;
  currentStepName?: string | null;
  currentStepSequence?: number | null;
  totalSteps: number;
  status: ApprovalRequestStatus;
  priority: ApprovalPriority;
  dataClassification: string;
  latestInformationRequest?: string | null;
  submittedAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  version: number;
};
