import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getHrTeamTime } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { ApprovalQueue, ProgressSignal, QueryBoundary } from './hr-domain-components';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

export function HrTeamTimeWorkspace() {
  const { t } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.team',
  });
  const query = useQuery({
    queryKey: ['hcm', 'team', 'time', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getHrTeamTime(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const pending = query.data?.teamQueue.length ?? 0;

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      <Stack gap={2}>
        <Alert severity="info" icon={<ShieldCheck size={18} aria-hidden="true" />}>
          {t('domains.teamBoundary', { boundary: query.data?.dataBoundary ?? '-' })}
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <ProgressSignal
            label={t('domains.time.teamPending')}
            value={String(pending)}
            detail={t('domains.time.teamPendingDetail')}
            progress={Math.min(100, pending * 20)}
            tone={pending ? 'warning' : 'success'}
          />
          <ProgressSignal
            label={t('domains.time.teamCoverage')}
            value={t('domains.time.currentWeek')}
            detail={t('domains.time.teamCoverageDetail')}
            progress={100}
            tone="primary"
          />
        </Box>
        <ApprovalQueue
          domain="time"
          decisionScope="team"
          items={query.data?.teamQueue ?? []}
          title={t('domains.time.queueTitle')}
          description={t('domains.time.queueDescription')}
        />
      </Stack>
    </QueryBoundary>
  );
}
