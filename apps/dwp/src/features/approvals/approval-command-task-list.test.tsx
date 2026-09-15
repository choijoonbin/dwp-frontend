// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalCommandTaskList } from './approval-command-task-list';

import type { ApprovalTask } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'home.commandCenter.taskList') return 'Pending approvals';
      if (key === 'home.commandCenter.assignment.CLAIMED') return 'Claimed';
      if (key === 'home.commandCenter.assignment.REASSIGNED') return 'Delegated';
      if (key === 'inbox.stageProgress') return `${options?.current} · ${options?.name}`;
      if (key === 'home.commandCenter.selectForBatch') return `Select ${options?.title}`;
      return key;
    },
  }),
}));
vi.mock('./approval-ui', () => ({
  PriorityChip: ({ priority }: { priority: string }) => <span>{priority}</span>,
  StatusChip: ({ status }: { status: string }) => <span>{status}</span>,
}));

function task(taskId: string, status: ApprovalTask['status']): ApprovalTask {
  return {
    taskId,
    requestId: `request-${taskId}`,
    requestNumber: `APR-${taskId}`,
    title: `Request ${taskId}`,
    summary: '',
    workflowNameKo: '결재',
    workflowNameEn: 'Approval',
    stepKey: 'REVIEW',
    stepName: 'Review',
    stepSequence: 1,
    requesterName: 'Kim',
    requesterOrgName: 'Platform',
    status,
    priority: 'HIGH',
    dataClassification: 'INTERNAL',
    riskScore: 72,
    version: 1,
  };
}

let container: HTMLDivElement;
let root: Root;

describe('approval command task list', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('exposes selected row semantics and confirmed assignment states', async () => {
    await act(async () =>
      root.render(
        <ApprovalCommandTaskList
          tasks={[task('claimed', 'CLAIMED'), task('delegated', 'REASSIGNED')]}
          selectedTaskId="claimed"
          selectedBatchIds={[]}
          emptyQueue={false}
          search=""
          busy={false}
          selectionMode
          onSearchChange={vi.fn()}
          onSelect={vi.fn()}
          onToggleBatch={vi.fn()}
          totalElements={2}
          page={0}
          totalPages={1}
          sort="PRIORITY"
          status=""
          onPageChange={vi.fn()}
          onSortChange={vi.fn()}
          onStatusChange={vi.fn()}
        />
      )
    );

    const rows = [...container.querySelectorAll('[role="row"]')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
    expect(rows[1]?.getAttribute('aria-selected')).toBe('false');
    expect(rows[0]?.textContent).toContain('Claimed');
    expect(rows[1]?.textContent).toContain('Delegated');
    expect(container.querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe(
      'Pending approvals'
    );
  });
});
