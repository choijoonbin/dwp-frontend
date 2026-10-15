import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  EmployeeChangeWorkspaceView,
  HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE,
  HrisEmployeeChangeWorkspace,
} from '../pages/hris-employee-change-workspace';
import { parseEmployeeChangeProjection } from '../model/employee-change-contract';
import {
  employeeChangeProjection,
  employeeChangeReceipt,
} from './employee-change-fixtures.test-support';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('HrisEmployeeChangeWorkspace', () => {
  it('exposes a dedicated default-off boundary without owner queries or commands', () => {
    const html = renderToStaticMarkup(createElement(HrisEmployeeChangeWorkspace));

    expect(HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE).toBe('OFF');
    expect(html).toContain('data-testid="hris-employee-change-workspace"');
    expect(html).toContain('data-runtime-state="OFF"');
    expect(html).toContain('data-surface-family="employee-change"');
    expect(html).toContain('Employee-change lifecycle is unavailable');
    expect(html).toContain('Feature state: OFF');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
  });

  it('mounts the governed route without reusing People 360 or assignment proposals', () => {
    const hcmPage = readFileSync(new URL('../../../../../pages/hcm.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(
      new URL('../pages/hris-employee-change-workspace.tsx', import.meta.url),
      'utf8'
    );

    expect(hcmPage).toContain("import('../features/hris/employee-services/employee-change')");
    expect(hcmPage).toContain("'employee-change-requests': <HrisEmployeeChangeWorkspace />");
    expect(hcmPage).toContain('people: <HrisPeople360Workspace />');
    expect(hcmPage).toContain(
      'assignments: <AssignmentRegister assignmentProposal={assignmentProposalPort} />'
    );
    expect(workspace).not.toContain('features/hris/people');
    expect(workspace).not.toContain('AssignmentProposal');
    expect(workspace).toContain('useEmployeeChangeWorkspace');
    expect(workspace).toContain('data-runtime-state="OFF"');
  });

  it('renders the enabled projection and only the lifecycle actions granted by IAQ-009', () => {
    const projection = parseEmployeeChangeProjection(employeeChangeProjection());
    const html = renderToStaticMarkup(
      createElement(EmployeeChangeWorkspaceView, {
        copy: {
          title: 'Employee-change requests',
          description: 'Governed employee changes',
          unavailableTitle: 'Unavailable',
          unavailableDescription: 'Unavailable',
        },
        projection,
        selectedItem: projection.items[0]!,
        receipt: null,
        receiptRecoveryPhase: 'IDLE',
        receiptRecoveryAttempt: 0,
        receiptRecoveryMaximumAttempts: 5,
        receiptRecoveryCanRecover: false,
        loading: false,
        fetching: false,
        error: null,
        commandError: null,
        commandBusy: false,
        commandLockedByReceipt: false,
        pageIndex: 0,
        canNext: false,
        canPrevious: false,
        canCreate: true,
        applyConnected: false,
        onSelect: vi.fn(),
        onRefresh: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(null),
        onSubmit: vi.fn().mockResolvedValue(null),
        onApply: vi.fn().mockResolvedValue(null),
        onRecoverReceipt: vi.fn(),
      })
    );

    expect(html).toContain('data-runtime-state="ON"');
    expect(html).toContain('Kim Minsoo · PROFILE_UPDATE');
    expect(html).toContain('Submit for approval');
    expect(html).not.toContain('Apply approved change');
  });

  it('does not expose New request without exact create action truth', () => {
    const projection = parseEmployeeChangeProjection(employeeChangeProjection());
    const html = renderToStaticMarkup(
      createElement(EmployeeChangeWorkspaceView, {
        copy: {
          title: 'Employee-change requests',
          description: 'Governed employee changes',
          unavailableTitle: 'Unavailable',
          unavailableDescription: 'Unavailable',
        },
        projection,
        selectedItem: projection.items[0]!,
        receipt: null,
        receiptRecoveryPhase: 'IDLE',
        receiptRecoveryAttempt: 0,
        receiptRecoveryMaximumAttempts: 5,
        receiptRecoveryCanRecover: false,
        loading: false,
        fetching: false,
        error: null,
        commandError: null,
        commandBusy: false,
        commandLockedByReceipt: false,
        pageIndex: 0,
        canNext: false,
        canPrevious: false,
        canCreate: false,
        applyConnected: false,
        onSelect: vi.fn(),
        onRefresh: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(null),
        onSubmit: vi.fn().mockResolvedValue(null),
        onApply: vi.fn().mockResolvedValue(null),
        onRecoverReceipt: vi.fn(),
      })
    );

    expect(html).not.toContain('New request');
  });

  it.each([
    ['ACCEPTED', 'Command accepted'],
    ['RUNNING', 'Command is running'],
    ['SUCCEEDED', 'Command completed'],
    ['REJECTED', 'Command rejected'],
    ['FAILED', 'Command failed'],
    ['RESULT_UNKNOWN', 'Command result is unknown'],
  ] as const)('renders the %s receipt state with an accessible status', (status, title) => {
    const projection = parseEmployeeChangeProjection(employeeChangeProjection());
    const receipt = { ...employeeChangeReceipt(), status };
    const html = renderToStaticMarkup(
      createElement(EmployeeChangeWorkspaceView, {
        copy: {
          title: 'Employee-change requests',
          description: 'Governed employee changes',
          unavailableTitle: 'Unavailable',
          unavailableDescription: 'Unavailable',
        },
        projection,
        selectedItem: projection.items[0]!,
        receipt,
        receiptRecoveryPhase: ['SUCCEEDED', 'REJECTED', 'FAILED'].includes(status)
          ? 'SETTLED'
          : 'POLLING',
        receiptRecoveryAttempt: 1,
        receiptRecoveryMaximumAttempts: 5,
        receiptRecoveryCanRecover: false,
        loading: false,
        fetching: false,
        error: null,
        commandError: null,
        commandBusy: false,
        commandLockedByReceipt: false,
        pageIndex: 0,
        canNext: false,
        canPrevious: false,
        canCreate: false,
        applyConnected: false,
        onSelect: vi.fn(),
        onRefresh: vi.fn(),
        onNext: vi.fn(),
        onPrevious: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(null),
        onSubmit: vi.fn().mockResolvedValue(null),
        onApply: vi.fn().mockResolvedValue(null),
        onRecoverReceipt: vi.fn(),
      })
    );

    expect(html).toContain(title);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('tabindex="-1"');
    expect(html.includes('href="/hr/operations/people/employee-change-requests"')).toBe(
      status === 'SUCCEEDED'
    );
  });
});
