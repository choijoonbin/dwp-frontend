// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

import enHcm from '../../../../../../../../libs/shared-i18n/src/locales/en/hcm.json';

import {
  HrisTimeWorkPlanStudio,
  HrisTimeWorkPlanStudioRuntime,
  WORK_ARRANGEMENT_KINDS,
  createHrisTimeWorkPlanDataSource,
  createWorkPlanSimulationRequest,
  receiptNeedsReconciliation,
  selectWorkPlanSimulationCommand,
  selectWorkPlanStudioDisplay,
  workPlanSimulationBlockers,
} from '../../index';

import type {
  HrisTimeWorkPlanGovernedAuthority,
  HrisTimeWorkPlanHttpClient,
  WorkPlanStudioDataSource,
  WorkPlanStudioScope,
} from '../../index';

const readyScope: WorkPlanStudioScope = {
  ready: true,
  scopeKey: 'opaque-synthetic-scope-a',
  decisionRevision: 'decision-7',
  effectiveOn: '2026-03-08',
};

const workPlanStudioI18n = createInstance();

function withHcmI18n(children: ReactNode) {
  return createElement(I18nextProvider, { i18n: workPlanStudioI18n }, children);
}

async function governedSimulationExecutor<T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
): Promise<T> {
  return execute({
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: readyScope.decisionRevision,
    contextKey: 'hcm.operations.time.work-plan-simulation',
    contextScopeKey: readyScope.scopeKey,
  });
}

function workPlanSource(): Record<string, unknown> {
  return {
    queryState: 'COMPLETE',
    freshness: 'CURRENT',
    asOf: '2026-03-01T00:00:00Z',
    partialFailures: [],
    privateTenantContext: 'must-not-project',
    workPlans: [
      {
        workPlanId: 'work-plan-synthetic-1',
        title:
          'Synthetic overnight service plan — 장기 레이블 안전성 검증을 위한 매우 긴 근무 계획 이름',
        version: 7,
        lifecycle: 'IN_REVIEW',
        arrangement: { kind: 'SPLIT_SHIFT' },
        effectiveStart: '2026-01-01',
        effectiveEnd: '2026-12-31',
        timeZone: 'America/New_York',
        assignment: {
          assignmentId: 'assignment-synthetic-1',
          label: 'Synthetic night operations cohort',
          snapshotRevision: 'assignment-snapshot-12',
          freshness: 'CURRENT',
          privateWorkerName: 'must-not-project',
        },
        policyPack: {
          state: 'CURRENT',
          jurisdiction: 'SYNTHETIC-US-NY',
          effectiveOn: '2026-03-08',
          revision: 'pack-2026.1',
        },
        resolution: {
          state: 'RESOLVED',
          winningLevel: 'ASSIGNMENT',
          trace: [
            {
              level: 'JURISDICTION',
              label: 'Synthetic jurisdiction baseline',
              disposition: 'SHADOWED',
              policyCode: 'SYNTH-BASE',
              policyRevision: '3',
            },
            {
              level: 'JOB',
              label: 'Synthetic operations job policy',
              disposition: 'SHADOWED',
              policyCode: 'SYNTH-JOB',
              policyRevision: '5',
            },
            {
              level: 'EMPLOYMENT',
              label: 'Synthetic employment terms',
              disposition: 'SHADOWED',
              policyCode: 'SYNTH-EMPLOYMENT',
              policyRevision: '8',
            },
            {
              level: 'ASSIGNMENT',
              label: 'Synthetic assignment override',
              disposition: 'APPLIED',
              policyCode: 'SYNTH-ASSIGNMENT',
              policyRevision: '12',
            },
          ],
        },
        segments: [
          {
            segmentId: 'gap-segment',
            label: 'Synthetic spring transition',
            startInstant: '2026-03-08T06:30:00Z',
            endInstant: '2026-03-08T07:30:00Z',
            localStart: '2026-03-08 01:30',
            localEnd: '2026-03-08 03:30',
            startOffset: '-05:00',
            endOffset: '-04:00',
            overnight: false,
            dstResolution: 'EXACT',
          },
          {
            segmentId: 'fold-segment',
            label: 'Synthetic autumn transition',
            startInstant: '2026-11-01T05:30:00Z',
            endInstant: '2026-11-01T07:30:00Z',
            localStart: '2026-11-01 01:30',
            localEnd: '2026-11-01 02:30',
            startOffset: '-04:00',
            endOffset: '-05:00',
            overnight: false,
            dstResolution: 'FOLD_LATER',
          },
          {
            segmentId: 'overnight-segment',
            label: 'Synthetic overnight coverage',
            startInstant: '2026-11-02T03:00:00Z',
            endInstant: '2026-11-02T11:00:00Z',
            localStart: '2026-11-01 22:00',
            localEnd: '2026-11-02 06:00',
            startOffset: '-05:00',
            endOffset: '-05:00',
            overnight: true,
            dstResolution: 'EXACT',
          },
        ],
        availableActions: ['VALIDATE', 'SIMULATE'],
      },
    ],
  };
}

