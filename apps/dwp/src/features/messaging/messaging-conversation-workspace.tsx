import { Command, MessageSquarePlus, RefreshCw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { MessagingConversationContext } from './messaging-conversation-context';
import { MessagingConversationHeader } from './messaging-conversation-header';
import { MessagingConversationListPane } from './messaging-conversation-list-pane';
import { MessagingCreateConversationDialog } from './messaging-create-conversation-dialog';
import { MessagingMeetingHost } from './messaging-meeting-host';
import { MessagingMessageDialogs } from './messaging-message-dialogs';
import { MessagingMembersDialog } from './messaging-members-dialog';
import { MessagingPageHeading } from './messaging-components';
import { MessagingSearchPalette } from './messaging-search-palette';
import { MessagingThreadPanel } from './messaging-thread-panel';
import { MessagingTimelinePane } from './messaging-timeline-pane';
import { useMessagingWorkspaceController } from './use-messaging-workspace-controller';

import type { MessagingScope } from './messaging-workspace-types';

export function MessagingConversationWorkspace({ scope }: { scope: MessagingScope }) {
  const workspace = useMessagingWorkspaceController(scope);
  const {
    t,
    auth,
    title,
    description,
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
  } = workspace;

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('workspace.eyebrow')}
        title={title}
        description={description}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <ActionButton
              intent="primary"
              startIcon={<MessageSquarePlus size={17} />}
              onClick={() => setCreateDialogOpen(true)}
            >
              {t('create.action')}
            </ActionButton>
            <ActionIconButton label={t('search.open')} onClick={() => setSearchPaletteOpen(true)}>
              <Command size={18} />
            </ActionIconButton>
            <ActionButton intent="quiet" startIcon={<RefreshCw size={17} />} onClick={refresh}>
              {t('actions.refresh')}
            </ActionButton>
          </Stack>
        }
      />

      <Box
        sx={{
          mt: 2.5,
          height: { xs: 'auto', lg: 'calc(100dvh - 190px)' },
          minHeight: { lg: 640 },
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: thread
              ? 'minmax(0, 1fr) minmax(360px, 420px)'
              : 'minmax(280px, 320px) minmax(0, 1fr)',
            xl: thread
              ? 'minmax(280px, 320px) minmax(0, 1fr) minmax(360px, 420px)'
              : 'minmax(320px, 380px) minmax(0, 1fr) minmax(300px, 340px)',
          },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            display: {
              xs: selectedId ? 'none' : 'block',
              lg: thread ? 'none' : 'block',
              xl: 'block',
            },
            borderRight: { lg: 1 },
            borderColor: 'divider',
          }}
        >
          <MessagingConversationListPane
            conversations={conversationsQuery.data?.items ?? []}
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
            }}
            onSearchChange={setSearch}
            onSelect={selectConversation}
          />
        </Box>

        <Box
          sx={{
            minWidth: 0,
            minHeight: { xs: selectedId ? 'calc(100dvh - 150px)' : 0, lg: 0 },
            display: { xs: selectedId ? 'grid' : 'none', lg: 'grid' },
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
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
              />
              <MessagingTimelinePane
                messages={rootMessages}
                currentUserId={auth.user?.userId}
                replyCounts={fallbackReplyCounts}
                typingNames={typingNames}
                scrollRef={detailScrollRef}
                draft={draft}
                sending={sendMutation.isPending}
                sendError={sendMutation.isError}
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
                }}
                onScroll={markVisibleMessagesRead}
                onLoadOlder={loadOlderMessages}
                onDraftChange={(value) => {
                  if (sendMutation.isError) sendMutation.reset();
                  setDraft(value);
                }}
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
            sx={{
              display: { xs: 'contents', lg: 'block' },
              minWidth: 0,
              minHeight: 0,
              borderLeft: { lg: 1 },
              borderColor: 'divider',
            }}
          >
            <MessagingThreadPanel
              open
              desktop={desktopSplitView}
              thread={thread}
              currentUserId={auth.user?.userId}
              draft={threadDraft}
              onDraftChange={(value) => {
                if (threadSendMutation.isError) threadSendMutation.reset();
                setThreadDraft(value);
              }}
              onSend={sendThreadReply}
              onRetry={retryThreadReply}
              isSending={threadSendMutation.isPending}
              hasError={threadSendMutation.isError}
              onClose={() => setThreadRootId(null)}
              onReact={toggleReaction}
              onSave={saveMessage}
              onEdit={openEditMessage}
              onDelete={setDeletingMessage}
              loading={threadQuery.isLoading}
              loadError={threadQuery.isError}
            />
          </Box>
        ) : (
          <Box
            component="aside"
            sx={{
              display: { xs: 'none', xl: 'block' },
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              borderLeft: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            <MessagingConversationContext
              detail={detail}
              fallbackTopic={selectedConversation?.topic}
              labels={{
                members: t('context.members'),
                governance: t('context.governance'),
                classification: detail
                  ? t(`classification.${detail.conversation.dataClassification}`)
                  : '',
                spaceLinked: detail?.conversation.linkedSpaceName
                  ? t('context.spaceLinked', { space: detail.conversation.linkedSpaceName })
                  : '',
                membershipBound: t('context.membershipBound'),
                empty: t('context.empty'),
              }}
            />
          </Box>
        )}
      </Box>

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
