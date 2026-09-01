import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  GraduationCap,
  HeartPulse,
  ReceiptText,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionButton, EmptyState, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { PersonAvatar } from '../../components/person-avatar';
import { HcmSectionSurface, HcmStageRail, HcmToolLink, hcmToneColor } from './hcm-home-visuals';
import { HcmRhythmMetric } from './hcm-rhythm-metric';

import type { LucideIcon } from 'lucide-react';
import type {
  HomeWidgetSize,
  HrHomeOverview,
  OrganizationChartPerson,
} from '@dwp-frontend/shared-utils';
import type { HcmHomeWidgetKey } from './hcm-home-widget-registry';

export type HcmHomeMode = 'personal' | 'team';

export type HcmHomeToolLink = {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  route: string;
  badge?: string;
};

export type HcmHomeTimeStage = {
  label: string;
  detail: string;
  state: 'completed' | 'current' | 'upcoming';
};

type HcmHomeWidgetContentProps = {
  widgetKey: HcmHomeWidgetKey;
  size: HomeWidgetSize;
  homeMode: HcmHomeMode;
  tools: readonly HcmHomeToolLink[];
  overview: HrHomeOverview;
  currentTime: HrHomeOverview['time'];
  timeStages: HcmHomeTimeStage[];
  domainAvailable: (domain: keyof HrHomeOverview['domainStates']) => boolean;
  availableLeaveDays: number | null;
  usedLeaveDays: number | null;
  standardDayMinutes: number | null;
  primaryLeaveBalance: HrHomeOverview['leaveBalances'][number] | undefined;
  payDaysRemaining: number | null;
  nearestBenefitWindow: HrHomeOverview['enrollmentWindows'][number] | undefined;
  nearestBenefitWindowDays: number | null;
  activeJourney: HrHomeOverview['journeys'][number] | undefined;
  journeyTargetDays: number | null;
  selfDisplayName: string;
  businessTitle?: string | null;
  organizationName: string;
  email?: string | null;
  teamTimePendingCount: number | null;
  teamAbsencePendingCount: number | null;
  directReports: readonly OrganizationChartPerson[];
  teamLoading: boolean;
  teamError: boolean;
  onRetryTeam: () => void;
};

