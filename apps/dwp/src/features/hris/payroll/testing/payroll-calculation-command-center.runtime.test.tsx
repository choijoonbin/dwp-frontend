// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { PayrollCalculationCommandCenterView } from '../pages/hris-payroll-calculation-command-center';
import { usePayrollCalculationCommandCenter } from '../hooks/use-payroll-calculation-command-center';
import {
  selectPayrollCalculationReceipt,
  selectPayrollCalculationRun,
} from '../model/payroll-calculation-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { PayrollCalculationDataSource } from '../api/payroll-calculation-api';
import type {
  PayrollCalculationCommandBinding,
  PayrollCalculationCommandExecutor,
  PayrollCalculationOwnerBinding,
  PayrollCalculationScope,
} from '../hooks/use-payroll-calculation-command-center';
import type {
  PayrollCalculationCommandKind,
  PayrollCalculationReceipt,
  PayrollRunState,
} from '../model/payroll-calculation-contract';

const ids = Object.freeze({
  ready: '30000000-0000-4000-8000-000000000001',
  failed: '30000000-0000-4000-8000-000000000002',
  unknown: '30000000-0000-4000-8000-000000000003',
  period: '30000000-0000-4000-8000-000000000004',
  receipt: '30000000-0000-4000-8000-000000000005',
  subject: '30000000-0000-4000-8000-000000000006',
});

const scope: PayrollCalculationScope = {
  ready: true,
  contextScopeKey: 'tenant:9/pay-group:11',
  decisionRevision: 'decision:payroll:41',
};

const legacyAuthority = {
  mode: 'LEGACY_COMPATIBILITY',
  rolloutState: '000',
} as const satisfies ProductSurfaceGovernedMutationAuthority;

function idsFactory() {
  let index = 100;
  return () => `30000000-0000-4000-8000-${String(index++).padStart(12, '0')}`;
}

function run(runId: string = ids.ready, state: PayrollRunState = 'READY', version = 4) {
  return selectPayrollCalculationRun({
    runId,
    runType: 'REGULAR',
    payPeriodId: ids.period,
    state,
    workerCount: 82,
    gross: { amount: '250000.0000', currency: 'USD' },
    net: { amount: '201250.0000', currency: 'USD' },
    version,
  });
}

const pair = {
  CALCULATE: ['RUN_CALCULATE', 'PAY_RUN_CALCULATE'],
  APPROVE: ['RUN_APPROVE', 'PAY_RUN_APPROVE'],
  FINALIZE: ['RUN_FINALIZE', 'PAY_RUN_FINALIZE'],
} as const;

function receipt(
  kind: PayrollCalculationCommandKind,
  correlationId: string,
  status: PayrollCalculationReceipt['status'] = 'SUCCEEDED'
) {
  return selectPayrollCalculationReceipt({
    receiptId: ids.receipt,
    commandType: pair[kind][0],
    originatingAction: pair[kind][1],
    subjectPrincipalPublicId: ids.subject,
    populationScopeDigest: 'c'.repeat(64),
    fieldPolicyRevision: 41,
    purposeCode: 'PAYROLL_PROCESSING',
    authorizationRevision: 41,
    status,
    correlationId,
    requestDigest: 'd'.repeat(64),
    createdAt: '2026-10-14T06:00:00Z',
    aggregateVersion: 5,
    resultRef: 'payroll-run:attempt:5',
  });
}

function source(overrides: Partial<PayrollCalculationDataSource> = {}) {
  const dataSource: PayrollCalculationDataSource = {
    run: vi.fn().mockResolvedValue(run()),
    calculate: vi
      .fn()
      .mockImplementation((_runId, _request, authority) =>
        Promise.resolve(receipt('CALCULATE', authority.correlationId))
      ),
    approve: vi
      .fn()
      .mockImplementation((_runId, _request, authority) =>
        Promise.resolve(receipt('APPROVE', authority.correlationId))
      ),
    finalize: vi
      .fn()
      .mockImplementation((_runId, _request, authority) =>
        Promise.resolve(receipt('FINALIZE', authority.correlationId))
      ),
    receipt: vi.fn(),
    ...overrides,
  };
  return dataSource;
}

