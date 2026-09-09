// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkAssignmentTask } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { WorkHubAssignmentDetail } from './work-hub-assignment-detail';
import { workAssignmentToHub } from './work-hub-assignment-model';

const mocks = vi.hoisted(() => ({ detail: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: { userId: '11' }, isAuthenticated: true }),
}));
vi.mock('./use-work-hub-assignment-detail', () => ({
  useWorkHubAssignmentDetail: mocks.detail,
}));
vi.mock('./work-hub-assignment-history', () => ({
  WorkHubAssignmentHistory: () => null,
}));

const assignmentId = '11111111-2222-4333-8444-555555555555';
const sourceReference = 'source-reference-secret';
const sourceRoute = '/meetings/history?meeting=source-reference-secret';

function task(overrides: Partial<WorkAssignmentTask> = {}): WorkAssignmentTask {
  return {
    assignmentId,
    createdByUserId: 7,
    assignedByUserId: 7,
    assigneeUserId: 11,
    title: 'Prepare the reviewed follow-up',
    description: 'Confirmed assignment terms',
    priority: 'NORMAL',
    dueAt: null,
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 0,
    version: 0,
    source: {
      availability: 'UNAVAILABLE',
      reference: null,
      sourceVersion: null,
      sourceRoute: null,
    },
    capabilities: {
      canAccept: true,
      canDecline: true,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: false,
    },
    createdAt: '2026-09-08T01:00:00Z',
    updatedAt: '2026-09-08T01:00:00Z',
    acceptedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function state(current: WorkAssignmentTask, overrides: Record<string, unknown> = {}) {
  return {
    query: {
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    task: current,
    busy: false,
    conflict: false,
    uncertain: false,
    outcome: null,
    execute: vi.fn(),
    reviewConflict: vi.fn(),
    recover: vi.fn(),
    retry: vi.fn(),
    canRecover: false,
    canRetry: false,
    ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;

async function render(current: WorkAssignmentTask, overrides: Record<string, unknown> = {}) {
  mocks.detail.mockReturnValue(state(current, overrides));
  await act(async () => {
    root.render(
      <WorkHubAssignmentDetail
        item={workAssignmentToHub(current, 11)}
        commandsEnabled
        onAccessDenied={vi.fn()}
        onChanged={vi.fn()}
        onOpenSource={vi.fn(() => true)}
      />
    );
  });
}

describe('WorkHubAssignmentDetail', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it('shows both state axes and retains Work-owned commands when source is unavailable', async () => {
    await render(task());

    expect(host.textContent).toContain('work:workHub.assignment.assignmentStates.PENDING');
    expect(host.textContent).toContain('work:workHub.assignment.workStates.OPEN');
    expect(host.textContent).toContain('work:workHub.assignment.assignmentState');
    expect(host.textContent).toContain('work:workHub.assignment.workState');
    expect(host.textContent).toContain('work:workHub.assignment.actions.accept');
    expect(host.textContent).toContain('work:workHub.assignment.actions.decline');
    expect(host.textContent).toContain('work:workHub.assignment.sourceStates.UNAVAILABLE');
    expect(host.textContent).not.toContain('work:workHub.assignment.openSource');
  });

  it('keeps receipt recovery visible through a detail query error', async () => {
    const recover = vi.fn();
    await render(task(), {
      query: {
        isPending: false,
        isError: true,
        isFetching: false,
        refetch: vi.fn(),
      },
      uncertain: true,
      recover,
      canRecover: true,
    });

    expect(host.textContent).toContain('work:workHub.assignment.result.uncertainTitle');
    const button = [...host.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes('work:workHub.assignment.result.checkResult')
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it('does not expose assignment or Meeting source identifiers in text or DOM metadata', async () => {
    const available = task({
      source: {
        availability: 'AVAILABLE',
        reference: {
          sourceSystem: 'MEETING_FOLLOWUP',
          meetingId: sourceReference,
          reportId: 'report-secret',
          candidateId: 'candidate-secret',
        },
        sourceVersion: 3,
        sourceRoute,
      },
    });
    await render(available);

    for (const secret of [
      assignmentId,
      sourceReference,
      'report-secret',
      'candidate-secret',
      sourceRoute,
    ]) {
      expect(host.textContent).not.toContain(secret);
      expect(host.innerHTML).not.toContain(secret);
    }
  });
});
