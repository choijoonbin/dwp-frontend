import { useTranslation } from 'react-i18next';
import { CalendarRange, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getHrTeamAbsence } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';
import {
  ApprovalQueue,
  DomainSection,
  ProgressSignal,
  QueryBoundary,
  StatusChip,
} from './hr-domain-components';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

export function HrTeamAbsenceWorkspace() {
  const { t } = useTranslation('hcm');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.team',
  });
  const query = useQuery({
    queryKey: ['hcm', 'team', 'absence', ...requestScope.cacheKey],
    queryFn: ({ signal }) => getHrTeamAbsence(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const teamCalendar = query.data?.teamCalendar ?? [];
  const pending = query.data?.teamQueue.length ?? 0;
  const teamMembersAway = new Set(teamCalendar.map((absence) => absence.personId)).size;

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.isError}
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
            label={t('domains.absence.teamPending')}
            value={String(pending)}
            detail={t('domains.absence.teamPendingDetail')}
            progress={Math.min(100, pending * 20)}
            tone={pending ? 'warning' : 'success'}
          />
          <ProgressSignal
            label={t('domains.absence.upcomingCoverage')}
            value={String(teamMembersAway)}
            detail={t('domains.absence.upcomingCoverageDetail', { count: teamCalendar.length })}
            progress={Math.min(100, teamMembersAway * 20)}
            tone={teamMembersAway ? 'primary' : 'success'}
          />
        </Box>
        <ApprovalQueue
          domain="absence"
          decisionScope="team"
          items={query.data?.teamQueue ?? []}
          title={t('domains.absence.queueTitle')}
          description={t('domains.absence.queueDescription')}
        />
        <DomainSection
          title={t('domains.absence.teamCalendarTitle')}
          description={t('domains.absence.teamCalendarDescription')}
        >
          {teamCalendar.length ? (
            <Box>
              {teamCalendar.map((absence, index) => (
                <Box key={absence.requestId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    gap={1.25}
                    sx={{ px: 2, py: 1.5 }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25} minWidth={0} flex={1}>
                      <PersonAvatar name={absence.employeeName} size={38} />
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750} noWrap>
                          {absence.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {[absence.employeeTitle, absence.planName].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CalendarRange size={16} aria-hidden="true" />
                      <Typography variant="caption" fontWeight={700}>
                        {formatDate(absence.startAt, { dateStyle: 'medium' })} -{' '}
                        {formatDate(absence.endAt, { dateStyle: 'medium' })}
                      </Typography>
                      <StatusChip status={absence.status} />
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('domains.absence.noTeamAbsenceTitle')}
              description={t('domains.absence.noTeamAbsenceDescription')}
            />
          )}
        </DomainSection>
      </Stack>
    </QueryBoundary>
  );
}
