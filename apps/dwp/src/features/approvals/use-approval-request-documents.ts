import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApprovalRequestDetail, HttpError, usePermissions } from '@dwp-frontend/shared-utils';
import {
  appendApprovalRequestComment,
  exportApprovalRequestDocument,
  getApprovalDocumentComments,
  getApprovalDocumentTools,
} from '@dwp-frontend/shared-utils/api/approval-document-api';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalDocumentMutation } from './use-approval-document-mutation';
import { useApprovalExperience } from './use-approval-experience';
import { approvalRequestCommandResultUnknown } from './approval-request-command-model';
import {
  APPROVAL_REQUEST_DOCUMENT_ROUTES,
  approvalRequestDocumentMatches,
  sameApprovalRequestDocument,
} from './approval-request-document-model';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type {
  ApprovalDocumentTools,
  ApprovalDocumentCommentInput,
  ApprovalDocumentExportInput,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

type Input = Readonly<{ tools: ApprovalDocumentTools }> &
  (
    | Readonly<{ kind: 'COMMENT'; input: ApprovalDocumentCommentInput }>
    | Readonly<{ kind: 'EXPORT'; input: ApprovalDocumentExportInput }>
  );
type Command = ApprovalManagementScopedCommand<Input>;

export function useApprovalRequestDocuments(
  requestId: string,
  detail?: ApprovalRequestDetail,
  isOwnerCurrent?: () => boolean,
  ownerError?: unknown
) {
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const epoch = useApprovalManagementCommandScope(scope.cacheKey);
  const generation = JSON.stringify([epoch.binding, requestId]);
  const sourceBinding = useRef({ generation, version: detail?.request.version });
  if (sourceBinding.current.generation !== generation)
    sourceBinding.current = { generation, version: detail?.request.version };
  else if (detail?.request.requestId === requestId)
    sourceBinding.current.version = detail.request.version;
  const { canViewRequests, canUpdateRequests } = useApprovalExperience();
  const { hasPermission } = usePermissions();
  const canExport = canViewRequests && hasPermission('ACTION.APPROVAL_REQUEST', 'EXPORT');
  const commentDispatch = useApprovalDocumentMutation(APPROVAL_REQUEST_DOCUMENT_ROUTES.comment);
  const exportDispatch = useApprovalDocumentMutation(APPROVAL_REQUEST_DOCUMENT_ROUTES.export);
  const owner = { type: 'REQUEST', id: requestId } as const;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [text, setText] = useState('');
  const [recovery, setRecovery] = useState<'CONFLICT' | 'DENIED' | 'ERROR' | 'UNKNOWN'>();
  const [verificationError, setVerificationError] = useState<unknown>();
  const verificationBlocked = useRef(false);
  const [artifact, setArtifact] =
    useState<Readonly<{ command: Command; document: ApprovalGeneratedDocument }>>();
  const currentArtifact = useRef(artifact);
  currentArtifact.current = artifact;
  const unknown = useRef<Command | undefined>(undefined);
  const retryingUnknown = useRef<Command | undefined>(undefined);
  const active = useRef<Command | undefined>(undefined);
  const mounted = useRef(true);
  const ownerCurrent = useRef(isOwnerCurrent);
  ownerCurrent.current = isOwnerCurrent;
  const toolsKey = [
    'approvals',
    ...scope.cacheKey,
    'request-document-tools',
    requestId,
    sourceBinding.current.version,
  ];
  const tools = useQuery({
    queryKey: toolsKey,
    queryFn: ({ signal }) => getApprovalDocumentTools(owner, scope.contextScopeKey, signal),
    enabled: scope.ready && canViewRequests && Boolean(detail?.request.requestId === requestId),
    meta: scope.queryMeta,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const visibleTools =
    scope.ready &&
    canViewRequests &&
    detail &&
    !tools.isError &&
    !tools.isFetching &&
    approvalRequestDocumentMatches(tools.data, detail.request)
      ? tools.data
      : undefined;
  const commentsKey = [
    'approvals',
    ...scope.cacheKey,
    'request-document-comments',
    requestId,
    page,
    approvalRequestDocumentMatches(tools.data, {
      requestId,
      version: sourceBinding.current.version ?? -1,
    })
      ? tools.data.commentsVersion
      : undefined,
  ];
  const comments = useQuery({
    queryKey: commentsKey,
    queryFn: ({ signal }) =>
      getApprovalDocumentComments(owner, page, 25, scope.contextScopeKey, signal),
    enabled: Boolean(visibleTools),
    meta: scope.queryMeta,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const sourceReady = Boolean(
    !verificationError &&
    visibleTools &&
    !comments.isError &&
    !comments.isFetching &&
    comments.data?.commentsVersion === visibleTools.commentsVersion
  );
  const latest = useRef({
    generation,
    detail,
    visibleTools,
    sourceReady,
    canUpdateRequests,
    canExport,
  });
  latest.current = { generation, detail, visibleTools, sourceReady, canUpdateRequests, canExport };
  const replayingComment = (command: Command) =>
    unknown.current === command && command.input.kind === 'COMMENT';
  const cachedSourceCurrent = (command: Command) => {
    const cachedTools = queryClient.getQueryData<ApprovalDocumentTools>(toolsKey);
    const cachedComments = queryClient.getQueryData<{ commentsVersion: number }>(commentsKey);
    return Boolean(
      cachedTools &&
      cachedComments &&
      cachedComments.commentsVersion === cachedTools.commentsVersion &&
      sameApprovalRequestDocument(command.input.tools, cachedTools, replayingComment(command)) &&
      (command.input.kind === 'COMMENT'
        ? cachedTools.comment.allowed
        : command.input.input.intent === 'PRINT'
          ? cachedTools.print.allowed
          : cachedTools.jsonExport.allowed)
    );
  };
  const current = (command: Command) =>
    mounted.current &&
    epoch.isCurrent(command) &&
    latest.current.generation === generation &&
    latest.current.sourceReady &&
    !verificationBlocked.current &&
    (ownerCurrent.current?.() ?? true) &&
    cachedSourceCurrent(command) &&
    [toolsKey, commentsKey].every((key) => {
      const state = queryClient.getQueryState(key);
      return state?.status === 'success' && state.fetchStatus === 'idle' && !state.error;
    }) &&
    Boolean(
      latest.current.detail &&
      approvalRequestDocumentMatches(command.input.tools, latest.current.detail.request) &&
      latest.current.visibleTools &&
      sameApprovalRequestDocument(
        command.input.tools,
        latest.current.visibleTools,
        replayingComment(command)
      )
    );
  const permitted = (command: Command) =>
    command.input.kind === 'COMMENT'
      ? latest.current.canUpdateRequests &&
        commentDispatch.available &&
        command.input.tools.comment.allowed &&
        latest.current.visibleTools?.comment.allowed
      : latest.current.canExport &&
        exportDispatch.available &&
        (command.input.input.intent === 'PRINT'
          ? command.input.tools.print.allowed && latest.current.visibleTools?.print.allowed
          : command.input.tools.jsonExport.allowed &&
            latest.current.visibleTools?.jsonExport.allowed);
  const assertCurrent = (command: Command) => {
    if (!current(command) || !permitted(command))
      throw new HttpError('Current document source changed.', 409);
  };
  const verifySource = async (command: Command) => {
    assertCurrent(command);
    const freshDetail = await getApprovalRequestDetail(requestId, scope.contextScopeKey);
    assertCurrent(command);
    const fresh = await getApprovalDocumentTools(owner, scope.contextScopeKey);
    assertCurrent(command);
    if (
      !approvalRequestDocumentMatches(fresh, freshDetail.request) ||
      !sameApprovalRequestDocument(command.input.tools, fresh, replayingComment(command)) ||
      !(command.input.kind === 'COMMENT'
        ? fresh.comment.allowed
        : command.input.input.intent === 'PRINT'
          ? fresh.print.allowed
          : fresh.jsonExport.allowed)
    )
      throw new HttpError('Document or published policy changed.', 409);
  };
  const preflight = async (command: Command) => {
    try {
      await verifySource(command);
    } catch (error) {
      if (
        mounted.current &&
        epoch.isCurrent(command) &&
        command.input.tools.requestId === requestId
      ) {
        verificationBlocked.current = true;
        setVerificationError(error);
        if (error instanceof HttpError && [401, 403, 404].includes(error.status)) {
          setText('');
          setArtifact(undefined);
        }
      }
      throw error;
    }
  };
  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: Command) => {
      await preflight(command);
      if (command.input.kind === 'COMMENT') {
        const input = command.input.input;
        await commentDispatch.run(async (execution) => {
          assertCurrent(command);
          unknown.current = command;
          const result = await appendApprovalRequestComment(requestId, input, execution);
          if (
            !result ||
            result.requestId !== requestId ||
            result.sequence !== input.expectedCommentsVersion + 1 ||
            result.text !== input.text.trim()
          )
            throw new HttpError('Comment result could not be verified.', 503);
          return result;
        });
        return { command };
      }
      const exportInput = command.input.input;
      const document = await exportDispatch.run((execution) => {
        assertCurrent(command);
        unknown.current = command;
        return exportApprovalRequestDocument(requestId, exportInput, execution);
      });
      return { command, document };
    },
    onSuccess: async ({ command, document }) => {
      if (
        !mounted.current ||
        !epoch.isCurrent(command) ||
        command.input.tools.requestId !== requestId
      )
        return;
      unknown.current = undefined;
      setRecovery(undefined);
      if (document && current(command)) setArtifact({ command, document });
      if (command.input.kind === 'COMMENT') {
        setText('');
        await tools.refetch();
        await comments.refetch();
      }
    },
    onError: (error, command) => {
      if (
        !mounted.current ||
        !epoch.isCurrent(command) ||
        command.input.tools.requestId !== requestId
      )
        return;
      const status = error instanceof HttpError ? error.status : undefined;
      verificationBlocked.current = true;
      setVerificationError(error);
      const unresolved =
        retryingUnknown.current === command ||
        (unknown.current === command && approvalRequestCommandResultUnknown(error));
      if (!unresolved) unknown.current = undefined;
      setRecovery(
        unresolved
          ? 'UNKNOWN'
          : status === 403 || status === 401
            ? 'DENIED'
            : status === 409
              ? 'CONFLICT'
              : 'ERROR'
      );
      if (status === 401 || status === 403) {
        setText('');
        setArtifact(undefined);
      }
    },
    onSettled: (_, __, command) => {
      if (active.current === command) active.current = undefined;
      if (retryingUnknown.current === command) retryingUnknown.current = undefined;
    },
  });
  useEffect(() => {
    setPage(0);
    setText('');
    setRecovery(undefined);
    verificationBlocked.current = false;
    setVerificationError(undefined);
    setArtifact(undefined);
    unknown.current = undefined;
    retryingUnknown.current = undefined;
    active.current = undefined;
  }, [generation]);
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
  useEffect(() => {
    const error = [tools.error, comments.error, ownerError].find(
      (item) => item instanceof HttpError && [401, 403, 404].includes(item.status)
    );
    if (error instanceof HttpError && [401, 403, 404].includes(error.status)) {
      setText('');
      setArtifact(undefined);
    }
  }, [tools.error, comments.error, ownerError]);
  const begin = (input: Input) => {
    if (active.current || unknown.current || mutation.isPending) return;
    const command = epoch.capture(Object.freeze(input));
    if (!current(command) || !permitted(command)) return;
    active.current = command;
    setRecovery(undefined);
    setArtifact(undefined);
    mutation.mutate(command);
  };
  return {
    tools,
    comments,
    page,
    setPage,
    visibleTools,
    sourceReady,
    verificationError,
    text,
    setText: (value: string) => {
      if (!active.current && !unknown.current) setText(value);
    },
    recovery,
    commentAllowed:
      sourceReady &&
      Boolean(canUpdateRequests && commentDispatch.available && visibleTools?.comment.allowed),
    printAllowed:
      sourceReady && Boolean(canExport && exportDispatch.available && visibleTools?.print.allowed),
    downloadAllowed:
      sourceReady &&
      Boolean(canExport && exportDispatch.available && visibleTools?.jsonExport.allowed),
    pending: mutation.isPending,
    unknown: Boolean(unknown.current),
    retryAllowed: Boolean(
      unknown.current && current(unknown.current) && permitted(unknown.current)
    ),
    addComment: () => {
      if (
        active.current ||
        unknown.current ||
        mutation.isPending ||
        !visibleTools ||
        !text.trim() ||
        text.length > 2000
      )
        return;
      begin({
        kind: 'COMMENT',
        tools: visibleTools,
        input: Object.freeze({
          expectedVersion: visibleTools.requestVersion,
          expectedCommentsVersion: visibleTools.commentsVersion,
          text: text.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
    },
    exportDocument: (intent: 'PRINT' | 'DOWNLOAD', reason: string) => {
      if (
        active.current ||
        unknown.current ||
        mutation.isPending ||
        !visibleTools ||
        reason.trim().length < 4 ||
        reason.length > 1000
      )
        return;
      begin({
        kind: 'EXPORT',
        tools: visibleTools,
        input: Object.freeze({
          expectedVersion: visibleTools.requestVersion,
          payloadRevision: visibleTools.payloadRevision,
          expectedPolicyVersion: visibleTools.policyVersion,
          intent,
          reason: reason.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
    },
    artifact:
      artifact && epoch.isCurrent(artifact.command) && current(artifact.command)
        ? artifact
        : undefined,
    artifactCurrent: () =>
      Boolean(
        artifact &&
        currentArtifact.current === artifact &&
        current(artifact.command) &&
        Date.parse(artifact.document.expiresAt) > Date.now() &&
        Date.parse(artifact.document.retainUntil) > Date.now()
      ),
    verifyArtifact: async () => {
      if (!artifact || currentArtifact.current !== artifact || !current(artifact.command))
        throw new HttpError('Document authority changed.', 409);
      await preflight(artifact.command);
      assertCurrent(artifact.command);
      if (currentArtifact.current !== artifact)
        throw new HttpError('Generated document changed.', 409);
    },
    clearArtifact: () => {
      currentArtifact.current = undefined;
      setArtifact(undefined);
    },
    isBlocked: () => Boolean(active.current || unknown.current),
    retryOriginal: () => {
      const command = unknown.current;
      if (
        !command ||
        active.current ||
        mutation.isPending ||
        !current(command) ||
        !permitted(command)
      )
        return;
      active.current = command;
      retryingUnknown.current = command;
      mutation.mutate(command);
    },
    refresh: async (refreshedDetail?: ApprovalRequestDetail) => {
      const binding = epoch.capture(undefined);
      const context = refreshedDetail ?? latest.current.detail;
      if (active.current || !mounted.current || !epoch.isCurrent(binding)) return false;
      try {
        if (
          !context ||
          context.request.requestId !== requestId ||
          context.request.version !== sourceBinding.current.version
        )
          throw new HttpError('Owner recovery was not verified.', 409);
        const freshTools = await queryClient.fetchQuery({
          queryKey: [
            'approvals',
            ...scope.cacheKey,
            'request-document-tools',
            requestId,
            context.request.version,
          ],
          queryFn: ({ signal }) => getApprovalDocumentTools(owner, scope.contextScopeKey, signal),
          staleTime: 0,
          retry: false,
          meta: scope.queryMeta,
        });
        if (
          !mounted.current ||
          !epoch.isCurrent(binding) ||
          !approvalRequestDocumentMatches(freshTools, context.request)
        )
          throw new HttpError('Document recovery context changed.', 409);
        const freshComments = await queryClient.fetchQuery({
          queryKey: [
            'approvals',
            ...scope.cacheKey,
            'request-document-comments',
            requestId,
            page,
            freshTools.commentsVersion,
          ],
          queryFn: ({ signal }) =>
            getApprovalDocumentComments(owner, page, 25, scope.contextScopeKey, signal),
          staleTime: 0,
          retry: false,
          meta: scope.queryMeta,
        });
        if (
          !mounted.current ||
          !epoch.isCurrent(binding) ||
          freshComments.commentsVersion !== freshTools.commentsVersion ||
          !(ownerCurrent.current?.() ?? true)
        )
          throw new HttpError('Comment recovery context changed.', 409);
        verificationBlocked.current = false;
        setVerificationError(undefined);
        if (unknown.current?.input.kind === 'COMMENT') setText(unknown.current.input.input.text);
        return true;
      } catch (error) {
        if (mounted.current && epoch.isCurrent(binding)) {
          verificationBlocked.current = true;
          setVerificationError(error);
        }
        return false;
      }
    },
  };
}
