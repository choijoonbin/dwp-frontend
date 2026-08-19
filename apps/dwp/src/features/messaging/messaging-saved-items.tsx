import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkX, MessageSquareText, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getMessagingSavedItems,
  unsaveMessagingMessage,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  GuidedEmptyState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  messagingInitials,
  messagingRelativeTime,
  MessagingPageHeading,
} from './messaging-components';

const PAGE_SIZE = 30;

export function MessagingSavedItems() {
  const { t, i18n } = useTranslation('messaging');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['messaging', 'saved-items', page],
    queryFn: () => getMessagingSavedItems({ page, pageSize: PAGE_SIZE }),
    staleTime: 20_000,
    retry: 1,
  });
  const removeMutation = useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      unsaveMessagingMessage(conversationId, messageId),
    onSuccess: async () => {
      toast.success(t('saved.removeSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messaging', 'saved-items'] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] }),
      ]);
    },
    onError: () => toast.error(t('saved.removeError')),
  });
  const data = query.data;
  const hasPrevious = page > 0;
  const hasNext = Boolean(data && (page + 1) * data.pageSize < data.total);

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('saved.eyebrow')}
        title={t('saved.title')}
        description={t('saved.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} />}
            onClick={() => query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      <Box
        sx={{
          mt: 2.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {query.isLoading ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={96} />
            ))}
          </Stack>
        ) : query.isError ? (
          <Alert
            severity="error"
            action={
              <ActionButton intent="quiet" onClick={() => query.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            }
            sx={{ m: 2 }}
          >
            {t('saved.loadError')}
          </Alert>
        ) : data?.items.length ? (
          data.items.map((item) => (
            <Box
              key={`${item.message.conversationId}:${item.message.messageId}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                gap: 1.5,
                alignItems: 'start',
                px: { xs: 1.5, sm: 2 },
                py: 1.6,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              <Avatar sx={{ width: 38, height: 38, fontSize: 12, fontWeight: 800 }}>
                {messagingInitials(item.message.senderName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" fontWeight={800}>
                    {item.message.senderName}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={item.conversationName ?? t(`type.${item.conversationType}`)}
                    sx={{ height: 22 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {messagingRelativeTime(item.savedAt, i18n.resolvedLanguage ?? i18n.language)}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {item.message.deletedAt ? t('message.deleted') : item.message.body}
                </Typography>
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<MessageSquareText size={15} />}
                  onClick={() =>
                    navigate(`/messages/inbox?conversation=${item.message.conversationId}`)
                  }
                  sx={{ mt: 0.8 }}
                >
                  {t('saved.openConversation')}
                </ActionButton>
              </Box>
              <ActionIconButton
                label={t('saved.remove')}
                disabled={removeMutation.isPending}
                onClick={() =>
                  removeMutation.mutate({
                    conversationId: item.message.conversationId,
                    messageId: item.message.messageId,
                  })
                }
              >
                <BookmarkX size={17} />
              </ActionIconButton>
            </Box>
          ))
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={t('saved.emptyTitle')}
            description={t('saved.emptyDescription')}
          />
        )}
      </Box>

      {(hasPrevious || hasNext) && (
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
          <ActionButton
            intent="quiet"
            disabled={!hasPrevious}
            onClick={() => setPage((current) => current - 1)}
          >
            {t('saved.previous')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            disabled={!hasNext}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('saved.next')}
          </ActionButton>
        </Stack>
      )}
    </PageCanvas>
  );
}
