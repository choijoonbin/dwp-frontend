// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import { approvalFormPublishCommand } from './approval-high-risk-command-model';

const highRiskHarness = vi.hoisted(() => ({
  options: undefined as
    | {
        execute: (command: unknown, execution: unknown) => Promise<unknown>;
        onSuccess?: (result: unknown) => Promise<void>;
        onConflict?: () => Promise<void>;
      }
    | undefined,
  begin: vi.fn(async (_command: unknown) => undefined),
  close: vi.fn(),
}));

vi.mock('./use-approval-high-risk-command', () => ({
  useApprovalHighRiskCommand: (options: typeof highRiskHarness.options) => {
    highRiskHarness.options = options;
    return {
      begin: highRiskHarness.begin,
      controller: {
        open: false,
        busy: false,
        attempt: null,
        error: null,
        close: highRiskHarness.close,
        confirm: vi.fn(),
        continueWithIdentityProvider: vi.fn(),
        selectIdentityProvider: vi.fn(),
      },
    };
  },
}));

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

const cacheKey = (scope: string) => [
  `tenant-${scope}`,
  `actor-${scope}`,
  'NORMAL',
  'approvals.admin',
  `scope-${scope}`,
  `revision-${scope}`,
];

let startCommand: ((pending: Promise<string>) => Promise<void>) | undefined;
let accepted: string[];
let rejected: string[];
let beginHighRisk:
  ((command: ReturnType<typeof approvalFormPublishCommand>) => Promise<void>) | null;
let highRiskSuccesses: string[];
let highRiskConflicts: number;
let highRiskExecution: () => Promise<string>;

function Harness({ scope }: { scope: string }) {
  const commandScope = useApprovalManagementCommandScope(cacheKey(scope));
  useEffect(() => {
    startCommand = async (pending) => {
      const command = commandScope.capture(`input-${scope}`);
      try {
        const result = await commandScope.run(command, () => pending);
        if (commandScope.isCurrent(result.command)) accepted.push(result.value);
      } catch (error) {
        if (commandScope.isCurrent(command)) rejected.push(String(error));
      }
    };
  }, [commandScope, scope]);
  return null;
}

function HighRiskHarness({ scope }: { scope: string }) {
  const highRisk = useApprovalManagementHighRiskCommand({
    cacheKey: cacheKey(scope),
    operation: 'FORM_PUBLISH',
    execute: () => highRiskExecution(),
    onSuccess: (result) => {
      highRiskSuccesses.push(result);
    },
    onConflict: () => {
      highRiskConflicts += 1;
    },
  });
  useEffect(() => {
    beginHighRisk = highRisk.begin;
  }, [highRisk.begin]);
  return null;
}

describe('approval management command scope', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    accepted = [];
    rejected = [];
    beginHighRisk = null;
    highRiskSuccesses = [];
    highRiskConflicts = 0;
    highRiskExecution = async () => 'completed';
    highRiskHarness.options = undefined;
    highRiskHarness.begin.mockClear();
    highRiskHarness.close.mockClear();
    startCommand = undefined;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('drops a delayed success after the tenant scope changes', async () => {
    const pending = deferred<string>();
    await act(async () => root.render(<Harness scope="A" />));
    const inFlight = startCommand!(pending.promise);

    await act(async () => root.render(<Harness scope="B" />));
    await act(async () => pending.resolve('scope-A-result'));
    await inFlight;

    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it('drops a delayed rejection and does not accept an A to B to A replay', async () => {
    const staleSuccess = deferred<string>();
    const staleFailure = deferred<string>();
    await act(async () => root.render(<Harness scope="A" />));
    const successFlight = startCommand!(staleSuccess.promise);
    const failureFlight = startCommand!(staleFailure.promise);

    await act(async () => root.render(<Harness scope="B" />));
    await act(async () => root.render(<Harness scope="A" />));
    await act(async () => {
      staleSuccess.resolve('replayed-A-result');
      staleFailure.reject(new Error('stale-A-failure'));
    });
    await Promise.all([successFlight, failureFlight]);

    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it('keeps wire payload exact and drops a stale legacy high-risk completion', async () => {
    const pending = deferred<string>();
    highRiskExecution = () => pending.promise;
    await act(async () => root.render(<HighRiskHarness scope="A" />));
    const descriptor = approvalFormPublishCommand('form-1', 7);
    await act(async () => beginHighRisk!(descriptor));
    const bound = highRiskHarness.begin.mock.calls[0]![0] as typeof descriptor;
    const options = highRiskHarness.options!;

    expect(bound.payload).toEqual({ expectedVersion: 7 });
    const completion = options.execute(bound, {
      mode: 'LEGACY_COMPATIBILITY',
      rolloutState: '100',
    });
    await act(async () => root.render(<HighRiskHarness scope="B" />));
    await act(async () => pending.resolve('scope-A-published'));
    const outcome = await completion;
    await options.onSuccess?.(outcome);
    await options.onConflict?.();

    expect(outcome).toMatchObject({ state: 'DISCARDED' });
    expect(highRiskSuccesses).toEqual([]);
    expect(highRiskConflicts).toBe(0);
  });

  it('turns a stale secure high-risk rejection into a scope cancellation', async () => {
    const pending = deferred<string>();
    highRiskExecution = () => pending.promise;
    await act(async () => root.render(<HighRiskHarness scope="A" />));
    await act(async () => beginHighRisk!(approvalFormPublishCommand('form-1', 7)));
    const bound = highRiskHarness.begin.mock.calls[0]![0];
    const options = highRiskHarness.options!;
    const completion = options.execute(bound, {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'revision-A',
      contextKey: 'context-A',
      contextScopeKey: 'scope-A',
    });
    const rejection = completion.catch((error: unknown) => error);

    await act(async () => root.render(<HighRiskHarness scope="B" />));
    await act(async () => pending.reject(new Error('scope-A-command-failed')));

    await expect(rejection).resolves.toHaveProperty(
      'name',
      'ProductSurfaceOperationCancelledError'
    );
    expect(highRiskSuccesses).toEqual([]);
    expect(highRiskConflicts).toBe(0);
  });
});
