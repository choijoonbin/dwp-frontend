import { PerformanceReviewWorkspaceView } from '../components/performance-review-workspace';
import {
  useHrisPerformanceReviewRequestScope,
  usePerformanceReviewRuntime,
} from '../hooks/use-performance-review';

import type { PerformanceReviewDataSource } from '../api/performance-review-api';
import type { PerformanceReviewCommandExecutor } from '../hooks/use-performance-review';

export type HrisPerformanceReviewWorkspaceProps = Readonly<{
  reviewId: string | null;
  dataSource?: PerformanceReviewDataSource;
  commandExecutor?: PerformanceReviewCommandExecutor;
}>;

/**
 * Module-owned workspace only. The Start Token intentionally does not authorize route or shell
 * activation, so consumers must not mount this page until the control-owned feature gate opens.
 */
export function HrisPerformanceReviewWorkspace({
  reviewId,
  dataSource,
  commandExecutor,
}: HrisPerformanceReviewWorkspaceProps) {
  const requestScope = useHrisPerformanceReviewRequestScope();
  const runtime = usePerformanceReviewRuntime({
    reviewId,
    requestScope,
    dataSource,
    commandExecutor,
  });
  return (
    <PerformanceReviewWorkspaceView
      review={runtime.review}
      answers={runtime.answers}
      validation={runtime.validation}
      validationVisible={runtime.validationVisible}
      submission={runtime.submission}
      dirty={runtime.dirty}
      pendingKind={runtime.pendingKind}
      commandBusy={runtime.commandBusy}
      commandConnected={runtime.commandConnected}
      feedback={runtime.feedback}
      loadFailure={runtime.loadFailure}
      commandFailure={runtime.commandFailure}
      denied={runtime.denied}
      loading={runtime.loading}
      fetching={runtime.fetching}
      empty={runtime.empty}
      partial={runtime.partial}
      onAnswerChange={runtime.updateAnswer}
      onSaveDraft={runtime.saveDraft}
      onSubmit={runtime.submit}
      onRetryPending={runtime.retryPending}
      onReload={runtime.reload}
      onDiscardAndReload={runtime.discardAndReload}
    />
  );
}
