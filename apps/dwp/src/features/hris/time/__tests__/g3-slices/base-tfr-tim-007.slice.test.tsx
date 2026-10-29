// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import enHcm from '../../../../../../../../libs/shared-i18n/src/locales/en/hcm.json';

import {
  TimeCloseCommandOutcomeUnknownError,
  TimeCloseWorkspaceRuntime,
  parsePayrollTimeHandoffStatus,
  parseTimeCloseCommandReceipt,
  parseTimeCloseProjection,
} from '../../close';

import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import type { PayrollTimeHandoffStatus, TimeCloseDataSource } from '../../close';

import {
  PERIOD_ID,
  RECEIPT_ID,
  APPROVAL_ID,
  RESULT_ID,
  HANDOFF_ID,
  IDEMPOTENCY_KEY,
  scope,
  action,
  projection,
  receipt,
  handoff,
  ownerBinding,
  dataSource,
  buttonByText,
  buttonContainingText,
  inputByLabel,
  setInputValue,
  flush,
} from './base-tfr-tim-007.test-support';

describe('[SLICE:BASE-TFR-TIM-007] canonical time close and payroll handoff', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'hcm',
      ns: ['hcm'],
      resources: { en: { hcm: enHcm } },
      interpolation: { escapeValue: false },
    });
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('keeps default-OFF and unenrolled tenants at zero owner calls and renders no runtime', async () => {
    const source = dataSource();
    for (const props of [
      { enabled: false, tenantEnrolled: true },
      { enabled: true, tenantEnrolled: false },
      { enabled: undefined, tenantEnrolled: undefined },
    ]) {
      await act(async () => {
        root.render(
          createElement(TimeCloseWorkspaceRuntime, {
            ...props,
            entryMode: 'DAILY_CLOSE',
            scope,
            ownerBinding: ownerBinding(),
            dataSource: source,
          })
        );
        await flush();
      });
      expect(host.innerHTML).toBe('');
    }
    expect(source.readProjection).not.toHaveBeenCalled();
    expect(source.validate).not.toHaveBeenCalled();
    expect(source.close).not.toHaveBeenCalled();
    expect(source.readHandoff).not.toHaveBeenCalled();
  });

  it('hides non-authorized actions and disables every command on a stale owner projection', async () => {
    const stale = structuredClone(projection('DAILY_CLOSE'));
    stale.queryState.freshness = 'STALE';
    stale.items[0]!.availableActions = [action.VALIDATE];
    const source = dataSource({
      readProjection: vi.fn(async () => parseTimeCloseProjection(stale, 'DAILY_CLOSE')),
    });
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    expect(buttonByText(host, 'Validate').disabled).toBe(true);
    expect(
      [...host.querySelectorAll('button')].some((button) => button.textContent === 'Close period')
    ).toBe(false);
    expect(
      [...host.querySelectorAll('button')].some((button) => button.textContent === 'Reopen')
    ).toBe(false);
  });

  it('guards concurrent load-more dispatch before React commits the busy state', async () => {
    const firstPage = structuredClone(projection('DAILY_CLOSE'));
    firstPage.queryState.nextCursor = 'A'.repeat(16);
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(firstPage, 'DAILY_CLOSE'))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const source = dataSource({ readProjection });
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
        })
      );
      await flush();
    });
    act(() => {
      const loadMore = buttonByText(host, 'Load more periods');
      loadMore.click();
      loadMore.click();
    });
    expect(readProjection).toHaveBeenCalledTimes(2);
  });

  it('hides the prior scope synchronously and preserves filter/selection through a partial refresh', async () => {
    let releaseNewScope: (() => void) | undefined;
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE'), 'DAILY_CLOSE'))
      .mockResolvedValueOnce(
        parseTimeCloseProjection(projection('DAILY_CLOSE', 7, 'PARTIAL'), 'DAILY_CLOSE')
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseNewScope = () =>
              resolve(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
          })
      );
    const source = dataSource({ readProjection });
    const binding = ownerBinding();

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: binding,
          dataSource: source,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    const filter = inputByLabel('Filter periods');
    act(() => setInputValue(filter, 'Seoul'));
    act(() => setInputValue(inputByLabel('Handoff ID'), HANDOFF_ID));
    expect(host.textContent).toContain('Aggregate version');

    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(inputByLabel('Filter periods').value).toBe('Seoul');
    expect(host.textContent).toContain('Some close evidence is unavailable');
    expect(host.textContent).toContain('Aggregate version');

    act(() => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope: {
            ...scope,
            contextScopeKey: 'scope.tim-close.legal-entity-8',
            correlationId: '70000000-0000-4000-8000-000000000099',
          },
          ownerBinding: binding,
          dataSource: source,
        })
      );
    });
    expect(host.textContent).not.toContain('Seoul daily period');
    expect(host.textContent).toContain('Loading authorized time close evidence');
    await act(async () => {
      releaseNewScope?.();
      await flush();
    });
    expect(inputByLabel('Filter periods').value).toBe('');
    expect(host.textContent).not.toContain('Aggregate version');
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    expect(inputByLabel('Handoff ID').value).toBe('');
  });

  it('freezes stale CAS after conflict and preserves the dialog draft through failed then successful refresh', async () => {
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE', 7), 'DAILY_CLOSE'))
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
    const close = vi
      .fn<TimeCloseDataSource['close']>()
      .mockRejectedValue(new HttpError('stale aggregate', 412));
    const source = dataSource({ readProjection, close });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => setInputValue(inputByLabel('Filter periods'), 'Seoul'));
    act(() => setInputValue(inputByLabel('Handoff ID'), HANDOFF_ID));
    act(() => buttonByText(host, 'Close period').click());
    const approval = inputByLabel('Approval receipt ID');
    act(() => setInputValue(approval, APPROVAL_ID));
    await act(async () => {
      buttonByText(document, 'Close period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Refresh required before another command');
    expect(buttonByText(document, 'Close period', true).disabled).toBe(true);
    expect(inputByLabel('Approval receipt ID').value).toBe(APPROVAL_ID);

    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(host.textContent).toContain('Latest refresh could not be verified');
    expect(inputByLabel('Approval receipt ID').value).toBe(APPROVAL_ID);
    expect(buttonByText(document, 'Close period', true).disabled).toBe(true);

    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(inputByLabel('Approval receipt ID').value).toBe(APPROVAL_ID);
    expect(buttonByText(document, 'Close period', true).disabled).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('clears protected period, pending command, and dialog draft when command authority is denied', async () => {
    const close = vi
      .fn<TimeCloseDataSource['close']>()
      .mockRejectedValue(new HttpError('opaque denial', 403));
    const source = dataSource({ close });
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Close period').click());
    act(() => setInputValue(inputByLabel('Approval receipt ID'), APPROVAL_ID));
    await act(async () => {
      buttonByText(document, 'Close period', true).click();
      await flush();
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Time close evidence is unavailable');
    expect(host.textContent).not.toContain(PERIOD_ID);
    expect(host.textContent).not.toContain('Seoul daily period');
    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(inputByLabel('Filter periods').value).toBe('');
    expect(host.textContent).not.toContain('Aggregate version');
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    expect(inputByLabel('Handoff ID').value).toBe('');
  });

  it('deduplicates handoff reads and rejects results for an adjacent authorized period', async () => {
    const adjacent: PayrollTimeHandoffStatus = {
      ...parsePayrollTimeHandoffStatus(handoff('ACKNOWLEDGED'), '"2"'),
      closePeriodId: APPROVAL_ID,
    };
    let finish: ((value: PayrollTimeHandoffStatus) => void) | undefined;
    const readHandoff = vi.fn<TimeCloseDataSource['readHandoff']>(
      () =>
        new Promise((resolvePromise) => {
          finish = resolvePromise;
        })
    );
    const source = dataSource({ readHandoff });
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => setInputValue(inputByLabel('Handoff ID'), HANDOFF_ID));
    act(() => {
      const check = buttonByText(host, 'Check status');
      check.click();
      check.click();
    });
    expect(readHandoff).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish?.(adjacent);
      await flush();
    });
    expect(host.textContent).toContain('Handoff status could not be verified');
    expect(host.textContent).not.toContain(`Immutable result${RESULT_ID}`);
  });

  it('reconciles a safely recovered receipt id after an unverifiable 202 outcome', async () => {
    const validate = vi
      .fn<TimeCloseDataSource['validate']>()
      .mockRejectedValue(
        new TimeCloseCommandOutcomeUnknownError(new Error('malformed receipt'), RECEIPT_ID)
      );
    const readReceipt = vi
      .fn<TimeCloseDataSource['readReceipt']>()
      .mockResolvedValue(parseTimeCloseCommandReceipt(receipt('VALIDATE', 'SUCCEEDED')));
    const source = dataSource({ validate, readReceipt });
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Validate').click());
    await act(async () => {
      buttonByText(document, 'Validate period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Owner outcome is not yet proven');
    await act(async () => {
      buttonByText(host, 'Reconcile receipt').click();
      await flush();
    });
    expect(readReceipt).toHaveBeenCalledWith(RECEIPT_ID, scope, expect.any(AbortSignal));
    expect(host.textContent).toContain('Owner receipt: SUCCEEDED');
  });

  it('clears protected evidence when receipt reconciliation returns an opaque 404', async () => {
    const validate = vi
      .fn<TimeCloseDataSource['validate']>()
      .mockResolvedValue(parseTimeCloseCommandReceipt(receipt('VALIDATE', 'RESULT_UNKNOWN')));
    const readReceipt = vi
      .fn<TimeCloseDataSource['readReceipt']>()
      .mockRejectedValue(new HttpError('opaque denial', 404));
    const source = dataSource({ validate, readReceipt });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Validate').click());
    await act(async () => {
      buttonByText(document, 'Validate period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Owner outcome is not yet proven');
    await act(async () => {
      buttonByText(host, 'Reconcile receipt').click();
      await flush();
    });
    expect(readReceipt).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Time close evidence is unavailable');
    expect(host.textContent).not.toContain('Owner outcome is not yet proven');
    expect(host.textContent).not.toContain('Seoul daily period');
  });

  it('replays an unknown outcome with the identical key and reconciles a known receipt', async () => {
    const observedKeys: string[] = [];
    const validate = vi
      .fn<TimeCloseDataSource['validate']>()
      .mockImplementationOnce(async (_snapshot, _request, key) => {
        observedKeys.push(key);
        throw new HttpTransportError('NETWORK');
      })
      .mockImplementationOnce(async (_snapshot, _request, key) => {
        observedKeys.push(key);
        return parseTimeCloseCommandReceipt(receipt('VALIDATE', 'ACCEPTED'));
      });
    const readReceipt = vi
      .fn<TimeCloseDataSource['readReceipt']>()
      .mockResolvedValue(parseTimeCloseCommandReceipt(receipt('VALIDATE', 'SUCCEEDED')));
    const source = dataSource({ validate, readReceipt });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Validate').click());
    await act(async () => {
      buttonByText(document, 'Validate period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Owner outcome is not yet proven');
    await act(async () => {
      buttonByText(host, 'Replay exact command').click();
      await flush();
    });
    expect(observedKeys).toEqual([IDEMPOTENCY_KEY, IDEMPOTENCY_KEY]);
    expect(host.textContent).toContain('Owner receipt: ACCEPTED');
    await act(async () => {
      buttonByText(host, 'Check receipt').click();
      await flush();
    });
    expect(readReceipt).toHaveBeenCalledWith(RECEIPT_ID, scope, expect.any(AbortSignal));
    expect(host.textContent).toContain('Owner receipt: SUCCEEDED');
  });

  it('rejects a mutated durable RESULT_UNKNOWN body during exact command replay', async () => {
    const validate = vi
      .fn<TimeCloseDataSource['validate']>()
      .mockResolvedValueOnce(
        parseTimeCloseCommandReceipt(
          receipt('VALIDATE', 'RESULT_UNKNOWN', {
            aggregateVersion: undefined,
            resultRef: undefined,
          })
        )
      )
      .mockResolvedValueOnce(parseTimeCloseCommandReceipt(receipt('VALIDATE', 'RESULT_UNKNOWN')));
    const source = dataSource({ validate });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Validate').click());
    await act(async () => {
      buttonByText(document, 'Validate period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Owner outcome is not yet proven');
    await act(async () => {
      buttonByText(host, 'Replay exact command').click();
      await flush();
    });
    expect(validate).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('The command was rejected');
  });

  it('clears all protected command state after a same-scope projection denial', async () => {
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE'), 'DAILY_CLOSE'))
      .mockRejectedValueOnce(new HttpError('opaque denial', 403))
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
    const validate = vi
      .fn<TimeCloseDataSource['validate']>()
      .mockResolvedValue(parseTimeCloseCommandReceipt(receipt('VALIDATE', 'RESULT_UNKNOWN')));
    const source = dataSource({ readProjection, validate });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => setInputValue(inputByLabel('Filter periods'), 'Seoul'));
    act(() => setInputValue(inputByLabel('Handoff ID'), HANDOFF_ID));
    act(() => buttonByText(host, 'Validate').click());
    await act(async () => {
      buttonByText(document, 'Validate period', true).click();
      await flush();
    });
    expect(host.textContent).toContain('Owner outcome is not yet proven');

    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('Time close evidence is unavailable');
    expect(host.textContent).not.toContain('Owner outcome is not yet proven');
    expect(host.textContent).not.toContain('Seoul daily period');

    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(inputByLabel('Filter periods').value).toBe('');
    expect(host.textContent).not.toContain('Aggregate version');
    expect(host.textContent).not.toContain('Replay exact command');
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    expect(inputByLabel('Handoff ID').value).toBe('');
  });

  it('prevents an in-flight refresh from restoring data after a handoff denial', async () => {
    let finishRefresh: (() => void) | undefined;
    let denyHandoff: (() => void) | undefined;
    let refreshSignal: AbortSignal | undefined;
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE'), 'DAILY_CLOSE'))
      .mockImplementationOnce(
        (_mode, _scope, _page, signal) =>
          new Promise((resolvePromise) => {
            refreshSignal = signal;
            finishRefresh = () =>
              resolvePromise(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
          })
      );
    const readHandoff = vi.fn<TimeCloseDataSource['readHandoff']>(
      () =>
        new Promise((_resolvePromise, rejectPromise) => {
          denyHandoff = () => rejectPromise(new HttpError('opaque denial', 403));
        })
    );
    const source = dataSource({ readProjection, readHandoff });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => setInputValue(inputByLabel('Handoff ID'), HANDOFF_ID));
    act(() => buttonByText(host, 'Check status').click());
    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    await act(async () => {
      denyHandoff?.();
      await flush();
    });
    expect(refreshSignal?.aborted).toBe(true);
    expect(host.textContent).toContain('Time close evidence is unavailable');
    expect(host.textContent).not.toContain('Seoul daily period');

    await act(async () => {
      finishRefresh?.();
      await flush();
    });
    expect(host.textContent).toContain('Time close evidence is unavailable');
    expect(host.textContent).not.toContain('Seoul daily period');
    expect(
      [...host.querySelectorAll('button')].some((button) => button.textContent === 'Validate')
    ).toBe(false);
  });

  it('blocks an open dialog during refresh and accepts a canonical version-7 UUID afterward', async () => {
    const versionSevenApproval = '70000000-0000-7000-8000-000000000004';
    let finishRefresh: (() => void) | undefined;
    const readProjection = vi
      .fn<TimeCloseDataSource['readProjection']>()
      .mockResolvedValueOnce(parseTimeCloseProjection(projection('DAILY_CLOSE', 7), 'DAILY_CLOSE'))
      .mockImplementationOnce(
        () =>
          new Promise((resolvePromise) => {
            finishRefresh = () =>
              resolvePromise(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
          })
      )
      .mockResolvedValue(parseTimeCloseProjection(projection('DAILY_CLOSE', 8), 'DAILY_CLOSE'));
    const close = vi
      .fn<TimeCloseDataSource['close']>()
      .mockResolvedValue(parseTimeCloseCommandReceipt(receipt('CLOSE', 'SUCCEEDED')));
    const source = dataSource({ readProjection, close });

    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
          idFactory: () => IDEMPOTENCY_KEY,
        })
      );
      await flush();
    });
    act(() => buttonContainingText(host, 'Seoul daily period · 2026-10-17').click());
    act(() => buttonByText(host, 'Close period').click());
    act(() => setInputValue(inputByLabel('Approval receipt ID'), versionSevenApproval));
    await act(async () => {
      buttonByText(host, 'Refresh evidence').click();
      await flush();
    });
    expect(buttonByText(document, 'Close period', true).disabled).toBe(true);
    act(() => buttonByText(document, 'Close period', true).click());
    expect(close).not.toHaveBeenCalled();

    await act(async () => {
      finishRefresh?.();
      await flush();
    });
    expect(inputByLabel('Approval receipt ID').value).toBe(versionSevenApproval);
    expect(buttonByText(document, 'Close period', true).disabled).toBe(false);
    await act(async () => {
      buttonByText(document, 'Close period', true).click();
      await flush();
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.calls[0]?.[1]).toEqual({
      asOf: expect.any(String),
      approvalReceiptId: versionSevenApproval,
    });
  });

  it('provides semantic dialog/focus/live-region and responsive high-contrast/reduced-motion evidence', async () => {
    const source = dataSource();
    await act(async () => {
      root.render(
        createElement(TimeCloseWorkspaceRuntime, {
          enabled: true,
          tenantEnrolled: true,
          entryMode: 'DAILY_CLOSE',
          scope,
          ownerBinding: ownerBinding(),
          dataSource: source,
        })
      );
      await flush();
    });
    expect(host.querySelector('h1')?.textContent).toBe('Daily time close');
    const periodButton = buttonContainingText(host, 'Seoul daily period · 2026-10-17');
    act(() => {
      periodButton.focus();
      periodButton.click();
    });
    const opener = buttonByText(host, 'Reopen');
    act(() => {
      opener.focus();
      opener.click();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(inputByLabel('Approval receipt ID')).toBe(document.activeElement);
    await act(async () => {
      document
        .querySelector('[role="dialog"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    const sourceText = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/time/close/components/time-close-command-center.tsx'
      ),
      'utf8'
    );
    expect(sourceText).toContain('data-responsive-breakpoints="1440 1280 390 320 200-percent"');
    expect(sourceText).toContain('@media (forced-colors: active)');
    expect(sourceText).toContain('@media (prefers-reduced-motion: reduce)');
    expect(sourceText).toContain("xs: 'minmax(0, 1fr)'");
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
