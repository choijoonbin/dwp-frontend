import { ApprovalBatchResultPanel } from './approval-batch-result-panel';
import { downloadApprovalBatchResultCsv } from './approval-batch-result-export';
import { approvalBatchRetryTaskIds } from './approval-command-center-model';

import type { ApprovalBatchResult } from './approval-command-center-model';
import type { ApprovalTask } from '@dwp-frontend/shared-utils';

export function ApprovalCommandBatchResult({
  result,
  tasks,
  retrying,
  onRetry,
  onOpenTask,
  onDismiss,
}: {
  result: ApprovalBatchResult;
  tasks: readonly ApprovalTask[];
  retrying: boolean;
  onRetry: (taskIds: readonly string[], previousResult: ApprovalBatchResult) => void;
  onOpenTask: (taskId: string) => void;
  onDismiss: () => void;
}) {
  return (
    <ApprovalBatchResultPanel
      result={result}
      tasks={tasks}
      retrying={retrying}
      onRetry={() => {
        const taskIds = approvalBatchRetryTaskIds(result);
        if (taskIds.length > 0) onRetry(taskIds, result);
      }}
      onOpenTask={onOpenTask}
      onDownload={() => downloadApprovalBatchResultCsv(result)}
      onDismiss={onDismiss}
    />
  );
}
