import { useCallback, useMemo, useRef } from 'react';

import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';
import { approvalManagementScopeIdentity } from './approval-management-scope';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type {
  ApprovalHighRiskCommandDescriptor,
  ApprovalHighRiskOperation,
} from './approval-high-risk-command-model';

export type ApprovalManagementScopeBinding = Readonly<{
  scopeIdentity: string;
  scopeEpoch: number;
}>;

export type ApprovalManagementScopedCommand<TInput> = ApprovalManagementScopeBinding &
  Readonly<{
    input: TInput;
  }>;

export type ApprovalManagementScopedResult<TInput, TResult> = Readonly<{
  command: ApprovalManagementScopedCommand<TInput>;
  value: TResult;
}>;

type ApprovalManagementCommandScope = Readonly<{
  binding: ApprovalManagementScopeBinding;
  capture: <TInput>(input: TInput) => ApprovalManagementScopedCommand<TInput>;
  isCurrent: (candidate: ApprovalManagementScopeBinding) => boolean;
  run: <TInput, TResult>(
    command: ApprovalManagementScopedCommand<TInput>,
    execute: (input: TInput) => Promise<TResult>
  ) => Promise<ApprovalManagementScopedResult<TInput, TResult>>;
}>;

type ScopedHighRiskOutcome<TResult> =
  | Readonly<{
      state: 'COMPLETED';
      binding: ApprovalManagementScopeBinding;
      command: ApprovalHighRiskCommandDescriptor;
      value: TResult;
    }>
  | Readonly<{
      state: 'DISCARDED';
      binding: ApprovalManagementScopeBinding;
      command: ApprovalHighRiskCommandDescriptor;
    }>;

function sameBinding(
  left: ApprovalManagementScopeBinding,
  right: ApprovalManagementScopeBinding
): boolean {
  return left.scopeIdentity === right.scopeIdentity && left.scopeEpoch === right.scopeEpoch;
}

function readHighRiskBinding(
  command: ApprovalHighRiskCommandDescriptor,
  bindings: WeakMap<object, ApprovalManagementScopeBinding>
): ApprovalManagementScopeBinding | null {
  return bindings.get(command) ?? null;
}

function bindHighRiskCommand(
  command: ApprovalHighRiskCommandDescriptor,
  binding: ApprovalManagementScopeBinding,
  bindings: WeakMap<object, ApprovalManagementScopeBinding>
): ApprovalHighRiskCommandDescriptor {
  const bound = { ...command };
  bindings.set(bound, binding);
  return bound;
}

export function useApprovalManagementCommandScope(
  cacheKey: readonly string[]
): ApprovalManagementCommandScope {
  const scopeIdentity = approvalManagementScopeIdentity(cacheKey);
  const epochState = useRef({ scopeIdentity, scopeEpoch: 0 });
  if (epochState.current.scopeIdentity !== scopeIdentity) {
    epochState.current = {
      scopeIdentity,
      scopeEpoch: epochState.current.scopeEpoch + 1,
    };
  }
  const binding = useMemo<ApprovalManagementScopeBinding>(
    () => ({
      scopeIdentity,
      scopeEpoch: epochState.current.scopeEpoch,
    }),
    [scopeIdentity]
  );
  const currentBinding = useRef(binding);
  currentBinding.current = binding;

  const isCurrent = useCallback(
    (candidate: ApprovalManagementScopeBinding) => sameBinding(currentBinding.current, candidate),
    []
  );
  const capture = useCallback(
    function capture<TInput>(input: TInput): ApprovalManagementScopedCommand<TInput> {
      return { ...binding, input };
    },
    [binding]
  );
  const run = useCallback(
    async function run<TInput, TResult>(
      command: ApprovalManagementScopedCommand<TInput>,
      execute: (input: TInput) => Promise<TResult>
    ): Promise<ApprovalManagementScopedResult<TInput, TResult>> {
      if (!isCurrent(command)) throw new ProductSurfaceOperationCancelledError();
      const value = await execute(command.input);
      return { command, value };
    },
    [isCurrent]
  );

  return { binding, capture, isCurrent, run };
}

export function useApprovalManagementHighRiskCommand<TResult>({
  cacheKey,
  operation,
  execute,
  onSuccess,
  onConflict,
}: {
  cacheKey: readonly string[];
  operation: ApprovalHighRiskOperation;
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<TResult>;
  onSuccess?: (
    result: TResult,
    command: ApprovalHighRiskCommandDescriptor,
    binding: ApprovalManagementScopeBinding
  ) => void | Promise<void>;
  onConflict?: (
    command: ApprovalHighRiskCommandDescriptor,
    binding: ApprovalManagementScopeBinding
  ) => void | Promise<void>;
}) {
  const scope = useApprovalManagementCommandScope(cacheKey);
  const activeCommand = useRef<ApprovalHighRiskCommandDescriptor | null>(null);
  const commandBindings = useRef(new WeakMap<object, ApprovalManagementScopeBinding>());
  const { begin: beginHighRisk, controller } = useApprovalHighRiskCommand<
    ScopedHighRiskOutcome<TResult>
  >({
    operation,
    execute: async (command, execution) => {
      const binding = readHighRiskBinding(command, commandBindings.current);
      const discard = (): ScopedHighRiskOutcome<TResult> => ({
        state: 'DISCARDED',
        binding: binding ?? scope.binding,
        command,
      });
      if (!binding || !scope.isCurrent(binding)) {
        if (execution.mode === 'LEGACY_COMPATIBILITY') return discard();
        throw new ProductSurfaceOperationCancelledError();
      }
      try {
        const value = await execute(command, execution);
        return scope.isCurrent(binding)
          ? { state: 'COMPLETED', binding, command, value }
          : discard();
      } catch (error) {
        if (!scope.isCurrent(binding)) {
          if (execution.mode === 'LEGACY_COMPATIBILITY') return discard();
          throw new ProductSurfaceOperationCancelledError();
        }
        throw error;
      }
    },
    onSuccess: async (outcome) => {
      if (outcome.state !== 'COMPLETED' || !scope.isCurrent(outcome.binding)) return;
      await onSuccess?.(outcome.value, outcome.command, outcome.binding);
    },
    onConflict: async () => {
      const command = activeCommand.current;
      const binding = command ? readHighRiskBinding(command, commandBindings.current) : null;
      if (!command || !binding || !scope.isCurrent(binding)) return;
      await onConflict?.(command, binding);
    },
  });

  const begin = useCallback(
    (command: ApprovalHighRiskCommandDescriptor) => {
      const bound = bindHighRiskCommand(command, scope.binding, commandBindings.current);
      activeCommand.current = bound;
      return beginHighRisk(bound);
    },
    [beginHighRisk, scope.binding]
  );

  return { begin, controller };
}
