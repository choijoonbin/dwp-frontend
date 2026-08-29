import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessagingMessage } from '@dwp-frontend/shared-utils';

import { messagingMentionUserIds, type MessagingMentionDraft } from './messaging-composer-model';
import { upsertMessagingMessage } from './messaging-model';
import { messagingSendAttemptMatches, type MessagingSendAttempt } from './messaging-send-model';

import type { MutableRefObject, RefObject } from 'react';
import type { MessagingConversationDetail } from '@dwp-frontend/shared-utils';
import type { MessagingAttachmentQueue } from './use-messaging-attachment-queue';

type MessagingSendControllerInput = {
  selectedId: string | null;
  threadRootId: string | null;
  draftRef: MutableRefObject<string>;
  draftMentionsRef: MutableRefObject<MessagingMentionDraft[]>;
  threadDraftRef: MutableRefObject<string>;
  threadDraftMentionsRef: MutableRefObject<MessagingMentionDraft[]>;
  detailScrollRef: RefObject<HTMLDivElement | null>;
  mainAttachmentQueue: MessagingAttachmentQueue;
  threadAttachmentQueue: MessagingAttachmentQueue;
  setDraft: (value: string) => void;
  setDraftMentions: (value: MessagingMentionDraft[]) => void;
  setThreadDraft: (value: string) => void;
  setThreadDraftMentions: (value: MessagingMentionDraft[]) => void;
};

