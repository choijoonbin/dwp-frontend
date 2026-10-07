// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { HrisPayrollWorkspace, PAYROLL_SELF_SERVICE_CONTRACT, PayrollFoundationStudio } from '..';
import {
  payrollFoundationPublishCommand,
  payrollFoundationReverseCommand,
} from '../hooks/use-payroll-foundation-command-executors';
import {
  foundationWire,
  mutationWire,
  workspaceWire,
} from './payroll-foundation-fixtures.test-support';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';
import type {
  PayrollFoundationCommandExecutor,
  PayrollFoundationCommandExecutors,
} from '../hooks/use-payroll-foundation-studio';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const requestScope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope-payroll-foundation',
  cacheKey: [
    'tenant-synthetic',
    'actor-synthetic',
    'NORMAL',
    'hcm.payroll-foundation',
    'scope-payroll-foundation',
    'decision-1',
  ],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-synthetic',
    actorId: 'actor-synthetic',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.payroll-foundation',
    contextScopeKey: 'scope-payroll-foundation',
    decisionRevision: 'decision-1',
  },
};

function commandExecutor(spy: () => void = () => undefined): PayrollFoundationCommandExecutor {
  return async <T,>(
    execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
  ) => {
    spy();
    return execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' });
  };
}

function commandExecutors(): PayrollFoundationCommandExecutors {
  return {
    create: commandExecutor(),
    update: commandExecutor(),
    simulate: commandExecutor(),
    publish: commandExecutor(),
    reverse: commandExecutor(),
    reconcile: commandExecutor(),
  };
}

const legacyAuthority = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

function rotatedPublishExecutor(commandId: string): PayrollFoundationCommandExecutors['publish'] {
  return async (execute, binding) => {
    const descriptor = payrollFoundationPublishCommand(binding);
    return execute(legacyAuthority, { ...descriptor, idempotencyKey: commandId });
  };
}

function rotatedReverseExecutor(commandId: string): PayrollFoundationCommandExecutors['reverse'] {
  return async (execute, binding) => {
    const descriptor = payrollFoundationReverseCommand(binding);
    return execute(legacyAuthority, { ...descriptor, idempotencyKey: commandId });
  };
}

function dataSource(overrides: Partial<PayrollFoundationDataSource> = {}) {
  const result = (
    commandId: string,
    commandType: 'CREATE' | 'UPDATE' | 'SIMULATE' | 'PUBLISH' | 'REVERSE',
    configuration: ReturnType<typeof foundationWire>,
    reversalOfCommandId: string | null = null
  ) =>
    mutationWire({
      receipt: {
        ...mutationWire().receipt,
        commandId,
        commandType,
        configurationId: configuration.configurationId,
        resultVersion: configuration.version,
        reversalOfCommandId,
      },
      configuration,
    });
  return {
    list: vi.fn().mockResolvedValue(workspaceWire()),
    get: vi.fn().mockResolvedValue(foundationWire()),
    versions: vi.fn().mockResolvedValue([foundationWire()]),
    create: vi
      .fn()
      .mockImplementation((_request, commandId: string) =>
        Promise.resolve(
          result(commandId, 'CREATE', foundationWire({ version: 1, status: 'DRAFT' }))
        )
      ),
    update: vi
      .fn()
      .mockImplementation((_id, _request, commandId: string) =>
        Promise.resolve(
          result(commandId, 'UPDATE', foundationWire({ version: 4, status: 'DRAFT' }))
        )
      ),
    simulate: vi
      .fn()
      .mockImplementation((_id, _request, commandId: string) =>
        Promise.resolve(result(commandId, 'SIMULATE', foundationWire({ version: 4 })))
      ),
    publish: vi
      .fn()
      .mockImplementation((_id, _request, commandId: string) =>
        Promise.resolve(
          result(commandId, 'PUBLISH', foundationWire({ version: 4, status: 'PUBLISHED' }))
        )
      ),
    reverse: vi
      .fn()
      .mockImplementation((_id, _request, commandId: string) =>
        Promise.resolve(
          result(
            commandId,
            'REVERSE',
            foundationWire({ version: 4, status: 'REVERSED' }),
            foundationWire().lastCommandId
          )
        )
      ),
    receipt: vi
      .fn()
      .mockImplementation((commandId: string) =>
        Promise.resolve(result(commandId, 'SIMULATE', foundationWire({ version: 4 })))
      ),
    reconcile: vi
      .fn()
      .mockImplementation((commandId: string) =>
        Promise.resolve(result(commandId, 'SIMULATE', foundationWire({ version: 4 })))
      ),
    ...overrides,
  } as PayrollFoundationDataSource;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(label));
}

