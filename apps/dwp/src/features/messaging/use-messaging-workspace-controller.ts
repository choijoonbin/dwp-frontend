import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  addMessagingReaction,
  deleteMessagingMessage,
  getMessagingConversation,
  getMessagingConversations,
  getMessagingMessage,
  getMessagingMessages,
  getMessagingThread,
  markMessagingConversationRead,
  removeMessagingReaction,
  saveMessagingMessage,
  scheduleMessagingMessage,
  updateMessagingMessage,
  HttpError,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';

import useMediaQuery from '@mui/material/useMediaQuery';

import { useMessagingMeetingLabels } from './meeting';
import {
  messagingAdaptivePollingInterval,
  useDocumentVisibleState,
} from './messaging-adaptive-polling';
import type { MessagingMentionDraft } from './messaging-composer-model';
import {
  mergeMessagingMessages,
  messagingReplyCounts,
  messagingRootMessages,
  messagingThread,
  upsertMessagingMessage,
} from './messaging-model';
import {
  messagingConversationPageRequest,
  nextMessagingConversationPageParam,
  type MessagingConversationPageParam,
} from './messaging-conversation-pagination';
import {
  mergeMessagingNavigatorUrlState,
  readMessagingNavigatorUrlState,
} from './messaging-navigator-model';
import {
  captureMessagingTimelineScrollAnchor,
  stabilizeMessagingTimelineScrollAnchor,
  type MessagingTimelineScrollAnchor,
} from './messaging-history-scroll-anchor';
import { maskMessagingPresence, useBrowserOnlineState } from './messaging-presence-freshness';
import {
  resolveMessagingTransport,
  useMessagingRealtime,
  useMessagingTypingPublisher,
  type MessagingConnectionState,
} from './use-messaging-realtime';
import { useMessagingAttachmentQueue } from './use-messaging-attachment-queue';
import { useMessagingSendController } from './use-messaging-send-controller';
import {
  messagingMentionPersonPublicIds,
  useMessagingDraftContinuity,
} from './use-messaging-draft-continuity';

