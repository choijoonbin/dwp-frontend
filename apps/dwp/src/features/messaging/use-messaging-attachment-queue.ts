import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createMessagingAttachmentUpload,
  discardMessagingAttachment,
  uploadMessagingAttachmentContent,
  useToast,
} from '@dwp-frontend/shared-utils';

import type { MessagingAttachment } from '@dwp-frontend/shared-utils';

export const MESSAGING_ATTACHMENT_ACCEPT = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.txt',
  '.csv',
  '.docx',
  '.xlsx',
  '.pptx',
].join(',');

const MAX_ATTACHMENTS = 10;
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  txt: 'text/plain',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export type MessagingAttachmentDraft = {
  localId: string;
  file: File;
  state: 'UPLOADING' | 'READY' | 'REJECTED' | 'ERROR';
  attachment?: MessagingAttachment;
};

export type MessagingAttachmentQueue = {
  items: MessagingAttachmentDraft[];
  readyIds: string[];
  busy: boolean;
  addFiles: (files: File[]) => void;
  retry: (localId: string) => void;
  remove: (localId: string) => void;
  clear: () => void;
};

function contentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export function useMessagingAttachmentQueue(
  conversationId: string | null
): MessagingAttachmentQueue {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const [items, setItems] = useState<MessagingAttachmentDraft[]>([]);
  const itemsRef = useRef(items);
  const generationRef = useRef(0);
  const conversationRef = useRef(conversationId);

  const replaceItems = useCallback((next: MessagingAttachmentDraft[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const updateItem = useCallback(
    (localId: string, update: (item: MessagingAttachmentDraft) => MessagingAttachmentDraft) => {
      replaceItems(
        itemsRef.current.map((item) => (item.localId === localId ? update(item) : item))
      );
    },
    [replaceItems]
  );

  const upload = useCallback(
    async (draft: MessagingAttachmentDraft, generation: number) => {
      if (!conversationId) return;
      try {
        const session = await createMessagingAttachmentUpload({
          conversationId,
          filename: draft.file.name,
          contentType: contentType(draft.file),
          sizeBytes: draft.file.size,
          idempotencyKey: crypto.randomUUID(),
        });
        if (generationRef.current !== generation) return;
        updateItem(draft.localId, (current) => ({ ...current, attachment: session.attachment }));
        if (!session.uploadUrl) {
          throw new Error('The attachment upload session is not writable.');
        }
        const attachment = await uploadMessagingAttachmentContent(session.uploadUrl, draft.file);
        if (generationRef.current !== generation) return;
        updateItem(draft.localId, (current) => ({
          ...current,
          attachment,
          state: attachment.status === 'CLEAN' ? 'READY' : 'REJECTED',
        }));
      } catch {
        if (generationRef.current !== generation) return;
        updateItem(draft.localId, (current) => ({ ...current, state: 'ERROR' }));
      }
    },
    [conversationId, updateItem]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (!conversationId || !files.length) return;
      const remaining = MAX_ATTACHMENTS - itemsRef.current.length;
      if (remaining <= 0) {
        toast.warning(t('conversation.attachments.limit', { count: MAX_ATTACHMENTS }));
        return;
      }
      const accepted = files.slice(0, remaining);
      if (accepted.length < files.length) {
        toast.warning(t('conversation.attachments.limit', { count: MAX_ATTACHMENTS }));
      }
      const additions = accepted.map((file): MessagingAttachmentDraft => ({
        localId: crypto.randomUUID(),
        file,
        state: 'UPLOADING',
      }));
      replaceItems([...itemsRef.current, ...additions]);
      const generation = generationRef.current;
      additions.forEach((item) => void upload(item, generation));
    },
    [conversationId, replaceItems, t, toast, upload]
  );

  const retry = useCallback(
    (localId: string) => {
      const current = itemsRef.current.find((item) => item.localId === localId);
      if (!current || current.state === 'UPLOADING') return;
      if (conversationId && current.attachment) {
        void discardMessagingAttachment(conversationId, current.attachment.attachmentId);
      }
      const next = { ...current, state: 'UPLOADING' as const, attachment: undefined };
      updateItem(localId, () => next);
      void upload(next, generationRef.current);
    },
    [conversationId, updateItem, upload]
  );

  const remove = useCallback(
    (localId: string) => {
      const removed = itemsRef.current.find((item) => item.localId === localId);
      replaceItems(itemsRef.current.filter((item) => item.localId !== localId));
      if (conversationId && removed?.attachment) {
        void discardMessagingAttachment(conversationId, removed.attachment.attachmentId);
      }
    },
    [conversationId, replaceItems]
  );

  const clear = useCallback(() => replaceItems([]), [replaceItems]);

  useEffect(() => {
    const previousConversationId = conversationRef.current;
    const abandoned = itemsRef.current.filter(
      (item) => item.state !== 'UPLOADING' && item.attachment
    );
    generationRef.current += 1;
    replaceItems([]);
    if (previousConversationId) {
      abandoned.forEach((item) => {
        void discardMessagingAttachment(previousConversationId, item.attachment!.attachmentId);
      });
    }
    conversationRef.current = conversationId;
  }, [conversationId, replaceItems]);

  return useMemo(
    () => ({
      items,
      readyIds: items
        .filter((item) => item.state === 'READY' && item.attachment)
        .map((item) => item.attachment!.attachmentId),
      busy: items.some((item) => item.state === 'UPLOADING'),
      addFiles,
      retry,
      remove,
      clear,
    }),
    [addFiles, clear, items, remove, retry]
  );
}
