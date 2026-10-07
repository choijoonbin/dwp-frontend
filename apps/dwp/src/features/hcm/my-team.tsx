import { useTranslation } from 'react-i18next';
import { Building2, CalendarDays, ClipboardCheck, Clock3, Network, UsersRound } from 'lucide-react';
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
import {
  appendProductPageShortcutScope,
  PRODUCT_PAGE_SHORTCUT_TARGETS,
  useProductPageShortcutAccess,
} from '../../components/product-page-shortcut-access';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import { DomainSection } from './hr-domain-components';
import { HrTeamScopeContext } from './hr-team-scope-context';
import {
  buildHrTeamDecisionDestinations,
  hrTeamMemberDirectoryPath,
} from './hr-team-workspace-model';

export function MyTeam() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.team',
  });
  const teamTimeAccess = useProductPageShortcutAccess(PRODUCT_PAGE_SHORTCUT_TARGETS.hcmTeamTime);
  const teamAbsenceAccess = useProductPageShortcutAccess(
    PRODUCT_PAGE_SHORTCUT_TARGETS.hcmTeamAbsence
  );
  const directoryAccess = useProductPageShortcutAccess(PRODUCT_PAGE_SHORTCUT_TARGETS.hcmDirectory);
  const organizationAccess = useProductPageShortcutAccess(
    PRODUCT_PAGE_SHORTCUT_TARGETS.hcmOrganization
  );
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
  const decisionDestinations = team.data
    ? buildHrTeamDecisionDestinations(team.data).filter(({ domain }) =>
        domain === 'time' ? teamTimeAccess.disclosed : teamAbsenceAccess.disclosed
      )
    : [];

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
      {team.data && (
        <HrTeamScopeContext
          manager={team.data.manager}
          dataBoundary={team.data.dataBoundary}
          refreshedAt={team.dataUpdatedAt}
        />
      )}
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

      {decisionDestinations.length > 0 && (
        <DomainSection title={t('home.rhythm.team.title')} description={t('home.rhythm.team.meta')}>
          <Box>
            {decisionDestinations.map((destination, index) => {
              const time = destination.domain === 'time';
              const Icon = time ? Clock3 : CalendarDays;
              const access = time ? teamTimeAccess : teamAbsenceAccess;
              return (
                <Box key={destination.domain}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25} minWidth={0} flex={1}>
                      <Icon size={18} aria-hidden="true" />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750}>
                          {t(`home.rhythm.team.${time ? 'time' : 'absence'}`)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t(`home.rhythm.team.${time ? 'timeDetail' : 'absenceDetail'}`)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={destination.count ? 'warning' : 'success'}
                        label={t('home.needsAttention.count', { count: destination.count })}
                      />
                      <ActionButton
                        intent={destination.count ? 'primary' : 'secondary'}
                        size="small"
                        onClick={() =>
                          navigate(appendProductPageShortcutScope(destination.route, access))
                        }
                      >
                        {t(`home.needsAttention.${time ? 'reviewTime' : 'reviewLeave'}`)}
                      </ActionButton>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </DomainSection>
      )}

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
          {organizationAccess.disclosed && (
            <ActionButton
              intent="secondary"
              size="small"
              onClick={() =>
                navigate(appendProductPageShortcutScope('/hr/organization', organizationAccess))
              }
            >
              {t('myTeam.roster.openOrganization')}
            </ActionButton>
          )}
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
                    {directoryAccess.disclosed && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        sx={{ mt: 0.75 }}
                        aria-label={`${t('home.profile.open')}: ${person.displayName}`}
                        onClick={() =>
                          navigate(
                            appendProductPageShortcutScope(
                              hrTeamMemberDirectoryPath(person.personId),
                              directoryAccess
                            )
                          )
                        }
                      >
                        {t('home.profile.open')}
                      </ActionButton>
                    )}
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
              directoryAccess.disclosed ? (
                <ActionButton
                  intent="secondary"
                  onClick={() =>
                    navigate(appendProductPageShortcutScope('/hr/directory', directoryAccess))
                  }
                >
                  {t('myTeam.openDirectory')}
                </ActionButton>
              ) : undefined
            }
          />
        )}
      </Paper>
    </Stack>
  );
}