export function HcmHomeWidgetContent({
  widgetKey,
  size,
  homeMode,
  tools,
  overview,
  currentTime,
  timeStages,
  domainAvailable,
  availableLeaveDays,
  usedLeaveDays,
  standardDayMinutes,
  primaryLeaveBalance,
  payDaysRemaining,
  nearestBenefitWindow,
  nearestBenefitWindowDays,
  activeJourney,
  journeyTargetDays,
  selfDisplayName,
  businessTitle,
  organizationName,
  email,
  teamTimePendingCount,
  teamAbsencePendingCount,
  directReports,
  teamLoading,
  teamError,
  onRetryTeam,
}: HcmHomeWidgetContentProps) {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();

  switch (widgetKey) {
    case 'quick-actions':
      return (
        <Box component="section" aria-labelledby="hcm-tools-title">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            justifyContent="space-between"
            gap={1}
            sx={{ mb: 1.25 }}
          >
            <Box>
              <Typography id="hcm-tools-title" component="h2" variant="h6" fontWeight={800}>
                {t('home.tools.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                {t('home.tools.meta')}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t('home.tools.count', { count: tools.length })}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, 1fr)',
              },
              gap: 0.8,
            }}
          >
            {tools.map((tool) => (
              <HcmToolLink
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                description={tool.description}
                badge={tool.badge}
                onClick={() => navigate(tool.route)}
              />
            ))}
          </Box>
        </Box>
      );
    case 'people-signals':
      return (
        <Box id="hcm-rhythm" tabIndex={-1} sx={{ scrollMarginTop: 16 }}>
          <HcmSectionSurface
            eyebrow={t(`home.rhythm.${homeMode}.eyebrow`)}
            title={t(`home.rhythm.${homeMode}.title`)}
            meta={t(`home.rhythm.${homeMode}.meta`)}
          >
            <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
              {homeMode === 'personal' && (
                <Stack gap={1.5}>
                  <Box
                    sx={(theme) => ({
                      p: { xs: 1.4, sm: 1.75 },
                      borderRadius: 1,
                      bgcolor: alpha(
                        hcmToneColor.teal,
                        theme.palette.mode === 'dark' ? 0.1 : 0.035
                      ),
                    })}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                      gap={1.25}
                      sx={{ mb: 1.5 }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={800}>
                          {t('home.rhythm.time.title')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {currentTime
                            ? t('home.rhythm.time.period', {
                                start: formatDate(currentTime.periodStart, {
                                  dateStyle: 'medium',
                                }),
                                end: formatDate(currentTime.periodEnd, { dateStyle: 'medium' }),
                              })
                            : t('home.rhythm.time.noCard')}
                        </Typography>
                      </Box>
                      <ActionButton
                        intent="quiet"
                        size="small"
                        endIcon={<ArrowRight size={15} />}
                        onClick={() => navigate('/hr/time')}
                      >
                        {t('home.rhythm.time.open')}
                      </ActionButton>
                    </Stack>
                    <HcmStageRail label={t('home.rhythm.time.title')} stages={timeStages} />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        xl: size === 'full' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, 1fr)',
                      },
                      gap: 0.8,
                    }}
                  >
                    <HcmRhythmMetric
                      icon={CalendarDays}
                      label={t('home.rhythm.leave.label')}
                      value={
                        !domainAvailable('ABSENCE') || availableLeaveDays === null
                          ? t('home.states.unavailable')
                          : t('home.values.days', { value: availableLeaveDays })
                      }
                      detail={
                        domainAvailable('ABSENCE') && primaryLeaveBalance
                          ? t('home.rhythm.leave.detail', {
                              used: usedLeaveDays,
                              pending:
                                standardDayMinutes === null
                                  ? t('home.states.unavailable')
                                  : Math.round(
                                      (primaryLeaveBalance.pendingMinutes / standardDayMinutes) * 10
                                    ) / 10,
                            })
                          : t('home.rhythm.leave.noPlan')
                      }
                      progress={
                        domainAvailable('ABSENCE') && primaryLeaveBalance?.grantedMinutes
                          ? (primaryLeaveBalance.usedMinutes / primaryLeaveBalance.grantedMinutes) *
                            100
                          : undefined
                      }
                      onClick={() => navigate('/hr/absence')}
                    />
                    <HcmRhythmMetric
                      icon={ReceiptText}
                      label={t('home.rhythm.pay.label')}
                      value={
                        !domainAvailable('PAY') || payDaysRemaining === null
                          ? t('home.states.unavailable')
                          : t('home.values.dDay', { value: payDaysRemaining })
                      }
                      detail={
                        domainAvailable('PAY') && overview.pay
                          ? t('home.rhythm.pay.scheduleDetail')
                          : t('home.rhythm.pay.noCycle')
                      }
                      onClick={() => navigate('/hr/pay')}
                    />
                    <HcmRhythmMetric
                      icon={HeartPulse}
                      label={t('home.rhythm.benefits.label')}
                      value={
                        domainAvailable('BENEFITS')
                          ? t('home.values.count', { value: overview.activeBenefitCount })
                          : t('home.states.unavailable')
                      }
                      detail={
                        !domainAvailable('BENEFITS')
                          ? t('home.states.unavailable')
                          : nearestBenefitWindow
                            ? t('home.rhythm.benefits.window', {
                                days: nearestBenefitWindowDays ?? 0,
                              })
                            : t('home.rhythm.benefits.steady')
                      }
                      onClick={() => navigate('/hr/benefits')}
                    />
                    <HcmRhythmMetric
                      icon={GraduationCap}
                      label={t('home.rhythm.journey.label')}
                      value={
                        !domainAvailable('TALENT')
                          ? t('home.states.unavailable')
                          : activeJourney
                            ? `${activeJourney.progressPercent}%`
                            : t('home.rhythm.journey.emptyValue')
                      }
                      detail={
                        !domainAvailable('TALENT')
                          ? t('home.states.unavailable')
                          : activeJourney
                            ? t('home.rhythm.journey.detail', {
                                name: activeJourney.name,
                                days: journeyTargetDays ?? '-',
                              })
                            : t('home.rhythm.journey.empty')
                      }
                      progress={
                        domainAvailable('TALENT') ? activeJourney?.progressPercent : undefined
                      }
                      onClick={() => navigate('/hr/talent')}
                    />
                  </Box>
                </Stack>
              )}
              {homeMode === 'team' && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 0.8,
                  }}
                >
                  <HcmRhythmMetric
                    icon={Clock3}
                    label={t('home.rhythm.team.time')}
                    value={
                      !domainAvailable('TEAM') || teamTimePendingCount === null
                        ? t('home.states.unavailable')
                        : t('home.values.count', { value: teamTimePendingCount })
                    }
                    detail={t('home.rhythm.team.timeDetail')}
                    onClick={() => navigate('/hr/team/time')}
                  />
                  <HcmRhythmMetric
                    icon={CalendarDays}
                    label={t('home.rhythm.team.absence')}
                    value={
                      !domainAvailable('TEAM') || teamAbsencePendingCount === null
                        ? t('home.states.unavailable')
                        : t('home.values.count', { value: teamAbsencePendingCount })
                    }
                    detail={t('home.rhythm.team.absenceDetail')}
                    onClick={() => navigate('/hr/team/absence')}
                  />
                  <HcmRhythmMetric
                    icon={UsersRound}
                    label={t('home.rhythm.team.people')}
                    value={t('home.values.people', {
                      value: overview.employee.directReportCount,
                    })}
                    detail={t('home.rhythm.team.peopleDetail')}
                    onClick={() => navigate('/hr/team')}
                  />
                </Box>
              )}
            </Box>
          </HcmSectionSurface>
        </Box>
      );
    case 'profile':
      return (
        <HcmSectionSurface
          eyebrow={t('home.profile.eyebrow')}
          title={t('home.profile.title')}
          meta={t('home.profile.meta')}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/me')}>
              {t('home.profile.open')}
            </ActionButton>
          }
        >
          <Stack gap={1.5} sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <PersonAvatar name={selfDisplayName} size={48} />
              <Box minWidth={0}>
                <Typography fontWeight={800}>{selfDisplayName}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {businessTitle || t('home.profile.titleFallback')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {organizationName}
                </Typography>
              </Box>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: size === 'medium' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                gap: 1,
              }}
            >
              {[
                [t('home.profile.manager'), overview.employee.managerDisplayName],
                [t('home.profile.email'), email],
              ].map(([label, value]) => (
                <Box key={label} minWidth={0}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={720} sx={{ mt: 0.15 }}>
                    {value || t('home.states.unavailable')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        </HcmSectionSurface>
      );
    case 'team':
      return (
        <HcmSectionSurface
          eyebrow={t('home.team.eyebrow')}
          title={t('home.team.title')}
          meta={t('home.team.meta', {
            count: overview.employee.directReportCount,
          })}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => navigate('/hr/team')}>
              {t('home.team.open')}
            </ActionButton>
          }
        >
          {teamLoading ? (
            <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
              <LoadingState
                label={t('domains.loading')}
                variant="skeleton"
                size="compact"
                embedded
                skeletonRows={2}
                skeletonHeight={52}
                skeletonGap={0.8}
              />
            </Box>
          ) : teamError ? (
            <Stack alignItems="center" gap={1} role="alert" sx={{ pb: 2 }}>
              <EmptyState
                size="compact"
                title={t('home.team.loadErrorTitle')}
                description={t('home.team.loadErrorDescription')}
              />
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<RefreshCw size={15} />}
                onClick={onRetryTeam}
              >
                {t('common.retry')}
              </ActionButton>
            </Stack>
          ) : directReports.length ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: size === 'medium' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                },
                gap: 0.7,
                px: { xs: 1.5, md: 2 },
                pb: 2,
              }}
            >
              {directReports.slice(0, size === 'medium' ? 4 : 6).map((report) => (
                <Stack
                  key={report.personId}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={{ px: 1, py: 0.9, minWidth: 0, borderBottom: 1, borderColor: 'divider' }}
                >
                  <PersonAvatar name={report.displayName} size={36} />
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={760} sx={{ overflowWrap: 'anywhere' }}>
                      {report.displayName}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {report.businessTitle || t('home.profile.titleFallback')}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          ) : (
            <EmptyState
              size="compact"
              title={t('home.team.emptyTitle')}
              description={t('home.team.emptyDescription')}
            />
          )}
        </HcmSectionSurface>
      );
  }
}
