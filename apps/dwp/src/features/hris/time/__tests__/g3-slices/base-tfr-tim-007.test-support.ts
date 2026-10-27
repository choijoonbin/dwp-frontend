import { vi } from 'vitest';

import {
  parsePayrollTimeHandoffStatus,
  parseTimeCloseCommandReceipt,
  parseTimeCloseProjection,
} from '../../close';

import type {
  PayrollTimeHandoffStatus,
  TimeCloseCommandAuthorityExecutor,
  TimeCloseCommandReceipt,
  TimeCloseDataSource,
  TimeCloseEntryMode,
  TimeCloseOwnerBinding,
  TimeClosePageRouteContractKey,
  TimeCloseScope,
} from '../../close';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export const PERIOD_ID = '70000000-0000-4000-8000-000000000001';
export const SUBJECT_ID = '70000000-0000-4000-8000-000000000002';
export const RECEIPT_ID = '70000000-0000-4000-8000-000000000003';
export const APPROVAL_ID = '70000000-0000-4000-8000-000000000004';
export const RESULT_ID = '70000000-0000-4000-8000-000000000005';
export const HANDOFF_ID = '70000000-0000-4000-8000-000000000006';
export const PAYROLL_ENTITY_ID = '70000000-0000-4000-8000-000000000007';
export const PAY_PERIOD_ID = '70000000-0000-4000-8000-000000000008';
const RECEIVER_RECEIPT_ID = '70000000-0000-4000-8000-000000000009';
export const CORRELATION_ID = '70000000-0000-4000-8000-000000000010';
export const IDEMPOTENCY_KEY = '70000000-0000-4000-8000-000000000011';
export const DECISION_REVISION = `psr-${'a'.repeat(64)}`;

export const scope: TimeCloseScope = {
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

export const action = {
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

export function queryState(state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' = 'COMPLETE') {
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

export function projection(
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

export function receipt(
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

export function handoff(status: PayrollTimeHandoffStatus['status'] = 'ACKNOWLEDGED') {
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

export function successHeaders(extra: Record<string, string> = {}) {
  return {
    'Cache-Control': 'no-store',
    'X-Correlation-ID': CORRELATION_ID,
    'X-DWP-Decision-Revision': DECISION_REVISION,
    ...extra,
  };
}

export function authority(
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

export function ownerBinding(entryMode: TimeCloseEntryMode = 'DAILY_CLOSE'): TimeCloseOwnerBinding {
  const execute =
    (highRisk: boolean): TimeCloseCommandAuthorityExecutor =>
    (run, binding) =>
      run(authority(binding, highRisk));
  const pageRouteByEntryMode: Readonly<Record<TimeCloseEntryMode, TimeClosePageRouteContractKey>> =
    {
      COMMAND_CENTER: 'route.hcm.operations.time-command-center.page',
      DAILY_CLOSE: 'route.hcm.operations.time-daily-close.page',
      MONTHLY_CLOSE: 'route.hcm.operations.time-monthly-close.page',
    };
  return {
    page: {
      routeContractKey: pageRouteByEntryMode[entryMode],
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

export function dataSource(overrides: Partial<TimeCloseDataSource> = {}): TimeCloseDataSource {
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

export function buttonByText(
  container: ParentNode,
  label: string,
  last = false
): HTMLButtonElement {
  const matches = [...container.querySelectorAll('button')].filter(
    (candidate) => candidate.textContent?.trim() === label
  );
  const button = last ? matches.at(-1) : matches[0];
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

export function buttonContainingText(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(button instanceof HTMLButtonElement))
    throw new Error(`Missing button containing: ${label}`);
  return button;
}

export function inputByLabel(labelText: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.replace(/\s*\*$/, '').trim() === labelText
  );
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input: ${labelText}`);
  return input;
}

export function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
