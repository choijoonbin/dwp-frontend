// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAuthorizedEmployeeChangeResultLocation } from '../api/command-receipt-api';
import { useCommandReceiptRecovery } from '../hooks/use-command-receipt-recovery';

import type {
  HrisCommandReceiptReader,
  HrisCommandReceiptReadResult,
} from '../api/command-receipt-api';
import type { HrisCommandReceipt } from '../model/command-receipt';

const RECEIPT_ID = '10000000-0000-4000-8000-000000000001';
const RESULT_LOCATION =
  '/hr/operations/people/employee-change-requests?requestPublicId=123e4567-e89b-42d3-a456-426614174000';

function receipt(status: HrisCommandReceipt['status']): HrisCommandReceipt {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'EMPLOYEE_CHANGE_APPLY',
    originatingAction: 'APPLY_EMPLOYEE_CHANGE_REQUEST',
    subjectPrincipalPublicId: '10000000-0000-4000-8000-000000000002',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 11,
    purposeCode: 'HR_LIFECYCLE',
    authorizationRevision: 43,
    status,
    correlationId: '10000000-0000-4000-8000-000000000003',
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-15T01:00:00Z',
  };
}

function result(
  status: HrisCommandReceipt['status'],
  withLocation = false
): HrisCommandReceiptReadResult {
  const nextReceipt = receipt(status);
  return {
    receipt: nextReceipt,
    resultLocation: withLocation
      ? parseAuthorizedEmployeeChangeResultLocation(RESULT_LOCATION, nextReceipt)
      : null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness({
  seed,
  scopeIdentity,
  reader,
  maximumAttempts = 3,
}: Readonly<{
  seed: HrisCommandReceipt | null;
  scopeIdentity: string;
  reader: HrisCommandReceiptReader;
  maximumAttempts?: number;
}>) {
  const recovery = useCommandReceiptRecovery({
    enabled: true,
    seedReceipt: seed,
    scopeIdentity,
    contextScopeKey: `opaque:${scopeIdentity}`,
    reader,
    policy: { maximumAttempts, backoffMs: [0, 10, 20] },
  });
  return (
    <div>
      <output data-testid="state">
        {recovery.phase}|{recovery.receipt?.status ?? 'none'}|{recovery.attempt}|
        {recovery.resultLocation ?? 'none'}
      </output>
      <button type="button" disabled={!recovery.canRecover} onClick={recovery.recover}>
        Recover
      </button>
    </div>
  );
}

describe('useCommandReceiptRecovery', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  async function render(
    seed: HrisCommandReceipt | null,
    scopeIdentity: string,
    reader: HrisCommandReceiptReader,
    maximumAttempts?: number
  ) {
    await act(async () => {
      root.render(
        <Harness
          seed={seed}
          scopeIdentity={scopeIdentity}
          reader={reader}
          maximumAttempts={maximumAttempts}
        />
      );
    });
  }

  it('polls ACCEPTED and RUNNING with bounded backoff until a terminal receipt', async () => {
    const reader = vi
      .fn<HrisCommandReceiptReader>()
      .mockResolvedValueOnce(result('RUNNING'))
      .mockResolvedValueOnce(result('SUCCEEDED', true));
    await render(receipt('ACCEPTED'), 'scope-a', reader);

    await act(async () => vi.runAllTimersAsync());

    expect(host.querySelector('output')?.textContent).toBe(
      `SETTLED|SUCCEEDED|2|${RESULT_LOCATION}`
    );
    expect(reader).toHaveBeenCalledTimes(2);
    expect(reader.mock.calls.every((call) => call[1] === 'opaque:scope-a')).toBe(true);
    expect(reader.mock.calls.every((call) => call[2] instanceof AbortSignal)).toBe(true);
  });

  it('re-reads a terminal command seed before exposing the authorized result Location', async () => {
    const reader = vi.fn<HrisCommandReceiptReader>().mockResolvedValue(result('SUCCEEDED', true));
    await render(receipt('SUCCEEDED'), 'scope-a', reader);

    expect(host.querySelector('output')?.textContent).toBe('LOADING|SUCCEEDED|0|none');
    await act(async () => vi.runAllTimersAsync());

    expect(reader).toHaveBeenCalledTimes(1);
    expect(host.querySelector('output')?.textContent).toBe(
      `SETTLED|SUCCEEDED|1|${RESULT_LOCATION}`
    );
  });

  it('bounds RESULT_UNKNOWN recovery and starts a new cycle only from the keyboard button', async () => {
    const reader = vi.fn<HrisCommandReceiptReader>().mockResolvedValue(result('RESULT_UNKNOWN'));
    await render(receipt('RESULT_UNKNOWN'), 'scope-a', reader, 2);
    await act(async () => vi.runAllTimersAsync());

    expect(host.querySelector('output')?.textContent).toBe(
      'RECOVERY_REQUIRED|RESULT_UNKNOWN|2|none'
    );
    expect(reader).toHaveBeenCalledTimes(2);

    reader.mockReset().mockResolvedValue(result('SUCCEEDED', true));
    const button = host.querySelector('button')!;
    button.focus();
    await act(async () => button.click());
    await act(async () => vi.runAllTimersAsync());

    expect(document.activeElement).toBe(button);
    expect(host.querySelector('output')?.textContent).toBe(
      `SETTLED|SUCCEEDED|1|${RESULT_LOCATION}`
    );
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it('turns an opaque denial into a protected-data-free terminal view', async () => {
    const reader = vi
      .fn<HrisCommandReceiptReader>()
      .mockRejectedValue(new HttpError('opaque absence', 404));
    await render(receipt('RUNNING'), 'scope-a', reader);
    await act(async () => vi.runAllTimersAsync());

    expect(host.querySelector('output')?.textContent).toBe('DENIED|none|1|none');
    expect(host.textContent).not.toContain(RECEIPT_ID);
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight request and suppresses its late result after a scope change', async () => {
    const pending = deferred<HrisCommandReceiptReadResult>();
    const reader = vi.fn<HrisCommandReceiptReader>().mockReturnValue(pending.promise);
    await render(receipt('RUNNING'), 'scope-a', reader);
    await act(async () => vi.runOnlyPendingTimersAsync());
    const signal = reader.mock.calls[0]![2]!;

    await render(null, 'scope-b', reader);
    expect(signal.aborted).toBe(true);
    expect(host.querySelector('output')?.textContent).toBe('IDLE|none|0|none');

    pending.resolve(result('SUCCEEDED', true));
    await act(async () => Promise.resolve());
    expect(host.querySelector('output')?.textContent).toBe('IDLE|none|0|none');
  });

  it('aborts the active receipt read on unmount', async () => {
    const pending = deferred<HrisCommandReceiptReadResult>();
    const reader = vi.fn<HrisCommandReceiptReader>().mockReturnValue(pending.promise);
    await render(receipt('RUNNING'), 'scope-a', reader);
    await act(async () => vi.runOnlyPendingTimersAsync());
    const signal = reader.mock.calls[0]![2]!;

    await act(async () => root.unmount());

    expect(signal.aborted).toBe(true);
    root = createRoot(host);
  });
});
