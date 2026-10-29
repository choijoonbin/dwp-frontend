import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MessageCircleReply, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { getMessagingThreads } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { filterMessagingThreads } from './messaging-attention-model';
import { messagingRelativeTime, MessagingPageHeading } from './messaging-components';
import { messagingConversationHref } from './messaging-deep-link';
import { messagingVisualTokens } from './messaging-visual-model';

const THREAD_LIMIT = 100;

export function MessagingThreads() {
  const { t, i18n } = useTranslation('messaging');
  const [params, setParams] = useSearchParams();
  const queryText = params.get('q') ?? '';
  const deferredQuery = useDeferredValue(queryText);
  const query = useQuery({
    queryKey: ['messaging', 'threads', THREAD_LIMIT],
    queryFn: () => getMessagingThreads(THREAD_LIMIT),
    staleTime: 15_000,
    retry: 1,
  });
  const items = useMemo(
    () => filterMessagingThreads(query.data?.items ?? [], deferredQuery),
    [deferredQuery, query.data?.items]
  );
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const updateSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('threadsPage.eyebrow')}
        title={t('threadsPage.title')}
        description={t('threadsPage.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} aria-hidden="true" />}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      <Box component="section" aria-labelledby="messaging-threads-results" sx={{ mt: 2.5 }}>
        <TextField
          size="small"
          value={queryText}
          onChange={(event) => updateSearch(event.target.value)}
          label={t('threadsPage.search')}
          placeholder={t('threadsPage.searchPlaceholder')}
          sx={{ width: { xs: 1, sm: 380 }, maxWidth: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 2, mb: 1 }}>
          <Typography id="messaging-threads-results" component="h2" variant="subtitle1">
            {t('threadsPage.results')}
          </Typography>
          {!query.isPending && !query.isError && (
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {t('threadsPage.resultCount', { count: items.length })}
            </Typography>
          )}
        </Stack>

        {query.isPending ? (
          <LoadingState label={t('threadsPage.loading')} />
        ) : query.isError ? (
          <ErrorState
            title={t('threadsPage.loadError')}
            retryLabel={t('actions.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        ) : items.length ? (
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: messagingVisualTokens.radius.surface,
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {items.map((item) => (
              <Box
                key={`${item.conversationId}:${item.rootMessageId}`}
                component={RouterLink}
                to={messagingConversationHref({
                  conversationId: item.conversationId,
                  messageId: item.latestReplyMessageId,
                })}
                aria-label={t('threadsPage.open', {
                  conversation: item.conversationName || t('threadsPage.unnamedConversation'),
                  count: item.replyCount,
                })}
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: { xs: 1, sm: 1.5 },
                  alignItems: 'start',
                  minWidth: 0,
                  px: { xs: 1.25, sm: 2 },
                  py: 1.5,
                  color: 'text.primary',
                  textDecoration: 'none',
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                })}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: messagingVisualTokens.radius.control,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <MessageCircleReply size={18} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={800}>
                      {item.conversationName || t('threadsPage.unnamedConversation')}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('threadsPage.replyCount', { count: item.replyCount })}
                      sx={{ height: 21 }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    color={
                      item.protectedContent || item.rootDeleted ? 'text.secondary' : 'text.primary'
                    }
                    sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                  >
                    {item.rootDeleted
                      ? t('threadsPage.deletedRoot')
                      : item.protectedContent
                        ? t('threadsPage.protectedPreview')
                        : item.rootPreview || t('threadsPage.noPreview')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('threadsPage.latestReply', {
                      actor: item.latestReplySenderName,
                      time: messagingRelativeTime(item.latestReplyAt, locale),
                    })}
                  </Typography>
                </Box>
                <ExternalLink size={16} aria-hidden="true" />
              </Box>
            ))}
          </Box>
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={queryText.trim() ? t('threadsPage.noMatchesTitle') : t('threadsPage.emptyTitle')}
            description={
              queryText.trim()
                ? t('threadsPage.noMatchesDescription')
                : t('threadsPage.emptyDescription')
            }
          />
        )}
      </Box>
    </PageCanvas>
  );
}
