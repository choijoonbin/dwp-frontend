import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import type { VideoMeetingEffectivePermissions } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  acknowledgeVideoMeetingHand,
  clearVideoMeetingHandRequests,
  deleteVideoMeetingChatMessage,
  dismissVideoMeetingHand,
  getVideoMeetingChatMessages,
  getVideoMeetingHandRequests,
  lowerVideoMeetingHand,
  raiseVideoMeetingHand,
  sendVideoMeetingChatMessage,
  type VideoMeetingChatMessage,
  type VideoMeetingHandRequest,
} from '@dwp-frontend/shared-utils/api/video-meeting-collaboration-api';

import {
  type MeetingChatMessage,
  type MeetingCollaborationLabels,
  type MeetingCollaborationTab,
  type MeetingFloorRequest,
} from './meeting-collaboration-model';
import { MeetingCollaborationPanel } from './meeting-collaboration-panel';
import { formatMeetingTime } from './meeting-components';

const COLLABORATION_POLL_INTERVAL_MS = 2_000;
const COLLABORATION_PAGE_SIZE = 100;
const MAX_CHAT_MESSAGE_LENGTH = 4_000;

function mergeById<T>(
  current: readonly T[],
  incoming: readonly T[],
  id: (item: T) => string,
  sequence: (item: T) => number
): T[] {
  const merged = new Map(current.map((item) => [id(item), item]));
  for (const item of incoming) {
    const previous = merged.get(id(item));
    if (!previous || sequence(item) >= sequence(previous)) merged.set(id(item), item);
  }
  return [...merged.values()].sort((left, right) => sequence(left) - sequence(right));
}

function toChatMessage(message: VideoMeetingChatMessage): MeetingChatMessage {
  return {
    messageId: message.messageId,
    sequence: message.sequence,
    createdSequence: message.createdSequence,
    participantId: message.sender.participantId,
    senderName: message.sender.displayName,
    body: message.text ?? '',
    sentAt: message.sentAt,
    retentionUntil: message.retentionUntil,
    deliveryState: 'DELIVERED',
    isOwn: message.mine,
    canDelete: message.canDelete,
    deletedAt: message.deletedAt,
  };
}

function activeFloorRequests(requests: readonly VideoMeetingHandRequest[]): MeetingFloorRequest[] {
  return requests
    .filter((request) => request.state === 'RAISED' || request.state === 'ACKNOWLEDGED')
    .sort((left, right) => left.raisedSequence - right.raisedSequence)
    .map((request, index) => ({
      requestId: request.requestId,
      sequence: request.sequence,
      raisedSequence: request.raisedSequence,
      participantId: request.requester.participantId,
      participantName: request.requester.displayName,
      requestedAt: request.raisedAt,
      state: request.state,
      position: index + 1,
      mine: request.mine,
      canLower: request.canLower,
      canAcknowledge: request.canAcknowledge,
      canDismiss: request.canDismiss,
      acknowledgedAt: request.acknowledgedAt,
      resolvedAt: request.resolvedAt,
    }));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
}

