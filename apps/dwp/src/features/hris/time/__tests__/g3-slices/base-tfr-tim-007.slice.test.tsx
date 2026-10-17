// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TIME_CLOSE_API_CONTRACTS,
  TIME_CLOSE_ROUTE_PURPOSES,
  TimeCloseCommandOutcomeUnknownError,
  TimeCloseWorkspaceRuntime,
  assertTimeCloseReceiptProgression,
  assertTimeCloseScope,
  createTimeCloseDataSource,
  parsePayrollTimeHandoffStatus,
  parseTimeCloseCommandReceipt,
  parseTimeCloseProjection,
  timeCloseCommandAllowed,
} from '../../close';

import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import type {
  PayrollTimeHandoffStatus,
  TimeCloseCommandAuthorityExecutor,
  TimeCloseCommandReceipt,
  TimeCloseDataSource,
  TimeCloseEntryMode,
  TimeCloseHttpClient,
  TimeCloseOwnerBinding,
  TimeCloseScope,
} from '../../close';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const PERIOD_ID = '70000000-0000-4000-8000-000000000001';
const SUBJECT_ID = '70000000-0000-4000-8000-000000000002';
const RECEIPT_ID = '70000000-0000-4000-8000-000000000003';
const APPROVAL_ID = '70000000-0000-4000-8000-000000000004';
const RESULT_ID = '70000000-0000-4000-8000-000000000005';
const HANDOFF_ID = '70000000-0000-4000-8000-000000000006';
const PAYROLL_ENTITY_ID = '70000000-0000-4000-8000-000000000007';
const PAY_PERIOD_ID = '70000000-0000-4000-8000-000000000008';
const RECEIVER_RECEIPT_ID = '70000000-0000-4000-8000-000000000009';
const CORRELATION_ID = '70000000-0000-4000-8000-000000000010';
const IDEMPOTENCY_KEY = '70000000-0000-4000-8000-000000000011';
const DECISION_REVISION = `psr-${'a'.repeat(64)}`;

const scope: TimeCloseScope = {
  ready: true,
  contextScopeKey: 'scope.tim-close.legal-entity-7',
  decisionRevision: DECISION_REVISION,
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: CORRELATION_ID,
  effectiveOn: '2026-10-17',
};

const entryMeta = {
  COMMAND_CENTER: {
    route: '/hr/operations/time/command-center',
    groups: {
      EXCEPTION_SUMMARY: {
        decision: 'VIEW',
        value: { itemCount: 0, revision: 7, asOf: '2026-10-17T09:00:00Z' },
      },
      COMMAND_RECEIPT: {
        decision: 'VIEW',
        value: {
          receiptId: RECEIPT_ID,
          state: 'SUCCEEDED',
          occurredAt: '2026-10-17T09:00:00Z',
          revision: 1,
        },
      },
    },
  },
  DAILY_CLOSE: {
    route: '/hr/operations/time/daily-close',
    groups: {
      CLOSE_STATUS: { decision: 'VIEW', value: { code: 'OPEN', revision: 7 } },
      IMPACT_SUMMARY: {
        decision: 'VIEW',
        value: { itemCount: 0, revision: 7, asOf: '2026-10-17T09:00:00Z' },
      },
    },
  },
  MONTHLY_CLOSE: {
    route: '/hr/operations/time/monthly-close',
    groups: {
      CLOSE_STATUS: { decision: 'VIEW', value: { code: 'CLOSED', revision: 7 } },
      PAYROLL_HANDOFF: {
        decision: 'VIEW',
        value: {
          receiptId: RECEIPT_ID,
          state: 'ACKNOWLEDGED',
          occurredAt: '2026-10-17T09:00:00Z',
          revision: 2,
        },
      },
    },
  },
} as const;

const action = {
  VALIDATE: {
    actionKey: 'hris.action.tim.close.validate',
    method: 'POST',
    hrefTemplate: '/api/time/v1/close-periods/{periodId}/validations',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  },
  CLOSE: {
    actionKey: 'hris.action.tim.close.close',
    method: 'POST',
    hrefTemplate: '/api/time/v1/close-periods/{periodId}/close',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  },
  REOPEN: {
    actionKey: 'hris.action.tim.close.reopen',
    method: 'POST',
    hrefTemplate: '/api/time/v1/close-periods/{periodId}/reopen',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  },
  HANDOFF: {
    actionKey: 'hris.action.tim.handoff.create',
    method: 'POST',
    hrefTemplate: '/api/time/v1/close-periods/{periodId}/payroll-handoffs',
    idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
    stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
  },
} as const;

