import type { components as GatewayComponents } from '@dwp-frontend/api-contracts';
import type { ApprovalContentAccess } from './approval-content-access';
import type { ApprovalInformationRound } from './approval-information-contract';
import type {
  ApprovalAdminPulse,
  ApprovalFormDetail,
  ApprovalFormSchema,
  ApprovalTask,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
} from './approval-management-contract';
import type { ApprovalQuorumTaskSnapshot } from './approval-quorum-contract';
import type { ApprovalRequest } from './approval-request-contract';

export type ApprovalMetrics = {
  pending: number;
  dueToday: number;
  overdue: number;
  needsInformation: number;
  myRequestsInFlight: number;
  averageCycleHours: number;
  slaCompliancePercent: number;
};

export type ApprovalTimelineEvent = {
  eventId: string;
  eventType: string;
  actorType: string;
  actorId?: string | null;
  actorDisplayName?: string | null;
  stepName?: string | null;
  stepSequence?: number | null;
  delegated?: boolean;
  outcome: string;
  message?: string | null;
  occurredAt: string;
};

export type ApprovalTaskDetail = {
  task: ApprovalTask;
  contentAccess: ApprovalContentAccess;
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  timeline: ApprovalTimelineEvent[];
  canClaim: boolean;
  canDecide: boolean;
  selfApprovalBlocked: boolean;
  quorum?: ApprovalQuorumTaskSnapshot | null;
};

export type ApprovalRequestDetail = {
  informationGeneration?: number | null;
  informationRound?: ApprovalInformationRound | null;
  request: ApprovalRequest;
  workflowId: string;
  formId: string;
  formVersionId?: string | null;
  formSchemaSha256?: string | null;
  payload: Record<string, unknown>;
  formSchema?: ApprovalFormSchema;
  timeline: ApprovalTimelineEvent[];
};

export type ApprovalRequestPreflightCheck = {
  code: string;
  status: 'PASS' | 'BLOCKED';
  detail: string;
};

export type ApprovalRequestServerPreflight = {
  requestId: string;
  expectedVersion: number;
  ready: boolean;
  workflowContract: string;
  checks: ApprovalRequestPreflightCheck[];
  evaluatedAt: string;
  validUntil?: string | null;
};

export type ApprovalStageMetric = { stage: string; count: number; atRisk: number };
export type ApprovalInsight = {
  key: string;
  tone: string;
  titleKo: string;
  titleEn: string;
  detailKo: string;
  detailEn: string;
  route: string;
};

export type ApprovalHome = {
  generatedAt: string;
  metrics: ApprovalMetrics;
  focusQueue: ApprovalTask[];
  recentRequests: ApprovalRequest[];
  flow: ApprovalStageMetric[];
  insights: ApprovalInsight[];
  administrator: boolean;
  adminPulse?: ApprovalAdminPulse | null;
};

export type ApprovalRequestTemplate = {
  workflow: ApprovalWorkflow;
  routeDefinition: ApprovalWorkflowDetail['definition'];
  form: ApprovalFormDetail;
};

export type ApprovalDelegation = {
  delegationId: string;
  delegatorUserId: number;
  delegateUserId: number;
  delegatePersonPublicId?: string | null;
  delegateDisplayName: string;
  delegateEmail?: string | null;
  scopeType: 'ALL' | 'WORKFLOW';
  workflowId?: GatewayComponents['schemas']['approval_DelegationSummary']['workflowId'] | null;
  /** @deprecated Display-only metadata. Never use this key as delegation authority identity. */
  workflowKey?: GatewayComponents['schemas']['approval_DelegationSummary']['workflowKey'] | null;
  startsAt: string;
  endsAt: string;
  lifecycleState: string;
  reason: string;
  version: number;
  direction: 'OUTGOING' | 'INCOMING';
};

export type ApprovalDelegationCandidate = {
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  email?: string | null;
  jobTitle?: string | null;
};

type ApprovalDelegationCreateBase = {
  delegateUserId: number;
  startsAt: string;
  endsAt: string;
  reason: string;
};

export type ApprovalDelegationCreateInput = ApprovalDelegationCreateBase &
  (
    | { scopeType: 'ALL'; workflowId?: never }
    | {
        scopeType: 'WORKFLOW';
        workflowId: NonNullable<
          GatewayComponents['schemas']['approval_CreateDelegationRequest']['workflowId']
        >;
      }
  );

type ApprovalDelegationUpdateBase = ApprovalDelegationCreateBase & { expectedVersion: number };

export type ApprovalDelegationUpdateInput = ApprovalDelegationUpdateBase &
  ({ scopeType: 'ALL'; workflowId?: never } | { scopeType: 'WORKFLOW'; workflowId: string });
