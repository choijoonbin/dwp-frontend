import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BriefcaseBusiness, Clock3 } from 'lucide-react';
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
import { getWorkspaceWorkQueue } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

export function WorkHome() {
  const { t } = useTranslation('work');
  const query = useQuery({
    queryKey: ['workspace', 'work-queue'],
    queryFn: getWorkspaceWorkQueue,
    staleTime: 30_000,
    retry: 1,
  });
  const priorityItems = useMemo(
    () =>
      [...(query.data?.items ?? [])]
        .filter((item) => item.status !== 'completed')
        .sort((left, right) => {
          const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
          if (priority !== 0) return priority;
          return String(left.dueAt ?? '').localeCompare(String(right.dueAt ?? ''));
        })
        .slice(0, 5),
    [query.data?.items]
  );
  const header = (
    <ResourcePageHeader
      eyebrow={t('workHome.eyebrow')}
      title={t('workHome.title')}
      description={t('workHome.description')}
      status={
        <LiveStatus
          state={query.isFetching ? 'syncing' : 'live'}
          label={t('workHome.live')}
          refreshLabel={t('workPage.retry')}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      }
    />
  );

  if (query.isLoading) {
    return (
      <PageCanvas>
        {header}
        <LoadingState label={t('workHome.loading')} variant="skeleton" size="page" />
      </PageCanvas>
    );
  }
  if (query.isError || !query.data) {
    return (
      <PageCanvas>
        {header}
        <LocalErrorState
          title={t('workHome.errorTitle')}
          description={t('workHome.errorDescription')}
          retryLabel={t('workPage.retry')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          size="page"
        />
      </PageCanvas>
    );
  }

  const { summary } = query.data;
  return (
    <PageCanvas>
      {header}
      <Box sx={{ mt: 3 }}>
        <OperationalKpiStrip
          ariaLabel={t('workHome.summaryLabel')}
          items={[
            {
              key: 'total',
              value: summary.total,
              label: t('workHome.metrics.total'),
              detail: t('workHome.metrics.totalDetail'),
            },
            {
              key: 'due',
              value: summary.dueSoon,
              label: t('workHome.metrics.due'),
              detail: t('workHome.metrics.dueDetail'),
              tone: 'warning',
            },
            {
              key: 'progress',
              value: summary.inProgress,
              label: t('workHome.metrics.progress'),
              detail: t('workHome.metrics.progressDetail'),
              tone: 'info',
            },
            {
              key: 'waiting',
              value: summary.waiting,
              label: t('workHome.metrics.waiting'),
              detail: t('workHome.metrics.waitingDetail'),
            },
          ]}
        />
      </Box>
      <Box component="section" aria-labelledby="work-home-priority" sx={{ mt: 4 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Box>
            <Typography id="work-home-priority" component="h2" variant="h6">
              {t('workHome.priorityTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {t('workHome.priorityDescription')}
            </Typography>
          </Box>
          <ActionButton
            component={Link}
            to="/work/queue"
            intent="secondary"
            endIcon={<ArrowRight size={16} />}
          >
            {t('workHome.openQueue')}
          </ActionButton>
        </Stack>
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
          {priorityItems.length ? (
            priorityItems.map((item, index) => (
              <Box key={item.workItemId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  gap={1.5}
                  sx={{ py: 1.75 }}
                >
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    sx={{ minWidth: 0 }}
                  >
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
                      <BriefcaseBusiness size={17} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800}>
                        {item.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                        sx={{ mt: 0.3 }}
                      >
                        {item.summary || item.sourceSystem}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`labels.priority.${item.priority}`)}
                    />
                    <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                      <Clock3 size={14} />
                      <Typography variant="caption">
                        {item.dueAt
                          ? formatDate(item.dueAt, { dateStyle: 'medium' })
                          : t('workPage.noDueDate')}
                      </Typography>
                    </Stack>
                    <ActionButton
                      component={Link}
                      to={`/work/queue?item=${encodeURIComponent(item.id)}`}
                      intent="quiet"
                      size="small"
                    >
                      {t('workHome.open')}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            ))
          ) : (
            <EmptyState
              title={t('workHome.emptyTitle')}
              description={t('workHome.emptyDescription')}
              size="compact"
            />
          )}
        </Box>
      </Box>
    </PageCanvas>
  );
}