function executor(
  observed: PayrollCalculationCommandBinding[] = []
): PayrollCalculationCommandExecutor {
  return async <T,>(
    execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
    binding: PayrollCalculationCommandBinding
  ) => {
    observed.push(binding);
    if (binding.kind === 'CALCULATE') return execute(legacyAuthority);
    return execute({
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: binding.decisionRevision,
      contextKey: 'hcm.operations.payroll',
      contextScopeKey: binding.contextScopeKey,
      objectVersion: binding.expectedVersion,
      idempotencyKey: binding.idempotencyKey,
      stepUp: {
        challenge: 'signed-payroll-high-risk-command',
        challengeId: 'payroll-high-risk-challenge',
        decisionRevision: binding.decisionRevision,
        expiresAt: '2099-01-01T00:00:00Z',
      },
    });
  };
}

function owner(
  dataSource: PayrollCalculationDataSource,
  observed: PayrollCalculationCommandBinding[] = []
): PayrollCalculationOwnerBinding {
  return {
    run: { contractId: 'PEP-PAY-013', read: dataSource.run },
    calculate: { contractId: 'PEP-PAY-012', execute: executor(observed) },
    approve: { contractId: 'PEP-PAY-017', execute: executor(observed) },
    finalize: { contractId: 'PEP-PAY-018', execute: executor(observed) },
    receipt: { contractId: 'PEP-PAY-033', read: dataSource.receipt },
  };
}

const fixedNow = () => Date.parse('2026-10-14T06:00:00Z');