function queryState(state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE') {
  const partial = state === 'PARTIAL';
  const value: Record<string, unknown> = {
    state,
    scopeDecisionRevision: 'scope-tim-close-v50',
    freshness: state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CURRENT',
    nextCursor: null,
    fieldDecisionSummary: {
      viewCount: state === 'EMPTY' || state === 'UNAVAILABLE' ? 0 : 3,
      maskedCount: 0,
      omittedCount: 0,
    },
    partialFailures: partial
      ? [
          {
            componentKey: 'payroll.handoff',
            errorCode: 'HANDOFF_UNAVAILABLE',
            correlationId: CORRELATION_ID,
            retryable: true,
          },
        ]
      : [],
    correlationId: CORRELATION_ID,
    cachePolicy: {
      authorizationDecisionRevision: DECISION_REVISION,
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1',
      maxAgeSeconds: 0,
    },
  };
  return value;
}

function projection(
  variant: TimeCloseEntryMode = 'DAILY_CLOSE',
  version = 7,
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE'
) {
  const meta = entryMeta[variant];
  return {
    projectionVersion: '1',
    asOf: '2026-10-17T09:00:00Z',
    variantKey: variant,
    queryState: queryState(state),
    items:
      state === 'EMPTY' || state === 'UNAVAILABLE'
        ? []
        : [
            {
              itemPublicId: PERIOD_ID,
              title: 'Seoul daily period · 2026-10-17',
              statusCode: variant === 'MONTHLY_CLOSE' ? 'CLOSED' : 'OPEN',
              fieldGroups: {
                TIME_PERIOD: {
                  decision: 'VIEW',
                  value: {
                    effectiveFrom: '2026-10-17',
                    effectiveTo: '2026-10-17',
                    revision: version,
                  },
                },
                ...meta.groups,
              },
              deepLink: { route: meta.route, resourcePublicId: PERIOD_ID },
              availableActions: Object.values(action),
            },
          ],
  };
}

function receipt(
  kind: 'VALIDATE' | 'CLOSE' | 'REOPEN' | 'HANDOFF',
  status: TimeCloseCommandReceipt['status'] = 'ACCEPTED',
  overrides: Record<string, unknown> = {}
) {
  const bindings = {
    VALIDATE: ['PERIOD_VALIDATE', 'TIME_PERIOD_VALIDATE', 'WORK_TIME_PERIOD_CLOSURE'],
    CLOSE: ['PERIOD_CLOSE', 'TIME_PERIOD_CLOSE', 'WORK_TIME_PERIOD_CLOSURE'],
    REOPEN: ['PERIOD_REOPEN', 'TIME_PERIOD_REOPEN', 'WORK_TIME_PERIOD_CLOSURE'],
    HANDOFF: ['PAYROLL_HANDOFF', 'TIME_PAYROLL_HANDOFF', 'CLOSED_TIME_PAYROLL_TRANSFER'],
  } as const;
  const [commandType, originatingAction, purposeCode] = bindings[kind];
  const value: Record<string, unknown> = {
    receiptId: RECEIPT_ID,
    commandType,
    originatingAction,
    subjectPrincipalPublicId: SUBJECT_ID,
    populationScopeDigest: 'b'.repeat(64),
    fieldPolicyRevision: 50,
    purposeCode,
    authorizationRevision: 50,
    status,
    correlationId: CORRELATION_ID,
    requestDigest: 'c'.repeat(64),
    createdAt: '2026-10-17T09:00:01Z',
    aggregateVersion: 7,
    resultRef: RESULT_ID,
  };
  Object.entries(overrides).forEach(([key, entry]) => {
    if (entry === undefined) delete value[key];
    else value[key] = entry;
  });
  return value;
}

function handoff(status: PayrollTimeHandoffStatus['status'] = 'ACKNOWLEDGED') {
  const pending = status === 'PENDING';
  const acknowledged = status === 'ACKNOWLEDGED';
  return {
    handoffId: HANDOFF_ID,
    closePeriodId: PERIOD_ID,
    closedTimeResultId: RESULT_ID,
    closeRevision: 7,
    payrollEntityId: PAYROLL_ENTITY_ID,
    payPeriodId: PAY_PERIOD_ID,
    workerCount: 12,
    lineCount: 88,
    sourceDigest: 'd'.repeat(64),
    ruleDigest: 'e'.repeat(64),
    payloadDigest: 'f'.repeat(64),
    status,
    receiverReceiptId: pending ? null : RECEIVER_RECEIPT_ID,
    receiverReceiptRevision: pending ? null : 2,
    receiverReceiptDigest: pending ? null : '1'.repeat(64),
    reasonCode: pending || acknowledged ? null : 'PAYROLL_REJECTED',
    outcomeAt: pending ? null : '2026-10-17T09:05:00Z',
    createdAt: '2026-10-17T09:01:00Z',
    updatedAt: '2026-10-17T09:05:00Z',
    version: 2,
  };
}

