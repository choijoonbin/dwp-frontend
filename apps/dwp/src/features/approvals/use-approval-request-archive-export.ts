import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { getApprovalRequestDetail, HttpError, usePermissions } from '@dwp-frontend/shared-utils';
import {
  exportApprovalArchive,
  getApprovalDocumentTools,
} from '@dwp-frontend/shared-utils/api/approval-document-api';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalExperience } from './use-approval-experience';
import { useApprovalDocumentMutation } from './use-approval-document-mutation';
import { approvalRequestCommandResultUnknown } from './approval-request-command-model';
import {
  APPROVAL_REQUEST_DOCUMENT_ROUTES,
  approvalArchiveDocumentsEligible,
  sameApprovalRequestDocument,
} from './approval-request-document-model';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';
import type {
  ApprovalArchiveExportInput,
  ApprovalDocumentTools,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

type Command = ApprovalManagementScopedCommand<
  Readonly<{
    requests: readonly ApprovalRequest[];
    tools: readonly ApprovalDocumentTools[];
    input: ApprovalArchiveExportInput;
  }>
>;

export function useApprovalRequestArchiveExport(requests: readonly ApprovalRequest[]) {
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const epoch = useApprovalManagementCommandScope(scope.cacheKey);
  const identity = JSON.stringify(epoch.binding);
  const { canViewRequests } = useApprovalExperience();
  const { hasPermission } = usePermissions();
  const dispatch = useApprovalDocumentMutation(APPROVAL_REQUEST_DOCUMENT_ROUTES.archive);
  const queryClient = useQueryClient();
  const available =
    dispatch.available && canViewRequests && hasPermission('ACTION.APPROVAL_REQUEST', 'EXPORT');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [reason, setReason] = useState('');
  const [recovery, setRecovery] = useState<'ERROR' | 'CONFLICT' | 'UNKNOWN'>();
  const [verificationError, setVerificationError] = useState<unknown>();
  const verificationBlocked = useRef(false);
  const [artifact, setArtifact] =
    useState<Readonly<{ command: Command; document: ApprovalGeneratedDocument }>>();
  const artifactRef = useRef(artifact);
  artifactRef.current = artifact;
  const active = useRef<Command | undefined>(undefined);
  const unknown = useRef<Command | undefined>(undefined);
  const retryingUnknown = useRef<Command | undefined>(undefined);
  const mounted = useRef(true);
  const queries = useQueries({
    queries: requests.slice(0, 50).map((request) => ({
      queryKey: [
        'approvals',
        ...scope.cacheKey,
        'archive-document-tools',
        request.requestId,
        request.version,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getApprovalDocumentTools(
          { type: 'REQUEST', id: request.requestId },
          scope.contextScopeKey,
          signal
        ),
      enabled: open && available && scope.ready,
      meta: scope.queryMeta,
      staleTime: 0,
      gcTime: 0,
      retry: false,
    })),
  });
  const queryReady =
    open &&
    available &&
    scope.ready &&
    requests.length > 0 &&
    requests.length <= 50 &&
    queries.length === requests.length &&
    queries.every((query) => query.data && !query.isError && !query.isFetching);
  const selectedRequests = requests.filter((request) => selected.includes(request.requestId));
  const selectedTools = selectedRequests
    .map((request) => queries[requests.indexOf(request)]?.data)
    .filter((item): item is ApprovalDocumentTools => Boolean(item));
  const ready =
    !verificationError &&
    queryReady &&
    approvalArchiveDocumentsEligible(selectedTools, selectedRequests);
  const latest = useRef({ identity, requests, queries, queryReady, available });
  latest.current = { identity, requests, queries, queryReady, available };
  const current = (command: Command) =>
    mounted.current &&
    epoch.isCurrent(command) &&
    latest.current.identity === identity &&
    latest.current.queryReady &&
    latest.current.available &&
    !verificationBlocked.current &&
    command.input.requests.every((request, index) => {
      const at = latest.current.requests.findIndex(
        (item) =>
          item.requestId === request.requestId &&
          item.version === request.version &&
          item.status === request.status
      );
      const toolsKey = [
        'approvals',
        ...scope.cacheKey,
        'archive-document-tools',
        request.requestId,
        request.version,
      ];
      const query = queryClient.getQueryState(toolsKey);
      const tools = queryClient.getQueryData<ApprovalDocumentTools>(toolsKey);
      return (
        at >= 0 &&
        query?.status === 'success' &&
        query.fetchStatus === 'idle' &&
        !query.error &&
        Boolean(
          tools &&
          sameApprovalRequestDocument(command.input.tools[index]!, tools) &&
          tools.archiveExport.allowed &&
          tools.jsonExport.allowed
        )
      );
    });
  const assertCurrent = (command: Command) => {
    if (!current(command)) throw new HttpError('Current archive authority changed.', 409);
  };
  const verifySource = async (command: Command) => {
    assertCurrent(command);
    const freshRequests: ApprovalRequest[] = [];
    const freshTools: ApprovalDocumentTools[] = [];
    for (const request of command.input.requests) {
      const detail = await getApprovalRequestDetail(request.requestId, scope.contextScopeKey);
      assertCurrent(command);
      const tools = await getApprovalDocumentTools(
        { type: 'REQUEST', id: request.requestId },
        scope.contextScopeKey
      );
      assertCurrent(command);
      freshRequests.push(detail.request);
      freshTools.push(tools);
    }
    if (
      !approvalArchiveDocumentsEligible(freshTools, freshRequests) ||
      freshTools.some(
        (tools, index) => !sameApprovalRequestDocument(command.input.tools[index]!, tools)
      )
    )
      throw new HttpError('Archive document or policy changed.', 409);
  };
  const preflight = async (command: Command) => {
    try {
      await verifySource(command);
    } catch (error) {
      if (mounted.current && epoch.isCurrent(command)) {
        verificationBlocked.current = true;
        setVerificationError(error);
        artifactRef.current = undefined;
        setArtifact(undefined);
      }
      throw error;
    }
  };
  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: Command) => {
      await preflight(command);
      const document = await dispatch.run((execution) => {
        assertCurrent(command);
        unknown.current = command;
        return exportApprovalArchive(command.input.input, execution);
      });
      return { command, document };
    },
    onSuccess: ({ command, document }) => {
      if (!mounted.current || !epoch.isCurrent(command)) return;
      unknown.current = undefined;
      setRecovery(undefined);
      if (current(command)) setArtifact({ command, document });
    },
    onError: (error, command) => {
      if (!mounted.current || !epoch.isCurrent(command)) return;
      verificationBlocked.current = true;
      setVerificationError(error);
      artifactRef.current = undefined;
      const unresolved =
        retryingUnknown.current === command ||
        (unknown.current === command && approvalRequestCommandResultUnknown(error));
      if (!unresolved) unknown.current = undefined;
      setRecovery(
        unresolved
          ? 'UNKNOWN'
          : error instanceof HttpError && error.status === 409
            ? 'CONFLICT'
            : 'ERROR'
      );
      setArtifact(undefined);
    },
    onSettled: (_, __, command) => {
      if (active.current === command) active.current = undefined;
      if (retryingUnknown.current === command) retryingUnknown.current = undefined;
    },
  });
  useEffect(() => {
    setOpen(false);
    setSelected([]);
    setReason('');
    setRecovery(undefined);
    verificationBlocked.current = false;
    setVerificationError(undefined);
    setArtifact(undefined);
    active.current = undefined;
    unknown.current = undefined;
    retryingUnknown.current = undefined;
  }, [identity]);
  const rows = JSON.stringify(requests.map((request) => [request.requestId, request.version]));
  useEffect(() => {
    if (!active.current && !unknown.current) {
      setSelected([]);
      setArtifact(undefined);
    }
  }, [rows]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!active.current && !unknown.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const artifactCurrent = () =>
    Boolean(
      artifact &&
      artifactRef.current === artifact &&
      current(artifact.command) &&
      Date.parse(artifact.document.expiresAt) > Date.now() &&
      Date.parse(artifact.document.retainUntil) > Date.now()
    );
  return {
    open,
    setOpen: (value: boolean) => {
      if (!active.current) setOpen(value);
    },
    selected,
    reason,
    setReason: (value: string) => {
      if (!active.current && !unknown.current) setReason(value);
    },
    ready,
    available,
    queries,
    queryReady,
    recovery,
    verificationError,
    pending: mutation.isPending,
    isBlocked: () => Boolean(active.current || unknown.current),
    unknown: Boolean(unknown.current),
    retryAllowed: Boolean(unknown.current && current(unknown.current)),
    artifact: artifactCurrent() ? artifact : undefined,
    artifactCurrent,
    toggle: (id: string) => {
      if (!active.current && !unknown.current)
        setSelected((current) =>
          current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        );
    },
    begin: () => {
      if (
        !ready ||
        active.current ||
        unknown.current ||
        reason.trim().length < 4 ||
        reason.length > 1000
      )
        return;
      const first = selectedTools[0]!;
      const command = epoch.capture(
        Object.freeze({
          requests: Object.freeze([...selectedRequests]),
          tools: Object.freeze([...selectedTools]),
          input: Object.freeze({
            items: Object.freeze(
              selectedTools.map((tools) =>
                Object.freeze({
                  requestId: tools.requestId,
                  expectedVersion: tools.requestVersion,
                  payloadRevision: tools.payloadRevision,
                })
              )
            ),
            expectedPolicyVersion: first.policyVersion,
            expectedPolicyId: first.policyId,
            resourceSetKey: first.resourceSetKey,
            reason: reason.trim(),
            idempotencyKey: crypto.randomUUID(),
          }),
        })
      );
      if (!current(command)) return;
      active.current = command;
      setRecovery(undefined);
      setArtifact(undefined);
      mutation.mutate(command);
    },
    retryOriginal: () => {
      const command = unknown.current;
      if (!command || active.current || mutation.isPending || !current(command)) return;
      active.current = command;
      retryingUnknown.current = command;
      mutation.mutate(command);
    },
    refresh: async (refreshedRequests?: readonly ApprovalRequest[]) => {
      const binding = epoch.capture(undefined);
      const originalRequests = [...(refreshedRequests ?? latest.current.requests)];
      if (!originalRequests.length || originalRequests.length > 50) return;
      try {
        const freshDetails = await Promise.all(
          originalRequests.map((request) =>
            getApprovalRequestDetail(request.requestId, scope.contextScopeKey)
          )
        );
        const freshQueries = await Promise.all(queries.map((query) => query.refetch()));
        if (
          !mounted.current ||
          !epoch.isCurrent(binding) ||
          originalRequests.length !== freshQueries.length
        )
          return;
        const valid =
          freshQueries.length === originalRequests.length &&
          freshQueries.every((query, index) => {
            const request = originalRequests[index]!;
            const freshRequest = freshDetails[index]?.request;
            return (
              query.isSuccess &&
              query.data &&
              freshRequest?.requestId === request.requestId &&
              freshRequest.version === request.version &&
              freshRequest.status === request.status &&
              query.data.requestId === request.requestId &&
              query.data.requestVersion === request.version
            );
          });
        if (valid) {
          verificationBlocked.current = false;
          setVerificationError(undefined);
        }
      } catch (error) {
        if (mounted.current && epoch.isCurrent(binding)) {
          verificationBlocked.current = true;
          setVerificationError(error);
        }
      }
    },
    verifyArtifact: async () => {
      if (!artifactCurrent() || !artifact) throw new HttpError('Archive artifact changed.', 409);
      await preflight(artifact.command);
      if (!artifactCurrent()) throw new HttpError('Archive artifact changed.', 409);
    },
    clearArtifact: () => {
      artifactRef.current = undefined;
      setArtifact(undefined);
    },
  };
}
