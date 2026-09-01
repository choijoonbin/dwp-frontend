import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock3, FileText, Inbox, LifeBuoy, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState } from '@dwp-frontend/design-system';
import { getHcmServiceCatalog, getHcmServiceRequests } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DomainSection, ProgressSignal, QueryBoundary } from './hr-domain-components';
import { HcmQueryState } from '../../components/hcm-query-state';

import type { ServiceRequestStatus } from '@dwp-frontend/shared-utils';

const OPEN_STATUSES = new Set<ServiceRequestStatus>([
  'DRAFT',
  'SUBMITTED',
  'TRIAGED',
  'IN_PROGRESS',
  'AWAITING_REQUESTER',
]);

export function HrServiceHub() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const catalog = useQuery({
    queryKey: ['services', 'catalog', 'surface:hcm'],
    queryFn: ({ signal }) => getHcmServiceCatalog(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const requests = useQuery({
    queryKey: ['services', 'requests', 'surface:hcm'],
    queryFn: ({ signal }) => getHcmServiceRequests(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const peopleServices = useMemo(
    () => (catalog.data?.items ?? []).filter((item) => item.categoryKey === 'PEOPLE'),
    [catalog.data?.items]
  );
  // The requests endpoint is already constrained by `surface=hcm`; do not make request tracking
  // depend on the independently loaded catalog or on a legacy `people.` key convention.
  const hrRequests = requests.data ?? [];
  const openRequests = hrRequests.filter((request) => OPEN_STATUSES.has(request.status));
  const awaitingRequester = hrRequests.filter(
    (request) => request.status === 'AWAITING_REQUESTER'
  ).length;

  return (
    <QueryBoundary
      loading={catalog.isLoading && requests.isLoading}
      error={catalog.isError && requests.isError ? (catalog.error ?? requests.error) : null}
      retrying={catalog.isFetching || requests.isFetching}
      onRetry={() => {
        void catalog.refetch();
        void requests.refetch();
      }}
    >
      <Stack gap={2}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <ProgressSignal
            label={t('services.metrics.available')}
            value={catalog.isError ? '-' : String(peopleServices.length)}
            detail={t('services.metrics.availableDetail')}
            progress={!catalog.isError && peopleServices.length ? 100 : 0}
            tone={catalog.isError ? 'error' : peopleServices.length ? 'success' : 'warning'}
          />
          <ProgressSignal
            label={t('services.metrics.open')}
            value={requests.isError ? '-' : String(openRequests.length)}
            detail={t('services.metrics.openDetail')}
            progress={requests.isError ? 0 : Math.min(100, openRequests.length * 20)}
            tone={requests.isError ? 'error' : 'primary'}
          />
          <ProgressSignal
            label={t('services.metrics.awaiting')}
            value={requests.isError ? '-' : String(awaitingRequester)}
            detail={t('services.metrics.awaitingDetail')}
            progress={!requests.isError && awaitingRequester ? 100 : 0}
            tone={requests.isError ? 'error' : awaitingRequester ? 'warning' : 'success'}
          />
        </Box>

        <DomainSection
          title={t('services.catalogTitle')}
          description={t('services.catalogDescription')}
          action={
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<LifeBuoy size={16} />}
              onClick={() => navigate('/services/discover?category=PEOPLE&source=hr')}
            >
              {t('services.openCatalog')}
            </ActionButton>
          }
        >
          {catalog.isLoading ? (
            <HcmQueryState loading size="compact" />
          ) : catalog.isError ? (
            <HcmQueryState
              size="compact"
              error={catalog.error}
              retrying={catalog.isFetching}
              onRetry={() => void catalog.refetch()}
            />
          ) : peopleServices.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {peopleServices.map((service, index) => (
                <Stack
                  key={service.serviceKey}
                  direction="row"
                  alignItems="flex-start"
                  gap={1.25}
                  sx={{
                    minHeight: 138,
                    p: 2,
                    borderTop: index > 1 ? 1 : 0,
                    borderLeft: { md: index % 2 ? 1 : 0 },
                    borderColor: 'divider',
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 38,
                      height: 38,
                      flex: '0 0 38px',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1,
                      color: 'var(--dwp-product-accent, #11756D)',
                      bgcolor: 'var(--dwp-product-soft, #E7F4F1)',
                    }}
                  >
                    <FileText size={19} />
                  </Box>
                  <Box minWidth={0} flex={1}>
                    <Typography variant="body2" fontWeight={760}>
                      {service.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ mt: 0.35 }}
                    >
                      {service.description}
                    </Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<Clock3 size={13} />}
                        label={t('services.sla', { hours: service.slaHours })}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<ShieldCheck size={13} />}
                        label={t(`services.classification.${service.dataClassification}`)}
                      />
                    </Stack>
                  </Box>
                  <ActionButton
                    intent="quiet"
                    size="small"
                    endIcon={<ArrowRight size={15} />}
                    onClick={() =>
                      navigate(
                        `/services/discover?category=PEOPLE&service=${encodeURIComponent(service.serviceKey)}&source=hr`
                      )
                    }
                  >
                    {t('services.request')}
                  </ActionButton>
                </Stack>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('services.emptyCatalogTitle')}
              description={t('services.emptyCatalogDescription')}
            />
          )}
        </DomainSection>

        <DomainSection
          title={t('services.requestsTitle')}
          description={t('services.requestsDescription')}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={() => navigate('/services/my')}
            >
              {t('services.allRequests')}
            </ActionButton>
          }
        >
          {requests.isLoading ? (
            <HcmQueryState loading size="compact" />
          ) : requests.isError ? (
            <HcmQueryState
              size="compact"
              error={requests.error}
              retrying={requests.isFetching}
              onRetry={() => void requests.refetch()}
            />
          ) : hrRequests.length ? (
            <Box>
              {hrRequests.slice(0, 6).map((request, index) => (
                <Box key={request.requestId}>
                  {index > 0 && <Divider />}
                  <Stack
                    component="button"
                    type="button"
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    onClick={() =>
                      navigate(
                        `/services/${request.status === 'DRAFT' ? 'drafts' : 'my'}/${request.requestId}`
                      )
                    }
                    sx={{
                      width: 1,
                      px: 2,
                      py: 1.5,
                      border: 0,
                      bgcolor: 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Inbox size={18} aria-hidden="true" />
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={750} noWrap>
                        {request.summary}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {request.requestNumber} · {request.assignedGroup}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={request.status === 'AWAITING_REQUESTER' ? 'warning' : 'default'}
                      label={t(`services.status.${request.status}`)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(request.updatedAt, { dateStyle: 'medium' })}
                    </Typography>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('services.emptyRequestsTitle')}
              description={t('services.emptyRequestsDescription')}
            />
          )}
        </DomainSection>
      </Stack>
    </QueryBoundary>
  );
}
