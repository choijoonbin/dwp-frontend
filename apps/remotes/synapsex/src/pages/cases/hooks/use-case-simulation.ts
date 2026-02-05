/**
 * Case Detail Simulation 훅
 * runCaseSimulation API (POST /api/synapse/agent-tools/actions/simulate)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import { showToast, runCaseSimulation, type CaseSimulationResponse } from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------

export type CaseSimulationResult = CaseSimulationResponse;

export const useCaseSimulation = (caseId: string | undefined, actionId?: string) => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error('Case ID required');
      const res = await runCaseSimulation({ caseId, actionId });
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
