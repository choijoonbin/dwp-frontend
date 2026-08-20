import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Bookmark, CircleAlert, Newspaper, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  LiveStatus,
  LocalErrorState,
  LoadingState,
  OperationalKpiStrip,
  PageCanvas,
  ResourcePageHeader,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getCommunicationFeed } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CommunicationItem } from '@dwp-frontend/shared-utils';

function storyPath(item: CommunicationItem) {
  return `/communications/for-you/${item.communicationId}`;
}

export function CommunicationsHome() {
  const { t } = useTranslation('communications');
  const query = useQuery({
    queryKey: ['communications', 'home'],
    queryFn: () => getCommunicationFeed({ scope: 'for-you', type: 'ALL', size: 8 }),
    staleTime: 30_000,
    retry: 1,
  });
  const stories = useMemo(() => {
    const items = [query.data?.featured, ...(query.data?.items ?? [])].filter(
      (item): item is CommunicationItem => Boolean(item)
    );
    return [...new Map(items.map((item) => [item.communicationId, item])).values()].slice(0, 5);
  }, [query.data]);
  const header = (
    <ResourcePageHeader
      eyebrow={t('productHome.eyebrow')}
      title={t('productHome.title')}
      description={t('productHome.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('productHome.live')}
          refreshLabel={t('page.retry')}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      }
    />
  );

  if (query.isLoading)
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('productHome.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  if (query.isError || !query.data)
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('productHome.errorTitle')}
          description={t('productHome.errorDescription')}
          retryLabel={t('page.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  const { summary } = query.data;
  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('productHome.summaryLabel')}
          items={[
            {
              key: 'unread',
              value: summary.unread,
              label: t('productHome.metrics.unread'),
              detail: t('productHome.metrics.unreadDetail'),
              tone: 'info',
            },
            {
              key: 'required',
              value: summary.required,
              label: t('productHome.metrics.required'),
              detail: t('productHome.metrics.requiredDetail'),
              tone: 'warning',
            },
            {
              key: 'saved',
              value: summary.saved,
              label: t('productHome.metrics.saved'),
              detail: t('productHome.metrics.savedDetail'),
            },
            {
              key: 'total',
              value: summary.total,
              label: t('productHome.metrics.total'),
              detail: t('productHome.metrics.totalDetail'),
            },
          ]}
        />
      </Box>
      <Box component="section" aria-labelledby="communications-home-latest" sx={{ mt: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="communications-home-latest" component="h2" variant="h6">
              {t('productHome.latestTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('productHome.latestDescription')}
            </Typography>
          </Box>
          <ActionButton
            component={Link}
            to="/communications/for-you"
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
          >
            {t('productHome.openFeed')}
          </ActionButton>
        </Stack>
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
          {stories.length ? (
            stories.map((item, index) => {
              const StoryIcon = item.acknowledgementRequired
                ? CircleAlert
                : item.readerState.saved
                  ? Bookmark
                  : item.featured
                    ? Sparkles
                    : Newspaper;
              return (
                <Box key={item.communicationId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    gap={1.5}
                    sx={{ py: 1.75 }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 34,
                          height: 34,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'var(--dwp-product-soft)',
                          color: 'var(--dwp-product-accent)',
                          borderRadius: 1,
                          flexShrink: 0,
                        }}
                      >
                        <StoryIcon size={17} />
                      </Box>
                      <Box minWidth={0}>
                        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                          <Typography variant="body2" fontWeight={800}>
                            {item.title}
                          </Typography>
                          {item.readerState.unread && (
                            <Chip size="small" color="primary" label={t('page.unread')} />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ mt: 0.3 }}
                        >
                          {item.summary}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                      <Typography variant="caption" color="text.secondary">
                        {item.publishedAt
                          ? formatDate(item.publishedAt, { dateStyle: 'medium' })
                          : item.publisherName}
                      </Typography>
                      <ActionButton
                        component={Link}
                        to={storyPath(item)}
                        intent="quiet"
                        size="small"
                      >
                        {t('productHome.open')}
                      </ActionButton>
                    </Stack>
                  </Stack>
                </Box>
              );
            })
          ) : (
            <EmptyState
              title={t('productHome.emptyTitle')}
              description={t('productHome.emptyDescription')}
              size="compact"
            />
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}