function Runtime({
  runIds,
  receiptIds,
  dataSource,
  binding,
  runtimeScope = scope,
  idFactory,
  now = fixedNow,
  staleAfterMs = 60_000,
}: Readonly<{
  runIds: readonly string[];
  receiptIds?: readonly string[];
  dataSource: PayrollCalculationDataSource;
  binding?: PayrollCalculationOwnerBinding;
  runtimeScope?: PayrollCalculationScope;
  idFactory: () => string;
  now?: () => number;
  staleAfterMs?: number;
}>) {
  const controller = usePayrollCalculationCommandCenter({
    runIds,
    ...(receiptIds ? { receiptIds } : {}),
    scope: runtimeScope,
    ownerBinding: binding,
    dataSource,
    idFactory,
    now,
    staleAfterMs,
  });
  return <PayrollCalculationCommandCenterView controller={controller} />;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!(result instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return result;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
}

describe('[SLICE:BASE-TFR-PAY-011] payroll calculation command center', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  async function renderRuntime(
    dataSource: PayrollCalculationDataSource,
    binding: PayrollCalculationOwnerBinding | undefined = owner(dataSource),
    options: Partial<React.ComponentProps<typeof Runtime>> = {}
  ) {
    const idFactory = options.idFactory ?? idsFactory();
    await act(async () => {
      root.render(
        <Runtime
          runIds={[ids.ready]}
          dataSource={dataSource}
          binding={binding}
          idFactory={idFactory}
          {...options}
        />
      );
    });
    await settle();
  }

  it('renders responsive exception-first list/detail evidence and executes CAS calculation', async () => {
    const observed: PayrollCalculationCommandBinding[] = [];
    const dataSource = source({
      run: vi.fn().mockImplementation((runId) => {
        if (runId === ids.failed) return Promise.resolve(run(runId, 'FAILED'));
        if (runId === ids.unknown) return Promise.resolve(run(runId, 'RESULT_UNKNOWN'));
        return Promise.resolve(run(runId));
      }),
    });
    await renderRuntime(dataSource, owner(dataSource, observed), {
      runIds: [ids.ready, ids.failed, ids.unknown],
    });

    const listText = host.querySelector('section')?.textContent ?? '';
    expect(listText.indexOf('RESULT_UNKNOWN')).toBeLessThan(listText.indexOf('FAILED'));
    expect(
      host.querySelector('[data-testid="payroll-calculation-responsive-grid"]')
    ).not.toBeNull();
    expect(host.textContent).toContain('Receipt and recovery evidence');

    const inspectReady = host.querySelector(
      `button[aria-label="Inspect: REGULAR ${ids.ready.slice(0, 8)}…${ids.ready.slice(-4)}"]`
    );
    if (!(inspectReady instanceof HTMLButtonElement)) throw new Error('Missing ready-run control.');
    await act(async () => inspectReady.click());
    const calculate = button('Calculate run');
    calculate.focus();
    expect(document.activeElement).toBe(calculate);
    await act(async () => calculate.click());
    expect(document.body.textContent).toContain('Creates one calculation attempt');
    await act(async () => button('Confirm controlled action').click());
    await settle();

    expect(observed[0]).toMatchObject({
      kind: 'CALCULATE',
      runId: ids.ready,
      expectedVersion: 4,
      request: { reasonCode: 'PAYROLL_CALCULATION' },
    });
    expect(dataSource.calculate).toHaveBeenCalledWith(
      ids.ready,
      { reasonCode: 'PAYROLL_CALCULATION' },
      expect.objectContaining({ expectedObjectVersion: 4 })
    );
    expect(host.textContent).toContain('Payroll command completed');
  });

  it('reconciles RUNNING and RESULT_UNKNOWN through the durable receipt before refresh', async () => {
    let firstCorrelation = '';
    const dataSource = source({
      calculate: vi.fn().mockImplementation((_runId, _request, authority) => {
        firstCorrelation = authority.correlationId;
        return Promise.resolve(receipt('CALCULATE', authority.correlationId, 'RUNNING'));
      }),
      receipt: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(receipt('CALCULATE', firstCorrelation, 'SUCCEEDED'))
        ),
    });
    await renderRuntime(dataSource);

    await act(async () => button('Calculate run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(host.textContent).toContain('Command outcome needs reconciliation');
    expect(host.textContent).not.toContain('Retry exact command');

    await act(async () => button('Check durable receipt').click());
    await settle();
    expect(dataSource.receipt).toHaveBeenCalledWith(
      ids.receipt,
      expect.objectContaining({ contextScopeKey: scope.contextScopeKey })
    );
    expect(host.textContent).toContain('Payroll command completed');
  });

  it('rejects substituted immutable receipt identity and keeps reconciliation actionable', async () => {
    let firstCorrelation = '';
    const dataSource = source({
      calculate: vi.fn().mockImplementation((_runId, _request, authority) => {
        firstCorrelation = authority.correlationId;
        return Promise.resolve(receipt('CALCULATE', authority.correlationId, 'RUNNING'));
      }),
      receipt: vi.fn().mockImplementation(() =>
        Promise.resolve({
          ...receipt('CALCULATE', firstCorrelation, 'SUCCEEDED'),
          subjectPrincipalPublicId: ids.failed,
        })
      ),
    });
    await renderRuntime(dataSource);

    await act(async () => button('Calculate run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    await act(async () => button('Check durable receipt').click());
    await settle();

    expect(host.textContent).toContain('Command outcome needs reconciliation');
    expect(host.textContent).not.toContain('Payroll command completed');
    expect(button('Check durable receipt').disabled).toBe(false);
  });

  it('keeps opaque receipt-read failures recoverable and blocks commands without PEP-PAY-033', async () => {
    const deniedReceiptSource = source({
      calculate: vi
        .fn()
        .mockImplementation((_runId, _request, authority) =>
          Promise.resolve(receipt('CALCULATE', authority.correlationId, 'RUNNING'))
        ),
      receipt: vi.fn().mockRejectedValue(new HttpError('opaque', 404)),
    });
    await renderRuntime(deniedReceiptSource);
    await act(async () => button('Calculate run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    await act(async () => button('Check durable receipt').click());
    await settle();
    expect(host.textContent).toContain('Command outcome needs reconciliation');
    expect(button('Check durable receipt').disabled).toBe(false);

    const unboundSource = source();
    const complete = owner(unboundSource);
    const withoutReceipt: PayrollCalculationOwnerBinding = {
      run: complete.run,
      calculate: complete.calculate,
      approve: complete.approve,
      finalize: complete.finalize,
    };
    await renderRuntime(unboundSource, withoutReceipt, {
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:no-receipt-reader' },
    });
    expect(button('Calculate run').disabled).toBe(true);
    expect(unboundSource.calculate).not.toHaveBeenCalled();
  });

  it('does not let an old-scope receipt rejection write feedback or busy state into a new scope', async () => {
    const oldRead = deferred<PayrollCalculationReceipt>();
    const oldSource = source({
      calculate: vi
        .fn()
        .mockImplementation((_runId, _request, authority) =>
          Promise.resolve(receipt('CALCULATE', authority.correlationId, 'RUNNING'))
        ),
      receipt: vi.fn(() => oldRead.promise),
    });
    await renderRuntime(oldSource);
    await act(async () => button('Calculate run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    await act(async () => button('Check durable receipt').click());

    const nextSource = source({ run: vi.fn().mockResolvedValue(run(ids.failed, 'FAILED')) });
    await act(async () => {
      root.render(
        <Runtime
          runIds={[ids.failed]}
          dataSource={nextSource}
          binding={owner(nextSource)}
          runtimeScope={{ ...scope, decisionRevision: 'decision:payroll:reconciled-scope' }}
          idFactory={idsFactory()}
        />
      );
    });
    await act(async () => oldRead.reject(new HttpError('old scope', 404)));
    await settle();

    expect(host.textContent).not.toContain('Command outcome needs reconciliation');
    expect(host.textContent).not.toContain('Payroll command was not completed');
    expect(button('Refresh evidence').disabled).toBe(false);
  });

  it('loads caller-provided receipt evidence only through the exact receipt owner', async () => {
    const dataSource = source({
      receipt: vi
        .fn()
        .mockResolvedValue(receipt('CALCULATE', '30000000-0000-4000-8000-000000000099')),
    });
    await renderRuntime(dataSource, owner(dataSource), { receiptIds: [ids.receipt] });

    expect(dataSource.receipt).toHaveBeenCalledWith(
      ids.receipt,
      expect.objectContaining({
        contextScopeKey: scope.contextScopeKey,
        signal: expect.any(AbortSignal),
      })
    );
    expect(host.textContent).toContain(ids.receipt);
    expect(host.textContent).toContain('payroll-run:attempt:5');
  });

  it('replays a transport-uncertain command with the same key, correlation and body', async () => {
    const observed: PayrollCalculationCommandBinding[] = [];
    const calculate = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockImplementation((_runId, _request, authority) =>
        Promise.resolve(receipt('CALCULATE', authority.correlationId))
      );
    const dataSource = source({ calculate });
    await renderRuntime(dataSource, owner(dataSource, observed));

    await act(async () => button('Calculate run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(host.textContent).toContain('Retry exact command');

    await act(async () => button('Retry exact command').click());
    await settle();
    expect(observed).toHaveLength(2);
    expect(observed[1]).toMatchObject({
      idempotencyKey: observed[0]!.idempotencyKey,
      correlationId: observed[0]!.correlationId,
      expectedVersion: observed[0]!.expectedVersion,
    });
    expect(observed[1]!.request).toBe(observed[0]!.request);
  });

  it('requires exact high-risk owner bindings for approval and finalization', async () => {
    const observed: PayrollCalculationCommandBinding[] = [];
    const validatedSource = source({
      run: vi.fn().mockResolvedValue(run(ids.ready, 'VALIDATED', 8)),
    });
    await renderRuntime(validatedSource, owner(validatedSource, observed));
    await act(async () => button('Approve run').click());
    expect(document.body.textContent).toContain('maker-checker verification');
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(observed[0]).toMatchObject({
      kind: 'APPROVE',
      expectedVersion: 8,
      request: { reasonCode: 'PAYROLL_APPROVAL' },
    });

    const approvedSource = source({
      run: vi.fn().mockResolvedValue(run(ids.ready, 'APPROVED', 9)),
    });
    await renderRuntime(approvedSource, owner(approvedSource, observed), {
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:42' },
    });
    await act(async () => button('Finalize payroll').click());
    expect(document.body.textContent).toContain('Corrections require a new run');
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(observed.at(-1)).toMatchObject({
      kind: 'FINALIZE',
      expectedVersion: 9,
      request: { reasonCode: 'PAYROLL_FINALIZATION' },
    });
  });

  it('hides prior run evidence synchronously when scope, run set, or owner changes', async () => {
    const firstSource = source();
    await renderRuntime(firstSource);
    expect(host.textContent).toContain(ids.ready);

    const next = deferred<ReturnType<typeof run>>();
    const nextSource = source({ run: vi.fn(() => next.promise) });
    const nextBinding = owner(nextSource);
    act(() => {
      flushSync(() => {
        root.render(
          <Runtime
            runIds={[ids.failed]}
            dataSource={nextSource}
            binding={nextBinding}
            runtimeScope={{ ...scope, decisionRevision: 'decision:payroll:new-scope' }}
            idFactory={idsFactory()}
          />
        );
      });
      expect(host.textContent).not.toContain(ids.ready);
      expect(host.textContent).toContain('Loading payroll runs');
      expect(host.querySelector('button[aria-label^="Inspect:"]')).toBeNull();
    });
    await act(async () => next.resolve(run(ids.failed, 'FAILED')));
    await settle();
  });

  it('rejects stale secure authority and every legacy high-risk downgrade before transport', async () => {
    const staleSource = source({ run: vi.fn().mockResolvedValue(run(ids.ready, 'VALIDATED', 8)) });
    const staleApprove: PayrollCalculationCommandExecutor = async (execute, binding) =>
      execute({
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: 'stale-decision',
        contextKey: 'hcm.operations.payroll',
        contextScopeKey: 'tenant:other/pay-group:other',
        objectVersion: binding.expectedVersion,
        idempotencyKey: binding.idempotencyKey,
        stepUp: {
          challenge: 'stale-step-up',
          challengeId: 'stale-challenge',
          decisionRevision: 'stale-decision',
          expiresAt: '2099-01-01T00:00:00Z',
        },
      });
    await renderRuntime(staleSource, {
      ...owner(staleSource),
      approve: { contractId: 'PEP-PAY-017', execute: staleApprove },
    });
    await act(async () => button('Approve run').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(staleSource.approve).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Payroll command was not completed');

    const legacySource = source({ run: vi.fn().mockResolvedValue(run(ids.ready, 'APPROVED', 9)) });
    const legacyFinalize: PayrollCalculationCommandExecutor = async (execute) =>
      execute(legacyAuthority);
    await renderRuntime(
      legacySource,
      {
        ...owner(legacySource),
        finalize: { contractId: 'PEP-PAY-018', execute: legacyFinalize },
      },
      { runtimeScope: { ...scope, decisionRevision: 'decision:payroll:legacy-check' } }
    );
    await act(async () => button('Finalize payroll').click());
    await act(async () => button('Confirm controlled action').click());
    await settle();
    expect(legacySource.finalize).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Payroll command was not completed');
  });

  it('cancels deferred step-up dispatch when its exact scope changes', async () => {
    const authorityGate = deferred<void>();
    const oldSource = source({
      run: vi.fn().mockResolvedValue(run(ids.ready, 'VALIDATED', 8)),
    });
    const delayedApprove: PayrollCalculationCommandExecutor = async (execute, binding) => {
      await authorityGate.promise;
      return execute({
        mode: 'SECURE',
        rolloutState: '111',
        expectedDecisionRevision: binding.decisionRevision,
        contextKey: 'hcm.operations.payroll',
        contextScopeKey: binding.contextScopeKey,
        objectVersion: binding.expectedVersion,
        idempotencyKey: binding.idempotencyKey,
        stepUp: {
          challenge: 'signed-payroll-high-risk-command',
          challengeId: 'payroll-high-risk-challenge',
          decisionRevision: binding.decisionRevision,
          expiresAt: '2099-01-01T00:00:00Z',
        },
      });
    };
    await renderRuntime(oldSource, {
      ...owner(oldSource),
      approve: { contractId: 'PEP-PAY-017', execute: delayedApprove },
    });
    await act(async () => button('Approve run').click());
    await act(async () => button('Confirm controlled action').click());

    const nextSource = source();
    await act(async () => {
      root.render(
        <Runtime
          runIds={[ids.ready]}
          dataSource={nextSource}
          binding={owner(nextSource)}
          runtimeScope={{ ...scope, decisionRevision: 'decision:payroll:after-step-up' }}
          idFactory={idsFactory()}
        />
      );
    });
    await act(async () => authorityGate.resolve());
    await settle();

    expect(oldSource.approve).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Command outcome needs reconciliation');
    expect(button('Calculate run').disabled).toBe(false);
  });

  it('covers loading, empty, opaque denied, partial and stale states fail-closed', async () => {
    const pending = deferred<ReturnType<typeof run>>();
    const loadingSource = source({ run: vi.fn(() => pending.promise) });
    const factory = idsFactory();
    await act(async () => {
      root.render(
        <Runtime
          runIds={[ids.ready]}
          dataSource={loadingSource}
          binding={owner(loadingSource)}
          idFactory={factory}
        />
      );
    });
    expect(host.textContent).toContain('Loading payroll runs');
    await act(async () => pending.resolve(run()));
    await settle();

    await renderRuntime(source(), owner(source()), { runIds: [] });
    expect(host.textContent).toContain('No payroll runs in this workspace');

    const deniedSource = source({ run: vi.fn().mockRejectedValue(new HttpError('opaque', 404)) });
    await renderRuntime(deniedSource, owner(deniedSource), {
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:43' },
    });
    expect(host.textContent).toContain('Payroll run access is not authorized');

    const partialSource = source({
      run: vi
        .fn()
        .mockImplementation((runId) =>
          runId === ids.failed ? Promise.reject(new Error('owner timeout')) : Promise.resolve(run())
        ),
    });
    await renderRuntime(partialSource, owner(partialSource), {
      runIds: [ids.ready, ids.failed],
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:44' },
    });
    expect(host.textContent).toContain('Some runs could not be disclosed');
    expect(button('Calculate run').disabled).toBe(true);

    const staleSource = source();
    await renderRuntime(staleSource, owner(staleSource), {
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:45' },
      staleAfterMs: 0,
    });
    expect(host.textContent).toContain('Payroll evidence may be stale');
    expect(button('Calculate run').disabled).toBe(true);
  });

  it('crosses the freshness deadline without an external render and blocks dispatch', async () => {
    let clock = fixedNow();
    const dataSource = source();
    await renderRuntime(dataSource, owner(dataSource), {
      runtimeScope: { ...scope, decisionRevision: 'decision:payroll:deadline' },
      now: () => clock,
      staleAfterMs: 20,
    });
    expect(button('Calculate run').disabled).toBe(false);

    clock += 20;
    await act(async () => {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 35));
    });

    expect(host.textContent).toContain('Payroll evidence may be stale');
    expect(button('Calculate run').disabled).toBe(true);
    expect(dataSource.calculate).not.toHaveBeenCalled();
  });

  it('fails closed without the owner binding while retaining zoom-safe semantic controls', async () => {
    const dataSource = source();
    await act(async () => {
      root.render(
        <Runtime runIds={[ids.ready]} dataSource={dataSource} idFactory={idsFactory()} />
      );
    });
    await settle();
    expect(host.textContent).toContain('Payroll run access is not authorized');
    expect(dataSource.run).not.toHaveBeenCalled();
    const commandCenter = host.querySelector('[data-testid="payroll-calculation-command-center"]');
    expect(commandCenter?.getAttribute('data-feature-state')).toBe('owner-activation-required');
    expect(host.querySelector('h1')?.textContent).toContain('Payroll calculation command center');
    expect(button('Refresh evidence').getAttribute('type')).toBe('button');
  });
});
