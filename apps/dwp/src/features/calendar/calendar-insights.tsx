import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  Clock3,
  Focus,
  Gauge,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCalendarHome, usePermissions } from '@dwp-frontend/shared-utils';
import { ActionButton, ErrorState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { CalendarEventDialog } from './calendar-event-dialog';
import {
  CalendarMetric,
  CalendarPageHeading,
  calendarDate,
  calendarTime,
} from './calendar-components';
import {
  CalendarCanvas,
  CalendarSectionHeader,
  CalendarWeekBalanceRail,
} from './calendar-experience';

function hours(value: number) {
  return (value / 60).toFixed(value % 60 === 0 ? 0 : 1);
}

export function CalendarInsights() {
  const { t, i18n } = useTranslation('calendar');
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const canCreate = hasPermission('APP.CALENDAR', 'CREATE');
  const [focusDialog, setFocusDialog] = useState(false);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  const query = useQuery({
    queryKey: ['calendar', 'home', timeZone],
    queryFn: () => getCalendarHome(timeZone),
    staleTime: 30_000,
    retry: 1,
  });
  const derived = useMemo(() => {
    if (!query.data) return null;
    const { metrics, weekLoad } = query.data;
    const total = metrics.meetingMinutes + metrics.focusMinutes;
    const focusProgress = Math.min(
      100,
      Math.round((metrics.focusMinutes * 100) / Math.max(1, metrics.focusTargetMinutes))
    );
    const overloaded = weekLoad.filter((day) => day.loadPercent > 100).length;
    const healthiest = [...weekLoad].sort((left, right) => left.loadPercent - right.loadPercent)[0];
    return {
      total,
      focusProgress,
      overloaded,
      healthiest,
      meetingShare: Math.round((metrics.meetingMinutes * 100) / Math.max(1, total)),
    };
  }, [query.data]);

  return (
    <CalendarCanvas archetype="command">
      <CalendarPageHeading
        icon={BarChart3}
        eyebrow={t('insights.eyebrow')}
        title={t('insights.title')}
        description={t('insights.description')}
        actions={
          canCreate ? (
            <ActionButton
              intent="primary"
              startIcon={<CalendarPlus size={17} />}
              onClick={() => setFocusDialog(true)}
            >
              {t('insights.protectFocus')}
            </ActionButton>
          ) : undefined
        }
      />

      {query.isError ? (
        <ErrorState
          title={t('insights.loadError')}
          description={t('error.description')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.isLoading || !query.data || !derived ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={128} />
          <Skeleton variant="rounded" height={410} />
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.7fr) minmax(300px, 0.8fr)' },
              gap: 2,
            }}
          >
            <Box
              component="section"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <CalendarSectionHeader
                icon={BarChart3}
                title={t('insights.weekPattern')}
                description={t('insights.weekPatternDescription')}
              />
              <Divider />
              <Box sx={{ p: 2.5 }}>
                <CalendarWeekBalanceRail
                  days={query.data.weekLoad.map((day) => ({
                    key: day.date,
                    label: calendarDate(day.date, language),
                    meetingMinutes: day.meetingMinutes,
                    focusMinutes: day.focusMinutes,
                    loadPercent: day.loadPercent,
                  }))}
                  meetingLabel={`${t('home.metrics.meetings')} (${t('units.minute')})`}
                  focusLabel={`${t('home.metrics.focus')} (${t('units.minute')})`}
                  utilizationLabel={(day) => t('insights.utilization', { value: day.loadPercent })}
                />
              </Box>
            </Box>

            <Box
              component="section"
              sx={{
                bgcolor: (theme) =>
                  alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.09 : 0.035),
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <CalendarSectionHeader
                icon={Sparkles}
                title={t('insights.recommendations')}
                description={t('insights.recommendationsDescription')}
              />
              <Divider />
              <Stack divider={<Divider flexItem />}>
                <Box sx={{ p: 2 }}>
                  <Chip
                    size="small"
                    icon={<Focus size={14} />}
                    label={t('insights.focusLabel')}
                    color={derived.focusProgress >= 100 ? 'success' : 'warning'}
                    variant="outlined"
                  />
                  <Typography fontWeight={600} sx={{ mt: 1 }}>
                    {derived.focusProgress >= 100
                      ? t('insights.focusProtected')
                      : t('insights.focusGap', {
                          count: Math.max(
                            0,
                            query.data.metrics.focusTargetMinutes - query.data.metrics.focusMinutes
                          ),
                        })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    {t('insights.focusAction')}
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Chip
                    size="small"
                    icon={<Clock3 size={14} />}
                    label={t('insights.balanceLabel')}
                    variant="outlined"
                  />
                  <Typography fontWeight={600} sx={{ mt: 1 }}>
                    {derived.healthiest
                      ? t('insights.bestWindow', {
                          date: calendarDate(derived.healthiest.date, language),
                        })
                      : t('insights.noBestWindow')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    {t('insights.bestWindowDescription')}
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Chip
                    size="small"
                    icon={<BarChart3 size={14} />}
                    label={t('insights.meetingLabel')}
                    variant="outlined"
                  />
                  <Typography fontWeight={600} sx={{ mt: 1 }}>
                    {derived.meetingShare > 70
                      ? t('insights.meetingHeavy')
                      : t('insights.meetingBalanced')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                    {t('insights.meetingAction')}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box
            component="section"
            aria-label={t('insights.title')}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            <CalendarMetric
              label={t('insights.metrics.meetingTime')}
              value={`${hours(query.data.metrics.meetingMinutes)}${t('units.hour')}`}
              hint={t('insights.metrics.meetingShare', { value: derived.meetingShare })}
              icon={UsersRound}
              tone="primary"
              onClick={() => navigate('/calendar/schedule')}
            />
            <CalendarMetric
              label={t('insights.metrics.focusTime')}
              value={`${hours(query.data.metrics.focusMinutes)}${t('units.hour')}`}
              hint={t('insights.metrics.focusTarget')}
              icon={Focus}
              tone="success"
              progress={derived.focusProgress}
              progressLabel={`${derived.focusProgress}%`}
              onClick={() => navigate('/calendar/focus')}
            />
            <CalendarMetric
              label={t('insights.metrics.overloadDays')}
              value={String(derived.overloaded)}
              hint={t('insights.metrics.overloadDescription')}
              icon={Gauge}
              tone={derived.overloaded ? 'warning' : 'neutral'}
            />
            <CalendarMetric
              label={t('insights.metrics.conflicts')}
              value={String(query.data.metrics.conflictCount)}
              hint={t('insights.metrics.conflictDescription')}
              icon={AlertTriangle}
              tone={query.data.metrics.conflictCount ? 'error' : 'neutral'}
              onClick={() => navigate('/calendar/invitations')}
            />
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            color="text.secondary"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Clock3 size={15} />
              <Typography variant="caption">{t('insights.privateHint')}</Typography>
            </Stack>
            <Typography variant="caption">
              {t('insights.updatedAt', {
                time: calendarTime(query.data.generatedAt, language),
              })}
            </Typography>
          </Stack>
        </Stack>
      )}

      {canCreate && (
        <CalendarEventDialog
          open={focusDialog}
          initialType="FOCUS"
          onClose={() => setFocusDialog(false)}
        />
      )}
    </CalendarCanvas>
  );
}
