import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  GraduationCap,
  ReceiptText,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionButton, EmptyState, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { PersonAvatar } from '../../components/person-avatar';
import { shellMobileContextRailHeight } from '../../components/shell-header';
import { HcmSectionSurface, HcmStageRail, HcmToolLink, hcmToneColor } from './hcm-home-visuals';
import {
  hcmHomeProviderIsAvailable,
  hcmHomeProviderRoute,
  type HcmHomeProviderPayloadMap,
  type HcmHomeProviderSnapshot,
  type HcmHomeProviderWidgetId,
} from './hcm-home-provider-adapter';
import { HcmRhythmMetric } from './hcm-rhythm-metric';

import type { LucideIcon } from 'lucide-react';
import type { HomeWidgetSize, HrHomeDomain } from '@dwp-frontend/shared-utils';
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
  providerSnapshots: readonly HcmHomeProviderSnapshot[];
  tools: readonly HcmHomeToolLink[];
  currentTime: HcmHomeProviderPayloadMap['tim-self-time'] | null;
  timeStages: HcmHomeTimeStage[];
  domainAvailable: (domain: HrHomeDomain) => boolean;
  availableLeaveDays: number | null;
  usedLeaveDays: number | null;
  standardDayMinutes: number | null;
  primaryLeaveBalance: NonNullable<
    HcmHomeProviderPayloadMap['tim-self-absence']['displayBalance']
  > | null;
  payDaysRemaining: number | null;
  hasPayCycle: boolean;
  activeGoalCount: number;
  requiredLearningCount: number;
  activeJourneyCount: number;
  activeJourneyProgressPercent: number | null;
  journeyTargetDays: number | null;
  selfDisplayName: string;
  businessTitle?: string | null;
  organizationName: string;
  managerDisplayName: string | null;
  teamTimePendingCount: number | null;
  teamAbsencePendingCount: number | null;
  directReportCount: number | null;
};

