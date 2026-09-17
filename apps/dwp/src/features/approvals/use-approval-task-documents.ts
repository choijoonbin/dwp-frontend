import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApprovalTask, HttpError } from '@dwp-frontend/shared-utils';
import {
  appendApprovalTaskComment,
  exportApprovalTaskDocument,
  getApprovalDocumentComments,
  getApprovalDocumentTools,
} from '@dwp-frontend/shared-utils/api/approval-document-api';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { hasApprovalTaskContentAccess } from './approval-command-center-model';
import { sameApprovalDocumentSnapshot } from './approval-document-snapshot';
import { useApprovalDocumentMutation } from './use-approval-document-mutation';

import type { ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import type {
  ApprovalDocumentTools,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

type Command = Readonly<{
  kind: 'COMMENT' | 'PRINT' | 'DOWNLOAD';
  text: string;
  key: string;
  tools: ApprovalDocumentTools;
  identity: string;
  epoch: number;
}>;
type SourceOptions = {
  taskId?: string;
  ready?: boolean;
  error?: unknown;
  refreshOwner?: () => Promise<ApprovalTaskDetail>;
};
const denied = (error: unknown) =>
  error instanceof HttpError && [401, 403, 404].includes(error.status);
export function useApprovalTaskDocuments(
  detail: ApprovalTaskDetail | undefined,
  assertCurrent: () => void,
  source: SourceOptions = {}
) {
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const client = useQueryClient();
  const commentAction = useApprovalDocumentMutation('route.approvals.work.task-comment.action');
  const exportAction = useApprovalDocumentMutation(
    'route.approvals.work.task-document-export.action'
  );
  const taskId = source.taskId ?? detail?.task.taskId;
  const ownerIdentity = JSON.stringify([taskId, ...scope.cacheKey]);
  const binding = useRef({ ownerIdentity, version: detail?.task.version, detail });
  if (binding.current.ownerIdentity !== ownerIdentity)
    binding.current = { ownerIdentity, version: detail?.task.version, detail };
  else if (detail && detail.task.taskId === taskId)
    binding.current = { ownerIdentity, version: detail.task.version, detail };
  const pinnedDetail = binding.current.detail;
  const identity = JSON.stringify([ownerIdentity, binding.current.version]);
  const epoch = useRef({ identity, value: 0 });
  if (epoch.current.identity !== identity)
    epoch.current = { identity, value: epoch.current.value + 1 };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const installed = commentAction.available && exportAction.available;
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  const [sourceDenied, setSourceDenied] = useState(false);
  const deniedRef = useRef(false);
  const [dialog, setDialog] = useState<Command['kind'] | null>(null);
  const [text, setText] = useState('');
  const stateIdentity = useRef(identity);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [page, setPage] = useState(0);
  const owner = { type: 'TASK', id: taskId ?? '' } as const;
  const ownerReady = Boolean(
    scope.ready &&
    source.ready !== false &&
    detail &&
    detail.task.taskId === taskId &&
    hasApprovalTaskContentAccess(detail) &&
    !source.error
  );
  const queryKey = [
    'approvals',
    'task-document-tools',
    owner.id,
    epoch.current.value,
    ...scope.cacheKey,
  ] as const;
  const tools = useQuery({
    queryKey,
    meta: scope.queryMeta,
    queryFn: ({ signal }) => getApprovalDocumentTools(owner, scope.contextScopeKey, signal),
    enabled: installed && ownerReady && !sourceDenied,
    retry: false,
    staleTime: 15000,
  });
  const ready =
    installed &&
    ownerReady &&
    !blocked &&
    !blockedRef.current &&
    !sourceDenied &&
    !deniedRef.current &&
    tools.isSuccess &&
    !tools.isFetching &&
    tools.failureCount === 0 &&
    tools.failureReason === null &&
    tools.data.taskId === owner.id &&
    tools.data.requestId === detail?.task.requestId &&
    tools.data.taskVersion === detail?.task.version;
  const commentsKey = [
    'approvals',
    'task-document-comments',
    owner.id,
    page,
    epoch.current.value,
    ...scope.cacheKey,
  ] as const;
  const comments = useQuery({
    queryKey: commentsKey,
    meta: scope.queryMeta,
    queryFn: ({ signal }) =>
      getApprovalDocumentComments(owner, page, 25, scope.contextScopeKey, signal),
    enabled: ready,
    retry: false,
    staleTime: 15000,
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<Command | null>(null);
  const pendingRef = useRef<Command | null>(null);
  const [failure, setFailure] = useState<'UNKNOWN' | 'CONFLICT' | 'DENIED' | 'UNAVAILABLE' | null>(
    null
  );
  const [artifact, setArtifact] = useState<ApprovalGeneratedDocument | null>(null);
  const artifactRef = useRef<ApprovalGeneratedDocument | null>(null);
  const artifactCommand = useRef<Command | null>(null);
  const live = useRef({
    identity,
    epoch: epoch.current.value,
    ready,
    detail,
    scope,
    assertCurrent,
    queryKey,
    commentsKey,
    refreshOwner: source.refreshOwner,
  });
  live.current = {
    identity,
    epoch: epoch.current.value,
    ready,
    detail,
    scope,
    assertCurrent,
    queryKey,
    commentsKey,
    refreshOwner: source.refreshOwner,
  };
  const isCurrent = (command: Pick<Command, 'identity' | 'epoch'>) =>
    mounted.current &&
    command.identity === live.current.identity &&
    command.epoch === live.current.epoch;
  useEffect(() => {
    stateIdentity.current = identity;
    setPending(null);
    pendingRef.current = null;
    setFailure(null);
    setBlocked(false);
    blockedRef.current = false;
    setSourceDenied(false);
    deniedRef.current = false;
    setDialog(null);
    setText('');
    setPage(0);
    setArtifact(null);
    artifactRef.current = null;
    artifactCommand.current = null;
  }, [identity]);
  const sourceErrors = [
    source.error,
    tools.failureReason,
    tools.error,
    comments.failureReason,
    comments.error,
  ];
  const sourceError = sourceErrors.find(denied) ?? sourceErrors.find(Boolean);
  const sourceHidden =
    sourceDenied || denied(sourceError) || Boolean(detail && !hasApprovalTaskContentAccess(detail));
  const currentReady =
    ready &&
    !sourceError &&
    !sourceHidden &&
    comments.isSuccess &&
    !comments.isFetching &&
    comments.failureCount === 0;
  live.current.ready = currentReady;
  const latchFailure = (error: unknown) => {
    blockedRef.current = true;
    setBlocked(true);
    if (denied(error)) {
      deniedRef.current = true;
      setSourceDenied(true);
      setDialog(null);
    }
    artifactRef.current = null;
    artifactCommand.current = null;
    setArtifact(null);
  };
  useEffect(() => {
    if (sourceError) latchFailure(sourceError);
  }, [sourceError, identity]);
  const assertSource = (command: Command) => {
    const cached = client.getQueryState<ApprovalDocumentTools>(live.current.queryKey);
    if (
      !isCurrent(command) ||
      !live.current.ready ||
      blockedRef.current ||
      deniedRef.current ||
      cached?.status !== 'success' ||
      cached.fetchStatus !== 'idle' ||
      cached.error ||
      cached.fetchFailureCount > 0
    )
      throw new HttpError('Document source changed', 409);
    const data = cached.data;
    if (
      !data ||
      !sameApprovalDocumentSnapshot(
        command.tools,
        data,
        command.kind === 'COMMENT' && pendingRef.current === command
      )
    )
      throw new HttpError('Cached document version changed', 409);
    const allowed =
      command.kind === 'COMMENT'
        ? data.comment.allowed
        : command.kind === 'PRINT'
          ? data.print.allowed
          : data.jsonExport.allowed;
    if (!allowed) throw new HttpError('Cached document operation denied', 403);
    const cachedComments = client.getQueryState<NonNullable<typeof comments.data>>(
      live.current.commentsKey
    );
    if (
      command.kind === 'COMMENT' &&
      (cachedComments?.status !== 'success' ||
        cachedComments.fetchStatus !== 'idle' ||
        cachedComments.error ||
        cachedComments.fetchFailureCount > 0 ||
        (pendingRef.current !== command &&
          cachedComments.data?.commentsVersion !== data.commentsVersion))
    )
      throw cachedComments?.error ?? new HttpError('Comment source changed', 409);
    live.current.assertCurrent();
  };
  const verify = async (command: Command, retry = false) => {
    assertSource(command);
    if (!detail) throw new HttpError('Document owner unavailable', 409);
    const latest = await getApprovalTask(owner.id, scope.contextScopeKey);
    assertSource(command);
    if (!hasApprovalTaskContentAccess(latest)) throw new HttpError('Document content denied', 403);
    if (
      !isCurrent(command) ||
      latest.task.taskId !== owner.id ||
      latest.task.version !== detail.task.version ||
      latest.task.requestId !== detail.task.requestId
    )
      throw new HttpError('Document authority changed', 409);
    const fresh = await getApprovalDocumentTools(owner, scope.contextScopeKey);
    if (
      !isCurrent(command) ||
      !sameApprovalDocumentSnapshot(command.tools, fresh, retry && command.kind === 'COMMENT')
    )
      throw new HttpError('Document version changed', 409);
    const allowed =
      command.kind === 'COMMENT'
        ? fresh.comment.allowed
        : command.kind === 'PRINT'
          ? fresh.print.allowed
          : fresh.jsonExport.allowed;
    if (!allowed) throw new HttpError('Document operation denied', 403);
    assertSource(command);
    client.setQueryData(queryKey, fresh);
    return fresh;
  };
  const execute = async (command: Command, retry = false) => {
    if (
      busyRef.current ||
      refreshingRef.current ||
      (pendingRef.current && pendingRef.current !== command)
    )
      return null;
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    let dispatched = false;
    let acknowledged = false;
    try {
      await verify(command, retry);
      const run = command.kind === 'COMMENT' ? commentAction.run : exportAction.run;
      const result = await run(async (execution) => {
        assertSource(command);
        dispatched = true;
        if (command.kind === 'COMMENT')
          return {
            kind: 'COMMENT' as const,
            value: await appendApprovalTaskComment(
              owner.id,
              Object.freeze({
                expectedVersion: command.tools.taskVersion!,
                expectedCommentsVersion: command.tools.commentsVersion,
                idempotencyKey: command.key,
                text: command.text,
              }),
              execution
            ),
          };
        return {
          kind: 'EXPORT' as const,
          value: await exportApprovalTaskDocument(
            owner.id,
            Object.freeze({
              expectedVersion: command.tools.taskVersion!,
              payloadRevision: command.tools.payloadRevision,
              expectedPolicyVersion: command.tools.policyVersion,
              reason: command.text,
              idempotencyKey: command.key,
              intent: command.kind,
            }),
            execution
          ),
        };
      });
      if (!isCurrent(command)) return null;
      acknowledged = true;
      await verify(command, command.kind === 'COMMENT');
      if (!isCurrent(command)) return null;
      pendingRef.current = null;
      setPending(null);
      if (result.kind === 'EXPORT') {
        const value = result.value;
        artifactCommand.current = command;
        artifactRef.current = value;
        setArtifact(value);
      } else void comments.refetch();
      return result.value;
    } catch (error) {
      if (!isCurrent(command)) return null;
      if (!dispatched || !unknownResult(error)) latchFailure(error);
      const unknown = unknownResult(error);
      if (retry || (dispatched && (unknown || acknowledged))) {
        pendingRef.current = command;
        setPending(command);
        setFailure('UNKNOWN');
      } else {
        setBlocked(true);
        setFailure(
          unknown
            ? 'UNAVAILABLE'
            : error instanceof HttpError && error.status === 409
              ? 'CONFLICT'
              : 'DENIED'
        );
      }
      return null;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const start = (kind: Command['kind'], text: string) => {
    if (!ready || pendingRef.current || busyRef.current || refreshingRef.current || !tools.data)
      return Promise.resolve(null);
    return execute(
      Object.freeze({
        kind,
        text,
        key: crypto.randomUUID(),
        tools: tools.data,
        identity,
        epoch: epoch.current.value,
      })
    );
  };
  const closeArtifact = () => {
    artifactRef.current = null;
    artifactCommand.current = null;
    setArtifact(null);
  };
  const artifactCurrent = () => {
    const command = artifactCommand.current;
    if (!command || !artifactRef.current || !isCurrent(command) || !live.current.ready)
      return false;
    try {
      assertSource(command);
      return (
        Date.parse(artifactRef.current.expiresAt) > Date.now() &&
        Date.parse(artifactRef.current.retainUntil) > Date.now()
      );
    } catch {
      return false;
    }
  };
  const verifyArtifact = async () => {
    const command = artifactCommand.current;
    if (!command) throw new Error('Document artifact unavailable');
    try {
      await verify(command);
      if (!artifactCurrent()) throw new Error('Document artifact expired');
    } catch (error) {
      if (isCurrent(command)) latchFailure(error);
      throw error;
    }
  };
  const refreshSource = async () => {
    if (busyRef.current || refreshingRef.current || !pinnedDetail || !taskId) return;
    const expected = { identity, epoch: epoch.current.value };
    if (!isCurrent(expected)) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const latest = live.current.refreshOwner
        ? await live.current.refreshOwner()
        : await getApprovalTask(owner.id, scope.contextScopeKey);
      if (
        !isCurrent(expected) ||
        latest.task.taskId !== taskId ||
        latest.task.requestId !== pinnedDetail.task.requestId ||
        latest.task.version !== pinnedDetail.task.version
      )
        throw new HttpError('Document owner changed during recovery', 409);
      if (!hasApprovalTaskContentAccess(latest)) throw new HttpError('Document owner denied', 403);
      const result = await tools.refetch();
      if (
        !isCurrent(expected) ||
        !result.isSuccess ||
        result.isFetching ||
        result.error ||
        result.data.taskId !== taskId ||
        result.data.requestId !== latest.task.requestId ||
        result.data.taskVersion !== latest.task.version
      )
        throw result.error ?? new HttpError('Document source recovery failed', 409);
      const currentComments = await comments.refetch();
      if (
        !isCurrent(expected) ||
        !currentComments.isSuccess ||
        currentComments.error ||
        currentComments.data.commentsVersion !== result.data.commentsVersion
      )
        throw currentComments.error ?? new HttpError('Comment source recovery failed', 409);
      live.current.assertCurrent();
      blockedRef.current = false;
      deniedRef.current = false;
      setBlocked(false);
      setSourceDenied(false);
      if (!pendingRef.current) setFailure(null);
    } catch (error) {
      if (isCurrent(expected)) latchFailure(error);
      throw error;
    } finally {
      refreshingRef.current = false;
      if (mounted.current) setRefreshing(false);
    }
  };
  let retryAvailable = false;
  if (pending && currentReady && !refreshing) {
    try {
      assertSource(pending);
      retryAvailable = true;
    } catch {
      // An UNKNOWN command remains private until its original pins and capability match.
    }
  }
  return {
    tools,
    comments,
    ready: currentReady,
    sourceDenied: sourceHidden,
    busy,
    refreshing,
    retryAvailable,
    dialog: stateIdentity.current === identity ? dialog : null,
    text: sourceHidden || stateIdentity.current !== identity ? '' : text,
    setText: (value: string) => {
      if (
        !isCurrent({ identity, epoch: epoch.current.value }) ||
        busyRef.current ||
        pendingRef.current ||
        deniedRef.current ||
        refreshingRef.current
      )
        return;
      setText(value);
    },
    openDialog: (kind: Command['kind']) => {
      if (
        !isCurrent({ identity, epoch: epoch.current.value }) ||
        !live.current.ready ||
        busyRef.current ||
        pendingRef.current ||
        blockedRef.current
      )
        return;
      setText('');
      setDialog(kind);
    },
    closeDialog: () => {
      if (busyRef.current || pendingRef.current || refreshingRef.current) return;
      setDialog(null);
      setText('');
    },
    completeDialog: () => {
      if (pendingRef.current || busyRef.current) return;
      setDialog(null);
      setText('');
    },
    pending: pending && isCurrent(pending) ? pending : null,
    failure,
    page,
    setPage,
    refreshSource,
    artifact:
      artifactCommand.current && isCurrent(artifactCommand.current) && ready && !sourceHidden
        ? artifact
        : null,
    start,
    retryOriginal: () =>
      pendingRef.current ? execute(pendingRef.current, true) : Promise.resolve(null),
    closeArtifact,
    artifactCurrent,
    verifyArtifact,
  };
}
const unknownResult = (error: unknown) =>
  !(error instanceof HttpError) || error.status >= 500 || error.status === 408;
export type ApprovalTaskDocumentsController = ReturnType<typeof useApprovalTaskDocuments>;
