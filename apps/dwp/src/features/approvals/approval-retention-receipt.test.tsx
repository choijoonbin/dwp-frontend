// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareApprovalRetentionReceiptOriginal } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import { ApprovalRetentionReceipt } from './approval-retention-receipt';

import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';

const deps = vi.hoisted(() => ({
  available: true,
  pending: false,
  current: true,
  receipt: undefined as ApprovalRetentionReceiptMetadata | undefined,
  error: undefined as Error | undefined,
  read: vi.fn(async () => undefined),
}));

vi.mock('./use-approval-retention-receipt', () => ({
  useApprovalRetentionReceipt: () => ({
    available: deps.available,
    pending: deps.pending,
    receipt: deps.receipt,
    error: deps.error,
    isCurrent: () => deps.current,
    read: deps.read,
  }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button type="button" disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
  InlineFeedback: ({
    children,
    action,
  }: {
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div role="status">
      {children}
      {action}
    </div>
  ),
}));

describe('retention receipt recovery UI owns no mutation retry', () => {
  let root: Root;
  let container: HTMLDivElement;
  let sourceCurrent: boolean;
  let confirmed: ReturnType<
    typeof vi.fn<
      (
        candidate: ApprovalRetentionReceiptOriginal,
        receipt: ApprovalRetentionReceiptMetadata
      ) => void
    >
  >;
  let original: Awaited<ReturnType<typeof prepareApprovalRetentionReceiptOriginal>>;

  beforeEach(async () => {
    vi.stubGlobal('crypto', webcrypto);
    deps.available = true;
    deps.pending = false;
    deps.current = true;
    deps.receipt = undefined;
    deps.error = undefined;
    deps.read.mockClear();
    sourceCurrent = true;
    confirmed = vi.fn();
    original = await prepareApprovalRetentionReceiptOriginal(
      {
        operation: 'INITIALIZE_POLICY',
        originalTargetId: null,
        body: { expectedAbsent: true, idempotencyKey: 'initialize:original' },
      },
      99,
      'RS_APPROVAL_FINANCE'
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = () =>
    act(() =>
      root.render(
        <ApprovalRetentionReceipt
          original={original}
          sourceIsCurrent={() => sourceCurrent}
          isOriginal={(candidate) => candidate === original}
          onConfirmed={confirmed}
        />
      )
    );
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);

  it('offers only the receipt GET while UNKNOWN', async () => {
    render();
    expect(container.textContent).toContain('admin.retention.receiptOriginalPreserved');
    await act(async () => button('admin.retention.receiptLookup')!.click());
    expect(deps.read).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('clears only after an explicit current COMMITTED receipt acceptance', async () => {
    deps.receipt = {
      status: 'COMMITTED',
      resultReferenceId: '11111111-1111-4111-8111-111111111111',
    } as ApprovalRetentionReceiptMetadata;
    render();
    await act(async () => button('admin.retention.receiptAccept')!.click());
    expect(confirmed).toHaveBeenCalledWith(original, deps.receipt);
    confirmed.mockClear();
    sourceCurrent = false;
    render();
    await act(async () => button('admin.retention.receiptAccept')!.click());
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('keeps UNKNOWN without an acceptance action when the receipt read is inconclusive', () => {
    deps.error = new Error('503');
    render();
    expect(container.textContent).toContain('admin.retention.receiptReadError');
    expect(button('admin.retention.receiptAccept')).toBeUndefined();
    expect(confirmed).not.toHaveBeenCalled();
  });
});
