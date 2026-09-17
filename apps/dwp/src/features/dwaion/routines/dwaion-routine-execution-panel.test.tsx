// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DWAION_ROUTINE_COPY_EN } from './dwaion-routine-copy';
import {
  DwaionRoutineExecutionPanel,
  selectPrintableRoutineRun,
} from './dwaion-routine-execution-panel';

import type {
  DwaionRoutineAdvancedCommand,
  DwaionRoutineAdvancedPayload,
  DwaionRoutineExecutionRun,
  DwaionRoutineRuntimeCapabilities,
} from '@dwp-frontend/shared-utils';
import type { DwaionRoutine } from './dwaion-routine-model';

const ROUTINE: DwaionRoutine = {
  routineId: '11111111-1111-4111-8111-111111111111',
  title: 'Morning priority review',
  description: 'Review work evidence and create governed proposals.',
  status: 'ACTIVE',
  revision: 8,
  executionMode: 'SCHEDULED',
  triggerType: 'SCHEDULED',
  webhookEventType: null,
  webhookEndpointReference: null,
  sourceKeys: ['WORK_ITEM'],
  schedule: {
    cadence: 'WEEKDAYS',
    localTime: '09:00:00',
    timeZone: 'Asia/Seoul',
    activeFrom: null,
    activeUntil: null,
    quietHoursStart: null,
    quietHoursEnd: null,
    weekDays: [],
  },
  consents: [
    { key: 'SOURCE_ACCESS', state: 'ENABLED' },
    { key: 'ANALYSIS', state: 'ENABLED' },
    { key: 'PROPOSAL_DELIVERY', state: 'ENABLED' },
  ],
  schedulingAvailable: true,
  backgroundExecutionAvailable: true,
  notificationDeliveryAvailable: true,
  dryRunAvailable: true,
  proposalDeliveryAvailable: true,
  activationAvailable: true,
  nextRunAt: '2026-09-18T00:00:00Z',
  budget: {
    maximumRunsPerMonth: 31,
    maximumTokensPerRun: 32_000,
    maximumMinutesPerRun: 15,
  },
  retryPolicy: {
    maximumAttempts: 3,
    initialBackoffSeconds: 30,
    backoffMultiplier: 2,
  },
  notificationPolicy: {
    notifyOnPartial: true,
    notifyOnFailure: true,
    notifyOnRecovery: true,
  },
  compensationPolicy: { enabled: true, strategy: 'REVOKE_PENDING_HANDOFFS' },
};

let root: Root;
let host: HTMLDivElement;

