// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  PayrollConfigurationWorkbenchRuntime,
  selectPayrollConfigurationWorkbench,
  selectPayrollFormulaReceipt,
} from '..';
import {
  PAY006_IDS,
  commandReceiptWire,
  workbenchWire,
} from './payroll-element-formula-fixtures.test-support';
import { payrollFormulaPublishCommand } from '../../integration/hris-payroll-configuration-workspace';

import type {
  PayrollConfigurationOwnerBinding,
  PayrollConfigurationScope,
  PayrollElementFormulaDataSource,
  PayrollFormulaCommandBinding,
  PayrollFormulaCommandExecutor,
  PayrollFormulaReceipt,
} from '..';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const scope: PayrollConfigurationScope = {
  ready: true,
  contextScopeKey: 'scope:tenant-300:payroll-settings',
  decisionRevision: 'decision:pay:37',
  locale: 'en-US',
  timeZone: 'Asia/Seoul',
  correlationId: PAY006_IDS.correlation,
};

const legacyAuthority = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

function commandIdFactory() {
  let counter = 10;
  return () => `40000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`;
}

function receipt(
  commandType: PayrollFormulaReceipt['commandType'],
  correlationId: string,
  overrides: Record<string, unknown> = {}
) {
  return selectPayrollFormulaReceipt(
    commandReceiptWire(commandType, { correlationId, ...overrides })
  );
}

function executor(
  beforeExecute: (binding: PayrollFormulaCommandBinding) => void = () => undefined
): PayrollFormulaCommandExecutor {
  return async <T,>(
    execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
    binding: PayrollFormulaCommandBinding
  ) => {
    beforeExecute(binding);
    return execute(legacyAuthority);
  };
}

function dataSource(overrides: Partial<PayrollElementFormulaDataSource> = {}) {
  const source: PayrollElementFormulaDataSource = {
    workbench: vi.fn().mockResolvedValue(selectPayrollConfigurationWorkbench(workbenchWire())),
    createElement: vi.fn(),
    createFormula: vi.fn(),
    validateFormula: vi
      .fn()
      .mockImplementation((_formulaId, _request, authority) =>
        Promise.resolve(receipt('VALIDATE_FORMULA', authority.correlationId))
      ),
    simulateFormula: vi
      .fn()
      .mockImplementation((_formulaId, _request, authority) =>
        Promise.resolve(receipt('SIMULATE_FORMULA', authority.correlationId))
      ),
    publishFormula: vi
      .fn()
      .mockImplementation((_formulaId, _request, authority) =>
        Promise.resolve(receipt('PUBLISH_FORMULA', authority.correlationId))
      ),
    ...overrides,
  };
  return source;
}

