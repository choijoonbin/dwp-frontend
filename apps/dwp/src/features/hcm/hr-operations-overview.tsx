import { useTranslation } from 'react-i18next';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, SignalMetric } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import { getHrWorkforceOperationsOverview } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DomainSection, QueryBoundary } from './hr-domain-components';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

export function HrOperationsOverview() {
  const { t } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
  const query = useQuery({
    queryKey: ['hcm', 'operations', 'overview', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getHrWorkforceOperationsOverview(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
    retry: 1,
  });

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        <Alert severity="info" icon={<ShieldCheck size={18} aria-hidden="true" />}>
          {t('domains.operations.overviewBoundary', {
            boundary: query.data?.dataBoundary ?? '-',
          })}
        </Alert>

        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }}>
          <Box flex={1} minWidth={0}>
            <Typography component="p" variant="subtitle2">
              {t('domains.operations.fieldGroups')}
            </Typography>
            <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
              {(query.data?.fieldGroups ?? []).map((fieldGroup) => (
                <Chip key={fieldGroup} size="small" variant="outlined" label={fieldGroup} />
              ))}
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {query.data?.generatedAt
              ? t('domains.operations.generatedAt', {
                  value: formatDate(query.data.generatedAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })
              : '-'}
          </Typography>
        </Stack>

        {(query.data?.domains ?? []).length ? (
          query.data!.domains.map((domain) => (
            <DomainSection
              key={domain.domain}
              title={t('domains.operations.overviewDomainTitle', {
                domain: t(`domains.names.${domain.domain}`),
              })}
              description={t('domains.operations.overviewPending', {
                count: formatNumber(domain.pendingCount),
              })}
              action={<ClipboardList size={18} aria-hidden="true" />}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: 1,
                  p: 1.5,
                }}
              >
                {domain.metrics.map((metric) => (
                  <SignalMetric
                    key={metric.key}
                    label={t(`domains.operations.metricLabels.${domain.domain}.${metric.key}`)}
                    value={formatNumber(metric.value)}
                    detail={t(`domains.operations.metricDetails.${metric.severity}`)}
                    tone={
                      metric.severity === 'CRITICAL'
                        ? 'error'
                        : metric.severity === 'ATTENTION'
                          ? 'warning'
                          : 'info'
                    }
                    icon={<ClipboardList size={17} />}
                  />
                ))}
              </Box>
            </DomainSection>
          ))
        ) : (
          <EmptyState
            title={t('domains.operations.emptyTitle')}
            description={t('domains.operations.emptyDescription')}
          />
        )}
      </Stack>
    </QueryBoundary>
  );
}
