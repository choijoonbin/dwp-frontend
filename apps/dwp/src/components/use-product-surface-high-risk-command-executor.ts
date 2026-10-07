import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  useProductSurfaceHighRiskCommand,
  type ProductSurfaceHighRiskCommandController,
  type ProductSurfaceHighRiskCommandDescriptor,
  type ProductSurfaceHighRiskOperation,
} from './product-surface-high-risk-command';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export type ProductSurfaceHighRiskExecution<TResult> = (
  authority: ProductSurfaceGovernedMutationAuthority,
  command?: ProductSurfaceHighRiskCommandDescriptor
) => Promise<TResult>;

export type ProductSurfaceHighRiskCommandExecutor<TBinding> = <TResult>(
  execute: ProductSurfaceHighRiskExecution<TResult>,
  binding: TBinding
) => Promise<TResult>;

type PendingCommand = {
  descriptor: ProductSurfaceHighRiskCommandDescriptor;
  execute: ProductSurfaceHighRiskExecution<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  observedCoordinatorActivity: boolean;
};

const TERMINAL_ERRORS = new Set([
  'authority-unavailable',
  'revision-conflict',
  'command-rejected',
  'command-uncertain',
  'legacy-command-failed',
]);

function sameImmutableBinding(
  expected: ProductSurfaceHighRiskCommandDescriptor,
  actual: ProductSurfaceHighRiskCommandDescriptor
) {
  return (
    expected.operation === actual.operation &&
    expected.commandMethod === actual.commandMethod &&
    expected.commandPath === actual.commandPath &&
    expected.targetType === actual.targetType &&
    expected.targetId === actual.targetId &&
    expected.expectedObjectVersion === actual.expectedObjectVersion
  );
}

function terminalFailure(error: string | null): Error {
  if (error === 'revision-conflict') {
    return new HttpError('The governed command authority changed before dispatch.', 409);
  }
  if (error === 'authority-unavailable') {
    return new HttpError('The governed command authority is unavailable.', 403);
  }
  if (error === 'command-uncertain' || error === 'legacy-command-failed') {
    return new HttpTransportError('NETWORK');
  }
  return new HttpError('The governed command was rejected.', 422);
}

/**
 * Bridges the shared step-up coordinator into domain runtimes that await a command result.
 * Only the coordinator may supply mutation authority; callers provide immutable command facts.
 */
export function useProductSurfaceHighRiskCommandExecutor<TBinding>({
  operation,
  buildCommand,
}: {
  operation: ProductSurfaceHighRiskOperation;
  buildCommand: (binding: TBinding) => ProductSurfaceHighRiskCommandDescriptor;
}): Readonly<{
  execute: ProductSurfaceHighRiskCommandExecutor<TBinding>;
  controller: ProductSurfaceHighRiskCommandController;
}> {
  const pendingRef = useRef<PendingCommand | null>(null);

  const settle = useCallback((kind: 'resolve' | 'reject', value: unknown) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    if (kind === 'resolve') pending.resolve(value);
    else pending.reject(value);
  }, []);

  const coordinator = useProductSurfaceHighRiskCommand<unknown>({
    operation,
    execute: (command, authority) => {
      const pending = pendingRef.current;
      if (!pending || !sameImmutableBinding(pending.descriptor, command)) {
        throw new HttpError('The governed command changed before dispatch.', 409);
      }
      return pending.execute(authority, command);
    },
    onSuccess: (result) => settle('resolve', result),
    onConflict: () => settle('reject', new HttpError('The governed command is stale.', 409)),
  });
  const begin = coordinator.begin;

  const execute = useCallback(
    <TResult,>(
      run: ProductSurfaceHighRiskExecution<TResult>,
      binding: TBinding
    ): Promise<TResult> => {
      if (pendingRef.current) {
        return Promise.reject(new Error('A governed command is already pending.'));
      }
      let descriptor: ProductSurfaceHighRiskCommandDescriptor;
      try {
        descriptor = buildCommand(binding);
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise<TResult>((resolve, reject) => {
        pendingRef.current = {
          descriptor,
          execute: run as ProductSurfaceHighRiskExecution<unknown>,
          resolve: (value) => resolve(value as TResult),
          reject,
          observedCoordinatorActivity: false,
        };
        void begin(descriptor).catch((error) => settle('reject', error));
      });
    },
    [begin, buildCommand, settle]
  ) satisfies ProductSurfaceHighRiskCommandExecutor<TBinding>;

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (
      coordinator.controller.open ||
      coordinator.controller.busy ||
      coordinator.controller.attempt
    ) {
      pending.observedCoordinatorActivity = true;
    }
    if (TERMINAL_ERRORS.has(coordinator.controller.error ?? '')) {
      settle('reject', terminalFailure(coordinator.controller.error));
      return;
    }
    if (
      pending.observedCoordinatorActivity &&
      !coordinator.controller.open &&
      !coordinator.controller.busy &&
      !coordinator.controller.attempt
    ) {
      settle('reject', new HttpTransportError('ABORT'));
    }
  }, [
    coordinator.controller.attempt,
    coordinator.controller.busy,
    coordinator.controller.error,
    coordinator.controller.open,
    settle,
  ]);

  useEffect(
    () => () => {
      settle('reject', new HttpTransportError('ABORT'));
    },
    [settle]
  );

  const controller = useMemo<ProductSurfaceHighRiskCommandController>(
    () => ({
      ...coordinator.controller,
      close: () => {
        settle('reject', new HttpTransportError('ABORT'));
        coordinator.controller.close();
      },
    }),
    [coordinator.controller, settle]
  );

  return useMemo(() => ({ execute, controller }), [controller, execute]);
}
