import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApprovalRequestDetail,
  getApprovalTask,
  HttpError,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import {
  getApprovalAttachments,
  getApprovalAttachmentUpload,
  reserveApprovalAttachmentUpload,
  uploadApprovalAttachmentContent,
  reconcileApprovalAttachmentUpload,
  cancelApprovalAttachmentUpload,
  selectApprovalAttachments,
  createApprovalRequestAttachmentDownloadGrant,
  createApprovalTaskAttachmentDownloadGrant,
  loadApprovalAttachmentDownload,
} from '@dwp-frontend/shared-utils/api/approval-attachment-api';
import { getApprovalDocumentTools } from '@dwp-frontend/shared-utils/api/approval-document-api';
import { resolveApprovalContentAccess } from '@dwp-frontend/shared-utils/api/approval-content-access';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { ApprovalAttachmentClientController } from './approval-attachment-client-controller';
import {
  approvalAttachmentItemMatches,
  approvalAttachmentSourceMatches,
  approvalAttachmentUploadMatches,
  sameApprovalAttachmentSource,
  approvalAttachmentSelectionReplayMatches,
} from './approval-attachment-client-model';
import {
  approvalAttachmentRouteInstalled,
  useApprovalAttachmentMutation,
} from './use-approval-attachment-mutation';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';

import type { ApprovalAttachmentClientCommand } from './approval-attachment-client-controller';
import type { ApprovalAttachmentSource } from './approval-attachment-client-model';
import type { ApprovalDocumentOwner } from '@dwp-frontend/shared-utils/api/approval-document-contract';
import type { ApprovalAttachments } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';

