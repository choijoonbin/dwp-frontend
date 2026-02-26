import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuraStore } from '@dwp-frontend/shared-utils/aura/use-aura-store';
import { useNotificationWebSocket, useWorkbenchReactiveStore } from '@dwp-frontend/shared-utils';

type NotificationMessage = Parameters<
  NonNullable<NonNullable<Parameters<typeof useNotificationWebSocket>[0]>['onReceive']>
>[0];

type NotificationPayload = {
  case_id?: string | number;
  caseId?: string | number;
  run_id?: string;
  runId?: string;
  stream_url?: string;
  streamUrl?: string;
  content?: string;
  delta?: string;
  event?: string;
};

const normalizeCaseId = (message: NotificationMessage, payload: NotificationPayload | undefined) =>
  (payload?.case_id != null ? String(payload.case_id) : null) ??
  (payload?.caseId != null ? String(payload.caseId) : null) ??
  ((message as { case_id?: string | number }).case_id != null
    ? String((message as { case_id?: string | number }).case_id)
    : null) ??
  ((message as { caseId?: string | number }).caseId != null
    ? String((message as { caseId?: string | number }).caseId)
    : null) ??
  undefined;

const normalizeRunId = (payload: NotificationPayload | undefined) =>
  payload?.run_id != null ? String(payload.run_id) : payload?.runId != null ? String(payload.runId) : undefined;

const normalizeStreamUrl = (payload: NotificationPayload | undefined, runId: string | undefined) => {
  const fromPayload =
    payload?.stream_url != null && String(payload.stream_url).trim() !== ''
      ? String(payload.stream_url)
      : payload?.streamUrl != null && String(payload.streamUrl).trim() !== ''
        ? String(payload.streamUrl)
        : undefined;
  return fromPayload ?? (runId ? `/api/synapse/analysis-runs/${runId}/stream` : undefined);
};

export function useDashboardNotificationSync(enabled: boolean) {
  const queryClient = useQueryClient();

  const onNotificationReceive = useCallback(
    (message: NotificationMessage) => {
      const category = (message.category ?? '').toString().toUpperCase();
      const type = (message.type ?? '').toString().toUpperCase();
      const payload = message.payload as NotificationPayload | undefined;
      const caseId = normalizeCaseId(message, payload);
      const runId = normalizeRunId(payload);

      if (category === 'THOUGHT_STREAM' || type === 'THOUGHT_STREAM') {
        const workbench = useWorkbenchReactiveStore.getState();
        if (!caseId || workbench.currentThoughtStreamCaseId !== caseId) return;
        const delta = (payload?.content ?? payload?.delta ?? '').toString();
        if (!delta) return;

        const aura = useAuraStore.getState();
        const { addThoughtChain, updateThoughtChain } = aura.actions;
        const existingId = runId ? workbench.getStreamingThoughtId(runId) : undefined;

        if (existingId) {
          const current = aura.thoughtChains.find((chain) => chain.id === existingId);
          if (current) {
            updateThoughtChain(existingId, { content: current.content + delta });
            return;
          }
        }

        const newId = addThoughtChain({ type: 'analysis', content: delta });
        if (runId) workbench.setStreamingThoughtId(runId, newId);
        return;
      }

      if (category === 'CASE_ACTION' || type === 'CASE_ACTION' || payload?.event === 'case_created') {
        queryClient.invalidateQueries({ queryKey: ['synapse', 'dashboard', 'agent-stream'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
        if (caseId) {
          useWorkbenchReactiveStore.getState().setSuggestedSelectCaseId(caseId);
        }
      }

      if (type === 'ANALYSIS_STARTED' || category === 'ANALYSIS_STARTED') {
        if (caseId) {
          const workbench = useWorkbenchReactiveStore.getState();
          workbench.addAnalyzing(caseId);
          workbench.setSuggestedSelectCaseId(caseId);
          const streamUrl = normalizeStreamUrl(payload, runId);
          if (streamUrl) {
            workbench.setPendingAutoStream({ caseId, streamUrl, runId });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['synapse', 'dashboard', 'agent-stream'] });
        queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      }
    },
    [queryClient]
  );

  useNotificationWebSocket({
    enabled,
    showToastOnReceive: false,
    subscribeByTenant: false,
    onReceive: onNotificationReceive,
  });
}
