import { parseTimecard } from '../../index';

import { type ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  TimecardCommandExecutor,
  TimecardOperationScope,
  TimecardOwnerBinding,
  TimecardSnapshot,
  TimecardState,
} from '../../index';

export const TIMECARD_ID = '11111111-1111-4111-8111-111111111111';
export const WORKER_ID = '22222222-2222-4222-8222-222222222222';
export const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
export const RECEIPT_ID = '44444444-4444-4444-8444-444444444444';
export const OTHER_TIMECARD_ID = '55555555-5555-4555-8555-555555555555';
export const IDEMPOTENCY_KEY = '66666666-6666-4666-8666-666666666666';
export const REFRESHED_IDEMPOTENCY_KEY = '77777777-7777-4777-8777-777777777777';
export const OPAQUE_ETAG = '"tim-v7-seal"';

export function timecardSource(
  state: TimecardState = 'OPEN',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    timecardId: TIMECARD_ID,
    workerId: WORKER_ID,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-14',
    state,
    totalMinutes: 2_400,
    ledgerRevision: 3,
    version: 7,
    ...overrides,
  };
}

export function snapshot(state: TimecardState = 'OPEN', etag = OPAQUE_ETAG): TimecardSnapshot {
  return { timecard: parseTimecard(timecardSource(state)), etag };
}

export function scope(
  populationKind: TimecardOperationScope['populationKind'] = 'SELF',
  overrides: Partial<TimecardOperationScope> = {}
): TimecardOperationScope {
  return {
    ready: true,
    contextScopeKey: 'scope.tim-017',
    decisionRevision: 'decision-revision-42',
    actorWorkerId: populationKind === 'SELF' ? WORKER_ID : ACTOR_ID,
    populationKind,
    timecardPurpose: 'TIME_TIMECARD',
    receiptPurpose: 'COMMAND_STATUS',
    ...overrides,
  };
}

export function receiptSource(
  kind: 'CORRECT' | 'SUBMIT' | 'DECIDE',
  status: 'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'RESULT_UNKNOWN',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const action = {
    CORRECT: 'TIME_TIMECARD_CORRECT',
    SUBMIT: 'TIME_TIMECARD_SUBMIT',
    DECIDE: 'TIME_TIMECARD_DECIDE',
  }[kind];
  return {
    receiptId: RECEIPT_ID,
    commandType: `OWNER_${kind}_COMMAND`,
    originatingAction: action,
    timecardId: TIMECARD_ID,
    status,
    requestDigest: 'a'.repeat(64),
    acceptedAt: '2026-10-14T00:00:00Z',
    completedAt: ['SUCCEEDED', 'REJECTED', 'FAILED'].includes(status)
      ? '2026-10-14T00:00:01Z'
      : null,
    resultRef: status === 'SUCCEEDED' ? `timecard:${TIMECARD_ID}:version:8` : null,
    ...overrides,
  };
}

export function authorityFor(
  requestScope: TimecardOperationScope
): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: requestScope.decisionRevision,
    contextKey: 'hcm.time.timecard',
    contextScopeKey: requestScope.contextScopeKey,
  };
}

export function ownerBinding(requestScope: TimecardOperationScope): TimecardOwnerBinding {
  const execute: TimecardCommandExecutor = (command) => command(authorityFor(requestScope));
  return {
    timecard: {
      contractId: 'PEP-TIM-011',
      routeContractKey: 'route.hcm.time.timecard.data',
    },
    receipt: {
      contractId: 'PEP-TIM-028',
      routeContractKey: 'route.hcm.time.command-receipt.data',
    },
    correct: {
      contractId: 'PEP-TIM-012',
      actionKey: 'hris.action.tim.timecard.correct',
      routeContractKey: 'route.hcm.time.timecard-correction.action',
      execute,
    },
    submit: {
      contractId: 'PEP-TIM-013',
      actionKey: 'hris.action.tim.timecard.submit',
      routeContractKey: 'route.hcm.time.timecard-submit.action',
      execute,
    },
    decide: {
      contractId: 'PEP-TIM-014',
      actionKey: 'hris.action.tim.timecard.decide',
      routeContractKey: 'route.hcm.time.timecard-decision.action',
      execute,
    },
  };
}

export function buttonByText(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

export function inputByLabel(labelText: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim() === labelText
  );
  const input = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input: ${labelText}`);
  return input;
}

export function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}