export function useApprovalAttachmentClient({
  owner,
  version,
  ready,
  isOwnerCurrent,
}: {
  owner: ApprovalDocumentOwner;
  version?: number;
  ready: boolean;
  isOwnerCurrent?: () => boolean;
}) {
  const scope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const commandScope = useApprovalManagementCommandScope(scope.cacheKey);
  const epoch = JSON.stringify([commandScope.binding, owner.type, owner.id]);
  const { hasPermission } = usePermissions();
  const resource = owner.type === 'TASK' ? 'ACTION.APPROVAL_TASK' : 'ACTION.APPROVAL_REQUEST';
  const canView = hasPermission(resource, 'VIEW');
  const canUpdate = owner.type === 'REQUEST' && canView && hasPermission(resource, 'UPDATE');
  const canExport = canView && hasPermission(resource, 'EXPORT');
  const reserve = useApprovalAttachmentMutation(
    'route.approvals.work.request-attachment-reserve.action'
  );
  const content = useApprovalAttachmentMutation(
    'route.approvals.work.attachment-upload-content.action'
  );
  const reconcile = useApprovalAttachmentMutation(
    'route.approvals.work.attachment-upload-reconcile.action'
  );
  const cancel = useApprovalAttachmentMutation(
    'route.approvals.work.attachment-upload-cancel.action'
  );
  const selection = useApprovalAttachmentMutation(
    'route.approvals.work.request-attachment-selection.action'
  );
  const download = useApprovalAttachmentMutation(
    owner.type === 'TASK'
      ? 'route.approvals.work.task-attachment-download.action'
      : 'route.approvals.work.request-attachment-download.action'
  );
  const dataInstalled = approvalAttachmentRouteInstalled(
    owner.type === 'TASK'
      ? 'route.approvals.work.task-attachments.data'
      : 'route.approvals.work.request-attachments.data',
    'GET',
    owner.type === 'TASK'
      ? '/api/approvals/v1/tasks/{taskId}/attachments'
      : '/api/approvals/v1/requests/{requestId}/attachments',
    'DATA'
  );
  const queryClient = useQueryClient();
  const queryKey = [
    'approvals',
    ...scope.cacheKey,
    'attachment-source',
    owner.type,
    owner.id,
    version,
  ];
  const read = async (signal?: AbortSignal): Promise<ApprovalAttachmentSource> => {
    const tools = await getApprovalDocumentTools(owner, scope.contextScopeKey, signal);
    const attachments = await getApprovalAttachments(owner, scope.contextScopeKey, signal, tools);
    const source = Object.freeze({ owner: Object.freeze({ ...owner }), tools, attachments });
    if (version === undefined || !approvalAttachmentSourceMatches(source, owner, version))
      throw new HttpError('Attachment owner source changed.', 409);
    return source;
  };
  const source = useQuery({
    queryKey,
    queryFn: ({ signal }) => read(signal),
    enabled:
      scope.ready &&
      ready &&
      canView &&
      dataInstalled &&
      Boolean(owner.id) &&
      version !== undefined,
    meta: scope.queryMeta,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    notifyOnChangeProps: 'all',
  });
  const mounted = useRef(true);
  const blocked = useRef(false);
  const [verificationFailure, setVerificationFailure] =
    useState<Readonly<{ epoch: string; error: unknown }>>();
  const previousEpoch = useRef(epoch);
  if (previousEpoch.current !== epoch) {
    previousEpoch.current = epoch;
    blocked.current = false;
  }
  const latest = useRef({ epoch, ready, version, canView, canUpdate, canExport, isOwnerCurrent });
  latest.current = {
    epoch,
    ready: ready && scope.ready,
    version,
    canView,
    canUpdate,
    canExport,
    isOwnerCurrent,
  };
  const sourceCurrent = (original?: ApprovalAttachmentSource) => {
    const state = queryClient.getQueryState<ApprovalAttachmentSource>(queryKey);
    const current = state?.data;
    return Boolean(
      mounted.current &&
      !blocked.current &&
      latest.current.epoch === epoch &&
      latest.current.ready &&
      latest.current.canView &&
      dataInstalled &&
      latest.current.version !== undefined &&
      (latest.current.isOwnerCurrent?.() ?? true) &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      !state.error &&
      current &&
      approvalAttachmentSourceMatches(current, owner, latest.current.version) &&
      queryClient
        .getQueryCache()
        .findAll()
        .every((query) => {
          const key = query.queryKey;
          const ownerQuery =
            key[0] === 'approvals' &&
            key.includes(owner.id) &&
            scope.cacheKey.every((part, index) => key[index + 1] === part) &&
            (key.includes('detail') ||
              key.includes('detail-view') ||
              key.includes('command-center-detail'));
          return (
            !ownerQuery ||
            (query.state.status === 'success' &&
              query.state.fetchStatus === 'idle' &&
              !query.state.error)
          );
        }) &&
      (!original || sameApprovalAttachmentSource(original, current))
    );
  };
  const action = (command: ApprovalAttachmentClientCommand) => {
    switch (command.kind) {
      case 'RESERVE':
        return reserve;
      case 'CONTENT':
        return content;
      case 'RECONCILE':
        return reconcile;
      case 'CANCEL':
        return cancel;
      case 'SELECT':
        return selection;
      case 'DOWNLOAD':
        return download;
    }
  };
  const assertCurrent = (command: ApprovalAttachmentClientCommand) => {
    const current = queryClient.getQueryData<ApprovalAttachmentSource>(queryKey);
    const replay = controllerRef.current?.isOriginalUnknown(command);
    const snapshotMatches =
      current &&
      (sameApprovalAttachmentSource(command.source, current) ||
        (replay &&
          command.kind === 'SELECT' &&
          approvalAttachmentSelectionReplayMatches(command.source, current, command.input)));
    if (
      command.epoch !== latest.current.epoch ||
      !sourceCurrent() ||
      !snapshotMatches ||
      !action(command).available ||
      (command.kind === 'DOWNLOAD'
        ? !latest.current.canExport ||
          !command.source.attachments.download.allowed ||
          !command.source.attachments.manifest.sealed ||
          !command.source.attachments.manifest.items.some((item) =>
            approvalAttachmentItemMatches(command.item, item)
          )
        : !latest.current.canUpdate ||
          !command.source.attachments.upload.allowed ||
          command.source.attachments.manifest.sealed)
    )
      throw new HttpError('Current attachment authority changed.', 409);
    if ('upload' in command && Date.parse(command.upload.expiresAt) <= Date.now())
      throw new HttpError('Attachment upload expired.', 409);
  };
  const verify = async (command: ApprovalAttachmentClientCommand) => {
    assertCurrent(command);
    const freshOwner =
      owner.type === 'TASK'
        ? await getApprovalTask(owner.id, scope.contextScopeKey)
        : await getApprovalRequestDetail(owner.id, scope.contextScopeKey);
    assertCurrent(command);
    const ownerVersion =
      'task' in freshOwner ? freshOwner.task.version : freshOwner.request.version;
    if ('task' in freshOwner && !resolveApprovalContentAccess(freshOwner).full)
      throw new HttpError('Current task content authority is unavailable.', 403);
    if (ownerVersion !== latest.current.version)
      throw new HttpError('Attachment owner version changed.', 409);
    const fresh = await read();
    assertCurrent(command);
    if (!(
      sameApprovalAttachmentSource(command.source, fresh) ||
      (controllerRef.current?.isOriginalUnknown(command) &&
        command.kind === 'SELECT' &&
        approvalAttachmentSelectionReplayMatches(command.source, fresh, command.input))
    ))
      throw new HttpError('Attachment policy or manifest changed.', 409);
    if ('upload' in command) {
      const upload = await getApprovalAttachmentUpload(
        command.upload.uploadId,
        scope.contextScopeKey
      );
      assertCurrent(command);
      if (
        !approvalAttachmentUploadMatches(command.upload, upload) ||
        (!controllerRef.current?.isOriginalUnknown(command) &&
          upload.version !== command.input.expectedVersion)
      )
        throw new HttpError('Original upload version changed.', 409);
    }
  };
  const guardedVerify = async (command: ApprovalAttachmentClientCommand) => {
    try {
      await verify(command);
    } catch (error) {
      if (latest.current.epoch === command.epoch) {
        blocked.current = true;
        setVerificationFailure({ epoch: command.epoch, error });
      }
      throw error;
    }
  };
  const controllerRef = useRef<ApprovalAttachmentClientController | null>(null);
  const environment = {
    current: () => {
      const current = queryClient.getQueryData<ApprovalAttachmentSource>(queryKey);
      return sourceCurrent() && current ? { source: current, epoch } : undefined;
    },
    assertCurrent,
    execute: async (
      command: ApprovalAttachmentClientCommand,
      blob: Blob | undefined,
      onDispatch: () => void
    ) => {
      await guardedVerify(command);
      return action(command).run(async (execution) => {
        await guardedVerify(command);
        const options = { beforeDispatch: onDispatch };
        switch (command.kind) {
          case 'RESERVE':
            return reserveApprovalAttachmentUpload(owner.id, command.input, execution, options);
          case 'CONTENT':
            if (!blob) throw new HttpError('Original attachment bytes are missing.', 409);
            return uploadApprovalAttachmentContent(
              command.upload,
              blob,
              command.input,
              execution,
              options
            );
          case 'RECONCILE':
            return reconcileApprovalAttachmentUpload(
              command.upload.uploadId,
              command.input,
              execution,
              options
            );
          case 'CANCEL':
            return cancelApprovalAttachmentUpload(
              command.upload.uploadId,
              command.input,
              execution,
              options
            );
          case 'SELECT':
            return selectApprovalAttachments(owner.id, command.input, execution, options);
          case 'DOWNLOAD': {
            const grant =
              owner.type === 'TASK'
                ? await createApprovalTaskAttachmentDownloadGrant(
                    owner.id,
                    command.item,
                    command.input,
                    execution,
                    options
                  )
                : await createApprovalRequestAttachmentDownloadGrant(
                    owner.id,
                    command.item,
                    command.input,
                    execution,
                    options
                  );
            assertCurrent(command);
            if (
              !approvalAttachmentRouteInstalled(
                'route.approvals.work.attachment-download-content.data',
                'GET',
                '/api/approvals/v1/attachment-downloads/{grantId}/content',
                'DATA'
              )
            )
              throw new HttpError('Attachment download contract is unavailable.', 409);
            const artifact = await loadApprovalAttachmentDownload(
              grant,
              command.item,
              scope.contextScopeKey,
              { beforeDispatch: () => assertCurrent(command) }
            );
            assertCurrent(command);
            await guardedVerify(command);
            assertCurrent(command);
            if (Date.parse(grant.expiresAt) <= Date.now())
              throw new HttpError('Attachment grant expired.', 409);
            const url = URL.createObjectURL(artifact.blob);
            try {
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = artifact.fileName;
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
            } finally {
              window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            return;
          }
        }
      });
    },
    inspect: async (upload: Parameters<typeof approvalAttachmentUploadMatches>[0]) => {
      if (
        !sourceCurrent() ||
        !approvalAttachmentRouteInstalled(
          'route.approvals.work.attachment-upload.data',
          'GET',
          '/api/approvals/v1/attachment-uploads/{uploadId}',
          'DATA'
        )
      )
        throw new HttpError('Attachment status authority is unavailable.', 409);
      const fresh = await getApprovalAttachmentUpload(upload.uploadId, scope.contextScopeKey);
      if (!sourceCurrent()) throw new HttpError('Attachment source changed.', 409);
      return fresh;
    },
    sourceUpdated: (attachments: ApprovalAttachments) => {
      const current = queryClient.getQueryData<ApprovalAttachmentSource>(queryKey);
      if (current) queryClient.setQueryData(queryKey, Object.freeze({ ...current, attachments }));
    },
  };
  if (!controllerRef.current)
    controllerRef.current = new ApprovalAttachmentClientController(environment);
  const controller = controllerRef.current;
  controller.configure(environment, epoch);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  useEffect(() => {
    if (!sourceCurrent() || controller.unresolved) return;
    const waiting = state.uploads.filter((row) =>
      ['QUARANTINED', 'SCANNING'].includes(row.upload.state)
    );
    if (!waiting.length) return;
    const timer = window.setInterval(() => {
      if (!sourceCurrent() || controller.unresolved || controller.getSnapshot().busy) return;
      void (async () => {
        for (const row of waiting) {
          if (!sourceCurrent() || controller.unresolved) return;
          await controller.inspect(row.upload.uploadId);
        }
      })();
    }, 15_000);
    return () => window.clearInterval(timer);
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const denied =
    state.problem === 'DENIED' ||
    [
      source.error,
      verificationFailure?.epoch === epoch ? verificationFailure.error : undefined,
    ].some((error) => error instanceof HttpError && [401, 403, 404].includes(error.status));
  const current = sourceCurrent();
  return {
    controller,
    state,
    source,
    queryKey,
    attachments: !denied && current ? source.data?.attachments : undefined,
    masked: denied || !canView || !scope.ready,
    available: dataInstalled,
    ready: current,
    uploadReady:
      current &&
      canUpdate &&
      reserve.available &&
      content.available &&
      selection.available &&
      Boolean(source.data?.attachments.upload.allowed && !source.data.attachments.manifest.sealed),
    downloadReady:
      current &&
      canExport &&
      download.available &&
      Boolean(source.data?.attachments.download.allowed),
    refresh: async () => {
      if (!dataInstalled || !ready || !scope.ready || !canView) return;
      const expectedEpoch = epoch;
      const result = await source.refetch();
      if (latest.current.epoch !== expectedEpoch || result.isError || !result.data) return;
      blocked.current = false;
      setVerificationFailure(undefined);
      controller.recoverSource();
    },
  };
}

export type ApprovalAttachmentClient = ReturnType<typeof useApprovalAttachmentClient>;