function commandSource(
  status: 'RESULT_UNKNOWN' | 'SUCCEEDED',
  receiptOverrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    receipt: {
      receiptId: 'receipt-synthetic-91',
      workPlanId: 'work-plan-synthetic-1',
      operation: 'SIMULATE',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      status,
      updatedAt: '2026-03-01T00:01:00Z',
      ...receiptOverrides,
    },
    simulation:
      status === 'SUCCEEDED'
        ? {
            workPlanId: 'work-plan-synthetic-1',
            baseVersion: 7,
            status: 'COMPLETE',
            generatedAt: '2026-03-01T00:01:00Z',
            policyRevision: 'pack-2026.1',
            rows: [
              {
                key: 'coverage',
                label: 'Synthetic covered assignments',
                currentValue: '12 assignments',
                draftValue: '11 assignments',
                impact: 'WARNING',
              },
            ],
            findings: ['One synthetic assignment needs an alternate schedule.'],
            partialFailures: [],
          }
        : null,
  };
}

function firstPlanSource(source: Record<string, unknown>): Record<string, unknown> {
  return (source.workPlans as Record<string, unknown>[])[0]!;
}

function buttonByText(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return button;
}

describe('[SLICE:BASE-TFR-TIM-016] Work Plan & Schedule Studio', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    await workPlanStudioI18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'hcm',
      ns: ['hcm'],
      resources: { en: { hcm: enHcm } },
      interpolation: { escapeValue: false },
    });
  });

  beforeEach(async () => {
    await workPlanStudioI18n.changeLanguage('en');
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

  it('projects the typed catalog, precedence, server timing, and excludes adjacent private data', () => {
    const selected = selectWorkPlanStudioDisplay(workPlanSource());
    const plan = selected.workPlans[0]!;

    expect(WORK_ARRANGEMENT_KINDS).toEqual([
      'FIXED',
      'FLEX',
      'AVERAGED',
      'SELECTIVE',
      'COMPRESSED',
      'PART_TIME',
      'REDUCED',
      'SPLIT_SHIFT',
      'SHIFT',
      'ON_CALL',
      'DEEMED',
      'DISCRETIONARY',
      'TENANT_EXTENSION',
    ]);
    expect(plan.lifecycle).toBe('IN_REVIEW');
    expect(plan.resolution.trace.map((step) => step.level)).toEqual([
      'JURISDICTION',
      'JOB',
      'EMPLOYMENT',
      'ASSIGNMENT',
    ]);
    expect(plan.segments.map((segment) => [segment.startOffset, segment.endOffset])).toEqual([
      ['-05:00', '-04:00'],
      ['-04:00', '-05:00'],
      ['-05:00', '-05:00'],
    ]);
    expect(plan.segments[2]?.overnight).toBe(true);
    expect(JSON.stringify(selected)).not.toContain('privateWorkerName');
    expect(JSON.stringify(selected)).not.toContain('privateTenantContext');
  });

  it('requires server-owned local timing and validates an IANA zone even with no segments', () => {
    const mismatched = workPlanSource();
    const mismatchedPlan = firstPlanSource(mismatched);
    const segment = (mismatchedPlan.segments as Record<string, unknown>[])[0]!;
    segment.localStart = '2026-03-08 06:30';
    expect(() => selectWorkPlanStudioDisplay(mismatched)).toThrow(
      'Work plan studio source payload is invalid.'
    );

    const fixedOffset = workPlanSource();
    const fixedOffsetPlan = firstPlanSource(fixedOffset);
    fixedOffsetPlan.timeZone = '-05:00';
    fixedOffsetPlan.segments = [];
    expect(() => selectWorkPlanStudioDisplay(fixedOffset)).toThrow(
      'Work plan studio source payload is invalid.'
    );
  });

  it('fails closed for partial, stale, unavailable, and every unresolved policy state', () => {
    const cases: Array<[string, (source: Record<string, unknown>) => void]> = [
      ['QUERY_PARTIAL', (source) => (source.queryState = 'PARTIAL')],
      ['WORKSPACE_STALE', (source) => (source.freshness = 'STALE')],
      [
        'ASSIGNMENT_STALE',
        (source) =>
          ((firstPlanSource(source).assignment as Record<string, unknown>).freshness = 'STALE'),
      ],
      [
        'POLICY_OVERLAP',
        (source) =>
          ((firstPlanSource(source).resolution as Record<string, unknown>).state = 'OVERLAP'),
      ],
      [
        'POLICY_NO_APPLICABLE_POLICY',
        (source) =>
          ((firstPlanSource(source).resolution as Record<string, unknown>).state =
            'NO_APPLICABLE_POLICY'),
      ],
      [
        'POLICY_PACK_MISSING',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'MISSING';
          (plan.resolution as Record<string, unknown>).state = 'PACK_MISSING';
        },
      ],
      [
        'POLICY_PACK_REVOKED',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'REVOKED';
          (plan.resolution as Record<string, unknown>).state = 'REVOKED';
        },
      ],
      [
        'POLICY_PACK_EXPIRED',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'EXPIRED';
          (plan.resolution as Record<string, unknown>).state = 'PACK_EXPIRED';
        },
      ],
      [
        'POLICY_PACK_OUT_OF_RANGE',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'OUT_OF_RANGE';
          (plan.resolution as Record<string, unknown>).state = 'OUT_OF_RANGE';
        },
      ],
      [
        'POLICY_PACK_INVALID',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'INVALID';
          (plan.resolution as Record<string, unknown>).state = 'INVALID';
        },
      ],
      [
        'POLICY_PACK_SIGNATURE_INVALID',
        (source) => {
          const plan = firstPlanSource(source);
          (plan.policyPack as Record<string, unknown>).state = 'SIGNATURE_INVALID';
          (plan.resolution as Record<string, unknown>).state = 'SIGNATURE_INVALID';
        },
      ],
    ];

    for (const [expectedBlocker, change] of cases) {
      const source = workPlanSource();
      change(source);
      const selected = selectWorkPlanStudioDisplay(source);
      const plan = selected.workPlans[0]!;
      expect(workPlanSimulationBlockers(selected, plan)).toContain(expectedBlocker);
      expect(createWorkPlanSimulationRequest(selected, plan)).toBeNull();
    }

    const unavailableSource = workPlanSource();
    unavailableSource.queryState = 'UNAVAILABLE';
    unavailableSource.freshness = 'UNAVAILABLE';
    unavailableSource.workPlans = [];
    const unavailable = selectWorkPlanStudioDisplay(unavailableSource);
    expect(unavailable.queryState).toBe('UNAVAILABLE');
    expect(unavailable.workPlans).toHaveLength(0);
  });

  it('renders responsive semantic catalog alternatives and a server-owned diff without publish authority', () => {
    const workspace = selectWorkPlanStudioDisplay(workPlanSource());
    const command = selectWorkPlanSimulationCommand(commandSource('SUCCEEDED'));
    act(() => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudio, {
            workspace,
            selectedWorkPlanId: workspace.workPlans[0]!.workPlanId,
            simulationCommand: command,
            onSelect: vi.fn(),
            onSimulate: vi.fn(),
          })
        )
      );
    });

    expect(host.querySelector('table[aria-label="Work plan catalog"]')).not.toBeNull();
    expect(host.querySelector('ul[aria-label="Work plan agenda"]')).not.toBeNull();
    expect(
      host.querySelector('table[aria-label="Date-resolved schedule segments"]')
    ).not.toBeNull();
    expect(
      host.querySelector('table[aria-label="Current and draft simulation differences"]')
    ).not.toBeNull();
    expect(host.textContent).toContain('2026-03-08 01:30 (-05:00)');
    expect(host.textContent).toContain('2026-03-08 03:30 (-04:00)');
    expect(host.textContent).toContain('Publishing is intentionally separate');
    expect(host.textContent).toContain('장기 레이블 안전성 검증');
    expect(buttonByText(host, 'Run server simulation').disabled).toBe(false);
  });

  it('does not read before scope readiness and reconciles RESULT_UNKNOWN using the same receipt', async () => {
    const read = vi.fn((_scope: WorkPlanStudioScope, _signal: AbortSignal) =>
      Promise.resolve(workPlanSource())
    );
    const simulate = vi.fn(
      (
        _request: Parameters<WorkPlanStudioDataSource['simulate']>[0],
        _scope: WorkPlanStudioScope,
        _signal: AbortSignal
      ) => Promise.resolve(commandSource('RESULT_UNKNOWN'))
    );
    const reconcileReceipt = vi.fn(
      (
        _receipt: Parameters<WorkPlanStudioDataSource['reconcileReceipt']>[0],
        _scope: WorkPlanStudioScope,
        _signal: AbortSignal
      ) => Promise.resolve(commandSource('SUCCEEDED'))
    );
    const dataSource: WorkPlanStudioDataSource = { read, simulate, reconcileReceipt };
    const pendingScope = { ...readyScope, ready: false };

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudioRuntime, {
            requestScope: pendingScope,
            dataSource,
            simulationExecutor: governedSimulationExecutor,
          })
        )
      );
    });
    expect(read).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudioRuntime, {
            requestScope: readyScope,
            dataSource,
            simulationExecutor: governedSimulationExecutor,
          })
        )
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonByText(host, 'Run server simulation').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(simulate).toHaveBeenCalledTimes(1);
    const unknownCommand = selectWorkPlanSimulationCommand(commandSource('RESULT_UNKNOWN'));
    expect(receiptNeedsReconciliation(unknownCommand.receipt)).toBe(true);
    expect(host.textContent).toContain('do not submit a duplicate command');

    await act(async () => {
      buttonByText(host, 'Reconcile receipt').click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(reconcileReceipt).toHaveBeenCalledWith(
      unknownCommand.receipt,
      readyScope,
      expect.any(AbortSignal)
    );
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Current vs draft — server simulation');
  });

  it('calls the owner API adapter with effective scope, governed simulation, and same-receipt recovery', async () => {
    const get = vi.fn<HrisTimeWorkPlanHttpClient['get']>();
    const post = vi.fn<HrisTimeWorkPlanHttpClient['post']>();
    const client: HrisTimeWorkPlanHttpClient = { get, post };
    const authority: HrisTimeWorkPlanGovernedAuthority = (scope, signal) => ({
      decisionRevision: scope.decisionRevision,
      config: {
        contextScopeKey: scope.scopeKey,
        headers: { 'X-DWP-Expected-Decision-Revision': scope.decisionRevision },
        signal,
      },
    });
    const dataSource = createHrisTimeWorkPlanDataSource(
      client,
      () => '11111111-1111-4111-8111-111111111111',
      authority
    );
    const signal = new AbortController().signal;
    const catalog = workPlanSource();
    const pending = commandSource('RESULT_UNKNOWN');
    get.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: catalog },
    });
    post.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: pending },
    });
    get.mockResolvedValueOnce({
      data: { status: 'SUCCESS', message: '', data: commandSource('SUCCEEDED') },
    });

    await expect(dataSource.read(readyScope, signal)).resolves.toBe(catalog);
    expect(get).toHaveBeenNthCalledWith(1, '/api/time/v1/hris/work-plans?effectiveOn=2026-03-08', {
      contextScopeKey: 'opaque-synthetic-scope-a',
      signal,
    });

    const workspace = selectWorkPlanStudioDisplay(catalog);
    const request = createWorkPlanSimulationRequest(workspace, workspace.workPlans[0]!);
    if (!request) throw new Error('Expected a valid synthetic simulation request');
    await expect(dataSource.simulate(request, readyScope, signal)).resolves.toBe(pending);
    expect(post).toHaveBeenCalledWith(
      '/api/time/v1/hris/work-plans/work-plan-synthetic-1/simulations',
      expect.objectContaining({ expectedVersion: 7 }),
      {
        contextScopeKey: 'opaque-synthetic-scope-a',
        headers: {
          'Idempotency-Key': '11111111-1111-4111-8111-111111111111',
          'X-DWP-Expected-Decision-Revision': 'decision-7',
        },
        signal,
      }
    );

    const pendingReceipt = selectWorkPlanSimulationCommand(pending).receipt;
    await dataSource.reconcileReceipt(pendingReceipt, readyScope, signal);
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/api/time/v1/hris/work-plan-receipts/receipt-synthetic-91',
      { contextScopeKey: 'opaque-synthetic-scope-a', signal }
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not store a RESULT_UNKNOWN receipt owned by another work plan', async () => {
    const read = vi.fn(() => Promise.resolve(workPlanSource()));
    const simulate = vi.fn(() =>
      Promise.resolve(
        commandSource('RESULT_UNKNOWN', {
          workPlanId: 'work-plan-foreign',
        })
      )
    );
    const reconcileReceipt = vi.fn(() => Promise.resolve(commandSource('SUCCEEDED')));
    const dataSource: WorkPlanStudioDataSource = { read, simulate, reconcileReceipt };

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudioRuntime, {
            requestScope: readyScope,
            dataSource,
            simulationExecutor: governedSimulationExecutor,
          })
        )
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      buttonByText(host, 'Run server simulation').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(simulate).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain(
      'The server response did not match the selected work plan revision.'
    );
    expect(host.textContent).not.toContain('do not submit a duplicate command');
    expect(
      [...host.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Reconcile receipt')
      )
    ).toBe(false);
    expect(buttonByText(host, 'Run server simulation').disabled).toBe(false);
    expect(reconcileReceipt).not.toHaveBeenCalled();
  });

  it('suppresses a late response after an opaque scope transition', async () => {
    let resolveA: ((source: Record<string, unknown>) => void) | undefined;
    let resolveB: ((source: Record<string, unknown>) => void) | undefined;
    const responseA = new Promise<Record<string, unknown>>((resolve) => {
      resolveA = resolve;
    });
    const responseB = new Promise<Record<string, unknown>>((resolve) => {
      resolveB = resolve;
    });
    const read = vi.fn((scope: WorkPlanStudioScope) =>
      scope.scopeKey === 'opaque-synthetic-scope-a' ? responseA : responseB
    );
    const dataSource: WorkPlanStudioDataSource = {
      read,
      simulate: vi.fn(() => Promise.resolve(commandSource('RESULT_UNKNOWN'))),
      reconcileReceipt: vi.fn(() => Promise.resolve(commandSource('SUCCEEDED'))),
    };
    const scopeB: WorkPlanStudioScope = {
      ...readyScope,
      scopeKey: 'opaque-synthetic-scope-b',
      decisionRevision: 'decision-8',
    };

    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudioRuntime, { requestScope: readyScope, dataSource })
        )
      );
      await Promise.resolve();
    });
    await act(async () => {
      root.render(
        withHcmI18n(
          createElement(HrisTimeWorkPlanStudioRuntime, { requestScope: scopeB, dataSource })
        )
      );
      await Promise.resolve();
    });

    const sourceB = workPlanSource();
    firstPlanSource(sourceB).title = 'Synthetic scope B plan';
    await act(async () => {
      resolveB?.(sourceB);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain('Synthetic scope B plan');

    const sourceA = workPlanSource();
    firstPlanSource(sourceA).title = 'Synthetic late scope A plan';
    await act(async () => {
      resolveA?.(sourceA);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain('Synthetic late scope A plan');
    expect(host.textContent).toContain('Synthetic scope B plan');
  });
});