export function HcmHomeWidgetContent({
  widgetKey,
  size,
  homeMode,
  providerSnapshots,
  tools,
  currentTime,
  timeStages,
  domainAvailable,
  availableLeaveDays,
  usedLeaveDays,
  standardDayMinutes,
  primaryLeaveBalance,
  payDaysRemaining,
  hasPayCycle,
  activeGoalCount,
  requiredLearningCount,
  activeJourneyCount,
  activeJourneyProgressPercent,
  journeyTargetDays,
  selfDisplayName,
  businessTitle,
  organizationName,
  managerDisplayName,
  teamTimePendingCount,
  teamAbsencePendingCount,
  directReportCount,
}: HcmHomeWidgetContentProps) {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const providerState = (widgetId: HcmHomeProviderWidgetId) =>
    providerSnapshots.find((snapshot) => snapshot.widgetId === widgetId)?.state ?? 'UNREGISTERED';
  const providerAvailable = (widgetId: HcmHomeProviderWidgetId) =>
    hcmHomeProviderIsAvailable(providerSnapshots, widgetId);
  const providerRoute = (widgetId: HcmHomeProviderWidgetId) =>
    hcmHomeProviderRoute(providerSnapshots, widgetId);
  const selfTimeRoute = providerRoute('tim-self-time');
  const selfAbsenceRoute = providerRoute('tim-self-absence');
  const teamTimeRoute = providerRoute('tim-team-time-decisions');
  const teamAbsenceRoute = providerRoute('tim-team-absence-decisions');
  const payRoute = providerRoute('pay-self-cycle');
  const performanceRoute = providerRoute('per-self-performance');
  const profileRoute = providerRoute('hrm-self-employment');
  const teamRoute = providerRoute('hrm-team-shape');

  switch (widgetKey) {
    case 'quick-actions':
      return (
        <Box
          component="section"
          aria-labelledby="hcm-tools-title"
          data-hris-home-horizon="NOW NEXT CHANGED"
        >
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
        <Box
          id="hcm-rhythm"
          tabIndex={-1}
          data-hris-home-horizon={homeMode === 'team' ? 'NOW CHANGED' : 'NOW NEXT CHANGED'}
          sx={{
            // The home uses document scrolling. Keep the programmatically focused
            // rhythm landmark below the fixed command header; reserve the compact
            // mobile context rail as well so a future/product-surface rail cannot
            // obscure the focus target.
            scrollMarginBlockStart: {
              xs: `${foundationTokens.layout.headerHeight + shellMobileContextRailHeight + 16}px`,
              lg: `${foundationTokens.layout.headerHeight + 16}px`,
            },
          }}
        >
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
                                start: currentTime.periodStart
                                  ? formatDate(currentTime.periodStart, {
                                      dateStyle: 'medium',
                                    })
                                  : t('home.states.unavailable'),
                                end: currentTime.periodEnd
                                  ? formatDate(currentTime.periodEnd, { dateStyle: 'medium' })
                                  : t('home.states.unavailable'),
                              })
                            : t('home.rhythm.time.noCard')}
                        </Typography>
                      </Box>
                      {selfTimeRoute && (
                        <ActionButton
                          intent="quiet"
                          size="small"
                          endIcon={<ArrowRight size={15} />}
                          onClick={() => navigate(selfTimeRoute)}
                        >
                          {t('home.rhythm.time.open')}
                        </ActionButton>
                      )}
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
                      onClick={selfAbsenceRoute ? () => navigate(selfAbsenceRoute) : undefined}
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
                        domainAvailable('PAY') && hasPayCycle
                          ? t('home.rhythm.pay.scheduleDetail')
                          : t('home.rhythm.pay.noCycle')
                      }
                      onClick={payRoute ? () => navigate(payRoute) : undefined}
                    />
                    <HcmRhythmMetric
                      icon={GraduationCap}
                      label={t('home.rhythm.journey.label')}
                      value={
                        !domainAvailable('TALENT')
                          ? t('home.states.unavailable')
                          : activeJourneyProgressPercent !== null
                            ? `${activeJourneyProgressPercent}%`
                            : activeJourneyCount > 0
                              ? t('home.values.count', { value: activeJourneyCount })
                              : t('home.rhythm.journey.emptyValue')
                      }
                      detail={
                        !domainAvailable('TALENT')
                          ? t('home.states.unavailable')
                          : activeJourneyCount > 0 ||
                              activeGoalCount > 0 ||
                              requiredLearningCount > 0
                            ? t('home.rhythm.journey.detail', {
                                name: t('home.rhythm.journey.label'),
                                days: journeyTargetDays ?? '-',
                              })
                            : t('home.rhythm.journey.empty')
                      }
                      progress={
                        domainAvailable('TALENT')
                          ? (activeJourneyProgressPercent ?? undefined)
                          : undefined
                      }
                      onClick={performanceRoute ? () => navigate(performanceRoute) : undefined}
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
                      !providerAvailable('tim-team-time-decisions') || teamTimePendingCount === null
                        ? t('home.states.unavailable')
                        : t('home.values.count', { value: teamTimePendingCount })
                    }
                    detail={t('home.rhythm.team.timeDetail')}
                    onClick={teamTimeRoute ? () => navigate(teamTimeRoute) : undefined}
                  />
                  <HcmRhythmMetric
                    icon={CalendarDays}
                    label={t('home.rhythm.team.absence')}
                    value={
                      !providerAvailable('tim-team-absence-decisions') ||
                      teamAbsencePendingCount === null
                        ? t('home.states.unavailable')
                        : t('home.values.count', { value: teamAbsencePendingCount })
                    }
                    detail={t('home.rhythm.team.absenceDetail')}
                    onClick={teamAbsenceRoute ? () => navigate(teamAbsenceRoute) : undefined}
                  />
                  <HcmRhythmMetric
                    icon={UsersRound}
                    label={t('home.rhythm.team.people')}
                    value={
                      providerAvailable('hrm-team-shape')
                        ? t('home.values.people', {
                            value: directReportCount ?? 0,
                          })
                        : t('home.states.unavailable')
                    }
                    detail={t('home.rhythm.team.peopleDetail')}
                    onClick={teamRoute ? () => navigate(teamRoute) : undefined}
                  />
                </Box>
              )}
            </Box>
          </HcmSectionSurface>
        </Box>
      );
    case 'profile':
      return (
        <Box
          data-hris-home-provider="hrm-self-employment"
          data-hris-home-provider-state={providerState('hrm-self-employment')}
        >
          <HcmSectionSurface
            eyebrow={t('home.profile.eyebrow')}
            title={t('home.profile.title')}
            meta={t('home.profile.meta')}
            action={
              profileRoute ? (
                <ActionButton intent="quiet" size="small" onClick={() => navigate(profileRoute)}>
                  {t('home.profile.open')}
                </ActionButton>
              ) : undefined
            }
          >
            {providerAvailable('hrm-self-employment') ? (
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
                  {[[t('home.profile.manager'), managerDisplayName]].map(([label, value]) => (
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
            ) : (
              <EmptyState
                size="compact"
                title={t('home.needsAttention.unavailableTitle')}
                description={t('home.needsAttention.personalUnavailable')}
              />
            )}
          </HcmSectionSurface>
        </Box>
      );
    case 'team':
      return (
        <Box
          data-hris-home-provider="hrm-team-shape"
          data-hris-home-provider-state={providerState('hrm-team-shape')}
        >
          <HcmSectionSurface
            eyebrow={t('home.team.eyebrow')}
            title={t('home.team.title')}
            meta={t('home.team.meta', {
              count: providerAvailable('hrm-team-shape') ? (directReportCount ?? 0) : 0,
            })}
            action={
              teamRoute ? (
                <ActionButton intent="quiet" size="small" onClick={() => navigate(teamRoute)}>
                  {t('home.team.open')}
                </ActionButton>
              ) : undefined
            }
          >
            {!providerAvailable('hrm-team-shape') ? (
              <EmptyState
                size="compact"
                title={t('home.needsAttention.unavailableTitle')}
                description={t('home.needsAttention.teamUnavailable')}
              />
            ) : (directReportCount ?? 0) > 0 ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={1.25}
                sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}
              >
                <UsersRound size={28} color={hcmToneColor.teal} aria-hidden="true" />
                <Box>
                  <Typography variant="h6" fontWeight={820}>
                    {t('home.values.people', { value: directReportCount })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('home.rhythm.team.peopleDetail')}
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <EmptyState
                size="compact"
                title={t('home.team.emptyTitle')}
                description={t('home.team.emptyDescription')}
              />
            )}
          </HcmSectionSurface>
        </Box>
      );
  }
}