let host: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
}

async function renderStudio(
  source: PayrollFoundationDataSource,
  scope: ProductSurfaceRequestScope = requestScope,
  executors: PayrollFoundationCommandExecutors | null = commandExecutors()
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PayrollFoundationStudio
          requestScope={scope}
          dataSource={source}
          commandExecutors={executors ?? undefined}
        />
      </QueryClientProvider>
    );
  });
  await settle();
  await settle();
}

describe('PayrollFoundationStudio runtime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
    vi.restoreAllMocks();
  });

  it('coexists with the unchanged employee pay workspace contract', () => {
    expect(HrisPayrollWorkspace).not.toBe(PayrollFoundationStudio);
    expect(PAYROLL_SELF_SERVICE_CONTRACT).toMatchObject({
      route: '/hr/pay',
      primaryUser: 'EMPLOYEE',
      calculatesPayroll: false,
      initiatesPayment: false,
    });
  });

  it('fails closed when exact mutation executors are not injected', async () => {
    const source = dataSource();
    await renderStudio(source, requestScope, null);

    expect(button(host, 'New foundation')?.disabled).toBe(true);
    expect(button(host, 'Edit draft')?.disabled).toBe(true);
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
    expect(button(host, 'Publish version')?.disabled).toBe(true);

    await act(async () => {
      button(host, 'New foundation')?.click();
      button(host, 'Run simulation')?.click();
    });
    expect(source.create).not.toHaveBeenCalled();
    expect(source.simulate).not.toHaveBeenCalled();
  });

  it('dispatches SIMULATE only through the exact simulation executor', async () => {
    const calls = {
      create: vi.fn(),
      update: vi.fn(),
      simulate: vi.fn(),
      publish: vi.fn(),
      reverse: vi.fn(),
      reconcile: vi.fn(),
    };
    const source = dataSource();
    await renderStudio(source, requestScope, {
      create: commandExecutor(calls.create),
      update: commandExecutor(calls.update),
      simulate: commandExecutor(calls.simulate),
      publish: commandExecutor(calls.publish),
      reverse: commandExecutor(calls.reverse),
      reconcile: commandExecutor(calls.reconcile),
    });

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();

    expect(calls.simulate).toHaveBeenCalledOnce();
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.publish).not.toHaveBeenCalled();
    expect(calls.reverse).not.toHaveBeenCalled();
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(source.simulate).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ contextScopeKey: 'scope-payroll-foundation' }),
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }
    );
  });

  it('accepts a PAY publish receipt bound to the proof-reissued idempotency key', async () => {
    const rotatedCommandId = '20000000-0000-4000-8000-000000000001';
    const source = dataSource();
    await renderStudio(source, requestScope, {
      ...commandExecutors(),
      publish: rotatedPublishExecutor(rotatedCommandId),
    });

    await act(async () => button(host, 'Publish version')?.click());
    await act(async () => button(document.body, 'Publish simulated version')?.click());
    await settle();

    expect(source.publish).toHaveBeenCalledOnce();
    expect((source.publish as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toBe(rotatedCommandId);
    expect(host.textContent).toContain('Owner receipt confirms the command succeeded.');
    expect(host.textContent).not.toContain('Command result is unknown');
  });

  it('accepts a PAY reversal receipt bound to the proof-reissued idempotency key', async () => {
    const rotatedCommandId = '20000000-0000-4000-8000-000000000002';
    const published = foundationWire({
      status: 'PUBLISHED',
      access: { ...foundationWire().access, canReverse: true },
    });
    const source = dataSource({
      list: vi.fn().mockResolvedValue(workspaceWire({ configurations: [published] })),
      get: vi.fn().mockResolvedValue(published),
    });
    await renderStudio(source, requestScope, {
      ...commandExecutors(),
      reverse: rotatedReverseExecutor(rotatedCommandId),
    });

    await act(async () => button(host, 'Reverse publication')?.click());
    await act(async () => button(document.body, 'Submit reversal')?.click());
    await settle();

    expect(source.reverse).toHaveBeenCalledOnce();
    expect((source.reverse as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]).toBe(rotatedCommandId);
    expect(host.textContent).toContain('Owner receipt confirms the command succeeded.');
    expect(host.textContent).not.toContain('Command result is unknown');
  });

  it('renders a complete loading boundary before owner data arrives', async () => {
    const pending = deferred<unknown>();
    const source = dataSource({ list: vi.fn().mockReturnValue(pending.promise) });
    await renderStudio(source);

    expect(host.querySelector('[data-query-state="loading"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="payroll-foundation-studio"]')).toBeNull();
  });

  it('keeps authorized empty create enabled and denied empty create fail-closed', async () => {
    const allowed = dataSource({
      list: vi.fn().mockResolvedValue(
        workspaceWire({
          configurations: [],
          access: { ...foundationWire().access, canCreate: true },
        })
      ),
    });
    await renderStudio(allowed);
    expect(host.textContent).toContain('No payroll foundation is visible');
    expect(button(host, 'New foundation')?.disabled).toBe(false);

    await act(async () => root.unmount());
    queryClient.clear();
    root = createRoot(host);
    const denied = dataSource({
      list: vi.fn().mockResolvedValue(
        workspaceWire({
          configurations: [],
          access: { ...foundationWire().access, canCreate: false },
        })
      ),
    });
    await renderStudio(denied);
    expect(button(host, 'New foundation')?.disabled).toBe(true);
  });

  it('retains usable data while surfacing partial owner failure and blocking publish', async () => {
    const configuration = foundationWire();
    const source = dataSource({
      list: vi.fn().mockResolvedValue(
        workspaceWire({
          configurations: [configuration],
          partialFailures: [{ source: 'POLICY_OWNER', code: 'SOURCE_UNAVAILABLE' }],
        })
      ),
      get: vi.fn().mockResolvedValue(configuration),
      versions: vi.fn().mockResolvedValue([configuration]),
    });
    await renderStudio(source);

    expect(host.textContent).toContain('Some owner dependencies are unavailable');
    expect(host.textContent).toContain('Synthetic Payroll Entity');
    expect(host.textContent).toContain('DEPENDENCY_PARTIAL');
    expect(button(host, 'Publish version')?.disabled).toBe(true);
    expect(
      [...host.querySelectorAll('ul')].every((list) =>
        [...list.children].every((child) => child.tagName === 'LI')
      )
    ).toBe(true);
  });

  it('obeys the server SoD projection even when current simulation evidence passed', async () => {
    const configuration = foundationWire({
      access: {
        ...foundationWire().access,
        canPublish: false,
        publishDenialCode: 'SOD_AUTHOR_CANNOT_PUBLISH',
      },
    });
    await renderStudio(
      dataSource({
        list: vi.fn().mockResolvedValue(workspaceWire({ configurations: [configuration] })),
        get: vi.fn().mockResolvedValue(configuration),
      })
    );

    expect(button(host, 'Publish version')?.disabled).toBe(true);
    expect(host.textContent).toContain('SOD_AUTHOR_CANNOT_PUBLISH');
    expect(host.textContent).toContain('Author / publisher separation');
  });

  it('turns an uncertain command into same-receipt lookup instead of a second command', async () => {
    const simulate = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const receipt = vi.fn().mockImplementation((commandId: string) =>
      Promise.resolve(
        mutationWire({
          receipt: { ...mutationWire().receipt, commandId, resultVersion: 4 },
          configuration: foundationWire({ version: 4 }),
        })
      )
    );
    const source = dataSource({ simulate, receipt });
    await renderStudio(source);

    await act(async () => {
      button(host, 'Run simulation')?.click();
      button(host, 'Run simulation')?.click();
    });
    await settle();
    expect(host.textContent).toContain('Command result is unknown');
    expect(button(host, 'Check receipt')).not.toBeUndefined();
    expect(document.activeElement?.getAttribute('data-command-state')).toBe('RESULT_UNKNOWN');
    expect(simulate).toHaveBeenCalledOnce();
    const originalCommandId = simulate.mock.calls[0]?.[2];
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
    expect(button(host, 'New foundation')?.disabled).toBe(true);
    expect(button(host, 'Edit draft')?.disabled).toBe(true);

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    expect(simulate).toHaveBeenCalledOnce();

    await act(async () => button(host, 'Check receipt')?.click());
    await settle();
    expect(receipt).toHaveBeenCalledOnce();
    expect(receipt.mock.calls[0]?.[0]).toBe(originalCommandId);
    expect(simulate).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Owner receipt confirms the command succeeded.');
  });

  it('fails closed when a mutation response is bound to another command', async () => {
    const simulate = vi.fn().mockResolvedValue(mutationWire());
    await renderStudio(dataSource({ simulate }));

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();

    const dispatchedCommandId = simulate.mock.calls[0]?.[2];
    expect(dispatchedCommandId).not.toBe(mutationWire().receipt.commandId);
    expect(host.textContent).toContain('Command result is unknown');
    expect(host.textContent).toContain(dispatchedCommandId);
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
  });

  it('rejects a poisoned uncertain result version and recovers the original command', async () => {
    const simulate = vi
      .fn()
      .mockImplementation((_id: string, _request: unknown, commandId: string) =>
        Promise.resolve(
          mutationWire({
            receipt: {
              ...mutationWire().receipt,
              commandId,
              status: 'RESULT_UNKNOWN',
              resultVersion: 99,
              failureCode: 'RESULT_UNKNOWN',
            },
            configuration: foundationWire({ version: 99 }),
          })
        )
      );
    const receipt = vi.fn().mockImplementation((commandId: string) =>
      Promise.resolve(
        mutationWire({
          receipt: { ...mutationWire().receipt, commandId, resultVersion: 4 },
          configuration: foundationWire({ version: 4 }),
        })
      )
    );
    await renderStudio(dataSource({ simulate, receipt }));

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    const dispatchedCommandId = simulate.mock.calls[0]?.[2];
    expect(host.textContent).toContain('Command result is unknown');
    expect(host.textContent).toContain(dispatchedCommandId);

    await act(async () => button(host, 'Check receipt')?.click());
    await settle();
    expect(receipt).toHaveBeenCalledWith(dispatchedCommandId, expect.any(Object));
    expect(host.textContent).toContain('Owner receipt confirms the command succeeded.');
  });

  it('recovers a network-uncertain reversal with its original publication lineage', async () => {
    const rotatedCommandId = '20000000-0000-4000-8000-000000000003';
    const published = foundationWire({
      status: 'PUBLISHED',
      access: { ...foundationWire().access, canReverse: true },
    });
    const reverse = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const receipt = vi.fn().mockImplementation((commandId: string) =>
      Promise.resolve(
        mutationWire({
          receipt: {
            ...mutationWire().receipt,
            commandId,
            commandType: 'REVERSE',
            status: 'REVERSAL_FAILED',
            resultVersion: published.version,
            reversalOfCommandId: published.lastCommandId,
            failureCode: 'REVERSAL_PRECONDITION_FAILED',
          },
          configuration: published,
        })
      )
    );
    await renderStudio(
      dataSource({
        list: vi.fn().mockResolvedValue(workspaceWire({ configurations: [published] })),
        get: vi.fn().mockResolvedValue(published),
        reverse,
        receipt,
      }),
      requestScope,
      { ...commandExecutors(), reverse: rotatedReverseExecutor(rotatedCommandId) }
    );

    await act(async () => button(host, 'Reverse publication')?.click());
    await act(async () => button(document.body, 'Submit reversal')?.click());
    await settle();
    const dispatchedCommandId = reverse.mock.calls[0]?.[2];
    expect(dispatchedCommandId).toBe(rotatedCommandId);
    expect(host.textContent).toContain('Command result is unknown');

    await act(async () => button(host, 'Check receipt')?.click());
    await settle();
    expect(receipt).toHaveBeenCalledWith(rotatedCommandId, expect.any(Object));
    expect(host.textContent).toContain('Publication reversal failed');
    expect(host.textContent).not.toContain('Command result is unknown');
  });

  it('keeps the original receipt locked when lookup returns a different receipt', async () => {
    const simulate = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const receipt = vi.fn().mockResolvedValue(mutationWire());
    await renderStudio(dataSource({ simulate, receipt }));

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    const dispatchedCommandId = simulate.mock.calls[0]?.[2];

    await act(async () => button(host, 'Check receipt')?.click());
    await settle();

    expect(receipt).toHaveBeenCalledWith(dispatchedCommandId, expect.any(Object));
    expect(host.textContent).toContain('Command result is unknown');
    expect(host.textContent).toContain(dispatchedCommandId);
    expect(host.textContent).not.toContain('Owner receipt confirms the command succeeded.');
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
  });

  it('does not replace a newer projection with an older immutable receipt result', async () => {
    const current = foundationWire();
    const newer = foundationWire({ version: 5 });
    const refresh = deferred<unknown>();
    const get = vi.fn().mockResolvedValueOnce(current).mockReturnValue(refresh.promise);
    const simulate = vi.fn().mockRejectedValue(new HttpTransportError('NETWORK'));
    const receipt = vi.fn().mockImplementation((commandId: string) =>
      Promise.resolve(
        mutationWire({
          receipt: {
            ...mutationWire().receipt,
            commandId,
            resultVersion: 4,
          },
          configuration: foundationWire({ version: 4 }),
        })
      )
    );
    await renderStudio(
      dataSource({
        list: vi.fn().mockResolvedValue(workspaceWire({ configurations: [current] })),
        get,
        simulate,
        receipt,
      })
    );

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    const detailKey = [
      'hris',
      'payroll-foundation',
      ...requestScope.cacheKey,
      'configuration',
      current.configurationId,
    ] as const;
    await act(async () => queryClient.setQueryData(detailKey, newer));
    await settle();
    await act(async () => button(host, 'Check receipt')?.click());
    await settle();

    const cached = queryClient.getQueryData<ReturnType<typeof foundationWire>>(detailKey);
    expect(cached?.version).toBe(5);
    expect(host.textContent).toContain('Owner receipt confirms the command succeeded.');
  });

  it('ignores an old command response after the governed scope changes', async () => {
    const response = deferred<unknown>();
    const simulate = vi.fn().mockReturnValue(response.promise);
    const source = dataSource({ simulate });
    await renderStudio(source);

    await act(async () => button(host, 'Run simulation')?.click());
    const commandId = simulate.mock.calls[0]?.[2] as string;
    const nextScope: ProductSurfaceRequestScope = {
      ...requestScope,
      contextScopeKey: 'scope-payroll-foundation-next',
      cacheKey: [
        requestScope.cacheKey[0],
        requestScope.cacheKey[1],
        requestScope.cacheKey[2],
        requestScope.cacheKey[3],
        'scope-payroll-foundation-next',
        'decision-2',
      ],
      queryMeta: {
        ...requestScope.queryMeta,
        contextScopeKey: 'scope-payroll-foundation-next',
        decisionRevision: 'decision-2',
      },
    };
    await renderStudio(source, nextScope);

    await act(async () => {
      response.resolve(
        mutationWire({
          receipt: {
            ...mutationWire().receipt,
            commandId,
            status: 'RESULT_UNKNOWN',
            resultVersion: 4,
            failureCode: 'RESULT_UNKNOWN',
          },
          configuration: foundationWire({ version: 4 }),
        })
      );
      await response.promise;
    });
    await settle();

    expect(host.textContent).not.toContain('Command result is unknown');
    expect(button(host, 'New foundation')?.disabled).toBe(false);
    expect(button(host, 'Run simulation')?.disabled).toBe(false);
  });

  it('blocks every new mutation while the owner receipt remains pending', async () => {
    const pending = (commandId: string) =>
      mutationWire({
        receipt: {
          ...mutationWire().receipt,
          commandId,
          status: 'PENDING',
          resultVersion: null,
          completedAt: null,
        },
        configuration: null,
      });
    const simulate = vi
      .fn()
      .mockImplementation((_id: string, _request: unknown, commandId: string) =>
        Promise.resolve(pending(commandId))
      );
    const receipt = vi
      .fn()
      .mockImplementation((commandId: string) => Promise.resolve(pending(commandId)));
    await renderStudio(dataSource({ simulate, receipt }));

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    expect(simulate).toHaveBeenCalledOnce();
    const originalCommandId = simulate.mock.calls[0]?.[2];
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
    expect(button(host, 'New foundation')?.disabled).toBe(true);
    expect(button(host, 'Edit draft')?.disabled).toBe(true);

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    expect(simulate).toHaveBeenCalledOnce();

    await act(async () => button(host, 'Check receipt')?.click());
    await settle();
    expect(receipt).toHaveBeenCalledOnce();
    expect(receipt.mock.calls[0]?.[0]).toBe(originalCommandId);
    expect(button(host, 'Run simulation')?.disabled).toBe(true);
  });

  it('surfaces optimistic conflict and keeps owner data visible', async () => {
    const simulate = vi.fn().mockRejectedValue(new HttpError('changed', 409));
    await renderStudio(dataSource({ simulate }));

    await act(async () => button(host, 'Run simulation')?.click());
    await settle();
    expect(host.textContent).toContain('A newer version exists');
    expect(host.textContent).toContain('Synthetic Payroll Entity');
    expect(button(host, 'Refresh')).not.toBeUndefined();
  });

  it('reports reversal failure without changing the published projection', async () => {
    const published = foundationWire({
      status: 'PUBLISHED',
      access: { ...foundationWire().access, canReverse: true },
    });
    const reverse = vi
      .fn()
      .mockImplementation((_id: string, _request: unknown, commandId: string) =>
        Promise.resolve(
          mutationWire({
            receipt: {
              ...mutationWire().receipt,
              commandId,
              commandType: 'REVERSE',
              status: 'REVERSAL_FAILED',
              reversalOfCommandId: published.lastCommandId,
              failureCode: 'REVERSAL_PRECONDITION_FAILED',
            },
            configuration: published,
          })
        )
      );
    await renderStudio(
      dataSource({
        list: vi.fn().mockResolvedValue(workspaceWire({ configurations: [published] })),
        get: vi.fn().mockResolvedValue(published),
        reverse,
      })
    );

    await act(async () => button(host, 'Reverse publication')?.click());
    await settle();
    expect(document.body.textContent).toContain('Review publication reversal');
    await act(async () => button(document.body, 'Submit reversal')?.click());
    await settle();
    expect(reverse).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Publication reversal failed');
    expect(host.textContent).toContain('PUBLISHED');
  });

  it('renders permission failure without leaking a stale configuration', async () => {
    await renderStudio(
      dataSource({ list: vi.fn().mockRejectedValue(new HttpError('Denied', 403)) })
    );
    expect(host.querySelector('[data-query-state="permission"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Synthetic Payroll Entity');
  });
});
