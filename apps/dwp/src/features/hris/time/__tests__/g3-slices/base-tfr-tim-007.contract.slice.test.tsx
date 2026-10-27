// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TIME_CLOSE_API_CONTRACTS,
  TIME_CLOSE_ROUTE_PURPOSES,
  TimeCloseCommandOutcomeUnknownError,
  assertTimeCloseReceiptProgression,
  assertTimeCloseScope,
  createTimeCloseDataSource,
  parsePayrollTimeHandoffStatus,
  parseTimeCloseCommandReceipt,
  parseTimeCloseProjection,
  timeCloseCommandAllowed,
} from '../../close';

import type { TimeCloseHttpClient } from '../../close';

import {
  PERIOD_ID,
  SUBJECT_ID,
  RECEIPT_ID,
  APPROVAL_ID,
  RESULT_ID,
  HANDOFF_ID,
  PAYROLL_ENTITY_ID,
  PAY_PERIOD_ID,
  CORRELATION_ID,
  IDEMPOTENCY_KEY,
  DECISION_REVISION,
  scope,
  projection,
  receipt,
  handoff,
  successHeaders,
  authority,
} from './base-tfr-tim-007.test-support';

describe('[SLICE:BASE-TFR-TIM-007] canonical time close and payroll handoff', () => {
  let host: HTMLDivElement;
  let root: Root;

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

  it('pins the three IA reads, five PEPs, and exact eight-route purpose map', () => {
    expect(TIME_CLOSE_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-039',
        method: 'GET',
        path: '/api/time/v1/hris/workbench/time-command-center',
      },
      {
        bindingId: 'IAQ-043',
        method: 'GET',
        path: '/api/time/v1/hris/workbench/time-daily-close',
      },
      {
        bindingId: 'IAQ-044',
        method: 'GET',
        path: '/api/time/v1/hris/workbench/time-monthly-close',
      },
      {
        bindingId: 'PEP-TIM-022',
        method: 'POST',
        path: '/api/time/v1/close-periods/{periodId}/validations',
      },
      {
        bindingId: 'PEP-TIM-023',
        method: 'POST',
        path: '/api/time/v1/close-periods/{periodId}/close',
      },
      {
        bindingId: 'PEP-TIM-024',
        method: 'POST',
        path: '/api/time/v1/close-periods/{periodId}/reopen',
      },
      {
        bindingId: 'PEP-TIM-025',
        method: 'POST',
        path: '/api/time/v1/close-periods/{periodId}/payroll-handoffs',
      },
      {
        bindingId: 'PEP-TIM-026',
        method: 'GET',
        path: '/api/time/v1/payroll-handoffs/{handoffId}',
      },
    ]);
    expect(TIME_CLOSE_ROUTE_PURPOSES).toEqual({
      'route.hcm.operations.time-command-center.page': 'TIME_OPERATIONS',
      'route.hcm.operations.time-daily-close.page': 'TIME_CLOSE',
      'route.hcm.operations.time-monthly-close.page': 'TIME_CLOSE',
      'route.hcm.operations.time-close-validate.action': 'WORK_TIME_PERIOD_CLOSURE',
      'route.hcm.operations.time-close.action': 'WORK_TIME_PERIOD_CLOSURE',
      'route.hcm.operations.time-reopen.action': 'WORK_TIME_PERIOD_CLOSURE',
      'route.hcm.operations.time-payroll-handoff-create.action': 'CLOSED_TIME_PAYROLL_TRANSFER',
      'route.hcm.operations.time-payroll-handoff.data': 'CLOSED_TIME_PAYROLL_TRANSFER',
    });
  });

  it('strictly parses all four projection states, masks fields, and rejects variant action drift', () => {
    for (const mode of ['COMMAND_CENTER', 'DAILY_CLOSE', 'MONTHLY_CLOSE'] as const) {
      expect(parseTimeCloseProjection(projection(mode), mode)).toMatchObject({
        variant: mode,
        queryState: 'COMPLETE',
        periods: [{ periodId: PERIOD_ID, version: 7 }],
      });
      expect(parseTimeCloseProjection(projection(mode, 7, 'EMPTY'), mode).periods).toEqual([]);
      expect(parseTimeCloseProjection(projection(mode, 7, 'UNAVAILABLE'), mode)).toMatchObject({
        queryState: 'UNAVAILABLE',
        freshness: 'UNAVAILABLE',
      });
    }
    expect(
      parseTimeCloseProjection(projection('DAILY_CLOSE', 7, 'PARTIAL'), 'DAILY_CLOSE')
    ).toMatchObject({ queryState: 'PARTIAL', partialFailures: [{ retryable: true }] });

    const masked = structuredClone(projection('DAILY_CLOSE'));
    masked.items[0]!.fieldGroups.TIME_PERIOD = {
      decision: 'MASK',
      value: null,
      maskReason: 'FIELD_POLICY',
      maskedDisplayKey: 'time.period.masked',
    } as never;
    masked.queryState.fieldDecisionSummary = { viewCount: 2, maskedCount: 1, omittedCount: 0 };
    expect(parseTimeCloseProjection(masked, 'DAILY_CLOSE').periods[0]).toMatchObject({
      periodStart: null,
      version: null,
      actions: [],
    });

    const hostile = structuredClone(projection('DAILY_CLOSE'));
    hostile.items[0]!.availableActions.push({
      actionKey: 'hris.action.tim.timecard.correct',
      method: 'POST',
      hrefTemplate: '/api/time/v1/timecards/{timecardId}/corrections',
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    } as never);
    expect(() => parseTimeCloseProjection(hostile, 'DAILY_CLOSE')).toThrow(
      'Invalid available action'
    );
    expect(() =>
      parseTimeCloseProjection(
        { ...projection('DAILY_CLOSE'), asOf: '2026-02-30T09:00:00Z' },
        'DAILY_CLOSE'
      )
    ).toThrow('projection as-of');
  });

  it('binds deep links and reconciles every expected field decision including omissions', () => {
    const adjacentDeepLink = structuredClone(projection('DAILY_CLOSE'));
    adjacentDeepLink.items[0]!.deepLink.resourcePublicId = APPROVAL_ID;
    expect(() => parseTimeCloseProjection(adjacentDeepLink, 'DAILY_CLOSE')).toThrow(
      'Invalid time close deep link'
    );

    const omitted = structuredClone(projection('DAILY_CLOSE'));
    delete (omitted.items[0]!.fieldGroups as Record<string, unknown>).IMPACT_SUMMARY;
    omitted.queryState.fieldDecisionSummary = { viewCount: 2, maskedCount: 0, omittedCount: 1 };
    expect(parseTimeCloseProjection(omitted, 'DAILY_CLOSE').periods[0]).toMatchObject({
      impactCount: null,
    });

    const drift = structuredClone(omitted);
    drift.queryState.fieldDecisionSummary = { viewCount: 3, maskedCount: 0, omittedCount: 0 };
    expect(() => parseTimeCloseProjection(drift, 'DAILY_CLOSE')).toThrow(
      'Invalid field decision summary'
    );

    const unavailableDrift = projection('DAILY_CLOSE', 7, 'UNAVAILABLE');
    unavailableDrift.queryState.fieldDecisionSummary = {
      viewCount: 0,
      maskedCount: 0,
      omittedCount: 1,
    };
    expect(() => parseTimeCloseProjection(unavailableDrift, 'DAILY_CLOSE')).toThrow(
      'Invalid field decision summary'
    );
  });

  it('honors an authorized monthly close action without inventing absent blocker evidence', () => {
    const monthly = structuredClone(projection('MONTHLY_CLOSE'));
    monthly.items[0]!.statusCode = 'OPEN';
    (monthly.items[0]!.fieldGroups as Record<string, unknown>).CLOSE_STATUS = {
      decision: 'VIEW',
      value: { code: 'OPEN', revision: 7 },
    };
    const period = parseTimeCloseProjection(monthly, 'MONTHLY_CLOSE').periods[0]!;
    expect(period).toMatchObject({ blockerCount: null, impactCount: null, closeStatus: 'OPEN' });
    expect(timeCloseCommandAllowed(period, 'CLOSE')).toBe(true);
  });

  it('binds raw projection cache authority and fails closed on non-200 or missing status', async () => {
    const get = vi.fn<TimeCloseHttpClient['get']>(async () => ({
      data: projection('DAILY_CLOSE'),
      status: 200,
      headers: successHeaders(),
    }));
    const source = createTimeCloseDataSource({ get, post: vi.fn() });
    await expect(
      source.readProjection('DAILY_CLOSE', scope, {}, new AbortController().signal)
    ).resolves.toMatchObject({ periods: [{ periodId: PERIOD_ID }] });
    expect(get).toHaveBeenCalledWith(
      `/api/time/v1/hris/workbench/time-daily-close?limit=100&filter%5BeffectiveOn%5D=2026-10-17&sort=timePeriod%3ADESC&sort=itemPublicId%3AASC&locale=en-US&timeZone=Asia%2FSeoul&correlationId=${CORRELATION_ID}`,
      { contextScopeKey: scope.contextScopeKey, signal: expect.any(AbortSignal) }
    );

    const staleAuthority = structuredClone(projection('DAILY_CLOSE'));
    staleAuthority.queryState.cachePolicy = {
      authorizationDecisionRevision: `psr-${'b'.repeat(64)}`,
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 0,
    };
    get.mockResolvedValueOnce({
      data: staleAuthority,
      status: 200,
      headers: successHeaders(),
    });
    await expect(
      source.readProjection('DAILY_CLOSE', scope, {}, new AbortController().signal)
    ).rejects.toThrow('cache authority');

    get.mockResolvedValueOnce({
      data: projection('DAILY_CLOSE'),
      status: undefined as never,
      headers: successHeaders(),
    });
    await expect(
      source.readProjection('DAILY_CLOSE', scope, {}, new AbortController().signal)
    ).rejects.toThrow('success status');
    get.mockResolvedValueOnce({
      data: projection('DAILY_CLOSE'),
      status: 201,
      headers: successHeaders(),
    });
    await expect(
      source.readProjection('DAILY_CLOSE', scope, {}, new AbortController().signal)
    ).rejects.toThrow('success status');
  });

  it('rejects malformed BCP-47 locales and non-IANA time zones before owner calls', () => {
    expect(() => assertTimeCloseScope({ ...scope, locale: 'en_US' })).toThrow('operation scope');
    expect(() => assertTimeCloseScope({ ...scope, timeZone: 'Seoul/Not_A_Zone' })).toThrow(
      'operation scope'
    );
  });

  it('binds CAS, purpose, idempotency and fresh challenge only to close and reopen', async () => {
    const post = vi.fn<TimeCloseHttpClient['post']>(async (url) => ({
      data: receipt(
        url.endsWith('/validations')
          ? 'VALIDATE'
          : url.endsWith('/close')
            ? 'CLOSE'
            : url.endsWith('/reopen')
              ? 'REOPEN'
              : 'HANDOFF'
      ),
      status: 202,
      headers: successHeaders({
        Location: `/api/time/v1/command-receipts/${RECEIPT_ID}`,
        'Retry-After': '1',
      }),
    }));
    const source = createTimeCloseDataSource({ get: vi.fn(), post });
    const signal = new AbortController().signal;
    const snapshot = { periodId: PERIOD_ID, version: 7 };
    const standard = authority({ expectedVersion: 7, idempotencyKey: IDEMPOTENCY_KEY }, false);
    const elevated = authority({ expectedVersion: 7, idempotencyKey: IDEMPOTENCY_KEY }, true);

    await source.validate(
      snapshot,
      { asOf: '2026-10-17T09:00:00Z' },
      IDEMPOTENCY_KEY,
      scope,
      standard,
      signal
    );
    expect(post.mock.calls[0]?.[2]).toMatchObject({
      contextScopeKey: scope.contextScopeKey,
      csrfReplay: 'NEVER',
      headers: {
        'Idempotency-Key': IDEMPOTENCY_KEY,
        'If-Match': '"7"',
        'X-Correlation-ID': CORRELATION_ID,
        'X-DWP-Expected-Decision-Revision': DECISION_REVISION,
        'X-Purpose-Code': 'WORK_TIME_PERIOD_CLOSURE',
      },
    });
    expect(post.mock.calls[0]?.[2].headers).not.toHaveProperty('X-DWP-Step-Up-Challenge');

    await source.close(
      snapshot,
      {
        asOf: '2026-10-17T09:00:00Z',
        approvalReceiptId: APPROVAL_ID,
        unsealed: 'must-not-cross-wire',
      } as never,
      IDEMPOTENCY_KEY,
      scope,
      elevated,
      signal
    );
    expect(post.mock.calls[1]?.[2].headers).toMatchObject({
      'If-Match': '"7"',
      'X-DWP-Step-Up-Challenge': 'fresh-close-challenge',
    });
    expect(post.mock.calls[1]?.[1]).toEqual({
      asOf: '2026-10-17T09:00:00Z',
      approvalReceiptId: APPROVAL_ID,
    });

    await source.reopen(
      snapshot,
      {
        asOf: '2026-10-17T09:00:00Z',
        approvalReceiptId: APPROVAL_ID,
        reasonCode: 'LATE_APPROVAL',
        unsealed: 'must-not-cross-wire',
      } as never,
      IDEMPOTENCY_KEY,
      scope,
      elevated,
      signal
    );
    expect(post.mock.calls[2]?.[1]).toEqual({
      asOf: '2026-10-17T09:00:00Z',
      approvalReceiptId: APPROVAL_ID,
      reasonCode: 'LATE_APPROVAL',
    });
    expect(post.mock.calls[2]?.[2].headers).toHaveProperty(
      'X-DWP-Step-Up-Challenge',
      'fresh-close-challenge'
    );

    await source.createHandoff(
      snapshot,
      {
        closedTimeResultId: RESULT_ID,
        payrollEntityId: PAYROLL_ENTITY_ID,
        payPeriodId: PAY_PERIOD_ID,
        unsealed: 'must-not-cross-wire',
      } as never,
      IDEMPOTENCY_KEY,
      scope,
      standard,
      signal
    );
    expect(post.mock.calls[3]?.[1]).toEqual({
      closedTimeResultId: RESULT_ID,
      payrollEntityId: PAYROLL_ENTITY_ID,
      payPeriodId: PAY_PERIOD_ID,
    });
    expect(post.mock.calls[3]?.[2].headers).not.toHaveProperty('X-DWP-Step-Up-Challenge');
    await expect(
      source.validate(
        snapshot,
        { asOf: '2026-10-17T09:00:00Z' },
        IDEMPOTENCY_KEY,
        scope,
        elevated,
        signal
      )
    ).rejects.toThrow('authority');
    await expect(
      source.close(
        snapshot,
        { asOf: '2026-10-17T09:00:00Z', approvalReceiptId: APPROVAL_ID },
        IDEMPOTENCY_KEY,
        scope,
        standard,
        signal
      )
    ).rejects.toThrow('authority');
  });

  it('retains only a receipt id bound by an exact authoritative 202 Location', async () => {
    const malformed = receipt('VALIDATE', 'ACCEPTED', { requestDigest: 'not-a-digest' });
    const post = vi.fn<TimeCloseHttpClient['post']>(async () => ({
      data: malformed,
      status: 202,
      headers: successHeaders({
        Location: `/api/time/v1/command-receipts/${RECEIPT_ID}`,
        'Retry-After': '1',
      }),
    }));
    const source = createTimeCloseDataSource({ get: vi.fn(), post });
    const args = [
      { periodId: PERIOD_ID, version: 7 },
      { asOf: '2026-10-17T09:00:00Z' },
      IDEMPOTENCY_KEY,
      scope,
      authority({ expectedVersion: 7, idempotencyKey: IDEMPOTENCY_KEY }, false),
      new AbortController().signal,
    ] as const;

    const recoverable = await source.validate(...args).catch((error: unknown) => error);
    expect(recoverable).toBeInstanceOf(TimeCloseCommandOutcomeUnknownError);
    expect((recoverable as TimeCloseCommandOutcomeUnknownError).receiptId).toBe(RECEIPT_ID);

    post.mockResolvedValueOnce({
      data: malformed,
      status: 202,
      headers: successHeaders({
        Location: `https://hostile.invalid/adjacent/${RECEIPT_ID}`,
        'Retry-After': '1',
      }),
    });
    const unbound = await source.validate(...args).catch((error: unknown) => error);
    expect(unbound).toBeInstanceOf(TimeCloseCommandOutcomeUnknownError);
    expect((unbound as TimeCloseCommandOutcomeUnknownError).receiptId).toBeUndefined();

    post.mockResolvedValueOnce({
      data: malformed,
      status: 202,
      headers: {
        ...successHeaders({
          Location: `/api/time/v1/command-receipts/${RECEIPT_ID}`,
          'Retry-After': '1',
        }),
        'Cache-Control': 'private',
      },
    });
    const cacheable = await source.validate(...args).catch((error: unknown) => error);
    expect((cacheable as TimeCloseCommandOutcomeUnknownError).receiptId).toBeUndefined();
  });

  it('rejects adjacent/forged receipts and preserves established receipt lineage', async () => {
    expect(() =>
      parseTimeCloseCommandReceipt({
        receiptId: RECEIPT_ID,
        commandType: 'TIMECARD_SUBMIT',
        originatingAction: 'TIME_TIMECARD_SUBMIT',
        subjectPrincipalPublicId: SUBJECT_ID,
        populationScopeDigest: 'b'.repeat(64),
        fieldPolicyRevision: 50,
        purposeCode: 'TIME_TIMECARD',
        authorizationRevision: 50,
        status: 'SUCCEEDED',
        correlationId: CORRELATION_ID,
        requestDigest: 'c'.repeat(64),
        createdAt: '2026-10-17T09:00:01Z',
      })
    ).toThrow();
    expect(() =>
      parseTimeCloseCommandReceipt(
        receipt('CLOSE', 'SUCCEEDED', { originatingAction: 'TIME_PERIOD_REOPEN' })
      )
    ).toThrow('binding');

    const accepted = parseTimeCloseCommandReceipt(
      receipt('CLOSE', 'ACCEPTED', { aggregateVersion: undefined, resultRef: undefined })
    );
    const succeeded = parseTimeCloseCommandReceipt(receipt('CLOSE', 'SUCCEEDED'));
    expect(() => assertTimeCloseReceiptProgression(accepted, succeeded)).not.toThrow();
    expect(() =>
      assertTimeCloseReceiptProgression(
        succeeded,
        parseTimeCloseCommandReceipt(receipt('CLOSE', 'SUCCEEDED', { resultRef: HANDOFF_ID }))
      )
    ).toThrow('progression');

    const get = vi.fn<TimeCloseHttpClient['get']>(async () => ({
      data: receipt('CLOSE'),
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }));
    const source = createTimeCloseDataSource({ get, post: vi.fn() });
    await source.readReceipt(RECEIPT_ID, scope, new AbortController().signal);
    expect(get).toHaveBeenNthCalledWith(1, `/api/time/v1/command-receipts/${RECEIPT_ID}`, {
      contextScopeKey: scope.contextScopeKey,
      signal: expect.any(AbortSignal),
    });
    get.mockResolvedValueOnce({
      data: receipt('CLOSE', 'ACCEPTED', { receiptId: APPROVAL_ID }),
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
    await expect(
      source.readReceipt(RECEIPT_ID, scope, new AbortController().signal)
    ).rejects.toThrow('path identity');
    get.mockResolvedValueOnce({
      data: receipt('CLOSE'),
      status: 200,
      headers: { 'Cache-Control': 'private' },
    });
    await expect(
      source.readReceipt(RECEIPT_ID, scope, new AbortController().signal)
    ).rejects.toThrow('cache policy');
  });

  it('parses immutable handoff lineage and enforces status/nullability/ETag invariants', async () => {
    expect(parsePayrollTimeHandoffStatus(handoff('PENDING'), '"2"')).toMatchObject({
      status: 'PENDING',
      receiverReceiptId: null,
    });
    expect(parsePayrollTimeHandoffStatus(handoff('ACKNOWLEDGED'), '"2"')).toMatchObject({
      status: 'ACKNOWLEDGED',
      closedTimeResultId: RESULT_ID,
      sourceDigest: 'd'.repeat(64),
      ruleDigest: 'e'.repeat(64),
      payloadDigest: 'f'.repeat(64),
    });
    expect(() => parsePayrollTimeHandoffStatus(handoff('ACKNOWLEDGED'), 'W/"2"')).toThrow('ETag');
    expect(() =>
      parsePayrollTimeHandoffStatus(
        { ...handoff('RESULT_UNKNOWN'), receiverReceiptId: null },
        '"2"'
      )
    ).toThrow('outcome invariant');
    expect(() =>
      parsePayrollTimeHandoffStatus({ ...handoff('ACKNOWLEDGED'), workerCount: 1_000_001 }, '"2"')
    ).toThrow('handoff count');

    const get = vi.fn<TimeCloseHttpClient['get']>(async () => ({
      data: handoff('ACKNOWLEDGED'),
      status: 200,
      headers: successHeaders({ ETag: '"2"' }),
    }));
    const source = createTimeCloseDataSource({ get, post: vi.fn() });
    await source.readHandoff(HANDOFF_ID, scope, new AbortController().signal);
    expect(get).toHaveBeenCalledWith(`/api/time/v1/payroll-handoffs/${HANDOFF_ID}`, {
      contextScopeKey: scope.contextScopeKey,
      signal: expect.any(AbortSignal),
      headers: {
        'X-Correlation-ID': CORRELATION_ID,
        'X-Purpose-Code': 'CLOSED_TIME_PAYROLL_TRANSFER',
        'X-DWP-Expected-Decision-Revision': DECISION_REVISION,
      },
    });
  });
});
