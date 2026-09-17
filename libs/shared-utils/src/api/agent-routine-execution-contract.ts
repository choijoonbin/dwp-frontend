import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type DwaionRoutineSource = 'WORK_ITEM' | 'MAIL' | 'CALENDAR';

export type DwaionRoutineBudget = {
  maximumRunsPerMonth: number;
  maximumTokensPerRun: number;
  maximumMinutesPerRun: number;
};

export type DwaionRoutineRetryPolicy = {
  maximumAttempts: number;
  initialBackoffSeconds: number;
  backoffMultiplier: number;
};

export type DwaionRoutineNotificationPolicy = {
  notifyOnPartial: boolean;
  notifyOnFailure: boolean;
  notifyOnRecovery: boolean;
};

export type DwaionRoutineCompensationPolicy = {
  enabled: boolean;
  strategy: 'REVOKE_PENDING_HANDOFFS' | 'PROVIDER_MANAGED';
};

export type DwaionRoutineExecutionPolicyDefinition = {
  budget: DwaionRoutineBudget;
  retryPolicy: DwaionRoutineRetryPolicy;
  notificationPolicy: DwaionRoutineNotificationPolicy;
  compensationPolicy: DwaionRoutineCompensationPolicy;
};

export type DwaionRoutineRuntimeCapabilities = {
  lifecycleMode: string;
  activationAvailable: boolean;
  schedulingAvailable: boolean;
  backgroundExecutionAvailable: boolean;
  dryRunAvailable: boolean;
  pauseResumeAvailable: boolean;
  oneTimeScheduleAvailable: boolean;
  activeWindowPreviewAvailable: boolean;
  quietHoursPreviewAvailable: boolean;
  quietHoursDeliveryEnforcementAvailable: boolean;
  holidayPolicyAvailable: boolean;
  costBudgetAvailable: boolean;
  runtimeBudgetAvailable: boolean;
  notificationDeliveryAvailable: boolean;
  proposalDeliveryAvailable: boolean;
  externalWriteAvailable: boolean;
  executionProviderState: string;
  recoveryHint: string | null;
  supportedCadences: Array<'DAILY' | 'WEEKDAYS' | 'WEEKLY'>;
  consentScopes: Array<'SOURCE_ACCESS' | 'ANALYSIS' | 'PROPOSAL_DELIVERY'>;
};

export type DwaionRoutineRunState =
  | 'QUEUED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'RETRY_SCHEDULED'
  | 'COMPENSATING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATED';

export type DwaionRoutineNotificationState =
  'NOT_REQUIRED' | 'DELIVERED' | 'NOT_CONFIGURED' | 'FAILED';

export type DwaionRoutineExecutionReceipt = {
  receiptId: string;
  routineRunId: string;
  routineId: string;
  routineRevision: number;
  terminalState: Extract<DwaionRoutineRunState, 'COMPLETED' | 'COMPENSATED'>;
  providerReceiptId: string;
  resultSha256: string;
  evidenceCount: number;
  proposalsCreated: number;
  approvalGatedActionsCreated: number;
  externalWritesPerformed: 0;
  notificationState: DwaionRoutineNotificationState;
  authorizationDecisionRevision: number;
  authorizedSources: DwaionRoutineSource[];
  completedAt: string;
};

export type DwaionRoutineExecutionRun = {
  routineRunId: string;
  routineId: string;
  routineRevision: number;
  trigger: 'SCHEDULED' | 'MANUAL';
  state: DwaionRoutineRunState;
  version: number;
  attemptCount: number;
  maximumAttempts: number;
  scheduledFor: string;
  nextAttemptAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  evidenceCount: number;
  proposalsCreated: number;
  approvalGatedActionsCreated: number;
  tokensUsed: number;
  elapsedMs: number;
  notificationState: DwaionRoutineNotificationState;
  safeErrorCode: string | null;
  recoveryHint: string | null;
  compensationRequired: boolean;
  receipt: DwaionRoutineExecutionReceipt | null;
  createdAt: string;
  updatedAt: string;
};

export type DwaionRoutineHighRiskCommand = {
  commandId: string;
  expectedRevision: number;
  reasonCode: string;
  changeReason: string;
  authority?: ProductSurfaceGovernedMutationAuthority;
};

export type DwaionRoutineActivationCommand = DwaionRoutineHighRiskCommand & {
  action: 'ACTIVATE' | 'DEACTIVATE';
  startAt?: string | null;
};

export type DwaionRoutineRunCommand = DwaionRoutineHighRiskCommand & {
  action: 'RETRY' | 'CANCEL' | 'COMPENSATE';
};
