import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Command,
  Hash,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  addMessagingReaction,
  getMessagingConversation,
  getMessagingConversations,
  sendMessagingMessage,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Theme } from '@mui/material/styles';
import type { MessagingConversation } from '@dwp-frontend/shared-utils';

import {
  ClassificationChip,
  MessagingConversationListItem,
  MessagingMessageRow,
  MessagingPageHeading,
  MessagingPersonLine,
} from './messaging-components';

type Scope = 'ALL' | 'FAVORITES' | 'SPACES' | 'DIRECT' | 'CHANNELS';

export function MessagingConversationWorkspace({ scope }: { scope: Scope }) {
  const { t } = useTranslation('messaging');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [draft, setDraft] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
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
    retry: 1,
  });
  const detailQuery = useQuery({
    queryKey: ['messaging', 'conversation', selectedId],
    queryFn: () => getMessagingConversation(selectedId!),
    enabled: Boolean(selectedId),
    staleTime: 8_000,
    retry: 1,
  });
  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      sendMessagingMessage({
        conversationId: selectedId!,
        body,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async (detail) => {
      setDraft('');
      queryClient.setQueryData(['messaging', 'conversation', selectedId], detail);
      await queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] });
      requestAnimationFrame(() => {
        detailScrollRef.current?.scrollTo({ top: detailScrollRef.current.scrollHeight });
      });
    },
    onError: () => toast.error(t('conversation.sendError')),
  });
  const reactionMutation = useMutation({
    mutationFn: (messageId: string) => addMessagingReaction(selectedId!, messageId, '👍'),
    onSuccess: (detail) => {
      queryClient.setQueryData(['messaging', 'conversation', selectedId], detail);
    },
    onError: () => toast.error(t('conversation.reactionError')),
  });
  const selectedConversation = conversationsQuery.data?.items.find(
    (item) => item.conversationId === selectedId
  );
  const detail = detailQuery.data;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [search]);

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

  const title = useMemo(() => t(`workspace.${scope}.title`), [scope, t]);
  const description = useMemo(() => t(`workspace.${scope}.description`), [scope, t]);

  const selectConversation = (conversation: MessagingConversation) => {
    const next = new URLSearchParams(params);
    next.set('conversation', conversation.conversationId);
    setParams(next, { replace: true });
  };
  const clearSelection = () => {
    const next = new URLSearchParams(params);
    next.delete('conversation');
    setParams(next, { replace: true });
  };
  const send = () => {
    const body = draft.trim();
    if (!body || !selectedId || sendMutation.isPending) return;
    sendMutation.mutate(body);
  };

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('workspace.eyebrow')}
        title={title}
        description={description}
        actions={
          <Stack direction="row" spacing={1}>
            <ActionIconButton
              label={t('actions.focusSearch')}
              onClick={() => searchRef.current?.focus()}
            >
              <Command size={18} />
            </ActionIconButton>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={17} />}
              onClick={() => {
                conversationsQuery.refetch();
                detailQuery.refetch();
              }}
            >
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
            lg: 'minmax(320px, 380px) minmax(0, 1fr) minmax(300px, 340px)',
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
            display: { xs: selectedId ? 'none' : 'flex', lg: 'flex' },
            flexDirection: 'column',
            borderRight: { lg: 1 },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
            <FormField
              fullWidth
              size="small"
              value={search}
              placeholder={t('workspace.search')}
              inputRef={searchRef}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {conversationsQuery.isLoading ? (
              <Box sx={{ p: 1.5 }}>
                {[0, 1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} variant="rounded" height={84} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : conversationsQuery.isError ? (
              <Alert severity="error" sx={{ m: 1.5 }}>
                {t('workspace.loadError')}
              </Alert>
            ) : conversationsQuery.data?.items.length ? (
              conversationsQuery.data.items.map((conversation) => (
                <MessagingConversationListItem
                  key={conversation.conversationId}
                  conversation={conversation}
                  selected={selectedId === conversation.conversationId}
                  onSelect={() => selectConversation(conversation)}
                />
              ))
            ) : (
              <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center', p: 2 }}>
                <GuidedEmptyState
                  kind={search ? 'no-results' : 'empty'}
                  title={t('workspace.emptyTitle')}
                  description={t('workspace.emptyDescription')}
                />
              </Box>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            minHeight: { xs: selectedId ? 'calc(100dvh - 150px)' : 0, lg: 0 },
            display: { xs: selectedId ? 'grid' : 'none', lg: 'grid' },
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
            <Box sx={{ p: 2 }}>
              <Skeleton variant="rounded" height={74} />
              <Skeleton variant="rounded" height={420} sx={{ mt: 2 }} />
            </Box>
          ) : detailQuery.isError || !detail ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {t('conversation.loadError')}
            </Alert>
          ) : (
            <>
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <ActionIconButton
                  label={t('actions.back')}
                  onClick={clearSelection}
                  sx={{ display: { lg: 'none' } }}
                >
                  <ArrowLeft size={18} />
                </ActionIconButton>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
                    {detail.conversation.visibility === 'SPACE' ? (
                      <Hash size={18} />
                    ) : (
                      <MessageSquarePlus size={18} />
                    )}
                    <Typography component="h2" variant="h6" fontWeight={850} noWrap>
                      {detail.conversation.name}
                    </Typography>
                    <ClassificationChip classification={detail.conversation.dataClassification} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {detail.conversation.topic}
                  </Typography>
                </Box>
              </Stack>

              <Box ref={detailScrollRef} sx={{ minHeight: 0, overflowY: 'auto', px: 2, py: 1.25 }}>
                {detail.messages.length ? (
                  detail.messages.map((message) => (
                    <MessagingMessageRow
                      key={message.messageId}
                      message={message}
                      mine={message.senderUserId === auth.user?.userId}
                      onReact={() => reactionMutation.mutate(message.messageId)}
                    />
                  ))
                ) : (
                  <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
                    <GuidedEmptyState
                      kind="empty"
                      title={t('conversation.noMessagesTitle')}
                      description={t('conversation.noMessagesDescription')}
                    />
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  p: 1.5,
                  minWidth: 0,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  borderTop: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <FormField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={5}
                  sx={{ maxWidth: '100%' }}
                  value={draft}
                  placeholder={t('conversation.composerPlaceholder')}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      send();
                    }
                  }}
                />
                <Stack
                  direction="row"
                  spacing={1.25}
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{
                      minWidth: 0,
                      flex: '1 1 auto',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {detail.realtime.state === 'READY_FOR_WEBSOCKET_GATEWAY'
                      ? t('conversation.realtimeRest')
                      : detail.realtime.detail}
                  </Typography>
                  <ActionButton
                    intent="primary"
                    endIcon={
                      sendMutation.isPending ? <CircularProgress size={15} /> : <Send size={16} />
                    }
                    disabled={!draft.trim() || sendMutation.isPending}
                    onClick={send}
                    sx={{ minWidth: 108, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {t('conversation.send')}
                  </ActionButton>
                </Stack>
              </Box>
            </>
          )}
        </Box>

        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            minWidth: 0,
            minHeight: 0,
            overflowY: 'auto',
            borderLeft: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          {detail ? (
            <Stack spacing={2} sx={{ p: 2 }}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('context.members')}
                </Typography>
                <Stack spacing={1.25} sx={{ mt: 1 }}>
                  {detail.members.slice(0, 8).map((member) => (
                    <MessagingPersonLine key={member.userId} person={member} />
                  ))}
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('context.governance')}
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ShieldCheck size={16} color="var(--dwp-product-accent)" />
                    <Typography variant="body2" fontWeight={760}>
                      {t(`classification.${detail.conversation.dataClassification}`)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {detail.conversation.linkedSpaceName
                      ? t('context.spaceLinked', { space: detail.conversation.linkedSpaceName })
                      : t('context.membershipBound')}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {selectedConversation?.topic ?? t('context.empty')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}