export function MeetingCollaborationRuntime({
  meetingId,
  activeTab,
  meetingLive,
  canModerate,
  permissions: effectivePermissions,
  onClose,
  onTabChange,
}: {
  meetingId: string;
  activeTab: MeetingCollaborationTab | null;
  meetingLive: boolean;
  canModerate: boolean;
  permissions: VideoMeetingEffectivePermissions;
  onClose: () => void;
  onTabChange: (tab: MeetingCollaborationTab) => void;
}) {
  const { t, i18n } = useTranslation('meetings');
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [handRequests, setHandRequests] = useState<VideoMeetingHandRequest[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [floorHasMore, setFloorHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [floorMutating, setFloorMutating] = useState(false);
  const [busyMessageIds, setBusyMessageIds] = useState<ReadonlySet<string>>(new Set());
  const [busyRequestIds, setBusyRequestIds] = useState<ReadonlySet<string>>(new Set());
  const [lastReadSequence, setLastReadSequence] = useState(0);
  const chatCursor = useRef(0);
  const floorCursor = useRef(0);

  useEffect(() => {
    chatCursor.current = 0;
    floorCursor.current = 0;
    setChatMessages([]);
    setHandRequests([]);
    setLastReadSequence(0);
  }, [meetingId]);

  const chatQuery = useQuery({
    queryKey: ['meetings', meetingId, 'collaboration', 'chat'],
    queryFn: () =>
      getVideoMeetingChatMessages(meetingId, chatCursor.current, COLLABORATION_PAGE_SIZE),
    enabled: effectivePermissions.chat,
    refetchInterval: meetingLive ? COLLABORATION_POLL_INTERVAL_MS : false,
    retry: 1,
  });
  const floorQuery = useQuery({
    queryKey: ['meetings', meetingId, 'collaboration', 'floor'],
    queryFn: () =>
      getVideoMeetingHandRequests(meetingId, floorCursor.current, COLLABORATION_PAGE_SIZE),
    enabled: effectivePermissions.handRaise,
    refetchInterval: meetingLive ? COLLABORATION_POLL_INTERVAL_MS : false,
    retry: 1,
  });

  useEffect(() => {
    if (!chatQuery.data) return;
    const incoming = chatQuery.data.items.map(toChatMessage);
    setChatMessages((current) => {
      const optimistic = current.filter((message) => message.messageId.startsWith('pending:'));
      const delivered = mergeById(
        current.filter((message) => !message.messageId.startsWith('pending:')),
        incoming,
        (message) => message.messageId,
        (message) => message.sequence
      );
      return [...delivered, ...optimistic];
    });
    chatCursor.current = Math.max(chatCursor.current, chatQuery.data.nextSequence);
    setChatHasMore(chatQuery.data.hasMore);
    setChatError(null);
  }, [chatQuery.data]);

  useEffect(() => {
    if (!floorQuery.data) return;
    setHandRequests((current) =>
      mergeById(
        current,
        floorQuery.data.items,
        (request) => request.requestId,
        (request) => request.sequence
      )
    );
    floorCursor.current = Math.max(floorCursor.current, floorQuery.data.nextSequence);
    setFloorHasMore(floorQuery.data.hasMore);
    setFloorError(null);
  }, [floorQuery.data]);

  useEffect(() => {
    if (chatQuery.isError) setChatError(t('room.collaboration.loadError'));
  }, [chatQuery.isError, t]);
  useEffect(() => {
    if (floorQuery.isError) setFloorError(t('room.collaboration.loadError'));
  }, [floorQuery.isError, t]);

  const maxChatSequence = chatMessages.reduce(
    (maximum, message) => Math.max(maximum, message.sequence),
    0
  );
  const unreadCount = chatMessages.filter(
    (message) =>
      !message.isOwn && message.deliveryState === 'DELIVERED' && message.sequence > lastReadSequence
  ).length;
  const floorRequests = useMemo(() => activeFloorRequests(handRequests), [handRequests]);

  const sendChat = useCallback(
    async (body: string, clientMessageId: string) => {
      const pendingId = `pending:${clientMessageId}`;
      const optimistic: MeetingChatMessage = {
        messageId: pendingId,
        clientMessageId,
        sequence: Math.max(chatCursor.current, maxChatSequence) + 1,
        createdSequence: Math.max(chatCursor.current, maxChatSequence) + 1,
        participantId: 'viewer',
        senderName: t('room.collaboration.you'),
        body,
        sentAt: new Date().toISOString(),
        retentionUntil: null,
        deliveryState: 'PENDING',
        isOwn: true,
        canDelete: false,
      };
      setChatMessages((current) => [...current, optimistic]);
      setSending(true);
      setChatError(null);
      try {
        const sent = toChatMessage(
          await sendVideoMeetingChatMessage(meetingId, {
            text: body,
            idempotencyKey: clientMessageId,
          })
        );
        setChatMessages((current) =>
          mergeById(
            current.filter((message) => message.messageId !== pendingId),
            [sent],
            (message) => message.messageId,
            (message) => message.sequence
          )
        );
      } catch (error) {
        setChatMessages((current) =>
          current.map((message) =>
            message.messageId === pendingId ? { ...message, deliveryState: 'FAILED' } : message
          )
        );
        setChatError(t('room.collaboration.sendError'));
        throw error;
      } finally {
        setSending(false);
      }
    },
    [maxChatSequence, meetingId, t]
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const failed = chatMessages.find(
        (message) => message.messageId === messageId && message.deliveryState === 'FAILED'
      );
      if (!failed?.clientMessageId) return;
      setChatMessages((current) => current.filter((message) => message.messageId !== messageId));
      void sendChat(failed.body, failed.clientMessageId);
    },
    [chatMessages, sendChat]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      setBusyMessageIds((current) => new Set(current).add(messageId));
      setChatError(null);
      try {
        const deleted = toChatMessage(
          await deleteVideoMeetingChatMessage(meetingId, messageId, {
            idempotencyKey: crypto.randomUUID(),
          })
        );
        setChatMessages((current) =>
          mergeById(
            current,
            [deleted],
            (message) => message.messageId,
            (message) => message.sequence
          )
        );
      } catch {
        setChatError(t('room.collaboration.deleteError'));
      } finally {
        setBusyMessageIds((current) => {
          const next = new Set(current);
          next.delete(messageId);
          return next;
        });
      }
    },
    [meetingId, t]
  );

  const runFloorAction = useCallback(
    async (
      requestId: string,
      action: (
        meetingId: string,
        requestId: string,
        key: string
      ) => Promise<VideoMeetingHandRequest>
    ) => {
      setBusyRequestIds((current) => new Set(current).add(requestId));
      setFloorMutating(true);
      setFloorError(null);
      try {
        const updated = await action(meetingId, requestId, crypto.randomUUID());
        setHandRequests((current) =>
          mergeById(
            current,
            [updated],
            (request) => request.requestId,
            (request) => request.sequence
          )
        );
      } catch {
        setFloorError(t('room.collaboration.floorMutationError'));
      } finally {
        setFloorMutating(false);
        setBusyRequestIds((current) => {
          const next = new Set(current);
          next.delete(requestId);
          return next;
        });
      }
    },
    [meetingId, t]
  );

  const labels = useMemo<MeetingCollaborationLabels>(() => {
    const formatTime = (value: string) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : formatMeetingTime(value, i18n.language);
    };
    return {
      panelTitle: t('room.collaboration.title'),
      close: t(activeTab === 'floor' ? 'room.controls.floorClose' : 'room.controls.chatClose'),
      chatTab: t('room.collaboration.chatTab'),
      floorTab: t('room.collaboration.floorTab'),
      unreadMessages: (count) => t('room.collaboration.unreadMessages', { count }),
      pendingFloorRequests: (count) => t('room.collaboration.pendingFloorRequests', { count }),
      chatDescription: t('room.collaboration.chatDescription'),
      chatLoading: t('room.collaboration.chatLoading'),
      chatEmptyTitle: t('room.collaboration.chatEmptyTitle'),
      chatEmptyDescription: t('room.collaboration.chatEmptyDescription'),
      chatPermissionTitle: t('room.collaboration.chatPermissionTitle'),
      chatPermissionDescription: t('room.collaboration.chatPermissionDescription'),
      loadMoreMessages: t('room.collaboration.loadMoreMessages'),
      loadingMoreMessages: t('room.collaboration.loadingMoreMessages'),
      chatErrorTitle: t('room.collaboration.chatErrorTitle'),
      retry: t('actions.retry'),
      deletedMessage: t('room.collaboration.deletedMessage'),
      pendingMessage: t('room.collaboration.pendingMessage'),
      failedMessage: t('room.collaboration.failedMessage'),
      retryMessage: t('room.collaboration.retryMessage'),
      deleteMessage: t('room.collaboration.deleteMessage'),
      confirmDeleteMessage: t('room.collaboration.confirmDeleteMessage'),
      cancelDeleteMessage: t('actions.cancel'),
      timestamp: formatTime,
      chatPlaceholder: t('room.controls.chatPlaceholder'),
      sendMessage: t('room.controls.chatSend'),
      sendingMessage: t('room.collaboration.sendingMessage'),
      charactersRemaining: (count) => t('room.collaboration.charactersRemaining', { count }),
      floorDescription: t('room.collaboration.floorDescription'),
      floorLoading: t('room.collaboration.floorLoading'),
      floorEmptyTitle: t('room.collaboration.floorEmptyTitle'),
      floorEmptyDescription: t('room.collaboration.floorEmptyDescription'),
      floorPermissionTitle: t('room.collaboration.floorPermissionTitle'),
      floorPermissionDescription: t('room.collaboration.floorPermissionDescription'),
      floorErrorTitle: t('room.collaboration.floorErrorTitle'),
      requestFloor: t('room.raiseHand'),
      withdrawRequest: t('room.lowerHand'),
      requestPending: t('room.collaboration.requestPending'),
      ownQueuePosition: (position) => t('room.collaboration.ownQueuePosition', { position }),
      raised: t('room.collaboration.states.raised'),
      acknowledged: t('room.collaboration.states.acknowledged'),
      lowered: t('room.collaboration.states.lowered'),
      dismissed: t('room.collaboration.states.dismissed'),
      cleared: t('room.collaboration.states.cleared'),
      acknowledgeRequest: t('room.collaboration.acknowledgeRequest'),
      dismissRequest: t('room.collaboration.dismissRequest'),
      clearFloorQueue: t('room.collaboration.clearFloorQueue'),
      confirmClearFloorQueue: t('room.collaboration.confirmClearFloorQueue'),
      cancelClearFloorQueue: t('actions.cancel'),
      loadMoreFloorRequests: t('room.collaboration.loadMoreFloorRequests'),
      loadingMoreFloorRequests: t('room.collaboration.loadingMoreFloorRequests'),
      requestedAt: (value) => t('room.collaboration.requestedAt', { time: formatTime(value) }),
      participantInitials: initials,
    };
  }, [activeTab, i18n.language, t]);

  if (!activeTab) return null;

  const chatDisabledReason = effectivePermissions.chat
    ? !meetingLive
      ? t('room.collaboration.meetingEnded')
      : null
    : t('room.collaboration.chatDisabled');
  const floorDisabledReason = effectivePermissions.handRaise
    ? !meetingLive
      ? t('room.collaboration.meetingEnded')
      : null
    : t('room.collaboration.floorDisabled');

  return (
    <div
      id="meeting-collaboration-panel"
      className="dwp-meeting-side-panel dwp-meeting-side-panel--collaboration"
    >
      <MeetingCollaborationPanel
        activeTab={activeTab}
        maxMessageLength={MAX_CHAT_MESSAGE_LENGTH}
        disabled={!meetingLive}
        chat={{
          messages: chatMessages,
          unreadCount,
          loading: chatQuery.isLoading,
          loadingMore: chatQuery.isFetching && chatMessages.length > 0,
          hasMore: chatHasMore,
          nextSequence: chatCursor.current,
          sending,
          error: chatError,
          retentionNotice: t('room.collaboration.retentionNotice'),
          disabledReason: chatDisabledReason,
          busyMessageIds,
        }}
        floor={{
          requests: floorRequests,
          nextSequence: floorCursor.current,
          hasMore: floorHasMore,
          loading: floorQuery.isLoading,
          loadingMore: floorQuery.isFetching && floorRequests.length > 0,
          mutating: floorMutating,
          error: floorError,
          disabledReason: floorDisabledReason,
          busyRequestIds,
        }}
        permissions={{
          canReadChat: effectivePermissions.chat,
          canSendChat: effectivePermissions.chat && meetingLive,
          canModerateChat: canModerate,
          canViewFloorQueue: effectivePermissions.handRaise,
          canRequestFloor: effectivePermissions.handRaise && meetingLive,
          canModerateFloor: canModerate,
        }}
        labels={labels}
        actions={{
          onClose,
          onTabChange,
          onMarkChatRead: () => setLastReadSequence(maxChatSequence),
          onLoadMoreMessages: () => void chatQuery.refetch(),
          onRetryChat: () => void chatQuery.refetch(),
          onSendChat: sendChat,
          onRetryMessage: retryMessage,
          onDeleteMessage: (messageId) => void deleteMessage(messageId),
          onRetryFloor: () => void floorQuery.refetch(),
          onLoadMoreFloorRequests: () => void floorQuery.refetch(),
          onRequestFloor: () => {
            setFloorMutating(true);
            setFloorError(null);
            void raiseVideoMeetingHand(meetingId, crypto.randomUUID())
              .then((raised) =>
                setHandRequests((current) =>
                  mergeById(
                    current,
                    [raised],
                    (request) => request.requestId,
                    (request) => request.sequence
                  )
                )
              )
              .catch(() => setFloorError(t('room.collaboration.floorMutationError')))
              .finally(() => setFloorMutating(false));
          },
          onLowerHand: (requestId) => void runFloorAction(requestId, lowerVideoMeetingHand),
          onAcknowledgeFloor: (requestId) =>
            void runFloorAction(requestId, acknowledgeVideoMeetingHand),
          onDismissFloor: (requestId) => void runFloorAction(requestId, dismissVideoMeetingHand),
          onClearFloorQueue: () => {
            setFloorMutating(true);
            setFloorError(null);
            void clearVideoMeetingHandRequests(meetingId, crypto.randomUUID())
              .then(() => floorQuery.refetch())
              .catch(() => setFloorError(t('room.collaboration.floorMutationError')))
              .finally(() => setFloorMutating(false));
          },
        }}
      />
    </div>
  );
}
