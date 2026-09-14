import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteApprovalDraft,
  getApprovalDraftReconciliation,
  recoverApprovalDraft,
  restoreApprovalDraft,
  HttpError,
  useToast,
} from '@dwp-frontend/shared-utils';

import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalGovernedMutation } from './use-approval-governed-mutation';

import type { ApprovalDraftState, ApprovalRequest } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

export type ApprovalRequestDraftAction = 'delete' | 'restore' | 'recover';
type DraftCommand = Readonly<{
  kind: ApprovalRequestDraftAction;
  request: ApprovalRequest;
  revision?: number;
  reason: string;
  idempotencyKey: string;
}>;
type ScopedCommand = ApprovalManagementScopedCommand<DraftCommand>;

export function useApprovalRequestDraftCommand({
  cacheKey,
  contextScopeKey,
  ready,
  reloadCurrent,
}: {
  cacheKey: readonly string[];
  contextScopeKey?: string;
  ready: boolean;
  reloadCurrent: (request: ApprovalRequest) => Promise<ApprovalRequest | undefined>;
}) {
  const { t } = useTranslation('approvals');
  const toast = useToast();
  const queryClient = useQueryClient();
  const scope = useApprovalManagementCommandScope(cacheKey);
  const alive = useRef(true);
  const readyRef = useRef(ready);
  const activeAttempt = useRef<string | undefined>(undefined);
  const unresolved = useRef<ScopedCommand | undefined>(undefined);
  readyRef.current = ready;
  const [action, setAction] = useState<DraftCommand>();
  const [problem, setProblem] = useState<'CONFLICT' | 'DENIED' | 'UNKNOWN' | 'ERROR'>();
  const runDelete = useApprovalGovernedMutation('route.approvals.work.request-draft-delete.action');
  const runRestore = useApprovalGovernedMutation(
    'route.approvals.work.request-draft-restore.action'
  );
  const runRecover = useApprovalGovernedMutation(
    'route.approvals.work.request-draft-recover.action'
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setAction(undefined);
    setProblem(undefined);
    activeAttempt.current = undefined;
    unresolved.current = undefined;
  }, [scope.binding.scopeIdentity]);
  const isCurrent = (command: ScopedCommand) => alive.current && scope.isCurrent(command);
  const execute = async (command: ScopedCommand): Promise<ApprovalDraftState> => {
    if (!isCurrent(command) || !readyRef.current)
      throw new HttpError('Approval draft authority is not current.', 409);
    const { kind, request, reason, revision, idempotencyKey } = command.input;
    const run = kind === 'delete' ? runDelete : kind === 'restore' ? runRestore : runRecover;
    return run(async (execution) => {
      if (!isCurrent(command) || !readyRef.current)
        throw new HttpError('Approval draft identity changed.', 409);
      const input = { expectedVersion: request.version, idempotencyKey, reason };
      if (kind === 'delete') return deleteApprovalDraft(request.requestId, input, execution);
      if (kind === 'restore') return restoreApprovalDraft(request.requestId, input, execution);
      if (!revision) throw new HttpError('Approval draft revision is missing.', 409);
      return recoverApprovalDraft(request.requestId, { ...input, revision }, execution);
    });
  };
  const requireReceipt = (command: ScopedCommand, receipt: ApprovalDraftState) => {
    if (
      receipt.requestId !== command.input.request.requestId ||
      !Number.isSafeInteger(receipt.version) ||
      receipt.version <= command.input.request.version ||
      (command.input.kind === 'delete' ? !receipt.deletedAt : Boolean(receipt.deletedAt))
    ) {
      throw new Error('Approval draft command receipt is not authoritative.');
    }
  };
  const mutation = useMutation({
    mutationFn: async ({ command, reconcile }: { command: ScopedCommand; reconcile: boolean }) => {
      if (!isCurrent(command)) throw new HttpError('Approval draft identity changed.', 409);
      if (reconcile) {
        const result = await getApprovalDraftReconciliation(
          command.input.idempotencyKey,
          contextScopeKey
        );
        if (
          !isCurrent(command) ||
          result.idempotencyKey !== command.input.idempotencyKey ||
          !Array.isArray(result.receipts)
        )
          throw new Error('Approval draft receipt identity is invalid.');
        const matching = result.receipts.filter(
          (receipt) =>
            receipt.commandType === command.input.kind.toUpperCase() &&
            receipt.route ===
              `POST /v1/requests/${command.input.request.requestId}/draft/${command.input.kind}`
        );
        if (matching.length > 1) throw new Error('Approval draft receipt is ambiguous.');
        const receipt = matching[0]?.draft ?? (await execute(command));
        requireReceipt(command, receipt);
        return { command, receipt };
      }
      const latest = await reloadCurrent(command.input.request);
      if (
        !isCurrent(command) ||
        latest?.requestId !== command.input.request.requestId ||
        latest.version !== command.input.request.version ||
        latest.status !== 'DRAFT'
      )
        throw new HttpError('Approval draft changed before command.', 409);
      const receipt = await execute(command);
      requireReceipt(command, receipt);
      return { command, receipt };
    },
    onSuccess: async ({ command }) => {
      if (!isCurrent(command)) return;
      setAction(undefined);
      setProblem(undefined);
      unresolved.current = undefined;
      await queryClient.invalidateQueries({ queryKey: ['approvals', ...cacheKey] });
      if (isCurrent(command)) toast.success(t('requests.drafts.commandSaved'));
    },
    onError: (error, { command, reconcile }) => {
      if (!isCurrent(command)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      const next =
        status === 409
          ? reconcile && unresolved.current
            ? 'UNKNOWN'
            : 'CONFLICT'
          : [401, 403, 404].includes(status ?? 0)
            ? 'DENIED'
            : status && status < 500
              ? 'ERROR'
              : 'UNKNOWN';
      setProblem(next);
      if (next === 'UNKNOWN') unresolved.current = command;
      if (next === 'DENIED') setAction(undefined);
    },
    onSettled: (_, __, { command }) => {
      if (activeAttempt.current === command.input.idempotencyKey) activeAttempt.current = undefined;
    },
  });

  const open = (kind: ApprovalRequestDraftAction, request: ApprovalRequest, revision?: number) => {
    if (
      !ready ||
      activeAttempt.current ||
      unresolved.current ||
      mutation.isPending ||
      problem ||
      request.status !== 'DRAFT'
    )
      return;
    setAction({ kind, request, revision, reason: '', idempotencyKey: crypto.randomUUID() });
  };
  const refresh = async () => {
    if (problem === 'UNKNOWN' || activeAttempt.current || mutation.isPending) return;
    const binding = scope.binding;
    if (unresolved.current) {
      if (!alive.current || !scope.isCurrent(unresolved.current)) return;
      setAction(unresolved.current.input);
      setProblem('UNKNOWN');
      return;
    }
    const latest = action ? await reloadCurrent(action.request) : undefined;
    if (!alive.current || !scope.isCurrent(binding) || (action && !latest)) return;
    if (action && latest)
      setAction({ ...action, request: latest, idempotencyKey: crypto.randomUUID() });
    setProblem(undefined);
  };
  return {
    action,
    problem,
    pending: mutation.isPending,
    unresolved: Boolean(unresolved.current),
    open,
    setReason: (reason: string) => {
      if (!mutation.isPending && !unresolved.current && problem !== 'UNKNOWN')
        setAction((current) => (current ? { ...current, reason } : current));
    },
    close: () => {
      if (!mutation.isPending && !unresolved.current && problem !== 'UNKNOWN') {
        setAction(undefined);
        setProblem(undefined);
      }
    },
    submit: () => {
      if (
        action &&
        ready &&
        !problem &&
        !mutation.isPending &&
        !unresolved.current &&
        !activeAttempt.current &&
        action.reason.trim()
      ) {
        activeAttempt.current = action.idempotencyKey;
        mutation.mutate({
          command: scope.capture({ ...action, reason: action.reason.trim() }),
          reconcile: false,
        });
      }
    },
    reconcile: () => {
      if (action && !mutation.isPending && !activeAttempt.current && problem === 'UNKNOWN') {
        activeAttempt.current = action.idempotencyKey;
        mutation.mutate({ command: scope.capture(action), reconcile: true });
      }
    },
    refresh,
  };
}
