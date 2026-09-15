import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getApprovalRequestDetail, HttpError } from '@dwp-frontend/shared-utils';

import {
  approvalDraftBackupFingerprint,
  approvalDraftBackupSource,
  createApprovalDraftBackupArtifact,
  downloadApprovalDraftBackup,
  sameApprovalDraftBackupSource,
} from './approval-request-draft-backup';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';

import type { ApprovalRequest, ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

export type ApprovalDraftBackupProblem = 'STALE' | 'DENIED' | 'UNAVAILABLE';

type BackupCommand = ApprovalManagementScopedCommand<
  Readonly<{
    requestId: string;
    version: number;
    contextScopeKey?: string;
    fingerprint: string;
  }>
>;

export function useApprovalRequestDraftBackup({
  cacheKey,
  contextScopeKey,
  ready,
  request,
  detail,
}: {
  cacheKey: readonly string[];
  contextScopeKey?: string;
  ready: boolean;
  request?: ApprovalRequest;
  detail?: ApprovalRequestDetail;
}) {
  const scope = useApprovalManagementCommandScope(cacheKey);
  const mounted = useRef(true);
  const active = useRef<BackupCommand | undefined>(undefined);
  const [problem, setProblem] = useState<ApprovalDraftBackupProblem>();
  const source = (() => {
    if (
      !ready ||
      !request ||
      !detail ||
      request.requestId !== detail.request.requestId ||
      request.version !== detail.request.version ||
      request.status !== 'DRAFT'
    )
      return undefined;
    try {
      return approvalDraftBackupSource(detail);
    } catch {
      return undefined;
    }
  })();
  const sourceFingerprint = source ? approvalDraftBackupFingerprint(source) : '';
  const latest = useRef({ ready, request, detail, source, sourceFingerprint, contextScopeKey });
  latest.current = { ready, request, detail, source, sourceFingerprint, contextScopeKey };

  const current = (command: BackupCommand) => {
    const value = latest.current;
    return (
      mounted.current &&
      scope.isCurrent(command) &&
      value.ready &&
      value.contextScopeKey === command.input.contextScopeKey &&
      value.request?.requestId === command.input.requestId &&
      value.request.version === command.input.version &&
      value.request.status === 'DRAFT' &&
      value.detail?.request.requestId === command.input.requestId &&
      value.sourceFingerprint === command.input.fingerprint
    );
  };
  const assertCurrent = (command: BackupCommand) => {
    if (!current(command)) throw new HttpError('Approval draft backup context changed.', 409);
  };

  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: BackupCommand) => {
      assertCurrent(command);
      const freshDetail = await getApprovalRequestDetail(
        command.input.requestId,
        command.input.contextScopeKey
      );
      assertCurrent(command);
      const freshSource = approvalDraftBackupSource(freshDetail);
      const cachedSource = latest.current.source;
      if (
        !cachedSource ||
        freshSource.requestId !== command.input.requestId ||
        freshSource.expectedVersion !== command.input.version ||
        !sameApprovalDraftBackupSource(cachedSource, freshSource)
      )
        throw new HttpError('Approval draft changed before backup.', 409);
      const artifact = await createApprovalDraftBackupArtifact(freshSource);
      assertCurrent(command);
      downloadApprovalDraftBackup(artifact, () => current(command));
      return command;
    },
    onSuccess: (command) => {
      if (current(command)) setProblem(undefined);
    },
    onError: (error, command) => {
      if (!mounted.current || !scope.isCurrent(command)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      setProblem(
        status === 409 ? 'STALE' : [401, 403, 404].includes(status ?? 0) ? 'DENIED' : 'UNAVAILABLE'
      );
    },
    onSettled: (_, __, command) => {
      if (active.current === command) active.current = undefined;
    },
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    active.current = undefined;
    setProblem(undefined);
  }, [scope.binding.scopeIdentity, scope.binding.scopeEpoch, sourceFingerprint]);

  return {
    ready: Boolean(source) && !mutation.isPending && !active.current,
    pending: mutation.isPending,
    problem,
    download: () => {
      if (!source || !ready || active.current || mutation.isPending) return;
      const command = scope.capture(
        Object.freeze({
          requestId: source.requestId,
          version: source.expectedVersion,
          ...(contextScopeKey ? { contextScopeKey } : {}),
          fingerprint: sourceFingerprint,
        })
      );
      if (!current(command)) return;
      active.current = command;
      setProblem(undefined);
      mutation.mutate(command);
    },
  };
}
