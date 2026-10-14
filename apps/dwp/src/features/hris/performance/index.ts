export {
  HrisPerformanceWorkspace,
  HrisPerformanceWorkspace as default,
} from './pages/hris-performance-workspace';
export type { HrisPerformanceWorkspaceProps } from './pages/hris-performance-workspace';

export {
  buildPerformanceGoalUpdate,
  classifyPerformanceGoalSaveFailure,
  createPerformanceGoalDraft,
  HRIS_PERFORMANCE_PHASE_ONE_ROUTE,
  isPerformanceGoalEditable,
  rebasePerformanceGoalDraft,
  selectPerformancePersonalGoals,
  setPerformanceGoalDraftProgress,
  validatePerformanceGoalDraft,
  withPerformanceGoalSaveFailure,
} from './model/performance-goal-model';
export type {
  PerformanceDataProvenance,
  PerformanceGoalDraft,
  PerformanceGoalDraftValidation,
  PerformanceGoalSaveFailure,
  PerformanceGoalUpdate,
  PerformancePersonalGoals,
} from './model/performance-goal-model';

export {
  HrisPerformanceCycleStudio,
  HrisPerformanceCycleStudioRuntime,
} from './pages/hris-performance-cycle-studio';
export type {
  HrisPerformanceCycleStudioProps,
  HrisPerformanceCycleStudioRuntimeProps,
} from './pages/hris-performance-cycle-studio';
export {
  HrisPerformanceCycleOperationsWorkspace,
  type HrisPerformanceCycleOperationsWorkspaceProps,
} from './pages/hris-performance-cycle-operations-workspace';
export {
  useHrisPerformanceCycleRequestScope,
  useHrisPerformanceCycleRuntime,
} from './hooks/use-performance-cycle-studio';
export { usePerformanceCycleCommandExecutors } from './hooks/use-performance-cycle-command-executors';
export type {
  HrisPerformanceCycleRuntime,
  HrisPerformanceCycleRuntimeOptions,
  PerformanceCommandExecutor,
  PerformanceCommandExecutors,
} from './hooks/use-performance-cycle-studio';
export {
  buildCreatePerformanceCycleRequest,
  buildPublishPerformanceCycleRequest,
  buildUpdatePerformanceCycleRequest,
  classifyPerformanceCommandFailure,
  createPerformanceCycleDraft,
  performancePreviewIsCurrent,
  performancePreviewState,
  performanceReceiptDisposition,
  rebasePerformanceCycleDraft,
  validatePerformanceCycleDraft,
} from './model/performance-cycle-command';
export {
  PERFORMANCE_CYCLE_OPERATIONS_ROUTE,
  selectPerformanceCommandReceipt,
  selectPerformanceCycleCollection,
  selectPerformanceCycleCommandResult,
  selectPerformanceCycleDetail,
  selectPerformancePopulationPreview,
  selectPerformancePreviewCommandResult,
} from './model/performance-cycle-contract';
export type {
  PerformanceCommandReceipt,
  PerformanceCycleAllowedAction,
  PerformanceCycleCollection,
  PerformanceCycleDetail,
  PerformanceCycleLifecycle,
  PerformanceCycleSummary,
  PerformanceCycleVersion,
  PerformancePopulationPreview,
  PerformancePopulationPreviewMember,
} from './model/performance-cycle-contract';

// BASE-TFR-PER-013 assigned-review module exports. Runtime route activation remains control-owned.
export { HrisPerformanceReviewWorkspace } from './pages/hris-performance-review-workspace';
export type { HrisPerformanceReviewWorkspaceProps } from './pages/hris-performance-review-workspace';
export {
  useHrisPerformanceReviewRequestScope,
  usePerformanceReviewRuntime,
} from './hooks/use-performance-review';
export type {
  PerformanceReviewCommandDescriptor,
  PerformanceReviewCommandExecutor,
  PerformanceReviewFailure,
  PerformanceReviewRuntime,
  PerformanceReviewRuntimeOptions,
} from './hooks/use-performance-review';
export {
  readAssignedPerformanceReview,
  saveAssignedPerformanceReviewDraft,
  submitAssignedPerformanceReview,
  PERFORMANCE_REVIEW_API_CONTRACTS,
} from './api/performance-review-api';
export type {
  PerformanceReviewDataSource,
  PerformanceReviewMutationExecution,
} from './api/performance-review-api';
export {
  PERFORMANCE_REVIEW_DEFAULT_ENABLED,
  parseAssignedPerformanceReview,
  parsePerformanceReviewSnapshot,
  parsePerformanceReviewSubmission,
} from './model/performance-review-contract';
export {
  buildPerformanceReviewDraftCommand,
  setPerformanceReviewAnswer,
  validatePerformanceReviewAnswers,
} from './model/performance-review-draft';
export type {
  AssignedPerformanceReview,
  PerformanceReviewAnswer,
  PerformanceReviewDraftCommand,
  PerformanceReviewForm,
  PerformanceReviewFormItem,
  PerformanceReviewSnapshot,
  PerformanceReviewSubmission,
  PerformanceReviewValidation,
  SubmitPerformanceReviewCommand,
} from './model/performance-review-types';
