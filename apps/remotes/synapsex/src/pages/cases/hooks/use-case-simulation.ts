/**
 * Case Detail Simulation 훅
 * runCaseSimulation API (POST /api/synapse/agent-tools/actions/simulate)
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showToast, runCaseSimulation, type CaseSimulationResponse } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

export type CaseSimulationResult = CaseSimulationResponse;

/** BE 필수: actionType (PAYMENT_BLOCK, REQUEST_INFO, DISMISS, RELEASE_BLOCK 등). 미지정 시 PAYMENT_BLOCK 사용 */
const DEFAULT_SIMULATION_ACTION_TYPE = 'PAYMENT_BLOCK';

export const useCaseSimulation = (
  caseId: string | undefined,
  options?: { actionType?: string; actionId?: string }
) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const actionType = options?.actionType ?? DEFAULT_SIMULATION_ACTION_TYPE;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error('Case ID required');
      const res = await runCaseSimulation({ caseId, actionType, actionId: options?.actionId });
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Simulation failed');
      }
      return res.data as CaseSimulationResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'actions'] });
      showToast(t('toast.simulationCompleted'));
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t('toast.simulationFailed'), 'error');
    },
  });

  return {
    runSimulation: () => mutation.mutate(),
    result: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
};
