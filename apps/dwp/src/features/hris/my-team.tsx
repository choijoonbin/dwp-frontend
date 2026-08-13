import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Network, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SignalMetric,
} from '@dwp-frontend/design-system';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import { getOrganizationChart } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../people/directory/person-avatar';
import { useHrisExperience } from './use-hris-experience';

export function MyTeam() {
  const { t } = useTranslation('hris');
  const navigate = useNavigate();
  const experience = useHrisExperience();
  const chart = useQuery({
    queryKey: ['hris', 'my-team', experience.currentPerson?.personId],
    queryFn: () => getOrganizationChart({ depth: 12, surface: 'directory' }),
    enabled: Boolean(experience.currentPerson),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const reports = useMemo(
    () =>
      (chart.data?.people ?? []).filter(
        (person) => person.managerPersonId === experience.currentPerson?.personId
      ),
    [chart.data?.people, experience.currentPerson?.personId]
  );
  const organizationNameById = useMemo(
    () =>
      new Map((chart.data?.organizations ?? []).map((item) => [item.organizationId, item.name])),
    [chart.data?.organizations]
  );
  const locationCount = new Set(reports.map((person) => person.locationName).filter(Boolean)).size;
  const managerCount = reports.filter((person) => person.directReportCount > 0).length;

  if (experience.currentPersonQuery.isLoading || chart.isLoading) {
    return <LoadingState size="standard" label={t('myTeam.loading')} />;
  }
  if (experience.currentPersonQuery.isError || chart.isError) {
    return (
      <ErrorState
        size="standard"
        title={t('common.loadError')}
        description={t('myTeam.loadError')}
        retryLabel={t('common.retry')}
        onRetry={() => {
          void experience.currentPersonQuery.refetch();
          void chart.refetch();
        }}
        retrying={experience.currentPersonQuery.isFetching || chart.isFetching}
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
          label={t('myTeam.signals.locations')}
          value={formatNumber(locationCount)}
          detail={t('myTeam.signals.locationsDetail')}
          icon={<MapPin size={17} />}
          tone="success"
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
                      {person.businessTitle || person.jobProfileName || '-'}
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
                          {organizationNameById.get(person.organizationId) ||
                            chart.data?.company.name ||
                            '-'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <MapPin size={13} aria-hidden="true" />
                        <Typography variant="caption" color="text.secondary">
                          {person.locationName || '-'}
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
