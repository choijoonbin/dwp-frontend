import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HOME_DISMISS_RECOMMENDATION_ACTION,
  HttpError,
  executeHomeV2WidgetAction,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';

import { resolveHomeRecommendationCommand } from './home-recommendation-command-contract';
import { HOME_V2_QUERY_ROOT } from './use-home-v2-runtime';

import type {
  HomeDeviceClass,
  HomeRecommendation,
  HomeV2WidgetCommandStatus,
} from '@dwp-frontend/shared-utils';
import type { useHomeV2Runtime } from './use-home-v2-runtime';

type HomeV2Runtime = ReturnType<typeof useHomeV2Runtime>;
export type HomeRecommendationCommandUiState =
  | 'DISABLED'
  | 'READY'
  | 'CONFIRMING'
  | 'PENDING'
  | HomeV2WidgetCommandStatus
  | 'CONFLICT'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

type PendingCommand = Readonly<{
  command: Extract<
    ReturnType<typeof resolveHomeRecommendationCommand>,
    { kind: 'READY' }
  >['command'];
  recommendation: HomeRecommendation;
}>;

export function resolveHomeRecommendationCommandUiState({
  availability,
  confirming,
  pending,
  terminal,
}: Readonly<{
  availability: 'DISABLED' | 'DENIED' | 'UNAVAILABLE' | 'READY';
  confirming: boolean;
  pending: boolean;
  terminal: HomeRecommendationCommandUiState | null;
}>): HomeRecommendationCommandUiState {
  if (availability !== 'READY') return availability;
  if (pending) return 'PENDING';
  if (confirming) return 'CONFIRMING';
  return terminal ?? 'READY';
}

function terminalState(error: unknown): HomeRecommendationCommandUiState {
  if (!(error instanceof HttpError)) return 'UNKNOWN';
  if (error.status === 403) return 'DENIED';
  if (error.status === 409) return 'CONFLICT';
  if (error.status === 503) return 'UNAVAILABLE';
  return 'UNKNOWN';
}

export function useHomeRecommendationCommand({
  deviceClass,
  runtime,
  timeZone,
}: Readonly<{
  deviceClass: HomeDeviceClass;
  runtime: HomeV2Runtime;
  timeZone: string;
}>) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [terminal, setTerminal] = useState<HomeRecommendationCommandUiState | null>(null);
  const intentRef = useRef<ReturnType<typeof resolveIdempotentMutationIntent> | null>(null);
  const result = runtime.activation.kind === 'ACTIVE' ? runtime.activation.result : null;
  const availability = useMemo(
    () =>
      result
        ? resolveHomeRecommendationCommand(result.snapshot.data, result.metadata)
        : ({ kind: 'DISABLED' } as const),
    [result]
  );
  const expectedDecisionRevision = result?.metadata.decisionRevision ?? null;
  const capabilityKey =
    availability.kind === 'READY'
      ? [
          result?.metadata.rolloutRevision,
          expectedDecisionRevision,
          availability.command.instanceId,
          availability.command.expectedResultVersion,
          ...availability.command.recommendationKeys,
        ].join(':')
      : availability.kind;

  useEffect(() => {
    setPending(null);
    setTerminal(null);
    intentRef.current = null;
  }, [capabilityKey]);

  const mutation = useMutation({
    mutationFn: async (request: PendingCommand) => {
      const fingerprint = {
        instanceId: request.command.instanceId,
        actionId: request.command.actionId,
        expectedResultVersion: request.command.expectedResultVersion,
        recommendationKey: request.recommendation.key,
      };
      intentRef.current = resolveIdempotentMutationIntent(intentRef.current, fingerprint);
      if (!expectedDecisionRevision) {
        throw new HttpError('Home command authority is unavailable.', 503);
      }
      return executeHomeV2WidgetAction({
        actionId: HOME_DISMISS_RECOMMENDATION_ACTION.actionId,
        deviceClass,
        expectedResultVersion: request.command.expectedResultVersion,
        expectedDecisionRevision,
        idempotencyKey: intentRef.current.key,
        instanceId: request.command.instanceId,
        mode: result!.snapshot.data.mode,
        parameters: { recommendationKey: request.recommendation.key },
        timeZone,
      });
    },
    onSuccess: async (receipt) => {
      setPending(null);
      setTerminal(receipt.status);
      await queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT });
    },
    onError: (error) => {
      setPending(null);
      setTerminal(terminalState(error));
      if (error instanceof HttpError && (error.status === 403 || error.status === 409)) {
        void queryClient.invalidateQueries({ queryKey: HOME_V2_QUERY_ROOT });
      }
    },
    retry: false,
  });

  const request = (recommendation: HomeRecommendation) => {
    if (
      availability.kind !== 'READY' ||
      !availability.command.recommendationKeys.includes(recommendation.key)
    ) {
      setTerminal(availability.kind === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DENIED');
      return;
    }
    setTerminal(null);
    setPending({ command: availability.command, recommendation });
  };
  const confirm = () => {
    if (!pending || mutation.isPending) return;
    if (
      availability.kind !== 'READY' ||
      availability.command.instanceId !== pending.command.instanceId ||
      availability.command.expectedResultVersion !== pending.command.expectedResultVersion ||
      !availability.command.recommendationKeys.includes(pending.recommendation.key)
    ) {
      setPending(null);
      setTerminal('DENIED');
      return;
    }
    mutation.mutate(pending);
  };
  const status = resolveHomeRecommendationCommandUiState({
    availability: availability.kind,
    confirming: pending !== null,
    pending: mutation.isPending,
    terminal,
  });

  return {
    busy: mutation.isPending,
    cancel: () => {
      if (!mutation.isPending) setPending(null);
    },
    clearStatus: () => setTerminal(null),
    confirm,
    dismiss: status === 'READY' ? request : undefined,
    feedbackStatus: terminal,
    pendingRecommendation: pending?.recommendation ?? null,
    status,
  } as const;
}