function successHeaders(extra: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Correlation-ID': CORRELATION_ID,
    'X-DWP-Decision-Revision': DECISION_REVISION,
    ...extra,
  };
}

function authority(
  binding: Readonly<{ expectedVersion: number; idempotencyKey: string }>,
  highRisk: boolean
): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    contextKey: 'hcm.time.close',
    contextScopeKey: scope.contextScopeKey,
    expectedDecisionRevision: scope.decisionRevision,
    objectVersion: binding.expectedVersion,
    idempotencyKey: binding.idempotencyKey,
    ...(highRisk
      ? {
          stepUp: {
            challenge: 'fresh-close-challenge',
            challengeId: 'challenge-tim-007',
            decisionRevision: scope.decisionRevision,
            expiresAt: '2099-10-17T09:10:00Z',
          },
        }
      : {}),
  };
}

function ownerBinding(entryMode: TimeCloseEntryMode = 'DAILY_CLOSE'): TimeCloseOwnerBinding {
  const execute =
    (highRisk: boolean): TimeCloseCommandAuthorityExecutor =>
    (run, binding) =>
      run(authority(binding, highRisk));
  return {
    page: {
      routeContractKey: {
        COMMAND_CENTER: 'route.hcm.operations.time-command-center.page',
        DAILY_CLOSE: 'route.hcm.operations.time-daily-close.page',
        MONTHLY_CLOSE: 'route.hcm.operations.time-monthly-close.page',
      }[entryMode],
    },
    commands: {
      validate: {
        routeContractKey: 'route.hcm.operations.time-close-validate.action',
        execute: execute(false),
      },
      close: {
        routeContractKey: 'route.hcm.operations.time-close.action',
        execute: execute(true),
      },
      reopen: {
        routeContractKey: 'route.hcm.operations.time-reopen.action',
        execute: execute(true),
      },
      handoff: {
        routeContractKey: 'route.hcm.operations.time-payroll-handoff-create.action',
        execute: execute(false),
      },
      receipt: { routeContractKey: 'route.hcm.time.command-receipt.data' },
    },
    handoffStatus: {
      routeContractKey: 'route.hcm.operations.time-payroll-handoff.data',
    },
  };
}

function dataSource(overrides: Partial<TimeCloseDataSource> = {}): TimeCloseDataSource {
  return {
    readProjection: vi.fn(async (mode) => parseTimeCloseProjection(projection(mode), mode)),
    validate: vi.fn(async () => parseTimeCloseCommandReceipt(receipt('VALIDATE', 'SUCCEEDED'))),
    close: vi.fn(async () => parseTimeCloseCommandReceipt(receipt('CLOSE', 'SUCCEEDED'))),
    reopen: vi.fn(async () => parseTimeCloseCommandReceipt(receipt('REOPEN', 'SUCCEEDED'))),
    createHandoff: vi.fn(async () => parseTimeCloseCommandReceipt(receipt('HANDOFF', 'SUCCEEDED'))),
    readReceipt: vi.fn(async () => parseTimeCloseCommandReceipt(receipt('VALIDATE', 'SUCCEEDED'))),
    readHandoff: vi.fn(async () => parsePayrollTimeHandoffStatus(handoff(), '"2"')),
    ...overrides,
  };
}

function buttonByText(container: ParentNode, label: string, last = false): HTMLButtonElement {
  const matches = [...container.querySelectorAll('button')].filter(
    (candidate) => candidate.textContent?.trim() === label
  );
  const button = last ? matches.at(-1) : matches[0];
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

function buttonContainingText(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(button instanceof HTMLButtonElement))
    throw new Error(`Missing button containing: ${label}`);
  return button;
}

function inputByLabel(labelText: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.replace(/\s*\*$/, '').trim() === labelText
  );
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input: ${labelText}`);
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

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
    monthly.items[0]!.fieldGroups.CLOSE_STATUS = {
      decision: 'VIEW',
      value: { code: 'OPEN', revision: 7 },
    };
    const period = parseTimeCloseProjection(monthly, 'MONTHLY_CLOSE').periods[0]!;
    expect(period).toMatchObject({ blockerCount: null, impactCount: null, closeStatus: 'OPEN' });
    expect(timeCloseCommandAllowed(period, 'CLOSE')).toBe(true);
  });

  it('binds raw projection cache authority and fails closed on non-200 or missing status', async () => {
    const get = vi.fn(async () => ({
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
    const post = vi.fn(async (url: string) => ({
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
    const post = vi.fn(async () => ({
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

    const get = vi.fn(async () => ({
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

    const get = vi.fn(async () => ({
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