describe('DwaionRoutineExecutionPanel print report', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('binds the printable section and document title to the same terminal run receipt', async () => {
    const pending = createRun('run-newest', 'PARTIAL', null);
    const selected = createRun('run-selected', 'COMPLETED', 'receipt-selected');
    const older = createRun('run-older', 'COMPLETED', 'receipt-older');
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const previousTitle = document.title;

    await act(async () => {
      root.render(
        <DwaionRoutineExecutionPanel
          routine={ROUTINE}
          runs={[pending, selected, older]}
          versions={[]}
          busy={false}
          canManage
          copy={DWAION_ROUTINE_COPY_EN}
          formatTimestamp={(value) => `formatted:${value}`}
          onActivate={vi.fn()}
          onTrigger={vi.fn()}
          onRunCommand={vi.fn()}
          onRollbackVersion={vi.fn()}
          onDownloadTelemetry={vi.fn()}
          onAdvancedCommand={vi.fn()}
          onRetry={vi.fn()}
        />
      );
    });

    expect(selectPrintableRoutineRun([pending, selected, older])).toBe(selected);
    const report = document.querySelector<HTMLElement>('.routine-print-report');
    expect(report?.dataset.runId).toBe('run-selected');
    expect(report?.dataset.receiptId).toBe('receipt-selected');
    expect(report?.textContent).toContain('sha-run-selected');
    expect(report?.textContent).toContain('COMPLETED');
    expect(report?.textContent).toContain('formatted:2026-09-17T04:00:00Z');
    expect(report?.textContent).toContain('32000');
    expect(report?.textContent).not.toContain('receipt-older');

    const printButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === DWAION_ROUTINE_COPY_EN.printReport
    );
    expect(printButton).toBeDefined();
    await act(async () => printButton?.click());

    expect(print).toHaveBeenCalledOnce();
    expect(document.title).toContain('run-selected');
    expect(document.title).toContain('receipt-selected');
    expect(document.title).not.toContain('run-older');

    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe(previousTitle);
    expect(document.head.textContent).toContain('.routine-print-report');
    expect(document.head.textContent).toContain('@media print');
  });

  it('rejects a terminal receipt whose run or state does not match', () => {
    const wrongRun = createRun('run-a', 'COMPLETED', 'receipt-a');
    const wrongState = createRun('run-b', 'COMPENSATED', 'receipt-b');
    if (!wrongRun.receipt || !wrongState.receipt) throw new Error('test receipt missing');
    wrongRun.receipt = { ...wrongRun.receipt, routineRunId: 'run-other' };
    wrongState.receipt = { ...wrongState.receipt, terminalState: 'COMPLETED' };

    expect(selectPrintableRoutineRun([wrongRun, wrongState])).toBeNull();
  });

  it('submits bounded temporary budget and active engine rollback controls', async () => {
    const onAdvancedCommand = vi.fn<(payload: DwaionRoutineAdvancedPayload) => void>();
    const engineCommand = createActiveEngineCommand();
    await act(async () => {
      root.render(
        <DwaionRoutineExecutionPanel
          routine={ROUTINE}
          capabilities={runtimeCapabilities()}
          runs={[]}
          versions={[]}
          advancedCommand={engineCommand}
          busy={false}
          canManage
          copy={DWAION_ROUTINE_COPY_EN}
          formatTimestamp={(value) => value}
          onActivate={vi.fn()}
          onTrigger={vi.fn()}
          onRunCommand={vi.fn()}
          onRollbackVersion={vi.fn()}
          onDownloadTelemetry={vi.fn()}
          onAdvancedCommand={onAdvancedCommand}
          onRetry={vi.fn()}
        />
      );
    });

    await clickButton(DWAION_ROUTINE_COPY_EN.temporaryLimit);
    await clickButton(DWAION_ROUTINE_COPY_EN.engineRollback);

    expect(onAdvancedCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: 'TEMPORARY_BUDGET_INCREASE',
        additionalRuns: 1,
        additionalTokensPerRun: 10_000,
        additionalMinutesPerRun: 15,
      })
    );
    const budgetPayload = onAdvancedCommand.mock.calls[0]?.[0];
    if (budgetPayload?.kind !== 'TEMPORARY_BUDGET_INCREASE') {
      throw new Error('Temporary budget command was not submitted.');
    }
    expect(Date.parse(budgetPayload.expiresAt)).toBeGreaterThan(Date.now());
    expect(onAdvancedCommand).toHaveBeenNthCalledWith(2, {
      kind: 'AGENT_ENGINE_SWITCH',
      action: 'ROLLBACK',
    });
  });
});

async function clickButton(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button).toBeDefined();
  expect(button?.disabled).toBe(false);
  await act(async () => button?.click());
}

