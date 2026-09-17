import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDwaionSecureAttachment,
  createDwaionAttachmentAuditReport,
  detachDwaionConversationAttachments,
  deleteDwaionSecureAttachment,
  downloadDwaionAttachmentAuditReport,
  getDwaionSecureAttachment,
  newDwaionCommandAttempt,
  type DwaionAttachmentAuditReportReceipt,
  type DwaionAttachmentDetachReceipt,
  type DwaionSecureAttachment,
} from '@dwp-frontend/shared-utils';

import { useDwaionGovernedMutation } from '../../../components/use-dwaion-governed-mutation';
import {
  dwaionAttachmentCanUse,
  dwaionAttachmentNeedsPolling,
  dwaionAttachmentSelectionCanSubmit,
  validateDwaionAttachmentSelection,
  type DwaionAttachmentSelectionError,
} from './dwaion-secure-attachment-model';

type PendingUpload = {
  file: File;
  createCommandId: string;
  completeCommandId: string;
};

export function useDwaionSecureAttachments(
  conversationId?: string | null,
  initialAttachments: readonly DwaionSecureAttachment[] = []
) {
  const governCreate = useDwaionGovernedMutation('route.dwaion.work.attachment-create.action');
  const governDelete = useDwaionGovernedMutation('route.dwaion.work.attachment-delete.action');
  const governDetach = useDwaionGovernedMutation('route.dwaion.work.attachment-detach.action');
  const governAudit = useDwaionGovernedMutation('route.dwaion.work.attachment-audit-report.action');
  const [attachments, setAttachments] = useState<DwaionSecureAttachment[]>(() => [
    ...initialAttachments,
  ]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<DwaionAttachmentSelectionError | null>(null);
  const [operationError, setOperationError] = useState<
    'UPLOAD' | 'DELETE' | 'REFRESH' | 'DETACH' | 'AUDIT' | null
  >(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState<'DETACH' | 'AUDIT' | null>(null);
  const [detachReceipt, setDetachReceipt] = useState<DwaionAttachmentDetachReceipt | null>(null);
  const [auditReceipt, setAuditReceipt] = useState<DwaionAttachmentAuditReportReceipt | null>(null);
  const deleteCommands = useRef(new Map<string, { commandId: string; expectedRevision: number }>());
  const actionCommands = useRef(new Map<string, { commandId: string; idempotencyKey: string }>());

  const runUpload = useCallback(
    async (pending: PendingUpload) => {
      setUploadingNames((current) => [...current, pending.file.name]);
      setOperationError(null);
      try {
        const attachment = await governCreate((authority) =>
          createDwaionSecureAttachment(pending.file, {
            createCommandId: pending.createCommandId,
            completeCommandId: pending.completeCommandId,
            conversationId,
            authority,
          })
        );
        setAttachments((current) => [
          ...current.filter((item) => item.attachmentId !== attachment.attachmentId),
          attachment,
        ]);
        setUploads((current) => current.filter((item) => item !== pending));
      } catch {
        setOperationError('UPLOAD');
      } finally {
        setUploadingNames((current) => current.filter((name) => name !== pending.file.name));
      }
    },
    [conversationId, governCreate]
  );

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const error = validateDwaionAttachmentSelection(
        attachments.filter((item) => item.state !== 'DELETED').length + uploads.length,
        files
      );
      setSelectionError(error);
      if (error) return;
      const pending = files.map((file) => ({
        file,
        createCommandId: globalThis.crypto.randomUUID(),
        completeCommandId: globalThis.crypto.randomUUID(),
      }));
      setUploads((current) => [...current, ...pending]);
      pending.forEach((item) => void runUpload(item));
    },
    [attachments, runUpload, uploads.length]
  );

  const retryUploads = useCallback(() => {
    setOperationError(null);
    uploads.forEach((item) => void runUpload(item));
  }, [runUpload, uploads]);

  const detachAll = useCallback(async () => {
    if (!conversationId || uploads.length || uploadingNames.length || !attachments.length) return;
    const selection = attachments.map((item) => ({
      attachmentId: item.attachmentId,
      expectedRevision: item.revision,
    }));
    const key = `detach:${conversationId}:${selection
      .map((item) => `${item.attachmentId}:${item.expectedRevision}`)
      .join(',')}`;
    const attempt = actionCommands.current.get(key) ?? newDwaionCommandAttempt();
    actionCommands.current.set(key, attempt);
    setActionBusy('DETACH');
    setOperationError(null);
    try {
      const receipt = await governDetach((authority) =>
        detachDwaionConversationAttachments(conversationId, selection, attempt, authority)
      );
      actionCommands.current.delete(key);
      setDetachReceipt(receipt);
      setAttachments([]);
      setSelectionError(null);
    } catch {
      setOperationError('DETACH');
    } finally {
      setActionBusy(null);
    }
  }, [attachments, conversationId, governDetach, uploadingNames.length, uploads.length]);

  const issueAuditReport = useCallback(async () => {
    if (!conversationId || !attachments.length) return;
    const selection = attachments.map((item) => ({
      attachmentId: item.attachmentId,
      expectedRevision: item.revision,
    }));
    const sameReceipt =
      auditReceipt &&
      auditReceipt.conversationId === conversationId &&
      auditReceipt.attachmentIds.length === selection.length &&
      auditReceipt.attachmentIds.every((id) => selection.some((item) => item.attachmentId === id));
    const key = `audit:${conversationId}:${selection
      .map((item) => `${item.attachmentId}:${item.expectedRevision}`)
      .join(',')}`;
    const attempt = actionCommands.current.get(key) ?? newDwaionCommandAttempt();
    actionCommands.current.set(key, attempt);
    setActionBusy('AUDIT');
    setOperationError(null);
    try {
      const receipt =
        sameReceipt && auditReceipt
          ? auditReceipt
          : await governAudit((authority) =>
              createDwaionAttachmentAuditReport(conversationId, selection, attempt, authority)
            );
      if (!sameReceipt) {
        actionCommands.current.delete(key);
        setAuditReceipt(receipt);
      }
      const blob = await downloadDwaionAttachmentAuditReport(receipt.reportId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dwaion-attachment-audit-${receipt.reportId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setOperationError('AUDIT');
    } finally {
      setActionBusy(null);
    }
  }, [attachments, auditReceipt, conversationId, governAudit]);

  const remove = useCallback(
    async (attachment: DwaionSecureAttachment) => {
      let attempt = deleteCommands.current.get(attachment.attachmentId);
      if (!attempt) {
        attempt = {
          commandId: globalThis.crypto.randomUUID(),
          expectedRevision: attachment.revision,
        };
        deleteCommands.current.set(attachment.attachmentId, attempt);
      }
      setOperationError(null);
      setDeletingIds((current) =>
        current.includes(attachment.attachmentId) ? current : [...current, attachment.attachmentId]
      );
      try {
        const deleted = await governDelete((authority) =>
          deleteDwaionSecureAttachment(
            attachment.attachmentId,
            attempt!.expectedRevision,
            attempt!.commandId,
            authority
          )
        );
        setAttachments((current) =>
          current.map((item) => (item.attachmentId === deleted.attachmentId ? deleted : item))
        );
        if (deleted.state === 'DELETED') deleteCommands.current.delete(attachment.attachmentId);
      } catch {
        setOperationError('DELETE');
      } finally {
        setDeletingIds((current) =>
          current.filter((attachmentId) => attachmentId !== attachment.attachmentId)
        );
      }
    },
    [governDelete]
  );

  const removeAll = useCallback(async () => {
    for (const attachment of attachments.filter((item) => item.state !== 'DELETED')) {
      await remove(attachment);
    }
  }, [attachments, remove]);

  useEffect(() => {
    const active = attachments.filter(dwaionAttachmentNeedsPolling);
    if (!active.length) return undefined;
    const controller = new AbortController();
    const refresh = async () => {
      const results = await Promise.allSettled(
        active.map((item) => getDwaionSecureAttachment(item.attachmentId, controller.signal))
      );
      if (controller.signal.aborted) return;
      const next = results
        .filter(
          (result): result is PromiseFulfilledResult<DwaionSecureAttachment> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);
      if (next.length) {
        const byId = new Map(next.map((item) => [item.attachmentId, item]));
        setAttachments((current) => current.map((item) => byId.get(item.attachmentId) ?? item));
      }
      if (results.some((result) => result.status === 'rejected')) setOperationError('REFRESH');
    };
    const timer = globalThis.setInterval(() => void refresh(), 2_500);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [attachments]);

  const visible = useMemo(
    () => attachments.filter((item) => item.state !== 'DELETED'),
    [attachments]
  );
  const readyIds = useMemo(
    () => visible.filter(dwaionAttachmentCanUse).map((item) => item.attachmentId),
    [visible]
  );
  return {
    attachments: visible,
    readyIds,
    uploadingNames,
    selectionError,
    operationError,
    deletingIds,
    actionBusy,
    detachReceipt,
    auditReceipt,
    hasFiles: visible.length > 0 || uploads.length > 0,
    canSubmit: dwaionAttachmentSelectionCanSubmit(visible, uploadingNames.length > 0),
    addFiles,
    retryUploads,
    detachAll,
    issueAuditReport,
    remove,
    removeAll,
    clearError: () => {
      setSelectionError(null);
      setOperationError(null);
    },
  };
}
