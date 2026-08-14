import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { getCalendarHome } from '@dwp-frontend/shared-utils';
import { ActionButton, ErrorState, PageCanvas, SignalMetric } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CalendarEventDialog } from './calendar-event-dialog';
import { CalendarPageHeading, calendarDate } from './calendar-components';

function hours(value: number) {
  return (value / 60).toFixed(value % 60 === 0 ? 0 : 1);
}

export function CalendarInsights() {
  const { t, i18n } = useTranslation('calendar');
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
    <PageCanvas>
      <CalendarPageHeading
        eyebrow={t('insights.eyebrow')}
        title={t('insights.title')}
        description={t('insights.description')}
        actions={
          <ActionButton
            intent="primary"
            startIcon={<CalendarPlus size={17} />}
            onClick={() => setFocusDialog(true)}
          >
            {t('insights.protectFocus')}
          </ActionButton>
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
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            <SignalMetric
              label={t('insights.metrics.meetingTime')}
              value={`${hours(query.data.metrics.meetingMinutes)}h`}
              detail={t('insights.metrics.meetingShare', { value: derived.meetingShare })}
              icon={<UsersRound size={17} />}
              tone="primary"
            />
            <SignalMetric
              label={t('insights.metrics.focusTime')}
              value={`${hours(query.data.metrics.focusMinutes)}h`}
              detail={t('insights.metrics.focusTarget')}
              icon={<Focus size={17} />}
              tone="success"
              progress={derived.focusProgress}
              progressLabel={`${derived.focusProgress}%`}
            />
            <SignalMetric
              label={t('insights.metrics.overloadDays')}
              value={String(derived.overloaded)}
              detail={t('insights.metrics.overloadDescription')}
              icon={<Gauge size={17} />}
              tone={derived.overloaded ? 'warning' : 'neutral'}
            />
            <SignalMetric
              label={t('insights.metrics.conflicts')}
              value={String(query.data.metrics.conflictCount)}
              detail={t('insights.metrics.conflictDescription')}
              icon={<AlertTriangle size={17} />}
              tone={query.data.metrics.conflictCount ? 'error' : 'neutral'}
            />
          </Box>

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
              <Box sx={{ p: 2.25 }}>
                <Typography component="h2" variant="h6" fontWeight={800}>
                  {t('insights.weekPattern')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('insights.weekPatternDescription')}
                </Typography>
              </Box>
              <Divider />
              <Stack spacing={2.25} sx={{ p: 2.5 }}>
                {query.data.weekLoad.map((day) => {
                  const max = Math.max(480, day.meetingMinutes + day.focusMinutes);
                  return (
                    <Box key={day.date}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ mb: 0.8 }}
                      >
                        <Typography variant="body2" fontWeight={750}>
                          {calendarDate(day.date, language)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={day.loadPercent > 100 ? 'error.main' : 'text.secondary'}
                          fontWeight={700}
                        >
                          {t('insights.utilization', { value: day.loadPercent })}
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          display: 'flex',
                          height: 14,
                          bgcolor: 'action.hover',
                          borderRadius: 0.5,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{ width: `${(day.meetingMinutes * 100) / max}%`, bgcolor: '#2563EB' }}
                        />
                        <Box
                          sx={{ width: `${(day.focusMinutes * 100) / max}%`, bgcolor: '#0F766E' }}
                        />
                      </Box>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('insights.meetingMinutes', { count: day.meetingMinutes })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('insights.focusMinutes', { count: day.focusMinutes })}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            <Box
              component="section"
              sx={{
                bgcolor: '#F6F8FB',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 2.25, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sparkles size={19} color="#7C3AED" />
                <Box>
                  <Typography component="h2" variant="h6" fontWeight={800}>
                    {t('insights.recommendations')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('insights.recommendationsDescription')}
                  </Typography>
                </Box>
              </Box>
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
                  <Typography fontWeight={750} sx={{ mt: 1 }}>
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
                  <Typography fontWeight={750} sx={{ mt: 1 }}>
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
                  <Typography fontWeight={750} sx={{ mt: 1 }}>
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

          <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
            <Clock3 size={15} />
            <Typography variant="caption">{t('insights.privateHint')}</Typography>
          </Stack>
        </Stack>
      )}

      <CalendarEventDialog
        open={focusDialog}
        initialType="FOCUS"
        onClose={() => setFocusDialog(false)}
      />
    </PageCanvas>
  );
}
