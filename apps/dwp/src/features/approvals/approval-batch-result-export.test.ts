import { describe, expect, it, vi } from 'vitest';

import {
  buildApprovalBatchResultCsv,
  downloadApprovalBatchResultCsv,
} from './approval-batch-result-export';

import type { ApprovalBatchResult } from './approval-command-center-model';

const result: ApprovalBatchResult = {
  requestedTaskIds: ['task-1', 'task-2', 'task-3', 'task-4'],
  approvedTaskIds: ['task-1'],
  ineligibleTaskIds: ['task-2'],
  failedTaskId: 'task-3',
  failure: {
    taskId: 'task-3',
    phase: 'DECISION',
    reason: 'VERSION_CONFLICT',
    retryable: true,
  },
  remainingTaskIds: ['task-4'],
};

describe('approval batch result export', () => {
  it('exports only non-personal result evidence as UTF-8 CSV', () => {
    expect(buildApprovalBatchResultCsv(result)).toBe(
      '\uFEFF"task_id","outcome","cause","retryable"\r\n' +
        '"task-1","APPROVED","COMPLETED","false"\r\n' +
        '"task-2","INELIGIBLE","LATEST_AUTHORITY_OR_STATE","false"\r\n' +
        '"task-3","FAILED","VERSION_CONFLICT","true"\r\n' +
        '"task-4","NOT_ATTEMPTED","EARLIER_FAILURE","true"\r\n'
    );
  });

  it('downloads the controlled CSV blob and releases its object URL', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:approval-batch-result');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const anchor = { click, download: '', href: '' };
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    vi.stubGlobal('window', { setTimeout });

    downloadApprovalBatchResultCsv(result);
    expect(click).toHaveBeenCalledOnce();
    expect(anchor).toMatchObject({
      href: 'blob:approval-batch-result',
      download: 'approval-batch-result.csv',
    });
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(buildApprovalBatchResultCsv(result).slice(1));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:approval-batch-result');

    vi.unstubAllGlobals();
  });
});