import type { Theme } from '@mui/material/styles';
import type {
  MessagingConversation,
  MessagingConversationDetail,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';
import type { MessagingReactionMutationInput, MessagingScope } from './messaging-workspace-types';

type MessagingHistoryScrollAnchor =
  | { target: 'timeline'; anchor: MessagingTimelineScrollAnchor }
  | { target: 'document'; height: number };

type MessagingDraftSnapshot = {
  body: string;
  mentions: MessagingMentionDraft[];
};

type MessagingScheduleAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

export type MessagingMessageTargetState =
  'IDLE' | 'LOADING' | 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE';

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function useMessagingWorkspaceController(scope: MessagingScope) {
  const { t } = useTranslation('messaging');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const browserOnline = useBrowserOnlineState();
  const documentVisible = useDocumentVisibleState();
  const [params, setParams] = useSearchParams();
  const activeScope: MessagingScope =
    scope === 'ALL' && params.get('attention')?.toLowerCase() === 'mentions' ? 'MENTIONS' : scope;
  const navigatorUrlState = useMemo(() => readMessagingNavigatorUrlState(params), [params]);
  const search = navigatorUrlState.query;
  const navigatorFilter = navigatorUrlState.filter;
  const setSearch = useCallback(
    (value: string) => {
      setParams(mergeMessagingNavigatorUrlState(params, { query: value }), { replace: true });
    },
    [params, setParams]
  );
  const setNavigatorFilter = useCallback(
    (value: typeof navigatorFilter) => {
      setParams(mergeMessagingNavigatorUrlState(params, { filter: value }), { replace: true });
    },
    [params, setParams]
  );
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draft, setDraftState] = useState('');
  const [draftMentions, setDraftMentionsState] = useState<MessagingMentionDraft[]>([]);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadDraft, setThreadDraftState] = useState('');
  const [threadDraftMentions, setThreadDraftMentionsState] = useState<MessagingMentionDraft[]>([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
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
  const draftRef = useRef('');
  const draftMentionsRef = useRef<MessagingMentionDraft[]>([]);
  const threadDraftRef = useRef('');
  const threadDraftMentionsRef = useRef<MessagingMentionDraft[]>([]);
  const conversationDraftsRef = useRef(new Map<string, MessagingDraftSnapshot>());
  const previousConversationRef = useRef<string | null>(null);
  const mainScheduleAttemptRef = useRef<MessagingScheduleAttempt | null>(null);
  const threadScheduleAttemptRef = useRef<MessagingScheduleAttempt | null>(null);
  const nearTimelineBottomRef = useRef(true);
  const timelineConversationRef = useRef<string | null>(null);
  const latestMessageRef = useRef<string | null>(null);
  const realtimeStateRef = useRef<MessagingConnectionState>('connecting');
  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);
  const setDraftMentions = useCallback((value: MessagingMentionDraft[]) => {
    draftMentionsRef.current = value;
    setDraftMentionsState(value);
  }, []);
  const setThreadDraft = useCallback((value: string) => {
    threadDraftRef.current = value;
    setThreadDraftState(value);
  }, []);
  const setThreadDraftMentions = useCallback((value: MessagingMentionDraft[]) => {
    threadDraftMentionsRef.current = value;
    setThreadDraftMentionsState(value);
  }, []);
  const desktopSplitView = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const selectedId = params.get('conversation');
  const requestedMessageValue = params.get('message');
  const requestedMessageId =
    requestedMessageValue && CANONICAL_UUID.test(requestedMessageValue)
      ? requestedMessageValue
      : null;
  const mainAttachmentQueue = useMessagingAttachmentQueue(selectedId, selectedId);
  const threadAttachmentQueue = useMessagingAttachmentQueue(
    selectedId,
    selectedId && threadRootId ? `${selectedId}:${threadRootId}` : null
  );
  const {
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
  } = useMessagingSendController({
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
  });

  const conversationsQuery = useInfiniteQuery({
    queryKey: ['messaging', 'conversations', activeScope, debouncedSearch],
    queryFn: ({ pageParam }) =>
      getMessagingConversations({
        scope: activeScope,
        query: debouncedSearch,
        pageSize: 30,
        ...messagingConversationPageRequest(pageParam),
      }),
    initialPageParam: 0 as MessagingConversationPageParam,
    getNextPageParam: nextMessagingConversationPageParam,
    staleTime: 15_000,
    refetchInterval: () =>
      messagingAdaptivePollingInterval({
        state: selectedId ? realtimeStateRef.current : 'polling',
        online: browserOnline,
        visible: documentVisible,
        activeIntervalMs: 30_000,
      }),
    retry: 1,
  });
  const detailQuery = useQuery({
    queryKey: ['messaging', 'conversation', selectedId],
    queryFn: () => getMessagingConversation(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 8_000,
    refetchInterval: (query) =>
      messagingAdaptivePollingInterval({
        state:
          resolveMessagingTransport(query.state.data?.realtime) === 'polling'
            ? 'polling'
            : realtimeStateRef.current,
        online: browserOnline,
        visible: documentVisible,
        activeIntervalMs: 12_000,
      }),
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
  const exactMessageQuery = useQuery({
    queryKey: ['messaging', 'message', selectedId, requestedMessageId],
    queryFn: () => getMessagingMessage(selectedId!, requestedMessageId!),
    enabled: Boolean(selectedId && requestedMessageId),
    staleTime: 8_000,
    retry: (failureCount, error) =>
      !(error instanceof HttpError && [403, 404, 410].includes(error.status)) && failureCount < 1,
  });
  const threadQuery = useQuery({
    queryKey: ['messaging', 'thread', selectedId, threadRootId],
    queryFn: () => getMessagingThread(selectedId!, threadRootId!),
    enabled: Boolean(selectedId && threadRootId),
    staleTime: 5_000,
    retry: 1,
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

  const conversations = useMemo(
    () =>
      Array.from(
        new Map(
          (conversationsQuery.data?.pages.flatMap((page) => page.items) ?? []).map(
            (conversation) => [conversation.conversationId, conversation]
          )
        ).values()
      ),
    [conversationsQuery.data?.pages]
  );
  const selectedConversation = conversations.find((item) => item.conversationId === selectedId);
  const detail = useMemo(() => {
    const cached = detailQuery.data;
    if (!cached || browserOnline) return cached;
    return {
      ...cached,
      members: maskMessagingPresence(cached.members, false),
    };
  }, [browserOnline, detailQuery.data]);
  const historyMessages = useMemo(
    () => messageHistoryQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messageHistoryQuery.data?.pages]
  );
  const timelineMessages = useMemo(
    () =>
      mergeMessagingMessages(historyMessages, [
        ...(detail?.messages ?? []),
        ...(exactMessageQuery.data ? [exactMessageQuery.data] : []),
      ]),
    [detail?.messages, exactMessageQuery.data, historyMessages]
  );
  const targetedMessage = requestedMessageId
    ? timelineMessages.find((message) => message.messageId === requestedMessageId)
    : undefined;
  const messageTargetState: MessagingMessageTargetState = !requestedMessageValue
    ? 'IDLE'
    : !requestedMessageId
      ? 'NOT_FOUND'
      : targetedMessage
        ? 'FOUND'
        : exactMessageQuery.isPending || exactMessageQuery.isFetching
          ? 'LOADING'
          : exactMessageQuery.error instanceof HttpError &&
              [403, 404, 410].includes(exactMessageQuery.error.status)
            ? 'NOT_FOUND'
            : exactMessageQuery.isError
              ? 'UNAVAILABLE'
              : 'NOT_FOUND';
  const rootMessages = useMemo(() => messagingRootMessages(timelineMessages), [timelineMessages]);
  const fallbackReplyCounts = useMemo(
    () => messagingReplyCounts(timelineMessages),
    [timelineMessages]
  );
  const fallbackThread = useMemo(
    () => messagingThread(timelineMessages, threadRootId),
    [threadRootId, timelineMessages]
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
    tenantId: auth.user?.tenantId,
    userId: auth.user?.userId,
  });
  realtimeStateRef.current = realtimeConnection.state;
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
    const previousId = previousConversationRef.current;
    if (previousId) {
      conversationDraftsRef.current.set(previousId, {
        body: draftRef.current,
        mentions: draftMentionsRef.current,
      });
    }
    const nextDraft = selectedId ? conversationDraftsRef.current.get(selectedId) : undefined;
    setDraft(nextDraft?.body ?? '');
    setDraftMentions(nextDraft?.mentions ?? []);
    previousConversationRef.current = selectedId;
    mainScheduleAttemptRef.current = null;
    threadScheduleAttemptRef.current = null;
    setThreadRootId(null);
    setThreadDraft('');
    setThreadDraftMentions([]);
    setEditingMessage(null);
    setDeletingMessage(null);
    setEditBody('');
    historyScrollAnchorRef.current = null;
  }, [selectedId, setDraft, setDraftMentions, setThreadDraft, setThreadDraftMentions]);

  const mainDraftContinuity = useMessagingDraftContinuity({
    conversationId: selectedId,
    enabled: Boolean(selectedId),
    value: draft,
    mentions: draftMentions,
    valueRef: draftRef,
    mentionsRef: draftMentionsRef,
    members: detail?.members ?? [],
    membersReady: Boolean(detail),
    setValue: setDraft,
    setMentions: setDraftMentions,
  });
  const threadDraftContinuity = useMessagingDraftContinuity({
    conversationId: selectedId,
    threadRootMessageId: threadRootId,
    enabled: Boolean(selectedId && threadRootId),
    value: threadDraft,
    mentions: threadDraftMentions,
    valueRef: threadDraftRef,
    mentionsRef: threadDraftMentionsRef,
    members: detail?.members ?? [],
    membersReady: Boolean(detail),
    setValue: setThreadDraft,
    setMentions: setThreadDraftMentions,
  });
  const mainDraftPersistenceState = mainDraftContinuity.state;
  const threadDraftPersistenceState = threadDraftContinuity.state;

  const mainScheduleMutation = useMutation({
    mutationFn: scheduleMessagingMessage,
    onSuccess: async (scheduled, input) => {
      if (selectedId === input.conversationId && draftRef.current.trim() === input.body) {
        setDraft('');
        setDraftMentions([]);
      }
      mainScheduleAttemptRef.current = null;
      toast.success(t('schedule.success'));
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'scheduled-messages'] });
      return scheduled;
    },
    onError: () => toast.error(t('schedule.error')),
  });
  const threadScheduleMutation = useMutation({
    mutationFn: scheduleMessagingMessage,
    onSuccess: async (scheduled, input) => {
      if (
        selectedId === input.conversationId &&
        threadRootId === input.replyToMessageId &&
        threadDraftRef.current.trim() === input.body
      ) {
        setThreadDraft('');
        setThreadDraftMentions([]);
      }
      threadScheduleAttemptRef.current = null;
      toast.success(t('schedule.success'));
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'scheduled-messages'] });
      return scheduled;
    },
    onError: () => toast.error(t('schedule.error')),
  });

  const scheduleMainMessage = useCallback(
    async (timing: { scheduledFor: string; displayTimeZone: string }) => {
      const body = draftRef.current.trim();
      if (!selectedId || !body || mainAttachmentQueue.items.length > 0) return false;
      const mentionedPersonPublicIds = messagingMentionPersonPublicIds(
        draftMentionsRef.current,
        detail?.members ?? []
      );
      if (mentionedPersonPublicIds === null) {
        toast.error(t('schedule.error'));
        return false;
      }
      const fingerprint = JSON.stringify([
        selectedId,
        body,
        mentionedPersonPublicIds,
        timing.scheduledFor,
        timing.displayTimeZone,
      ]);
      if (mainScheduleAttemptRef.current?.fingerprint !== fingerprint) {
        mainScheduleAttemptRef.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
      }
      try {
        await mainScheduleMutation.mutateAsync({
          conversationId: selectedId,
          body,
          idempotencyKey: mainScheduleAttemptRef.current.idempotencyKey,
          attachmentIds: [],
          mentionedPersonPublicIds,
          ...timing,
        });
        return true;
      } catch {
        return false;
      }
    },
    [
      detail?.members,
      draftMentionsRef,
      draftRef,
      mainAttachmentQueue.items.length,
      mainScheduleMutation,
      selectedId,
      t,
      toast,
    ]
  );

  const scheduleThreadMessage = useCallback(
    async (timing: { scheduledFor: string; displayTimeZone: string }) => {
      const body = threadDraftRef.current.trim();
      if (!selectedId || !threadRootId || !body || threadAttachmentQueue.items.length > 0) {
        return false;
      }
      const mentionedPersonPublicIds = messagingMentionPersonPublicIds(
        threadDraftMentionsRef.current,
        detail?.members ?? []
      );
      if (mentionedPersonPublicIds === null) {
        toast.error(t('schedule.error'));
        return false;
      }
      const fingerprint = JSON.stringify([
        selectedId,
        threadRootId,
        body,
        mentionedPersonPublicIds,
        timing.scheduledFor,
        timing.displayTimeZone,
      ]);
      if (threadScheduleAttemptRef.current?.fingerprint !== fingerprint) {
        threadScheduleAttemptRef.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
      }
      try {
        await threadScheduleMutation.mutateAsync({
          conversationId: selectedId,
          body,
          replyToMessageId: threadRootId,
          idempotencyKey: threadScheduleAttemptRef.current.idempotencyKey,
          attachmentIds: [],
          mentionedPersonPublicIds,
          ...timing,
        });
        return true;
      } catch {
        return false;
      }
    },
    [
      detail?.members,
      selectedId,
      t,
      threadAttachmentQueue.items.length,
      threadDraftMentionsRef,
      threadDraftRef,
      threadRootId,
      threadScheduleMutation,
      toast,
    ]
  );

  useEffect(() => {
    const rootId = targetedMessage?.replyToMessageId;
    if (!requestedMessageId || !rootId) return;
    setThreadRootId((current) => (current === rootId ? current : rootId));
  }, [requestedMessageId, targetedMessage?.replyToMessageId]);

  useLayoutEffect(() => {
    const anchor = historyScrollAnchorRef.current;
    if (!anchor) return;
    historyScrollAnchorRef.current = null;
    const scroller = detailScrollRef.current;
    if (!scroller) return;
    if (anchor.target === 'timeline') {
      return stabilizeMessagingTimelineScrollAnchor(scroller, anchor.anchor);
    }
    window.scrollBy({
      top: document.documentElement.scrollHeight - anchor.height,
      behavior: 'instant',
    });
    return undefined;
  }, [messageHistoryQuery.data?.pages.length]);

  useEffect(() => {
    if (!desktopSplitView || selectedId || !conversations.length) return;
    const next = new URLSearchParams(params);
    next.set('conversation', conversations[0]!.conversationId);
    next.delete('message');
    setParams(next, { replace: true });
  }, [conversations, desktopSplitView, params, selectedId, setParams]);

  const latestMessage = detail?.messages.at(-1);
  useEffect(() => {
    if (!selectedId || !latestMessage || requestedMessageId) return;
    const conversationChanged = timelineConversationRef.current !== selectedId;
    const messageChanged = latestMessageRef.current !== latestMessage.messageId;
    if (!messageChanged && !conversationChanged) return;
    timelineConversationRef.current = selectedId;
    latestMessageRef.current = latestMessage.messageId;
    if (
      conversationChanged ||
      nearTimelineBottomRef.current ||
      latestMessage.senderUserId === auth.user?.userId
    ) {
      nearTimelineBottomRef.current = true;
      setNewMessageCount(0);
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ top: detailScrollRef.current.scrollHeight });
      });
      return;
    }
    setNewMessageCount((current) => current + 1);
  }, [auth.user?.userId, latestMessage, requestedMessageId, selectedId]);

  const lastMessageId = detail?.messages.at(-1)?.messageId;
  const markRead = markReadMutation.mutate;
  const markReadPending = markReadMutation.isPending;
  const markVisibleMessagesRead = useCallback(() => {
    if (
      document.visibilityState !== 'visible' ||
      !document.hasFocus() ||
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

  const handleTimelineScroll = useCallback(() => {
    const scroller = detailScrollRef.current;
    if (scroller) {
      nearTimelineBottomRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 48;
      if (nearTimelineBottomRef.current) setNewMessageCount(0);
    }
    markVisibleMessagesRead();
  }, [markVisibleMessagesRead]);

  const jumpToLatest = useCallback(() => {
    nearTimelineBottomRef.current = true;
    setNewMessageCount(0);
    detailScrollRef.current?.scrollTo({
      top: detailScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
    requestAnimationFrame(markVisibleMessagesRead);
  }, [markVisibleMessagesRead]);

  useEffect(() => {
    const frame = requestAnimationFrame(markVisibleMessagesRead);
    window.addEventListener('focus', markVisibleMessagesRead);
    document.addEventListener('visibilitychange', markVisibleMessagesRead);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('focus', markVisibleMessagesRead);
      document.removeEventListener('visibilitychange', markVisibleMessagesRead);
    };
  }, [markVisibleMessagesRead]);

  const openConversation = useCallback(
    (conversationId: string, messageId?: string) => {
      const next = new URLSearchParams(params);
      next.set('conversation', conversationId);
      if (messageId) next.set('message', messageId);
      else next.delete('message');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );
  const selectConversation = (conversation: MessagingConversation) =>
    openConversation(conversation.conversationId);
  const clearSelection = () => {
    const next = new URLSearchParams(params);
    next.delete('conversation');
    next.delete('message');
    setParams(next, { replace: true });
  };
  const clearMessageTarget = () => {
    const next = new URLSearchParams(params);
    next.delete('message');
    setParams(next, { replace: true });
  };
  const retryMessageTarget = () => {
    void Promise.all([detailQuery.refetch(), exactMessageQuery.refetch()]);
  };
  const clearMentionFilter = () => {
    const next = new URLSearchParams(params);
    next.delete('attention');
    setParams(next, { replace: true });
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
      ? { target: 'timeline', anchor: captureMessagingTimelineScrollAnchor(scroller) }
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
    title: t(`workspace.${activeScope}.title`),
    description: t(`workspace.${activeScope}.description`),
    mentionFilterActive: activeScope === 'MENTIONS',
    desktopSplitView,
    selectedId,
    requestedMessageId,
    messageTargetState,
    targetedMessage,
    selectedConversation,
    search,
    setSearch,
    navigatorFilter,
    setNavigatorFilter,
    searchRef,
    detailScrollRef,
    conversationsQuery,
    conversations,
    detailQuery,
    messageHistoryQuery,
    threadQuery,
    detail,
    rootMessages,
    fallbackReplyCounts,
    thread,
    threadRootId,
    currentMember,
    meetingLabels,
    realtimeConnection,
    typingNames,
    newMessageCount,
    draft,
    setDraft,
    draftMentions,
    setDraftMentions,
    mainAttachmentQueue,
    threadDraft,
    setThreadDraft,
    threadDraftMentions,
    setThreadDraftMentions,
    threadAttachmentQueue,
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
    sendPending,
    sendError,
    mainSchedulePending: mainScheduleMutation.isPending,
    mainScheduleError: mainScheduleMutation.isError,
    mainDraftPersistenceState,
    resolveMainDraftConflict: mainDraftContinuity.resolveConflict,
    threadSendPending,
    threadSendError,
    threadSchedulePending: threadScheduleMutation.isPending,
    threadScheduleError: threadScheduleMutation.isError,
    threadDraftPersistenceState,
    resolveThreadDraftConflict: threadDraftContinuity.resolveConflict,
    resetSendError,
    resetThreadSendError,
    editMutation,
    deleteMutation,
    selectConversation,
    clearSelection,
    clearMessageTarget,
    retryMessageTarget,
    clearMentionFilter,
    openConversation,
    send,
    retrySend,
    scheduleMainMessage,
    sendThreadReply,
    retryThreadReply,
    scheduleThreadMessage,
    toggleReaction,
    saveMessage,
    openEditMessage,
    submitEditMessage,
    confirmDeleteMessage,
    loadOlderMessages,
    handleTimelineScroll,
    jumpToLatest,
    refresh,
    conversationCreated,
    setThreadRootId,
  };
}
