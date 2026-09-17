import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDwaionSecureAttachment,
  deleteDwaionSecureAttachment,
  getDwaionSecureAttachment,
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

export function useDwaionSecureAttachments(conversationId?: string | null) {
  const governCreate = useDwaionGovernedMutation('route.dwaion.work.attachment-create.action');
  const governDelete = useDwaionGovernedMutation('route.dwaion.work.attachment-delete.action');
  const [attachments, setAttachments] = useState<DwaionSecureAttachment[]>([]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<DwaionAttachmentSelectionError | null>(null);
  const [operationError, setOperationError] = useState<'UPLOAD' | 'DELETE' | 'REFRESH' | null>(
    null
  );
  const deleteCommands = useRef(new Map<string, string>());

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

  const remove = useCallback(
    async (attachment: DwaionSecureAttachment) => {
      let commandId = deleteCommands.current.get(attachment.attachmentId);
      if (!commandId) {
        commandId = globalThis.crypto.randomUUID();
        deleteCommands.current.set(attachment.attachmentId, commandId);
      }
      setOperationError(null);
      try {
        const deleted = await governDelete((authority) =>
          deleteDwaionSecureAttachment(
            attachment.attachmentId,
            attachment.revision,
            commandId!,
            authority
          )
        );
        setAttachments((current) =>
          current.map((item) => (item.attachmentId === deleted.attachmentId ? deleted : item))
        );
        deleteCommands.current.delete(attachment.attachmentId);
      } catch {
        setOperationError('DELETE');
      }
    },
    [governDelete]
  );

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
    hasFiles: visible.length > 0 || uploads.length > 0,
    canSubmit: dwaionAttachmentSelectionCanSubmit(visible, uploadingNames.length > 0),
    addFiles,
    retryUploads,
    remove,
    clearError: () => {
      setSelectionError(null);
      setOperationError(null);
    },
  };
}