function createActiveEngineCommand(): DwaionRoutineAdvancedCommand {
  return {
    commandId: '22222222-2222-4222-8222-222222222222',
    routineId: ROUTINE.routineId,
    ownerUserId: 'member-1',
    kind: 'AGENT_ENGINE_SWITCH',
    state: 'SUCCEEDED',
    expectedRevision: ROUTINE.revision,
    version: 2,
    makerUserId: 'member-1',
    checkerUserId: null,
    canApprove: false,
    proposedDefinition: null,
    problem: null,
    receipt: {
      receiptId: '33333333-3333-4333-8333-333333333333',
      commandId: '22222222-2222-4222-8222-222222222222',
      routineId: ROUTINE.routineId,
      kind: 'AGENT_ENGINE_SWITCH',
      state: 'SUCCEEDED',
      providerReceiptId: 'provider-engine-override',
      resultSha256: 'a'.repeat(64),
      providerOutcome: {
        routineId: ROUTINE.routineId,
        expectedRevision: ROUTINE.revision,
        kind: 'AGENT_ENGINE_SWITCH',
        outcome: 'APPLIED',
        appliedPayload: {
          kind: 'AGENT_ENGINE_SWITCH',
          action: 'APPLY',
          agentId: 'dwaion-personal-routine-agent',
          engineId: 'dwp-agent-kernel-v2',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
        evidenceRef: 'engine-policy:version-2',
      },
      appliedRevision: null,
      completedAt: '2026-09-17T04:00:00Z',
    },
    createdAt: '2026-09-17T03:59:00Z',
    updatedAt: '2026-09-17T04:00:00Z',
  };
}

function runtimeCapabilities(): DwaionRoutineRuntimeCapabilities {
  const available = { available: true, configured: true, reasonCode: null, recoveryHint: null };
  return {
    lifecycleMode: 'ACTIVE_RUNTIME',
    activationAvailable: true,
    schedulingAvailable: true,
    backgroundExecutionAvailable: true,
    dryRunAvailable: true,
    pauseResumeAvailable: true,
    oneTimeScheduleAvailable: true,
    activeWindowPreviewAvailable: true,
    quietHoursPreviewAvailable: true,
    quietHoursDeliveryEnforcementAvailable: true,
    holidayPolicyAvailable: true,
    costBudgetAvailable: true,
    runtimeBudgetAvailable: true,
    notificationDeliveryAvailable: true,
    proposalDeliveryAvailable: true,
    externalWriteAvailable: false,
    webhookTriggerAvailable: true,
    agentKernelBinding: available,
    whitelistedSourceBinding: available,
    blockedSourcePolicy: available,
    zeroWritePolicy: available,
    semanticVersionDiff: available,
    runtimeBudgetRetry: available,
    automaticQuarantine: available,
    changeApproval: available,
    agentSwitching: available,
    wormDelivery: available,
    oauthReauthorization: available,
    temporaryBudgetIncrease: available,
    operatorEscalation: available,
    providerRollback: available,
    executionProviderState: 'AVAILABLE',
    recoveryHint: null,
    supportedCadences: ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'],
    consentScopes: ['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY'],
  };
}

function createRun(
  routineRunId: string,
  state: DwaionRoutineExecutionRun['state'],
  receiptId: string | null
): DwaionRoutineExecutionRun {
  return {
    routineRunId,
    routineId: ROUTINE.routineId,
    routineRevision: ROUTINE.revision,
    trigger: 'SCHEDULED',
    state,
    version: 2,
    attemptCount: 1,
    maximumAttempts: 3,
    scheduledFor: '2026-09-17T03:59:00Z',
    nextAttemptAt: null,
    startedAt: '2026-09-17T03:59:30Z',
    completedAt: '2026-09-17T04:00:00Z',
    evidenceCount: 7,
    proposalsCreated: 3,
    approvalGatedActionsCreated: 2,
    tokensUsed: 32_000,
    elapsedMs: 4_200,
    notificationState: 'DELIVERED',
    safeErrorCode: state === 'PARTIAL' ? 'PROVIDER_PARTIAL' : null,
    recoveryHint: state === 'PARTIAL' ? 'Retry after provider recovery.' : null,
    recoveryAction: null,
    recoveryCommandId: null,
    compensationRequired: false,
    receipt: receiptId
      ? {
          receiptId,
          routineRunId,
          routineId: ROUTINE.routineId,
          routineRevision: ROUTINE.revision,
          terminalState: state as 'COMPLETED' | 'COMPENSATED',
          providerReceiptId: `provider-${routineRunId}`,
          resultSha256: `sha-${routineRunId}`,
          evidenceCount: 7,
          proposalsCreated: 3,
          approvalGatedActionsCreated: 2,
          externalWritesPerformed: 0,
          notificationState: 'DELIVERED',
          authorizationDecisionRevision: 19,
          authorizedSources: ['WORK_ITEM'],
          recoveryAction: null,
          recoveryCommandId: null,
          completedAt: '2026-09-17T04:00:00Z',
        }
      : null,
    createdAt: '2026-09-17T03:59:00Z',
    updatedAt: '2026-09-17T04:00:00Z',
  };
}
