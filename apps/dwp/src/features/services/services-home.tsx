import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock3, FileClock, LifeBuoy, ListChecks } from 'lucide-react';
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
import { getServiceHomeCatalog, getServiceHomeRequests } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const completedStates = new Set(['RESOLVED', 'CLOSED', 'CANCELLED']);

export function ServicesHome() {
  const { t, i18n } = useTranslation('services');
  const query = useQuery({
    queryKey: ['services', 'home', 'view', 'absent'],
    queryFn: async ({ signal }) => {
      const [catalog, requests] = await Promise.all([
        getServiceHomeCatalog(signal),
        getServiceHomeRequests(signal),
      ]);
      return { catalog, requests };
    },
    staleTime: 30_000,
    retry: 1,
  });
  const language = i18n.resolvedLanguage ?? i18n.language;
  const activeRequests = useMemo(
    () =>
      (query.data?.requests ?? [])
        .filter((request) => request.status !== 'DRAFT' && !completedStates.has(request.status))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [query.data?.requests]
  );
  const featured = (query.data?.catalog.items ?? []).filter((item) => item.featured).slice(0, 4);
  const drafts = (query.data?.requests ?? []).filter((request) => request.status === 'DRAFT');
  const waiting = activeRequests.filter((request) => request.status === 'AWAITING_REQUESTER');
  const header = (
    <ResourcePageHeader
      eyebrow={t('productHome.eyebrow')}
      title={t('productHome.title')}
      description={t('productHome.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('productHome.live')}
          refreshLabel={t('productHome.retry')}
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
          retryLabel={t('productHome.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );

  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('productHome.summaryLabel')}
          items={[
            {
              key: 'services',
              value: query.data.catalog.activeCount,
              label: t('productHome.metrics.services'),
              detail: t('productHome.metrics.servicesDetail'),
            },
            {
              key: 'active',
              value: activeRequests.length,
              label: t('productHome.metrics.active'),
              detail: t('productHome.metrics.activeDetail'),
              tone: 'info',
            },
            {
              key: 'waiting',
              value: waiting.length,
              label: t('productHome.metrics.waiting'),
              detail: t('productHome.metrics.waitingDetail'),
              tone: 'warning',
            },
            {
              key: 'drafts',
              value: drafts.length,
              label: t('productHome.metrics.drafts'),
              detail: t('productHome.metrics.draftsDetail'),
            },
          ]}
        />
      </Box>
      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="services-home-active">
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Box>
              <Typography id="services-home-active" component="h2" variant="h6">
                {t('productHome.activeTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                {t('productHome.activeDescription')}
              </Typography>
            </Box>
            <ActionButton
              component={Link}
              to="/services/my"
              intent="secondary"
              endIcon={<ArrowRight size={16} />}
            >
              {t('productHome.openRequests')}
            </ActionButton>
          </Stack>
          <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
            {activeRequests.length ? (
              activeRequests.slice(0, 5).map((request, index) => (
                <Box key={request.requestId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    gap={1.5}
                    sx={{ py: 1.7 }}
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
                        <ListChecks size={17} />
                      </Box>
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={800}>
                          {language.startsWith('en')
                            ? request.serviceNameEn
                            : request.serviceNameKo}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                          sx={{ mt: 0.3 }}
                        >
                          {request.summary}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`requests.statusLabels.${request.status}`)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(request.updatedAt, { dateStyle: 'medium' })}
                      </Typography>
                      <ActionButton
                        component={Link}
                        to={`/services/my/${request.requestId}`}
                        intent="quiet"
                        size="small"
                      >
                        {t('productHome.open')}
                      </ActionButton>
                    </Stack>
                  </Stack>
                </Box>
              ))
            ) : (
              <EmptyState
                title={t('productHome.emptyActiveTitle')}
                description={t('productHome.emptyActiveDescription')}
                size="compact"
              />
            )}
          </Box>
        </Box>
        <Box component="section" aria-labelledby="services-home-featured">
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Box>
              <Typography id="services-home-featured" component="h2" variant="h6">
                {t('productHome.featuredTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                {t('productHome.featuredDescription')}
              </Typography>
            </Box>
            <ActionButton component={Link} to="/services/discover" intent="quiet" size="small">
              {t('productHome.discover')}
            </ActionButton>
          </Stack>
          <Stack sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }} divider={<Divider />}>
            {featured.length ? (
              featured.map((service) => (
                <Stack
                  key={service.serviceKey}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1.5}
                  sx={{ py: 1.5 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.1} minWidth={0}>
                    <LifeBuoy size={17} color="var(--dwp-product-accent)" />
                    <Box minWidth={0}>
                      <Typography variant="body2" fontWeight={750}>
                        {service.name}
                      </Typography>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        color="text.secondary"
                      >
                        <Clock3 size={13} />
                        <Typography variant="caption">
                          {t('discover.estimate', { hours: service.estimatedResolutionHours })}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                  <ActionButton
                    component={Link}
                    to={`/services/discover?service=${encodeURIComponent(service.serviceKey)}`}
                    intent="quiet"
                    size="small"
                  >
                    {t('discover.request')}
                  </ActionButton>
                </Stack>
              ))
            ) : (
              <EmptyState
                title={t('productHome.emptyFeaturedTitle')}
                description={t('productHome.emptyFeaturedDescription')}
                size="compact"
                icon={<FileClock size={24} />}
              />
            )}
          </Stack>
        </Box>
      </Box>
    </PageCanvas>
  );
}
