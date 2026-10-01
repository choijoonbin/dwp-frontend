// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProductSurfaceHighRiskCommandExecutor } from './use-product-surface-high-risk-command-executor';

import type { ProductSurfaceHighRiskCommandDescriptor } from './product-surface-high-risk-command';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const coordinator = vi.hoisted(() => ({
  options: null as null | {
    execute: (
      command: ProductSurfaceHighRiskCommandDescriptor,
      authority: ProductSurfaceGovernedMutationAuthority
    ) => Promise<unknown>;
    onSuccess?: (result: unknown) => void | Promise<void>;
  },
  command: null as ProductSurfaceHighRiskCommandDescriptor | null,
  close: vi.fn(),
}));

vi.mock('./product-surface-high-risk-command', () => ({
  useProductSurfaceHighRiskCommand: (options: typeof coordinator.options) => {
    coordinator.options = options;
    return {
      begin: async (command: ProductSurfaceHighRiskCommandDescriptor) => {
        coordinator.command = command;
      },
      controller: {
        open: false,
        busy: false,
        attempt: null,
        error: null,
        close: coordinator.close,
        confirm: vi.fn(),
        continueWithIdentityProvider: vi.fn(),
        selectIdentityProvider: vi.fn(),
      },
    };
  },
}));

type Binding = Readonly<{ targetId: string; commandId: string; version: number }>;

let root: Root;
let mount: HTMLDivElement;
let latest: ReturnType<typeof useProductSurfaceHighRiskCommandExecutor<Binding>>;

function command(binding: Binding): ProductSurfaceHighRiskCommandDescriptor {
  return {
    operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
    commandMethod: 'POST',
    commandPath: `/api/people/v1/hris/performance/cycles/${binding.targetId}/publish`,
    targetType: 'PERFORMANCE_CYCLE',
    targetId: binding.targetId,
    expectedObjectVersion: binding.version,
    payload: { commandId: binding.commandId, expectedRevision: binding.version },
    idempotencyKey: binding.commandId,
  };
}

function Probe() {
  latest = useProductSurfaceHighRiskCommandExecutor({
    operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
    buildCommand: command,
  });
  return null;
}

describe('product surface high-risk awaited executor', () => {
  beforeEach(async () => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    coordinator.options = null;
    coordinator.command = null;
    coordinator.close.mockReset();
    mount = document.createElement('div');
    root = createRoot(mount);
    await act(async () => root.render(createElement(Probe)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('forwards only challenge-bound authority and the immutable command to the owner call', async () => {
    const authority = {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'decision-7',
      contextKey: 'hcm-operations',
      contextScopeKey: 'payroll-scope',
      objectVersion: 7,
      idempotencyKey: 'command-7',
      stepUp: {
        challenge: 'challenge',
        challengeId: 'challenge-id',
        decisionRevision: 'decision-7',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    } as const;
    const owner = vi.fn(async () => ({ receipt: 'bound' }));
    const pending = latest.execute(owner, {
      targetId: 'cycle-7',
      commandId: 'command-7',
      version: 7,
    });

    expect(coordinator.command).toMatchObject({
      targetId: 'cycle-7',
      expectedObjectVersion: 7,
      idempotencyKey: 'command-7',
    });
    const result = await coordinator.options!.execute(coordinator.command!, authority);
    await coordinator.options!.onSuccess?.(result);

    await expect(pending).resolves.toEqual({ receipt: 'bound' });
    expect(owner).toHaveBeenCalledWith(authority, coordinator.command);
  });

  it('fails closed when the command identity changes before dispatch', async () => {
    const pending = latest.execute(vi.fn(), {
      targetId: 'cycle-7',
      commandId: 'command-7',
      version: 7,
    });
    const changed = { ...coordinator.command!, targetId: 'cycle-8' };

    expect(() =>
      coordinator.options!.execute(changed, {
        mode: 'LEGACY_COMPATIBILITY',
        rolloutState: '100',
      })
    ).toThrowError('The governed command changed before dispatch.');
    const aborted = expect(pending).rejects.toMatchObject({ reason: 'ABORT' });
    await act(async () => latest.controller.close());
    await aborted;
    expect(coordinator.close).toHaveBeenCalledOnce();
  });
});
