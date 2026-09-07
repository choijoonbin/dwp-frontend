import { useState } from 'react';
import { ContentDialog, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';

import { MessagingConversationContext } from './messaging-conversation-context';
import { MessagingConversationHeader } from './messaging-conversation-header';
import { MessagingConversationListPane } from './messaging-conversation-list-pane';
import { MessagingCreateConversationDialog } from './messaging-create-conversation-dialog';
import { MessagingMeetingHost } from './messaging-meeting-host';
import { MessagingMessageDialogs } from './messaging-message-dialogs';
import { MessagingMembersDialog } from './messaging-members-dialog';
import { MessagingSearchPalette } from './messaging-search-palette';
import { MessagingThreadPanel } from './messaging-thread-panel';
import { MessagingTimelinePane } from './messaging-timeline-pane';
import { MessagingWorkspaceChrome } from './messaging-workspace-chrome';
import { messagingVisualTokens } from './messaging-visual-model';
import { useMessagingWorkspaceController } from './use-messaging-workspace-controller';
import {
  notificationContextKeys,
  useNotificationActiveContexts,
} from '../../components/notification-active-context';

import type { MessagingScope } from './messaging-workspace-types';

export function MessagingConversationWorkspace({ scope }: { scope: MessagingScope }) {
  const wideContext = useMediaQuery('(min-width: 1280px)');
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const workspace = useMessagingWorkspaceController(scope);
  const {
    t,
    auth,
    title,
    description,
    mentionFilterActive,
    desktopSplitView,
    selectedId,
    search,
    setSearch,
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
    threadSendPending,
    threadSendError,
    resetSendError,
    resetThreadSendError,
    editMutation,
    deleteMutation,
    selectConversation,
    clearSelection,
    clearMentionFilter,
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
    handleTimelineScroll,
    jumpToLatest,
    refresh,
    conversationCreated,
    setThreadRootId,
  } = workspace;
  useNotificationActiveContexts([
    selectedId ? notificationContextKeys.messagingConversation(selectedId) : null,
  ]);

  const contextPanel = (
    <MessagingConversationContext
      detail={detail}
      messages={rootMessages}
      onOpenThread={(messageId) => {
        setContextDialogOpen(false);
        setThreadRootId(messageId);
      }}
      onJumpToMessage={(messageId) => {
        setContextDialogOpen(false);
        // Wait for the modal to restore focus before focusing the visible message.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const message = detailScrollRef.current?.querySelector<HTMLElement>(
              `[data-msg-receipt-id="${CSS.escape(messageId)}"]`
            );
            const scroller = detailScrollRef.current;
            if (message && scroller) {
              const top =
                scroller.scrollTop +
                message.getBoundingClientRect().top -
                scroller.getBoundingClientRect().top;
              scroller.scrollTo({
                top: top - Math.max(0, (scroller.clientHeight - message.clientHeight) / 2),
                behavior: 'instant',
              });
            }
            message?.focus({ preventScroll: true });
          })
        );
      }}
      onOpenMembers={() => {
        setContextDialogOpen(false);
        setMembersDialogOpen(true);
      }}
    />
  );

  return (
    <PageCanvas topInset="compact">
      <Box
        data-testid="messaging-workspace-canvas"
        sx={{
          width: 1,
          minWidth: 0,
        }}
      >
        <Box sx={{ display: { xs: selectedId ? 'none' : 'block', lg: 'block' } }}>
          <MessagingWorkspaceChrome
            eyebrow={t('workspace.eyebrow')}
            title={title}
            description={description}
            mentionFilterActive={mentionFilterActive}
            labels={{
              showAll: t('workspace.MENTIONS.showAll'),
              create: t('create.action'),
              search: t('search.open'),
              refresh: t('actions.refresh'),
            }}
            onShowAll={clearMentionFilter}
            onCreate={() => setCreateDialogOpen(true)}
            onSearch={() => setSearchPaletteOpen(true)}
            onRefresh={refresh}
          />
        </Box>

        <Box
          sx={(theme) => ({
            width: { xs: selectedId ? 'calc(100% + 32px)' : 1, lg: 1 },
            height: { xs: selectedId ? 'calc(100dvh - 64px)' : 'auto', lg: 'calc(100dvh - 128px)' },
            minHeight: { xs: selectedId ? 0 : 'auto', lg: 520 },
            mx: { xs: selectedId ? -2 : 0, lg: 0 },
            mt: { xs: selectedId ? -2 : 0, lg: 0 },
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: thread
                ? 'minmax(0, 1fr) minmax(336px, 372px)'
                : 'minmax(260px, 292px) minmax(0, 1fr)',
            },
            '@media (min-width: 1280px)': {
              gridTemplateColumns: thread
                ? 'minmax(0, 1fr) 340px'
                : contextCollapsed
                  ? '240px minmax(0, 1fr)'
                  : '224px minmax(0, 1fr) 248px',
            },
            '@media (min-width: 1600px)': {
              gridTemplateColumns: thread
                ? '258px minmax(0, 1fr) 340px'
                : contextCollapsed
                  ? '258px minmax(0, 1fr)'
                  : '258px minmax(0, 1fr) 288px',
            },
            borderStyle: 'solid',
            borderWidth: { xs: selectedId ? 0 : 1, lg: 1 },
            borderColor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.22 : 0.1
            ),
            borderRadius: {
              xs: selectedId ? 0 : messagingVisualTokens.radius.surface,
              lg: messagingVisualTokens.radius.surface,
            },
            bgcolor: alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'dark' ? 0.08 : 0.035
            ),
            overflow: 'hidden',
          })}
        >
          <Box
            sx={(theme) => ({
              minWidth: 0,
              minHeight: 0,
              display: {
                xs: selectedId ? 'none' : 'block',
                lg: thread ? 'none' : 'block',
              },
              '@media (min-width: 1600px)': { display: 'block' },
              borderRightStyle: 'solid',
              borderRightWidth: { xs: 0, lg: 1 },
              borderColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.22 : 0.11
              ),
              bgcolor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === 'dark' ? 0.82 : 0.86
              ),
              overflow: 'hidden',
            })}
          >
            <MessagingConversationListPane
              conversations={conversations}
              selectedId={selectedId}
              search={search}
              searchInputRef={searchRef}
              loading={conversationsQuery.isLoading}
              loadError={conversationsQuery.isError}
              labels={{
                search: t('workspace.search'),
                list: t('workspace.list'),
                loadError: t('workspace.loadError'),
                emptyTitle: t('workspace.emptyTitle'),
                emptyDescription: t('workspace.emptyDescription'),
                create: t('navigator.create'),
                loadMore: t('workspace.loadMore'),
                loadingMore: t('workspace.loadingMore'),
              }}
              hasMore={Boolean(conversationsQuery.hasNextPage)}
              loadingMore={conversationsQuery.isFetchingNextPage}
              onSearchChange={setSearch}
              onSelect={selectConversation}
              onCreate={() => setCreateDialogOpen(true)}
              onLoadMore={() => conversationsQuery.fetchNextPage()}
            />
          </Box>

          <Box
            sx={{
              minWidth: 0,
              minHeight: { xs: selectedId ? 'calc(100dvh - 150px)' : 0, lg: 0 },
              display: { xs: selectedId ? 'grid' : 'none', lg: 'grid' },
              gridTemplateColumns: 'minmax(0, 1fr)',
              gridTemplateRows: 'auto minmax(0, 1fr) auto',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {!selectedId ? (
              <Box sx={{ display: 'grid', placeItems: 'center', p: 3 }}>
                <GuidedEmptyState
                  kind="empty"
                  title={t('conversation.selectTitle')}
                  description={t('conversation.selectDescription')}
                />
              </Box>
            ) : detailQuery.isLoading ? (
              <Box sx={{ p: 2 }} aria-busy="true">
                <Skeleton variant="rounded" height={74} />
                <Skeleton variant="rounded" height={420} sx={{ mt: 2 }} />
              </Box>
            ) : detailQuery.isError || !detail ? (
              <Alert severity="error" sx={{ m: 2 }}>
                {t('conversation.loadError')}
              </Alert>
            ) : (
              <>
                <MessagingConversationHeader
                  detail={detail}
                  currentMember={currentMember}
                  connectionState={realtimeConnection.state}
                  labels={{
                    back: t('actions.back'),
                    members: t('members.action'),
                    meeting: t('conversation.meetingAction'),
                  }}
                  onBack={clearSelection}
                  onOpenMembers={() => setMembersDialogOpen(true)}
                  onOpenMeeting={() => setMeetingDialogOpen(true)}
                  contextExpanded={wideContext ? !contextCollapsed && !thread : contextDialogOpen}
                  onToggleContext={() => {
                    if (wideContext) {
                      if (thread) setThreadRootId(null);
                      setContextCollapsed(thread ? false : !contextCollapsed);
                    } else setContextDialogOpen(true);
                  }}
                />
                <MessagingTimelinePane
                  conversation={detail.conversation}
                  messages={rootMessages}
                  currentUserId={auth.user?.userId}
                  replyCounts={fallbackReplyCounts}
                  typingNames={typingNames}
                  scrollRef={detailScrollRef}
                  draft={draft}
                  draftMentions={draftMentions}
                  members={detail.members}
                  allowMentionAll={
                    currentMember?.memberRole === 'OWNER' ||
                    currentMember?.memberRole === 'MODERATOR'
                  }
                  sending={sendPending}
                  sendError={sendError}
                  attachmentQueue={mainAttachmentQueue}
                  lastReadSequence={currentMember?.lastReadSequence}
                  newMessageCount={newMessageCount}
                  hasOlder={Boolean(messageHistoryQuery.hasNextPage)}
                  loadingOlder={messageHistoryQuery.isFetchingNextPage}
                  olderLoadError={messageHistoryQuery.isFetchNextPageError}
                  labels={{
                    timeline: t('conversation.timeline'),
                    loadOlder: t('conversation.history.loadOlder'),
                    loadingOlder: t('conversation.history.loading'),
                    olderLoadError: t('conversation.history.loadError'),
                    emptyTitle: t('conversation.noMessagesTitle'),
                    emptyDescription: t('conversation.noMessagesDescription'),
                    unread: t('conversation.unread'),
                    newMessages: t('conversation.newMessages', { count: newMessageCount }),
                  }}
                  onScroll={handleTimelineScroll}
                  onLoadOlder={loadOlderMessages}
                  onJumpToLatest={jumpToLatest}
                  onDraftChange={(value) => {
                    if (sendError) resetSendError();
                    setDraft(value);
                  }}
                  onDraftMentionsChange={setDraftMentions}
                  onOpenMeeting={() => setMeetingDialogOpen(true)}
                  onSend={send}
                  onRetrySend={retrySend}
                  onReply={setThreadRootId}
                  onReact={toggleReaction}
                  onSave={saveMessage}
                  onEdit={openEditMessage}
                  onDelete={setDeletingMessage}
                />
              </>
            )}
          </Box>

          {thread ? (
            <Box
              sx={(theme) => ({
                display: { xs: 'contents', lg: 'block' },
                minWidth: 0,
                minHeight: 0,
                borderLeftStyle: 'solid',
                borderLeftWidth: { xs: 0, lg: 1 },
                borderColor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.22 : 0.11
                ),
                bgcolor: 'background.paper',
                overflow: 'hidden',
              })}
            >
              <MessagingThreadPanel
                open
                desktop={desktopSplitView}
                thread={thread}
                currentUserId={auth.user?.userId}
                conversation={detail?.conversation}
                draft={threadDraft}
                draftMentions={threadDraftMentions}
                members={detail?.members ?? []}
                allowMentionAll={
                  currentMember?.memberRole === 'OWNER' || currentMember?.memberRole === 'MODERATOR'
                }
                onDraftChange={(value) => {
                  if (threadSendError) resetThreadSendError();
                  setThreadDraft(value);
                }}
                onDraftMentionsChange={setThreadDraftMentions}
                onSend={sendThreadReply}
                onRetry={retryThreadReply}
                isSending={threadSendPending}
                hasError={threadSendError}
                attachmentQueue={threadAttachmentQueue}
                onClose={() => setThreadRootId(null)}
                onReact={toggleReaction}
                onSave={saveMessage}
                onEdit={openEditMessage}
                onDelete={setDeletingMessage}
                loading={threadQuery.isLoading}
                loadError={threadQuery.isError}
              />
            </Box>
          ) : wideContext && !contextCollapsed ? (
            <Box
              component="aside"
              sx={(theme) => ({
                display: 'block',
                minWidth: 0,
                minHeight: 0,
                overflowY: 'auto',
                borderLeft: 1,
                borderColor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === 'dark' ? 0.22 : 0.11
                ),
                bgcolor: alpha(
                  theme.palette.background.paper,
                  theme.palette.mode === 'dark' ? 0.76 : 0.72
                ),
              })}
            >
              {contextPanel}
            </Box>
          ) : null}
        </Box>
      </Box>

      {contextDialogOpen && !wideContext && selectedId ? (
        <ContentDialog
          open
          title={t('context.panelTitle')}
          closeLabel={t('actions.close')}
          onClose={() => setContextDialogOpen(false)}
          maxWidth="xs"
          fullScreen={!desktopSplitView}
        >
          {contextPanel}
        </ContentDialog>
      ) : null}

      {selectedId && detail && auth.user ? (
        <MessagingMeetingHost
          open={meetingDialogOpen}
          conversationId={selectedId}
          conversationName={detail.conversation.name ?? t('conversation.untitled')}
          displayName={auth.user.displayName ?? auth.user.email}
          currentUserId={auth.user.userId}
          canModerateConversation={
            currentMember?.memberRole === 'OWNER' || currentMember?.memberRole === 'MODERATOR'
          }
          labels={meetingLabels}
          onClose={() => setMeetingDialogOpen(false)}
        />
      ) : null}
      {detail && membersDialogOpen ? (
        <MessagingMembersDialog
          open
          conversation={detail.conversation}
          onClose={() => setMembersDialogOpen(false)}
          onLeft={() => {
            setMembersDialogOpen(false);
            clearSelection();
          }}
        />
      ) : null}
      <MessagingCreateConversationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreated={conversationCreated}
      />
      <MessagingSearchPalette
        open={searchPaletteOpen}
        onClose={() => setSearchPaletteOpen(false)}
        onOpenConversation={openConversation}
      />
      <MessagingMessageDialogs
        editingMessage={editingMessage}
        deletingMessage={deletingMessage}
        editBody={editBody}
        editBusy={editMutation.isPending}
        deleteBusy={deleteMutation.isPending}
        onEditBodyChange={setEditBody}
        onCloseEdit={() => {
          if (editMutation.isPending) return;
          setEditingMessage(null);
          setEditBody('');
        }}
        onSubmitEdit={submitEditMessage}
        onCloseDelete={() => {
          if (!deleteMutation.isPending) setDeletingMessage(null);
        }}
        onConfirmDelete={confirmDeleteMessage}
      />
    </PageCanvas>
  );
}
