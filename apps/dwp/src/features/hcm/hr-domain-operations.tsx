import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, SignalMetric } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import { getHrDomainOperations } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalQueue, DomainSection, QueryBoundary } from './hr-domain-components';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

export function HrDomainOperations({
  domain,
}: {
  domain: 'TIME' | 'ABSENCE' | 'BENEFITS' | 'PAY' | 'TALENT';
}) {
  const { t } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const query = useQuery({
    queryKey: ['hcm', 'operations', domain, ...requestScope.cacheKey],
    queryFn: ({ signal }) => getHrDomainOperations(domain, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const actionableDomain = domain === 'TIME' || domain === 'ABSENCE';

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1}>
            <ShieldCheck size={18} aria-hidden="true" />
            <Box>
              <Typography variant="body2" fontWeight={750}>
                {t('domains.operations.boundaryTitle')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('domains.operations.boundaryDescription', {
                  domain: t(`domains.names.${domain}`),
                })}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Chip size="small" variant="outlined" label={t('domains.operations.tenantScope')} />
            <Chip
              size="small"
              variant="outlined"
              label={
                query.data?.generatedAt
                  ? formatDate(query.data.generatedAt, { dateStyle: 'short', timeStyle: 'short' })
                  : '-'
              }
            />
          </Stack>
        </Stack>

        <Box
          aria-label={t('domains.operations.metrics')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          {(query.data?.metrics ?? []).map((metric) => (
            <SignalMetric
              key={metric.key}
              label={t(`domains.operations.metricLabels.${domain}.${metric.key}`)}
              value={formatNumber(metric.value)}
              detail={t(`domains.operations.metricDetails.${metric.severity}`)}
              tone={
                metric.severity === 'CRITICAL'
                  ? 'error'
                  : metric.severity === 'ATTENTION'
                    ? 'warning'
                    : 'info'
              }
              icon={
                metric.severity === 'CRITICAL' ? (
                  <AlertTriangle size={17} />
                ) : metric.severity === 'ATTENTION' ? (
                  <CalendarCheck2 size={17} />
                ) : (
                  <CheckCircle2 size={17} />
                )
              }
            />
          ))}
        </Box>

        {actionableDomain ? (
          <ApprovalQueue
            domain={domain === 'TIME' ? 'time' : 'absence'}
            items={query.data?.workQueue ?? []}
            title={t('domains.operations.queueTitle', { domain: t(`domains.names.${domain}`) })}
            description={t('domains.operations.queueDescription')}
          />
        ) : (
          <DomainSection
            title={t('domains.operations.readinessTitle')}
            description={t('domains.operations.readinessDescription', {
              domain: t(`domains.names.${domain}`),
            })}
          >
            {(query.data?.metrics ?? []).length ? (
              <Box>
                {query.data!.metrics.map((metric, index) => (
                  <Box key={metric.key}>
                    {index > 0 && <Divider />}
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5 }}>
                      <Database size={17} aria-hidden="true" />
                      <Typography variant="body2" fontWeight={700} flex={1}>
                        {t(`domains.operations.metricLabels.${domain}.${metric.key}`)}
                      </Typography>
                      <Typography variant="body2" fontWeight={780}>
                        {formatNumber(metric.value)}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={metric.severity === 'ATTENTION' ? 'warning' : 'success'}
                        label={t(`domains.operations.metricDetails.${metric.severity}`)}
                      />
                    </Stack>
                  </Box>
                ))}
              </Box>
            ) : (
              <EmptyState
                title={t('domains.operations.emptyTitle')}
                description={t('domains.operations.emptyDescription')}
              />
            )}
          </DomainSection>
        )}
      </Stack>
    </QueryBoundary>
  );
}