function ownerBinding(
  source: PayrollElementFormulaDataSource,
  overrides: Partial<PayrollConfigurationOwnerBinding> = {}
): PayrollConfigurationOwnerBinding {
  return {
    page: { contractId: 'IAQ-055', read: source.workbench },
    validate: { contractId: 'PEP-PAY-006', execute: executor() },
    simulate: { contractId: 'PEP-PAY-007', execute: executor() },
    publish: { contractId: 'PEP-PAY-008', execute: executor() },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
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

describe('[SLICE:BASE-TFR-PAY-006] payroll configuration workbench runtime', () => {
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

  async function render(
    source: PayrollElementFormulaDataSource,
    binding: PayrollConfigurationOwnerBinding | undefined = ownerBinding(source),
    runtimeScope: PayrollConfigurationScope = scope
  ) {
    await act(async () => {
      root.render(
        <PayrollConfigurationWorkbenchRuntime
          scope={runtimeScope}
          ownerBinding={binding}
          dataSource={source}
          idFactory={commandIdFactory()}
        />
      );
    });
    await settle();
  }

  it('renders the list-detail studio and executes exact validate and simulation commands', async () => {
    const source = dataSource();
    await render(source);

    expect(host.querySelector('[data-slice="BASE-TFR-PAY-006"]')).not.toBeNull();
    expect(host.querySelector('nav[aria-label="Payroll items and formulas"]')).not.toBeNull();
    expect(host.textContent).toContain('Base pay formula');
    expect(host.textContent).toContain('pay.formula.base-pay');
    expect(document.querySelector('label')?.textContent).toContain('Formula input key');

    await act(async () => button('Validate formula').click());
    await settle();
    expect(source.validateFormula).toHaveBeenCalledWith(
      PAY006_IDS.formula,
      { expectedVersion: 1 },
      expect.objectContaining({ expectedObjectVersion: 1 })
    );

    await act(async () => button('Simulate formula').click());
    await settle();
    expect(source.simulateFormula).toHaveBeenCalledWith(
      PAY006_IDS.formula,
      expect.objectContaining({
        expectedVersion: 1,
        inputs: { basePay: { type: 'MONEY', value: '100.00', currency: 'TST' } },
        timeoutMillis: 2_000,
      }),
      expect.objectContaining({ expectedObjectVersion: 1 })
    );
    expect(host.textContent).toContain('Payroll command completed');
  });

  it('shows publish step-up progress before dispatching the exact high-risk command', async () => {
    const gate = deferred<void>();
    const bindings: PayrollFormulaCommandBinding[] = [];
    const source = dataSource();
    const publish: PayrollFormulaCommandExecutor = async (execute, binding) => {
      bindings.push(binding);
      await gate.promise;
      return execute(
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'context:payroll-settings',
          contextScopeKey: scope.contextScopeKey,
          objectVersion: binding.expectedVersion,
          idempotencyKey: binding.idempotencyKey,
          stepUp: {
            challenge: 'signed-step-up-proof',
            challengeId: 'challenge-pay-006',
            decisionRevision: scope.decisionRevision,
            expiresAt: '2027-01-01T00:00:00Z',
          },
        },
        payrollFormulaPublishCommand(binding)
      );
    };
    await render(
      source,
      ownerBinding(source, { publish: { contractId: 'PEP-PAY-008', execute: publish } })
    );

    await act(async () => button('Publish formula').click());
    expect(document.body.textContent).toContain('Publish this payroll formula?');
    await act(async () => button('Continue to step-up').click());
    expect(document.body.textContent).toContain('Step-up verification is in progress');
    expect(source.publishFormula).not.toHaveBeenCalled();

    await act(async () => gate.resolve());
    await settle();
    expect(bindings).toHaveLength(1);
    expect(source.publishFormula).toHaveBeenCalledWith(
      PAY006_IDS.formula,
      { expectedVersion: 1 },
      expect.objectContaining({
        idempotencyKey: bindings[0]!.idempotencyKey,
        expectedObjectVersion: 1,
        governance: expect.objectContaining({ stepUp: expect.any(Object) }),
      })
    );
  });

  it('adopts an exact pre-dispatch challenge key and preserves it for ambiguous retry', async () => {
    const rotatedKey = '40000000-0000-4000-8000-000000000099';
    const observedBindings: PayrollFormulaCommandBinding[] = [];
    const observedDescriptors: ReturnType<typeof payrollFormulaPublishCommand>[] = [];
    const publishFormula = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockImplementation((_formulaId, _request, authority) =>
        Promise.resolve(receipt('PUBLISH_FORMULA', authority.correlationId))
      );
    const source = dataSource({ publishFormula });
    const publish: PayrollFormulaCommandExecutor = async (execute, binding) => {
      observedBindings.push(binding);
      const descriptor = payrollFormulaPublishCommand({
        ...binding,
        idempotencyKey: observedBindings.length === 1 ? rotatedKey : binding.idempotencyKey,
      });
      observedDescriptors.push(descriptor);
      return execute(
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'context:payroll-settings',
          contextScopeKey: scope.contextScopeKey,
          objectVersion: binding.expectedVersion,
          idempotencyKey: descriptor.idempotencyKey,
          stepUp: {
            challenge: 'signed-step-up-proof',
            challengeId: 'challenge-pay-006',
            decisionRevision: scope.decisionRevision,
            expiresAt: '2027-01-01T00:00:00Z',
          },
        },
        descriptor
      );
    };
    await render(
      source,
      ownerBinding(source, { publish: { contractId: 'PEP-PAY-008', execute: publish } })
    );

    await act(async () => button('Publish formula').click());
    await act(async () => button('Continue to step-up').click());
    await settle();
    expect(host.textContent).toContain('Payroll command outcome is unknown');

    await act(async () => button('Retry exact command').click());
    await settle();

    expect(publishFormula).toHaveBeenCalledTimes(2);
    expect(observedBindings).toHaveLength(2);
    expect(observedBindings[0]!.idempotencyKey).not.toBe(rotatedKey);
    expect(observedBindings[1]!.idempotencyKey).toBe(rotatedKey);
    expect(observedDescriptors.map((descriptor) => descriptor.idempotencyKey)).toEqual([
      rotatedKey,
      rotatedKey,
    ]);
    expect(publishFormula.mock.calls.map((call) => call[2].idempotencyKey)).toEqual([
      rotatedKey,
      rotatedKey,
    ]);
    expect(publishFormula.mock.calls[1]![1]).toBe(publishFormula.mock.calls[0]![1]);
  });

  it('fails closed when a publish descriptor changes the immutable formula binding', async () => {
    const source = dataSource();
    const publish: PayrollFormulaCommandExecutor = async (execute, binding) => {
      const descriptor = payrollFormulaPublishCommand({
        ...binding,
        formulaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
      return execute(
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'context:payroll-settings',
          contextScopeKey: scope.contextScopeKey,
          objectVersion: binding.expectedVersion,
          idempotencyKey: descriptor.idempotencyKey,
          stepUp: {
            challenge: 'signed-step-up-proof',
            challengeId: 'challenge-pay-006',
            decisionRevision: scope.decisionRevision,
            expiresAt: '2027-01-01T00:00:00Z',
          },
        },
        descriptor
      );
    };
    await render(
      source,
      ownerBinding(source, { publish: { contractId: 'PEP-PAY-008', execute: publish } })
    );

    await act(async () => button('Publish formula').click());
    await act(async () => button('Continue to step-up').click());
    await settle();

    expect(source.publishFormula).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Payroll command was rejected');
    expect(host.textContent).not.toContain('Retry exact command');
  });

  it('never rotates an already-dispatched key while retrying an ambiguous publication', async () => {
    const rotatedRetryKey = '40000000-0000-4000-8000-000000000099';
    const observedBindings: PayrollFormulaCommandBinding[] = [];
    const publishFormula = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const source = dataSource({ publishFormula });
    const publish: PayrollFormulaCommandExecutor = async (execute, binding) => {
      observedBindings.push(binding);
      const descriptor = payrollFormulaPublishCommand({
        ...binding,
        idempotencyKey: observedBindings.length === 1 ? binding.idempotencyKey : rotatedRetryKey,
      });
      return execute(
        {
          mode: 'SECURE',
          rolloutState: '111',
          expectedDecisionRevision: scope.decisionRevision,
          contextKey: 'context:payroll-settings',
          contextScopeKey: scope.contextScopeKey,
          objectVersion: binding.expectedVersion,
          idempotencyKey: descriptor.idempotencyKey,
          stepUp: {
            challenge: 'signed-step-up-proof',
            challengeId: 'challenge-pay-006',
            decisionRevision: scope.decisionRevision,
            expiresAt: '2027-01-01T00:00:00Z',
          },
        },
        descriptor
      );
    };
    await render(
      source,
      ownerBinding(source, { publish: { contractId: 'PEP-PAY-008', execute: publish } })
    );

    await act(async () => button('Publish formula').click());
    await act(async () => button('Continue to step-up').click());
    await settle();
    expect(host.textContent).toContain('Payroll command outcome is unknown');

    await act(async () => button('Retry exact command').click());
    await settle();

    expect(observedBindings).toHaveLength(2);
    expect(observedBindings[1]!.idempotencyKey).toBe(observedBindings[0]!.idempotencyKey);
    expect(publishFormula).toHaveBeenCalledTimes(1);
    expect(publishFormula.mock.calls[0]![2].idempotencyKey).toBe(
      observedBindings[0]!.idempotencyKey
    );
    expect(host.textContent).toContain('Payroll command outcome is unknown');
    expect(button('Retry exact command').disabled).toBe(false);
  });

  it('does not offer an exact retry when step-up is cancelled before dispatch', async () => {
    const source = dataSource();
    const publish: PayrollFormulaCommandExecutor = async () => {
      throw new HttpTransportError('ABORT');
    };
    await render(
      source,
      ownerBinding(source, { publish: { contractId: 'PEP-PAY-008', execute: publish } })
    );

    await act(async () => button('Publish formula').click());
    await act(async () => button('Continue to step-up').click());
    await settle();

    expect(source.publishFormula).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Payroll command was rejected');
    expect(host.textContent).not.toContain('Retry exact command');
  });

  it('retries an ambiguous result with the same idempotency key, correlation id, and body', async () => {
    const observedBindings: PayrollFormulaCommandBinding[] = [];
    const simulate = vi
      .fn()
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'))
      .mockImplementation((_formulaId, _request, authority) =>
        Promise.resolve(receipt('SIMULATE_FORMULA', authority.correlationId))
      );
    const source = dataSource({ simulateFormula: simulate });
    await render(
      source,
      ownerBinding(source, {
        simulate: {
          contractId: 'PEP-PAY-007',
          execute: executor((binding) => observedBindings.push(binding)),
        },
      })
    );

    await act(async () => button('Simulate formula').click());
    await settle();
    expect(host.textContent).toContain('Payroll command outcome is unknown');

    await act(async () => button('Retry exact command').click());
    await settle();
    expect(simulate).toHaveBeenCalledTimes(2);
    expect(observedBindings).toHaveLength(2);
    expect(observedBindings[1]).toMatchObject({
      idempotencyKey: observedBindings[0]!.idempotencyKey,
      correlationId: observedBindings[0]!.correlationId,
      expectedVersion: observedBindings[0]!.expectedVersion,
    });
    expect(observedBindings[1]!.request).toBe(observedBindings[0]!.request);
  });

  it('renders partial, masked, and omitted evidence without enabling version-bound commands', async () => {
    const raw = workbenchWire() as Record<string, unknown>;
    const original = (raw.items as Record<string, unknown>[])[0]!;
    raw.items = [
      {
        ...original,
        fieldGroups: {
          POLICY_VERSION: {
            decision: 'MASK',
            value: null,
            maskReason: 'FIELD_POLICY',
            maskedDisplayKey: 'payroll.policy-version.masked',
          },
        },
      },
    ];
    raw.queryState = {
      ...(raw.queryState as Record<string, unknown>),
      state: 'PARTIAL',
      freshness: 'STALE',
      fieldDecisionSummary: { viewCount: 0, maskedCount: 1, omittedCount: 2 },
      partialFailures: [
        {
          componentKey: 'payroll-policy',
          errorCode: 'OWNER_TIMEOUT',
          correlationId: '50000000-0000-4000-8000-000000000001',
          retryable: true,
        },
      ],
    };
    const source = dataSource({
      workbench: vi.fn().mockResolvedValue(selectPayrollConfigurationWorkbench(raw)),
    });
    await render(source);

    expect(host.textContent).toContain('Some payroll configuration is unavailable');
    expect(host.textContent).toContain('Payroll configuration may be stale');
    expect(host.textContent).toContain('Masked by field policy');
    expect(host.textContent).toContain('Not disclosed');
    expect(button('Validate formula').disabled).toBe(true);
    expect(button('Simulate formula').disabled).toBe(true);
    expect(button('Publish formula').disabled).toBe(true);
  });

  it('covers loading, empty, read-error, and permission states without calling adjacent owners', async () => {
    const page = deferred<ReturnType<typeof selectPayrollConfigurationWorkbench>>();
    const source = dataSource({ workbench: vi.fn(() => page.promise) });
    await act(async () => {
      root.render(
        <PayrollConfigurationWorkbenchRuntime
          scope={scope}
          ownerBinding={{ page: { contractId: 'IAQ-055', read: source.workbench } }}
          dataSource={source}
        />
      );
    });
    expect(host.textContent).toContain('Loading payroll configuration');

    const empty = workbenchWire() as Record<string, unknown>;
    empty.items = [];
    empty.queryState = {
      ...(empty.queryState as Record<string, unknown>),
      state: 'EMPTY',
      fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
    };
    await act(async () => page.resolve(selectPayrollConfigurationWorkbench(empty)));
    await settle();
    expect(host.textContent).toContain('No payroll elements or formulas');

    const deniedSource = dataSource({
      workbench: vi.fn().mockRejectedValue(new HttpError('forbidden', 403)),
    });
    await act(async () => {
      root.render(
        <PayrollConfigurationWorkbenchRuntime
          scope={scope}
          ownerBinding={{ page: { contractId: 'IAQ-055', read: deniedSource.workbench } }}
          dataSource={deniedSource}
        />
      );
    });
    await settle();
    expect(host.textContent).toContain('Payroll configuration is not authorized');

    const errorSource = dataSource({ workbench: vi.fn().mockRejectedValue(new Error('offline')) });
    await act(async () => {
      root.render(
        <PayrollConfigurationWorkbenchRuntime
          scope={{ ...scope, decisionRevision: 'decision:pay:38' }}
          ownerBinding={{ page: { contractId: 'IAQ-055', read: errorSource.workbench } }}
          dataSource={errorSource}
        />
      );
    });
    await settle();
    expect(host.textContent).toContain('Payroll configuration is unavailable');

    const closedSource = dataSource();
    await act(async () => {
      root.render(
        <PayrollConfigurationWorkbenchRuntime
          scope={{ ...scope, ready: false, decisionRevision: 'decision:pay:39' }}
          dataSource={closedSource}
        />
      );
    });
    expect(host.textContent).toContain('settings administration scope is required');
    expect(closedSource.workbench).not.toHaveBeenCalled();
  });
});
