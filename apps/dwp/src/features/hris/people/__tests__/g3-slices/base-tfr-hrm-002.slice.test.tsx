// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EmployeeChangeWorkspaceView,
  HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE,
} from '../../../employee-services/employee-change/pages/hris-employee-change-workspace';
import { parseEmployeeChangeProjection } from '../../../employee-services/employee-change/model/employee-change-contract';
import {
  employeeChangeProjection,
  employeeChangeReceipt,
} from '../../../employee-services/employee-change/testing/employee-change-fixtures.test-support';
import { HRIS_COMMAND_RECEIPT_API_CONTRACT } from '../../command-receipts/api/command-receipt-api';
import { DEFAULT_COMMAND_RECEIPT_RECOVERY_POLICY } from '../../command-receipts/hooks/use-command-receipt-recovery';

import type { EmployeeChangeWorkspaceViewProps } from '../../../employee-services/employee-change/pages/hris-employee-change-workspace';
import type { HrisCommandReceipt } from '../../command-receipts/model/command-receipt';

const projection = parseEmployeeChangeProjection(employeeChangeProjection());

function viewProps(
  overrides: Partial<EmployeeChangeWorkspaceViewProps> = {}
): EmployeeChangeWorkspaceViewProps {
  return {
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
    ...overrides,
  };
}

describe('BASE-TFR-HRM-002 frontend acceptance slice', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function render(props: EmployeeChangeWorkspaceViewProps) {
    await act(async () => root.render(<EmployeeChangeWorkspaceView {...props} />));
  }

  it('keeps the feature default OFF and pins a bounded GET-only PEP-HRM-014 client', () => {
    expect(HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE).toBe('OFF');
    expect(HRIS_COMMAND_RECEIPT_API_CONTRACT).toEqual({
      bindingId: 'PEP-HRM-014',
      method: 'GET',
      path: '/api/people/v1/hris/command-receipts/{receiptId}',
    });
    expect(DEFAULT_COMMAND_RECEIPT_RECOVERY_POLICY).toEqual({
      maximumAttempts: 5,
      backoffMs: [0, 750, 1_500, 3_000, 5_000],
    });
  });

  it('moves focus to terminal live status and exposes only the fixed authorized route', async () => {
    await render(viewProps());
    const succeeded = { ...employeeChangeReceipt(), status: 'SUCCEEDED' } as HrisCommandReceipt;
    await render(
      viewProps({
        receipt: succeeded,
        receiptRecoveryPhase: 'SETTLED',
      })
    );

    const status = host.querySelector('[data-testid="employee-change-receipt-status"]');
    expect(document.activeElement).toBe(status);
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      '/hr/operations/people/employee-change-requests'
    );
  });

  it('clears stale receipt details and links for opaque denial', async () => {
    await render(
      viewProps({
        receipt: null,
        receiptRecoveryPhase: 'DENIED',
        receiptRecoveryAttempt: 1,
      })
    );

    const alert = host.querySelector('[data-testid="employee-change-receipt-status"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.getAttribute('aria-live')).toBe('assertive');
    expect(host.textContent).toContain('No cached result is shown');
    expect(host.textContent).not.toContain(employeeChangeReceipt().receiptId);
    expect(host.querySelector('a')).toBeNull();
  });

  it('offers keyboard-operable recovery only after the bounded checks finish', async () => {
    const recover = vi.fn();
    await render(
      viewProps({
        receipt: { ...employeeChangeReceipt(), status: 'RESULT_UNKNOWN' } as HrisCommandReceipt,
        receiptRecoveryPhase: 'RECOVERY_REQUIRED',
        receiptRecoveryAttempt: 5,
        receiptRecoveryCanRecover: true,
        commandLockedByReceipt: true,
        onRecoverReceipt: recover,
      })
    );

    const button = [...host.querySelectorAll('button')].find(
      (candidate) => candidate.textContent?.trim() === 'Recover receipt'
    )!;
    button.focus();
    await act(async () => button.click());

    expect(document.activeElement).toBe(button);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('The outcome is not terminal after 5 bounded checks');
    expect(
      [...host.querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.trim() === 'Submit for approval'
      )?.disabled
    ).toBe(true);
  });
});