export function useMessagingSendController({
  selectedId,
  threadRootId,
  draftRef,
  draftMentionsRef,
  threadDraftRef,
  threadDraftMentionsRef,
  detailScrollRef,
  mainAttachmentQueue,
  threadAttachmentQueue,
  setDraft,
  setDraftMentions,
  setThreadDraft,
  setThreadDraftMentions,
}: MessagingSendControllerInput) {
  const queryClient = useQueryClient();
  const activeContextRef = useRef({ conversationId: selectedId, threadRootId });
  const previousConversationRef = useRef(selectedId);
  const previousThreadContextRef = useRef({ conversationId: selectedId, threadRootId });
  const mainSendAttemptRef = useRef<MessagingSendAttempt | null>(null);
  const threadSendAttemptRef = useRef<MessagingSendAttempt | null>(null);
  activeContextRef.current = { conversationId: selectedId, threadRootId };

  const sendMutation = useMutation({
    mutationFn: (attempt: MessagingSendAttempt) =>
      sendMessagingMessage({
        conversationId: attempt.conversationId,
        body: attempt.payload.body,
        idempotencyKey: attempt.payload.idempotencyKey,
        attachmentIds: attempt.payload.attachmentIds,
        mentionedUserIds: attempt.payload.mentionedUserIds,
      }),
    onSuccess: async (message, attempt) => {
      const active = activeContextRef.current;
      const ownsActiveComposer =
        mainSendAttemptRef.current === attempt &&
        messagingSendAttemptMatches(attempt, active.conversationId, null);
      if (ownsActiveComposer) {
        if (draftRef.current.trim() === attempt.payload.body) {
          setDraft('');
          setDraftMentions([]);
        }
        mainAttachmentQueue.clear();
        mainSendAttemptRef.current = null;
      }
      queryClient.setQueryData<MessagingConversationDetail>(
        ['messaging', 'conversation', message.conversationId],
        (current) =>
          current
            ? {
                ...current,
                conversation: {
                  ...current.conversation,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                },
                messages: upsertMessagingMessage(current.messages, message),
              }
            : current
      );
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] });
      if (ownsActiveComposer) {
        requestAnimationFrame(() => {
          detailScrollRef.current?.scrollTo({ top: detailScrollRef.current.scrollHeight });
        });
      }
    },
  });

  const threadSendMutation = useMutation({
    mutationFn: (attempt: MessagingSendAttempt) =>
      sendMessagingMessage({
        conversationId: attempt.conversationId,
        body: attempt.payload.body,
        replyToMessageId: attempt.payload.replyToMessageId,
        idempotencyKey: attempt.payload.idempotencyKey,
        attachmentIds: attempt.payload.attachmentIds,
        mentionedUserIds: attempt.payload.mentionedUserIds,
      }),
    onSuccess: async (message, attempt) => {
      const active = activeContextRef.current;
      const ownsActiveComposer =
        threadSendAttemptRef.current === attempt &&
        messagingSendAttemptMatches(attempt, active.conversationId, active.threadRootId);
      if (ownsActiveComposer) {
        if (threadDraftRef.current.trim() === attempt.payload.body) {
          setThreadDraft('');
          setThreadDraftMentions([]);
        }
        threadAttachmentQueue.clear();
        threadSendAttemptRef.current = null;
      }
      queryClient.setQueryData<MessagingConversationDetail>(
        ['messaging', 'conversation', message.conversationId],
        (current) =>
          current
            ? { ...current, messages: upsertMessagingMessage(current.messages, message) }
            : current
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] }),
        queryClient.invalidateQueries({
          queryKey: ['messaging', 'thread', attempt.conversationId, attempt.threadRootId],
        }),
      ]);
    },
  });

  const resetSendError = useCallback(() => {
    mainSendAttemptRef.current = null;
    sendMutation.reset();
  }, [sendMutation]);
  const resetThreadSendError = useCallback(() => {
    threadSendAttemptRef.current = null;
    threadSendMutation.reset();
  }, [threadSendMutation]);

  useEffect(() => {
    if (previousConversationRef.current === selectedId) return;
    previousConversationRef.current = selectedId;
    mainSendAttemptRef.current = null;
    sendMutation.reset();
  }, [selectedId, sendMutation]);

  useEffect(() => {
    const previous = previousThreadContextRef.current;
    if (previous.conversationId === selectedId && previous.threadRootId === threadRootId) return;
    previousThreadContextRef.current = { conversationId: selectedId, threadRootId };
    threadSendAttemptRef.current = null;
    threadSendMutation.reset();
  }, [selectedId, threadRootId, threadSendMutation]);

  const sendPending =
    sendMutation.isPending &&
    messagingSendAttemptMatches(mainSendAttemptRef.current, selectedId, null);
  const sendError =
    sendMutation.isError &&
    messagingSendAttemptMatches(mainSendAttemptRef.current, selectedId, null);
  const threadSendPending =
    threadSendMutation.isPending &&
    messagingSendAttemptMatches(threadSendAttemptRef.current, selectedId, threadRootId);
  const threadSendError =
    threadSendMutation.isError &&
    messagingSendAttemptMatches(threadSendAttemptRef.current, selectedId, threadRootId);

  const send = useCallback(() => {
    const body = draftRef.current.trim();
    if (
      (!body && mainAttachmentQueue.readyIds.length === 0) ||
      !selectedId ||
      sendPending ||
      mainAttachmentQueue.busy
    ) {
      return;
    }
    const attempt: MessagingSendAttempt = {
      conversationId: selectedId,
      threadRootId: null,
      payload: {
        body,
        idempotencyKey: crypto.randomUUID(),
        attachmentIds: mainAttachmentQueue.readyIds,
        mentionedUserIds: messagingMentionUserIds(draftMentionsRef.current),
      },
    };
    mainSendAttemptRef.current = attempt;
    sendMutation.mutate(attempt);
  }, [draftMentionsRef, draftRef, mainAttachmentQueue, selectedId, sendMutation, sendPending]);

  const retrySend = useCallback(() => {
    const attempt = mainSendAttemptRef.current;
    if (!messagingSendAttemptMatches(attempt, selectedId, null) || sendPending) return;
    sendMutation.mutate(attempt!);
  }, [selectedId, sendMutation, sendPending]);

  const sendThreadReply = useCallback(() => {
    const body = threadDraftRef.current.trim();
    if (
      (!body && threadAttachmentQueue.readyIds.length === 0) ||
      !selectedId ||
      !threadRootId ||
      threadSendPending ||
      threadAttachmentQueue.busy
    ) {
      return;
    }
    const attempt: MessagingSendAttempt = {
      conversationId: selectedId,
      threadRootId,
      payload: {
        body,
        replyToMessageId: threadRootId,
        idempotencyKey: crypto.randomUUID(),
        attachmentIds: threadAttachmentQueue.readyIds,
        mentionedUserIds: messagingMentionUserIds(threadDraftMentionsRef.current),
      },
    };
    threadSendAttemptRef.current = attempt;
    threadSendMutation.mutate(attempt);
  }, [
    selectedId,
    threadAttachmentQueue,
    threadDraftMentionsRef,
    threadDraftRef,
    threadRootId,
    threadSendMutation,
    threadSendPending,
  ]);

  const retryThreadReply = useCallback(() => {
    const attempt = threadSendAttemptRef.current;
    if (!messagingSendAttemptMatches(attempt, selectedId, threadRootId) || threadSendPending) {
      return;
    }
    threadSendMutation.mutate(attempt!);
  }, [selectedId, threadRootId, threadSendMutation, threadSendPending]);

  return {
    sendPending,
    sendError,
    threadSendPending,
    threadSendError,
    resetSendError,
    resetThreadSendError,
    send,
    retrySend,
    sendThreadReply,
    retryThreadReply,
  };
}
