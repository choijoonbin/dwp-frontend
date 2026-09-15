import { approvalBatchOutcome } from './approval-command-center-model';

import type { ApprovalBatchResult } from './approval-command-center-model';

const UTF8_BOM = '\uFEFF';

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildApprovalBatchResultCsv(result: ApprovalBatchResult): string {
  const rows = result.requestedTaskIds.map((taskId) => {
    const outcome = approvalBatchOutcome(result, taskId);
    const cause =
      outcome === 'APPROVED'
        ? 'COMPLETED'
        : outcome === 'INELIGIBLE'
          ? 'LATEST_AUTHORITY_OR_STATE'
          : outcome === 'FAILED'
            ? (result.failure?.reason ?? 'UNKNOWN')
            : 'EARLIER_FAILURE';
    const retryable =
      outcome === 'FAILED' || outcome === 'NOT_ATTEMPTED'
        ? String(Boolean(result.failure?.retryable))
        : 'false';
    return [taskId, outcome, cause, retryable].map(csvCell).join(',');
  });
  return `${UTF8_BOM}${['task_id', 'outcome', 'cause', 'retryable'].map(csvCell).join(',')}\r\n${rows.join('\r\n')}\r\n`;
}

export function downloadApprovalBatchResultCsv(result: ApprovalBatchResult): void {
  const url = URL.createObjectURL(
    new Blob([buildApprovalBatchResultCsv(result)], { type: 'text/csv;charset=utf-8' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'approval-batch-result.csv';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
