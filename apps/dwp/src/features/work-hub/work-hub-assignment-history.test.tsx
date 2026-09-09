// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  WorkAssignmentEvent,
  WorkAssignmentTask,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { WorkHubAssignmentHistory } from './work-hub-assignment-history';

const mocks = vi.hoisted(() => ({ history: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      [key, ...Object.values(values ?? {})].join(':'),
  }),
}));
vi.mock('./use-work-hub-assignment-history', () => ({
  useWorkHubAssignmentHistory: mocks.history,
}));

const assignmentId = '11111111-2222-4333-8444-555555555555';
const eventId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const auditRecordId = 'audit-record-secret';
const privateReasonCode = 'TENANT_PRIVATE_REASON';

const task = {
  assignmentId,
  version: 0,
} as WorkAssignmentTask;

function event(overrides: Partial<WorkAssignmentEvent> = {}): WorkAssignmentEvent {
  return {
    eventId,
    assignmentId,
    action: 'CREATE',
    actorUserId: 987654,
    assigneeUserId: 123456,
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 0,
    version: 0,
    reasonCode: privateReasonCode,
    occurredAt: '2026-09-08T01:00:00Z',
    auditRecordId,
    ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;

describe('WorkHubAssignmentHistory', () => {
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

  it('renders safe role labels and masks event, audit, actor, assignee, and policy identifiers', async () => {
    mocks.history.mockReturnValue({
      isPending: false,
      isError: false,
      data: [event()],
      error: null,
      refetch: vi.fn(),
    });
    await act(async () => {
      root.render(
        <WorkHubAssignmentHistory
          task={task}
          actorId={11}
          onAccessDenied={vi.fn()}
          onTaskChanged={vi.fn()}
        />
      );
    });

    expect(host.textContent).toContain('workHub.assignment.otherMember');
    expect(host.textContent).toContain('workHub.assignment.history.policyReason');
    for (const secret of [
      assignmentId,
      eventId,
      auditRecordId,
      privateReasonCode,
      '987654',
      '123456',
    ]) {
      expect(host.textContent).not.toContain(secret);
      expect(host.innerHTML).not.toContain(secret);
    }
  });
});
