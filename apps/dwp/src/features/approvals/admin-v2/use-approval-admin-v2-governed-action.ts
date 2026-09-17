import { useCallback, useState } from 'react';

import { useProductSurfaceGovernedMutation } from '../../../components/use-product-surface-governed-mutation';
import { useApprovalManagementCommandScope } from '../approval-management-command-scope';
import { approvalAdminV2CommandFailureState } from './approval-admin-v2-runtime-model';

import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { ApprovalAdminV2GovernedOptions } from '@dwp-frontend/shared-utils/api/approval-admin-v2-governed-api';
import type { AdminV2SourceState } from './admin-v2-types';

type Source = Readonly<{
  state: AdminV2SourceState;
  scopeReady: boolean;
  requestScope: Readonly<{ cacheKey: readonly string[] }>;
  refetch: () => unknown;
}>;

export function useApprovalAdminV2GovernedAction(
  source: Source,
  routeContractKey: string,
  onSuccess?: () => void | Promise<void>
) {
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey,
    taskKind: 'ADMINISTRATION',
  });
  const scope = useApprovalManagementCommandScope(source.requestScope.cacheKey);
  const [busy, setBusy] = useState(false);
  const [failureState, setFailureState] = useState<
    Extract<AdminV2SourceState, 'forbidden' | 'conflict' | 'unavailable'> | undefined
  >();

  const run = useCallback(
    async <T>(
      execute: (
        execution: ApprovalMutationExecution,
        options: ApprovalAdminV2GovernedOptions
      ) => Promise<T>
    ) => {
      if (source.state !== 'ready' || !source.scopeReady || busy) {
        setFailureState('unavailable');
        return undefined;
      }
      const command = scope.capture({ idempotencyKey: globalThis.crypto.randomUUID() });
      setBusy(true);
      setFailureState(undefined);
      try {
        const result = await dispatch((execution) =>
          scope.run(command, ({ idempotencyKey }) =>
            execute(execution, {
              idempotencyKey,
              beforeDispatch: () => {
                if (!scope.isCurrent(command)) {
                  throw new Error('Approval management scope changed.');
                }
              },
            })
          )
        );
        if (!scope.isCurrent(command)) return undefined;
        await source.refetch();
        await onSuccess?.();
        return result.value;
      } catch (caught) {
        setFailureState(approvalAdminV2CommandFailureState(caught));
        throw caught;
      } finally {
        setBusy(false);
      }
    },
    [busy, dispatch, onSuccess, scope, source]
  );

  return {
    run,
    busy,
    failureState,
    clearFailure: () => setFailureState(undefined),
  } as const;
}
