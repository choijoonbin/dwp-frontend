import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  decideDwaionRoutineAdvancedCommand,
  getDwaionRoutinePendingApprovals,
  HttpError,
  newDwaionRoutineCommandId,
  useToast,
  type DwaionRoutineAdvancedCommand,
  type DwaionRoutineAdvancedDecisionInput,
} from '@dwp-frontend/shared-utils';

import { useDwaionGovernedMutation } from '../../../components/use-dwaion-governed-mutation';

export const ROUTINE_APPROVAL_QUEUE_KEY = ['dwaion', 'routine-advanced-pending-approvals'] as const;

export function useDwaionRoutineApprovalQueue({
  enabled,
  identity,
  approvedMessage,
  rejectedMessage,
  failedMessage,
}: {
  enabled: boolean;
  identity: string;
  approvedMessage: string;
  rejectedMessage: string;
  failedMessage: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const governDecision = useDwaionGovernedMutation(
    'route.dwaion.work.routine-advanced-approval.action'
  );
  const commandIds = useRef(new Map<string, string>());
  const query = useQuery({
    queryKey: [...ROUTINE_APPROVAL_QUEUE_KEY, identity],
    queryFn: ({ signal }) => getDwaionRoutinePendingApprovals(signal),
    enabled,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) =>
      !(error instanceof HttpError && [401, 403, 404].includes(error.status)) && failureCount < 2,
    meta: { accessSensitive: true },
  });
  const mutation = useMutation({
    mutationFn: (input: {
      command: DwaionRoutineAdvancedCommand;
      decision: DwaionRoutineAdvancedDecisionInput;
    }) => {
      const key = `${input.command.commandId}:${input.command.version}:${input.decision.decision}`;
      const commandId = commandIds.current.get(key) ?? newDwaionRoutineCommandId();
      commandIds.current.set(key, commandId);
      return governDecision((authority) =>
        decideDwaionRoutineAdvancedCommand(input.command, commandId, input.decision, authority)
      );
    },
    onSuccess: async (command, input) => {
      commandIds.current.delete(
        `${input.command.commandId}:${input.command.version}:${input.decision.decision}`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROUTINE_APPROVAL_QUEUE_KEY }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'personal-routines'] }),
        queryClient.invalidateQueries({ queryKey: ['dwaion', 'routine-advanced-commands'] }),
      ]);
      toast.success(command.state === 'SUCCEEDED' ? approvedMessage : rejectedMessage);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) void query.refetch();
      toast.error(failedMessage);
    },
  });

  return {
    commands: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: query.isError,
    pending: mutation.isPending,
    retry: () => query.refetch(),
    decide: async (
      command: DwaionRoutineAdvancedCommand,
      decision: DwaionRoutineAdvancedDecisionInput
    ) => {
      await mutation.mutateAsync({ command, decision });
    },
  };
}
