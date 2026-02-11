/**
 * Case analysis run state — latestRunId 동기화, 스트림 시작/재시도
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnalysisRunStream,
  useCaseAnalysisRunsQuery,
} from '@dwp-frontend/shared-utils';

export const useCaseAnalysisRunState = (
  caseId: string | undefined,
  evidence: Record<string, unknown> | undefined
) => {
  const queryClient = useQueryClient();
  const [latestRunId, setLatestRunId] = useState<string | null>(null);

  const { startStream, cancel, status: streamStatus, stepProgress } = useAnalysisRunStream();
  const { data: analysisRunsData } = useCaseAnalysisRunsQuery(caseId, {
    enabled: Boolean(caseId),
    latest: true,
  });

  useEffect(() => {
    if (!caseId) return;
    setLatestRunId(null);
  }, [caseId]);

  useEffect(() => {
    if (analysisRunsData?.runId) {
      setLatestRunId(analysisRunsData.runId);
    }
  }, [analysisRunsData?.runId]);

  const handleStartAnalysis = () => {
    if (caseId) {
      startStream(caseId, {
        onSuccess: (runId) => {
          setLatestRunId(runId);
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'action-proposals'] });
          queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'analysis-runs'] });
        },
        payload: evidence ? { evidenceSnapshot: evidence } : undefined,
      });
    }
  };

  const handleRetryStream = () => handleStartAnalysis();

  return {
    latestRunId,
    handleStartAnalysis,
    handleRetryStream,
    streamStatus,
    stepProgress,
    cancel,
  };
};
