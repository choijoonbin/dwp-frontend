import { useTranslation } from 'react-i18next';
import { Building2, ClipboardCheck, Network, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState, SignalMetric } from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import { getHrTeam } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';
import { HcmQueryState } from '../../components/hcm-query-state';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
export function MyTeam() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.team',
  });
  const team = useQuery({
    queryKey: ['hcm', 'team', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getHrTeam(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const reports = team.data?.members ?? [];
  const managerCount = reports.filter((person) => person.directReportCount > 0).length;
  const pendingCount = (team.data?.timePendingCount ?? 0) + (team.data?.absencePendingCount ?? 0);

  if (team.isLoading) {
    return <HcmQueryState loading />;
  }
  if (team.isError) {
    return (
      <HcmQueryState
        error={team.error}
        onRetry={() => void team.refetch()}
        retrying={team.isFetching}
      />
    );
  }

  return (
    <Stack gap={2}>
      <Box
        aria-label={t('myTeam.signalsLabel')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <SignalMetric
          label={t('myTeam.signals.directReports')}
          value={formatNumber(reports.length)}
          detail={t('myTeam.signals.directReportsDetail')}
          icon={<UsersRound size={17} />}
          tone="primary"
        />
        <SignalMetric
          label={t('myTeam.signals.peopleManagers')}
          value={formatNumber(managerCount)}
          detail={t('myTeam.signals.peopleManagersDetail')}
          icon={<Network size={17} />}
          tone="info"
        />
        <SignalMetric
          label={t('myTeam.signals.pendingApprovals')}
          value={formatNumber(pendingCount)}
          detail={t('myTeam.signals.pendingApprovalsDetail')}
          icon={<ClipboardCheck size={17} />}
          tone={pendingCount ? 'warning' : 'success'}
        />
      </Box>

      <Paper component="section" variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1}
          sx={{ px: 2, py: 1.6 }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1" fontWeight={760}>
              {t('myTeam.roster.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('myTeam.roster.meta', { count: reports.length })}
            </Typography>
          </Box>
          <ActionButton
            intent="secondary"
            size="small"
            onClick={() => navigate('/hr/organization')}
          >
            {t('myTeam.roster.openOrganization')}
          </ActionButton>
        </Stack>
        <Divider />
        {reports.length ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {reports.map((person, index) => (
              <Box
                key={person.personId}
                sx={{
                  p: 2,
                  minWidth: 0,
                  borderTop: { xs: index ? 1 : 0, md: index > 1 ? 1 : 0 },
                  borderLeft: { xs: 0, md: index % 2 ? 1 : 0 },
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" alignItems="flex-start" gap={1.25}>
                  <PersonAvatar name={person.displayName} size={42} />
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" alignItems="center" gap={0.75} minWidth={0}>
                      <Typography variant="body2" fontWeight={760} noWrap>
                        {person.displayName}
                      </Typography>
                      {person.directReportCount > 0 && (
                        <Chip size="small" variant="outlined" label={t('myTeam.roster.manager')} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {person.businessTitle || '-'}
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="center"
                      gap={1.5}
                      flexWrap="wrap"
                      sx={{ mt: 1 }}
                    >
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Building2 size={13} aria-hidden="true" />
                        <Typography variant="caption" color="text.secondary">
                          {person.organizationName || '-'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <EmptyState
            title={t('myTeam.emptyTitle')}
            description={t('myTeam.emptyDescription')}
            action={
              <ActionButton intent="secondary" onClick={() => navigate('/hr/directory')}>
                {t('myTeam.openDirectory')}
              </ActionButton>
            }
          />
        )}
      </Paper>
    </Stack>
  );
}
