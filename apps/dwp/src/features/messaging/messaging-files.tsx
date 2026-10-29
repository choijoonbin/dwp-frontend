import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Link as LinkIcon, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { getMessagingSharedAssets } from '@dwp-frontend/shared-utils';
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

import { messagingRelativeTime, MessagingPageHeading } from './messaging-components';
import { messagingConversationHref } from './messaging-deep-link';
import {
  filterMessagingAssets,
  messagingAssetFileSize,
  messagingAssetKindFilter,
  type MessagingAssetKindFilter,
} from './messaging-files-model';
import { messagingVisualTokens } from './messaging-visual-model';

const ASSET_LIMIT = 100;

export function MessagingFiles() {
  const { t, i18n } = useTranslation('messaging');
  const [params, setParams] = useSearchParams();
  const queryText = params.get('q') ?? '';
  const deferredQueryText = useDeferredValue(queryText);
  const kind = messagingAssetKindFilter(params.get('kind'));
  const query = useQuery({
    queryKey: ['messaging', 'shared-assets', ASSET_LIMIT],
    queryFn: () => getMessagingSharedAssets(ASSET_LIMIT),
    staleTime: 30_000,
    retry: 1,
  });
  const items = useMemo(
    () => filterMessagingAssets(query.data?.items ?? [], deferredQueryText, kind),
    [deferredQueryText, kind, query.data?.items]
  );
  const updateParam = (key: 'q' | 'kind', value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const filtered = Boolean(queryText.trim() || kind !== 'ALL');
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('files.eyebrow')}
        title={t('files.title')}
        description={t('files.description')}
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

      <Box
        component="section"
        aria-labelledby="messaging-files-results-title"
        sx={{ mt: 2.5, minWidth: 0 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <FormField
            fullWidth={false}
            size="small"
            value={queryText}
            onChange={(event) => updateParam('q', event.target.value)}
            label={t('files.search')}
            placeholder={t('files.searchPlaceholder')}
            sx={{ width: { xs: 1, sm: 360 }, maxWidth: 1 }}
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
            value={kind}
            onChange={(_, value: MessagingAssetKindFilter | null) =>
              value && updateParam('kind', value)
            }
            aria-label={t('files.kindFilter')}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            {(['ALL', 'FILE', 'LINK'] as const).map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`files.kinds.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 2, mb: 1 }}>
          <Typography id="messaging-files-results-title" component="h2" variant="subtitle1">
            {t('files.results')}
          </Typography>
          {!query.isPending && !query.isError && (
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {t('files.resultCount', { count: items.length })}
            </Typography>
          )}
        </Stack>

        {query.isPending ? (
          <LoadingState label={t('files.loading')} />
        ) : query.isError ? (
          <ErrorState
            title={t('files.loadError')}
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
              const Icon = item.kind === 'FILE' ? FileText : LinkIcon;
              const size = messagingAssetFileSize(item.sizeBytes);
              const title = item.protectedContent ? t('files.protectedTitle') : item.title;
              return (
                <Box
                  key={item.id}
                  component={RouterLink}
                  to={messagingConversationHref({
                    conversationId: item.conversationId,
                    messageId: item.messageId,
                  })}
                  aria-label={t('files.open', {
                    title,
                    conversation: item.conversationName,
                  })}
                  sx={(theme) => ({
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    gap: { xs: 1, sm: 1.5 },
                    alignItems: 'center',
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
                      <Typography
                        variant="body2"
                        fontWeight="fontWeightBold"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {title}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`files.kinds.${item.kind}`)}
                        sx={{ height: 21 }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.conversationName || t('files.unnamedConversation')} · {item.senderName}{' '}
                      · {messagingRelativeTime(item.sharedAt, locale)}
                      {size ? ` · ${size}` : ''}
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
            title={filtered ? t('files.noMatchesTitle') : t('files.emptyTitle')}
            description={filtered ? t('files.noMatchesDescription') : t('files.emptyDescription')}
          />
        )}

        {query.data?.items.length === ASSET_LIMIT && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('files.limitNotice', { count: ASSET_LIMIT })}
          </Typography>
        )}
      </Box>
    </PageCanvas>
  );
}
