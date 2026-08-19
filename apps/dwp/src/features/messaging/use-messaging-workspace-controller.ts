import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  addMessagingReaction,
  deleteMessagingMessage,
  getMessagingConversation,
  getMessagingConversations,
  getMessagingMessages,
  getMessagingThread,
  markMessagingConversationRead,
  removeMessagingReaction,
  saveMessagingMessage,
  sendMessagingMessage,
  updateMessagingMessage,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import useMediaQuery from '@mui/material/useMediaQuery';

import { useMessagingMeetingLabels } from './meeting';
import {
  mergeMessagingMessages,
  messagingReplyCounts,
  messagingRootMessages,
  messagingThread,
  upsertMessagingMessage,
} from './messaging-model';
import {
  resolveMessagingTransport,
  useMessagingRealtime,
  useMessagingTypingPublisher,
} from './use-messaging-realtime';

import type { Theme } from '@mui/material/styles';
import type {
  MessagingConversation,
  MessagingConversationDetail,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';
import type {
  MessagingReactionMutationInput,
  MessagingScope,
  MessagingSendMutationInput,
} from './messaging-workspace-types';

type MessagingHistoryScrollAnchor = {
  target: 'timeline' | 'document';
  height: number;
};

export function useMessagingWorkspaceController(scope: MessagingScope) {
  const { t } = useTranslation('messaging');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchPaletteOpen, setSearchPaletteOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessagingMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<MessagingMessage | null>(null);
  const [editBody, setEditBody] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const historyScrollAnchorRef = useRef<MessagingHistoryScrollAnchor | null>(null);
  const readCursorRef = useRef<string | null>(null);
  const mainSendAttemptRef = useRef<MessagingSendMutationInput | null>(null);
  const threadSendAttemptRef = useRef<MessagingSendMutationInput | null>(null);
  const desktopSplitView = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const selectedId = params.get('conversation');

  const conversationsQuery = useQuery({
    queryKey: ['messaging', 'conversations', scope, debouncedSearch],
    queryFn: () =>
      getMessagingConversations({
        scope,
        query: debouncedSearch,
        page: 0,
        pageSize: 60,
      }),
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: 1,
  });
  const detailQuery = useQuery({
    queryKey: ['messaging', 'conversation', selectedId],
    queryFn: () => getMessagingConversation(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 8_000,
    refetchInterval: (query) =>
      resolveMessagingTransport(query.state.data?.realtime) === 'polling' ? 12_000 : 60_000,
    retry: 1,
  });
  const messageHistoryQuery = useInfiniteQuery({
    queryKey: ['messaging', 'conversation-history', selectedId],
    queryFn: ({ pageParam }) =>
      getMessagingMessages({
        conversationId: selectedId!,
        beforeSequence: pageParam,
        limit: 50,
      }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextBeforeSequence ?? undefined) : undefined,
    enabled: Boolean(selectedId),
    staleTime: 8_000,
    retry: 1,
  });
  const threadQuery = useQuery({
    queryKey: ['messaging', 'thread', selectedId, threadRootId],
    queryFn: () => getMessagingThread(selectedId!, threadRootId!),
    enabled: Boolean(selectedId && threadRootId),
    staleTime: 5_000,
    retry: 1,
  });

  const sendMutation = useMutation({
    mutationFn: (input: MessagingSendMutationInput) =>
      sendMessagingMessage({
        conversationId: selectedId!,
        body: input.body,
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: async (message) => {
      setDraft('');
      mainSendAttemptRef.current = null;
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
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ top: detailScrollRef.current.scrollHeight });
      });
    },
  });
  const threadSendMutation = useMutation({
    mutationFn: (input: MessagingSendMutationInput) =>
      sendMessagingMessage({
        conversationId: selectedId!,
        body: input.body,
        replyToMessageId: input.replyToMessageId,
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: async (message) => {
      setThreadDraft('');
      threadSendAttemptRef.current = null;
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
          queryKey: ['messaging', 'thread', selectedId, threadRootId],
        }),
      ]);
    },
  });
  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji, remove }: MessagingReactionMutationInput) =>
      remove
        ? removeMessagingReaction(selectedId!, messageId, emoji)
        : addMessagingReaction(selectedId!, messageId, emoji),
    onSuccess: (message) => {
      queryClient.setQueryData<MessagingConversationDetail>(
        ['messaging', 'conversation', message.conversationId],
        (current) =>
          current
            ? { ...current, messages: upsertMessagingMessage(current.messages, message) }
            : current
      );
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'thread', selectedId] });
    },
    onError: () => toast.error(t('conversation.reactionError')),
  });
  const markReadMutation = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      markMessagingConversationRead(conversationId, messageId),
    onSuccess: (cursor) => {
      queryClient.setQueryData<MessagingConversationDetail>(
        ['messaging', 'conversation', cursor.conversationId],
        (current) =>
          current
            ? {
                ...current,
                conversation: { ...current.conversation, unreadCount: 0 },
                members: current.members.map((member) =>
                  member.userId === auth.user?.userId
                    ? {
                        ...member,
                        lastReadMessageId: cursor.lastReadMessageId,
                        lastReadSequence: cursor.lastReadSequence,
                        lastReadAt: cursor.lastReadAt,
                      }
                    : member
                ),
              }
            : current
      );
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] });
    },
    onError: (_error, variables) => {
      const failedKey = `${variables.conversationId}:${variables.messageId}`;
      if (readCursorRef.current === failedKey) readCursorRef.current = null;
    },
  });
  const saveMutation = useMutation({
    mutationFn: (messageId: string) => saveMessagingMessage(selectedId!, messageId),
    onSuccess: () => {
      toast.success(t('message.saveSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'saved-items'] });
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] });
    },
    onError: () => toast.error(t('message.saveError')),
  });
  const editMutation = useMutation({
    mutationFn: ({ message, body }: { message: MessagingMessage; body: string }) =>
      updateMessagingMessage({
        conversationId: message.conversationId,
        messageId: message.messageId,
        body,
        version: message.version,
      }),
    onSuccess: async () => {
      setEditingMessage(null);
      setEditBody('');
      toast.success(t('message.editSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversation', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'thread', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] }),
      ]);
    },
    onError: () => toast.error(t('message.editError')),
  });
  const deleteMutation = useMutation({
    mutationFn: (message: MessagingMessage) =>
      deleteMessagingMessage({
        conversationId: message.conversationId,
        messageId: message.messageId,
        version: message.version,
      }),
    onSuccess: async () => {
      setDeletingMessage(null);
      toast.success(t('message.deleteSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversation', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'thread', selectedId] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] }),
      ]);
    },
    onError: () => toast.error(t('message.deleteError')),
  });

  const selectedConversation = conversationsQuery.data?.items.find(
    (item) => item.conversationId === selectedId
  );
  const detail = detailQuery.data;
  const historyMessages = useMemo(
    () => messageHistoryQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messageHistoryQuery.data?.pages]
  );
  const timelineMessages = useMemo(
    () => mergeMessagingMessages(historyMessages, detail?.messages ?? []),
    [detail?.messages, historyMessages]
  );
  const rootMessages = useMemo(() => messagingRootMessages(timelineMessages), [timelineMessages]);
  const fallbackReplyCounts = useMemo(
    () => messagingReplyCounts(detail?.messages ?? []),
    [detail?.messages]
  );
  const fallbackThread = useMemo(
    () => messagingThread(detail?.messages ?? [], threadRootId),
    [detail?.messages, threadRootId]
  );
  const thread = threadQuery.data
    ? { root: threadQuery.data.root, replies: threadQuery.data.replies }
    : fallbackThread;
  const currentMember = detail?.members.find((member) => member.userId === auth.user?.userId);
  const meetingLabels = useMessagingMeetingLabels();
  const realtimeConnection = useMessagingRealtime({
    conversationId: selectedId,
    realtime: detail?.realtime,
    enabled: Boolean(detail),
  });
  useMessagingTypingPublisher({
    conversationId: selectedId,
    drafting: Boolean(draft.trim() || threadDraft.trim()),
    enabled: Boolean(detail && resolveMessagingTransport(detail.realtime) === 'sse'),
  });
  const typingNames = useMemo(
    () =>
      realtimeConnection.typingUserIds
        .filter((userId) => userId !== auth.user?.userId)
        .map((userId) => detail?.members.find((member) => member.userId === userId)?.displayName)
        .filter((name): name is string => Boolean(name)),
    [auth.user?.userId, detail?.members, realtimeConnection.typingUserIds]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, [contenteditable="true"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSearchPaletteOpen(true);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    setThreadRootId(null);
    setThreadDraft('');
    setEditingMessage(null);
    setDeletingMessage(null);
    setEditBody('');
    historyScrollAnchorRef.current = null;
  }, [selectedId]);

  useEffect(() => {
    const anchor = historyScrollAnchorRef.current;
    if (!anchor) return;
    historyScrollAnchorRef.current = null;
    requestAnimationFrame(() => {
      const scroller = detailScrollRef.current;
      if (!scroller) return;
      if (anchor.target === 'timeline') {
        scroller.scrollTop += scroller.scrollHeight - anchor.height;
        return;
      }
      window.scrollBy({
        top: document.documentElement.scrollHeight - anchor.height,
        behavior: 'instant',
      });
    });
  }, [messageHistoryQuery.data?.pages.length]);

  useEffect(() => {
    if (!desktopSplitView || selectedId || !conversationsQuery.data?.items.length) return;
    const next = new URLSearchParams(params);
    next.set('conversation', conversationsQuery.data.items[0]!.conversationId);
    setParams(next, { replace: true });
  }, [conversationsQuery.data?.items, desktopSplitView, params, selectedId, setParams]);

  useEffect(() => {
    if (!detail?.messages.length) return;
    requestAnimationFrame(() => {
      detailScrollRef.current?.scrollTo({ top: detailScrollRef.current.scrollHeight });
    });
  }, [detail?.conversation.conversationId, detail?.messages.length]);

  const lastMessageId = detail?.messages.at(-1)?.messageId;
  const markRead = markReadMutation.mutate;
  const markReadPending = markReadMutation.isPending;
  const markVisibleMessagesRead = useCallback(() => {
    if (
      document.visibilityState !== 'visible' ||
      !selectedId ||
      !lastMessageId ||
      markReadPending
    ) {
      return;
    }
    const scroller = detailScrollRef.current;
    if (!scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 32)
      return;
    const readCursorKey = `${selectedId}:${lastMessageId}`;
    if (readCursorRef.current === readCursorKey) return;
    readCursorRef.current = readCursorKey;
    markRead({ conversationId: selectedId, messageId: lastMessageId });
  }, [lastMessageId, markRead, markReadPending, selectedId]);

  useEffect(() => {
    const frame = requestAnimationFrame(markVisibleMessagesRead);
    return () => cancelAnimationFrame(frame);
  }, [markVisibleMessagesRead]);

  const openConversation = useCallback(
    (conversationId: string) => {
      const next = new URLSearchParams(params);
      next.set('conversation', conversationId);
      setParams(next, { replace: true });
    },
    [params, setParams]
  );
  const selectConversation = (conversation: MessagingConversation) =>
    openConversation(conversation.conversationId);
  const clearSelection = () => {
    const next = new URLSearchParams(params);
    next.delete('conversation');
    setParams(next, { replace: true });
  };
  const send = () => {
    const body = draft.trim();
    if (!body || !selectedId || sendMutation.isPending) return;
    const input = {
      body,
      idempotencyKey: crypto.randomUUID(),
    } satisfies MessagingSendMutationInput;
    mainSendAttemptRef.current = input;
    sendMutation.mutate(input);
  };
  const retrySend = () => {
    if (!mainSendAttemptRef.current || sendMutation.isPending) return;
    sendMutation.mutate(mainSendAttemptRef.current);
  };
  const sendThreadReply = () => {
    const body = threadDraft.trim();
    if (!body || !selectedId || !thread?.root.messageId || threadSendMutation.isPending) return;
    const input = {
      body,
      replyToMessageId: thread.root.messageId,
      idempotencyKey: crypto.randomUUID(),
    } satisfies MessagingSendMutationInput;
    threadSendAttemptRef.current = input;
    threadSendMutation.mutate(input);
  };
  const retryThreadReply = () => {
    if (!threadSendAttemptRef.current || threadSendMutation.isPending) return;
    threadSendMutation.mutate(threadSendAttemptRef.current);
  };
  const toggleReaction = (messageId: string, emoji: string, remove: boolean) => {
    if (!selectedId || reactionMutation.isPending) return;
    reactionMutation.mutate({ messageId, emoji, remove });
  };
  const saveMessage = (message: MessagingMessage) => {
    if (!selectedId || saveMutation.isPending) return;
    saveMutation.mutate(message.messageId);
  };
  const openEditMessage = (message: MessagingMessage) => {
    editMutation.reset();
    setEditingMessage(message);
    setEditBody(message.body);
  };
  const submitEditMessage = () => {
    const body = editBody.trim();
    if (!editingMessage || !body || editMutation.isPending) return;
    editMutation.mutate({ message: editingMessage, body });
  };
  const confirmDeleteMessage = () => {
    if (!deletingMessage || deleteMutation.isPending) return;
    deleteMutation.mutate(deletingMessage);
  };
  const loadOlderMessages = () => {
    const scroller = detailScrollRef.current;
    if (!scroller || !messageHistoryQuery.hasNextPage || messageHistoryQuery.isFetchingNextPage)
      return;
    const timelineScrolls = scroller.scrollHeight > scroller.clientHeight + 1;
    historyScrollAnchorRef.current = timelineScrolls
      ? { target: 'timeline', height: scroller.scrollHeight }
      : { target: 'document', height: document.documentElement.scrollHeight };
    void messageHistoryQuery.fetchNextPage();
  };
  const refresh = () => {
    void conversationsQuery.refetch();
    void detailQuery.refetch();
  };
  const conversationCreated = (conversationId: string) => {
    setCreateDialogOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] });
    openConversation(conversationId);
  };

  return {
    t,
    auth,
    title: t(`workspace.${scope}.title`),
    description: t(`workspace.${scope}.description`),
    desktopSplitView,
    selectedId,
    selectedConversation,
    search,
    setSearch,
    searchRef,
    detailScrollRef,
    conversationsQuery,
    detailQuery,
    messageHistoryQuery,
    threadQuery,
    detail,
    rootMessages,
    fallbackReplyCounts,
    thread,
    currentMember,
    meetingLabels,
    realtimeConnection,
    typingNames,
    draft,
    setDraft,
    threadDraft,
    setThreadDraft,
    meetingDialogOpen,
    setMeetingDialogOpen,
    membersDialogOpen,
    setMembersDialogOpen,
    createDialogOpen,
    setCreateDialogOpen,
    searchPaletteOpen,
    setSearchPaletteOpen,
    editingMessage,
    setEditingMessage,
    deletingMessage,
    setDeletingMessage,
    editBody,
    setEditBody,
    sendMutation,
    threadSendMutation,
    editMutation,
    deleteMutation,
    selectConversation,
    clearSelection,
    openConversation,
    send,
    retrySend,
    sendThreadReply,
    retryThreadReply,
    toggleReaction,
    saveMessage,
    openEditMessage,
    submitEditMessage,
    confirmDeleteMessage,
    loadOlderMessages,
    markVisibleMessagesRead,
    refresh,
    conversationCreated,
    setThreadRootId,
  };
}
