import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AtSign,
  BellRing,
  CircleAlert,
  ExternalLink,
  MessageCircleReply,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { getMessagingActivity } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ErrorState,
  FormField,
  GuidedEmptyState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  filterMessagingActivity,
  messagingActivityFilter,
  type MessagingActivityFilter,
} from './messaging-attention-model';
import { messagingRelativeTime, MessagingPageHeading } from './messaging-components';
import { messagingConversationHref } from './messaging-deep-link';
import { messagingVisualTokens } from './messaging-visual-model';

import type { MessagingActivityKind } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

const ACTIVITY_LIMIT = 100;
const ACTIVITY_ICONS: Record<MessagingActivityKind, LucideIcon> = {
  MENTION: AtSign,
  THREAD_REPLY: MessageCircleReply,
  REACTION: Sparkles,
  SYSTEM: BellRing,
  SCHEDULE_FAILED: CircleAlert,
};

export function MessagingActivity() {
  const { t, i18n } = useTranslation('messaging');
  const [params, setParams] = useSearchParams();
  const filter = messagingActivityFilter(params.get('kind'));
  const queryText = params.get('q') ?? '';
  const deferredQuery = useDeferredValue(queryText);
  const query = useQuery({
    queryKey: ['messaging', 'activity', ACTIVITY_LIMIT],
    queryFn: () => getMessagingActivity(ACTIVITY_LIMIT),
    staleTime: 15_000,
    retry: 1,
  });
  const items = useMemo(
    () => filterMessagingActivity(query.data?.items ?? [], filter, deferredQuery),
    [deferredQuery, filter, query.data?.items]
  );
  const updateParam = (key: 'q' | 'kind', value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const filtered = filter !== 'ALL' || Boolean(queryText.trim());
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('activity.eyebrow')}
        title={t('activity.title')}
        description={t('activity.description')}
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

      <Box component="section" aria-labelledby="messaging-activity-results" sx={{ mt: 2.5 }}>
        <Stack spacing={1.25}>
          <FormField
            fullWidth={false}
            size="small"
            value={queryText}
            onChange={(event) => updateParam('q', event.target.value)}
            label={t('activity.search')}
            placeholder={t('activity.searchPlaceholder')}
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
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, value: MessagingActivityFilter | null) =>
              value && updateParam('kind', value)
            }
            aria-label={t('activity.filterLabel')}
            sx={{ alignSelf: 'flex-start', maxWidth: 1, flexWrap: 'wrap' }}
          >
            {(
              ['ALL', 'MENTION', 'THREAD_REPLY', 'REACTION', 'SYSTEM', 'SCHEDULE_FAILED'] as const
            ).map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`activity.kinds.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 2, mb: 1 }}>
          <Typography id="messaging-activity-results" component="h2" variant="subtitle1">
            {t('activity.results')}
          </Typography>
          {!query.isPending && !query.isError && (
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {t('activity.resultCount', { count: items.length })}
            </Typography>
          )}
        </Stack>

        {query.isPending ? (
          <LoadingState label={t('activity.loading')} />
        ) : query.isError ? (
          <ErrorState
            title={t('activity.loadError')}
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
            {items.map((item) => {
              const Icon = ACTIVITY_ICONS[item.kind];
              return (
                <Box
                  key={item.id}
                  component={RouterLink}
                  to={messagingConversationHref({
                    conversationId: item.conversationId,
                    messageId: item.messageId,
                  })}
                  aria-label={t('activity.open', {
                    kind: t(`activity.kinds.${item.kind}`),
                    conversation: item.conversationName || t('activity.unnamedConversation'),
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
                    <Icon size={18} aria-hidden="true" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {t(`activity.itemTitle.${item.kind}`, { actor: item.actorName })}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={item.conversationName || t('activity.unnamedConversation')}
                        sx={{ height: 21 }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      color={item.protectedContent ? 'text.secondary' : 'text.primary'}
                      sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
                    >
                      {item.protectedContent
                        ? t('activity.protectedPreview')
                        : item.preview || t('activity.noPreview')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {messagingRelativeTime(item.occurredAt, locale)}
                    </Typography>
                  </Box>
                  <ExternalLink size={16} aria-hidden="true" />
                </Box>
              );
            })}
          </Box>
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={filtered ? t('activity.noMatchesTitle') : t('activity.emptyTitle')}
            description={
              filtered ? t('activity.noMatchesDescription') : t('activity.emptyDescription')
            }
          />
        )}
      </Box>
    </PageCanvas>
  );
}
